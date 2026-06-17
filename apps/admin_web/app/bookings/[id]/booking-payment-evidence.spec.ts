import {
  bookingPaymentEvidence,
  type BookingPaymentEvidenceInput,
} from './booking-payment-evidence';

describe('booking payment evidence', () => {
  it('summarizes payment labels and authorized queue routing', () => {
    const evidence = bookingPaymentEvidence({
      payment: {
        id: 'payment-1',
        status: 'AUTHORIZED',
        method: 'MOMO',
        amount: 250000,
        currency: 'VND',
      },
    });

    expect(evidence).toMatchObject({
      paymentId: 'payment-1',
      paymentStatus: 'AUTHORIZED',
      paymentMethod: 'MOMO',
      paymentMethodAmountLabel: 'MOMO / 250.000 VND',
      readablePaymentMethodAmountLabel: 'MOMO / 250.000 VND',
      paymentMethodStatusLabel: 'MOMO / AUTHORIZED',
      paymentQueueValue: 'AUTHORIZED',
      paymentQueueHref: '/payments?review=authorized',
      paymentTone: 'pill-info',
      refundCount: 0,
      refundCountLabel: '0 refund row(s)',
      refundRecordStatus: 'No refund record',
    });
  });

  it('uses direct booking refund rows before payment refund rows', () => {
    const booking: BookingPaymentEvidenceInput = {
      payment: {
        status: 'REFUNDED',
        method: 'VNPAY',
        amount: 300000,
        currency: 'VND',
        refunds: [
          {
            id: 'payment-refund',
            amount: 300000,
            status: 'COMPLETED',
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      },
      refunds: [
        {
          id: 'booking-refund',
          amount: 150000,
          status: 'REQUESTED',
          createdAt: '2026-06-10T10:00:00.000Z',
          reason: 'Customer evidence accepted',
          payment: { currency: 'VND' },
        },
      ],
    };

    const evidence = bookingPaymentEvidence(booking);

    expect(evidence.refundRows).toEqual(booking.refunds);
    expect(evidence).toMatchObject({
      refundCount: 1,
      refundCountLabel: '1 refund row(s)',
      refundRecordStatus: '1 refund record(s)',
      refundHref: '/refunds?review=open',
      refundTone: 'pill-warn',
    });
    expect(evidence.refundEvidence).toContain('REQUESTED');
    expect(evidence.refundEvidence).toContain('Customer evidence accepted');
  });

  it('keeps no-payment display labels stable', () => {
    expect(bookingPaymentEvidence({ payment: null })).toMatchObject({
      paymentId: null,
      paymentStatus: 'NONE',
      paymentMethod: 'NONE',
      paymentMethodStatusLabel: 'NONE / NONE',
      paymentQueueValue: 'No payment',
      paymentQueueHref: '/payments',
      paymentTone: 'pill-neutral',
      refundEvidence: 'No refund action recorded.',
    });
  });
});
