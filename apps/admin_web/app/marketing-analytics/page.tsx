import {
  ArrowUpRight,
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
  TicketPercent,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminOverviewGrid } from '../../components/admin-overview-card';
import {
  AdminMetricGrid,
  AdminPageTemplate,
  AdminSectionHeader,
} from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTextLink } from '../../components/admin-text-link';
import {
  AdminActionCard,
  AdminDetailGrid,
  AdminDisclosure,
  AdminNoticeCard,
  AdminSection,
  AdminTaskGrid,
} from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import {
  AdminMarketingDimensionKey,
  AdminMarketingDimensionPage,
  AdminMarketingDimensionRow,
  AdminMarketingAttributionQuality,
  AdminMarketingCouponPerformancePage,
  AdminMarketingCouponPerformanceRow,
  AdminMarketingCouponSummary,
  AdminMarketingComparison,
  AdminMarketingComparisonMetric,
  AdminMarketingOverview,
  AdminMarketingSummary,
  AdminMarketingStats,
  AdminMarketingUnknownAttributionDiagnostics,
  AdminMarketingUnknownAttributionReason,
  adminGetResult,
} from '../../lib/admin-api';
import {
  formatPercentLabel as formatPercent,
  shortDisplayId,
  formatWholeNumber as formatNumber,
} from '../../lib/admin-format';
import {
  MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE,
  MARKETING_ANALYTICS_COUPON_PAGE_SIZE,
  buildMarketingActionPriorities,
  hasMarketingDecisionEvidence,
  type MarketingActionPriority,
  marketingAnalyticsCouponPageHref,
  marketingAnalyticsCouponPaging,
  marketingAnalyticsCouponPerformanceApiPath,
  marketingAnalyticsCouponPerformanceEnabled,
  marketingAnalyticsCouponSummaryApiPath,
  marketingAnalyticsDimensionApiPath,
  marketingAnalyticsDimensionPageHref,
  marketingAnalyticsDimensionPaging,
  marketingAnalyticsHref,
  marketingAnalyticsSummaryApiPath,
  marketingAnalyticsPlatformOptions,
  marketingAnalyticsRangeOptions,
  marketingAnalyticsRegionOptions,
  marketingAnalyticsSourceOptions,
  marketingSpendDailyApiPath,
  marketingSpendPanelHref,
  normalizeMarketingSpendDraft,
  normalizeMarketingAnalyticsFilters,
  type MarketingSpendDraft,
} from './marketing-analytics-model';
import { MarketingAnalyticsTrendChart } from './marketing-analytics-trend-chart';
import {
  MarketingSpendActionForm,
  MarketingSpendSubmitButton,
} from './marketing-spend-action-form';

type MarketingAnalyticsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type MarketingDimensionPages = Record<AdminMarketingDimensionKey, AdminMarketingDimensionPage>;
type MarketingDimensionAvailability = Record<AdminMarketingDimensionKey, boolean>;
type MarketingDimensionLoadResult = {
  readonly available: MarketingDimensionAvailability;
  readonly pages: MarketingDimensionPages;
};
type MarketingPageOverview = AdminMarketingOverview &
  Pick<AdminMarketingSummary, 'comparison' | 'trend' | 'unknownAttributionDiagnostics'>;
type MarketingSpendDailyRecord = {
  campaignId: string;
  campaignName: string | null;
  currency: string;
  id: string;
  notes: string | null;
  platform: string;
  regionCode: string;
  source: string;
  spendAmount: number;
  spendDate: string;
  updatedAt: string;
};

const marketingDimensionKeys: readonly AdminMarketingDimensionKey[] = [
  'source',
  'region',
  'campaign',
  'platform',
];
const marketingDimensionMetricHeaders = [
  'Signups',
  'Completed',
  'Cancelled',
  'Ad spend',
  'CPA completed',
  'Fee revenue',
  'Gross ROAS',
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
  attributionQuality: {
    attributedFirstOpens: 0,
    unknownFirstOpens: 0,
    firstOpenCoverageRate: 0,
    attributedSignups: 0,
    unknownSignups: 0,
    signupCoverageRate: 0,
  },
  campaignEfficiency: [],
  topInsights: [],
  dataGaps: [],
};
const emptyMarketingSummary: AdminMarketingSummary = {
  ...emptyMarketingOverview,
  comparison: {
    previousRangeLabel: 'Previous 7 days',
    firstOpens: emptyComparisonMetric(),
    signups: emptyComparisonMetric(),
    bookingCompleted: emptyComparisonMetric(),
    adSpend: emptyComparisonMetric(),
    platformFeeRevenue: emptyComparisonMetric(),
  },
  trend: [],
  unknownAttributionDiagnostics: {
    totalUnknownSignups: 0,
    rows: [],
    recentAccounts: [],
  },
};

const emptyMarketingCouponSummary: AdminMarketingCouponSummary = {
  generatedAt: new Date(0).toISOString(),
  source: 'booking-payment-coupon-metadata',
  range: '7d',
  rangeLabel: 'Last 7 days',
  windowStartAt: new Date(0).toISOString(),
  windowEndAt: new Date(0).toISOString(),
  appliedBookingCount: 0,
  completedBookingCount: 0,
  cancelledBookingCount: 0,
  refundedBookingCount: 0,
  realizedDiscountAmount: 0,
  completedBookingValue: 0,
  completedConversionRate: 0,
  cancellationRate: 0,
  refundRate: 0,
  averageDiscountAmount: 0,
};

function emptyMarketingCouponPerformancePage(
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>,
  paging: { readonly skip: number; readonly take: number },
): AdminMarketingCouponPerformancePage {
  return {
    generatedAt: new Date(0).toISOString(),
    source: 'booking-payment-coupon-metadata',
    range: filters.range,
    rangeLabel: emptyMarketingCouponSummary.rangeLabel,
    windowStartAt: new Date(0).toISOString(),
    windowEndAt: new Date(0).toISOString(),
    rows: [],
    skip: paging.skip,
    take: paging.take,
    totalCount: 0,
  };
}

