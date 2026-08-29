import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { AdminDataTable } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { AdminTextLink } from '../../../components/admin-text-link';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import { adminCountLabel } from '../../../lib/admin-copy';

export type CustomerBookingOperationMetric = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
};

export type CustomerBookingOperationRow = {
  readonly addressLabel: string;
  readonly bookingHelper: ReactNode;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly id: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
  readonly partnerHelper: string;
  readonly partnerHref: string | null;
  readonly partnerLabel: string;
  readonly paymentDetailLabel: ReactNode;
  readonly paymentTypeLabel: string;
  readonly requestTimeLabel: ReactNode;
  readonly serviceLabel: string;
  readonly servicePriceAmount: number | null;
  readonly servicePriceCurrency: string;
  readonly sortAtMs: number;
  readonly stateDetail: ReactNode;
  readonly stateLabel: string;
  readonly stateTone: string;
};

export type CustomerBookingOperationGroup = {
  readonly key: string;
  readonly rows: readonly CustomerBookingOperationRow[];
  readonly title: string;
  readonly totalRows: number;
};

type CustomerBookingHistoryFilter = 'all' | 'cancelled' | 'completed' | 'live';

const CUSTOMER_BOOKING_OPERATION_HEADERS = [
  'When & booking',
  'Service & Partner',
  'Money',
  'Outcome',
] as const;
const CUSTOMER_BOOKING_HISTORY_FILTERS: readonly CustomerBookingHistoryFilter[] = [
  'all',
  'live',
  'completed',
  'cancelled',
];

type CustomerBookingOperationBoardProps = {
  readonly basePath: string;
  readonly groups: readonly CustomerBookingOperationGroup[];
  readonly metrics: readonly CustomerBookingOperationMetric[];
  readonly searchParams: Record<string, string | string[] | undefined>;
};

type GroupedBookingRow = CustomerBookingOperationRow & { readonly groupKey: string };

export function CustomerBookingOperationBoard({
  basePath,
  groups,
  metrics,
  searchParams,
}: CustomerBookingOperationBoardProps) {
  const activeFilter = readCustomerBookingHistoryFilter(searchParams.bookingHistory);
  const allRows = groups.flatMap((group) =>
    group.rows.map((row) => ({ ...row, groupKey: group.key })),
  );
  const filteredRows = allRows
    .filter((row) => customerBookingHistoryRowMatches(row, activeFilter))
    .sort((left, right) => customerBookingHistorySort(left, right, activeFilter));
  const totalRows = filteredRows.length;
  const counts = customerBookingHistoryCounts(allRows);

  return (
    <AdminTablePanel
      actions={
        <AdminTextLink
          href={`/bookings?view=all&dateRange=all&q=${encodeURIComponent(basePath.split('/').at(-1) ?? '')}`}
        >
          View all bookings
        </AdminTextLink>
      }
      className="booking-monitor customer-booking-operation-section admin-mb-16"
      description={`Latest ${allRows.length} bookings. An active booking is shown first when available.`}
      id="customer-booking-history"
      resultLabel={adminCountLabel(totalRows, 'booking')}
      resultTone={customerBookingHistoryTone(activeFilter, totalRows)}
      title="Recent bookings"
    >
      {allRows.length === 0 ? (
        <AdminEmptyState
          className="customer-booking-operation-empty"
          message="No recent booking records were found for this customer."
          title={null}
        />
      ) : (
        <>
          <AdminTraceSummary
            className="customer-booking-operation-summary admin-mb-12"
            inferScope={false}
            metrics={metrics.map((metric) => ({
              className: `customer-booking-operation-metric ${metric.tone}`,
              detail: metric.helper,
              label: metric.label,
              value: metric.value,
            }))}
          />
          <AdminSegmentedControl
            activeValue={activeFilter}
            ariaLabel="Recent booking filters"
            className="customer-booking-history-filters admin-mb-12"
            options={CUSTOMER_BOOKING_HISTORY_FILTERS.map((filter) => ({
              href: buildCustomerBookingHistoryHref(basePath, searchParams, filter),
              label: `${customerBookingHistoryFilterLabel(filter)} ${counts[filter]}`,
              value: filter,
            }))}
          />

          <AdminDataTable
            className="vuexy-booking-table customer-recent-bookings-table"
            emptyMessage="No booking matched this recent-booking filter."
            headers={CUSTOMER_BOOKING_OPERATION_HEADERS}
            rowCount={filteredRows.length}
          >
            {filteredRows.map((row) => (
              <CustomerBookingOperationTableRow key={row.id} row={row} />
            ))}
          </AdminDataTable>
        </>
      )}
    </AdminTablePanel>
  );
}

