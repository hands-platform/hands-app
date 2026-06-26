import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FCM_CREDENTIAL_REQUIREMENT =
  'FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS';
export const FIREBASE_SERVICE_ACCOUNT_JSON_KEY = 'FIREBASE_SERVICE_ACCOUNT_JSON';
export const GOOGLE_APPLICATION_CREDENTIALS_KEY = 'GOOGLE_APPLICATION_CREDENTIALS';

export type FirebaseCredentialConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  serviceAccountJson?: string;
  googleApplicationCredentials?: string;
};

export function readFirebaseCredentialConfig(config: ConfigService): FirebaseCredentialConfig {
  return {
    projectId: config.get<string>('FIREBASE_PROJECT_ID')?.trim(),
    clientEmail: config.get<string>('FIREBASE_CLIENT_EMAIL')?.trim(),
    privateKey: normalizePrivateKey(config.get<string>('FIREBASE_PRIVATE_KEY')?.trim()),
    serviceAccountJson: config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON')?.trim(),
    googleApplicationCredentials: config.get<string>('GOOGLE_APPLICATION_CREDENTIALS')?.trim(),
  };
}

export function firebaseCredentialReadiness(config: FirebaseCredentialConfig) {
  const hasServiceAccountJson = hasValidFirebaseServiceAccountJson(config.serviceAccountJson);
  const hasFieldCredentials = Boolean(config.projectId && config.clientEmail && config.privateKey);
  const hasApplicationDefault = existingApplicationDefaultCredentials(config.googleApplicationCredentials);
  const invalid = [
    config.serviceAccountJson && !hasServiceAccountJson ? FIREBASE_SERVICE_ACCOUNT_JSON_KEY : null,
    !hasServiceAccountJson &&
    !hasFieldCredentials &&
    config.googleApplicationCredentials &&
    !hasApplicationDefault
      ? GOOGLE_APPLICATION_CREDENTIALS_KEY
      : null,
  ].filter((key): key is string => Boolean(key));
  const ready =
    invalid.length === 0 && (hasServiceAccountJson || hasFieldCredentials || hasApplicationDefault);

  return {
    ready,
    missing: ready || invalid.length > 0 ? [] : [FCM_CREDENTIAL_REQUIREMENT],
    invalid,
  };
}

export function configuredFirebaseCredentialKeys(config: FirebaseCredentialConfig) {
  return [
    config.serviceAccountJson ? FIREBASE_SERVICE_ACCOUNT_JSON_KEY : null,
    config.projectId ? 'FIREBASE_PROJECT_ID' : null,
    config.clientEmail ? 'FIREBASE_CLIENT_EMAIL' : null,
    config.privateKey ? 'FIREBASE_PRIVATE_KEY' : null,
    config.googleApplicationCredentials ? GOOGLE_APPLICATION_CREDENTIALS_KEY : null,
  ].filter((key): key is string => Boolean(key));
}

export function firebaseProjectIdFromConfig(config: FirebaseCredentialConfig) {
  if (config.serviceAccountJson) {
    return parseFirebaseServiceAccount(config.serviceAccountJson).projectId;
  }

  if (config.projectId) {
    return config.projectId;
  }

  if (config.googleApplicationCredentials) {
    return parseFirebaseServiceAccountFile(config.googleApplicationCredentials).projectId;
  }

  return undefined;
}

export function parseFirebaseServiceAccountFile(path: string) {
  return parseFirebaseServiceAccount(readFileSync(resolve(path), 'utf8'));
}

function existingApplicationDefaultCredentials(value?: string) {
  if (!value || !existsSync(resolve(value))) {
    return false;
  }

  try {
    return hasValidFirebaseServiceAccountJson(readFileSync(resolve(value), 'utf8'));
  } catch {
    return false;
  }
}

export function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, '\n');
}

export function parseFirebaseServiceAccount(raw: string) {
  const decoded = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(decoded) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: normalizePrivateKey(parsed.private_key),
  };
}

export function hasValidFirebaseServiceAccountJson(raw?: string) {
  if (!raw) {
    return false;
  }

  try {
    const parsed = parseFirebaseServiceAccount(raw);
    return Boolean(parsed.projectId && parsed.clientEmail && parsed.privateKey);
  } catch {
    return false;
  }
}
