import Link from 'next/link';
import { Download } from 'lucide-react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import type { CustomerFilters } from './customer-filters';

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
        <div className="vuexy-customer-filter-footer">
          {activeFilters.length > 0 ? (
            <>
              {activeFilters.map((filter) => (
                <span className="pill pill-warn" key={filter}>
                  {filter}
                </span>
              ))}
            </>
          ) : (
            <Link className="vuexy-customer-button is-ghost" href="/customers">
              Clear filters
            </Link>
          )}
        </div>
      }
    >
      <form action="/customers" className="vuexy-customer-form">
        <input name="pageSize" type="hidden" value={filters.pageSize} />
        <div className="vuexy-customer-form-primary">
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.booking}
            label="Completed reservations"
            name="booking"
            options={bookingFilterOptions}
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.country}
            label="Country"
            name="country"
            options={countryFilterOptions}
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.gender}
            label="Gender"
            name="gender"
            options={genderFilterOptions}
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.payment}
            label="Wallet state"
            name="payment"
            options={paymentFilterOptions}
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.seen}
            label="Last login state"
            name="seen"
            options={seenFilterOptions}
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.sort}
            label="Sort customers"
            name="sort"
            options={sortFilterOptions}
          />
          <AdminFormSearch
            className="vuexy-customer-search"
            defaultValue={filters.q}
            label="Search customer"
            name="q"
            placeholder="Search Customer"
          />
          <AdminFormControlLink
            className="vuexy-customer-export"
            download="hands-customers.csv"
            href={csvHref}
          >
            <Download aria-hidden="true" size={16} />
            Export
          </AdminFormControlLink>
          <AdminFormControlButton className="vuexy-customer-button">Apply</AdminFormControlButton>
        </div>
        <div className="vuexy-customer-advanced-grid">
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.joinedRange}
            label="Sign-up date"
            name="joinedRange"
            options={dateRangeFilterOptions('Sign-up')}
          />
          <AdminFormDate
            className="vuexy-customer-date"
            defaultValue={customerCustomDateValue(filters.joinedRange, filters.joinedFrom)}
            label="Sign-up from"
            name="joinedFrom"
          />
          <AdminFormDate
            className="vuexy-customer-date"
            defaultValue={customerCustomDateValue(filters.joinedRange, filters.joinedTo)}
            label="Sign-up to"
            name="joinedTo"
          />
          <AdminFormSelect
            className="vuexy-customer-select"
            defaultValue={filters.lastBookingRange}
            label="Last reservation"
            name="lastBookingRange"
            options={dateRangeFilterOptions('Last reservation')}
          />
          <AdminFormDate
            className="vuexy-customer-date"
            defaultValue={customerCustomDateValue(filters.lastBookingRange, filters.lastBookingFrom)}
            label="Last reservation from"
            name="lastBookingFrom"
          />
          <AdminFormDate
            className="vuexy-customer-date"
            defaultValue={customerCustomDateValue(filters.lastBookingRange, filters.lastBookingTo)}
            label="Last reservation to"
            name="lastBookingTo"
          />
          <label className="vuexy-customer-number-field">
            <span className="sr-only">Minimum reservations</span>
            <input
              defaultValue={filters.minBookings ?? ''}
              min="0"
              name="minBookings"
              placeholder="Min reservations"
              type="number"
            />
          </label>
        </div>
      </form>
    </AdminFilterPanel>
  );
}

const bookingFilterOptions = [
  { label: 'All bookings', value: '' },
  { label: 'Completed work', value: 'completed' },
  { label: 'Active booking', value: 'active' },
  { label: 'Closed booking', value: 'closed' },
  { label: 'No booking yet', value: 'no-booking' },
] as const;

const countryFilterOptions = [
  { label: 'All countries', value: '' },
  { label: 'Vietnam', value: 'VN' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Japan', value: 'JP' },
  { label: 'China', value: 'CN' },
  { label: 'Singapore', value: 'SG' },
  { label: 'Thailand', value: 'TH' },
  { label: 'United States', value: 'US' },
  { label: 'Unknown country', value: 'UNKNOWN' },
] as const;

const genderFilterOptions = [
  { label: 'All genders', value: '' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Other', value: 'other' },
  { label: 'Not captured', value: 'unknown' },
] as const;

const paymentFilterOptions = [
  { label: 'All wallet', value: '' },
  { label: 'Captured payment', value: 'captured' },
  { label: 'Refund history', value: 'refund' },
  { label: 'Payment follow-up', value: 'issue' },
  { label: 'No payment record', value: 'no-payment' },
] as const;

const seenFilterOptions = [
  { label: 'All logins', value: '' },
  { label: 'In app now', value: 'live' },
  { label: 'Seen in 7 days', value: '7d' },
  { label: 'Seen in 30 days', value: '30d' },
  { label: 'No app session', value: 'no-session' },
  { label: 'No access 30 days', value: 'inactive-30d' },
] as const;

const sortFilterOptions = [
  { label: 'Latest reservation', value: 'last-booking' },
  { label: 'Most reservations', value: 'booking-count' },
  { label: 'Last completed work', value: 'last-work' },
  { label: 'Completed count', value: 'completed-count' },
  { label: 'Last login', value: 'last-seen' },
  { label: 'Sign-up date', value: 'joined' },
  { label: 'Customer name', value: 'name' },
] as const;

function dateRangeFilterOptions(prefix: string) {
  return [
    { label: `${prefix}: All`, value: '' },
    { label: `${prefix}: Today`, value: 'today' },
    { label: `${prefix}: Yesterday`, value: 'yesterday' },
    { label: `${prefix}: Last 7 days`, value: '7d' },
    { label: `${prefix}: Specific period`, value: 'custom' },
  ] as const;
}

function customerCustomDateValue(range: string, value: string) {
  return !range || range === 'custom' ? value : '';
}
