import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingCloseoutReadiness } from './booking-closeout-readiness';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.762622,
    lng: 106.660172,
    recordedAt: '2026-06-14T01:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('booking closeout readiness', () => {
  it('marks a completed booking ready when all factual closeout records are aligned', () => {
    const readiness = bookingCloseoutReadiness({
      booking: booking({
        addressSnapshot: { addressText: 'District 1 address' } as AdminBookingDetail['addressSnapshot'],
        auditLogs: [{ id: 'audit-1' }] as AdminBookingDetail['auditLogs'],
        chatRoom: { id: 'chat-room-1' },
        customerProfile: {
          id: 'customer-profile-1',
          user: { fullName: 'Customer One', phone: '+84900000001' },
        } as AdminBookingDetail['customerProfile'],
        earning: {
          platformFeeLogs: [{ id: 'fee-log-1' }],
          status: 'PAID',
          taxLogs: [{ id: 'tax-log-1' }],
          walletLedgerEntries: [{ id: 'wallet-entry-1' }],
        } as AdminBookingDetail['earning'],
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        selectedProviderId: 'partner-selected',
        selectedProvider: { id: 'partner-selected', displayName: 'Selected Partner' },
        status: 'COMPLETED',
      }),
      financeFlags: [],
      latestLocation: location(),
      messageCount: 2,
      notificationCount: 1,
    });

    expect(readiness.status).toBe('Ready');
    expect(readiness.tone).toBe('pill-success');
    expect(readiness.openItems).toEqual([]);
    expect(readiness.helper).toBe('All factual records needed for this booking stage are aligned.');
    expect(readiness.items.find((item) => item.id === 'location-signal')?.detail).toMatch(
      /^Location recorded without readable address \//,
    );
    expect(readiness.items.find((item) => item.id === 'chat-record')).toMatchObject({
      label: 'Chat',
      status: 'Chat record valid',
      detail: '2 retained message(s). Chat record remains available after mobile chat is hidden.',
    });
    expect(JSON.stringify(readiness)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });

  it('keeps active booking monitor gaps visible without forcing payment or finance closeout', () => {
    const readiness = bookingCloseoutReadiness({
      booking: booking({
        customerProfile: {
          id: 'customer-profile-1',
          user: { fullName: 'Customer One', phone: '+84900000001' },
        } as AdminBookingDetail['customerProfile'],
        payment: null,
        status: 'MATCHED',
      }),
      financeFlags: [],
      messageCount: 0,
      notificationCount: 0,
    });

    expect(readiness.status).toBe('5 monitor item(s)');
    expect(readiness.tone).toBe('pill-info');
    expect(readiness.openItems.map((item) => item.label)).toEqual([
      'Customer',
      'Partner',
      'Chat',
      'Location',
      'Audit',
    ]);
    expect(readiness.items.find((item) => item.id === 'customer-record')?.detail).toContain(
      'No confirmed service address',
    );
    expect(readiness.items.find((item) => item.id === 'chat-record')?.status).toBe('Chat record missing');
  });

  it('raises finance tone when ledger or cash settlement blocks remain', () => {
    const readiness = bookingCloseoutReadiness({
      booking: booking({
        addressSnapshot: { addressText: 'District 1 address' } as AdminBookingDetail['addressSnapshot'],
        auditLogs: [{ id: 'audit-1' }] as AdminBookingDetail['auditLogs'],
        chatRoom: { id: 'chat-room-1' },
        customerProfile: { id: 'customer-profile-1' } as AdminBookingDetail['customerProfile'],
        earning: {
          currency: 'VND',
          netAmount: -150000,
          status: 'PENDING',
        } as AdminBookingDetail['earning'],
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CASH',
          status: 'PENDING',
        } as AdminBookingDetail['payment'],
        selectedProviderId: 'partner-selected',
        selectedProvider: { id: 'partner-selected', displayName: 'Selected Partner' },
        status: 'COMPLETED',
      }),
      financeFlags: [
        {
          action: 'Review finance closeout.',
          detail: 'Finance closeout evidence is incomplete.',
          severity: 'high',
          title: 'Finance flag',
        },
      ],
      latestLocation: location(),
      messageCount: 1,
      notificationCount: 1,
    });

    expect(readiness.status).toBe('2 closeout item(s)');
    expect(readiness.tone).toBe('pill-warn');
    expect(readiness.openItems.map((item) => item.label)).toEqual(['Finance', 'Cash']);
    expect(readiness.helper).toContain('Finance, Cash');
  });
});
