import Link from 'next/link';

import { formatMoney } from '../../lib/admin-format';

export type EarningsCashDebtTotals = {
  readonly bookingAmount: number;
  readonly debtAmount: number;
  readonly platformFee: number;
  readonly taxAmount: number;
};

export type EarningsCashDebtQueueItem = {
  readonly bookingAmount: number;
  readonly bookingHref: string;
  readonly bookingShortId: string;
  readonly currency: string;
  readonly debtAmount: number;
  readonly earningId: string;
  readonly lastLedgerRef: string | null;
  readonly partnerHref: string;
  readonly paymentMethod: string;
  readonly platformFee: number;
  readonly providerName: string;
  readonly settlementChecklist: readonly string[];
  readonly settlementNotes: string;
  readonly settlementReference: string;
  readonly taxAmount: number;
};

type EarningsCashDebtQueueSectionProps = {
  readonly currency: string;
  readonly items: readonly EarningsCashDebtQueueItem[];
  readonly totals: EarningsCashDebtTotals;
};

export function EarningsCashDebtQueueSection({ currency, items, totals }: EarningsCashDebtQueueSectionProps) {
  return (
    <div className="card admin-mt-20">
      <div className="ops-section-header">
        <div>
          <h2>Cash fee debt queue</h2>
          <p className="muted">
            Cash bookings create a negative partner wallet until the partner deposits the HANDS fee or
            finance offsets it.
          </p>
        </div>
        <span className={items.length ? 'pill pill-danger' : 'pill pill-success'}>
          {items.length} blocked wallet(s)
        </span>
      </div>
      {items.length ? (
        <div className="service-trace-summary">
          <CashDebtMetric label="Blocked wallets" value={String(items.length)} />
          <CashDebtMetric amount={totals.debtAmount} currency={currency} label="Wallet debt" />
          <CashDebtMetric amount={totals.bookingAmount} currency={currency} label="Booking cash" />
          <CashDebtMetric amount={totals.platformFee} currency={currency} label="HANDS fee" />
          <CashDebtMetric amount={totals.taxAmount} currency={currency} label="Tax" />
        </div>
      ) : null}
      {items.length ? (
        <div className="setup-stage-list">
          {items.slice(0, 12).map((item) => (
            <div className="setup-stage-item" key={item.earningId}>
              <span>DEBT</span>
              <div>
                <strong>{item.providerName}</strong>
                <p className="muted">
                  Owes {formatMoney(item.debtAmount, item.currency)} from booking{' '}
                  <Link className="text-link" href={item.bookingHref}>
                    {item.bookingShortId}
                  </Link>
                  {' / '}payment {item.paymentMethod}
                </p>
                <p className="muted">
                  Booking cash {formatMoney(item.bookingAmount, item.currency)}
                  {' / '}HANDS fee {formatMoney(item.platformFee, item.currency)}
                  {' / '}tax {formatMoney(item.taxAmount, item.currency)}
                </p>
                <div className="service-matrix-cell">
                  {item.settlementChecklist.map((step) => (
                    <small key={step}>{step}</small>
                  ))}
                  <small>Suggested ref: {item.settlementReference}</small>
                  {item.lastLedgerRef ? <small>Last ledger ref: {item.lastLedgerRef}</small> : null}
                </div>
                <p className="muted">
                  Settling this row records the partner cash-fee debt as paid and can reopen final
                  acceptance, service start, and payout release once the wallet is non-negative.
                </p>
              </div>
              <div className="actions">
                <Link className="text-link" href={item.partnerHref}>
                  Partner
                </Link>
                <form action="/earnings">
                  <input type="hidden" name="confirm" value="mark-paid" />
                  <input type="hidden" name="earningId" value={item.earningId} />
                  <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
                  <input
                    aria-label="Settlement reference"
                    defaultValue={item.settlementReference}
                    name="settlementRef"
                    placeholder="Deposit ref or offset memo"
                  />
                  <input type="hidden" name="settlementNotes" value={item.settlementNotes} />
                  <button type="submit">Review fee settlement</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No partner has unsettled cash fee debt in the current admin result window.</p>
      )}
    </div>
  );
}

function CashDebtMetric({
  amount,
  currency,
  label,
  value,
}: {
  readonly amount?: number;
  readonly currency?: string;
  readonly label: string;
  readonly value?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value ?? formatMoney(amount ?? 0, currency ?? 'VND')}</strong>
    </div>
  );
}
