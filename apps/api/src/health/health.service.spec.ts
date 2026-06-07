import { ConfigService } from '@nestjs/config';
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
