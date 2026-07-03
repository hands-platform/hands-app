import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
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
  readonly cashAccountingPreview: readonly string[];
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Cash bookings create a negative Partner wallet until the Partner deposits the HANDS fee or finance offsets it."
      resultLabel={`${items.length} blocked wallet(s)`}
      resultTone={items.length > 0 ? 'danger' : 'success'}
      title="Cash fee debt queue"
    >
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
                {item.cashAccountingPreview.length ? (
                  <div
                    className="admin-mini-ledger"
                    aria-label={`Cash accounting preview for ${item.earningId}`}
                  >
                    <span>Accounting preview</span>
                    {item.cashAccountingPreview.map((line) => (
                      <small key={`${item.earningId}-${line}`}>{line}</small>
                    ))}
                  </div>
                ) : null}
                <p className="muted">
                  Settling this row records the Partner cash-fee debt as paid and can reopen final acceptance,
                  service start, and payout release once the wallet is non-negative.
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
                  <AdminFormInput
                    defaultValue={item.settlementReference}
                    label="Settlement reference"
                    name="settlementRef"
                    placeholder="Deposit ref or offset memo"
                  />
                  <input type="hidden" name="settlementNotes" value={item.settlementNotes} />
                  <AdminFormControlButton className="btn btn-primary" type="submit">
                    Review fee settlement
                  </AdminFormControlButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No Partner has unsettled cash fee debt in the current admin result window.</p>
      )}
    </AdminFilterPanel>
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
