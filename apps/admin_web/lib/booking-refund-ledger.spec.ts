import {
  bookingRefundLedgerEvidence,
  bookingRefundRows,
  type BookingRefundLedgerInput,
} from './booking-refund-ledger';

describe('booking refund ledger helpers', () => {
  it('uses direct booking refund rows first', () => {
    const booking: BookingRefundLedgerInput = {
      payment: {
        status: 'REFUNDED',
        currency: 'VND',
        refunds: [
          {
            id: 'payment-refund',
            amount: 100000,
            status: 'PENDING',
            createdAt: '2026-05-20T10:00:00.000Z',
          },
        ],
      },
      refunds: [
        {
          id: 'booking-refund',
          amount: 200000,
          status: 'APPROVED',
          createdAt: '2026-05-21T10:00:00.000Z',
          reason: 'Customer evidence accepted',
          payment: { currency: 'VND' },
        },
      ],
    };

    expect(bookingRefundRows(booking)).toEqual(booking.refunds);
    expect(bookingRefundLedgerEvidence(booking)).toContain('APPROVED');
    expect(bookingRefundLedgerEvidence(booking)).toContain('Customer evidence accepted');
  });

  it('falls back to payment refund rows with booking payment currency', () => {
    const booking: BookingRefundLedgerInput = {
      payment: {
        status: 'REFUNDED',
        currency: 'VND',
        refunds: [
          {
            id: 'payment-refund',
            amount: 150000,
            status: 'RELEASED',
            createdAt: '2026-05-20T10:00:00.000Z',
          },
        ],
      },
    };

    expect(bookingRefundRows(booking)).toEqual([
      {
        id: 'payment-refund',
        amount: 150000,
        status: 'RELEASED',
        createdAt: '2026-05-20T10:00:00.000Z',
        payment: { currency: 'VND' },
      },
    ]);
    expect(bookingRefundLedgerEvidence(booking)).toContain('RELEASED');
  });

  it('explains missing rows for refunded and non-refunded bookings', () => {
    expect(bookingRefundLedgerEvidence({ payment: { status: 'REFUNDED' } })).toBe(
      'Payment is marked refunded but no refund row is loaded.',
    );
    expect(bookingRefundLedgerEvidence({ payment: { status: 'AUTHORIZED' } })).toBe(
      'No refund action recorded.',
    );
  });
});
