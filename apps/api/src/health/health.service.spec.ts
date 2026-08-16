import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  futureReadinessFromChecks,
  HealthService,
  referralRequirementsForProfile,
} from './health.service';

function config(values: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function service(values: Record<string, string> = {}) {
  return new HealthService(config(values), {} as never, {} as never);
}

function storageCheck(values: Record<string, string> = {}) {
  return service(values)
    .externalReadiness()
    .checks.find((check) => check.category === 'storage');
}

function pushCheck(values: Record<string, string> = {}) {
  return service(values)
    .externalReadiness()
    .checks.find((check) => check.category === 'push');
}

function smsCheck(values: Record<string, string> = {}) {
  return service(values)
    .externalReadiness()
    .checks.find((check) => check.category === 'sms');
}

function referralCheck(values: Record<string, string> = {}) {
  return service(values)
    .externalReadiness()
    .checks.find((check) => check.category === 'referrals');
}

describe('HealthService external readiness caching', () => {
  it('reuses external readiness results within one service instance to avoid repeated setup scans', () => {
    const get = vi.fn((key: string) => ({ PUSH_PROVIDER: 'in_app_only' })[key]);
    const health = new HealthService({ get } as unknown as ConfigService, {} as never, {} as never);

    const first = health.externalReadiness();
    const callsAfterFirst = get.mock.calls.length;
    const second = health.externalReadiness();

    expect(second).toBe(first);
    expect(get).toHaveBeenCalledTimes(callsAfterFirst);
  });
});

describe('HealthService external services status contract', () => {
  it('separates configuration readiness from safe runtime evidence', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const health = new HealthService(
      config({
        SUPABASE_URL: 'https://hands-staging.supabase.co',
        SUPABASE_ANON_KEY: 'public-anon-key',
        SUPABASE_JWT_SECRET: 'placeholder-jwt-secret',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
        MAPTILER_API_KEY: 'maptiler-key',
        GEOAPIFY_API_KEY: 'geoapify-key',
      }),
      { $queryRaw: queryRaw } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    const supabase = overview.services.find((item) => item.name === 'Supabase core');
    const maps = overview.services.find((item) => item.name === 'Maps and geocoding');

    expect(supabase).toMatchObject({
      configurationStatus: 'CONFIGURED',
      runtimeStatus: 'HEALTHY',
      probeType: 'CONNECTIVITY',
      evidenceLevel: 'CONNECTIVITY',
      lastVerifiedAt: expect.any(String),
      evidenceGap: false,
      lastProbeAt: expect.any(String),
      lastSuccessAt: expect.any(String),
      failureSince: null,
    });
    expect(maps).toMatchObject({
      configurationStatus: 'CONFIGURED',
      runtimeStatus: 'NOT_MONITORED',
      probeType: 'CONFIG',
      evidenceLevel: 'CONFIGURATION_ONLY',
      evidenceGap: true,
      lastProbeAt: null,
      lastSuccessAt: null,
      safeOperatorAction: 'Review Vietnam operations before relying on map coverage.',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('treats disabled payment gateways and referral links as deferred for cash-only launch', async () => {
    const health = new HealthService(
      config({ MOMO_GATEWAY_ENABLED: 'false', VNPAY_GATEWAY_ENABLED: 'false' }),
      { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    const deferred = overview.services.filter((service) =>
      ['MoMo payments', 'VNPay payments', 'Referral app links'].includes(service.name),
    );

    expect(overview.launchProfile).toBe('CASH_ONLY');
    expect(overview.referralReleaseProfile).toBe('ANDROID_MVP');
    expect(deferred).toHaveLength(3);
    expect(deferred).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configurationStatus: 'DEFERRED',
          launchScope: 'DEFERRED',
          enabled: false,
          requiredForCurrentLaunch: false,
          runtimeStatus: 'NOT_MONITORED',
          deferredReason: expect.any(String),
          futureReadiness: expect.stringMatching(/NOT_STARTED|PARTIAL|READY_FOR_REENTRY/),
          reentryChecks: expect.any(Array),
          reviewTrigger: expect.any(String),
          reviewedAt: null,
        }),
      ]),
    );
    expect(overview.counts.deferred).toBe(3);
    expect(overview.counts.total).toBe(overview.services.length);
    expect(overview.counts.active).toBe(
      overview.services.filter(
        (service) => service.enabled && service.configurationStatus !== 'DEFERRED',
      ).length,
    );
    expect(overview.counts.launchBlockers).toBe(
      overview.services.filter(
        (service) => service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE',
      ).length,
    );
    expect(overview.counts.unknown).toBe(
      overview.services.filter(
        (service) => service.enabled && service.runtimeStatus === 'UNKNOWN',
      ).length,
    );
    expect(overview.counts.notMonitored).toBe(
      overview.services.filter(
        (service) => service.enabled && service.runtimeStatus === 'NOT_MONITORED',
      ).length,
    );
    expect(overview.counts.evidenceGaps).toBe(
      overview.services.filter(
        (service) =>
          service.requiredForCurrentLaunch &&
          service.enabled &&
          ['UNKNOWN', 'NOT_MONITORED'].includes(service.runtimeStatus),
      ).length,
    );
    expect(overview.blockingCategories).not.toContain('payments');
    expect(overview.blockingCategories).not.toContain('referrals');
    expect(
      overview.checks
        .filter((check) => ['supabase-auth', 'sms', 'storage', 'push'].includes(check.category))
        .every((check) => check.scope === 'CURRENT_STAGE'),
    ).toBe(true);
    expect(
      overview.checks
        .filter((check) => ['payments', 'referrals'].includes(check.category))
        .every((check) => check.scope === 'DEFERRED'),
    ).toBe(true);
    expect(deferred.find((service) => service.name === 'MoMo payments')).toMatchObject({
      evidenceHref: null,
      relatedWorkspaceHref: '/payments',
      runbookHref: null,
    });
    expect(deferred.find((service) => service.name === 'Referral app links')).toMatchObject({
      platformScope: 'ANDROID_MVP',
      relatedWorkspaceHref: '/referrals/customers#referral-link-readiness',
    });
    expect(JSON.stringify(deferred)).not.toMatch(
      /MOMO_|VNPAY_|REFERRAL_.*_(?:URL|KEY|SECRET)|ACCESS_KEY|HASH_SECRET/,
    );
  });

  it('does not treat configuration alone as functional readiness for deferred work', async () => {
    const health = new HealthService(
      config({
        MOMO_PARTNER_CODE: 'sandbox-partner',
        MOMO_ACCESS_KEY: 'sandbox-access',
        MOMO_SECRET_KEY: 'valid-test-secret-1234567890',
        MOMO_BASE_URL: 'https://sandbox.example.test',
        MOMO_IPN_URL: 'https://hands.example.test/payments/momo/ipn',
        MOMO_REDIRECT_URL: 'https://hands.example.test/payments/momo/return',
      }),
      { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    const momo = overview.services.find((service) => service.name === 'MoMo payments');

    expect(momo?.reentryChecks.slice(0, 2).every((check) => check.status === 'VERIFIED')).toBe(true);
    expect(momo?.reentryChecks.slice(2).every((check) => check.status === 'PENDING')).toBe(true);
    expect(momo?.futureReadiness).toBe('PARTIAL');
  });

  it('does not hide an explicitly enabled payment gateway in deferred cash-only scope', async () => {
    const health = new HealthService(
      config({ MOMO_GATEWAY_ENABLED: 'true', VNPAY_GATEWAY_ENABLED: 'false' }),
      { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    const momoService = overview.services.find((service) => service.name === 'MoMo payments');
    const momoCheck = overview.checks.find((check) => check.name === 'MoMo payments');

    expect(momoService).toMatchObject({
      configurationStatus: 'INCOMPLETE',
      enabled: true,
      requiredForCurrentLaunch: true,
    });
    expect(momoCheck).toMatchObject({ deferred: false, scope: 'CURRENT_STAGE' });
    expect(overview.blockingCategories).toContain('payments');
  });

  it('marks a failed bounded database probe down without exposing the raw provider error', async () => {
    const health = new HealthService(
      config(),
      { $queryRaw: vi.fn().mockRejectedValue(new Error('postgres://user:secret@internal/db')) } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    const supabase = overview.services.find((item) => item.name === 'Supabase core');

    expect(supabase).toMatchObject({
      runtimeStatus: 'DOWN',
      evidenceSummary: 'Database connectivity probe failed.',
      lastProbeAt: expect.any(String),
      lastSuccessAt: null,
      failureSince: expect.any(String),
    });
    expect(JSON.stringify(overview)).not.toContain('postgres://');
    expect(overview.counts.needsAction).toBeGreaterThan(0);
  });

  it('does not run side-effectful OTP, push, SMS, payment, or upload probes', async () => {
    const get = vi.fn((key: string) => ({
      MOMO_GATEWAY_ENABLED: 'false',
      VNPAY_GATEWAY_ENABLED: 'false',
      PUSH_PROVIDER: 'in_app_only',
    })[key]);
    const health = new HealthService(
      { get } as unknown as ConfigService,
      { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as never,
      {} as never,
    );

    const overview = await health.externalServicesOverview();
    expect(overview.services.filter((service) => service.category !== 'core')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runtimeStatus: 'NOT_MONITORED' }),
      ]),
    );
    expect(get.mock.calls.map(([key]) => key)).not.toEqual(
      expect.arrayContaining(['OTP_PHONE', 'FCM_TOKEN', 'PAYMENT_AMOUNT', 'UPLOAD_FILE']),
    );
  });

  it('gives degraded runtime evidence a service-specific impact and operator action', () => {
    const health = new HealthService(
      config({
        SUPABASE_URL: 'https://hands-staging.supabase.co',
        SUPABASE_ANON_KEY: 'public-anon-key',
        SUPABASE_JWT_SECRET: 'placeholder-jwt-secret',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
      }),
      {} as never,
      {} as never,
    );
    const check = health.externalReadiness().checks.find((item) => item.category === 'supabase');
    const internalHealth = health as unknown as {
      externalServiceStatus: (
        value: unknown,
        checkedAt: string,
        probe: Record<string, unknown>,
      ) => { impactSummary: string; safeOperatorAction: string | null };
    };

    const degraded = internalHealth.externalServiceStatus(
      check,
      '2026-08-12T03:00:00.000Z',
      {
        evidenceSummary: 'Database connectivity is degraded.',
        failureSince: '2026-08-12T02:59:00.000Z',
        isStale: false,
        lastProbeAt: '2026-08-12T03:00:00.000Z',
        lastSuccessAt: '2026-08-12T02:58:00.000Z',
        latencyMs: 1_900,
        status: 'DEGRADED',
      },
    );

    expect(degraded.impactSummary).toBe(
      'Customer, Partner, booking, and retained service records may be impaired.',
    );
    expect(degraded.safeOperatorAction).toBe(
      'Review affected app sessions and escalate database connectivity.',
    );
  });
});

describe('HealthService public responses', () => {
  it('does not disclose the runtime environment from the public liveness response', () => {
    expect(service({ NODE_ENV: 'production' }).healthcheck()).toEqual({
      ok: true,
      service: 'hands-api',
      timestamp: expect.any(String),
    });
  });

  it('returns only boolean dependency status without raw infrastructure errors or config names', async () => {
    const health = new HealthService(
      config(),
      {
        $queryRaw: vi.fn().mockRejectedValue(new Error('postgres://user:secret@internal/db')),
      } as never,
      {
        ping: vi.fn().mockRejectedValue(new Error('redis://:secret@internal:6379')),
      } as never,
    );

    await expect(health.readiness()).resolves.toEqual({
      ok: false,
      timestamp: expect.any(String),
      checks: {
        database: { ok: false },
        redis: { ok: false },
        storage: { ok: false },
      },
    });
  });
});

describe('HealthService external storage readiness', () => {
  it('keeps storage blocked when no storage values are configured', () => {
    const check = storageCheck();

    expect(check?.status).toBe('BLOCKED');
    expect(check?.missing).toEqual([
      'S3_ENDPOINT',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_PUBLIC_BASE_URL',
      'S3_BUCKET or S3_PRIVATE_BUCKET+S3_PUBLIC_BUCKET',
    ]);
  });

  it('keeps storage partial when upload signing is configured but public CDN URL is missing', () => {
    const check = storageCheck({
      STORAGE_PROVIDER: 'supabase-storage-s3',
      S3_ENDPOINT: 'https://project-ref.storage.supabase.co/storage/v1/s3',
      S3_PRIVATE_BUCKET: 'hands-private',
      S3_PUBLIC_BUCKET: 'hands-public',
      S3_ACCESS_KEY: 'storage-access-key',
      S3_SECRET_KEY: 'storage-secret-key',
    });

    expect(check?.status).toBe('PARTIAL');
    expect(check?.configured).toEqual([
      'S3_ENDPOINT',
      'S3_PRIVATE_BUCKET',
      'S3_PUBLIC_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ]);
    expect(check?.missing).toEqual(['S3_PUBLIC_BASE_URL']);
  });

  it('marks Supabase Storage S3 ready when private, public, and CDN values are configured', () => {
    const check = storageCheck({
      STORAGE_PROVIDER: 'supabase-storage-s3',
      S3_ENDPOINT: 'https://project-ref.storage.supabase.co/storage/v1/s3',
      S3_PRIVATE_BUCKET: 'hands-private',
      S3_PUBLIC_BUCKET: 'hands-public',
      S3_ACCESS_KEY: 'storage-access-key',
      S3_SECRET_KEY: 'storage-secret-key',
      S3_PUBLIC_BASE_URL: 'https://project-ref.supabase.co/storage/v1/object/public/hands-public',
    });

    expect(check?.status).toBe('READY');
    expect(check?.missing).toEqual([]);
    expect(check?.detail).toContain('supabase-storage-s3 storage is configured');
  });
});

describe('HealthService external SMS readiness', () => {
  it('requires the approved sender id before production phone OTP readiness', () => {
    const check = smsCheck({
      SMS_PROVIDER: 'vonage',
      SMS_API_URL: 'https://api.example.test/sms',
      SMS_API_KEY: '51830fa7',
      SMS_API_SECRET: 'placeholder-sms-secret',
    });

    expect(check?.status).toBe('PARTIAL');
    expect(check?.configured).toEqual([
      'SMS_PROVIDER',
      'SMS_API_URL',
      'SMS_API_KEY',
      'SMS_API_SECRET',
    ]);
    expect(check?.missing).toEqual(['SMS_SENDER_ID']);
  });

  it('marks production SMS ready when provider, endpoint, key, secret, and sender id are configured', () => {
    const check = smsCheck({
      SMS_PROVIDER: 'vonage',
      SMS_API_URL: 'https://api.example.test/sms',
      SMS_API_KEY: '51830fa7',
      SMS_API_SECRET: 'placeholder-sms-secret',
      SMS_SENDER_ID: 'HANDS',
    });

    expect(check?.status).toBe('READY');
    expect(check?.configured).toEqual([
      'SMS_PROVIDER',
      'SMS_API_URL',
      'SMS_API_KEY',
      'SMS_API_SECRET',
      'SMS_SENDER_ID',
    ]);
    expect(check?.missing).toEqual([]);
  });

  it('blocks production SMS readiness when the provider value is not approved', () => {
    const check = smsCheck({
      SMS_PROVIDER: 'typo-provider',
      SMS_API_URL: 'https://api.example.test/sms',
      SMS_API_KEY: '51830fa7',
      SMS_API_SECRET: 'placeholder-sms-secret',
      SMS_SENDER_ID: 'HANDS',
    });

    expect(check?.status).toBe('PARTIAL');
    expect(check?.configured).toEqual([
      'SMS_API_URL',
      'SMS_API_KEY',
      'SMS_API_SECRET',
      'SMS_SENDER_ID',
    ]);
    expect(check?.invalid).toEqual(['SMS_PROVIDER']);
  });

  it('blocks production SMS readiness when the endpoint is not an HTTPS URL', () => {
    const check = smsCheck({
      SMS_PROVIDER: 'vonage',
      SMS_API_URL: 'not-a-url',
      SMS_API_KEY: '51830fa7',
      SMS_API_SECRET: 'placeholder-sms-secret',
      SMS_SENDER_ID: 'HANDS',
    });

    expect(check?.status).toBe('PARTIAL');
    expect(check?.configured).toEqual(['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_API_SECRET', 'SMS_SENDER_ID']);
    expect(check?.invalid).toEqual(['SMS_API_URL']);
  });

  it('keeps production SMS partial when the provider API secret is too weak', () => {
    const check = smsCheck({
      SMS_PROVIDER: 'vonage',
      SMS_API_URL: 'https://api.example.test/sms',
      SMS_API_KEY: '51830fa7',
      SMS_API_SECRET: 'short',
      SMS_SENDER_ID: 'HANDS',
    });

    expect(check?.status).toBe('PARTIAL');
    expect(check?.configured).toEqual(['SMS_PROVIDER', 'SMS_API_URL', 'SMS_API_KEY', 'SMS_SENDER_ID']);
    expect(check?.invalid).toEqual(['SMS_API_SECRET']);
  });
});

describe('HealthService external referral readiness', () => {
  it('tracks referral app store links as a deferred setup gap before referral E2E', () => {
    const check = referralCheck();
    const readiness = service().externalReadiness();

    expect(check).toMatchObject({
      name: 'Referral app links',
      category: 'referrals',
      status: 'BLOCKED',
      scope: 'DEFERRED',
      deferred: true,
    });
    expect(check?.missing).toEqual([
      'REFERRAL_PUBLIC_BASE_URL',
      'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
      'REFERRAL_PARTNER_ANDROID_STORE_URL',
    ]);
    expect(check?.commands).toEqual(['npm.cmd run external:check:referrals']);
    expect(readiness.blockingCategories).not.toContain('referrals');
    expect(readiness.deferredCategories).toContain('referrals');
  });

  it('marks Android referral links ready without requiring future iOS destinations', () => {
    const check = referralCheck({
      REFERRAL_PUBLIC_BASE_URL: 'https://hands.vn',
      REFERRAL_CUSTOMER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.massagevn.customer.customer_app',
      REFERRAL_PARTNER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.massagevn.provider.provider_app',
    });

    expect(check).toMatchObject({
      status: 'READY',
      scope: 'DEFERRED',
    });
    expect(check?.missing).toEqual([]);
    expect(check?.invalid).toEqual([]);
  });

  it('adds iOS destinations only for the iOS release profile', () => {
    expect(referralRequirementsForProfile('ANDROID_MVP').map((requirement) => requirement.key)).toEqual([
      'REFERRAL_PUBLIC_BASE_URL',
      'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
      'REFERRAL_PARTNER_ANDROID_STORE_URL',
    ]);
    expect(referralRequirementsForProfile('IOS_RELEASE').map((requirement) => requirement.key)).toEqual([
      'REFERRAL_PUBLIC_BASE_URL',
      'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
      'REFERRAL_PARTNER_ANDROID_STORE_URL',
      'REFERRAL_CUSTOMER_IOS_STORE_URL',
      'REFERRAL_PARTNER_IOS_STORE_URL',
    ]);
  });

  it('derives all future readiness states while excluding future-platform checks', () => {
    expect(futureReadinessFromChecks([
      { label: 'One', status: 'PENDING' },
      { label: 'iOS', status: 'FUTURE' },
    ])).toBe('NOT_STARTED');
    expect(futureReadinessFromChecks([
      { label: 'One', status: 'VERIFIED' },
      { label: 'Two', status: 'PENDING' },
      { label: 'iOS', status: 'FUTURE' },
    ])).toBe('PARTIAL');
    expect(futureReadinessFromChecks([
      { label: 'One', status: 'VERIFIED' },
      { label: 'Two', status: 'VERIFIED' },
      { label: 'iOS', status: 'FUTURE' },
    ])).toBe('READY_FOR_REENTRY');
  });
});

describe('HealthService external push readiness', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('keeps FCM blocked until Firebase Admin credentials are configured', () => {
    const check = pushCheck({ PUSH_PROVIDER: 'fcm' });

    expect(check?.status).toBe('BLOCKED');
    expect(check?.name).toBe('FCM push service');
    expect(check?.missing).toEqual([
      'FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS',
    ]);
    expect(check?.commands).toEqual([
      'npm.cmd run external:check:push',
      'npm.cmd run fcm:env-contract',
      'npm.cmd run fcm:credentials-check',
      'npm.cmd run fcm:token-smoke -- --dry-run',
      'npm.cmd run fcm:push-smoke -- --dry-run',
    ]);
  });

  it('keeps FCM blocked when application default credentials point to a missing file', () => {
    const check = pushCheck({
      PUSH_PROVIDER: 'fcm',
      GOOGLE_APPLICATION_CREDENTIALS: 'C:\\secure\\missing-firebase-admin.json',
    });

    expect(check?.status).toBe('BLOCKED');
    expect(check?.configured).toEqual(['PUSH_PROVIDER', 'GOOGLE_APPLICATION_CREDENTIALS']);
    expect(check?.invalid).toEqual(['GOOGLE_APPLICATION_CREDENTIALS']);
    expect(check?.detail).toContain('does not point to an existing valid service account JSON file');
  });

  it('keeps FCM blocked when service account JSON is present but incomplete', () => {
    const check = pushCheck({
      PUSH_PROVIDER: 'fcm',
      FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
    });

    expect(check?.status).toBe('BLOCKED');
    expect(check?.configured).toEqual(['PUSH_PROVIDER', 'FIREBASE_SERVICE_ACCOUNT_JSON']);
    expect(check?.missing).toEqual([]);
    expect(check?.invalid).toEqual(['FIREBASE_SERVICE_ACCOUNT_JSON']);
    expect(check?.detail).toContain('not a valid Firebase service account JSON payload');
  });

  it('marks FCM ready when application default credentials point to a valid service account file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hands-fcm-'));
    const serviceAccountPath = join(tempDir, 'firebase-admin.json');
    writeFileSync(
      serviceAccountPath,
      JSON.stringify({
        project_id: 'hands-demo',
        client_email: 'firebase-admin@example.test',
        private_key: 'private-key',
      }),
    );

    const check = pushCheck({
      PUSH_PROVIDER: 'fcm',
      GOOGLE_APPLICATION_CREDENTIALS: serviceAccountPath,
    });

    expect(check?.status).toBe('READY');
    expect(check?.configured).toEqual(['PUSH_PROVIDER', 'GOOGLE_APPLICATION_CREDENTIALS']);
    expect(check?.missing).toEqual([]);
  });

  it('marks FCM ready when split Firebase Admin credentials are configured', () => {
    const check = pushCheck({
      PUSH_PROVIDER: 'fcm',
      FIREBASE_PROJECT_ID: 'hands-demo',
      FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.test',
      FIREBASE_PRIVATE_KEY: 'placeholder-firebase-admin-private-key',
    });

    expect(check?.status).toBe('READY');
    expect(check?.configured).toEqual([
      'PUSH_PROVIDER',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ]);
    expect(check?.missing).toEqual([]);
  });
});
