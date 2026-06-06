import Link from 'next/link';
import { MetricCard } from '../../components/metric-card';
import { AdminCustomer, adminGet } from '../../lib/admin-api';
import { formatDateTime as formatDate, formatMoney } from '../../lib/admin-format';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';

const ACTIVE_STATUSES = [
  'CREATED',
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
];
const CLOSED_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type CustomerFilters = {
  q: string;
  booking: string;
  bookingFlow: string;
  reachability: string;
  address: string;
  payment: string;
  chat: string;
  memo: string;
  sort: string;
  joinedFrom: string;
  joinedTo: string;
  seen: string;
  minBookings: number | null;
  minCompleted: number | null;
  minSpend: number | null;
};

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
            saved addresses, app sessions, and push reachability. This page records factual customer activity for
            operator review.
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
          <table className="table" style={{ marginTop: 14 }}>
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
        ) : (
          <p className="muted" style={{ marginTop: 14 }}>
            No customer booking activity has been recorded yet.
          </p>
        )}
      </section>

      <section className="card">
        <div className="ops-section-header">
          <div>
            <h2>All customers</h2>
            <p className="muted">
              List view sorted by {customerSortLabel(filters.sort)}. Open a row to see all customer details.
            </p>
          </div>
          <span className="pill pill-info">{rows.length} rows</span>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Customer ID</th>
                <th>Phone / email</th>
                <th>Joined</th>
                <th>Recent access</th>
                <th>Last work</th>
                <th>Bookings</th>
                <th>Completed</th>
                <th>Frequent service / area</th>
                <th>Repeated partner</th>
                <th>Closed / no-show</th>
                <th>Total paid</th>
                <th>Device / IP</th>
                <th>Ops trail</th>
                <th>Memo</th>
                <th>Addresses</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <p className="muted">First signup: {formatDate(row.joinedAt)}</p>
                  </td>
                  <td>
                    <code>{row.id}</code>
                  </td>
                  <td>
                    <strong>{row.phone}</strong>
                    <p className="muted">{row.email}</p>
                  </td>
                  <td>{formatDate(row.joinedAt)}</td>
                  <td>
                    <strong>{row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}</strong>
                    <p className="muted">{row.isLive ? 'In app now' : 'Not live'}</p>
                  </td>
                  <td>
                    <strong>
                      {row.lastCompletedAt ? formatDate(row.lastCompletedAt) : 'No completed work'}
                    </strong>
                    <p className="muted">{row.lastCompletedLabel}</p>
                  </td>
                  <td>
                    <strong>{row.bookingCount}</strong>
                    <p className="muted">
                      {row.activeBookings} active / last{' '}
                      {row.lastBookingAt ? formatDate(row.lastBookingAt) : 'none'}
                    </p>
                  </td>
                  <td>
                    <strong>{row.completedBookings}</strong>
                    <p className="muted">{row.lastCompletedPartner}</p>
                  </td>
                  <td>
                    <strong>{row.commonService}</strong>
                    <p className="muted">{row.commonArea}</p>
                  </td>
                  <td>
                    <strong>{row.commonPartner}</strong>
                    <p className="muted">Repeated selected or preferred partner</p>
                  </td>
                  <td>
                    <strong>{row.cancelledBookings}</strong>
                    <p className="muted">
                      Customer {row.customerClosedBookings} / admin {row.adminClosedBookings} / partner{' '}
                      {row.partnerClosedBookings}
                    </p>
                    <p className="muted">{row.noShowBookings} no-show</p>
                  </td>
                  <td>
                    <strong>{formatMoney(row.capturedSpend)}</strong>
                    <p className="muted">{formatMoney(row.refundAmount)} refunded</p>
                  </td>
                  <td>
                    <strong>{row.latestSessionDevice}</strong>
                    <p className="muted">{row.latestSessionIp}</p>
                  </td>
                  <td>
                    <strong>{row.chatRooms} chat room(s)</strong>
                    <p className="muted">
                      {row.paymentIssues} payment follow-up / {row.memoCount} memo(s)
                    </p>
                  </td>
                  <td>
                    <strong>{row.latestMemoTitle}</strong>
                    <p className="muted">{row.latestMemoDetail}</p>
                  </td>
                  <td>{row.addressCount}</td>
                  <td>
                    <Link className="text-link" href={`/customers/${row.id}`}>
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={17}>
                    <strong>No customers found</strong>
                    <p className="muted">Change the filters or clear search to view customer records.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function buildCustomerFilters(params: Record<string, string | string[] | undefined>): CustomerFilters {
  return {
    q: readSearchParam(params.q),
    booking: readSearchParam(params.booking),
    bookingFlow: normalizeCustomerBookingFlowFilter(readSearchParam(params.bookingFlow)),
    reachability: readSearchParam(params.reachability),
    address: readSearchParam(params.address),
    payment: readSearchParam(params.payment),
    chat: readSearchParam(params.chat),
    memo: readSearchParam(params.memo),
    sort: readCustomerSort(params.sort),
    joinedFrom: readDateParam(params.joinedFrom),
    joinedTo: readDateParam(params.joinedTo),
    seen: readSearchParam(params.seen),
    minBookings: readPositiveNumber(params.minBookings),
    minCompleted: readPositiveNumber(params.minCompleted),
    minSpend: readPositiveNumber(params.minSpend),
  };
}

