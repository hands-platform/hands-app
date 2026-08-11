import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  externalRegistrationPlan,
  projectControlSequence,
  setupOrder,
  verifiedBaseline,
} from './setup-page-data';
import { notificationFilterLinks } from '../notifications/notification-page-model';
import {
  FCM_CUSTOMER_LIVE_REGISTERED_DEVICE_SMOKE_COMMAND,
  FCM_CUSTOMER_LIVE_TOKEN_SMOKE_COMMAND,
  FCM_PROVIDER_SUGGESTED_NOTIFICATION_PREFLIGHT_COMMAND,
  FCM_SETUP_REVIEW_COMMANDS,
} from '../notifications/fcm-smoke-commands';

describe('setup page data', () => {
  it('keeps setup order ids unique and required operating groups visible', () => {
    const ids = setupOrder.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mobile',
        'supabase',
        'operations-policy',
        'referrals',
        'payments',
        'notifications',
        'storage',
      ]),
    );
    expect(setupOrder.find((item) => item.id === 'notifications')?.env).toEqual(
      expect.arrayContaining(['PUSH_PROVIDER', 'FIREBASE_PROJECT_ID']),
    );
    expect(ids.indexOf('payments')).toBeGreaterThan(ids.indexOf('notifications'));
    expect(ids.indexOf('payments')).toBeGreaterThan(ids.indexOf('referrals'));
    expect(ids.indexOf('payments')).toBeGreaterThan(ids.indexOf('storage'));
    const mapsSetup = setupOrder.find((item) => item.id === 'maps');
    expect(mapsSetup?.notes).toEqual(
      expect.arrayContaining([
        'external:check:maps validates the MapTiler style endpoint and a Vietnam geocoding query.',
      ]),
    );
    const storageSetup = setupOrder.find((item) => item.id === 'storage');
    expect(storageSetup?.notes).toEqual(
      expect.arrayContaining([
        'Local MinIO upload/read smoke passes for private verification files and public partner media.',
      ]),
    );
    const supabaseSetup = setupOrder.find((item) => item.id === 'supabase');
    expect(supabaseSetup?.notes).toEqual(
      expect.arrayContaining([
        'Run local:status before relying on local smoke results; it reports API build freshness, live API health, and Admin reachability.',
      ]),
    );
    expect(supabaseSetup?.commands).toEqual(
      expect.arrayContaining(['npm.cmd run local:status']),
    );
    const notificationSetup = setupOrder.find((item) => item.id === 'notifications');
    expect(notificationSetup?.notes).toEqual(
      expect.arrayContaining([
        'google-services.json is mobile client config only; it does not replace server-side Firebase Admin credentials.',
        'Firebase Admin credentials must come from the same Firebase project as the customer and Partner google-services.json files.',
        'Run fcm:token-smoke -- --dry-run first; it lists customer/Partner actors and config without contacting the API or FCM.',
        'Run fcm:token-smoke before live push smoke; it verifies customer/Partner token registration without contacting FCM.',
        'Run fcm:token-recovery-smoke -- --dry-run before the API/DB recovery check; it lists the synthetic recovery contract without writing records.',
        'Run fcm:token-recovery-smoke after token registration changes; it verifies disabled-token re-enable and replacement-token behavior without contacting FCM.',
        'Run fcm:push-smoke -- --dry-run for merged config/readiness only; it does not contact the API or FCM.',
        'Run fcm:push-smoke -- --preflight --use-registered-device to check API readiness, Firebase project alignment, notification availability, and registered device readiness without sending FCM.',
        'After a live fcm:push-smoke, rerun fcm:push-smoke -- --preflight --use-registered-device and confirm retryAuditPreflight.evidence is HAS_PUSH_DEVICE_LAST_SEEN_AT before relying on stale-token decisions.',
        'If the latest Partner alert is blocked by notification.partner_alert_channel, FCM smoke auto-selects or suggests a standard-notification id instead of changing policy just for testing.',
        'Live push smoke needs either a real app FCM token or FCM_SMOKE_USE_REGISTERED_DEVICE=true after that same app session registers an enabled device.',
        'Use the notification board to separate credential or delivery failures, disabled tokens, stale tokens, and pending worker queue issues before retry.',
        'After fcm:push-smoke, review the FCM route, failed sends, disabled device, stale device, pending queue, operations handoff, and Notification audit evidence before enabling FCM push broadly.',
      ]),
    );
    expect(notificationSetup?.commands).toEqual(
      expect.arrayContaining([
        'npm.cmd run external:check:push',
        'npm.cmd run notifications:push-data-contract',
        'npm.cmd run notifications:retry-audit-contract',
        'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly',
        'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -UpdateEnv',
        'npm.cmd run security:secrets',
        'npm.cmd run fcm:credentials-check',
        'npm.cmd run docker:contract',
        'npm.cmd run fcm:token-smoke -- --dry-run',
        'npm.cmd run fcm:token-recovery-smoke -- --dry-run',
        'npm.cmd run fcm:token-recovery-smoke',
        'npm.cmd run fcm:push-smoke -- --dry-run',
        'npm.cmd run fcm:push-smoke -- --preflight',
        'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device',
        FCM_PROVIDER_SUGGESTED_NOTIFICATION_PREFLIGHT_COMMAND,
        'npm.cmd run fcm:token-smoke',
        FCM_CUSTOMER_LIVE_TOKEN_SMOKE_COMMAND,
        FCM_CUSTOMER_LIVE_REGISTERED_DEVICE_SMOKE_COMMAND,
        ...FCM_SETUP_REVIEW_COMMANDS,
      ]),
    );
    const supabaseAuthSetup = setupOrder.find((item) => item.id === 'supabase-auth');
    expect(supabaseAuthSetup?.env).toEqual([
      'AUTH_BACKEND',
      'SMS_PROVIDER',
      'SMS_API_URL',
      'SMS_API_KEY',
      'SMS_API_SECRET',
      'SMS_SENDER_ID',
      'SUPABASE_PHONE_SMOKE_PHONE',
    ]);
    expect(supabaseAuthSetup?.notes).toEqual(
      expect.arrayContaining([
        'auth:supabase-smoke passes the synthetic Supabase JWT exchange and role-boundary contract; the real Phone Auth OTP verify path must still produce the Supabase access token before mobile switching.',
        'Current Vonage credentials can send an OTP to the test device; SMS sender-channel refinement is deferred.',
        'Do not switch mobile login broadly until a captured 6 digit OTP verifies and API token exchange passes.',
        'For Supabase Phone Auth E2E, maintain the configured SMS/Verify credential in the chosen provider console and keep SMS_PROVIDER, SMS_API_URL, SMS_API_KEY, SMS_API_SECRET, and SMS_SENDER_ID in ignored env only.',
        'For Vonage, use the dashboard owned by administration@hands.vn; only revisit the endpoint, sender, or product choice when SMS delivery is required.',
        'Live OTP smoke is split into --send and --verify so operators do not send OTP messages by accident.',
      ]),
    );
    expect(supabaseAuthSetup?.commands).toEqual(
      expect.arrayContaining([
        'npm.cmd run auth:supabase-phone-smoke -- --dry-run',
        '$env:SUPABASE_PHONE_SMOKE_PHONE="+84900000001"; npm.cmd run auth:supabase-phone-smoke -- --send',
        '$env:SUPABASE_PHONE_SMOKE_OTP="<6-digit-code>"; npm.cmd run auth:supabase-phone-smoke -- --verify',
      ]),
    );
    const operationsPolicySetup = setupOrder.find((item) => item.id === 'operations-policy');
    expect(operationsPolicySetup?.notes).toEqual(
      expect.arrayContaining([
        'Partners with negative wallet balance can view marketplace requests, but final acceptance, service start, and payout release wait for settlement.',
      ]),
    );
    expect(operationsPolicySetup?.notes.join(' ')).not.toContain(
      'marketplace alerts, participation',
    );
    const referralSetup = setupOrder.find((item) => item.id === 'referrals');
    expect(referralSetup?.env).toEqual([
      'REFERRAL_PUBLIC_BASE_URL',
      'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
      'REFERRAL_CUSTOMER_IOS_STORE_URL',
      'REFERRAL_PARTNER_ANDROID_STORE_URL',
      'REFERRAL_PARTNER_IOS_STORE_URL',
    ]);
    expect(referralSetup?.commands).toEqual(
      expect.arrayContaining([
        'npm.cmd run external:check:referrals',
        'npm.cmd run referrals:public-link-smoke -- --dry-run',
        'npm.cmd run referrals:public-link-smoke',
        'npm.cmd run referrals:claim-api-smoke -- --dry-run',
        'npm.cmd run referrals:claim-api-smoke',
        'npm.cmd run referrals:reward-action-smoke -- --dry-run',
        'npm.cmd run referrals:reward-action-smoke',
        'npm.cmd run referrals:wallet-credit-readiness',
      ]),
    );
    expect(referralSetup?.notes).toEqual(
      expect.arrayContaining([
        'Run referral reward action smoke before broad referral operations; it verifies admin hold, reverse, and audited wallet credit decisions.',
        'Run referral wallet-credit readiness as a guardrail; automatic payout must stay disabled unless explicitly approved.',
        'Reward candidates can be staged in Admin, and wallet posting remains an audited admin credit action.',
      ]),
    );
    expect(referralSetup?.notes.join(' ')).not.toContain('Keep referral rewards disabled');
    expect(referralSetup?.notes.join(' ')).not.toContain('remaining ledger/API gap');
  });

  it('keeps external registration and baseline handoff data populated', () => {
    const planIds = externalRegistrationPlan.map((item) => item.id);
    expect(planIds).toEqual(
      expect.arrayContaining([
        'github-org',
        'operations-policy',
        'fcm',
        'referral-app-links',
        'payments-vn',
      ]),
    );
    expect(planIds.indexOf('payments-vn')).toBeGreaterThan(planIds.indexOf('fcm'));
    expect(planIds.indexOf('payments-vn')).toBeGreaterThan(planIds.indexOf('referral-app-links'));
    expect(planIds.indexOf('payments-vn')).toBeGreaterThan(planIds.indexOf('storage-cdn'));
    const fcmPlan = externalRegistrationPlan.find((item) => item.id === 'fcm');
    expect(fcmPlan).toMatchObject({
      groupId: 'notifications',
      provider: 'Firebase Cloud Messaging',
    });
    expect(fcmPlan?.status).toBeUndefined();
    expect(fcmPlan?.statusClass).toBeUndefined();
    const phonePlan = externalRegistrationPlan.find((item) => item.id === 'sms-phone-provider');
    expect(phonePlan).toMatchObject({
      groupId: 'supabase-auth',
      provider: 'Supabase Phone Auth + Vonage',
    });
    expect(phonePlan?.status).toBeUndefined();
    expect(phonePlan?.statusClass).toBeUndefined();
    expect(phonePlan?.env).toEqual([
      'AUTH_BACKEND',
      'SMS_PROVIDER',
      'SMS_API_URL',
      'SMS_API_KEY',
      'SMS_API_SECRET',
      'SMS_SENDER_ID',
      'SUPABASE_PHONE_SMOKE_PHONE',
    ]);
    const storagePlan = externalRegistrationPlan.find((item) => item.id === 'storage-cdn');
    expect(storagePlan?.detail).toContain('Local MinIO upload/read smoke passes for development.');
    const referralPlan = externalRegistrationPlan.find((item) => item.id === 'referral-app-links');
    expect(referralPlan).toMatchObject({
      groupId: 'referrals',
      provider: 'Google Play + Apple App Store',
      status: 'Deferred',
      statusClass: 'pill-neutral',
    });
    expect(projectControlSequence.map((item) => item.phase)).toEqual([
      'Phase A',
      'Phase B',
      'Phase C',
      'Phase D',
      'Phase E',
    ]);
    expect(verifiedBaseline).toEqual(
      expect.arrayContaining([
        'API typecheck and build pass.',
        'MapTiler, Geoapify, and storage smoke checks pass.',
        'Secret leak guard passes.',
      ]),
    );
  });

  it('keeps notification setup review links backed by notification filters', () => {
    const notificationSetup = setupOrder.find((item) => item.id === 'notifications');
    const supportedReviews = new Set<string>(
      notificationFilterLinks.map((link) => link.review).filter(Boolean),
    );
    const linkedReviews =
      notificationSetup?.commands
        .map((command) => command.match(/\/notifications\?review=([^"'\s]+)/)?.[1])
        .filter((review): review is string => Boolean(review)) ?? [];

    expect(linkedReviews).toEqual([
      'fcm',
      'failed',
      'disabled-device',
      'stale-device',
      'unattempted',
    ]);
    expect(linkedReviews.every((review) => supportedReviews.has(review))).toBe(true);
  });

  it('keeps FCM push smoke setup commands aligned with the executable script contract', () => {
    const root = workspaceRoot();
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      readonly scripts?: Record<string, string>;
    };
    const fcmPushSmokeSource = readFileSync(resolve(root, 'infra/scripts/fcm-push-smoke.mjs'), 'utf8');
    const notificationSetup = setupOrder.find((item) => item.id === 'notifications');
    const pushSmokeCommands =
      notificationSetup?.commands.filter((command) => command.includes('fcm:push-smoke')) ?? [];

    expect(pushSmokeCommands).toHaveLength(6);
    expect(
      new Set(pushSmokeCommands.flatMap((command) => command.match(/npm\.cmd run ([\w:-]+)/)?.[1])),
    ).toEqual(new Set(['fcm:push-smoke']));
    expect(packageJson.scripts?.['fcm:push-smoke']).toBe('node infra/scripts/fcm-push-smoke.mjs');
    expect(
      pushSmokeCommands.find((command) => command.includes('<preflight suggested standard notification id>')),
    ).toContain('FCM_SMOKE_EXPECT_STATUS="SENT"');
    expect(pushSmokeCommands).toContain('npm.cmd run fcm:push-smoke -- --preflight --use-registered-device');

    for (const command of pushSmokeCommands) {
      if (command.includes('--dry-run')) {
        expect(fcmPushSmokeSource).toContain("process.argv.includes('--dry-run')");
      }
      if (command.includes('--preflight')) {
        expect(fcmPushSmokeSource).toContain("process.argv.includes('--preflight')");
      }
      const envKeys = Array.from(command.matchAll(/\$env:(FCM_SMOKE_[A-Z0-9_]+)/g)).map((match) => match[1]);
      expect(envKeys.every((key) => fcmPushSmokeSource.includes(key))).toBe(true);
    }
  });
});

function workspaceRoot() {
  return process.cwd().replaceAll('\\', '/').endsWith('/apps/admin_web')
    ? resolve(process.cwd(), '..', '..')
    : process.cwd();
}
