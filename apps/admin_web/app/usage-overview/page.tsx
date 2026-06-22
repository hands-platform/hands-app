import {
  Activity,
  CalendarCheck,
  Eye,
  MapPinned,
  MousePointerClick,
  Trophy,
  Users,
} from 'lucide-react';
import {
  AdminUsageOverview,
  AdminUsageOverviewRegionRow,
  AdminUsageOverviewRankRow,
  adminGet,
} from '../../lib/admin-api';
import {
  normalizeUsageOverviewRange,
  usageOverviewHref,
  usageOverviewRangeOptions,
} from './usage-overview-model';

export const dynamic = 'force-dynamic';

type UsageOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const emptyUsageOverview: AdminUsageOverview = {
  generatedAt: new Date(0).toISOString(),
  refreshSeconds: 60,
  source: 'stored-usage-aggregates',
  range: '7d',
  rangeLabel: 'Last 7 days',
  windowStartAt: null,
  windowEndAt: null,
  totals: {
    customerSessionCount: 0,
    completedBookingCount: 0,
    partnerProfileViewCount: 0,
    partnerBookingRequestCount: 0,
  },
  customerUsage: {
    mostActiveCustomers: [],
    completedBookingCustomers: [],
  },
  regionUsage: [],
  partnerUsage: {
    mostViewedPartners: [],
    requestedPartners: [],
    completedPartners: [],
  },
};

