# Docker

Docker Compose runs PostgreSQL/PostGIS, Redis, and MinIO for local development.
The production-style API container connects to the compose `postgres` service internally, so local host-only `DATABASE_URL` values do not leak into the container runtime.

Production-style app images:

- `api.Dockerfile` builds and runs the NestJS API workspace.
- `admin_web.Dockerfile` builds and runs the Next.js admin workspace.
- Firebase Admin JSON stays outside Git. For FCM in Docker, set `FIREBASE_ADMIN_CREDENTIALS_HOST_PATH` to the host JSON path; the API container reads it from `FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH` or `/run/secrets/firebase-admin.json`.

Use from the repository root:

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

Set `HANDS_ENV_FILE` when validating with a non-default env file, for example `.env.example`; normal local runs use the ignored `.env`.

Run migrations after services are healthy:

```powershell
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```
