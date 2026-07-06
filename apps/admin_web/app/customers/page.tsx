import { CalendarClock, Star } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminTextLink } from '../../components/admin-text-link';
import { adminGet } from '../../lib/admin-api';
import type { AdminCustomer, AdminCustomerSummary } from '../../lib/admin-api';
import { buildCsvDataHref } from '../../lib/csv-export';
import {
  buildCustomerActiveFilters,
  buildCustomerDataHrefs,
  buildCustomerFilters,
  customerSortLabel,
} from './customer-filters';
import { CustomerFilterBoard } from './customer-filter-board';
import {
  buildCustomerRow,
  buildCustomerSummary,
  buildServerCustomerPagination,
} from './customer-list-model';
import {
  buildCustomerManagementMetrics,
  buildCustomerManagementTableRows,
} from './customer-management-view-model';
import { CustomersTableSection } from './customers-table-section';

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams?: CustomersPageSearchParams }) {
  const filters = buildCustomerFilters(searchParams ? await searchParams : {});
  const dataHrefs = buildCustomerDataHrefs(filters);
  const [customers, serverSummary] = await Promise.all([
    adminGet<AdminCustomer[]>(dataHrefs.listHref, []),
    adminGet<AdminCustomerSummary>(dataHrefs.summaryHref, { totalCount: 0 }),
  ]);
  const rows = customers.map(buildCustomerRow);
  const rowSummary = buildCustomerSummary(rows);
  const allSummary = {
    ...rowSummary,
    total: serverSummary.totalCount,
    genderBreakdown: serverSummary.genderBreakdown ?? rowSummary.genderBreakdown,
    todayJoined: serverSummary.todayJoined ?? rowSummary.todayJoined,
    todayJoinedGenderBreakdown: serverSummary.todayJoinedGenderBreakdown ?? rowSummary.todayJoinedGenderBreakdown,
    todaySeen: serverSummary.todaySeen ?? rowSummary.todaySeen,
    todaySeenGenderBreakdown: serverSummary.todaySeenGenderBreakdown ?? rowSummary.todaySeenGenderBreakdown,
    monthSeen: serverSummary.monthSeen ?? rowSummary.monthSeen,
    monthSeenGenderBreakdown: serverSummary.monthSeenGenderBreakdown ?? rowSummary.monthSeenGenderBreakdown,
  };
  const activeFilters = buildCustomerActiveFilters(filters);
  const metrics = buildCustomerManagementMetrics(allSummary);
  const pagination = buildServerCustomerPagination(rows, filters, serverSummary.totalCount);
  const tableRows = buildCustomerManagementTableRows(pagination.rows);
  const tablePagination = { ...pagination, rows: tableRows };
  const customerListCsvHref = buildCsvDataHref(
    rows.map((row) => ({
      customer_id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      device_language: row.deviceLanguage,
      country: row.deviceLanguageCountryLabel,
      gender: row.genderLabel,
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
      'device_language',
      'country',
      'gender',
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
      description="Customer list aligned to the Vuexy management table using live customer profile, reservation, session, and wallet data."
      metrics={metrics}
      actions={
        <>
          <AdminFormControlLink className="button-secondary" href="/bookings">
            <CalendarClock aria-hidden="true" size={16} />
            Open bookings
          </AdminFormControlLink>
          <AdminTextLink href="/payments">
            Open payments
          </AdminTextLink>
          <AdminFormControlLink className="button-secondary" href="/reviews">
            <Star aria-hidden="true" size={16} />
            Open reviews
          </AdminFormControlLink>
        </>
      }
    >
      <CustomerFilterBoard
        activeFilters={activeFilters}
        csvHref={customerListCsvHref}
        filteredCount={rows.length}
        filters={filters}
        totalCount={serverSummary.totalCount}
      />

      <CustomersTableSection
        filters={filters}
        pagination={tablePagination}
        sortLabel={customerSortLabel(filters.sort)}
      />
    </AdminPageTemplate>
  );
}