function readCustomerSort(value: string | string[] | undefined) {
  const sort = readSearchParam(value);
  return [
    'last-booking',
    'last-work',
    'booking-count',
    'completed-count',
    'captured-spend',
    'last-seen',
    'joined',
    'name',
  ].includes(sort)
    ? sort
    : 'last-booking';
}

function readDateParam(value: string | string[] | undefined) {
  const date = readSearchParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function readPositiveNumber(value: string | string[] | undefined) {
  const raw = readSearchParam(value).replaceAll(',', '');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizeCustomerBookingFlowFilter(value: string) {
  const allowed = [
    'open-matching',
    'first-pick',
    'customer-choice',
    'chat-live',
    'chat-missing',
    'service-live',
    'completed-work',
    'closed-record',
    'address-snapshot',
  ];
  return allowed.includes(value) ? value : '';
}

function customerBookingFlowFilterLabel(flow: string) {
  const labels: Record<string, string> = {
    'open-matching': 'Open matching wait',
    'first-pick': 'First-pick pending',
    'customer-choice': 'Customer final choice',
    'chat-live': 'Chat room opened',
    'chat-missing': 'Matched but chat missing',
    'service-live': 'Service in progress',
    'completed-work': 'Completed work',
    'closed-record': 'Closed or no-show record',
    'address-snapshot': 'Address snapshot saved',
  };
  return labels[flow] ?? flow;
}

function customerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'booking count';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'captured-spend') return 'captured spend';
  if (sort === 'last-seen') return 'last app session';
  if (sort === 'joined') return 'first signup date';
  if (sort === 'name') return 'customer name';
  return 'latest booking progress date';
}

