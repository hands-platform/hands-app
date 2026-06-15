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

console.log(
  JSON.stringify(
    {
      ok,
      purpose: 'HANDS external setup preflight before filling real console credentials.',
      generatedFiles,
      checks: results,
      nextSteps: ok
        ? nextSetupSteps({ firebasePushReady, phoneAuthReady })
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

function nextSetupSteps({ firebasePushReady, phoneAuthReady }) {
  const preparationSteps = [
    'Open infra/setup/.generated/hands-external-registration-pack.md while creating external accounts.',
    'Copy infra/env/hands-staging.env.example values into .env after external consoles are ready.',
    'Paste infra/supabase/.generated/hands-staging-setup.sql into Supabase SQL Editor.',
  ];
  const followUpSteps = [
    'Run npm.cmd run external:check:supabase for Supabase core values.',
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
      'Supabase Phone Auth SMS values and SUPABASE_PHONE_SMOKE_PHONE are present; run npm.cmd run external:check:supabase-auth, npm.cmd run auth:supabase-phone-smoke -- --dry-run, then use --send/--verify for the live OTP smoke.',
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
