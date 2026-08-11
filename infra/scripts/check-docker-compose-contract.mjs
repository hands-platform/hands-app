import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const composePath = resolve('docker-compose.prod.yml');
const compose = readFileSync(composePath, 'utf8');
const dockerIgnore = readFileSync(resolve('.dockerignore'), 'utf8');
const apiDockerfile = readFileSync(resolve('infra/docker/api.Dockerfile'), 'utf8');
const adminDockerfile = readFileSync(resolve('infra/docker/admin_web.Dockerfile'), 'utf8');
const nginxConfig = readFileSync(resolve('infra/nginx/nginx.conf'), 'utf8');
const powershellDeploy = readFileSync(resolve('infra/scripts/deploy-prod.ps1'), 'utf8');
const shellDeploy = readFileSync(resolve('infra/scripts/deploy-prod.sh'), 'utf8');

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const requiredMarkers = [
  {
    name: 'api database uses compose postgres service',
    marker:
      'DATABASE_URL: postgresql://${POSTGRES_USER:-massage}:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD for production}@postgres:5432/${POSTGRES_DB:-massage_vn}?schema=public',
  },
  {
    name: 'api redis uses compose redis service',
    marker: 'REDIS_URL: redis://redis:6379',
  },
  {
    name: 'api minio uses compose minio service',
    marker: 'S3_ENDPOINT: http://minio:9000',
  },
  {
    name: 'api firebase admin uses container credential path',
    marker:
      'GOOGLE_APPLICATION_CREDENTIALS: ${FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH:-/run/secrets/firebase-admin.json}',
  },
  {
    name: 'firebase admin host credential is bind mounted',
    marker:
      'source: ${FIREBASE_ADMIN_CREDENTIALS_HOST_PATH:-./infra/docker/firebase-admin.placeholder.json}',
  },
  {
    name: 'firebase admin container credential target is stable',
    marker: 'target: ${FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH:-/run/secrets/firebase-admin.json}',
  },
  {
    name: 'api readiness healthcheck is configured',
    marker: 'http://127.0.0.1:3000/api/health/ready',
  },
  {
    name: 'admin web healthcheck is configured',
    marker: 'http://127.0.0.1:3000/login',
  },
  {
    name: 'application containers prevent privilege escalation',
    marker: 'no-new-privileges:true',
  },
  {
    name: 'nginx origin defaults to loopback behind TLS termination',
    marker: '${HANDS_NGINX_BIND_ADDRESS:-127.0.0.1}:${HANDS_NGINX_HTTP_PORT:-80}:80',
  },
];

const missing = requiredMarkers.filter((item) => !compose.includes(item.marker));
const deploymentChecks = [
  {
    name: 'PowerShell deploy passes the selected env file to Compose',
    ok:
      powershellDeploy.includes('$env:HANDS_ENV_FILE = $resolvedEnvFile') &&
      powershellDeploy.includes('"--env-file", $resolvedEnvFile'),
  },
  {
    name: 'PowerShell production seed is explicit opt-in',
    ok: powershellDeploy.includes('if ($IncludeSeed)') && !powershellDeploy.includes('if (-not $SkipSeed)'),
  },
  {
    name: 'PowerShell deploy migrates before starting application services',
    ok:
      powershellDeploy.includes('docker @compose run --rm api npx prisma migrate deploy') &&
      appearsBefore(powershellDeploy, 'Run-Step "Run Prisma migrations"', 'Run-Step "Start production application services"'),
  },
  {
    name: 'shell deploy passes the selected env file to Compose',
    ok:
      shellDeploy.includes('export HANDS_ENV_FILE="$ENV_FILE"') &&
      shellDeploy.includes('docker compose --env-file "$ENV_FILE"'),
  },
  {
    name: 'shell production seed is explicit opt-in',
    ok: shellDeploy.includes('if [ "$RUN_SEED" = "1" ]') && !shellDeploy.includes('SKIP_SEED='),
  },
  {
    name: 'shell deploy migrates before starting application services',
    ok:
      shellDeploy.includes('compose run --rm api npx prisma migrate deploy') &&
      appearsBefore(shellDeploy, 'step "Run Prisma migrations"', 'step "Start production application services"'),
  },
];
const failedDeploymentChecks = deploymentChecks.filter((item) => !item.ok);
const dependencyInstallMarker =
  'RUN --mount=type=cache,target=/root/.npm \\\n    npm ci --no-audit --prefer-offline --fetch-retries=5';
