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

  it('falls back to the Supabase Auth server for signing-key tokens', async () => {
    const payload = {
      sub: 'supabase-signing-key-user',
      aud: 'authenticated',
      iss: 'https://projectref.supabase.co/auth/v1',
      phone: '84900000004',
      app_metadata: { role: Role.CUSTOMER },
    };
    const { jwt, prisma, service } = createService(payload);
    jwt.verify.mockImplementation(() => {
      throw new Error('legacy HMAC verification failed');
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: payload.sub,
        phone: payload.phone,
        app_metadata: payload.app_metadata,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(
        service.authenticateSupabaseBearerToken('supabase-signing-key-token', [Role.CUSTOMER]),
      ).resolves.toMatchObject({
        activeRole: Role.CUSTOMER,
        roles: [Role.CUSTOMER],
        authProvider: 'supabase',
        externalUserId: payload.sub,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://projectref.supabase.co/auth/v1/user',
        expect.objectContaining({
          method: 'GET',
          headers: {
            apikey: 'sb_publishable_test',
            authorization: 'Bearer supabase-signing-key-token',
          },
          redirect: 'error',
        }),
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+84900000004' }),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects a remotely validated token when the Auth user does not match its subject', async () => {
    const payload = {
      sub: 'supabase-token-subject',
      aud: 'authenticated',
      iss: 'https://projectref.supabase.co/auth/v1',
      app_metadata: { role: Role.CUSTOMER },
    };
    const { jwt, prisma, service } = createService(payload);
    jwt.verify.mockImplementation(() => {
      throw new Error('legacy HMAC verification failed');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'different-supabase-user' }),
      }),
    );

    try {
      await expect(
        service.authenticateSupabaseBearerToken('subject-mismatch-token', [Role.CUSTOMER]),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects a remotely validated token with an unexpected issuer', async () => {
    const payload = {
      sub: 'supabase-wrong-issuer-user',
      aud: 'authenticated',
      iss: 'https://other-project.supabase.co/auth/v1',
      app_metadata: { role: Role.CUSTOMER },
    };
    const { jwt, prisma, service } = createService(payload);
    jwt.verify.mockImplementation(() => {
      throw new Error('legacy HMAC verification failed');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: payload.sub }),
      }),
    );

    try {
      await expect(
        service.authenticateSupabaseBearerToken('wrong-issuer-token', [Role.CUSTOMER]),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed when the Supabase Auth server rejects the token', async () => {
    const payload = {
      sub: 'supabase-rejected-user',
      aud: 'authenticated',
      app_metadata: { role: Role.CUSTOMER },
    };
    const { jwt, prisma, service } = createService(payload);
    jwt.verify.mockImplementation(() => {
      throw new Error('legacy HMAC verification failed');
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    try {
      await expect(
        service.authenticateSupabaseBearerToken('rejected-token', [Role.CUSTOMER]),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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

describe('AuthTokenService Admin Web API tokens', () => {
  it('authenticates a valid token as the database-backed operator identity', async () => {
    const { prisma, service, token } = createAdminWebApiServiceAndToken();

    await expect(service.authenticateBearerToken(token)).resolves.toMatchObject({
      id: 'operator-user-1',
      activeRole: Role.ADMIN,
      roles: [Role.ADMIN],
      authProvider: 'admin-web',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        roles: { has: Role.ADMIN },
        OR: [
          { id: 'operator@hands.vn' },
          { email: 'operator@hands.vn' },
          { phone: 'operator@hands.vn' },
          { adminOperatorCredential: { is: { email: 'operator@hands.vn' } } },
        ],
      },
      select: { id: true, roles: true },
    });
  });

  it.each([
    ['wrong audience', { aud: 'hands-socket' }],
    ['wrong scope', { scope: 'admin:realtime' }],
    ['wrong type', { typ: 'access' }],
    ['wrong role', { role: Role.CUSTOMER }],
  ])('rejects an Admin Web API token with %s', async (_label, overrides) => {
    const { service, signToken } = createAdminWebApiServiceAndToken();

    await expect(service.authenticateBearerToken(signToken(overrides))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a signed token when the operator no longer has Admin access', async () => {
    const { prisma, service, token } = createAdminWebApiServiceAndToken();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
  });
});

function createService(payload: Record<string, unknown>) {
  const jwt = {
    verify: vi.fn().mockReturnValue(payload),
    decode: vi.fn().mockReturnValue(payload),
  };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'SUPABASE_JWT_SECRET') {
        return 'supabase-jwt-secret';
      }
      if (key === 'SUPABASE_JWT_AUDIENCE') {
        return 'authenticated';
      }
      if (key === 'SUPABASE_URL') {
        return 'https://projectref.supabase.co';
      }
      if (key === 'SUPABASE_ANON_KEY') {
        return 'sb_publishable_test';
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

function createAdminWebApiServiceAndToken() {
  const jwt = new JwtService();
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'ADMIN_WEB_API_TOKEN_SECRET') return 'test-admin-web-api-secret';
      if (key === 'JWT_ACCESS_SECRET') return 'test-jwt-access-secret';
      if (key === 'ADMIN_REALTIME_TOKEN_SECRET') return 'test-admin-realtime-secret';
      if (key === 'ADMIN_WEB_SESSION_COOKIE_SECRET') return 'test-session-cookie-secret';
      return undefined;
    }),
  };
  const prisma = {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'operator-user-1', roles: [Role.ADMIN] }),
    },
  };
  const service = new AuthTokenService(jwt, config as never, prisma as never);
  const signToken = (overrides: Record<string, unknown> = {}) =>
    jwt.sign(
      {
        sub: 'operator@hands.vn',
        typ: 'admin-web-api',
        aud: 'hands-api',
        scope: 'admin:api',
        role: Role.ADMIN,
        jti: 'admin-web-jti',
        ...overrides,
      },
      { secret: 'test-admin-web-api-secret', expiresIn: '5m' },
    );

  return { jwt, prisma, service, signToken, token: signToken() };
}
