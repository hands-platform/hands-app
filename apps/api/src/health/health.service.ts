import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FCM_CREDENTIAL_REQUIREMENT,
  FIREBASE_SERVICE_ACCOUNT_JSON_KEY,
  GOOGLE_APPLICATION_CREDENTIALS_KEY,
  configuredFirebaseCredentialKeys,
  firebaseCredentialReadiness,
  readFirebaseCredentialConfig,
} from '../notifications/firebase-admin-credentials';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { FCM_ANDROID_NOTIFICATION_CHANNEL_ID } from '../notifications/push-delivery.service';

const EXTERNAL_READINESS_CACHE_TTL_MS = 5_000;
const EXTERNAL_RUNTIME_PROBE_TIMEOUT_MS = 2_000;
const EXTERNAL_RUNTIME_STALE_MS = 5 * 60_000;
const CURRENT_LAUNCH_PROFILE = 'CASH_ONLY' as const;
const CURRENT_REFERRAL_RELEASE_PROFILE = 'ANDROID_MVP' as const;

@Injectable()
export class HealthService {
  private externalReadinessCache: { expiresAt: number; value: ExternalReadinessResult } | null = null;
  private externalServicesCache: { expiresAt: number; value: ExternalServicesOverview } | null = null;
  private readonly runtimeEvidence = new Map<
    string,
    { failureSince: string | null; lastSuccessAt: string | null }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisStateService,
  ) {}

  healthcheck() {
    return {
      ok: true,
      service: 'hands-api',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const [database, redis] = await Promise.all([this.databaseStatus(), this.redisStatus()]);
    const storage = this.storageStatus();
    const ok = database.ok && redis.ok;

    return {
      ok,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
        storage: { ok: storage.ok },
      },
    };
  }

  externalReadiness() {
    const now = Date.now();

    if (this.externalReadinessCache && this.externalReadinessCache.expiresAt > now) {
      return this.externalReadinessCache.value;
    }

    const value = this.buildExternalReadiness();
    this.externalReadinessCache = {
      expiresAt: now + EXTERNAL_READINESS_CACHE_TTL_MS,
      value,
    };

    return value;
  }

  async externalServicesOverview(): Promise<ExternalServicesOverview> {
    const now = Date.now();
    if (this.externalServicesCache && this.externalServicesCache.expiresAt > now) {
      return this.externalServicesCache.value;
    }

    const legacy = this.externalReadiness();
    const databaseProbe = await this.databaseRuntimeProbe();
    const services = legacy.checks
      .filter((check) => !['mobile', 'mobile-release'].includes(check.category))
      .map((check) => this.externalServiceStatus(check, legacy.timestamp, databaseProbe));
    const actionServices = services.filter(externalServiceNeedsAction);
    const blockingCategories = uniqueCategories(actionServices.map((service) => service.category));
    const evidenceGapServices = services.filter(externalServiceHasEvidenceGap);
    const overview: ExternalServicesOverview = {
      ...legacy,
      currentStageOk: actionServices.length === 0,
      blockingCategories,
      deferredCategories: uniqueCategories(
        services
          .filter((service) => service.configurationStatus === 'DEFERRED')
          .map((service) => service.category),
      ),
      launchProfile: CURRENT_LAUNCH_PROFILE,
      referralReleaseProfile: CURRENT_REFERRAL_RELEASE_PROFILE,
      generatedAt: new Date().toISOString(),
      counts: {
        total: services.length,
        active: services.filter(
          (service) => service.enabled && service.configurationStatus !== 'DEFERRED',
        ).length,
        needsAction: actionServices.length,
        launchBlockers: services.filter(
          (service) =>
            service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE',
        ).length,
        degraded: services.filter(
          (service) => service.enabled && service.runtimeStatus === 'DEGRADED',
        ).length,
        unknown: services.filter(
          (service) => service.enabled && service.runtimeStatus === 'UNKNOWN',
        ).length,
        notMonitored: services.filter(
          (service) => service.enabled && service.runtimeStatus === 'NOT_MONITORED',
        ).length,
        evidenceGaps: evidenceGapServices.length,
        deferred: services.filter((service) => service.configurationStatus === 'DEFERRED').length,
        required: services.filter((service) => service.requiredForCurrentLaunch).length,
        configurationReady: services.filter(
          (service) =>
            service.requiredForCurrentLaunch && service.configurationStatus === 'CONFIGURED',
        ).length,
        runtimeVerified: services.filter(
          (service) =>
            service.requiredForCurrentLaunch &&
            service.evidenceLevel !== 'CONFIGURATION_ONLY' &&
            service.lastVerifiedAt !== null,
        ).length,
      },
      services,
    };

    this.externalServicesCache = {
      expiresAt: now + EXTERNAL_READINESS_CACHE_TTL_MS,
      value: overview,
    };
    return overview;
  }

  private buildExternalReadiness(): ExternalReadinessResult {
    const rawChecks = [
      this.mobileFirebaseRemovalReadiness(),
      this.mobileReleaseReadiness(),
      this.externalGroup('Supabase core', 'supabase', [
        { key: 'SUPABASE_URL', validator: 'https-url' },
        { key: 'SUPABASE_ANON_KEY' },
        { key: 'SUPABASE_JWT_SECRET', validator: 'secret' },
        { key: 'SUPABASE_SERVICE_ROLE_KEY', validator: 'secret' },
      ]),
      this.externalGroup('Supabase Phone Auth', 'supabase-auth', [
        { key: 'AUTH_BACKEND', expected: 'supabase' },
      ]),
      this.externalGroup('Maps and geocoding', 'maps', [
        { key: 'MAPTILER_API_KEY' },
        { key: 'GEOAPIFY_API_KEY' },
      ]),
      this.externalGroup('Referral app links', 'referrals', [
        ...referralRequirementsForProfile(CURRENT_REFERRAL_RELEASE_PROFILE),
      ]),
      this.externalGroup('MoMo payments', 'payments', [
        { key: 'MOMO_GATEWAY_ENABLED', expected: 'true' },
        { key: 'MOMO_PARTNER_CODE' },
        { key: 'MOMO_ACCESS_KEY' },
        { key: 'MOMO_SECRET_KEY', validator: 'secret' },
        { key: 'MOMO_BASE_URL', validator: 'https-url' },
        { key: 'MOMO_IPN_URL', validator: 'https-url' },
        { key: 'MOMO_REDIRECT_URL', validator: 'https-url' },
      ]),
      this.externalGroup('VNPay payments', 'payments', [
        { key: 'VNPAY_GATEWAY_ENABLED', expected: 'true' },
        { key: 'VNPAY_TMN_CODE' },
        { key: 'VNPAY_HASH_SECRET', validator: 'secret' },
        { key: 'VNPAY_PAYMENT_URL', validator: 'https-url' },
        { key: 'VNPAY_API_URL', validator: 'https-url' },
        { key: 'VNPAY_RETURN_URL', validator: 'https-url' },
        { key: 'VNPAY_SERVER_IP' },
      ]),
      this.storageExternalReadiness(),
      this.externalGroup('Production SMS', 'sms', [
        { key: 'SMS_PROVIDER', validator: 'sms-provider' },
        { key: 'SMS_API_URL', validator: 'https-url' },
        { key: 'SMS_API_KEY' },
        { key: 'SMS_API_SECRET', validator: 'secret' },
        { key: 'SMS_SENDER_ID' },
      ]),
      this.pushProviderExternalReadiness(),
    ] as ExternalReadinessCheck[];
    const checks = rawChecks.map((check) => this.decorateExternalCheck(check));
    const currentStageChecks = checks.filter((check) => check.scope === 'CURRENT_STAGE');
    const blockingCategories = uniqueCategories(
      currentStageChecks.filter((check) => check.status !== 'READY').map((check) => check.category),
    );
    const deferredCategories = uniqueCategories(
      checks
        .filter((check) => check.scope === 'DEFERRED' && check.status !== 'READY')
        .map((check) => check.category),
    );
    const currentStageCommands = uniqueStrings(
      currentStageChecks.filter((check) => check.status !== 'READY').flatMap((check) => check.commands ?? []),
    );
    const deferredCommands = uniqueStrings(
      checks
        .filter((check) => check.scope === 'DEFERRED' && check.status !== 'READY')
        .flatMap((check) => check.commands ?? []),
    );

    return {
      ok: checks.every((check) => check.status === 'READY'),
      currentStageOk: blockingCategories.length === 0,
      productionE2EOk: checks.every((check) => check.status === 'READY'),
      blockingCategories,
      deferredCategories,
      currentStageCommands,
      deferredCommands,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async databaseStatus() {
    const probe = await this.databaseConnectivityProbe();
    return { ok: probe.ok };
  }

  private async databaseRuntimeProbe(): Promise<RuntimeProbeResult> {
    const lastEvidence = this.runtimeEvidence.get('supabase-core') ?? {
      failureSince: null,
      lastSuccessAt: null,
    };
    const probe = await this.databaseConnectivityProbe(EXTERNAL_RUNTIME_PROBE_TIMEOUT_MS);

    if (probe.ok) {
      const lastProbeAt = new Date().toISOString();
      this.runtimeEvidence.set('supabase-core', {
        failureSince: null,
        lastSuccessAt: lastProbeAt,
      });
      return {
        evidenceSummary: 'Database connectivity probe succeeded.',
        failureSince: null,
        isStale: false,
        lastProbeAt,
        lastSuccessAt: lastProbeAt,
        latencyMs: probe.latencyMs,
        status: 'HEALTHY',
      };
    }

    const lastProbeAt = new Date().toISOString();
    const failureSince = probe.timedOut
      ? lastEvidence.failureSince
      : lastEvidence.failureSince ?? lastProbeAt;
    this.runtimeEvidence.set('supabase-core', {
      failureSince,
      lastSuccessAt: lastEvidence.lastSuccessAt,
    });
    return {
      evidenceSummary: probe.timedOut
        ? 'Database connectivity probe timed out; runtime state is unknown.'
        : 'Database connectivity probe failed.',
      failureSince,
      isStale: Boolean(
        lastEvidence.lastSuccessAt &&
          Date.now() - Date.parse(lastEvidence.lastSuccessAt) > EXTERNAL_RUNTIME_STALE_MS,
      ),
      lastProbeAt,
      lastSuccessAt: lastEvidence.lastSuccessAt,
      latencyMs: probe.latencyMs,
      status: probe.timedOut ? 'UNKNOWN' : 'DOWN',
    };
  }

  private async databaseConnectivityProbe(timeoutMs?: number) {
    const startedAt = Date.now();
    try {
      const query = this.prisma.$queryRaw`SELECT 1`;
      await (timeoutMs ? withTimeout(query, timeoutMs) : query);
      return { latencyMs: Date.now() - startedAt, ok: true, timedOut: false };
    } catch (error) {
      return {
        latencyMs: Date.now() - startedAt,
        ok: false,
        timedOut: error instanceof RuntimeProbeTimeoutError,
      };
    }
  }

  private externalServiceStatus(
    check: ExternalReadinessCheck,
    configurationCheckedAt: string,
    databaseProbe: RuntimeProbeResult,
  ): ExternalServiceStatus {
    const policy = externalServicePolicy(
      CURRENT_LAUNCH_PROFILE,
      check,
      this.config,
    );
    const runtime = check.category === 'supabase'
      ? databaseProbe
      : {
          evidenceSummary:
            'Configuration was checked. No safe side-effect-free runtime probe is configured.',
          failureSince: null,
          isStale: false,
          lastProbeAt: null,
          lastSuccessAt: null,
          latencyMs: null,
          status: 'NOT_MONITORED' as const,
        };
    const metadata = externalServiceOperatorMetadata(check.category, check.name);
    const deferredMetadata = policy.configurationStatus === 'DEFERRED'
      ? deferredServiceMetadata(check)
      : null;
    const evidenceLevel: ExternalEvidenceLevel = check.category === 'supabase'
      ? 'CONNECTIVITY'
      : 'CONFIGURATION_ONLY';
    const lastVerifiedAt = check.category === 'supabase'
      ? runtime.lastProbeAt
      : configurationCheckedAt;
    const runtimeNeedsAction = ['DOWN', 'DEGRADED'].includes(runtime.status);
    const runtimeNeedsVerification = ['UNKNOWN', 'NOT_MONITORED'].includes(runtime.status);
    const service: ExternalServiceStatus = {
      id: externalServiceId(check),
      name: check.name,
      category: externalServiceCategory(check.category),
      launchScope: policy.requiredForCurrentLaunch ? 'CURRENT_STAGE' : 'DEFERRED',
      enabled: policy.enabled,
      requiredForCurrentLaunch: policy.requiredForCurrentLaunch,
      configurationStatus: policy.configurationStatus,
      configurationCheckedAt,
      runtimeStatus: runtime.status,
      probeType: check.category === 'supabase' ? 'CONNECTIVITY' : 'CONFIG',
      evidenceLevel,
      lastVerifiedAt,
      verificationMethod:
        check.category === 'supabase'
          ? 'Bounded database connectivity query.'
          : 'Configuration keys and formats only; no safe side-effect-free runtime probe.',
      lastProbeAt: runtime.lastProbeAt,
      lastSuccessAt: runtime.lastSuccessAt,
      failureSince: runtime.failureSince,
      latencyMs: runtime.latencyMs,
      isStale: runtime.isStale,
      evidenceSummary: runtime.evidenceSummary,
      impactSummary: externalServiceImpactSummary(check.category, runtime.status),
      ownerTeam: metadata.ownerTeam,
      evidenceHref: metadata.evidenceHref,
      relatedWorkspaceHref: metadata.relatedWorkspaceHref,
      runbookHref: metadata.runbookHref,
      escalationRoute: metadata.relatedWorkspaceHref,
      runbookUrl: metadata.runbookHref,
      deferredReason: deferredMetadata?.deferredReason ?? null,
      futureReadiness: deferredMetadata?.futureReadiness ?? null,
      reentryChecks: deferredMetadata?.reentryChecks ?? [],
      reviewTrigger: deferredMetadata?.reviewTrigger ?? null,
      reviewedAt: null,
      platformScope: deferredMetadata?.platformScope ?? null,
      safeOperatorAction:
        policy.configurationStatus === 'DEFERRED'
          ? deferredMetadata?.operatorAction ?? 'Review this capability only when its launch trigger is reached.'
          : policy.configurationStatus === 'INCOMPLETE'
            ? metadata.configurationAction
            : runtimeNeedsAction
              ? metadata.runtimeAction
              : runtimeNeedsVerification
                ? metadata.runtimeAction
                : 'No configuration action required.',
      evidenceGap: false,
    };
    service.evidenceGap = externalServiceHasEvidenceGap(service);

    return service;
  }

  private async redisStatus() {
    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG' };
    } catch {
      return { ok: false };
    }
  }

  private storageStatus() {
    const required = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PUBLIC_BASE_URL'];
    const bucketConfigured = Boolean(
      this.config.get<string>('S3_BUCKET') ||
      (this.config.get<string>('S3_PRIVATE_BUCKET') && this.config.get<string>('S3_PUBLIC_BUCKET')),
    );
    const missing = [
      ...required.filter((key) => !this.config.get<string>(key)),
      bucketConfigured ? null : 'S3_BUCKET or S3_PRIVATE_BUCKET+S3_PUBLIC_BUCKET',
    ].filter((key): key is string => Boolean(key));
    const provider = this.config.get<string>('STORAGE_PROVIDER')?.trim() || 's3-compatible';
    const mode =
      missing.length > 0
        ? 'placeholder'
        : provider === 'supabase-storage-s3'
          ? 'supabase-storage-s3'
          : 's3-compatible-presigned';

    return {
      ok: missing.length === 0,
      provider,
      mode,
      missing,
      publicBaseUrlConfigured: Boolean(this.config.get<string>('S3_PUBLIC_BASE_URL')),
    };
  }

  private storageExternalReadiness() {
    const storage = this.storageStatus();
    const configured = [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_PRIVATE_BUCKET',
      'S3_PUBLIC_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ].filter((key) => this.config.get<string>(key));
    if (this.config.get<string>('S3_REGION')) {
      configured.push('S3_REGION');
    }
    if (this.config.get<string>('S3_PUBLIC_BASE_URL')) {
      configured.push('S3_PUBLIC_BASE_URL');
    }

    return {
      name: 'File storage and CDN',
      category: 'storage',
      status: externalCheckStatus({ configured, invalid: [], missing: storage.missing }),
      configured,
      missing: storage.missing,
      invalid: [],
      detail: storage.ok
        ? `${storage.provider} storage is configured for file upload/read flows.`
        : 'Configure S3-compatible, Supabase Storage S3, R2, or MinIO storage values.',
    };
  }

  private pushProviderExternalReadiness() {
    const pushProvider = this.config.get<string>('PUSH_PROVIDER')?.trim().toLowerCase() || 'in_app_only';
    const firebaseConfig = readFirebaseCredentialConfig(this.config);

    if (pushProvider === 'in_app_only') {
      return {
        name: 'FCM push service',
        category: 'push',
        status: 'BLOCKED',
        missing: [FCM_CREDENTIAL_REQUIREMENT],
        configured: ['PUSH_PROVIDER'],
        invalid: [],
        detail:
          'Current delivery is in-app only. Set PUSH_PROVIDER=fcm and server-side Firebase Admin credentials before FCM push E2E.',
      };
    }

    if (pushProvider !== 'fcm') {
      return {
        name: 'FCM push service',
        category: 'push',
        status: 'BLOCKED',
        missing: [],
        configured: [],
        invalid: ['PUSH_PROVIDER'],
        detail:
          'Unsupported push provider. Use PUSH_PROVIDER=in_app_only locally or PUSH_PROVIDER=fcm for staging.',
      };
    }

    const readiness = firebaseCredentialReadiness(firebaseConfig);
    const configured = ['PUSH_PROVIDER', ...configuredFirebaseCredentialKeys(firebaseConfig)];

    return {
      name: 'FCM push service',
      category: 'push',
      status: readiness.ready ? 'READY' : 'BLOCKED',
      missing: readiness.missing,
      configured,
      invalid: readiness.invalid,
      detail: readiness.ready
        ? 'FCM credentials are configured and backend Firebase Admin delivery is enabled.'
        : readiness.invalid.includes(FIREBASE_SERVICE_ACCOUNT_JSON_KEY)
          ? 'FCM push is selected, but FIREBASE_SERVICE_ACCOUNT_JSON is not a valid Firebase service account JSON payload.'
          : readiness.invalid.includes(GOOGLE_APPLICATION_CREDENTIALS_KEY)
            ? 'FCM push is selected, but GOOGLE_APPLICATION_CREDENTIALS does not point to an existing valid service account JSON file.'
            : 'FCM push is selected, but server-side Firebase Admin credentials are missing.',
    };
  }

  private mobileReleaseReadiness() {
    const repoRoot = this.findRepoRoot();
    const customerKeyPropertiesPath = join(repoRoot, 'apps/customer_app/android/key.properties');
    const providerKeyPropertiesPath = join(repoRoot, 'apps/provider_app/android/key.properties');
    const customerExamplePath = join(repoRoot, 'apps/customer_app/android/key.properties.example');
    const providerExamplePath = join(repoRoot, 'apps/provider_app/android/key.properties.example');
    const customerUploadKeystore = this.config.get<string>('ANDROID_CUSTOMER_UPLOAD_KEYSTORE')?.trim();
    const providerUploadKeystore = this.config.get<string>('ANDROID_PROVIDER_UPLOAD_KEYSTORE')?.trim();
    const customerUploadKeystoreExists = this.configuredPathExists(repoRoot, customerUploadKeystore);
    const providerUploadKeystoreExists = this.configuredPathExists(repoRoot, providerUploadKeystore);

    const configured = [
      existsSync(customerExamplePath) ? 'customer_key_properties_example' : null,
      existsSync(providerExamplePath) ? 'provider_key_properties_example' : null,
      existsSync(customerKeyPropertiesPath) || customerUploadKeystoreExists
        ? 'ANDROID_CUSTOMER_UPLOAD_KEYSTORE'
        : null,
      existsSync(providerKeyPropertiesPath) || providerUploadKeystoreExists
        ? 'ANDROID_PROVIDER_UPLOAD_KEYSTORE'
        : null,
    ].filter((value): value is string => Boolean(value));
    const missing = [
      existsSync(customerExamplePath) ? null : 'apps/customer_app/android/key.properties.example',
      existsSync(providerExamplePath) ? null : 'apps/provider_app/android/key.properties.example',
      existsSync(customerKeyPropertiesPath) || customerUploadKeystoreExists
        ? null
        : 'ANDROID_CUSTOMER_UPLOAD_KEYSTORE',
      existsSync(providerKeyPropertiesPath) || providerUploadKeystoreExists
        ? null
        : 'ANDROID_PROVIDER_UPLOAD_KEYSTORE',
    ].filter((value): value is string => Boolean(value));
    const invalid = [
      customerUploadKeystore && !customerUploadKeystoreExists ? 'ANDROID_CUSTOMER_UPLOAD_KEYSTORE' : null,
      providerUploadKeystore && !providerUploadKeystoreExists ? 'ANDROID_PROVIDER_UPLOAD_KEYSTORE' : null,
    ].filter((value): value is string => Boolean(value));
    const localSigningPrepared = existsSync(customerExamplePath) && existsSync(providerExamplePath);
    const releaseSecretsConfigured =
      (existsSync(customerKeyPropertiesPath) || customerUploadKeystoreExists) &&
      (existsSync(providerKeyPropertiesPath) || providerUploadKeystoreExists);

    return {
      name: 'Android release signing',
      category: 'mobile-release',
      status:
        invalid.length > 0
          ? 'BLOCKED'
          : releaseSecretsConfigured
            ? 'READY'
            : localSigningPrepared
              ? 'PARTIAL'
              : 'BLOCKED',
      configured,
      missing,
      invalid,
      detail:
        invalid.length > 0
          ? 'One or more Android upload keystore paths are configured but do not exist on disk.'
          : releaseSecretsConfigured
            ? 'Customer and provider Android release signing values are configured locally.'
            : localSigningPrepared
              ? 'Signing examples are committed; create local key.properties files and store keystores outside Git before Play release.'
              : 'Add Android signing examples and local release signing setup before production distribution.',
    };
  }

  private configuredPathExists(repoRoot: string, value?: string) {
    return Boolean(value && existsSync(resolve(repoRoot, value)));
  }

  private mobileFirebaseRemovalReadiness() {
    const repoRoot = this.findRepoRoot();
    const apps = [
      {
        name: 'customer_app',
        expectedAndroidPackage: 'com.massagevn.customer.customer_app',
        pubspecPath: 'apps/customer_app/pubspec.yaml',
        rootGradlePath: 'apps/customer_app/android/build.gradle.kts',
        appGradlePath: 'apps/customer_app/android/app/build.gradle.kts',
        manifestPath: 'apps/customer_app/android/app/src/main/AndroidManifest.xml',
        fcmHandlerPath: 'apps/customer_app/lib/src/core/fcm_message_handling_service.dart',
        configPath: 'apps/customer_app/android/app/google-services.json',
      },
      {
        name: 'provider_app',
        expectedAndroidPackage: 'com.massagevn.provider.provider_app',
        pubspecPath: 'apps/provider_app/pubspec.yaml',
        rootGradlePath: 'apps/provider_app/android/build.gradle.kts',
        appGradlePath: 'apps/provider_app/android/app/build.gradle.kts',
        manifestPath: 'apps/provider_app/android/app/src/main/AndroidManifest.xml',
        fcmHandlerPath: 'apps/provider_app/lib/src/core/fcm_message_handling_service.dart',
        configPath: 'apps/provider_app/android/app/google-services.json',
      },
    ].map((app) => {
      const pubspec = this.readRepoFile(repoRoot, app.pubspecPath);
      const rootGradle = this.readRepoFile(repoRoot, app.rootGradlePath);
      const appGradle = this.readRepoFile(repoRoot, app.appGradlePath);
      const manifest = this.readRepoFile(repoRoot, app.manifestPath);
      const fcmHandler = this.readRepoFile(repoRoot, app.fcmHandlerPath);
      const googleServices = this.readRepoFile(repoRoot, app.configPath);
      const checked = pubspec !== null || rootGradle !== null || appGradle !== null;
      const hasBlockedFirebasePackages =
        /cloud_firestore|firebase_auth|firebase_database|firebase_storage/.test(pubspec ?? '');
      const androidApplicationId = androidApplicationIdFromGradle(appGradle ?? '');
      const googleServicesPackages = googleServicesAndroidPackages(googleServices);
      const androidManifestChannelId = androidManifestDefaultChannelId(manifest ?? '');
      const fcmHandlerChannelId = dartFcmNotificationChannelId(fcmHandler ?? '');
      const androidApplicationIdMatches = androidApplicationId === app.expectedAndroidPackage;
      const googleServicesPackageMatches =
        googleServices === null || googleServicesPackages.includes(app.expectedAndroidPackage);
      const notificationChannelIdMatches =
        androidManifestChannelId === FCM_ANDROID_NOTIFICATION_CHANNEL_ID &&
        fcmHandlerChannelId === FCM_ANDROID_NOTIFICATION_CHANNEL_ID;

      return {
        name: app.name,
        checked,
        ok:
          checked &&
          !hasBlockedFirebasePackages &&
          androidApplicationIdMatches &&
          googleServicesPackageMatches &&
          notificationChannelIdMatches,
        failures: [
          hasBlockedFirebasePackages ? 'blocked_firebase_package' : null,
          androidApplicationIdMatches ? null : 'android_application_id_mismatch',
          googleServicesPackageMatches ? null : 'google_services_package_mismatch',
          notificationChannelIdMatches ? null : 'fcm_channel_id_mismatch',
        ].filter((value): value is string => Boolean(value)),
      };
    });

    const sourceAvailable = apps.every((app) => app.checked);
    const failingApps = apps.filter((app) => !app.ok);

    return {
      name: 'Mobile Firebase scope guard',
      category: 'mobile',
      status: !sourceAvailable ? 'PARTIAL' : failingApps.length === 0 ? 'READY' : 'BLOCKED',
      configured: apps.filter((app) => app.ok).map((app) => app.name),
      missing: failingApps.map((app) => app.name),
      invalid: failingApps.flatMap((app) => app.failures.map((failure) => `${app.name}:${failure}`)),
      detail: !sourceAvailable
        ? 'Mobile app source files were not available to this API runtime; run the local Firebase scope script from the repository.'
        : failingApps.length === 0
          ? 'Customer and provider Flutter apps keep Firebase limited to FCM-only surfaces with matching Android FCM app IDs and channel IDs.'
          : 'Fix Firebase package scope, Android app IDs, google-services package names, or FCM channel IDs in the listed mobile apps. FCM is allowed.',
    };
  }

  private findRepoRoot() {
    const cwd = process.cwd();
    const candidates = [cwd, resolve(cwd, '..', '..')];
    return (
      candidates.find((candidate) =>
        existsSync(join(candidate, 'infra/scripts/check-mobile-firebase.mjs')),
      ) ?? cwd
    );
  }

  private readRepoFile(repoRoot: string, relativePath: string) {
    const fullPath = join(repoRoot, relativePath);
    return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : null;
  }

  private externalGroup(
    name: string,
    category: string,
    requirements: Array<{
      key: string;
      validator?: 'https-url' | 'secret' | 'sms-provider';
      expected?: string;
    }>,
  ) {
    const configured: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const requirement of requirements) {
      const value = this.config.get<string>(requirement.key)?.trim() ?? '';
      if (!value) {
        missing.push(requirement.key);
        continue;
      }

      if (requirement.expected && value.toLowerCase() !== requirement.expected.toLowerCase()) {
        invalid.push(requirement.key);
        continue;
      }

      if (requirement.validator === 'https-url' && !isHttpsUrl(value)) {
        invalid.push(requirement.key);
        continue;
      }

      if (requirement.validator === 'secret' && !isSecretLikeValue(value)) {
        invalid.push(requirement.key);
        continue;
      }

      if (requirement.validator === 'sms-provider' && !isSupportedSmsProvider(value)) {
        invalid.push(requirement.key);
        continue;
      }

      configured.push(requirement.key);
    }

    const status = externalCheckStatus({ configured, invalid, missing });

    return {
      name,
      category,
      status,
      configured,
      missing,
      invalid,
      detail:
        status === 'READY'
          ? 'All required environment values are configured.'
          : 'Set the missing or invalid environment values before production-like E2E testing.',
    };
  }

  private decorateExternalCheck(check: ExternalReadinessCheck): ExternalReadinessCheck {
    const metadata = externalReadinessMetadata(check.category, check.name);
    const policy = externalServicePolicy(CURRENT_LAUNCH_PROFILE, check, this.config);
    const deferred = !policy.requiredForCurrentLaunch;
    return {
      ...check,
      scope: deferred ? 'DEFERRED' : 'CURRENT_STAGE',
      deferred,
      operatorAction: metadata.operatorAction,
      commands: metadata.commands,
      secretSafe: true,
      detail: metadata.detailPrefix ? `${metadata.detailPrefix} ${check.detail}` : check.detail,
    };
  }
}

