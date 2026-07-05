import { AdminFormControlButton, AdminFormDate } from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
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
    title: 'Realtime Bookings',
    description: 'Live request, matching, Partner handoff, address, location, and chat repair views.',
  },
  {
    key: 'completed',
    title: 'Completed',
    description: 'Closeout, payment, cash debt, pricing, refund, and expired booking review views.',
  },
  {
    key: 'postMatchCancellations',
    title: 'Post-match Cancellations',
    description: 'Cancellation approval, evidence, no-show, and manual decision review views.',
  },
  {
    key: 'archive',
    title: 'Archive',
    description: 'Full booking history for investigation and audit review.',
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

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description={(
        <>
          Active queue: <strong>{activeView.label}</strong> - {activeView.description}
        </>
      )}
      id="booking-operation-filters"
      resultLabel={`Showing ${visibleBookingCount} of ${baseVisibleBookingCount}`}
      resultTone={view === 'all' ? 'success' : 'warning'}
      title="Booking operation filters"
      footer={<p className="muted">{activeView.operatorHint}</p>}
    >
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
          <form className="booking-custom-date-grid" action={dateRangeFormAction} method="get">
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
          </form>
        )}
      </div>
      <div className="booking-monitor-view-categories" aria-label="Booking operation categories">
        {categorizedViewOptions.map(({ category, options }) => (
          <section className="booking-monitor-view-category" key={category.key}>
            <div className="booking-monitor-view-category-heading">
              <h3>{category.title}</h3>
              <p>{category.description}</p>
            </div>
            <div className="participant-list">
              {options.map((option) => (
                <button
                  key={option.view}
                  type="button"
                  onClick={() => onViewChange(option.view)}
                  disabled={view === option.view}
                  title={option.description}
                >
                  {option.label} ({viewCounts.get(option.view) ?? 0})
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminFilterPanel>
  );
}

function noop() {
  // Optional handlers let focused unit tests render this component without wiring every control.
}

function defaultDateRangeHrefFor(value: BookingDateRangeFilter) {
  return `?dateRange=${value}`;
}
