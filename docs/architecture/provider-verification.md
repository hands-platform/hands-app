# Partner Verification

The MVP supports a simple verification loop for partners.

## Partner Flow

1. Partner logs in.
2. Partner requests `GET /partner/verification` to load or create the verification record.
3. Partner requests `POST /files/presign` with `purpose=provider-verification` and `visibility=PRIVATE`.
4. API creates a private `FileAsset` attached to the partner verification record with `uploadStatus=PENDING`.
5. Partner uploads the file bytes to the returned PUT URL.
6. Partner calls `POST /files/:id/complete` with optional `sizeBytes`; API marks the file `UPLOADED`.
7. Partner calls `POST /partner/verification/submit`.
8. Verification status becomes `SUBMITTED`.

Legacy `/provider/verification` routes remain available for older app builds.

## Admin Flow

1. Admin opens the partner verification dashboard.
2. Admin sees verification status, rejection reason, private file metadata, purpose, upload status, uploaded time, and file size.
3. Admin approves or rejects.
4. Partner receives an in-app notification.

## Production Hardening

- Replace placeholder upload URLs with S3/R2 presigned PUT URLs.
- Require `UPLOADED` files before allowing final verification submission.
- Add document categories such as ID card, certificate, selfie, and work permit.
- Add file malware scanning and moderation workflow before approval.
