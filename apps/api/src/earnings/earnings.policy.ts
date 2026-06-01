import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

export type WalletDeltaInput = {
  paymentMethod?: PaymentMethod | string | null;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  tipAmount: number;
};

export type PricedServiceLine = {
  serviceId: string;
  serviceName?: string | null;
  price: number;
  quantity: number;
};

export type ServicePayoutRuleLine = {
  id: string;
  serviceId: string;
  customerPrice: number;
  providerPayoutAmount: number;
  vatBps: number;
  otherCostAmount: number;
};

export function calculateProviderWalletDelta(input: WalletDeltaInput) {
  if (input.paymentMethod === PaymentMethod.CASH || input.paymentMethod === 'CASH') {
    return -(input.platformFee + input.withholdingAmount);
  }

  return input.grossAmount - input.platformFee - input.withholdingAmount;
}

export function calculateServicePayoutFeeFromRules(input: {
  grossAmount: number;
  currency: string;
  services: PricedServiceLine[];
  payoutRules: ServicePayoutRuleLine[];
}) {
  if (input.services.length === 0) {
    return null;
  }

  const ruleByServiceAndPrice = new Map(
    input.payoutRules.map((rule) => [`${rule.serviceId}:${rule.customerPrice}`, rule]),
  );
  const selectedRules = input.services.map((service) => ({
    service,
    rule: ruleByServiceAndPrice.get(`${service.serviceId}:${service.price}`),
  }));
  if (selectedRules.some((item) => !item.rule)) {
    return null;
  }

  const ruleLines = selectedRules.map(({ service, rule }) => {
    if (!rule) {
      throw new BadRequestException('Missing service payout rule');
    }
    const customerAmount = service.price * service.quantity;
    const providerPayoutAmount = rule.providerPayoutAmount * service.quantity;
    const platformFeeAmount = Math.max(0, customerAmount - providerPayoutAmount);
    const vatAmount = Math.round((platformFeeAmount * rule.vatBps) / 10_000);
    const otherCostAmount = rule.otherCostAmount * service.quantity;
    return {
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      quantity: service.quantity,
      customerPrice: service.price,
      customerAmount,
      providerPayoutAmount,
      platformFeeAmount,
      vatBps: rule.vatBps,
      vatAmount,
      otherCostAmount,
      ruleId: rule.id,
    };
  });
  const providerPayoutAmount = ruleLines.reduce((sum, line) => sum + line.providerPayoutAmount, 0);
  const platformFeeAmount = Math.max(0, input.grossAmount - providerPayoutAmount);
  const vatAmount = ruleLines.reduce((sum, line) => sum + line.vatAmount, 0);
  const otherCostAmount = ruleLines.reduce((sum, line) => sum + line.otherCostAmount, 0);

  return {
    platformFeeAmount,
    currency: input.currency,
    policyVersionId: null,
    ruleSnapshot: {
      source: 'SERVICE_PAYOUT_RULE',
      providerPayoutAmount,
      vatAmount,
      otherCostAmount,
      grossAmount: input.grossAmount,
      netCompanyFeeBeforeWithholding: platformFeeAmount - vatAmount - otherCostAmount,
      lines: ruleLines,
    },
  };
}