function filterCustomerRows(rows: ReturnType<typeof buildCustomerRow>[], filters: CustomerFilters) {
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (
      query &&
      ![
        row.name,
        row.phone,
        row.email,
        row.id,
        row.commonService,
        row.commonArea,
        row.commonPartner,
        row.latestMemoTitle,
        row.latestMemoDetail,
      ].some((value) => value.toLowerCase().includes(query))
    ) {
      return false;
    }
    if (filters.booking === 'active' && row.activeBookings === 0) return false;
    if (filters.booking === 'completed' && row.completedBookings === 0) return false;
    if (filters.booking === 'closed' && row.cancelledBookings === 0) return false;
    if (filters.booking === 'no-booking' && row.bookingCount > 0) return false;
    if (filters.bookingFlow === 'open-matching' && row.openMatchingBookings === 0) return false;
    if (filters.bookingFlow === 'first-pick' && row.firstPickBookings === 0) return false;
    if (filters.bookingFlow === 'customer-choice' && row.customerChoiceBookings === 0) return false;
    if (filters.bookingFlow === 'chat-live' && row.chatRooms === 0) return false;
    if (filters.bookingFlow === 'chat-missing' && row.chatMissingBookings === 0) return false;
    if (filters.bookingFlow === 'service-live' && row.serviceLiveBookings === 0) return false;
    if (filters.bookingFlow === 'completed-work' && row.completedBookings === 0) return false;
    if (filters.bookingFlow === 'closed-record' && row.cancelledBookings === 0) return false;
    if (filters.bookingFlow === 'address-snapshot' && row.addressSnapshotBookings === 0) return false;
    if (filters.reachability === 'in-app' && !row.isLive) return false;
    if (filters.reachability === 'push-ready' && !row.pushReachable) return false;
    if (filters.reachability === 'no-push' && row.pushReachable) return false;
    if (filters.reachability === 'no-session' && row.lastSeenAt) return false;
    if (filters.seen === 'live' && !row.isLive) return false;
    if (filters.seen === '7d' && !isWithinRecentDays(row.lastSeenAt, 7)) return false;
    if (filters.seen === '30d' && !isWithinRecentDays(row.lastSeenAt, 30)) return false;
    if (filters.seen === 'inactive-30d' && isWithinRecentDays(row.lastSeenAt, 30)) return false;
    if (filters.seen === 'never' && row.lastSeenAt) return false;
    if (filters.address === 'saved' && row.addressCount === 0) return false;
    if (filters.address === 'missing' && row.addressCount > 0) return false;
    if (filters.payment === 'captured' && row.capturedSpend <= 0) return false;
    if (filters.payment === 'issue' && row.paymentIssues === 0) return false;
    if (filters.payment === 'refund' && row.refundAmount <= 0) return false;
    if (filters.payment === 'no-payment' && row.paymentCount > 0) return false;
    if (filters.chat === 'has-chat' && row.chatRooms === 0) return false;
    if (filters.chat === 'no-chat' && row.chatRooms > 0) return false;
    if (filters.memo === 'has-memo' && row.memoCount === 0) return false;
    if (filters.memo === 'no-memo' && row.memoCount > 0) return false;
    if (filters.joinedFrom && !isOnOrAfterDate(row.joinedAt, filters.joinedFrom)) return false;
    if (filters.joinedTo && !isOnOrBeforeDate(row.joinedAt, filters.joinedTo)) return false;
    if (filters.minBookings !== null && row.bookingCount < filters.minBookings) return false;
    if (filters.minCompleted !== null && row.completedBookings < filters.minCompleted) return false;
    if (filters.minSpend !== null && row.capturedSpend < filters.minSpend) return false;
    return true;
  });
}

function sortCustomerRows(rows: ReturnType<typeof buildCustomerRow>[], sort: string) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sort === 'last-work') {
      return dateMs(right.lastCompletedAt) - dateMs(left.lastCompletedAt);
    }
    if (sort === 'booking-count') {
      return (
        right.bookingCount - left.bookingCount || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt)
      );
    }
    if (sort === 'completed-count') {
      return (
        right.completedBookings - left.completedBookings ||
        dateMs(right.lastCompletedAt) - dateMs(left.lastCompletedAt)
      );
    }
    if (sort === 'captured-spend') {
      return (
        right.capturedSpend - left.capturedSpend || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt)
      );
    }
    if (sort === 'last-seen') {
      return dateMs(right.lastSeenAt) - dateMs(left.lastSeenAt);
    }
    if (sort === 'joined') {
      return dateMs(right.joinedAt) - dateMs(left.joinedAt);
    }
    if (sort === 'name') {
      return left.name.localeCompare(right.name);
    }
    return dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
  });
  return sorted;
}

