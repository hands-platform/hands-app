import {
  createAdminMfaEnrollment,
  decryptAdminMfaSecret,
  encryptAdminMfaSecret,
  matchingTotpCounter,
  verifyAdminMfaCode,
  verifyTotpCode,
} from './admin-mfa';

describe('Admin MFA', () => {
  const encryptionSecret = 'test-admin-mfa-encryption-key-with-32-characters';

  it('encrypts Admin MFA secrets with authenticated encryption', () => {
    const encrypted = encryptAdminMfaSecret('JBSWY3DPEHPK3PXP', encryptionSecret);
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptAdminMfaSecret(encrypted, encryptionSecret)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => decryptAdminMfaSecret(encrypted, `${encryptionSecret}-wrong`)).toThrow();
  });

  it('verifies RFC 6238-compatible TOTP codes within one time step', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(verifyTotpCode(secret, '324550', 1_700_000_000_000)).toBe(true);
    expect(matchingTotpCounter(secret, '324550', 1_700_000_000_000)).toBe(56_666_666);
    expect(verifyTotpCode(secret, '000000', 1_700_000_000_000)).toBe(false);
    expect(matchingTotpCounter(secret, '000000', 1_700_000_000_000)).toBeNull();
  });

  it('consumes a recovery code only once', () => {
    const enrollment = createAdminMfaEnrollment('operator@hands.vn', encryptionSecret);
    const code = enrollment.recoveryCodes[0];
    const first = verifyAdminMfaCode({
      code,
      encryptedSecret: enrollment.encryptedSecret,
      encryptionSecret,
      recoveryCodeHashes: enrollment.recoveryCodeHashes,
    });
    expect(first.verified).toBe(true);
    expect(first.recoveryCodeHashes).toHaveLength(9);
    expect(first.totpCounter).toBeNull();
    expect(
      verifyAdminMfaCode({
        code,
        encryptedSecret: enrollment.encryptedSecret,
        encryptionSecret,
        recoveryCodeHashes: first.recoveryCodeHashes ?? [],
      }).verified,
    ).toBe(false);
  });
});