type ExternalReadinessCheck = {
  name: string;
  category: string;
  status: 'READY' | 'PARTIAL' | 'BLOCKED';
  configured: string[];
  missing: string[];
  invalid: string[];
  detail: string;
  scope?: 'CURRENT_STAGE' | 'DEFERRED';
  deferred?: boolean;
  operatorAction?: string;
  commands?: string[];
  secretSafe?: boolean;
};

type ExternalReadinessResult = {
  ok: boolean;
  currentStageOk: boolean;
  productionE2EOk: boolean;
  blockingCategories: string[];
  deferredCategories: string[];
  currentStageCommands: string[];
  deferredCommands: string[];
  timestamp: string;
  checks: ExternalReadinessCheck[];
};

type ExternalConfigurationStatus =
  | 'CONFIGURED'
  | 'INCOMPLETE'
  | 'DISABLED'
  | 'DEFERRED'
  | 'UNKNOWN';

type ExternalRuntimeStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'NOT_MONITORED';
type ExternalEvidenceLevel = 'CONFIGURATION_ONLY' | 'CONNECTIVITY' | 'FUNCTIONAL';
export type ExternalFutureReadiness = 'NOT_STARTED' | 'PARTIAL' | 'READY_FOR_REENTRY';
export type ExternalReentryCheck = {
  label: string;
  status: 'VERIFIED' | 'PENDING' | 'FUTURE';
};
export type ReferralReleaseProfile = 'ANDROID_MVP' | 'IOS_RELEASE';

