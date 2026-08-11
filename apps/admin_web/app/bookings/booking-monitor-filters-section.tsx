import type { FormEventHandler } from 'react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminDisclosure } from '../../components/admin-surface';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import type { BookingDateRangeFilter } from './booking-date-range-filter';
import type { BookingPageView } from './booking-page-params';
import type {
  AdminQueueAge,
  AdminQueueAgeCounts,
  AdminQueueSlaSummary,
  AdminQueueSlaFilter,
  AdminQueueSort,
} from '../../lib/admin-queue-list';
import { ADMIN_QUEUE_SORT_OPTIONS } from '../../lib/admin-queue-list';
import { AdminQueueAgeSortControls } from '../../components/admin-queue-age-sort-controls';
import { adminCountLabel } from '../../lib/admin-copy';
import type { BookingPostMatchCancellationReasonFilter } from './booking-post-match-cancellation-reason';
import { BOOKING_RECORD_VIEWS, bookingMonitorIsRecordsView } from './booking-monitor-realtime';

export type BookingMonitorViewOption = {
  readonly description: string;
  readonly label: string;
  readonly operatorHint: string;
  readonly view: BookingPageView;
};

export type BookingMonitorDateRangeFilterOption = {
  readonly label: string;
  readonly value: BookingDateRangeFilter;
};

type BookingMonitorFiltersSectionProps = {
  readonly age?: AdminQueueAge;
  readonly ageCounts?: AdminQueueAgeCounts;
  readonly ageHref?: (age: AdminQueueAge) => string;
  readonly queueSla?: AdminQueueSlaSummary;
  readonly slaFilter?: AdminQueueSlaFilter;
  readonly slaHref?: (sla: AdminQueueSlaFilter) => string;
  readonly activeView: BookingMonitorViewOption;
  readonly baseVisibleBookingCount: number;
  readonly cancellationReasonFilter?: BookingPostMatchCancellationReasonFilter;
  readonly cancellationReasonFilterOptions?: readonly {
    readonly label: string;
    readonly value: BookingPostMatchCancellationReasonFilter;
  }[];
  readonly customDateFrom?: string;
  readonly customDateError?: string | null;
  readonly customDateTo?: string;
  readonly dateRangeFormAction?: string;
  readonly dateRangeFilter?: BookingDateRangeFilter;
  readonly dateRangeLabel?: string;
  readonly dateRangeHiddenInputs?: readonly (readonly [string, string])[];
  readonly dateRangeHrefFor?: (value: BookingDateRangeFilter) => string;
  readonly dateRangeFilterOptions?: readonly BookingMonitorDateRangeFilterOption[];
  readonly onCustomDateFromChange?: (value: string) => void;
  readonly onCustomDateSubmit?: FormEventHandler<HTMLFormElement>;
  readonly onCustomDateToChange?: (value: string) => void;
  readonly onDateRangeFilterChange?: (value: BookingDateRangeFilter) => void;
  readonly onViewChange: (value: BookingPageView) => void;
  readonly searchClearHref?: string;
  readonly filterResetHref?: string;
  readonly hasActiveFilters?: boolean;
  readonly searchQuery?: string;
  readonly showAdditionalQueues?: boolean;
  readonly showDateRange?: boolean;
  readonly showQueueAge?: boolean;
  readonly showEmptyViewOptions?: boolean;
  readonly queueAgeHelp?: string;
  readonly queueAgeLabel?: string;
  readonly queueSortOptions?: readonly { readonly label: string; readonly value: AdminQueueSort }[];
  readonly title?: string;
  readonly sort?: AdminQueueSort;
  readonly sortHref?: (sort: AdminQueueSort) => string;
  readonly view: BookingPageView;
  readonly viewCounts: ReadonlyMap<string, number>;
  readonly viewHrefFor?: (value: BookingPageView) => string;
  readonly viewOptions: readonly BookingMonitorViewOption[];
  readonly visibleBookingCount: number;
};

const PRIMARY_BOOKING_VIEWS = new Set<BookingPageView>([
  'attention',
  'active',
  'matching',
  'in-service',
]);
const COMPLETED_ACTION_VIEW_ORDER: readonly BookingPageView[] = [
  'payment',
  'cash-debt',
  'refund-review',
  'closeout',
  'pricing',
];
const COMPLETED_HISTORY_VIEWS = new Set<BookingPageView>(['expired', 'all']);

