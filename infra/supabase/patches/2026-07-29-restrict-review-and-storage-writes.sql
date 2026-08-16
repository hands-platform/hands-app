-- Existing-project hardening. Apply only through the reviewed Supabase SQL process.

drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "reviews owner and subject read" on public.reviews;
create policy "reviews owner and subject read"
  on public.reviews for select
  using (
    public.is_admin()
    or customer_id = auth.uid()
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

revoke select on table public.reviews from anon;

drop policy if exists "owner public media insert" on storage.objects;
drop policy if exists "owner public media update" on storage.objects;
drop policy if exists "owner public media delete" on storage.objects;
drop policy if exists "private media owner insert" on storage.objects;
drop policy if exists "private media owner update" on storage.objects;
drop policy if exists "private media owner delete" on storage.objects;
