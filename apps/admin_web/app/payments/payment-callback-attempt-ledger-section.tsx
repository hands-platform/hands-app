import { AdminDataTable } from '../../components/admin-data-table';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type PaymentCallbackAttemptLedgerRow = {
  readonly amountLabel: string;
  readonly bookingHref: string | null;
  readonly createdAtLabel: string;
  readonly errorMessage: string | null;
  readonly gatewayTransactionId: string;
  readonly id: string;
  readonly method: string;
  readonly outcome: string;
  readonly paymentIdLabel: string | null;
  readonly paymentStatus: string | null;
  readonly pillClass: string;
  readonly providerRef: string;
  readonly providerStatus: string;
  readonly signatureLabel: string;
  readonly verificationMode: string;
};

type PaymentCallbackAttemptLedgerSectionProps = {
  readonly rows: readonly PaymentCallbackAttemptLedgerRow[];
};

export function PaymentCallbackAttemptLedgerSection({ rows }: PaymentCallbackAttemptLedgerSectionProps) {
  return (
    <AdminTablePanel
      description="Accepted, replayed, rejected, and conflicting gateway callbacks. Unknown gateway references remain visible here even when they cannot attach to a payment row."
      resultLabel={`${rows.length} attempt(s)`}
      resultTone={rows.length > 0 ? 'info' : 'warning'}
      title="Payment callback attempt ledger"
    >
      <AdminDataTable
        className="vuexy-booking-table"
        emptyMessage="No callback attempts match this queue."
        headers={['Received', 'Method', 'Outcome', 'Gateway ref', 'Payment', 'Evidence']}
        rowCount={rows.length}
      >
        {rows.slice(0, 10).map((row) => (
          <tr id={`callback-attempt-${row.id}`} key={row.id}>
            <td>{row.createdAtLabel}</td>
            <td>{row.method}</td>
            <td>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.pillClass)}>{row.outcome}</StatusBadge>
              <div className="muted">{row.errorMessage ?? 'No processing error recorded.'}</div>
            </td>
            <td>
              {row.providerRef}
              <div className="muted">{row.gatewayTransactionId}</div>
            </td>
            <td>
              {row.paymentIdLabel ? (
                <>
                  {row.paymentIdLabel}
                  <div className="muted">{row.paymentStatus ?? 'UNKNOWN'}</div>
                  {row.bookingHref ? (
                    <a className="text-link" href={row.bookingHref}>
                      Open booking
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  Not linked
                  <div className="muted">Gateway reference did not match a saved payment.</div>
                </>
              )}
            </td>
            <td>
              <div className="setup-stage-list">
                <div className="setup-stage-item">
                  <StatusBadge tone="info">Signature</StatusBadge>
                  <div>
                    <strong>{row.signatureLabel}</strong>
                    <p className="muted">Mode: {row.verificationMode}</p>
                  </div>
                </div>
                <div className="setup-stage-item">
                  <StatusBadge tone="neutral">Gateway</StatusBadge>
                  <div>
                    <strong>{row.providerStatus}</strong>
                    <p className="muted">Amount: {row.amountLabel}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTablePanel>
  );
}
