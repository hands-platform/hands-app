import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';
import { firebaseAdminCredentialsConfigured } from './lib/firebase-admin-credentials.mjs';
import { firebaseProjectAlignment } from './lib/firebase-project-alignment.mjs';

const steps = [
  {
    name: 'root env example',
    command: ['infra/scripts/check-env.mjs', '.env.example'],
  },
  {
    name: 'staging env template',
    command: ['infra/scripts/check-env.mjs', 'infra/env/hands-staging.env.example', '--template'],
  },
  {
    name: 'external setup advisory',
    command: ['infra/scripts/check-external-setup.mjs'],
  },
  {
    name: 'external registration pack json',
    command: ['infra/scripts/external-registration-pack.mjs', '--format=json'],
  },
  {
    name: 'external registration pack file',
    command: [
      'infra/scripts/external-registration-pack.mjs',
      '--out=infra/setup/.generated/hands-external-registration-pack.md',
    ],
  },
  {
    name: 'external setup copy guard',
    command: ['infra/scripts/check-external-setup-copy.mjs'],
  },
  {
    name: 'secret leak guard',
    command: ['infra/scripts/check-secret-leaks.mjs'],
  },
  {
    name: 'docker compose contract',
    command: ['infra/scripts/check-docker-compose-contract.mjs'],
  },
  {
    name: 'supabase sql pack',
    command: ['infra/scripts/prepare-supabase-sql-pack.mjs'],
  },
  {
    name: 'mobile firebase removal guard',
    command: ['infra/scripts/check-mobile-firebase.mjs'],
  },
  {
    name: 'mobile visible copy guard',
    command: ['infra/scripts/check-mobile-visible-copy.mjs'],
    optional: true,
    deferredReason: 'Mobile visible-copy cleanup is deferred until the dedicated mobile pass.',
  },
  {
    name: 'admin visible copy guard',
    command: ['infra/scripts/check-admin-visible-copy.mjs'],
  },
  {
    name: 'final authority guard',
    command: ['infra/scripts/check-final-authority.mjs'],
  },
  {
    name: 'vietnam scope guard',
    command: ['infra/scripts/check-vietnam-scope.mjs'],
  },
  {
    name: 'admin query guard',
    command: ['infra/scripts/check-admin-query-guards.mjs'],
  },
  {
    name: 'api policy coverage guard',
    command: ['infra/scripts/check-api-policy-coverage.mjs'],
  },
  {
    name: 'flutter architecture guard',
    command: ['infra/scripts/check-flutter-architecture.mjs'],
  },
  {
    name: 'supabase schema alignment',
    command: ['infra/scripts/check-supabase-schema.mjs'],
  },
];

const results = steps.map(runStep);
const generatedFiles = [
  'infra/setup/.generated/hands-external-registration-pack.md',
  'infra/supabase/.generated/hands-staging-setup.sql',
].map((file) => {
  const path = resolve(file);
  return {
    file,
    exists: existsSync(path),
  };
});

const failed = results.filter((result) => result.status === 'FAIL');
const missingGenerated = generatedFiles.filter((file) => !file.exists);
const ok = failed.length === 0 && missingGenerated.length === 0;
const { env } = loadMergedEnv('.env');
const firebasePushReady = firebaseAdminCredentialsConfigured(env) && firebaseProjectAlignment(env).ok;
const phoneAuthReady = phoneAuthSetupState(env);
const externalReady = externalSetupState(env);

console.log(
  JSON.stringify(
    {
      ok,
      purpose: 'HANDS external setup preflight before filling real console credentials.',
      generatedFiles,
      checks: results,
      nextSteps: ok
        ? nextSetupSteps({ firebasePushReady, phoneAuthReady, externalReady })
        : failed.map((result) => result.fix),
    },
    null,
    2,
  ),
);

if (!ok) {
  process.exitCode = 1;
}

