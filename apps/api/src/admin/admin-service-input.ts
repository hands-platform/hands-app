import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeNullable, slugify } from './admin-text-helpers';

export const PRICE_STEP_UNIT_VND = 100000;
const SERVICE_NAME_TRANSLATION_KEYS = ['en', 'vi', 'ko', 'ja', 'zh'] as const;
const SUPPORTED_SERVICE_DURATIONS = [60, 90, 120] as const;

export type ServiceCatalogGroupCommand = ReturnType<typeof normalizeServiceCatalogGroupCommand>;

export function normalizeServiceDurationSetInput(input: {
  serviceGroupKey?: string;
  name?: string;
  nameTranslations?: unknown;
  priceStep?: number;
  displayOrder?: number;
  durations?: Array<{
    durationMin?: number;
    basePrice?: number;
    providerPayoutAmount?: number | null;
  }>;
}) {
  const name = input.name?.trim();
  if (!name) {
    throw new BadRequestException('Service name is required');
  }
  const groupKey = normalizeNullable(input.serviceGroupKey) ?? slugify(name);
  const priceStep = input.priceStep ?? PRICE_STEP_UNIT_VND;
  const displayOrder = input.displayOrder ?? 100;
  const durationRows = (input.durations ?? []).filter((row) => row.basePrice !== undefined);
  if (durationRows.length === 0) {
    throw new BadRequestException('At least one duration price is required');
  }
  const durationSet = new Set<number>();
  for (const row of durationRows) {
    if (row.durationMin === undefined || durationSet.has(row.durationMin)) {
      throw new BadRequestException('Duration options must be unique and explicit');
    }
    durationSet.add(row.durationMin);
  }
  return {
    name,
    groupKey,
    priceStep,
    displayOrder,
    durationRows,
    durationMins: [...durationSet],
  };
}

export function normalizeServiceInput(
  input: {
    serviceGroupKey?: string | null;
    name?: string;
    nameTranslations?: unknown;
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
    nameTranslations:
      input.nameTranslations === undefined
        ? undefined
        : normalizeServiceNameTranslationsForPrisma(input.nameTranslations),
    description: input.description === undefined ? undefined : normalizeNullable(input.description),
    durationMin,
    basePrice: input.basePrice,
    priceStep: input.priceStep,
    displayOrder: input.displayOrder,
    active: input.active,
  };
}

export function normalizeServiceNameTranslations(input: unknown) {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Service name translations must be an object');
  }

  const translations: Record<string, string> = {};
  for (const key of SERVICE_NAME_TRANSLATION_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('Service translated names must be text');
    }
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    if (normalized.length > 120) {
      throw new BadRequestException('Service translated names must be 120 characters or fewer');
    }
    translations[key] = normalized;
  }

  return Object.keys(translations).length ? translations : null;
}

