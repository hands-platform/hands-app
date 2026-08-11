import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  Eye,
  MousePointerClick,
  Repeat2,
  Trophy,
  Users,
} from 'lucide-react';

import {
  type AdminUsageOverview,
  type AdminUsageOverviewCustomerRankingRow,
  type AdminUsageOverviewPartnerRankingRow,
  adminGet,
} from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminFormControlButton, AdminFormDate } from '../../components/admin-form-controls';
import {
  AdminMiniMetricStrip,
  AdminOverviewCommandCard,
  AdminOverviewCommandGrid,
  AdminOverviewGrid,
} from '../../components/admin-overview-card';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import {
  AdminCard,
  AdminDisclosure,
  AdminErrorState,
  AdminKpiCard,
  AdminSection,
} from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { formatCurrencyAmount as money, formatWholeNumber as number } from '../../lib/admin-format';
import {
  buildUsageActionPriorities,
  normalizeUsageOverviewRange,
  usageOverviewRangeOptions,
  usageOverviewWithDefaults,
  usageOverviewHref,
  validateUsageCustomRange,
} from './usage-overview-model';
import { UsageOverviewTrendChart } from './usage-overview-trend-chart';
import { UsageOverviewRefreshButton } from './usage-overview-refresh-button';

type UsageOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsageOverviewPage({
  searchParams,
}: {
  readonly searchParams?: UsageOverviewPageSearchParams;
}) {
  const params = await searchParams;
  const range = normalizeUsageOverviewRange(params?.range);
  const from = stringParam(params?.from);
  const to = stringParam(params?.to);
  const today = vietnamDateInput(new Date());
  const validationError = range === 'custom' ? validateUsageCustomRange(from, to, today) : null;
  const query = new URLSearchParams({ range });
  if (range === 'custom' && from) query.set('from', from);
  if (range === 'custom' && to) query.set('to', to);
  const requestHref = `/usage-overview?${query.toString()}`;
  const rawOverview = validationError
    ? null
    : await adminGet<AdminUsageOverview | null>(`/admin/usage-overview?${query.toString()}`, null, {
        freshness: 'live',
      });
  const overview = rawOverview ? usageOverviewWithDefaults(rawOverview, range) : null;

  return (
    <AdminPageTemplate
      contentClassName="usage-overview-page usage-overview-v2"
      description="Customer reach, booking outcomes, and the records that need an operator decision."
      title="Customer Usage"
    >
      <UsageRangePanel
        from={from}
        overview={overview}
        range={range}
        to={to}
        validationError={validationError}
      />

      {validationError ? (
        <AdminErrorState
          message={`${validationError} The requested period was not changed or loaded.`}
          title="Custom period not applied"
        />
      ) : !overview ? (
        <AdminErrorState
          action={<AdminTextLink href={requestHref}>Retry usage report</AdminTextLink>}
          message="The usage API did not return a report. No zero values are shown until the source becomes available."
          title="Usage data unavailable"
        />
      ) : (
        <UsageOverviewContent overview={overview} />
      )}
    </AdminPageTemplate>
  );
}

