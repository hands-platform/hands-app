import type { ReactNode } from 'react';

export type PaymentDetailCallbackTimelineRow = {
  readonly amountLabel: string;
  readonly createdAtLabel: string;
  readonly errorCodeLabel: string;
  readonly errorMessage: string;
  readonly id: string;
  readonly outcome: string;
  readonly payloadDetails: ReactNode;
  readonly pillClass: string;
  readonly providerRef: string;
  readonly providerStatus: string;
  readonly signatureLabel: string;
  readonly verificationMode: string;
};

type PaymentDetailCallbackTimelineSectionProps = {
  readonly reviewCount: number;
  readonly rows: readonly PaymentDetailCallbackTimelineRow[];
};

export function PaymentDetailCallbackTimelineSection({ reviewCount, rows }: PaymentDetailCallbackTimelineSectionProps) {
  return (
    <section className="card admin-mb-16" id="callback-timeline">
      <div className="ops-section-header">
        <div>
          <h2>Gateway callback attempt timeline</h2>
          <p className="muted">
            Accepted, replayed, rejected, and conflicting callbacks connected to this payment or gateway reference.
          </p>
        </div>
        <span className={`pill ${reviewCount ? 'pill-warn' : 'pill-info'}`}>
          {reviewCount ? `${reviewCount} review` : 'Trace ready'}
        </span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Received</th>
            <th>Outcome</th>
            <th>Gateway evidence</th>
            <th>Error</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr id={`callback-attempt-${row.id}`} key={row.id}>
              <td>{row.createdAtLabel}</td>
              <td>
                <span className={`pill ${row.pillClass}`}>{row.outcome}</span>
                <div className="muted">Signature: {row.signatureLabel}</div>
              </td>
              <td>
                <strong>{row.providerRef}</strong>
                <div className="muted">Mode: {row.verificationMode}</div>
                <div className="muted">Gateway status: {row.providerStatus}</div>
                <div className="muted">Amount: {row.amountLabel}</div>
              </td>
              <td>
                {row.errorCodeLabel}
                <div className="muted">{row.errorMessage}</div>
              </td>
              <td>{row.payloadDetails}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No gateway callback attempts have been captured for this payment yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
