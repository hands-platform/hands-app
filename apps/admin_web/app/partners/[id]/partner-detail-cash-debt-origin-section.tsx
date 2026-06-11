import Link from 'next/link';

export type PartnerCashDebtOriginRow = {
  readonly amountLabel: string;
  readonly bookingHref?: string;
  readonly bookingLabel: string;
  readonly createdLabel: string;
  readonly evidenceLabel: string;
  readonly handsFeeLabel: string;
  readonly id: string;
  readonly originLabel: string;
  readonly paymentMethod: string;
  readonly taxLabel: string;
};

type PartnerDetailCashDebtOriginSectionProps = {
  readonly hasCashFeeDebt: boolean;
  readonly hasSettlementRef: boolean;
  readonly openDebtLabel: string;
  readonly openRowCount: number;
  readonly rows: readonly PartnerCashDebtOriginRow[];
};

export function PartnerDetailCashDebtOriginSection({
  hasCashFeeDebt,
  hasSettlementRef,
  openDebtLabel,
  openRowCount,
  rows,
}: PartnerDetailCashDebtOriginSectionProps) {
  return (
    <div className={`card ${hasCashFeeDebt ? 'card-danger' : ''} admin-mb-16`} id="cash-debt-origin">
      <div className="ops-section-header">
        <div>
          <h2>Cash debt origin and settlement</h2>
          <p className="muted">
            Partner wallet debt is reviewed by why it became negative and whether a company-fee deposit or
            approved offset has evidence. Marketplace visibility is not logged here; direct
            first-pick and already-matched service flow are not retroactively blocked by wallet debt.
          </p>
        </div>
        <span className={`pill ${hasCashFeeDebt ? 'pill-danger' : 'pill-success'}`}>
          {hasCashFeeDebt ? `${openRowCount} open row(s)` : 'No open cash debt'}
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Total open debt</span>
          <strong>{openDebtLabel}</strong>
          <small>From cash-service fee/tax settlement rows.</small>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{hasSettlementRef ? 'Some refs' : 'Needs ref'}</strong>
          <small>Deposit reference or admin offset is required to clear debt.</small>
        </div>
        <div>
          <span>Marketplace</span>
          <strong>{hasCashFeeDebt ? 'Participation blocked' : 'Participation open'}</strong>
          <small>Partner can view marketplace requests; marketplace alerts and booking participation are blocked.</small>
        </div>
        <div>
          <span>Direct first-pick</span>
          <strong>Not wallet-blocked</strong>
          <small>Use account, KYC, bank, location, push, and pricing gates for direct flow.</small>
        </div>
        <div>
          <span>Payout release</span>
          <strong>{hasCashFeeDebt ? 'Held' : 'Open'}</strong>
          <small>Finance should not release payout while HANDS fee/tax debt is open.</small>
        </div>
        <div>
          <span>Next action</span>
          <strong>{hasCashFeeDebt ? 'Collect/offset' : 'Monitor'}</strong>
          <small>
            {hasCashFeeDebt ? 'Use Cash Settlements to clear the wallet.' : 'No finance action needed.'}
          </small>
        </div>
      </div>
      {rows.length ? (
        <div className="setup-stage-list admin-mt-16">
          {rows.map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span>CASH DEBT</span>
              <div>
                <strong>{row.amountLabel}</strong>
                <p className="muted">{row.originLabel}</p>
                <p className="muted">
                  Booking {row.bookingLabel} / payment {row.paymentMethod} / created {row.createdLabel}
                </p>
                <p className="muted">
                  Marketplace reopen rule: once deposit reference or admin offset clears this debt, the
                  partner can participate in marketplace bookings again.
                </p>
                <div className="participant-list">
                  <span className="pill pill-danger">HANDS fee {row.handsFeeLabel}</span>
                  <span className="pill pill-warn">Tax {row.taxLabel}</span>
                  <span className="pill pill-info">{row.evidenceLabel}</span>
                  <span className="pill pill-info">Direct first-pick not wallet-blocked</span>
                </div>
              </div>
              <div className="button-row">
                {row.bookingHref ? (
                  <Link className="text-link" href={row.bookingHref}>
                    Booking evidence
                  </Link>
                ) : null}
                <Link className="text-link" href="/cash-settlements">
                  Settle
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted admin-mt-12">
          No open cash-service fee debt is visible for this partner.
        </p>
      )}
    </div>
  );
}
