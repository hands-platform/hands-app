import {
  CalendarClock,
  CheckCircle2,
  MapPinned,
  ShieldCheck,
  UserCheck,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import dynamicComponent from 'next/dynamic';
import type { ReactNode } from 'react';
import {
  type AdminVietnamOverview,
  AdminVietnamOverviewSummary,
  AdminVietnamOverviewRealtimePointFeed,
  adminGet,
} from '../../lib/admin-api';
import {
  normalizeVietnamOverviewRange,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewRealtimeMetricDotLegend,
  vietnamOverviewRealtimeMapPoints,
  vietnamOverviewRealtimePointsApiHref,
  vietnamOverviewRealtimePointCounts,
  vietnamOverviewRangeOptions,
} from './vietnam-overview-model';
import type { VietnamOverviewLiveMapProps } from './vietnam-overview-live-map';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminOverviewGrid, AdminSummaryCardGrid } from '../../components/admin-overview-card';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminCard, AdminCardGrid, AdminKpiCard, AdminRowLink, AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';
import { formatWholeNumber as formatNumber } from '../../lib/admin-format';

export const dynamic = 'force-dynamic';

const VietnamOverviewLiveMap = dynamicComponent<VietnamOverviewLiveMapProps>(
  () => import('./vietnam-overview-live-map').then((mod) => mod.VietnamOverviewLiveMap),
  {
    loading: () => (
      <div
        aria-label="Vietnam overview map loading"
        className="vietnam-maplibre-shell is-loading"
      />
    ),
  },
);

type VietnamOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const emptyVietnamOverview: AdminVietnamOverviewSummary = {
  generatedAt: new Date(0).toISOString(),
  refreshSeconds: 60,
  source: 'stored-address-aggregates',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: null,
  windowEndAt: null,
  totals: {
    customerCount: 0,
    activeCustomerCount: 0,
    partnerCount: 0,
    onlinePartnerCount: 0,
    activeBookingCount: 0,
    completedBookingCount: 0,
    cancellationCount: 0,
    revenueAmount: 0,
    currency: 'VND',
  },
  regions: [],
  points: [],
};

const emptyVietnamOverviewRealtimePointFeed: AdminVietnamOverviewRealtimePointFeed = {
  generatedAt: new Date(0).toISOString(),
  refreshSeconds: 60,
  source: 'stored-address-aggregates',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: null,
  windowEndAt: null,
  realtimePoints: [],
};

const VIETNAM_REGION_HEADERS = [
  'Region',
  'Load',
  'Customers',
  'Active',
  'Partners',
  'Ready',
  'Bookings',
  'Done',
  'Cancel',
  'Paid volume',
] as const;

