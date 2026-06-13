import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firebaseAdminCredentialProjectId } from './firebase-admin-credentials.mjs';

export const firebaseProjectAlignmentInvalidKeys = {
  projectMismatch: 'FIREBASE_PROJECT_ID_MISMATCH',
  mobileConfigInvalid: 'MOBILE_FIREBASE_CONFIG_INVALID',
  mobileProjectMismatch: 'MOBILE_FIREBASE_PROJECT_MISMATCH',
};

const firebaseProjectAlignmentIssueCopy = {
  [firebaseProjectAlignmentInvalidKeys.projectMismatch]: {
    label: 'Firebase Admin project does not match mobile app project',
    action:
      'Validate the Firebase Admin service account JSON from the same Firebase project as the mobile google-services.json files: npm.cmd run fcm:credentials:install -- -SourcePath <service-account-json> -CheckOnly, then install with -UpdateEnv.',
  },
  [firebaseProjectAlignmentInvalidKeys.mobileConfigInvalid]: {
    label: 'Mobile Firebase config file is invalid',
    action:
      'Re-download the affected google-services.json file from Firebase project settings and keep it outside Git.',
  },
  [firebaseProjectAlignmentInvalidKeys.mobileProjectMismatch]: {
    label: 'Customer and Partner Firebase configs use different projects',
    action:
      'Use customer and Partner google-services.json files from the same HANDS Firebase project before running live FCM smoke.',
  },
};

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

export function firebaseProjectAlignment(env, options = {}) {
  const repoRoot = options.repoRoot ?? resolve(import.meta.dirname, '..', '..', '..');
  const adminProjectId = firebaseAdminCredentialProjectId(env);
  const configs = mobileFirebaseConfigs.map((config) => readMobileFirebaseConfig(repoRoot, config));
  const invalid = [];
  const presentConfigs = configs.filter((config) => config.exists);
  const projectIds = new Set(presentConfigs.map((config) => config.projectId).filter(Boolean));

  if (presentConfigs.some((config) => config.status === 'invalid')) {
    invalid.push(firebaseProjectAlignmentInvalidKeys.mobileConfigInvalid);
  }

  if (projectIds.size > 1) {
    invalid.push(firebaseProjectAlignmentInvalidKeys.mobileProjectMismatch);
  }

  const expectedMobileProjectId = [...projectIds][0] ?? null;
  if (expectedMobileProjectId && adminProjectId && expectedMobileProjectId !== adminProjectId) {
    invalid.push(firebaseProjectAlignmentInvalidKeys.projectMismatch);
  }

  return {
    ok: invalid.length === 0,
    status: alignmentStatus({ adminProjectId, expectedMobileProjectId, presentConfigs, invalid }),
    adminCredentialProjectId: adminProjectId,
    expectedMobileProjectId,
    checkedMobileConfigs: configs,
    invalid,
    issues: firebaseProjectAlignmentIssues(invalid),
  };
}

export function firebaseProjectAlignmentActions(invalidKeys) {
  return firebaseProjectAlignmentIssues(invalidKeys).map((issue) => issue.action);
}

export function firebaseProjectAlignmentIssues(invalidKeys) {
  return invalidKeys.map((code) => ({
    code,
    label: firebaseProjectAlignmentIssueLabel(code),
    action: firebaseProjectAlignmentIssueAction(code),
  }));
}

export function firebaseProjectAlignmentIssueLabel(code) {
  return firebaseProjectAlignmentIssueCopy[code]?.label ?? code;
}

function firebaseProjectAlignmentIssueAction(code) {
  return (
    firebaseProjectAlignmentIssueCopy[code]?.action ?? `Resolve Firebase project alignment issue: ${code}.`
  );
}

function readMobileFirebaseConfig(repoRoot, config) {
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
