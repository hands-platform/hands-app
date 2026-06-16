import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';

export type EarningsLedgerRow = {
  readonly bookingHref: string;
  readonly bookingPaymentMethod: string;
  readonly bookingShortId: string;
  readonly canCreatePayout: boolean;
  readonly canDirectlyPay: boolean;
  readonly createdAtLabel: string;
  readonly feePolicyHint: string;
  readonly grossAmountLabel: string;
  readonly id: string;
  readonly netAmountLabel: string;
  readonly netCompanyFeeHint: string;
  readonly payoutBatchHref: string | null;
  readonly payoutBatchLabel: string | null;
  readonly platformFeeLabel: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly providerProfileId: string;
  readonly settlementMethodLabel: string | null;
  readonly settlementRef: string | null;
  readonly signalClassName: string;
  readonly statusHint: string;
  readonly statusLabel: string;
  readonly taxPolicyHint: string;
  readonly transferRef: string;
  readonly walletEntries: readonly string[];
  readonly withholdingAmountLabel: string;
};

type EarningsLedgerSectionProps = {
  readonly rows: readonly EarningsLedgerRow[];
};

const ledgerHeaders = [
  'Partner',
  'Booking',
  'Status',
  'Payout batch',
  'Gross / Fee / Tax',
  'Net',
  'Action',
] as const;

export function EarningsLedgerSection({ rows }: EarningsLedgerSectionProps) {
  return (
    <div className="card admin-mt-20">
      <div className="ops-section-header">
        <div>
          <h2>Recent earnings ledger</h2>
          <p className="muted">
            Raw earning rows remain visible for booking traceability, tax audit, payout batching, and cash
            fee settlement correction.
          </p>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable emptyMessage="No earnings loaded." headers={ledgerHeaders} rowCount={rows.length}>
          {rows.map((row) => (
            <tr id={`earning-${row.id}`} key={row.id}>
              <td>
                <div>{row.providerName}</div>
                <div className="muted">{row.providerPhone}</div>
              </td>
              <td>
                <a className="text-link" href={row.bookingHref}>
                  {row.bookingShortId}
                </a>
                <div className="muted">{row.createdAtLabel}</div>
                <div className="muted">Payment {row.bookingPaymentMethod}</div>
                {row.settlementRef ? <div className="muted">Settlement ref {row.settlementRef}</div> : null}
                {row.settlementMethodLabel ? (
                  <div className="muted">Settlement method {row.settlementMethodLabel}</div>
                ) : null}
                {row.walletEntries.map((entry) => (
                  <div className="muted" key={entry}>
                    {entry}
                  </div>
                ))}
              </td>
              <td>
                <span className={row.signalClassName}>{row.statusLabel}</span>
                <div className="muted admin-mt-6">
                  {row.statusHint}
                </div>
              </td>
              <td>
                {row.payoutBatchHref && row.payoutBatchLabel ? (
                  <a className="pill pill-info" href={row.payoutBatchHref}>
                    {row.payoutBatchLabel}
                  </a>
                ) : (
                  <span className="pill pill-warn">Not batched</span>
                )}
              </td>
              <td>
                <div>{row.grossAmountLabel} gross</div>
                <div className="muted">{row.platformFeeLabel}</div>
                <div className="muted">{row.feePolicyHint}</div>
                <div className="muted">{row.netCompanyFeeHint}</div>
                <div className="muted">{row.withholdingAmountLabel}</div>
                <div className="muted">{row.taxPolicyHint}</div>
              </td>
              <td>
                <strong>{row.netAmountLabel}</strong>
              </td>
              <td>
                {row.canDirectlyPay ? (
                  <form action="/earnings">
                    <input type="hidden" name="confirm" value="mark-paid" />
                    <input type="hidden" name="earningId" value={row.id} />
                    <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
                    <input
                      aria-label="Settlement reference"
                      name="settlementRef"
                      placeholder="Deposit ref or offset memo"
                    />
                    <button type="submit">Review fee settlement</button>
                  </form>
                ) : null}
                {row.canCreatePayout ? (
                  <form action="/earnings" className="admin-mt-6">
                    <input type="hidden" name="confirm" value="create-payout" />
                    <input type="hidden" name="providerProfileId" value={row.providerProfileId} />
                    <input type="hidden" name="transferRef" value={row.transferRef} />
                    <button type="submit">Review payout batch</button>
                  </form>
                ) : null}
                {!row.canDirectlyPay && !row.canCreatePayout ? (
                  <span className="muted">{row.statusLabel === 'PAID' ? 'Paid' : 'No action'}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}
