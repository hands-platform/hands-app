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
import { redirect } from 'next/navigation';

import {
  type AdminUsageOverview,
  type AdminUsageOverviewCustomerRankingRow,
  type AdminUsageOverviewPartnerRankingRow,
  adminGet,
} from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
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
  usageOverviewEmptyRangeAction,
  usageOverviewWithDefaults,
  usageOverviewCustomHref,
  usageOverviewHref,
  validateUsageCustomRange,
} from './usage-overview-model';
import { UsageOverviewTrendChartDeferred } from './usage-overview-trend-chart-deferred';
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
  if (range === 'custom' && !from && !to) {
    redirect(usageOverviewCustomHref(today));
  }
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
        today={today}
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
  today,
  validationError,
}: {
  readonly from: string | null;
  readonly overview: AdminUsageOverview | null;
  readonly range: ReturnType<typeof normalizeUsageOverviewRange>;
  readonly to: string | null;
  readonly today: string;
  readonly validationError: string | null;
}) {
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
          href: option.value === 'custom' ? usageOverviewCustomHref(today) : usageOverviewHref(option.value),
          label: option.label,
          value: option.value,
        }))}
      />
      {range === 'custom' ? (
        <AdminDirectoryFilterForm action="/usage-overview" className="usage-overview-custom-range" method="get">
          <input name="range" type="hidden" value="custom" />
          <AdminFormDate
            ariaDescribedBy={validationError ? 'usage-custom-range-error' : undefined}
            ariaInvalid={Boolean(validationError)}
            defaultValue={from ?? ''}
            label="From"
            labelVisibility="visible"
            name="from"
            required
          />
          <AdminFormDate
            ariaDescribedBy={validationError ? 'usage-custom-range-error' : undefined}
            ariaInvalid={Boolean(validationError)}
            defaultValue={to ?? ''}
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
        </AdminDirectoryFilterForm>
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

  const usageGuaranteed = overview.provenance.usage === 'guaranteed';
  const bookingGuaranteed = overview.provenance.booking === 'guaranteed';
  const usageTime = overview.freshness.usageAggregatedThroughAt;
  const usageDelayed = overview.freshness.usageStatus === 'delayed';
  const usageUnavailable = ['unknown', 'failed'].includes(overview.freshness.usageStatus);

  return (
    <div className="usage-overview-trust-stack" role="status" aria-label="Data health">
      <div className="usage-overview-data-health">
        <div className={`usage-overview-data-health-item${usageUnavailable || usageDelayed ? ' is-warning' : ''}`}>
          <span>Usage telemetry</span>
          <strong>
            {usageUnavailable || usageDelayed ? <AlertTriangle aria-hidden="true" size={14} /> : null}
            {usageUnavailable ? 'Data unavailable' : usageDelayed ? 'Delayed' : 'Available'}
          </strong>
          <small>{usageTime ? `Through ${formatUsageDateTime(usageTime)} ICT` : 'No production aggregate timestamp'}</small>
        </div>
        <div className={`usage-overview-data-health-item${usageGuaranteed ? '' : ' is-warning'}`}>
          <span>Usage provenance</span>
          <strong>
            {usageGuaranteed ? null : <AlertTriangle aria-hidden="true" size={14} />}
            {usageGuaranteed ? 'Production verified' : 'Verification incomplete'}
          </strong>
          <small>{overview.provenance.unknownUsageAggregateCount > 0 ? `${number(overview.provenance.unknownUsageAggregateCount)} unknown rows excluded` : 'Server-owned origin required'}</small>
        </div>
        <div className={`usage-overview-data-health-item${bookingGuaranteed ? '' : ' is-warning'}`}>
          <span>Booking records</span>
          <strong>
            {bookingGuaranteed ? null : <AlertTriangle aria-hidden="true" size={14} />}
            {bookingGuaranteed ? 'Production verified' : 'Verification incomplete'}
          </strong>
          <small>{overview.provenance.unknownBookingCount > 0 ? `${number(overview.provenance.unknownBookingCount)} unknown records excluded` : 'Explicit production origin required'}</small>
        </div>
        <div className={`usage-overview-data-health-item${usageDelayed ? ' is-warning' : ''}`}>
          <span>Report generated</span>
          <strong>
            {usageDelayed ? <AlertTriangle aria-hidden="true" size={14} /> : null}
            {formatUsageDateTime(overview.freshness.reportGeneratedAt)} ICT
          </strong>
          <small>{usageDelayed ? 'Usage exceeds the 48-hour freshness threshold' : 'Booking and usage sources are evaluated separately'}</small>
        </div>
      </div>
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
  const usageAvailable = !['unknown', 'failed'].includes(overview.freshness.usageStatus);
  const bookingAvailable = overview.provenance.booking === 'guaranteed';
  const bookingExcludedCount = overview.provenance.unknownBookingCount;
  const emptyRangeAction = usageOverviewEmptyRangeAction(overview.range);
  const kpis = [
    [
      'active-customers',
      'Active unique customers',
      usageAvailable ? overview.totals.activeCustomerCount : null,
      usageAvailable ? previous.activeCustomerCount : null,
      Users,
      'primary',
      'usage',
    ],
    [
      'partner-views',
      'Partner view events',
      usageAvailable ? overview.totals.partnerProfileViewCount : null,
      usageAvailable ? previous.partnerProfileViewCount : null,
      Eye,
      'info',
      'usage',
    ],
    [
      'created-bookings',
      'Booking records created',
      overview.bookingQuality.createdBookingCount,
      previous.createdBookingCount,
      CalendarCheck,
      'warning',
      'booking',
    ],
    [
      'unresolved-bookings',
      'Unresolved booking records',
      overview.bookingQuality.unresolvedCount,
      previous.unresolvedCount,
      AlertTriangle,
      'danger',
      'booking',
    ],
  ] as const;

  const report = (
    <>
      <ActionPriorities overview={overview} />

      <AdminOverviewCommandGrid ariaLabel="Period health">
        {kpis.map(([key, label, current, previousValue, Icon, tone, source]) => (
          <AdminKpiCard
            className={`usage-overview-kpi-card is-${tone}`}
            helper={
              source === 'booking' && !bookingAvailable
                ? bookingSubsetDetail(bookingExcludedCount)
                : current === null || previousValue === null
                  ? 'Data unavailable'
                  : `${periodDelta(current, previousValue).label} vs previous equal period`
            }
            icon={Icon}
            iconSize={18}
            key={key}
            kind="period"
            label={label}
            scope={overview.rangeLabel}
            value={
              current === null
                ? '—'
                : source === 'booking' && !bookingAvailable
                  ? `${number(current)} verified`
                  : number(current)
            }
          />
        ))}
      </AdminOverviewCommandGrid>

      <UniqueCustomerReach
        bookingAvailable={bookingAvailable}
        bookingExcludedCount={bookingExcludedCount}
        overview={overview}
        usageAvailable={usageAvailable}
      />
      <BookingOutcomes
        bookingAvailable={bookingAvailable}
        bookingExcludedCount={bookingExcludedCount}
        overview={overview}
      />

      <AdminSection
        actions={<Activity aria-hidden="true" size={18} />}
        className="usage-overview-trend-card"
        description={`${overview.appliedRange.granularity === 'hourly' ? 'Hourly' : 'Daily'} activity in Vietnam time. Booking outcomes above are the current status of bookings created in-period; completed activity below uses closedAt.${bookingAvailable ? '' : ` ${bookingSourceDetail(bookingExcludedCount)}.`}`}
        statusLabel={overview.rangeLabel}
        title="Activity trends"
      >
        <UsageOverviewTrendChartDeferred
          bookingAvailable={bookingAvailable}
          bookingExcludedCount={bookingExcludedCount}
          rows={overview.behavior.trend}
          usageAvailable={usageAvailable}
        />
      </AdminSection>

      <AdminOverviewGrid ariaLabel="Customer period and current base" variant="insight">
        <PeriodCustomers
          bookingAvailable={bookingAvailable}
          bookingExcludedCount={bookingExcludedCount}
          overview={overview}
        />
        <RetentionCard overview={overview} usageAvailable={usageAvailable} />
        <CurrentCustomerBase
          bookingAvailable={bookingAvailable}
          bookingExcludedCount={bookingExcludedCount}
          overview={overview}
          usageAvailable={usageAvailable}
        />
      </AdminOverviewGrid>

      <CustomerRankingTable rows={overview.customerRankings.slice(0, 5)} />
      <PartnerRankingTable rows={overview.partnerRankings.slice(0, 5)} />

      <AdminOverviewGrid ariaLabel="Demand and service patterns" variant="behavior">
        <PopularServices
          bookingAvailable={bookingAvailable}
          bookingExcludedCount={bookingExcludedCount}
          overview={overview}
        />
        <RegionTopFive
          bookingAvailable={bookingAvailable}
          bookingExcludedCount={bookingExcludedCount}
          overview={overview}
        />
      </AdminOverviewGrid>
    </>
  );

  if (hasTrackedUsage(overview)) return report;

  return (
    <>
      <AdminSection
        actions={emptyRangeAction ? (
          <AdminTextLink href={emptyRangeAction.href}>{emptyRangeAction.label}</AdminTextLink>
        ) : undefined}
        description={
          bookingAvailable
            ? 'No stored app usage or booking event was recorded in the selected reporting period. Check the range, event collection, and aggregate freshness before treating this as zero demand.'
            : `No stored app usage or verified production booking activity was recorded in the selected reporting period. ${bookingSourceDetail(bookingExcludedCount)}.`
        }
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
      description="These queues contain records from the selected reporting period. Open a queue to review the exact customers or bookings."
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

function UniqueCustomerReach({
  bookingAvailable,
  bookingExcludedCount,
  overview,
  usageAvailable,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
  readonly usageAvailable: boolean;
}) {
  return (
    <AdminSection
      actions={<MousePointerClick aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-funnel-grid"
      className="usage-overview-funnel-card"
      description="Unique customers who reached each state in the period. This does not claim event order or event-lineage conversion."
      statusLabel="Unique customers"
      title="Unique-customer reach"
    >
      {overview.funnel.map((step, index) => {
        const bookingStep = step.key === 'booking' || step.key === 'completed';
        return (
          <AdminCard className="usage-overview-funnel-step" key={step.key}>
            <span>{step.label}</span>
            <strong>
              {!bookingStep && !usageAvailable
                ? '—'
                : bookingStep && !bookingAvailable
                  ? `${number(step.count)} verified`
                  : number(step.count)}
            </strong>
            <small>
              {!bookingStep && !usageAvailable
                ? 'Data unavailable'
                : bookingStep && !bookingAvailable
                  ? bookingSubsetDetail(bookingExcludedCount)
                  : index === 0
                    ? 'unique customers'
                    : step.conversionRate === null
                      ? 'N/A · no previous-step customers'
                      : `${number(step.conversionRate)}% of previous reached set`}
            </small>
          </AdminCard>
        );
      })}
    </AdminSection>
  );
}

function BookingOutcomes({
  bookingAvailable,
  bookingExcludedCount,
  overview,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
}) {
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
      description={`Mutually exclusive current status as of report generation for booking records created in the reporting period.${bookingAvailable ? '' : ` ${bookingSourceDetail(bookingExcludedCount)}.`}`}
      statusLabel={bookingAvailable ? (reconciled ? 'Cohort reconciled' : 'Source mismatch') : 'Verified cohort only'}
      statusTone={bookingAvailable ? undefined : 'warning'}
      title="Booking outcomes"
    >
      <AdminMiniMetricStrip
        className="usage-overview-booking-outcome-list"
        metrics={[
          { label: 'Created in period', tone: 'primary', value: bookingMetricValue(outcomes.createdBookingCount, bookingAvailable) },
          { label: 'Completed', tone: 'success', value: bookingMetricValue(overview.totals.completedBookingCount, bookingAvailable) },
          { label: 'Cancelled', tone: 'warning', value: bookingMetricValue(outcomes.cancellationCount, bookingAvailable) },
          { label: 'No-show', tone: 'danger', value: bookingMetricValue(outcomes.noShowCount, bookingAvailable) },
          { label: 'Expired', tone: 'warning', value: bookingMetricValue(outcomes.expiredCount, bookingAvailable) },
          { label: 'Refunded', tone: 'danger', value: bookingMetricValue(outcomes.refundCount, bookingAvailable) },
          {
            label: 'Still open / unresolved',
            tone: outcomes.unresolvedCount > 0 ? 'danger' : 'success',
            value: bookingMetricValue(outcomes.unresolvedCount, bookingAvailable),
          },
        ]}
      />
    </AdminSection>
  );
}

function PeriodCustomers({
  bookingAvailable,
  bookingExcludedCount,
  overview,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
}) {
  return (
    <MetricSection
      description={bookingAvailable ? undefined : `${bookingSourceDetail(bookingExcludedCount)}.`}
      icon={Users}
      metrics={[
        ['New customers', overview.customerLifecycle.newCustomerCount, 'info'],
        [bookingAvailable ? 'Customers with completed work' : 'Customers with verified completed work', bookingMetricValue(overview.customerLifecycle.completedCustomerCount, bookingAvailable), 'success'],
        [bookingAvailable ? '2+ completions in period' : '2+ verified completions in period', bookingMetricValue(overview.customerLifecycle.repeatCustomerCount, bookingAvailable), 'success'],
      ]}
      title="Period customers"
    />
  );
}

function CurrentCustomerBase({
  bookingAvailable,
  bookingExcludedCount,
  overview,
  usageAvailable,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
  readonly usageAvailable: boolean;
}) {
  const usageThrough = overview.freshness.usageAggregatedThroughAt;
  return (
    <MetricSection
      description={`Usage-derived snapshot. Reporting-period comparison does not apply.${bookingAvailable ? '' : ` ${bookingSourceDetail(bookingExcludedCount)}.`}`}
      icon={Users}
      metrics={[
        [bookingAvailable ? 'Never booked' : 'No verified production booking', overview.customerLifecycle.neverBookedCustomerCount, 'warning'],
        ['Inactive 30d', usageAvailable ? overview.customerLifecycle.churnRiskCustomerCount : '—', 'danger'],
        ['Seen today', usageAvailable ? overview.customerLifecycle.activeTodayCustomerCount : '—', 'info'],
        ['Seen in 7d', usageAvailable ? overview.customerLifecycle.active7dCustomerCount : '—', 'primary'],
        ['Seen in 30d', usageAvailable ? overview.customerLifecycle.active30dCustomerCount : '—', 'primary'],
      ]}
      title={`Current customer base · ${usageThrough ? `As of usage data through ${formatUsageDateTime(usageThrough)} ICT` : 'Usage data time unavailable'}`}
    />
  );
}

function RetentionCard({ overview, usageAvailable }: { readonly overview: AdminUsageOverview; readonly usageAvailable: boolean }) {
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
          <strong>{!usageAvailable ? '—' : row.rate === null ? 'N/A' : `${number(row.rate)}%`}</strong>
          <small>
            {!usageAvailable ? 'Data unavailable' : row.eligibleCustomerCount === 0
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
  readonly metrics: ReadonlyArray<readonly [string, number | string, string]>;
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
        metrics={metrics.map(([label, value, tone]) => ({ label, tone, value: typeof value === 'number' ? number(value) : value }))}
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
      title="Most active customers · Top 5"
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

function PopularServices({
  bookingAvailable,
  bookingExcludedCount,
  overview,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
}) {
  return (
    <AdminSection
      actions={<Trophy aria-hidden="true" size={18} />}
      bodyClassName="usage-overview-compact-list"
      className="usage-overview-behavior-card"
      description={bookingAvailable ? undefined : `${bookingSourceDetail(bookingExcludedCount)}.`}
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
        <span className="muted">
          {bookingAvailable
            ? 'No service demand in this period.'
            : `No verified production service demand in this period. ${bookingSourceDetail(bookingExcludedCount)}.`}
        </span>
      )}
    </AdminSection>
  );
}

function RegionTopFive({
  bookingAvailable,
  bookingExcludedCount,
  overview,
}: {
  readonly bookingAvailable: boolean;
  readonly bookingExcludedCount: number;
  readonly overview: AdminUsageOverview;
}) {
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
      description={`Created booking demand and current cohort outcomes for the top five regions.${bookingAvailable ? '' : ` ${bookingSourceDetail(bookingExcludedCount)}.`}`}
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
        <span className="muted">
          {bookingAvailable
            ? 'No regional booking demand in this period.'
            : `No verified production regional booking demand in this period. ${bookingSourceDetail(bookingExcludedCount)}.`}
        </span>
      )}
    </AdminSection>
  );
}

function periodDelta(current: number, previous: number) {
  if (previous === 0) return { label: current === 0 ? 'No change' : 'New activity' };
  const value = Math.round(((current - previous) / previous) * 100);
  return { label: `${value > 0 ? '+' : ''}${number(value)}%` };
}

function bookingMetricValue(value: number, bookingAvailable: boolean) {
  return bookingAvailable ? number(value) : `${number(value)} verified`;
}

function bookingSubsetDetail(excludedCount: number) {
  return excludedCount > 0
    ? `Verified subset only · ${number(excludedCount)} unverified records excluded`
    : 'Verified subset only · Booking source verification incomplete';
}

function bookingSourceDetail(excludedCount: number) {
  return excludedCount > 0
    ? `Source incomplete · ${number(excludedCount)} unverified records excluded`
    : 'Source incomplete · Booking source verification incomplete';
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