function CustomerBookingOperationTableRow({ row }: { readonly row: CustomerBookingOperationRow }) {
  return (
    <tr>
      <td>
        <span className="muted">{row.requestTimeLabel}</span>
        <div className="vuexy-booking-id-line">
          <AdminTextLink href={row.bookingHref} title={`Open booking ${row.bookingLabel}`}>
            <Eye aria-hidden="true" size={14} />
            <strong>{row.bookingLabel}</strong>
          </AdminTextLink>
        </div>
        <p className="muted">{row.bookingHelper}</p>
        <details className="customer-booking-row-details">
          <summary>Address</summary>
          <p>{row.addressLabel}</p>
        </details>
      </td>
      <td>
        <strong>{row.serviceLabel}</strong>
        {row.servicePriceAmount === null ? null : (
          <p className="muted">
            <MoneyText amount={row.servicePriceAmount} currency={row.servicePriceCurrency} />
          </p>
        )}
        <AdminPersonCell
          avatarClassName="vuexy-booking-avatar is-partner"
          avatarStatus={row.partnerAvatarStatus}
          className="vuexy-booking-person"
          copyClassName="vuexy-booking-person-copy"
          helper={row.partnerHelper}
          href={row.partnerHref}
          label={row.partnerLabel}
          linkClassName="vuexy-booking-person-link"
        />
      </td>
      <td>
        <StatusBadge tone="neutral">{row.paymentTypeLabel}</StatusBadge>
        <p className="muted">{row.paymentDetailLabel}</p>
      </td>
      <td>
        <StatusBadgeFromPillClass pillClass={row.stateTone}>{row.stateLabel}</StatusBadgeFromPillClass>
        <p className="muted">{row.stateDetail}</p>
      </td>
    </tr>
  );
}

function customerBookingHistoryCounts(rows: readonly GroupedBookingRow[]) {
  return {
    all: rows.length,
    live: rows.filter((row) => row.groupKey === 'live').length,
    completed: rows.filter((row) => row.groupKey === 'completed').length,
    cancelled: rows.filter((row) => customerBookingHistoryRowMatches(row, 'cancelled')).length,
  } satisfies Record<CustomerBookingHistoryFilter, number>;
}

function customerBookingHistoryRowMatches(
  row: GroupedBookingRow,
  filter: CustomerBookingHistoryFilter,
) {
  if (filter === 'all') return true;
  if (filter === 'cancelled') {
    return row.groupKey === 'pre-match-cancelled' || row.groupKey === 'partner-cancelled';
  }
  return row.groupKey === filter;
}

function customerBookingHistorySort(
  left: GroupedBookingRow,
  right: GroupedBookingRow,
  filter: CustomerBookingHistoryFilter,
) {
  if (filter === 'all' && left.groupKey !== right.groupKey) {
    if (left.groupKey === 'live') return -1;
    if (right.groupKey === 'live') return 1;
  }
  return right.sortAtMs - left.sortAtMs;
}

function readCustomerBookingHistoryFilter(
  value: string | string[] | undefined,
): CustomerBookingHistoryFilter {
  const normalized = Array.isArray(value) ? value[0] : value;
  return CUSTOMER_BOOKING_HISTORY_FILTERS.includes(normalized as CustomerBookingHistoryFilter)
    ? (normalized as CustomerBookingHistoryFilter)
    : 'all';
}

export function buildCustomerBookingHistoryHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  filter: CustomerBookingHistoryFilter,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (
      key === 'bookingHistory' ||
      key === 'bookingHistoryPage' ||
      key === 'action' ||
      key === 'noteNotice' ||
      key === 'notificationNotice' ||
      key === 'walletAdjustmentNotice' ||
      key.endsWith('BookingsPage') ||
      value === undefined
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  if (filter !== 'all') params.set('bookingHistory', filter);

  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}#customer-booking-history`;
}

function customerBookingHistoryFilterLabel(filter: CustomerBookingHistoryFilter) {
  switch (filter) {
    case 'live':
      return 'Live';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'All';
  }
}

function customerBookingHistoryTone(
  filter: CustomerBookingHistoryFilter,
  totalRows: number,
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  if (totalRows === 0) return 'neutral';
  if (filter === 'live' || filter === 'cancelled') return 'warning';
  if (filter === 'completed') return 'success';
  return 'info';
}
