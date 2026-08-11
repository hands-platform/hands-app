import { S3PresignService } from './s3-presign.service';

describe('S3PresignService', () => {
  it('includes the required upload content type in the signed headers', () => {
    const service = new S3PresignService(configFixture() as never);

    const url = new URL(
      service.presign({
        method: 'PUT',
        key: 'public/profile-image/file.jpg',
        headers: { 'content-type': 'image/jpeg' },
      })!,
    );

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
  });

  it('allows placeholder storage only outside production', () => {
    const development = new S3PresignService(
      configFixture({ NODE_ENV: 'development', S3_ACCESS_KEY: '', S3_SECRET_KEY: '' }) as never,
    );
    const production = new S3PresignService(
      configFixture({ NODE_ENV: 'production', S3_ACCESS_KEY: '', S3_SECRET_KEY: '' }) as never,
    );

    expect(development.isConfigured()).toBe(false);
    expect(development.allowsPlaceholderStorage()).toBe(true);
    expect(production.isConfigured()).toBe(false);
    expect(production.allowsPlaceholderStorage()).toBe(false);
  });
});

function configFixture(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    S3_ACCESS_KEY: 'access-key',
    S3_BUCKET: 'hands',
    S3_ENDPOINT: 'https://storage.example',
    S3_REGION: 'auto',
    S3_SECRET_KEY: 'secret-key',
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => values[key]),
    getOrThrow: vi.fn((key: string) => {
      const value = values[key];
      if (!value) {
        throw new Error(`Missing ${key}`);
      }
      return value;
    }),
  };
}
