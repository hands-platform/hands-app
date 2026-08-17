import { Optional } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AdminOperatorPermissionCategory, BookingStatus, Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { adminOperatorHasRequiredCategory } from '../admin/admin-operator-category.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SocketAuthService } from '../auth/socket-auth.service';
import { assertProviderCanViewOpenBookingMarketplace } from '../bookings/bookings.provider-readiness';
import { SOCKET_ROOMS } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { corsOriginFromEnv } from '../security/cors-origin';
import { socketEventAllowed } from '../security/socket-rate-limit';

const MAX_SOCKET_RESOURCE_ID_LENGTH = 128;

@WebSocketGateway({ cors: { origin: corsOriginFromEnv(), credentials: true } })
export class MatchingGateway implements OnGatewayConnection {
  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly prisma: PrismaService,
    @Optional() private readonly redisState?: RedisStateService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const user = await this.socketAuth.authenticate(client);
      await client.join(SOCKET_ROOMS.user(user.id));
      if (
        user.roles.includes(Role.ADMIN) &&
        adminOperatorHasRequiredCategory(
          user.adminPermissionCategories ?? [],
          AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
        )
      ) {
        await client.join(SOCKET_ROOMS.adminBookings());
      }
      if (user.roles.includes(Role.PROVIDER)) {
        if (await this.canReceiveProviderSignals(user.id)) {
          await client.join(SOCKET_ROOMS.providers());
        }
      }
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('booking.join_room')
  async joinBookingRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const user = await this.socketAuth.requireCurrentUser(client);
    if (!(await socketEventAllowed(this.redisState, user.id, 'booking.join_room', 60))) {
      return { ok: false, error: 'BOOKING_RATE_LIMITED' };
    }
    const bookingId = socketBookingId(payload);
    if (!bookingId) {
      return { ok: false, error: 'BOOKING_INVALID_PAYLOAD' };
    }
    const allowed = await this.canAccessBookingRoom(bookingId, user);
    if (!allowed) {
      if (user.roles.includes(Role.ADMIN)) {
        await this.socketAuth.recordAdminAuthorizationDenial(
          user,
          `booking:${bookingId}`,
          'BOOKING_ROOM_FORBIDDEN',
        );
      }
      return { ok: false, error: 'BOOKING_ROOM_FORBIDDEN' };
    }

