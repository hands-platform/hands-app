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
      <div className="participant-list">
        {visibleViewOptions.map((option) => (
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
    </AdminFilterPanel>
  );
}
