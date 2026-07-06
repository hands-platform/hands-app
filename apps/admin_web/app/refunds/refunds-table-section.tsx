import type { ReactNode } from 'react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminNotePanel } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type RefundActionExecutionRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

export type RefundTableRow = {
  readonly amount: number;
  readonly bookingHref: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly currency: string;
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
    <AdminTablePanel
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
                  <AdminTextLink href={row.bookingHref}>
                    Open booking
                  </AdminTextLink>
                  <AdminTextLink href={row.paymentHref}>
                    Open payment
                  </AdminTextLink>
                </div>
              </td>
              <td>
                <MoneyText amount={row.amount} currency={row.currency} />
              </td>
              <td>{row.status}</td>
              <td>
                <div>{row.opsSignal}</div>
                <div className="muted admin-mt-8">{row.opsHint}</div>
                <AdminNotePanel className="admin-mt-10">
                  <strong>Refund action execution map</strong>
                  <div className="setup-stage-list admin-mt-8">
                    {row.executionRows.map((item) => (
                      <AdminStageItem key={`${row.id}-${item.action}`}>
                        <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>
                          {item.status}
                        </StatusBadge>
                        <div>
                          <strong>{item.action}</strong>
                          <p className="muted">{item.reason}</p>
                          <small>{item.operatorRule}</small>
                        </div>
                      </AdminStageItem>
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
    </AdminTablePanel>
  );
}
