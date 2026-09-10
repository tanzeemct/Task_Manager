-- Task Management App — Database Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Safe to run once on a fresh project.

-- ============================================================
-- 1. USERS  (extends Supabase's built-in auth.users)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'user')) default 'user',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. RECURRING TEMPLATES
-- ============================================================
create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid not null references public.users(id),
  created_by uuid not null references public.users(id),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'custom')),
  interval_count int not null default 1,
  day_of_week int,          -- 0-6, for weekly
  day_of_month int,         -- 1-31, for monthly
  default_time time not null default '17:00',
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  proof_required boolean not null default false,
  end_type text not null default 'never' check (end_type in ('never','after_count','on_date')),
  end_count int,
  end_date date,
  occurrences_created int not null default 0,
  last_generated_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. MONTHLY CLOSINGS
-- ============================================================
create table if not exists public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  title text not null,               -- e.g. "September 2026 Closing"
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. TASKS  (the central entity)
-- ============================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references public.users(id),
  assigned_to uuid not null references public.users(id),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'pending' check (status in (
    'pending','accepted','in_progress','completed','awaiting_approval',
    'approved','rejected','cancelled','extension_requested'
  )),
  deadline timestamptz,
  proof_required boolean not null default false,
  recurring_template_id uuid references public.recurring_templates(id),
  closing_id uuid references public.monthly_closings(id),
  closing_order int,
  extension_reason text,
  extension_requested_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_closing on public.tasks(closing_id);

-- ============================================================
-- 5. COMMENTS
-- ============================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.users(id),
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. ATTACHMENTS  (metadata; actual bytes live in Supabase Storage)
-- ============================================================
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.users(id),
  file_path text not null,      -- path inside the 'task-attachments' storage bucket
  file_name text not null,
  file_size int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. ACTIVITY HISTORY  (append-only accountability log)
-- ============================================================
create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.users(id),
  action text not null,          -- e.g. 'assigned','accepted','started','completed','approved','rejected','commented','extension_requested','extension_approved'
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_task on public.activity_history(task_id);

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  task_id uuid references public.tasks(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read);

-- ============================================================
-- ROW LEVEL SECURITY
-- Core rule: a task is visible/actionable only to its creator,
-- its assignee, or an Admin. This is enforced HERE, not just in the UI.
-- ============================================================

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_history enable row level security;
alter table public.notifications enable row level security;
alter table public.recurring_templates enable row level security;
alter table public.monthly_closings enable row level security;

-- Helper: is the current logged-in user an Admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- USERS: everyone can read active users (needed for assignee pickers, names on tasks)
create policy "users_select_all" on public.users
  for select using (true);

-- Only Admin can insert/update/deactivate users
create policy "users_admin_write" on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- TASKS: visible only to creator, assignee, or Admin
create policy "tasks_select_owner_or_admin" on public.tasks
  for select using (
    auth.uid() = created_by or auth.uid() = assigned_to or public.is_admin()
  );

create policy "tasks_insert_any_authenticated_user" on public.tasks
  for insert with check (auth.uid() = created_by);

create policy "tasks_update_owner_or_admin" on public.tasks
  for update using (
    auth.uid() = created_by or auth.uid() = assigned_to or public.is_admin()
  );

-- COMMENTS: same visibility as the parent task
create policy "comments_select_via_task" on public.comments
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

create policy "comments_insert_via_task" on public.comments
  for insert with check (
    auth.uid() = author_id and exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

-- ATTACHMENTS: same pattern
create policy "attachments_select_via_task" on public.attachments
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

create policy "attachments_insert_via_task" on public.attachments
  for insert with check (
    auth.uid() = uploaded_by and exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

-- ACTIVITY HISTORY: readable by task participants; append-only (no update/delete policy exists,
-- which means update/delete are denied by default under RLS)
create policy "activity_select_via_task" on public.activity_history
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

create policy "activity_insert_via_task" on public.activity_history
  for insert with check (
    auth.uid() = actor_id and exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

-- NOTIFICATIONS: only visible to the user they belong to
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

create policy "notifications_insert_any" on public.notifications
  for insert with check (true); -- inserted by triggers/functions on behalf of other users

-- RECURRING TEMPLATES / MONTHLY CLOSINGS: Admin-managed, everyone can read
create policy "templates_select_all" on public.recurring_templates
  for select using (true);
create policy "templates_admin_write" on public.recurring_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "closings_select_all" on public.monthly_closings
  for select using (true);
create policy "closings_admin_write" on public.monthly_closings
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- TRIGGER: auto-create a notification whenever a task's status changes
-- or a task is newly assigned. This is what powers "Admin sees the
-- update immediately" via Supabase Realtime subscribing to notifications.
-- ============================================================
create or replace function public.notify_on_task_change()
returns trigger
language plpgsql
security definer
as $$
declare
  notify_user uuid;
  msg text;
begin
  if TG_OP = 'INSERT' then
    notify_user := new.assigned_to;
    msg := 'New task assigned: ' || new.title;
    insert into public.notifications (user_id, task_id, type, message)
      values (notify_user, new.id, 'new_task', msg);
    insert into public.activity_history (task_id, actor_id, action)
      values (new.id, new.created_by, 'assigned');
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.status is distinct from new.status then
    -- notify the "other side": if the assignee changed it, tell the creator; vice versa
    if auth.uid() = new.assigned_to then
      notify_user := new.created_by;
    else
      notify_user := new.assigned_to;
    end if;

    msg := case new.status
      when 'accepted' then 'Task accepted: ' || new.title
      when 'in_progress' then 'Task started: ' || new.title
      when 'awaiting_approval' then 'Task submitted for approval: ' || new.title
      when 'approved' then 'Task approved: ' || new.title
      when 'rejected' then 'Task rejected / changes requested: ' || new.title
      when 'cancelled' then 'Task cancelled: ' || new.title
      when 'extension_requested' then 'Extension requested: ' || new.title
      else 'Task updated: ' || new.title
    end;

    insert into public.notifications (user_id, task_id, type, message)
      values (notify_user, new.id, new.status, msg);
    insert into public.activity_history (task_id, actor_id, action)
      values (new.id, auth.uid(), new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_task_change on public.tasks;
create trigger trg_notify_on_task_change
  after insert or update on public.tasks
  for each row execute function public.notify_on_task_change();

-- ============================================================
-- STORAGE BUCKET for attachments (run once)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('task-attachments', 'task-attachments', false)
  on conflict (id) do nothing;

-- Storage access mirrors task access: only participants of the task
-- referenced in the file path (path convention: {task_id}/{filename})
-- can read/write. Configure this policy in Supabase Dashboard > Storage
-- > task-attachments > Policies using the same is_admin()/task-ownership
-- logic as above, since storage policies are managed separately from
-- table policies.