export function BookingMonitorFiltersSection({
  age = 'all',
  ageCounts,
  ageHref = (value) => `?age=${value}`,
  queueSla,
  slaFilter = 'all',
  slaHref,
  activeView,
  baseVisibleBookingCount,
  cancellationReasonFilter = 'all',
  cancellationReasonFilterOptions = [],
  customDateFrom = '',
  customDateError = null,
  customDateTo = '',
  dateRangeFormAction = '/bookings',
  dateRangeFilter = 'today',
  dateRangeLabel = 'Period',
  dateRangeHiddenInputs = [],
  dateRangeHrefFor = defaultDateRangeHrefFor,
  dateRangeFilterOptions = [],
  onCustomDateFromChange = noop,
  onCustomDateSubmit,
  onCustomDateToChange = noop,
  onDateRangeFilterChange = noop,
  onViewChange,
  searchClearHref = '/bookings',
  filterResetHref = '/bookings',
  hasActiveFilters = false,
  searchQuery = '',
  showAdditionalQueues = true,
  showDateRange = true,
  showQueueAge = true,
  showEmptyViewOptions = false,
  queueAgeHelp = 'Queue age is measured from the booking request creation time.',
  queueAgeLabel = 'Requested',
  queueSortOptions,
  sort = 'newest',
  sortHref = (value) => `?sort=${value}`,
  title = 'Booking queues',
  view,
  viewCounts,
  viewHrefFor = defaultViewHrefFor,
  viewOptions,
}: BookingMonitorFiltersSectionProps) {
  const isPostMatchCancellationWorkspace =
    dateRangeFormAction === '/bookings/post-match-cancellations';
  const isCompletedWorkspace = dateRangeFormAction === '/bookings/completed';
  const isRecordsWorkspace = bookingMonitorIsRecordsView(dateRangeFormAction, view);
  const visibleViewOptions = viewOptions.filter(
    (option) =>
      PRIMARY_BOOKING_VIEWS.has(option.view) ||
      option.view === view ||
      option.view === 'all' ||
      (viewCounts.get(option.view) ?? 0) > 0,
  );
  const preferredPrimaryViewOptions = visibleViewOptions.filter((option) =>
    PRIMARY_BOOKING_VIEWS.has(option.view),
  );
  const recordViewOptions = viewOptions
    .filter((option) => BOOKING_RECORD_VIEWS.has(option.view))
    .map((option) => (option.view === 'all' ? { ...option, label: 'All records' } : option))
    .sort((left, right) => Number(right.view === 'all') - Number(left.view === 'all'));
  const completedActionOptions = COMPLETED_ACTION_VIEW_ORDER.flatMap((completedView) =>
    viewOptions.filter((option) => option.view === completedView),
  );
  const visibleCompletedActionOptions = completedActionOptions.filter(
    (option) => option.view === view || (viewCounts.get(option.view) ?? 0) > 0,
  );
  const emptyCompletedActionOptions = completedActionOptions.filter(
    (option) => option.view !== view && (viewCounts.get(option.view) ?? 0) === 0,
  );
  const completedHistoryOptions = viewOptions.filter((option) =>
    COMPLETED_HISTORY_VIEWS.has(option.view),
  );
  const primaryViewOptions = isRecordsWorkspace
    ? recordViewOptions
    : isPostMatchCancellationWorkspace
      ? viewOptions
      : preferredPrimaryViewOptions.length > 0
        ? preferredPrimaryViewOptions
        : visibleViewOptions.slice(0, 1);
  const additionalViewOptions = isPostMatchCancellationWorkspace ? [] : visibleViewOptions.filter(
    (option) => !primaryViewOptions.some((primaryOption) => primaryOption.view === option.view),
  );
  const emptyAdditionalViewOptions = viewOptions.filter(
    (option) =>
      !PRIMARY_BOOKING_VIEWS.has(option.view) &&
      option.view !== 'all' &&
      option.view !== view &&
      (viewCounts.get(option.view) ?? 0) === 0,
  );
  const visibleDateRangeOptions = dateRangeFilterOptions.filter((option) => option.value !== 'all');
  const showCustomDateRange = dateRangeFilter === 'custom';
  const showCancellationReasonFilter = cancellationReasonFilterOptions.length > 0;
  const currentViewCount = viewCounts.get(view) ?? baseVisibleBookingCount;
  const resultTone = isCompletedWorkspace
    ? COMPLETED_HISTORY_VIEWS.has(view)
      ? ('neutral' as const)
      : currentViewCount > 0
        ? ('warning' as const)
        : ('success' as const)
    : bookingQueueResultTone(view, currentViewCount);
  const activePeriodLabel =
    dateRangeFilter === 'custom'
      ? customDateFrom && customDateTo
        ? `${customDateFrom} to ${customDateTo}`
        : 'Custom dates'
      : dateRangeFilterOptions.find((option) => option.value === dateRangeFilter)?.label ?? 'Today';
  const recordCount = currentViewCount;

  return (
    <AdminTablePanel
      actions={
        isRecordsWorkspace ? (
          <AdminFormControlLink className="button-secondary" href="/bookings">
            Back to live bookings
          </AdminFormControlLink>
        ) : undefined
      }
      className={
        isCompletedWorkspace
          ? 'booking-completed-filter-panel'
          : isPostMatchCancellationWorkspace
            ? 'booking-post-match-filter-panel'
            : undefined
      }
      description={
        isRecordsWorkspace
          ? `Historical · ${activePeriodLabel} · ${adminCountLabel(recordCount, 'record')} · Audit fixtures excluded`
          : activeView.operatorHint
      }
      id="booking-operation-filters"
      resultTone={resultTone}
      title={isRecordsWorkspace ? 'Booking records' : title}
    >
      {!isRecordsWorkspace && !isPostMatchCancellationWorkspace && !isCompletedWorkspace && (
        <div className="booking-monitor-queue-scope">
          <strong>Work now</strong>
          <span>Resolve Needs action first.</span>
          <strong>Monitor</strong>
          <span>Live, matching, and in-service views can overlap.</span>
        </div>
      )}
      {isCompletedWorkspace ? (
        <div className="booking-completed-queue-groups">
          <div aria-labelledby="booking-completed-action-queues" role="group">
            <h3 id="booking-completed-action-queues">Needs action</h3>
            {visibleCompletedActionOptions.length > 0 ? (
              <AdminSegmentedControl
                activeValue={view}
                ariaLabel="Closeout action queues"
                className="booking-monitor-view-options"
                options={bookingViewControlOptions(
                  visibleCompletedActionOptions,
                  viewCounts,
                  viewHrefFor,
                  onViewChange,
                )}
              />
            ) : (
              <AdminInlineNotice tone="success">No closeout checks need action.</AdminInlineNotice>
            )}
          </div>
          <div aria-labelledby="booking-completed-history-queues" role="group">
            <h3 id="booking-completed-history-queues">History</h3>
            <AdminSegmentedControl
              activeValue={view}
              ariaLabel="Closeout history"
              className="booking-monitor-view-options"
              options={bookingViewControlOptions(
                completedHistoryOptions,
                viewCounts,
                viewHrefFor,
                onViewChange,
              )}
            />
          </div>
          <p className="muted booking-closeout-queue-overlap-note">
            Counts overlap: All payment exceptions includes the cash and refund queues.
          </p>
          {showEmptyViewOptions && emptyCompletedActionOptions.length > 0 && (
            <AdminDisclosure ariaLabel="Empty closeout checks">
              <summary>
                <span>
                  Show {emptyCompletedActionOptions.length} empty{' '}
                  {emptyCompletedActionOptions.length === 1 ? 'check' : 'checks'}
                </span>
                <small>No records currently need these checks</small>
              </summary>
              <div className="admin-disclosure-content">
                <AdminSegmentedControl
                  activeValue={view}
                  ariaLabel="Empty closeout checks"
                  className="booking-monitor-view-options"
                  options={bookingViewControlOptions(
                    emptyCompletedActionOptions,
                    viewCounts,
                    viewHrefFor,
                    onViewChange,
                  )}
                />
              </div>
            </AdminDisclosure>
          )}
        </div>
      ) : (
        <AdminSegmentedControl
          activeValue={view}
          ariaLabel={isRecordsWorkspace ? 'Records outcome' : 'Primary booking queues'}
          className="booking-monitor-view-options booking-monitor-primary-queues"
          options={bookingViewControlOptions(primaryViewOptions, viewCounts, viewHrefFor, onViewChange)}
        />
      )}

      <AdminFormShell
        className="admin-filter-form booking-monitor-search-form admin-mt-14"
        action={dateRangeFormAction}
        method="get"
      >
            {dateRangeHiddenInputs
              .filter(
                ([key]) =>
                  !['page', 'q'].includes(key) &&
                  key !== 'cancellationReason',
              )
              .map(([key, value], index) => (
                <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
              ))}
            <AdminFormSearch
              className="admin-form-control-fluid"
              defaultValue={searchQuery}
              label="Search bookings"
              name="q"
              placeholder="Booking ID, customer, Partner, or address"
            />
            {showCancellationReasonFilter && (
              <AdminFormSelect
                className="admin-form-control-fluid"
                defaultValue={cancellationReasonFilter}
                label="Cancellation reason"
                labelVisibility="visible"
                name="cancellationReason"
                options={cancellationReasonFilterOptions}
              />
            )}
            <AdminFormControlButton className="button-primary">
              {showCancellationReasonFilter ? 'Apply filters' : 'Search'}
            </AdminFormControlButton>
            {(hasActiveFilters || searchQuery) && (
              <AdminFormControlLink
                className="button-secondary"
                href={hasActiveFilters ? filterResetHref : searchClearHref}
              >
                {hasActiveFilters ? 'Reset filters' : 'Clear'}
              </AdminFormControlLink>
            )}
      </AdminFormShell>
      {showDateRange && (
        <div className="booking-date-filter-bar admin-mt-14" aria-label="Booking list date range">
              <span className="payment-filter-group-label">
                {isRecordsWorkspace ? 'Report period' : dateRangeLabel}
              </span>
              <AdminSegmentedControl
                activeValue={dateRangeFilter}
                ariaLabel="Booking list period"
                options={visibleDateRangeOptions.map((option) => ({
                  href:
                    option.value === 'custom'
                      ? dateRangeHrefFor(dateRangeFilter)
                      : dateRangeHrefFor(option.value),
                  label: option.label,
                  onClick: (event) => {
                    if (option.value === 'custom') event.preventDefault();
                    onDateRangeFilterChange(option.value);
                  },
                  value: option.value,
                }))}
              />
              {showCustomDateRange && (
                <AdminFormShell
                  className="booking-custom-date-grid"
                  action={dateRangeFormAction}
                  aria-describedby={customDateError ? 'booking-custom-date-error' : undefined}
                  method="get"
                  noValidate
                  onSubmit={onCustomDateSubmit}
                >
                  {dateRangeHiddenInputs
                    .filter(([key]) => !['dateRange', 'dateFrom', 'dateTo', 'page'].includes(key))
                    .map(([key, value], index) => (
                      <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
                    ))}
                  <input type="hidden" name="dateRange" value="custom" />
                  <AdminFormDate
                    ariaDescribedBy={customDateError ? 'booking-custom-date-error' : undefined}
                    ariaInvalid={Boolean(customDateError)}
                    className="admin-form-control-fluid"
                    label="Start date"
                    labelVisibility="visible"
                    name="dateFrom"
                    onChange={(event) => onCustomDateFromChange(event.target.value)}
                    required
                    value={customDateFrom}
                  />
                  <AdminFormDate
                    ariaDescribedBy={customDateError ? 'booking-custom-date-error' : undefined}
                    ariaInvalid={Boolean(customDateError)}
                    className="admin-form-control-fluid"
                    label="End date"
                    labelVisibility="visible"
                    name="dateTo"
                    onChange={(event) => onCustomDateToChange(event.target.value)}
                    required
                    value={customDateTo}
                  />
                  <div className="booking-custom-date-error-row">
                    {customDateError && (
                      <AdminInlineNotice
                        className="booking-custom-date-error"
                        id="booking-custom-date-error"
                        role="alert"
                        tone="danger"
                      >
                        {customDateError}
                      </AdminInlineNotice>
                    )}
                  </div>
                  <AdminFormControlButton className="button-primary booking-date-apply-button">
                    Apply dates
                  </AdminFormControlButton>
                </AdminFormShell>
              )}
        </div>
      )}
      {isRecordsWorkspace ? (
        <div className="booking-records-sort admin-mt-14" aria-label="Booking records order">
          <span className="payment-filter-group-label">Order</span>
          <AdminSegmentedControl
            activeValue={sort}
            ariaLabel="Booking records order"
            options={(queueSortOptions ?? ADMIN_QUEUE_SORT_OPTIONS).map((option) => ({
              href: sortHref(option.value),
              label: option.label,
              value: option.value,
            }))}
          />
        </div>
      ) : showQueueAge ? (
        <>
          <p className="sr-only" id="booking-age-filter-help">
            {queueAgeHelp}
          </p>
          <div aria-describedby="booking-age-filter-help" className="admin-mt-14">
            <AdminQueueAgeSortControls
              age={age}
              ageAriaLabel={isPostMatchCancellationWorkspace ? 'Cancellation decision age' : 'Booking request age'}
              ageCounts={ageCounts}
              ageHref={ageHref}
              ageLabel={queueAgeLabel}
              sla={queueSla}
              slaFilter={slaFilter}
              slaHref={slaHref}
              sort={sort}
              sortHref={sortHref}
              sortOptions={queueSortOptions}
            />
          </div>
        </>
      ) : null}
      {showAdditionalQueues && !isRecordsWorkspace && !isCompletedWorkspace && (additionalViewOptions.length > 0 ||
        (showEmptyViewOptions && emptyAdditionalViewOptions.length > 0)) && (
        <AdminDisclosure
          ariaLabel="Additional booking queues"
          className="admin-mt-14"
          open={additionalViewOptions.some((option) => option.view === view)}
        >
          <summary>
            <span>Additional queues</span>
            <small>Live flow, exceptions, and history</small>
          </summary>
          <div className="admin-disclosure-content booking-monitor-additional-queue-groups">
            {bookingAdditionalQueueGroups(additionalViewOptions).map((group) => (
              <div aria-labelledby={`booking-queue-group-${group.key}`} key={group.key} role="group">
                <h3 id={`booking-queue-group-${group.key}`}>{group.label}</h3>
                <AdminSegmentedControl
                  activeValue={view}
                  ariaLabel={`${group.label} booking queues`}
                  className="booking-monitor-view-options"
                  options={bookingViewControlOptions(group.options, viewCounts, viewHrefFor, onViewChange)}
                />
              </div>
            ))}
            {showEmptyViewOptions && emptyAdditionalViewOptions.length > 0 && (
              <AdminDisclosure ariaLabel="Empty booking queues">
                <summary>
                  <span>Show empty queues</span>
                  <small>{emptyAdditionalViewOptions.length} queues currently have no records</small>
                </summary>
                <div className="admin-disclosure-content booking-monitor-additional-queue-groups">
                  {bookingAdditionalQueueGroups(emptyAdditionalViewOptions).map((group) => (
                    <div
                      aria-labelledby={`booking-empty-queue-group-${group.key}`}
                      key={group.key}
                      role="group"
                    >
                      <h3 id={`booking-empty-queue-group-${group.key}`}>{group.label}</h3>
                      <AdminSegmentedControl
                        activeValue={view}
                        ariaLabel={`Empty ${group.label} booking queues`}
                        className="booking-monitor-view-options"
                        options={bookingViewControlOptions(
                          group.options,
                          viewCounts,
                          viewHrefFor,
                          onViewChange,
                        )}
                      />
                    </div>
                  ))}
                </div>
              </AdminDisclosure>
            )}
          </div>
        </AdminDisclosure>
      )}
    </AdminTablePanel>
  );
}