type RuntimeProbeResult = {
  evidenceSummary: string;
  failureSince: string | null;
  isStale: boolean;
  lastProbeAt: string | null;
  lastSuccessAt: string | null;
  latencyMs: number | null;
  status: ExternalRuntimeStatus;
};

type ExternalServiceStatus = {
  id: string;
  name: string;
  category: 'auth' | 'core' | 'maps' | 'payments' | 'storage' | 'messaging' | 'referrals';
  launchScope: 'CURRENT_STAGE' | 'DEFERRED';
  enabled: boolean;
  requiredForCurrentLaunch: boolean;
  configurationStatus: ExternalConfigurationStatus;
  configurationCheckedAt: string | null;
  runtimeStatus: ExternalRuntimeStatus;
  probeType: 'CONFIG' | 'CONNECTIVITY' | 'FUNCTIONAL_E2E' | 'NONE';
  evidenceLevel: ExternalEvidenceLevel;
  lastVerifiedAt: string | null;
  verificationMethod: string;
  lastProbeAt: string | null;
  lastSuccessAt: string | null;
  failureSince: string | null;
  latencyMs: number | null;
  isStale: boolean;
  evidenceSummary: string;
  impactSummary: string;
  ownerTeam: string;
  evidenceHref: string | null;
  relatedWorkspaceHref: string | null;
  runbookHref: string | null;
  escalationRoute: string | null;
  runbookUrl: string | null;
  deferredReason: string | null;
  futureReadiness: ExternalFutureReadiness | null;
  reentryChecks: ExternalReentryCheck[];
  reviewTrigger: string | null;
  reviewedAt: string | null;
  platformScope: ReferralReleaseProfile | null;
  safeOperatorAction: string | null;
  evidenceGap: boolean;
};

