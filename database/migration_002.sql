-- Migration 002 — run AFTER schema.sql, in Supabase SQL Editor.
-- Adds: user self-service invite flow, extension-request fields,
-- and the pieces needed for the Monthly Closing / Recurring UI.

-- ============================================================
-- Extension ("Need More Time") support
-- ============================================================
alter table public.tasks
  add column if not exists requested_new_deadline timestamptz,
  add column if not exists previous_status text;

-- ============================================================
-- Invite flow — lets Admin "add a user" using only the anon key
-- (no service-role key is ever exposed to the frontend).
--
-- Flow: Admin inserts a row here with the new person's email/name/role,
-- then the app calls supabase.auth.signInWithOtp({ email }) which sends
-- that person a magic-link sign-in email. When they click it and sign in
-- for the first time, Supabase creates their auth.users row, and the
-- trigger below automatically creates their public.users profile,
-- matched by email, using the name/role from this invite.
-- ============================================================
create table if not exists public.pending_invites (
  email text primary key,
  full_name text not null,
  role text not null default 'user' check (role in ('admin','user')),
  invited_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.pending_invites enable row level security;

create policy "invites_admin_only" on public.pending_invites
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
declare
  invite record;
begin
  select * into invite from public.pending_invites where email = new.email;

  if invite.email is not null then
    insert into public.users (id, full_name, role)
      values (new.id, invite.full_name, invite.role);
    delete from public.pending_invites where email = new.email;
  else
    -- Someone signed in without an invite record (shouldn't normally happen
    -- since there's no public signup page) — create a minimal inactive
    -- profile rather than silently failing, so an Admin can review it.
    insert into public.users (id, full_name, role, active)
      values (new.id, coalesce(new.email, 'New user'), 'user', false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
