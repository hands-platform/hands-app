export type BookingListActionChip = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: string;
};

export type BookingListActionChipsInput = {
  readonly cashDebtNeedsOps: boolean;
  readonly chatNeedsRepair: boolean;
  readonly chatState: {
    readonly detail: string;
    readonly label: string;
    readonly tone: string;
  };
  readonly closeoutNeedsOps: boolean;
  readonly locationDetail: string;
  readonly locationNeedsOps: boolean;
  readonly paymentDetail: string;
  readonly paymentNeedsOps: boolean;
  readonly pricingDetail: string;
  readonly pricingNeedsOps: boolean;
  readonly pricingTone: string;
};

export function bookingListActionChipsFromFacts(
  input: BookingListActionChipsInput,
): readonly BookingListActionChip[] {
  return [
    {
      detail: input.chatState.detail,
      href: input.chatNeedsRepair ? '/bookings?view=chat-repair' : '/bookings?view=chat',
      label: input.chatNeedsRepair ? 'Chat repair' : input.chatState.label,
      tone: input.chatNeedsRepair ? 'pill-danger' : input.chatState.tone,
    },
    {
      detail: input.locationDetail,
      href: '/bookings?view=location',
      label: input.locationNeedsOps ? 'Location check' : 'Location clear',
      tone: input.locationNeedsOps ? 'pill-warn' : 'pill-success',
    },
    {
      detail: input.paymentDetail,
      href: '/bookings?view=payment',
      label: input.paymentNeedsOps ? 'Payment check' : 'Payment clear',
      tone: input.paymentNeedsOps ? 'pill-warn' : 'pill-success',
    },
    {
      detail: input.cashDebtNeedsOps
        ? 'Partner cash fee debt must be settled before final acceptance, service start, or payout release resumes.'
        : 'No Partner cash fee debt is visible for this booking.',
      href: '/bookings?view=cash-debt',
      label: input.cashDebtNeedsOps ? 'Cash debt' : 'Cash clear',
      tone: input.cashDebtNeedsOps ? 'pill-danger' : 'pill-success',
    },
    {
      detail: input.closeoutNeedsOps
        ? 'Completed booking needs payment, earning, tax, fee, or wallet impact closeout.'
        : 'No completed closeout blocker is visible.',
      href: '/bookings?view=closeout',
      label: input.closeoutNeedsOps ? 'Closeout check' : 'Closeout clear',
      tone: input.closeoutNeedsOps ? 'pill-warn' : 'pill-success',
    },
    {
      detail: input.pricingDetail,
      href: '/bookings?view=pricing',
      label: input.pricingNeedsOps ? 'Pricing check' : 'Pricing clear',
      tone: input.pricingNeedsOps ? input.pricingTone : 'pill-success',
    },
  ];
}
