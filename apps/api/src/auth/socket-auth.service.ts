import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSocketRevocation, RedisStateService } from '../redis/redis-state.service';
import { AuthenticatedUser } from './auth.types';
import { AuthTokenService } from './auth-token.service';

export type AuthenticatedSocket = Socket & {
  data: {
    accessToken?: string;
    authExpiryTimer?: NodeJS.Timeout;
    authRevalidationTimer?: NodeJS.Timeout;
    user?: AuthenticatedUser;
  };
};

const ADMIN_SOCKET_REVALIDATION_MS = 5_000;
const ADMIN_SOCKET_REVOCATION_SUBSCRIBE_RETRY_MS = 5_000;

@Injectable()
export class SocketAuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocketAuthService.name);
  private readonly adminSocketsBySession = new Map<string, Set<AuthenticatedSocket>>();
  private readonly adminSocketsByUser = new Map<string, Set<AuthenticatedSocket>>();
  private readonly mobileSocketsByFamily = new Map<string, Set<AuthenticatedSocket>>();
  private readonly handleAdminSocketRevocation = (event: AdminSocketRevocation) =>
    this.applyAdminSocketRevocation(event);
  private readonly handleAdminSocketRevocationUnavailable = () =>
    this.handleRevocationSubscriptionUnavailable();
  private adminSocketRevocationSubscribeRetry?: NodeJS.Timeout;
  private adminSocketRevocationSubscriptionReady = false;
  private destroyed = false;
  private unsubscribeAdminSocketRevocations?: () => boolean;

  constructor(
    private readonly authTokens: AuthTokenService,
    @Optional() private readonly redisState?: RedisStateService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async onModuleInit() {
    await this.subscribeToAdminSocketRevocations();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.adminSocketRevocationSubscribeRetry) {
      clearTimeout(this.adminSocketRevocationSubscribeRetry);
      this.adminSocketRevocationSubscribeRetry = undefined;
    }
    this.unsubscribeAdminSocketRevocations?.();
    this.unsubscribeAdminSocketRevocations = undefined;
    this.adminSocketRevocationSubscriptionReady = false;
  }

  private async subscribeToAdminSocketRevocations() {
    if (!this.redisState || this.destroyed || this.unsubscribeAdminSocketRevocations) return;
    try {
      this.unsubscribeAdminSocketRevocations = await this.redisState.subscribeAdminSocketRevocations(
        this.handleAdminSocketRevocation,
        this.handleAdminSocketRevocationUnavailable,
      );
      this.adminSocketRevocationSubscriptionReady = true;
    } catch {
      this.adminSocketRevocationSubscriptionReady = false;
      this.logger.warn('Admin socket revocation fan-out unavailable');
      this.scheduleAdminSocketRevocationSubscriptionRetry();
    }
  }

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = extractSocketToken(client);
    if (!token) {
      throw new UnauthorizedException('Socket bearer token is required');
    }

    const user = await this.authTokens.authenticateSocketToken(token);
    if (this.requiresRevocationSubscription(user) && !this.adminSocketRevocationSubscriptionReady) {
      throw new UnauthorizedException(this.revocationUnavailableMessage(user));
    }
    const socket = client as AuthenticatedSocket;
    socket.data.accessToken = token;
    socket.data.user = user;
    this.scheduleAuthenticationChecks(socket, user);
    return user;
  }

  requireUser(client: Socket): AuthenticatedUser {
    const user = (client as AuthenticatedSocket).data.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated socket user is required');
    }
    return user;
  }

  async requireCurrentUser(client: Socket): Promise<AuthenticatedUser> {
    const socket = client as AuthenticatedSocket;
    const token = socket.data.accessToken;
    if (!token) {
      throw new UnauthorizedException('Authenticated socket token is required');
    }
    try {
      if (
        socket.data.user &&
        this.requiresRevocationSubscription(socket.data.user) &&
        !this.adminSocketRevocationSubscriptionReady
      ) {
        throw new UnauthorizedException(this.revocationUnavailableMessage(socket.data.user));
      }
      const currentUser = await this.authTokens.authenticateSocketToken(token);
      if (
        socket.data.user?.authProvider === 'admin-realtime' &&
        socket.data.user.adminPermissionVersion !== currentUser.adminPermissionVersion
      ) {
        throw new UnauthorizedException('Admin socket permissions changed');
      }
      socket.data.user = currentUser;
      return currentUser;
    } catch (error) {
      client.disconnect(true);
      throw error;
    }
  }

  async recordAdminAuthorizationDenial(
    user: AuthenticatedUser,
    target: string,
    reason: string,
  ) {
    if (!this.prisma || !user.roles.includes(Role.ADMIN)) return;
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: 'admin_operator.realtime.authorization_denied',
          target,
          metadata: {
            reason,
            sessionId: user.sessionId ?? null,
          },
        },
      });
    } catch {
      this.logger.warn('Could not record Admin realtime authorization denial');
    }
  }

  disconnectAdminSession(sessionId: string) {
    this.disconnectAdminSessionLocally(sessionId);
    void this.redisState?.publishAdminSocketRevocation({ id: sessionId, scope: 'session' }).catch(() => {
      this.logger.warn('Admin session socket revocation publish failed');
    });
  }

  disconnectAdminUser(userId: string) {
    this.disconnectAdminUserLocally(userId);
    void this.redisState?.publishAdminSocketRevocation({ id: userId, scope: 'user' }).catch(() => {
      this.logger.warn('Admin user socket revocation publish failed');
    });
  }

  disconnectMobileFamily(familyId: string) {
    this.disconnectMobileFamilyLocally(familyId);
    void this.redisState?.publishAdminSocketRevocation({ id: familyId, scope: 'mobile-family' }).catch(() => {
      this.logger.warn('Mobile family socket revocation publish failed');
    });
  }

  private scheduleAuthenticationChecks(socket: AuthenticatedSocket, user: AuthenticatedUser) {
    this.clearAuthenticationChecks(socket);
    if (user.tokenExpiresAt) {
      const expiresInMs = Math.max(0, user.tokenExpiresAt - Date.now());
      socket.data.authExpiryTimer = setTimeout(() => socket.disconnect(true), expiresInMs);
    }
    if (user.authProvider === 'admin-realtime') {
      this.registerAdminSocket(socket, user);
      socket.data.authRevalidationTimer = setInterval(() => {
        void this.requireCurrentUser(socket).catch(() => undefined);
      }, ADMIN_SOCKET_REVALIDATION_MS);
    } else if (user.authProvider === 'nest' && user.sessionFamilyId) {
      this.addSocket(this.mobileSocketsByFamily, user.sessionFamilyId, socket);
    }
    socket.once('disconnect', () => this.clearAuthenticationChecks(socket));
  }

  private clearAuthenticationChecks(socket: AuthenticatedSocket) {
    if (socket.data.authExpiryTimer) clearTimeout(socket.data.authExpiryTimer);
    if (socket.data.authRevalidationTimer) clearInterval(socket.data.authRevalidationTimer);
    socket.data.authExpiryTimer = undefined;
    socket.data.authRevalidationTimer = undefined;
    this.unregisterAdminSocket(socket);
    this.unregisterMobileSocket(socket);
  }

  private registerAdminSocket(socket: AuthenticatedSocket, user: AuthenticatedUser) {
    this.addSocket(this.adminSocketsByUser, user.id, socket);
    if (user.sessionId) {
      this.addSocket(this.adminSocketsBySession, user.sessionId, socket);
    }
  }

  private unregisterAdminSocket(socket: AuthenticatedSocket) {
    const user = socket.data.user;
    if (!user) return;
    this.removeSocket(this.adminSocketsByUser, user.id, socket);
    if (user.sessionId) {
      this.removeSocket(this.adminSocketsBySession, user.sessionId, socket);
    }
  }

  private unregisterMobileSocket(socket: AuthenticatedSocket) {
    const familyId = socket.data.user?.sessionFamilyId;
    if (familyId) this.removeSocket(this.mobileSocketsByFamily, familyId, socket);
  }

  private addSocket(
    registry: Map<string, Set<AuthenticatedSocket>>,
    key: string,
    socket: AuthenticatedSocket,
  ) {
    const sockets = registry.get(key) ?? new Set<AuthenticatedSocket>();
    sockets.add(socket);
    registry.set(key, sockets);
  }

  private removeSocket(
    registry: Map<string, Set<AuthenticatedSocket>>,
    key: string,
    socket: AuthenticatedSocket,
  ) {
    const sockets = registry.get(key);
    sockets?.delete(socket);
    if (sockets?.size === 0) registry.delete(key);
  }

  private disconnectSockets(sockets: Set<AuthenticatedSocket> | undefined) {
    for (const socket of [...(sockets ?? [])]) {
      this.clearAuthenticationChecks(socket);
      socket.disconnect(true);
    }
  }

  private applyAdminSocketRevocation(event: AdminSocketRevocation) {
    if (event.scope === 'session') this.disconnectAdminSessionLocally(event.id);
    else if (event.scope === 'user') this.disconnectAdminUserLocally(event.id);
    else this.disconnectMobileFamilyLocally(event.id);
  }

  private handleRevocationSubscriptionUnavailable() {
    if (this.destroyed) return;
    this.adminSocketRevocationSubscriptionReady = false;
    this.unsubscribeAdminSocketRevocations?.();
    this.unsubscribeAdminSocketRevocations = undefined;
    this.disconnectAllTrackedSockets();
    this.scheduleAdminSocketRevocationSubscriptionRetry();
  }

  private scheduleAdminSocketRevocationSubscriptionRetry() {
    if (this.destroyed || this.adminSocketRevocationSubscribeRetry) return;
    this.adminSocketRevocationSubscribeRetry = setTimeout(() => {
      this.adminSocketRevocationSubscribeRetry = undefined;
      void this.subscribeToAdminSocketRevocations();
    }, ADMIN_SOCKET_REVOCATION_SUBSCRIBE_RETRY_MS);
  }

  private disconnectAllTrackedSockets() {
    const sockets = new Set<AuthenticatedSocket>();
    for (const registered of this.adminSocketsByUser.values()) {
      for (const socket of registered) sockets.add(socket);
    }
    for (const registered of this.mobileSocketsByFamily.values()) {
      for (const socket of registered) sockets.add(socket);
    }
    this.disconnectSockets(sockets);
  }

  private disconnectAdminSessionLocally(sessionId: string) {
    this.disconnectSockets(this.adminSocketsBySession.get(sessionId));
  }

  private disconnectAdminUserLocally(userId: string) {
    this.disconnectSockets(this.adminSocketsByUser.get(userId));
  }

  private disconnectMobileFamilyLocally(familyId: string) {
    this.disconnectSockets(this.mobileSocketsByFamily.get(familyId));
  }

  private requiresRevocationSubscription(user: AuthenticatedUser) {
    return Boolean(
      this.redisState &&
      (user.authProvider === 'admin-realtime' ||
        (user.authProvider === 'nest' && user.sessionFamilyId)),
    );
  }

  private revocationUnavailableMessage(user: AuthenticatedUser) {
    return user.authProvider === 'admin-realtime'
      ? 'Admin realtime revocation checks are unavailable'
      : 'Mobile session revocation checks are unavailable';
  }
}

function extractSocketToken(client: Socket) {
  const authToken = client.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return stripBearer(authToken);
  }

  const header = client.handshake.headers.authorization;
  if (typeof header === 'string') {
    return stripBearer(header);
  }

  return undefined;
}

function stripBearer(value: string) {
  const [scheme, token] = value.split(' ');
  return scheme === 'Bearer' ? token : value;
}