const dockerfileChecks = [
  {
    name: 'API Docker dependency install uses a retryable BuildKit cache',
    ok: apiDockerfile.includes(dependencyInstallMarker),
  },
  {
    name: 'Admin Docker dependency install uses a retryable BuildKit cache',
    ok: adminDockerfile.includes(dependencyInstallMarker),
  },
  {
    name: 'API runtime uses the non-root Node user',
    ok: apiDockerfile.includes('USER node'),
  },
  {
    name: 'Admin runtime uses the non-root Node user',
    ok: adminDockerfile.includes('USER node'),
  },
  {
    name: 'application containers drop Linux capabilities',
    ok: (compose.match(/cap_drop:\s*\r?\n\s*-\s*ALL/gu) ?? []).length >= 2,
  },
];
const failedDockerfileChecks = dockerfileChecks.filter((item) => !item.ok);
const nginxChecks = [
  {
    name: 'production API host is routed independently',
    ok:
      nginxConfig.includes('server_name api.hands.vn;') &&
      nginxConfig.includes('proxy_pass http://massage_api/api/;'),
  },
  {
    name: 'production Admin host preserves Next.js API handlers',
    ok:
      nginxConfig.includes('server_name admin.hands.vn;') &&
      nginxConfig.includes('proxy_pass http://massage_admin_web/;'),
  },
  {
    name: 'public referral host reaches the Admin Web referral route',
    ok:
      nginxConfig.includes('server_name hands.vn www.hands.vn;') &&
      nginxConfig.includes('proxy_pass http://massage_admin_web/r/;'),
  },
  {
    name: 'local path-based smoke routing remains available',
    ok: nginxConfig.includes('listen 80 default_server;') && nginxConfig.includes('server_name _;'),
  },
  {
    name: 'TLS offload protocol is preserved for upstream applications',
    ok:
      nginxConfig.includes('map $http_x_forwarded_proto $proxy_forwarded_proto') &&
      nginxConfig.includes('proxy_set_header X-Forwarded-Proto $proxy_forwarded_proto;'),
  },
];
const failedNginxChecks = nginxChecks.filter((item) => !item.ok);
const recursiveBuildArtifactPatterns = [
  '**/node_modules',
  '**/.next',
  '**/dist',
  '**/build',
  '**/coverage',
  '**/.dart_tool',
  '**/.gradle',
  '**/Pods',
  '**/.env',
  '**/.env.*',
  'apps/customer_app',
  'apps/provider_app',
  '**/*.jks',
  '**/*.keystore',
  '**/key.properties',
  '**/*service-account*.json',
  '**/firebase-admin*.json',
];
const missingDockerIgnorePatterns = recursiveBuildArtifactPatterns.filter(
  (pattern) => !dockerIgnore.split(/\r?\n/u).includes(pattern),
);
const result = {
  ok:
    missing.length === 0 &&
    failedDeploymentChecks.length === 0 &&
    failedDockerfileChecks.length === 0 &&
    failedNginxChecks.length === 0 &&
    missingDockerIgnorePatterns.length === 0,
  files: [
    '.dockerignore',
    'docker-compose.prod.yml',
    'infra/docker/api.Dockerfile',
    'infra/docker/admin_web.Dockerfile',
    'infra/nginx/nginx.conf',
    'infra/scripts/deploy-prod.ps1',
    'infra/scripts/deploy-prod.sh',
  ],
  checked: [
    ...requiredMarkers.map((item) => item.name),
    ...deploymentChecks.map((item) => item.name),
    ...dockerfileChecks.map((item) => item.name),
    ...nginxChecks.map((item) => item.name),
    'recursive generated artifacts and local credentials are excluded from Docker context',
  ],
  missing: [
    ...missing.map((item) => item.name),
    ...failedDeploymentChecks.map((item) => item.name),
    ...failedDockerfileChecks.map((item) => item.name),
    ...failedNginxChecks.map((item) => item.name),
    ...missingDockerIgnorePatterns.map((pattern) => `.dockerignore ${pattern}`),
  ],
};

console[result.ok ? 'log' : 'error'](JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
