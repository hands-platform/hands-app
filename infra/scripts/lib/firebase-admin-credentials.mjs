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

export function firebaseAdminCredentialProjectId(
  env,
  applicationCredentialsProjectId = firebaseApplicationCredentialsProjectId,
) {
  const serviceAccountJson = envValue(env, firebaseServiceAccountJsonEnvKey);
  if (serviceAccountJson) {
    return firebaseServiceAccountJsonProjectId(serviceAccountJson);
  }

  if (firebaseAdminEnvKeys.every((key) => Boolean(envValue(env, key)))) {
    return envValue(env, 'FIREBASE_PROJECT_ID') ?? null;
  }

  return applicationCredentialsProjectId(envValue(env, firebaseApplicationCredentialsEnvKey));
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

export function firebaseApplicationCredentialsProjectId(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || !existsSync(resolve(normalized))) {
    return null;
  }

  try {
    return firebaseServiceAccountJsonProjectId(readFileSync(resolve(normalized), 'utf8'));
  } catch {
    return null;
  }
}

export function firebaseServiceAccountJsonConfigured(value) {
  const parsed = parseFirebaseServiceAccountJson(value);
  return Boolean(parsed?.project_id && parsed?.client_email && parsed?.private_key);
}

export function firebaseServiceAccountJsonProjectId(value) {
  return parseFirebaseServiceAccountJson(value)?.project_id ?? null;
}

function envValue(env, key) {
  const value = String(env[key] ?? '').trim();
  return value ? value : undefined;
}

function parseFirebaseServiceAccountJson(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  try {
    const decoded = normalized.startsWith('{')
      ? normalized
      : Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