type BookingMonitorAdditionalQueuesSectionProps = {
  readonly onViewChange: (value: BookingPageView) => void;
  readonly view: BookingPageView;
  readonly viewCounts: ReadonlyMap<string, number>;
  readonly viewHrefFor: (value: BookingPageView) => string;
  readonly viewOptions: readonly BookingMonitorViewOption[];
};

const BOOKING_EXCEPTION_VIEWS = new Set<BookingPageView>([
  'matching-delays',
  'handoff-repair',
  'no-supply',
  'data-anomaly',
]);

export function BookingMonitorAdditionalQueuesSection({
  onViewChange,
  view,
  viewCounts,
  viewHrefFor,
  viewOptions,
}: BookingMonitorAdditionalQueuesSectionProps) {
  const exceptionOptions = viewOptions.filter(
    (option) =>
      BOOKING_EXCEPTION_VIEWS.has(option.view) &&
      ((viewCounts.get(option.view) ?? 0) > 0 || option.view === view),
  );
  const creationFailure = viewOptions.find((option) => option.view === 'blocked-create');
  const creationFailureCount = viewCounts.get('blocked-create') ?? 0;
  const directoryOptions = viewOptions.filter(
    (option) =>
      !PRIMARY_BOOKING_VIEWS.has(option.view) &&
      !BOOKING_RECORD_VIEWS.has(option.view) &&
      option.view !== 'blocked-create',
  );

  return (
    <AdminTablePanel
      actions={(
        <AdminFormControlLink className="button-secondary" href={viewHrefFor('all')}>
          Booking records
        </AdminFormControlLink>
      )}
      description="Only non-zero exception queues are promoted here."
      id="booking-additional-exceptions"
      title="Additional exceptions"
    >
      {exceptionOptions.length > 0 ? (
        <AdminSegmentedControl
          activeValue={view}
          ariaLabel="Additional booking exceptions"
          className="booking-monitor-view-options"
          options={bookingViewControlOptions(exceptionOptions, viewCounts, viewHrefFor, onViewChange)}
        />
      ) : (
        <AdminInlineNotice tone="success">No additional exceptions.</AdminInlineNotice>
      )}

      {creationFailure && creationFailureCount > 0 && (
        <AdminInlineNotice className="admin-mt-14" tone="warning">
          <strong>Creation failures today: {creationFailureCount}</strong>{' '}
          <AdminFormControlLink href={viewHrefFor('blocked-create')}>
            Review failures
          </AdminFormControlLink>
        </AdminInlineNotice>
      )}

      <AdminDisclosure ariaLabel="Browse booking queue directory" className="admin-mt-14">
        <summary>
          <span>Browse queue directory</span>
          <small>Stage views and inactive exceptions</small>
        </summary>
        <div className="admin-disclosure-content">
          <AdminSegmentedControl
            activeValue={view}
            ariaLabel="Booking queue directory"
            className="booking-monitor-view-options booking-monitor-queue-directory"
            options={bookingViewControlOptions(directoryOptions, viewCounts, viewHrefFor, onViewChange)}
          />
        </div>
      </AdminDisclosure>
    </AdminTablePanel>
  );
}

