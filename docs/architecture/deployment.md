# Deployment Notes

The MVP is designed for a simple VPS or VM deployment before moving to managed cloud services.

## Runtime Processes

- `api`: NestJS API on `API_PORT`, default `3000`.
- `admin_web`: Next.js admin web, default `3000` inside its container/process.
- `postgres`: PostgreSQL + PostGIS.
- `redis`: Redis for realtime state and BullMQ.
- `storage`: S3-compatible bucket such as Cloudflare R2, AWS S3, or MinIO.
- `nginx`: reverse proxy for admin web, API, and Socket.IO.

## Docker Compose Production Skeleton

`docker-compose.prod.yml` builds and runs:

- `api` from `infra/docker/api.Dockerfile`.
- `admin_web` from `infra/docker/admin_web.Dockerfile`.
- `nginx` with `infra/nginx/nginx.conf`.
- `postgres`, `redis`, `minio`, and `minio-init`.

Example:

```powershell
Copy-Item .env.example .env
node infra/scripts/check-env.mjs .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose -f docker-compose.prod.yml exec api npm run prisma:seed --workspace @massage-vn/api
```

Or use the scripted flow:

```powershell
.\infra\scripts\deploy-prod.ps1
```

```bash
sh infra/scripts/deploy-prod.sh
```

Useful options:

- PowerShell: `-SkipBuild`, `-SkipSeed`, `-SkipSmoke`, `-EnvFile .env.production`.
- Shell: `SKIP_BUILD=1`, `SKIP_SEED=1`, `SKIP_SMOKE=1`, `ENV_FILE=.env.production`.

## Nginx Routing

`infra/nginx/nginx.conf` routes:

- `/api/*` to the Nest API, preserving the `/api` prefix.
- `/socket.io/*` to the Nest Socket.IO server with websocket upgrade headers.
- `/` to the Next.js admin web.

Nginx forwards `X-Request-Id` so API logs and client-visible responses can be correlated.

## Environment Validation

Run this before deployment:

```powershell
node infra/scripts/check-env.mjs .env
```

The script fails on missing required runtime values and warns about recommended integrations such as storage, OS push, MoMo, and VNPay.

## Minimum Production Checklist

- Replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Use a managed or backed-up PostgreSQL database.
- Use a managed Redis or configure persistence/monitoring.
- Configure S3/R2 storage credentials.
- Configure HTTPS termination at Nginx or load balancer.
- Run Prisma migrations explicitly.
- Schedule database backups and test restore on staging.
- Use `infra/scripts/collect-logs.*` when investigating staging or production issues.
- Run `npm.cmd run api:smoke` against staging after deployment.
