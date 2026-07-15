import { AdminFormControlButton, AdminFormDate, AdminFormShell } from '../../components/admin-form-controls';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTablePanel } from '../../components/admin-table-panel';
import type { BookingDateRangeFilter } from './booking-date-range-filter';
import type { BookingPageView } from './booking-page-params';

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

type BookingMonitorViewCategoryKey =
  | 'realtime'
  | 'completed'
  | 'postMatchCancellations'
  | 'archive';

type BookingMonitorViewCategory = {
  readonly description: string;
  readonly key: BookingMonitorViewCategoryKey;
  readonly title: string;
};

type BookingMonitorFiltersSectionProps = {
  readonly activeView: BookingMonitorViewOption;
  readonly baseVisibleBookingCount: number;
  readonly customDateFrom?: string;
  readonly customDateTo?: string;
  readonly dateRangeFormAction?: string;
  readonly dateRangeFilter?: BookingDateRangeFilter;
  readonly dateRangeHiddenInputs?: readonly (readonly [string, string])[];
  readonly dateRangeHrefFor?: (value: BookingDateRangeFilter) => string;
  readonly dateRangeFilterOptions?: readonly BookingMonitorDateRangeFilterOption[];
  readonly onCustomDateFromChange?: (value: string) => void;
  readonly onCustomDateToChange?: (value: string) => void;
  readonly onDateRangeFilterChange?: (value: BookingDateRangeFilter) => void;
  readonly onViewChange: (value: BookingPageView) => void;
  readonly showEmptyViewOptions?: boolean;
  readonly view: BookingPageView;
  readonly viewCounts: ReadonlyMap<string, number>;
  readonly viewOptions: readonly BookingMonitorViewOption[];
  readonly visibleBookingCount: number;
};

const bookingMonitorViewCategories: readonly BookingMonitorViewCategory[] = [
  {
    key: 'realtime',
    title: 'Live / Today',
    description: 'Current request, matching, Partner handoff, address, location, and chat repair queues.',
  },
  {
    key: 'completed',
    title: 'Closeout / Today',
    description: 'Completed, payment, cash debt, pricing, refund, and expired booking closeout queues.',
  },
  {
    key: 'postMatchCancellations',
    title: 'Cancellation Review',
    description: 'Cancellation approval, no-show, evidence, and manual decision queues needing review.',
  },
  {
    key: 'archive',
    title: 'Records / Audit',
    description: 'Full booking history for investigation, retained evidence, and audit review.',
  },
];

const bookingMonitorViewCategoryByView: Record<BookingPageView, BookingMonitorViewCategoryKey> = {
  active: 'realtime',
  address: 'realtime',
  all: 'archive',
  attention: 'realtime',
  'blocked-create': 'realtime',
  'cash-debt': 'completed',
  chat: 'realtime',
  'chat-evidence': 'postMatchCancellations',
  'chat-repair': 'realtime',
  closeout: 'completed',
  'customer-choice': 'realtime',
  'evidence-missing': 'postMatchCancellations',
  expired: 'completed',
  'first-pick': 'realtime',
  'handoff-repair': 'realtime',
  location: 'realtime',
  'manual-decision': 'postMatchCancellations',
  marketplace: 'realtime',
  matching: 'realtime',
  'no-show': 'postMatchCancellations',
  'no-supply': 'realtime',
  payment: 'completed',
  'post-match-cancellations': 'postMatchCancellations',
  pricing: 'completed',
  'refund-review': 'completed',
};

