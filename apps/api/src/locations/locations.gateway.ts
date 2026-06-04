import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { SOCKET_ROOMS } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { corsOriginFromEnv } from '../security/cors-origin';

@WebSocketGateway({ cors: { origin: corsOriginFromEnv(), credentials: true } })
export class LocationsGateway implements OnGatewayConnection {
  constructor(
    private readonly redisState: RedisStateService,
    private readonly socketAuth: SocketAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const user = await this.socketAuth.authenticate(client);
      await client.join(SOCKET_ROOMS.user(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('provider.location.update')
  async updateProviderLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookingId?: string; lat: number; lng: number },
  ) {
    const user = this.socketAuth.requireUser(client);
    if (!user.roles.includes(Role.PROVIDER)) {
      return { ok: false, error: 'PROVIDER_ROLE_REQUIRED' };
    }

    const provider = await this.prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!provider) {
      return { ok: false, error: 'PROVIDER_PROFILE_NOT_FOUND' };
    }

    await this.redisState.setProviderLocation(provider.id, { lat: payload.lat, lng: payload.lng });

    if (payload.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: payload.bookingId, selectedProviderId: provider.id },
        select: { id: true },
      });
      if (!booking) {
        return { ok: false, error: 'BOOKING_LOCATION_FORBIDDEN' };
      }
      this.server.to(SOCKET_ROOMS.booking(payload.bookingId)).emit('provider.location.updated', {
        bookingId: payload.bookingId,
        providerProfileId: provider.id,
        lat: payload.lat,
        lng: payload.lng,
        recordedAt: new Date().toISOString(),
      });
    }
    return { ok: true };
  }
}
