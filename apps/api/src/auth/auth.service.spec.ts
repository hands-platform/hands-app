import { HttpStatus, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { hashAdminOperatorPassword } from './admin-operator-credential';
import { encryptAdminMfaSecret } from './admin-mfa';

describe('AuthService OTP production guard', () => {
  it('uses a cryptographic six-digit OTP generator in production', async () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for OTPs');
    });
    const { redisState, service } = createOtpService({ NODE_ENV: 'production' });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).resolves.toMatchObject({
      status: 'OTP_REQUESTED',
    });
    const otp = redisState.setOtp.mock.calls[0]?.[1];
    expect(otp).toMatch(/^\d{6}$/);
    expect(mathRandom).not.toHaveBeenCalled();
    mathRandom.mockRestore();
  });

  it('does not expose or accept a universal development OTP in staging', async () => {
    const { prisma, redisState, service } = createOtpService({
      NODE_ENV: 'staging',
      MOBILE_AUTH_ALLOW_DEV_OTP: 'true',
      DEV_OTP: '123456',
    });

    const requested = await service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER });
    expect(requested).not.toHaveProperty('devOtp');
    expect(redisState.setOtp.mock.calls[0]?.[1]).toMatch(/^\d{6}$/);

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).rejects.toThrow('Invalid OTP');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns the configured development OTP only with an explicit local opt-in', async () => {
    const { redisState, service } = createOtpService({
      NODE_ENV: 'development',
      MOBILE_AUTH_ALLOW_DEV_OTP: 'true',
      DEV_OTP: '654321',
    });

    await expect(
      service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER }),
    ).resolves.toMatchObject({ devOtp: '654321' });
    expect(redisState.setOtp).toHaveBeenCalledWith('+84900000000', '654321');
  });

  it('rejects admin OTP requests before storing or delivering OTPs', async () => {
    const { otpDelivery, redisState, service } = createOtpService({});

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.ADMIN })).rejects.toThrow(
      'Mobile auth only supports CUSTOMER or PROVIDER roles',
    );
    expect(redisState.setOtp).not.toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('rejects admin OTP verification before reading or consuming OTPs', async () => {
    const { prisma, redisState, service } = createOtpService({});

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.ADMIN }),
    ).rejects.toThrow('Mobile auth only supports CUSTOMER or PROVIDER roles');
    expect(redisState.getOtp).not.toHaveBeenCalled();
    expect(redisState.consumeOtp).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('enforces a phone-level OTP resend cooldown', async () => {
    const { otpDelivery, redisState, service } = createOtpService({
      redisState: {
        reserveOtpSend: vi.fn().mockResolvedValue(false),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).rejects.toThrow(
      'Please wait before requesting another OTP',
    );
    expect(redisState.setOtp).not.toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('enforces a hashed phone daily OTP send budget before storing or delivering a code', async () => {
    const { otpDelivery, redisState, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        consumeRateLimit: vi.fn().mockResolvedValue({ count: 11, resetAt: Date.now() + 60_000 }),
      },
    });

    await expect(
      service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER }),
    ).rejects.toThrow('OTP request limit reached');
    expect(redisState.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^otp-send:phone:[a-f0-9]{64}$/),
      24 * 60 * 60_000,
    );
    expect(JSON.stringify(redisState.consumeRateLimit.mock.calls)).not.toContain('+84900000000');
    expect(redisState.setOtp).not.toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('fails closed outside local/test when the OTP abuse budget store is unavailable', async () => {
    const { otpDelivery, redisState, service } = createOtpService({
      NODE_ENV: 'staging',
      redisState: {
        consumeRateLimit: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(
      service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER }),
    ).rejects.toThrow('OTP service is temporarily unavailable');
    expect(redisState.setOtp).not.toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('invalidates an OTP after five failed verification attempts', async () => {
    const { prisma, redisState, service } = createOtpService({
      redisState: {
        getOtp: vi.fn().mockResolvedValue('654321'),
        incrementOtpAttempts: vi.fn().mockResolvedValue(5),
      },
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '000000', role: Role.CUSTOMER }),
    ).rejects.toThrow('Invalid OTP');

    expect(redisState.consumeOtp).toHaveBeenCalledWith('+84900000000');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects production OTP requests when Redis cannot store the OTP', async () => {
    const { otpDelivery, redisState, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        setOtp: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).rejects.toThrow(
      'OTP service is temporarily unavailable',
    );
    expect(redisState.setOtp).toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('does not log Redis connection details when production OTP storage fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        setOtp: vi.fn().mockRejectedValue(new Error('redis://:super-secret@localhost:6379 unavailable')),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).rejects.toThrow(
      'OTP service is temporarily unavailable',
    );

    expect(warn).toHaveBeenCalledWith('Redis OTP store unavailable.');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('super-secret');
    warn.mockRestore();
  });

  it('does not log Redis connection details when non-production OTP storage falls back', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service } = createOtpService({
      NODE_ENV: 'development',
      redisState: {
        setOtp: vi.fn().mockRejectedValue(new Error('redis://:dev-secret@localhost:6379 unavailable')),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).resolves.toMatchObject({
      status: 'OTP_REQUESTED',
    });

    expect(warn.mock.calls.flat().join(' ')).not.toContain('dev-secret');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('redis://');
    warn.mockRestore();
  });

  it('does not log Redis connection details when non-production OTP lookup falls back', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { prisma, service } = createOtpService({
      NODE_ENV: 'development',
      redisState: {
        getOtp: vi.fn().mockRejectedValue(new Error('redis://:lookup-secret@localhost:6379 unavailable')),
      },
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '000000', role: Role.CUSTOMER }),
    ).rejects.toThrow('Invalid OTP');

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain('lookup-secret');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('redis://');
    warn.mockRestore();
  });

  it('does not log Redis connection details when non-production OTP consume falls back', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { prisma, service } = createOtpService({
      NODE_ENV: 'development',
      redisState: {
        getOtp: vi.fn().mockResolvedValue('123456'),
        consumeOtp: vi
          .fn()
          .mockRejectedValue(new Error('redis://:consume-secret@localhost:6379 unavailable')),
      },
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 'user-1', roles: [Role.CUSTOMER] });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).resolves.toMatchObject({ otpAccepted: true });

    expect(warn.mock.calls.flat().join(' ')).not.toContain('consume-secret');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('redis://');
    warn.mockRestore();
  });

  it('signs mobile access tokens with the configured access secret used by the bearer guard', async () => {
    const { config, jwt, prisma, redisState, service } = createOtpService({ NODE_ENV: 'development' });
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'JWT_ACCESS_SECRET') return 'configured-access-secret';
      return undefined;
    });
    redisState.getOtp.mockResolvedValue('123456');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 'user-1', roles: [Role.CUSTOMER] });

    await service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER });

    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ activeRole: Role.CUSTOMER, sub: 'user-1' }),
      { secret: 'configured-access-secret' },
    );
  });

  it('preserves dual mobile membership while issuing only the selected OTP session role', async () => {
    const { jwt, prisma, redisState, service } = createOtpService({ NODE_ENV: 'development' });
    redisState.getOtp.mockResolvedValue('123456');
    prisma.user.findUnique.mockResolvedValue({
      id: 'dual-mobile-user',
      roles: [Role.CUSTOMER, Role.PROVIDER],
      customerProfile: {},
      providerProfile: {},
    });
    prisma.user.upsert.mockResolvedValue({
      id: 'dual-mobile-user',
      roles: [Role.CUSTOMER, Role.PROVIDER],
      customerProfile: {},
      providerProfile: {},
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).resolves.toMatchObject({
      user: { id: 'dual-mobile-user', roles: [Role.CUSTOMER] },
    });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          roles: { set: [Role.CUSTOMER, Role.PROVIDER] },
        }),
      }),
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        activeRole: Role.CUSTOMER,
        roles: [Role.CUSTOMER],
        sub: 'dual-mobile-user',
      }),
      expect.any(Object),
    );
  });

  it('does not let OTP authentication mint stored Admin roles into a mobile token', async () => {
    const { jwt, prisma, redisState, service } = createOtpService({ NODE_ENV: 'development' });
    redisState.getOtp.mockResolvedValue('123456');
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-mobile-collision',
      roles: [Role.ADMIN, Role.CUSTOMER],
      customerProfile: {},
      providerProfile: null,
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).rejects.toThrow('Mobile authentication cannot use an Admin operator account');
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects production OTP verification when atomic Redis verification is unavailable', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        consumeOtpIfMatches: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).rejects.toThrow('OTP service is temporarily unavailable');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects production OTP verification when atomic Redis consumption fails', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        consumeOtpIfMatches: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).rejects.toThrow('OTP service is temporarily unavailable');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('AuthService refresh', () => {
  it('preserves the active provider role from refresh tokens', async () => {
    const { service, signedPayloads } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.PROVIDER },
      [Role.CUSTOMER, Role.PROVIDER],
    );

    await service.refresh('refresh-token-1');

    expect(signedPayloads[0]).toMatchObject({
      sub: 'user-1',
      activeRole: Role.PROVIDER,
      roles: [Role.PROVIDER],
      refreshed: true,
    });
  });

  it('infers a single mobile role for legacy refresh tokens', async () => {
    const { service, signedPayloads } = createService({ sub: 'user-1', tokenType: 'refresh' }, [
      Role.PROVIDER,
    ]);

    await service.refresh('refresh-token-1');

    expect(signedPayloads[0]).toMatchObject({
      sub: 'user-1',
      activeRole: Role.PROVIDER,
      roles: [Role.PROVIDER],
      refreshed: true,
    });
  });

  it('rejects legacy multi-role refresh tokens without an explicit active role', async () => {
    const { service, signedPayloads } = createService({ sub: 'user-1', tokenType: 'refresh' }, [
      Role.CUSTOMER,
      Role.PROVIDER,
    ]);

    await expect(service.refresh('refresh-token-1')).rejects.toThrow(
      'Refresh token requires an explicit mobile role',
    );
    expect(signedPayloads).toHaveLength(0);
  });

  it('rejects refresh when a mobile identity has been promoted to an Admin operator', async () => {
    const { service } = createService({ sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER }, [
      Role.CUSTOMER,
      Role.ADMIN,
    ]);

    await expect(service.refresh('refresh-token-1')).rejects.toThrow(
      'Mobile authentication cannot use an Admin operator account',
    );
  });

  it('rotates the refresh token and revokes the presented token hash', async () => {
    const { redisState, service, signedPayloads } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER },
      [Role.CUSTOMER],
    );

    await expect(service.refresh('refresh-token-1')).resolves.toEqual({
      accessToken: 'signed-token-1',
      refreshToken: 'signed-token-2',
    });
    expect(redisState.consumeRefreshToken).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    expect(redisState.consumeRefreshToken.mock.calls[0]?.[0]).not.toContain('refresh-token-1');
    expect(signedPayloads[0]).toEqual(expect.objectContaining({ familyId: expect.any(String) }));
    expect(signedPayloads[1]).toEqual(expect.objectContaining({ familyId: expect.any(String) }));
    expect((signedPayloads[0] as { familyId: string }).familyId).toBe(
      (signedPayloads[1] as { familyId: string }).familyId,
    );
  });

  it('rejects a refresh token that was already revoked', async () => {
    const { prisma, redisState, service } = createService(
      {
        sub: 'user-1',
        tokenType: 'refresh',
        activeRole: Role.CUSTOMER,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      [Role.CUSTOMER],
    );
    redisState.consumeRefreshToken.mockResolvedValue(false);

    await expect(service.refresh('refresh-token-1')).rejects.toThrow('Refresh token has been revoked');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(redisState.revokeRefreshFamily).toHaveBeenCalledWith(
      expect.any(String),
      30 * 24 * 60 * 60,
    );
  });

  it('allows only one concurrent refresh to consume the same token', async () => {
    const { prisma, redisState, service } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER },
      [Role.CUSTOMER],
    );
    let consumed = false;
    redisState.consumeRefreshToken.mockImplementation(async () => {
      if (consumed) {
        return false;
      }
      consumed = true;
      await Promise.resolve();
      return true;
    });

    const results = await Promise.allSettled([
      service.refresh('refresh-token-1'),
      service.refresh('refresh-token-1'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('blocks refresh when concurrent logout revokes the token first', async () => {
    const { prisma, redisState, service } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER },
      [Role.CUSTOMER],
    );
    let releaseConsume: (() => void) | undefined;
    let revoked = false;
    redisState.consumeRefreshToken.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releaseConsume = () => resolve(!revoked);
        }),
    );
    redisState.revokeRefreshToken.mockImplementation(async () => {
      revoked = true;
      releaseConsume?.();
    });

    const refreshResult = service.refresh('refresh-token-1');
    while (!releaseConsume) {
      await Promise.resolve();
    }
    await expect(service.logout('refresh-token-1')).resolves.toEqual({ ok: true });
    await expect(refreshResult).rejects.toThrow('Refresh token has been revoked');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('revokes a refresh token on logout', async () => {
    const { redisState, service, socketAuth } = createService(
      { sub: 'user-1', tokenType: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 },
      [Role.CUSTOMER],
    );

    await expect(service.logout('refresh-token-1')).resolves.toEqual({ ok: true });
    expect(redisState.revokeRefreshToken).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    expect(redisState.revokeRefreshFamily).toHaveBeenCalledWith(
      expect.any(String),
      30 * 24 * 60 * 60,
    );
    expect(socketAuth.disconnectMobileFamily).toHaveBeenCalledWith(expect.any(String));
  });

  it('fails closed in production when refresh token consumption cannot reach Redis', async () => {
    const { config, jwt, prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        consumeRefreshToken: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'JWT_REFRESH_SECRET') return 'production-refresh-secret-with-32-chars';
      return undefined;
    });
    jwt.verify.mockReturnValue({
      sub: 'user-1',
      tokenType: 'refresh',
      activeRole: Role.CUSTOMER,
    });

    await expect(service.refresh('refresh-token-1')).rejects.toThrow(
      'Authentication service is temporarily unavailable',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('AuthService Supabase exchange', () => {
  it('rejects admin role exchanges before authenticating Supabase tokens', async () => {
    const { authTokens, service } = createOtpService({});

    await expect(
      service.exchangeSupabaseSession({
        supabaseAccessToken: 'supabase-token',
        role: Role.ADMIN,
      }),
    ).rejects.toThrow('Supabase mobile exchange only supports CUSTOMER or PROVIDER roles');
    expect(authTokens.authenticateSupabaseBearerToken).not.toHaveBeenCalled();
  });

  it('does not exchange a Supabase mobile token into stored Admin roles', async () => {
    const { authTokens, jwt, prisma, service } = createOtpService({});
    authTokens.authenticateSupabaseBearerToken.mockResolvedValue({
      id: 'admin-mobile-collision',
      activeRole: Role.CUSTOMER,
      roles: [Role.CUSTOMER],
      authProvider: 'supabase',
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'admin-mobile-collision',
      roles: [Role.ADMIN, Role.CUSTOMER],
      customerProfile: {},
      providerProfile: null,
    });

    await expect(
      service.exchangeSupabaseSession({
        supabaseAccessToken: 'supabase-token',
        role: Role.CUSTOMER,
      }),
    ).rejects.toThrow('Mobile authentication cannot use an Admin operator account');
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('issues only the selected role when a Supabase identity has both mobile roles', async () => {
    const { authTokens, jwt, prisma, service } = createOtpService({});
    authTokens.authenticateSupabaseBearerToken.mockResolvedValue({
      id: 'dual-mobile-user',
      activeRole: Role.PROVIDER,
      roles: [Role.CUSTOMER, Role.PROVIDER],
      authProvider: 'supabase',
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'dual-mobile-user',
      roles: [Role.CUSTOMER, Role.PROVIDER],
      customerProfile: {},
      providerProfile: {},
    });

    await expect(
      service.exchangeSupabaseSession({
        supabaseAccessToken: 'supabase-token',
        role: Role.PROVIDER,
      }),
    ).resolves.toMatchObject({
      user: { id: 'dual-mobile-user', roles: [Role.PROVIDER] },
    });
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        activeRole: Role.PROVIDER,
        roles: [Role.PROVIDER],
        sub: 'dual-mobile-user',
      }),
      expect.any(Object),
    );
    expect(authTokens.authenticateSupabaseBearerToken).toHaveBeenCalledWith(
      'supabase-token',
      [Role.PROVIDER],
      { requireAuthServer: true },
    );
  });
});

describe('AuthService Admin operator login', () => {
  const mfaEncryptionSecret = 'test-admin-mfa-encryption-key-with-32-characters';

  it('verifies a stored Admin credential without a broad Admin bearer token', async () => {
    const { passwordHash, passwordSalt } = hashAdminOperatorPassword('operator-password');
    const { prisma, service } = createOtpService({});
    prisma.adminOperatorCredential.findUnique.mockResolvedValue({
      id: 'credential-1',
      disabledAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordHash,
      passwordSalt,
      user: {
        id: 'operator-1',
        email: 'operator@hands.vn',
        fullName: 'Operator One',
        roles: [Role.ADMIN],
        adminOperatorPermission: { id: 'permission-1' },
      },
    });
    prisma.$transaction.mockImplementationOnce((async (input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(input as Array<Promise<unknown>>)) as never);

    await expect(
      service.verifyAdminOperatorLogin({ email: ' OPERATOR@hands.vn ', password: 'operator-password' }),
    ).resolves.toMatchObject({ authenticated: true, user: { id: 'operator-1', roles: [Role.ADMIN] } });
    expect(prisma.adminOperatorCredential.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'operator@hands.vn' } }),
    );
  });

  it('rejects invalid stored Admin credentials', async () => {
    const { prisma, service } = createOtpService({});
    prisma.adminOperatorCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyAdminOperatorLogin({ email: 'operator@hands.vn', password: 'wrong' }),
    ).rejects.toThrow('Invalid admin operator credentials');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        action: 'admin_operator.login.failed_unknown_identity',
        target: expect.stringMatching(/^admin_login_identity:[a-f0-9]{64}$/),
        metadata: expect.objectContaining({
          identityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    });
    expect(JSON.stringify(prisma.adminAuditLog.create.mock.calls)).not.toContain('operator@hands.vn');
  });

  it('requires the enrolled Admin MFA code after the password is verified', async () => {
    const { passwordHash, passwordSalt } = hashAdminOperatorPassword('operator-password');
    const { config, prisma, service } = createOtpService({});
    config.get.mockImplementation((key: string) =>
      key === 'ADMIN_MFA_ENCRYPTION_KEY' ? mfaEncryptionSecret : undefined,
    );
    prisma.adminOperatorCredential.findUnique.mockResolvedValue({
      id: 'credential-mfa-1',
      disabledAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      mfaRecoveryCodeHashes: [],
      mfaSecretEncrypted: encryptAdminMfaSecret('JBSWY3DPEHPK3PXP', mfaEncryptionSecret),
      mfaState: 'VERIFIED',
      passwordHash,
      passwordSalt,
      user: {
        id: 'operator-mfa-1',
        email: 'mfa@hands.vn',
        fullName: 'MFA Operator',
        roles: [Role.ADMIN],
        adminOperatorPermission: { id: 'permission-mfa-1' },
      },
    });
    prisma.$transaction.mockImplementationOnce((async (input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(input as Array<Promise<unknown>>)) as never);

    await expect(
      service.verifyAdminOperatorLogin({ email: 'mfa@hands.vn', password: 'operator-password' }),
    ).rejects.toThrow('Invalid admin operator credentials');
  });

  it('creates an MFA-verified Admin session for a valid TOTP code', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    try {
      const { passwordHash, passwordSalt } = hashAdminOperatorPassword('operator-password');
      const { config, prisma, redisState, service } = createOtpService({});
      config.get.mockImplementation((key: string) =>
        key === 'ADMIN_MFA_ENCRYPTION_KEY' ? mfaEncryptionSecret : undefined,
      );
      prisma.adminOperatorCredential.findUnique.mockResolvedValue({
        id: 'credential-mfa-2',
        disabledAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        mfaRecoveryCodeHashes: [],
        mfaSecretEncrypted: encryptAdminMfaSecret('JBSWY3DPEHPK3PXP', mfaEncryptionSecret),
        mfaState: 'VERIFIED',
        passwordHash,
        passwordSalt,
        user: {
          id: 'operator-mfa-2',
          email: 'mfa-valid@hands.vn',
          fullName: 'MFA Operator',
          roles: [Role.ADMIN],
          adminOperatorPermission: { id: 'permission-mfa-2' },
        },
      });

      await expect(
        service.verifyAdminOperatorLogin({
          email: 'mfa-valid@hands.vn',
          mfaCode: '324550',
          password: 'operator-password',
        }),
      ).resolves.toMatchObject({ authenticated: true, user: { id: 'operator-mfa-2' } });
      expect(redisState.consumeAdminMfaTotp).toHaveBeenCalledWith(
        'credential-mfa-2',
        56_666_666,
      );
      expect(prisma.adminWebSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mfaVerifiedAt: new Date(1_700_000_000_000) }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a TOTP counter that was already consumed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    try {
      const { passwordHash, passwordSalt } = hashAdminOperatorPassword('operator-password');
      const { config, prisma, redisState, service } = createOtpService({
        redisState: { consumeAdminMfaTotp: vi.fn().mockResolvedValue(false) },
      });
      config.get.mockImplementation((key: string) =>
        key === 'ADMIN_MFA_ENCRYPTION_KEY' ? mfaEncryptionSecret : undefined,
      );
      prisma.adminOperatorCredential.findUnique.mockResolvedValue({
        id: 'credential-mfa-replay',
        disabledAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        mfaRecoveryCodeHashes: [],
        mfaSecretEncrypted: encryptAdminMfaSecret('JBSWY3DPEHPK3PXP', mfaEncryptionSecret),
        mfaState: 'VERIFIED',
        passwordHash,
        passwordSalt,
        user: {
          id: 'operator-mfa-replay',
          email: 'mfa-replay@hands.vn',
          fullName: 'MFA Replay Operator',
          roles: [Role.ADMIN],
          adminOperatorPermission: { id: 'permission-mfa-replay' },
        },
      });
      prisma.$transaction.mockImplementationOnce((async (input: unknown) =>
        typeof input === 'function'
          ? (input as (tx: typeof prisma) => Promise<unknown>)(prisma)
          : Promise.all(input as Array<Promise<unknown>>)) as never);

      await expect(
        service.verifyAdminOperatorLogin({
          email: 'mfa-replay@hands.vn',
          mfaCode: '324550',
          password: 'operator-password',
        }),
      ).rejects.toThrow('Invalid admin operator credentials');

      expect(redisState.consumeAdminMfaTotp).toHaveBeenCalledWith(
        'credential-mfa-replay',
        56_666_666,
      );
      expect(prisma.adminWebSession.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('records failed public logins without allowing an unauthenticated caller to lock the operator', async () => {
    const { passwordHash, passwordSalt } = hashAdminOperatorPassword('expected-password');
    const { prisma, service, socketAuth } = createOtpService({});
    prisma.adminOperatorCredential.findUnique.mockResolvedValue({
      id: 'credential-locked',
      disabledAt: null,
      failedLoginCount: 4,
      lockedUntil: null,
      passwordHash,
      passwordSalt,
      user: {
        id: 'operator-locked',
        email: 'locked@hands.vn',
        fullName: 'Locked Operator',
        roles: [Role.ADMIN],
        adminOperatorPermission: { id: 'permission-locked' },
      },
    });
    prisma.adminOperatorCredential.update.mockResolvedValueOnce({ failedLoginCount: 5 });
    prisma.$transaction.mockImplementationOnce((async (input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(input as Array<Promise<unknown>>)) as never);

    await expect(
      service.verifyAdminOperatorLogin(
        { email: 'locked@hands.vn', password: 'wrong-password' },
        { sourceIp: '203.0.113.10', userAgent: 'Admin browser' },
      ),
    ).rejects.toThrow('Invalid admin operator credentials');

    expect(prisma.adminOperatorCredential.update).toHaveBeenCalledTimes(1);
    expect(prisma.adminOperatorCredential.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lockedUntil: expect.any(Date) }) }),
    );
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        action: 'admin_operator.login.failed',
        target: 'user:operator-locked',
        metadata: expect.objectContaining({
          locked: false,
          sourceIp: '203.0.113.10',
          userAgent: 'Admin browser',
        }),
      }),
    });
    expect(socketAuth.disconnectAdminUser).not.toHaveBeenCalled();
  });

  it('rate limits distributed login failures by a hashed account identity', async () => {
    const { prisma, redisState, service } = createOtpService({
      redisState: {
        consumeRateLimit: vi.fn().mockResolvedValue({ count: 21, resetAt: Date.now() + 60_000 }),
      },
    });
    prisma.adminOperatorCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyAdminOperatorLogin({
        email: 'operator@hands.vn',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(redisState.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^admin-login-account:[a-f0-9]{64}$/),
      15 * 60_000,
    );
    expect(redisState.consumeRateLimit.mock.calls[0]?.[0]).not.toContain('operator@hands.vn');
  });

  it('fails closed in production when the distributed Admin login limiter is unavailable', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        consumeRateLimit: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });
    prisma.adminOperatorCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyAdminOperatorLogin({
        email: 'operator@hands.vn',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
  });
});

