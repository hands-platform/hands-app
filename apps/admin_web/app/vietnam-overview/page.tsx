import { CheckCircle2, MapPinned, RefreshCw, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import dynamicComponent from 'next/dynamic';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminDetails } from '../../components/admin-details';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminErrorState, AdminKpiCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import { formatWholeNumber as formatNumber } from '../../lib/admin-format';
import {
  type AdminVietnamOverviewRealtimePointFeed,
  type AdminVietnamOverviewRegion,
  type AdminVietnamOverviewSummary,
  adminGetResult,
} from '../../lib/admin-api';
import type { VietnamOverviewLiveMapProps } from './vietnam-overview-live-map';
import {
  normalizeVietnamOverviewRange,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewMappedSignalScope,
  vietnamOverviewRangeOptions,
  vietnamOverviewRealtimeMapPoints,
  vietnamOverviewRealtimeMetricDotLegend,
  vietnamOverviewRealtimePointCounts,
  vietnamOverviewRealtimePointsApiHref,
} from './vietnam-overview-model';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vietnam Overview | HANDS Admin' };

const VietnamOverviewLiveMap = dynamicComponent<VietnamOverviewLiveMapProps>(
  () => import('./vietnam-overview-live-map').then((module) => module.VietnamOverviewLiveMap),
  {
    loading: () => (
      <div
        aria-label="Vietnam operations map loading"
        className="vietnam-maplibre-shell is-loading"
        role="status"
      />
    ),
  },
);

type VietnamOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type VietnamOverviewView = 'live' | 'period';

const defaultLiveSignals: readonly VietnamOverviewMetricDotKey[] = ['needs-supply', 'online'];
const liveSignalKeys = new Set<VietnamOverviewMetricDotKey>([
  'customers',
  'active',
  'online',
  'busy-partners',
  'offline-partners',
  'stale-partners',
  'needs-supply',
  'assigned-bookings',
  'stale-bookings',
]);

const emptyTotals = {
  customerCount: 0,
  activeCustomerCount: 0,
  customersSeenIn30DaysCount: 0,
  partnerCount: 0,
  onlinePartnerCount: 0,
  readyPartnerCount: 0,
  busyPartnerCount: 0,
  offlinePartnerCount: 0,
  stalePartnerCount: 0,
  activeBookingCount: 0,
  needsSupplyNowCount: 0,
  assignedOrInServiceCount: 0,
  staleActiveRecordCount: 0,
  supplyShortageCount: 0,
  completedBookingCount: 0,
  cancellationCount: 0,
  revenueAmount: 0,
  paidVolumeAvailable: false,
  currency: 'VND',
};

const emptySample = {
  limitPerSource: 50,
  sources: [],
};

const emptyVietnamOverview: AdminVietnamOverviewSummary = {
  generatedAt: new Date(0).toISOString(),
  refreshMode: 'manual',
  refreshSeconds: 0,
  source: 'stored-address-aggregates',
  timeZone: 'Asia/Ho_Chi_Minh',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: null,
  windowEndAt: null,
  regionalSampleLimit: 50,
  partnerLocationFreshnessMinutes: 15,
  sample: emptySample,
  totals: emptyTotals,
  regions: [],
};

const emptyVietnamOverviewRealtimePointFeed: AdminVietnamOverviewRealtimePointFeed = {
  generatedAt: new Date(0).toISOString(),
  refreshMode: 'manual',
  refreshSeconds: 0,
  source: 'stored-address-aggregates',
  timeZone: 'Asia/Ho_Chi_Minh',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: null,
  windowEndAt: null,
  partnerLocationFreshnessMinutes: 15,
  sample: emptySample,
  totals: emptyTotals,
  regions: [],
  realtimePoints: [],
};

const periodHeaders = [
  'Region',
  'Completed',
  'Canceled',
  'Cancellation share',
  'Paid volume',
  'View report',
] as const;

