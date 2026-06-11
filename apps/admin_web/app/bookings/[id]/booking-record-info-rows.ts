type BookingRecordServiceRowsInput = {
  optionLabel: string;
  serviceName: string;
  durationLabel: string;
  bookingPriceLabel: string;
  adminMinimumLabel: string;
  payoutRuleLabel: string;
  notesLabel: string;
  createdLabel: string;
  updatedLabel: string;
};

type BookingRecordPaymentRowsInput = {
  paymentIdLabel: string;
  paymentMethodLabel: string;
  paymentAmountLabel: string;
  refundCount: number;
  earningLabel: string;
  cashFeeDebtLabel?: string | null;
  serviceFeedbackLabel: string;
};

export function bookingRecordServiceRows(input: BookingRecordServiceRowsInput) {
  return [
    { label: 'Option', value: input.optionLabel },
    { label: 'Name', value: input.serviceName },
    { label: 'Duration', value: input.durationLabel },
    { label: 'Booking price', value: input.bookingPriceLabel },
    { label: 'Admin minimum', value: input.adminMinimumLabel },
    { label: 'Partner payout rule', value: input.payoutRuleLabel },
    { label: 'Notes', value: input.notesLabel },
    { label: 'Created', value: input.createdLabel },
    { label: 'Updated', value: input.updatedLabel },
  ];
}

export function bookingRecordPaymentRows(input: BookingRecordPaymentRowsInput) {
  return [
    { label: 'Payment id', value: input.paymentIdLabel },
    { label: 'Method', value: input.paymentMethodLabel },
    { label: 'Amount', value: input.paymentAmountLabel },
    { label: 'Refund count', value: `${input.refundCount}` },
    { label: 'Earning', value: input.earningLabel },
    ...(input.cashFeeDebtLabel
      ? [{ label: 'Cash fee debt', value: input.cashFeeDebtLabel }]
      : []),
    { label: 'Service feedback', value: input.serviceFeedbackLabel },
  ];
}
