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
        'Run fcm:token-smoke before live push smoke; it verifies customer/provider token registration without contacting FCM.',
        'Run fcm:push-smoke -- --dry-run for merged config/readiness only; it does not contact the API or FCM.',
        'Live push smoke needs a real app FCM token from the current Android/iOS build.',
        'After fcm:push-smoke, review the FCM route, failed sends, disabled device, stale device, and pending queues before enabling OS push broadly.',
      ]),
    );
    expect(notificationSetup?.commands).toEqual(
      expect.arrayContaining([
        'npm.cmd run external:check:push',
        'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -UpdateEnv',
        'npm.cmd run fcm:credentials-check',
        'npm.cmd run fcm:token-smoke -- --dry-run',
        'npm.cmd run fcm:push-smoke -- --dry-run',
        'npm.cmd run fcm:token-smoke',
        '$env:FCM_SMOKE_DEVICE_TOKEN="<real app FCM token>"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
        'Open http://localhost:3101/notifications?review=fcm',
        'Open http://localhost:3101/notifications?review=failed',
        'Open http://localhost:3101/notifications?review=disabled-device',
        'Open http://localhost:3101/notifications?review=stale-device',
        'Open http://localhost:3101/notifications?review=pending',
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
});
