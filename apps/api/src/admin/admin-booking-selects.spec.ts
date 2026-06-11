import {
  adminAddressSnapshotSelect,
  adminBookingOpsTaskSummarySelect,
  adminChatMessageSummarySelect,
  adminChatRoomPresenceSelect,
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
  });

  it('keeps chat presence bounded to the latest message', () => {
    expect(adminChatRoomPresenceSelect.messages).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: 1,
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
});