function buildCustomerActiveFilters(filters: CustomerFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.booking) labels.push(`Booking: ${filters.booking}`);
  if (filters.bookingFlow) labels.push(`Booking flow: ${customerBookingFlowFilterLabel(filters.bookingFlow)}`);
  if (filters.reachability) labels.push(`Reachability: ${filters.reachability}`);
  if (filters.address) labels.push(`Address: ${filters.address}`);
  if (filters.payment) labels.push(`Payment: ${filters.payment}`);
  if (filters.chat) labels.push(`Chat: ${filters.chat}`);
  if (filters.memo) labels.push(`Memo: ${filters.memo}`);
  if (filters.joinedFrom) labels.push(`Joined from: ${filters.joinedFrom}`);
  if (filters.joinedTo) labels.push(`Joined to: ${filters.joinedTo}`);
  if (filters.seen) labels.push(`Recent access: ${filters.seen}`);
  if (filters.minBookings !== null) labels.push(`Min bookings: ${filters.minBookings}`);
  if (filters.minCompleted !== null) labels.push(`Min completed: ${filters.minCompleted}`);
  if (filters.minSpend !== null) labels.push(`Min paid amount: ${formatMoney(filters.minSpend)}`);
  if (filters.sort !== 'last-booking') labels.push(`Sort: ${customerSortLabel(filters.sort)}`);
  return labels;
}

function buildCustomerRow(customer: AdminCustomer) {
  const bookings = customer.bookings ?? [];
  const payments = bookings.map((booking) => booking.payment).filter(Boolean);
  const refundAmount = bookings.reduce((sum, booking) => {
    const paymentRefunds = booking.payment?.refunds ?? [];
    const bookingRefunds = booking.refunds ?? [];
    return (
      sum +
      [...paymentRefunds, ...bookingRefunds].reduce(
        (innerSum, refund) => innerSum + Number(refund.amount ?? 0),
        0,
      )
    );
  }, 0);
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length;
  const closedBookings = bookings.filter((booking) => CLOSED_STATUSES.includes(booking.status));
  const cancelledBookings = closedBookings.length;
  const customerClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'CUSTOMER').length;
  const adminClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'ADMIN').length;
  const partnerClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'PROVIDER').length;
  const noShowBookings = bookings.filter((booking) => booking.status === 'NO_SHOW').length;
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const openMatchingBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length;
  const firstPickBookings = bookings.filter(
    (booking) => booking.preferredProviderId && !booking.selectedProviderId,
  ).length;
  const customerChoiceBookings = bookings.filter((booking) => Boolean(booking.selectedProviderId)).length;
  const serviceLiveBookings = bookings.filter((booking) =>
    ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  ).length;
  const chatMissingBookings = bookings.filter(
    (booking) => shouldHaveCustomerChatRoom(booking) && !booking.chatRoom,
  ).length;
  const addressSnapshotBookings = bookings.filter((booking) => Boolean(booking.addressSnapshot)).length;
  const paymentIssues = payments.filter(
    (payment) => payment && !['AUTHORIZED', 'CAPTURED'].includes(payment.status),
  ).length;
  const capturedSpend = payments
    .filter((payment) => payment?.status === 'CAPTURED')
    .reduce((sum, payment) => sum + Number(payment?.amount ?? 0), 0);
  const addressCount = readAddressCount(customer.addresses) + (customer.selectedLocations?.length ?? 0);
  const lastBookingAt = bookings
    .map((booking) => booking.updatedAt ?? booking.createdAt ?? booking.scheduledStartAt)
    .filter(Boolean)
    .sort((left, right) => dateMs(right) - dateMs(left))[0];
  const completedRows = bookings
    .filter((booking) => booking.status === 'COMPLETED')
    .sort(
      (left, right) =>
        dateMs(right.updatedAt ?? right.createdAt ?? right.scheduledStartAt) -
        dateMs(left.updatedAt ?? left.createdAt ?? left.scheduledStartAt),
    );
  const lastCompletedBooking = completedRows[0];
  const lastCompletedAt =
    lastCompletedBooking?.updatedAt ??
    lastCompletedBooking?.createdAt ??
    lastCompletedBooking?.scheduledStartAt;
  const commonService = mostCommonLabel(bookings.map((booking) => bookingServiceLabel(booking)));
  const commonArea = mostCommonLabel(
    bookings
      .map((booking) => bookingAddressLabel(booking))
      .filter((label) => label !== 'No address'),
  );
  const commonPartner = mostCommonLabel(bookings.map((booking) => bookingPartnerLabel(booking)));
  const latestSession = customer.user?.appSessions?.[0];
  const lastSeenAt = latestSession?.lastSeenAt;
  const isLive = Boolean(lastSeenAt && Date.now() - dateMs(lastSeenAt) <= 30 * 60_000);
  const pushReachable = Boolean(customer.user?.pushDevices?.some((device) => device.enabled));
  const latestMemo = [...(customer.auditLogs ?? [])].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  )[0];
  const memoCount = customer.auditLogCount ?? customer.auditLogs?.length ?? 0;
  const activityLabel =
    activeBookings > 0
      ? `${activeBookings} active booking(s)`
      : completedBookings > 0
        ? `${completedBookings} completed work record(s)`
        : bookings.length > 0
          ? `${bookings.length} booking record(s)`
          : 'No booking history yet';

  return {
    id: customer.id,
    name: customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer',
    phone: customer.user?.phone ?? 'No phone',
    email: customer.user?.email ?? 'No email',
    joinedAt: customer.user?.createdAt,
    bookingCount: bookings.length,
    activeBookings,
    openMatchingBookings,
    firstPickBookings,
    customerChoiceBookings,
    serviceLiveBookings,
    chatMissingBookings,
    addressSnapshotBookings,
    completedBookings,
    cancelledBookings,
    customerClosedBookings,
    adminClosedBookings,
    partnerClosedBookings,
    noShowBookings,
    paymentCount: payments.length,
    refundAmount,
    capturedSpend,
    addressCount,
    lastBookingAt,
    lastCompletedAt,
    lastCompletedLabel: lastCompletedBooking
      ? bookingServiceLabel(lastCompletedBooking)
      : 'No finished service record',
    lastCompletedPartner: lastCompletedBooking
      ? bookingPartnerLabel(lastCompletedBooking)
      : 'No completed partner',
    commonService: commonService ?? 'Not enough bookings',
    commonArea: commonArea ?? 'No repeated area',
    commonPartner: commonPartner ?? 'Not enough bookings',
    lastSeenAt,
    latestSessionDevice: sessionDeviceLabel(latestSession),
    latestSessionPlatform: latestSession?.platform ?? 'Unknown platform',
    latestSessionIp: latestSession?.ipAddress ?? 'No IP recorded',
    latestSessionAppVersion: latestSession?.appVersion ?? 'No app version',
    isLive,
    pushReachable,
    paymentIssues,
    chatRooms: bookings.filter((booking) => booking.chatRoom).length,
    memoCount,
    activityLabel,
    latestMemoTitle: latestMemo?.action ?? 'No memo',
    latestMemoDetail: latestMemo
      ? compactText(compactJson(latestMemo.metadata), 72)
      : 'No internal memo saved yet',
  };
}

