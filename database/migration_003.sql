-- Migration 003 — run AFTER schema.sql and migration_002.sql.
-- This migration fixes real gaps found during a full audit of the running
-- implementation, not cosmetic changes. Each section says what was broken.

-- ============================================================
-- FIX 1 (SECURITY — confirmed real): a deactivated regular user could
-- still read/write their OWN tasks/comments/attachments via a direct API
-- call, because the existing policies only checked "are you the owner",
-- never "are you still an active account". Deactivation was enforced by
-- the frontend UI only, not the database — the actual security boundary.
-- ============================================================
create or replace function public.is_active()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select active from public.users where id = auth.uid()), false);
$$;

drop policy if exists "tasks_select_owner_or_admin" on public.tasks;
create policy "tasks_select_owner_or_admin" on public.tasks
  for select using (
    public.is_admin() or (public.is_active() and (auth.uid() = created_by or auth.uid() = assigned_to))
  );

drop policy if exists "tasks_update_owner_or_admin" on public.tasks;
create policy "tasks_update_owner_or_admin" on public.tasks
  for update using (
    public.is_admin() or (public.is_active() and (auth.uid() = created_by or auth.uid() = assigned_to))
  );

drop policy if exists "tasks_insert_any_authenticated_user" on public.tasks;
create policy "tasks_insert_any_authenticated_user" on public.tasks
  for insert with check (auth.uid() = created_by and public.is_active());

drop policy if exists "comments_insert_via_task" on public.comments;
create policy "comments_insert_via_task" on public.comments
  for insert with check (
    auth.uid() = author_id and public.is_active() and exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "attachments_insert_via_task" on public.attachments;
create policy "attachments_insert_via_task" on public.attachments
  for insert with check (
    auth.uid() = uploaded_by and public.is_active() and exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
    )
  );

-- ============================================================
-- FIX 2 (SECURITY / LIFECYCLE INTEGRITY — confirmed real): the update
-- policy above proves IDENTITY but never validated that the requested
-- status change was a legal transition, or that the right role was making
-- it. In practice this meant: an assignee could set their own task
-- straight to 'approved' via a raw API call (self-approval bypassing
-- Admin review entirely), or jump straight from 'pending' to 'approved'
-- skipping the whole lifecycle. The frontend never offered these buttons,
-- but nothing in the database stopped a direct request from doing it.
-- ============================================================
create or replace function public.validate_task_transition()
returns trigger
language plpgsql
security definer
as $$
declare
  is_assignee boolean := auth.uid() = old.assigned_to;
  is_creator_or_admin boolean := auth.uid() = old.created_by or public.is_admin();
  pair text := old.status || '->' || new.status;
begin
  if old.status = new.status then
    return new; -- non-status field changes (comments, attachments) are fine
  end if;

  -- Each legal transition paired with exactly who is allowed to make it.
  -- Anything not listed here is rejected outright, including status jumps
  -- that skip steps (e.g. 'pending' straight to 'approved').
  case pair
    when 'pending->accepted'            then if not is_assignee then raise exception 'Only the assignee can accept this task.'; end if;
    when 'pending->rejected'            then if not is_assignee then raise exception 'Only the assignee can reject this task.'; end if;
    when 'pending->cancelled'           then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    when 'accepted->in_progress'        then if not is_assignee then raise exception 'Only the assignee can start this task.'; end if;
    when 'accepted->rejected'           then if not is_assignee then raise exception 'Only the assignee can reject this task.'; end if;
    when 'accepted->cancelled'          then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    when 'accepted->extension_requested' then if not is_assignee then raise exception 'Only the assignee can request an extension.'; end if;
    when 'in_progress->awaiting_approval' then if not is_assignee then raise exception 'Only the assignee can mark this task complete.'; end if;
    when 'in_progress->cancelled'       then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    when 'in_progress->extension_requested' then if not is_assignee then raise exception 'Only the assignee can request an extension.'; end if;
    when 'awaiting_approval->approved'  then
      if is_assignee then raise exception 'The assignee cannot approve their own submitted work.'; end if;
      if not is_creator_or_admin then raise exception 'Only the creator or an Admin can approve this task.'; end if;
    when 'awaiting_approval->changes_requested' then
      if is_assignee then raise exception 'The assignee cannot request changes on their own submitted work.'; end if;
      if not is_creator_or_admin then raise exception 'Only the creator or an Admin can request changes.'; end if;
    when 'awaiting_approval->cancelled' then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    when 'changes_requested->awaiting_approval' then if not is_assignee then raise exception 'Only the assignee can resubmit this task.'; end if;
    when 'changes_requested->cancelled' then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    when 'extension_requested->accepted', 'extension_requested->in_progress' then
      if not is_creator_or_admin then raise exception 'Only the creator or an Admin can decide an extension request.'; end if;
    when 'extension_requested->cancelled' then if not is_creator_or_admin then raise exception 'Only the creator or an Admin can cancel this task.'; end if;
    else
      raise exception 'That status change (%) is not a valid transition.', pair;
  end case;

  return new;
end;
$$;

drop trigger if exists trg_validate_task_transition on public.tasks;
create trigger trg_validate_task_transition
  before update on public.tasks
  for each row execute function public.validate_task_transition();

-- Add the 'changes_requested' status (see Fix 3 below for why it's separate from 'in_progress')
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in (
  'pending','accepted','in_progress','completed','awaiting_approval',
  'approved','rejected','cancelled','extension_requested','changes_requested'
));

