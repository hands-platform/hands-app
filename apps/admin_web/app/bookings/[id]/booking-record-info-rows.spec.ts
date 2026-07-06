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
        createdValue: '2026-06-11T01:00:00.000Z',
        updatedLabel: '2026-06-12',
        updatedValue: '2026-06-12T02:00:00.000Z',
      }).map((row) => row.label),
    ).toEqual([
      'Option',
      'Name',
      'Duration',
      'Notes',
      'Record time',
    ]);
  });

  it('keeps raw service record timestamps for shared DateTimeText rendering', () => {
    expect(
      bookingRecordServiceRows({
        optionLabel: 'Massage / 60 min',
        serviceName: 'Massage',
        durationLabel: '60 min',
        notesLabel: 'No notes',
        createdLabel: '11 Jun 2026, 08:00',
        createdValue: '2026-06-11T01:00:00.000Z',
        updatedLabel: '12 Jun 2026, 09:00',
        updatedValue: '2026-06-12T02:00:00.000Z',
      }),
    ).toContainEqual({
      dateTimeEndLabel: '12 Jun 2026, 09:00',
      dateTimeEndValue: '2026-06-12T02:00:00.000Z',
      dateTimeStartLabel: '11 Jun 2026, 08:00',
      dateTimeStartValue: '2026-06-11T01:00:00.000Z',
      label: 'Record time',
      value: '11 Jun 2026, 08:00 / updated 12 Jun 2026, 09:00',
    });
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
