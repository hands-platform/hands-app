import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';

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
  readonly amountLabel: string;
  readonly bookingHref: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly callbackEvidence: ReactNode;
  readonly cashDebtLabel: string | null;
  readonly cashDebtSettlementForm: ReactNode;
  readonly customerPhone: string;
  readonly earningHref: string | null;
  readonly executionRows: readonly PaymentActionExecutionRow[];
  readonly id: string;
  readonly method: string;
  readonly opsHint: string;
  readonly opsSignal: ReactNode;
  readonly providerRef: string;
  readonly recordDateLabel: string;
  readonly refundHref: string | null;
  readonly stateLabel: string;
  readonly status: string;
};

type PaymentOperationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly PaymentOperationsTableRow[];
};

export function PaymentOperationsTableSection({ emptyMessage, rows }: PaymentOperationsTableSectionProps) {
  return (
    <div className="card">
      <AdminDataTable
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
            <td>{row.amountLabel}</td>
            <td>
              {row.bookingIdLabel}
              <div className="muted">{row.bookingStatus}</div>
              <div className="muted">{row.recordDateLabel}</div>
              <div className="muted">{row.customerPhone}</div>
              {row.cashDebtLabel ? <div className="muted">{row.cashDebtLabel}</div> : null}
              <div className="actions admin-mt-8">
                <a className="text-link" href={row.bookingHref}>
                  Open booking
                </a>
                {row.earningHref ? (
                  <a className="text-link" href={row.earningHref}>
                    Open earning
                  </a>
                ) : null}
                {row.refundHref ? (
                  <a className="text-link" href={row.refundHref}>
                    Open refund
                  </a>
                ) : null}
              </div>
            </td>
            <td>
              <div>{row.opsSignal}</div>
              <div className="muted admin-mt-8">
                {row.opsHint}
              </div>
              <div className="ops-task-note admin-mt-10">
                <strong>Payment action execution map</strong>
                <div className="setup-stage-list admin-mt-8">
                  {row.executionRows.map((executionRow) => (
                    <div className="setup-stage-item" key={`${row.id}-${executionRow.action}`}>
                      <span className={`pill ${executionRow.pillClass}`}>{executionRow.status}</span>
                      <div>
                        <strong>{executionRow.action}</strong>
                        <p className="muted">{executionRow.reason}</p>
                        <small>{executionRow.operatorRule}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
    </div>
  );
}
