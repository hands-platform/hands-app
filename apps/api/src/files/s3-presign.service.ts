import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'crypto';

type PresignInput = {
  method: 'GET' | 'PUT';
  key: string;
  bucket?: string;
  expiresInSeconds?: number;
};

export type StorageMode = 's3-compatible-presigned' | 'supabase-storage-s3' | 'placeholder';

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

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expires,
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalRequest = [
      input.method,
      objectPath,
      canonicalQuery(query),
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
    const signingKey = getSigningKey(secretKey, dateStamp, region, service);
    query.set('X-Amz-Signature', hmacHex(signingKey, stringToSign));

    return `${endpoint.origin}${objectPath}?${query.toString()}`;
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

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
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
