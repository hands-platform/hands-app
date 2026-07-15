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
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
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
      description="Separate today activity, reservation risk, customer segments, and history without loading every record."
      id="customer-directory-controls"
      resultLabel={`${filteredCount} visible / ${totalCount} total`}
      title="Customer operations filters"
      footer={
        <div className="vuexy-customer-filter-footer admin-directory-filter-footer">
          <AdminFilterSummary
            ariaLabel="Active customer filters"
            className="vuexy-customer-active-filters"
            labels={activeFilters}
          />
          <AdminFormControlLink className="admin-directory-filter-button is-ghost" href="/customers">
            Clear filters
          </AdminFormControlLink>
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
            label="Sign-up records"
            rangeKey="joinedRange"
            toKey="joinedTo"
            toLabel="Sign-up to"
          />
          <CustomerDateButtonGroup
            filters={filters}
            fromKey="lastBookingFrom"
            fromLabel="Last reservation from"
            label="Reservation risk / history"
            rangeKey="lastBookingRange"
            toKey="lastBookingTo"
            toLabel="Last reservation to"
          />
          <CustomerDateButtonGroup
            filters={filters}
            fromKey="lastLoginFrom"
            fromLabel="Last login from"
            label="Today active / login history"
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
      <AdminSegmentedControl
        activeValue={activeRange}
        ariaLabel={label}
        className="vuexy-customer-date-buttons"
        options={customerDateRangeButtonOptions.map((option) => ({
          href: buildCustomerListHref(filters, { [rangeKey]: option.value } as Partial<CustomerFilters>),
          label: option.label,
          value: option.value,
        }))}
      />
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
      <span className="vuexy-customer-filter-group-label">Customer segments / history sort</span>
      <AdminSegmentedControl
        activeValue={filters.sort}
        ariaLabel="Reservation count sort"
        className="vuexy-customer-date-buttons"
        options={reservationCountSortOptions.map((option) => ({
          href: buildCustomerListHref(filters, { sort: option.value }),
          label: option.label,
          value: option.value,
        }))}
      />
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
  { label: 'All dates', value: '' },
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
