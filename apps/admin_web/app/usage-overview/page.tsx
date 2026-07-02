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
  const generatedAt = formatDateTime(overview.generatedAt);
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
    <div className="usage-overview-page">
      <section className="toolbar">
        <div>
          <h1>Usage Overview</h1>
          <p className="muted">
            Customer app frequency, Partner discovery, booking intent, and completed-work flow from
            stored usage events.
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

      <section className="usage-overview-command-grid" aria-label="Usage command summary">
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
      </section>

      <section className="card usage-overview-funnel-card" aria-labelledby="usage-funnel-title">
        <div className="ops-section-header usage-overview-section-header">
          <div>
            <h2 id="usage-funnel-title">Customer app-to-booking funnel</h2>
            <p className="muted">
              Stored flow from app activity to Partner discovery, preferred request, and completed work.
            </p>
          </div>
          <span className="pill pill-info">{overview.rangeLabel}</span>
        </div>
        <div className="usage-overview-funnel-steps">
          {funnelSteps.map((step, index) => (
            <article key={step.label} className={`usage-overview-funnel-step is-${step.tone}`}>
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
            </article>
          ))}
        </div>
      </section>

      <section className="usage-overview-segment-grid" aria-label="Customer usage segments">
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
      </section>

      <section className="usage-overview-insight-grid" aria-label="Customers overview">
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
      </section>

      <section className="usage-overview-behavior-grid" aria-label="Customer behavior patterns">
        <PopularServicesCard rows={overview.behavior.popularServices} />
        <HourlyActivityCard rows={overview.behavior.hourlyActivity} />
      </section>

      <PlatformUsageCard rows={overview.platformUsage} />

      <PartnerDiscoveryConversionCard rows={overview.partnerUsage.discoveryConversion} />

      <CustomerSegmentsBoard overview={overview} />

      <ActionPrioritiesBoard overview={overview} />

      <section className="usage-overview-grid">
        <section className="usage-overview-group">
          <div className="usage-overview-group-heading">
            <span>Customer behavior</span>
            <strong>Who is active and who completed work</strong>
          </div>
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
        </section>
        <section className="usage-overview-group">
          <div className="usage-overview-group-heading">
            <span>Partner discovery</span>
            <strong>Who customers look at, request, and complete with</strong>
          </div>
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
        </section>
        <RegionUsageCard rows={overview.regionUsage} />
      </section>
    </div>
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
    <section className="card usage-overview-segment-board-card" aria-labelledby="usage-segments-title">
      <div className="ops-section-header">
        <div>
          <h2 id="usage-segments-title">Customer segments</h2>
          <p className="muted">
            Operational customer groups for follow-up, retention, priority handling, and issue review.
          </p>
        </div>
        <Users size={18} aria-hidden="true" />
      </div>
      <div className="usage-overview-segment-board-grid">
        {rows.map(({ detail, icon: Icon, label, percent, tone, value }) => (
          <article key={label} className={`usage-overview-segment-board-item is-${tone}`}>
            <span className="usage-overview-command-icon">
              <Icon size={17} aria-hidden="true" />
            </span>
            <div>
              <span>{label}</span>
              <strong>{formatNumber(value)}</strong>
              <small>{detail}</small>
            </div>
            <em>{percent}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionPrioritiesBoard({ overview }: { readonly overview: AdminUsageOverview }) {
  const priorities = buildUsageActionPriorities(overview);

  return (
    <section className="card usage-overview-action-card" aria-labelledby="usage-actions-title">
      <div className="ops-section-header">
        <div>
          <h2 id="usage-actions-title">Action priorities</h2>
          <p className="muted">
            Follow-up signals calculated from the current usage range. These are counts and rates only,
            not full customer lists.
          </p>
        </div>
        <AlertTriangle size={18} aria-hidden="true" />
      </div>
      <div className="usage-overview-action-list">
        {priorities.map((priority) => (
          <ActionPriorityItem key={priority.key} priority={priority} />
        ))}
      </div>
    </section>
  );
}

function PlatformUsageCard({ rows }: { readonly rows: readonly AdminUsageOverviewPlatformRow[] }) {
  const maxSessions = Math.max(1, ...rows.map((row) => row.sessionCount));

  return (
    <section className="card usage-overview-platform-card" aria-labelledby="usage-platform-title">
      <div className="ops-section-header">
        <div>
          <h2 id="usage-platform-title">Platform usage</h2>
          <p className="muted">
            Customer app sessions by platform in this range. Use this to spot Android/iOS/Web usage
            imbalance before checking acquisition or product issues.
          </p>
        </div>
        <Activity size={18} aria-hidden="true" />
      </div>
      {rows.length > 0 ? (
        <div className="usage-overview-platform-list">
          {rows.map((row) => {
            const widthPercent = Math.max(6, Math.round((row.sessionCount / maxSessions) * 100));

            return (
              <article key={row.platform} className="usage-overview-platform-row">
                <div className="usage-overview-platform-main">
                  <span className={`usage-overview-platform-dot is-${row.platform}`} aria-hidden="true" />
                  <div>
                    <strong>{platformLabel(row.platform)}</strong>
                    <small>
                      {row.lastActivityAt ? `Last active ${formatDateTime(row.lastActivityAt)}` : 'No last activity'}
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
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <Activity size={20} aria-hidden="true" />
          <strong>No platform session pattern loaded.</strong>
          <p className="muted">Try another range after customer app sessions exist.</p>
        </div>
      )}
    </section>
  );
}

function PartnerDiscoveryConversionCard({
  rows,
}: {
  readonly rows: readonly AdminUsageOverviewPartnerDiscoveryRow[];
}) {
  return (
    <section
      className="card usage-overview-discovery-card"
      aria-labelledby="usage-partner-discovery-title"
    >
      <div className="ops-section-header">
        <div>
          <h2 id="usage-partner-discovery-title">Partner discovery conversion</h2>
          <p className="muted">
            Partner profile views, preferred requests, and completed-work conversion in this range.
          </p>
        </div>
        <Eye size={18} aria-hidden="true" />
      </div>
      {rows.length > 0 ? (
        <div className="usage-overview-discovery-list">
          {rows.map((row) => (
            <article key={row.id} className="usage-overview-discovery-row">
              <span className="usage-overview-rank">#{row.rank}</span>
              <div className="usage-overview-name-cell">
                <span className="usage-overview-avatar">
                  <Users size={15} aria-hidden="true" />
                </span>
                <div>
                  {row.href ? <a href={row.href}>{row.label}</a> : <strong>{row.label}</strong>}
                  {row.secondary ? <small>{row.secondary}</small> : null}
                </div>
              </div>
              <div className="usage-overview-discovery-metrics">
                <span>
                  <strong>{formatNumber(row.viewCount)}</strong>
                  Views
                </span>
                <span>
                  <strong>{formatNumber(row.requestCount)}</strong>
                  Requests
                </span>
                <span>
                  <strong>{formatNumber(row.completedCount)}</strong>
                  Done
                </span>
              </div>
              <div className="usage-overview-discovery-rates">
                <span>{formatNumber(row.viewToRequestRate)}% view to request</span>
                <span>{formatNumber(row.requestToCompleteRate)}% request to done</span>
              </div>
              <time>{row.lastActivityAt ? formatDateTime(row.lastActivityAt) : 'No date'}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <Eye size={20} aria-hidden="true" />
          <strong>No Partner discovery conversion loaded.</strong>
          <p className="muted">Try another range after Partner profile views or requests exist.</p>
        </div>
      )}
    </section>
  );
}

function ActionPriorityItem({ priority }: { readonly priority: UsageActionPriority }) {
  const Icon = usageActionPriorityIcons[priority.key] ?? CalendarCheck;
  const value = priority.valueLabel.includes('to-')
    ? `${formatNumber(priority.value)}%`
    : formatNumber(priority.value);

  return (
    <article className={`usage-overview-action-item is-${priority.tone}`}>
      <span className="usage-overview-command-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <span>{priority.label}</span>
        <strong>{value}</strong>
        <small>{priority.detail}</small>
      </div>
      <em>{priority.valueLabel}</em>
    </article>
  );
}

function PopularServicesCard({ rows }: { readonly rows: readonly AdminUsageOverviewPopularServiceRow[] }) {
  const maxBookings = Math.max(1, ...rows.map((row) => row.bookingCount));

  return (
    <article className="card usage-overview-behavior-card">
      <div className="ops-section-header">
        <div>
          <h2>Popular services</h2>
          <p className="muted">Service choices from bookings created in this usage range.</p>
        </div>
        <Trophy size={18} aria-hidden="true" />
      </div>
      {rows.length > 0 ? (
        <div className="usage-overview-service-list">
          {rows.map((row) => {
            const widthPercent = Math.max(6, Math.round((row.bookingCount / maxBookings) * 100));

            return (
              <article key={row.id} className="usage-overview-service-row">
                <div className="usage-overview-service-main">
                  <span className="usage-overview-rank">#{row.rank}</span>
                  <div>
                    <strong>{row.label}</strong>
                    {row.secondary ? <small>{row.secondary}</small> : null}
                  </div>
                </div>
                <div className="usage-overview-service-metrics">
                  <span>
                    <strong>{formatNumber(row.bookingCount)}</strong>
                    bookings
                  </span>
                  <span>
                    <strong>{formatNumber(row.quantity)}</strong>
                    quantity
                  </span>
                  <span>
                    <strong>{money(row.amount)}</strong>
                    booked value
                  </span>
                </div>
                <div className="usage-overview-region-bar" aria-hidden="true">
                  <i style={{ width: `${widthPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <Trophy size={20} aria-hidden="true" />
          <strong>No service booking pattern loaded.</strong>
          <p className="muted">Try another range after bookings exist.</p>
        </div>
      )}
    </article>
  );
}

function HourlyActivityCard({ rows }: { readonly rows: readonly AdminUsageOverviewHourlyActivityRow[] }) {
  const activeRows = [...rows]
    .filter((row) => row.totalActivityCount > 0)
    .sort((left, right) => right.totalActivityCount - left.totalActivityCount)
    .slice(0, 8);
  const maxActivity = Math.max(1, ...activeRows.map((row) => row.totalActivityCount));

  return (
    <article className="card usage-overview-behavior-card">
      <div className="ops-section-header">
        <div>
          <h2>Hourly activity</h2>
          <p className="muted">Busiest hours from customer sessions and preferred-Partner requests.</p>
        </div>
        <Activity size={18} aria-hidden="true" />
      </div>
      {activeRows.length > 0 ? (
        <div className="usage-overview-hour-list">
          {activeRows.map((row) => {
            const widthPercent = Math.max(6, Math.round((row.totalActivityCount / maxActivity) * 100));

            return (
              <article key={row.hour} className="usage-overview-hour-row">
                <div>
                  <strong>{row.label}</strong>
                  <span>{formatNumber(row.totalActivityCount)} signals</span>
                </div>
                <div className="usage-overview-region-bar" aria-hidden="true">
                  <i style={{ width: `${widthPercent}%` }} />
                </div>
                <div className="usage-overview-hour-metrics">
                  <span>{formatNumber(row.customerSessionCount)} sessions</span>
                  <span>{formatNumber(row.bookingRequestCount)} requests</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <Activity size={20} aria-hidden="true" />
          <strong>No hourly usage pattern loaded.</strong>
          <p className="muted">Try another range after customer app activity exists.</p>
        </div>
      )}
    </article>
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
    <article className={`usage-overview-command-card is-${tone}`}>
      <span className="usage-overview-command-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
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
    <article className="card usage-overview-insight-card">
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="usage-overview-mini-metric-list">
        {rows.map((row) => (
          <div key={row.label} className={`usage-overview-mini-metric is-${row.tone}`}>
            <span>{row.label}</span>
            <strong>{formatNumber(row.value)}</strong>
          </div>
        ))}
      </div>
    </article>
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
    <article className="card usage-overview-insight-card">
      <div className="ops-section-header">
        <div>
          <h2>Payment & coupon</h2>
          <p className="muted">Completed-booking payment mix and coupon usage signal.</p>
        </div>
        <WalletCards size={18} aria-hidden="true" />
      </div>
      <div className="usage-overview-payment-summary">
          <div className="usage-overview-mini-metric is-info">
            <span>Coupon bookings</span>
            <strong>{formatNumber(couponBookingCount)}</strong>
          </div>
          <div className="usage-overview-mini-metric is-danger">
            <span>Failed payments</span>
            <strong>{formatNumber(paymentFailureCount)}</strong>
          </div>
          <div className="usage-overview-mini-metric is-warning">
            <span>Refund amount</span>
            <strong>{money(refundAmount)}</strong>
          </div>
          <div className="usage-overview-mini-metric is-primary">
            <span>Methods</span>
            <strong>{formatNumber(rows.length)}</strong>
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="usage-overview-payment-mix">
          {rows.map((row) => {
            const widthPercent = Math.max(6, Math.round((row.amount / maxAmount) * 100));

            return (
              <div key={row.method} className="usage-overview-payment-row">
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <BadgePercent size={20} aria-hidden="true" />
          <strong>No completed payment mix loaded.</strong>
          <p className="muted">Try another usage range after completed payments exist.</p>
        </div>
      )}
    </article>
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
      {activeRows.length > 0 ? (
        <div className="usage-overview-region-list">
          {activeRows.map((row) => {
            const activity = row.customerSessionCount + row.bookingRequestCount + row.completedBookingCount;
            const widthPercent = Math.max(6, Math.round((activity / maxRegionActivity) * 100));

            return (
              <article key={row.regionCode} className="usage-overview-region-row">
                <div className="vietnam-region-name">
                  <span>{row.shortName}</span>
                  <strong>{row.regionName}</strong>
                </div>
                <div className="usage-overview-region-metrics">
                  <span>
                    <strong>{formatNumber(row.customerSessionCount)}</strong>
                    Sessions
                  </span>
                  <span>
                    <strong>{formatNumber(row.bookingRequestCount)}</strong>
                    Requests
                  </span>
                  <span>
                    <strong>{formatNumber(row.completedBookingCount)}</strong>
                    Completed
                  </span>
                </div>
                <div className="usage-overview-region-bar" aria-hidden="true">
                  <i style={{ width: `${widthPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <MapPinned size={20} aria-hidden="true" />
          <strong>No region usage loaded.</strong>
          <p className="muted">Try another stored usage range.</p>
        </div>
      )}
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
      {rows.length > 0 ? (
        <div className="usage-overview-ranking-list" aria-label={title}>
          {rows.map((row) => (
            <article key={`${title}-${row.id}`} className="usage-overview-ranking-row">
              <span className="usage-overview-rank">#{row.rank}</span>
              <div className="usage-overview-name-cell">
                <span className="usage-overview-avatar">
                  <Users size={15} aria-hidden="true" />
                </span>
                <div>
                  {row.href ? <a href={row.href}>{row.label}</a> : <strong>{row.label}</strong>}
                  {row.secondary ? <small>{row.secondary}</small> : null}
                </div>
              </div>
              <div className="usage-overview-row-value">
                <strong>{formatNumber(row.value)}</strong>
                <span>{valueHeading}</span>
              </div>
              <time>{row.lastActivityAt ? formatDateTime(row.lastActivityAt) : 'No date'}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state usage-overview-empty-state">
          <MapPinned size={20} aria-hidden="true" />
          <strong>{emptyMessage}</strong>
          <p className="muted">Try another stored usage range.</p>
        </div>
      )}
    </article>
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

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
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
  return `${formatNumber(Math.round((numerator / denominator) * 100))}%`;
}
