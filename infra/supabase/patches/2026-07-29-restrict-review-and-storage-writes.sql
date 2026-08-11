-- Existing-project hardening. Apply only through the reviewed Supabase SQL process.

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  using (status = 'PUBLISHED');

drop policy if exists "owner public media insert" on storage.objects;
drop policy if exists "owner public media update" on storage.objects;
drop policy if exists "owner public media delete" on storage.objects;
drop policy if exists "private media owner insert" on storage.objects;
drop policy if exists "private media owner update" on storage.objects;
drop policy if exists "private media owner delete" on storage.objects;
