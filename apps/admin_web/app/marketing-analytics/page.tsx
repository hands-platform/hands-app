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
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminOverviewGrid } from '../../components/admin-overview-card';
import { AdminMetricGrid, AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import {
  AdminMarketingDimensionKey,
  AdminMarketingDimensionPage,
  AdminMarketingDimensionRow,
  AdminMarketingOverview,
  AdminMarketingSummary,
  AdminMarketingStats,
  adminGet,
} from '../../lib/admin-api';
import {
  formatCurrencyAmount as formatCurrency,
  formatDateTime,
  formatPercentLabel as formatPercent,
  formatWholeNumber as formatNumber,
} from '../../lib/admin-format';
import {
  MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE,
  marketingAnalyticsDimensionApiPath,
  marketingAnalyticsDimensionPageHref,
  marketingAnalyticsDimensionPaging,
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
type MarketingDimensionPages = Record<AdminMarketingDimensionKey, AdminMarketingDimensionPage>;

const marketingDimensionKeys: readonly AdminMarketingDimensionKey[] = [
  'source',
  'region',
  'campaign',
  'platform',
];
const marketingDimensionMetricHeaders = [
  'Signups',
  'Address',
  'Created',
  'Completed',
  'Cancel',
  'Ad spend',
  'CPA done',
  'Fee revenue',
  'ROAS',
] as const;

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

async function loadMarketingDimensionPages(
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>,
  params: Record<string, string | string[] | undefined> | undefined,
): Promise<MarketingDimensionPages> {
  const pages = await Promise.all(
    marketingDimensionKeys.map(async (dimension) => {
      const paging = marketingAnalyticsDimensionPaging(params, dimension);
      const page = await adminGet<AdminMarketingDimensionPage>(
        marketingAnalyticsDimensionApiPath(filters, dimension, paging),
        emptyMarketingDimensionPage(dimension, filters, paging),
      );

      return [dimension, page] as const;
    }),
  );

  return Object.fromEntries(pages) as MarketingDimensionPages;
}

function emptyMarketingDimensionPage(
  dimension: AdminMarketingDimensionKey,
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>,
  paging: { readonly skip: number; readonly take: number },
): AdminMarketingDimensionPage {
  return {
    generatedAt: new Date(0).toISOString(),
    refreshSeconds: 300,
    source: 'stored-marketing-aggregates',
    range: filters.range,
    rangeLabel: emptyMarketingOverview.rangeLabel,
    windowStartAt: new Date(0).toISOString(),
    windowEndAt: new Date(0).toISOString(),
    filters: {
      source: filters.source ?? null,
      platform: filters.platform ?? null,
      regionCode: filters.regionCode ?? null,
      campaignId: filters.campaignId ?? null,
    },
    dimension,
    rows: [],
    skip: paging.skip,
    take: paging.take,
    totalCount: 0,
  };
}

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams?: MarketingAnalyticsPageSearchParams;
}) {
  const params = await searchParams;
  const filters = normalizeMarketingAnalyticsFilters(params);
  const includeBreakdowns = normalizeBreakdownParam(params?.breakdowns);
  const summary = await adminGet<AdminMarketingSummary>(
    marketingAnalyticsSummaryApiPath(filters),
    emptyMarketingSummary,
  );
  const overview = marketingOverviewFromSummary(summary);
  const dimensionPages = includeBreakdowns ? await loadMarketingDimensionPages(filters, params) : null;
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
    <AdminPageTemplate
      actions={
        <>
          <StatusBadge tone="success">No live ad API</StatusBadge>
          <StatusBadge tone="info">Generated {generatedAt}</StatusBadge>
        </>
      }
      contentClassName="marketing-analytics-page usage-overview-page"
      description="Acquisition funnel, source, campaign, and region analytics from stored HANDS app, booking, referral, and finance records. This page is intentionally separate from Vietnam Operations Map."
      title="Marketing Analytics"
    >

      <AdminSection
        actions={<StatusBadge tone="info">{overview.rangeLabel}</StatusBadge>}
        className="usage-overview-filter-panel marketing-analytics-filter-panel"
        description="Bounded ranges and aggregate dimensions only. Phone numbers, exact location points, and ad identifiers are not exposed here."
        title="Marketing filters"
      >
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
        <AdminFormGrid className="marketing-analytics-campaign-form" action="/marketing-analytics">
          <input type="hidden" name="range" value={filters.range} />
          {filters.source ? <input type="hidden" name="source" value={filters.source} /> : null}
          {filters.platform ? <input type="hidden" name="platform" value={filters.platform} /> : null}
          {filters.regionCode ? <input type="hidden" name="regionCode" value={filters.regionCode} /> : null}
          <AdminFormInput
            defaultValue={filters.campaignId ?? ''}
            label="Campaign ID"
            labelVisibility="visible"
            name="campaignId"
            placeholder="ref-smoke, campaign id..."
            type="search"
          />
          <AdminFormControlButton className="booking-date-apply-button" type="submit">
            Apply campaign
          </AdminFormControlButton>
        </AdminFormGrid>
      </AdminSection>

      <ManualSpendForm filters={filters} />

      <AdminMetricGrid
        ariaLabel="Marketing summary metrics"
        className="vietnam-overview-metric-grid"
        metrics={cards.map(({ label, value, detail, icon, tone }) => ({
          className: `vietnam-overview-metric is-${tone}`,
          helper: detail,
          icon,
          iconSize: 18,
          label,
          value,
        }))}
      />

      <AdminOverviewGrid
        ariaLabel="Marketing analytics funnel and breakdowns"
        className="marketing-analytics-grid"
        variant="content"
      >
        <FunnelCard overview={overview} />
        <InsightCard overview={overview} />
        {dimensionPages ? (
          <>
            <MarketingTable
              title="Source performance"
              description="Current first slice groups unknown demand separately from tracked referral attribution."
              emptyMessage="No source aggregate loaded."
              filters={filters}
              page={dimensionPages.source}
              rows={dimensionPages.source.rows}
              primaryColumn="Source"
              icon={<Megaphone size={18} aria-hidden="true" />}
              labelFor={(row) => sourceLabel(row.source)}
              secondaryFor={(row) => row.platform ? platformLabel(row.platform) : null}
            />
            <MarketingTable
              title="Region performance"
              description="RegionCode rollups from saved addresses and booking address snapshots."
              emptyMessage="No regional marketing aggregate loaded."
              filters={filters}
              page={dimensionPages.region}
              rows={dimensionPages.region.rows.filter(hasMarketingActivity)}
              primaryColumn="Region"
              icon={<MapPinned size={18} aria-hidden="true" />}
              labelFor={(row) => row.regionName ?? row.regionCode ?? 'Unknown region'}
              secondaryFor={(row) => row.regionCode ?? null}
            />
            <MarketingTable
              title="Campaign performance"
              description="Referral code campaigns first; paid campaign rows can be added by manual spend/import foundation."
              emptyMessage="No tracked campaign rows in this range."
              filters={filters}
              page={dimensionPages.campaign}
              rows={dimensionPages.campaign.rows}
              primaryColumn="Campaign"
              icon={<BarChart3 size={18} aria-hidden="true" />}
              labelFor={(row) => row.campaignName ?? row.campaignId ?? 'Unknown campaign'}
              secondaryFor={(row) => row.source ? sourceLabel(row.source) : null}
            />
            <MarketingTable
              title="Platform first opens"
              description="Platform split from stored app sessions, prepared for Android, iOS, and Web."
              emptyMessage="No platform first-open rows in this range."
              filters={filters}
              page={dimensionPages.platform}
              rows={dimensionPages.platform.rows}
              primaryColumn="Platform"
              icon={<Smartphone size={18} aria-hidden="true" />}
              labelFor={(row) => platformLabel(row.platform)}
              secondaryFor={() => 'FCM-ready delivery layer'}
            />
          </>
        ) : (
          <MarketingBreakdownLoader filters={filters} />
        )}
      </AdminOverviewGrid>
    </AdminPageTemplate>
  );
}

