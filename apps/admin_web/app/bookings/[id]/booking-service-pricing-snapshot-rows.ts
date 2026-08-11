type BookingServicePricingSnapshotInput = {
  serviceOption: string;
  customerPrice: string;
  adminMinimum: string;
  payoutRuleStatus: string;
  payoutRuleLine: string;
  earningStatus: string | null;
  providerPayout: string;
  providerNet: string;
  platformFee: string;
  feeCosts: string;
  netHandsFee: string;
  withholding: string;
  companyFeeAfterTax: string;
  walletLedger: string;
  paymentMethod: string;
};

export function bookingServicePricingSnapshotRows(input: BookingServicePricingSnapshotInput) {
  return [
    {
      label: 'Service option',
      value: input.serviceOption,
      helper: 'Booked service name, duration option, and quantity snapshot.',
    },
    {
      label: 'Customer price',
      value: input.customerPrice,
      helper: `Admin minimum ${input.adminMinimum}; Partner price must follow the configured step.`,
    },
    {
      label: 'Payout rule',
      value: input.payoutRuleStatus,
      helper: input.payoutRuleLine,
    },
    {
      label: input.earningStatus ? 'Partner payout' : 'Projected payout',
      value: input.providerPayout,
      helper: input.providerNet,
    },
    {
      label: 'HANDS fee',
      value: input.platformFee,
      helper: `${input.feeCosts}; net ${input.netHandsFee}`,
    },
    {
      label: 'Tax and withholding',
      value: input.withholding,
      helper: `Company fee after tax: ${input.companyFeeAfterTax}`,
    },
    {
      label: 'Wallet impact',
      value: input.walletLedger,
      helper:
        input.paymentMethod === 'CASH'
          ? 'Cash bookings can create Partner fee debt until settled.'
          : 'Non-cash bookings should create a payout credit after completion.',
    },
  ];
}
