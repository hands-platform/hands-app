import { Logger, UnauthorizedException } from '@nestjs/common';
import { AdminOperatorPermissionCategory, Role } from '@prisma/client';

import { SocketAuthService } from './socket-auth.service';

describe('SocketAuthService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('disconnects the socket when its signed token expires', async () => {
    vi.useFakeTimers();
    const tokenExpiresAt = Date.now() + 1_000;
    const user = adminRealtimeUser({ tokenExpiresAt });
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    const service = new SocketAuthService(authTokens as never);
    const socket = socketFixture();

    await expect(service.authenticate(socket as never)).resolves.toEqual(user);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('records authorization denial evidence only for authenticated Admin sockets', async () => {
    const prisma = { adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } };
    const service = new SocketAuthService({} as never, undefined, prisma as never);

    await service.recordAdminAuthorizationDenial(
      adminRealtimeUser(),
      'booking:booking-1',
      'BOOKING_ROOM_FORBIDDEN',
    );

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin_operator.realtime.authorization_denied',
        target: 'booking:booking-1',
      }),
    });
  });

  it('revalidates the token before accepting an inbound socket event', async () => {
    const user = adminRealtimeUser();
    const authTokens = {
      authenticateSocketToken: vi.fn().mockResolvedValueOnce(user).mockRejectedValueOnce(
        new UnauthorizedException('Session revoked'),
      ),
    };
    const service = new SocketAuthService(authTokens as never);
    const socket = socketFixture();
    await service.authenticate(socket as never);

    await expect(service.requireCurrentUser(socket as never)).rejects.toThrow('Session revoked');
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects an Admin socket when the permission version changes', async () => {
    const original = adminRealtimeUser({ adminPermissionVersion: 1 });
    const changed = adminRealtimeUser({ adminPermissionVersion: 2 });
    const authTokens = {
      authenticateSocketToken: vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(changed),
    };
    const service = new SocketAuthService(authTokens as never);
    const socket = socketFixture();
    await service.authenticate(socket as never);

    await expect(service.requireCurrentUser(socket as never)).rejects.toThrow(
      'Admin socket permissions changed',
    );
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('periodically revalidates an idle Admin socket', async () => {
    vi.useFakeTimers();
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    const service = new SocketAuthService(authTokens as never);
    const socket = socketFixture();
    await service.authenticate(socket as never);

    await vi.advanceTimersByTimeAsync(5_000);

    expect(authTokens.authenticateSocketToken).toHaveBeenCalledTimes(2);
  });

  it('disconnects an active Admin socket immediately when its session is revoked', async () => {
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    const service = new SocketAuthService(authTokens as never);
    const socket = socketFixture();
    await service.authenticate(socket as never);

    service.disconnectAdminSession('admin-session-1');

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects every active socket for a disabled Admin operator', async () => {
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    const service = new SocketAuthService(authTokens as never);
    const firstSocket = socketFixture();
    const secondSocket = socketFixture();
    await service.authenticate(firstSocket as never);
    await service.authenticate(secondSocket as never);

    service.disconnectAdminUser('admin-user-1');

    expect(firstSocket.disconnect).toHaveBeenCalledWith(true);
    expect(secondSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('fans out a local revocation and applies revocations published by another instance', async () => {
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    let receiveRevocation: ((event: { id: string; scope: 'session' | 'user' }) => void) | undefined;
    const redisState = {
      publishAdminSocketRevocation: vi.fn().mockResolvedValue(1),
      subscribeAdminSocketRevocations: vi.fn().mockImplementation(async (listener) => {
        receiveRevocation = listener;
        return vi.fn();
      }),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);
    await service.onModuleInit();
    const localSocket = socketFixture();
    const remoteSocket = socketFixture();
    await service.authenticate(localSocket as never);
    await service.authenticate(remoteSocket as never);

    service.disconnectAdminSession('admin-session-1');
    expect(redisState.publishAdminSocketRevocation).toHaveBeenCalledWith({
      id: 'admin-session-1',
      scope: 'session',
    });
    expect(localSocket.disconnect).toHaveBeenCalledWith(true);

    await service.authenticate(remoteSocket as never);
    receiveRevocation?.({ id: 'admin-user-1', scope: 'user' });
    expect(remoteSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects mobile sockets locally and across instances when their token family is revoked', async () => {
    const user = mobileNestUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    let receiveRevocation:
      | ((event: { id: string; scope: 'mobile-family' | 'session' | 'user' }) => void)
      | undefined;
    const redisState = {
      publishAdminSocketRevocation: vi.fn().mockResolvedValue(1),
      subscribeAdminSocketRevocations: vi.fn().mockImplementation(async (listener) => {
        receiveRevocation = listener;
        return vi.fn();
      }),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);
    await service.onModuleInit();
    const localSocket = socketFixture();
    const remoteSocket = socketFixture();
    await service.authenticate(localSocket as never);

    service.disconnectMobileFamily('mobile-family-1');
    expect(redisState.publishAdminSocketRevocation).toHaveBeenCalledWith({
      id: 'mobile-family-1',
      scope: 'mobile-family',
    });
    expect(localSocket.disconnect).toHaveBeenCalledWith(true);

    await service.authenticate(remoteSocket as never);
    receiveRevocation?.({ id: 'mobile-family-1', scope: 'mobile-family' });
    expect(remoteSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('retries the cross-instance revocation subscription after a transient failure', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const authTokens = { authenticateSocketToken: vi.fn() };
    const unsubscribe = vi.fn();
    const redisState = {
      subscribeAdminSocketRevocations: vi
        .fn()
        .mockRejectedValueOnce(new Error('redis://operator:private-secret@internal:6379'))
        .mockResolvedValueOnce(unsubscribe),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);

    await service.onModuleInit();
    expect(redisState.subscribeAdminSocketRevocations).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Admin socket revocation fan-out unavailable');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-secret');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(redisState.subscribeAdminSocketRevocations).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('fails closed for new Admin sockets while revocation fan-out is unavailable', async () => {
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    const redisState = {
      subscribeAdminSocketRevocations: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);
    await service.onModuleInit();

    await expect(service.authenticate(socketFixture() as never)).rejects.toThrow(
      'Admin realtime revocation checks are unavailable',
    );
  });

  it('disconnects active Admin sockets when the revocation subscription is lost', async () => {
    vi.useFakeTimers();
    const user = adminRealtimeUser();
    const authTokens = { authenticateSocketToken: vi.fn().mockResolvedValue(user) };
    let notifyUnavailable: (() => void) | undefined;
    const unsubscribe = vi.fn();
    const redisState = {
      subscribeAdminSocketRevocations: vi.fn().mockImplementation(async (_listener, onUnavailable) => {
        notifyUnavailable = onUnavailable;
        return unsubscribe;
      }),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);
    await service.onModuleInit();
    const socket = socketFixture();
    await service.authenticate(socket as never);

    notifyUnavailable?.();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    await expect(service.authenticate(socketFixture() as never)).rejects.toThrow(
      'Admin realtime revocation checks are unavailable',
    );
  });

  it('cancels a pending revocation subscription retry during shutdown', async () => {
    vi.useFakeTimers();
    const authTokens = { authenticateSocketToken: vi.fn() };
    const redisState = {
      subscribeAdminSocketRevocations: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    };
    const service = new SocketAuthService(authTokens as never, redisState as never);

    await service.onModuleInit();
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(redisState.subscribeAdminSocketRevocations).toHaveBeenCalledTimes(1);
  });
});

function adminRealtimeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'admin-user-1',
    activeRole: Role.ADMIN,
    roles: [Role.ADMIN],
    authProvider: 'admin-realtime' as const,
    sessionId: 'admin-session-1',
    adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
    adminPermissionVersion: 1,
    tokenExpiresAt: Date.now() + 120_000,
    ...overrides,
  };
}

function mobileNestUser() {
  return {
    id: 'customer-user-1',
    activeRole: Role.CUSTOMER,
    roles: [Role.CUSTOMER],
    authProvider: 'nest' as const,
    sessionFamilyId: 'mobile-family-1',
    tokenExpiresAt: Date.now() + 120_000,
  };
}

function socketFixture() {
  return {
    data: {},
    handshake: { auth: { token: 'signed-socket-token' }, headers: {} },
    disconnect: vi.fn(),
    once: vi.fn(),
  };
}
