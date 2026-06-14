import type {
  AdminAppSession,
  AdminBooking,
  AdminCashSettlementSummary,
  AdminCustomer,
  AdminProvider,
} from '../../lib/admin-api';
import {
  buildChatSignals,
  buildCustomerSignals,
  buildPartnerSignals,
  buildPresence,
} from './operations-handoff-signals';

describe('operations handoff signal models', () => {
  it('counts chat rooms and recent messages using a stable reference time', () => {
    const nowMs = Date.parse('2026-06-14T10:00:00.000Z');

    expect(
      buildChatSignals(
        [
          booking({
            chatRoom: {
              id: 'chat-1',
              messages: [
                { body: 'recent', createdAt: '2026-06-14T09:45:00.000Z', id: 'message-1' },
                { body: 'old', createdAt: '2026-06-14T06:00:00.000Z', id: 'message-2' },
              ],
            },
          }),
          booking({ chatRoom: null }),
        ],
        { nowMs },
      ),
    ).toEqual({ roomCount: 1, recentMessageCount: 1 });
  });

  it('groups customer and Partner app session presence', () => {
    const nowMs = Date.parse('2026-06-14T10:00:00.000Z');

    expect(
      buildPresence(
        [
          session({ active: true, lastSeenAt: '2026-06-14T09:55:00.000Z', role: 'CUSTOMER' }),
          session({ active: false, lastSeenAt: '2026-06-14T09:00:00.000Z', role: 'CUSTOMER' }),
          session({ active: true, lastSeenAt: '2026-06-14T09:50:00.000Z', role: 'PROVIDER' }),
          session({ active: false, lastSeenAt: '2026-06-14T01:00:00.000Z', role: 'PARTNER' }),
        ],
        { nowMs },
      ),
    ).toEqual({
      customerLive: 1,
      customerRecent: 1,
      partnerLive: 1,
      partnerRecent: 1,
    });
  });

  it('sorts customer signals by latest work and summarizes payment/location facts', () => {
    const rows = buildCustomerSignals([
      customer({
        id: 'customer-old',
        bookings: [booking({ createdAt: '2026-06-13T00:00:00.000Z', id: 'booking-old' })],
      }),
      customer({
        id: 'customer-new',
        bookings: [
          booking({
            createdAt: '2026-06-14T00:00:00.000Z',
            id: 'booking-new',
            payment: { amount: 150000, method: 'MOMO', status: 'CAPTURED' },
            status: 'COMPLETED',
          }),
        ],
        selectedLocations: [
          {
            addressText: 'Ho Chi Minh City',
            createdAt: '2026-06-14T00:00:00.000Z',
            id: 'location-1',
            latitude: 10.7,
            longitude: 106.6,
          },
        ],
        user: { fullName: 'Customer Mai' },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      id: 'customer-new',
      completedCount: 1,
      detail: '1 booking(s), 150.000 VND payment total, 1 saved location(s).',
      name: 'Customer Mai',
    });
  });

  it('prioritizes Partner cash debt, review, and stale location signals', () => {
    const nowMs = Date.parse('2026-06-14T10:00:00.000Z');
    const signals = buildPartnerSignals(
      [
        partner({
          currentLocationUpdatedAt: '2026-06-14T09:45:00.000Z',
          displayName: 'Provider Linh',
          id: 'partner-cash',
          status: 'ACTIVE',
        }),
        partner({
          currentLocationUpdatedAt: '2026-06-14T01:00:00.000Z',
          id: 'partner-stale',
          kyc: { id: 'kyc-1', status: 'PENDING' },
          status: 'ACTIVE',
        }),
      ],
      cashSummary({ topProviderGroups: [cashDebtGroup({ providerProfileId: 'partner-cash' })] }),
      { nowMs },
    );

    expect(signals.attentionCount).toBe(2);
    expect(signals.rows[0]).toMatchObject({
      id: 'partner-cash',
      name: 'Partner Linh',
      status: 'Cash settlement',
      className: 'pill pill-danger',
    });
    expect(signals.rows[1]).toMatchObject({
      id: 'partner-stale',
      status: 'KYC review',
      className: 'pill pill-warn',
    });
  });
});

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    chatRoom: null,
    createdAt: '2026-06-14T00:00:00.000Z',
    id: 'booking-1',
    status: 'MATCHED',
    ...input,
  } as AdminBooking;
}

function session(input: Partial<AdminAppSession>): AdminAppSession {
  return {
    active: false,
    id: 'session-1',
    lastSeenAt: '2026-06-14T00:00:00.000Z',
    role: 'CUSTOMER',
    ...input,
  } as AdminAppSession;
}

function customer(input: Partial<AdminCustomer>): AdminCustomer {
  return {
    bookings: [],
    id: 'customer-1',
    selectedLocations: [],
    user: { phone: '0900000000' },
    ...input,
  } as AdminCustomer;
}

function partner(input: Partial<AdminProvider>): AdminProvider {
  return {
    bankAccounts: [],
    currentLocationUpdatedAt: null,
    displayName: 'Partner',
    id: 'partner-1',
    selectedBookings: [],
    status: 'ACTIVE',
    ...input,
  } as AdminProvider;
}

function cashSummary(input: Partial<AdminCashSettlementSummary>): AdminCashSettlementSummary {
  return {
    topProviderGroups: [],
    ...input,
  } as AdminCashSettlementSummary;
}

function cashDebtGroup(input: Partial<AdminCashSettlementSummary['topProviderGroups'][number]>) {
  return {
    currency: 'VND',
    debtAmount: 100000,
    latestOpenAt: '2026-06-14T00:00:00.000Z',
    oldestOpenAt: '2026-06-14T00:00:00.000Z',
    platformFee: 90000,
    providerName: 'Partner Linh',
    providerProfileId: 'partner-1',
    rowCount: 1,
    settlementReference: 'cash-ref-1',
    taxAmount: 10000,
    ...input,
  };
}
