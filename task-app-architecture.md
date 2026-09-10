# Technical Architecture & Free Infrastructure Plan

**Hard constraint driving every choice below: $0/month, no mandatory paid tier, suitable for ~5 users.**

---

## 1. Recommended Architecture (Overview)

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | React (PWA-enabled) | One codebase, installable-but-optional, huge free tooling ecosystem |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | One integrated platform instead of stitching 5 separate free services together — fewer moving parts, fewer accounts, fewer things to break |
| Database | Supabase Postgres (managed) | Real relational database, free tier, built-in row-level security for the "task privacy" requirement |
| Authentication | Supabase Auth | Free, handles password/session/reset out of the box, integrates natively with the database's permission rules |
| Realtime | Supabase Realtime (Postgres change subscriptions) | Free, no separate WebSocket service needed, "Admin sees update instantly" comes for free |
| File storage | Supabase Storage | Bundled with the same free account, 1 GB free |
| Hosting | Cloudflare Pages | Free, unlimited bandwidth, no "non-commercial use only" clause (see risk note on Vercel below), fast global CDN, HTTPS by default |
| Notifications | In-app (via Realtime) + Web Push (browser, free/native) + email (free-tier transactional email) | No paid push service required; WhatsApp stays a manual share channel, not an API |

**Important honesty note on hosting:** Vercel's free "Hobby" tier is excellent technically, but its terms restrict it to personal, non-commercial projects — a tool used to run your business/team is arguably commercial use, which is a real (if commonly overlooked) violation risk. Cloudflare Pages has no such restriction and is recommended instead for that reason alone, not a technical one.

Every layer above has a genuine $0 tier with no credit card requirement, and all can be swapped later without a rewrite if you outgrow them (see Section 16).

---

## 2. Hosting

**Cloudflare Pages** deployment flow:
1. Code lives in a GitHub repository (free, private repos included).
2. Cloudflare Pages connects to that repo; every push to the main branch triggers an automatic build and deploy.
3. Cloudflare issues a free subdomain automatically: `your-app-name.pages.dev`, HTTPS included by default, works identically on mobile and desktop browsers.
4. PWA support (manifest + service worker) is just static files served like any other asset — no special hosting feature required.
5. No local server, no server maintenance — it's a static/edge deployment; the app talks directly to Supabase from the browser.

If you later want `tasks.yourcompany.com` instead of the `.pages.dev` subdomain, that's a DNS change only (a domain is optional, not a rebuild).

## 3. Domain

Use the free `*.pages.dev` subdomain at launch. It's a real HTTPS URL, shareable via WhatsApp exactly like any link, and requires zero configuration. A custom domain can be attached later purely as a cosmetic upgrade — nothing about the architecture depends on it.

## 4. Database (Logical Model)

Entities and relationships, conceptually (no SQL yet):

- **Users** — one record per person; holds name, role (Admin/User), contact info, active/inactive flag.
- **Tasks** — the central entity: title, description, priority, deadline, status, proof-required flag, references to who created it and who it's assigned to, optional link to a Recurring Template or a Monthly Closing Item.
- **Task Assignments** — kept as fields on Task itself (assigned_by, assigned_to) rather than a separate table, since each task has exactly one current assignee — simpler than a join table for this scale.
- **Task Status** — not a separate table; a status field on Task, with the *history* of status changes captured in Activity History instead (so "current status" and "how we got here" are cleanly separated).
- **Comments** — many-to-one with Task; author, text, timestamp.
- **Attachments** — many-to-one with Task; file reference (pointer into Storage), uploader, timestamp.
- **Notifications** — one per user per event; references the Task that triggered it, read/unread flag, type, timestamp.
- **Activity History** — an append-only log: task reference, actor, action type, timestamp, optional notes. This table is never updated or deleted from — see Section 12.
- **Recurring Templates** — the repeating "recipe" (title, assignee, frequency, day-of-week/month, end condition); each occurrence it generates becomes a normal Task row referencing the template.
- **Monthly Closing** — a named period (e.g. "September 2026"), owns many **Closing Items**.
- **Closing Items** — each one *is* a Task (via the same link Task has to Monthly Closing), plus an order/sequence number for checklist display.
- **Approval Records** — captured as Activity History entries (approved/rejected/who/when/comment) rather than a separate table — approval is a type of event, not a separate entity, keeping the model simpler.

