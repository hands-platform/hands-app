import { groupServiceCatalogOptions } from './service-catalog-groups';

describe('service catalog groups', () => {
  it('groups service duration options under one service name and sorts by duration', () => {
    const groups = groupServiceCatalogOptions([
      {
        id: 'swedish-90',
        serviceGroupKey: 'swedish_massage',
        name: 'Swedish Massage',
        description: 'Relaxing full-body massage',
        durationMin: 90,
        basePrice: 650000,
        active: true,
        payoutRules: [{ id: 'rule-90' }],
      },
      {
        id: 'swedish-60',
        serviceGroupKey: 'swedish_massage',
        name: 'Swedish Massage',
        description: 'Relaxing full-body massage',
        durationMin: 60,
        basePrice: 500000,
        active: true,
        payoutRules: [{ id: 'rule-60' }],
      },
      {
        id: 'swedish-120',
        serviceGroupKey: 'swedish_massage',
        name: 'Swedish Massage',
        description: 'Relaxing full-body massage',
        durationMin: 120,
        basePrice: 800000,
        active: false,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(
      expect.objectContaining({
        key: 'swedish_massage',
        name: 'Swedish Massage',
        durationSummary: '60 min, 90 min, 120 min',
        activeOptionCount: 2,
        minBasePrice: 500000,
        maxBasePrice: 650000,
        payoutRuleCount: 2,
      }),
    );
    expect(groups[0].missingStandardDurations).toEqual([120]);
    expect(groups[0].options.map((option) => option.id)).toEqual(['swedish-60', 'swedish-90', 'swedish-120']);
  });

  it('builds stable group keys from Vietnamese service names when no explicit key exists', () => {
    const groups = groupServiceCatalogOptions([
      {
        id: 'foot-60',
        name: 'Massage Chân Đá Nóng',
        durationMin: 60,
        basePrice: 500000,
      },
    ]);

    expect(groups[0].key).toBe('massage_chan_da_nong');
  });

  it('falls back to option id when a service name cannot produce a slug', () => {
    const groups = groupServiceCatalogOptions([
      {
        id: 'service-001',
        name: '!!!',
        durationMin: 60,
        basePrice: 500000,
      },
    ]);

    expect(groups[0].key).toBe('service-001');
  });
});