type ExternalServicesOverview = ExternalReadinessResult & {
  launchProfile: typeof CURRENT_LAUNCH_PROFILE | 'ONLINE_PAYMENTS';
  referralReleaseProfile: ReferralReleaseProfile;
  generatedAt: string;
  counts: {
    total: number;
    active: number;
    needsAction: number;
    launchBlockers: number;
    degraded: number;
    unknown: number;
    notMonitored: number;
    evidenceGaps: number;
    deferred: number;
    required: number;
    configurationReady: number;
    runtimeVerified: number;
  };
  services: ExternalServiceStatus[];
};

class RuntimeProbeTimeoutError extends Error {}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RuntimeProbeTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function externalServicePolicy(
  launchProfile: ExternalServicesOverview['launchProfile'],
  check: ExternalReadinessCheck,
  config: ConfigService,
): {
  configurationStatus: ExternalConfigurationStatus;
  enabled: boolean;
  requiredForCurrentLaunch: boolean;
} {
  const paymentGatewayKey = check.name === 'MoMo payments'
    ? 'MOMO_GATEWAY_ENABLED'
    : check.name === 'VNPay payments'
      ? 'VNPAY_GATEWAY_ENABLED'
      : null;
  const explicitlyEnabled = paymentGatewayKey
    ? config.get<string>(paymentGatewayKey)?.trim().toLowerCase() === 'true'
    : check.category === 'push'
      ? config.get<string>('PUSH_PROVIDER')?.trim().toLowerCase() === 'fcm'
      : true;

  if (['mobile', 'mobile-release', 'referrals'].includes(check.category)) {
    return {
      configurationStatus: 'DEFERRED',
      enabled: false,
      requiredForCurrentLaunch: false,
    };
  }

  if (paymentGatewayKey && launchProfile === 'CASH_ONLY' && !explicitlyEnabled) {
    return {
      configurationStatus: 'DEFERRED',
      enabled: false,
      requiredForCurrentLaunch: false,
    };
  }

  const requiredForCurrentLaunch =
    !paymentGatewayKey || launchProfile === 'ONLINE_PAYMENTS' || explicitlyEnabled;
  return {
    configurationStatus: check.status === 'READY' ? 'CONFIGURED' : 'INCOMPLETE',
    enabled: explicitlyEnabled,
    requiredForCurrentLaunch,
  };
}