function UsageRangePanel({
  from,
  overview,
  range,
  to,
  validationError,
}: {
  readonly from: string | null;
  readonly overview: AdminUsageOverview | null;
  readonly range: ReturnType<typeof normalizeUsageOverviewRange>;
  readonly to: string | null;
  readonly validationError: string | null;
}) {
  const today = vietnamDateInput(new Date());
  const applied = overview?.appliedRange;
  const periodLabel =
    applied?.fromDate && applied.toDate
      ? `${applied.fromDate} – ${applied.toDate} · ${applied.dayCount} ${applied.dayCount === 1 ? 'day' : 'days'} · Vietnam time`
      : (overview?.rangeLabel ?? 'Unavailable');
  const scopeLabels = overview
    ? [
        periodLabel,
        applied?.granularity === 'hourly' ? 'Hourly' : 'Daily',
        overview.comparison.fromDate && overview.comparison.toDate
          ? `Compared with ${overview.comparison.fromDate} – ${overview.comparison.toDate}`
          : 'Comparison unavailable',
        `Report generated ${formatUsageDateTime(overview.freshness.reportGeneratedAt)} ICT`,
        overview.freshness.usageAggregatedThroughAt
          ? `Usage signals through ${formatUsageDateTime(overview.freshness.usageAggregatedThroughAt)} ICT`
          : 'Usage signal time unavailable',
      ]
    : [validationError ? 'Report not loaded · correct the dates' : 'Report not loaded'];

  return (
    <AdminFilterPanel
      actions={
        overview ? <UsageOverviewRefreshButton /> : undefined
      }
      className="usage-overview-filter-panel"
      description="Applied dates use Asia/Ho_Chi_Minh. Presets compare with the immediately preceding period of equal length."
      resultLabel={periodLabel}
      title="Reporting period"
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
      {range === 'custom' ? (
        <form action="/usage-overview" className="usage-overview-custom-range" method="get">
          <input name="range" type="hidden" value="custom" />
          <AdminFormDate
            ariaDescribedBy={validationError ? 'usage-custom-range-error' : undefined}
            ariaInvalid={Boolean(validationError)}
            defaultValue={from ?? today}
            label="From"
            labelVisibility="visible"
            name="from"
            required
          />
          <AdminFormDate
            ariaDescribedBy={validationError ? 'usage-custom-range-error' : undefined}
            ariaInvalid={Boolean(validationError)}
            defaultValue={to ?? today}
            label="To"
            labelVisibility="visible"
            name="to"
            required
          />
          <AdminFormControlButton type="submit">Apply period</AdminFormControlButton>
          {validationError ? (
            <small id="usage-custom-range-error" role="alert">
              {validationError}
            </small>
          ) : null}
        </form>
      ) : null}
      <AdminFilterSummary
        ariaLabel="Applied usage report scope"
        className="usage-overview-scope-summary"
        labels={scopeLabels}
        tone="info"
      />
      <UsageDataTrustNotice overview={overview} />
    </AdminFilterPanel>
  );
}

function UsageDataTrustNotice({ overview }: { readonly overview: AdminUsageOverview | null }) {
  if (!overview) {
    return (
      <div className="usage-overview-trust-notice is-neutral" role="status">
        <strong>Provenance not evaluated</strong>
        <span>The report was not loaded, so no production-data claim is shown.</span>
      </div>
    );
  }

  const provenanceGuaranteed = overview.provenance.usageFixtures === 'guaranteed';
  const usageTime = overview.freshness.usageAggregatedThroughAt;
  const usageDelayed = overview.freshness.usageStatus === 'delayed';
  const usageUnknown = overview.freshness.usageStatus === 'unknown';

  return (
    <div className="usage-overview-trust-stack">
      <div
        className={`usage-overview-trust-notice ${provenanceGuaranteed ? 'is-success' : 'is-warning'}`}
        role={provenanceGuaranteed ? 'status' : 'alert'}
      >
        <strong>{provenanceGuaranteed ? 'Synthetic usage excluded' : 'Usage provenance is incomplete'}</strong>
        <span>
          {provenanceGuaranteed
            ? 'Every usage total on this report reads only server-owned production aggregates.'
            : overview.provenance.unknownAggregateCount > 0
              ? `${number(overview.provenance.unknownAggregateCount)} unknown aggregate ${overview.provenance.unknownAggregateCount === 1 ? 'row is' : 'rows are'} excluded. Do not use the missing historical usage as a production total.`
              : 'Legacy aggregate provenance has not been verified. Do not use these totals for production decisions.'}
        </span>
      </div>
      {usageDelayed || usageUnknown ? (
        <div className="usage-overview-trust-notice is-warning" role="alert">
          <strong>{usageDelayed ? 'Production usage signals may be delayed' : 'Production usage freshness is unknown'}</strong>
          <span>
            {usageTime
              ? `The latest production usage signal is ${formatUsageDateTime(usageTime)} ICT, beyond the named 48-hour threshold for this period.`
              : 'No production usage aggregate timestamp is available for this period.'}
          </span>
        </div>
      ) : null}
      <AdminDisclosure ariaLabel="Source activity times" className="usage-overview-source-times">
        <summary>Source activity times</summary>
        <dl>
          <div><dt>Booking activity</dt><dd>{formatOptionalUsageDateTime(overview.freshness.bookingActivityThroughAt)}</dd></div>
          <div><dt>Review activity</dt><dd>{formatOptionalUsageDateTime(overview.freshness.reviewActivityThroughAt)}</dd></div>
          <div><dt>Refund activity</dt><dd>{formatOptionalUsageDateTime(overview.freshness.refundActivityThroughAt)}</dd></div>
        </dl>
      </AdminDisclosure>
    </div>
  );
}

