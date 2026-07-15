import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ADMIN_OPERATOR_PASSWORD_HASH_BYTES = 64;
const ADMIN_OPERATOR_PASSWORD_SALT_BYTES = 16;

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
