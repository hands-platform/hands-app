import {
  Activity,
  AlertTriangle,
  BadgePercent,
  CalendarCheck,
  ChevronRight,
  CreditCard,
  Eye,
  MapPinned,
  MousePointerClick,
  Repeat2,
  Search,
  Trophy,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  AdminUsageOverview,
  AdminUsageOverviewHourlyActivityRow,
  AdminUsageOverviewPartnerDiscoveryRow,
  AdminUsageOverviewPlatformRow,
  AdminUsageOverviewPopularServiceRow,
  AdminUsageOverviewRegionRow,
  AdminUsageOverviewRankRow,
  adminGet,
} from '../../lib/admin-api';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminMiniMetricStrip,
  AdminOverviewCommandCard,
  AdminOverviewCommandGrid,
  AdminOverviewGrid,
  AdminOverviewGroup,
} from '../../components/admin-overview-card';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminCard, AdminCardGrid, AdminKpiCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import {
  formatCurrencyAmount as money,
  formatPercentLabel,
  formatWholeNumber as formatNumber,
} from '../../lib/admin-format';
import {
  buildUsageActionPriorities,
  emptyUsageOverview,
  normalizeUsageOverviewRange,
  type UsageActionPriority,
  usageOverviewWithDefaults,
  usageOverviewHref,
  usageOverviewRangeOptions,
} from './usage-overview-model';

export const dynamic = 'force-dynamic';

type UsageOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsageOverviewPage({
  searchParams,
}: {
  searchParams?: UsageOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizeUsageOverviewRange(params?.range);
  const rawOverview = await adminGet<AdminUsageOverview>(
    `/admin/usage-overview?range=${range}`,
    emptyUsageOverview(range),
  );
  const overview = usageOverviewWithDefaults(rawOverview, range);
  const funnelSteps = buildUsageFunnelSteps(overview);
  const usageHealthCards: UsageCommandCardConfig[] = [
    {
      label: 'App sessions',
      value: formatNumber(overview.totals.customerSessionCount),
      detail: `${formatNumber(overview.customerUsage.mostActiveCustomers.length)} active customer ranks`,
      icon: Activity,
      tone: 'info',
    },
    {
      label: 'Partner discovery',
      value: formatNumber(overview.totals.partnerProfileViewCount),
      detail: `${formatPercent(overview.totals.partnerBookingRequestCount, overview.totals.partnerProfileViewCount)} view-to-request`,
      icon: Eye,
      tone: 'primary',
    },
    {
      label: 'Booking intent',
      value: formatNumber(overview.totals.partnerBookingRequestCount),
      detail: `${formatPercent(overview.totals.completedBookingCount, overview.totals.partnerBookingRequestCount)} request-to-complete`,
      icon: MousePointerClick,
      tone: 'warning',
    },
    {
      label: 'Completed work',
      value: formatNumber(overview.totals.completedBookingCount),
      detail: `${formatNumber(overview.customerUsage.completedBookingCustomers.length)} customer ranks closed`,
      icon: CalendarCheck,
      tone: 'success',
    },
  ];
  const usageSegmentCards: UsageCommandCardConfig[] = [
    {
      label: 'New customers',
      value: formatNumber(overview.customerLifecycle.newCustomerCount),
      detail: 'Customer accounts created in this range',
      icon: UserPlus,
      tone: overview.customerLifecycle.newCustomerCount > 0 ? 'info' : 'neutral',
    },
    {
      label: 'Never booked',
      value: formatNumber(overview.customerLifecycle.neverBookedCustomerCount),
      detail: 'Customers who still have no booking record',
      icon: Search,
      tone: overview.customerLifecycle.neverBookedCustomerCount > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Churn risk',
      value: formatNumber(overview.customerLifecycle.churnRiskCustomerCount),
      detail: 'Completed before, no app session in 30 days',
      icon: AlertTriangle,
      tone: overview.customerLifecycle.churnRiskCustomerCount > 0 ? 'danger' : 'success',
    },
    {
      label: 'Repeat customers',
      value: formatNumber(overview.customerLifecycle.repeatCustomerCount),
      detail: 'Customers with 2+ completed bookings in range',
      icon: Repeat2,
      tone: overview.customerLifecycle.repeatCustomerCount > 0 ? 'success' : 'neutral',
    },
  ];

  return (
    <AdminPageTemplate
      contentClassName="usage-overview-page"
      description="Customer app frequency, Partner discovery, booking intent, and completed-work flow from stored usage events."
      title="Usage Overview"
    >

      <AdminSection
        actions={
          <>
            <StatusBadge tone="success">Vietnam only</StatusBadge>
            <StatusBadge tone="info">
              Generated <DateTimeText value={overview.generatedAt} />
            </StatusBadge>
          </>
        }
        className="usage-overview-filter-panel"
        description="Use bounded date windows so operators can compare app activity without broad page fetches."
        statusLabel={overview.rangeLabel}
        title="Usage range"
      >
        <AdminSegmentedControl
          activeValue={range}
          ariaLabel="Usage overview range"
          className="usage-overview-range-buttons"
          options={usageOverviewRangeOptions.map((option) => ({
            href: usageOverviewHref(option.value),
            label: option.label,
            value: option.value,
          }))}
        />
      </AdminSection>

      <AdminOverviewCommandGrid ariaLabel="Usage command summary">
        {usageHealthCards.map(({ label, value, detail, icon: Icon, tone }) => (
          <UsageCommandCard
            key={label}
            detail={detail}
            icon={Icon}
            label={label}
            tone={tone}
            value={value}
          />
        ))}
      </AdminOverviewCommandGrid>

      <AdminSection
        bodyClassName="usage-overview-funnel-steps"
        className="usage-overview-funnel-card"
        description="Stored flow from app activity to Partner discovery, preferred request, and completed work."
        statusLabel={overview.rangeLabel}
        title="Customer app-to-booking funnel"
      >
        {funnelSteps.map((step, index) => (
          <AdminCard key={step.label} className={`usage-overview-funnel-step is-${step.tone}`}>
            <div className="usage-overview-funnel-step-header">
              <span>{step.label}</span>
              <strong>{formatNumber(step.value)}</strong>
            </div>
            <div className="usage-overview-funnel-bar" aria-hidden="true">
              <i style={{ width: `${step.widthPercent}%` }} />
            </div>
            <small>{step.detail}</small>
            {index < funnelSteps.length - 1 ? (
              <ChevronRight className="usage-overview-funnel-arrow" size={18} aria-hidden="true" />
            ) : null}
          </AdminCard>
        ))}
      </AdminSection>

      <AdminOverviewGrid ariaLabel="Customer usage segments" variant="segment">
        {usageSegmentCards.map(({ label, value, detail, icon: Icon, tone }) => (
          <UsageCommandCard
            key={label}
            detail={detail}
            icon={Icon}
            label={label}
            tone={tone}
            value={value}
          />
        ))}
      </AdminOverviewGrid>

      <AdminOverviewGrid ariaLabel="Customers overview" variant="insight">
        <UsageInsightCard
          title="Customer lifecycle"
          description="Account, activity, first booking, repeat, and churn-risk counts from stored records."
          icon={Users}
          rows={[
            { label: 'New', value: overview.customerLifecycle.newCustomerCount, tone: 'info' },
            { label: 'Active in range', value: overview.customerLifecycle.activeCustomerCount, tone: 'primary' },
            { label: 'Completed customers', value: overview.customerLifecycle.completedCustomerCount, tone: 'success' },
            { label: 'Repeat customers', value: overview.customerLifecycle.repeatCustomerCount, tone: 'success' },
            { label: 'Churn risk', value: overview.customerLifecycle.churnRiskCustomerCount, tone: 'danger' },
            { label: 'Never booked', value: overview.customerLifecycle.neverBookedCustomerCount, tone: 'warning' },
          ]}
        />
        <UsageInsightCard
          title="Retention pulse"
          description="Recency counts are fixed windows, independent from the selected report range."
          icon={Repeat2}
          rows={[
            { label: 'D1 active', value: overview.customerLifecycle.activeTodayCustomerCount, tone: 'info' },
            { label: 'D7 active', value: overview.customerLifecycle.active7dCustomerCount, tone: 'primary' },
            { label: 'D30 active', value: overview.customerLifecycle.active30dCustomerCount, tone: 'success' },
          ]}
        />
        <UsageInsightCard
          title="Booking quality"
          description="Booking creation, completion, cancellation, and refund signals for the selected range."
          icon={CalendarCheck}
          rows={[
            { label: 'Created', value: overview.bookingQuality.createdBookingCount, tone: 'primary' },
            { label: 'Completed', value: overview.totals.completedBookingCount, tone: 'success' },
            { label: 'Cancelled / expired', value: overview.bookingQuality.cancellationCount, tone: 'warning' },
            { label: 'Refunded', value: overview.bookingQuality.refundCount, tone: 'danger' },
            { label: 'Low reviews', value: overview.bookingQuality.lowReviewCount, tone: 'danger' },
          ]}
        />
        <PaymentCouponInsightCard
          couponBookingCount={overview.paymentAndCoupon.couponBookingCount}
          paymentFailureCount={overview.paymentAndCoupon.paymentFailureCount}
          refundAmount={overview.paymentAndCoupon.refundAmount}
          rows={overview.paymentAndCoupon.paymentMethodMix}
        />
      </AdminOverviewGrid>

      <AdminOverviewGrid ariaLabel="Customer behavior patterns" variant="behavior">
        <PopularServicesCard rows={overview.behavior.popularServices} />
        <HourlyActivityCard rows={overview.behavior.hourlyActivity} />
      </AdminOverviewGrid>

      <PlatformUsageCard rows={overview.platformUsage} />

      <PartnerDiscoveryConversionCard rows={overview.partnerUsage.discoveryConversion} />

      <CustomerSegmentsBoard overview={overview} />

      <ActionPrioritiesBoard overview={overview} />

      <AdminOverviewGrid ariaLabel="Customer and Partner usage rankings" variant="content">
        <AdminOverviewGroup
          eyebrow="Customer behavior"
          title="Who is active and who completed work"
        >
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
            title="Problem signal customers"
            description="Customers with cancellation, no-show, expiry, or refund signals in the selected range."
            emptyMessage="No problem customer signals loaded."
            rows={overview.customerUsage.qualityRiskCustomers}
            valueHeading="Signals"
          />
          <UsageRankingCard
            title="Low review customers"
            description="Customers who left 1-2 star published reviews in the selected range."
            emptyMessage="No low customer reviews loaded."
            rows={overview.customerUsage.lowReviewCustomers}
            valueHeading="Low reviews"
          />
        </AdminOverviewGroup>
        <AdminOverviewGroup
          eyebrow="Partner discovery"
          title="Who customers look at, request, and complete with"
        >
          <UsageRankingCard
            title="Most viewed Partners"
            description="Partner profile views from stored customer interactions."
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
        </AdminOverviewGroup>
        <RegionUsageCard rows={overview.regionUsage} />
      </AdminOverviewGrid>
    </AdminPageTemplate>
  );
}

function CustomerSegmentsBoard({ overview }: { readonly overview: AdminUsageOverview }) {
  const rows = [
    {
      detail: 'New accounts in range with no booking yet',
      icon: Search,
      label: 'New unbooked',
      percent: formatPercent(
        overview.customerSegments.newUnbookedCustomerCount,
        overview.customerLifecycle.newCustomerCount,
      ),
      tone: 'warning',
      value: overview.customerSegments.newUnbookedCustomerCount,
    },
    {
      detail: 'Customers with exactly one completed booking',
      icon: CalendarCheck,
      label: 'First completed',
      percent: formatPercent(
        overview.customerSegments.firstCompletedCustomerCount,
        overview.customerLifecycle.completedCustomerCount,
      ),
      tone: 'info',
      value: overview.customerSegments.firstCompletedCustomerCount,
    },
    {
      detail: 'Customers with 2+ completed bookings',
      icon: Repeat2,
      label: 'Repeat customers',
      percent: formatPercent(
        overview.customerSegments.repeatCustomerCount,
        overview.customerLifecycle.completedCustomerCount,
      ),
      tone: 'success',
      value: overview.customerSegments.repeatCustomerCount,
    },
    {
      detail: 'Customers with 3+ completed bookings',
      icon: Trophy,
      label: 'High value customers',
      percent: formatPercent(
        overview.customerSegments.vipCustomerCount,
        overview.customerLifecycle.completedCustomerCount,
      ),
      tone: 'primary',
      value: overview.customerSegments.vipCustomerCount,
    },
    {
      detail: 'Completed before, no app session in 30 days',
      icon: AlertTriangle,
      label: 'Churn risk',
      percent: formatPercent(
        overview.customerSegments.churnRiskCustomerCount,
        overview.customerLifecycle.completedCustomerCount,
      ),
      tone: 'danger',
      value: overview.customerSegments.churnRiskCustomerCount,
    },
    {
      detail: 'Customers with cancellation, no-show, expiry, or refund signal',
      icon: AlertTriangle,
      label: 'Problem signal',
      percent: formatPercent(
        overview.customerSegments.issueCustomerCount,
        overview.customerLifecycle.activeCustomerCount,
      ),
      tone: 'warning',
      value: overview.customerSegments.issueCustomerCount,
    },
  ] satisfies Array<{
    detail: string;
    icon: UsageCardIcon;
    label: string;
    percent: string;
    tone: UsageCardTone;
    value: number;
  }>;

  return (
    <AdminSection
      actions={<Users size={18} aria-hidden="true" />}
      bodyClassName="usage-overview-segment-board-grid"
      className="usage-overview-segment-board-card"
      description="Operational customer groups for follow-up, retention, priority handling, and issue review."
      title="Customer segments"
    >
      {rows.map(({ detail, icon: Icon, label, percent, tone, value }) => (
        <AdminOverviewCommandCard
          baseClassName="usage-overview-segment-board-item"
          className={`is-${tone}`}
          detail={detail}
          icon={<Icon size={17} aria-hidden="true" />}
          iconClassName="usage-overview-command-icon"
          key={label}
          label={label}
          trailing={<em>{percent}</em>}
          value={formatNumber(value)}
        />
      ))}
    </AdminSection>
  );
}

function ActionPrioritiesBoard({ overview }: { readonly overview: AdminUsageOverview }) {
  const priorities = buildUsageActionPriorities(overview);

  return (
    <AdminSection
      actions={<AlertTriangle size={18} aria-hidden="true" />}
      bodyClassName="usage-overview-action-list"
      className="usage-overview-action-card"
      description="Follow-up signals calculated from the current usage range. These are counts and rates only, not full customer lists."
      title="Action priorities"
    >
      {priorities.map((priority) => (
        <ActionPriorityItem key={priority.key} priority={priority} />
      ))}
    </AdminSection>
  );
}

function PlatformUsageCard({ rows }: { readonly rows: readonly AdminUsageOverviewPlatformRow[] }) {
  const maxSessions = Math.max(1, ...rows.map((row) => row.sessionCount));

  return (
    <AdminSection
      actions={<Activity size={18} aria-hidden="true" />}
      bodyClassName={rows.length > 0 ? 'usage-overview-platform-list' : 'usage-overview-empty-state'}
      className="usage-overview-platform-card"
      description="Customer app sessions by platform in this range. Use this to spot Android/iOS/Web usage imbalance before checking acquisition or product issues."
      title="Platform usage"
    >
      {rows.length > 0 ? (
        rows.map((row) => {
          const widthPercent = Math.max(6, Math.round((row.sessionCount / maxSessions) * 100));

          return (
            <AdminCard key={row.platform} className="usage-overview-platform-row">
              <div className="usage-overview-platform-main">
                <span className={`usage-overview-platform-dot is-${row.platform}`} aria-hidden="true" />
                <div>
                  <strong>{platformLabel(row.platform)}</strong>
                  <small>
                    Last active <DateTimeText fallback="No last activity" value={row.lastActivityAt} />
                  </small>
                </div>
              </div>
              <div className="usage-overview-platform-value">
                <strong>{formatNumber(row.sessionCount)}</strong>
                <span>sessions</span>
              </div>
              <div className="usage-overview-region-bar" aria-hidden="true">
                <i style={{ width: `${widthPercent}%` }} />
              </div>
            </AdminCard>
          );
        })
      ) : (
        <UsageOverviewEmptyState
          icon={Activity}
          message="Try another range after customer app sessions exist."
          title="No platform session pattern loaded."
        />
      )}
    </AdminSection>
  );
}

function PartnerDiscoveryConversionCard({
  rows,
}: {
  readonly rows: readonly AdminUsageOverviewPartnerDiscoveryRow[];
}) {
  return (
    <AdminSection
      actions={<Eye size={18} aria-hidden="true" />}
      bodyClassName={rows.length > 0 ? 'usage-overview-discovery-list' : 'usage-overview-empty-state'}
      className="usage-overview-discovery-card"
      description="Partner profile views, preferred requests, and completed-work conversion in this range."
      title="Partner discovery conversion"
    >
      {rows.length > 0 ? (
        rows.map((row) => (
          <AdminCard key={row.id} className="usage-overview-discovery-row">
            <span className="usage-overview-rank">#{row.rank}</span>
            <div className="usage-overview-name-cell">
              <span className="usage-overview-avatar">
                <Users size={15} aria-hidden="true" />
              </span>
              <div>
                {row.href ? <AdminTextLink href={row.href}>{row.label}</AdminTextLink> : <strong>{row.label}</strong>}
                {row.secondary ? <small>{row.secondary}</small> : null}
              </div>
            </div>
            <AdminMiniMetricStrip
              className="usage-overview-discovery-metrics"
              metrics={[
                { label: 'Views', value: formatNumber(row.viewCount) },
                { label: 'Requests', value: formatNumber(row.requestCount) },
                { label: 'Done', value: formatNumber(row.completedCount) },
              ]}
            />
            <div className="usage-overview-discovery-rates">
              <span>{formatNumber(row.viewToRequestRate)}% view to request</span>
              <span>{formatNumber(row.requestToCompleteRate)}% request to done</span>
            </div>
            <DateTimeText fallback="No date" value={row.lastActivityAt} />
          </AdminCard>
        ))
      ) : (
        <UsageOverviewEmptyState
          icon={Eye}
          message="Try another range after Partner profile views or requests exist."
          title="No Partner discovery conversion loaded."
        />
      )}
    </AdminSection>
  );
}

function ActionPriorityItem({ priority }: { readonly priority: UsageActionPriority }) {
  const Icon = usageActionPriorityIcons[priority.key] ?? CalendarCheck;
  const value = priority.valueLabel.includes('to-')
    ? `${formatNumber(priority.value)}%`
    : formatNumber(priority.value);

  return (
    <AdminOverviewCommandCard
      baseClassName="usage-overview-action-item"
      className={`is-${priority.tone}`}
      detail={priority.detail}
      icon={<Icon size={17} aria-hidden="true" />}
      iconClassName="usage-overview-command-icon"
      label={priority.label}
      trailing={<em>{priority.valueLabel}</em>}
      value={value}
    />
  );
}

function PopularServicesCard({ rows }: { readonly rows: readonly AdminUsageOverviewPopularServiceRow[] }) {
  const maxBookings = Math.max(1, ...rows.map((row) => row.bookingCount));

  return (
    <AdminSection
      actions={<Trophy size={18} aria-hidden="true" />}
      bodyClassName={rows.length > 0 ? 'usage-overview-service-list' : 'usage-overview-empty-state'}
      className="usage-overview-behavior-card"
      description="Service choices from bookings created in this usage range."
      title="Popular services"
    >
      {rows.length > 0 ? (
        rows.map((row) => {
          const widthPercent = Math.max(6, Math.round((row.bookingCount / maxBookings) * 100));

          return (
            <AdminCard key={row.id} className="usage-overview-service-row">
              <div className="usage-overview-service-main">
                <span className="usage-overview-rank">#{row.rank}</span>
                <div>
                  <strong>{row.label}</strong>
                  {row.secondary ? <small>{row.secondary}</small> : null}
                </div>
              </div>
              <AdminMiniMetricStrip
                className="usage-overview-service-metrics"
                metrics={[
                  { label: 'bookings', value: formatNumber(row.bookingCount) },
                  { label: 'quantity', value: formatNumber(row.quantity) },
                  { label: 'booked value', value: money(row.amount) },
                ]}
              />
              <div className="usage-overview-region-bar" aria-hidden="true">
                <i style={{ width: `${widthPercent}%` }} />
              </div>
            </AdminCard>
          );
        })
      ) : (
        <UsageOverviewEmptyState
          icon={Trophy}
          message="Try another range after bookings exist."
          title="No service booking pattern loaded."
        />
      )}
    </AdminSection>
  );
}

function HourlyActivityCard({ rows }: { readonly rows: readonly AdminUsageOverviewHourlyActivityRow[] }) {
  const activeRows = [...rows]
    .filter((row) => row.totalActivityCount > 0)
    .sort((left, right) => right.totalActivityCount - left.totalActivityCount)
    .slice(0, 8);
  const maxActivity = Math.max(1, ...activeRows.map((row) => row.totalActivityCount));

  return (
    <AdminSection
      actions={<Activity size={18} aria-hidden="true" />}
      bodyClassName={activeRows.length > 0 ? 'usage-overview-hour-list' : 'usage-overview-empty-state'}
      className="usage-overview-behavior-card"
      description="Busiest hours from customer sessions and preferred-Partner requests."
      title="Hourly activity"
    >
      {activeRows.length > 0 ? (
        activeRows.map((row) => {
          const widthPercent = Math.max(6, Math.round((row.totalActivityCount / maxActivity) * 100));

          return (
            <AdminCard key={row.hour} className="usage-overview-hour-row">
              <div>
                <strong>{row.label}</strong>
                <span>{formatNumber(row.totalActivityCount)} signals</span>
              </div>
              <div className="usage-overview-region-bar" aria-hidden="true">
                <i style={{ width: `${widthPercent}%` }} />
              </div>
              <AdminMiniMetricStrip
                className="usage-overview-hour-metrics"
                metrics={[
                  { label: 'sessions', value: formatNumber(row.customerSessionCount) },
                  { label: 'requests', value: formatNumber(row.bookingRequestCount) },
                ]}
              />
            </AdminCard>
          );
        })
      ) : (
        <UsageOverviewEmptyState
          icon={Activity}
          message="Try another range after customer app activity exists."
          title="No hourly usage pattern loaded."
        />
      )}
    </AdminSection>
  );
}

type UsageCardTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
type UsageCardIcon = typeof Activity;
const usageActionPriorityIcons: Record<string, UsageCardIcon> = {
  'issue-signal': AlertTriangle,
  'churn-risk': AlertTriangle,
  'new-unbooked': Search,
  'discovery-dropoff': Eye,
  'completion-dropoff': CalendarCheck,
};
type UsageCommandCardConfig = {
  readonly detail: string;
  readonly icon: UsageCardIcon;
  readonly label: string;
  readonly tone: UsageCardTone;
  readonly value: string;
};

function UsageCommandCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  readonly detail: string;
  readonly icon: UsageCardIcon;
  readonly label: string;
  readonly tone: UsageCardTone;
  readonly value: string;
}) {
  return (
    <AdminKpiCard
      className={`usage-overview-kpi-card is-${tone}`}
      helper={detail}
      icon={Icon}
      iconSize={18}
      label={label}
      value={value}
    />
  );
}

