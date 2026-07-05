import type { ReactNode } from 'react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminNotePanel } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type RefundActionExecutionRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

export type RefundTableRow = {
  readonly amountLabel: string;
  readonly bookingHref: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly customerLabel: string;
  readonly executionRows: readonly RefundActionExecutionRow[];
  readonly id: string;
  readonly opsHint: string;
  readonly opsSignal: ReactNode;
  readonly partnerLabel: string;
  readonly paymentHref: string;
  readonly paymentLabel: string;
  readonly shortId: string;
  readonly status: string;
};

type RefundsTableSectionProps = {
  readonly emptyMessage: string;
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly RefundTableRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

export function RefundsTableSection({ emptyMessage, pagination }: RefundsTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Refund rows with booking, payment, customer, partner, and ledger action evidence for finance follow-up."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Refund operations"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={['Refund', 'Customer', 'Partner', 'Payment', 'Booking', 'Amount', 'Status', 'Ops hint']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr id={`refund-${row.id}`} key={row.id}>
              <td>{row.shortId}</td>
              <td>{row.customerLabel}</td>
              <td>{row.partnerLabel}</td>
              <td>{row.paymentLabel}</td>
              <td>
                {row.bookingStatus}
                <div className="muted">Booking {row.bookingIdLabel}</div>
                <div className="actions admin-mt-8">
                  <a className="text-link" href={row.bookingHref}>
                    Open booking
                  </a>
                  <a className="text-link" href={row.paymentHref}>
                    Open payment
                  </a>
                </div>
              </td>
              <td>{row.amountLabel}</td>
              <td>{row.status}</td>
              <td>
                <div>{row.opsSignal}</div>
                <div className="muted admin-mt-8">{row.opsHint}</div>
                <AdminNotePanel className="admin-mt-10">
                  <strong>Refund action execution map</strong>
                  <div className="setup-stage-list admin-mt-8">
                    {row.executionRows.map((item) => (
                      <div className="setup-stage-item" key={`${row.id}-${item.action}`}>
                        <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>
                          {item.status}
                        </StatusBadge>
                        <div>
                          <strong>{item.action}</strong>
                          <p className="muted">{item.reason}</p>
                          <small>{item.operatorRule}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </AdminNotePanel>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Refund pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminFilterPanel>
  );
}
