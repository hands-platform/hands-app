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

@WebSocketGateway({ cors: { origin: true, credentials: true } })
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
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('provider.joined', payload);
  }

  emitProviderAccepted(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('provider.accepted', payload);
  }

  emitBookingOpened(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('booking.opened', payload);
    this.server.to(SOCKET_ROOMS.providers()).emit('booking.opened', payload);
  }

  emitDirectBookingRequested(userId: string, bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.user(userId)).emit('booking.opened', payload);
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('booking.opened', payload);
  }

  emitBackupBookingAvailable(userIds: string[], bookingId: string, payload: unknown) {
    for (const userId of userIds) {
      this.server.to(SOCKET_ROOMS.user(userId)).emit('booking.opened', payload);
    }
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('booking.opened', payload);
  }

  emitBookingMatched(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('booking.matched', payload);
  }

  emitBookingExpired(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('booking.expired', payload);
  }

  emitServiceCompleted(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('service.completed', payload);
  }

  emitServiceStarted(bookingId: string, payload: unknown) {
    this.server.to(SOCKET_ROOMS.booking(bookingId)).emit('service.started', payload);
  }

  private async canAccessBookingRoom(bookingId: string, userId: string, roles: Role[]) {
    if (roles.includes(Role.ADMIN)) {
      return true;
    }

    if (roles.includes(Role.CUSTOMER)) {
      const customer = await this.prisma.customerProfile.findUnique({ where: { userId } });
      if (customer) {
        const booking = await this.prisma.booking.findFirst({
          where: { id: bookingId, customerProfileId: customer.id },
          select: { id: true },
        });
        if (booking) {
          return true;
        }
      }
    }

    if (roles.includes(Role.PROVIDER)) {
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

    return false;
  }
}