type UsageInsightRow = {
  readonly label: string;
  readonly tone: UsageCardTone;
  readonly value: number;
};

function UsageInsightCard({
  description,
  icon: Icon,
  rows,
  title,
}: {
  readonly description: string;
  readonly icon: UsageCardIcon;
  readonly rows: readonly UsageInsightRow[];
  readonly title: string;
}) {
  return (
    <AdminSection
      actions={<Icon size={18} aria-hidden="true" />}
      bodyClassName="usage-overview-mini-metric-list"
      className="usage-overview-insight-card"
      description={description}
      title={title}
    >
      <AdminMiniMetricStrip
        className="usage-overview-mini-metric-list"
        itemClassName="usage-overview-mini-metric"
        metrics={rows.map((row) => ({
          label: row.label,
          tone: row.tone,
          value: formatNumber(row.value),
        }))}
      />
    </AdminSection>
  );
}

function PaymentCouponInsightCard({
  couponBookingCount,
  paymentFailureCount,
  refundAmount,
  rows,
}: {
  readonly couponBookingCount: number;
  readonly paymentFailureCount: number;
  readonly refundAmount: number;
  readonly rows: readonly { amount: number; bookingCount: number; method: string }[];
}) {
  const maxAmount = Math.max(1, ...rows.map((row) => row.amount));

  return (
    <AdminSection
      actions={<WalletCards size={18} aria-hidden="true" />}
      bodyClassName="usage-overview-payment-card-body"
      className="usage-overview-insight-card"
      description="Completed-booking payment mix and coupon usage signal."
      title="Payment & coupon"
    >
      <AdminMiniMetricStrip
        className="usage-overview-payment-summary"
        itemClassName="usage-overview-mini-metric"
        metrics={[
          { label: 'Coupon bookings', tone: 'info', value: formatNumber(couponBookingCount) },
          { label: 'Failed payments', tone: 'danger', value: formatNumber(paymentFailureCount) },
          { label: 'Refund amount', tone: 'warning', value: money(refundAmount) },
          { label: 'Methods', tone: 'primary', value: formatNumber(rows.length) },
        ]}
      />
      {rows.length > 0 ? (
        <AdminCardGrid ariaLabel="Payment method mix" className="usage-overview-payment-mix">
          {rows.map((row) => {
            const widthPercent = Math.max(6, Math.round((row.amount / maxAmount) * 100));

            return (
              <AdminCard key={row.method} className="usage-overview-payment-row">
                <div>
                  <span>
                    <CreditCard size={14} aria-hidden="true" />
                    {paymentMethodLabel(row.method)}
                  </span>
                  <strong>{money(row.amount)}</strong>
                </div>
                <div className="usage-overview-region-bar" aria-hidden="true">
                  <i style={{ width: `${widthPercent}%` }} />
                </div>
                <small>{formatNumber(row.bookingCount)} completed bookings</small>
              </AdminCard>
            );
          })}
        </AdminCardGrid>
      ) : (
        <UsageOverviewEmptyState
          icon={BadgePercent}
          message="Try another usage range after completed payments exist."
          title="No completed payment mix loaded."
        />
      )}
    </AdminSection>
  );
}

