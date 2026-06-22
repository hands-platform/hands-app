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
  AdminVietnamOverviewRegion,
  adminGet,
} from '../../lib/admin-api';

export const dynamic = 'force-dynamic';

const emptyVietnamOverview: AdminVietnamOverview = {
  generatedAt: new Date(0).toISOString(),
  refreshSeconds: 60,
  source: 'stored-address-aggregates',
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
};

export default async function VietnamOverviewPage() {
  const overview = await adminGet<AdminVietnamOverview>(
    '/admin/vietnam-overview',
    emptyVietnamOverview,
  );
  const regions = overview.regions;
  const maxDemand = Math.max(
    1,
    ...regions.map((region) => region.activeBookingCount + region.completedBookingCount),
  );
  const rankedRegions = [...regions].sort(
    (left, right) =>
      right.activeBookingCount +
      right.completedBookingCount -
      (left.activeBookingCount + left.completedBookingCount),
  );
  const lastGeneratedAt = formatDateTime(overview.generatedAt);
  const metrics = [
    {
      label: 'Customers',
      value: formatNumber(overview.totals.customerCount),
      detail: `${formatNumber(overview.totals.activeCustomerCount)} active in 30 days`,
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
            Region-level operating view built from stored service addresses, customer address records, and
            Partner profile areas. Individual GPS points are intentionally excluded.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Vietnam only</span>
          <span className="pill pill-info">Refreshes every {overview.refreshSeconds}s</span>
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
            <h2>Regional operating heatmap</h2>
            <p className="muted">
              Uses saved region signals only. This avoids paid map lookups while giving operators a quick
              read on where demand and supply are concentrated.
            </p>
          </div>
          <span className="pill pill-info">Generated {lastGeneratedAt}</span>
        </div>

        <div className="vietnam-overview-map-layout">
          <div className="vietnam-region-map" aria-label="Vietnam regional demand heatmap">
            {rankedRegions.map((region, index) => (
              <RegionHeatBlock
                key={region.regionCode}
                index={index}
                maxDemand={maxDemand}
                region={region}
              />
            ))}
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

function RegionHeatBlock({
  index,
  maxDemand,
  region,
}: {
  index: number;
  maxDemand: number;
  region: AdminVietnamOverviewRegion;
}) {
  const demand = region.activeBookingCount + region.completedBookingCount;
  const intensity = Math.max(8, Math.round((demand / maxDemand) * 100));

  return (
    <article
      className={`vietnam-region-block is-rank-${Math.min(index + 1, 5)}`}
      style={{ '--region-intensity': `${intensity}%` } as CSSProperties & Record<'--region-intensity', string>}
    >
      <div>
        <span>{region.shortName}</span>
        <strong>{region.regionName}</strong>
      </div>
      <MapPinned size={18} aria-hidden="true" />
      <small>
        {formatNumber(region.activeBookingCount)} active / {formatNumber(region.partnerCount)} Partners
      </small>
    </article>
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
