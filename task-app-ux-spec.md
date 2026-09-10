# Task Management App — UX & Screen Structure Specification

**Design goal:** Mobile-first, extremely simple task tracking and approval system for a ~5-person team, with WhatsApp as the primary entry point to individual tasks.

---

## A. Complete Screen Map

### Admin Screens
1. Admin Dashboard (home)
2. All Tasks (list + filters)
3. Task Details
4. Create/Edit Task (single form, edit reuses it)
5. Task Approval View (a mode of Task Details, not a separate screen)
6. Recurring Task Templates (list)
7. Create/Edit Recurring Template
8. Monthly Closing (list of closings)
9. Monthly Closing Details
10. Create Monthly Closing
11. Users (team list)
12. User Details (their tasks + history + performance)
13. Add/Edit User
14. Reports
15. Notifications
16. Settings
17. Profile

### User Screens
1. User Dashboard (home)
2. My Tasks (filtered list)
3. Task Details (same component as Admin's, permission-gated)
4. Tasks I Assigned to Admin
5. Notifications
6. My History
7. Profile

**Design decision:** Task Details is one shared screen/component across roles — what you see and can do on it changes based on role + status. This avoids maintaining two parallel task UIs and keeps the mental model simple ("there's one task page, it just adapts to you").

**WhatsApp Task View** is *not* a new screen — it's Task Details rendered in a stripped, focused mode for first-time/link entry (see Section B).

---

## B. Navigation Structure

### Mobile (primary)
**Bottom navigation, 4 items, both roles:**

- **Admin:** Home · Tasks · Closing · More (Users/Reports/Notifications/Profile tucked under More)
- **User:** Home · My Tasks · Assigned by Me · More (Notifications/History/Profile under More)

A **floating action button (+)** on Dashboard and Tasks screens for Admin (Create Task) and User (Assign task to Admin) — one obvious primary action, no menu-diving.

Notifications get a bell icon with badge count in the top bar, not a bottom-nav slot (checked often, but not a "destination" the way Tasks is).

**Why bottom nav over drawer:** 4 items fits comfortably, thumb-reachable, no hidden hamburger menu — matches "user should never feel lost."

### WhatsApp Link Entry
Bypasses navigation shell entirely on first tap — full-screen focused task card, no bottom nav, no dashboard. A small "Open full app" link at the bottom lets them step up into the normal shell if they want to.

### Desktop (Admin, occasionally)
Bottom nav becomes a **left sidebar** with the same items, plus room to show labels. Task list + Task Details can sit side-by-side (list on left, detail panel on right) instead of full-screen push navigation — same data, denser layout. No new features desktop-only; just more visible at once.

---

## C. Task Lifecycle Diagram

```
                  ┌───────────┐
                  │  Pending  │  (assigned, not yet acted on)
                  └─────┬─────┘
                        │ Accept
                        ▼
                  ┌───────────┐
        ┌─────────│ Accepted  │
        │ Reject  └─────┬─────┘
        ▼               │ Start
  ┌───────────┐         ▼
  │ Rejected  │   ┌─────────────┐
  └───────────┘   │ In Progress │───────┐
                   └──────┬──────┘       │ Need More Time
                          │ Complete      ▼
                          ▼        ┌─────────────────┐
                  ┌────────────────┤ Extension        │
                  │ Awaiting        │ Requested        │
                  │ Approval        └────────┬─────────┘
                  └───────┬────────┘         │ Admin decides
              Admin       │                  ▼
           reviews  ┌─────┴─────┐   New deadline set → back to In Progress
                     │           │   or denied → stays, old deadline stands
              Approve│           │Reject/Request Changes
                     ▼           ▼
             ┌──────────────┐ ┌────────────────┐
             │  Approved /  │ │ back to         │
             │  Finalized   │ │ In Progress     │
             └──────────────┘ │ (with feedback) │
                               └────────────────┘

  Any non-final state + deadline passed → Overdue (a flag/badge, not a
  dead-end state — the task keeps its underlying status, just marked late)

  Any state before Approved → Admin or creator can Cancel → Cancelled
```

Overdue is deliberately an **overlay flag**, not a status that replaces Pending/Accepted/In Progress — so "Overdue + In Progress" is a valid, visible combination.

---

## D–I. User Journeys

### Journey 1 — Admin creates and assigns a normal task
- **Start:** Admin Dashboard → taps **+**
- **Screen:** Create Task
- **Action:** Title, assignee, deadline; description/priority optional (collapsed by default)
- **System:** Task created as **Pending**; assignee notified in-app; Admin gets a share link + "Send via WhatsApp" button pre-filled with task name + link
- **Final status:** Pending, visible on both dashboards

### Journey 2 — User receives task via WhatsApp and completes it
- **Start:** WhatsApp message with link
- **Screen:** Focused Task View (stripped)
- **Actions:** Tap link → see task → **Accept** → **Start** → **Complete** (+ optional Upload Proof)
- **System:** Each tap updates status instantly, logs timestamp, pings Admin
- **Final status:** Awaiting Approval

### Journey 3 — Admin approves completed task
- **Start:** Notification "Bilal completed X"
- **Screen:** Task Details (Approval mode)
- **Action:** Review description/proof/comments → **Approve & Finalize**
- **System:** Status → Approved/Finalized, locked from further edits, logged
- **Final status:** Approved / Finalized

### Journey 4 — User rejects a task
- **Start:** User opens a newly assigned task they can't/won't do
- **Screen:** Task Details / Focused View
- **Action:** **Reject** → required short reason
- **System:** Status → Rejected; Admin notified with reason; Admin can reassign or cancel
- **Final status:** Rejected (Admin follow-up required)

### Journey 5 — User requests more time
- **Start:** In Progress task nearing/at deadline
- **Screen:** Task Details
- **Action:** **Need More Time** → reason + proposed new date → Submit
- **System:** Status → "Extension Requested" (sub-state), Admin notified
- **Admin action:** Approve (deadline updates, task returns to In Progress) or Deny (original deadline stands, task now shows Overdue if passed)

### Journey 6 — User assigns a task/request to Admin
- **Start:** User Dashboard → **+** ("Ask Admin")
- **Screen:** Create Task (same form, "Assign to" locked to Admin)
- **System:** Task created, assigned to Admin, appears in Admin's Pending queue like any other task
- **Final status:** Follows the same lifecycle as any task — Admin can Accept/Start/Complete/Reject it

### Journey 7 — Recurring daily task
- **Start:** Admin sets up "Daily Cash Closing" template (Repeat: Daily, assignee: Ahmed)
- **System:** Each day at a defined time, a fresh task instance is auto-created as Pending, notification sent
- **User side:** Sees it appear in "Today's Tasks" like a normal task — no awareness of the template underneath
- **Final status:** Each instance completes independently; template keeps generating until end condition is hit

### Journey 8 — Monthly closing workflow
- **Start:** Admin creates "September Closing" from a checklist template, assigns each line item to a User
- **Screen:** Monthly Closing Details — checklist with per-item assignee/status
- **Users:** Complete their assigned items exactly like normal tasks (each item *is* a task)
- **Admin:** Watches the closing's aggregate progress bar (e.g. 72%) tick up as items get approved
- **Final status:** Closing is "Complete" once every item is Approved/Finalized

### Journey 9 — Task becomes overdue
- **Start:** Deadline passes with task not yet Approved
- **System:** Automatic — no user action. Task gets a red "Overdue" badge + duration ("2 days late"), surfaces in Admin's Overdue widget and the assignee's Overdue section
- **Notification:** Sent once to assignee ("Your task is now overdue") and rolled into Admin's daily overview, not repeated hourly

### Journey 10 — Admin reviews employee history
- **Start:** Admin → Users → selects a person
- **Screen:** User Details
- **View:** Summary stats (completed/overdue/on-time rate) + chronological task history with statuses and dates
- **Action:** Can drill into any past task's full detail/activity log from here

---

## Screen-by-Screen Specification

### WhatsApp / Focused Task View
Loads directly to this, no shell, no login friction beyond a lightweight identity check (handled at implementation stage). Content in strict priority order:

1. Task title (largest text)
2. Status badge (icon + label + color)
3. Deadline with urgency framing ("Due today, 5:00 PM" not just a date)
4. One-line description
5. Assigned by (name)
6. **One big primary action button** matching current status (Accept / Start / Mark Complete)
7. Secondary actions as smaller text-links below the primary button: Reject · Need More Time · Add Comment
8. "View full details" expandable — reveals attachments/comments/history for those who want more, collapsed by default

Only one primary action is ever shown at a time — never a wall of buttons.

### Task Details (full)
Sections, in order of prominence:

1. **Header** — title, status badge, overdue flag if applicable
2. **Actions** — primary action button pinned near top (not buried at bottom of a long page)
3. **Deadline** — date/time, countdown or lateness
4. **People** — assigned by / assigned to (avatars + names)
5. **Instructions/Description**
6. **Attachments** — thumbnails, upload control if action allows
7. **Comments** — chronological thread, input at bottom
8. **Activity History** — collapsed by default ("Show full history"), since it's for audit not daily reading
9. **Priority, recurrence info, monthly-closing link** — secondary metadata, smaller text, lower on page

### Admin Dashboard
Order (top to bottom, answers "what needs me right now" first):

1. **KPI strip** — 4-5 numbers max: Overdue, Awaiting Approval, In Progress, Completed Today
2. **Awaiting My Approval** — list, since this is Admin's unique bottleneck action
3. **Overdue Tasks** — list
4. **Today's Tasks** across the team
5. **Team progress** — compact per-employee status (e.g. mini bars/avatars with counts)
6. **Monthly Closing progress** (if one is active)
7. **Recent activity feed** — collapsed/scrollable, lowest priority
8. **Quick action:** Create Task (FAB, always visible)

### User Dashboard
Strict priority order per the spec:
1. Awaiting My Action (needs a tap right now)
2. Due Today
3. Overdue (mine)
4. Upcoming
5. Recently Completed (short, collapsible)

No team-wide data, no analytics — just "what do I do next."

### Create/Edit Task
Two-tier form to minimize typing:

**Always visible:** Title, Assign to, Deadline (date + optional time)
**Collapsed "Add details" (optional):** Description, Priority (defaults to Normal), Recurring toggle, Proof required toggle, Attachment, Initial comment/instructions

Assign-to defaults intelligently: Admin creating → defaults to last-used assignee; User creating → locked to Admin. Saving with just title + assignee + deadline is a fully valid task — nothing else is required.

### Recurring Task Setup
Inline, plain-language controls, not a cron-style builder:
```
Repeat: [One-time ▾ Daily ▾ Weekly ▾ Monthly ▾ Custom]
Every: [1] [day/week/month]
On: (shown only for weekly/monthly) [Mon] or [1st of month]
Ends: ( ) Never   ( ) After [x] times   ( ) On date [__]
```
Each occurrence appears to the User as an ordinary independent task — no visible link to "template" language.

### Monthly Closing Details
- Big progress percentage + bar at top
- Four count chips: Completed / Pending / Overdue / Awaiting Approval
- Checklist below, each row = task title, assignee avatar, status badge, tap-through to that task's Task Details
- Admin-only "Add item" to append a checklist line after creation

### Notifications
- Grouped by day ("Today," "Yesterday," "Earlier")
- Unread = bold/dot indicator; tapping marks read and deep-links straight into the relevant Task Details (never the inbox → dashboard → search path)
- No priority tiers beyond visual grouping — keep it flat and chronological to stay simple
- A single rolled-up "digest" line for repetitive low-urgency events (e.g. "3 tasks approved today") rather than 3 separate notifications

### Reports
Kept to a short menu of pre-built views rather than a report-builder:
- Team Overview (counts by status)
- Employee-wise performance
- Overdue Tasks
- Completion History (date range)
- Monthly Closing history

Each opens as a simple filterable list/table — export deferred (see Section K).

### Search & Filters
Search: task title only, available from All Tasks and My Tasks.
Filters (Admin's All Tasks): Employee, Status, Priority, Overdue-only, Monthly-closing-only.
Filters (User's My Tasks): Status only — a 5-person, few-dozen-task list doesn't need heavier filtering.
Recurring/non-recurring filter is **not** included — it's an implementation detail, not something users think in terms of day to day.

### Empty States
Written as short, encouraging, specific lines rather than "No data":
- No tasks today → "Nothing due today. 🎉"
- No overdue → "All caught up — nothing overdue."
- No pending approvals → "Nothing waiting on your review."
- No notifications → "You're all caught up."
- No monthly closing yet → "No closing started this month — [Create Closing]"

### Confirmation & Error States
Confirmations: short toast/snackbar, auto-dismissing, no modal interruptions for routine actions ("Task completed ✓", "Approved ✓", "Sent to Bilal ✓"). Destructive actions (delete, cancel task) get a one-tap confirm dialog, everything else doesn't.
Errors: plain language, always paired with the fix ("Couldn't upload — file too large (max 10MB)." not an error code).

---

## Status Visual System (Section 9)

Every status = **icon + label + color**, never color alone:

| Status | Icon | Color |
|---|---|---|
| Pending | ○ | Gray |
| Accepted | ◐ | Blue |
| In Progress | ▶ | Blue |
| Completed | ✓ | Teal |
| Awaiting Approval | ⏳ | Amber |
| Approved / Finalized | ✓✓ | Green |
| Rejected | ✕ | Red |
| Overdue (flag) | ⚠ | Red, appended to whatever status |
| Cancelled | ⊘ | Gray, strikethrough text |
| Need More Time / Extension Requested | ⏱ | Amber |

Rejection UX distinguishes its two cases explicitly in the label/copy: "Rejected by Bilal" (User declined the assignment) vs. "Changes Requested by Admin" (Admin sent submitted work back) — same red-family color, different wording so nobody confuses "I don't want this" with "this isn't good enough yet."

---

## K. Recommended MVP Screens

- Admin Dashboard, All Tasks, Task Details, Create/Edit Task
- User Dashboard, My Tasks, Task Details (shared component)
- WhatsApp Focused Task View
- Notifications (simple list)
- Basic Users list + User Details
- Comments + Attachments on Task Details
- Core lifecycle: Pending → Accepted → In Progress → Completed → Awaiting Approval → Approved, plus Reject and Overdue flag

This alone delivers the entire "Assign → Notify → Work → Complete → Review → Approve → Record" loop for both directions (Admin↔User).

## L. Postpone to Later Version

- Recurring task templates (launch with manually re-created tasks first; automate once the core loop is proven)
- Monthly Closing as a distinct structured feature (can be simulated with a task-naming convention initially)
- Need More Time / extension request flow (start with Admin manually editing deadlines)
- Reports screen beyond a basic status count
- Search/filter beyond status
- Notification digests/grouping logic (start with a flat chronological list)
- Desktop side-by-side layout (ship mobile-only first, adapt later)
- User performance stats/analytics on User Details

This keeps the first release small enough to ship fast while already proving the full assign/complete/approve loop end to end.