export default async function VietnamOverviewPage({
  searchParams,
}: {
  searchParams?: VietnamOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const view = normalizeVietnamOverviewView(params?.view);
  const range = normalizeVietnamOverviewRange(params?.range);
  const signalKeys = normalizeVietnamOverviewSignalFilters(params?.signals);
  const result = view === 'live'
    ? await adminGetResult<AdminVietnamOverviewRealtimePointFeed>(
        vietnamOverviewRealtimePointsApiHref(),
        emptyVietnamOverviewRealtimePointFeed,
      )
    : await adminGetResult<AdminVietnamOverviewSummary>(
        `/admin/vietnam-overview/summary?range=${range}`,
        emptyVietnamOverview,
      );
  const overview = result.data;
  const regions = overview.regions;
  const activeRegion = normalizeVietnamOverviewRegionFilter(params?.region, regions);
  const activeRegionCode = activeRegion?.regionCode ?? null;
  const currentHref = vietnamOverviewHrefWithState({
    range,
    regionCode: activeRegionCode,
    signalKeys,
    view,
  });
  const refreshHref = currentHref;

  return (
    <AdminPageTemplate
      actions={
        <div className="vietnam-overview-header-actions">
          <AdminSegmentedControl
            activeValue={view}
            ariaLabel="Vietnam overview mode"
            options={[
              {
                href: vietnamOverviewHrefWithState({
                  range,
                  regionCode: activeRegionCode,
                  signalKeys,
                  view: 'live',
                }),
                label: 'Live operations',
                value: 'live',
              },
              {
                href: vietnamOverviewHrefWithState({
                  range,
                  regionCode: activeRegionCode,
                  signalKeys,
                  view: 'period',
                }),
                label: 'Period outcomes',
                value: 'period',
              },
            ]}
          />
          <a className="button secondary" href={refreshHref}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh
          </a>
        </div>
      }
      contentClassName="vietnam-overview-workspace"
      description="Current demand, assignable Partner coverage, and Vietnam-time booking outcomes."
      title="Vietnam Overview"
    >
      <span id="vietnam-overview-top" />
      <div aria-live="polite" className="vietnam-overview-freshness" role="status">
        {result.ok ? (
          <>
            Generated <DateTimeText fallback="Unknown" value={overview.generatedAt} />
            <span>Manual refresh</span>
            <span>{overview.timeZone}</span>
          </>
        ) : (
          <span>Latest successful generation time unavailable</span>
        )}
      </div>

      {!result.ok ? (
        <AdminErrorState
          action={<AdminTextLink href={refreshHref}>Retry</AdminTextLink>}
          message={
            view === 'live'
              ? 'Live Vietnam signals could not be loaded. Retry before using this view for coverage decisions.'
              : 'Period outcomes could not be loaded. Retry before using this report.'
          }
          title={view === 'live' ? 'Live operations unavailable' : 'Period outcomes unavailable'}
        />
      ) : view === 'live' ? (
        <LiveOperations
          activeRegion={activeRegion}
          feed={overview as AdminVietnamOverviewRealtimePointFeed}
          range={range}
          signalKeys={signalKeys}
        />
      ) : (
        <PeriodOutcomes
          activeRegion={activeRegion}
          overview={overview as AdminVietnamOverviewSummary}
          range={range}
        />
      )}
    </AdminPageTemplate>
  );
}

function LiveOperations({
  activeRegion,
  feed,
  range,
  signalKeys,
}: {
  readonly activeRegion: AdminVietnamOverviewRegion | null;
  readonly feed: AdminVietnamOverviewRealtimePointFeed;
  readonly range: AdminVietnamOverviewSummary['range'];
  readonly signalKeys: readonly VietnamOverviewMetricDotKey[];
}) {
  const activeSignalSet = new Set(signalKeys);
  const allPoints = vietnamOverviewRealtimeMapPoints(feed.realtimePoints);
  const regionPoints = activeRegion
    ? allPoints.filter((point) => point.regionCode === activeRegion.regionCode)
    : allPoints;
  const visiblePoints = regionPoints.filter((point) => activeSignalSet.has(point.kind));
  const pointCounts = vietnamOverviewRealtimePointCounts(regionPoints);
  const totals = feed.totals;
  const returnHref = `${vietnamOverviewHrefWithState({
    range,
    regionCode: activeRegion?.regionCode,
    signalKeys,
    view: 'live',
  })}#vietnam-operating-map`;
  const clearRegionHref = activeRegion
    ? `${vietnamOverviewHrefWithState({ range, signalKeys, view: 'live' })}#vietnam-operating-map`
    : null;
  const resetLayersHref = `${vietnamOverviewHrefWithState({
    range,
    regionCode: activeRegion?.regionCode,
    signalKeys: defaultLiveSignals,
    view: 'live',
    omitDefaultSignals: true,
  })}#vietnam-operating-map`;
  const sampleScope = vietnamOverviewMappedSignalScope(feed.sample);
  const signalFilters = vietnamOverviewRealtimeMetricDotLegend.map((item) => ({
    count: pointCounts[item.key] ?? 0,
    href: `${vietnamOverviewHrefWithState({
      range,
      regionCode: activeRegion?.regionCode,
      signalKeys: toggleSignal(signalKeys, item.key),
      view: 'live',
    })}#vietnam-operating-map`,
    isActive: activeSignalSet.has(item.key),
    key: item.key,
    label: item.label,
  }));
  const sampledRegions = activeRegion ? [activeRegion] : feed.regions;
  const visibleRegions = sampledRegions
    .filter((region) =>
      region.needsSupplyNowCount +
        region.assignedOrInServiceCount +
        region.staleActiveRecordCount +
        region.readyPartnerCount >
      0,
    )
    .sort(
      (left, right) =>
        right.supplyShortageCount - left.supplyShortageCount ||
        right.needsSupplyNowCount - left.needsSupplyNowCount,
    );
  const hiddenRegionCount = Math.max(0, sampledRegions.length - visibleRegions.length);

  return (
    <>
      <section aria-label="Current Vietnam coverage" className="vietnam-overview-coverage-strip">
        <AdminKpiCard
          helper="Valid matching records that still need Partner supply."
          href={totals.needsSupplyNowCount > 0 ? '/bookings?view=matching' : undefined}
          icon={MapPinned}
          kind="live"
          label="Needs supply now"
          scope="Live"
          value={formatNumber(totals.needsSupplyNowCount)}
        />
        <AdminKpiCard
          helper={`Assignable now using the matching freshness policy (${formatNumber(feed.partnerLocationFreshnessMinutes)} min).`}
          icon={ShieldCheck}
          kind="live"
          label="Ready Partners"
          scope="Live"
          value={formatNumber(totals.readyPartnerCount)}
        />
        <AdminKpiCard
          helper={totals.supplyShortageCount > 0 ? `${totals.supplyShortageCount} valid matching booking(s) exceed ready supply.` : 'Ready supply covers valid matching demand.'}
          href={totals.supplyShortageCount > 0 ? '/bookings?view=matching' : undefined}
          icon={totals.supplyShortageCount > 0 ? XCircle : CheckCircle2}
          kind={totals.supplyShortageCount > 0 ? 'risk' : 'live'}
          label="Supply shortage"
          scope="Live"
          value={formatNumber(totals.supplyShortageCount)}
        />
      </section>

      <div className="vietnam-overview-live-status-strip">
        <span>
          Matched / in service <strong>{formatNumber(totals.assignedOrInServiceCount)}</strong>
        </span>
        <span className={totals.staleActiveRecordCount > 0 ? 'is-warning' : undefined}>
          Stale active records <strong>{formatNumber(totals.staleActiveRecordCount)}</strong>
        </span>
        {totals.staleActiveRecordCount > 0 ? (
          <>
            <AdminTextLink href="/bookings?view=matching-delays&sla=overdue&sort=oldest">
              Matching delays
            </AdminTextLink>
            <AdminTextLink href="/bookings?view=data-anomaly">Data anomalies</AdminTextLink>
          </>
        ) : null}
      </div>

      <AdminSection
        actions={
          <div className="actions">
            <StatusBadge tone="success">Generated <DateTimeText fallback="Unknown" value={feed.generatedAt} /></StatusBadge>
            {feed.sample?.sources?.some((source) => source.truncated) ? (
              <StatusBadge tone="warning">Partial sample</StatusBadge>
            ) : null}
          </div>
        }
        className="vietnam-overview-map-section"
        description="Monitor current booking demand and assignable Partner coverage by region. Secondary saved and stale locations are off by default."
        id="vietnam-operating-map"
        title="Operating map"
      >
        <VietnamOverviewLiveMap
            clearRegionHref={clearRegionHref}
            focusRegionCode={activeRegion?.regionCode ?? null}
            focusRegionName={activeRegion?.regionName ?? null}
            focusRegionShortName={activeRegion?.shortName ?? null}
            points={visiblePoints}
            resetLayersHref={resetLayersHref}
            returnHref={returnHref}
            sampleCopy={sampleScope.copy}
            signalFilters={signalFilters}
            totalPointCount={regionPoints.length}
        />
      </AdminSection>

      <AdminSection
        actions={<StatusBadge tone="warning">Sample · up to {formatNumber(feed.sample?.limitPerSource ?? 50)}/source</StatusBadge>}
        className="vietnam-overview-region-card"
        description="Regional rows use recent mapped records and are not complete regional totals. Open the source records before staffing decisions."
        title="Regional location sample"
      >
        <AdminTableScroll ariaLabel="Regional location sample table" className="vietnam-overview-table-wrap">
          <AdminDataTable
            className="vietnam-overview-live-region-table"
            emptyMessage={<AdminEmptyState message="No mapped regional records are available." title="No regional sample" />}
            headers={['Region', 'Needs supply', 'Ready Partners', 'Shortage', 'Matched / service', 'Stale', 'Action']}
            rowCount={visibleRegions.length}
          >
            {visibleRegions.map((region) => {
              const potentialGap = region.supplyShortageCount > 0;
              return (
                <tr key={region.regionCode}>
                  <td><strong>{region.regionName}</strong></td>
                  <td>{formatNumber(region.needsSupplyNowCount)}</td>
                  <td>{formatNumber(region.readyPartnerCount)}</td>
                  <td>
                    <StatusBadge tone={potentialGap ? 'warning' : 'neutral'}>
                      {potentialGap ? formatNumber(region.supplyShortageCount) : 'No sampled shortage'}
                    </StatusBadge>
                  </td>
                  <td>{formatNumber(region.assignedOrInServiceCount)}</td>
                  <td>
                    {region.staleActiveRecordCount > 0 ? (
                      <StatusBadge tone="warning">{formatNumber(region.staleActiveRecordCount)}</StatusBadge>
                    ) : '0'}
                  </td>
                  <td>
                    <AdminTextLink
                      href={`${vietnamOverviewHrefWithState({
                        range,
                        regionCode: region.regionCode,
                        signalKeys,
                        view: 'live',
                      })}#vietnam-operating-map`}
                    >
                      Focus on map
                    </AdminTextLink>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
        {hiddenRegionCount > 0 ? (
          <AdminDetails className="vietnam-overview-empty-regions">
            <summary>Show {formatNumber(hiddenRegionCount)} regions with no sampled live records</summary>
            <p>A zero sample does not mean the region has no customers or Partners.</p>
          </AdminDetails>
        ) : null}
      </AdminSection>
    </>
  );
}

function PeriodOutcomes({
  activeRegion,
  overview,
  range,
}: {
  readonly activeRegion: AdminVietnamOverviewRegion | null;
  readonly overview: AdminVietnamOverviewSummary;
  readonly range: AdminVietnamOverviewSummary['range'];
}) {
  const metrics = activeRegion ?? overview.totals;
  const closedCount = metrics.completedBookingCount + metrics.cancellationCount;
  const cancellationShare = percentage(metrics.cancellationCount, closedCount);
  const visibleRegions = activeRegion ? [activeRegion] : overview.regions;

  return (
    <>
      <AdminFilterPanel
        bodyClassName="vietnam-overview-period-filter-body"
        description={windowLabel(overview)}
        resultLabel={overview.rangeLabel}
        title="Report period"
      >
        <AdminSegmentedControl
          activeValue={range}
          ariaLabel="Vietnam report period"
          options={vietnamOverviewRangeOptions.map((option) => ({
            href: vietnamOverviewHrefWithState({
              range: option.value,
              regionCode: activeRegion?.regionCode,
              signalKeys: defaultLiveSignals,
              view: 'period',
            }),
            label: option.label,
            value: option.value,
          }))}
        />
        {activeRegion ? (
          <div className="vietnam-overview-report-focus">
            <span>Report focus: <strong>{activeRegion.regionName}</strong></span>
            <AdminTextLink href={vietnamOverviewHrefWithState({ range, signalKeys: defaultLiveSignals, view: 'period' })}>
              All regions
            </AdminTextLink>
          </div>
        ) : null}
      </AdminFilterPanel>

      <section aria-label="Vietnam period outcomes" className="vietnam-overview-period-metrics">
        <AdminKpiCard
          helper="Bookings completed using the verified closed timestamp."
          icon={CheckCircle2}
          kind="period"
          label="Completed"
          scope={null}
          value={formatNumber(metrics.completedBookingCount)}
        />
        <AdminKpiCard
          helper={`${formatNumber(metrics.cancellationCount)} of ${formatNumber(closedCount)} closed bookings were canceled.`}
          icon={XCircle}
          kind="period"
          label="Canceled"
          scope={null}
          value={formatNumber(metrics.cancellationCount)}
        />
        <AdminKpiCard
          helper="Canceled bookings divided by completed plus canceled bookings."
          icon={MapPinned}
          kind="period"
          label="Cancellation share"
          scope={null}
          value={closedCount > 0 ? formatPercent(cancellationShare) : '—'}
        />
        <AdminKpiCard
          helper={
            metrics.paidVolumeAvailable
              ? 'Captured or released payment volume across the unbounded record set.'
              : 'Unavailable for bounded periods because payments do not store a captured or released timestamp.'
          }
          icon={WalletCards}
          kind="period"
          label="Paid volume"
          scope={null}
          value={
            metrics.paidVolumeAvailable
              ? <MoneyText amount={metrics.revenueAmount} currency={metrics.currency} />
              : 'Unavailable'
          }
        />
      </section>

      <AdminSection
        actions={<StatusBadge tone="warning">Outcome sample · up to {formatNumber(overview.sample?.limitPerSource ?? overview.regionalSampleLimit)}/source</StatusBadge>}
        className="vietnam-overview-region-card"
        description="National KPI cards use exact aggregate queries. Regional rows are a bounded location sample and must not be used as national totals."
        title={activeRegion ? `${activeRegion.regionName} period outcomes` : 'Regional outcome sample'}
      >
        <AdminTableScroll ariaLabel="Regional period outcome sample table" className="vietnam-overview-table-wrap">
          <AdminDataTable
            className="vietnam-overview-table"
            emptyMessage={<AdminEmptyState message="No closed booking outcomes were mapped for this period." title="No regional outcomes" />}
            headers={periodHeaders}
            rowCount={visibleRegions.length}
          >
            {visibleRegions.map((region) => {
              const regionClosed = region.completedBookingCount + region.cancellationCount;
              return (
                <tr key={region.regionCode}>
                  <td><strong>{region.regionName}</strong></td>
                  <td>{formatNumber(region.completedBookingCount)}</td>
                  <td>{formatNumber(region.cancellationCount)}</td>
                  <td>{regionClosed > 0 ? formatPercent(percentage(region.cancellationCount, regionClosed)) : '—'}</td>
                  <td>
                    {region.paidVolumeAvailable
                      ? <MoneyText amount={region.revenueAmount} currency={region.currency} />
                      : 'Unavailable'}
                  </td>
                  <td>
                    <AdminTextLink
                      href={vietnamOverviewHrefWithState({
                        range,
                        regionCode: region.regionCode,
                        signalKeys: defaultLiveSignals,
                        view: 'period',
                      })}
                    >
                      View region report
                    </AdminTextLink>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminSection>
    </>
  );
}

function normalizeVietnamOverviewView(value: string | string[] | undefined): VietnamOverviewView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'period' ? 'period' : 'live';
}

function normalizeVietnamOverviewSignalFilters(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === 'none') return [];
  if (!candidate) return [...defaultLiveSignals];

  const selected = candidate
    .split(',')
    .map((item) => item.trim())
    .flatMap((item) => item === 'bookings' ? ['needs-supply', 'assigned-bookings'] : [item])
    .filter((item): item is VietnamOverviewMetricDotKey => liveSignalKeys.has(item as VietnamOverviewMetricDotKey));

  return [...new Set(selected)];
}

function normalizeVietnamOverviewRegionFilter(
  value: string | string[] | undefined,
  regions: readonly AdminVietnamOverviewRegion[],
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return regions.find((region) => region.regionCode === candidate) ?? null;
}

function vietnamOverviewHrefWithState({
  omitDefaultSignals = false,
  range,
  regionCode,
  signalKeys,
  view,
}: {
  readonly omitDefaultSignals?: boolean;
  readonly range: AdminVietnamOverviewSummary['range'];
  readonly regionCode?: string | null;
  readonly signalKeys: readonly VietnamOverviewMetricDotKey[];
  readonly view: VietnamOverviewView;
}) {
  const params = new URLSearchParams();
  params.set('view', view);
  if (view === 'period' || range !== 'today') params.set('range', range);
  if (regionCode) params.set('region', regionCode);
  const usingDefault = sameSignals(signalKeys, defaultLiveSignals);
  if (signalKeys.length === 0) params.set('signals', 'none');
  else if (!(omitDefaultSignals && usingDefault) && !usingDefault) params.set('signals', signalKeys.join(','));
  const query = params.toString();
  return query ? `/vietnam-overview?${query}` : '/vietnam-overview';
}

function sameSignals(left: readonly VietnamOverviewMetricDotKey[], right: readonly VietnamOverviewMetricDotKey[]) {
  return left.length === right.length && left.every((key) => right.includes(key));
}

function toggleSignal(signalKeys: readonly VietnamOverviewMetricDotKey[], key: VietnamOverviewMetricDotKey) {
  return signalKeys.includes(key) ? signalKeys.filter((item) => item !== key) : [...signalKeys, key];
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;
}

function windowLabel(overview: AdminVietnamOverviewSummary) {
  if (!overview.windowStartAt || !overview.windowEndAt) {
    return 'All stored outcomes · unbounded period.';
  }

  return `From ${formatVietnamBoundary(overview.windowStartAt)} to before ${formatVietnamBoundary(overview.windowEndAt)} · ${overview.timeZone}.`;
}

function formatVietnamBoundary(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(new Date(value));
}