function RegionUsageCard({ rows }: { rows: readonly AdminUsageOverviewRegionRow[] }) {
  const activeRows = rows.filter(
    (row) =>
      row.customerSessionCount > 0 || row.bookingRequestCount > 0 || row.completedBookingCount > 0,
  );
  const maxRegionActivity = Math.max(
    1,
    ...activeRows.map(
      (row) => row.customerSessionCount + row.bookingRequestCount + row.completedBookingCount,
    ),
  );

  return (
    <AdminSection
      actions={<MapPinned size={18} aria-hidden="true" />}
      bodyClassName={activeRows.length > 0 ? 'usage-overview-region-list' : 'usage-overview-empty-state'}
      className="usage-overview-ranking-card usage-overview-region-card"
      description="Regional usage from saved customer addresses and booking service addresses. Individual location points stay out of this overview."
      title="Region usage"
    >
      {activeRows.length > 0 ? (
        activeRows.map((row) => {
          const activity = row.customerSessionCount + row.bookingRequestCount + row.completedBookingCount;
          const widthPercent = Math.max(6, Math.round((activity / maxRegionActivity) * 100));

          return (
            <AdminCard key={row.regionCode} className="usage-overview-region-row">
              <div className="vietnam-region-name">
                <span>{row.shortName}</span>
                <strong>{row.regionName}</strong>
              </div>
              <AdminMiniMetricStrip
                className="usage-overview-region-metrics"
                metrics={[
                  { label: 'Sessions', value: formatNumber(row.customerSessionCount) },
                  { label: 'Requests', value: formatNumber(row.bookingRequestCount) },
                  { label: 'Completed', value: formatNumber(row.completedBookingCount) },
                ]}
              />
              <div className="usage-overview-region-bar" aria-hidden="true">
                <i style={{ width: `${widthPercent}%` }} />
              </div>
            </AdminCard>
          );
        })
      ) : (
        <UsageOverviewEmptyState
          icon={MapPinned}
          message="Try another stored usage range."
          title="No region usage loaded."
        />
      )}
    </AdminSection>
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
    <AdminSection
      actions={<Trophy size={18} aria-hidden="true" />}
      bodyClassName={rows.length > 0 ? 'usage-overview-ranking-list' : 'usage-overview-empty-state'}
      className="usage-overview-ranking-card"
      description={description}
      title={title}
    >
      {rows.length > 0 ? (
        rows.map((row) => (
          <AdminCard key={`${title}-${row.id}`} className="usage-overview-ranking-row">
            <span className="usage-overview-rank">#{row.rank}</span>
            <div className="usage-overview-name-cell">
              <span className="usage-overview-avatar">
                <Users size={15} aria-hidden="true" />
              </span>
              <div>
                {row.href ? <AdminTextLink href={row.href}>{row.label}</AdminTextLink> : <strong>{row.label}</strong>}
                {row.secondary ? <small>{row.secondary}</small> : null}
              </div>
            </div>
            <div className="usage-overview-row-value">
              <strong>{formatNumber(row.value)}</strong>
              <span>{valueHeading}</span>
            </div>
            <DateTimeText fallback="No date" value={row.lastActivityAt} />
          </AdminCard>
        ))
      ) : (
        <UsageOverviewEmptyState
          icon={MapPinned}
          message="Try another stored usage range."
          title={emptyMessage}
        />
      )}
    </AdminSection>
  );
}

