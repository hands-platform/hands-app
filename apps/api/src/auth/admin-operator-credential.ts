import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ADMIN_OPERATOR_PASSWORD_HASH_BYTES = 64;
const ADMIN_OPERATOR_PASSWORD_SALT_BYTES = 16;
export const ADMIN_OPERATOR_MAX_FAILED_LOGINS = 5;
export const ADMIN_OPERATOR_LOCK_MS = 15 * 60_000;
const DUMMY_ADMIN_OPERATOR_CREDENTIAL = {
  passwordSalt: 'hands-admin-dummy-password-salt',
  passwordHash: scryptSync(
    'hands-admin-dummy-password',
    'hands-admin-dummy-password-salt',
    ADMIN_OPERATOR_PASSWORD_HASH_BYTES,
  ).toString('base64url'),
};

export function hashAdminOperatorPassword(password: string) {
  const passwordSalt = randomBytes(ADMIN_OPERATOR_PASSWORD_SALT_BYTES).toString('base64url');
  const passwordHash = scryptSync(password, passwordSalt, ADMIN_OPERATOR_PASSWORD_HASH_BYTES).toString(
    'base64url',
  );

  return { passwordHash, passwordSalt };
}

export function verifyAdminOperatorPassword(
  password: string,
  credential: { readonly passwordHash: string; readonly passwordSalt: string },
) {
  const candidateHash = scryptSync(
    password,
    credential.passwordSalt,
    ADMIN_OPERATOR_PASSWORD_HASH_BYTES,
  ).toString('base64url');
  const candidate = Buffer.from(candidateHash);
  const expected = Buffer.from(credential.passwordHash);

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function verifyAdminOperatorPasswordOrDummy(
  password: string,
  credential: { readonly passwordHash: string; readonly passwordSalt: string } | null | undefined,
) {
  return verifyAdminOperatorPassword(password, credential ?? DUMMY_ADMIN_OPERATOR_CREDENTIAL);
}
