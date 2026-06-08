export type BookingFinanceSummaryTrace = {
  currency: string;
  paymentMethod: string;
  customerPriceAmount: number | null;
  serviceOption: string;
  providerPayoutAmount: number | null;
  earningStatus?: string | null;
  platformFeeAmount: number | null;
  netHandsFee: string;
  withholdingAmount: number | null;
  withholding: string;
  companyFeeAfterTaxAmount: number | null;
  walletTotalAmount: number;
};

export type BookingFinanceSummaryCard = {
  label: string;
  value: string;
  helper: string;
};

export type BookingFinanceSummaryOptions = {
  money: (amount?: number | null, currency?: string) => string;
};

export function bookingFinanceSummaryCards(
  financeTrace: BookingFinanceSummaryTrace,
  options: BookingFinanceSummaryOptions,
): BookingFinanceSummaryCard[] {
  const walletHelper =
    financeTrace.paymentMethod === 'CASH'
      ? financeTrace.walletTotalAmount < 0
        ? 'Cash fee debt gates marketplace alerts, participation, and payout release.'
        : 'Cash settlement ledger is not negative.'
      : 'Non-cash booking should create payout credit after completion.';

  return [
    {
      label: 'Customer charge',
      value: options.money(financeTrace.customerPriceAmount, financeTrace.currency),
      helper: financeTrace.serviceOption,
    },
    {
      label: 'Partner payout',
      value: options.money(financeTrace.providerPayoutAmount, financeTrace.currency),
      helper: financeTrace.earningStatus
        ? `Earning ${financeTrace.earningStatus}`
        : 'Projected from payout rule.',
    },
    {
      label: 'HANDS fee',
      value: options.money(financeTrace.platformFeeAmount, financeTrace.currency),
      helper: `${financeTrace.netHandsFee} before withholding impact.`,
    },
    {
      label: 'Tax withheld',
      value: options.money(financeTrace.withholdingAmount, financeTrace.currency),
      helper: financeTrace.withholding,
    },
    {
      label: 'Company net',
      value: options.money(financeTrace.companyFeeAfterTaxAmount, financeTrace.currency),
      helper: 'HANDS fee after VAT, other costs, and withholding.',
    },
    {
      label: 'Wallet impact',
      value: options.money(financeTrace.walletTotalAmount, financeTrace.currency),
      helper: walletHelper,
    },
  ];
}