async function loadMarketingDimensionPages(
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>,
  params: Record<string, string | string[] | undefined> | undefined,
): Promise<MarketingDimensionLoadResult> {
  const pages = await Promise.all(
    marketingDimensionKeys.map(async (dimension) => {
      const paging = marketingAnalyticsDimensionPaging(params, dimension);
      const page = await adminGetResult<AdminMarketingDimensionPage>(
        marketingAnalyticsDimensionApiPath(filters, dimension, paging),
        emptyMarketingDimensionPage(dimension, filters, paging),
        {
          freshness: 'aggregate',
          revalidateSeconds: 60,
          tags: ['admin-marketing-analytics'],
        },
      );

      return [dimension, page] as const;
    }),
  );

  return {
    available: Object.fromEntries(
      pages.map(([dimension, result]) => [dimension, result.ok]),
    ) as MarketingDimensionAvailability,
    pages: Object.fromEntries(
      pages.map(([dimension, result]) => [dimension, result.data]),
    ) as MarketingDimensionPages,
  };
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
  const spendDraft = normalizeMarketingSpendDraft(params, filters);
  const includeBreakdowns = normalizeBreakdownParam(params?.breakdowns);
  const includeCouponPerformance = marketingAnalyticsCouponPerformanceEnabled(params);
  const couponPaging = marketingAnalyticsCouponPaging(params);
  const [summaryResult, couponSummaryResult, spendRecordResult] = await Promise.all([
    adminGetResult<AdminMarketingSummary>(marketingAnalyticsSummaryApiPath(filters), emptyMarketingSummary, {
      freshness: 'aggregate',
      revalidateSeconds: 60,
      tags: ['admin-marketing-analytics'],
    }),
    adminGetResult<AdminMarketingCouponSummary>(
      marketingAnalyticsCouponSummaryApiPath(filters),
      {
        ...emptyMarketingCouponSummary,
        range: filters.range,
      },
      {
        freshness: 'aggregate',
        revalidateSeconds: 60,
        tags: ['admin-marketing-analytics'],
      },
    ),
    spendDraft?.preview
      ? adminGetResult<MarketingSpendDailyRecord | null>(marketingSpendDailyApiPath(spendDraft), null)
      : Promise.resolve({ data: null, ok: true, status: null }),
  ]);
  const overview = summaryResult.ok ? marketingOverviewFromSummary(summaryResult.data) : null;
  const couponSummary = couponSummaryResult.data;
  const marketingActions = overview
    ? buildMarketingActionPriorities({
        attributionQuality: overview.attributionQuality,
        campaignEfficiency: overview.campaignEfficiency,
        comparison: overview.comparison,
        filters,
        rangeLabel: overview.rangeLabel,
        totals: overview.totals,
      })
    : [];
  const [dimensionLoadResult, couponPerformanceResult] = await Promise.all([
    includeBreakdowns ? loadMarketingDimensionPages(filters, params) : Promise.resolve(null),
    includeCouponPerformance
      ? adminGetResult<AdminMarketingCouponPerformancePage>(
          marketingAnalyticsCouponPerformanceApiPath(filters, couponPaging),
          emptyMarketingCouponPerformancePage(filters, couponPaging),
          {
            freshness: 'aggregate',
            revalidateSeconds: 60,
            tags: ['admin-marketing-analytics'],
          },
        )
      : Promise.resolve(null),
  ]);
  const dimensionPages = dimensionLoadResult?.pages ?? null;
  const dimensionAvailability = dimensionLoadResult?.available ?? null;
  const couponPerformancePage = couponPerformanceResult?.data ?? null;
  const cards = overview
    ? [
    {
      label: 'Ad spend',
      value: <MoneyText amount={overview.totals.adSpend} />,
      detail: 'Manual daily spend rows',
      icon: BadgeDollarSign,
      tone: 'warning',
    },
    {
      label: 'CPA completed customer',
      value: <MoneyText amount={overview.totals.conversionRates.cpaBookingCompleted} fallback="n/a" />,
      detail: 'Ad spend / completed cohort customers',
      icon: Target,
      tone: 'info',
    },
    {
      label: 'Gross ROAS',
      value: formatNullableMultiplier(overview.totals.conversionRates.roas),
      detail: 'Gross booking value / ad spend',
      icon: TrendingUp,
      tone: marketingRoasTone(overview.totals.conversionRates.roas),
    },
    {
      label: 'Fee ROAS',
      value: formatNullableMultiplier(overview.totals.conversionRates.platformFeeRoas),
      detail: 'Platform fee revenue / ad spend · 1.00x break-even',
      icon: BarChart3,
      tone: marketingRoasTone(overview.totals.conversionRates.platformFeeRoas),
    },
    {
      label: 'Platform fee revenue',
      value: <MoneyText amount={overview.totals.platformFeeRevenue} />,
      detail: (
        <>
          Gross <MoneyText amount={overview.totals.grossBookingValue} />
        </>
      ),
      icon: CircleDollarSign,
      tone: 'primary',
    },
  ]
    : [];

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink
          href={spendDraft ? marketingAnalyticsHref(filters) : marketingSpendPanelHref(filters)}
        >
          {spendDraft ? 'Close spend' : 'Add spend'}
        </AdminFormControlLink>
      }
      contentClassName="marketing-analytics-page"
      description="New-customer acquisition cohort, source, campaign, coupon, and spend performance from stored HANDS records."
      title="Marketing Analytics"
    >
      <AdminFilterPanel
        actions={
          <>
            <StatusBadge tone="info">{overview?.rangeLabel ?? marketingRangeLabel(filters.range)}</StatusBadge>
            <StatusBadge tone="info">Signup cohort</StatusBadge>
            <StatusBadge tone="neutral">Spend source: manual records</StatusBadge>
            {overview ? (
              <StatusBadge tone="info">
                Generated <DateTimeText value={overview.generatedAt} />
              </StatusBadge>
            ) : (
              <StatusBadge tone="danger">Marketing summary unavailable</StatusBadge>
            )}
          </>
        }
        className="marketing-analytics-filter-panel"
        description="Range and source scope the acquisition cohort. Platform and campaign are available as secondary cohort filters."
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
        <AdminDisclosure
          ariaLabel="Additional marketing filters"
          className="marketing-analytics-more-filters"
          open={Boolean(filters.platform || filters.campaignId)}
        >
          <summary>More filters</summary>
          <div className="marketing-analytics-more-filter-fields">
            <FilterButtons
              label="Platform"
              options={marketingAnalyticsPlatformOptions}
              activeValue={filters.platform ?? 'all'}
              hrefFor={(platform) =>
                marketingAnalyticsHref({ ...filters, platform: platform === 'all' ? null : platform })
              }
            />
            <AdminFormGrid className="marketing-analytics-campaign-form" action="/marketing-analytics">
              <input type="hidden" name="range" value={filters.range} />
              {filters.source ? <input type="hidden" name="source" value={filters.source} /> : null}
              {filters.platform ? <input type="hidden" name="platform" value={filters.platform} /> : null}
              <AdminFormInput
                defaultValue={filters.campaignId ?? ''}
                label="Campaign ID"
                labelVisibility="visible"
                name="campaignId"
                placeholder="Search recent campaigns"
                type="search"
              />
              <AdminFormControlButton className="marketing-analytics-apply-button" type="submit">
                Apply campaign
              </AdminFormControlButton>
            </AdminFormGrid>
          </div>
        </AdminDisclosure>
        <AdminFilterSummary
          ariaLabel="Active marketing filters"
          labels={[marketingAnalyticsActiveFilterLabels(filters).join(' · ')]}
          tone="info"
        >
          {filters.range !== '7d' ? (
            <AdminTextLink href={marketingAnalyticsHref({ ...filters, range: '7d' })}>
              Reset range
            </AdminTextLink>
          ) : null}
          {filters.source ? (
            <AdminTextLink href={marketingAnalyticsHref({ ...filters, source: null })}>
              Clear source
            </AdminTextLink>
          ) : null}
          {filters.platform ? (
            <AdminTextLink href={marketingAnalyticsHref({ ...filters, platform: null })}>
              Clear platform
            </AdminTextLink>
          ) : null}
          {filters.campaignId ? (
            <AdminTextLink href={marketingAnalyticsHref({ ...filters, campaignId: null })}>
              Clear campaign
            </AdminTextLink>
          ) : null}
          {filters.range !== '7d' ||
          filters.source ||
          filters.platform ||
          filters.campaignId ? (
            <AdminTextLink
              href={marketingAnalyticsHref({
                ...filters,
                campaignId: null,
                platform: null,
                range: '7d',
                source: null,
              })}
            >
              Clear all
            </AdminTextLink>
          ) : null}
        </AdminFilterSummary>
      </AdminFilterPanel>

      {spendDraft ? (
        <MarketingSpendPanel
          draft={spendDraft}
          filters={filters}
          readFailed={!spendRecordResult.ok}
          record={spendRecordResult.data}
        />
      ) : null}

      {overview ? (
        <>
          <MarketingNeedsActionSection
            actions={marketingActions}
            hasEvidence={hasMarketingDecisionEvidence(overview.totals)}
            rangeLabel={overview.rangeLabel}
          />

          <FunnelCard overview={overview} />

          <AdminOverviewGrid
            ariaLabel="Marketing attribution quality and campaign efficiency"
            baseClassName="marketing-operations-grid"
            variant="content"
          >
            <AttributionQualityCard
              diagnostics={overview.unknownAttributionDiagnostics}
              quality={overview.attributionQuality}
              rangeLabel={overview.rangeLabel}
            />
            <CampaignEfficiencyCard rangeLabel={overview.rangeLabel} rows={overview.campaignEfficiency} />
          </AdminOverviewGrid>

          <section
            aria-labelledby="marketing-business-outcomes-title"
            className="marketing-outcome-metrics-group"
          >
            <AdminSectionHeader
              status={<StatusBadge tone="info">{overview.rangeLabel}</StatusBadge>}
              title="Business outcome metrics"
              titleId="marketing-business-outcomes-title"
            />
            <AdminMetricGrid
              ariaLabel="Marketing business outcome metrics"
              className="marketing-analytics-metric-grid"
              metrics={cards.map(({ label, value, detail, icon, tone }) => ({
                className: `marketing-analytics-metric is-${tone}`,
                helper: detail,
                icon,
                iconSize: 18,
                label,
                scope: null,
                value,
              }))}
            />
          </section>

          <MarketingComparisonSection comparison={overview.comparison} rangeLabel={overview.rangeLabel} />

          <AdminSection
            actions={<StatusBadge tone="info">Vietnam time</StatusBadge>}
            bodyClassName="marketing-trend-body"
            className="marketing-trend-section"
            description="Daily authenticated app entry and new-signup activity. First-booking lines stay inside the selected new-customer cohort; ad spend uses recorded daily rows."
            id="marketing-acquisition-trend"
            title="Acquisition and booking trend"
          >
            <MarketingAnalyticsTrendChart points={overview.trend} />
          </AdminSection>
        </>
      ) : (
        <MarketingSummaryUnavailable filters={filters} />
      )}

      <CouponPerformanceSection
        available={couponSummaryResult.ok}
        filters={filters}
        page={couponPerformancePage}
        pageAvailable={couponPerformanceResult?.ok ?? true}
        summary={couponSummary}
      />

      <AdminSection
        actions={
          <StatusBadge tone="neutral">
            {filters.regionCode
              ? marketingFilterOptionLabel(marketingAnalyticsRegionOptions, filters.regionCode)
              : 'All regions'}
          </StatusBadge>
        }
        bodyClassName="marketing-breakdown-scope-body"
        className="marketing-breakdown-scope"
        description="Region scopes manually recorded spend and recent location evidence only. It does not change the headline acquisition cohort, comparison, actions, or coupons."
        title="Spend & location breakdown scope"
      >
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
      </AdminSection>

      <div className="marketing-breakdown-stack">
        {dimensionPages ? (
          <>
            <MarketingTable
              available={dimensionAvailability?.source ?? true}
              title="Source performance"
              description="Current first slice groups unknown demand separately from tracked referral attribution."
              emptyMessage="No source aggregate loaded."
              filters={filters}
              page={dimensionPages.source}
              rows={dimensionPages.source.rows}
              primaryColumn="Source"
              icon={<Megaphone size={18} aria-hidden="true" />}
              labelFor={(row) => sourceLabel(row.source)}
              secondaryFor={(row) => (row.platform ? platformLabel(row.platform) : null)}
            />
            <MarketingTable
              available={dimensionAvailability?.region ?? true}
              title="Recent location evidence"
              description="Sample · up to 100 recent records per evidence source from saved addresses, booking service addresses, and recorded spend. This is not a complete regional total."
              emptyMessage="No recent regional evidence loaded."
              filters={filters}
              page={dimensionPages.region}
              rows={dimensionPages.region.rows.filter(hasMarketingActivity)}
              primaryColumn="Region"
              icon={<MapPinned size={18} aria-hidden="true" />}
              labelFor={(row) => row.regionName ?? row.regionCode ?? 'Unknown region'}
              secondaryFor={(row) => row.regionCode ?? null}
            />
            <MarketingTable
              available={dimensionAvailability?.campaign ?? true}
              title="Campaign performance"
              description="Referral code campaigns first; paid campaign rows can be added by manual spend/import foundation."
              emptyMessage="No tracked campaign rows in this range."
              filters={filters}
              page={dimensionPages.campaign}
              rows={dimensionPages.campaign.rows}
              primaryColumn="Campaign"
              icon={<BarChart3 size={18} aria-hidden="true" />}
              labelFor={(row) => row.campaignName ?? row.campaignId ?? 'Unknown campaign'}
              secondaryFor={(row) => (row.source ? sourceLabel(row.source) : null)}
            />
            <MarketingTable
              available={dimensionAvailability?.platform ?? true}
              title="Platform first opens"
              description="First recorded app platform for the selected acquisition cohort."
              emptyMessage="No platform first-open rows in this range."
              filters={filters}
              page={dimensionPages.platform}
              rows={dimensionPages.platform.rows}
              primaryColumn="Platform"
              icon={<Smartphone size={18} aria-hidden="true" />}
              labelFor={(row) => platformLabel(row.platform)}
              secondaryFor={() => null}
            />
          </>
        ) : (
          <MarketingBreakdownLoader filters={filters} />
        )}
      </div>

      {overview ? <InsightCard overview={overview} /> : null}
    </AdminPageTemplate>
  );
}

