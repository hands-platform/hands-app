import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { hashAdminOperatorPassword } from './admin-operator-credential';

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

  it('rejects production OTP verification when Redis lookup is unavailable', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        getOtp: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(
      service.verifyOtp({ phone: '+84900000000', otp: '123456', role: Role.CUSTOMER }),
    ).rejects.toThrow('OTP service is temporarily unavailable');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects production OTP verification when Redis cannot consume a valid OTP', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        getOtp: vi.fn().mockResolvedValue('123456'),
        consumeOtp: vi.fn().mockRejectedValue(new Error('redis down')),
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

  it('does not guess an active role for legacy multi-role refresh tokens', async () => {
    const { service, signedPayloads } = createService({ sub: 'user-1', tokenType: 'refresh' }, [
      Role.CUSTOMER,
      Role.PROVIDER,
    ]);

    await service.refresh('refresh-token-1');

    expect(signedPayloads[0]).toMatchObject({
      sub: 'user-1',
      roles: [Role.CUSTOMER, Role.PROVIDER],
      refreshed: true,
    });
    expect(signedPayloads[0]).not.toHaveProperty('activeRole');
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
    const { redisState, service } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER },
      [Role.CUSTOMER],
    );

    await expect(service.refresh('refresh-token-1')).resolves.toEqual({
      accessToken: 'signed-token-1',
      refreshToken: 'signed-token-2',
    });
    expect(redisState.consumeRefreshToken).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
    expect(redisState.consumeRefreshToken.mock.calls[0]?.[0]).not.toContain('refresh-token-1');
  });

  it('rejects a refresh token that was already revoked', async () => {
    const { prisma, redisState, service } = createService(
      { sub: 'user-1', tokenType: 'refresh', activeRole: Role.CUSTOMER },
      [Role.CUSTOMER],
    );
    redisState.consumeRefreshToken.mockResolvedValue(false);

    await expect(service.refresh('refresh-token-1')).rejects.toThrow('Refresh token has been revoked');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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
    await expect(service.logout('refresh-token-1')).resolves.toEqual({ ok: true });
    await expect(refreshResult).rejects.toThrow('Refresh token has been revoked');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('revokes a refresh token on logout', async () => {
    const { redisState, service } = createService(
      { sub: 'user-1', tokenType: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 },
      [Role.CUSTOMER],
    );

    await expect(service.logout('refresh-token-1')).resolves.toEqual({ ok: true });
    expect(redisState.revokeRefreshToken).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
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
      if (key === 'JWT_REFRESH_SECRET') return 'production-refresh-secret';
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
  });
});

describe('AuthService Admin operator login', () => {
  it('verifies a stored Admin credential without a broad Admin bearer token', async () => {
    const { passwordHash, passwordSalt } = hashAdminOperatorPassword('operator-password');
    const { prisma, service } = createOtpService({});
    prisma.adminOperatorCredential.findUnique.mockResolvedValue({
      passwordHash,
      passwordSalt,
      user: {
        id: 'operator-1',
        email: 'operator@hands.vn',
        fullName: 'Operator One',
        roles: [Role.ADMIN],
      },
    });

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
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  };

  return {
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      redisState as never,
      {} as never,
      {} as never,
    ),
    signedPayloads,
    prisma,
    redisState,
  };
}

function createOtpService({
  NODE_ENV,
  redisState: redisStateOverrides,
}: {
  NODE_ENV?: string;
  redisState?: Partial<
    Record<
      | 'consumeOtp'
      | 'getOtp'
      | 'incrementOtpAttempts'
      | 'reserveOtpSend'
      | 'setOtp'
      | 'consumeRefreshToken'
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
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
    },
  };
  const config = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? NODE_ENV : undefined)),
  };
  const redisState = {
    consumeOtp: vi.fn().mockResolvedValue(undefined),
    getOtp: vi.fn().mockResolvedValue(null),
    incrementOtpAttempts: vi.fn().mockResolvedValue(1),
    reserveOtpSend: vi.fn().mockResolvedValue(true),
    consumeRefreshToken: vi.fn().mockResolvedValue(true),
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
    ),
  };
}
