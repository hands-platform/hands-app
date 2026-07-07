import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingDetailConnectedRecordLinks } from './booking-detail-connected-record-links';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-connected-record-links',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    finalPartnerSummary: bookingFinalPartnerSummary(input),
    messageCount: 4,
    notificationCount: 3,
    paymentEvidence: {
      paymentQueueValue: 'AUTHORIZED',
      paymentMethodAmountLabel: 'CARD / 500.000 VND',
      paymentQueueHref: '/payments?review=authorized',
      paymentTone: 'pill-info',
      refundCountLabel: '0 refund row(s)',
      refundEvidence: 'No refund record',
      refundHref: '#payment',
      refundTone: 'pill-neutral',
    },
    financeTrace: {
      walletLedger: 'No entry',
    },
  };
}

describe('bookingDetailConnectedRecordLinks', () => {
  it('builds linked record shortcuts for active booking evidence', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-1234567890' } as AdminBookingDetail['chatRoom'],
      customerProfile: {
        id: 'customer-profile-1',
        user: {
          phone: '+84000000001',
        },
      } as AdminBookingDetail['customerProfile'],
      payment: { method: 'CARD', status: 'AUTHORIZED' } as AdminBookingDetail['payment'],
      preferredProvider: {
        id: 'partner-preferred',
        displayName: 'Preferred Partner',
      } as AdminBookingDetail['preferredProvider'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
    });

    const links = bookingDetailConnectedRecordLinks(baseInput(input));

    expect(links.map((link) => link.label)).toEqual([
      'Customer record',
      'Preferred Partner',
      'Final Partner',
      'Chat record',
      'Notifications',
      'Payment queue',
      'Refund queue',
      'Cash settlement',
    ]);
    expect(links.find((link) => link.label === 'Customer record')).toMatchObject({
      href: '/customers/customer-profile-1',
      tone: 'pill-success',
      value: 'Linked',
    });
    expect(links.find((link) => link.label === 'Final Partner')).toMatchObject({
      href: '/partners/partner-selected',
      value: 'Linh Partner',
    });
    expect(links.find((link) => link.label === 'Chat record')).toMatchObject({
      href: '/chat-archive?q=booking-detail-connected-record-links',
      value: '4 message(s)',
    });
    expect(links.find((link) => link.label === 'Chat record')?.detail).not.toMatch(/archive|trace/i);
    expect(links.find((link) => link.label === 'Notifications')?.detail).not.toMatch(/trace|retry/i);
    expect(links.find((link) => link.label === 'Refund queue')).toMatchObject({
      detail: 'Queue empty.',
      value: '0 refund row(s)',
    });
  });

  it('keeps missing links and cash settlement path visible', () => {
    const input = booking({
      earning: {
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: { method: 'CASH', status: 'CAPTURED' } as AdminBookingDetail['payment'],
    });

    const links = bookingDetailConnectedRecordLinks({
      ...baseInput(input),
      financeTrace: {
        walletLedger: '-120.000 VND / 1 entry',
      },
      notificationCount: 0,
      paymentEvidence: {
        ...baseInput(input).paymentEvidence,
        paymentMethodAmountLabel: 'CASH / 500.000 VND',
        paymentQueueHref: '/payments',
        paymentQueueValue: 'CAPTURED',
      },
    });

    expect(links.find((link) => link.label === 'Customer record')).toMatchObject({
      href: '#customer',
      tone: 'pill-warn',
      value: 'Profile missing',
    });
    expect(links.find((link) => link.label === 'Notifications')).toMatchObject({
      tone: 'pill-neutral',
      value: '0 alert(s)',
    });
    expect(links.find((link) => link.label === 'Cash settlement')).toMatchObject({
      detail: '-120.000 VND / 1 entry',
      href: '/cash-settlements',
      tone: 'pill-danger',
      value: 'Settlement needed',
    });
  });
});
