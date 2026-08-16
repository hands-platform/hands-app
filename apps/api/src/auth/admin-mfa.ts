import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const ADMIN_MFA_CODE_DIGITS = 6;
const ADMIN_MFA_PERIOD_SECONDS = 30;
const ADMIN_MFA_RECOVERY_CODE_COUNT = 10;
const ADMIN_MFA_RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type AdminMfaVerification = {
  recoveryCodeHashes: string[] | null;
  totpCounter: number | null;
  verified: boolean;
};

export function createAdminMfaEnrollment(email: string, encryptionSecret: string) {
  assertAdminMfaEncryptionSecret(encryptionSecret);
  const secret = base32Encode(randomBytes(20));
  const recoveryCodes = Array.from({ length: ADMIN_MFA_RECOVERY_CODE_COUNT }, () =>
    adminMfaRecoveryCode(),
  );
  return {
    encryptedSecret: encryptAdminMfaSecret(secret, encryptionSecret),
    otpAuthUri: adminMfaOtpAuthUri(email, secret),
    recoveryCodeHashes: recoveryCodes.map(hashAdminMfaRecoveryCode),
    recoveryCodes,
    secret,
  };
}

export function verifyAdminMfaCode(input: {
  code: string | null | undefined;
  encryptedSecret: string;
  encryptionSecret: string;
  recoveryCodeHashes: readonly string[];
  nowMs?: number;
}): AdminMfaVerification {
  const code = input.code?.trim() ?? '';
  if (!code) return { recoveryCodeHashes: null, totpCounter: null, verified: false };
  const secret = decryptAdminMfaSecret(input.encryptedSecret, input.encryptionSecret);
  const totpCounter = matchingTotpCounter(secret, code, input.nowMs);
  if (totpCounter !== null) {
    return { recoveryCodeHashes: null, totpCounter, verified: true };
  }
  const recoveryIndex = input.recoveryCodeHashes.findIndex((hash) =>
    verifyAdminMfaRecoveryCode(code, hash),
  );
  if (recoveryIndex < 0) {
    return { recoveryCodeHashes: null, totpCounter: null, verified: false };
  }
  return {
    recoveryCodeHashes: input.recoveryCodeHashes.filter((_, index) => index !== recoveryIndex),
    totpCounter: null,
    verified: true,
  };
}

export function verifyTotpCode(secret: string, code: string, nowMs = Date.now()) {
  return matchingTotpCounter(secret, code, nowMs) !== null;
}

export function matchingTotpCounter(secret: string, code: string, nowMs = Date.now()) {
  const normalized = code.replace(/\s/gu, '');
  if (!/^\d{6}$/u.test(normalized)) return null;
  const counter = Math.floor(nowMs / 1000 / ADMIN_MFA_PERIOD_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const candidateCounter = counter + offset;
    if (
      candidateCounter >= 0 &&
      constantTimeTextEqual(normalized, totpCode(secret, candidateCounter))
    ) {
      return candidateCounter;
    }
  }
  return null;
}

export function encryptAdminMfaSecret(secret: string, encryptionSecret: string) {
  assertAdminMfaEncryptionSecret(encryptionSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', adminMfaEncryptionKey(encryptionSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptAdminMfaSecret(value: string, encryptionSecret: string) {
  assertAdminMfaEncryptionSecret(encryptionSecret);
  const [version, ivValue, tagValue, ciphertextValue, extra] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error('Invalid Admin MFA secret envelope');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    adminMfaEncryptionKey(encryptionSecret),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function hashAdminMfaRecoveryCode(code: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(normalizeRecoveryCode(code), salt, 64).toString('base64url');
  return `v1.${salt}.${hash}`;
}

export function verifyAdminMfaRecoveryCode(code: string, encoded: string) {
  const [version, salt, expectedValue, extra] = encoded.split('.');
  if (version !== 'v1' || !salt || !expectedValue || extra) return false;
  const candidate = scryptSync(normalizeRecoveryCode(code), salt, 64);
  const expected = Buffer.from(expectedValue, 'base64url');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function assertAdminMfaEncryptionSecret(value: string | null | undefined): asserts value is string {
  if (!value || value.trim().length < 32) {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY must contain at least 32 characters');
  }
}

function adminMfaOtpAuthUri(email: string, secret: string) {
  const issuer = 'HANDS Admin';
  const label = `${issuer}:${email.trim().toLowerCase()}`;
  const query = new URLSearchParams({ algorithm: 'SHA1', digits: '6', issuer, period: '30', secret });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

function adminMfaRecoveryCode() {
  const value = Array.from({ length: 12 }, () =>
    ADMIN_MFA_RECOVERY_ALPHABET[randomBytes(1)[0] % ADMIN_MFA_RECOVERY_ALPHABET.length],
  ).join('');
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
}

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/gu, '');
}

function adminMfaEncryptionKey(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function totpCode(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** ADMIN_MFA_CODE_DIGITS).padStart(ADMIN_MFA_CODE_DIGITS, '0');
}

function base32Encode(value: Buffer) {
  let bits = 0;
  let accumulator = 0;
  let encoded = '';
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return encoded;
}

function base32Decode(value: string) {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid Base32 Admin MFA secret');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function constantTimeTextEqual(left: string, right: string) {
  const leftValue = Buffer.from(left);
  const rightValue = Buffer.from(right);
  return leftValue.length === rightValue.length && timingSafeEqual(leftValue, rightValue);
}
