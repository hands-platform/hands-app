export type BookingServiceListPayoutRule = {
  readonly active: boolean;
  readonly currency?: string | null;
  readonly customerPrice: number | string | null | undefined;
  readonly providerPayoutAmount: number | string | null | undefined;
};

export type BookingServiceListLabelsInput = {
  readonly currency: string;
  readonly customerPrice: number | string | null | undefined;
  readonly durationMin: number | null | undefined;
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly minimumPrice: number | string | null | undefined;
  readonly payoutRules: readonly BookingServiceListPayoutRule[];
  readonly serviceName: string | null | undefined;
};

export type BookingServiceListLabels = {
  readonly optionLabel: string;
  readonly payoutRuleLabel: string | null;
  readonly priceLabel: string;
};

export function bookingServiceListLabelsFromFacts(
  input: BookingServiceListLabelsInput,
): BookingServiceListLabels {
  const customerPrice = readNumber(input.customerPrice);
  const minimumPrice = readNumber(input.minimumPrice);
  return {
    optionLabel: serviceOptionLabel(input.serviceName, input.durationMin),
    payoutRuleLabel: servicePayoutRuleLabel({
      currency: input.currency,
      customerPrice,
      formatMoney: input.formatMoney,
      payoutRules: input.payoutRules,
    }),
    priceLabel: servicePriceLabel({
      currency: input.currency,
      customerPrice,
      formatMoney: input.formatMoney,
      minimumPrice,
    }),
  };
}

function serviceOptionLabel(serviceName: string | null | undefined, durationMin: number | null | undefined) {
  if (!serviceName) {
    return 'Service pending';
  }

  const duration = durationMin ? `${durationMin} min` : 'duration pending';
  return `${serviceName} / ${duration}`;
}

function servicePriceLabel({
  currency,
  customerPrice,
  formatMoney,
  minimumPrice,
}: {
  readonly currency: string;
  readonly customerPrice: number | null;
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly minimumPrice: number | null;
}) {
  if (customerPrice === null) {
    return 'Price pending';
  }

  const customerPriceLabel = `Customer price ${formatMoney(customerPrice, currency)}`;
  return minimumPrice === null || minimumPrice === customerPrice
    ? customerPriceLabel
    : `${customerPriceLabel} / Minimum ${formatMoney(minimumPrice, currency)}`;
}

function servicePayoutRuleLabel({
  currency,
  customerPrice,
  formatMoney,
  payoutRules,
}: {
  readonly currency: string;
  readonly customerPrice: number | null;
  readonly formatMoney: (amount: number, currency: string) => string;
  readonly payoutRules: readonly BookingServiceListPayoutRule[];
}) {
  if (customerPrice === null) {
    return null;
  }

  const payoutRule = payoutRules.find(
    (rule) => rule.active && readNumber(rule.customerPrice) === customerPrice,
  );
  if (!payoutRule) {
    return 'Payout rule missing';
  }

  const providerPayout = readNumber(payoutRule.providerPayoutAmount) ?? 0;
  const platformFee = customerPrice - providerPayout;
  const payoutCurrency = payoutRule.currency ?? currency;
  return `Payout ${formatMoney(providerPayout, payoutCurrency)} / fee ${formatMoney(platformFee, payoutCurrency)}`;
}

function readNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}
