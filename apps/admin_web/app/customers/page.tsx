import Link from 'next/link';
import { AdminTableScroll } from '../../components/admin-data-table';
import { MetricCard } from '../../components/metric-card';
import { adminGet } from '../../lib/admin-api';
import type { AdminCustomer } from '../../lib/admin-api';
import { formatDateTime as formatDate, formatMoney } from '../../lib/admin-format';
import { buildCsvDataHref } from '../../lib/csv-export';
import { buildCustomerActiveFilters, buildCustomerFilters, customerSortLabel } from './customer-filters';
import {
  buildCustomerFilterSummary,
  buildCustomerRow,
  buildCustomerSummary,
  filterCustomerRows,
  sortCustomerRows,
} from './customer-list-model';
import { CustomersTableSection } from './customers-table-section';

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams?: CustomersPageSearchParams }) {
  const filters = buildCustomerFilters(searchParams ? await searchParams : {});
  const customers = await adminGet<AdminCustomer[]>('/admin/customers', []);
  const allRows = customers.map(buildCustomerRow);
  const rows = sortCustomerRows(filterCustomerRows(allRows, filters), filters.sort);
  const summary = buildCustomerSummary(rows);
  const recentActivityRows = rows.filter((row) => row.lastBookingAt || row.lastCompletedAt).slice(0, 8);
  const activeFilters = buildCustomerActiveFilters(filters);
  const filterSummary = buildCustomerFilterSummary(rows, allRows, summary, activeFilters.length);
  const customerListCsvHref = buildCsvDataHref(
    rows.map((row) => ({
      customer_id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      joined_at: row.joinedAt ?? '',
      recent_access_at: row.lastSeenAt ?? '',
      last_completed_work_at: row.lastCompletedAt ?? '',
      last_booking_at: row.lastBookingAt ?? '',
      booking_count: row.bookingCount,
      active_booking_count: row.activeBookings,
      open_matching_count: row.openMatchingBookings,
      first_pick_count: row.firstPickBookings,
      customer_choice_count: row.customerChoiceBookings,
      chat_missing_count: row.chatMissingBookings,
      address_snapshot_count: row.addressSnapshotBookings,
      completed_work_count: row.completedBookings,
      closed_booking_count: row.cancelledBookings,
      customer_closed_count: row.customerClosedBookings,
      admin_closed_count: row.adminClosedBookings,
      partner_closed_count: row.partnerClosedBookings,
      no_show_count: row.noShowBookings,
      captured_spend_vnd: row.capturedSpend,
      refund_amount_vnd: row.refundAmount,
      payment_count: row.paymentCount,
      address_count: row.addressCount,
      push_reachable: row.pushReachable,
      in_app_now: row.isLive,
      chat_room_count: row.chatRooms,
      payment_issue_count: row.paymentIssues,
      latest_session_device: row.latestSessionDevice,
      latest_session_platform: row.latestSessionPlatform,
      latest_session_ip: row.latestSessionIp,
      latest_session_app_version: row.latestSessionAppVersion,
      frequent_service: row.commonService,
      frequent_area: row.commonArea,
      repeated_partner: row.commonPartner,
      last_completed_partner: row.lastCompletedPartner,
      admin_memo_count: row.memoCount,
      latest_memo: row.latestMemoTitle,
      latest_memo_detail: row.latestMemoDetail,
    })),
    [
      'customer_id',
      'name',
      'phone',
      'email',
      'joined_at',
      'recent_access_at',
      'last_completed_work_at',
      'last_booking_at',
      'booking_count',
      'active_booking_count',
      'open_matching_count',
      'first_pick_count',
      'customer_choice_count',
      'chat_missing_count',
      'address_snapshot_count',
      'completed_work_count',
      'closed_booking_count',
      'customer_closed_count',
      'admin_closed_count',
      'partner_closed_count',
      'no_show_count',
      'captured_spend_vnd',
      'refund_amount_vnd',
      'payment_count',
      'address_count',
      'push_reachable',
      'in_app_now',
      'chat_room_count',
      'payment_issue_count',
      'latest_session_device',
      'latest_session_platform',
      'latest_session_ip',
      'latest_session_app_version',
      'frequent_service',
      'frequent_area',
      'repeated_partner',
      'last_completed_partner',
      'admin_memo_count',
      'latest_memo',
      'latest_memo_detail',
    ],
  );

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Customer Management</h1>
          <p className="muted">
            Customer activity board for profile, booking history, completed work, chat archives, wallet view,
            saved addresses, last app session state, and push reachability. This page records factual customer activity
            for operator review.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/bookings">
            Open bookings
          </Link>
          <Link className="text-link" href="/payments">
            Open payments
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/customers">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Name, phone, email, customer id" />
          </label>
          <label>
            Booking state
            <select name="booking" defaultValue={filters.booking}>
              <option value="">All</option>
              <option value="active">Active booking</option>
              <option value="completed">Completed work</option>
              <option value="closed">Closed booking</option>
              <option value="no-booking">No booking yet</option>
            </select>
          </label>
          <label>
            Booking flow
            <select name="bookingFlow" defaultValue={filters.bookingFlow}>
              <option value="">All</option>
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
          <label>
            App and push
            <select name="reachability" defaultValue={filters.reachability}>
              <option value="">All</option>
              <option value="in-app">In app now</option>
              <option value="push-ready">Push ready</option>
              <option value="no-push">No push device</option>
              <option value="no-session">No app session</option>
            </select>
          </label>
          <label>
            Address
            <select name="address" defaultValue={filters.address}>
              <option value="">All</option>
              <option value="saved">Saved address</option>
              <option value="missing">No saved address</option>
            </select>
          </label>
          <label>
            Payment
            <select name="payment" defaultValue={filters.payment}>
              <option value="">All</option>
              <option value="captured">Captured payment</option>
              <option value="issue">Payment follow-up</option>
              <option value="refund">Refund history</option>
              <option value="no-payment">No payment record</option>
            </select>
          </label>
          <label>
            Chat archive
            <select name="chat" defaultValue={filters.chat}>
              <option value="">All</option>
              <option value="has-chat">Has chat archive</option>
              <option value="no-chat">No chat archive</option>
            </select>
          </label>
          <label>
            Admin memo
            <select name="memo" defaultValue={filters.memo}>
              <option value="">All</option>
              <option value="has-memo">Has memo</option>
              <option value="no-memo">No memo</option>
            </select>
          </label>
          <label>
            Joined from
            <input type="date" name="joinedFrom" defaultValue={filters.joinedFrom} />
          </label>
          <label>
            Joined to
            <input type="date" name="joinedTo" defaultValue={filters.joinedTo} />
          </label>
          <label>
            Recent access
            <select name="seen" defaultValue={filters.seen}>
              <option value="">All</option>
              <option value="live">In app now</option>
              <option value="7d">Seen in 7 days</option>
              <option value="30d">Seen in 30 days</option>
              <option value="inactive-30d">No access 30 days</option>
              <option value="never">No app session</option>
            </select>
          </label>
          <label>
            Min bookings
            <input name="minBookings" defaultValue={filters.minBookings ?? ''} inputMode="numeric" />
          </label>
          <label>
            Min completed
            <input name="minCompleted" defaultValue={filters.minCompleted ?? ''} inputMode="numeric" />
          </label>
          <label>
            Min paid amount
            <input name="minSpend" defaultValue={filters.minSpend ?? ''} inputMode="numeric" />
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={filters.sort}>
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
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/customers">
              Clear filters
            </Link>
            <a
              className="text-link"
              download={`hands-customers-${filters.sort}.csv`}
              href={customerListCsvHref}
            >
              Export CSV
            </a>
            <span className="muted">
              Showing {rows.length} of {allRows.length} customer row(s)
            </span>
          </div>
          {activeFilters.length > 0 ? (
            <div className="participant-list full-span">
              <span className="pill pill-info">Active filters</span>
              {activeFilters.map((filter) => (
                <span className="pill pill-warn" key={filter}>
                  {filter}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted full-span">
              No customer filter is active. Use filters when support needs one customer, one booking state, or
              missing contact/location information.
            </p>
          )}
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Current filter summary</h2>
            <p className="muted">
              A factual snapshot of the customer rows currently loaded on this page before export or follow-up
              work.
            </p>
          </div>
          <span className="pill pill-info">{filters.sort ? customerSortLabel(filters.sort) : 'Default'}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {filterSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small className="muted">{item.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Customers" value={summary.total.toString()} helper="Total customer profiles" />
        <MetricCard
          label="Joined recently"
          value={summary.recentJoins.toString()}
          helper="New accounts in 30 days"
        />
        <MetricCard
          label="In app now"
          value={summary.live.toString()}
          helper="Latest session under 30 minutes"
        />
        <MetricCard
          label="Active bookings"
          value={summary.activeBookings.toString()}
          helper="Needs live ops attention"
        />
        <MetricCard
          label="Completed work"
          value={summary.completedBookings.toString()}
          helper="Finished service records"
        />
        <MetricCard
          label="Last work"
          value={summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : 'None'}
          helper="Newest completed service"
        />
        <MetricCard
          label="Closed bookings"
          value={summary.cancelledBookings.toString()}
          helper="Cancelled, expired, or refunded records"
        />
        <MetricCard
          label="Saved addresses"
          value={summary.addresses.toString()}
          helper="Saved or selected locations"
        />
        <MetricCard
          label="Captured spend"
          value={formatMoney(summary.capturedSpend)}
          helper="Captured customer payments"
        />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer activity board</h2>
            <p className="muted">
              Recent customer activity by booking, completed work, payment, chat archive, address, and
              reachability.
            </p>
          </div>
          <span className="pill pill-info">{recentActivityRows.length} recent</span>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Last booking</span>
            <strong>{summary.latestBookingAt ? formatDate(summary.latestBookingAt) : 'None'}</strong>
            <small className="muted">Newest customer activity</small>
          </div>
          <div>
            <span>Push reachable</span>
            <strong>{summary.pushReachable}</strong>
            <small className="muted">Enabled device token exists</small>
          </div>
          <div>
            <span>Refund records</span>
            <strong>{formatMoney(summary.refundAmount)}</strong>
            <small className="muted">Refund rows in loaded history</small>
          </div>
          <div>
            <span>Chat traces</span>
            <strong>{summary.chatRooms}</strong>
            <small className="muted">Rooms connected to bookings</small>
          </div>
          <div>
            <span>No saved address</span>
            <strong>{summary.missingAddress}</strong>
            <small className="muted">Profile has no stored address row</small>
          </div>
          <div>
            <span>Payment issues</span>
            <strong>{summary.paymentIssues}</strong>
            <small className="muted">Pending, failed, released, or refunded</small>
          </div>
        </div>
        {recentActivityRows.length > 0 ? (
          <AdminTableScroll>
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Activity</th>
                  <th>Last completed work</th>
                  <th>Last booking</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentActivityRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <p className="muted">{row.phone}</p>
                    </td>
                    <td>{row.activityLabel}</td>
                    <td>{row.lastCompletedAt ? formatDate(row.lastCompletedAt) : 'No completed work yet'}</td>
                    <td>{row.lastBookingAt ? formatDate(row.lastBookingAt) : 'No booking'}</td>
                    <td>
                      <Link className="text-link" href={`/customers/${row.id}`}>
                        Open customer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        ) : (
          <p className="muted" style={{ marginTop: 14 }}>
            No customer booking activity has been recorded yet.
          </p>
        )}
      </section>

      <CustomersTableSection rows={rows} sortLabel={customerSortLabel(filters.sort)} />
    </>
  );
}
