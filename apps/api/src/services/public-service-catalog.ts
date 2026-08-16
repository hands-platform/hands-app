import {
  Prisma,
  ServiceCatalogProvenance,
  ServicePublicationStatus,
} from '@prisma/client';

export const PUBLIC_SERVICE_CATALOG_DURATIONS = [60, 90, 120] as const;

export const publicServiceCatalogWhere = {
  active: true,
  durationMin: { in: [...PUBLIC_SERVICE_CATALOG_DURATIONS] },
  publicationStatus: ServicePublicationStatus.PUBLISHED,
  provenance: {
    in: [ServiceCatalogProvenance.OPERATOR, ServiceCatalogProvenance.SEED],
  },
} satisfies Prisma.MassageServiceWhereInput;

export function isPublicServiceCatalogOption(option: {
  readonly basePrice: number;
  readonly payoutRules: readonly {
    readonly active?: boolean;
    readonly customerPrice: number;
    readonly providerPayoutAmount: number;
  }[];
}) {
  return option.payoutRules.some(
    (rule) =>
      rule.active !== false &&
      rule.customerPrice === option.basePrice &&
      rule.providerPayoutAmount <= rule.customerPrice,
  );
}
