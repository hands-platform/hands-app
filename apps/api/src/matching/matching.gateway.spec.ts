import { Role } from '@prisma/client';
import { SOCKET_ROOMS } from '../common/domain';
import { MatchingGateway } from './matching.gateway';

describe('MatchingGateway admin booking realtime', () => {
  it('joins admin sockets to the booking monitor room', async () => {
    const gateway = new MatchingGateway(
      { authenticate: jest.fn().mockResolvedValue({ id: 'admin-user', roles: [Role.ADMIN] }) } as never,
      {} as never,
    );
    const client = { join: jest.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.user('admin-user'));
    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
  });

  it('mirrors booking lifecycle events to the admin booking monitor room', () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    const payload = { bookingId: 'booking-1' };

    gateway.emitBookingMatched('booking-1', payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
    expect(emit).toHaveBeenCalledWith('booking.matched', payload);
  });

  it('does not join customer sockets to bookings they do not own', async () => {
    const prisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const gateway = new MatchingGateway(
      { requireUser: jest.fn().mockReturnValue({ id: 'customer-user-1', roles: [Role.CUSTOMER] }) } as never,
      prisma as never,
    );
    const client = { join: jest.fn() };

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
        findUnique: jest.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
    };
    const gateway = new MatchingGateway(
      { requireUser: jest.fn().mockReturnValue({ id: 'provider-user-1', roles: [Role.PROVIDER] }) } as never,
      prisma as never,
    );
    const client = { join: jest.fn() };

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
