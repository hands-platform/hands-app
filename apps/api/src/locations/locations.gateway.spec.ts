import { BookingStatus, Role } from '@prisma/client';

import { SOCKET_ROOMS } from '../common/domain';
import { LocationsGateway } from './locations.gateway';

describe('LocationsGateway provider location updates', () => {
  function createGateway() {
    const redisState = {
      getProviderLocation: vi.fn().mockResolvedValue(null),
      setProviderLocation: vi.fn().mockResolvedValue(undefined),
    };
    const socketAuth = {
      requireCurrentUser: vi.fn().mockResolvedValue({ id: 'provider-user-1', roles: [Role.PROVIDER] }),
      authenticate: vi.fn(),
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_SERVICE,
          customerProfile: { userId: 'customer-user-1' },
          selectedProvider: { userId: 'provider-user-1' },
        }),
      },
    };
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const gateway = new LocationsGateway(redisState as never, socketAuth as never, prisma as never);
    gateway.server = { to } as never;

    return { gateway, redisState, socketAuth, prisma, emit, to };
  }

  it('rejects invalid coordinates before writing provider location state', async () => {
    const { gateway, redisState, prisma } = createGateway();

    const result = await gateway.updateProviderLocation({} as never, {
      lat: Number.NaN,
      lng: 106.7009,
    });

    expect(result).toEqual({ ok: false, error: 'INVALID_LOCATION_PAYLOAD' });
    expect(prisma.providerProfile.findUnique).not.toHaveBeenCalled();
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
  });

  it('rejects an oversized booking id before querying provider or booking records', async () => {
    const { gateway, redisState, prisma } = createGateway();

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'b'.repeat(129),
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(result).toEqual({ ok: false, error: 'INVALID_LOCATION_PAYLOAD' });
    expect(prisma.providerProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
  });

  it('rejects provider location updates outside the Vietnam service area', async () => {
    const { gateway, redisState, prisma } = createGateway();

    const result = await gateway.updateProviderLocation({} as never, {
      lat: 37.5665,
      lng: 126.978,
    });

    expect(result).toEqual({ ok: false, error: 'LOCATION_OUTSIDE_SERVICE_AREA' });
    expect(prisma.providerProfile.findUnique).not.toHaveBeenCalled();
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
  });

  it('does not write provider location state for forbidden booking-specific updates', async () => {
    const { gateway, redisState, prisma, emit } = createGateway();
    prisma.booking.findFirst.mockResolvedValue(null);

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'booking-for-another-provider',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(result).toEqual({ ok: false, error: 'BOOKING_LOCATION_FORBIDDEN' });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: 'booking-for-another-provider', selectedProviderId: 'provider-profile-1' },
      select: {
        id: true,
        status: true,
        customerProfile: { select: { userId: true } },
        selectedProvider: { select: { userId: true } },
      },
    });
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not write idle provider location updates that are too frequent and nearby', async () => {
    const { gateway, redisState, emit } = createGateway();
    redisState.getProviderLocation.mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: new Date().toISOString(),
    });

    const result = await gateway.updateProviderLocation({} as never, {
      lat: 10.7769,
      lng: 106.7109,
    });

    expect(result).toEqual({ ok: false, error: 'TOO_FREQUENT_IDLE_LOCATION_UPDATE' });
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not write active booking location updates before the active interval passes', async () => {
    const { gateway, redisState, emit } = createGateway();
    redisState.getProviderLocation.mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: new Date().toISOString(),
    });

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7409,
    });

    expect(result).toEqual({
      ok: false,
      error: 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE',
    });
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('broadcasts a recently persisted booking location without writing it twice', async () => {
    const { gateway, redisState, emit, to } = createGateway();
    redisState.getProviderLocation.mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: new Date().toISOString(),
    });

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(result).toEqual({ ok: true });
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.user('customer-user-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.user('provider-user-1'));
    expect(to).not.toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(emit).toHaveBeenCalledWith(
      'provider.location.updated',
      expect.objectContaining({
        bookingId: 'booking-1',
        providerProfileId: 'provider-profile-1',
        lat: 10.7769,
        lng: 106.7009,
      }),
    );
  });

  it('does not write booking-specific location updates after the booking is closed', async () => {
    const { gateway, redisState, prisma, emit } = createGateway();
    prisma.booking.findFirst.mockResolvedValue({ id: 'booking-1', status: BookingStatus.COMPLETED });

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(result).toEqual({ ok: false, error: 'BOOKING_LOCATION_INACTIVE' });
    expect(redisState.getProviderLocation).not.toHaveBeenCalled();
    expect(redisState.setProviderLocation).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('writes and broadcasts normalized coordinates for authorized booking updates', async () => {
    const { gateway, redisState, emit, to } = createGateway();

    const result = await gateway.updateProviderLocation({} as never, {
      bookingId: 'booking-1',
      lat: '10.7769' as never,
      lng: '106.7009' as never,
    });

    expect(result).toEqual({ ok: true });
    expect(redisState.setProviderLocation).toHaveBeenCalledWith(
      'provider-profile-1',
      expect.objectContaining({
        lat: 10.7769,
        lng: 106.7009,
      }),
    );
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.user('customer-user-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.user('provider-user-1'));
    expect(to).not.toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(emit).toHaveBeenCalledWith(
      'provider.location.updated',
      expect.objectContaining({
        bookingId: 'booking-1',
        providerProfileId: 'provider-profile-1',
        lat: 10.7769,
        lng: 106.7009,
      }),
    );
  });
});
