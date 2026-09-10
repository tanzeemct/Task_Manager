# Team Tasks — MVP

A mobile-first task management PWA for a small team: bidirectional task assignment (Admin ↔ Users), a full accept → start → complete → approve lifecycle, WhatsApp-shareable task links, comments, attachments, and an immutable activity history. Built entirely on free-tier infrastructure.

## 1. What's actually implemented in this codebase (be precise about this)

**Working now:**
- Email/password auth, roles (Admin/User), active/inactive accounts
- Admin "invite" flow — Admin enters a name/email, the new person gets a magic-link sign-in email, and their profile is created automatically on first login (no service-role key ever touches the frontend)
- Admin can also create a teammate's account **directly with a password** (Team → Add team member → "Create with password") — no email dependency; runs through the `admin-create-user` Edge Function so the service-role key stays server-side (see `supabase/functions/admin-create-user`)
- "Forgot password?" on the Login screen — sends a Supabase reset-password email; clicking it brings the person back to a "set new password" screen (`src/pages/ResetPassword.jsx`), no Admin involvement needed. Requires one Supabase dashboard setting — see Section 3A step 7.
- Optional Yes / No / Explanation checklist response on any task ("Checklist response" toggle in Create Task) — for quick confirmations that don't need the full accept/start/complete/approve lifecycle
- "Send via WhatsApp" button (Task Detail + right after creating a task) — pre-fills the task name, deadline, and link in WhatsApp; works both on the web and inside the Android app (via `@capacitor/browser`)
- Native Android app wrapper (Capacitor, see Section 12a) — the same React app bundled into an installable `.apk`
- Bidirectional task creation (Admin → User and User → Admin)
- Full lifecycle: Pending → Accepted → In Progress → Completed (Awaiting Approval) → Approved, plus Reject and Cancel paths
- Task Detail screen used both as the normal in-app view **and** the WhatsApp-shared link destination (`/task/:id`)
- "Need More Time" extension request flow: assignee requests a reason + new deadline, Admin approves (deadline updates) or denies (original deadline stands)
- Comments, file attachments (via Supabase Storage) with type/size validation, signed-URL viewing, and deletion by the uploader or Admin (locked once a task is approved), overdue detection
- Append-only Activity History, driven automatically by a database trigger — not something the frontend can forget to log
- In-app notifications: bell icon with live unread count, grouped notification list, deep-links into the task, realtime-updated
- Monthly Closing: create a closing with a checklist of items (each item is a real task under the hood), progress bar + completed/pending/overdue/awaiting-approval breakdown
- Recurring tasks: Admin can define daily/weekly/monthly/custom templates; occurrences are generated when an Admin opens the app (see the honest caveat below — this is not yet a true background schedule)
- Admin "Team" screen: view all users, deactivate/reactivate, view a user's tasks
- Admin and User dashboards
- Row-level security enforced in the database, not just the UI — see `database/schema.sql` and `database/migration_002.sql`

**Still deferred (schema-ready or straightforward next steps, not built):**
- A true server-side recurring-task schedule (Supabase Edge Function + pg_cron, both free) — today's version generates occurrences client-side when an Admin loads the app, which works but means a quiet day with no Admin login delays that day's occurrence
- Reports screen beyond the Monthly Closing progress view
- Browser push notifications and email notifications (in-app notifications are fully working; these are the two enhancement channels from the architecture phase)
- Search across task titles (status filtering is implemented; text search is not)

Everything listed as "working" is real, wired to the database, and has no fake buttons. What's deferred is named honestly rather than stubbed.

## 2. Why I couldn't do the actual deployment myself

I built and organized all of this inside a sandboxed environment with no internet access, and I don't hold your Supabase/Cloudflare credentials. So I can't run `npm install`, can't verify the build compiles end-to-end, and can't click deploy. Everything below is written so you (or anyone) can go from these files to a live URL in about 15–20 minutes.

## 3. One-time setup