function buildCustomerSummary(rows: ReturnType<typeof buildCustomerRow>[]) {
  return {
    total: rows.length,
    live: rows.filter((row) => row.isLive).length,
    recentJoins: rows.filter(
      (row) => row.joinedAt && Date.now() - dateMs(row.joinedAt) <= 30 * 24 * 60 * 60_000,
    ).length,
    activeBookings: rows.reduce((sum, row) => sum + row.activeBookings, 0),
    completedBookings: rows.reduce((sum, row) => sum + row.completedBookings, 0),
    cancelledBookings: rows.reduce((sum, row) => sum + row.cancelledBookings, 0),
    addresses: rows.reduce((sum, row) => sum + row.addressCount, 0),
    capturedSpend: rows.reduce((sum, row) => sum + row.capturedSpend, 0),
    refundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    pushReachable: rows.filter((row) => row.pushReachable).length,
    chatRooms: rows.reduce((sum, row) => sum + row.chatRooms, 0),
    missingAddress: rows.filter((row) => row.addressCount === 0).length,
    paymentIssues: rows.reduce((sum, row) => sum + row.paymentIssues, 0),
    latestBookingAt: rows
      .map((row) => row.lastBookingAt)
      .filter(Boolean)
      .sort((left, right) => dateMs(right) - dateMs(left))[0],
    latestCompletedAt: rows
      .map((row) => row.lastCompletedAt)
      .filter(Boolean)
      .sort((left, right) => dateMs(right) - dateMs(left))[0],
  };
}

