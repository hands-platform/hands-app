import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { bookingOperatingSnapshot } from './booking-operating-snapshot';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-operating-snapshot',
    participants: [],
    status: 'CREATED',
    ...input,
  } as AdminBookingDetail;
}

function attention(severity: AttentionFlag['severity']): AttentionFlag {
  return {
    action: 'Review the booking.',
    detail: 'A booking check needs operator attention.',
    severity,
    title: 'Booking check',
  };
}

describe('bookingOperatingSnapshot', () => {
  it('summarizes a completed booking as successful when no checks are open', () => {
    const snapshot = bookingOperatingSnapshot({
      booking: booking({
        addressSnapshot: {
          createdAt: '2026-06-14T01:10:00.000Z',
          source: 'customer_confirmation',
        } as AdminBookingDetail['addressSnapshot'],
        chatRoom: { id: 'chat-room-1' },
        earning: {
          currency: 'VND',
          netAmount: 240000,
          status: 'PAID',
        } as AdminBookingDetail['earning'],
        payment: {
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Selected Partner',
        },
        status: 'COMPLETED',
      }),
      addressLine: 'District 1 address',
      addressPin: '10.762622, 106.660172',
      attentionFlags: [],
      messageCount: 3,
      notificationCount: 2,
    });

    expect(snapshot).toMatchObject({
      href: '#finance',
      hrefLabel: 'Open finance',
      nextAction: 'Reconcile completed booking',
      noteClassName: 'ops-task-info',
      status: 'COMPLETED',
      tone: 'pill-success',
    });
    expect(snapshot.facts.map((fact) => fact.label)).toEqual([
      'Confirmed address',
      'Customer final choice',
      'Preferred Partner',
      'Marketplace supply',
      'Chat and alerts',
      'Payment and wallet',
    ]);
    expect(snapshot.facts.find((fact) => fact.label === 'Payment and wallet')).toMatchObject({
      helper: 'Ledger 240.000 VND',
      value: 'CARD / CAPTURED',
    });
    expect(snapshot.facts.find((fact) => fact.label === 'Confirmed address')).toMatchObject({
      helper: 'Confirmed service address saved / customer_confirmation / 14 Jun 2026, 08:10',
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/source of truth|service address snapshot/i);
    expect(JSON.stringify(snapshot)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
  });

  it('uses warning tone for non-high attention checks', () => {
    const snapshot = bookingOperatingSnapshot({
      booking: booking({
        status: 'OPEN_MATCHING',
      }),
      addressLine: 'District 3 address',
      addressPin: 'No pin',
      attentionFlags: [attention('medium')],
      messageCount: 0,
      notificationCount: 1,
    });

    expect(snapshot).toMatchObject({
      noteClassName: 'ops-task-warning',
      nextAction: 'Monitor Partner participation',
      tone: 'pill-warn',
    });
  });

  it('uses danger tone and cash debt action when finance settlement blocks remain', () => {
    const snapshot = bookingOperatingSnapshot({
      booking: booking({
        earning: {
          currency: 'VND',
          netAmount: -150000,
          status: 'PENDING',
        } as AdminBookingDetail['earning'],
        payment: {
          method: 'CASH',
          status: 'PENDING',
        } as AdminBookingDetail['payment'],
        status: 'MATCHED',
      }),
      addressLine: 'District 7 address',
      addressPin: '10.730000, 106.720000',
      attentionFlags: [attention('high')],
      messageCount: 0,
      notificationCount: 0,
    });

    expect(snapshot).toMatchObject({
      href: '#finance',
      nextAction: 'Settle cash fee debt',
      noteClassName: 'ops-task-danger',
      tone: 'pill-danger',
    });
    expect(snapshot.facts.find((fact) => fact.label === 'Payment and wallet')).toMatchObject({
      helper: 'Debt 150.000 VND',
      value: 'CASH / PENDING',
    });
  });

  it('counts marketplace and selectable Partner rows in the supply fact', () => {
    const snapshot = bookingOperatingSnapshot({
      booking: booking({
        participants: [
          {
            id: 'first-pick',
            distanceMeters: 500,
            providerProfileId: 'partner-first',
            status: 'JOINED',
          },
          {
            id: 'marketplace-accepted',
            providerProfileId: 'partner-marketplace',
            status: 'ACCEPTED',
          },
        ] as AdminBookingDetail['participants'],
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
        status: 'OPEN_MATCHING',
      }),
      addressLine: 'District 2 address',
      addressPin: '10.780000, 106.740000',
      attentionFlags: [],
      messageCount: 0,
      notificationCount: 0,
    });

    expect(snapshot.facts.find((fact) => fact.label === 'Preferred Partner')).toMatchObject({
      helper: 'JOINED / 500 m',
      value: 'First Pick Partner',
    });
    expect(snapshot.facts.find((fact) => fact.label === 'Marketplace supply')).toMatchObject({
      value: '1 marketplace / 1 selectable',
    });
  });
});
