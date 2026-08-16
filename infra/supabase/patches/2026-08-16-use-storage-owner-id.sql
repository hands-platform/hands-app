-- Existing-project Storage ownership hardening.
-- Supabase deprecated storage.objects.owner in favor of owner_id.
-- Service-role uploads can have no owner; those objects remain server-mediated.

drop policy if exists "private media owner read" on storage.objects;
create policy "private media owner read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hands-private'
    and (
      owner_id = (select auth.uid()::text)
      or (select public.is_admin())
    )
  );
