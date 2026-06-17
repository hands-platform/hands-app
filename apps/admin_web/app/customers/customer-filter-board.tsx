import Link from 'next/link';
import { Download } from 'lucide-react';
import {
  AdminFormControlButton,
  AdminFormControlLink,
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
      footer={(
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
      )}
    >
      <form action="/customers" className="vuexy-customer-form">
        <input name="sort" type="hidden" value={filters.sort} />
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
          <AdminFormSearch
            className="vuexy-customer-search"
            defaultValue={filters.q}
            label="Search customer"
            name="q"
            placeholder="Search Customer"
          />
          <AdminFormControlLink className="vuexy-customer-export" download="hands-customers.csv" href={csvHref}>
            <Download aria-hidden="true" size={16} />
            Export
          </AdminFormControlLink>
          <AdminFormControlButton className="vuexy-customer-button">
            Apply
          </AdminFormControlButton>
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
