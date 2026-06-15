import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  externalRegistrationPlan,
  projectControlSequence,
  setupOrder,
  verifiedBaseline,
} from './setup-page-data';
import { notificationFilterLinks } from '../notifications/notification-page-model';

describe('setup page data', () => {
  it('keeps setup order ids unique and required operating groups visible', () => {
    const ids = setupOrder.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mobile',
        'supabase',
        'operations-policy',
        'payments',
        'notifications',
        'storage',
      ]),
    );
    expect(setupOrder.find((item) => item.id === 'notifications')?.env).toEqual(
      expect.arrayContaining(['PUSH_PROVIDER', 'FIREBASE_PROJECT_ID']),
    );
    const notificationSetup = setupOrder.find((item) => item.id === 'notifications');
    expect(notificationSetup?.notes).toEqual(
      expect.arrayContaining([
        'google-services.json is mobile client config only; it does not replace server-side Firebase Admin credentials.',
        'Firebase Admin credentials must come from the same Firebase project as the customer and Partner google-services.json files.',
        'Run fcm:token-smoke -- --dry-run first; it lists customer/Partner actors and config without contacting the API or FCM.',
        'Run fcm:token-smoke before live push smoke; it verifies customer/Partner token registration without contacting FCM.',
        'Run fcm:token-recovery-smoke after token registration changes; it verifies disabled-token re-enable and replacement-token behavior without contacting FCM.',
        'Run fcm:push-smoke -- --dry-run for merged config/readiness only; it does not contact the API or FCM.',
        'Run fcm:push-smoke -- --preflight to check API readiness, Firebase project alignment, notification availability, and registered device readiness without sending FCM.',
        'After a live fcm:push-smoke, rerun fcm:push-smoke -- --preflight and confirm retryAuditPreflight.evidence is HAS_PUSH_DEVICE_LAST_SEEN_AT before relying on stale-token decisions.',
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
        'npm.cmd run fcm:token-recovery-smoke',
        'npm.cmd run fcm:push-smoke -- --dry-run',
        'npm.cmd run fcm:push-smoke -- --preflight',
        '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_PHONE="+84900000002"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; $env:FCM_SMOKE_NOTIFICATION_ID="<preflight suggested standard notification id>"; npm.cmd run fcm:push-smoke -- --preflight',
        'npm.cmd run fcm:token-smoke',
        '$env:FCM_SMOKE_ROLE="CUSTOMER"; $env:FCM_SMOKE_PHONE="+84900000001"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_DEVICE_TOKEN="<real app FCM token>"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
        '$env:FCM_SMOKE_ROLE="CUSTOMER"; $env:FCM_SMOKE_PHONE="+84900000001"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
        'Open http://localhost:3101/notifications?review=fcm',
        'Open http://localhost:3101/notifications?review=failed',
        'Open http://localhost:3101/notifications?review=disabled-device',
        'Open http://localhost:3101/notifications?review=stale-device',
        'Open http://localhost:3101/notifications?review=pending',
        'Open http://localhost:3101/operations-handoff',
        'Open http://localhost:3101/audit-log?bucket=Notification',
      ]),
    );
  });

  it('keeps external registration and baseline handoff data populated', () => {
    expect(externalRegistrationPlan.map((item) => item.id)).toEqual(
      expect.arrayContaining(['github-org', 'operations-policy', 'fcm', 'payments-vn']),
    );
    const fcmPlan = externalRegistrationPlan.find((item) => item.id === 'fcm');
    expect(fcmPlan).toMatchObject({
      groupId: 'notifications',
      provider: 'Firebase Cloud Messaging',
    });
    expect(fcmPlan?.status).toBeUndefined();
    expect(fcmPlan?.statusClass).toBeUndefined();
    expect(projectControlSequence.map((item) => item.phase)).toEqual([
      'Phase A',
      'Phase B',
      'Phase C',
      'Phase D',
      'Phase E',
    ]);
    expect(verifiedBaseline).toEqual(
      expect.arrayContaining(['API typecheck and build pass.', 'Secret leak guard passes.']),
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

    expect(linkedReviews).toEqual(['fcm', 'failed', 'disabled-device', 'stale-device', 'pending']);
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

    expect(pushSmokeCommands).toHaveLength(5);
    expect(
      new Set(pushSmokeCommands.flatMap((command) => command.match(/npm\.cmd run ([\w:-]+)/)?.[1])),
    ).toEqual(new Set(['fcm:push-smoke']));
    expect(packageJson.scripts?.['fcm:push-smoke']).toBe('node infra/scripts/fcm-push-smoke.mjs');
    expect(
      pushSmokeCommands.find((command) => command.includes('<preflight suggested standard notification id>')),
    ).toContain('FCM_SMOKE_EXPECT_STATUS="SENT"');

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
