import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HealthService } from './health.service';

function config(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
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
