export type BookingPricingPolicyPayoutRule = {
  readonly active: boolean;
  readonly customerPrice: number | string | null | undefined;
  readonly providerPayoutAmount: number | string | null | undefined;
};

export type BookingPricingPolicySignalInput = {
  readonly customerPrice: number | string | null | undefined;
  readonly hasBookedService: boolean;
  readonly hasService: boolean;
  readonly minimumPrice: number | string | null | undefined;
  readonly payoutRules: readonly BookingPricingPolicyPayoutRule[];
  readonly priceStep: number | string | null | undefined;
};

export type BookingPricingPolicySignal = {
  readonly label:
    | 'Service missing'
    | 'Price missing'
    | 'Below admin minimum'
    | 'Invalid price step'
    | 'Active payout rule missing'
    | 'Partner payout exceeds price'
    | 'Zero company gross fee'
    | 'Pricing ready';
  readonly status: 'ready' | 'warning' | 'blocked';
  readonly tone: 'pill-success' | 'pill-warn' | 'pill-danger';
};

export function bookingPricingPolicySignalFromFacts(
  input: BookingPricingPolicySignalInput,
): BookingPricingPolicySignal {
  if (!input.hasBookedService || !input.hasService) {
    return { status: 'blocked', label: 'Service missing', tone: 'pill-danger' };
  }

  const customerPrice = readAmount(input.customerPrice);
  if (customerPrice === null) {
    return { status: 'blocked', label: 'Price missing', tone: 'pill-danger' };
  }

  const minimum = readAmount(input.minimumPrice);
  const priceStep = readAmount(input.priceStep) ?? 100000;
  if (minimum !== null && customerPrice < minimum) {
    return { status: 'blocked', label: 'Below admin minimum', tone: 'pill-danger' };
  }
  if (priceStep <= 0 || customerPrice % priceStep !== 0) {
    return { status: 'blocked', label: 'Invalid price step', tone: 'pill-danger' };
  }

  const payoutRule = input.payoutRules.find(
    (rule) => rule.active && Number(rule.customerPrice) === customerPrice,
  );
  if (!payoutRule) {
    return { status: 'blocked', label: 'Active payout rule missing', tone: 'pill-danger' };
  }

  const providerPayout = Number(payoutRule.providerPayoutAmount);
  if (providerPayout > customerPrice) {
    return { status: 'blocked', label: 'Partner payout exceeds price', tone: 'pill-danger' };
  }

  const platformFee = customerPrice - providerPayout;
  if (platformFee <= 0) {
    return { status: 'warning', label: 'Zero company gross fee', tone: 'pill-warn' };
  }

  return { status: 'ready', label: 'Pricing ready', tone: 'pill-success' };
}

function readAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}
