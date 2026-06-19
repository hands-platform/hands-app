import { X } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';

export type BookingMonitorViewOption = {
  readonly description: string;
  readonly label: string;
  readonly operatorHint: string;
  readonly view: BookingPageView;
};

export type BookingMonitorEvidenceFilterOption = {
  readonly label: string;
  readonly value: BookingEvidenceFilter;
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
  readonly evidenceFilter: BookingEvidenceFilter;
  readonly evidenceFilterOptions: readonly BookingMonitorEvidenceFilterOption[];
  readonly onClearFilters: () => void;
  readonly onEvidenceFilterChange: (value: BookingEvidenceFilter) => void;
  readonly onPaymentFilterChange: (value: string) => void;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onStatusFilterChange: (value: string) => void;
  readonly onViewChange: (value: BookingPageView) => void;
  readonly paymentFilter: string;
  readonly paymentFilterOptions: readonly string[];
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly statusFilterOptions: readonly string[];
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
  evidenceFilter,
  evidenceFilterOptions,
  onClearFilters,
  onEvidenceFilterChange,
  onPaymentFilterChange,
  onSearchQueryChange,
  onStatusFilterChange,
  onViewChange,
  paymentFilter,
  paymentFilterOptions,
  searchQuery,
  statusFilter,
  statusFilterOptions,
  view,
  viewCounts,
  viewOptions,
  visibleBookingCount,
}: BookingMonitorFiltersSectionProps) {
  const visibleViewOptions = viewOptions.filter(
    (option) =>
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

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16"
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
      <div className="ops-filter-grid admin-mb-14">
        <AdminFormSearch
          className="booking-monitor-search"
          label="Search booking/customer/Partner"
          name="bookingSearch"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Booking ID, phone, Partner, customer, service"
          value={searchQuery}
        />
        <AdminFormSelect
          className="booking-monitor-select"
          label="Booking status"
          name="bookingStatus"
          onChange={(event) => onStatusFilterChange(event.target.value)}
          options={[
            { label: 'All statuses', value: 'all' },
            ...statusFilterOptions.map((status) => ({ label: status, value: status })),
          ]}
          value={statusFilter}
        />
        <AdminFormSelect
          className="booking-monitor-select"
          label="Payment method"
          name="paymentMethod"
          onChange={(event) => onPaymentFilterChange(event.target.value)}
          options={[
            { label: 'All methods', value: 'all' },
            ...paymentFilterOptions.map((method) => ({ label: method, value: method })),
          ]}
          value={paymentFilter}
        />
        <AdminFormSelect
          className="booking-monitor-select"
          label="Evidence filter"
          name="evidenceFilter"
          onChange={(event) => onEvidenceFilterChange(event.target.value as BookingEvidenceFilter)}
          options={evidenceFilterOptions}
          value={evidenceFilter}
        />
        <div className="actions ops-filter-actions">
          <AdminFormControlButton
            className="booking-monitor-clear"
            type="button"
            onClick={onClearFilters}
          >
            <X aria-hidden="true" size={16} />
            Clear list filters
          </AdminFormControlButton>
        </div>
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