export default async function UsageOverviewPage({
  searchParams,
}: {
  searchParams?: UsageOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizeUsageOverviewRange(params?.range);
  const overview = await adminGet<AdminUsageOverview>(
    `/admin/usage-overview?range=${range}`,
    emptyUsageOverview,
  );
  const generatedAt = formatDateTime(overview.generatedAt);
  const metricCards = [
    {
      label: 'Customer sessions',
      value: formatNumber(overview.totals.customerSessionCount),
      detail: 'Stored app-session rows only',
      icon: Activity,
      tone: 'info',
    },
    {
      label: 'Completed bookings',
      value: formatNumber(overview.totals.completedBookingCount),
      detail: 'Closed booking records',
      icon: CalendarCheck,
      tone: 'success',
    },
    {
      label: 'Partner profile views',
      value: formatNumber(overview.totals.partnerProfileViewCount),
      detail: 'Stored profile-view records',
      icon: Eye,
      tone: 'primary',
    },
    {
      label: 'Partner requests',
      value: formatNumber(overview.totals.partnerBookingRequestCount),
      detail: 'Preferred Partner booking requests',
      icon: MousePointerClick,
      tone: 'warning',
    },
  ];

  return (
    <div className="usage-overview-page">
      <section className="toolbar">
        <div>
          <h1>Usage Overview</h1>
          <p className="muted">
            Low-cost customer and Partner usage ranking from stored app sessions, booking records, and
            profile-view aggregates. No realtime GPS or reverse-geocoding is used.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Vietnam only</span>
          <span className="pill pill-info">Generated {generatedAt}</span>
        </div>
      </section>

      <section className="card admin-filter-panel usage-overview-filter-panel">
        <div className="admin-filter-panel-header">
          <div>
            <h2>Usage range</h2>
            <p className="muted">
              Use bounded date windows so operators can compare app activity without broad page fetches.
            </p>
          </div>
          <span className="pill pill-info">{overview.rangeLabel}</span>
        </div>
        <div className="booking-date-filter-buttons usage-overview-range-buttons">
          {usageOverviewRangeOptions.map((option) => (
            <a
              key={option.value}
              className={`booking-date-filter-button${option.value === range ? ' is-active' : ''}`}
              href={usageOverviewHref(option.value)}
            >
              {option.label}
            </a>
          ))}
        </div>
      </section>

      <section className="vietnam-overview-metric-grid">
        {metricCards.map(({ label, value, detail, icon: Icon, tone }) => (
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

      <section className="usage-overview-grid">
        <UsageRankingCard
          title="Most active customers"
          description="Customers with the most app-session activity in the selected range."
          emptyMessage="No customer app-session activity loaded."
          rows={overview.customerUsage.mostActiveCustomers}
          valueHeading="Sessions"
        />
        <UsageRankingCard
          title="Customers by completed work"
          description="Customers ranked by completed booking count in the selected range."
          emptyMessage="No completed customer bookings loaded."
          rows={overview.customerUsage.completedBookingCustomers}
          valueHeading="Completed"
        />
        <UsageRankingCard
          title="Most viewed Partners"
          description="Partner profile searches and views from stored customer interactions."
          emptyMessage="No Partner profile views loaded."
          rows={overview.partnerUsage.mostViewedPartners}
          valueHeading="Views"
        />
        <UsageRankingCard
          title="Most requested Partners"
          description="Preferred Partner booking requests in the selected range."
          emptyMessage="No Partner requests loaded."
          rows={overview.partnerUsage.requestedPartners}
          valueHeading="Requests"
        />
        <UsageRankingCard
          title="Completed Partner ranking"
          description="Partners ranked by completed bookings in the selected range."
          emptyMessage="No completed Partner bookings loaded."
          rows={overview.partnerUsage.completedPartners}
          valueHeading="Completed"
        />
        <RegionUsageCard rows={overview.regionUsage} />
      </section>
    </div>
  );
}

function RegionUsageCard({ rows }: { rows: readonly AdminUsageOverviewRegionRow[] }) {
  const activeRows = rows.filter(
    (row) =>
      row.customerSessionCount > 0 || row.bookingRequestCount > 0 || row.completedBookingCount > 0,
  );

  return (
    <article className="card usage-overview-ranking-card usage-overview-region-card">
      <div className="ops-section-header">
        <div>
          <h2>Region usage</h2>
          <p className="muted">
            RegionCode aggregate from stored customer login address and booking address snapshots. It
            intentionally excludes individual location points.
          </p>
        </div>
        <MapPinned size={18} aria-hidden="true" />
      </div>
      <div className="admin-table-scroll usage-overview-table-wrap">
        <table className="table usage-overview-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Customer sessions</th>
              <th>Requests</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.regionCode}>
                <td>
                  <div className="vietnam-region-name">
                    <span>{row.shortName}</span>
                    <strong>{row.regionName}</strong>
                  </div>
                </td>
                <td>{formatNumber(row.customerSessionCount)}</td>
                <td>{formatNumber(row.bookingRequestCount)}</td>
                <td>{formatNumber(row.completedBookingCount)}</td>
              </tr>
            ))}
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <MapPinned size={20} aria-hidden="true" />
                    <strong>No region usage loaded.</strong>
                    <p className="muted">Try another stored usage range.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function UsageRankingCard({
  description,
  emptyMessage,
  rows,
  title,
  valueHeading,
}: {
  description: string;
  emptyMessage: string;
  rows: readonly AdminUsageOverviewRankRow[];
  title: string;
  valueHeading: string;
}) {
  return (
    <article className="card usage-overview-ranking-card">
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <Trophy size={18} aria-hidden="true" />
      </div>
      <div className="admin-table-scroll usage-overview-table-wrap">
        <table className="table usage-overview-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>{valueHeading}</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.id}`}>
                <td>
                  <span className="usage-overview-rank">#{row.rank}</span>
                </td>
                <td>
                  <div className="usage-overview-name-cell">
                    <span className="usage-overview-avatar">
                      <Users size={15} aria-hidden="true" />
                    </span>
                    <div>
                      {row.href ? <a href={row.href}>{row.label}</a> : <strong>{row.label}</strong>}
                      {row.secondary ? <small>{row.secondary}</small> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{formatNumber(row.value)}</strong>
                  <small className="muted"> {row.valueLabel}</small>
                </td>
                <td>
                  {row.lastActivityAt ? (
                    <span>{formatDateTime(row.lastActivityAt)}</span>
                  ) : (
                    <span className="muted">No date</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <MapPinned size={20} aria-hidden="true" />
                    <strong>{emptyMessage}</strong>
                    <p className="muted">Try another stored usage range.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