function ManualSpendForm({ filters }: { filters: ReturnType<typeof normalizeMarketingAnalyticsFilters> }) {
  const defaultSpendDate = new Date().toISOString().slice(0, 10);

  return (
    <AdminSection
      actions={<StatusBadge tone="warning">Manual input</StatusBadge>}
      className="marketing-spend-panel"
      description="Enter bounded daily spend by source, platform, region, and campaign. This keeps ad-network API costs out of the MVP while still enabling CPI, CPA, and ROAS checks."
      title="Manual daily spend"
    >
      <AdminFormGrid className="marketing-spend-form" action={upsertMarketingSpendDaily}>
        <AdminFormDate
          defaultValue={defaultSpendDate}
          label="Date"
          labelVisibility="visible"
          name="spendDate"
          required
        />
        <AdminFormSelect
          defaultValue={filters.source ?? 'google'}
          label="Source"
          labelVisibility="visible"
          name="source"
          options={marketingAnalyticsSourceOptions
            .filter((option) => option.value !== 'all' && option.value !== 'unknown')
            .map((option) => ({ label: option.label, value: option.value }))}
        />
        <AdminFormSelect
          defaultValue={filters.platform ?? 'android'}
          label="Platform"
          labelVisibility="visible"
          name="platform"
          options={marketingAnalyticsPlatformOptions
            .filter((option) => option.value !== 'all')
            .map((option) => ({ label: option.label, value: option.value }))}
        />
        <AdminFormSelect
          defaultValue={filters.regionCode ?? 'all'}
          label="Region"
          labelVisibility="visible"
          name="regionCode"
          options={marketingAnalyticsRegionOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
        />
        <AdminFormInput
          defaultValue={filters.campaignId ?? ''}
          label="Campaign ID"
          labelVisibility="visible"
          name="campaignId"
          placeholder="launch-hcm"
        />
        <AdminFormInput
          label="Campaign name"
          labelVisibility="visible"
          name="campaignName"
          placeholder="Launch HCMC"
        />
        <AdminFormInput
          label="Spend amount"
          labelVisibility="visible"
          name="spendAmount"
          placeholder="600000"
          required
        />
        <AdminFormInput
          defaultValue="VND"
          label="Currency"
          labelVisibility="visible"
          name="currency"
        />
        <AdminFormInput
          className="admin-grid-span-2"
          label="Notes"
          labelVisibility="visible"
          name="notes"
          placeholder="Manual import note"
        />
        <AdminFormControlButton
          className="booking-date-apply-button marketing-spend-submit"
          type="submit"
        >
          Save spend
        </AdminFormControlButton>
      </AdminFormGrid>
    </AdminSection>
  );
}

function MarketingBreakdownLoader({ filters }: { filters: ReturnType<typeof normalizeMarketingAnalyticsFilters> }) {
  const href = marketingAnalyticsHref(filters);
  const joiner = href.includes('?') ? '&' : '?';

  return (
    <AdminSection
      actions={<BarChart3 size={18} aria-hidden="true" />}
      bodyClassName="marketing-breakdown-loader-body"
      className="usage-overview-ranking-card marketing-table-card"
      description="The default view loads summary counts only. Open breakdowns when you need source, region, campaign, and platform rows."
      title="Breakdown tables"
    >
      <BarChart3 size={22} aria-hidden="true" />
      <AdminEmptyState
        className="marketing-breakdown-loader-empty"
        framed
        message="This keeps Marketing Analytics light until an operator requests the list data."
        title="Dimension rows are not loaded by default."
      />
      <AdminFormControlLink className="button-primary" href={`${href}${joiner}breakdowns=1`}>
        Load breakdown tables
      </AdminFormControlLink>
    </AdminSection>
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
      <AdminSegmentedControl
        activeValue={activeValue}
        ariaLabel={label}
        className="usage-overview-range-buttons"
        options={options.map((option) => ({
          href: hrefFor(option.value),
          label: option.label,
          value: option.value,
        }))}
      />
    </div>
  );
}

function FunnelCard({ overview }: { overview: AdminMarketingOverview }) {
  return (
    <AdminSection
      actions={<MousePointerClick size={18} aria-hidden="true" />}
      bodyClassName="marketing-funnel-list"
      className="usage-overview-ranking-card marketing-funnel-card"
      description="Canonical HANDS funnel events from first open through repeat completion."
      title="Acquisition funnel"
    >
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
    </AdminSection>
  );
}

function InsightCard({ overview }: { overview: AdminMarketingOverview }) {
  return (
    <AdminSection
      actions={<Send size={18} aria-hidden="true" />}
      bodyClassName="marketing-insight-list"
      className="usage-overview-ranking-card marketing-insight-card"
      description="Operator-readable findings and current data gaps before paid scaling."
      footer={
        overview.dataGaps.length > 0 ? (
          <>
            {overview.dataGaps.map((gap) => (
              <span key={gap}>{gap}</span>
            ))}
          </>
        ) : null
      }
      footerClassName="marketing-data-gap-list"
      title="Top insights"
    >
        {(overview.topInsights.length ? overview.topInsights : ['No material insight in this range yet.']).map(
          (insight) => (
            <p key={insight}>{insight}</p>
          ),
        )}
    </AdminSection>
  );
}

function MarketingTable({
  description,
  emptyMessage,
  filters,
  icon,
  labelFor,
  page,
  primaryColumn,
  rows,
  secondaryFor,
  title,
}: {
  description: string;
  emptyMessage: string;
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
  icon: ReactNode;
  labelFor: (row: AdminMarketingDimensionRow) => string;
  page?: AdminMarketingDimensionPage;
  primaryColumn: string;
  rows: readonly AdminMarketingDimensionRow[];
  secondaryFor: (row: AdminMarketingDimensionRow) => string | null;
  title: string;
}) {
  const pageTake = page?.take ?? MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE;
  const activePage = page ? Math.floor(page.skip / pageTake) + 1 : 1;
  const totalRows = page?.totalCount ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageTake));
  const pageFrom = totalRows === 0 || rows.length === 0 || !page ? 0 : page.skip + 1;
  const pageTo = page ? Math.min(totalRows, page.skip + rows.length) : rows.length;

  return (
    <AdminSection
      actions={
        <div className="actions marketing-table-actions">
          {page ? (
            <StatusBadge tone="info">
              Showing {formatNumber(rows.length)} / {formatNumber(page.totalCount)}
            </StatusBadge>
          ) : null}
          {icon}
        </div>
      }
      className="usage-overview-ranking-card marketing-table-card"
      description={description}
      title={title}
    >
      <AdminTableScroll className="usage-overview-table-wrap">
        <AdminDataTable
          className="usage-overview-table marketing-analytics-table"
          emptyMessage={
            <AdminEmptyState
              message="Try a different range or remove the dimension filter."
              title={emptyMessage}
            />
          }
          headers={[primaryColumn, ...marketingDimensionMetricHeaders]}
          rowCount={rows.length}
        >
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
        </AdminDataTable>
      </AdminTableScroll>
      {page ? (
        <AdminTablePaginationFooter
          activePage={activePage}
          ariaLabel={`${title} pagination`}
          className="marketing-table-pagination-footer"
          from={pageFrom}
          hrefForPage={(nextPage) =>
            marketingAnalyticsDimensionPageHref(filters, page.dimension, nextPage)
          }
          summaryLabel={`Showing ${formatNumber(pageFrom)} to ${formatNumber(pageTo)} of ${formatNumber(
            totalRows,
          )} entries`}
          to={pageTo}
          totalPages={totalPages}
          totalRows={totalRows}
        />
      ) : null}
    </AdminSection>
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

function formatDecimal(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatNullableCurrency(value: number | null) {
  return value === null ? 'n/a' : formatCurrency(value);
}

function formatNullableMultiplier(value: number | null) {
  return value === null ? 'n/a' : `${formatDecimal(value)}x`;
}
