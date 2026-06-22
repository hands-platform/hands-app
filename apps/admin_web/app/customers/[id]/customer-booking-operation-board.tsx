import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPersonCell } from '../../../components/admin-person-cell';
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
  readonly rows: readonly CustomerBookingOperationRow[];
  readonly title: string;
};

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
  readonly groups: readonly CustomerBookingOperationGroup[];
  readonly metrics: readonly CustomerBookingOperationMetric[];
};

export function CustomerBookingOperationBoard({
  groups,
  metrics,
}: CustomerBookingOperationBoardProps) {
  return (
    <section className="card admin-mb-16" id="customer-booking-situation-board">
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

      <div className="customer-booking-operation-stack admin-mt-16">
        {groups.map((group) => (
          <section className="customer-booking-operation-section" key={group.key}>
            <div className="ops-section-header">
              <div>
                <h3>{group.title}</h3>
                <p className="muted">{group.description}</p>
              </div>
              <span className={`pill ${group.countTone}`}>{group.rows.length} rows</span>
            </div>
            <AdminTableScroll>
              <AdminDataTable
                emptyMessage={group.emptyMessage}
                headers={CUSTOMER_BOOKING_OPERATION_HEADERS}
                rowCount={group.rows.length}
              >
                {group.rows.map((row) => (
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
            </AdminTableScroll>
          </section>
        ))}
      </div>
    </section>
  );
}