**Relationships in one line:** A User creates and is assigned Tasks; a Task optionally belongs to a Recurring Template or a Monthly Closing; every Task has many Comments, Attachments, and Activity History entries; every important event on a Task also creates a Notification for the relevant User(s).

## 5. Authentication

- **Login:** email + password (or magic link, since it's only ~5 people) via Supabase Auth.
- **Logout:** clears the session token client-side; standard.
- **Password recovery:** Supabase's built-in "forgot password" email flow — free, no custom email server needed.
- **Session handling:** Supabase issues a long-lived session so people aren't asked to log in every time they tap a WhatsApp link — this matters a lot given how often the app is opened.
- **Roles:** a single `role` field (`admin` / `user`) on the Users table, checked both in the UI (what buttons show) and in the database's row-level security rules (what's actually allowed — the UI check alone is not security).
- **Deactivated users:** an `active` flag; deactivated accounts can't log in and their name simply shows on historical tasks as "Ahmed (deactivated)" rather than deleting their history.
- **Unauthorized access:** anyone not logged in, or logged in but not authorized for a given task, gets a clear "You don't have access to this task" screen — never a raw error or a silent redirect to someone else's data.

## 6. WhatsApp Task Link Architecture (critical section)

**The mechanism:** every task has a unique, unguessable ID. The shareable link is simply:
`https://your-app.pages.dev/task/{task-id}`

There is no WhatsApp API involved — the Admin just copies this link into a normal WhatsApp message, exactly like sharing a YouTube link. WhatsApp is purely a delivery channel; the app doesn't know or care that WhatsApp was used.

**How it works securely, step by step:**
1. The person taps the link → lands directly on that task's focused view, not the dashboard (a deep link, not a search).
2. The app checks: *is someone logged in right now?* If yes, it immediately checks the database rule: *is this logged-in person the assignee, the creator, or an Admin?* If yes, they see the task. If no, they see "You don't have access to this task."
3. If nobody is logged in, they're shown a lightweight login (since it's an internal team of ~5, this can be as simple as "enter your name/PIN") — after which the same authorization check runs.
4. **This authorization check happens in the database itself (row-level security), not just in the app's UI** — so even a modified request or a shared browser session can't bypass it.

**Forwarded links:** if Bilal forwards his task link to Ahmed, Ahmed still has to log in as himself, and the database rule still says "only Bilal (or Admin) can view/act on this task" — so forwarding a link doesn't leak access. Ahmed would see the "no access" screen even though he has the URL.

**After finalization:** the link keeps working (so history/proof remains reviewable), but the action buttons disappear once a task is Approved/Finalized — the page becomes read-only for everyone who could see it before.

**Link expiry:** the link itself does not expire — it's tied to the task's lifetime, not to a timer — because Admins may need to revisit a task's link months later for records. Security comes from the login + authorization check on every visit, not from the link going stale.

## 7. Realtime Updates

Supabase Realtime subscribes the Admin's dashboard to "any task where I'm the creator or Admin, notify me on change." When Bilal marks a task Completed, the database row updates, Supabase pushes that change over an already-open connection, and the Admin's screen updates within roughly a second — no manual refresh, no polling loop needed.

**If a user loses internet mid-action:** the action (e.g. "Mark Complete") simply fails to send and the button shows a clear "Couldn't save — check your connection, tap to retry" state. Nothing is silently lost or silently duplicated; the user always knows whether their tap "took."

## 8. Notifications