function UsageOverviewEmptyState({
  icon: Icon,
  message,
  title,
}: {
  readonly icon: UsageCardIcon;
  readonly message: string;
  readonly title: string;
}) {
  return (
    <>
      <Icon size={20} aria-hidden="true" />
      <AdminEmptyState message={message} title={title} />
    </>
  );
}

function buildUsageFunnelSteps(overview: AdminUsageOverview) {
  const counts = [
    {
      label: 'App sessions',
      value: overview.totals.customerSessionCount,
      detail: 'Customer app activity',
      tone: 'info',
    },
    {
      label: 'Partner views',
      value: overview.totals.partnerProfileViewCount,
      detail: 'Partner detail/profile discovery',
      tone: 'primary',
    },
    {
      label: 'Partner requests',
      value: overview.totals.partnerBookingRequestCount,
      detail: 'Preferred Partner booking intent',
      tone: 'warning',
    },
    {
      label: 'Completed',
      value: overview.totals.completedBookingCount,
      detail: 'Closed completed booking work',
      tone: 'success',
    },
  ] satisfies Array<{
    detail: string;
    label: string;
    tone: UsageCardTone;
    value: number;
  }>;
  const maxValue = Math.max(1, ...counts.map((step) => step.value));

  return counts.map((step, index) => {
    const previousValue = index > 0 ? counts[index - 1]?.value ?? 0 : 0;
    const conversionDetail = index === 0
      ? step.detail
      : `${formatPercent(step.value, previousValue)} from previous step`;

    return {
      ...step,
      detail: conversionDetail,
      widthPercent: Math.max(step.value > 0 ? 6 : 0, Math.round((step.value / maxValue) * 100)),
    };
  });
}

function paymentMethodLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function platformLabel(value: string) {
  if (value === 'ios') return 'iOS';
  if (value === 'android') return 'Android';
  if (value === 'web') return 'Web';

  return 'Unknown';
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return '0%';
  return formatPercentLabel(Math.round((numerator / denominator) * 100));
}
