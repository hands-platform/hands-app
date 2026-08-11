# Storage

## MVP Contract

The API exposes `POST /api/files/presign` to create a `FileAsset` record and return an upload contract:

- `file` - database record with key, content type, purpose, visibility, owner, and CDN/private metadata.
- `upload.method` - currently `PUT`.
- `upload.url` - S3/R2-compatible presigned PUT URL when storage env vars are configured.
- `upload.headers` - client must send matching `content-type`.
- `storageMode` - `s3-compatible-presigned`, `supabase-storage-s3`, or `placeholder`.

The created record starts with `uploadStatus=PENDING`. After the app uploads the bytes to the returned PUT URL, it must call `POST /api/files/:id/complete` with an optional `sizeBytes` value. The API then marks the asset as `UPLOADED`, stores `uploadedAt`, and shows the result in admin provider verification views.

This explicit completion step prevents an admin from treating an empty presigned contract as a finished verification document.

## Visibility

- `PRIVATE` - provider verification IDs, passports, private moderation materials.
- `PUBLIC` - provider gallery/profile media intended for CDN.

## Purposes

- `PROVIDER_VERIFICATION` - private ID, certificate, selfie, and work-permit files.
- `PROVIDER_GALLERY` - public profile/gallery media.
- `CHAT_ATTACHMENT` - private chat files.
- `PROFILE_IMAGE` - public profile avatar media.

## Storage Providers

Set `STORAGE_PROVIDER`, `S3_ENDPOINT`, `S3_REGION`, bucket values, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` to enable SigV4 presigned PUT/GET URLs. `S3_PUBLIC_BASE_URL` can point at a CDN or public bucket domain for public assets.

The simplest local mode uses one bucket through `S3_BUCKET`. Staging and production should prefer separate buckets:

- `S3_PRIVATE_BUCKET` for provider verification and private moderation files.
- `S3_PUBLIC_BUCKET` for provider profile/gallery media.

If the split bucket values are not set, the API falls back to `S3_BUCKET` for backwards-compatible local MinIO flows.

Local development defaults to MinIO:

```dotenv
STORAGE_PROVIDER=s3-compatible
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_BUCKET=massage-vn
S3_PRIVATE_BUCKET=
S3_PUBLIC_BUCKET=
S3_ACCESS_KEY=<local-minio-access-key>
S3_SECRET_KEY=<local-minio-secret-key>
S3_PUBLIC_BASE_URL=http://localhost:9000/massage-vn
```

For the local Docker Compose stack, use the MinIO credentials from your ignored local `.env` or
Docker Compose override. Do not commit real access keys.

Supabase Storage can be used through its S3-compatible endpoint without changing mobile upload flows:

```dotenv
STORAGE_PROVIDER=supabase-storage-s3
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_REGION=auto
S3_BUCKET=
S3_PRIVATE_BUCKET=hands-private
S3_PUBLIC_BUCKET=hands-public
S3_ACCESS_KEY=<supabase-storage-access-key>
S3_SECRET_KEY=<supabase-storage-secret-key>
S3_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/hands-public
```

Confirm the exact Supabase S3 endpoint and access keys in the Supabase dashboard before production use. Keep these credentials server-side only.

Run the Supabase storage policy draft after the core schema:

```sql
-- Supabase SQL editor
\i infra/supabase/hands-core-schema.sql
\i infra/supabase/storage-schema.sql
```

If using the Supabase dashboard SQL editor, paste `hands-core-schema.sql` first, then paste `storage-schema.sql`. The storage policy file creates:

- `hands-public` for public provider profile/gallery media.
- `hands-private` for provider verification and private moderation files.
- owner/admin RLS policies for direct client access in a later migration phase.

Private files are read through `GET /api/files/:id/read-url`, which checks that the requester is an
admin, the file owner, or the provider who owns the linked verification record before returning a
short-lived signed GET URL.

Chat messages store only validated `FileAsset` IDs. The sender must own an uploaded private
`CHAT_ATTACHMENT`; arbitrary URLs and client-defined attachment metadata are rejected. The other
customer/Partner participant in the same booking chat can request the signed read URL after the
attachment is linked to a persisted message.

Run a real storage upload/read smoke after setting S3-compatible credentials:

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run storage:smoke
```

The smoke creates a provider verification upload contract, uploads a tiny PNG through the presigned PUT URL, marks the file `UPLOADED`, and confirms the admin signed GET URL can read the same bytes back.

If storage variables are missing, the API deliberately falls back to placeholder URLs only outside
production so local MVP flows remain usable. Production upload, private read, completion, and
deletion operations fail closed when S3-compatible storage is not configured.
