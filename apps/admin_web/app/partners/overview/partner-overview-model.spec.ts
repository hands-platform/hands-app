import {
  normalizePartnerOverviewRange,
  partnerOverviewActiveFilters,
  partnerOverviewHref,
  partnerOverviewRangeOptions,
  partnerOverviewWithDefaults,
} from './partner-overview-model';

describe('partner overview page model', () => {
  it('offers the low-cost partner overview ranges in operations order', () => {
    expect(partnerOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      '7d',
      '30d',
      '90d',
    ]);
  });

  it('defaults to today and rejects unsupported ranges', () => {
    expect(normalizePartnerOverviewRange(undefined)).toBe('today');
    expect(normalizePartnerOverviewRange('all')).toBe('today');
    expect(normalizePartnerOverviewRange('30d')).toBe('30d');
  });

  it('builds stable filter links without adding empty filters', () => {
    expect(partnerOverviewHref('7d', { city: 'hcm', walletStatus: 'negative', serviceId: null })).toBe(
      '/partners/overview?range=7d&city=hcm&walletStatus=negative',
    );
  });

  it('summarizes active filters with remove links', () => {
    expect(
      partnerOverviewActiveFilters('30d', {
        city: 'hcm',
        onlineStatus: '',
        riskStatus: 'high',
        serviceId: 'service-1',
        walletStatus: 'negative',
      }),
    ).toEqual([
      {
        key: 'city',
        label: 'City / area',
        value: 'hcm',
        removeHref: '/partners/overview?range=30d&riskStatus=high&serviceId=service-1&walletStatus=negative',
      },
      {
        key: 'riskStatus',
        label: 'Risk',
        value: 'High',
        removeHref: '/partners/overview?range=30d&city=hcm&serviceId=service-1&walletStatus=negative',
      },
      {
        key: 'serviceId',
        label: 'Service',
        value: 'service-1',
        removeHref: '/partners/overview?range=30d&city=hcm&riskStatus=high&walletStatus=negative',
      },
      {
        key: 'walletStatus',
        label: 'Wallet',
        value: 'Negative',
        removeHref: '/partners/overview?range=30d&city=hcm&riskStatus=high&serviceId=service-1',
      },
    ]);
  });

  it('fills missing aggregate sections from an older API payload', () => {
    const overview = partnerOverviewWithDefaults(
      {
        generatedAt: '2026-07-02T00:00:00.000Z',
        refreshSeconds: 60,
        source: 'stored-partner-supply-aggregates',
        range: '7d',
        rangeLabel: 'Last 7 days',
        summaryKpis: [
          {
            key: 'totalPartners',
            label: 'Total Partners',
            value: 10,
            detail: 'Registered',
            unit: 'count',
            deltaPercent: null,
          },
        ],
      },
      '7d',
    );

    expect(overview.summaryKpis).toHaveLength(1);
    expect(overview.supplyHealth.areas).toEqual([]);
    expect(overview.supplyHealth.services).toEqual([]);
    expect(overview.funnel.steps).toEqual([]);
    expect(overview.bookingQuality.riskPartners).toEqual([]);
    expect(overview.financeWalletRisk.negativeWalletPartners).toEqual([]);
    expect(overview.actionLists).toEqual([]);
    expect(overview.segments).toEqual([]);
  });
});
