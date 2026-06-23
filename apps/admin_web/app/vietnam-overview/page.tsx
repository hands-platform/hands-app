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
import type { CSSProperties } from 'react';
import {
  AdminVietnamOverview,
  adminGet,
} from '../../lib/admin-api';
import {
  normalizeVietnamOverviewRange,
  type VietnamOverviewGeoapifyTileGrid,
  type VietnamOverviewMapPoint,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewGeoapifyTileGrid,
  vietnamOverviewRealtimeMetricDotLegend,
  vietnamOverviewRealtimeMapPoints,
  vietnamOverviewRealtimePointCounts,
  vietnamOverviewRangeOptions,
} from './vietnam-overview-model';
import {
  type VietnamOverviewMapPointCluster,
  VietnamOverviewMapClusters,
} from './vietnam-overview-map-clusters';

export const dynamic = 'force-dynamic';

type VietnamOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const emptyVietnamOverview: AdminVietnamOverview = {
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

export default async function VietnamOverviewPage({
  searchParams,
}: {
  searchParams?: VietnamOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizeVietnamOverviewRange(params?.range);
  const activeSignalKeys = normalizeVietnamOverviewSignalFilters(params?.signals);
  const activeSignalSet = new Set<VietnamOverviewMetricDotKey>(activeSignalKeys);
  const overview = await adminGet<AdminVietnamOverview>(
    `/admin/vietnam-overview?range=${range}`,
    emptyVietnamOverview,
  );
  const regions = overview.regions;
  const activeRegion = normalizeVietnamOverviewRegionFilter(params?.region, regions);
  const activeRegionCode = activeRegion?.regionCode ?? null;
  const allMapPoints = vietnamOverviewRealtimeMapPoints(overview.points ?? []);
  const regionalMapPoints = activeRegionCode
    ? allMapPoints.filter((point) => point.regionCode === activeRegionCode)
    : allMapPoints;
  const mapPoints = regionalMapPoints.filter((point) => activeSignalSet.has(point.kind));
  const allMapPointCounts = vietnamOverviewRealtimePointCounts(regionalMapPoints);
  const mapPointClusters = clusterVietnamOverviewMapPoints(mapPoints);
  const visibleRegions = activeRegion
    ? [activeRegion]
    : [...regions].sort(
        (left, right) => vietnamRegionOperatingScore(right) - vietnamRegionOperatingScore(left),
      );
  const maxRegionOperatingScore = Math.max(1, ...visibleRegions.map(vietnamRegionOperatingScore));
  const regionFocusHrefs = vietnamOverviewRegionFocusHrefs(range, activeSignalKeys, regions);
  const clearRegionHref = vietnamOverviewHrefWithState({ range, signalKeys: activeSignalKeys });
  const geoapifyTileGrid = vietnamOverviewGeoapifyTileGrid();
  const hasGeoapifyTileKey = Boolean(process.env.GEOAPIFY_API_KEY?.trim());
  const lastGeneratedAt = formatDateTime(overview.generatedAt);
  const metricTotals = activeRegion ?? overview.totals;
  const metricRangeLabel = activeRegion ? activeRegion.regionName : overview.rangeLabel;
  const regionRealtimeSummary = [
    { label: 'Active customers', value: formatNumber(allMapPointCounts.active), tone: 'info' },
    { label: 'Online Partners', value: formatNumber(allMapPointCounts.online), tone: 'success' },
    { label: 'Active bookings', value: formatNumber(allMapPointCounts.bookings), tone: 'warning' },
  ];
  const regionPeriodSummary = [
    { label: 'Customers', value: formatNumber(metricTotals.customerCount) },
    { label: 'Partners', value: formatNumber(metricTotals.partnerCount) },
    { label: 'Completed', value: formatNumber(metricTotals.completedBookingCount) },
    { label: 'Canceled', value: formatNumber(metricTotals.cancellationCount) },
    { label: 'Revenue', value: formatCurrency(metricTotals.revenueAmount, metricTotals.currency) },
  ];
  const metrics = [
    {
      label: 'Customers',
      value: formatNumber(metricTotals.customerCount),
      detail: `${formatNumber(metricTotals.activeCustomerCount)} active in ${metricRangeLabel}`,
      icon: Users,
      tone: 'info',
    },
    {
      label: 'Partners',
      value: formatNumber(metricTotals.partnerCount),
      detail: `${formatNumber(metricTotals.onlinePartnerCount)} online from stored heartbeat`,
      icon: UserCheck,
      tone: 'success',
    },
    {
      label: 'Active bookings',
      value: formatNumber(metricTotals.activeBookingCount),
      detail: 'Request, matching, travel, arrival, or in service',
      icon: CalendarClock,
      tone: 'warning',
    },
    {
      label: 'Completed',
      value: formatNumber(metricTotals.completedBookingCount),
      detail: 'Stored address closeout count',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Cancellations',
      value: formatNumber(metricTotals.cancellationCount),
      detail: 'Cancelled, no-show, expired, or refunded',
      icon: XCircle,
      tone: 'danger',
    },
    {
      label: 'Revenue',
      value: formatCurrency(metricTotals.revenueAmount, metricTotals.currency),
      detail: 'Captured or released payments only',
      icon: WalletCards,
      tone: 'primary',
    },
  ];

  return (
    <div className="vietnam-overview-page">
      <section className="toolbar">
        <div>
          <h1>Vietnam Overview</h1>
          <p className="muted">
            Realtime operating map for active customers, online Partners, and active bookings across Vietnam.
            Period metrics are summarized below without paid map lookup.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Vietnam only</span>
          {activeRegion ? <span className="pill pill-primary">Focused: {activeRegion.regionName}</span> : null}
          <span className="pill pill-info">Refreshes every {overview.refreshSeconds}s</span>
        </div>
      </section>

      <section className="card vietnam-overview-map-card">
        <div className="ops-section-header">
          <div>
            <h2>Realtime Vietnam operating map</h2>
            <p className="muted">
              The map only shows current operating signals: active customer sessions, online Partner
              heartbeats, and active booking service addresses. Points outside Vietnam are not rendered.
            </p>
          </div>
          <span className="pill pill-info">Generated {lastGeneratedAt}</span>
        </div>

        <div className="vietnam-overview-map-layout">
          <div className="vietnam-region-map vietnam-map-canvas" aria-label="Vietnam operating map">
            <div className="vietnam-map-context-chip">
              <MapPinned size={16} aria-hidden="true" />
              Realtime dots {formatNumber(mapPoints.length)}/{formatNumber(regionalMapPoints.length)}
            </div>
            {activeRegion ? (
              <div className="vietnam-map-region-focus-chip">
                <span>{activeRegion.shortName}</span>
                {activeRegion.regionName}
                <a href={clearRegionHref}>Clear</a>
              </div>
            ) : null}
            <div className="vietnam-map-dot-legend" aria-label="Vietnam map dot legend">
              {vietnamOverviewRealtimeMetricDotLegend.map((item) => {
                const isActive = activeSignalSet.has(item.key);

                return (
                  <a
                    key={item.key}
                    aria-pressed={isActive}
                    className={`vietnam-map-signal-filter${isActive ? ' is-active' : ''}`}
                    href={vietnamOverviewSignalHref(range, item.key, activeSignalKeys, activeRegionCode)}
                    role="button"
                  >
                    <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{formatNumber(allMapPointCounts[item.key])}</strong>
                  </a>
                );
              })}
            </div>
            <div
              className={`vietnam-map-geo-layer ${
                hasGeoapifyTileKey ? 'is-geoapify-map' : 'is-static-map'
              }`}
              style={
                {
                  '--vietnam-map-view-aspect-ratio': `${geoapifyTileGrid.viewAspectRatio}`,
                } as CSSProperties & Record<'--vietnam-map-view-aspect-ratio', string>
              }
            >
              <VietnamOverviewMapClusters clusters={mapPointClusters} regionFocusHrefs={regionFocusHrefs}>
                {hasGeoapifyTileKey ? <GeoapifyVietnamTileLayer tileGrid={geoapifyTileGrid} /> : null}
                {!hasGeoapifyTileKey ? <VietnamMapOutline /> : null}
              </VietnamOverviewMapClusters>
              {mapPoints.length === 0 ? (
                <div className="vietnam-map-tile-empty">
                  <ShieldCheck size={22} aria-hidden="true" />
                  <strong>No realtime dots for selected filters</strong>
                  <p className="muted">Use the signal filters to show active sessions, Partner heartbeats, or bookings.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="card admin-filter-panel vietnam-overview-filter-panel">
        <div className="admin-filter-panel-header">
          <div>
            <h2>Period metrics range</h2>
            <p className="muted">
              The numbers below are bounded by the selected period and use stored event timestamps.
            </p>
          </div>
          <div className="actions">
            {activeRegion ? (
              <a className="pill pill-primary vietnam-overview-clear-focus" href={clearRegionHref}>
                Clear {activeRegion.shortName}
              </a>
            ) : null}
            <span className="pill pill-info">{overview.rangeLabel}</span>
          </div>
        </div>
        <div className="booking-date-filter-buttons vietnam-overview-range-buttons">
          {vietnamOverviewRangeOptions.map((option) => (
            <a
              key={option.value}
              className={`booking-date-filter-button${option.value === range ? ' is-active' : ''}`}
              href={vietnamOverviewHrefWithState({
                range: option.value,
                regionCode: activeRegionCode,
                signalKeys: activeSignalKeys,
              })}
            >
              {option.label}
            </a>
          ))}
        </div>
      </section>

      {activeRegion ? (
        <section className="card vietnam-region-focus-summary-card">
          <div className="vietnam-region-focus-heading">
            <span>{activeRegion.shortName}</span>
            <div>
              <h2>{activeRegion.regionName}</h2>
              <p className="muted">
                Focused operating readout for realtime signals and {overview.rangeLabel} totals.
              </p>
            </div>
          </div>
          <div className="vietnam-region-focus-summary-grid" aria-label="Focused region summary">
            {regionRealtimeSummary.map((item) => (
              <article key={item.label} className={`vietnam-region-focus-summary-item is-${item.tone}`}>
                <small>Realtime</small>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
            {regionPeriodSummary.map((item) => (
              <article key={item.label} className="vietnam-region-focus-summary-item">
                <small>{overview.rangeLabel}</small>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="vietnam-overview-metric-grid" aria-label="Period metric summary">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label} className={`metric-card vietnam-overview-metric is-${tone}`}>
            <span className="metric-card-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="metric-card-content">
              <p>{label}</p>
              <h2>{value}</h2>
              <small>{detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="card vietnam-overview-region-card">
        <div className="ops-section-header">
          <div>
            <h2>{activeRegion ? `${activeRegion.regionName} metrics` : 'Period regional metrics'}</h2>
            <p className="muted">
              {activeRegion
                ? 'Focused numeric distribution for the selected region. Clear focus to return to all regions.'
                : `Numeric distribution by region for ${overview.rangeLabel}. This section does not add map dots.`}
            </p>
          </div>
        </div>
        <div className="admin-table-scroll vietnam-overview-table-wrap">
          <table className="table vietnam-overview-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Load</th>
                <th>Customers</th>
                <th>Active</th>
                <th>Partners</th>
                <th>Online</th>
                <th>Bookings</th>
                <th>Done</th>
                <th>Cancel</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegions.map((region) => {
                const operatingScore = vietnamRegionOperatingScore(region);
                const loadLevel = vietnamRegionLoadLevel(operatingScore, maxRegionOperatingScore);
                const loadPercent = Math.round((operatingScore / maxRegionOperatingScore) * 100);

                return (
                  <tr
                    key={region.regionCode}
                    className={region.regionCode === activeRegionCode ? 'is-focused-region' : ''}
                  >
                    <td>
                      <div className="vietnam-region-name">
                        <span>{region.shortName}</span>
                        <div>
                          <strong>{region.regionName}</strong>
                          <div
                            className="vietnam-region-signal-row"
                            aria-label={`${region.regionName} realtime signals`}
                          >
                            <span className="is-active">
                              <i aria-hidden="true" />
                              {formatNumber(region.activeCustomerCount)}
                            </span>
                            <span className="is-online">
                              <i aria-hidden="true" />
                              {formatNumber(region.onlinePartnerCount)}
                            </span>
                            <span className="is-bookings">
                              <i aria-hidden="true" />
                              {formatNumber(region.activeBookingCount)}
                            </span>
                          </div>
                          <a
                            className="vietnam-region-focus-link"
                            href={
                              region.regionCode === activeRegionCode
                                ? clearRegionHref
                                : regionFocusHrefs[region.regionCode]
                            }
                          >
                            {region.regionCode === activeRegionCode ? 'Clear focus' : 'Focus region'}
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
                    <td>{formatNumber(region.customerCount)}</td>
                    <td>{formatNumber(region.activeCustomerCount)}</td>
                    <td>{formatNumber(region.partnerCount)}</td>
                    <td>{formatNumber(region.onlinePartnerCount)}</td>
                    <td>{formatNumber(region.activeBookingCount)}</td>
                    <td>{formatNumber(region.completedBookingCount)}</td>
                    <td>{formatNumber(region.cancellationCount)}</td>
                    <td>{formatCurrency(region.revenueAmount, region.currency)}</td>
                  </tr>
                );
              })}
              {visibleRegions.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <ShieldCheck size={22} aria-hidden="true" />
                      <strong>No regional aggregates loaded</strong>
                      <p className="muted">Check API availability or seed stored address records.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const VIETNAM_BOUNDARY_PATH = [
  'M69.00 56.74 L68.73 56.48 L68.87 56.40 L68.64 56.10 L69.48 55.57 L68.27 55.12 L68.07 54.67 L69.86 54.46 L69.76 54.21 L70.20 53.96 L70.34 53.57 L70.67 53.55 L70.80 53.11 L69.83 52.62 L69.66 52.19 L68.67 52.13 L68.59 51.73 L68.04 51.55 L67.12 51.64 L66.46 51.04 L65.49 50.68 L65.32 50.21 L64.36 49.85 L64.83 49.29 L65.45 49.32 L67.19 48.91 L68.06 48.32 L67.95 47.94 L66.24 47.97 L65.49 47.55 L64.28 47.25 L63.85 46.66 L61.96 46.41 L61.83 46.15 L60.95 45.69 L60.70 45.71 L60.80 45.14 L60.58 44.97 L60.29 44.96 L59.28 45.67 L58.38 45.52 L58.01 45.09 L58.00 44.60 L57.16 44.43 L56.76 44.13 L56.67 42.11 L56.56 42.00 L56.21 42.17 L55.14 41.96 L54.84 41.63 L54.94 41.50 L53.83 40.80 L53.88 40.47 L53.56 40.10 L53.25 40.07 L52.77 40.36 L52.32 40.27 L50.24 39.39 L47.75 37.93 L46.54 37.59 L45.55 36.64 L45.07 36.42 L44.93 36.21 L45.08 35.72 L44.49 35.38 L44.33 35.10 L43.45 34.66 L43.33 34.32 L42.63 34.18 L42.07 34.51 L41.19 34.22 L41.16 33.85 L40.45 33.87 L39.58 33.50 L39.46 33.42 L39.54 33.12 L38.50 32.55 L38.92 31.74 L39.62 31.52 L38.91 30.98 L36.50 30.74 L35.91 30.46 L33.88 30.35 L31.95 29.70 L31.22 29.24 L30.17 29.14 L29.44 28.72 L28.25 28.36 L27.63 28.38 L27.48 28.08 L26.85 27.85 L25.46 27.55 L24.66 27.58 L23.66 27.14 L23.11 27.10 L24.41 26.51 L25.48 26.37 L25.76 25.99 L26.12 25.91 L25.89 25.42 L25.22 25.16 L24.97 24.82 L25.01 24.64 L26.11 24.83 L26.70 24.60 L27.86 24.48 L28.69 24.81 L29.75 24.61 L31.32 25.14 L32.68 25.11 L33.45 24.36 L35.06 23.93 L35.21 23.56 L34.44 23.44 L34.76 23.17 L35.92 22.69 L36.87 22.61 L36.80 22.15 L37.06 22.09 L36.31 21.71 L36.35 21.45 L35.24 21.15 L33.64 21.31 L33.21 21.21 L33.22 20.78 L33.61 20.64 L33.51 20.38 L32.19 19.91 L30.40 19.93 L29.50 19.74 L30.56 19.13 L31.20 19.28 L31.78 19.12 L32.69 18.41 L31.15 18.05 L30.66 17.65 L29.86 17.61 L28.49 16.83 L27.76 16.83 L27.42 16.58 L26.15 16.38 L25.71 16.39 L25.13 16.72 L22.32 17.12 L21.96 17.45 L21.93 17.79 L21.34 17.92 L21.43 18.25 L20.95 18.35 L19.72 17.85 L18.62 17.73 L18.01 17.32 L16.85 17.49 L14.13 17.07 L13.35 16.57 L12.68 15.87 L11.84 15.64 L11.57 15.22 L11.04 14.99 L11.10 14.67 L10.02 14.48 L10.94 14.16 L11.05 13.62 L11.48 13.23 L10.62 13.38 L12.18 12.42 L11.95 11.46 L11.78 11.36 L10.59 11.58 L10.44 11.51 L10.33 10.83 L10.08 10.73 L9.86 10.84 L9.83 11.36 L9.40 11.74 L8.13 11.89 L7.90 11.57 L7.81 10.78 L7.39 10.31 L5.98 9.95 L5.83 9.71 L6.04 9.54 L5.28 9.28 L4.00 8.39 L4.00 6.48 L4.80 5.62 L4.45 5.36 L5.09 5.20 L5.53 4.74 L6.18 4.77 L6.70 5.19 L7.33 5.06 L10.40 5.81 L11.28 6.60 L12.86 6.90 L13.06 6.84 L13.05 6.54 L14.28 6.21 L14.13 5.95 L14.27 5.76 L15.56 5.36 L16.52 4.58 L17.52 4.92 L17.55 5.23 L18.09 5.69 L18.80 5.93 L19.39 5.54 L19.34 5.16 L19.88 4.72 L20.59 4.52 L22.95 5.79 L24.49 6.41 L24.82 6.28 L25.30 5.04 L25.82 4.68 L27.67 4.35 L28.01 4.36 L27.86 4.62 L27.96 4.89 L29.25 5.25',
  'L30.61 4.87 L31.92 4.28 L32.36 4.47 L33.54 4.44 L34.54 4.00 L52.79 4.00 L53.46 4.19 L55.72 4.00 L57.40 4.00 L57.91 4.20 L58.21 4.06 L59.13 4.53 L59.98 4.62 L59.33 4.88 L58.50 5.94 L58.08 6.01 L57.60 5.74 L57.21 5.84 L56.59 6.85 L56.77 7.45 L57.92 7.68 L58.29 8.24 L58.00 8.45 L58.40 9.08 L58.10 9.71 L58.24 9.92 L59.11 9.62 L59.77 9.84 L60.81 9.88 L61.50 10.21 L62.62 10.15 L62.76 10.37 L62.34 10.68 L62.54 10.90 L63.32 10.99 L64.65 11.52 L65.91 11.49 L66.85 12.26 L67.83 11.92 L68.21 12.05 L68.26 12.28 L68.77 12.38 L69.16 12.20 L70.17 12.22 L72.22 11.90 L72.90 12.00 L74.89 13.00 L74.12 13.27 L73.95 13.17 L74.11 12.96 L73.87 12.73 L73.52 12.68 L73.36 12.82 L73.29 12.71 L72.95 12.98 L72.83 12.73 L72.66 12.77 L72.76 12.95 L72.09 12.77 L71.90 12.86 L72.36 12.94 L72.41 13.03 L72.24 13.00 L72.33 13.17 L72.02 13.22 L71.86 13.48 L70.86 13.48 L70.79 13.69 L70.44 13.66 L70.53 13.79 L70.39 13.84 L70.53 13.92 L70.10 13.96 L69.88 14.23 L69.43 14.16 L69.03 13.88 L69.06 14.14 L69.22 14.18 L67.69 14.01 L67.61 14.10 L68.04 14.27 L67.09 14.37 L67.17 14.46 L67.01 14.59 L66.93 14.89 L67.36 14.94 L67.19 15.38 L67.01 15.47 L67.09 15.56 L66.93 15.60 L67.18 15.95 L65.14 16.18 L65.39 16.26 L64.92 16.43 L64.96 16.53 L63.33 16.40 L64.36 15.87 L63.55 16.09 L63.50 15.91 L63.29 16.07 L63.16 15.91 L63.08 16.13 L63.06 15.97 L62.82 15.91 L62.99 16.13 L62.47 16.00 L62.82 16.31 L62.51 16.44 L60.67 16.18 L61.79 16.71 L61.27 16.72 L60.93 16.53 L61.10 16.71 L60.85 16.89 L60.42 16.53 L59.66 16.40 L60.26 16.28 L59.98 15.97 L59.14 15.94 L58.88 16.00 L58.97 16.09 L58.03 16.00 L58.54 16.09 L58.20 16.09 L58.45 16.40 L59.44 16.53 L59.31 16.88 L58.97 16.75 L58.75 16.89 L59.31 17.10 L59.36 17.39 L58.97 17.37 L59.45 17.73 L59.73 17.77 L60.07 18.21 L59.59 17.98 L58.28 18.08 L58.79 18.32 L57.97 18.53 L57.33 18.30 L57.84 18.71 L56.48 19.09 L57.25 19.05 L57.10 19.19 L57.31 19.38 L57.25 19.50 L56.48 19.76 L57.43 19.69 L57.30 20.12 L56.99 20.16 L57.22 20.26 L57.41 20.80 L56.23 20.59 L56.86 20.70 L57.12 21.08 L54.76 21.21 L54.85 21.31 L52.46 22.50 L52.63 22.32 L52.54 22.27 L52.20 22.63 L51.34 22.81 L51.34 22.37 L51.04 22.81 L50.31 22.59 L49.44 23.06 L49.46 23.38 L49.20 23.56 L49.11 23.91 L48.94 23.82 L48.34 24.04 L49.11 24.00 L49.04 24.09 L48.69 24.38 L48.34 24.38 L47.82 24.89 L47.74 25.24 L47.72 25.10 L47.39 25.14 L47.40 25.24 L47.57 25.11 L47.74 25.33 L47.66 26.30 L47.14 26.43 L47.63 26.96 L47.40 26.96 L47.61 27.22 L47.26 27.32 L47.15 27.51 L46.79 27.54 L46.64 27.93 L46.71 28.33 L45.55 28.61 L45.17 29.13 L45.43 29.61 L46.46 29.97 L46.29 30.10 L45.94 29.97 L46.11 30.15 L46.50 30.17 L46.90 30.41 L46.78 30.77 L46.95 30.86 L46.88 31.21 L47.13 31.15 L47.06 30.59 L47.29 30.66 L47.82 31.65 L48.49 32.19 L48.94 32.43 L49.37 32.45 L49.72 32.89 L51.40 33.79 L51.17 33.81 L52.07 33.77 L53.39 34.17 L54.33 34.63 L54.43',
  '34.74 L53.83 34.84 L54.25 34.84 L54.33 35.10 L54.50 34.84 L55.44 34.69 L55.28 34.88 L55.35 35.01 L56.56 35.81 L55.45 36.25 L55.64 36.35 L55.54 36.47 L55.88 37.11 L56.23 37.35 L56.12 37.40 L54.68 37.00 L53.56 36.95 L55.37 37.22 L54.79 37.30 L54.75 37.43 L55.11 37.53 L54.94 37.40 L55.62 37.36 L56.31 37.53 L57.93 38.90 L59.55 39.77 L63.90 41.37 L64.09 41.55 L64.02 41.82 L65.05 42.46 L64.27 42.79 L64.88 42.74 L64.87 42.63 L65.21 42.53 L70.44 44.60 L68.04 44.21 L70.44 44.78 L70.11 44.87 L70.79 44.83 L70.61 45.02 L70.79 45.18 L71.21 45.03 L73.01 45.94 L72.43 45.94 L72.80 46.42 L73.71 46.59 L74.22 46.37 L74.12 46.11 L75.15 46.33 L75.54 46.15 L76.18 46.86 L75.65 46.70 L75.67 46.86 L77.55 46.99 L76.78 47.43 L76.79 47.62 L77.47 47.92 L77.85 47.81 L77.92 48.15 L77.47 48.36 L78.24 48.32 L78.02 47.90 L78.09 47.59 L77.81 47.57 L78.07 47.34 L78.97 47.52 L79.14 47.38 L79.35 47.52 L78.93 47.74 L78.32 47.69 L78.23 47.93 L78.49 48.42 L79.95 49.16 L79.69 49.23 L80.12 49.16 L80.30 49.64 L80.69 50.02 L82.73 51.42 L83.54 51.50 L83.35 51.72 L82.87 51.70 L82.76 51.78 L82.86 51.90 L83.16 52.01 L83.71 51.67 L83.80 51.97 L84.66 52.34 L84.66 52.74 L85.27 52.61 L84.86 52.42 L85.18 52.21 L85.00 52.07 L85.34 52.07 L85.49 52.42 L86.04 52.67 L86.08 52.99 L86.90 53.22 L86.29 53.40 L86.55 53.54 L86.38 53.49 L86.22 53.85 L85.78 53.85 L86.22 54.07 L86.38 53.89 L86.78 54.97 L87.57 55.88 L87.32 55.89 L88.58 56.68 L88.69 56.98 L88.46 56.87 L88.60 57.49 L88.26 57.65 L88.34 57.74 L88.43 57.56 L89.07 58.29 L89.21 58.92 L89.88 59.41 L90.01 59.77 L89.89 59.87 L90.49 60.43 L89.97 60.21 L89.66 60.28 L90.32 60.62 L90.66 61.08 L90.83 61.80 L91.34 62.09 L91.30 62.84 L90.87 62.87 L90.92 62.42 L90.64 61.99 L90.26 62.54 L90.74 62.73 L90.31 63.08 L90.59 63.72 L91.30 64.07 L91.08 64.14 L91.18 64.32 L90.23 63.57 L90.13 63.67 L91.08 64.46 L91.43 64.37 L91.30 64.65 L91.75 64.74 L91.34 65.12 L90.92 64.96 L91.26 64.77 L90.56 64.61 L90.40 64.77 L90.57 64.99 L90.40 65.21 L91.34 65.47 L91.08 65.61 L91.18 65.82 L90.74 65.82 L91.18 66.22 L91.30 65.79 L91.48 65.88 L91.34 66.88 L91.60 67.20 L93.31 68.30 L93.23 68.70 L92.89 68.74 L93.13 68.56 L92.98 68.53 L92.11 68.87 L92.20 69.19 L92.76 69.73 L93.41 69.96 L93.14 70.07 L93.14 70.51 L93.00 70.55 L92.56 70.21 L92.80 69.98 L92.54 69.76 L92.20 69.85 L92.20 70.07 L91.78 69.93 L92.37 69.60 L91.99 69.05 L90.06 70.02 L90.06 70.64 L90.23 70.69 L90.49 70.47 L90.40 70.38 L90.61 70.42 L90.46 70.82 L91.23 71.11 L91.23 71.41 L91.82 71.64 L91.22 71.93 L89.81 71.23 L89.46 71.26 L89.63 71.40 L89.37 71.35 L89.71 71.62 L89.95 71.59 L90.18 72.05 L90.53 72.22 L90.06 72.50 L89.71 72.41 L90.14 72.59 L90.06 72.69 L90.31 72.90 L89.80 72.94 L90.05 72.94 L90.34 73.30 L90.12 73.49 L90.26 73.87 L91.08 74.40 L90.82 74.77 L91.18 75.02 L90.31 74.98 L90.23 74.09 L89.83 73.43 L89.54 73.47 L89.78 73.67',
  'L89.71 73.85 L90.14 74.16 L90.10 74.34 L89.77 74.70 L89.22 74.86 L89.07 75.07 L89.15 75.29 L89.54 75.33 L90.06 75.04 L89.91 75.31 L90.05 75.58 L90.54 75.90 L89.20 76.97 L88.34 76.88 L88.04 76.53 L87.75 76.56 L88.00 76.76 L88.00 77.14 L87.66 77.14 L87.85 77.31 L87.73 78.35 L86.90 78.64 L85.92 78.49 L85.27 78.56 L84.58 78.86 L84.12 79.47 L83.20 79.40 L81.64 79.66 L80.90 80.30 L79.61 80.50 L79.31 80.94 L78.94 81.00 L78.75 81.21 L78.23 80.96 L76.33 81.17 L75.82 81.50 L74.98 82.58 L73.99 82.44 L72.80 82.63 L69.76 83.42 L68.89 83.86 L66.68 84.17 L65.90 84.65 L64.88 84.48 L65.21 84.29 L64.70 84.02 L63.25 83.99 L63.25 83.82 L62.90 84.04 L62.82 83.86 L62.39 83.99 L62.91 83.70 L62.90 83.18 L62.64 82.98 L62.82 83.03 L62.80 82.86 L62.30 82.58 L62.25 82.68 L62.64 82.87 L62.53 83.12 L62.81 83.20 L62.64 83.47 L62.84 83.59 L62.47 83.55 L62.39 83.07 L62.30 83.44 L62.64 83.73 L62.05 84.09 L62.05 83.86 L61.72 83.56 L61.79 83.22 L61.02 82.89 L60.36 83.03 L59.82 82.71 L59.34 82.75 L59.21 82.85 L59.66 83.20 L59.17 83.73 L58.61 83.85 L58.20 83.73 L58.36 83.91 L57.43 84.26 L57.25 83.95 L57.27 84.18 L57.69 84.28 L58.20 84.04 L58.38 84.31 L58.62 84.30 L58.92 84.08 L59.26 84.08 L59.85 84.56 L59.88 85.26 L55.28 85.05 L59.97 86.08 L59.89 86.39 L59.21 86.75 L58.80 86.78 L58.85 86.61 L58.71 86.56 L58.36 86.89 L58.55 87.02 L58.11 87.26 L57.39 87.22 L55.86 86.72 L54.50 85.67 L53.65 85.41 L54.37 85.71 L54.61 86.09 L55.77 86.87 L58.70 87.76 L58.36 88.11 L58.46 87.96 L58.28 87.85 L57.97 88.22 L57.33 88.24 L56.31 87.71 L54.94 87.26 L51.81 85.62 L51.42 85.59 L51.97 85.84 L52.42 86.32 L55.95 87.99 L56.72 88.70 L57.19 88.78 L57.19 89.36 L56.80 89.77 L56.06 90.02 L54.81 90.01 L53.13 89.48 L49.16 87.38 L47.74 87.05 L50.92 88.72 L51.16 89.08 L52.46 90.06 L52.63 90.52 L52.12 90.85 L52.43 90.97 L52.42 91.17 L44.23 92.71 L42.60 93.54 L41.44 94.76 L40.74 95.09 L39.80 95.22 L38.77 95.91 L34.00 96.00 L35.44 95.74 L35.24 95.54 L35.41 95.49 L36.40 95.58 L37.04 95.36 L35.95 95.49 L35.60 95.33 L36.61 95.18 L36.52 94.78 L35.21 95.02 L34.68 94.72 L35.15 93.95 L35.14 92.69 L35.71 88.79 L36.16 88.06 L37.12 88.04 L38.19 87.53 L38.58 87.51 L38.92 88.02 L38.84 87.40 L37.54 86.50 L36.26 86.47 L34.65 85.63 L33.84 85.66 L33.14 86.16 L32.66 86.16 L32.36 85.41 L31.89 85.19 L31.72 85.28 L31.24 84.71 L31.56 84.58 L31.56 84.39 L30.87 84.65 L30.67 84.65 L30.64 84.39 L31.18 84.34 L32.09 83.69 L35.68 83.67 L36.64 83.03 L38.33 82.49 L38.33 82.28 L37.69 81.62 L37.64 81.39 L38.47 80.99 L38.72 81.20 L40.67 81.40 L41.47 81.68 L42.63 80.88 L43.42 81.03 L46.91 80.54 L48.48 81.75 L48.86 81.69 L49.14 81.31 L50.22 81.81 L52.22 82.15 L51.52 81.13 L51.64 80.84 L52.35 80.80 L52.00 80.30 L51.42 80.08 L51.08 80.28 L49.86 79.50 L48.75 79.23 L48.58 78.92 L48.06 78.77 L48.42 77.88 L48.22 77.19 L47.54 76.99 L47.42 76.73 L48.01 76.40',
  'L49.18 76.50 L50.19 75.67 L52.80 75.97 L53.43 76.28 L54.43 76.19 L55.32 76.37 L55.44 76.28 L54.97 75.73 L55.48 75.07 L54.93 74.39 L55.53 74.36 L55.92 74.50 L56.31 74.37 L58.77 74.38 L59.65 73.77 L61.92 73.67 L64.41 72.41 L65.15 72.22 L66.50 72.07 L67.41 72.56 L67.70 72.55 L68.93 71.98 L69.46 71.14 L69.37 70.91 L69.56 70.28 L69.25 69.57 L69.20 69.03 L68.59 68.58 L68.33 68.05 L68.51 67.81 L68.25 67.60 L70.09 65.36 L70.05 64.53 L68.93 63.27 L68.04 62.69 L67.94 62.13 L68.10 61.88 L67.88 61.39 L66.93 61.27 L66.79 61.16 L66.81 60.77 L66.50 60.52 L66.98 59.75 L67.05 59.46 L66.90 59.08 L67.34 58.57 L68.04 58.56 L68.31 58.39 L68.82 57.80 L68.80 57.41 L69.16 56.92 L69.00 56.74 Z M52.63 89.54 L53.65 89.77 L53.63 89.93 L53.05 90.10 L53.11 89.93 L52.46 89.61 L52.37 89.65 L52.83 89.90 L52.46 89.86 L51.09 88.68 L52.63 89.54 Z M59.05 85.36 L59.48 85.52 L59.05 85.64 L56.40 85.19 L59.05 85.36 Z M64.65 84.10 L65.14 84.35 L64.88 84.30 L63.59 85.01 L63.49 84.57 L64.37 84.41 L64.65 84.10 Z M61.70 84.26 L62.22 84.48 L61.10 84.70 L60.93 84.35 L61.19 83.99 L61.10 84.09 L60.99 83.94 L61.59 83.73 L61.85 83.83 L61.53 84.35 L61.70 84.26 Z M61.36 83.66 L61.12 83.71 L60.67 83.47 L60.89 83.18 L60.67 83.03 L61.10 83.00 L61.62 83.24 L61.53 83.59 L61.19 83.38 L61.36 83.66 Z M91.60 72.77 L91.86 72.90 L91.10 72.97 L90.57 72.72 L91.60 72.77 Z M58.28 95.23 L57.99 95.24 L58.20 95.49 L57.53 95.52 L57.49 95.79 L56.99 95.60 L57.88 95.13 L58.28 95.06 L58.28 95.23 Z M56.23 87.80 L56.80 88.14 L56.51 88.14 L55.28 87.49 L56.23 87.80 Z M26.03 84.70 L26.07 85.50 L25.42 86.48 L25.64 86.65 L25.64 87.05 L25.13 86.90 L24.46 85.59 L23.22 85.03 L23.08 84.70 L24.17 84.73 L25.06 84.19 L26.03 84.70 Z M60.93 84.13 L60.24 84.09 L60.75 84.31 L60.50 84.48 L59.63 84.10 L59.40 83.44 L59.82 83.22 L59.40 82.80 L60.60 83.14 L60.67 83.33 L60.50 83.49 L60.90 83.77 L60.50 83.91 L60.93 84.13 Z M63.50 17.42 L63.68 17.50 L63.33 17.33 L63.42 17.54 L62.90 17.50 L63.42 17.86 L63.25 17.81 L63.08 18.04 L63.08 17.90 L62.73 17.90 L62.99 17.86 L62.90 17.77 L62.47 17.72 L62.56 17.86 L61.37 17.30 L61.97 16.92 L61.87 16.97 L62.56 17.15 L62.95 17.05 L63.04 17.22 L63.85 17.42 L63.50 17.42 Z M60.50 16.90 L61.08 17.44 L60.59 17.44 L60.24 16.92 L60.24 17.15 L59.57 16.92 L59.82 16.58 L60.31 16.68 L60.50 16.90 Z M69.07 16.71 L69.47 16.35 L69.31 16.65 L68.56 17.28 L68.30 17.33 L68.52 17.00 L68.38 16.88 L69.07 16.71 Z M71.81 16.00 L72.41 16.22 L72.16 16.18 L72.13 16.41 L71.73 16.53 L71.98 16.24 L71.72 16.11 L71.81 16.00 Z M69.16 16.00 L69.48 15.90 L68.90 16.62 L67.44 16.79 L68.65 16.36 L68.81 16.00 L69.00 16.04 L69.16 15.87 L69.16 16.00 Z M70.27 15.38 L70.40 15.36 L69.74 16.24 L69.49 16.22 L69.93 15.55 L70.27 15.38 Z M69.76 14.76 L70.08 14.73 L68.38 15.51 L67.36 15.82 L67.16 15.74 L67.73 14.86 L68.13 14.81 L68.19 14.35 L69.04 14.64 L69.16',
  '14.85 L69.76 14.76 Z M72.67 13.80 L71.39 14.14 L72.67 13.80 Z M73.36 13.61 L74.98 13.52 L73.18 13.87 L73.01 13.88 L73.41 13.71 L72.84 13.74 L73.36 13.61 Z M86.78 83.54 L86.99 83.63 L87.01 83.85 L86.63 83.78 L86.62 83.58 L86.78 83.54 Z M92.42 70.31 L92.50 70.59 L91.40 70.23 L92.11 70.14 L92.42 70.31 Z M67.12 17.25 L67.29 17.42 L66.88 17.35 L66.76 17.14 L67.12 17.25 Z M67.28 16.85 L67.44 16.91 L67.10 17.04 L66.66 16.88 L67.28 16.85 Z M72.82 15.97 L73.20 15.91 L72.72 16.20 L72.82 15.97 Z',
].join(' ');

function VietnamMapOutline() {
  return (
    <svg
      aria-hidden="true"
      className="vietnam-map-outline"
      role="presentation"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="vietnamMapLand" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(115 103 240)" stopOpacity="0.22" />
          <stop offset="54%" stopColor="rgb(40 199 111)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgb(0 207 232)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        className="vietnam-map-shape"
        d={VIETNAM_BOUNDARY_PATH}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function GeoapifyVietnamTileLayer({
  tileGrid,
}: {
  tileGrid: VietnamOverviewGeoapifyTileGrid;
}) {
  const tileLayerStyle = {
    gridTemplateColumns: `repeat(${tileGrid.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${tileGrid.rows}, minmax(0, 1fr))`,
    height: `${tileGrid.layerHeightPercent}%`,
    left: `${tileGrid.layerLeftPercent}%`,
    top: `${tileGrid.layerTopPercent}%`,
    width: `${tileGrid.layerWidthPercent}%`,
  } satisfies CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="vietnam-geoapify-tile-layer"
      data-map-provider="geoapify"
      style={tileLayerStyle}
    >
      {tileGrid.tiles.map((tile) => (
        <img
          key={`${tile.z}-${tile.x}-${tile.y}`}
          alt=""
          className="vietnam-geoapify-tile"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={tile.src}
        />
      ))}
    </div>
  );
}

const vietnamMapClusterBucketPercent = 0.35;
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
    region.activeBookingCount * 4 +
    region.activeCustomerCount * 2 +
    region.onlinePartnerCount * 2 +
    region.completedBookingCount +
    region.cancellationCount
  );
}

function vietnamRegionLoadLevel(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? score / maxScore : 0;

  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'medium';
  if (score > 0) return 'low';
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

function clusterVietnamOverviewMapPoints(
  points: readonly VietnamOverviewMapPoint[],
): VietnamOverviewMapPointCluster[] {
  const clusters = new Map<string, VietnamOverviewMapPoint[]>();

  for (const point of points) {
    const clusterKey = [
      Math.round(point.mapXPercent / vietnamMapClusterBucketPercent),
      Math.round(point.mapYPercent / vietnamMapClusterBucketPercent),
    ].join(':');
    const existing = clusters.get(clusterKey) ?? [];

    existing.push(point);
    clusters.set(clusterKey, existing);
  }

  return [...clusters.entries()]
    .map(([id, clusterPoints]) => {
      const sortedPoints = [...clusterPoints].sort(
        (left, right) => eventTimeMs(right.occurredAt) - eventTimeMs(left.occurredAt),
      );
      const primaryPoint = sortedPoints[0] ?? clusterPoints[0];
      const mapXPercent = averagePercent(sortedPoints.map((point) => point.mapXPercent));
      const mapYPercent = averagePercent(sortedPoints.map((point) => point.mapYPercent));
      const metricKinds = new Set(sortedPoints.map((point) => point.kind));

      return {
        id,
        isMixed: metricKinds.size > 1,
        mapXPercent,
        mapYPercent,
        points: sortedPoints,
        primaryPoint,
      };
    })
    .sort((left, right) => left.points.length - right.points.length);
}

function averagePercent(values: readonly number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function eventTimeMs(value: string) {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number, currency: string) {
  if (value <= 0) return `0 ${currency}`;
  return `${formatNumber(value)} ${currency}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() === 0) {
    return 'pending';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
