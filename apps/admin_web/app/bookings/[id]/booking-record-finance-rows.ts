type BookingRecordFinanceRowsInput = {
  pricingSource: string;
  serviceOption: string;
  customerPrice: string;
  adminMinimum: string;
  payoutRuleStatus: string;
  payoutRuleLine: string;
  providerPayout: string;
  platformFee: string;
  feeCosts: string;
  netHandsFee: string;
  withholding: string;
  companyFeeAfterTax: string;
  walletLedger: string;
  providerNet: string;
};

export function bookingRecordFinanceRows(input: BookingRecordFinanceRowsInput) {
  return [
    { label: 'Pricing basis', value: `${input.pricingSource} / ${input.serviceOption}` },
    { label: 'Customer price floor', value: `${input.customerPrice} / min ${input.adminMinimum}` },
    { label: 'Payout rule', value: `${input.payoutRuleStatus} / ${input.payoutRuleLine}` },
    { label: 'Fee and tax', value: `${input.platformFee} / ${input.feeCosts} / ${input.withholding}` },
    { label: 'Wallet and Partner net', value: `${input.walletLedger} / ${input.providerNet}` },
  ];
}
