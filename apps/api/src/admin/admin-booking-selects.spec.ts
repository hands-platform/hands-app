import {
  ADMIN_CUSTOMER_DETAIL_BOOKING_CHAT_MESSAGE_LIMIT,
  adminAddressSnapshotListSelect,
  adminAddressSnapshotSelect,
  adminBookingListSelect,
  adminBookingOpsTaskSummarySelect,
  adminChatMessageSummarySelect,
  adminChatRoomPresenceSelect,
  adminCustomerBookingListSelect,
  adminCustomerDetailBookingSelect,
} from './admin-booking-selects';

describe('admin booking selects', () => {
  it('keeps address snapshots location-aware without expanding relations', () => {
    expect(adminAddressSnapshotSelect).toMatchObject({
      bookingId: true,
      selectedLocationId: true,
      latitude: true,
      longitude: true,
      addressText: true,
    });
    expect(adminAddressSnapshotListSelect).toEqual({
      id: true,
      addressText: true,
      latitude: true,
      longitude: true,
    });
  });

  it('keeps chat presence bounded to recent messages', () => {
    expect(adminChatRoomPresenceSelect.messages).toMatchObject({
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: expect.objectContaining({ body: true, sender: expect.any(Object) }),
    });
  });

  it('keeps ops task and chat message summaries actor-aware', () => {
    expect(adminBookingOpsTaskSummarySelect.actor).toMatchObject({
      select: { id: true, phone: true, fullName: true },
    });
    expect(adminChatMessageSummarySelect.sender).toMatchObject({
      select: expect.objectContaining({ id: true, roles: true }),
    });
  });

  it('keeps booking list rows connected to service, payment, and bounded chat count context', () => {
    expect(adminBookingListSelect).toMatchObject({
      customerProfile: { select: { id: true, user: expect.any(Object) } },
      preferredProvider: {
        select: expect.objectContaining({
          currentLocationUpdatedAt: true,
          displayName: true,
          user: { select: { id: true, phone: true, fullName: true } },
        }),
      },
      services: expect.any(Object),
      payment: expect.any(Object),
      earning: expect.any(Object),
      chatRoom: {
        select: {
          id: true,
          _count: { select: { messages: true } },
        },
      },
    });
    expect(adminBookingListSelect.participants).toMatchObject({
      orderBy: { joinedAt: 'asc' },
      take: 10,
    });
    expect(
      'messages' in (adminBookingListSelect.chatRoom.select as Record<string, unknown>),
    ).toBe(false);
    expect(
      'email' in (adminBookingListSelect.customerProfile.select.user.select as Record<string, unknown>),
    ).toBe(false);
    expect(
      'roles' in (adminBookingListSelect.customerProfile.select.user.select as Record<string, unknown>),
    ).toBe(false);
    expect(
      'ratingAvg' in (adminBookingListSelect.preferredProvider.select as Record<string, unknown>),
    ).toBe(false);
    expect('rawMeta' in (adminBookingListSelect.payment.select as Record<string, unknown>)).toBe(false);
    expect(
      adminBookingListSelect.services.select.service.select.payoutRules.select,
    ).toEqual({
      customerPrice: true,
      providerPayoutAmount: true,
      currency: true,
      active: true,
    });
    expect(adminBookingListSelect.earning).toMatchObject({
      select: {
        id: true,
        providerProfileId: true,
        bookingId: true,
        netAmount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('keeps customer booking detail rows bounded for nested activity', () => {
    expect(adminCustomerBookingListSelect.chatRoom).toMatchObject({ select: { id: true } });
    expect(adminCustomerBookingListSelect).not.toHaveProperty('metadata');
    expect(adminCustomerBookingListSelect).not.toHaveProperty('lat');
    expect(adminCustomerBookingListSelect).not.toHaveProperty('lng');
    expect(adminCustomerBookingListSelect).not.toHaveProperty('scheduledStartAt');
    expect(adminCustomerBookingListSelect.preferredProvider.select).toEqual({
      id: true,
      displayName: true,
      user: { select: { id: true, phone: true, fullName: true } },
    });
    expect(adminCustomerBookingListSelect.services.select.service.select).toEqual({
      name: true,
      durationMin: true,
    });
    expect(adminCustomerBookingListSelect.payment.select).not.toHaveProperty('providerRef');
    expect(adminCustomerBookingListSelect.payment.select.refunds).toMatchObject({ take: 5 });
    expect(adminCustomerDetailBookingSelect).toHaveProperty('metadata', false);
    expect(adminCustomerDetailBookingSelect.walletLedgerEntries).toMatchObject({ take: 5 });
    expect(adminCustomerDetailBookingSelect.opsTasks).toMatchObject({ take: 5 });
    expect(ADMIN_CUSTOMER_DETAIL_BOOKING_CHAT_MESSAGE_LIMIT).toBeLessThanOrEqual(5);
    expect(adminCustomerDetailBookingSelect.chatRoom.select.messages).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_BOOKING_CHAT_MESSAGE_LIMIT,
      select: adminChatMessageSummarySelect,
    });
  });
});
