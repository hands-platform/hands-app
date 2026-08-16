import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const maxFileBytes = 1024 * 1024;

const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);

const findings = [];

const blockedTrackedFilePatterns = [
  {
    pattern: /(^|\/)google-services\.json$/i,
    reason: 'Firebase Android client config must stay ignored',
  },
  {
    pattern: /(^|\/)GoogleService-Info\.plist$/i,
    reason: 'Firebase iOS client config must stay ignored',
  },
  {
    pattern: /(^|\/)(?!.*placeholder).*firebase-admin.*\.json$/i,
    reason: 'Firebase Admin service account JSON must stay outside Git',
  },
];

const secretAssignmentKeys = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_DB_PASSWORD',
  'MAPTILER_API_KEY',
  'GEOAPIFY_API_KEY',
  'VONAGE_API_KEY',
  'VONAGE_API_SECRET',
  'VONAGE_APPLICATION_ID',
  'VONAGE_PRIVATE_KEY',
  'VONAGE_SIGNATURE_SECRET',
  'MOMO_SECRET_KEY',
  'MOMO_ACCESS_KEY',
  'VNPAY_HASH_SECRET',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'SMS_API_KEY',
  'SMS_API_SECRET',
  'S3_SECRET_KEY',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'DATABASE_PASSWORD',
  'POSTGRES_PASSWORD',
  'MINIO_ROOT_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
]);

const safePlaceholderPattern =
  /^(|<[^>]+>|your[-_ ].*|change-me|changeme|dev-.*|example.*|.*example.*|.*placeholder.*)$/i;

for (const file of trackedFiles) {
  checkTrackedFileName(file);
  const absolutePath = resolve(root, file);
  if (!existsSync(absolutePath) || statSync(absolutePath).size > maxFileBytes) {
    continue;
  }

  const source = readFileSync(absolutePath, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    checkLine(file, index + 1, line);
  });
}

if (findings.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        findingCount: findings.length,
        findings,
        guidance:
          'Move real credentials into ignored .env files or server secret stores. Commit only placeholders.',
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, scannedFiles: trackedFiles.length }, null, 2));

function checkLine(file, lineNumber, line) {
  if (/\bsb_secret_[A-Za-z0-9_-]{16,}\b/.test(line)) {
    addFinding(file, lineNumber, 'Supabase secret key literal');
  }

  if (/\bsb_publishable_[A-Za-z0-9_-]{16,}\b/.test(line)) {
    addFinding(file, lineNumber, 'Supabase publishable key literal');
  }

  if (/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}\b/.test(line)) {
    addFinding(file, lineNumber, 'JWT token literal');
  }

  if (
    /hands_admin_session/.test(line) &&
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/.test(line)
  ) {
    addFinding(file, lineNumber, 'signed Admin Web session cookie literal');
  }

  if (/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(line)) {
    addFinding(file, lineNumber, 'private key block');
  }

  if (/"type"\s*:\s*"service_account"/.test(line)) {
    addFinding(file, lineNumber, 'Google service account JSON literal');
  }

  if (/"private_key_id"\s*:\s*"[A-Za-z0-9_-]{16,}"/.test(line)) {
    addFinding(file, lineNumber, 'Google service account private key id literal');
  }

  if (/"client_email"\s*:\s*"[^"]+@[^"]+\.iam\.gserviceaccount\.com"/.test(line)) {
    addFinding(file, lineNumber, 'Google service account client email literal');
  }

  const assignment = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (!assignment) {
    return;
  }

  const [, key, rawValue] = assignment;
  if (!secretAssignmentKeys.has(key)) {
    return;
  }

  const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
  if (!safePlaceholderPattern.test(value)) {
    addFinding(file, lineNumber, `${key} contains a non-placeholder value`);
  }
}

function checkTrackedFileName(file) {
  const normalized = file.replaceAll('\\', '/');
  for (const blocked of blockedTrackedFilePatterns) {
    if (blocked.pattern.test(normalized)) {
      addFinding(file, 1, blocked.reason);
    }
  }
}

function addFinding(file, line, reason) {
  findings.push({ file, line, reason });
}
