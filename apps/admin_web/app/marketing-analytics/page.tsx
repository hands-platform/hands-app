import {
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MapPinned,
  Megaphone,
  MousePointerClick,
  Send,
  Smartphone,
  Target,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  AdminMarketingDimensionRow,
  AdminMarketingOverview,
  AdminMarketingSummary,
  AdminMarketingStats,
  adminGet,
} from '../../lib/admin-api';
import {
  marketingAnalyticsApiPath,
  marketingAnalyticsHref,
  marketingAnalyticsSummaryApiPath,
  marketingAnalyticsPlatformOptions,
  marketingAnalyticsRangeOptions,
  marketingAnalyticsRegionOptions,
  marketingAnalyticsSourceOptions,
  normalizeMarketingAnalyticsFilters,
} from './marketing-analytics-model';
import { upsertMarketingSpendDaily } from './actions';

export const dynamic = 'force-dynamic';

type MarketingAnalyticsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const emptyStats: AdminMarketingStats = {
  firstOpens: 0,
  signups: 0,
  addressSaves: 0,
  bookingCreated: 0,
  bookingCompleted: 0,
  bookingCancelled: 0,
  firstBookingCompleted: 0,
  repeatBookingCompleted: 0,
  grossBookingValue: 0,
  platformFeeRevenue: 0,
  refundAmount: 0,
  adSpend: 0,
  conversionRates: {
    signupRate: 0,
    addressSaveRate: 0,
    bookingCreateRate: 0,
    bookingCompleteRate: 0,
    cancellationRate: 0,
    firstBookingRate: 0,
    repeatBookingRate: 0,
    cpi: null,
    cpa: null,
    cpaSignup: null,
    cpaBookingCreated: null,
    cpaBookingCompleted: null,
    roas: null,
    platformFeeRoas: null,
  },
};