function createService(refreshPayload: Record<string, unknown>, roles: Role[]) {
  const signedPayloads: unknown[] = [];
  const jwt = {
    verify: vi.fn().mockReturnValue(refreshPayload),
    sign: vi.fn((payload: unknown) => {
      signedPayloads.push(payload);
      return `signed-token-${signedPayloads.length}`;
    }),
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', roles }),
    },
  };
  const config = { get: vi.fn().mockReturnValue(undefined) };
  const redisState = {
    consumeRefreshToken: vi.fn().mockResolvedValue(true),
    isRefreshFamilyRevoked: vi.fn().mockResolvedValue(false),
    revokeRefreshFamily: vi.fn().mockResolvedValue(undefined),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  };
  const socketAuth = { disconnectMobileFamily: vi.fn() };

  return {
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      redisState as never,
      {} as never,
      {} as never,
      socketAuth as never,
    ),
    signedPayloads,
    prisma,
    redisState,
    socketAuth,
  };
}

function createOtpService({
  NODE_ENV,
  MOBILE_AUTH_ALLOW_DEV_OTP = 'true',
  DEV_OTP = '123456',
  redisState: redisStateOverrides,
}: {
  NODE_ENV?: string;
  MOBILE_AUTH_ALLOW_DEV_OTP?: string;
  DEV_OTP?: string;
  redisState?: Partial<
    Record<
      | 'consumeOtp'
      | 'consumeOtpIfMatches'
      | 'consumeAdminMfaTotp'
      | 'consumeRateLimit'
      | 'getOtp'
      | 'incrementOtpAttempts'
      | 'reserveOtpSend'
      | 'setOtp'
      | 'consumeRefreshToken'
      | 'isRefreshFamilyRevoked'
      | 'revokeRefreshFamily'
      | 'revokeRefreshToken',
      ReturnType<typeof vi.fn>
    >
  >;
}) {
  const jwt = {
    sign: vi.fn().mockReturnValue('signed-token'),
    verify: vi.fn(),
  };
  const prisma = {
    adminOperatorCredential: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    adminWebSession: {
      create: vi.fn().mockResolvedValue({}),
    },
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'NODE_ENV') return NODE_ENV;
      if (key === 'MOBILE_AUTH_ALLOW_DEV_OTP') return MOBILE_AUTH_ALLOW_DEV_OTP;
      if (key === 'DEV_OTP') return DEV_OTP;
      return undefined;
    }),
  };
  const redisState = {
    consumeAdminMfaTotp: vi.fn().mockResolvedValue(true),
    consumeOtp: vi.fn().mockResolvedValue(undefined),
    consumeOtpIfMatches: vi.fn().mockResolvedValue(false),
    consumeRateLimit: vi.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60_000 }),
    getOtp: vi.fn().mockResolvedValue(null),
    incrementOtpAttempts: vi.fn().mockResolvedValue(1),
    reserveOtpSend: vi.fn().mockResolvedValue(true),
    consumeRefreshToken: vi.fn().mockResolvedValue(true),
    isRefreshFamilyRevoked: vi.fn().mockResolvedValue(false),
    revokeRefreshFamily: vi.fn().mockResolvedValue(undefined),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    setOtp: vi.fn().mockResolvedValue(undefined),
    ...redisStateOverrides,
  };
  const otpDelivery = {
    deliverOtp: vi.fn().mockResolvedValue({ provider: 'sms', status: 'DELIVERED' }),
  };
  const authTokens = {
    authenticateSupabaseBearerToken: vi.fn(),
  };
  const socketAuth = {
    disconnectAdminUser: vi.fn(),
    disconnectMobileFamily: vi.fn(),
  };

  return {
    authTokens,
    config,
    jwt,
    otpDelivery,
    prisma,
    redisState,
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      redisState as never,
      otpDelivery as never,
      authTokens as never,
      socketAuth as never,
    ),
    socketAuth,
  };
}
