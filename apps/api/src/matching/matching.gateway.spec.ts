import { AdminOperatorPermissionCategory, BookingStatus, Role } from '@prisma/client';
import { SOCKET_ROOMS } from '../common/domain';
import { MatchingGateway } from './matching.gateway';

function realtimeServer(clients: unknown[] = []) {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const fetchSockets = vi.fn().mockResolvedValue(clients);
  const inRoom = vi.fn().mockReturnValue({ fetchSockets });
  return { emit, fetchSockets, inRoom, server: { in: inRoom, to } as never, to };
}

describe('MatchingGateway admin booking realtime', () => {
  it('joins admin sockets to the booking monitor room', async () => {
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue({
          id: 'admin-user',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
        }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.user('admin-user'));
    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
  });

  it('does not join an Admin without realtime permission to the global booking room', async () => {
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue({
          id: 'support-admin-user',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS],
        }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.user('support-admin-user'));
    expect(client.join).not.toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
  });

  it('keeps the REST/UI Master Admin bypass for the global booking room', async () => {
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue({
          id: 'master-admin-user',
          roles: [Role.ADMIN, Role.MASTER_ADMIN],
          adminPermissionCategories: [],
        }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn() };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
  });

  it('joins only marketplace-visible Partners to the global provider signal room', async () => {
    const join = vi.fn();
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue({ id: 'partner-user', roles: [Role.PROVIDER] }),
      } as never,
      {
        providerProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              userId: 'partner-user',
              blockedAt: null,
              blockedReason: null,
              verification: { status: 'APPROVED' },
              kyc: { status: 'APPROVED' },
              documents: [
                { type: 'CCCD_FRONT', status: 'APPROVED', deletedAt: null },
                { type: 'CCCD_BACK', status: 'APPROVED', deletedAt: null },
                { type: 'SELFIE', status: 'APPROVED', deletedAt: null },
              ],
            },
          ]),
        },
      } as never,
    );

    await gateway.handleConnection({ join } as never);
    expect(join).toHaveBeenCalledWith(SOCKET_ROOMS.providers());
  });

  it('keeps a blocked Partner out of the global provider signal room', async () => {
    const join = vi.fn();
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue({ id: 'blocked-partner-user', roles: [Role.PROVIDER] }),
      } as never,
      {
        providerProfile: {
          findMany: vi.fn().mockResolvedValue([
            {
              userId: 'blocked-partner-user',
              blockedAt: new Date(),
              blockedReason: 'review',
              verification: { status: 'APPROVED' },
              kyc: { status: 'APPROVED' },
              documents: [],
            },
          ]),
        },
      } as never,
    );

    await gateway.handleConnection({ join } as never);
    expect(join).toHaveBeenCalledWith(SOCKET_ROOMS.user('blocked-partner-user'));
    expect(join).not.toHaveBeenCalledWith(SOCKET_ROOMS.providers());
  });

  it('does not let an Admin without booking-detail permission join a booking room', async () => {
    const recordAdminAuthorizationDenial = vi.fn();
    const gateway = new MatchingGateway(
      {
        recordAdminAuthorizationDenial,
        requireCurrentUser: vi.fn().mockResolvedValue({
          id: 'realtime-only-admin',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
        }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn() };

    await expect(
      gateway.joinBookingRoom(client as never, { bookingId: 'booking-sensitive-1' }),
    ).resolves.toEqual({ ok: false, error: 'BOOKING_ROOM_FORBIDDEN' });
    expect(client.join).not.toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-sensitive-1'));
    expect(recordAdminAuthorizationDenial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'realtime-only-admin' }),
      'booking:booking-sensitive-1',
      'BOOKING_ROOM_FORBIDDEN',
    );
  });

  it('keeps the REST/UI Master Admin bypass for an individual booking room', async () => {
    const gateway = new MatchingGateway(
      {
        requireCurrentUser: vi.fn().mockResolvedValue({
          id: 'master-admin-user',
          roles: [Role.ADMIN, Role.MASTER_ADMIN],
          adminPermissionCategories: [],
        }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn().mockResolvedValue(undefined) };

    await expect(
      gateway.joinBookingRoom(client as never, { bookingId: 'booking-sensitive-1' }),
    ).resolves.toEqual({ ok: true });
    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-sensitive-1'));
  });

  it.each([
    ['Finance-only', [AdminOperatorPermissionCategory.FINANCE], false, false],
    ['Booking-only', [AdminOperatorPermissionCategory.BOOKINGS], true, true],
    ['read-only realtime', [AdminOperatorPermissionCategory.BOOKINGS_REALTIME], true, false],
  ])('enforces the %s global and booking-room matrix', async (_, categories, globalAllowed, detailAllowed) => {
    const user = { id: 'matrix-admin', roles: [Role.ADMIN], adminPermissionCategories: categories };
    const gateway = new MatchingGateway(
      {
        authenticate: vi.fn().mockResolvedValue(user),
        recordAdminAuthorizationDenial: vi.fn(),
        requireCurrentUser: vi.fn().mockResolvedValue(user),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn().mockResolvedValue(undefined) };

    await gateway.handleConnection(client as never);
    await expect(
      gateway.joinBookingRoom(client as never, { bookingId: 'booking-sensitive-1' }),
    ).resolves.toEqual(detailAllowed ? { ok: true } : { ok: false, error: 'BOOKING_ROOM_FORBIDDEN' });

    expect(client.join.mock.calls.some(([room]) => room === SOCKET_ROOMS.adminBookings())).toBe(globalAllowed);
    expect(client.join.mock.calls.some(([room]) => room === SOCKET_ROOMS.booking('booking-sensitive-1'))).toBe(detailAllowed);
  });

  it('mirrors booking lifecycle events to the admin booking monitor room', async () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server, to } = realtimeServer();
    gateway.server = server;
    const payload = { bookingId: 'booking-1' };

    await gateway.emitBookingMatched('booking-1', payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
    expect(emit).toHaveBeenCalledWith('booking.matched', payload);
  });

  it('notifies the booking room when the Partner arrives', async () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server, to } = realtimeServer();
    gateway.server = server;
    const payload = { id: 'booking-1', status: 'ARRIVED' };

    await gateway.emitProviderArrived('booking-1', payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.adminBookings());
    expect(emit).toHaveBeenCalledWith('provider.arrived', payload);
  });

  it.each([
    ['matched', 'booking.matched', 'MATCHED', (gateway: MatchingGateway, payload: unknown) =>
      gateway.emitBookingMatched('booking-1', payload)],
    ['expired', 'booking.expired', 'EXPIRED', (gateway: MatchingGateway, payload: unknown) =>
      gateway.emitBookingExpired('booking-1', payload)],
  ])('notifies the provider request queue when a booking is %s', async (_, eventName, status, emitEvent) => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server, to } = realtimeServer();
    gateway.server = server;
    const payload = { bookingId: 'booking-1', customerPhone: 'private-phone' };

    await emitEvent(gateway, payload);

    expect(to).toHaveBeenCalledWith(SOCKET_ROOMS.providers());
    expect(emit).toHaveBeenCalledWith(eventName, {
      bookingId: 'booking-1',
      event: eventName,
      status,
    });
    expect(JSON.stringify(emit.mock.calls.at(-1))).not.toContain('private-phone');
  });

  it('publishes the committed booking status in matched provider signals', async () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server } = realtimeServer();
    gateway.server = server;

    await gateway.emitBookingMatched('booking-1', {
      bookingId: 'booking-1',
      status: BookingStatus.IN_SERVICE,
    });

    expect(emit).toHaveBeenLastCalledWith('booking.matched', {
      bookingId: 'booking-1',
      event: 'booking.matched',
      status: BookingStatus.IN_SERVICE,
    });
  });

  it('publishes cancellation as cancellation rather than expiration', async () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server } = realtimeServer();
    gateway.server = server;

    await gateway.emitBookingExpired('booking-1', {
      bookingId: 'booking-1',
      status: BookingStatus.CANCELLED,
    });

    expect(emit).toHaveBeenLastCalledWith('booking.cancelled', {
      bookingId: 'booking-1',
      event: 'booking.cancelled',
      status: BookingStatus.CANCELLED,
    });
  });

  it('does not expose booking details in provider booking-opened signals', async () => {
    const gateway = new MatchingGateway({} as never, {} as never);
    const { emit, server } = realtimeServer();
    gateway.server = server;
    const payload = {
      input: {
        booking: {
          customer: { phone: '0865907184' },
          addressSnapshot: { latitude: 10.7769, longitude: 106.7009 },
        },
      },
    };

    await gateway.emitBookingOpened('booking-1', payload);

    expect(emit).toHaveBeenCalledWith('booking.opened', {
      bookingId: 'booking-1',
      event: 'booking.opened',
      status: 'OPEN_MATCHING',
    });
    const providerCall = emit.mock.calls.at(-1);
    expect(JSON.stringify(providerCall)).not.toContain('0865907184');
    expect(JSON.stringify(providerCall)).not.toContain('10.7769');
  });

  it('removes a non-selected Partner before post-match booking events are emitted', async () => {
    const leave = vi.fn();
    const stalePartner = {
      data: { user: { id: 'stale-partner-user', roles: [Role.PROVIDER] } },
      leave,
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'stale-partner-profile' }) },
      booking: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const gateway = new MatchingGateway({} as never, prisma as never);
    const { emit, server } = realtimeServer([stalePartner]);
    gateway.server = server;

    await gateway.emitServiceStarted('booking-1', { exactAddress: 'private-address' });

    expect(leave).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(emit).toHaveBeenCalledWith('service.started', { exactAddress: 'private-address' });
  });

  it('removes a Partner who is no longer marketplace-visible before global signals are emitted', async () => {
    const leave = vi.fn();
    const blockedPartner = {
      data: { user: { id: 'blocked-partner-user', roles: [Role.PROVIDER] } },
      leave,
    };
    const prisma = {
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: 'blocked-partner-user',
            blockedAt: new Date(),
            blockedReason: 'review',
            verification: { status: 'APPROVED' },
            kyc: { status: 'APPROVED' },
            documents: [],
          },
        ]),
      },
    };
    const gateway = new MatchingGateway({} as never, prisma as never);
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const inRoom = vi.fn((room: string) => ({
      fetchSockets: vi.fn().mockResolvedValue(
        room === SOCKET_ROOMS.providers() ? [blockedPartner] : [],
      ),
    }));
    gateway.server = { in: inRoom, to } as never;

    await gateway.emitBookingOpened('booking-1', { privateAddress: 'not-for-global-room' });

    expect(leave).toHaveBeenCalledWith(SOCKET_ROOMS.providers());
    expect(emit).toHaveBeenCalledWith('booking.opened', {
      bookingId: 'booking-1',
      event: 'booking.opened',
      status: 'OPEN_MATCHING',
    });
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
      {
        requireCurrentUser: vi.fn().mockResolvedValue({ id: 'customer-user-1', roles: [Role.CUSTOMER] }),
      } as never,
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
      {
        requireCurrentUser: vi.fn().mockResolvedValue({ id: 'provider-user-1', roles: [Role.PROVIDER] }),
      } as never,
      prisma as never,
    );
    const client = { join: vi.fn() };

    await expect(gateway.joinBookingRoom(client as never, { bookingId: 'booking-1' })).resolves.toEqual({ ok: true });

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.booking('booking-1'));
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        OR: [
          { selectedProviderId: 'provider-profile-1' },
          {
            status: BookingStatus.OPEN_MATCHING,
            OR: [
              { preferredProviderId: 'provider-profile-1' },
              { participants: { some: { providerProfileId: 'provider-profile-1' } } },
            ],
          },
        ],
      },
      select: { id: true },
    });
  });

  it('does not acknowledge a booking room until the Socket.IO adapter joins it', async () => {
    const gateway = new MatchingGateway(
      {
        requireCurrentUser: vi.fn().mockResolvedValue({ id: 'admin-1', roles: [Role.ADMIN], adminPermissionCategories: [AdminOperatorPermissionCategory.BOOKINGS_DETAIL] }),
      } as never,
      {} as never,
    );
    const client = { join: vi.fn().mockRejectedValue(new Error('Redis adapter unavailable')) };

    await expect(
      gateway.joinBookingRoom(client as never, { bookingId: 'booking-1' }),
    ).resolves.toEqual({ ok: false, error: 'BOOKING_ROOM_JOIN_FAILED' });
  });

  it.each([null, {}, { bookingId: '' }, { bookingId: 'x'.repeat(129) }])(
    'rejects malformed booking room payloads before authorization queries',
    async (payload) => {
      const prisma = {
        customerProfile: { findUnique: vi.fn() },
        providerProfile: { findUnique: vi.fn() },
        booking: { findFirst: vi.fn() },
      };
      const gateway = new MatchingGateway(
        {
          requireCurrentUser: vi.fn().mockResolvedValue({ id: 'customer-1', roles: [Role.CUSTOMER] }),
        } as never,
        prisma as never,
      );

      await expect(gateway.joinBookingRoom({} as never, payload)).resolves.toEqual({
        ok: false,
        error: 'BOOKING_INVALID_PAYLOAD',
      });
      expect(prisma.customerProfile.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    },
  );
});