function bookingViewControlOptions(
  options: readonly BookingMonitorViewOption[],
  viewCounts: ReadonlyMap<string, number>,
  viewHrefFor: (value: BookingPageView) => string,
  onViewChange: (value: BookingPageView) => void,
) {
  return options.map((option) => ({
    href: viewHrefFor(option.view),
    ariaLabel: `${option.label}, ${adminCountLabel(viewCounts.get(option.view) ?? 0, 'booking')}`,
    label: `${option.label} ${viewCounts.get(option.view) ?? 0}`,
    onClick: () => onViewChange(option.view),
    title: option.description,
    value: option.view,
  }));
}

const BOOKING_ADDITIONAL_QUEUE_GROUPS = [
  {
    key: 'live-flow',
    label: 'Live flow',
    views: new Set<BookingPageView>(['first-pick', 'marketplace', 'customer-choice', 'matched']),
  },
  {
    key: 'exceptions',
    label: 'Exceptions',
    views: new Set<BookingPageView>([
      'matching-delays',
      'no-supply',
      'handoff-repair',
      'data-anomaly',
      'blocked-create',
    ]),
  },
  {
    key: 'history',
    label: 'History',
    views: new Set<BookingPageView>([
      'pre-match-cancelled',
      'preferred-rejected',
      'preferred-no-response',
      'all',
    ]),
  },
] as const;