    try {
      await client.join(SOCKET_ROOMS.booking(bookingId));
      return { ok: true };
    } catch {
      return { ok: false, error: 'BOOKING_ROOM_JOIN_FAILED' };
    }
  }

  async emitProviderJoined(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'provider.joined', payload);
  }

  async emitProviderAccepted(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'provider.accepted', payload);
  }

  async emitProviderRejected(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'provider.rejected', payload);
  }

  async emitProviderArrived(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'provider.arrived', payload);
  }

  async emitBookingOpened(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
    await this.emitProviderSignal(
      'booking.opened',
      providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING'),
    );
  }

  async emitDirectBookingRequested(userId: string, bookingId: string, payload: unknown) {
    this.server
      .to(SOCKET_ROOMS.user(userId))
      .emit('booking.opened', providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING'));
    await this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
  }

  async emitBackupBookingAvailable(userIds: string[], bookingId: string, payload: unknown) {
    const signal = providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING');
    for (const userId of userIds) {
      this.server.to(SOCKET_ROOMS.user(userId)).emit('booking.opened', signal);
    }
    await this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
  }

  async emitBookingMatched(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'booking.matched', payload);
    await this.emitProviderSignal(
      'booking.matched',
      providerBookingSignal(bookingId, 'booking.matched', bookingStatusFromPayload(payload, 'MATCHED')),
    );
  }

  async emitBookingExpired(bookingId: string, payload: unknown) {
    const status = bookingStatusFromPayload(payload, 'EXPIRED');
    const event = status === BookingStatus.CANCELLED ? 'booking.cancelled' : 'booking.expired';
    await this.emitBookingMonitorEvent(bookingId, event, payload);
    await this.emitProviderSignal(
      event,
      providerBookingSignal(bookingId, event, status),
    );
  }

  async emitServiceCompleted(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'service.completed', payload);
  }

  async emitServiceStarted(bookingId: string, payload: unknown) {
    await this.emitBookingMonitorEvent(bookingId, 'service.started', payload);
  }

  private async emitBookingMonitorEvent(bookingId: string, eventName: string, payload: unknown) {
    const room = SOCKET_ROOMS.booking(bookingId);
    const clients = await this.server.in(room).fetchSockets();
    for (const client of clients) {
      const user = client.data.user as AuthenticatedUser | undefined;
      if (!user || !(await this.canAccessBookingRoom(bookingId, user))) {
        await client.leave(room);
      }
    }
    this.server.to(room).emit(eventName, payload);
    this.server.to(SOCKET_ROOMS.adminBookings()).emit(eventName, payload);
  }

  private async emitProviderSignal(eventName: string, payload: unknown) {
    const room = SOCKET_ROOMS.providers();
    const clients = await this.server.in(room).fetchSockets();
    const providerUserIds = Array.from(
      new Set(
        clients
          .map((client) => client.data.user as AuthenticatedUser | undefined)
          .filter((user): user is AuthenticatedUser => Boolean(user?.roles.includes(Role.PROVIDER)))
          .map((user) => user.id),
      ),
    );
    const eligibleUserIds = await this.marketplaceSignalProviderUserIds(providerUserIds);
    for (const client of clients) {
      const user = client.data.user as AuthenticatedUser | undefined;
      if (!user || !eligibleUserIds.has(user.id)) {
        await client.leave(room);
      }
    }
    this.server.to(room).emit(eventName, payload);
  }

  private async canReceiveProviderSignals(userId: string) {
    const eligible = await this.marketplaceSignalProviderUserIds([userId]);
    return eligible.has(userId);
  }

  private async marketplaceSignalProviderUserIds(userIds: string[]) {
    if (userIds.length === 0) return new Set<string>();
    const providers = await this.prisma.providerProfile.findMany({
      where: { userId: { in: userIds } },
      include: {
        verification: true,
        kyc: true,
        documents: { where: { deletedAt: null } },
      },
    });
    const eligible = new Set<string>();
    for (const provider of providers) {
      try {
        assertProviderCanViewOpenBookingMarketplace(provider);
        eligible.add(provider.userId);
      } catch {
        // Ineligible Partners keep their personal room but lose marketplace signals.
      }
    }
    return eligible;
  }

  private async canAccessBookingRoom(bookingId: string, user: AuthenticatedUser) {
    if (user.roles.includes(Role.ADMIN)) {
      return adminOperatorHasRequiredCategory(
        user.adminPermissionCategories ?? [],
        AdminOperatorPermissionCategory.BOOKINGS_DETAIL,
      );
    }

    if (user.roles.includes(Role.CUSTOMER)) {
      if (await this.canCustomerAccessBookingRoom(bookingId, user.id)) {
        return true;
      }
    }

    if (user.roles.includes(Role.PROVIDER)) {
      return this.canProviderAccessBookingRoom(bookingId, user.id);
    }

    return false;
  }

  private async canCustomerAccessBookingRoom(bookingId: string, userId: string) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!customer) {
      return false;
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerProfileId: customer.id },
      select: { id: true },
    });
    return Boolean(booking);
  }

  private async canProviderAccessBookingRoom(bookingId: string, userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      return false;
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { selectedProviderId: provider.id },
          {
            status: BookingStatus.OPEN_MATCHING,
            OR: [
              { preferredProviderId: provider.id },
              { participants: { some: { providerProfileId: provider.id } } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(booking);
  }
}

function providerBookingSignal(bookingId: string, event: string, status: string) {
  return { bookingId, event, status };
}

function socketBookingId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).bookingId;
  if (typeof value !== 'string') return null;
  const bookingId = value.trim();
  return bookingId.length > 0 && bookingId.length <= MAX_SOCKET_RESOURCE_ID_LENGTH
    ? bookingId
    : null;
}

function bookingStatusFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  if ('status' in payload && typeof payload.status === 'string') return payload.status;
  if ('booking' in payload && payload.booking && typeof payload.booking === 'object') {
    const booking = payload.booking;
    if ('status' in booking && typeof booking.status === 'string') return booking.status;
  }
  return fallback;
}
