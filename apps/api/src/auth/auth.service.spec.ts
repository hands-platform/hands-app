import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

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
