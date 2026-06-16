import Link from 'next/link';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { adminGet } from '../../lib/admin-api';
import type { AdminCustomer } from '../../lib/admin-api';
import { formatDateTime as formatDate } from '../../lib/admin-format';
import { buildCsvDataHref } from '../../lib/csv-export';
import { buildCustomerActiveFilters, buildCustomerFilters, customerSortLabel } from './customer-filters';
import { CustomerFilterBoard } from './customer-filter-board';
import {
  buildCustomerRow,
  buildCustomerSummary,
  filterCustomerRows,
  sortCustomerRows,
} from './customer-list-model';
import {
  buildCustomerManagementMetrics,
  buildCustomerManagementSpotlights,
  buildCustomerManagementTableRows,
} from './customer-management-view-model';
import { CustomersTableSection } from './customers-table-section';

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams?: CustomersPageSearchParams }) {
  const filters = buildCustomerFilters(searchParams ? await searchParams : {});
  const customers = await adminGet<AdminCustomer[]>('/admin/customers', []);
  const allRows = customers.map(buildCustomerRow);
  const rows = sortCustomerRows(filterCustomerRows(allRows, filters), filters.sort);
  const summary = buildCustomerSummary(rows);
  const activeFilters = buildCustomerActiveFilters(filters);
  const metrics = buildCustomerManagementMetrics(summary, allRows.length);
  const spotlights = buildCustomerManagementSpotlights(
    summary,
    rows.length,
    allRows.length,
    activeFilters.length,
  );
  const tableRows = buildCustomerManagementTableRows(rows);
  const recentActivityRows = rows.filter((row) => row.lastBookingAt || row.lastCompletedAt).slice(0, 6);
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
    <AdminPageTemplate
      title="Customer Management"
      description="Customer profile, booking movement, completed work, chat archive, payment footprint, saved locations, app sessions, and push reachability in one management flow."
      metrics={metrics}
      actions={
        <>
          <Link className="text-link" href="/bookings">
            Open bookings
          </Link>
          <Link className="text-link" href="/payments">
            Open payments
          </Link>
          <Link className="text-link" href="/reviews">
            Open reviews
          </Link>
        </>
      }
    >
      <CustomerFilterBoard
        activeFilters={activeFilters}
        csvHref={customerListCsvHref}
        filteredCount={rows.length}
        filters={filters}
        totalCount={allRows.length}
      />

      <section className="card admin-mb-16">
        <AdminSectionHeader
          title="Customer operations snapshot"
          description="Quick read of the filtered customer directory before an operator opens the full table."
          status={<span className="pill pill-info">{spotlights.length} signals</span>}
        />
        <div className="service-trace-summary admin-mt-12">
          {spotlights.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          title="Recent customer movement"
          description="Newest booking and completed-work signals so the operations desk can jump directly into the next customer record."
          status={<span className="pill pill-info">{recentActivityRows.length} recent</span>}
        />
        <div className="service-trace-summary admin-mt-12">
          {recentActivityRows.length > 0 ? (
            recentActivityRows.map((row) => (
              <Link href={`/customers/${row.id}`} key={row.id}>
                <span>{row.name}</span>
                <strong>{row.activityLabel}</strong>
                <small>
                  {row.lastBookingAt ? `Last booking ${formatDate(row.lastBookingAt)}` : 'No booking yet'} /{' '}
                  {row.lastCompletedAt ? `last work ${formatDate(row.lastCompletedAt)}` : 'no completed work'}
                </small>
              </Link>
            ))
          ) : (
            <div>
              <span>Activity</span>
              <strong>No customer movement yet</strong>
              <small>Once bookings are created or completed, this rail will surface the newest customer signals.</small>
            </div>
          )}
        </div>
      </section>

      <CustomersTableSection rows={tableRows} sortLabel={customerSortLabel(filters.sort)} />
    </AdminPageTemplate>
  );
}
