import { Download } from 'lucide-react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { StatusBadge } from '../../components/status-badge';
import { buildCustomerListHref, type CustomerFilters } from './customer-filters';

type CustomerFilterBoardProps = {
  readonly activeFilters: readonly string[];
  readonly csvHref: string;
  readonly filters: CustomerFilters;
  readonly filteredCount: number;
  readonly totalCount: number;
};

export function CustomerFilterBoard({
  activeFilters,
  csvHref,
  filters,
  filteredCount,
  totalCount,
}: CustomerFilterBoardProps) {
  return (
    <AdminFilterPanel
      className="vuexy-customer-filter-card admin-mb-16"
      id="customer-directory-controls"
      resultLabel={`${filteredCount} of ${totalCount}`}
      title="Filters"
      footer={
        <div className="vuexy-customer-filter-footer admin-directory-filter-footer">
          {activeFilters.length > 0 ? (
            <>
              {activeFilters.map((filter) => (
                <StatusBadge key={filter} tone="warning">
                  {filter}
                </StatusBadge>
              ))}
            </>
          ) : (
            <AdminFormControlLink className="admin-directory-filter-button is-ghost" href="/customers">
              Clear filters
            </AdminFormControlLink>
          )}
        </div>
      }
    >
      <AdminDirectoryFilterForm action="/customers" className="vuexy-customer-form">
        <input name="pageSize" type="hidden" value={filters.pageSize} />
        <div className="vuexy-customer-filter-grid admin-directory-filter-grid">
          <div className="vuexy-customer-filter-group admin-directory-filter-group is-primary" aria-label="Customer list filters">
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.country}
              label="Country"
              name="country"
              options={countryFilterOptions}
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={filters.gender}
              label="Gender"
              name="gender"
              options={genderFilterOptions}
            />
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search customer"
              name="q"
              placeholder="Search Customer"
            />
          </div>
          <div className="vuexy-customer-filter-actions admin-directory-filter-actions" aria-label="Customer filter actions">
            <AdminFormControlLink
              className="admin-directory-filter-export"
              download="hands-customers.csv"
              href={csvHref}
            >
              <Download aria-hidden="true" size={16} />
              Export
            </AdminFormControlLink>
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </div>
        </div>
        <div className="vuexy-customer-date-filter-grid" aria-label="Customer date filters">
          <CustomerDateButtonGroup
            filters={filters}
            fromKey="joinedFrom"
            fromLabel="Sign-up from"
            label="Sign-up Date"
            rangeKey="joinedRange"
            toKey="joinedTo"
            toLabel="Sign-up to"
          />
          <CustomerDateButtonGroup
            filters={filters}
            fromKey="lastBookingFrom"
            fromLabel="Last reservation from"
            label="Last Reservation"
            rangeKey="lastBookingRange"
            toKey="lastBookingTo"
            toLabel="Last reservation to"
          />
          <CustomerDateButtonGroup
            filters={filters}
            fromKey="lastLoginFrom"
            fromLabel="Last login from"
            label="Last Login Date"
            rangeKey="lastLoginRange"
            toKey="lastLoginTo"
            toLabel="Last login to"
          />
          <CustomerReservationSortGroup filters={filters} />
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

type CustomerDateRangeKey = 'joinedRange' | 'lastBookingRange' | 'lastLoginRange';
type CustomerDateValueKey =
  | 'joinedFrom'
  | 'joinedTo'
  | 'lastBookingFrom'
  | 'lastBookingTo'
  | 'lastLoginFrom'
  | 'lastLoginTo';

type CustomerDateButtonGroupProps = {
  readonly filters: CustomerFilters;
  readonly fromKey: CustomerDateValueKey;
  readonly fromLabel: string;
  readonly label: string;
  readonly rangeKey: CustomerDateRangeKey;
  readonly toKey: CustomerDateValueKey;
  readonly toLabel: string;
};

function CustomerDateButtonGroup({
  filters,
  fromKey,
  fromLabel,
  label,
  rangeKey,
  toKey,
  toLabel,
}: CustomerDateButtonGroupProps) {
  const activeRange = filters[rangeKey];
  const showCustomDateRange = activeRange === 'custom';

  return (
    <div className="booking-date-filter-bar vuexy-customer-date-filter-group">
      <span className="vuexy-customer-filter-group-label">{label}</span>
      <input name={rangeKey} type="hidden" value={activeRange} />
      <div className="booking-date-filter-buttons vuexy-customer-date-buttons" role="group" aria-label={label}>
        {customerDateRangeButtonOptions.map((option) => (
          <a
            key={option.value}
            aria-current={activeRange === option.value ? 'page' : undefined}
            className={activeRange === option.value ? 'is-active' : undefined}
            href={buildCustomerListHref(filters, { [rangeKey]: option.value } as Partial<CustomerFilters>)}
          >
            {option.label}
          </a>
        ))}
      </div>
      {showCustomDateRange && (
        <div className="booking-custom-date-grid vuexy-customer-custom-date-grid">
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={customerCustomDateValue(activeRange, filters[fromKey])}
            label={fromLabel}
            name={fromKey}
          />
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={customerCustomDateValue(activeRange, filters[toKey])}
            label={toLabel}
            name={toKey}
          />
          <AdminFormControlButton className="button-primary booking-date-apply-button">
            Apply dates
          </AdminFormControlButton>
        </div>
      )}
    </div>
  );
}

function CustomerReservationSortGroup({ filters }: { readonly filters: CustomerFilters }) {
  return (
    <div className="booking-date-filter-bar vuexy-customer-date-filter-group is-compact">
      <span className="vuexy-customer-filter-group-label">Reservation Count</span>
      <div
        className="booking-date-filter-buttons vuexy-customer-date-buttons"
        role="group"
        aria-label="Reservation count sort"
      >
        {reservationCountSortOptions.map((option) => (
          <a
            key={option.value}
            aria-current={filters.sort === option.value ? 'page' : undefined}
            className={filters.sort === option.value ? 'is-active' : undefined}
            href={buildCustomerListHref(filters, { sort: option.value })}
          >
            {option.label}
          </a>
        ))}
      </div>
    </div>
  );
}

const countryFilterOptions = [
  { label: 'All countries', value: '' },
  { label: 'Vietnam', value: 'VN' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Japan', value: 'JP' },
  { label: 'China', value: 'CN' },
  { label: 'Singapore', value: 'SG' },
  { label: 'Unknown country', value: 'UNKNOWN' },
] as const;

const genderFilterOptions = [
  { label: 'All genders', value: '' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Other', value: 'other' },
  { label: 'Not captured', value: 'unknown' },
] as const;

const customerDateRangeButtonOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Previous day', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last month', value: '30d' },
  { label: 'Custom dates', value: 'custom' },
] as const;

const reservationCountSortOptions = [
  { label: 'Many first', value: 'booking-count' },
  { label: 'Few first', value: 'booking-count-asc' },
] as const;

function customerCustomDateValue(range: string, value: string) {
  return !range || range === 'custom' ? value : '';
}