| Type | Mechanism | Cost | Notes |
|---|---|---|---|
| In-app | Realtime + a Notifications table | Free | Always works, foundation layer |
| Browser push | Web Push API (native browser capability) | Free | Works even if the site isn't open, but requires the user to have granted permission once — not guaranteed on first visit |
| Email | Free-tier transactional email service (e.g. a provider with a no-cost monthly quota well above ~5 users' needs) | Free at this scale | Good fallback for "deadline approaching" type nudges |
| WhatsApp | None (no automated API) | N/A | WhatsApp remains manual link-sharing only, per your requirement — the app cannot push a WhatsApp message on its own without a paid API |

Realistic expectation: in-app + browser push covers "Admin is looking at the app or has it open in a background tab." Email is the safety net for anything time-sensitive when nobody's watching the app. True automated WhatsApp notifications are the one thing that genuinely isn't free — that's a deliberate, disclosed limitation, not an oversight.

## 9. Offline / Poor Internet

Kept intentionally simple, not a full offline-sync engine:
- **Can work offline:** viewing a task page the browser already loaded/cached; reading previously-loaded lists.
- **Cached:** the app shell (so the page frame loads instantly even on a bad connection) via a standard PWA service worker.
- **Actions taken offline:** not silently queued — this avoids the complexity and conflict risk of a sync engine for a 5-person tool. Instead, action buttons are disabled with a "You're offline — reconnect to submit" message. Simpler and more honest than pretending an offline action succeeded.
- **Conflicts:** because actions require a live connection to submit, there's effectively nothing to reconcile — the "last write wins" scenario (two people acting on the same task at once) is rare at this team size and is handled by simply showing the latest state on refresh.

## 10. File Attachments

- **Storage:** Supabase Storage (1 GB free, bundled with the same account as the database).
- **Max file size:** recommend capping uploads at ~10 MB per file — comfortably covers PDFs, phone photos, and typical Excel/Word files without one bad upload eating a large share of the free quota.
- **Allowed types:** images (jpg/png), PDF, Excel (xlsx), Word (docx) — a small, reviewable allowlist rather than "anything," which also helps keep out unwanted file types.
- **Access:** identical rule to tasks — only the task's assignee, creator, and Admin can view/download its attachments, enforced at the database/storage-policy level.
- **What happens at the storage limit:** uploads start failing with a clear message; at ~5 users this would take a very long time to hit (see Section 17's numbers) — but the plan should be to periodically archive/delete attachments from very old, finalized tasks if it ever gets close.

## 11. Security Model

- **Role-based access:** every request is checked against the logged-in user's role (Admin vs. User) at the database level, not just hidden in the UI.
- **Task ownership:** a task is only visible/actionable to its creator, its assignee, and Admin — enforced by row-level security rules, so "User A can't see User B's task" is a database guarantee, not a UI convention.
- **Self-approval prevention:** the approval action is only enabled when the logged-in user is the task's Admin/approver and is *not* the same person who submitted the completion — preventing someone from assigning, completing, and approving their own task end-to-end.
- **Comments/attachments/history:** inherit the same visibility rule as their parent task — no separate permission system to keep in sync.
- **Unauthenticated access:** any data-bearing request without a valid session is rejected outright at the database layer, before it ever reaches the app's screens.

## 12. Immutable Activity History

Activity History is modeled as an **append-only** table: rows are only ever inserted, never edited or deleted, by database policy. Every meaningful action (assigned, accepted, started, commented, uploaded, completed, approved, rejected, deadline changed, cancelled) writes one row with who/what/when. Because updates and deletes are disallowed at the database rule level (not just "the app doesn't have a delete button"), the history can't be quietly rewritten later, which is exactly what "accountability" requires.

## 13. Recurring Tasks (Backend Logic)

- **Template:** stores the repeat rule (daily/weekly/monthly/custom), the assignee, and an end condition (never / after N times / until a date).
- **Occurrence:** a normal Task row, generated from the template, with a reference back to it.
- **Next occurrence:** computed from the template's rule + the date of the last-generated occurrence; a scheduled job (a free, low-frequency background function) checks daily whether it's time to spawn the next one.
- **Completed occurrence:** behaves exactly like any completed Task — nothing special.
- **Missed occurrence:** if a new occurrence's due date passes with the previous one never actioned, it's flagged Overdue exactly like a normal task — recurrence doesn't grant any special leniency.
- **Overdue occurrence:** same overlay-flag mechanism as regular tasks (Section 12 of the UX phase) — no separate status system for recurring vs. one-off tasks, which keeps the mental model (and the database) simpler.

## 14. Monthly Closing Architecture

A Monthly Closing record owns a set of Closing Items; each Closing Item *is* a Task (sharing the exact same table and lifecycle), with an added `closing_id` reference and a display order number. This means:
- No duplicate workflow to build or maintain — completing a closing item uses the identical accept/start/complete/approve flow as any task.
- The Closing's progress percentage is simply a computed count: (approved closing items) ÷ (total closing items) — recalculated on read, not stored, so it's never stale.
- Adding a new closing item later is just creating a new Task with that `closing_id` set.

## 15. Data Ownership & Backup

- **Where data lives:** entirely inside your Supabase project (Postgres database + file storage) — you own the account, and it isn't tied to the frontend hosting choice.
- **Backups:** the free tier does not include automatic daily backups — this is a real limitation, not an oversight. A practical free workaround is a scheduled export (a free automation, e.g. a scheduled GitHub Action) that periodically dumps the database to a file and stores it somewhere durable and free (e.g. a private repo or cloud storage free tier).
- **Export strategy:** since the underlying database is standard Postgres, a full data export is always possible in an open, portable format — no lock-in to a proprietary export format.
- **Recovery strategy:** restoring from the most recent scheduled export if something goes wrong; given the team size and task volume, even a daily export represents very little at-risk data.

## 16. Scalability

| Team size | Expected experience |
|---|---|
| ~5 (current) | Comfortably within every free limit with large headroom |
| 10 | Still comfortable; database size and bandwidth usage roughly double but remain well under free caps |
| 25 | Likely still workable on free tiers, but attachment storage (1 GB total) and database size (500 MB) start to warrant periodic cleanup/archiving of old finalized tasks |
| 50 | This is where the free database storage cap and the "two active projects" limit become a real planning concern — likely time to evaluate a low-cost paid tier for the database specifically (not the whole stack) |
| 100 | Free tier is no longer realistic for the database/storage layer; hosting (Cloudflare Pages) would likely still be free at this scale, but backend usage would need a paid plan |

The architecture doesn't need to change shape at any of these thresholds — only the paid/free status of individual pieces does, and only the backend (not the frontend hosting) is likely to need it first.

## 17. Free-Tier Risk Analysis

| Service | Free limit | Expected usage (5 users) | Risk level | If exceeded | Alternative |
|---|---|---|---|---|---|
| Supabase database | 500 MB storage, project pauses after 7 days of no activity | A few MB for years of task/comment/history text at this scale | Low (size) / Medium (auto-pause) | Size: uploads/writes start failing. Pause: project goes offline until manually resumed | Self-hosted Postgres (e.g. free-tier VM) or a paid Supabase tier (~$25/mo) |
| Supabase storage | 1 GB files, 50 MB max file size | Modest — a handful of PDFs/images per week | Low initially, grows over time | Uploads fail once full | Periodic archiving of old attachments, or paid storage add-on |
| Supabase realtime | 200 concurrent connections | 5 | Very low | N/A at this scale | N/A needed |
| Supabase auth | 50,000 monthly active users | 5 | Negligible | N/A | N/A needed |
| Cloudflare Pages | Effectively unlimited bandwidth on free tier, generous build limits | Trivial for a 5-person internal tool | Very low | Build/deploy limits would need to be hit, which is unlikely | Netlify free tier, or self-host |
| Web Push | No formal cap; a free browser API | Trivial | Very low | N/A | Fall back to email/in-app |
| Free transactional email | Provider-dependent free daily/monthly send quota, well above ~5 users' notification volume | A handful of emails/day | Very low | Sends start failing/queueing until quota resets | Switch providers, or reduce non-critical email notifications |

**Honest bottom line:** the single most likely real-world irritation isn't hitting a size limit — it's a Supabase free project auto-pausing after 7 days of no API traffic (a genuine free-tier quirk, not this document overselling "free"). A trivial workaround (a free scheduled "ping" job hitting the project daily) neutralizes this, and it should be treated as a required setup step, not an afterthought.

---

## 18. Recommended Final Architecture (Diagram)

```
 User's mobile browser (WhatsApp link tap)
              │
              ▼
 Cloudflare Pages  ── serves the React PWA, free HTTPS subdomain
              │
              ▼
      Web Application (runs in the browser)
              │
   ┌──────────┼───────────────┬─────────────┐
   ▼          ▼               ▼             ▼
 Supabase   Supabase        Supabase      Supabase
  Auth      Postgres DB     Realtime      Storage
(login/     (tasks, users,  (live push    (attachments)
 sessions)   history, etc)   of changes)
              │
              ▼
     Notification triggers
   (in-app + web push + email)
              │
              ▼
        Admin sees the update
```

Every arrow above is a free-tier connection; nothing in this diagram requires a paid line item to function for ~5 users.

## 19. Development Environment

- **Editor:** VS Code (free)
- **Runtime:** Node.js (LTS version)
- **Package manager:** npm (ships with Node — no need for anything extra)
- **Browser:** Chrome or Edge, with mobile device emulation for testing the mobile-first views
- **Version control:** Git + a free GitHub repository (also what triggers Cloudflare Pages deploys)
- **Testing tools:** kept minimal at this scale — manual testing on an actual phone plus browser dev tools; a formal automated test suite can be introduced later if the team/codebase grows

Nothing beyond this is needed — deliberately avoiding heavier tooling (Docker, complex CI pipelines, etc.) that would be overkill for a 5-person internal tool.

## 20. Project Structure (High Level Only)

```
task-app/
├── public/                 (PWA manifest, icons, service worker)
├── src/
│   ├── screens/            (one folder per screen from the UX phase)
│   ├── components/         (shared: TaskCard, StatusBadge, etc.)
│   ├── lib/                (Supabase client setup, auth helpers)
│   └── styles/             (design system tokens/theme)
├── supabase/
│   ├── migrations/         (database schema changes, version-controlled)
│   └── functions/          (scheduled jobs: recurring task generator, etc.)
└── README.md
```

No implementation code — this is only the shape of the eventual project.

## 21. Development Phases (Roadmap)

1. Project foundation (repo, hosting pipeline, empty deployed shell)
2. Authentication (login/logout/roles)
3. Users (Admin can add/edit/deactivate)
4. Tasks (create, view, list — no lifecycle actions yet)
5. Task lifecycle (accept/start/complete/approve/reject flow)
6. WhatsApp task links (deep-linking + authorization)
7. Realtime (live dashboard updates)
8. Notifications (in-app, then push, then email)
9. Recurring tasks
10. Monthly closing
11. Attachments
12. Reports
13. Security review/testing pass
14. Deployment polish (custom domain if desired, final QA)

This order is deliberately built so that after Phase 6 you already have the core "assign → WhatsApp → act → approve" loop fully working end to end — everything after that is enrichment, not core functionality.

## 22. MVP

**Must be in Version 1:** Auth + roles, Create/Assign task (both directions), full task lifecycle through Approval, WhatsApp deep-link view, Task Details with comments + attachments, Admin and User dashboards, basic in-app notifications, Activity History.

**Postpone to later versions:** Recurring tasks, Monthly Closing, browser push + email notifications, Reports beyond a basic count, "Need More Time" extension workflow, search/filtering beyond status. This mirrors the MVP cut from the UX phase — the architecture doesn't change that recommendation, it just confirms it's technically the right place to draw the line too.

## 23. Critical Technical Decisions (Summary)

1. **Frontend:** React, built as an installable PWA
2. **Backend/database:** Supabase (Postgres, integrated)
3. **Hosting:** Cloudflare Pages
4. **Authentication:** Supabase Auth
5. **Storage:** Supabase Storage
6. **Realtime:** Supabase Realtime (Postgres change subscriptions)
7. **Notifications:** In-app (primary) + Web Push (secondary) + free-tier transactional email (fallback); no automated WhatsApp API
8. **Deployment:** Git push → automatic Cloudflare Pages build/deploy
9. **Estimated free-tier capacity:** comfortable through roughly 25 users before any paid upgrade becomes worth evaluating
10. **Main technical risks:** (a) Supabase free-project auto-pause after inactivity — mitigated with a scheduled keep-alive ping; (b) no automated free backups — mitigated with a scheduled export job; (c) no automated WhatsApp push notifications — an accepted, disclosed limitation rather than a solvable gap within the free-only constraint

---

This is the recommended architecture, pending your approval. No implementation, package installation, or file creation will begin until you confirm.
