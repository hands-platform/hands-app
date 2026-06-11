import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeNullable, slugify } from './admin-text-helpers';

export const PRICE_STEP_UNIT_VND = 100000;

export function normalizeServiceInput(
  input: {
    serviceGroupKey?: string | null;
    name?: string;
    description?: string | null;
    durationMin?: number;
    basePrice?: number;
    priceStep?: number;
    displayOrder?: number;
    active?: boolean;
  },
  creating: boolean,
  existing?: { name: string; basePrice: number; priceStep: number },
): Prisma.MassageServiceUncheckedCreateInput | Prisma.MassageServiceUncheckedUpdateInput {
  const name = input.name?.trim();
  if (creating && !name) {
    throw new BadRequestException('Service name is required');
  }
  const durationMin = input.durationMin;
  if (
    (creating || durationMin !== undefined) &&
    (!Number.isInteger(durationMin) || (durationMin ?? 0) <= 0)
  ) {
    throw new BadRequestException('Service duration must be a positive integer');
  }

  const nextPriceStep = input.priceStep ?? existing?.priceStep ?? PRICE_STEP_UNIT_VND;
  if (!Number.isInteger(nextPriceStep) || nextPriceStep <= 0) {
    throw new BadRequestException('Price step must be a positive integer');
  }
  if (nextPriceStep % PRICE_STEP_UNIT_VND !== 0) {
    throw new BadRequestException(`Price step must use ${PRICE_STEP_UNIT_VND} VND increments`);
  }
  const nextBasePrice = input.basePrice ?? existing?.basePrice;
  if (
    (creating || input.basePrice !== undefined) &&
    (!Number.isInteger(nextBasePrice) || (nextBasePrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Base price must be a positive integer');
  }
  if (nextBasePrice !== undefined && nextBasePrice % nextPriceStep !== 0) {
    throw new BadRequestException(`Base price must use ${nextPriceStep} VND increments`);
  }

  const nextName = name ?? existing?.name ?? '';
  const normalizedGroupKey =
    input.serviceGroupKey === undefined
      ? creating
        ? slugify(nextName)
        : undefined
      : (normalizeNullable(input.serviceGroupKey) ?? slugify(nextName));
  return {
    serviceGroupKey: normalizedGroupKey,
    name: name ?? undefined,
    description: input.description === undefined ? undefined : normalizeNullable(input.description),
    durationMin,
    basePrice: input.basePrice,
    priceStep: input.priceStep,
    displayOrder: input.displayOrder,
    active: input.active,
  };
}

export function normalizeServicePayoutRuleInput(
  service: { basePrice: number; priceStep: number },
  input: {
    customerPrice?: number;
    providerPayoutAmount?: number;
    vatBps?: number;
    otherCostAmount?: number;
    active?: boolean;
    notes?: string | null;
  },
  creating: boolean,
  existing?: {
    customerPrice: number;
    providerPayoutAmount: number;
    vatBps: number;
    otherCostAmount: number;
    active: boolean;
    notes?: string | null;
  },
) {
  const customerPrice = input.customerPrice ?? existing?.customerPrice;
  if (
    (creating || input.customerPrice !== undefined) &&
    (!Number.isInteger(customerPrice) || (customerPrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Customer price must be a positive integer');
  }
  if (customerPrice !== undefined && customerPrice < service.basePrice) {
    throw new BadRequestException('Customer price cannot be lower than the admin minimum');
  }
  if (customerPrice !== undefined && customerPrice % service.priceStep !== 0) {
    throw new BadRequestException(`Customer price must use ${service.priceStep} VND increments`);
  }

  const providerPayoutAmount = input.providerPayoutAmount ?? existing?.providerPayoutAmount;
  if (
    (creating || input.providerPayoutAmount !== undefined) &&
    (!Number.isInteger(providerPayoutAmount) || (providerPayoutAmount ?? -1) < 0)
  ) {
    throw new BadRequestException('Partner payout amount must be zero or greater');
  }
  if (
    customerPrice !== undefined &&
    providerPayoutAmount !== undefined &&
    providerPayoutAmount > customerPrice
  ) {
    throw new BadRequestException('Partner payout amount cannot exceed customer price');
  }

  const vatBps = input.vatBps ?? existing?.vatBps ?? 0;
  if (!Number.isInteger(vatBps) || vatBps < 0 || vatBps > 10000) {
    throw new BadRequestException('VAT basis points must be between 0 and 10000');
  }
  const otherCostAmount = input.otherCostAmount ?? existing?.otherCostAmount ?? 0;
  if (!Number.isInteger(otherCostAmount) || otherCostAmount < 0) {
    throw new BadRequestException('Other cost amount must be zero or greater');
  }

  return {
    customerPrice: customerPrice as number,
    providerPayoutAmount: providerPayoutAmount as number,
    vatBps,
    otherCostAmount,
    currency: 'VND',
    active: input.active ?? existing?.active ?? true,
    notes: input.notes === undefined ? existing?.notes : normalizeNullable(input.notes),
  };
}
