import Link from 'next/link';
import { Download, Search, SlidersHorizontal } from 'lucide-react';
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
          <h2 id="customer-directory-controls">Customer directory controls</h2>
          <p>
            Search customer profile, booking stage, payment trail, chat archive, app reachability, and
            operator memo in one filter board.
          </p>
        </div>
        <div className="participant-list">
          <span className="pill pill-info">
            {filteredCount} of {totalCount} customers
          </span>
          <span className="pill pill-neutral">
            <SlidersHorizontal aria-hidden="true" size={14} />
            Ops filters
          </span>
        </div>
      </div>

      <form action="/customers" className="vuexy-customer-form">
        <div className="vuexy-customer-form-primary">
          <label className="vuexy-customer-search">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search customer</span>
            <input defaultValue={filters.q} name="q" placeholder="Search customer" type="search" />
          </label>
          <label className="vuexy-customer-select">
            <span className="sr-only">Booking state</span>
            <select defaultValue={filters.booking} name="booking">
              <option value="">All bookings</option>
              <option value="active">Active booking</option>
              <option value="completed">Completed work</option>
              <option value="closed">Closed booking</option>
              <option value="no-booking">No booking yet</option>
            </select>
          </label>
          <label className="vuexy-customer-select">
            <span className="sr-only">Booking flow</span>
            <select defaultValue={filters.bookingFlow} name="bookingFlow">
              <option value="">All flow</option>
              <option value="open-matching">Open matching wait</option>
              <option value="first-pick">First-pick pending</option>
              <option value="customer-choice">Customer final choice</option>
              <option value="chat-live">Chat room opened</option>
              <option value="chat-missing">Matched but chat missing</option>
              <option value="service-live">Service in progress</option>
              <option value="completed-work">Completed work</option>
              <option value="closed-record">Closed or no-show record</option>
              <option value="address-snapshot">Address snapshot saved</option>
            </select>
          </label>
          <label className="vuexy-customer-select">
            <span className="sr-only">App and push</span>
            <select defaultValue={filters.reachability} name="reachability">
              <option value="">All reachability</option>
              <option value="in-app">In app now</option>
              <option value="push-ready">Push ready</option>
              <option value="no-push">No push device</option>
              <option value="no-session">No app session</option>
            </select>
          </label>
          <button className="vuexy-customer-button" type="submit">
            Apply
          </button>
          <Link className="vuexy-customer-button is-ghost" href="/customers">
            Clear
          </Link>
          <a className="vuexy-customer-export" download="hands-customers.csv" href={csvHref}>
            <Download aria-hidden="true" size={16} />
            Export
          </a>
        </div>

        <div className="vuexy-customer-advanced-grid">
          <label>
            Address
            <select defaultValue={filters.address} name="address">
              <option value="">All</option>
              <option value="saved">Saved address</option>
              <option value="missing">No saved address</option>
            </select>
          </label>
          <label>
            Payment
            <select defaultValue={filters.payment} name="payment">
              <option value="">All</option>
              <option value="captured">Captured payment</option>
              <option value="issue">Payment follow-up</option>
              <option value="refund">Refund history</option>
              <option value="no-payment">No payment record</option>
            </select>
          </label>
          <label>
            Chat archive
            <select defaultValue={filters.chat} name="chat">
              <option value="">All</option>
              <option value="has-chat">Has chat archive</option>
              <option value="no-chat">No chat archive</option>
            </select>
          </label>
          <label>
            Admin memo
            <select defaultValue={filters.memo} name="memo">
              <option value="">All</option>
              <option value="has-memo">Has memo</option>
              <option value="no-memo">No memo</option>
            </select>
          </label>
          <label>
            Recent access
            <select defaultValue={filters.seen} name="seen">
              <option value="">All</option>
              <option value="live">In app now</option>
              <option value="7d">Seen in 7 days</option>
              <option value="30d">Seen in 30 days</option>
              <option value="inactive-30d">No access 30 days</option>
              <option value="never">No app session</option>
            </select>
          </label>
          <label>
            Joined from
            <input defaultValue={filters.joinedFrom} name="joinedFrom" type="date" />
          </label>
          <label>
            Joined to
            <input defaultValue={filters.joinedTo} name="joinedTo" type="date" />
          </label>
          <label>
            Min bookings
            <input defaultValue={filters.minBookings ?? ''} inputMode="numeric" name="minBookings" />
          </label>
          <label>
            Min completed
            <input defaultValue={filters.minCompleted ?? ''} inputMode="numeric" name="minCompleted" />
          </label>
          <label>
            Min paid amount
            <input defaultValue={filters.minSpend ?? ''} inputMode="numeric" name="minSpend" />
          </label>
          <label>
            Sort
            <select defaultValue={filters.sort} name="sort">
              <option value="last-booking">Last booking</option>
              <option value="last-work">Last completed work</option>
              <option value="booking-count">Booking count</option>
              <option value="completed-count">Completed work count</option>
              <option value="captured-spend">Captured spend</option>
              <option value="last-seen">Last app session</option>
              <option value="joined">First signup</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </form>

      <div className="vuexy-customer-filter-footer">
        {activeFilters.length > 0 ? (
          <>
            <span className="pill pill-info">Active filters</span>
            {activeFilters.map((filter) => (
              <span className="pill pill-warn" key={filter}>
                {filter}
              </span>
            ))}
          </>
        ) : (
          <p className="muted">
            No filters are active. Use this board when support needs one customer segment, one booking
            state, or missing device and address follow-up.
          </p>
        )}
      </div>
    </section>
  );
}
