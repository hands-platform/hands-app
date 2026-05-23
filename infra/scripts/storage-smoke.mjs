import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv('.env');

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3100/api';
const providerPhone = process.env.PROVIDER_DEMO_PHONE ?? '+84900000002';
const adminPhone = process.env.ADMIN_DEMO_PHONE ?? '+84900000099';
const otp = process.env.DEV_OTP ?? process.env.ADMIN_DEMO_OTP ?? '123456';
const samplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const providerAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: providerPhone, otp, role: 'PROVIDER' }),
});
const adminAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: adminPhone, otp, role: 'ADMIN' }),
});

const uploadContract = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/png',
  visibility: 'PRIVATE',
  purpose: 'provider-verification',
});

if (uploadContract.storageMode === 'placeholder' || uploadContract.upload.url.startsWith('/')) {
  throw new Error(
    'Storage smoke requires real S3-compatible storage settings. Fill S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY.',
  );
}

const uploadResponse = await fetch(uploadContract.upload.url, {
  method: uploadContract.upload.method,
  headers: uploadContract.upload.headers,
  body: samplePng,
});
if (!uploadResponse.ok) {
  throw new Error(
    `Storage PUT failed: ${uploadResponse.status} ${await uploadResponse.text().catch(() => '')}`,
  );
}

const completedFile = await postJson(`/files/${uploadContract.file.id}/complete`, providerAuth.accessToken, {
  sizeBytes: samplePng.length,
});
if (completedFile.uploadStatus !== 'UPLOADED' || completedFile.sizeBytes !== samplePng.length) {
  throw new Error(`File completion mismatch: ${JSON.stringify(completedFile)}`);
}

const readContract = await getJson(`/files/${uploadContract.file.id}/read-url`, adminAuth.accessToken);
if (readContract.storageMode === 'placeholder' || readContract.read.url.startsWith('/')) {
  throw new Error(`Read URL stayed in placeholder mode: ${JSON.stringify(readContract)}`);
}

const readResponse = await fetch(readContract.read.url);
const readBytes = Buffer.from(await readResponse.arrayBuffer());
if (!readResponse.ok || readBytes.length !== samplePng.length) {
  throw new Error(
    `Storage GET failed or size mismatch: ${JSON.stringify({
      status: readResponse.status,
      expectedBytes: samplePng.length,
      actualBytes: readBytes.length,
    })}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      storageMode: uploadContract.storageMode,
      fileId: uploadContract.file.id,
      key: uploadContract.file.key,
      uploadStatus: completedFile.uploadStatus,
      bytesUploaded: samplePng.length,
      bytesRead: readBytes.length,
    },
    null,
    2,
  ),
);

async function request(path, options = {}) {
  const { retryRateLimit = true, ...fetchOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...fetchOptions,
    headers: { 'content-type': 'application/json', ...(fetchOptions.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429 && retryRateLimit) {
      const retryAfterSeconds = Number(body.retryAfterSeconds ?? response.headers.get('retry-after') ?? 30);
      await sleep(Math.max(1, retryAfterSeconds) * 1000);
      return request(path, { ...options, retryRateLimit: false });
    }
    throw new Error(
      `${fetchOptions.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function postJson(path, accessToken, body = {}) {
  return request(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
}

function getJson(path, accessToken) {
  return request(path, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

function loadEnv(file) {
  const envPath = resolve(file);
  if (!existsSync(envPath)) {
    return;
  }
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    if (process.env[key]) {
      continue;
    }
    process.env[key] = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
