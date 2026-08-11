import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { SOCKET_ROOMS } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { corsOriginFromEnv } from '../security/cors-origin';

@WebSocketGateway({ cors: { origin: corsOriginFromEnv(), credentials: true } })
export class MatchingGateway implements OnGatewayConnection {
  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const user = await this.socketAuth.authenticate(client);
      await client.join(SOCKET_ROOMS.user(user.id));
      if (user.roles.includes(Role.ADMIN)) {
        await client.join(SOCKET_ROOMS.adminBookings());
      }
      if (user.roles.includes(Role.PROVIDER)) {
        await client.join(SOCKET_ROOMS.providers());
      }
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('booking.join_room')
  async joinBookingRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { bookingId: string }) {
    const user = this.socketAuth.requireUser(client);
    const allowed = await this.canAccessBookingRoom(payload.bookingId, user.id, user.roles);
    if (!allowed) {
      return { ok: false, error: 'BOOKING_ROOM_FORBIDDEN' };
    }

    void client.join(SOCKET_ROOMS.booking(payload.bookingId));
    return { ok: true };
  }

  emitProviderJoined(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'provider.joined', payload);
  }

  emitProviderAccepted(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'provider.accepted', payload);
  }

  emitProviderRejected(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'provider.rejected', payload);
  }

  emitProviderArrived(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'provider.arrived', payload);
  }

  emitBookingOpened(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
    this.server
      .to(SOCKET_ROOMS.providers())
      .emit('booking.opened', providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING'));
  }

  emitDirectBookingRequested(userId: string, bookingId: string, payload: unknown) {
    this.server
      .to(SOCKET_ROOMS.user(userId))
      .emit('booking.opened', providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING'));
    this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
  }

  emitBackupBookingAvailable(userIds: string[], bookingId: string, payload: unknown) {
    const signal = providerBookingSignal(bookingId, 'booking.opened', 'OPEN_MATCHING');
    for (const userId of userIds) {
      this.server.to(SOCKET_ROOMS.user(userId)).emit('booking.opened', signal);
    }
    this.emitBookingMonitorEvent(bookingId, 'booking.opened', payload);
  }

  emitBookingMatched(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'booking.matched', payload);
    this.server
      .to(SOCKET_ROOMS.providers())
      .emit('booking.matched', providerBookingSignal(bookingId, 'booking.matched', 'MATCHED'));
  }

  emitBookingExpired(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'booking.expired', payload);
    this.server
      .to(SOCKET_ROOMS.providers())
      .emit('booking.expired', providerBookingSignal(bookingId, 'booking.expired', 'EXPIRED'));
  }

  emitServiceCompleted(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'service.completed', payload);
  }

  emitServiceStarted(bookingId: string, payload: unknown) {
    this.emitBookingMonitorEvent(bookingId, 'service.started', payload);
  }

  private emitBookingMonitorEvent(bookingId: string, eventName: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit(eventName, payload);
    this.server.to(SOCKET_ROOMS.adminBookings()).emit(eventName, payload);
  }

  private async canAccessBookingRoom(bookingId: string, userId: string, roles: Role[]) {
    if (roles.includes(Role.ADMIN)) {
      return true;
    }

    if (roles.includes(Role.CUSTOMER)) {
      if (await this.canCustomerAccessBookingRoom(bookingId, userId)) {
        return true;
      }
    }

    if (roles.includes(Role.PROVIDER)) {
      return this.canProviderAccessBookingRoom(bookingId, userId);
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
          { preferredProviderId: provider.id },
          { selectedProviderId: provider.id },
          { participants: { some: { providerProfileId: provider.id } } },
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
