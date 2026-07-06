import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminNotePanel } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

export type PaymentActionExecutionRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

export type PaymentOperationsTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly amount: number;
  readonly bookingHref: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly callbackEvidence: ReactNode;
  readonly cashDebtLabel: string | null;
  readonly cashDebtSettlementForm: ReactNode;
  readonly currency: string;
  readonly customerPhone: string;
  readonly earningHref: string | null;
  readonly executionRows: readonly PaymentActionExecutionRow[];
  readonly id: string;
  readonly method: string;
  readonly opsHint: string;
  readonly opsSignal: ReactNode;
  readonly providerRef: string;
  readonly recordDate: string | null;
  readonly refundHref: string | null;
  readonly stateLabel: string;
  readonly status: string;
};

type PaymentOperationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly PaymentOperationsTableRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

export function PaymentOperationsTableSection({ emptyMessage, pagination }: PaymentOperationsTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminTablePanel
      description="Payment rows with booking links, gateway evidence, callback state, refund paths, and cash debt settlement actions."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Payment operations"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={['Payment', 'Method', 'Status', 'Amount', 'Booking', 'Ops hint', 'Gateway ref', 'Action']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr id={`payment-${row.id}`} key={row.id}>
              <td>{row.id}</td>
              <td>{row.method}</td>
              <td>
                {row.status}
                <div className="muted">{row.stateLabel}</div>
              </td>
              <td>
                <MoneyText amount={row.amount} currency={row.currency} />
              </td>
              <td>
                {row.bookingIdLabel}
                <div className="muted">{row.bookingStatus}</div>
                <div className="muted">
                  Record date <DateTimeText fallback="No payment record date" value={row.recordDate} />
                </div>
                <div className="muted">{row.customerPhone}</div>
                {row.cashDebtLabel ? <div className="muted">{row.cashDebtLabel}</div> : null}
                <div className="actions admin-mt-8">
                  <AdminTextLink href={row.bookingHref}>
                    Open booking
                  </AdminTextLink>
                  {row.earningHref ? (
                    <AdminTextLink href={row.earningHref}>
                      Open earning
                    </AdminTextLink>
                  ) : null}
                  {row.refundHref ? (
                    <AdminTextLink href={row.refundHref}>
                      Open refund
                    </AdminTextLink>
                  ) : null}
                </div>
              </td>
              <td>
                <div>{row.opsSignal}</div>
                <div className="muted admin-mt-8">
                  {row.opsHint}
                </div>
                <AdminNotePanel className="admin-mt-10">
                  <strong>Payment action execution map</strong>
                  <AdminStageList className="admin-mt-8">
                    {row.executionRows.map((executionRow) => (
                      <AdminStageItem key={`${row.id}-${executionRow.action}`}>
                        <StatusBadgeFromPillClass pillClass={executionRow.pillClass}>
                          {executionRow.status}
                        </StatusBadgeFromPillClass>
                        <div>
                          <strong>{executionRow.action}</strong>
                          <p className="muted">{executionRow.reason}</p>
                          <small>{executionRow.operatorRule}</small>
                        </div>
                      </AdminStageItem>
                    ))}
                  </AdminStageList>
                </AdminNotePanel>
              </td>
              <td>
                <div>{row.providerRef}</div>
                {row.callbackEvidence}
              </td>
              <td>
                <ActionMenu actions={row.actions} label={row.actionLabel} />
                {row.cashDebtSettlementForm}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Payment pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}
