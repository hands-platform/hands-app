import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlButton, AdminFormInput, AdminFormShell } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';

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
  readonly cashAccountingPreview: readonly ReactNode[];
  readonly cashAccountingPreviewText: readonly string[];
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
    <AdminTablePanel
      description="Cash bookings create a negative Partner wallet until the Partner deposits the HANDS fee or finance offsets it."
      resultLabel={`${items.length} blocked wallet(s)`}
      resultTone={items.length > 0 ? 'danger' : 'success'}
      title="Cash fee debt queue"
    >
      {items.length ? (
        <AdminTraceSummary
          defaultKind="risk"
          defaultScope="Open cash debt"
          metrics={[
            { label: 'Blocked wallets', value: String(items.length) },
            { label: 'Wallet debt', value: <MoneyText amount={totals.debtAmount} currency={currency} /> },
            { label: 'Booking cash', value: <MoneyText amount={totals.bookingAmount} currency={currency} /> },
            { label: 'HANDS fee', value: <MoneyText amount={totals.platformFee} currency={currency} /> },
            { label: 'Tax', value: <MoneyText amount={totals.taxAmount} currency={currency} /> },
          ]}
        />
      ) : null}
      {items.length ? (
        <AdminStageList>
          {items.slice(0, 12).map((item) => (
            <AdminStageItem key={item.earningId}>
              <span>DEBT</span>
              <div>
                <strong>{item.providerName}</strong>
                <p className="muted">
                  Owes <MoneyText amount={item.debtAmount} currency={item.currency} /> from booking{' '}
                  <AdminTextLink href={item.bookingHref}>
                    {item.bookingShortId}
                  </AdminTextLink>
                  {' / '}payment {item.paymentMethod}
                </p>
                <p className="muted">
                  Booking cash <MoneyText amount={item.bookingAmount} currency={item.currency} />
                  {' / '}HANDS fee <MoneyText amount={item.platformFee} currency={item.currency} />
                  {' / '}tax <MoneyText amount={item.taxAmount} currency={item.currency} />
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
                    {item.cashAccountingPreview.map((line, index) => (
                      <small key={`${item.earningId}-cash-accounting-${index}`}>{line}</small>
                    ))}
                  </div>
                ) : null}
                <p className="muted">
                  Settling this row records the Partner cash-fee debt as paid and can reopen final acceptance,
                  service start, and payout release once the wallet is non-negative.
                </p>
              </div>
              <div className="actions">
                <AdminTextLink href={item.partnerHref}>
                  Partner
                </AdminTextLink>
                <AdminFormShell action="/earnings">
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
                  <AdminFormControlButton className="button-primary" type="submit">
                    Review fee settlement
                  </AdminFormControlButton>
                </AdminFormShell>
              </div>
            </AdminStageItem>
          ))}
        </AdminStageList>
      ) : (
        <AdminEmptyState framed message="No Partner has unsettled cash fee debt in the current admin result window." />
      )}
    </AdminTablePanel>
  );
}
