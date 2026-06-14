import Link from 'next/link';

import { AdminDataTable } from '../../components/admin-data-table';

export type CashSettlementOpenDebtActionExecutionRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: string;
  readonly status: string;
};

export type CashSettlementOpenDebtTableRow = {
  readonly actionRows: readonly CashSettlementOpenDebtActionExecutionRow[];
  readonly bookingAmountLabel: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly createdAtLabel: string;
  readonly debtAmountLabel: string;
  readonly debtOrigin: string;
  readonly earningId: string;
  readonly lastLedgerRef: string | null;
  readonly nextAction: string;
  readonly partnerHref: string;
  readonly paymentMethod: string;
  readonly platformFeeLabel: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly serviceLabel: string;
  readonly settlementEvidence: string;
  readonly settlementMethodDefault: string;
  readonly settlementMethodLabel: string;
  readonly settlementNotesDefault: string;
  readonly settlementReference: string;
  readonly taxAmountLabel: string;
};

type CashSettlementOpenDebtTableSectionProps = {
  readonly rows: readonly CashSettlementOpenDebtTableRow[];
};

export function CashSettlementOpenDebtTableSection({ rows }: CashSettlementOpenDebtTableSectionProps) {
  return (
    <div className="card admin-card-scroll">
      <div className="ops-section-header">
        <div>
          <h2>Open cash fee debt rows</h2>
          <p className="muted">
            Settle only after confirming a Partner deposit or a documented admin offset. The backend rejects missing
            references.
          </p>
        </div>
        <Link className="text-link" href="/payments?review=cash-debt">
          Payment debt view
        </Link>
      </div>
      <AdminDataTable
        emptyMessage="No cash fee debt is waiting for settlement."
        headers={['Partner', 'Booking', 'Debt', 'Fee / Tax', 'Evidence', 'Settlement']}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.earningId}>
            <td>
              <strong>{row.providerName}</strong>
              <div className="muted">{row.providerPhone}</div>
              <div className="participant-list admin-mt-8">
                <Link className="pill" href={row.partnerHref}>
                  Partner
                </Link>
                <span className="pill pill-danger">Final acceptance blocked</span>
              </div>
            </td>
            <td>
              <Link className="text-link" href={row.bookingHref}>
                {row.bookingLabel}
              </Link>
              <div className="muted">{row.createdAtLabel}</div>
              <div className="muted">{row.serviceLabel}</div>
            </td>
            <td>
              <strong>{row.debtAmountLabel}</strong>
              <div className="muted">Cash collected: {row.bookingAmountLabel}</div>
              <div className="muted">{row.debtOrigin}</div>
            </td>
            <td>
              <div>HANDS fee {row.platformFeeLabel}</div>
              <div className="muted">Tax {row.taxAmountLabel}</div>
            </td>
            <td>
              <div className="service-matrix-cell">
                <small>{row.settlementEvidence}</small>
                <small>Suggested ref: {row.settlementReference}</small>
                <small>Payment method: {row.paymentMethod}</small>
                <small>Settlement method: {row.settlementMethodLabel}</small>
                {row.lastLedgerRef ? <small>Last ledger ref: {row.lastLedgerRef}</small> : null}
                <small>{row.nextAction}</small>
              </div>
              <div className="ops-task-note admin-mt-10">
                <strong>Cash settlement action execution map</strong>
                <div className="setup-stage-list admin-mt-8">
                  {row.actionRows.map((item) => (
                    <div className="setup-stage-item" key={`${row.earningId}-${item.action}`}>
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
            <td>
              <form action="/cash-settlements" className="inline-form">
                <input type="hidden" name="confirm" value="settle" />
                <input type="hidden" name="earningId" value={row.earningId} />
                <select aria-label="Settlement method" name="settlementMethod" defaultValue={row.settlementMethodDefault}>
                  <option value="PARTNER_DEPOSIT">Partner deposit</option>
                  <option value="ADMIN_OFFSET">Admin offset</option>
                </select>
                <input
                  aria-label="Settlement reference"
                  name="settlementRef"
                  placeholder="Bank deposit ref or admin offset"
                  defaultValue={row.settlementReference}
                />
                <input
                  aria-label="Settlement notes"
                  name="settlementNotes"
                  placeholder="Evidence note"
                  defaultValue={row.settlementNotesDefault}
                />
                <button type="submit">Review settlement</button>
              </form>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}
