import {
  bookingRecordPaymentRows,
  bookingRecordServiceRows,
} from './booking-record-info-rows';

describe('booking record info rows', () => {
  it('builds service rows in the booking record order', () => {
    expect(
      bookingRecordServiceRows({
        optionLabel: 'Massage / 60 min',
        serviceName: 'Massage',
        durationLabel: '60 min',
        notesLabel: 'No notes',
        createdLabel: '2026-06-11',
        updatedLabel: '2026-06-12',
      }).map((row) => row.label),
    ).toEqual([
      'Option',
      'Name',
      'Duration',
      'Notes',
      'Record time',
    ]);
  });

  it('adds cash fee debt only when the booking needs settlement', () => {
    expect(
      bookingRecordPaymentRows({
        paymentIdLabel: 'payment-1',
        paymentMethodLabel: 'CASH',
        paymentAmountLabel: '500.000 VND',
        refundCount: 0,
        earningLabel: '-150.000 VND / PENDING',
        cashFeeDebtLabel: '150.000 VND / Partner blocked',
        serviceFeedbackLabel: 'Not submitted',
      }),
    ).toContainEqual({ label: 'Cash fee debt', value: '150.000 VND / Partner blocked' });

    expect(
      bookingRecordPaymentRows({
        paymentIdLabel: 'payment-1',
        paymentMethodLabel: 'MOMO',
        paymentAmountLabel: '500.000 VND',
        refundCount: 1,
        earningLabel: '350.000 VND / AVAILABLE',
        cashFeeDebtLabel: null,
        serviceFeedbackLabel: 'Submitted',
      }).map((row) => row.label),
    ).not.toContain('Cash fee debt');
  });
});
