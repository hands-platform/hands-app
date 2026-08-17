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
docker compose --env-file .env -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.prod.yml up -d postgres redis minio
docker compose --env-file .env -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Production seed data is never applied by default. Run the seed command manually only for a disposable demo environment.

Or use the scripted flow:

```powershell
.\infra\scripts\deploy-prod.ps1
```

```bash
sh infra/scripts/deploy-prod.sh
```

Useful options:

- PowerShell: `-SkipBuild`, `-SkipSmoke`, `-EnvFile .env.production`, `-ComposeFile docker-compose.prod.yml`.
- Shell: `SKIP_BUILD=1`, `SKIP_SMOKE=1`, `ENV_FILE=.env.production`, `COMPOSE_FILE=docker-compose.prod.yml`.
- Demo-only seed opt-in: PowerShell `-IncludeSeed`; Shell `RUN_SEED=1`. Never enable this against a production database.

The deployment scripts pass the selected environment file to Compose as both its interpolation source and the API/Admin service `env_file`, so validation and runtime use the same configuration.

The scripted flow builds images, starts only PostgreSQL/Redis/MinIO, runs `prisma migrate deploy` in a one-off API container, and starts API/Admin/Nginx only after migration succeeds. It never runs reset, development migration, or seed implicitly.

Before a production deployment, record the release commit, image or artifact identifiers, migration directories included in the release, and the last verified backup. The deploy scripts build from the current checkout; the release owner must retain the previous deployable artifact or commit before replacing it. Follow [Release Rollback And Incident Response](../runbooks/release-rollback-incident-response.md) for go/no-go, rollback, and incident evidence.

## Nginx Routing

`infra/nginx/nginx.conf` separates production hosts so Admin Web route handlers are not intercepted by the Nest API proxy:

- `api.hands.vn/api/*` and `api.hands.vn/socket.io/*` to the Nest API. Release readiness probes `/api/health/ready`, which includes database and Redis readiness rather than liveness alone.
- `admin.hands.vn/*`, including Next.js `/api/admin/*` session, export, calendar, map tile, and realtime-token handlers, to the Admin Web.
- `hands.vn/r/*` to the public referral route in Admin Web; other public-root paths redirect to `admin.hands.vn` until a separate public web app exists.
- Unknown/local hosts retain path-based routing so `API_BASE_URL=http://localhost/api` deployment smoke remains usable.

Nginx forwards `X-Request-Id`, `X-Forwarded-Host`, and the TLS-offload protocol so API logs, secure redirects, and client-visible responses can be correlated correctly.

This Compose Nginx listens on internal/public HTTP port 80 and does not terminate certificates itself. Production must place a trusted TLS edge, load balancer, or host-level reverse proxy in front of it. The edge must:

- provision certificates covering `hands.vn`, `www.hands.vn`, `api.hands.vn`, and `admin.hands.vn`;
- redirect public HTTP to HTTPS;
- preserve the original `Host` header;
- set `X-Forwarded-Proto: https`;
- permit websocket upgrades for `api.hands.vn/socket.io/*`;
- keep the Compose port 80 origin private to the edge whenever possible.

The default Compose binding is `HANDS_NGINX_BIND_ADDRESS=127.0.0.1` and `HANDS_NGINX_HTTP_PORT=80`, which is appropriate for a TLS proxy running on the same host. If a trusted external load balancer must reach the origin over a private network, set `HANDS_NGINX_BIND_ADDRESS` to that private interface address. Do not use `0.0.0.0` unless firewall rules restrict origin access to the trusted edge.

## Environment Validation

Run this before deployment:

```powershell
node infra/scripts/check-env.mjs .env
```

The script fails on missing required runtime values and warns about recommended integrations such as storage, FCM push, MoMo, and VNPay.

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
- Record a successful isolated restore drill using [Backup And Restore](backup-restore.md) before relying on a backup for production recovery.
- Confirm the previous application artifact remains deployable and review the rollback decision tree before opening production traffic.
