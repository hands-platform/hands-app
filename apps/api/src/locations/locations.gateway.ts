import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BookingStatus, Role } from '@prisma/client';
import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { SOCKET_ROOMS } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { corsOriginFromEnv } from '../security/cors-origin';
import { socketEventAllowed } from '../security/socket-rate-limit';
import {
  isVietnamServiceAreaCoordinate,
  providerLocationUpdateDecision,
} from './location-update-policy';

const ACTIVE_BOOKING_LOCATION_STATUSES = new Set<BookingStatus>([
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
]);
const MAX_SOCKET_RESOURCE_ID_LENGTH = 128;

type ParsedProviderLocationPayload =
  | { ok: true; bookingId?: string; lat: number; lng: number }
  | { ok: false; error: 'INVALID_LOCATION_PAYLOAD' | 'LOCATION_OUTSIDE_SERVICE_AREA' };

function parseProviderLocationPayload(payload: {
  bookingId?: unknown;
  lat?: unknown;
  lng?: unknown;
}): ParsedProviderLocationPayload {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'INVALID_LOCATION_PAYLOAD' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: 'INVALID_LOCATION_PAYLOAD' };
  }
  if (!isVietnamServiceAreaCoordinate(lat, lng)) {
    return { ok: false, error: 'LOCATION_OUTSIDE_SERVICE_AREA' };
  }
  if (payload.bookingId !== undefined && typeof payload.bookingId !== 'string') {
    return { ok: false, error: 'INVALID_LOCATION_PAYLOAD' };
  }

  const bookingId = payload.bookingId?.trim();
  if (
    payload.bookingId !== undefined &&
    (!bookingId || bookingId.length > MAX_SOCKET_RESOURCE_ID_LENGTH)
  ) {
    return { ok: false, error: 'INVALID_LOCATION_PAYLOAD' };
  }

  return { ok: true, bookingId, lat, lng };
}

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
    const user = await this.socketAuth.requireCurrentUser(client);
    if (!user.roles.includes(Role.PROVIDER)) {
      return { ok: false, error: 'PROVIDER_ROLE_REQUIRED' };
    }
    if (!(await socketEventAllowed(this.redisState, user.id, 'provider.location.update', 120))) {
      return { ok: false, error: 'LOCATION_RATE_LIMITED' };
    }

    const parsedPayload = parseProviderLocationPayload(payload);
    if (!parsedPayload.ok) {
      return parsedPayload;
    }

    const provider = await this.prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!provider) {
      return { ok: false, error: 'PROVIDER_PROFILE_NOT_FOUND' };
    }

    let hasActiveBookingContext = false;
    let bookingRecipientUserIds: string[] = [];
    if (parsedPayload.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: parsedPayload.bookingId, selectedProviderId: provider.id },
        select: {
          id: true,
          status: true,
          customerProfile: { select: { userId: true } },
          selectedProvider: { select: { userId: true } },
        },
      });
      if (!booking) {
        return { ok: false, error: 'BOOKING_LOCATION_FORBIDDEN' };
      }
      if (!ACTIVE_BOOKING_LOCATION_STATUSES.has(booking.status)) {
        return { ok: false, error: 'BOOKING_LOCATION_INACTIVE' };
      }
      hasActiveBookingContext = true;
      bookingRecipientUserIds = Array.from(
        new Set([booking.customerProfile.userId, booking.selectedProvider?.userId].filter(Boolean)),
      ) as string[];
    }

    const recordedAt = new Date().toISOString();
    const previousLocation = await this.redisState.getProviderLocation(provider.id);
    const decision = providerLocationUpdateDecision({
      previous: previousLocation,
      next: { lat: parsedPayload.lat, lng: parsedPayload.lng },
      now: new Date(recordedAt),
      hasActiveBookingContext,
    });
    const relaysPersistedBookingLocation =
      !decision.allowed &&
      decision.reason === 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE' &&
      hasActiveBookingContext &&
      sameCoordinates(previousLocation, parsedPayload);
    if (!decision.allowed && !relaysPersistedBookingLocation) {
      return { ok: false, error: decision.reason };
    }

    if (decision.allowed) {
      await this.redisState.setProviderLocation(provider.id, {
        lat: parsedPayload.lat,
        lng: parsedPayload.lng,
        recordedAt,
      });
    }

    if (parsedPayload.bookingId) {
      const locationEvent = {
        bookingId: parsedPayload.bookingId,
        providerProfileId: provider.id,
        lat: parsedPayload.lat,
        lng: parsedPayload.lng,
        recordedAt,
      };
      for (const recipientUserId of bookingRecipientUserIds) {
        this.server.to(SOCKET_ROOMS.user(recipientUserId)).emit('provider.location.updated', locationEvent);
      }
    }
    return { ok: true };
  }
}

function sameCoordinates(
  previous: { lat: number; lng: number } | null | undefined,
  next: { lat: number; lng: number },
) {
  if (!previous) {
    return false;
  }
  return Math.abs(previous.lat - next.lat) < 0.0000001 && Math.abs(previous.lng - next.lng) < 0.0000001;
}