export default async function VietnamOverviewPage({
  searchParams,
}: {
  searchParams?: VietnamOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizeVietnamOverviewRange(params?.range);
  const activeSignalKeys = normalizeVietnamOverviewSignalFilters(params?.signals);
  const activeSignalSet = new Set<VietnamOverviewMetricDotKey>(activeSignalKeys);
  const [overview, realtimePointFeed] = await Promise.all([
    adminGet<AdminVietnamOverviewSummary>(
      `/admin/vietnam-overview/summary?range=${range}`,
      emptyVietnamOverview,
    ),
    adminGet<AdminVietnamOverviewRealtimePointFeed>(
      vietnamOverviewRealtimePointsApiHref(),
      emptyVietnamOverviewRealtimePointFeed,
    ),
  ]);
  const regions = overview.regions;
  const activeRegion = normalizeVietnamOverviewRegionFilter(params?.region, regions);
  const activeRegionCode = activeRegion?.regionCode ?? null;
  const realtimePointSource = realtimePointFeed.realtimePoints;
  const allRealtimeMapPoints = vietnamOverviewRealtimeMapPoints(realtimePointSource);
  const regionalRealtimeMapPoints = activeRegionCode
    ? allRealtimeMapPoints.filter((point) => point.regionCode === activeRegionCode)
    : allRealtimeMapPoints;
  const mapPoints = regionalRealtimeMapPoints.filter((point) => activeSignalSet.has(point.kind));
  const allMapPointCounts = vietnamOverviewRealtimePointCounts(regionalRealtimeMapPoints);
  const visibleRegions = activeRegion
    ? [activeRegion]
    : [...regions].sort(
        (left, right) => vietnamRegionOperatingScore(right) - vietnamRegionOperatingScore(left),
      );
  const maxRegionOperatingScore = Math.max(1, ...visibleRegions.map(vietnamRegionOperatingScore));
  const regionFocusHrefs = vietnamOverviewRegionFocusHrefs(range, activeSignalKeys, regions);
  const clearRegionHref = vietnamOverviewHrefWithState({ range, signalKeys: activeSignalKeys });
  const metricTotals = activeRegion ?? overview.totals;
  const customerMetricScopeLabel = activeRegion ? `${activeRegion.shortName} customers` : 'stored customers';
  const periodClosedWorkCount = metricTotals.completedBookingCount + metricTotals.cancellationCount;
  const periodWorkVolume =
    metricTotals.activeBookingCount + metricTotals.completedBookingCount + metricTotals.cancellationCount;
  const periodCompletionRate = percentage(metricTotals.completedBookingCount, periodClosedWorkCount);
  const periodCancellationRate = percentage(metricTotals.cancellationCount, periodClosedWorkCount);
  const partnerReadyRate = percentage(metricTotals.onlinePartnerCount, metricTotals.partnerCount);
  const activeCustomerRate = percentage(metricTotals.activeCustomerCount, metricTotals.customerCount);
  const activeBookingShare = percentage(metricTotals.activeBookingCount, periodWorkVolume);
  const periodWindowLabel: ReactNode = overview.windowStartAt && overview.windowEndAt
    ? (
        <>
          <DateTimeText fallback="pending" value={overview.windowStartAt} />
          {' - '}
          <DateTimeText fallback="pending" value={overview.windowEndAt} />
        </>
      )
    : 'All stored period data';
  const regionRealtimeSummary = [
    { label: 'All customers', value: formatNumber(allMapPointCounts.customers), tone: 'primary' },
    { label: 'Active customers', value: formatNumber(allMapPointCounts.active), tone: 'info' },
    { label: 'Ready Partners', value: formatNumber(allMapPointCounts.online), tone: 'success' },
    { label: '7d inactive Partners', value: formatNumber(allMapPointCounts['stale-partners']), tone: 'danger' },
    { label: 'Offline Partners', value: formatNumber(allMapPointCounts['offline-partners']), tone: 'neutral' },
    { label: 'Active bookings', value: formatNumber(allMapPointCounts.bookings), tone: 'warning' },
  ];
  const regionPeriodSummary = [
    { label: 'Customers', value: formatNumber(metricTotals.customerCount) },
    { label: 'Partners', value: formatNumber(metricTotals.partnerCount) },
    { label: 'Completed', value: formatNumber(metricTotals.completedBookingCount) },
    { label: 'Canceled', value: formatNumber(metricTotals.cancellationCount) },
    {
      label: 'Paid volume',
      value: <MoneyText amount={metricTotals.revenueAmount} currency={metricTotals.currency} />,
    },
  ];
  const periodFilterSummary = [
    {
      label: 'Window',
      value: overview.rangeLabel,
      detail: periodWindowLabel,
      tone: 'info',
    },
    {
      label: 'Focus',
      value: activeRegion ? activeRegion.regionName : 'All Vietnam',
      detail: activeRegion
        ? `${activeRegion.shortName} period report and map focus`
        : `${formatNumber(regions.length)} regions included`,
      tone: 'primary',
    },
    {
      label: 'Work volume',
      value: formatNumber(periodWorkVolume),
      detail: `${formatNumber(metricTotals.activeBookingCount)} active - ${formatNumber(metricTotals.completedBookingCount)} done - ${formatNumber(metricTotals.cancellationCount)} cancel`,
      tone: periodWorkVolume > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Completion rate',
      value: formatPercent(periodCompletionRate),
      detail: periodClosedWorkCount > 0
        ? `${formatNumber(metricTotals.completedBookingCount)} completed of ${formatNumber(periodClosedWorkCount)} closed`
        : (
            <>
              Generated <DateTimeText fallback="pending" value={overview.generatedAt} />
            </>
          ),
      tone: periodClosedWorkCount > 0 ? 'success' : 'neutral',
    },
  ];
  const realtimeSignalTotal = vietnamOverviewRealtimeMetricDotLegend.reduce(
    (total, item) => total + allMapPointCounts[item.key],
    0,
  );
  const maxRealtimeSignalCount = Math.max(
    1,
    ...vietnamOverviewRealtimeMetricDotLegend.map((item) => allMapPointCounts[item.key]),
  );
  const realtimeSignalRows = vietnamOverviewRealtimeMetricDotLegend.map((item) => ({
    ...item,
    value: allMapPointCounts[item.key],
    percent: Math.max(6, Math.round((allMapPointCounts[item.key] / maxRealtimeSignalCount) * 100)),
  }));
  const realtimeRegionCandidates = activeRegion ? [activeRegion] : regions;
  const realtimeRegionRows = [...realtimeRegionCandidates]
    .map((region) => {
      const regionPointCounts = vietnamOverviewRealtimePointCounts(
        regionalRealtimeMapPoints.filter((point) => point.regionCode === region.regionCode),
      );
      const load = vietnamRegionRealtimePointScore(regionPointCounts);

      return {
        counts: regionPointCounts,
        href: regionFocusHrefs[region.regionCode],
        load,
        region,
      };
    })
    .filter(({ load }) => load > 0)
    .sort((left, right) => right.load - left.load);
  const topRealtimeRegionRows = realtimeRegionRows.slice(0, 5);
  const realtimeHotRegion = realtimeRegionRows[0] ?? null;
  const maxRealtimeRegionLoad = Math.max(1, ...topRealtimeRegionRows.map((item) => item.load));
  const partnerCoverageGap = allMapPointCounts.online - allMapPointCounts.bookings;
  const partnerCoveragePercent = allMapPointCounts.bookings > 0
    ? Math.min(100, Math.round((allMapPointCounts.online / allMapPointCounts.bookings) * 100))
    : allMapPointCounts.online > 0
      ? 100
      : 0;
  const partnerCoverageLabel = allMapPointCounts.bookings === 0
    ? 'No active booking pressure'
    : partnerCoverageGap >= 0
      ? `${formatSignedNumber(partnerCoverageGap)} Partner coverage`
      : `${formatNumber(Math.abs(partnerCoverageGap))} booking coverage gap`;
  const activeSignalLabel = activeSignalKeys.length === vietnamOverviewAllSignalKeys.length
    ? 'All realtime signals'
    : vietnamOverviewRealtimeMetricDotLegend
      .filter((item) => activeSignalKeys.includes(item.key))
      .map((item) => item.label)
      .join(', ');
  const realtimeOperatorCards = [
    {
      label: 'Live demand',
      value: formatNumber(allMapPointCounts.bookings),
      detail: `${formatNumber(allMapPointCounts.active)} active / ${formatNumber(allMapPointCounts.customers)} saved customers`,
      icon: CalendarClock,
      tone: 'warning',
      progress: Math.max(6, Math.round((allMapPointCounts.bookings / maxRealtimeSignalCount) * 100)),
    },
    {
      label: 'Ready partners',
      value: formatNumber(allMapPointCounts.online),
      detail: `${partnerCoverageLabel} · ${formatNumber(allMapPointCounts['stale-partners'])} stale / ${formatNumber(allMapPointCounts['offline-partners'])} offline`,
      icon: UserCheck,
      tone: partnerCoverageGap < 0 ? 'danger' : 'success',
      progress: Math.max(6, partnerCoveragePercent),
    },
    {
      label: 'Realtime focus',
      value: realtimeHotRegion?.region.shortName ?? '-',
      detail: realtimeHotRegion
        ? `${realtimeHotRegion.region.regionName} · ${formatNumber(realtimeHotRegion.load)} live load`
        : 'No active live dots now',
      icon: MapPinned,
      tone: 'primary',
      progress: realtimeHotRegion
        ? Math.max(6, Math.round((realtimeHotRegion.load / maxRealtimeRegionLoad) * 100))
        : 0,
    },
    {
      label: 'Map signal sample',
      value: `${formatNumber(mapPoints.length)}/${formatNumber(regionalRealtimeMapPoints.length)}`,
      detail: activeSignalLabel,
      icon: ShieldCheck,
      tone: mapPoints.length > 0 ? 'info' : 'neutral',
      progress: regionalRealtimeMapPoints.length > 0
        ? Math.max(6, Math.round((mapPoints.length / regionalRealtimeMapPoints.length) * 100))
        : 0,
    },
  ];
  const metrics = [
    {
      label: 'Customers',
      value: formatNumber(metricTotals.customerCount),
      detail: `${formatNumber(metricTotals.activeCustomerCount)} active sessions - ${formatPercent(activeCustomerRate)} of ${customerMetricScopeLabel}`,
      icon: Users,
      tone: 'info',
    },
    {
      label: 'Partners',
      value: formatNumber(metricTotals.partnerCount),
      detail: `${formatNumber(metricTotals.onlinePartnerCount)} ready - ${formatPercent(partnerReadyRate)} of listed Partners`,
      icon: UserCheck,
      tone: 'success',
    },
    {
      label: 'Active bookings',
      value: formatNumber(metricTotals.activeBookingCount),
      detail: periodWorkVolume > 0
        ? `${formatPercent(activeBookingShare)} of period work volume still open`
        : 'No active booking pressure in this period',
      icon: CalendarClock,
      tone: 'warning',
    },
    {
      label: 'Completed',
      value: formatNumber(metricTotals.completedBookingCount),
      detail: periodClosedWorkCount > 0
        ? `${formatPercent(periodCompletionRate)} of closed work`
        : 'No closed work in this period',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Cancellations',
      value: formatNumber(metricTotals.cancellationCount),
      detail: periodClosedWorkCount > 0
        ? `${formatPercent(periodCancellationRate)} of closed work needs review`
        : 'No cancellation pressure in this period',
      icon: XCircle,
      tone: 'danger',
    },
    {
      label: 'Paid volume',
      value: <MoneyText amount={metricTotals.revenueAmount} currency={metricTotals.currency} />,
      detail: 'Captured/released customer payment amount, not net platform revenue',
      icon: WalletCards,
      tone: 'primary',
    },
  ];
  const periodRegionDemandLeaders = [...visibleRegions].sort(
    (left, right) => vietnamRegionOperatingScore(right) - vietnamRegionOperatingScore(left),
  );
  const busiestRegion = periodRegionDemandLeaders[0] ?? null;
  const completionLeader = [...visibleRegions].sort(
    (left, right) => right.completedBookingCount - left.completedBookingCount,
  )[0] ?? null;
  const cancellationWatchRegion = [...visibleRegions].sort(
    (left, right) => right.cancellationCount - left.cancellationCount,
  )[0] ?? null;
  const visibleRegionPartnerCount = visibleRegions.reduce((total, region) => total + region.partnerCount, 0);
  const visibleRegionReadyPartnerCount = visibleRegions.reduce(
    (total, region) => total + region.onlinePartnerCount,
    0,
  );
  const visibleRegionReadyRate = percentage(visibleRegionReadyPartnerCount, visibleRegionPartnerCount);
  const periodRegionalInsights = [
    {
      label: 'Busiest region',
      value: busiestRegion?.shortName ?? '-',
      detail: busiestRegion
        ? `${formatNumber(vietnamRegionOperatingScore(busiestRegion))} demand load`
        : 'No period demand loaded',
      tone: busiestRegion && vietnamRegionOperatingScore(busiestRegion) > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Ready supply',
      value: formatNumber(visibleRegionReadyPartnerCount),
      detail: `${formatPercent(visibleRegionReadyRate)} of ${formatNumber(visibleRegionPartnerCount)} Partners ready`,
      tone: visibleRegionReadyPartnerCount > 0 ? 'success' : 'neutral',
    },
    {
      label: 'Completion leader',
      value: completionLeader?.shortName ?? '-',
      detail: completionLeader && completionLeader.completedBookingCount > 0
        ? `${formatNumber(completionLeader.completedBookingCount)} completed bookings`
        : 'No completed bookings in range',
      tone: completionLeader && completionLeader.completedBookingCount > 0 ? 'success' : 'neutral',
    },
    {
      label: 'Cancellation watch',
      value: cancellationWatchRegion?.shortName ?? '-',
      detail: cancellationWatchRegion && cancellationWatchRegion.cancellationCount > 0
        ? `${formatNumber(cancellationWatchRegion.cancellationCount)} cancellation records`
        : 'No cancellation pressure in range',
      tone: cancellationWatchRegion && cancellationWatchRegion.cancellationCount > 0 ? 'danger' : 'neutral',
    },
  ];

  return (
    <AdminPageTemplate
      contentClassName="vietnam-overview-page"
      description="Realtime operating map for saved customer addresses, active customers, ready Partners, offline Partners, 7-day inactive Partners, and active bookings across Vietnam. Period metrics are summarized below without paid map lookup."
      title="Vietnam Overview"
    >
      <AdminOverviewGrid
        ariaLabel="Realtime Vietnam operations dashboard"
        baseClassName="vietnam-realtime-dashboard"
        variant="content"
      >
        <AdminCardGrid ariaLabel="Realtime Vietnam signal widgets" className="vietnam-realtime-widget-grid">
          {realtimeOperatorCards.map(({ label, value, detail, icon: Icon, tone, progress }) => (
            <AdminCard key={label} className={`vietnam-realtime-widget is-${tone}`}>
              <div className="vietnam-realtime-widget-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <div className="vietnam-realtime-widget-copy">
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
              <div className="vietnam-realtime-widget-meter" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
            </AdminCard>
          ))}
        </AdminCardGrid>

        <AdminCardGrid ariaLabel="Realtime Vietnam analytics cards" className="vietnam-realtime-analytics-grid">
          <AdminSection
            actions={<strong>{formatNumber(realtimeSignalTotal)}</strong>}
            bodyClassName="vietnam-realtime-signal-bars"
            className="vietnam-realtime-chart-card"
            description="Current dots only, separate from period totals."
            title="Realtime signal mix"
          >
            {realtimeSignalRows.map((item) => (
              <div key={item.key} className={`vietnam-realtime-signal-row is-${item.key}`}>
                <div className="vietnam-realtime-signal-label">
                  <i aria-hidden="true" />
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value)}</strong>
                </div>
                <div className="vietnam-realtime-signal-track" aria-hidden="true">
                  <i style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </AdminSection>

          <AdminSection
            actions={<span>{activeRegion ? 'Focused map below' : 'Top 5'}</span>}
            bodyClassName="vietnam-realtime-region-bars"
            className="vietnam-realtime-chart-card"
            description="Regions ranked by bookings, active customers, ready Partners, and offline supply."
            title="Regional live load"
          >
            {topRealtimeRegionRows.map(({ counts, region, load, href }) => {
              const loadPercent = Math.max(6, Math.round((load / maxRealtimeRegionLoad) * 100));

              return (
                <AdminRowLink key={region.regionCode} className="vietnam-realtime-region-row" href={href}>
                  <span>{region.shortName}</span>
                  <div>
                    <strong>{region.regionName}</strong>
                    <small>
                      {formatNumber(counts.bookings)} bookings ·{' '}
                      {formatNumber(counts.active)} active ·{' '}
                      {formatNumber(counts.online)} ready ·{' '}
                      {formatNumber(counts['stale-partners'] + counts['offline-partners'])} off
                    </small>
                    <i aria-hidden="true">
                      <b style={{ width: `${loadPercent}%` }} />
                    </i>
                  </div>
                  <em>{formatNumber(load)}</em>
                </AdminRowLink>
              );
            })}
            {topRealtimeRegionRows.length === 0 ? (
              <AdminEmptyState
                className="vietnam-realtime-empty"
                framed
                message="Live regional load appears when current map dots are available."
                title="No realtime regional load yet"
              />
            ) : null}
          </AdminSection>
        </AdminCardGrid>
      </AdminOverviewGrid>

      <AdminSection
        actions={
          <>
            <StatusBadge tone="success">Vietnam only</StatusBadge>
            {activeRegion ? (
              <StatusBadge tone="primary">Focused: {activeRegion.regionName}</StatusBadge>
            ) : null}
            <StatusBadge tone="info">Refreshes every {overview.refreshSeconds}s</StatusBadge>
            <StatusBadge tone="info">
              Generated <DateTimeText fallback="pending" value={overview.generatedAt} />
            </StatusBadge>
          </>
        }
        bodyClassName="vietnam-overview-map-layout"
        className="vietnam-overview-map-card"
        title="Realtime Vietnam operating map"
      >
          <div className="vietnam-region-map vietnam-map-canvas" aria-label="Vietnam operating map">
            <VietnamOverviewLiveMap
              clearRegionHref={activeRegion ? clearRegionHref : null}
              focusRegionCode={activeRegionCode}
              focusRegionName={activeRegion?.regionName ?? null}
              focusRegionShortName={activeRegion?.shortName ?? null}
              points={mapPoints}
              signalFilters={vietnamOverviewRealtimeMetricDotLegend.map((item) => ({
                count: allMapPointCounts[item.key],
                href: vietnamOverviewSignalHref(range, item.key, activeSignalKeys, activeRegionCode),
                isActive: activeSignalSet.has(item.key),
                key: item.key,
                label: item.label,
              }))}
              totalPointCount={regionalRealtimeMapPoints.length}
            />
          </div>
      </AdminSection>

      <AdminSection
        actions={
          <>
            {activeRegion ? (
              <StatusBadgeLink
                className="vietnam-overview-clear-focus"
                href={clearRegionHref}
                tone="primary"
              >
                Clear {activeRegion.shortName}
              </StatusBadgeLink>
            ) : null}
            <StatusBadge tone="info">{overview.rangeLabel}</StatusBadge>
          </>
        }
        bodyClassName="vietnam-overview-filter-body"
        className="vietnam-overview-filter-panel"
        description="Select the period used by numeric cards and regional tables. Realtime map dots stay current."
        title="Period metrics range"
      >
          <AdminSegmentedControl
            activeValue={range}
            ariaLabel="Period metric range"
            className="vietnam-overview-range-buttons"
            options={vietnamOverviewRangeOptions.map((option) => ({
              href: vietnamOverviewHrefWithState({
                range: option.value,
                regionCode: activeRegionCode,
                signalKeys: activeSignalKeys,
              }),
              label: option.label,
              value: option.value,
            }))}
          />
          <AdminSummaryCardGrid
            ariaLabel="Selected Vietnam overview filters"
            className="vietnam-overview-filter-summary-grid"
            itemClassName="vietnam-overview-filter-summary-card"
            items={periodFilterSummary}
          />
      </AdminSection>

      {activeRegion ? (
        <AdminSection
          actions={<StatusBadge tone="primary">{activeRegion.shortName}</StatusBadge>}
          bodyClassName="vietnam-region-focus-summary-grid"
          className="vietnam-region-focus-summary-card"
          description={`Focused operating readout for realtime signals and ${overview.rangeLabel} totals.`}
          title={activeRegion.regionName}
        >
            <div className="vietnam-region-focus-summary-group">
              <div className="vietnam-region-focus-summary-group-label">
                <strong>Realtime map signals</strong>
                <span>Current operating dots only</span>
              </div>
              <AdminSummaryCardGrid
                className="vietnam-region-focus-summary-items is-realtime"
                itemClassName="vietnam-region-focus-summary-item"
                items={regionRealtimeSummary.map((item) => ({
                  ...item,
                  overline: 'Realtime',
                }))}
              />
            </div>
            <div className="vietnam-region-focus-summary-group">
              <div className="vietnam-region-focus-summary-group-label">
                <strong>Period totals</strong>
                <span>{overview.rangeLabel} stored event totals</span>
              </div>
              <AdminSummaryCardGrid
                className="vietnam-region-focus-summary-items is-period"
                itemClassName="vietnam-region-focus-summary-item"
                items={regionPeriodSummary.map((item) => ({
                  ...item,
                  overline: overview.rangeLabel,
                }))}
              />
            </div>
        </AdminSection>
      ) : null}

      <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{overview.rangeLabel}</StatusBadge>
            <StatusBadge tone="success">Stored totals</StatusBadge>
          </>
        }
        bodyClassName="vietnam-overview-metric-grid"
        className="vietnam-overview-period-report-card vietnam-overview-report-band"
        description={
          <>
            Stored customer, Partner, booking, cancellation, and paid volume totals for {overview.rangeLabel}.
            Paid volume is gross captured/released payment amount, not company net revenue.
          </>
        }
        headerClassName="vietnam-overview-report-header"
        title={activeRegion ? `${activeRegion.regionName} period report` : 'Vietnam period report'}
      >
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <AdminKpiCard
            className={`vietnam-overview-metric is-${tone}`}
            helper={detail}
            icon={Icon}
            iconSize={18}
            key={label}
            label={label}
            value={value}
          />
        ))}
      </AdminSection>

      <AdminSection
        actions={
          <div className="actions vietnam-overview-region-actions">
            <StatusBadge tone="info">{overview.rangeLabel}</StatusBadge>
            <StatusBadge tone={activeRegion ? 'primary' : 'neutral'}>
              {activeRegion ? `Map focus: ${activeRegion.shortName}` : `${visibleRegions.length} regions`}
            </StatusBadge>
          </div>
        }
        bodyClassName="vietnam-overview-region-card-body"
        className="vietnam-overview-region-card"
        description={
          activeRegion
            ? 'Focused period demand, supply, closeout, and paid volume for the selected region.'
            : `Compare period demand, supply readiness, closeout, cancellations, and paid volume by region for ${overview.rangeLabel}.`
        }
        title={activeRegion ? `${activeRegion.regionName} metrics` : 'Period regional metrics'}
      >
        <AdminSummaryCardGrid
          ariaLabel="Regional operations highlights"
          className="vietnam-overview-region-insight-grid"
          itemClassName="vietnam-overview-region-insight-card"
          items={periodRegionalInsights}
        />
        <AdminTableScroll className="vietnam-overview-table-wrap">
          <AdminDataTable
            className="vietnam-overview-table"
            emptyMessage={
              <AdminEmptyState
                message="Check API availability or seed stored address records."
                title="No regional aggregates loaded"
              />
            }
            headers={VIETNAM_REGION_HEADERS}
            rowCount={visibleRegions.length}
          >
              {visibleRegions.map((region) => {
                const operatingScore = vietnamRegionOperatingScore(region);
                const loadLevel = vietnamRegionLoadLevel(operatingScore, maxRegionOperatingScore);
                const loadPercent = Math.round((operatingScore / maxRegionOperatingScore) * 100);
                const isFocusedRegion = region.regionCode === activeRegionCode;

                return (
                  <tr
                    key={region.regionCode}
                    aria-current={isFocusedRegion ? 'true' : undefined}
                    className={isFocusedRegion ? 'is-focused-region' : ''}
                  >
                    <td>
                      <div className="vietnam-region-name">
                        <span>{region.shortName}</span>
                        <div>
                          <strong>{region.regionName}</strong>
                          {isFocusedRegion ? (
                            <span className="vietnam-region-focus-status">Selected on map</span>
                          ) : null}
                          <div
                            className="vietnam-region-signal-row"
                            aria-label={`${region.regionName} realtime signals`}
                          >
                            <span className="is-active">
                              <i aria-hidden="true" />
                              <strong>{formatNumber(region.activeCustomerCount)}</strong>
                              {' '}
                              <small>Active</small>
                            </span>
                            <span className="is-online">
                              <i aria-hidden="true" />
                              <strong>{formatNumber(region.onlinePartnerCount)}</strong>
                              {' '}
                              <small>Ready</small>
                            </span>
                            <span className="is-bookings">
                              <i aria-hidden="true" />
                              <strong>{formatNumber(region.activeBookingCount)}</strong>
                              {' '}
                              <small>Bookings</small>
                            </span>
                          </div>
                          <a
                            className="vietnam-region-focus-link"
                            href={
                              isFocusedRegion
                                ? clearRegionHref
                                : regionFocusHrefs[region.regionCode]
                            }
                          >
                            {isFocusedRegion ? 'Clear focus' : 'Focus on map'}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={`vietnam-region-load is-${loadLevel}`}>
                        <div className="vietnam-region-load-header">
                          <span>{vietnamRegionLoadLabel(loadLevel)}</span>
                          <strong>{formatNumber(operatingScore)}</strong>
                        </div>
                        <div className="vietnam-region-load-bar" aria-hidden="true">
                          <i style={{ width: `${loadPercent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell value={formatNumber(region.customerCount)} />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.activeCustomerCount)}
                        tone="info"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.partnerCount)}
                        tone="primary"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.onlinePartnerCount)}
                        tone="success"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.activeBookingCount)}
                        tone="warning"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.completedBookingCount)}
                        tone="success"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={formatNumber(region.cancellationCount)}
                        tone="danger"
                      />
                    </td>
                    <td className="vietnam-region-numeric-cell">
                      <VietnamRegionMetricCell
                        value={<MoneyText amount={region.revenueAmount} currency={region.currency} />}
                        tone="primary"
                      />
                    </td>
                  </tr>
                );
              })}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminSection>
    </AdminPageTemplate>
  );
}

type VietnamRegionMetricTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

function VietnamRegionMetricCell({
  value,
  tone = 'neutral',
}: {
  readonly value: ReactNode;
  readonly tone?: VietnamRegionMetricTone;
}) {
  return (
    <span className={`vietnam-region-number-cell is-${tone}`}>
      <strong>{value}</strong>
    </span>
  );
}

const vietnamOverviewAllSignalKeys = vietnamOverviewRealtimeMetricDotLegend.map((item) => item.key);

function normalizeVietnamOverviewSignalFilters(
  value: string | string[] | undefined,
): VietnamOverviewMetricDotKey[] {
  const rawValue = Array.isArray(value) ? value.join(',') : value;
  const requestedKeys = new Set(
    rawValue
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const activeKeys = vietnamOverviewAllSignalKeys.filter((key) => requestedKeys.has(key));

  return activeKeys.length > 0 ? activeKeys : vietnamOverviewAllSignalKeys;
}

function normalizeVietnamOverviewRegionFilter(
  value: string | string[] | undefined,
  regions: readonly AdminVietnamOverview['regions'][number][],
) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return null;
  }

  return regions.find((region) => region.regionCode === candidate) ?? null;
}

function vietnamOverviewRegionFocusHrefs(
  range: ReturnType<typeof normalizeVietnamOverviewRange>,
  signalKeys: readonly VietnamOverviewMetricDotKey[],
  regions: readonly AdminVietnamOverview['regions'][number][],
) {
  return regions.reduce(
    (hrefs, region) => ({
      ...hrefs,
      [region.regionCode]: vietnamOverviewHrefWithState({
        range,
        regionCode: region.regionCode,
        signalKeys,
      }),
    }),
    {} as Record<string, string>,
  );
}

function vietnamOverviewHrefWithState({
  range,
  regionCode,
  signalKeys,
}: {
  readonly range: ReturnType<typeof normalizeVietnamOverviewRange>;
  readonly regionCode?: string | null;
  readonly signalKeys: readonly VietnamOverviewMetricDotKey[];
}) {
  const params = new URLSearchParams({ range });

  if (regionCode) {
    params.set('region', regionCode);
  }

  const normalizedSignalKeys = vietnamOverviewAllSignalKeys.filter((key) => signalKeys.includes(key));

  if (
    normalizedSignalKeys.length > 0 &&
    normalizedSignalKeys.length < vietnamOverviewAllSignalKeys.length
  ) {
    params.set('signals', normalizedSignalKeys.join(','));
  }

  return `/vietnam-overview?${params.toString()}`;
}

function vietnamOverviewSignalHref(
  range: ReturnType<typeof normalizeVietnamOverviewRange>,
  signalKey: VietnamOverviewMetricDotKey,
  activeSignalKeys: readonly VietnamOverviewMetricDotKey[],
  regionCode?: string | null,
) {
  const nextSignalKeys = new Set(activeSignalKeys);

  if (nextSignalKeys.has(signalKey)) {
    nextSignalKeys.delete(signalKey);
  } else {
    nextSignalKeys.add(signalKey);
  }

  const normalizedNextSignalKeys = vietnamOverviewAllSignalKeys.filter((key) => nextSignalKeys.has(key));

  return vietnamOverviewHrefWithState({
    range,
    regionCode,
    signalKeys: normalizedNextSignalKeys,
  });
}

function vietnamRegionOperatingScore(region: AdminVietnamOverview['regions'][number]) {
  return (
    region.activeBookingCount * 5 +
    region.completedBookingCount * 2 +
    region.cancellationCount * 2 +
    region.activeCustomerCount
  );
}

function vietnamRegionRealtimePointScore(counts: Record<VietnamOverviewMetricDotKey, number>) {
  return (
    counts.bookings * 5 +
    counts.active * 3 +
    counts.online * 2 +
    counts.customers +
    counts['offline-partners'] +
    counts['stale-partners']
  );
}

function vietnamRegionLoadLevel(loadValue: number, maxLoadValue: number) {
  const ratio = maxLoadValue > 0 ? loadValue / maxLoadValue : 0;

  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'medium';
  if (loadValue > 0) return 'low';
  return 'quiet';
}

function vietnamRegionLoadLabel(level: ReturnType<typeof vietnamRegionLoadLevel>) {
  switch (level) {
    case 'high':
      return 'High load';
    case 'medium':
      return 'Medium load';
    case 'low':
      return 'Low load';
    default:
      return 'Quiet';
  }
}

function formatSignedNumber(value: number) {
  const formattedValue = formatNumber(value);

  return value > 0 ? `+${formattedValue}` : formattedValue;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}
