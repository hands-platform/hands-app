'use client';

import { useState, type FormEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure } from '../../components/admin-surface';
import {
  buildCustomerListHref,
  customerViewLabel,
  customerViewTotal,
  type CustomerFilters,
  type CustomerView,
  type CustomerViewCounts,
} from './customer-filters';

type CustomerFilterBoardProps = {
  readonly activeFilters: readonly string[];
  readonly filters: CustomerFilters;
  readonly viewCounts: CustomerViewCounts;
};

export function CustomerFilterBoard({ activeFilters, filters, viewCounts }: CustomerFilterBoardProps) {
  const [dateRange, setDateRange] = useState(filters.dateRange);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const customDateError = customerCustomDateError(dateRange, dateFrom, dateTo);
  const advancedFilterCount = [filters.country, filters.gender, dateRange].filter(Boolean).length;
  const showAdvancedFilters = advancedFilterCount > 0;
  const clearHref = buildCustomerListHref(filters, {
    country: '',
    dateFrom: '',
    dateRange: '',
    dateTo: '',
    gender: '',
    page: 1,
    q: '',
    segment: '',
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (customDateError) event.preventDefault();
  }

  return (
    <AdminFilterPanel
      className="vuexy-customer-filter-card admin-mb-16"
      description={`Current queue: ${customerViewLabel(filters.view)}. Search by identity or narrow the customer segment.`}
      id="customer-directory-controls"
      title="Customer filters"
      footer={
        activeFilters.length > 0 ? (
          <div className="vuexy-customer-filter-footer admin-directory-filter-footer">
            <AdminFilterSummary
              ariaLabel="Active customer filters"
              className="vuexy-customer-active-filters"
              labels={activeFilters}
            />
            <AdminFormControlLink className="admin-directory-filter-button is-ghost" href={clearHref}>
              Clear filters
            </AdminFormControlLink>
          </div>
        ) : undefined
      }
    >
      <div className="vuexy-customer-view-bar" aria-label="Customer operational views">
        <span className="vuexy-customer-filter-group-label">Operational view</span>
        <AdminSegmentedControl
          activeValue={filters.view}
          ariaLabel="Customer operational view"
          className="vuexy-customer-view-buttons"
          options={customerViewOptions.map((view) => ({
            ariaLabel: `${customerViewLabel(view.value)}, ${customerViewTotal(view.value, viewCounts, 0)} customers`,
            href: buildCustomerListHref(filters, { view: view.value }),
            label: `${customerViewLabel(view.value)} ${customerViewTotal(view.value, viewCounts, 0)}`,
            value: view.value,
          }))}
        />
      </div>

      <AdminDirectoryFilterForm action="/customers" className="vuexy-customer-form" onSubmit={handleSubmit}>
        <input name="pageSize" type="hidden" value={filters.pageSize} />
        <input name="view" type="hidden" value={filters.view} />

        <div className="vuexy-customer-filter-grid admin-directory-filter-grid">
          <div
            className="vuexy-customer-filter-group admin-directory-filter-group is-primary"
            aria-label="Customer directory filters"
          >
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search customer"
              name="q"
              placeholder="Name, phone, email, customer ID"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.segment}
              label="Customer segment"
              name="segment"
              options={customerSegmentOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.sort}
              label="Sort customers"
              name="sort"
              options={customerSortOptions}
            />
          </div>
          <div
            className="vuexy-customer-filter-actions admin-directory-filter-actions"
            aria-label="Customer filter actions"
          >
            <AdminFormControlButton
              className="admin-directory-filter-button"
              disabled={Boolean(customDateError)}
            >
              Apply filters
            </AdminFormControlButton>
          </div>
        </div>

        <AdminDisclosure className="vuexy-customer-filter-details" open={showAdvancedFilters}>
          <summary>
            <span>
              <SlidersHorizontal aria-hidden="true" size={16} />
              More filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
            </span>
            <small>Session activity period, recorded app language, and profile attributes</small>
          </summary>
          <div className="vuexy-customer-advanced-filter-grid">
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.dateField}
              label="Date field"
              name="dateField"
              options={customerDateFieldOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              label="Period"
              name="dateRange"
              onChange={(event) => setDateRange(event.target.value as CustomerFilters['dateRange'])}
              options={customerDateRangeOptions}
              value={dateRange}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.country}
              label="Recorded app language"
              name="country"
              options={appLocaleFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.gender}
              label="Gender"
              name="gender"
              options={genderFilterOptions}
            />
          </div>
          {dateRange === 'custom' ? (
            <div
              aria-describedby={customDateError ? 'customer-custom-date-error' : undefined}
              className="vuexy-customer-custom-date-wrap"
            >
              <div className="vuexy-customer-custom-date-grid">
                <AdminFormDate
                  ariaDescribedBy={customDateError ? 'customer-custom-date-error' : undefined}
                  ariaInvalid={Boolean(customDateError)}
                  className="vuexy-customer-date-field"
                  label="From"
                  labelVisibility="visible"
                  name="dateFrom"
                  native
                  onChange={(event) => setDateFrom(event.target.value)}
                  required
                  value={dateFrom}
                />
                <AdminFormDate
                  ariaDescribedBy={customDateError ? 'customer-custom-date-error' : undefined}
                  ariaInvalid={Boolean(customDateError)}
                  className="vuexy-customer-date-field"
                  label="To"
                  labelVisibility="visible"
                  name="dateTo"
                  native
                  onChange={(event) => setDateTo(event.target.value)}
                  required
                  value={dateTo}
                />
              </div>
              {customDateError ? (
                <p className="vuexy-customer-date-error" id="customer-custom-date-error" role="alert">
                  {customDateError}
                </p>
              ) : null}
            </div>
          ) : null}
        </AdminDisclosure>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

const customerViewOptions: ReadonlyArray<{ value: CustomerView }> = [
  { value: 'needs-action' },
  { value: 'all' },
  { value: 'new-today' },
  { value: 'active-today' },
];

const customerSegmentOptions = [
  { label: 'All customer segments', value: '' },
  { label: 'Never booked', value: 'never-booked' },
  { label: 'Has booking history', value: 'has-bookings' },
  { label: 'Completed customers', value: 'completed' },
  { label: 'Cancellation / no-show history', value: 'cancellation-risk' },
  { label: 'Inactive 30 days', value: 'inactive-30d' },
] as const;

const customerDateFieldOptions = [
  { label: 'Session activity period', value: 'last-login' },
  { label: 'Joined date', value: 'joined' },
  { label: 'Last booking activity', value: 'last-booking' },
] as const;

const customerSortOptions = [
  { label: 'Newest customers', value: 'newest' },
  { label: 'Customer name', value: 'name' },
  { label: 'Most bookings', value: 'booking-count' },
] as const;

const customerDateRangeOptions = [
  { label: 'All dates', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Previous day', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Custom dates', value: 'custom' },
] as const;

const appLocaleFilterOptions = [
  { label: 'All app languages', value: '' },
  { label: 'Vietnamese', value: 'VI' },
  { label: 'Korean', value: 'KO' },
  { label: 'Japanese', value: 'JA' },
  { label: 'Chinese', value: 'ZH' },
  { label: 'English', value: 'EN' },
  { label: 'Unknown language', value: 'UNKNOWN' },
] as const;

const genderFilterOptions = [
  { label: 'All genders', value: '' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Other', value: 'other' },
  { label: 'Not captured', value: 'unknown' },
] as const;

function customerCustomDateError(range: CustomerFilters['dateRange'], from: string, to: string) {
  if (range !== 'custom') return '';
  if (!from || !to) return 'Choose a start and end date.';
  if (from > to) return 'Start date must be on or before end date.';
  return '';
}
