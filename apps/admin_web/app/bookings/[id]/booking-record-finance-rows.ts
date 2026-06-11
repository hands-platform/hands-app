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
    { label: 'Pricing source', value: input.pricingSource },
    { label: 'Service option', value: input.serviceOption },
    { label: 'Customer price', value: input.customerPrice },
    { label: 'Admin minimum', value: input.adminMinimum },
    { label: 'Payout rule', value: input.payoutRuleStatus },
    { label: 'Rule line', value: input.payoutRuleLine },
    { label: 'Partner payout', value: input.providerPayout },
    { label: 'Platform fee', value: input.platformFee },
    { label: 'VAT / other costs', value: input.feeCosts },
    { label: 'Net HANDS fee', value: input.netHandsFee },
    { label: 'Withholding', value: input.withholding },
    { label: 'Company fee after tax', value: input.companyFeeAfterTax },
    { label: 'Wallet ledger', value: input.walletLedger },
    { label: 'Partner net', value: input.providerNet },
  ];
}
