import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerOperationRow, partnerAcceptBlockerSummary } from './partner-operation-row';

function approvedIdentityDocuments(): NonNullable<AdminProvider['documents']> {
  return [
    { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
    { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
    { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
  ];
}

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    id: 'booking-live-1',
    status: 'MATCHED',
    createdAt: '2026-06-01T01:00:00.000Z',
    updatedAt: '2026-06-01T01:10:00.000Z',
    services: [{ price: 450000, service: { name: 'Swedish Massage', durationMin: 60 } }],
    ...input,
  } as AdminBooking;
}

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  const matchedBooking = booking({
    id: 'booking-matched',
    status: 'MATCHED',
    chatRoom: { id: 'chat-room-1' },
  } as Partial<AdminBooking>);

  return {
    id: 'partner-1',
    displayName: 'Linh Wellness',
    legalName: 'Linh Wellness Legal',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date().toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: approvedIdentityDocuments(),
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'Vietcombank',
        accountHolderName: 'Linh Wellness',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    services: [
      { id: 'provider-service-1', active: true, service: { id: 'service-1', name: 'Swedish Massage' } },
    ],
    selectedBookings: [matchedBooking],
    preferredBookings: [booking({ id: 'booking-first-pick', status: 'OPEN_MATCHING' })],
    participants: [{ id: 'participant-1', status: 'ACCEPTED', booking: matchedBooking }],
    sessions: [{ id: 'session-1', suspicious: false, lastSeenAt: '2026-06-01T01:15:00.000Z' }],
    devices: [{ id: 'device-1', deviceId: 'device-1', enabled: true }],
    user: {
      id: 'user-1',
      phone: '0865907184',
      pushDevices: [{ id: 'push-1', enabled: true, createdAt: '2026-06-01T01:05:00.000Z' }],
    },
    earnings: [
      {
        id: 'earning-negative-wallet',
        providerProfileId: 'partner-1',
        bookingId: 'booking-cash',
        grossAmount: 500000,
        platformFee: 50000,
        withholdingAmount: 0,
        netAmount: -50000,
        currency: 'VND',
        status: 'PENDING',
      },
    ],
    ...input,
  } as AdminProvider;
}

describe('partner operation row', () => {
  it('keeps negative-wallet marketplace blocking separate from direct request readiness', () => {
    const row = buildPartnerOperationRow(partner(), DEFAULT_PROVIDER_OPS_POLICY, {
      displayName: (item) => item.displayName ?? item.id,
      canAcceptBookingNow: () => true,
    });

    expect(row.name).toBe('Linh Wellness');
    expect(row.avatarStatus).toBe('online');
    expect(row.acceptanceLabel).toBe('Direct request clear');
    expect(row.marketplaceAccessLabel).toBe('Settlement warning');
    expect(row.marketplaceAccessDetail).toContain('final acceptance, service start, and payout release');
    expect(row.marketplaceCanView).toBe(true);
    expect(row.marketplaceCanReceiveAlerts).toBe(false);
    expect(row.marketplaceCanParticipate).toBe(true);
    expect(row.marketplacePartnerAppMessage).toContain('Unpaid HANDS fees');
    expect(row.checklist.find((item) => item.label === 'Wallet')).toMatchObject({
      status: 'settlement needed',
      tone: 'warn',
    });
    expect(row.checklist.map((item) => item.label)).toContain('Withdrawal details');
    expect(row.checklist.map((item) => item.label)).toContain('Tax optional');
    expect(row.checklist.map((item) => item.label)).not.toContain('Withdrawal bank');
    expect(row.checklist.map((item) => item.label)).not.toContain('Legacy tax');
    expect(row.matchingFlow.map((item) => [item.label, item.status])).toEqual([
      ['First-pick', '1 record'],
      ['Marketplace', '1 participation record'],
      ['Customer choice', '1 selected'],
      ['Chat', '1 room'],
    ]);
    expect(row.nextAction.status).toBe('CASH DEBT');
  });

  it('uses server booking summary counts when booking relation rows are capped', () => {
    const row = buildPartnerOperationRow(
      partner({
        preferredBookings: [],
        selectedBookings: [],
        participants: [],
        bookingSummary: {
          activeBookingCount: 6,
          adminClosedBookingCount: 0,
          bookingCount: 14,
          chatMissingCount: 0,
          chatRoomCount: 2,
          closedBookingCount: 1,
          completedBookingCount: 4,
          customerClosedBookingCount: 0,
          latestBookingAt: '2026-06-20T12:00:00.000Z',
          matchingBookingCount: 4,
          noShowBookingCount: 0,
          participatingBookingCount: 5,
          partnerClosedBookingCount: 1,
          preferredBookingCount: 4,
          selectedBookingCount: 3,
          workingBookingCount: 2,
        },
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
      {
        displayName: (item) => item.displayName ?? item.id,
        canAcceptBookingNow: () => true,
      },
    );

    expect(row.matchingFlow.map((item) => [item.label, item.status])).toEqual([
      ['First-pick', '4 records'],
      ['Marketplace', '5 participation records'],
      ['Customer choice', '3 selected'],
      ['Chat', '2 rooms'],
    ]);
  });

  it('labels non-wallet marketplace blockers as dispatch repair', () => {
    const row = buildPartnerOperationRow(
      partner({
        earnings: [],
        user: {
          id: 'user-1',
          phone: '0865907184',
          pushDevices: [],
        },
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
      {
        displayName: (item) => item.displayName ?? item.id,
        canAcceptBookingNow: () => true,
      },
    );

    expect(row.marketplaceAccessLabel).toBe('Dispatch repair needed');
    expect(row.marketplaceAccessDetail).toContain('listed blockers resolved');
  });

  it('summarizes direct request blockers in operations language', () => {
    expect(
      partnerAcceptBlockerSummary(
        partner({
          status: 'OFFLINE',
          kyc: { id: 'kyc-2', status: 'REJECTED' },
          documents: [],
          bankAccounts: [],
          user: { id: 'user-2', phone: '0865907184', pushDevices: [] },
        }),
        DEFAULT_PROVIDER_OPS_POLICY,
      ),
    ).toContain('Blocked by: KYC REJECTED, identity documents, status OFFLINE');
  });
});
