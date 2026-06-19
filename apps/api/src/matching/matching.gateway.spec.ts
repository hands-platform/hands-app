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
});
