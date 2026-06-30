import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService Supabase roles', () => {
  it('ignores user_metadata roles when exchanging for a requested provider role', async () => {
    const { service } = createService({
      sub: 'supabase-user-1',
      aud: 'authenticated',
      phone: '+84900000001',
      app_metadata: { role: Role.CUSTOMER },
      user_metadata: { role: Role.PROVIDER },
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.PROVIDER])).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('uses app_metadata roles as the Supabase authorization source', async () => {
    const { service } = createService({
      sub: 'supabase-user-2',
      aud: 'authenticated',
      phone: '+84900000002',
      app_metadata: { roles: [Role.PROVIDER] },
      user_metadata: { roles: [Role.CUSTOMER] },
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.PROVIDER])).resolves.toMatchObject({
      activeRole: Role.PROVIDER,
      roles: [Role.PROVIDER],
      authProvider: 'supabase',
      externalUserId: 'supabase-user-2',
    });
  });

  it('rejects unexpected Supabase audiences before syncing user records', async () => {
    const { prisma, service } = createService({
      sub: 'supabase-user-3',
      aud: 'anon',
      phone: '+84900000003',
      app_metadata: { role: Role.CUSTOMER },
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.CUSTOMER])).rejects.toThrow(
      'Invalid Supabase token audience',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('AuthTokenService admin realtime socket tokens', () => {
  it('accepts a short-lived admin realtime token for socket auth only', async () => {
    const { service, token } = createAdminRealtimeServiceAndToken();

    await expect(service.authenticateSocketToken(token)).resolves.toMatchObject({
      id: 'admin-web',
      activeRole: Role.ADMIN,
      roles: [Role.ADMIN],
      authProvider: 'admin-realtime',
    });
  });

  it.each([
    ['wrong audience', { aud: 'hands-api' }],
    ['wrong scope', { scope: 'admin:api' }],
    ['wrong type', { typ: 'access' }],
    ['wrong role', { role: Role.CUSTOMER }],
  ])('rejects admin realtime tokens with %s', async (_label, overrides) => {
    const { service, signAdminRealtimeToken } = createAdminRealtimeServiceAndToken();

    await expect(service.authenticateSocketToken(signAdminRealtimeToken(overrides))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired admin realtime tokens', async () => {
    const { service, signAdminRealtimeToken } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateSocketToken(
        signAdminRealtimeToken({
          exp: Math.floor(Date.now() / 1000) - 30,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not accept admin realtime tokens for REST bearer authentication', async () => {
    const { service, token } = createAdminRealtimeServiceAndToken();

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects admin realtime tokens signed with the wrong secret', async () => {
    const { service, signAdminRealtimeToken } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateSocketToken(signAdminRealtimeToken({}, 'wrong-admin-realtime-secret')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('keeps normal Nest customer and partner socket JWT authentication working', async () => {
    const { service, signNestToken } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateSocketToken(
        signNestToken({
          sub: 'customer-user-1',
          roles: [Role.CUSTOMER],
          activeRole: Role.CUSTOMER,
        }),
      ),
    ).resolves.toMatchObject({
      id: 'customer-user-1',
      activeRole: Role.CUSTOMER,
      roles: [Role.CUSTOMER],
      authProvider: 'nest',
    });

    await expect(
      service.authenticateSocketToken(
        signNestToken({
          sub: 'partner-user-1',
          roles: [Role.PROVIDER],
          activeRole: Role.PROVIDER,
        }),
      ),
    ).resolves.toMatchObject({
      id: 'partner-user-1',
      activeRole: Role.PROVIDER,
      roles: [Role.PROVIDER],
      authProvider: 'nest',
    });
  });
});

function createService(payload: Record<string, unknown>) {
  const jwt = {
    verify: vi.fn().mockReturnValue(payload),
  };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_JWT_SECRET') {
        return 'supabase-jwt-secret';
      }
      if (key === 'SUPABASE_JWT_AUDIENCE') {
        return 'authenticated';
      }
      return undefined;
    }),
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(({ data }) =>
        Promise.resolve({
          id: 'user-1',
          roles: data.roles,
        }),
      ),
      update: vi.fn(({ data }) =>
        Promise.resolve({
          id: 'user-1',
          roles: data.roles?.set ?? [],
        }),
      ),
    },
  };

  return {
    service: new AuthTokenService(jwt as never, config as never, prisma as never),
    jwt,
    prisma,
  };
}

function createAdminRealtimeServiceAndToken() {
  const jwt = new JwtService();
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'ADMIN_REALTIME_TOKEN_SECRET') {
        return 'test-admin-realtime-secret';
      }
      if (key === 'JWT_ACCESS_SECRET') {
        return 'test-jwt-access-secret';
      }
      return undefined;
    }),
  };
  const prisma = { user: {} };
  const service = new AuthTokenService(jwt, config as never, prisma as never);
  const signAdminRealtimeToken = (
    overrides: Record<string, unknown> = {},
    secret = 'test-admin-realtime-secret',
  ) => {
    const payload = {
      sub: 'admin-web',
      typ: 'admin-realtime',
      aud: 'hands-socket',
      scope: 'admin:realtime',
      role: Role.ADMIN,
      jti: 'test-jti',
      ...overrides,
    };
    return jwt.sign(
      payload,
      'exp' in payload
        ? { secret }
        : { secret, expiresIn: '2m' },
    );
  };
  const signNestToken = (payload: Record<string, unknown>) =>
    jwt.sign(payload, { secret: 'test-jwt-access-secret', expiresIn: '15m' });

  return {
    service,
    token: signAdminRealtimeToken(),
    signAdminRealtimeToken,
    signNestToken,
  };
}
