import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService OTP production guard', () => {
  it('rejects production OTP requests when Redis cannot store the OTP', async () => {
    const { otpDelivery, redisState, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        setOtp: jest.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).rejects.toThrow(
      'OTP service is temporarily unavailable',
    );
    expect(redisState.setOtp).toHaveBeenCalled();
    expect(otpDelivery.deliverOtp).not.toHaveBeenCalled();
  });

  it('does not log Redis connection details when production OTP storage fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        setOtp: jest.fn().mockRejectedValue(new Error('redis://:super-secret@localhost:6379 unavailable')),
      },
    });

    await expect(service.requestOtp({ phone: '+84900000000', role: Role.CUSTOMER })).rejects.toThrow(
      'OTP service is temporarily unavailable',
    );

    expect(warn).toHaveBeenCalledWith('Redis OTP store unavailable.');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('super-secret');
    warn.mockRestore();
  });

  it('rejects production OTP verification when Redis lookup is unavailable', async () => {
    const { prisma, service } = createOtpService({
      NODE_ENV: 'production',
      redisState: {
        getOtp: jest.fn().mockRejectedValue(new Error('redis down')),
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
        getOtp: jest.fn().mockResolvedValue('123456'),
        consumeOtp: jest.fn().mockRejectedValue(new Error('redis down')),
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
      roles: [Role.CUSTOMER, Role.PROVIDER],
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
});

function createService(refreshPayload: Record<string, unknown>, roles: Role[]) {
  const signedPayloads: unknown[] = [];
  const jwt = {
    verify: jest.fn().mockReturnValue(refreshPayload),
    sign: jest.fn((payload: unknown) => {
      signedPayloads.push(payload);
      return `signed-token-${signedPayloads.length}`;
    }),
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', roles }),
    },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };

  return {
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
    ),
    signedPayloads,
  };
}

function createOtpService({
  NODE_ENV,
  redisState: redisStateOverrides,
}: {
  NODE_ENV?: string;
  redisState?: Partial<Record<'consumeOtp' | 'getOtp' | 'setOtp', jest.Mock>>;
}) {
  const jwt = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string) => (key === 'NODE_ENV' ? NODE_ENV : undefined)),
  };
  const redisState = {
    consumeOtp: jest.fn().mockResolvedValue(undefined),
    getOtp: jest.fn().mockResolvedValue(null),
    setOtp: jest.fn().mockResolvedValue(undefined),
    ...redisStateOverrides,
  };
  const otpDelivery = {
    deliverOtp: jest.fn().mockResolvedValue({ provider: 'sms', status: 'DELIVERED' }),
  };
  const authTokens = {
    authenticateSupabaseBearerToken: jest.fn(),
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