function runStep(step) {
  const child = spawnSync(process.execPath, step.command, {
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = `${child.stdout ?? ''}${child.stderr ?? ''}`.trim();
  const failed = child.status !== 0;
  const status = failed ? (step.optional ? 'DEFERRED' : 'FAIL') : 'PASS';

  return {
    name: step.name,
    status,
    command: `node ${step.command.join(' ')}`,
    fix: step.optional
      ? `${step.deferredReason} Run ${step.name} directly during the mobile pass.`
      : `Run ${step.name} directly and resolve the reported error.`,
    detail:
      failed && step.optional
        ? compactFailure(output, step.deferredReason)
        : child.status === 0
          ? compactSuccess(output)
          : output.slice(-1200),
  };
}

function nextSetupSteps({ firebasePushReady, phoneAuthReady, externalReady }) {
  const preparationSteps = [
    'Open infra/setup/.generated/hands-external-registration-pack.md only when creating or rotating external accounts.',
    externalReady.supabaseCoreReady
      ? 'Supabase core env values are present; rerun npm.cmd run external:check:supabase after Supabase URL/key changes.'
      : 'Copy infra/env/hands-staging.env.example values into .env after external consoles are ready, then run npm.cmd run external:check:supabase.',
    'Keep infra/supabase/.generated/hands-staging-setup.sql as the SQL rebuild reference; paste it only when provisioning or rebuilding Supabase staging.',
  ];
  const followUpSteps = [
    ...mapsNextSteps(externalReady),
    ...storageNextSteps(externalReady),
    ...phoneAuthNextSteps(phoneAuthReady),
    'Keep npm.cmd run auth:supabase-smoke passing for the API token exchange and role-boundary contract.',
  ];
  const fcmSteps = firebasePushReady
    ? [
        'FCM credentials are configured; rerun npm.cmd run fcm:credentials-check, npm.cmd run docker:contract, and npm.cmd run fcm:push-smoke -- --preflight --use-registered-device only after notification routing or credential changes.',
      ]
    : [
        'After downloading a Firebase service account JSON from the same project as the mobile google-services.json files, run npm.cmd run fcm:credentials:install -- -SourcePath <downloaded-json> -CheckOnly, then install with -UpdateEnv, run npm.cmd run security:secrets, npm.cmd run fcm:credentials-check, and npm.cmd run docker:contract.',
      ];

  return [...preparationSteps, ...fcmSteps, ...followUpSteps];
}

function phoneAuthNextSteps({ phoneReady, smsReady }) {
  if (smsReady && phoneReady) {
    return [
      'Supabase Phone Auth values and SUPABASE_PHONE_SMOKE_PHONE are present; run npm.cmd run external:check:supabase-auth and npm.cmd run auth:supabase-phone-smoke -- --dry-run, use --send only for an intentional OTP resend, and run --verify only with a fresh 6 digit OTP.',
      'Keep SMS sender-channel refinement deferred unless operators need OTP as SMS instead of the provider fallback route.',
    ];
  }
  if (smsReady) {
    return [
      'Supabase Phone Auth SMS values are present; set SUPABASE_PHONE_SMOKE_PHONE to the Vietnam E.164 test device, then run npm.cmd run external:check:supabase-auth and npm.cmd run auth:supabase-phone-smoke -- --dry-run before --send.',
    ];
  }
  return [
    'For Phone Auth E2E, create or open the Vonage SMS/Verify dashboard, or another approved Vietnam-capable SMS provider, then set SMS_PROVIDER, SMS_API_URL, SMS_API_KEY, SMS_API_SECRET, and SMS_SENDER_ID in ignored env.',
    'Only after those SMS values are present, run npm.cmd run external:check:supabase-auth, npm.cmd run auth:supabase-phone-smoke -- --dry-run, and then the --send/--verify live OTP smoke.',
  ];
}

function mapsNextSteps({ mapsReady }) {
  return mapsReady
    ? [
        'MapTiler and Geoapify values are present; rerun npm.cmd run external:check:maps after map-provider key changes.',
      ]
    : ['Set MAPTILER_API_KEY and GEOAPIFY_API_KEY in ignored env, then run npm.cmd run external:check:maps.'];
}

function storageNextSteps({ storageReady }) {
  return storageReady
    ? [
        'S3-compatible storage values are present; rerun npm.cmd run external:check:storage and npm.cmd run storage:smoke after storage or bucket changes.',
      ]
    : [
        'Set S3-compatible storage values, including either S3_BUCKET or both S3_PRIVATE_BUCKET/S3_PUBLIC_BUCKET, then run npm.cmd run external:check:storage.',
      ];
}

function externalSetupState(sourceEnv) {
  return {
    mapsReady: allEnvValues(sourceEnv, ['MAPTILER_API_KEY', 'GEOAPIFY_API_KEY']),
    storageReady: storageSetupReady(sourceEnv),
    supabaseCoreReady: allEnvValues(sourceEnv, [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_JWT_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]),
  };
}

function phoneAuthSetupState(sourceEnv) {
  return {
    phoneReady: hasVietnamE164Phone(sourceEnv.SUPABASE_PHONE_SMOKE_PHONE),
    smsReady:
      isRealSmsProvider(sourceEnv.SMS_PROVIDER) &&
      ['SMS_API_URL', 'SMS_API_KEY', 'SMS_API_SECRET', 'SMS_SENDER_ID'].every((key) =>
        hasEnvValue(sourceEnv, key),
      ),
  };
}

function storageSetupReady(sourceEnv) {
  return (
    allEnvValues(sourceEnv, [
      'STORAGE_PROVIDER',
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_PUBLIC_BASE_URL',
    ]) &&
    (hasEnvValue(sourceEnv, 'S3_BUCKET') ||
      allEnvValues(sourceEnv, ['S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET']))
  );
}

function isRealSmsProvider(value) {
  return ['vonage', 'viettel', 'fpt', 'custom'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );
}

function hasEnvValue(sourceEnv, key) {
  return String(sourceEnv[key] ?? '').trim().length > 0;
}

function allEnvValues(sourceEnv, keys) {
  return keys.every((key) => hasEnvValue(sourceEnv, key));
}

function hasVietnamE164Phone(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[\s().-]/g, '');
  return /^\+84\d{8,10}$/.test(normalized);
}

function compactSuccess(output) {
  if (!output) {
    return 'completed';
  }
  try {
    const parsed = JSON.parse(output);
    if (typeof parsed.ok === 'boolean') {
      return parsed.ok ? 'ok=true' : 'ok=false';
    }
  } catch {
    // Keep a short text preview for non-JSON tools.
  }
  return output.split(/\r?\n/).at(0)?.slice(0, 160) ?? 'completed';
}

function compactFailure(output, fallback) {
  if (!output) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed.violations)) {
      return `${fallback} ${parsed.violations.length} violation(s) remain.`;
    }
    if (Array.isArray(parsed.findings)) {
      return `${fallback} ${parsed.findings.length} finding(s) remain.`;
    }
  } catch {
    // Keep a short text preview for non-JSON tools.
  }
  return `${fallback} ${output.slice(-240)}`;
}