const emptyMarketingOverview: AdminMarketingOverview = {
  generatedAt: new Date(0).toISOString(),
  refreshSeconds: 300,
  source: 'stored-marketing-aggregates',
  range: '7d',
  rangeLabel: 'Last 7 days',
  windowStartAt: new Date(0).toISOString(),
  windowEndAt: new Date(0).toISOString(),
  filters: {
    source: null,
    platform: null,
    regionCode: null,
    campaignId: null,
  },
  totals: emptyStats,
  funnel: [],
  bySource: [],
  byPlatform: [],
  byRegion: [],
  byCampaign: [],
  topInsights: [],
  dataGaps: [],
};
const emptyMarketingSummary: AdminMarketingSummary = emptyMarketingOverview;

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams?: MarketingAnalyticsPageSearchParams;
}) {
  const params = await searchParams;
  const filters = normalizeMarketingAnalyticsFilters(params);
  const includeBreakdowns = normalizeBreakdownParam(params?.breakdowns);
  const overview = includeBreakdowns
    ? await adminGet<AdminMarketingOverview>(marketingAnalyticsApiPath(filters), emptyMarketingOverview)
    : marketingOverviewFromSummary(
        await adminGet<AdminMarketingSummary>(marketingAnalyticsSummaryApiPath(filters), emptyMarketingSummary),
      );
  const generatedAt = formatDateTime(overview.generatedAt);
  const cards = [
    {
      label: 'First opens',
      value: formatNumber(overview.totals.firstOpens),
      detail: 'Stored app-session first-open proxy',
      icon: Smartphone,
      tone: 'info',
    },
    {
      label: 'Signups',
      value: formatNumber(overview.totals.signups),
      detail: `${formatPercent(overview.totals.conversionRates.signupRate)} from first open`,
      icon: UserPlus,
      tone: 'primary',
    },
    {
      label: 'Address saved',
      value: formatNumber(overview.totals.addressSaves),
      detail: `${formatPercent(overview.totals.conversionRates.addressSaveRate)} from signup`,
      icon: MapPinned,
      tone: 'success',
    },
    {
      label: 'Bookings created',
      value: formatNumber(overview.totals.bookingCreated),
      detail: `${formatPercent(overview.totals.conversionRates.bookingCreateRate)} from address`,
      icon: ClipboardList,
      tone: 'warning',
    },
    {
      label: 'Bookings completed',
      value: formatNumber(overview.totals.bookingCompleted),
      detail: `${formatPercent(overview.totals.conversionRates.bookingCompleteRate)} completion rate`,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Ad spend',
      value: formatCurrency(overview.totals.adSpend),
      detail: 'Manual daily spend rows',
      icon: BadgeDollarSign,
      tone: 'warning',
    },
    {
      label: 'CPA completed booking',
      value: formatNullableCurrency(overview.totals.conversionRates.cpaBookingCompleted),
      detail: 'Ad spend / completed bookings',
      icon: Target,
      tone: 'info',
    },
    {
      label: 'ROAS',
      value: formatNullableMultiplier(overview.totals.conversionRates.roas),
      detail: 'Gross booking value / ad spend',
      icon: TrendingUp,
      tone: 'success',
    },
    {
      label: 'Platform fee revenue',
      value: formatCurrency(overview.totals.platformFeeRevenue),
      detail: `Gross ${formatCurrency(overview.totals.grossBookingValue)}`,
      icon: CircleDollarSign,
      tone: 'primary',
    },
  ];

  return (
    <div className="marketing-analytics-page usage-overview-page">
      <section className="toolbar">
        <div>
          <h1>Marketing Analytics</h1>
          <p className="muted">
            Acquisition funnel, source, campaign, and region analytics from stored HANDS app,
            booking, referral, and finance records. This page is intentionally separate from
            Vietnam Operations Map.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">No live ad API</span>
          <span className="pill pill-info">Generated {generatedAt}</span>
        </div>
      </section>

      <section className="card admin-filter-panel usage-overview-filter-panel marketing-analytics-filter-panel">
        <div className="admin-filter-panel-header">
          <div>
            <h2>Marketing filters</h2>
            <p className="muted">
              Bounded ranges and aggregate dimensions only. Phone numbers, exact location points, and ad
              identifiers are not exposed here.
            </p>
          </div>
          <span className="pill pill-info">{overview.rangeLabel}</span>
        </div>
        <FilterButtons
          label="Range"
          options={marketingAnalyticsRangeOptions}
          activeValue={filters.range}
          hrefFor={(range) => marketingAnalyticsHref({ ...filters, range })}
        />
        <FilterButtons
          label="Source"
          options={marketingAnalyticsSourceOptions}
          activeValue={filters.source ?? 'all'}
          hrefFor={(source) =>
            marketingAnalyticsHref({ ...filters, source: source === 'all' ? null : source })
          }
        />
        <FilterButtons
          label="Platform"
          options={marketingAnalyticsPlatformOptions}
          activeValue={filters.platform ?? 'all'}
          hrefFor={(platform) =>
            marketingAnalyticsHref({ ...filters, platform: platform === 'all' ? null : platform })
          }
        />
        <FilterButtons
          label="Region"
          options={marketingAnalyticsRegionOptions}
          activeValue={filters.regionCode ?? 'all'}
          hrefFor={(regionCode) =>
            marketingAnalyticsHref({
              ...filters,
              regionCode: regionCode === 'all' ? null : regionCode,
            })
          }
        />
        <form className="marketing-analytics-campaign-form" action="/marketing-analytics">
          <input type="hidden" name="range" value={filters.range} />
          {filters.source ? <input type="hidden" name="source" value={filters.source} /> : null}
          {filters.platform ? <input type="hidden" name="platform" value={filters.platform} /> : null}
          {filters.regionCode ? <input type="hidden" name="regionCode" value={filters.regionCode} /> : null}
          <label>
            <span>Campaign ID</span>
            <input
              type="search"
              name="campaignId"
              defaultValue={filters.campaignId ?? ''}
              placeholder="ref-smoke, campaign id..."
            />
          </label>
          <button className="booking-date-apply-button" type="submit">
            Apply campaign
          </button>
        </form>
      </section>

      <ManualSpendForm filters={filters} />

      <section className="vietnam-overview-metric-grid">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
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

      <section className="usage-overview-grid marketing-analytics-grid">
        <FunnelCard overview={overview} />
        <InsightCard overview={overview} />
        {includeBreakdowns ? (
          <>
            <MarketingTable
              title="Source performance"
              description="Current first slice groups unknown demand separately from tracked referral attribution."
              emptyMessage="No source aggregate loaded."
              rows={overview.bySource}
              primaryColumn="Source"
              icon={<Megaphone size={18} aria-hidden="true" />}
              labelFor={(row) => sourceLabel(row.source)}
              secondaryFor={(row) => row.platform ? platformLabel(row.platform) : null}
            />
            <MarketingTable
              title="Region performance"
              description="RegionCode rollups from saved addresses and booking address snapshots."
              emptyMessage="No regional marketing aggregate loaded."
              rows={overview.byRegion.filter(hasMarketingActivity)}
              primaryColumn="Region"
              icon={<MapPinned size={18} aria-hidden="true" />}
              labelFor={(row) => row.regionName ?? row.regionCode ?? 'Unknown region'}
              secondaryFor={(row) => row.regionCode ?? null}
            />
            <MarketingTable
              title="Campaign performance"
              description="Referral code campaigns first; paid campaign rows can be added by manual spend/import foundation."
              emptyMessage="No tracked campaign rows in this range."
              rows={overview.byCampaign}
              primaryColumn="Campaign"
              icon={<BarChart3 size={18} aria-hidden="true" />}
              labelFor={(row) => row.campaignName ?? row.campaignId ?? 'Unknown campaign'}
              secondaryFor={(row) => row.source ? sourceLabel(row.source) : null}
            />
            <MarketingTable
              title="Platform first opens"
              description="Platform split from stored app sessions, prepared for Android, iOS, and Web."
              emptyMessage="No platform first-open rows in this range."
              rows={overview.byPlatform}
              primaryColumn="Platform"
              icon={<Smartphone size={18} aria-hidden="true" />}
              labelFor={(row) => platformLabel(row.platform)}
              secondaryFor={() => 'FCM-ready delivery layer'}
            />
          </>
        ) : (
          <MarketingBreakdownLoader filters={filters} />
        )}
      </section>
    </div>
  );
}

