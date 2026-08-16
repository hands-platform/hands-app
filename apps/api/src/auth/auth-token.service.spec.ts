import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminOperatorPermissionCategory, Role } from '@prisma/client';
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

    await expect(
      service.authenticateSupabaseBearerToken('supabase-token', [Role.PROVIDER]),
    ).resolves.toMatchObject({
      activeRole: Role.PROVIDER,
      roles: [Role.PROVIDER],
      authProvider: 'supabase',
      externalUserId: 'supabase-user-2',
    });
  });

  it('does not accept an admin role injected through Supabase app metadata', async () => {
    const { prisma, service } = createService({
      sub: 'supabase-admin-injection',
      aud: 'authenticated',
      phone: '+84900000005',
      app_metadata: { roles: [Role.ADMIN, Role.MASTER_ADMIN] },
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.ADMIN])).rejects.toThrow(
      'Supabase token is not allowed for the requested role',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a Supabase identity already linked to a local Admin operator', async () => {
    const { prisma, service } = createService({
      sub: 'supabase-local-admin',
      aud: 'authenticated',
      phone: '+84900000006',
      app_metadata: { role: Role.CUSTOMER },
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'local-admin-user',
      roles: [Role.ADMIN, Role.PROVIDER],
      customerProfile: null,
      providerProfile: {},
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.CUSTOMER])).rejects.toThrow(
      'Supabase mobile identity cannot use an Admin operator account',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects automatic phone linking from Supabase to a local Admin operator', async () => {
    const { prisma, service } = createService({
      sub: 'supabase-phone-collision',
      aud: 'authenticated',
      phone: '+84900000008',
      app_metadata: { role: Role.CUSTOMER },
    });
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'local-admin-phone-owner',
      roles: [Role.ADMIN],
      customerProfile: null,
      providerProfile: null,
    });

    await expect(service.authenticateSupabaseBearerToken('supabase-token', [Role.CUSTOMER])).rejects.toThrow(
      'Supabase mobile identity cannot use an Admin operator account',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('replaces stale provider membership when Supabase demotes the user to customer', async () => {
    const { prisma, service } = createService({
      sub: 'supabase-provider-demotion',
      aud: 'authenticated',
      phone: '+84900000007',
      app_metadata: { role: Role.CUSTOMER },
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'demoted-provider-user',
      roles: [Role.PROVIDER],
      customerProfile: {},
      providerProfile: {},
    });

    await service.authenticateSupabaseBearerToken('supabase-token', [Role.CUSTOMER]);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: { set: [Role.CUSTOMER] },
        }),
      }),
    );
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

  it('requires a current Auth server session for exchange-grade verification', async () => {
    const payload = {
      sub: 'supabase-hmac-user',
      aud: 'authenticated',
      app_metadata: { role: Role.CUSTOMER },
    };
    const { jwt, prisma, service } = createService(payload);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    try {
      await expect(
        service.authenticateSupabaseBearerToken('locally-valid-token', [Role.CUSTOMER], {
          requireAuthServer: true,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('AuthTokenService admin realtime socket tokens', () => {
  it('accepts a short-lived admin realtime token for socket auth only', async () => {
    const { prisma, service, token } = createAdminRealtimeServiceAndToken();

    await expect(service.authenticateSocketToken(token)).resolves.toMatchObject({
      id: 'operator-user-1',
      activeRole: Role.ADMIN,
      roles: [Role.ADMIN],
      authProvider: 'admin-realtime',
    });
    expect(prisma.adminWebSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'test-jti' } }),
    );
  });

  it.each([
    ['wrong audience', { aud: 'hands-api' }],
    ['wrong scope', { scope: 'admin:api' }],
    ['wrong type', { typ: 'access' }],
    ['wrong role', { role: Role.CUSTOMER }],
    ['missing expiration', { exp: undefined }],
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

  it('does not accept an Admin Web REST token for socket authentication', async () => {
    const { service, token } = createAdminWebApiServiceAndToken();

    await expect(service.authenticateSocketToken(token)).rejects.toThrow(
      'Admin sockets require an admin realtime token',
    );
  });

  it('rejects admin realtime tokens signed with the wrong secret', async () => {
    const { service, signAdminRealtimeToken } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateSocketToken(signAdminRealtimeToken({}, 'wrong-admin-realtime-secret')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a validly signed realtime token after the operator loses Admin access', async () => {
    const { prisma, service, token } = createAdminRealtimeServiceAndToken();
    prisma.adminWebSession.findUnique.mockResolvedValue(null);

    await expect(service.authenticateSocketToken(token)).rejects.toThrow(UnauthorizedException);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        action: 'admin_operator.realtime.authentication_denied',
        metadata: {
          authProvider: 'admin-realtime',
          reason: 'SESSION_NOT_FOUND',
          sessionId: 'test-jti',
        },
        target: 'admin_web_session:test-jti',
      }),
    });
  });

  it('rejects realtime access until the Admin session has completed MFA enrollment', async () => {
    const { prisma, service, token } = createAdminRealtimeServiceAndToken();
    const session = adminWebSessionFixture('test-jti');
    session.mfaVerifiedAt = null;
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(service.authenticateSocketToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    ['revoked session', (session: ReturnType<typeof adminWebSessionFixture>) => { session.revokedAt = new Date(); }],
    ['expired session', (session: ReturnType<typeof adminWebSessionFixture>) => { session.expiresAt = new Date(0); }],
    ['disabled credential', (session: ReturnType<typeof adminWebSessionFixture>) => {
      session.user.adminOperatorCredential.disabledAt = new Date();
    }],
    ['locked credential', (session: ReturnType<typeof adminWebSessionFixture>) => {
      session.user.adminOperatorCredential.lockedUntil = new Date(Date.now() + 60_000);
    }],
    ['missing permission', (session: ReturnType<typeof adminWebSessionFixture>) => {
      session.user.adminOperatorPermission = null;
    }],
  ])('rejects a realtime reconnect with a %s', async (_label, mutateSession) => {
    const { prisma, service, token } = createAdminRealtimeServiceAndToken();
    const session = adminWebSessionFixture('test-jti');
    mutateSession(session);
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(service.authenticateSocketToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('does not let an invalid database session fall through to the development identity fallback', async () => {
    const { config, prisma, service, token } = createAdminRealtimeServiceAndToken();
    prisma.adminWebSession.findUnique.mockResolvedValue(null);
    config.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_REALTIME_TOKEN_SECRET') return 'test-admin-realtime-secret';
      if (key === 'JWT_ACCESS_SECRET') return 'test-jwt-access-secret';
      if (key === 'ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN') return 'true';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });

    await expect(service.authenticateSocketToken(token)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('keeps normal Nest customer and partner socket JWT authentication working', async () => {
    const { prisma, redisState, service, signNestToken } = createAdminRealtimeServiceAndToken();
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'customer-user-1',
        roles: [Role.CUSTOMER],
        customerProfile: { id: 'customer-1' },
        providerProfile: null,
      })
      .mockResolvedValueOnce({
        id: 'partner-user-1',
        roles: [Role.PROVIDER],
        customerProfile: null,
        providerProfile: { id: 'partner-1', deletedAt: null },
      });

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
      sessionFamilyId: 'mobile-family-1',
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
      sessionFamilyId: 'mobile-family-1',
    });
    expect(redisState.isRefreshFamilyRevoked).toHaveBeenCalledWith('mobile-family-1');
  });

  it('rejects a Nest access token after its refresh family is revoked', async () => {
    const { prisma, redisState, service, signNestToken } = createAdminRealtimeServiceAndToken();
    redisState.isRefreshFamilyRevoked.mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'customer-user-1',
      roles: [Role.CUSTOMER],
      customerProfile: { id: 'customer-1' },
      providerProfile: null,
    });

    await expect(
      service.authenticateBearerToken(
        signNestToken({
          sub: 'customer-user-1',
          roles: [Role.CUSTOMER],
          activeRole: Role.CUSTOMER,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not include Redis error details in mobile revocation logs', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { prisma, redisState, service, signNestToken } = createAdminRealtimeServiceAndToken();
    redisState.isRefreshFamilyRevoked.mockRejectedValue(
      new Error('redis://operator:private-secret@internal:6379'),
    );

    try {
      await expect(
        service.authenticateBearerToken(
          signNestToken({
            sub: 'customer-user-1',
            roles: [Role.CUSTOMER],
            activeRole: Role.CUSTOMER,
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Mobile access-token revocation check failed');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private-secret');
    } finally {
      warn.mockRestore();
    }
  });

  it('rejects a Nest access token after its mobile role is removed', async () => {
    const { prisma, service, signNestToken } = createAdminRealtimeServiceAndToken();
    prisma.user.findUnique.mockResolvedValue({
      id: 'partner-user-1',
      roles: [Role.CUSTOMER],
      customerProfile: { id: 'customer-1' },
      providerProfile: { id: 'partner-1', deletedAt: null },
    });

    await expect(
      service.authenticateBearerToken(
        signNestToken({
          sub: 'partner-user-1',
          roles: [Role.PROVIDER],
          activeRole: Role.PROVIDER,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a Nest provider token after the Partner profile is deleted', async () => {
    const { prisma, service, signNestToken } = createAdminRealtimeServiceAndToken();
    prisma.user.findUnique.mockResolvedValue({
      id: 'partner-user-1',
      roles: [Role.PROVIDER],
      customerProfile: null,
      providerProfile: { id: 'partner-1', deletedAt: new Date() },
    });

    await expect(
      service.authenticateBearerToken(
        signNestToken({
          sub: 'partner-user-1',
          roles: [Role.PROVIDER],
          activeRole: Role.PROVIDER,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects generic Nest JWTs carrying the Admin role', async () => {
    const { service, signNestToken } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateBearerToken(
        signNestToken({
          sub: 'operator-user-1',
          roles: [Role.ADMIN],
          activeRole: Role.ADMIN,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects generic Nest JWTs without an expiration', async () => {
    const { service, signNestTokenWithoutExpiration } = createAdminRealtimeServiceAndToken();

    await expect(
      service.authenticateBearerToken(
        signNestTokenWithoutExpiration({
          sub: 'customer-user-1',
          roles: [Role.CUSTOMER],
          activeRole: Role.CUSTOMER,
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
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
    expect(prisma.adminWebSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'admin-web-jti' } }),
    );
  });

  it.each([
    ['wrong audience', { aud: 'hands-socket' }],
    ['wrong scope', { scope: 'admin:realtime' }],
    ['wrong type', { typ: 'access' }],
    ['wrong role', { role: Role.CUSTOMER }],
  ])('rejects an Admin Web API token with %s', async (_label, overrides) => {
    const { service, signToken } = createAdminWebApiServiceAndToken();

    await expect(service.authenticateBearerToken(signToken(overrides))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an Admin Web API token signed with a non-HS256 algorithm', async () => {
    const { jwt, service } = createAdminWebApiServiceAndToken();
    const token = jwt.sign(
      {
        sub: 'operator-user-1',
        typ: 'admin-web-api',
        aud: 'hands-api',
        scope: 'admin:api',
        role: Role.ADMIN,
        jti: 'admin-web-jti',
      },
      { algorithm: 'HS384', expiresIn: '5m', secret: 'test-admin-web-api-secret' },
    );

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a signed token when the operator no longer has Admin access', async () => {
    const { prisma, service, token } = createAdminWebApiServiceAndToken();
    prisma.adminWebSession.findUnique.mockResolvedValue(null);

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it('records rate-limited REST denial evidence for a rejected Admin session', async () => {
    const redisState = {
      consumeRateLimit: vi.fn()
        .mockResolvedValueOnce({ count: 1, resetAt: Date.now() + 60_000 })
        .mockResolvedValueOnce({ count: 2, resetAt: Date.now() + 60_000 }),
    };
    const { prisma, service, token } = createAdminWebApiServiceAndToken(redisState);
    prisma.adminWebSession.findUnique.mockResolvedValue(null);

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);

    expect(redisState.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: 'admin_operator.rest.authentication_denied',
        target: 'admin_web_session:admin-web-jti',
        metadata: {
          authProvider: 'admin-web',
          reason: 'SESSION_NOT_FOUND',
          sessionId: 'admin-web-jti',
        },
      },
    });
  });

  it('marks an Admin Web session as enrollment-only until MFA is verified', async () => {
    const { prisma, service, token } = createAdminWebApiServiceAndToken();
    const session = adminWebSessionFixture('admin-web-jti', []);
    session.mfaVerifiedAt = null;
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(service.authenticateBearerToken(token)).resolves.toMatchObject({
      adminMfaEnrollmentRequired: true,
      authProvider: 'admin-web',
    });
  });

  it('rejects an Admin Web session after the configured idle timeout', async () => {
    const { prisma, service, token } = createAdminWebApiServiceAndToken();
    const session = adminWebSessionFixture('admin-web-jti', []);
    session.lastSeenAt = new Date(Date.now() - 31 * 60_000);
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(service.authenticateBearerToken(token)).rejects.toThrow(UnauthorizedException);
    expect(prisma.adminWebSession.update).not.toHaveBeenCalled();
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
  const prisma = {
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    adminWebSession: {
      findUnique: vi.fn().mockResolvedValue(adminWebSessionFixture('test-jti')),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
  };
  const redisState = {
    consumeRateLimit: vi.fn().mockResolvedValue({ count: 1 }),
    isRefreshFamilyRevoked: vi.fn().mockResolvedValue(false),
  };
  const service = new AuthTokenService(jwt, config as never, prisma as never, redisState as never);
  const signAdminRealtimeToken = (
    overrides: Record<string, unknown> = {},
    secret = 'test-admin-realtime-secret',
  ) => {
    const payload = {
      sub: 'operator-user-1',
      typ: 'admin-realtime',
      aud: 'hands-socket',
      scope: 'admin:realtime',
      role: Role.ADMIN,
      jti: 'test-jti',
      ...overrides,
    };
    if ('exp' in overrides && overrides.exp === undefined) delete payload.exp;
    return jwt.sign(payload, 'exp' in overrides ? { secret } : { secret, expiresIn: '2m' });
  };
  const signNestToken = (payload: Record<string, unknown>) =>
    jwt.sign(
      { familyId: 'mobile-family-1', ...payload },
      { secret: 'test-jwt-access-secret', expiresIn: '15m' },
    );
  const signNestTokenWithoutExpiration = (payload: Record<string, unknown>) =>
    jwt.sign(payload, { secret: 'test-jwt-access-secret' });

  return {
    config,
    prisma,
    redisState,
    service,
    token: signAdminRealtimeToken(),
    signAdminRealtimeToken,
    signNestToken,
    signNestTokenWithoutExpiration,
  };
}

function createAdminWebApiServiceAndToken(redisState?: { consumeRateLimit: ReturnType<typeof vi.fn> }) {
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
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    adminWebSession: {
      findUnique: vi.fn().mockResolvedValue(adminWebSessionFixture('admin-web-jti', [])),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const service = new AuthTokenService(jwt, config as never, prisma as never, redisState as never);
  const signToken = (overrides: Record<string, unknown> = {}) => {
    const payload = {
        sub: 'operator-user-1',
        typ: 'admin-web-api',
        aud: 'hands-api',
        scope: 'admin:api',
        role: Role.ADMIN,
        jti: 'admin-web-jti',
        ...overrides,
    };
    if ('exp' in overrides && overrides.exp === undefined) delete payload.exp;
    return jwt.sign(
      payload,
      'exp' in overrides
        ? { secret: 'test-admin-web-api-secret' }
        : { secret: 'test-admin-web-api-secret', expiresIn: '5m' },
    );
  };

  return { jwt, prisma, service, signToken, token: signToken() };
}

function adminWebSessionFixture(
  id: string,
  categories: AdminOperatorPermissionCategory[] = [AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
) {
  return {
    id,
    userId: 'operator-user-1',
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerifiedAt: new Date() as Date | null,
    revokedAt: null as Date | null,
    lastSeenAt: new Date(),
    user: {
      id: 'operator-user-1',
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        id: 'permission-1',
        categories,
        version: 1,
      } as { id: string; categories: AdminOperatorPermissionCategory[]; version: number } | null,
      adminOperatorCredential: {
        disabledAt: null as Date | null,
        lockedUntil: null as Date | null,
      },
    },
  };
}
