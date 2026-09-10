-- Migration 006 — run AFTER schema.sql, migration_002/003/004/005.sql.
-- Adds a readable email column on public.users so the Team screen can show
-- each person's sign-in email ("username") without needing a privileged
-- Edge Function call for something this simple. This does NOT add password
-- storage anywhere — Supabase never stores passwords in reversible form
-- (only a one-way hash in auth.users), so there is nothing to expose even
-- with full database access. Password control for Admin is handled instead
-- by supabase/functions/admin-reset-password (Admin sets a NEW password for
-- someone, never reveals the old one).

alter table public.users add column if not exists email text;

-- Backfill existing rows from auth.users (SQL Editor runs as a role that can
-- read auth.users; the app's normal anon/authenticated roles still can't).
update public.users u
  set email = a.email
  from auth.users a
  where a.id = u.id and u.email is distinct from a.email;

-- Keep it populated for every future signup (both the invited-match branch
-- and the no-invite fallback branch).
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
    insert into public.users (id, full_name, role, email)
      values (new.id, invite.full_name, invite.role, new.email);
    delete from public.pending_invites where email = new.email;
  else
    insert into public.users (id, full_name, role, active, email)
      values (new.id, coalesce(new.email, 'New user'), 'user', false, new.email);
  end if;

  return new;
end;
$$;
