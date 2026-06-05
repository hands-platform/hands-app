# Scripts

Operational scripts:

- `start-hands-local.ps1`, `stop-hands-local.ps1`, and `status-hands-local.ps1` manage the local HANDS API/Admin dev servers on ports 3100 and 3101. The stop script also removes lingering HANDS Node listeners that can keep ports occupied after a parent shell exits.
- `api-smoke.mjs` runs the end-to-end MVP API flow against a running API.
- `storage-smoke.mjs` verifies real S3-compatible storage by presigning a provider verification upload, PUT-ing a tiny PNG, completing the file record, and reading it back through an admin signed URL.
- `check-env.mjs` validates required and recommended environment variables.
- `check-admin-sensitive-exposure.mjs` prevents Admin API/Admin Web regressions that expose raw push notification tokens.
- `external-registration-pack.mjs` prints or writes the external account/key registration pack for HANDS.
- `setup-doctor.mjs` runs the external setup preflight and regenerates operator handoff files.
- `prepare-supabase-sql-pack.mjs` generates the ordered Supabase staging SQL bundle under `infra/supabase/.generated/`.
- `create-android-upload-keystores.ps1` generates local customer/provider Android upload keystores, writes ignored `key.properties` files, and records SHA fingerprints under the local secrets folder.
- `deploy-prod.ps1` runs the production-style Docker flow on Windows PowerShell.
- `deploy-prod.sh` runs the production-style Docker flow on Linux/macOS shells.
- `backup-db.ps1` and `backup-db.sh` create PostgreSQL backups under `backups/`.
- `restore-db.ps1` and `restore-db.sh` restore a backup only with an explicit force flag.
- `collect-logs.ps1` and `collect-logs.sh` collect Docker Compose service logs under `logs/`.

The deploy scripts validate env, start `docker-compose.prod.yml`, run Prisma migrations, optionally seed demo data, and optionally run the smoke script.

External registration order is documented here:

```text
C:\dev\massage-vn-workspace\repo\docs\architecture\operator-registration-plan.md
```
