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
  type VietnamOverviewMapPoint,
  vietnamOverviewMetricDotLegend,
  vietnamOverviewMapPoints,
  vietnamOverviewMetricPointCounts,
  vietnamOverviewHref,
  vietnamOverviewRangeOptions,
} from './vietnam-overview-model';

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
  const overview = await adminGet<AdminVietnamOverview>(
    `/admin/vietnam-overview?range=${range}`,
    emptyVietnamOverview,
  );
  const regions = overview.regions;
  const mapPoints = vietnamOverviewMapPoints(overview.points ?? []);
  const mapPointCounts = vietnamOverviewMetricPointCounts(mapPoints);
  const lastGeneratedAt = formatDateTime(overview.generatedAt);
  const metrics = [
    {
      label: 'Customers',
      value: formatNumber(overview.totals.customerCount),
      detail: `${formatNumber(overview.totals.activeCustomerCount)} active in ${overview.rangeLabel}`,
      icon: Users,
      tone: 'info',
    },
    {
      label: 'Partners',
      value: formatNumber(overview.totals.partnerCount),
      detail: `${formatNumber(overview.totals.onlinePartnerCount)} online from stored heartbeat`,
      icon: UserCheck,
      tone: 'success',
    },
    {
      label: 'Active bookings',
      value: formatNumber(overview.totals.activeBookingCount),
      detail: 'Request, matching, travel, arrival, or in service',
      icon: CalendarClock,
      tone: 'warning',
    },
    {
      label: 'Completed',
      value: formatNumber(overview.totals.completedBookingCount),
      detail: 'Stored address closeout count',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Cancellations',
      value: formatNumber(overview.totals.cancellationCount),
      detail: 'Cancelled, no-show, expired, or refunded',
      icon: XCircle,
      tone: 'danger',
    },
    {
      label: 'Revenue',
      value: formatCurrency(overview.totals.revenueAmount, overview.totals.currency),
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
            Stored event-location view for customers, Partners, bookings, completions, and cancellations
            across Vietnam. No live polling or paid map lookup is used here.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Vietnam only</span>
          <span className="pill pill-info">Refreshes every {overview.refreshSeconds}s</span>
        </div>
      </section>

      <section className="card admin-filter-panel vietnam-overview-filter-panel">
        <div className="admin-filter-panel-header">
          <div>
            <h2>Overview range</h2>
            <p className="muted">
              Bound the map points and regional counters by the event time stored in the system.
            </p>
          </div>
          <span className="pill pill-info">{overview.rangeLabel}</span>
        </div>
        <div className="booking-date-filter-buttons vietnam-overview-range-buttons">
          {vietnamOverviewRangeOptions.map((option) => (
            <a
              key={option.value}
              className={`booking-date-filter-button${option.value === range ? ' is-active' : ''}`}
              href={vietnamOverviewHref(option.value)}
            >
              {option.label}
            </a>
          ))}
        </div>
      </section>

      <section className="vietnam-overview-metric-grid">
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

      <section className="card vietnam-overview-map-card">
        <div className="ops-section-header">
          <div>
            <h2>Vietnam operating map</h2>
            <p className="muted">
              Every dot is projected from an existing stored coordinate at the time that event was recorded.
              Points outside Vietnam are not rendered.
            </p>
          </div>
          <span className="pill pill-info">Generated {lastGeneratedAt}</span>
        </div>

        <div className="vietnam-overview-map-layout">
          <div className="vietnam-region-map vietnam-map-canvas" aria-label="Vietnam operating map">
            <div className="vietnam-map-context-chip">
              <MapPinned size={16} aria-hidden="true" />
              Stored event dots
            </div>
            <div className="vietnam-map-dot-legend" aria-label="Vietnam map dot legend">
              {vietnamOverviewMetricDotLegend.map((item) => (
                <span key={item.key}>
                  <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
                  {item.label} {formatNumber(mapPointCounts[item.key])}
                </span>
              ))}
            </div>
            <VietnamMapOutline />
            {mapPoints.map((point) => (
              <EventMapPoint key={point.id} point={point} />
            ))}
            {mapPoints.length === 0 ? (
              <div className="vietnam-map-tile-empty">
                <ShieldCheck size={22} aria-hidden="true" />
                <strong>No event-location dots loaded</strong>
                <p className="muted">Check API availability or seed stored location records.</p>
              </div>
            ) : null}
          </div>

          <div className="admin-table-scroll vietnam-overview-table-wrap">
            <table className="table vietnam-overview-table">
              <thead>
                <tr>
                  <th>Region</th>
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
                {regions.map((region) => (
                  <tr key={region.regionCode}>
                    <td>
                      <div className="vietnam-region-name">
                        <span>{region.shortName}</span>
                        <strong>{region.regionName}</strong>
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
                ))}
                {regions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
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
        </div>
      </section>
    </div>
  );
}

function VietnamMapOutline() {
  return (
    <svg
      aria-hidden="true"
      className="vietnam-map-outline"
      role="presentation"
      viewBox="0 0 420 760"
      preserveAspectRatio="xMidYMid meet"
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
        d="M246 34 C224 55 213 86 225 117 C239 154 226 184 208 213 C188 244 188 279 207 306 C228 337 224 365 197 398 C169 433 173 474 203 505 C239 542 247 589 226 631 C210 662 223 704 261 730 C297 701 304 659 290 622 C275 582 285 548 314 516 C342 484 340 441 310 409 C284 381 284 344 309 314 C333 286 327 250 300 226 C275 203 270 169 287 138 C306 101 294 63 246 34 Z"
      />
      <path
        className="vietnam-map-coastline"
        d="M267 55 C279 103 252 147 271 198 C291 251 261 295 279 343 C295 386 332 422 316 472 C304 509 263 544 272 592 C279 634 302 681 265 725"
      />
      <circle className="vietnam-map-island" cx="327" cy="675" r="12" />
      <circle className="vietnam-map-island" cx="349" cy="713" r="8" />
    </svg>
  );
}

function EventMapPoint({ point }: { point: VietnamOverviewMapPoint }) {
  const pointStyle = {
    '--point-x': `${point.mapXPercent}%`,
    '--point-y': `${point.mapYPercent}%`,
  } as CSSProperties & Record<'--point-x' | '--point-y', string>;
  const title = [
    `${metricLabel(point.kind)}: ${point.label}`,
    point.addressText,
    formatDateTime(point.occurredAt),
  ].filter(Boolean).join(' | ');

  return (
    <span
      aria-label={title}
      className={`vietnam-map-event-point vietnam-map-metric-dot is-${point.kind}`}
      style={pointStyle}
      title={title}
    />
  );
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

function metricLabel(value: VietnamOverviewMapPoint['kind']) {
  return vietnamOverviewMetricDotLegend.find((item) => item.key === value)?.label ?? value;
}
