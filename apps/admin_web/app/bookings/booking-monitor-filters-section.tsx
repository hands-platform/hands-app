import { X } from 'lucide-react';

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
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking operation filters</h2>
          <p className="muted">
            Active queue: <strong>{activeView.label}</strong> - {activeView.description}
          </p>
        </div>
        <span className={`pill ${view === 'all' ? 'pill-success' : 'pill-warn'}`}>
          Showing {visibleBookingCount} of {baseVisibleBookingCount}
        </span>
      </div>
      <div className="ops-filter-grid admin-mb-14">
        <label>
          Search booking/customer/Partner
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Booking ID, phone, Partner, customer, service"
          />
        </label>
        <label>
          Booking status
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">All statuses</option>
            {statusFilterOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment method
          <select value={paymentFilter} onChange={(event) => onPaymentFilterChange(event.target.value)}>
            <option value="all">All methods</option>
            {paymentFilterOptions.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <label>
          Evidence filter
          <select
            value={evidenceFilter}
            onChange={(event) => onEvidenceFilterChange(event.target.value as BookingEvidenceFilter)}
          >
            {evidenceFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="actions ops-filter-actions">
          <button className="button button-secondary" type="button" onClick={onClearFilters}>
            <X aria-hidden="true" size={16} />
            Clear list filters
          </button>
        </div>
      </div>
      <div className="participant-list">
        {viewOptions.map((option) => (
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
      <p className="muted admin-mt-8">{activeView.operatorHint}</p>
    </section>
  );
}
