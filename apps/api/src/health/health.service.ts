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

@Injectable()
export class HealthService {
  private externalReadinessCache: { expiresAt: number; value: ExternalReadinessResult } | null = null;

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
      environment: this.config.get<string>('NODE_ENV') ?? 'development',
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
        storage,
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
        { key: 'REFERRAL_PUBLIC_BASE_URL', validator: 'https-url' },
        { key: 'REFERRAL_CUSTOMER_ANDROID_STORE_URL', validator: 'https-url' },
        { key: 'REFERRAL_CUSTOMER_IOS_STORE_URL', validator: 'https-url' },
        { key: 'REFERRAL_PARTNER_ANDROID_STORE_URL', validator: 'https-url' },
        { key: 'REFERRAL_PARTNER_IOS_STORE_URL', validator: 'https-url' },
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
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  private async redisStatus() {
    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG', response: pong };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
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
    const deferred = isDeferredExternalCategory(check.category);
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function isDeferredExternalCategory(category: string) {
  return ['mobile-release', 'supabase-auth', 'sms', 'payments', 'push', 'storage', 'referrals'].includes(
    category,
  );
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
