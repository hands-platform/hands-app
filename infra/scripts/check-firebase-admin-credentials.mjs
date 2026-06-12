import { loadMergedEnv } from './lib/env-file.mjs';
import {
  firebaseAdminCredentialsConfigured,
  firebaseAdminEnvKeys,
  firebaseApplicationCredentialsConfigured,
  firebaseApplicationCredentialsEnvKey,
  firebaseServiceAccountJsonConfigured,
  firebaseServiceAccountJsonEnvKey,
} from './lib/firebase-admin-credentials.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const configured = configuredCredentialKeys();
const serviceAccountJsonStatus = credentialStatus(
  hasEnvValue(firebaseServiceAccountJsonEnvKey),
  firebaseServiceAccountJsonConfigured(envValue(firebaseServiceAccountJsonEnvKey)),
);
const splitEnvStatus = splitCredentialStatus();
const googleApplicationCredentialsStatus = credentialStatus(
  hasEnvValue(firebaseApplicationCredentialsEnvKey),
  firebaseApplicationCredentialsConfigured(envValue(firebaseApplicationCredentialsEnvKey)),
);
const ok = firebaseAdminCredentialsConfigured(env);
const invalid = invalidCredentialKeys();
const missing = ok || invalid.length > 0 ? [] : [credentialRequirement()];
const result = {
  ok,
  mode: 'fcm-admin-credentials',
  envFile: {
    path: envPath,
    exists: envFileExists,
  },
  configured,
  missing,
  invalid,
  credentialSources: {
    serviceAccountJson: serviceAccountJsonStatus,
    splitEnv: splitEnvStatus,
    googleApplicationCredentials: googleApplicationCredentialsStatus,
  },
  nextActions: nextActions({ ok, invalid }),
};

console[ok ? 'log' : 'error'](JSON.stringify(result, null, 2));

if (!ok) {
  process.exit(1);
}

function configuredCredentialKeys() {
  return [
    hasEnvValue(firebaseServiceAccountJsonEnvKey) ? firebaseServiceAccountJsonEnvKey : null,
    ...firebaseAdminEnvKeys.filter((key) => hasEnvValue(key)),
    hasEnvValue(firebaseApplicationCredentialsEnvKey) ? firebaseApplicationCredentialsEnvKey : null,
  ].filter(Boolean);
}

function invalidCredentialKeys() {
  return [
    hasEnvValue(firebaseServiceAccountJsonEnvKey) && serviceAccountJsonStatus === 'invalid'
      ? firebaseServiceAccountJsonEnvKey
      : null,
    hasEnvValue(firebaseApplicationCredentialsEnvKey) && googleApplicationCredentialsStatus === 'invalid'
      ? firebaseApplicationCredentialsEnvKey
      : null,
  ].filter(Boolean);
}

function splitCredentialStatus() {
  const presentKeys = firebaseAdminEnvKeys.filter((key) => hasEnvValue(key));
  if (presentKeys.length === 0) {
    return 'missing';
  }
  return presentKeys.length === firebaseAdminEnvKeys.length ? 'valid' : 'incomplete';
}

function credentialStatus(configuredValue, valid) {
  if (!configuredValue) {
    return 'missing';
  }
  return valid ? 'valid' : 'invalid';
}

function nextActions({ ok: ready, invalid: invalidKeys }) {
  if (ready) {
    return [
      'Run npm.cmd run security:secrets to confirm Firebase client/admin config files are not tracked.',
      'Run npm.cmd run external:check:push when PUSH_PROVIDER=fcm is selected.',
      'Run npm.cmd run docker:contract to confirm Docker credential mounts and internal service URLs.',
      'Run npm.cmd run fcm:token-smoke -- --dry-run before live push smoke.',
    ];
  }

  const actions = [];
  if (invalidKeys.includes(firebaseServiceAccountJsonEnvKey)) {
    actions.push(
      'Fix FIREBASE_SERVICE_ACCOUNT_JSON so it contains project_id, client_email, and private_key, or remove it and use another credential source.',
    );
  }
  if (invalidKeys.includes(firebaseApplicationCredentialsEnvKey)) {
    actions.push(
      'Point GOOGLE_APPLICATION_CREDENTIALS to an existing valid Firebase service account JSON file available to the API process.',
    );
  }
  if (splitEnvStatus === 'incomplete') {
    actions.push(
      'Complete FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY, or use FIREBASE_SERVICE_ACCOUNT_JSON instead.',
    );
  }
  if (actions.length === 0) {
    actions.push(
      'Set one server-side credential source: FIREBASE_SERVICE_ACCOUNT_JSON, split FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }
  return actions;
}

function credentialRequirement() {
  return 'FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS';
}

function hasEnvValue(key) {
  return Boolean(envValue(key));
}

function envValue(key) {
  const value = env[key]?.trim();
  return value ? value : undefined;
}
