import { S3PresignService } from './s3-presign.service';

describe('S3PresignService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes the required upload content type in the signed headers', () => {
    const service = new S3PresignService(configFixture() as never);

    const url = new URL(
      service.presign({
        method: 'PUT',
        key: 'public/profile-image/file.jpg',
        headers: { 'content-length': '1024', 'content-type': 'image/jpeg' },
      })!,
    );

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
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

  it('requires malware scanning configuration in production', async () => {
    const service = new S3PresignService(configFixture({ NODE_ENV: 'production' }) as never);

    await expect(service.scanObject('private/file.jpg', 'PRIVATE')).rejects.toThrow(
      'File malware scanning is not configured',
    );
  });

  it('requires scanner authentication in production', async () => {
    const service = new S3PresignService(configFixture({
      FILE_MALWARE_SCAN_URL: 'https://scanner.example/scan',
      NODE_ENV: 'production',
    }) as never);

    await expect(service.scanObject('private/file.jpg', 'PRIVATE')).rejects.toThrow(
      'File malware scanner authentication is not configured',
    );
  });

  it('passes a short-lived private read URL to the configured malware scanner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ status: 'clean' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new S3PresignService(configFixture({
      FILE_MALWARE_SCAN_TOKEN: 'scanner-token',
      FILE_MALWARE_SCAN_URL: 'https://scanner.example/scan',
      NODE_ENV: 'production',
    }) as never);

    await expect(service.scanObject('private/file.jpg', 'PRIVATE')).resolves.toEqual({
      clean: true,
      mode: 'external-scanner',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://scanner.example/scan',
      expect.objectContaining({
        body: expect.stringContaining('X-Amz-Signature'),
        headers: expect.objectContaining({ authorization: 'Bearer scanner-token' }),
        method: 'POST',
      }),
    );
  });

  it('copies legacy public media to a distinct private quarantine key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = new S3PresignService(
      configFixture({ S3_PRIVATE_BUCKET: 'hands-private', S3_PUBLIC_BUCKET: 'hands-public' }) as never,
    );

    await service.copyObject(
      'public/profile-image/legacy.jpg',
      'PUBLIC',
      'PRIVATE',
      'private/profile-image/legacy.jpg',
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/hands-private/private/profile-image/legacy.jpg');
    expect(init.headers).toEqual({
      'x-amz-copy-source': '/hands-public/public/profile-image/legacy.jpg',
    });
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