function shouldHaveCustomerChatRoom(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
}

function buildCustomerFilterSummary(
  rows: ReturnType<typeof buildCustomerRow>[],
  allRows: ReturnType<typeof buildCustomerRow>[],
  summary: ReturnType<typeof buildCustomerSummary>,
  activeFilterCount: number,
) {
  const totalBookings = rows.reduce((sum, row) => sum + row.bookingCount, 0);
  const noAppSession = rows.filter((row) => !row.lastSeenAt).length;
  const completedShare =
    totalBookings > 0 ? Math.round((summary.completedBookings / totalBookings) * 100) : 0;

  return [
    {
      label: 'Filtered rows',
      value: `${rows.length}/${allRows.length}`,
      detail:
        activeFilterCount > 0
          ? `${activeFilterCount} active filter(s) are narrowing the customer list`
          : 'No active filters, full customer list is loaded',
    },
    {
      label: 'Completed work',
      value: summary.completedBookings.toString(),
      detail: `${completedShare}% of booking records in this result are completed`,
    },
    {
      label: 'Latest work',
      value: summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : 'None',
      detail: 'Most recent completed service in the current result',
    },
    {
      label: 'No app session',
      value: noAppSession.toString(),
      detail: 'Customer accounts without a saved app session record',
    },
    {
      label: 'Address follow-up',
      value: summary.missingAddress.toString(),
      detail: 'Customer profiles without saved or selected address records',
    },
    {
      label: 'Payment follow-up',
      value: summary.paymentIssues.toString(),
      detail: 'Payment records that are not authorized or captured',
    },
  ];
}

function bookingServiceLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function bookingPartnerLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return (
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    booking.selectedProvider?.user?.fullName ??
    booking.preferredProvider?.user?.fullName ??
    booking.selectedProvider?.user?.phone ??
    booking.preferredProvider?.user?.phone ??
    'No partner'
  );
}

function bookingAddressLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return (
    booking.addressSnapshot?.addressText ??
    stringifyAddress(booking.addressSnapshot?.address) ??
    stringifyAddress(booking.address) ??
    'No address'
  );
}

function sessionDeviceLabel(session?: NonNullable<NonNullable<AdminCustomer['user']>['appSessions']>[number]) {
  if (!session) return 'No session';
  const platform = session.platform ?? 'Unknown platform';
  const appVersion = session.appVersion ? `v${session.appVersion}` : 'No app version';
  return `${platform} / ${appVersion} / ${compactText(session.deviceId, 18)}`;
}

function mostCommonLabel(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === 'No service' || value === 'No address' || value === 'No partner') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function stringifyAddress(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const knownText = objectValue.addressText ?? objectValue.address ?? objectValue.label ?? objectValue.name;
    if (typeof knownText === 'string') return knownText;
    return compactText(JSON.stringify(value), 96);
  }
  return String(value);
}

function readAddressCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return 1;
  return 0;
}

function isWithinRecentDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  return Date.now() - dateMs(value) <= days * 24 * 60 * 60_000;
}

function isOnOrAfterDate(value: string | null | undefined, date: string) {
  if (!value) return false;
  return dateMs(value) >= new Date(`${date}T00:00:00`).getTime();
}

function isOnOrBeforeDate(value: string | null | undefined, date: string) {
  if (!value) return false;
  return dateMs(value) <= new Date(`${date}T23:59:59.999`).getTime();
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function compactJson(value: unknown) {
  if (!value) return 'No metadata';
  try {
    return JSON.stringify(value);
  } catch {
    return 'Metadata unavailable';
  }
}
