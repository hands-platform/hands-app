import { ServiceCatalogProvenance, ServicePublicationStatus } from '@prisma/client';
import { ServicesService } from './services.service';

describe('ServicesService public catalog', () => {
  it('returns only published standard active options with an exact safe payout rule', async () => {
    const findMany = vi.fn().mockResolvedValue([
      serviceRow({ id: 'valid', payoutRules: [payoutRule(500_000, 350_000)] }),
      serviceRow({ id: 'missing-exact', payoutRules: [payoutRule(600_000, 350_000)] }),
      serviceRow({ id: 'payout-above-price', payoutRules: [payoutRule(500_000, 550_000)] }),
    ]);
    const service = new ServicesService({ massageService: { findMany } } as never);

    const result = await service.listActive();
    expect(result).toEqual([
      expect.objectContaining({
        id: 'valid',
        basePrice: 500_000,
        durationMin: 60,
        nameTranslations: { en: 'Foot Massage', vi: 'Massage chân' },
      }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          durationMin: { in: [60, 90, 120] },
          publicationStatus: ServicePublicationStatus.PUBLISHED,
          provenance: {
            in: [ServiceCatalogProvenance.OPERATOR, ServiceCatalogProvenance.SEED],
          },
        },
        select: expect.not.objectContaining({ notes: true }),
      }),
    );
    expect(result[0]).not.toHaveProperty('payoutRules');
  });

  it('keeps a three-group, nine-option public payload below 32 KB without extra queries', async () => {
    const findMany = vi.fn().mockResolvedValue(
      ['foot', 'swedish', 'deep_tissue'].flatMap((groupKey, groupIndex) =>
        [60, 90, 120].map((durationMin, durationIndex) =>
          serviceRow({
            id: `${groupKey}-${durationMin}`,
            serviceGroupKey: groupKey,
            durationMin,
            displayOrder: groupIndex * 10 + durationIndex,
            payoutRules: [payoutRule(500_000 + durationIndex * 100_000, 300_000 + durationIndex * 100_000)],
            basePrice: 500_000 + durationIndex * 100_000,
          }),
        ),
      ),
    );
    const service = new ServicesService({ massageService: { findMany } } as never);

    const groups = await service.listActiveGroups();

    expect(groups).toHaveLength(3);
    expect(groups.flatMap((group) => group.options)).toHaveLength(9);
    expect(groups.every((group) => !('payoutRuleCount' in group))).toBe(true);
    expect(JSON.stringify(groups)).not.toMatch(/payout|providerPayout|grossFee|platformFee/i);
    expect(Buffer.byteLength(JSON.stringify(groups), 'utf8')).toBeLessThanOrEqual(32 * 1024);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

function serviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'service-1',
    serviceGroupKey: 'foot',
    name: 'Foot Massage',
    nameTranslations: { en: 'Foot Massage', vi: 'Massage chân' },
    description: 'Massage service',
    durationMin: 60,
    basePrice: 500_000,
    priceStep: 100_000,
    displayOrder: 1,
    payoutRules: [payoutRule(500_000, 350_000)],
    ...overrides,
  };
}

function payoutRule(customerPrice: number, providerPayoutAmount: number) {
  return { id: `rule-${customerPrice}-${providerPayoutAmount}`, customerPrice, providerPayoutAmount };
}