export function referralRequirementsForProfile(profile: ReferralReleaseProfile) {
  const androidRequirements = [
    { key: 'REFERRAL_PUBLIC_BASE_URL', validator: 'https-url' as const },
    { key: 'REFERRAL_CUSTOMER_ANDROID_STORE_URL', validator: 'https-url' as const },
    { key: 'REFERRAL_PARTNER_ANDROID_STORE_URL', validator: 'https-url' as const },
  ];

  return profile === 'IOS_RELEASE'
    ? [
        ...androidRequirements,
        { key: 'REFERRAL_CUSTOMER_IOS_STORE_URL', validator: 'https-url' as const },
        { key: 'REFERRAL_PARTNER_IOS_STORE_URL', validator: 'https-url' as const },
      ]
    : androidRequirements;
}

export function futureReadinessFromChecks(
  checks: readonly ExternalReentryCheck[],
): ExternalFutureReadiness {
  const currentChecks = checks.filter((check) => check.status !== 'FUTURE');
  const verified = currentChecks.filter((check) => check.status === 'VERIFIED').length;
  if (verified === 0) return 'NOT_STARTED';
  return verified === currentChecks.length ? 'READY_FOR_REENTRY' : 'PARTIAL';
}

function deferredServiceMetadata(check: ExternalReadinessCheck) {
  if (check.name === 'MoMo payments') {
    return deferredMetadata({
      deferredReason: 'Online payments are outside the current cash-only launch.',
      operatorAction: 'Review the MoMo re-entry checklist when online payments enter scope.',
      platformScope: null,
      reentryChecks: [
        reentryCheck(
          'Merchant sandbox connection',
          hasConfigured(check, ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'MOMO_BASE_URL']),
        ),
        reentryCheck(
          'Public HTTPS callback and redirect',
          hasConfigured(check, ['MOMO_IPN_URL', 'MOMO_REDIRECT_URL']),
        ),
        { label: 'Signed checkout, callback, and query-recovery smoke', status: 'PENDING' },
        { label: 'Reconciliation and refund runbook verification', status: 'PENDING' },
      ],
      reviewTrigger: 'When the online-payment phase is approved.',
    });
  }

  if (check.name === 'VNPay payments') {
    return deferredMetadata({
      deferredReason: 'VNPay is intentionally disabled during the cash-only launch.',
      operatorAction: 'Review the VNPay re-entry checklist when online payments enter scope.',
      platformScope: null,
      reentryChecks: [
        reentryCheck(
          'Merchant sandbox and signing configuration',
          hasConfigured(check, ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_PAYMENT_URL', 'VNPAY_API_URL']),
        ),
        reentryCheck(
          'Public HTTPS return route and server identity',
          hasConfigured(check, ['VNPAY_RETURN_URL', 'VNPAY_SERVER_IP']),
        ),
        { label: 'Signed checkout, GET IPN, and query-recovery smoke', status: 'PENDING' },
        { label: 'Asynchronous refund end-to-end verification', status: 'PENDING' },
      ],
      reviewTrigger: 'After the online-payment phase and public DNS/TLS are approved.',
    });
  }

  return deferredMetadata({
    deferredReason: 'Public referral sharing and store routing are outside the current launch stage.',
    operatorAction: 'Review referral link readiness before public sharing is enabled.',
    platformScope: CURRENT_REFERRAL_RELEASE_PROFILE,
    reentryChecks: [
      reentryCheck('Public referral base URL', hasConfigured(check, ['REFERRAL_PUBLIC_BASE_URL'])),
      reentryCheck(
        'Customer Android store destination',
        hasConfigured(check, ['REFERRAL_CUSTOMER_ANDROID_STORE_URL']),
      ),
      reentryCheck(
        'Partner Android store destination',
        hasConfigured(check, ['REFERRAL_PARTNER_ANDROID_STORE_URL']),
      ),
      { label: 'Android device-routing smoke', status: 'PENDING' },
      { label: 'Customer and Partner iOS destinations', status: 'FUTURE' },
    ],
    reviewTrigger: 'Before public referral sharing or an Android store release begins.',
  });
}

