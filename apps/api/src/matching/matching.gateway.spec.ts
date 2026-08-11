import { Role } from '@prisma/client';
import { SOCKET_ROOMS } from '../common/domain';
import { MatchingGateway } from './matching.gateway';

describe('MatchingGateway admin booking realtime', () => {
  it('joins admin sockets to the booking monitor room', async () => {
    const gateway = new MatchingGateway(
      { authenticate: vi.fn().mockResolvedValue({ id: 'admin-user', roles: [Role.ADMIN] }) } as never,
      {} as never,
    );
    const client = { join: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.user('admin-user'));
    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
  });

  it('mirrors booking lifecycle events to the admin booking monitor room', () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const payload = { bookingId: 'booking-1' };

    gateway.emitBookingMatched('booking-1', payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
    expect(emit).toHaveBeenCalledWith('booking.matched', payload);
  });

  it('notifies the booking room when the Partner arrives', () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const payload = { id: 'booking-1', status: 'ARRIVED' };

    gateway.emitProviderArrived('booking-1', payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
    expect(emit).toHaveBeenCalledWith('provider.arrived', payload);
  });

  it.each([
    ['matched', 'booking.matched', 'MATCHED', (gateway: MatchingGateway, payload: unknown) =>
      gateway.emitBookingMatched('booking-1', payload)],
    ['expired', 'booking.expired', 'EXPIRED', (gateway: MatchingGateway, payload: unknown) =>
      gateway.emitBookingExpired('booking-1', payload)],
  ])('notifies the provider request queue when a booking is %s', (_, eventName, status, emitEvent) => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const payload = { bookingId: 'booking-1', customerPhone: 'private-phone' };

    emitEvent(gateway, payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.providers());
    expect(emit).toHaveBeenCalledWith(eventName, {
      bookingId: 'booking-1',
      event: eventName,
      status,
    });
    expect(JSON.stringify(emit.mock.calls.at(-1))).not.toContain('private-phone');
  });

  it('does not expose booking details in provider booking-opened signals', () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const payload = {
      input: {
        booking: {
          customer: { phone: '0865907184' },
          addressSnapshot: { latitude: 10.7769, longitude: 106.7009 },
        },
      },
    };

    gateway.emitBookingOpened('booking-1', payload);

    expect(emit).toHaveBeenCalledWith('booking.opened', {
      bookingId: 'booking-1',
      event: 'booking.opened',
      status: 'OPEN_MATCHING',
    });
    const providerCall = emit.mock.calls.at(-1);
    expect(JSON.stringify(providerCall)).not.toContain('0865907184');
    expect(JSON.stringify(providerCall)).not.toContain('10.7769');
  });

  it('does not join customer sockets to bookings they do not own', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const gateway = new MatchingGateway(
      { requireUser: vi.fn().mockReturnValue({ id: 'customer-user-1', roles: [Role.CUSTOMER] }) } as never,
      prisma as never,
    );
    const client = { join: vi.fn() };

    await expect(gateway.joinBookingRoom(client as never, { bookingId: 'booking-for-another-customer' })).resolves.toEqual({
      ok: false,
      error: 'BOOKING_ROOM_FORBIDDEN',
    });

    expect(client.join).not.toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-for-another-customer'));
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: 'booking-for-another-customer', customerProfileId: 'customer-profile-1' },
      select: { id: true },
    });
  });

  it('joins provider sockets to bookings where they are participants', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({ id: 'booking-1' }),
      },
    };
    const gateway = new MatchingGateway(
      { requireUser: vi.fn().mockReturnValue({ id: 'provider-user-1', roles: [Role.PROVIDER] }) } as never,
      prisma as never,
    );
    const client = { join: vi.fn() };

    await expect(gateway.joinBookingRoom(client as never, { bookingId: 'booking-1' })).resolves.toEqual({ ok: true });

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        OR: [
          { preferredProviderId: 'provider-profile-1' },
          { selectedProviderId: 'provider-profile-1' },
          { participants: { some: { providerProfileId: 'provider-profile-1' } } },
        ],
      },
      select: { id: true },
    });
  });
});