export function normalizeServiceCatalogGroupCommand(
  groupKeyInput: string,
  input: {
    requestId: string;
    expectedVersion: number;
    intent: 'SAVE_DRAFT' | 'PUBLISH' | 'HIDE' | 'ARCHIVE';
    reason?: string;
    nameTranslations?: unknown;
    description?: string | null;
    priceStep: number;
    displayOrder: number;
    durations: Array<{
      durationMin: number;
      enabled: boolean;
      basePrice?: number;
      providerPayoutAmount?: number;
      displayOrder: number;
    }>;
  },
) {
  const serviceGroupKey = normalizeNullable(groupKeyInput);
  if (!serviceGroupKey || !/^[a-z0-9_]{2,80}$/u.test(serviceGroupKey)) {
    throw new BadRequestException({
      code: 'SERVICE_CATALOG_VALIDATION_FAILED',
      fieldErrors: { serviceGroupKey: 'Use 2-80 lowercase letters, numbers, or underscores.' },
    });
  }
  if (input.priceStep % PRICE_STEP_UNIT_VND !== 0) {
    throw new BadRequestException({
      code: 'SERVICE_CATALOG_VALIDATION_FAILED',
      fieldErrors: { priceStep: `Price step must use ${PRICE_STEP_UNIT_VND} VND increments.` },
    });
  }
  const translations = normalizeServiceNameTranslations(input.nameTranslations) ?? {};
  const durations = [...input.durations].sort((left, right) => left.durationMin - right.durationMin);
  const durationValues = durations.map((row) => row.durationMin);
  if (
    durationValues.length !== SUPPORTED_SERVICE_DURATIONS.length ||
    SUPPORTED_SERVICE_DURATIONS.some((duration) => !durationValues.includes(duration)) ||
    new Set(durationValues).size !== durationValues.length
  ) {
    throw new BadRequestException({
      code: 'SERVICE_CATALOG_VALIDATION_FAILED',
      fieldErrors: { durations: 'Provide one row for each supported duration: 60, 90, and 120 minutes.' },
    });
  }

  const normalized = {
    serviceGroupKey,
    requestId: input.requestId,
    expectedVersion: input.expectedVersion,
    intent: input.intent,
    reason: normalizeNullable(input.reason),
    nameTranslations: translations,
    description: normalizeNullable(input.description),
    priceStep: input.priceStep,
    displayOrder: input.displayOrder,
    durations: durations.map((row) => ({
      durationMin: row.durationMin,
      enabled: row.enabled,
      basePrice: row.basePrice,
      providerPayoutAmount: row.providerPayoutAmount,
      displayOrder: row.displayOrder,
    })),
  };

  if (input.intent === 'PUBLISH') {
    assertServiceCatalogPublishReady(normalized);
  }
  return normalized;
}

export function assertServiceCatalogPublishReady(input: {
  reason?: string | null;
  nameTranslations: Record<string, string>;
  priceStep: number;
  durations: Array<{
    durationMin: number;
    enabled: boolean;
    basePrice?: number;
    providerPayoutAmount?: number;
  }>;
}) {
  const fieldErrors: Record<string, string> = {};
  if (!input.nameTranslations.en) fieldErrors.nameEn = 'English name is required to publish.';
  if (!input.nameTranslations.vi) fieldErrors.nameVi = 'Vietnamese name is required to publish.';
  if (!input.reason || input.reason.length < 12) {
    fieldErrors.reason = 'Explain the publishing impact in at least 12 characters.';
  }
  if (!input.durations.some((row) => row.enabled)) {
    fieldErrors.durations = 'Enable at least one duration before publishing.';
  }
  for (const row of input.durations) {
    if (!row.enabled) continue;
    const prefix = `duration${row.durationMin}`;
    if (!Number.isInteger(row.basePrice) || (row.basePrice ?? 0) <= 0) {
      fieldErrors[`${prefix}.basePrice`] = 'Customer price is required for an enabled duration.';
      continue;
    }
    if ((row.basePrice as number) % input.priceStep !== 0) {
      fieldErrors[`${prefix}.basePrice`] = `Customer price must use ${input.priceStep} VND increments.`;
    }
    if (!Number.isInteger(row.providerPayoutAmount) || (row.providerPayoutAmount ?? -1) < 0) {
      fieldErrors[`${prefix}.providerPayoutAmount`] =
        'Partner payout must be explicitly set, including when it is 0 VND.';
    } else if ((row.providerPayoutAmount as number) > (row.basePrice as number)) {
      fieldErrors[`${prefix}.providerPayoutAmount`] = 'Partner payout cannot exceed customer price.';
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new BadRequestException({ code: 'SERVICE_CATALOG_VALIDATION_FAILED', fieldErrors });
  }
}

function normalizeServiceNameTranslationsForPrisma(input: unknown) {
  const translations = normalizeServiceNameTranslations(input);
  return translations === null ? Prisma.JsonNull : (translations as Prisma.InputJsonValue);
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