function UsageOverviewContent({ overview }: { readonly overview: AdminUsageOverview }) {
  const previous = overview.comparison.totals;
  const kpis = [
    [
      'active-customers',
      'Active unique customers',
      overview.totals.activeCustomerCount,
      previous.activeCustomerCount,
      Users,
      'primary',
    ],
    [
      'partner-views',
      'Partner view events',
      overview.totals.partnerProfileViewCount,
      previous.partnerProfileViewCount,
      Eye,
      'info',
    ],
    [
      'created-bookings',
      'Booking records created',
      overview.bookingQuality.createdBookingCount,
      previous.createdBookingCount,
      CalendarCheck,
      'warning',
    ],
    [
      'unresolved-bookings',
      'Unresolved booking records',
      overview.bookingQuality.unresolvedCount,
      previous.unresolvedCount,
      AlertTriangle,
      'danger',
    ],
  ] as const;

  const report = (
    <>
      <ActionPriorities overview={overview} />

      <AdminOverviewCommandGrid ariaLabel="Period health">
        {kpis.map(([key, label, current, previousValue, Icon, tone]) => (
          <AdminKpiCard
            className={`usage-overview-kpi-card is-${tone}`}
            helper={`${periodDelta(current, previousValue).label} vs previous equal period`}
            icon={Icon}
            iconSize={18}
            key={key}
            kind="period"
            label={label}
            scope={overview.rangeLabel}
            value={number(current)}
          />
        ))}
      </AdminOverviewCommandGrid>

      <UniqueCustomerReach overview={overview} />
      <BookingOutcomes overview={overview} />

      <AdminSection
        actions={<Activity aria-hidden="true" size={18} />}
        className="usage-overview-trend-card"
        description={`${overview.appliedRange.granularity === 'hourly' ? 'Hourly' : 'Daily'} activity in Vietnam time. Customer and booking scales are separated.`}
        statusLabel={overview.rangeLabel}
        title="Activity trends"
      >
        <UsageOverviewTrendChart rows={overview.behavior.trend} />
      </AdminSection>

      <AdminOverviewGrid ariaLabel="Customer period and current base" variant="insight">
        <PeriodCustomers overview={overview} />
        <RetentionCard overview={overview} />
        <CurrentCustomerBase overview={overview} />
      </AdminOverviewGrid>

      <CustomerRankingTable rows={overview.customerRankings.slice(0, 5)} />
      <PartnerRankingTable rows={overview.partnerRankings.slice(0, 5)} />

      <AdminOverviewGrid ariaLabel="Demand and service patterns" variant="behavior">
        <PopularServices overview={overview} />
        <RegionTopFive overview={overview} />
      </AdminOverviewGrid>
    </>
  );

  if (hasTrackedUsage(overview)) return report;

  return (
    <>
      <AdminSection
        actions={
          <>
            <AdminTextLink href="/usage-overview?range=7d">Use last 7 days</AdminTextLink>
          </>
        }
        description="No stored app usage or booking event was recorded in the selected reporting period. Check the range, event collection, and aggregate freshness before treating this as zero demand."
        statusLabel="No data"
        statusTone="neutral"
        title="No tracked usage in this period"
      >
        <p className="muted">
          Possible causes: no app activity, delayed daily aggregation, or a period before usage tracking
          began.
        </p>
      </AdminSection>
      <AdminDisclosure className="admin-mt-16 usage-overview-empty-report">
        <summary>Show empty report</summary>
        {report}
      </AdminDisclosure>
    </>
  );
}

function hasTrackedUsage(overview: AdminUsageOverview) {
  return [
    overview.totals.totalEventCount,
    overview.totals.activeCustomerCount,
    overview.totals.partnerProfileViewCount,
    overview.totals.partnerBookingRequestCount,
    overview.totals.completedBookingCount,
    overview.bookingQuality.createdBookingCount,
    overview.bookingQuality.cancellationCount,
    overview.bookingQuality.noShowCount,
    overview.bookingQuality.expiredCount,
    overview.bookingQuality.refundCount,
    overview.customerLifecycle.newCustomerCount,
  ].some((value) => value > 0);
}

function formatUsageDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatOptionalUsageDateTime(value: string | null) {
  return value ? `${formatUsageDateTime(value)} ICT` : 'No qualifying activity in this period';
}

function ActionPriorities({ overview }: { readonly overview: AdminUsageOverview }) {
  const priorities = buildUsageActionPriorities(overview);
  return (
    <AdminSection
      actions={<AlertTriangle aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-action-list"
      className="usage-overview-action-card"
      description="Counts and filters use the same reporting-period contract as their destination lists."
      statusLabel={
        priorities.length > 0
          ? `${priorities.length} ${priorities.length === 1 ? 'queue' : 'queues'}`
          : 'No issue'
      }
      title="Needs attention"
    >
      {priorities.length === 0 ? (
        <div className="usage-overview-no-alerts" role="status">
          <strong>No usage alerts in this period</strong>
          <span>There are no new unbooked customers or unresolved booking records to review.</span>
        </div>
      ) : (
        priorities.map((priority) => (
          <AdminOverviewCommandCard
            baseClassName="usage-overview-action-item"
            className={`is-${priority.tone}`}
            detail={priority.detail}
            href={priority.href}
            icon={
              priority.key === 'unresolved-bookings' ? (
                <CalendarCheck aria-hidden="true" size={17} />
              ) : (
                <Users aria-hidden="true" size={17} />
              )
            }
            iconClassName="usage-overview-command-icon"
            key={priority.key}
            kind={priority.tone === 'danger' ? 'risk' : 'action'}
            label={priority.label}
            scope="Review now"
            trailing={<span>{`Review ${number(priority.value)} ${priority.valueLabel} →`}</span>}
            value={number(priority.value)}
          />
        ))
      )}
    </AdminSection>
  );
}

function UniqueCustomerReach({ overview }: { readonly overview: AdminUsageOverview }) {
  return (
    <AdminSection
      actions={<MousePointerClick aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-funnel-grid"
      className="usage-overview-funnel-card"
      description="Unique customers who reached each state in the period. This does not claim event order or event-lineage conversion."
      statusLabel="Unique customers"
      title="Unique-customer reach"
    >
      {overview.funnel.map((step, index) => (
        <AdminCard className="usage-overview-funnel-step" key={step.key}>
          <span>{step.label}</span>
          <strong>{number(step.count)}</strong>
          <small>
            {index === 0
              ? 'unique customers'
              : step.conversionRate === null
                ? 'N/A · no previous-step customers'
                : `${number(step.conversionRate)}% of previous reached set`}
          </small>
        </AdminCard>
      ))}
    </AdminSection>
  );
}

function BookingOutcomes({ overview }: { readonly overview: AdminUsageOverview }) {
  const outcomes = overview.bookingQuality;
  const reconciled =
    overview.totals.completedBookingCount +
      outcomes.cancellationCount +
      outcomes.noShowCount +
      outcomes.expiredCount +
      outcomes.refundCount +
      outcomes.unresolvedCount ===
    outcomes.createdBookingCount;
  return (
    <AdminSection
      actions={<CalendarCheck aria-hidden="true" size={18} />}
      className="usage-overview-outcomes-card"
      description="Mutually exclusive current status as of report generation for booking records created in the reporting period."
      statusLabel={reconciled ? 'Cohort reconciled' : 'Source mismatch'}
      title="Booking outcomes"
    >
      <AdminMiniMetricStrip
        className="usage-overview-booking-outcome-list"
        metrics={[
          { label: 'Created in period', tone: 'primary', value: number(outcomes.createdBookingCount) },
          { label: 'Completed', tone: 'success', value: number(overview.totals.completedBookingCount) },
          { label: 'Cancelled', tone: 'warning', value: number(outcomes.cancellationCount) },
          { label: 'No-show', tone: 'danger', value: number(outcomes.noShowCount) },
          { label: 'Expired', tone: 'warning', value: number(outcomes.expiredCount) },
          { label: 'Refunded', tone: 'danger', value: number(outcomes.refundCount) },
          {
            label: 'Still open / unresolved',
            tone: outcomes.unresolvedCount > 0 ? 'danger' : 'success',
            value: number(outcomes.unresolvedCount),
          },
        ]}
      />
    </AdminSection>
  );
}

function PeriodCustomers({ overview }: { readonly overview: AdminUsageOverview }) {
  return (
    <MetricSection
      icon={Users}
      metrics={[
        ['New customers', overview.customerLifecycle.newCustomerCount, 'info'],
        ['Customers with completed work', overview.customerLifecycle.completedCustomerCount, 'success'],
        ['2+ completions in period', overview.customerLifecycle.repeatCustomerCount, 'success'],
      ]}
      title="Period customers"
    />
  );
}

function CurrentCustomerBase({ overview }: { readonly overview: AdminUsageOverview }) {
  const usageThrough = overview.freshness.usageAggregatedThroughAt;
  return (
    <MetricSection
      description="Usage-derived snapshot. Reporting-period comparison does not apply."
      icon={Users}
      metrics={[
        ['Never booked', overview.customerLifecycle.neverBookedCustomerCount, 'warning'],
        ['Inactive 30d', overview.customerLifecycle.churnRiskCustomerCount, 'danger'],
        ['Seen today', overview.customerLifecycle.activeTodayCustomerCount, 'info'],
        ['Seen in 7d', overview.customerLifecycle.active7dCustomerCount, 'primary'],
        ['Seen in 30d', overview.customerLifecycle.active30dCustomerCount, 'primary'],
      ]}
      title={`Current customer base · ${usageThrough ? `As of usage data through ${formatUsageDateTime(usageThrough)} ICT` : 'Usage data time unavailable'}`}
    />
  );
}

function RetentionCard({ overview }: { readonly overview: AdminUsageOverview }) {
  return (
    <AdminSection
      actions={<Repeat2 aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-retention-list"
      className="usage-overview-insight-card"
      description="Customers who returned on the exact milestone day after signup."
      title="Cohort retention"
    >
      {overview.retention.map((row) => (
        <AdminCard className="usage-overview-retention-row" key={row.milestone}>
          <span>D{row.milestone}</span>
          <strong>{row.rate === null ? 'N/A' : `${number(row.rate)}%`}</strong>
          <small>
            {row.eligibleCustomerCount === 0
              ? 'No eligible cohort'
              : `${number(row.returnedCustomerCount)} of ${number(row.eligibleCustomerCount)} eligible`}
          </small>
        </AdminCard>
      ))}
    </AdminSection>
  );
}

function MetricSection({
  description,
  icon: Icon,
  metrics,
  title,
}: {
  readonly description?: string;
  readonly icon: typeof Users;
  readonly metrics: ReadonlyArray<readonly [string, number, string]>;
  readonly title: string;
}) {
  return (
    <AdminSection
      actions={<Icon aria-hidden="true" size={18} />}
      className="usage-overview-insight-card"
      description={description}
      title={title}
    >
      <AdminMiniMetricStrip
        className="usage-overview-mini-metric-list"
        metrics={metrics.map(([label, value, tone]) => ({ label, tone, value: number(value) }))}
      />
    </AdminSection>
  );
}

function CustomerRankingTable({ rows }: { readonly rows: readonly AdminUsageOverviewCustomerRankingRow[] }) {
  return (
    <AdminSection
      actions={<AdminTextLink href="/customers?view=all">View all customers</AdminTextLink>}
      className="usage-overview-ranking-card"
      description="Top five customers by production usage events. Closed issue outcomes use closedAt in the selected period and include cancelled, no-show, expired, and refunded records; they are separate from the created-cohort outcomes above. Phone numbers are masked by the API."
      title="Customer activity · Top 5"
    >
      <AdminTableScroll ariaLabel="Customer activity top five table">
        <AdminDataTable
          emptyMessage="No customer activity in this period."
          headers={['Customer', 'Events', 'App opens', 'Partner views', 'Completed', 'Closed issue outcomes', 'Last active']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <th>
                <AdminTextLink href={row.href}>
                  #{row.rank} {row.label}
                </AdminTextLink>
                <small>{row.secondary}</small>
              </th>
              <td>{number(row.totalEventCount)}</td>
              <td>{number(row.appOpenCount)}</td>
              <td>{number(row.providerProfileViewCount)}</td>
              <td>{number(row.completedBookingCount)}</td>
              <td>
                <StatusBadge tone={row.issueCount > 0 ? 'danger' : 'success'}>
                  {number(row.issueCount)}
                </StatusBadge>
              </td>
              <td>
                <DateTimeText fallback="No activity" value={row.lastActivityAt} />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function PartnerRankingTable({ rows }: { readonly rows: readonly AdminUsageOverviewPartnerRankingRow[] }) {
  return (
    <AdminSection
      actions={<AdminTextLink href="/partners">View all Partners</AdminTextLink>}
      className="usage-overview-ranking-card"
      description="Top five Partner discovery signals. Views, preferred requests, and completed work are independent counts."
      title="Partner discovery · Top 5"
    >
      <AdminTableScroll ariaLabel="Partner discovery top five table">
        <AdminDataTable
          emptyMessage="No Partner discovery activity in this period."
          headers={['Partner', 'Views', 'Preferred requests', 'Completed', 'Last active']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <th>
                <AdminTextLink href={row.href}>
                  #{row.rank} {row.label}
                </AdminTextLink>
                <small>{row.secondary}</small>
              </th>
              <td>{number(row.viewCount)}</td>
              <td>{number(row.requestCount)}</td>
              <td>{number(row.completedCount)}</td>
              <td>
                <DateTimeText fallback="No activity" value={row.lastActivityAt} />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

function PopularServices({ overview }: { readonly overview: AdminUsageOverview }) {
  return (
    <AdminSection
      actions={<Trophy aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-compact-list"
      className="usage-overview-behavior-card"
      title="Popular services"
    >
      {overview.behavior.popularServices.length > 0 ? (
        overview.behavior.popularServices.slice(0, 5).map((row) => (
          <div className="usage-overview-service-row" key={row.id}>
            <span className="usage-overview-row-rank">#{row.rank}</span>
            <div className="usage-overview-row-identity">
              <strong>{row.label}</strong>
              <small>{row.secondary}</small>
            </div>
            <div className="usage-overview-service-values">
              <strong>{number(row.bookingCount)} bookings</strong>
              <small>{money(row.amount)}</small>
            </div>
          </div>
        ))
      ) : (
        <span className="muted">No service demand in this period.</span>
      )}
    </AdminSection>
  );
}

function RegionTopFive({ overview }: { readonly overview: AdminUsageOverview }) {
  const vietnamRange = ['today', 'yesterday', '7d', '30d'].includes(overview.range) ? overview.range : null;
  return (
    <AdminSection
      actions={
        vietnamRange ? (
          <AdminTextLink href={`/vietnam-overview?view=period&range=${vietnamRange}`}>
            Open Vietnam Overview
          </AdminTextLink>
        ) : undefined
      }
      bodyClassName="usage-overview-compact-list"
      className="usage-overview-behavior-card"
      description="Created booking demand and current cohort outcomes for the top five regions."
      title="Top regions"
    >
      {overview.regionUsage.length > 0 ? (
        overview.regionUsage.slice(0, 5).map((row) => (
          <div className="usage-overview-region-row-v2" key={row.regionCode}>
            <div className="usage-overview-region-identity">
              <span>{row.shortName}</span>
              <strong>{row.regionName}</strong>
            </div>
            <div className="usage-overview-region-values">
              <span><strong>{number(row.bookingRequestCount)}</strong> created</span>
              <span><strong>{number(row.completedBookingCount)}</strong> completed</span>
              <span><strong>{number(row.cancellationCount + row.noShowCount + row.expiredCount)}</strong> non-completed</span>
              <span><strong>{number(row.unresolvedCount)}</strong> unresolved</span>
            </div>
          </div>
        ))
      ) : (
        <span className="muted">No regional booking demand in this period.</span>
      )}
    </AdminSection>
  );
}

function periodDelta(current: number, previous: number) {
  if (previous === 0) return { label: current === 0 ? 'No change' : 'New activity' };
  const value = Math.round(((current - previous) / previous) * 100);
  return { label: `${value > 0 ? '+' : ''}${number(value)}%` };
}

function stringParam(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

function vietnamDateInput(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