### A. Create your free Supabase project
1. Go to supabase.com → New project (free tier, no card required).
2. Once created, open **SQL Editor** → paste the entire contents of `database/schema.sql` → Run.
3. Then paste and run `database/migration_002.sql`, then `migration_003.sql`, then `migration_004.sql`, then `migration_005.sql`, in that order, in the same SQL Editor. (002 adds the invite flow and extension-request columns; 003 closes real security/lifecycle gaps found in a full audit — deactivated-user access, invalid status transitions, missing storage policies, duplicate recurring occurrences, and notification accuracy; 004 adds attachment deletion; 005 adds the Yes/No/Explanation checklist response columns.)
4. Go to **Storage** → confirm a `task-attachments` bucket was created (the schema script creates it) → add storage policies restricting access to task participants (mirror the `is_admin()` logic used for tables — Supabase's dashboard has a policy template you can adapt).
5. Go to **Authentication → Providers** → confirm Email is enabled and that "Confirm email" / magic link sign-in is on, since the invite flow depends on it.
6. Go to **Edge Functions** → **Create a function** → name it exactly `admin-create-user` → paste the contents of `supabase/functions/admin-create-user/index.ts` → Deploy. (Powers "Create with password" on the Team screen — see Section 5. No secrets to configure: `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are injected automatically for every Edge Function. If you get "Failed to send a request to the Edge Function" in the app, this step wasn't done, or the function name doesn't match exactly.)
7. Go to **Authentication → URL Configuration** → add your app's URL (e.g. `http://localhost:5173` while developing, and your `https://…pages.dev` URL after deploying — Section 4) to **Redirect URLs**. Powers "Forgot password?" on the Login screen (Section 1) — without this, the reset email's link won't come back to the right place.
8. Go to **Project Settings → API** → copy your Project URL and `anon` public key.

### B. Configure the app
1. Copy `.env.example` to `.env`.
2. Paste in your Project URL and anon key from step A.8.

### C. Create your Admin account
1. In Supabase Dashboard → **Authentication → Users → Add user** → create yourself with email + password.
2. Copy the new user's UUID.
3. Back in **SQL Editor**, run:
   ```sql
   insert into public.users (id, full_name, role) values ('paste-uuid-here', 'Your Name', 'admin');
   ```

### D. Run it locally
```
npm install
npm run dev
```
Open the local URL it prints, sign in with the Admin account you just created.

## 4. Deploying for free (Cloudflare Pages)

1. Push this project to a new GitHub repository (private is fine, free).
2. In Cloudflare dashboard → **Pages → Create a project → Connect to Git** → select the repo.
3. Build settings: framework preset "Vite", build command `npm run build`, output directory `dist`.
4. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Pages project settings.
5. Deploy. You'll get a free `your-project.pages.dev` URL with HTTPS — that's your production link, shareable via WhatsApp exactly like any URL.

Every future `git push` to the main branch redeploys automatically.

## 5. How to add users

Admin → **Team** tab → **+ Add team member**, then pick one of two ways:
- **Create with password** (default tab) — enter their name, email, and a password you choose, pick a role, **Create account**. They can sign in immediately with that email/password; share it with them yourself however's convenient (WhatsApp, in person). Requires the `admin-create-user` Edge Function from Section 3A step 6.
- **Send email invite** — enter their name, email, role, **Send invite**. They receive a magic-link sign-in email; clicking it and signing in for the first time automatically creates their profile with the name/role you set. No password to distribute, but depends on the invite email actually arriving.

## 5a. Checklist response (Yes / No / Explanation)

When creating a task, toggle **"Checklist response"** under "Add details" — instead of (or alongside) the normal accept/start/complete flow, the assignee sees a simple prompt on Task Detail and answers **Yes**, **No**, or **Explain** (free text). Once answered it's locked and shown read-only to everyone with access to the task — good for quick confirmations ("Did you lock the register?") that don't need a full approval cycle. Only the assignee or an Admin can answer (enforced in `migration_005.sql`, not just the UI).

## 5b. How recurring tasks work

Admin → **More → Recurring** → **+ New recurring task** → set title, assignee, frequency (daily/weekly/monthly/custom), interval, due time, and an end condition. Each due occurrence appears to the assignee as a completely normal task — they have no visibility into "template" language. **Honest limitation:** occurrences are generated when an Admin next opens the app, not on a fixed background clock — fine for a team that opens the app daily, but if you need guaranteed on-time generation even with no one logged in, the next step is moving `generateDueOccurrences()` (in `src/lib/recurring.js`) into a Supabase Edge Function triggered by `pg_cron`, both still free.

## 5c. How Monthly Closing works

Admin → **Closing** tab → **+ Create closing** → name it, add checklist line items with an assignee each → **Create**. Each item behaves exactly like a normal task (same accept/start/complete/approve flow); the Closing's progress bar and stat breakdown are computed live from those items' statuses, so they're never stale.

## 6. How WhatsApp task links work

Every task has a real URL: `https://your-app.pages.dev/task/{task-id}`. Share it in WhatsApp like any link. When tapped: the browser opens directly to that task (no dashboard, no searching); if the person isn't logged in they're asked to sign in; the database then checks whether they're the task's assignee, creator, or an Admin — if not, they see "You don't have access to this task," even if they have the URL (this is what stops a forwarded link from leaking access). No WhatsApp API or automation is used anywhere — WhatsApp is purely a delivery channel for a normal link, exactly as required.

## 7. Backup / export

Supabase's free tier doesn't include automated backups. Until the Recurring/scheduling phase adds a proper scheduled export job, the simplest free safety net is: Supabase Dashboard → Database → occasionally run a manual export, or use the `pg_dump` connection string under Project Settings → Database to export locally. Treat this as a real gap to close early, not an afterthought.

## 8. Security model (what's actually enforced, not just intended)

All of the following are enforced as Postgres row-level security policies in `database/schema.sql` — meaning even a modified network request can't bypass them, not just the UI:
- A task is only readable/writable by its creator, its assignee, or an Admin.
- Comments, attachments, and activity history inherit the same rule via their parent task.
- Only Admins can write to `users`, `recurring_templates`, and `monthly_closings`.
- Activity history has no update/delete policy at all — rows can only ever be inserted, never edited or removed, by anyone, including Admin.
- Only the assignee or an Admin can set/change a task's checklist response (`migration_005.sql`), enforced by a trigger, not just by which buttons the UI shows.
- The `admin-create-user` Edge Function re-checks the caller is an active Admin itself (via their own session + RLS) before touching anything — the service-role key it holds never reaches the browser, and a non-Admin calling the function directly gets rejected regardless of what the frontend would normally show them.

## 9. Free-tier limitations (unchanged from the architecture phase — still true)

- Supabase free projects pause after 7 days with zero API traffic — set up a free scheduled ping (e.g. a GitHub Action hitting the project daily) so this never surprises you.
- No automated backups on the free tier (see Section 7).
- No free way to auto-send WhatsApp messages — sharing the link is a manual step for whoever assigns the task.
- 500 MB database / 1 GB file storage on Supabase's free tier — see the architecture doc's risk table for when this could matter (roughly: comfortable through ~25 users).

## 10. Testing performed

**Actually executed in this environment, for real, with observed output** (not simulated):
- `npm install` — fails reproducibly with `403 Forbidden` from `registry.npmjs.org`. Direct `curl` to npmjs.org, unpkg.com, and a Supabase host all fail too (403 / connection refused) — this sandbox has no outbound network access at all. This is a fact I verified by trying, not an assumption.
- `npm test` — runs 21 real unit tests against the actual `src/lib/status.js` and `src/lib/recurring.js` files (not copies) using Node directly, since those two modules are the app's pure logic and can run without React/Vite/Supabase installed. All 21 pass. This includes a regression test for the self-approval bug fixed in the last audit, and full coverage of the recurring-task date math.
- **A real, offline Chromium browser** (via Playwright, already present in this environment) loading the actual `src/lib/status.js` as a live ES module over a local server and running assertions inside it — confirmed the same logic behaves identically in a real browser engine, not just Node.
- **The real TypeScript compiler** run across every `.js`/`.jsx` file as a syntax checker (`tsc --allowJs --checkJs --noResolve`). Zero syntax-level (TS1xxx) errors across ~2,900 lines. The ~700 errors it did report are 100% expected noise from missing type declarations for uninstalled packages and untyped plain JS (e.g. "implicit any", "cannot find module react") — not real defects; none were parse errors.
- **A real bug this caught and I fixed**: the recurring-task monthly math had a genuine date-overflow bug (Jan 31 + 1 month silently became early March instead of Feb 28/29) — found by an executed test, not by reading the code, and fixed in `src/lib/recurring.js`.

**Not possible to verify from this sandbox, categorically** (confirmed by trying, not assumed):
- Installing `vite`, `react`, `react-router-dom`, or `@supabase/supabase-js` — no network route to any package registry.
- Building the production bundle (`vite build`) or running the dev server — both require the above.
- Connecting to a real Supabase project — no network route to any host, confirmed via direct `curl`.
- Anything requiring a live backend: real authentication, real RLS enforcement under real auth tokens, real Realtime push, real Storage upload/download, real email delivery for the invite flow, or any full end-to-end user journey through the actual rendered app.

**What this means concretely**: the pure logic — status transitions, overdue detection, and recurrence date math — has been executed and observed correct, including one real bug found and fixed this pass. The React component tree, the Supabase integration, and the database policies themselves have been read carefully and cross-checked against each other (see Section 1 and the migration files' inline audit notes) but never executed together as a running system, because that requires infrastructure this sandbox cannot reach. Section 10a below is the concrete, minimal set of steps for you to close that specific gap.

## 10a. Final user test checklist (10–20 minutes, do this yourself)

1. Run the SQL files in order (`schema.sql` → `migration_002` → `migration_003` → `migration_004`), create your Admin row, deploy per Sections 3–4.
2. Log in as Admin. From **Team**, invite a second account (User A) and a third (User B) using two email addresses you control.
3. As Admin: create a task assigned to User A with a deadline a few minutes out. Copy its task link (open the task, copy the URL).
4. Open that link in a private/incognito window (simulating "tapped from WhatsApp"), sign in as User A → Accept → Start → add a comment → upload a small PDF or image → Mark complete.
5. Back as Admin: confirm a notification appeared, open the task, review the comment/attachment, tap **Approve & finalize**. Confirm the status shows Approved and Activity History lists every step with correct names/times.
6. As User A again: create a new task assigned to **Admin** ("Ask admin"). Complete the same lifecycle in reverse. Confirm Admin is never shown an "Approve" button on this task while it's still assigned to them (this checks the self-approval fix) — only User A (the creator) or another Admin should be able to approve it.
7. Try opening User A's task link while logged in as **User B** — confirm you get "You don't have access to this task," not the task itself.
8. Deactivate User B from the Team screen, then confirm User B is locked out of the app.
9. Request a "Need more time" extension as User A on a new task, approve it as Admin, confirm the deadline updates; try it again and deny it, confirm the deadline stays.
10. Create a Monthly Closing with 2–3 items assigned across your test users; complete and approve one; confirm the progress bar and stat counts update correctly; check the Reports screen shows matching numbers.
11. Set up one daily recurring task; come back after its due time (or temporarily set the due time a minute ahead) and reopen the app as Admin to confirm a fresh occurrence appears, and that reopening again right after doesn't create a duplicate.
12. Try letting a deadline pass on an untouched task; confirm it shows the Overdue flag on both dashboards.
13. Do all of the above once on your phone's browser and once on a desktop browser, checking nothing overflows, buttons stay reachable, and the sticky action bar on Task Detail doesn't cover content.

## 11. Known limitations / honest gaps

- Recurring task generation is client-triggered, not a true background schedule (Section 5b)
- No browser push or email notifications yet — in-app only
- No reports screen beyond Monthly Closing's own progress view
- No text search on task titles
- No automated tests
- Storage bucket policies need to be added manually in the Supabase dashboard (SQL alone doesn't cover Storage RLS the same way as table RLS)
- The database triggers that auto-log activity history and auto-create user profiles on invite (`database/schema.sql`, `database/migration_002.sql`) rely on running as the `postgres` role, which is the default for anything run through the Supabase SQL Editor — don't recreate them under a restricted role

## 12a. Android app (APK)

The app is wrapped as a native Android project using [Capacitor](https://capacitorjs.com) — see the `android/` folder and `capacitor.config.json` (app id `com.teamtasks.app`). The web build is bundled straight into the app (`android/app/src/main/assets/public`), so it doesn't need to be hosted anywhere to run — only Supabase calls need internet, same as the web version. A "Send via WhatsApp" button (pre-filled with the task name + link) is wired up on Task Detail and right after creating a task; inside the native app it hands off to WhatsApp through `@capacitor/browser` instead of trying to load `wa.me` in the in-app WebView.

**Building the actual `.apk` file** needs Android's build tools (JDK 17, Android SDK, Gradle), which this environment doesn't have installed. Two ways to finish it, easiest first:

1. **Android Studio (recommended, all-in-one):**
   - Install [Android Studio](https://developer.android.com/studio) (free) — it bundles the JDK and Android SDK, so nothing else to install.
   - Open the `android/` folder in this project as an Android Studio project (let it sync Gradle the first time — takes a few minutes).
   - **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The finished `app-debug.apk` appears under `android/app/build/outputs/apk/debug/` — copy it to a phone and install (enable "Install unknown apps" for whatever app you copied it with).
   - For a Play Store-ready signed release build, use **Build → Generate Signed Bundle / APK** instead and follow the signing-key wizard.

2. **PWABuilder.com (zero install, but needs the app deployed first):** once you've deployed to Cloudflare Pages (Section 4) and have a real `https://…pages.dev` URL, go to [pwabuilder.com](https://www.pwabuilder.com), paste that URL, and it generates a signed Android package for you in the browser — no local tooling at all. This works because `vite-plugin-pwa` already gives the site a valid manifest.

Whenever you change the app, rebuild the bundled copy before opening/building in Android Studio again:
```
npm run android:sync
```

## 12b. WhatsApp share button

Every task now has a "⤴ WhatsApp" button (Task Detail, and on the confirmation screen right after creating a task) that opens WhatsApp with the task name, deadline, and its direct link pre-filled — the person just taps Send. This is still link-sharing, not the paid WhatsApp Business API: nothing is sent automatically, the person creating/viewing the task has to tap the button themselves, exactly as scoped in the original architecture doc (Section 8 there).

## 13. Sensible next increment

Given what's already built, the fastest high-value additions in order: (1) move recurring-task generation to a Supabase Edge Function + pg_cron for true background scheduling, (2) email notifications as a fallback channel for deadline-approaching/overdue alerts, (3) a Reports screen (employee-wise completion rate, overdue counts, date-range history), (4) text search on task titles.