export function BookingMonitorFiltersSection({
  activeView,
  baseVisibleBookingCount,
  customDateFrom = '',
  customDateTo = '',
  dateRangeFormAction = '/bookings',
  dateRangeFilter = 'today',
  dateRangeHiddenInputs = [],
  dateRangeHrefFor = defaultDateRangeHrefFor,
  dateRangeFilterOptions = [],
  onCustomDateFromChange = noop,
  onCustomDateToChange = noop,
  onDateRangeFilterChange = noop,
  onViewChange,
  showEmptyViewOptions = false,
  view,
  viewCounts,
  viewOptions,
  visibleBookingCount,
}: BookingMonitorFiltersSectionProps) {
  const visibleViewOptions = viewOptions.filter(
    (option) =>
      showEmptyViewOptions ||
      option.view === view || option.view === 'all' || (viewCounts.get(option.view) ?? 0) > 0,
  );
  const categorizedViewOptions = bookingMonitorViewCategories
    .map((category) => ({
      category,
      options: visibleViewOptions.filter(
        (option) => bookingMonitorViewCategoryByView[option.view] === category.key,
      ),
    }))
    .filter(({ options }) => options.length > 0);
  const visibleDateRangeOptions = dateRangeFilterOptions.filter((option) => option.value !== 'all');
  const showCustomDateRange = dateRangeFilter === 'custom';
  const activeCategory = bookingMonitorViewCategories.find(
    (category) => category.key === bookingMonitorViewCategoryByView[view],
  );
  const hiddenEmptyLaneCount = viewOptions.filter(
    (option) =>
      option.view !== view &&
      option.view !== 'all' &&
      (viewCounts.get(option.view) ?? 0) === 0,
  ).length;
  const filterSummaryLabels = bookingMonitorFilterSummaryLabels({
    activeCategoryTitle: activeCategory?.title,
    activeViewLabel: activeView.label,
    baseVisibleBookingCount,
    customDateFrom,
    customDateTo,
    dateRangeFilter,
    dateRangeFilterOptions,
    hiddenEmptyLaneCount,
    visibleBookingCount,
  });

  return (
    <AdminTablePanel
      description={(
        <>
          Current workspace: <strong>{activeView.label}</strong> - {activeView.description}
        </>
      )}
      id="booking-operation-filters"
      resultLabel={`Showing ${visibleBookingCount} of ${baseVisibleBookingCount}`}
      resultTone={view === 'all' ? 'success' : 'warning'}
      title="Booking workspace filters"
      footer={<p className="muted">{activeView.operatorHint}</p>}
    >
      <AdminFilterSummary
        ariaLabel="Active booking operation filters"
        labels={filterSummaryLabels}
        tone={view === 'all' ? 'success' : 'info'}
      />
      <div className="booking-date-filter-bar admin-mb-14" aria-label="Booking list date range">
        <AdminSegmentedControl
          activeValue={dateRangeFilter}
          ariaLabel="Booking list period"
          options={visibleDateRangeOptions.map((option) => ({
            href: dateRangeHrefFor(option.value),
            label: option.label,
            onClick: () => onDateRangeFilterChange(option.value),
            value: option.value,
          }))}
        />
        {showCustomDateRange && (
          <AdminFormShell className="booking-custom-date-grid" action={dateRangeFormAction} method="get">
            {dateRangeHiddenInputs
              .filter(([key]) => !['dateRange', 'dateFrom', 'dateTo'].includes(key))
              .map(([key, value], index) => (
                <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
              ))}
            <input type="hidden" name="dateRange" value="custom" />
            <AdminFormDate
              className="admin-form-control-fluid"
              label="Custom date from"
              name="dateFrom"
              onChange={(event) => onCustomDateFromChange(event.target.value)}
              value={customDateFrom}
            />
            <AdminFormDate
              className="admin-form-control-fluid"
              label="Custom date to"
              name="dateTo"
              onChange={(event) => onCustomDateToChange(event.target.value)}
              value={customDateTo}
            />
            <AdminFormControlButton className="button-primary booking-date-apply-button">
              Apply dates
            </AdminFormControlButton>
          </AdminFormShell>
        )}
      </div>
      <div className="booking-monitor-view-categories" aria-label="Booking operation categories">
        {categorizedViewOptions.map(({ category, options }) => (
          <fieldset className="booking-monitor-view-category" key={category.key}>
            <legend className="booking-monitor-view-category-heading">
              <div className="booking-monitor-view-category-title-row">
                <span>{category.title}</span>
                <span className="booking-monitor-view-category-count">
                  {bookingMonitorCategoryBookingCount(options, viewCounts)} total
                </span>
              </div>
              <p>{category.description}</p>
            </legend>
            <AdminSegmentedControl
              activeValue={view}
              ariaLabel={`${category.title} booking views`}
              className="booking-monitor-view-options"
              options={options.map((option) => ({
                href: '#booking-operation-filters',
                label: `${option.label} · ${viewCounts.get(option.view) ?? 0}`,
                onClick: (event) => {
                  event.preventDefault();
                  onViewChange(option.view);
                },
                title: option.description,
                value: option.view,
              }))}
            />
          </fieldset>
        ))}
      </div>
    </AdminTablePanel>
  );
}

function noop() {
  // Optional handlers let focused unit tests render this component without wiring every control.
}

function defaultDateRangeHrefFor(value: BookingDateRangeFilter) {
  return `?dateRange=${value}`;
}

function bookingMonitorCategoryBookingCount(
  options: readonly BookingMonitorViewOption[],
  viewCounts: ReadonlyMap<string, number>,
) {
  return options.reduce((total, option) => total + (viewCounts.get(option.view) ?? 0), 0);
}

function bookingMonitorFilterSummaryLabels({
  activeCategoryTitle,
  activeViewLabel,
  baseVisibleBookingCount,
  customDateFrom,
  customDateTo,
  dateRangeFilter,
  dateRangeFilterOptions,
  hiddenEmptyLaneCount,
  visibleBookingCount,
}: {
  readonly activeCategoryTitle?: string;
  readonly activeViewLabel: string;
  readonly baseVisibleBookingCount: number;
  readonly customDateFrom: string;
  readonly customDateTo: string;
  readonly dateRangeFilter: BookingDateRangeFilter;
  readonly dateRangeFilterOptions: readonly BookingMonitorDateRangeFilterOption[];
  readonly hiddenEmptyLaneCount: number;
  readonly visibleBookingCount: number;
}) {
  const dateLabel = bookingMonitorDateRangeSummaryLabel({
    customDateFrom,
    customDateTo,
    dateRangeFilter,
    dateRangeFilterOptions,
  });
  const labels = [
    `Queue: ${activeViewLabel}`,
    `Period: ${dateLabel}`,
    `Showing: ${visibleBookingCount}/${baseVisibleBookingCount}`,
  ];

  if (activeCategoryTitle) {
    labels.push(`Workspace: ${activeCategoryTitle}`);
  }

  if (hiddenEmptyLaneCount > 0) {
    labels.push(`${hiddenEmptyLaneCount} empty lanes hidden`);
  }

  return labels;
}

function bookingMonitorDateRangeSummaryLabel({
  customDateFrom,
  customDateTo,
  dateRangeFilter,
  dateRangeFilterOptions,
}: {
  readonly customDateFrom: string;
  readonly customDateTo: string;
  readonly dateRangeFilter: BookingDateRangeFilter;
  readonly dateRangeFilterOptions: readonly BookingMonitorDateRangeFilterOption[];
}) {
  if (dateRangeFilter === 'custom') {
    return customDateFrom && customDateTo ? `${customDateFrom} to ${customDateTo}` : 'Custom dates';
  }

  return dateRangeFilterOptions.find((option) => option.value === dateRangeFilter)?.label ?? dateRangeFilter;
}
