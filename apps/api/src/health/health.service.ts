import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisStateService,
  ) {}

  healthcheck() {
    return {
      ok: true,
      service: 'massage-vn-api',
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
    const checks = [
      this.mobileFirebaseRemovalReadiness(),
      this.mobileReleaseReadiness(),
      this.externalGroup('Supabase Auth', 'supabase', [
        { key: 'AUTH_BACKEND', expected: 'supabase' },
        { key: 'SUPABASE_URL', validator: 'https-url' },
        { key: 'SUPABASE_ANON_KEY' },
        { key: 'SUPABASE_JWT_SECRET', validator: 'secret' },
        { key: 'SUPABASE_SERVICE_ROLE_KEY', validator: 'secret' },
      ]),
      this.externalGroup('Maps and geocoding', 'maps', [
        { key: 'MAPTILER_API_KEY' },
        { key: 'GEOAPIFY_API_KEY' },
      ]),
      this.externalGroup('MoMo payments', 'payments', [
        { key: 'MOMO_PARTNER_CODE' },
        { key: 'MOMO_ACCESS_KEY' },
        { key: 'MOMO_SECRET_KEY', validator: 'secret' },
      ]),
      this.externalGroup('VNPay payments', 'payments', [
        { key: 'VNPAY_TMN_CODE' },
        { key: 'VNPAY_HASH_SECRET', validator: 'secret' },
      ]),
      this.storageExternalReadiness(),
      this.externalGroup('Production SMS', 'sms', [
        { key: 'SMS_PROVIDER' },
        { key: 'SMS_API_URL' },
        { key: 'SMS_API_KEY', validator: 'secret' },
      ]),
      this.pushProviderExternalReadiness(),
    ];

    return {
      ok: checks.every((check) => check.status === 'READY'),
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
    const required = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
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
      status: storage.ok ? 'READY' : configured.length > 0 ? 'PARTIAL' : 'BLOCKED',
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
    const oneSignalAppId = this.config.get<string>('ONESIGNAL_APP_ID')?.trim();
    const oneSignalRestApiKey = this.config.get<string>('ONESIGNAL_REST_API_KEY')?.trim();

    if (pushProvider === 'in_app_only') {
      return {
        name: 'OS push provider',
        category: 'push',
        status: 'BLOCKED',
        missing: ['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY'],
        configured: ['PUSH_PROVIDER'],
        invalid: [],
        detail:
          'Current delivery is intentionally in-app only. Set PUSH_PROVIDER=onesignal and server credentials before OS push E2E.',
      };
    }

    if (pushProvider !== 'onesignal') {
      return {
        name: 'OS push provider',
        category: 'push',
        status: 'BLOCKED',
        missing: [],
        configured: [],
        invalid: ['PUSH_PROVIDER'],
        detail:
          'Unsupported push provider. Use PUSH_PROVIDER=in_app_only locally or PUSH_PROVIDER=onesignal for staging.',
      };
    }

    const missing = [
      oneSignalAppId ? null : 'ONESIGNAL_APP_ID',
      oneSignalRestApiKey ? null : 'ONESIGNAL_REST_API_KEY',
    ].filter((key): key is string => Boolean(key));
    const configured = [
      'PUSH_PROVIDER',
      oneSignalAppId ? 'ONESIGNAL_APP_ID' : null,
      oneSignalRestApiKey ? 'ONESIGNAL_REST_API_KEY' : null,
    ].filter((key): key is string => Boolean(key));

    return {
      name: 'OS push provider',
      category: 'push',
      status: missing.length === 0 ? 'READY' : 'BLOCKED',
      missing,
      configured,
      invalid: [],
      detail:
        missing.length === 0
          ? 'OneSignal credentials are configured and backend HTTP delivery is enabled.'
          : 'OneSignal push is selected, but server-side credentials are missing.',
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
        pubspecPath: 'apps/customer_app/pubspec.yaml',
        rootGradlePath: 'apps/customer_app/android/build.gradle.kts',
        appGradlePath: 'apps/customer_app/android/app/build.gradle.kts',
        configPath: 'apps/customer_app/android/app/google-services.json',
      },
      {
        name: 'provider_app',
        pubspecPath: 'apps/provider_app/pubspec.yaml',
        rootGradlePath: 'apps/provider_app/android/build.gradle.kts',
        appGradlePath: 'apps/provider_app/android/app/build.gradle.kts',
        configPath: 'apps/provider_app/android/app/google-services.json',
      },
    ].map((app) => {
      const pubspec = this.readRepoFile(repoRoot, app.pubspecPath);
      const rootGradle = this.readRepoFile(repoRoot, app.rootGradlePath);
      const appGradle = this.readRepoFile(repoRoot, app.appGradlePath);
      const checked = pubspec !== null || rootGradle !== null || appGradle !== null;
      const hasFirebasePackages =
        /firebase_core|firebase_messaging|cloud_firestore|firebase_auth|firebase_storage/.test(pubspec ?? '');
      const hasGoogleServicesPlugin = /com\.google\.gms\.google-services/.test(
        `${rootGradle ?? ''}\n${appGradle ?? ''}`,
      );
      const hasGoogleServicesConfig = existsSync(join(repoRoot, app.configPath));
      return {
        name: app.name,
        checked,
        ok: checked && !hasFirebasePackages && !hasGoogleServicesPlugin && !hasGoogleServicesConfig,
      };
    });

    const sourceAvailable = apps.every((app) => app.checked);
    const failingApps = apps.filter((app) => !app.ok);

    return {
      name: 'Mobile Firebase removal guard',
      category: 'mobile',
      status: !sourceAvailable ? 'PARTIAL' : failingApps.length === 0 ? 'READY' : 'BLOCKED',
      configured: apps.filter((app) => app.ok).map((app) => app.name),
      missing: failingApps.map((app) => app.name),
      invalid: [],
      detail: !sourceAvailable
        ? 'Mobile app source files were not available to this API runtime; run the local Firebase removal script from the repository.'
        : failingApps.length === 0
          ? 'Customer and provider Flutter apps are Firebase-free.'
          : 'Remove Firebase packages, Google Services plugin usage, or google-services.json from the listed mobile apps.',
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
    requirements: Array<{ key: string; validator?: 'https-url' | 'secret'; expected?: string }>,
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

      configured.push(requirement.key);
    }

    const status =
      missing.length === 0 && invalid.length === 0 ? 'READY' : configured.length > 0 ? 'PARTIAL' : 'BLOCKED';

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
}

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
