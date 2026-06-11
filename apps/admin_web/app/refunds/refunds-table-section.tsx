import type { ReactNode } from 'react';

import { AdminDataTable } from '../../components/admin-data-table';

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
  readonly rows: readonly RefundTableRow[];
};

export function RefundsTableSection({ emptyMessage, rows }: RefundsTableSectionProps) {
  return (
    <div className="card">
      <AdminDataTable
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
              <div className="muted admin-mt-8">
                {row.opsHint}
              </div>
              <div className="ops-task-note admin-mt-10">
                <strong>Refund action execution map</strong>
                <div className="setup-stage-list admin-mt-8">
                  {row.executionRows.map((item) => (
                    <div className="setup-stage-item" key={`${row.id}-${item.action}`}>
                      <span className={`pill ${item.pillClass}`}>{item.status}</span>
                      <div>
                        <strong>{item.action}</strong>
                        <p className="muted">{item.reason}</p>
                        <small>{item.operatorRule}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}
