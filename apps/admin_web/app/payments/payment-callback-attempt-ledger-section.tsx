import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Accepted, replayed, rejected, and conflicting gateway callbacks. Unknown gateway references remain visible here even when they cannot attach to a payment row."
        status={<span className="pill pill-info">{rows.length} attempt(s)</span>}
        title="Payment callback attempt ledger"
      />
      <AdminDataTable
        emptyMessage="No callback attempts match this queue."
        headers={['Received', 'Method', 'Outcome', 'Gateway ref', 'Payment', 'Evidence']}
        rowCount={rows.length}
      >
        {rows.slice(0, 10).map((row) => (
          <tr id={`callback-attempt-${row.id}`} key={row.id}>
            <td>{row.createdAtLabel}</td>
            <td>{row.method}</td>
            <td>
              <span className={`pill ${row.pillClass}`}>{row.outcome}</span>
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
                  <span className="pill pill-info">Signature</span>
                  <div>
                    <strong>{row.signatureLabel}</strong>
                    <p className="muted">Mode: {row.verificationMode}</p>
                  </div>
                </div>
                <div className="setup-stage-item">
                  <span className="pill pill-neutral">Gateway</span>
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
    </section>
  );
}
