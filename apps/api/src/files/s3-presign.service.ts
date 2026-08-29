import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';

type PresignInput = {
  method: 'DELETE' | 'GET' | 'HEAD' | 'PUT';
  key: string;
  bucket?: string;
  expiresInSeconds?: number;
  headers?: Record<string, string>;
};

export type StorageMode = 's3-compatible-presigned' | 'supabase-storage-s3' | 'placeholder';
export type StoredObjectInspection = {
  contentType: string;
  prefix: Uint8Array;
  sizeBytes: number;
};

@Injectable()
export class S3PresignService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('S3_ENDPOINT') &&
      this.hasBucketConfiguration() &&
      this.config.get<string>('S3_ACCESS_KEY') &&
      this.config.get<string>('S3_SECRET_KEY'),
    );
  }

  allowsPlaceholderStorage() {
    return this.config.get<string>('NODE_ENV')?.trim().toLowerCase() !== 'production';
  }

  storageMode(): StorageMode {
    if (!this.isConfigured()) {
      return 'placeholder';
    }

    const provider = this.config.get<string>('STORAGE_PROVIDER')?.trim();
    if (provider === 'supabase-storage-s3') {
      return 'supabase-storage-s3';
    }

    return 's3-compatible-presigned';
  }

  configurationNote() {
    if (this.isConfigured()) {
      return 'Upload with PUT before the presigned URL expires.';
    }

    return 'Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY for MinIO, R2, or Supabase Storage S3 uploads.';
  }

  publicUrl(key: string) {
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (!publicBaseUrl) {
      return `/cdn/${key}`;
    }
    return `${publicBaseUrl.replace(/\/$/, '')}/${encodePath(key)}`;
  }

  bucketForVisibility(visibility: 'PUBLIC' | 'PRIVATE') {
    if (visibility === 'PUBLIC') {
      return this.config.get<string>('S3_PUBLIC_BUCKET')?.trim() || this.defaultBucket();
    }
    return this.config.get<string>('S3_PRIVATE_BUCKET')?.trim() || this.defaultBucket();
  }

  presign(input: PresignInput) {
    if (!this.isConfigured()) {
      return null;
    }

    const endpoint = new URL(this.config.getOrThrow<string>('S3_ENDPOINT'));
    const bucket = input.bucket ?? this.defaultBucket();
    if (!bucket) {
      return null;
    }
    const accessKey = this.config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretKey = this.config.getOrThrow<string>('S3_SECRET_KEY');
    const region = this.config.get<string>('S3_REGION') ?? 'auto';
    const service = 's3';
    const expires = String(input.expiresInSeconds ?? 900);
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const objectPath = `/${bucket}/${encodePath(input.key)}`;
    const host = endpoint.host;
    const canonicalHeaders = canonicalSignedHeaders(host, input.headers);

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expires,
      'X-Amz-SignedHeaders': canonicalHeaders.names,
    });

    const canonicalRequest = [
      input.method,
      objectPath,
      canonicalQuery(query),
      canonicalHeaders.values,
      canonicalHeaders.names,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
    const signingKey = getSigningKey(secretKey, dateStamp, region, service);
    query.set('X-Amz-Signature', hmacHex(signingKey, stringToSign));

    return `${endpoint.origin}${objectPath}?${query.toString()}`;
  }

  async inspectObject(key: string, visibility: 'PUBLIC' | 'PRIVATE'): Promise<StoredObjectInspection | null> {
    const bucket = this.bucketForVisibility(visibility);
    const headUrl = this.presign({ method: 'HEAD', key, bucket, expiresInSeconds: 120 });
    if (!headUrl) {
      return null;
    }

    const headResponse = await fetch(headUrl, { method: 'HEAD' });
    if (headResponse.status === 404) {
      return null;
    }
    if (!headResponse.ok) {
      throw new Error(`Storage object inspection failed with status ${headResponse.status}`);
    }

    const sizeBytes = Number(headResponse.headers.get('content-length'));
    const contentType = normalizeResponseContentType(headResponse.headers.get('content-type'));
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || !contentType) {
      throw new Error('Storage object metadata is incomplete');
    }

    const readUrl = this.presign({ method: 'GET', key, bucket, expiresInSeconds: 120 });
    if (!readUrl) {
      throw new Error('Storage object signature inspection is unavailable');
    }
    const readResponse = await fetch(readUrl, {
      method: 'GET',
      headers: { range: 'bytes=0-15' },
    });
    if (!readResponse.ok) {
      throw new Error(`Storage object signature inspection failed with status ${readResponse.status}`);
    }

    return {
      contentType,
      prefix: await readResponsePrefix(readResponse, 16),
      sizeBytes,
    };
  }

  async contentSha256(key: string, visibility: 'PUBLIC' | 'PRIVATE') {
    const url = this.presign({
      method: 'GET',
      key,
      bucket: this.bucketForVisibility(visibility),
      expiresInSeconds: 120,
    });
    if (!url) {
      throw new ServiceUnavailableException('Storage object integrity verification is unavailable');
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Storage object integrity verification failed with status ${response.status}`,
      );
    }
    const content = new Uint8Array(await response.arrayBuffer());
    return {
      contentSha256: createHash('sha256').update(content).digest('hex'),
      sizeBytes: content.byteLength,
    };
  }

  async deleteObject(key: string, visibility: 'PUBLIC' | 'PRIVATE') {
    const url = this.presign({
      method: 'DELETE',
      key,
      bucket: this.bucketForVisibility(visibility),
      expiresInSeconds: 300,
    });
    if (!url) {
      return { deleted: false, storageMode: this.storageMode() };
    }

    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Storage object deletion failed with status ${response.status}`);
    }
    return { deleted: true, storageMode: this.storageMode() };
  }

  async copyObject(
    key: string,
    sourceVisibility: 'PUBLIC' | 'PRIVATE',
    targetVisibility: 'PUBLIC' | 'PRIVATE',
    targetKey = key,
  ) {
    const sourceBucket = this.bucketForVisibility(sourceVisibility);
    const targetBucket = this.bucketForVisibility(targetVisibility);
    const copySource = `/${sourceBucket}/${encodePath(key)}`;
    const url = this.presign({
      method: 'PUT',
      key: targetKey,
      bucket: targetBucket,
      expiresInSeconds: 300,
      headers: { 'x-amz-copy-source': copySource },
    });
    if (!url) {
      throw new ServiceUnavailableException('File storage copy is unavailable');
    }
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'x-amz-copy-source': copySource },
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `File storage copy failed with status ${response.status}`,
      );
    }
    return { copied: true, storageMode: this.storageMode() };
  }

  async scanObject(key: string, visibility: 'PUBLIC' | 'PRIVATE') {
    const endpoint = this.config.get<string>('FILE_MALWARE_SCAN_URL')?.trim();
    if (!endpoint) {
      if (this.config.get<string>('NODE_ENV')?.trim().toLowerCase() === 'production') {
        throw new ServiceUnavailableException('File malware scanning is not configured');
      }
      return { clean: true, mode: 'not-configured-non-production' as const };
    }
    const scannerToken = this.config.get<string>('FILE_MALWARE_SCAN_TOKEN')?.trim();
    if (
      this.config.get<string>('NODE_ENV')?.trim().toLowerCase() === 'production' &&
      !scannerToken
    ) {
      throw new ServiceUnavailableException('File malware scanner authentication is not configured');
    }
    const downloadUrl = this.presign({
      method: 'GET',
      key,
      bucket: this.bucketForVisibility(visibility),
      expiresInSeconds: 300,
    });
    if (!downloadUrl) {
      throw new ServiceUnavailableException('File malware scanning is unavailable');
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(scannerToken
            ? { authorization: `Bearer ${scannerToken}` }
            : {}),
        },
        body: JSON.stringify({ downloadUrl }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException('File malware scanning is temporarily unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `File malware scanning failed with status ${response.status}`,
      );
    }
    const result = await response.json().catch(() => null) as
      | { clean?: boolean; status?: string }
      | null;
    const status = result?.status?.trim().toLowerCase();
    if (result?.clean === true || status === 'clean') {
      return { clean: true, mode: 'external-scanner' as const };
    }
    if (result?.clean === false || status === 'infected' || status === 'malicious') {
      return { clean: false, mode: 'external-scanner' as const };
    }
    throw new ServiceUnavailableException('File malware scanner returned an invalid result');
  }

  private defaultBucket() {
    return this.config.get<string>('S3_BUCKET')?.trim();
  }

  private hasBucketConfiguration() {
    return Boolean(
      this.defaultBucket() ||
      (this.config.get<string>('S3_PRIVATE_BUCKET')?.trim() &&
        this.config.get<string>('S3_PUBLIC_BUCKET')?.trim()),
    );
  }
}

function canonicalQuery(query: URLSearchParams) {
  return [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function canonicalSignedHeaders(host: string, headers?: Record<string, string>) {
  const values = new Map<string, string>([['host', host]]);
  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName || normalizedName === 'host') {
      continue;
    }
    values.set(normalizedName, value.trim().replace(/\s+/g, ' '));
  }
  const entries = [...values.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    names: entries.map(([name]) => name).join(';'),
    values: `${entries.map(([name, value]) => `${name}:${value}`).join('\n')}\n`,
  };
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function normalizeResponseContentType(contentType: string | null) {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readResponsePrefix(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }

  const chunks: number[] = [];
  try {
    while (chunks.length < limit) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      for (const byte of result.value) {
        chunks.push(byte);
        if (chunks.length === limit) {
          break;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Uint8Array.from(chunks);
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, service);
  return hmac(dateRegionServiceKey, 'aws4_request');
}