-- ============================================================
-- FIX 3 (UX/AUDIT CORRECTNESS — confirmed real): "User rejects a task"
-- and "Admin rejects/requests changes on submitted work" were collapsed
-- into the same 'in_progress' status, which meant the activity history
-- and notifications said "Task started" when what actually happened was
-- an Admin sending work back — exactly the ambiguity the original UX
-- phase explicitly said to avoid. 'changes_requested' is now a distinct,
-- clearly-labeled status (frontend change in status.js / TaskDetail.jsx).
-- ============================================================

-- ============================================================
-- FIX 4 (FUNCTIONAL — confirmed real, not just missing polish): the
-- attachments feature could not have worked at all. The storage bucket
-- was created with no access policies, and Supabase denies all access to
-- authenticated/anon roles on a bucket with zero policies — only the
-- service-role key (never used in this frontend) can bypass that. Every
-- upload/download call would have failed silently or with a permission
-- error. This adds the missing policies, mirroring the same
-- "task participant or Admin" rule used everywhere else, using the
-- {task_id}/{filename} path convention the upload code already follows.
-- ============================================================
create or replace function public.can_access_task(p_task_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
    and (t.created_by = auth.uid() or t.assigned_to = auth.uid() or public.is_admin())
  );
$$;

drop policy if exists "attachments_storage_select" on storage.objects;
create policy "attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and public.can_access_task((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and public.is_active()
    and public.can_access_task((storage.foldername(name))[1]::uuid)
  );

-- File size and type limits enforced at the bucket level, not just in the
-- frontend (a direct API call previously had no server-side limit at all).
update storage.buckets
  set file_size_limit = 10485760, -- 10 MB
      allowed_mime_types = array[
        'image/jpeg','image/png','application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword','application/vnd.ms-excel'
      ]
  where id = 'task-attachments';

-- ============================================================
-- FIX 5 (DATA INTEGRITY — confirmed real risk, not yet observed but
-- reachable): nothing stopped two overlapping recurring-generation runs
-- (e.g. two Admins opening the app at the same moment) from inserting two
-- occurrences for the same template on the same day. This makes the
-- database itself refuse the second one rather than relying on
-- application-level timing.
--
-- NOTE: a plain `deadline::date` expression can't be used in an index
-- because its result depends on the session's TimeZone setting, so
-- Postgres refuses to call it IMMUTABLE (this is exactly the "functions in
-- index expression must be marked IMMUTABLE" error). The fix is a small
-- wrapper function pinned to UTC — UTC has no daylight-saving shifts, so
-- the result genuinely never changes for a given input, which is what
-- IMMUTABLE actually requires; Postgres just can't infer that on its own
-- from the built-in timezone() function's declared volatility.
-- ============================================================
create or replace function public.date_utc(ts timestamptz)
returns date
language sql
immutable
as $$ select (ts at time zone 'utc')::date; $$;

create unique index if not exists uq_recurring_occurrence_per_day
  on public.tasks (recurring_template_id, public.date_utc(deadline))
  where recurring_template_id is not null;

-- ============================================================
-- FIX 6 (NOTIFICATION ACCURACY — confirmed real): the original trigger
-- only looked at new.status to decide the notification/history message.
-- That's wrong in two specific cases found during this audit: (a) there
-- was no message case for 'changes_requested' at all, so it silently fell
-- through to a generic "Task updated"; and (b) when an Admin approves or
-- denies an extension, the task's status moves back to 'accepted' or
-- 'in_progress' — which the old logic would describe as "Task accepted"
-- or "Task started", actively misreporting what actually happened.
-- ============================================================
create or replace function public.notify_on_task_change()
returns trigger
language plpgsql
security definer
as $$
declare
  notify_user uuid;
  msg text;
  was_extension_decision boolean;
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, task_id, type, message)
      values (new.assigned_to, new.id, 'new_task', 'New task assigned: ' || new.title);
    insert into public.activity_history (task_id, actor_id, action)
      values (new.id, new.created_by, 'assigned');
    return new;
  end if;

  if TG_OP = 'UPDATE' and old.status is distinct from new.status then
    if auth.uid() = new.assigned_to then
      notify_user := new.created_by;
    else
      notify_user := new.assigned_to;
    end if;

    was_extension_decision := old.status = 'extension_requested';

    if was_extension_decision then
      msg := case
        when new.status = 'cancelled' then 'Task cancelled: ' || new.title
        else 'Extension request decided on: ' || new.title
      end;
      insert into public.activity_history (task_id, actor_id, action, notes)
        values (
          new.id, auth.uid(),
          case when new.deadline is distinct from old.deadline then 'extension_approved' else 'extension_denied' end,
          case when new.deadline is distinct from old.deadline
            then 'New deadline: ' || to_char(new.deadline, 'YYYY-MM-DD HH24:MI')
            else 'Original deadline kept'
          end
        );
    else
      msg := case new.status
        when 'accepted' then 'Task accepted: ' || new.title
        when 'in_progress' then 'Task started: ' || new.title
        when 'awaiting_approval' then 'Task submitted for approval: ' || new.title
        when 'approved' then 'Task approved: ' || new.title
        when 'rejected' then 'Task rejected: ' || new.title
        when 'changes_requested' then 'Changes requested: ' || new.title
        when 'cancelled' then 'Task cancelled: ' || new.title
        when 'extension_requested' then 'Extension requested: ' || new.title
        else 'Task updated: ' || new.title
      end;
      insert into public.activity_history (task_id, actor_id, action)
        values (new.id, auth.uid(), new.status);
    end if;

    insert into public.notifications (user_id, task_id, type, message)
      values (notify_user, new.id, new.status, msg);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_task_change on public.tasks;
create trigger trg_notify_on_task_change
  after insert or update on public.tasks
  for each row execute function public.notify_on_task_change();
