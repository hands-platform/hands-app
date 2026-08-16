import { Prisma } from '@prisma/client';

export const adminServicePayoutRuleSummarySelect = {
  id: true,
  customerPrice: true,
  providerPayoutAmount: true,
  vatBps: true,
  otherCostAmount: true,
  currency: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  notes: true,
} satisfies Prisma.ServicePayoutRuleSelect;

export const adminProviderServiceSummarySelect = {
  id: true,
  price: true,
  active: true,
  service: {
    select: {
      id: true,
      name: true,
      nameTranslations: true,
      durationMin: true,
      basePrice: true,
      priceStep: true,
      active: true,
      payoutRules: {
        where: { active: true },
        orderBy: { customerPrice: 'asc' },
        select: adminServicePayoutRuleSummarySelect,
      },
    },
  },
} satisfies Prisma.ProviderServiceSelect;

export const adminProviderListServiceSelect = {
  id: true,
  active: true,
  service: {
    select: {
      id: true,
      name: true,
      nameTranslations: true,
      active: true,
    },
  },
} satisfies Prisma.ProviderServiceSelect;

export const adminBookingServiceSummarySelect = {
  id: true,
  bookingId: true,
  serviceId: true,
  quantity: true,
  price: true,
  service: {
    select: {
      id: true,
      serviceGroupKey: true,
      name: true,
      nameTranslations: true,
      durationMin: true,
      basePrice: true,
      priceStep: true,
      active: true,
      payoutRules: {
        where: { active: true },
        orderBy: { customerPrice: 'asc' },
        select: adminServicePayoutRuleSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingServiceSelect;

export const adminBookingListServiceSummarySelect = {
  id: true,
  bookingId: true,
  serviceId: true,
  quantity: true,
  price: true,
  service: {
    select: {
      id: true,
      serviceGroupKey: true,
      name: true,
      nameTranslations: true,
      durationMin: true,
      basePrice: true,
      priceStep: true,
      active: true,
      payoutRules: {
        where: { active: true },
        orderBy: { customerPrice: 'asc' },
        select: {
          customerPrice: true,
          providerPayoutAmount: true,
          currency: true,
          active: true,
        },
      },
    },
  },
} satisfies Prisma.BookingServiceSelect;

export const adminServiceCatalogSelect = {
  id: true,
  serviceGroupKey: true,
  name: true,
  nameTranslations: true,
  description: true,
  durationMin: true,
  basePrice: true,
  priceStep: true,
  displayOrder: true,
  active: true,
  publicationStatus: true,
  provenance: true,
  provenanceRunId: true,
  catalogVersion: true,
  publishedAt: true,
  publishedById: true,
  createdAt: true,
  updatedAt: true,
  payoutRules: {
    orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
    select: {
      id: true,
      serviceId: true,
      customerPrice: true,
      providerPayoutAmount: true,
      vatBps: true,
      otherCostAmount: true,
      currency: true,
      active: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.MassageServiceSelect;

export const adminServicePayoutRuleMutationSelect = {
  id: true,
  serviceId: true,
  customerPrice: true,
  providerPayoutAmount: true,
  vatBps: true,
  otherCostAmount: true,
  currency: true,
  active: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServicePayoutRuleSelect;

export const adminServiceMutationSelect = {
  id: true,
  serviceGroupKey: true,
  name: true,
  nameTranslations: true,
  description: true,
  durationMin: true,
  basePrice: true,
  priceStep: true,
  displayOrder: true,
  active: true,
  publicationStatus: true,
  provenance: true,
  provenanceRunId: true,
  catalogVersion: true,
  publishedAt: true,
  publishedById: true,
  createdAt: true,
  updatedAt: true,
  payoutRules: {
    orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
    select: adminServicePayoutRuleMutationSelect,
  },
} satisfies Prisma.MassageServiceSelect;

export const adminServicePayoutRuleWithServiceSelect = {
  ...adminServicePayoutRuleMutationSelect,
  service: { select: adminServiceMutationSelect },
} satisfies Prisma.ServicePayoutRuleSelect;
