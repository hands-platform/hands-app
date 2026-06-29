import Link from 'next/link';

import { AdminDataTable } from '../../components/admin-data-table';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import { recordPartnerBankDeposit } from './actions';
import { cashSettlementHref } from './cash-settlement-page-filters';
import type { CashSettlementFilters, CashSettlementPagination } from './cash-settlement-page-types';

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
  readonly cashAccountingPreview: readonly string[];
  readonly cashCouponOffsetLabel: string | null;
  readonly createdAtLabel: string;
  readonly debtAmountLabel: string;
  readonly depositAmountDefault: string;
  readonly debtOrigin: string;
  readonly earningId: string;
  readonly lastLedgerRef: string | null;
  readonly nextAction: string;
  readonly partnerHref: string;
  readonly paymentMethod: string;
  readonly platformFeeLabel: string;
  readonly providerProfileId: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly serviceLabel: string;
  readonly settlementEvidence: string;
  readonly settlementMethodDefault: string;
  readonly settlementMethodLabel: string;
  readonly settlementNotesDefault: string;
  readonly settlementReference: string;
  readonly taxAmountLabel: string;
  readonly walletDeductionBreakdown: readonly string[];
};

type CashSettlementOpenDebtTableSectionProps = {
  readonly filters: CashSettlementFilters;
  readonly pagination: CashSettlementPagination<CashSettlementOpenDebtTableRow>;
};

export function CashSettlementOpenDebtTableSection({
  filters,
  pagination,
}: CashSettlementOpenDebtTableSectionProps) {
  const rows = pagination.rows;

  return (
    <div className="card admin-card-scroll">
      <div className="ops-section-header">
        <div>
          <h2>Open cash fee debt rows</h2>
          <p className="muted">
            Settle only after confirming a Partner deposit or a documented admin offset. The backend rejects
            missing references.
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
              {row.cashCouponOffsetLabel ? (
                <div className="muted">Company coupon offset: {row.cashCouponOffsetLabel}</div>
              ) : null}
              <div className="muted">{row.debtOrigin}</div>
              {row.cashAccountingPreview.length ? (
                <div
                  className="admin-mini-ledger"
                  aria-label={`Cash accounting preview for ${row.earningId}`}
                >
                  <span>Accounting preview</span>
                  {row.cashAccountingPreview.map((item) => (
                    <small key={`${row.earningId}-${item}`}>{item}</small>
                  ))}
                </div>
              ) : null}
            </td>
            <td>
              <div>HANDS fee {row.platformFeeLabel}</div>
              <div className="muted">Tax {row.taxAmountLabel}</div>
              {row.walletDeductionBreakdown.length ? (
                <div className="service-matrix-cell admin-mt-8">
                  {row.walletDeductionBreakdown.map((item) => (
                    <small key={`${row.earningId}-${item}`}>{item}</small>
                  ))}
                </div>
              ) : null}
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
              <form action={recordPartnerBankDeposit} className="inline-form">
                <input type="hidden" name="providerProfileId" value={row.providerProfileId} />
                <input
                  aria-label="Deposit amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={row.depositAmountDefault}
                  required
                />
                <input
                  aria-label="Bank transaction id"
                  name="bankTransactionId"
                  placeholder="Bank transaction id"
                  defaultValue={row.settlementReference}
                  required
                />
                <input aria-label="Deposit date" name="depositDate" type="datetime-local" required />
                <input aria-label="Bank account" name="bankAccount" placeholder="Bank account" />
                <input
                  aria-label="Attachment evidence"
                  name="attachmentUrl"
                  placeholder="Evidence file URL"
                  required
                />
                <input
                  aria-label="Deposit notes"
                  name="notes"
                  placeholder="Deposit notes"
                  defaultValue={row.settlementNotesDefault}
                />
                <button type="submit">Record bank deposit</button>
              </form>
              <p className="muted admin-mt-8">
                Partner deposit is not platform revenue. It first settles negative wallet receivable, then
                becomes partner wallet liability.
              </p>
              <form action="/cash-settlements" className="inline-form">
                <input type="hidden" name="confirm" value="settle" />
                <input type="hidden" name="earningId" value={row.earningId} />
                <select
                  aria-label="Settlement method"
                  name="settlementMethod"
                  defaultValue={row.settlementMethodDefault}
                >
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
      <div className="vuexy-booking-table-footer">
        <span>
          Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
        </span>
        <AdminRoundedPagination
          activePage={pagination.page}
          ariaLabel="Cash settlement debt pages"
          className="vuexy-booking-pagination"
          hrefForPage={(page) =>
            cashSettlementHref({
              page,
              pageSize: filters.pageSize,
              q: filters.q,
              queue: filters.queue,
              range: filters.range,
            })
          }
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={pagination.totalPages}
        />
      </div>
    </div>
  );
}
