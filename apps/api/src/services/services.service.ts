import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { groupServiceCatalogOptions } from './service-catalog-groups';
import {
  isPublicServiceCatalogOption,
  publicServiceCatalogWhere,
} from './public-service-catalog';

const PRICE_STEP_UNIT_VND = 100000;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const services = await this.prisma.massageService.findMany({
      where: publicServiceCatalogWhere,
      select: {
        id: true,
        serviceGroupKey: true,
        name: true,
        nameTranslations: true,
        description: true,
        durationMin: true,
        basePrice: true,
        priceStep: true,
        displayOrder: true,
        payoutRules: {
          where: { active: true },
          orderBy: { customerPrice: 'asc' },
          select: {
            id: true,
            customerPrice: true,
            providerPayoutAmount: true,
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
    });

    return services.flatMap(({ payoutRules, ...service }) =>
      isPublicServiceCatalogOption({ ...service, payoutRules }) ? [service] : [],
    );
  }

  async listActiveGroups() {
    return groupServiceCatalogOptions(await this.listActive()).map((group) => ({
      key: group.key,
      name: group.name,
      nameTranslations: group.nameTranslations,
      description: group.description,
      durationSummary: group.durationSummary,
      activeOptionCount: group.activeOptionCount,
      missingStandardDurations: group.missingStandardDurations,
      minBasePrice: group.minBasePrice,
      maxBasePrice: group.maxBasePrice,
      options: group.options,
    }));
  }

  create(input: {
    serviceGroupKey?: string;
    name: string;
    nameTranslations?: unknown;
    description?: string;
    durationMin: number;
    basePrice: number;
    priceStep?: number;
    displayOrder?: number;
  }) {
    const data = normalizeServiceInput(input);
    return this.prisma.massageService.create({ data });
  }
}

function normalizeServiceInput(input: {
  serviceGroupKey?: string;
  name: string;
  nameTranslations?: unknown;
  description?: string;
  durationMin: number;
  basePrice: number;
  priceStep?: number;
  displayOrder?: number;
}) {
  const name = input.name?.trim();
  if (!name) {
    throw new BadRequestException('Service name is required');
  }
  if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) {
    throw new BadRequestException('Service duration must be a positive integer');
  }
  const priceStep = input.priceStep ?? 100000;
  if (!Number.isInteger(priceStep) || priceStep <= 0) {
    throw new BadRequestException('Price step must be a positive integer');
  }
  if (priceStep % PRICE_STEP_UNIT_VND !== 0) {
    throw new BadRequestException(`Price step must use ${PRICE_STEP_UNIT_VND} VND increments`);
  }
  if (!Number.isInteger(input.basePrice) || input.basePrice <= 0) {
    throw new BadRequestException('Base price must be a positive integer');
  }
  if (input.basePrice % priceStep !== 0) {
    throw new BadRequestException(`Base price must use ${priceStep} VND increments`);
  }

  return {
    serviceGroupKey: input.serviceGroupKey?.trim() || slugify(name),
    name,
    nameTranslations: normalizeServiceNameTranslationsForPrisma(input.nameTranslations),
    description: input.description?.trim() || null,
    durationMin: input.durationMin,
    basePrice: input.basePrice,
    priceStep,
    displayOrder: input.displayOrder ?? 0,
  };
}

function normalizeServiceNameTranslations(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const translations: Record<string, string> = {};
  for (const key of ['en', 'vi', 'ko', 'ja', 'zh']) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) {
      translations[key] = normalized;
    }
  }
  return Object.keys(translations).length ? translations : null;
}

function normalizeServiceNameTranslationsForPrisma(input: unknown) {
  const translations = normalizeServiceNameTranslations(input);
  return translations === null ? Prisma.JsonNull : (translations as Prisma.InputJsonValue);
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'service';
}
