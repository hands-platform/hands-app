import Link from 'next/link';
import { ChevronDown, Download, Search } from 'lucide-react';
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
    <section className="vuexy-customer-filter-card card admin-mb-16" aria-labelledby="customer-directory-controls">
      <div className="vuexy-customer-toolbar">
        <div>
          <h2 id="customer-directory-controls">Filters</h2>
        </div>
        <div className="participant-list">
          <span className="pill pill-info">{filteredCount} of {totalCount}</span>
        </div>
      </div>

      <form action="/customers" className="vuexy-customer-form">
        <input name="sort" type="hidden" value={filters.sort} />
        <div className="vuexy-customer-form-primary">
          <label className="vuexy-customer-select">
            <span className="sr-only">Completed reservations</span>
            <select defaultValue={filters.booking} name="booking">
              <option value="">All bookings</option>
              <option value="completed">Completed work</option>
              <option value="active">Active booking</option>
              <option value="closed">Closed booking</option>
              <option value="no-booking">No booking yet</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label className="vuexy-customer-select">
            <span className="sr-only">Wallet state</span>
            <select defaultValue={filters.payment} name="payment">
              <option value="">All wallet</option>
              <option value="captured">Captured payment</option>
              <option value="refund">Refund history</option>
              <option value="issue">Payment follow-up</option>
              <option value="no-payment">No payment record</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label className="vuexy-customer-select">
            <span className="sr-only">Last login state</span>
            <select defaultValue={filters.seen} name="seen">
              <option value="">All logins</option>
              <option value="live">In app now</option>
              <option value="7d">Seen in 7 days</option>
              <option value="30d">Seen in 30 days</option>
              <option value="no-session">No app session</option>
              <option value="inactive-30d">No access 30 days</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label className="vuexy-customer-search">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search customer</span>
            <input defaultValue={filters.q} name="q" placeholder="Search Customer" type="search" />
          </label>
          <a className="vuexy-customer-export" download="hands-customers.csv" href={csvHref}>
            <Download aria-hidden="true" size={16} />
            Export
          </a>
          <button className="vuexy-customer-button" type="submit">
            Apply
          </button>
        </div>
      </form>

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
    </section>
  );
}
