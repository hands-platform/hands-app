import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const firebaseAdminEnvKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
export const firebaseApplicationCredentialsEnvKey = 'GOOGLE_APPLICATION_CREDENTIALS';
export const firebaseServiceAccountJsonEnvKey = 'FIREBASE_SERVICE_ACCOUNT_JSON';

export function firebaseAdminCredentialsConfigured(
  env,
  applicationCredentialsConfigured = firebaseApplicationCredentialsConfigured,
) {
  const serviceAccountJson = envValue(env, firebaseServiceAccountJsonEnvKey);
  if (serviceAccountJson) {
    return firebaseServiceAccountJsonConfigured(serviceAccountJson);
  }

  return (
    firebaseAdminEnvKeys.every((key) => Boolean(envValue(env, key))) ||
    applicationCredentialsConfigured(envValue(env, firebaseApplicationCredentialsEnvKey))
  );
}

export function firebaseApplicationCredentialsConfigured(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || !existsSync(resolve(normalized))) {
    return false;
  }

  try {
    return firebaseServiceAccountJsonConfigured(readFileSync(resolve(normalized), 'utf8'));
  } catch {
    return false;
  }
}

export function firebaseServiceAccountJsonConfigured(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return false;
  }

  try {
    const decoded = normalized.startsWith('{')
      ? normalized
      : Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return Boolean(parsed.project_id && parsed.client_email && parsed.private_key);
  } catch {
    return false;
  }
}

function envValue(env, key) {
  const value = String(env[key] ?? '').trim();
  return value ? value : undefined;
}
