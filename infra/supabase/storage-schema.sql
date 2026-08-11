-- HANDS Supabase Storage buckets and read policies.
-- Run after `hands-core-schema.sql`.
-- Writes stay server-mediated through the NestJS presigned upload flow so purpose,
-- ownership, file limits, and content signatures are validated in one place.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'hands-public',
    'hands-public',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  ),
  (
    'hands-private',
    'hands-private',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public media read" on storage.objects;
create policy "public media read"
  on storage.objects for select
  using (bucket_id = 'hands-public');

drop policy if exists "owner public media insert" on storage.objects;
drop policy if exists "owner public media update" on storage.objects;
drop policy if exists "owner public media delete" on storage.objects;

drop policy if exists "private media owner read" on storage.objects;
create policy "private media owner read"
  on storage.objects for select
  using (
    bucket_id = 'hands-private'
    and (owner = auth.uid() or public.is_admin())
  );

drop policy if exists "private media owner insert" on storage.objects;
drop policy if exists "private media owner update" on storage.objects;
drop policy if exists "private media owner delete" on storage.objects;
