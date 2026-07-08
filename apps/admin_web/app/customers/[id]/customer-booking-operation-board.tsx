import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { AdminDataTable, AdminTablePaginationFooter } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { AdminTextLink } from '../../../components/admin-text-link';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';

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
  readonly servicePriceAmount: number;
  readonly servicePriceCurrency: string;
  readonly stateDetail: ReactNode;
  readonly stateLabel: string;
  readonly stateTone: string;
};

export type CustomerBookingOperationGroup = {
  readonly countTone: string;
  readonly description: string;
  readonly emptyMessage: string;
  readonly key: string;
  readonly page: number;
  readonly pageParam: string;
  readonly rows: readonly CustomerBookingOperationRow[];
  readonly title: string;
  readonly totalRows: number;
};

export const CUSTOMER_BOOKING_OPERATION_PAGE_SIZE = 5;
const CUSTOMER_BOOKING_OPERATION_HEADERS = [
  'Request Time',
  'Booking',
  'Service Type',
  'Partner',
  'Payment Type',
  'Address',
  'State',
] as const;

type CustomerBookingOperationBoardProps = {
  readonly basePath: string;
  readonly groups: readonly CustomerBookingOperationGroup[];
  readonly metrics: readonly CustomerBookingOperationMetric[];
  readonly searchParams: Record<string, string | string[] | undefined>;
};

export function CustomerBookingOperationBoard({
  basePath,
  groups,
  metrics,
  searchParams,
}: CustomerBookingOperationBoardProps) {
  const hasBookingOperationRows = groups.some((group) => group.totalRows > 0);

  return (
    <>
      <AdminSection
        className="admin-mb-16 customer-booking-operation-summary-card"
        description="Current work appears first, followed by completed work, pre-match cancellations, and Partner cancellations for this customer."
        id="customer-booking-situation-board"
        statusLabel="Booking operations"
        statusTone="info"
        title="Customer booking situation board"
      >
        <AdminTraceSummary
          className="admin-mt-12"
          metrics={metrics.map((metric) => ({
            className: `customer-booking-operation-metric ${metric.tone}`,
            detail: metric.helper,
            label: metric.label,
            value: metric.value,
          }))}
        />
      </AdminSection>

      {hasBookingOperationRows ? (
        groups.map((group) => (
          <CustomerBookingOperationSection
            basePath={basePath}
            group={group}
            key={group.key}
            searchParams={searchParams}
          />
        ))
      ) : (
        <AdminSection
          className="admin-mb-16 customer-booking-operation-empty-card"
          description="Payment Type, Partner, address, and state evidence will appear after the first booking."
          id="customer-booking-operation-empty"
          statusLabel="0 booking(s)"
          statusTone="neutral"
          title="Customer booking records"
        >
          <AdminEmptyState
            framed
            message="No customer booking operation rows have been created for this customer yet."
            title="No customer booking operation rows yet"
          />
          <div className="admin-filter-chip-row admin-mt-12" aria-label="Empty booking operation buckets">
            {groups.map((group) => (
              <StatusBadge key={group.key} tone="neutral">
                {group.title}
              </StatusBadge>
            ))}
          </div>
        </AdminSection>
      )}
    </>
  );
}

function CustomerBookingOperationSection({
  basePath,
  group,
  searchParams,
}: {
  readonly basePath: string;
  readonly group: CustomerBookingOperationGroup;
  readonly searchParams: Record<string, string | string[] | undefined>;
}) {
  const sectionId = `customer-booking-operation-${group.key}`;
  const totalRows = Math.max(0, group.totalRows);
  const totalPages = Math.max(1, Math.ceil(totalRows / CUSTOMER_BOOKING_OPERATION_PAGE_SIZE));
  const activePage = Math.min(Math.max(1, group.page), totalPages);
  const pageStartIndex = (activePage - 1) * CUSTOMER_BOOKING_OPERATION_PAGE_SIZE;
  const visibleRows = group.rows;
  const pageFrom = totalRows === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(totalRows, pageStartIndex + visibleRows.length);

  return (
    <AdminTablePanel
      className="booking-monitor customer-booking-operation-section"
      description={group.description}
      id={sectionId}
      resultLabel={`${totalRows} booking(s)`}
      resultTone={customerBookingOperationResultTone(group.countTone)}
      title={group.title}
    >
      <AdminDataTable
        className="vuexy-booking-table"
        emptyMessage={group.emptyMessage}
        headers={CUSTOMER_BOOKING_OPERATION_HEADERS}
        rowCount={visibleRows.length}
      >
        {visibleRows.map((row) => (
          <tr key={row.id}>
            <td>
              <span className="muted">{row.requestTimeLabel}</span>
            </td>
            <td>
              <div className="vuexy-booking-id-line">
                <AdminTextLink href={row.bookingHref} title="Open booking detail">
                  <Eye aria-hidden="true" size={14} />
                  <strong>{row.bookingLabel}</strong>
                </AdminTextLink>
              </div>
              <p className="muted">{row.bookingHelper}</p>
            </td>
            <td>
              <strong>{row.serviceLabel}</strong>
              <p className="muted">
                <MoneyText amount={row.servicePriceAmount} currency={row.servicePriceCurrency} />
              </p>
            </td>
            <td>
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
            <td>{row.addressLabel}</td>
            <td>
              <StatusBadgeFromPillClass pillClass={row.stateTone}>{row.stateLabel}</StatusBadgeFromPillClass>
              <p className="muted">{row.stateDetail}</p>
            </td>
          </tr>
        ))}
      </AdminDataTable>

      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel={`${group.title} pages`}
        className="customer-booking-operation-footer"
        from={pageFrom}
        hrefForPage={(page) =>
          buildCustomerBookingOperationPageHref(basePath, searchParams, group.pageParam, page, sectionId)
        }
        to={pageTo}
        totalPages={totalPages}
        totalRows={totalRows}
      />
    </AdminTablePanel>
  );
}

function buildCustomerBookingOperationPageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  pageParam: string,
  page: number,
  sectionId: string,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === pageParam || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set(pageParam, String(page));
  }

  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}#${sectionId}`;
}

function customerBookingOperationResultTone(
  countTone: string,
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  switch (countTone) {
    case 'pill-danger':
      return 'danger';
    case 'pill-success':
      return 'success';
    case 'pill-warn':
      return 'warning';
    case 'pill-info':
      return 'info';
    default:
      return 'neutral';
  }
}