function deferredMetadata(input: {
  deferredReason: string;
  operatorAction: string;
  platformScope: ReferralReleaseProfile | null;
  reentryChecks: ExternalReentryCheck[];
  reviewTrigger: string;
}) {
  return {
    ...input,
    futureReadiness: futureReadinessFromChecks(input.reentryChecks),
  };
}

function reentryCheck(label: string, verified: boolean): ExternalReentryCheck {
  return { label, status: verified ? 'VERIFIED' : 'PENDING' };
}

function hasConfigured(check: ExternalReadinessCheck, keys: readonly string[]) {
  return keys.every((key) => check.configured.includes(key));
}

function externalServiceNeedsAction(service: ExternalServiceStatus) {
  return (
    (service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE') ||
    (service.enabled && ['DOWN', 'DEGRADED'].includes(service.runtimeStatus))
  );
}

function externalServiceHasEvidenceGap(service: ExternalServiceStatus) {
  return (
    service.requiredForCurrentLaunch &&
    service.enabled &&
    ['UNKNOWN', 'NOT_MONITORED'].includes(service.runtimeStatus)
  );
}

function externalServiceId(check: ExternalReadinessCheck) {
  return `${check.category}-${check.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function externalServiceCategory(category: string): ExternalServiceStatus['category'] {
  if (category === 'supabase') return 'core';
  if (category === 'supabase-auth') return 'auth';
  if (category === 'push' || category === 'sms') return 'messaging';
  if (category === 'referrals') return 'referrals';
  if (category === 'payments') return 'payments';
  if (category === 'storage') return 'storage';
  return 'maps';
}

function externalServiceOperatorMetadata(category: string, name: string) {
  if (category === 'supabase') {
    return {
      ownerTeam: 'Platform operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/app-sessions',
      runbookHref: null,
      configurationAction: 'Escalate missing server configuration to Platform operations.',
      runtimeAction: 'Review affected app sessions and escalate database connectivity.',
    };
  }
  if (category === 'supabase-auth') {
    return {
      ownerTeam: 'Identity operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/app-sessions',
      runbookHref: null,
      configurationAction: 'Escalate phone authentication configuration to Identity operations.',
      runtimeAction: 'Review app sessions before asking customers or Partners to retry sign-in.',
    };
  }
  if (category === 'maps') {
    return {
      ownerTeam: 'Marketplace operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/vietnam-overview?view=live',
      runbookHref: null,
      configurationAction: 'Escalate map credential setup to Marketplace operations.',
      runtimeAction: 'Review Vietnam operations before relying on map coverage.',
    };
  }
  if (category === 'payments') {
    return {
      ownerTeam: 'Finance operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/payments',
      runbookHref: null,
      configurationAction: `Keep ${name.replace(' payments', '')} disabled until sandbox verification is complete.`,
      runtimeAction: 'Review payment evidence before accepting the affected payment method.',
    };
  }
  if (category === 'storage') {
    return {
      ownerTeam: 'Platform operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/partners',
      runbookHref: null,
      configurationAction: 'Escalate storage configuration before processing new documents or media.',
      runtimeAction: 'Review affected Partner documents and escalate storage connectivity.',
    };
  }
  if (category === 'referrals') {
    return {
      ownerTeam: 'Growth operations',
      evidenceHref: null,
      relatedWorkspaceHref: '/referrals/customers#referral-link-readiness',
      runbookHref: null,
      configurationAction: 'Prepare public links only when referral launch enters scope.',
      runtimeAction: 'Review referral attribution evidence.',
    };
  }
  return {
    ownerTeam: 'Customer operations',
    evidenceHref:
      category === 'push'
        ? '/notifications?mode=action&issue=failed&channel=fcm'
        : null,
    relatedWorkspaceHref: category === 'push' ? '/notifications' : '/app-sessions',
    runbookHref: null,
    configurationAction:
      category === 'push'
        ? 'Escalate push configuration; use in-app records for urgent follow-up.'
        : 'Escalate SMS configuration before asking users to retry phone verification.',
    runtimeAction:
      category === 'push'
        ? 'Review notification delivery and use in-app records for urgent follow-up.'
        : 'Review app sessions before asking users to retry phone verification.',
  };
}

function externalServiceImpactSummary(
  category: string,
  status: ExternalRuntimeStatus,
) {
  if (!['DOWN', 'DEGRADED'].includes(status)) {
    return 'No confirmed impact.';
  }

  const condition = status === 'DOWN' ? 'may be unavailable' : 'may be impaired';
  if (category === 'supabase') {
    return `Customer, Partner, booking, and retained service records ${condition}.`;
  }
  if (category === 'supabase-auth') {
    return `Sign-in and phone verification ${condition}.`;
  }
  if (category === 'maps') {
    return `Address search and nearby Partner discovery ${condition}.`;
  }
  if (category === 'payments') {
    return `The affected payment method ${condition}.`;
  }
  if (category === 'storage') {
    return `Document and media access ${condition}.`;
  }
  if (category === 'referrals') {
    return `Referral links and attribution ${condition}.`;
  }
  if (category === 'push') {
    return `Push notification delivery ${condition}.`;
  }
  return `SMS verification delivery ${condition}.`;
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSecretLikeValue(value: string) {
  return value.length >= 16 && !/^change-me$/i.test(value);
}

function isSupportedSmsProvider(value: string) {
  return ['vonage', 'viettel', 'fpt', 'custom'].includes(value.trim().toLowerCase());
}

function externalCheckStatus(input: {
  configured: readonly string[];
  invalid: readonly string[];
  missing: readonly string[];
}): ExternalReadinessCheck['status'] {
  if (input.missing.length === 0 && input.invalid.length === 0) {
    return 'READY';
  }
  return input.configured.length > 0 ? 'PARTIAL' : 'BLOCKED';
}

function androidApplicationIdFromGradle(source: string) {
  return source.match(/\bapplicationId\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

function googleServicesAndroidPackages(source: string | null) {
  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source) as {
      client?: Array<{
        client_info?: {
          android_client_info?: {
            package_name?: unknown;
          };
        };
      }>;
    };

    return (parsed.client ?? [])
      .map((client) => client.client_info?.android_client_info?.package_name)
      .filter(
        (packageName): packageName is string => typeof packageName === 'string' && packageName.length > 0,
      );
  } catch {
    return [];
  }
}

function androidManifestDefaultChannelId(source: string) {
  return source.match(/default_notification_channel_id"[\s\S]*?android:value="([^"]+)"/)?.[1] ?? null;
}

function dartFcmNotificationChannelId(source: string) {
  return source.match(/\bhandsFcmNotificationChannelId\s*=\s*'([^']+)'/)?.[1] ?? null;
}

function uniqueCategories(categories: string[]) {
  return [...new Set(categories)];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function externalReadinessMetadata(category: string, name: string) {
  if (category === 'supabase') {
    return {
      operatorAction:
        'Set Supabase core values in the ignored .env or server environment. Keep service role and JWT secret server-side only.',
      commands: ['npm.cmd run external:check:supabase', 'npm.cmd run supabase:schema:check'],
    };
  }

  if (category === 'maps') {
    return {
      operatorAction:
        'Set MapTiler and Geoapify keys in the ignored .env or shell, then rerun map readiness before mobile map E2E.',
      commands: ['npm.cmd run external:check:maps'],
    };
  }

  if (category === 'storage') {
    return {
      detailPrefix:
        'Local MVP can continue without upload E2E, but KYC/media upload flows need this before release.',
      operatorAction:
        'Configure MinIO, R2, or Supabase Storage S3 values outside Git, then run storage readiness and smoke.',
      commands: ['npm.cmd run external:check:storage', 'npm.cmd run storage:smoke'],
    };
  }

  if (category === 'supabase-auth') {
    return {
      operatorAction:
        'Keep Nest/dev OTP for local work. Enable Supabase Phone Auth only after the chosen SMS service is ready.',
      commands: ['npm.cmd run external:check:supabase-auth', 'npm.cmd run auth:supabase-smoke'],
    };
  }

  if (category === 'payments') {
    return {
      operatorAction:
        'Register MoMo/VNPay merchant values for staging E2E. Keep cash and mocked status checks until merchant credentials are ready.',
      commands: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
    };
  }

  if (category === 'sms') {
    return {
      operatorAction:
        'Register the chosen SMS service and connect the API key, API secret, endpoint, and sender only when production phone OTP E2E begins.',
      commands: ['npm.cmd run external:check:supabase-auth'],
    };
  }

  if (category === 'push') {
    return {
      operatorAction:
        'Use in-app notifications as fallback, then run push readiness, env contract, credential, token, and live-device checks before broad FCM push.',
      commands: [
        'npm.cmd run external:check:push',
        'npm.cmd run fcm:env-contract',
        'npm.cmd run fcm:credentials-check',
        'npm.cmd run fcm:token-smoke -- --dry-run',
        'npm.cmd run fcm:push-smoke -- --dry-run',
      ],
    };
  }

  if (category === 'referrals') {
    return {
      detailPrefix:
        'Referral policy can be configured in Admin without enabling public referral links yet.',
      operatorAction:
        'Set the public referral base URL and customer/Partner Android/iOS store URLs before referral link E2E.',
      commands: ['npm.cmd run external:check:referrals'],
    };
  }

  if (category === 'mobile-release') {
    return {
      operatorAction:
        'Create local Android release signing files and keystores outside Git before Play release.',
      commands: ['npm.cmd run external:check:production'],
    };
  }

  if (category === 'mobile') {
    return {
      operatorAction: name.includes('Firebase')
        ? 'Keep Firebase DB/Auth/Firestore out of mobile; FCM setup is the only allowed Firebase mobile surface.'
        : 'Run the mobile guard scripts from the repository.',
      commands: ['node infra\\scripts\\check-mobile-firebase.mjs'],
    };
  }

  return {
    operatorAction: 'Fill the required values outside Git, then rerun the setup checks.',
    commands: ['npm.cmd run external:check'],
  };
}
