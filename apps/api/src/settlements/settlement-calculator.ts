export type SettlementPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CUSTOMER_WALLET'
  | 'MOMO'
  | 'VNPAY'
  | 'MANUAL';

export type BookingSettlementCalculationInput = {
  paymentMethod: SettlementPaymentMethod;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  platformFeeGross: number;
  partnerVatRateBps: number;
  partnerPitRateBps: number;
  platformVatRateBps: number;
  paymentFeeRateBps: number;
  paymentFeeFixedAmount: number;
  partnerTaxableRevenueAmount?: number;
};

export function bpsAmount(baseAmount: number, rateBps: number) {
  return Math.round((baseAmount * rateBps) / 10_000);
}

export function calculateBookingSettlementAmounts(input: BookingSettlementCalculationInput) {
  const partnerTaxableRevenue = input.partnerTaxableRevenueAmount ?? input.customerPaymentAmount;
  const partnerVatAmount = bpsAmount(partnerTaxableRevenue, input.partnerVatRateBps);
  const partnerPitAmount = bpsAmount(partnerTaxableRevenue, input.partnerPitRateBps);
  const partnerWithholdingTotal = partnerVatAmount + partnerPitAmount;
  const platformFeeNetRevenue = Math.round(input.platformFeeGross / (1 + input.platformVatRateBps / 10_000));
  const companyOutputVat = input.platformFeeGross - platformFeeNetRevenue;
  const paymentProcessingFee =
    bpsAmount(input.customerPaymentAmount, input.paymentFeeRateBps) + input.paymentFeeFixedAmount;
  const partnerWalletDelta =
    input.paymentMethod === 'CASH'
      ? -(input.platformFeeGross + partnerWithholdingTotal)
      : input.partnerPayoutAmount - partnerWithholdingTotal;
  const customerWalletDebitAmount =
    input.paymentMethod === 'CUSTOMER_WALLET' ? input.customerPaymentAmount : 0;

  return {
    partnerTaxableRevenue,
    partnerVatAmount,
    partnerPitAmount,
    partnerWithholdingTotal,
    platformFeeNetRevenue,
    companyOutputVat,
    paymentProcessingFee,
    partnerWalletDelta,
    customerWalletDebitAmount,
    customerWalletCreditAmount: 0,
  };
}
