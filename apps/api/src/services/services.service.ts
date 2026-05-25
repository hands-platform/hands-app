import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PRICE_STEP_UNIT_VND = 100000;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.massageService.findMany({
      where: { active: true },
      include: {
        payoutRules: {
          where: { active: true },
          orderBy: { customerPrice: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
    });
  }

  create(input: {
    serviceGroupKey?: string;
    name: string;
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
    description: input.description?.trim() || null,
    durationMin: input.durationMin,
    basePrice: input.basePrice,
    priceStep,
    displayOrder: input.displayOrder ?? 0,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
