import Link from 'next/link';
import { AdminDataTable } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';

export type CustomerBookingOperationMetric = {
  readonly helper: string;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
};

export type CustomerBookingOperationRow = {
  readonly addressLabel: string;
  readonly bookingHelper: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly id: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
  readonly partnerHelper: string;
  readonly partnerHref: string | null;
  readonly partnerLabel: string;
  readonly requestTimeLabel: string;
  readonly serviceLabel: string;
  readonly servicePriceLabel: string;
  readonly stateDetail: string;
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
};

const CUSTOMER_BOOKING_OPERATION_PAGE_SIZE = 10;
const CUSTOMER_BOOKING_OPERATION_HEADERS = [
  'Request Time',
  'Booking',
  'Service Type',
  'Partner',
  'Address',
  'State',
  'Open',
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
  return (
    <>
      <section className="card admin-mb-16 customer-booking-operation-summary-card" id="customer-booking-situation-board">
        <div className="ops-section-header">
          <div>
            <h2>Customer booking situation board</h2>
            <p className="muted">
              Current work appears first, followed by completed work, pre-match cancellations, and Partner
              cancellations for this customer.
            </p>
          </div>
          <span className="pill pill-info">Booking operations</span>
        </div>

        <div className="service-trace-summary admin-mt-12">
          {metrics.map((metric) => (
            <div className={`customer-booking-operation-metric ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
      </section>

      {groups.map((group) => (
        <CustomerBookingOperationSection
          basePath={basePath}
          group={group}
          key={group.key}
          searchParams={searchParams}
        />
      ))}
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
  const totalPages = Math.max(1, Math.ceil(group.rows.length / CUSTOMER_BOOKING_OPERATION_PAGE_SIZE));
  const activePage = Math.min(Math.max(1, group.page), totalPages);
  const pageStartIndex = (activePage - 1) * CUSTOMER_BOOKING_OPERATION_PAGE_SIZE;
  const visibleRows = group.rows.slice(
    pageStartIndex,
    pageStartIndex + CUSTOMER_BOOKING_OPERATION_PAGE_SIZE,
  );
  const pageFrom = group.rows.length === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(group.rows.length, pageStartIndex + visibleRows.length);

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-booking-operation-section"
      description={group.description}
      id={sectionId}
      resultLabel={`${group.rows.length} booking(s)`}
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
              <Link className="text-link" href={row.bookingHref}>
                <strong>{row.bookingLabel}</strong>
              </Link>
              <p className="muted">{row.bookingHelper}</p>
            </td>
            <td>
              <strong>{row.serviceLabel}</strong>
              <p className="muted">{row.servicePriceLabel}</p>
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
            <td>{row.addressLabel}</td>
            <td>
              <span className={`pill ${row.stateTone}`}>{row.stateLabel}</span>
              <p className="muted">{row.stateDetail}</p>
            </td>
            <td>
              <Link className="text-link" href={row.bookingHref}>
                View
              </Link>
            </td>
          </tr>
        ))}
      </AdminDataTable>

      <div className="vuexy-booking-table-footer customer-booking-operation-footer">
        <span>
          Showing {pageFrom} to {pageTo} of {group.rows.length} entries
        </span>
        <AdminRoundedPagination
          activePage={activePage}
          ariaLabel={`${group.title} pages`}
          className="vuexy-booking-pagination"
          hrefForPage={(page) =>
            buildCustomerBookingOperationPageHref(basePath, searchParams, group.pageParam, page, sectionId)
          }
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={totalPages}
        />
      </div>
    </AdminFilterPanel>
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
