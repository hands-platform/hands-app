import { Prisma } from '@prisma/client';

export const adminServicePayoutRuleSummarySelect = {
  id: true,
  customerPrice: true,
  providerPayoutAmount: true,
  vatBps: true,
  otherCostAmount: true,
  currency: true,
  active: true,
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
  providers: {
    orderBy: [{ active: 'desc' }, { price: 'asc' }],
    take: 50,
    select: {
      id: true,
      providerProfileId: true,
      serviceId: true,
      price: true,
      active: true,
      providerProfile: {
        select: {
          id: true,
          displayName: true,
          status: true,
          blockedAt: true,
        },
      },
    },
  },
  bookings: {
    orderBy: { id: 'desc' },
    take: 8,
    select: {
      id: true,
      bookingId: true,
      serviceId: true,
      quantity: true,
      price: true,
      booking: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          selectedProviderId: true,
          payment: { select: { method: true, status: true, amount: true, currency: true } },
          earning: {
            select: {
              id: true,
              grossAmount: true,
              platformFee: true,
              withholdingAmount: true,
              netAmount: true,
              status: true,
              currency: true,
            },
          },
          taxLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, withholdingAmount: true, taxableAmount: true, currency: true },
          },
          platformFeeLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, platformFeeAmount: true, currency: true },
          },
          walletLedgerEntries: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, type: true, amount: true, currency: true },
          },
        },
      },
    },
  },
  _count: { select: { providers: true, bookings: true } },
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
  payoutRules: {
    orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
    select: adminServicePayoutRuleMutationSelect,
  },
} satisfies Prisma.MassageServiceSelect;

export const adminServicePayoutRuleWithServiceSelect = {
  ...adminServicePayoutRuleMutationSelect,
  service: { select: adminServiceMutationSelect },
} satisfies Prisma.ServicePayoutRuleSelect;
