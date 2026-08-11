import {
  normalizePartnerOverviewRange,
  partnerOverviewActiveFilters,
  partnerOverviewDirectoryLink,
  partnerOverviewFreshness,
  partnerOverviewHref,
  partnerOverviewRangeOptions,
  partnerOverviewWithDefaults,
} from './partner-overview-model';

describe('partner overview page model', () => {
  it('offers the low-cost partner overview ranges in operations order', () => {
    expect(partnerOverviewRangeOptions.map((option) => option.value)).toEqual(['today', '7d', '30d', '90d']);
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

  it('preserves supported overview filters in Partner directory drilldowns', () => {
    expect(
      partnerOverviewDirectoryLink('/partners?review=quality-all', '7d', {
        city: 'hcm',
        onlineStatus: 'available',
        serviceId: 'service-1',
        verificationStatus: 'APPROVED',
        walletStatus: 'negative',
      }),
    ).toEqual({
      exact: true,
      href:
        '/partners?review=quality-all&city=hcm&onlineStatus=available&serviceId=service-1&verification=APPROVED&walletStatus=negative&qualityRange=7d',
    });
  });

  it('marks drilldowns as a broader queue when bounded risk classification cannot be replayed', () => {
    expect(
      partnerOverviewDirectoryLink('/partners?review=available-blocked', '30d', {
        city: 'hcm',
        riskStatus: 'high',
        walletStatus: 'negative',
      }),
    ).toEqual({
      exact: false,
      href: '/partners?review=available-blocked&city=hcm&walletStatus=negative',
    });
  });

  it('marks Partner Operations stale after two declared refresh intervals', () => {
    const now = Date.parse('2026-08-08T04:02:01.000Z');

    expect(partnerOverviewFreshness('2026-08-08T04:01:01.000Z', 60, now).stale).toBe(false);
    expect(partnerOverviewFreshness('2026-08-08T03:59:59.000Z', 60, now).stale).toBe(true);
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
        source: 'live-summary-backed-partner-operational-query',
        timeZone: 'Asia/Ho_Chi_Minh',
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
    expect(overview.appActivity.kpis).toEqual([]);
    expect(overview.appActivity.mostActive).toEqual([]);
    expect(overview.appActivity.inactivePartners).toEqual([]);
    expect(overview.operatingStatus.availableBlockedReasons).toEqual([]);
    expect(overview.operatingStatus.customerDiscovery).toEqual({
      visibleNow: 0,
      visibleHref: '/partners?review=customer-visible-now',
      blockers: [],
    });
    expect(overview.bookingQuality.riskPartners).toEqual([]);
    expect(overview.financeWalletRisk.negativeWalletPartners).toEqual([]);
    expect(overview.filterOptions.services).toEqual([]);
    expect(overview.queryScope).toEqual({
      actionListCountScope: 'full-population',
      appActivityCountScope: 'full-population',
      operatingStatusCountScope: 'full-population',
      providerScanLimit: 500,
      walletBalancePartnerCount: 0,
      walletBalanceScopeTruncated: false,
      walletStatusFilterBounded: false,
    });
    expect(overview.actionLists).toEqual([]);
    expect(overview.segments).toEqual([]);
  });
});
