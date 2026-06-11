import {
  ADMIN_PROVIDER_COMPACT_LIST_LIMIT,
  ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,
  adminProviderListBookingSelect,
  adminProviderListEarningSelect,
  adminProviderListParticipantSelect,
  adminProviderListSelect,
  adminProviderListUserSelect,
} from './admin-provider-profile-selects';

describe('admin provider profile selects', () => {
  it('keeps exported provider list limits stable', () => {
    expect(ADMIN_PROVIDER_COMPACT_LIST_LIMIT).toBe(500);
    expect(ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT).toBe(3);
  });

  it('keeps compact provider user rows media and device bounded', () => {
    expect(adminProviderListUserSelect.pushDevices).toMatchObject({ take: 2 });
    expect(adminProviderListUserSelect.fileAssets).toMatchObject({ take: 2 });
  });

  it('keeps provider list booking and participant rows lightweight', () => {
    expect(adminProviderListBookingSelect).toMatchObject({
      addressSnapshot: expect.any(Object),
      chatRoom: { select: { id: true, createdAt: true } },
    });
    expect(adminProviderListParticipantSelect.booking).toMatchObject({
      select: adminProviderListBookingSelect,
    });
  });

  it('keeps provider list financial and relation collections bounded', () => {
    expect(adminProviderListEarningSelect.booking).toMatchObject({
      select: { id: true, status: true, scheduledStartAt: true },
    });
    expect(adminProviderListSelect).toMatchObject({
      preferredBookings: { take: 50 },
      selectedBookings: { take: 50 },
      participants: { take: 50 },
      earnings: { take: 30 },
    });
  });
});
