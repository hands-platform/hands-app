import { UnauthorizedException } from '@nestjs/common';
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
