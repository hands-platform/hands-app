import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const composePath = resolve('docker-compose.prod.yml');
const compose = readFileSync(composePath, 'utf8');

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
];

const missing = requiredMarkers.filter((item) => !compose.includes(item.marker));
const result = {
  ok: missing.length === 0,
  file: 'docker-compose.prod.yml',
  checked: requiredMarkers.map((item) => item.name),
  missing: missing.map((item) => item.name),
};

console[result.ok ? 'log' : 'error'](JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