function bookingAdditionalQueueGroups(options: readonly BookingMonitorViewOption[]) {
  const assignedViews = new Set<BookingPageView>();
  const groups = BOOKING_ADDITIONAL_QUEUE_GROUPS.map((group) => {
    const groupOptions = options.filter((option) => group.views.has(option.view));
    groupOptions.forEach((option) => assignedViews.add(option.view));
    return { key: group.key, label: group.label, options: groupOptions };
  }).filter((group) => group.options.length > 0);
  const otherOptions = options.filter((option) => !assignedViews.has(option.view));

  return otherOptions.length > 0
    ? [...groups, { key: 'other', label: 'Other queues', options: otherOptions }]
    : groups;
}

const ACTION_QUEUE_VIEWS = new Set<BookingPageView>([
  'attention',
  'matching-delays',
  'handoff-repair',
  'no-supply',
  'data-anomaly',
  'blocked-create',
  'manual-decision',
]);

function bookingQueueResultTone(view: BookingPageView, count: number) {
  if (view === 'all') return 'neutral' as const;
  if (ACTION_QUEUE_VIEWS.has(view)) return count > 0 ? ('warning' as const) : ('success' as const);
  return view === 'active' || view === 'matching' || view === 'in-service'
    ? ('info' as const)
    : ('neutral' as const);
}

function noop() {
  // Optional handlers let focused unit tests render this component without wiring every control.
}

function defaultDateRangeHrefFor(value: BookingDateRangeFilter) {
  return `?dateRange=${value}`;
}

function defaultViewHrefFor(value: BookingPageView) {
  return `?view=${value}`;
}
