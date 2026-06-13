import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadMergedEnv } from './lib/env-file.mjs';
import {
  firebaseAdminCredentialProjectId,
  firebaseAdminCredentialsConfigured,
  firebaseAdminEnvKeys,
  firebaseApplicationCredentialsConfigured,
  firebaseApplicationCredentialsEnvKey,
  firebaseServiceAccountJsonConfigured,
  firebaseServiceAccountJsonEnvKey,
} from './lib/firebase-admin-credentials.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const mobileFirebaseConfigs = [
  {
    app: 'customer_app',
    path: 'apps/customer_app/android/app/google-services.json',
  },
  {
    app: 'provider_app',
    path: 'apps/provider_app/android/app/google-services.json',
  },
];
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
const adminCredentialProjectId = firebaseAdminCredentialProjectId(env);
const projectAlignment = firebaseProjectAlignment(adminCredentialProjectId);
const ok = firebaseAdminCredentialsConfigured(env) && projectAlignment.ok;
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
  projectAlignment,
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
    ...projectAlignment.invalid,
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
      'Run npm.cmd run fcm:token-smoke -- --dry-run before live FCM push smoke.',
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
  if (invalidKeys.includes('FIREBASE_PROJECT_ID_MISMATCH')) {
    actions.push(
      'Install a Firebase Admin service account JSON from the same Firebase project as the mobile google-services.json files: npm.cmd run fcm:credentials:install -- -SourcePath <service-account-json> -UpdateEnv.',
    );
  }
  if (invalidKeys.includes('MOBILE_FIREBASE_CONFIG_INVALID')) {
    actions.push(
      'Re-download the affected google-services.json file from Firebase project settings and keep it outside Git.',
    );
  }
  if (invalidKeys.includes('MOBILE_FIREBASE_PROJECT_MISMATCH')) {
    actions.push(
      'Use customer and Partner google-services.json files from the same HANDS Firebase project before running live FCM smoke.',
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

function firebaseProjectAlignment(adminProjectId) {
  const configs = mobileFirebaseConfigs.map(readMobileFirebaseConfig);
  const invalid = [];
  const presentConfigs = configs.filter((config) => config.exists);
  const projectIds = new Set(presentConfigs.map((config) => config.projectId).filter(Boolean));

  if (presentConfigs.some((config) => config.status === 'invalid')) {
    invalid.push('MOBILE_FIREBASE_CONFIG_INVALID');
  }

  if (projectIds.size > 1) {
    invalid.push('MOBILE_FIREBASE_PROJECT_MISMATCH');
  }

  const expectedMobileProjectId = [...projectIds][0] ?? null;
  if (expectedMobileProjectId && adminProjectId && expectedMobileProjectId !== adminProjectId) {
    invalid.push('FIREBASE_PROJECT_ID_MISMATCH');
  }

  return {
    ok: invalid.length === 0,
    status: alignmentStatus({ adminProjectId, expectedMobileProjectId, presentConfigs, invalid }),
    adminCredentialProjectId: adminProjectId,
    expectedMobileProjectId,
    checkedMobileConfigs: configs,
    invalid,
  };
}

function readMobileFirebaseConfig(config) {
  const absolutePath = resolve(repoRoot, config.path);
  if (!existsSync(absolutePath)) {
    return {
      app: config.app,
      path: config.path,
      exists: false,
      status: 'missing',
      projectId: null,
      packageNames: [],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
    return {
      app: config.app,
      path: config.path,
      exists: true,
      status: 'valid',
      projectId: parsed.project_info?.project_id ?? null,
      packageNames: (parsed.client ?? [])
        .map((client) => client?.client_info?.android_client_info?.package_name)
        .filter((packageName) => typeof packageName === 'string' && packageName.length > 0),
    };
  } catch {
    return {
      app: config.app,
      path: config.path,
      exists: true,
      status: 'invalid',
      projectId: null,
      packageNames: [],
    };
  }
}

function alignmentStatus({ adminProjectId, expectedMobileProjectId, presentConfigs, invalid }) {
  if (invalid.length > 0) {
    return 'invalid';
  }
  if (presentConfigs.length === 0) {
    return 'not_checked_no_mobile_config';
  }
  if (!expectedMobileProjectId) {
    return 'not_checked_no_mobile_project_id';
  }
  if (!adminProjectId) {
    return 'not_checked_no_admin_project_id';
  }
  return adminProjectId === expectedMobileProjectId ? 'matched' : 'invalid';
}
