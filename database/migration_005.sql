-- Migration 005 — run AFTER schema.sql, migration_002/003/004.sql.
-- Adds:
--   (a) an optional Yes / No / Explanation checklist response on a task,
--       for tasks that just need a quick confirmation rather than the
--       full accept->start->complete->approve lifecycle;
--   (b) nothing else schema-side is needed for Admin-direct user creation
--       (see supabase/functions/admin-create-user) — it reuses the
--       pending_invites table and handle_new_auth_user trigger that
--       already exist from migration_002.sql.

-- ============================================================
-- Checklist response
-- ============================================================
alter table public.tasks
  add column if not exists requires_checklist_response boolean not null default false,
  add column if not exists checklist_response text,
  add column if not exists checklist_response_note text,
  add column if not exists checklist_response_by uuid references public.users(id),
  add column if not exists checklist_response_at timestamptz;

alter table public.tasks drop constraint if exists tasks_checklist_response_check;
alter table public.tasks add constraint tasks_checklist_response_check
  check (checklist_response is null or checklist_response in ('yes', 'no', 'explanation'));

-- Answering the checklist is a non-status update, so it's already covered
-- by the existing tasks_update_owner_or_admin RLS policy and skips
-- validate_task_transition entirely (that trigger only inspects rows where
-- old.status is distinct from new.status — see migration_003.sql).
-- This adds one more guard on top: only the assignee or an Admin may set
-- (or change) a checklist response — the creator alone (if not also the
-- assignee/Admin) should not be able to answer on the assignee's behalf.
create or replace function public.validate_checklist_response()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.checklist_response is distinct from new.checklist_response
     and not (auth.uid() = old.assigned_to or public.is_admin()) then
    raise exception 'Only the assignee or an Admin can answer this task''s checklist.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_checklist_response on public.tasks;
create trigger trg_validate_checklist_response
  before update on public.tasks
  for each row execute function public.validate_checklist_response();