function MarketingNeedsActionSection({
  actions,
  hasEvidence,
  rangeLabel,
}: {
  actions: readonly MarketingActionPriority[];
  hasEvidence: boolean;
  rangeLabel: string;
}) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={actions.length > 0 ? 'warning' : hasEvidence ? 'success' : 'neutral'}>
          {actions.length > 0
            ? `${actions.length} open`
            : hasEvidence
              ? 'No threshold breach'
              : 'Awaiting evidence'}
        </StatusBadge>
      }
      className="marketing-needs-action-section"
      description="Top campaign spend, fee break-even, period decline, and attribution issues. Only the four highest-priority findings are shown."
      id="marketing-needs-action"
      title="Marketing needs action"
    >
      {actions.length > 0 ? (
        <AdminTaskGrid className="marketing-needs-action-grid">
          {actions.map((action) => (
            <AdminActionCard
              actionLabel={action.actionLabel}
              className={`marketing-needs-action-card is-${action.tone}`}
              detail={action.detail}
              href={action.href}
              key={action.key}
              leading={<StatusBadge tone={action.tone}>{action.scope}</StatusBadge>}
              title={action.title}
              value={marketingActionValue(action)}
              variant="ops-task"
            />
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState
          message={
            hasEvidence
              ? 'Campaign spend, fee return, period movement, and attribution coverage are within the current decision thresholds.'
              : 'Record customer entry, signup, or campaign spend evidence before judging marketing performance.'
          }
          title={
            hasEvidence
              ? `No marketing action triggered in ${rangeLabel.toLowerCase()}`
              : `No marketing evidence in ${rangeLabel.toLowerCase()}`
          }
        />
      )}
    </AdminSection>
  );
}

function marketingActionValue(action: MarketingActionPriority) {
  if (action.valueKind === 'money') {
    return <MoneyText amount={action.value} />;
  }
  if (action.valueKind === 'percent') {
    return formatPercent(action.value);
  }
  if (action.valueKind === 'multiplier') {
    return `${formatDecimal(action.value)}x`;
  }
  return formatNumber(action.value);
}

function AttributionQualityCard({
  diagnostics,
  quality,
  rangeLabel,
}: {
  diagnostics: AdminMarketingUnknownAttributionDiagnostics;
  quality: AdminMarketingAttributionQuality;
  rangeLabel: string;
}) {
  const signupTotal = quality.attributedSignups + quality.unknownSignups;
  const entryTotal = quality.attributedFirstOpens + quality.unknownFirstOpens;

  return (
    <AdminSection
      bodyClassName="marketing-attribution-quality"
      className="marketing-attribution-card"
      description="Known first-touch source versus Unknown for the selected customer cohort."
      id="marketing-attribution-quality"
      title="Attribution quality"
    >
      <div className="marketing-attribution-coverage-summary">
        <div>
          <span>Signup source coverage</span>
          <strong>{formatPercent(quality.signupCoverageRate)}</strong>
          <small>{rangeLabel}</small>
        </div>
        <div
          aria-label={`${formatPercent(quality.signupCoverageRate)} signup source coverage`}
          className="marketing-attribution-progress"
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={quality.signupCoverageRate}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, quality.signupCoverageRate))}%` }} />
        </div>
      </div>
      <div className="marketing-attribution-breakdown">
        <div>
          <span>Known signups</span>
          <strong>{formatNumber(quality.attributedSignups)}</strong>
          <small>of {formatNumber(signupTotal)}</small>
        </div>
        <div>
          <span>Unknown signups</span>
          <strong>{formatNumber(quality.unknownSignups)}</strong>
          <small>needs source data</small>
        </div>
        <div>
          <span>Known entrants</span>
          <strong>{formatNumber(quality.attributedFirstOpens)}</strong>
          <small>
            {formatPercent(quality.firstOpenCoverageRate)} of {formatNumber(entryTotal)}
          </small>
        </div>
      </div>
      <div className="marketing-attribution-diagnostics">
        <div className="marketing-attribution-diagnostics-heading">
          <div>
            <strong>Unknown signup diagnostics</strong>
            <small>First customer session evidence for this signup cohort</small>
          </div>
          <StatusBadge tone={diagnostics.totalUnknownSignups > 0 ? 'warning' : 'success'}>
            {formatNumber(diagnostics.totalUnknownSignups)} unknown
          </StatusBadge>
        </div>
        {diagnostics.rows.length > 0 ? (
          <div
            aria-label="Unknown signup attribution diagnostics"
            className="marketing-attribution-diagnostic-list"
          >
            {diagnostics.rows.map((row) => (
              <div
                className="marketing-attribution-diagnostic-row"
                key={`${row.platform}:${row.appVersion ?? 'unknown'}:${row.reason}`}
              >
                <div>
                  <strong>{platformLabel(row.platform)}</strong>
                  <small>{row.appVersion ?? 'Version not reported'}</small>
                </div>
                <span>{unknownAttributionReasonLabel(row.reason)}</span>
                <strong>{formatNumber(row.signupCount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="marketing-attribution-diagnostics-empty">
            No unknown signup source requires client diagnosis.
          </p>
        )}
        {diagnostics.recentAccounts.length > 0 ? (
          <div className="marketing-attribution-account-trace">
            <div className="marketing-attribution-account-trace-heading">
              <strong>Recent signup gaps</strong>
              <small>Latest accounts without a usable first-touch source</small>
            </div>
            <div aria-label="Recent unknown signup accounts" className="marketing-attribution-account-list">
              {diagnostics.recentAccounts.map((account) => (
                <Link
                  className="marketing-attribution-account-row"
                  href={`/customers/${encodeURIComponent(account.customerProfileId)}`}
                  key={account.customerUserId}
                  prefetch={false}
                >
                  <div>
                    <strong>Customer {shortDisplayId(account.customerProfileId)}</strong>
                    <small>
                      Signed up <DateTimeText value={account.signupAt} />
                    </small>
                  </div>
                  <div>
                    <span>{unknownAttributionReasonLabel(account.reason)}</span>
                    <small>
                      {platformLabel(account.platform)} / {account.appVersion ?? 'Version not reported'}
                    </small>
                  </div>
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
}

function CampaignEfficiencyCard({
  rangeLabel,
  rows,
}: {
  rangeLabel: string;
  rows: readonly AdminMarketingDimensionRow[];
}) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">Top {Math.min(5, rows.length)}</StatusBadge>}
      bodyClassName="marketing-campaign-efficiency"
      className="marketing-campaign-efficiency-card"
      description="Completed customer cohorts and fee return after manually recorded ad spend."
      id="marketing-campaign-efficiency"
      title="Campaign efficiency"
    >
      {rows.length > 0 ? (
        <AdminTableScroll
          ariaLabel="Campaign efficiency table"
          className="marketing-campaign-efficiency-table-wrap"
        >
          <AdminDataTable
            className="marketing-campaign-efficiency-table"
            emptyMessage={null}
            headers={['Campaign', 'Completed', 'Ad spend', 'CPA completed', 'Fee ROAS', 'Decision']}
            rowCount={rows.length}
          >
            {rows.map((row) => {
              const decision = campaignEfficiencyDecision(row);

              return (
                <tr key={row.key}>
                  <td>
                    <div className="marketing-campaign-efficiency-name">
                      <strong>{row.campaignName ?? row.campaignId ?? 'Unknown campaign'}</strong>
                      <small>
                        {[sourceLabel(row.source), row.platform ? platformLabel(row.platform) : null]
                          .filter(Boolean)
                          .join(' / ')}
                      </small>
                    </div>
                  </td>
                  <td>{formatNumber(row.bookingCompleted)}</td>
                  <td>
                    <MoneyText amount={row.adSpend} />
                  </td>
                  <td>
                    <MoneyText amount={row.conversionRates.cpaBookingCompleted} fallback="n/a" />
                  </td>
                  <td>{formatNullableMultiplier(row.conversionRates.platformFeeRoas)}</td>
                  <td>
                    <StatusBadge tone={decision.tone}>{decision.label}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState
          message="Add a campaign ID to attribution or a manual spend row to compare campaign efficiency."
          title={`No campaign evidence in ${rangeLabel.toLowerCase()}`}
        />
      )}
    </AdminSection>
  );
}

function campaignEfficiencyDecision(row: AdminMarketingDimensionRow) {
  if (row.adSpend > 0 && row.bookingCompleted === 0) {
    return { label: 'Review spend', tone: 'danger' as const };
  }
  if (row.adSpend <= 0) {
    return { label: 'Tracked only', tone: 'info' as const };
  }
  if ((row.conversionRates.platformFeeRoas ?? 0) >= 1) {
    return { label: 'Fee positive', tone: 'success' as const };
  }
  return { label: 'Below break-even', tone: 'warning' as const };
}

function MarketingComparisonSection({
  comparison,
  rangeLabel,
}: {
  comparison: AdminMarketingComparison;
  rangeLabel: string;
}) {
  const rows = [
    {
      key: 'first-opens',
      label: 'Tracked entrants',
      metric: comparison.firstOpens,
      money: false,
      neutralDelta: false,
    },
    {
      key: 'signups',
      label: 'New signups',
      metric: comparison.signups,
      money: false,
      neutralDelta: false,
    },
    {
      key: 'completed',
      label: 'Completed cohort',
      metric: comparison.bookingCompleted,
      money: false,
      neutralDelta: false,
    },
    {
      key: 'spend',
      label: 'Ad spend',
      metric: comparison.adSpend,
      money: true,
      neutralDelta: true,
    },
    {
      key: 'fee-revenue',
      label: 'Fee revenue',
      metric: comparison.platformFeeRevenue,
      money: true,
      neutralDelta: false,
    },
  ] as const;

  return (
    <AdminSection
      actions={<StatusBadge tone="info">{comparison.previousRangeLabel}</StatusBadge>}
      bodyClassName="marketing-comparison-strip"
      className="marketing-comparison-section"
      description={`Current ${rangeLabel.toLowerCase()} values compared with the same elapsed previous period.`}
      id="marketing-previous-period"
      title="Previous-period comparison"
    >
      {rows.map((row) => {
        const deltaState = marketingComparisonDelta(row.metric, row.neutralDelta);

        return (
          <div className="marketing-comparison-item" key={row.key}>
            <span>{row.label}</span>
            <strong>
              {row.money ? <MoneyText amount={row.metric.current} /> : formatNumber(row.metric.current)}
            </strong>
            <div>
              <StatusBadge tone={deltaState.tone}>{deltaState.label}</StatusBadge>
              <small>
                Previous{' '}
                {row.money ? <MoneyText amount={row.metric.previous} /> : formatNumber(row.metric.previous)}
              </small>
            </div>
          </div>
        );
      })}
    </AdminSection>
  );
}

function marketingComparisonDelta(metric: AdminMarketingComparisonMetric, neutralDelta: boolean) {
  if (metric.delta === 0) {
    return { label: 'No change', tone: 'neutral' as const };
  }

  const prefix = metric.delta > 0 ? '+' : '';
  const label =
    metric.deltaPercent === null
      ? metric.delta > 0
        ? 'New activity'
        : 'No previous baseline'
      : `${prefix}${formatDecimal(metric.deltaPercent)}%`;

  if (neutralDelta) {
    return { label, tone: 'info' as const };
  }

  return {
    label,
    tone: metric.delta > 0 ? ('success' as const) : ('warning' as const),
  };
}

function CouponPerformanceSection({
  available,
  filters,
  page,
  pageAvailable,
  summary,
}: {
  available: boolean;
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
  page: AdminMarketingCouponPerformancePage | null;
  pageAvailable: boolean;
  summary: AdminMarketingCouponSummary;
}) {
  const hasActivity =
    summary.appliedBookingCount > 0 ||
    summary.completedBookingCount > 0 ||
    summary.cancelledBookingCount > 0 ||
    summary.refundedBookingCount > 0 ||
    summary.realizedDiscountAmount > 0 ||
    summary.completedBookingValue > 0 ||
    Boolean(page?.rows.length);
  const couponMetrics = [
    {
      helper: 'Bookings created with a coupon code in this range.',
      icon: TicketPercent,
      label: 'Coupon checkouts',
      value: formatNumber(summary.appliedBookingCount),
    },
    {
      helper: `${formatPercent(summary.completedConversionRate)} of coupon checkout bookings.`,
      icon: CheckCircle2,
      label: 'Completed',
      value: formatNumber(summary.completedBookingCount),
    },
    {
      helper: `${formatNumber(summary.cancelledBookingCount)} cancelled / ${formatNumber(
        summary.refundedBookingCount,
      )} refunded.`,
      icon: ClipboardList,
      label: 'Outcome exceptions',
      value: formatNumber(summary.cancelledBookingCount + summary.refundedBookingCount),
    },
    {
      helper: (
        <>
          Average <MoneyText amount={summary.averageDiscountAmount} /> per completed booking.
        </>
      ),
      icon: BadgeDollarSign,
      label: 'Realized discount',
      value: <MoneyText amount={summary.realizedDiscountAmount} />,
    },
    {
      helper: 'Completed coupon booking value after checkout discount.',
      icon: CircleDollarSign,
      label: 'Completed booking value',
      value: <MoneyText amount={summary.completedBookingValue} />,
    },
  ];

  return (
    <section aria-label="Coupon checkout performance" className="marketing-coupon-performance-group">
      <div className="marketing-coupon-performance-heading">
        <div>
          <h2>Coupon checkout performance</h2>
          <p>
            Booking-created cohort for the selected range. Completed conversion excludes cancelled and
            refunded bookings; expense, tax, and settlement evidence remain in Coupon Finance.
          </p>
        </div>
        <div className="actions marketing-coupon-actions">
          <StatusBadge tone="neutral">Scope: selected range only</StatusBadge>
          <AdminFormControlLink className="button-secondary" href="/coupons">
            Coupon operations
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/finance-tax/coupon-finance">
            Coupon finance
          </AdminFormControlLink>
        </div>
      </div>
      {!available ? (
        <AdminNoticeCard role="alert" tone="danger">
          <strong>Coupon performance is temporarily unavailable</strong>
          <p>
            Coupon results could not be loaded. Headline acquisition data remains independent; retry
            before using coupon outcomes.
          </p>
          <AdminTextLink href={marketingAnalyticsHref(filters)}>Retry coupon data</AdminTextLink>
        </AdminNoticeCard>
      ) : hasActivity ? (
        <AdminMetricGrid
          ariaLabel="Coupon marketing metrics"
          className="marketing-coupon-metric-grid"
          metrics={couponMetrics.map(({ helper, icon, label, value }) => ({
            className: 'marketing-coupon-metric',
            helper,
            icon,
            iconSize: 18,
            label,
            scope: null,
            value,
          }))}
        />
      ) : (
        <div className="marketing-coupon-empty-state">
          <AdminEmptyState
            message="Try a longer range, review coupon operations, or load code-level rows when you need historical evidence."
            title="No coupon checkout activity in this range"
          />
          <div className="actions">
            <AdminFormControlLink
              className="button-primary"
              href={marketingAnalyticsCouponPageHref(filters)}
            >
              Load coupon performance
            </AdminFormControlLink>
          </div>
        </div>
      )}
      {available && hasActivity ? <AdminSection
        actions={
          page ? (
            <StatusBadge tone="info">
              Showing {formatNumber(page.rows.length)} / {formatNumber(page.totalCount)}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">On demand</StatusBadge>
          )
        }
        bodyClassName="marketing-coupon-performance-body"
        className="marketing-coupon-performance-section"
        description="Server-paged coupon code outcomes for the selected booking-created cohort."
        title="Coupon code performance"
      >
        {!pageAvailable ? (
          <AdminNoticeCard role="alert" tone="danger">
            <strong>Coupon code rows could not be loaded</strong>
            <p>The range summary is still available. Retry before using code-level evidence.</p>
            <AdminTextLink href={marketingAnalyticsCouponPageHref(filters)}>
              Retry coupon rows
            </AdminTextLink>
          </AdminNoticeCard>
        ) : page ? (
          <CouponPerformanceTable filters={filters} page={page} rows={page.rows} />
        ) : (
          <div className="marketing-coupon-loader">
            <AdminEmptyState
              framed
              message="Summary metrics stay lightweight. Load the paged table only when you need code-level conversion evidence."
              title="Coupon rows are not loaded by default."
            />
            <AdminFormControlLink className="button-primary" href={marketingAnalyticsCouponPageHref(filters)}>
              Load coupon performance
            </AdminFormControlLink>
          </div>
        )}
      </AdminSection> : null}
    </section>
  );
}

function CouponPerformanceTable({
  filters,
  page,
  rows,
}: {
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
  page: AdminMarketingCouponPerformancePage;
  rows: readonly AdminMarketingCouponPerformanceRow[];
}) {
  const pageTake = page.take || MARKETING_ANALYTICS_COUPON_PAGE_SIZE;
  const activePage = Math.floor(page.skip / pageTake) + 1;
  const totalPages = Math.max(1, Math.ceil(page.totalCount / pageTake));
  const pageFrom = rows.length > 0 ? page.skip + 1 : 0;
  const pageTo = rows.length > 0 ? Math.min(page.totalCount, page.skip + rows.length) : 0;

  return (
    <>
      <AdminTableScroll
        ariaLabel="Coupon checkout performance table"
        className="marketing-analytics-table-wrap marketing-coupon-table-wrap"
      >
        <AdminDataTable
          className="marketing-analytics-table marketing-coupon-table"
          emptyMessage={
            <AdminEmptyState
              message="Try a longer range or review active codes in Coupon operations."
              title="No coupon checkout activity in this range."
            />
          }
          headers={[
            'Coupon',
            'State',
            'Checkouts',
            'Completed',
            'Cancelled',
            'Refunded',
            'Conversion',
            'Realized discount',
            'Booking value',
            'Last checkout',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={`${row.couponId ?? 'historical'}:${row.couponCode}`}>
              <td>
                <a className="text-link" href={`/coupons?q=${encodeURIComponent(row.couponCode)}`}>
                  {row.couponCode}
                </a>
              </td>
              <td>
                <StatusBadge tone={marketingCouponStateTone(row.couponState)}>
                  {marketingCouponStateLabel(row.couponState)}
                </StatusBadge>
              </td>
              <td>{formatNumber(row.appliedBookingCount)}</td>
              <td>{formatNumber(row.completedBookingCount)}</td>
              <td>{formatNumber(row.cancelledBookingCount)}</td>
              <td>{formatNumber(row.refundedBookingCount)}</td>
              <td>{formatPercent(row.completedConversionRate)}</td>
              <td>
                <MoneyText amount={row.realizedDiscountAmount} />
              </td>
              <td>
                <MoneyText amount={row.completedBookingValue} />
              </td>
              <td>
                <DateTimeText fallback="No checkout" value={row.latestCheckoutAt} />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel="Coupon performance pagination"
        className="marketing-table-pagination-footer"
        from={pageFrom}
        hrefForPage={(nextPage) => marketingAnalyticsCouponPageHref(filters, nextPage)}
        summaryLabel={`Showing ${formatNumber(pageFrom)} to ${formatNumber(pageTo)} of ${formatNumber(
          page.totalCount,
        )} entries`}
        to={pageTo}
        totalPages={totalPages}
        totalRows={page.totalCount}
      />
    </>
  );
}

function marketingCouponStateLabel(state: AdminMarketingCouponPerformanceRow['couponState']) {
  if (state === 'LIVE') return 'Live';
  if (state === 'SCHEDULED') return 'Scheduled';
  if (state === 'PAUSED') return 'Paused';
  if (state === 'EXPIRED') return 'Expired';
  return 'Historical';
}

function marketingCouponStateTone(state: AdminMarketingCouponPerformanceRow['couponState']) {
  if (state === 'LIVE') return 'success' as const;
  if (state === 'SCHEDULED') return 'info' as const;
  if (state === 'PAUSED' || state === 'EXPIRED') return 'warning' as const;
  return 'neutral' as const;
}

function MarketingSpendPanel({
  draft,
  filters,
  readFailed,
  record,
}: {
  draft: MarketingSpendDraft;
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
  readFailed: boolean;
  record: MarketingSpendDailyRecord | null;
}) {
  return (
    <AdminSection
      actions={
        <>
          <StatusBadge tone={draft.preview ? 'warning' : 'info'}>
            {draft.preview ? 'Review change' : 'Draft input'}
          </StatusBadge>
          <AdminFormControlLink href={marketingAnalyticsHref(filters)}>Close</AdminFormControlLink>
        </>
      }
      className="marketing-spend-panel"
      description="Analysis remains read-only until one daily spend change is reviewed with its current value and operator reason."
      id="marketing-spend-panel"
      title="Add daily spend"
    >
      {draft.preview ? (
        <MarketingSpendReview draft={draft} filters={filters} readFailed={readFailed} record={record} />
      ) : (
        <MarketingSpendDraftForm draft={draft} filters={filters} />
      )}
    </AdminSection>
  );
}

function MarketingSpendDraftForm({
  draft,
  filters,
}: {
  draft: MarketingSpendDraft;
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
}) {
  return (
    <AdminFormGrid action="/marketing-analytics" className="marketing-spend-form" method="get">
      <MarketingSpendFilterInputs filters={filters} />
      <input name="spend" type="hidden" value="add" />
      <input name="spendPreview" type="hidden" value="1" />
      <AdminFormDate
        defaultValue={draft.spendDate}
        label="Date"
        labelVisibility="visible"
        name="spendDate"
        required
      />
      <AdminFormSelect
        defaultValue={draft.source}
        label="Source"
        labelVisibility="visible"
        name="spendSource"
        options={marketingAnalyticsSourceOptions
          .filter((option) => option.value !== 'all' && option.value !== 'unknown')
          .map((option) => ({ label: option.label, value: option.value }))}
      />
      <AdminFormSelect
        defaultValue={draft.platform}
        label="Platform"
        labelVisibility="visible"
        name="spendPlatform"
        options={marketingAnalyticsPlatformOptions
          .filter((option) => option.value !== 'all')
          .map((option) => ({ label: option.label, value: option.value }))}
      />
      <AdminFormSelect
        defaultValue={draft.regionCode}
        label="Region"
        labelVisibility="visible"
        name="spendRegionCode"
        options={marketingAnalyticsRegionOptions.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
      />
      <AdminFormInput
        defaultValue={draft.campaignId}
        label="Campaign ID"
        labelVisibility="visible"
        name="spendCampaignId"
        placeholder="e.g. launch-hcm"
      />
      <AdminFormInput
        defaultValue={draft.campaignName}
        label="Campaign name"
        labelVisibility="visible"
        name="spendCampaignName"
        placeholder="e.g. Launch HCMC"
      />
      <AdminFormInput
        defaultValue={draft.spendAmount ?? ''}
        label="Spend amount"
        labelVisibility="visible"
        min={0}
        name="spendAmount"
        placeholder="e.g. 600000"
        required
        step={1}
        type="number"
      />
      <AdminFormStaticValue
        hiddenName="spendCurrency"
        hiddenValue="VND"
        label="Currency"
        labelVisibility="visible"
        value="VND"
      />
      <AdminFormActionRow>
        <AdminFormControlButton className="marketing-analytics-apply-button" type="submit">
          Review change
        </AdminFormControlButton>
        <AdminFormControlLink href={marketingAnalyticsHref(filters)}>Cancel</AdminFormControlLink>
      </AdminFormActionRow>
    </AdminFormGrid>
  );
}

function MarketingSpendReview({
  draft,
  filters,
  readFailed,
  record,
}: {
  draft: MarketingSpendDraft;
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
  readFailed: boolean;
  record: MarketingSpendDailyRecord | null;
}) {
  const existingAmount = record?.spendAmount ?? 0;
  const nextAmount = draft.spendAmount ?? 0;
  const delta = nextAmount - existingAmount;

  if (readFailed) {
    return (
      <AdminNoticeCard role="alert" tone="danger">
        <strong>Current spend could not be loaded</strong>
        <p>Do not save this change until the API is available and the existing value can be verified.</p>
      </AdminNoticeCard>
    );
  }

  return (
    <>
      <AdminNoticeCard className="admin-mb-16" tone={delta === 0 ? 'info' : 'warning'}>
        <strong>Change summary</strong>
        <p>
          <MoneyText amount={existingAmount} currency="VND" /> →{' '}
          <MoneyText amount={nextAmount} currency="VND" /> ({delta >= 0 ? '+' : ''}
          <MoneyText amount={delta} currency="VND" />)
        </p>
      </AdminNoticeCard>
      <AdminDetailGrid ariaLabel="Daily spend change evidence" className="admin-mb-16">
        <AdminFormStaticValue
          label="Period"
          labelVisibility="visible"
          value={`${draft.spendDate} · Vietnam time`}
        />
        <AdminFormStaticValue label="Source" labelVisibility="visible" value={sourceLabel(draft.source)} />
        <AdminFormStaticValue
          label="Channel"
          labelVisibility="visible"
          value={platformLabel(draft.platform)}
        />
        <AdminFormStaticValue label="Region" labelVisibility="visible" value={draft.regionCode} />
        <AdminFormStaticValue
          label="Campaign"
          labelVisibility="visible"
          value={draft.campaignName || draft.campaignId || 'All campaigns'}
        />
        <AdminFormStaticValue label="Currency" labelVisibility="visible" value="VND" />
        <AdminFormStaticValue
          label="Existing value"
          labelVisibility="visible"
          value={<MoneyText amount={existingAmount} />}
        />
        <AdminFormStaticValue
          label="New value"
          labelVisibility="visible"
          value={<MoneyText amount={nextAmount} />}
        />
      </AdminDetailGrid>
      <MarketingSpendActionForm className="marketing-spend-form">
        <input name="spendDate" type="hidden" value={draft.spendDate} />
        <input name="source" type="hidden" value={draft.source} />
        <input name="platform" type="hidden" value={draft.platform} />
        <input name="regionCode" type="hidden" value={draft.regionCode} />
        <input name="campaignId" type="hidden" value={draft.campaignId} />
        <input name="campaignName" type="hidden" value={draft.campaignName} />
        <input name="spendAmount" type="hidden" value={nextAmount} />
        <input name="currency" type="hidden" value="VND" />
        <input name="expectedUpdatedAt" type="hidden" value={record?.updatedAt ?? ''} />
        <AdminFormTextarea
          className="admin-grid-span-2"
          defaultValue={record?.notes ?? ''}
          label="Notes"
          labelVisibility="visible"
          maxLength={500}
          name="notes"
          rows={3}
        />
        <AdminFormTextarea
          className="admin-grid-span-2"
          label="Change reason"
          labelVisibility="visible"
          maxLength={500}
          minLength={12}
          name="reason"
          required
          rows={3}
        />
        <AdminFormActionRow>
          <MarketingSpendSubmitButton />
          <AdminFormControlLink href={marketingSpendPanelHref(filters, draft)}>
            Edit inputs
          </AdminFormControlLink>
        </AdminFormActionRow>
      </MarketingSpendActionForm>
    </>
  );
}

function MarketingSpendFilterInputs({
  filters,
}: {
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
}) {
  return (
    <>
      <input name="range" type="hidden" value={filters.range} />
      {filters.source ? <input name="source" type="hidden" value={filters.source} /> : null}
      {filters.platform ? <input name="platform" type="hidden" value={filters.platform} /> : null}
      {filters.regionCode ? <input name="regionCode" type="hidden" value={filters.regionCode} /> : null}
      {filters.campaignId ? <input name="campaignId" type="hidden" value={filters.campaignId} /> : null}
    </>
  );
}

function MarketingBreakdownLoader({
  filters,
}: {
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
}) {
  const href = marketingAnalyticsHref(filters);
  const joiner = href.includes('?') ? '&' : '?';

  return (
    <AdminSection
      actions={<BarChart3 size={18} aria-hidden="true" />}
      bodyClassName="marketing-breakdown-loader-body"
      className="marketing-table-card"
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

function marketingAnalyticsActiveFilterLabels(
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>,
) {
  const labels = [`Range: ${marketingFilterOptionLabel(marketingAnalyticsRangeOptions, filters.range)}`];

  if (filters.source) {
    labels.push(`Source: ${marketingFilterOptionLabel(marketingAnalyticsSourceOptions, filters.source)}`);
  }
  if (filters.platform) {
    labels.push(
      `Platform: ${marketingFilterOptionLabel(marketingAnalyticsPlatformOptions, filters.platform)}`,
    );
  }

  if (filters.campaignId) {
    labels.push(`Campaign: ${filters.campaignId}`);
  }

  return labels;
}

function marketingFilterOptionLabel<T extends string>(
  options: readonly { readonly value: T; readonly label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? value;
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
        className="marketing-analytics-range-buttons"
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
      className="marketing-funnel-card"
      description="Unique customers from the selected signup and attribution cohort. Every stage is a subset of the previous stage, so conversion cannot exceed 100%."
      id="marketing-acquisition-funnel"
      title="New customer cohort"
    >
      {overview.funnel.map((step) => (
        <div key={step.key} className="marketing-funnel-step">
          <span className="marketing-funnel-dot" aria-hidden="true" />
          <div>
            <strong>{step.label}</strong>
          </div>
          <span>{formatNumber(step.value)}</span>
          <em>{step.rateFromPrevious === null ? 'Start' : formatPercent(step.rateFromPrevious)}</em>
        </div>
      ))}
    </AdminSection>
  );
}

function InsightCard({ overview }: { overview: AdminMarketingOverview }) {
  const limitations = [
    'Acquisition metrics use the stored first-touch source for each new-customer cohort.',
    'Ad spend comes from manual daily spend records; no live advertising platform feed is connected.',
    'Region scopes recorded spend and recent location evidence only, not the headline acquisition cohort.',
    'Missing attribution stays Unknown and is not reassigned to another source.',
    'Recent location evidence is a sample of up to 100 records per evidence source, not a complete regional total.',
    ...overview.dataGaps,
  ];

  return (
    <AdminSection
      actions={<Send size={18} aria-hidden="true" />}
      bodyClassName="marketing-insight-list"
      className="marketing-insight-card"
      description="Operator-readable findings and current data gaps before paid scaling."
      title="Insights & metric scope"
    >
      {(overview.topInsights.length ? overview.topInsights : ['No material insight in this range yet.']).map(
        (insight) => (
          <p key={insight}>{insight}</p>
        ),
      )}
      <AdminDisclosure ariaLabel="Metric scope and limitations" className="marketing-metric-limitations">
        <summary>Metric scope & limitations</summary>
        <ul>
          {Array.from(new Set(limitations)).map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </AdminDisclosure>
    </AdminSection>
  );
}

function MarketingTable({
  available,
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
  available: boolean;
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
      className="marketing-table-card"
      description={description}
      title={title}
    >
      {!available ? (
        <AdminNoticeCard role="alert" tone="danger">
          <strong>{title} is temporarily unavailable</strong>
          <p>This breakdown could not be loaded. Other marketing sections remain independent.</p>
          <AdminTextLink href={marketingAnalyticsDimensionPageHref(filters, page?.dimension ?? 'source', 1)}>
            Retry this breakdown
          </AdminTextLink>
        </AdminNoticeCard>
      ) : (
        <AdminTableScroll ariaLabel={`${title} table`} className="marketing-analytics-table-wrap">
        <AdminDataTable
          className="marketing-analytics-table"
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
                <div className="marketing-analytics-name-cell">
                  <span className="marketing-analytics-avatar">
                    <BadgeDollarSign size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{labelFor(row)}</strong>
                    {secondaryFor(row) ? <small>{secondaryFor(row)}</small> : null}
                  </div>
                </div>
              </td>
              <td>{formatNumber(row.signups)}</td>
              <td>{formatNumber(row.bookingCompleted)}</td>
              <td>{formatNumber(row.bookingCancelled)}</td>
              <td>
                <MoneyText amount={row.adSpend} />
              </td>
              <td>
                <MoneyText amount={row.conversionRates.cpaBookingCompleted} fallback="n/a" />
              </td>
              <td>
                <MoneyText amount={row.platformFeeRevenue} />
              </td>
              <td>{formatNullableMultiplier(row.conversionRates.roas)}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      )}
      {available && page ? (
        <AdminTablePaginationFooter
          activePage={activePage}
          ariaLabel={`${title} pagination`}
          className="marketing-table-pagination-footer"
          from={pageFrom}
          hrefForPage={(nextPage) => marketingAnalyticsDimensionPageHref(filters, page.dimension, nextPage)}
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

function marketingOverviewFromSummary(summary: AdminMarketingSummary): MarketingPageOverview {
  return {
    ...summary,
    unknownAttributionDiagnostics: summary.unknownAttributionDiagnostics ?? {
      totalUnknownSignups: 0,
      rows: [],
      recentAccounts: [],
    },
    bySource: [],
    byPlatform: [],
    byRegion: [],
    byCampaign: [],
  };
}

function unknownAttributionReasonLabel(reason: AdminMarketingUnknownAttributionReason) {
  if (reason === 'NO_CUSTOMER_SESSION') return 'Account created; app session not reached';
  if (reason === 'UNSUPPORTED_SOURCE') return 'Unsupported source';
  return 'Attribution metadata missing';
}

function emptyComparisonMetric(): AdminMarketingComparisonMetric {
  return {
    current: 0,
    previous: 0,
    delta: 0,
    deltaPercent: null,
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

function formatNullableMultiplier(value: number | null) {
  return value === null ? 'n/a' : `${formatDecimal(value)}x`;
}

function marketingRoasTone(value: number | null) {
  if (value === null) return 'neutral';
  return value >= 1 ? 'success' : 'warning';
}

function marketingRangeLabel(range: ReturnType<typeof normalizeMarketingAnalyticsFilters>['range']) {
  return marketingFilterOptionLabel(marketingAnalyticsRangeOptions, range);
}

function MarketingSummaryUnavailable({
  filters,
}: {
  filters: ReturnType<typeof normalizeMarketingAnalyticsFilters>;
}) {
  return (
    <AdminNoticeCard className="marketing-summary-unavailable" role="alert" tone="danger">
      <strong>Marketing data is temporarily unavailable</strong>
      <p>
        Headline acquisition, comparison, trend, and action data could not be loaded. Do not treat this
        state as zero activity.
      </p>
      <div className="actions">
        <AdminFormControlLink className="button-primary" href={marketingAnalyticsHref(filters)}>
          Retry marketing data
        </AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href="/setup">
          Open system health
        </AdminFormControlLink>
      </div>
    </AdminNoticeCard>
  );
}
