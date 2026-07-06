type BookingRecordServiceRowsInput = {
  optionLabel: string;
  serviceName: string;
  durationLabel: string;
  notesLabel: string;
  createdLabel: string;
  createdValue?: string | null;
  updatedLabel: string;
  updatedValue?: string | null;
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
    { label: 'Notes', value: input.notesLabel },
    {
      dateTimeEndLabel: input.updatedLabel,
      dateTimeEndValue: input.updatedValue,
      dateTimeStartLabel: input.createdLabel,
      dateTimeStartValue: input.createdValue,
      label: 'Record time',
      value: `${input.createdLabel} / updated ${input.updatedLabel}`,
    },
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
