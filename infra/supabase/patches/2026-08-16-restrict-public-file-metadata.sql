-- Existing-project file metadata hardening. Apply through the reviewed Supabase SQL process.
-- Owners and Admins retain review access; other authenticated users see only approved uploads.

drop policy if exists "files owner read" on public.files;
create policy "files owner read"
  on public.files for select
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or (
      visibility = 'PUBLIC'
      and upload_status = 'UPLOADED'
      and review_status = 'APPROVED'
    )
  );