function ManualSpendForm({ filters }: { filters: ReturnType<typeof normalizeMarketingAnalyticsFilters> }) {
  const defaultSpendDate = new Date().toISOString().slice(0, 10);

  return (
    <section className="card admin-filter-panel marketing-spend-panel">
      <div className="admin-filter-panel-header">
        <div>
          <h2>Manual daily spend</h2>
          <p className="muted">
            Enter bounded daily spend by source, platform, region, and campaign. This keeps ad-network
            API costs out of the MVP while still enabling CPI, CPA, and ROAS checks.
          </p>
        </div>
        <span className="pill pill-warning">Manual input</span>
      </div>
      <form className="marketing-spend-form" action={upsertMarketingSpendDaily}>
        <label>
          <span>Date</span>
          <input type="date" name="spendDate" defaultValue={defaultSpendDate} required />
        </label>
        <label>
          <span>Source</span>
          <select name="source" defaultValue={filters.source ?? 'google'} required>
            {marketingAnalyticsSourceOptions
              .filter((option) => option.value !== 'all' && option.value !== 'unknown')
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Platform</span>
          <select name="platform" defaultValue={filters.platform ?? 'android'}>
            {marketingAnalyticsPlatformOptions
              .filter((option) => option.value !== 'all')
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Region</span>
          <select name="regionCode" defaultValue={filters.regionCode ?? 'all'}>
            {marketingAnalyticsRegionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Campaign ID</span>
          <input name="campaignId" defaultValue={filters.campaignId ?? ''} placeholder="launch-hcm" />
        </label>
        <label>
          <span>Campaign name</span>
          <input name="campaignName" placeholder="Launch HCMC" />
        </label>
        <label>
          <span>Spend amount</span>
          <input inputMode="numeric" name="spendAmount" placeholder="600000" required />
        </label>
        <label>
          <span>Currency</span>
          <input name="currency" defaultValue="VND" />
        </label>
        <label className="marketing-spend-notes">
          <span>Notes</span>
          <input name="notes" placeholder="Manual import note" />
        </label>
        <button className="booking-date-apply-button marketing-spend-submit" type="submit">
          Save spend
        </button>
      </form>
    </section>
  );
}

function MarketingBreakdownLoader({ filters }: { filters: ReturnType<typeof normalizeMarketingAnalyticsFilters> }) {
  const href = marketingAnalyticsHref(filters);
  const joiner = href.includes('?') ? '&' : '?';

  return (
    <article className="card usage-overview-ranking-card marketing-table-card">
      <div className="ops-section-header">
        <div>
          <h2>Breakdown tables</h2>
          <p className="muted">
            The default view loads summary counts only. Open breakdowns when you need source, region,
            campaign, and platform rows.
          </p>
        </div>
        <BarChart3 size={18} aria-hidden="true" />
      </div>
      <div className="empty-state">
        <BarChart3 size={22} aria-hidden="true" />
        <strong>Dimension rows are not loaded by default.</strong>
        <p className="muted">This keeps Marketing Analytics light until an operator requests the list data.</p>
        <a className="button button-primary" href={`${href}${joiner}breakdowns=1`}>
          Load breakdown tables
        </a>
      </div>
    </article>
  );
}

function FilterButtons<T extends string>({
  activeValue,
  hrefFor,
  label,
  options,
}: {
  activeValue: string;
  hrefFor: (value: T) => string;
  label: string;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="marketing-analytics-filter-row">
      <span className="marketing-analytics-filter-label">{label}</span>
      <div className="booking-date-filter-buttons usage-overview-range-buttons">
        {options.map((option) => (
          <a
            key={option.value}
            className={`booking-date-filter-button${option.value === activeValue ? ' is-active' : ''}`}
            href={hrefFor(option.value)}
          >
            {option.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function FunnelCard({ overview }: { overview: AdminMarketingOverview }) {
  return (
    <article className="card usage-overview-ranking-card marketing-funnel-card">
      <div className="ops-section-header">
        <div>
          <h2>Acquisition funnel</h2>
          <p className="muted">Canonical HANDS funnel events from first open through repeat completion.</p>
        </div>
        <MousePointerClick size={18} aria-hidden="true" />
      </div>
      <div className="marketing-funnel-list">
        {overview.funnel.map((step) => (
          <div key={step.key} className="marketing-funnel-step">
            <span className="marketing-funnel-dot" aria-hidden="true" />
            <div>
              <strong>{step.label}</strong>
              <small>{step.key}</small>
            </div>
            <span>{formatNumber(step.value)}</span>
            <em>{step.rateFromPrevious === null ? 'Start' : formatPercent(step.rateFromPrevious)}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function InsightCard({ overview }: { overview: AdminMarketingOverview }) {
  return (
    <article className="card usage-overview-ranking-card marketing-insight-card">
      <div className="ops-section-header">
        <div>
          <h2>Top insights</h2>
          <p className="muted">Operator-readable findings and current data gaps before paid scaling.</p>
        </div>
        <Send size={18} aria-hidden="true" />
      </div>
      <div className="marketing-insight-list">
        {(overview.topInsights.length ? overview.topInsights : ['No material insight in this range yet.']).map(
          (insight) => (
            <p key={insight}>{insight}</p>
          ),
        )}
      </div>
      <div className="marketing-data-gap-list">
        {overview.dataGaps.map((gap) => (
          <span key={gap}>{gap}</span>
        ))}
      </div>
    </article>
  );
}

function MarketingTable({
  description,
  emptyMessage,
  icon,
  labelFor,
  primaryColumn,
  rows,
  secondaryFor,
  title,
}: {
  description: string;
  emptyMessage: string;
  icon: ReactNode;
  labelFor: (row: AdminMarketingDimensionRow) => string;
  primaryColumn: string;
  rows: readonly AdminMarketingDimensionRow[];
  secondaryFor: (row: AdminMarketingDimensionRow) => string | null;
  title: string;
}) {
  return (
    <article className="card usage-overview-ranking-card marketing-table-card">
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {icon}
      </div>
      <div className="admin-table-scroll usage-overview-table-wrap">
        <table className="table usage-overview-table marketing-analytics-table">
          <thead>
            <tr>
              <th>{primaryColumn}</th>
              <th>Signups</th>
              <th>Address</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Cancel</th>
              <th>Ad spend</th>
              <th>CPA done</th>
              <th>Fee revenue</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <div className="usage-overview-name-cell">
                    <span className="usage-overview-avatar">
                      <BadgeDollarSign size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{labelFor(row)}</strong>
                      {secondaryFor(row) ? <small>{secondaryFor(row)}</small> : null}
                    </div>
                  </div>
                </td>
                <td>{formatNumber(row.signups)}</td>
                <td>{formatNumber(row.addressSaves)}</td>
                <td>{formatNumber(row.bookingCreated)}</td>
                <td>{formatNumber(row.bookingCompleted)}</td>
                <td>{formatNumber(row.bookingCancelled)}</td>
                <td>{formatCurrency(row.adSpend)}</td>
                <td>{formatNullableCurrency(row.conversionRates.cpaBookingCompleted)}</td>
                <td>{formatCurrency(row.platformFeeRevenue)}</td>
                <td>{formatNullableMultiplier(row.conversionRates.roas)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <BarChart3 size={20} aria-hidden="true" />
                    <strong>{emptyMessage}</strong>
                    <p className="muted">Try a different range or remove the dimension filter.</p>
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

function hasMarketingActivity(row: AdminMarketingDimensionRow) {
  return (
    row.firstOpens > 0 ||
    row.signups > 0 ||
    row.addressSaves > 0 ||
    row.bookingCreated > 0 ||
    row.bookingCompleted > 0 ||
    row.bookingCancelled > 0
  );
}

function marketingOverviewFromSummary(summary: AdminMarketingSummary): AdminMarketingOverview {
  return {
    ...summary,
    bySource: [],
    byPlatform: [],
    byRegion: [],
    byCampaign: [],
  };
}

function normalizeBreakdownParam(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === '1' || candidate === 'true' || candidate === 'breakdowns';
}

function sourceLabel(source: AdminMarketingDimensionRow['source']) {
  if (source === 'meta') return 'Meta';
  if (source === 'google') return 'Google';
  if (source === 'tiktok') return 'TikTok';
  if (source === 'organic') return 'Organic';
  if (source === 'referral') return 'Referral';
  if (source === 'direct') return 'Direct';
  return 'Unknown';
}

function platformLabel(platform: AdminMarketingDimensionRow['platform']) {
  if (platform === 'android') return 'Android';
  if (platform === 'ios') return 'iOS';
  if (platform === 'web') return 'Web';
  return 'Unknown platform';
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

function formatDecimal(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function formatNullableCurrency(value: number | null) {
  return value === null ? 'n/a' : formatCurrency(value);
}

function formatNullableMultiplier(value: number | null) {
  return value === null ? 'n/a' : `${formatDecimal(value)}x`;
}
