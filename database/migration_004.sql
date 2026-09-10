-- Migration 004 — run AFTER schema.sql, migration_002.sql, migration_003.sql.
-- Found during attachments audit: there was no way to delete an attachment
-- at all (original spec section 12 explicitly requires "delete where
-- permitted"). Scope: the uploader or an Admin can delete a file, but only
-- while the task is still open — once a task is approved/finalized, its
-- proof record becomes part of the permanent accountability trail and
-- should not be removable, matching the read-only-after-finalization rule
-- used throughout the rest of the app.

drop policy if exists "attachments_delete_uploader_or_admin" on public.attachments;
create policy "attachments_delete_uploader_or_admin" on public.attachments
  for delete using (
    (auth.uid() = uploaded_by or public.is_admin())
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.status <> 'approved'
    )
  );

drop policy if exists "attachments_storage_delete" on storage.objects;
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.attachments a
      join public.tasks t on t.id = a.task_id
      where a.file_path = name
      and (a.uploaded_by = auth.uid() or public.is_admin())
      and t.status <> 'approved'
    )
  );
