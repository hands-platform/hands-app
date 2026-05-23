# Provider Verification

The MVP supports a simple verification loop for providers.

## Provider Flow

1. Provider logs in.
2. Provider requests `GET /provider/verification` to load or create the verification record.
3. Provider requests `POST /files/presign` with `purpose=provider-verification` and `visibility=PRIVATE`.
4. API creates a private `FileAsset` attached to the provider verification record with `uploadStatus=PENDING`.
5. Provider uploads the file bytes to the returned PUT URL.
6. Provider calls `POST /files/:id/complete` with optional `sizeBytes`; API marks the file `UPLOADED`.
7. Provider calls `POST /provider/verification/submit`.
8. Verification status becomes `SUBMITTED`.

## Admin Flow

1. Admin opens the provider verification dashboard.
2. Admin sees verification status, rejection reason, private file metadata, purpose, upload status, uploaded time, and file size.
3. Admin approves or rejects.
4. Provider receives an in-app notification.

## Production Hardening

- Replace placeholder upload URLs with S3/R2 presigned PUT URLs.
- Require `UPLOADED` files before allowing final verification submission.
- Add document categories such as ID card, certificate, selfie, and work permit.
- Add file malware scanning and moderation workflow before approval.
