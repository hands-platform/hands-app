import Link from 'next/link';

import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import { PillClassBadge } from '../../components/status-badge';
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
  readonly showOperationsEvidence?: boolean;
};

export function CashSettlementOpenDebtTableSection({
  filters,
  pagination,
  showOperationsEvidence = false,
}: CashSettlementOpenDebtTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Settle only after confirming a Partner deposit or a documented admin offset. The backend rejects missing references."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'warning' : 'success'}
      title="Open cash fee debt rows"
    >
      <div className="participant-list admin-mb-12">
        <Link className="text-link" href="/payments?review=cash-debt">
          Payment debt view
        </Link>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
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
                {showOperationsEvidence && row.cashAccountingPreview.length ? (
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
                {showOperationsEvidence && row.walletDeductionBreakdown.length ? (
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
                {showOperationsEvidence ? (
                  <div className="ops-task-note admin-mt-10">
                    <strong>Cash settlement action execution map</strong>
                    <div className="setup-stage-list admin-mt-8">
                      {row.actionRows.map((item) => (
                        <div className="setup-stage-item" key={`${row.earningId}-${item.action}`}>
                          <PillClassBadge pillClass={item.pillClass}>{item.status}</PillClassBadge>
                          <div>
                            <strong>{item.action}</strong>
                            <p className="muted">{item.reason}</p>
                            <small>{item.operatorRule}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </td>
              <td>
                {showOperationsEvidence ? (
                  <>
                    <form action={recordPartnerBankDeposit} className="inline-form">
                      <input type="hidden" name="providerProfileId" value={row.providerProfileId} />
                      <AdminFormInput
                        defaultValue={row.depositAmountDefault}
                        label="Deposit amount"
                        min="1"
                        name="amount"
                        required
                        step="1"
                        type="number"
                      />
                      <AdminFormInput
                        defaultValue={row.settlementReference}
                        label="Bank transaction id"
                        name="bankTransactionId"
                        placeholder="Bank transaction id"
                        required
                      />
                      <AdminFormInput label="Deposit date" name="depositDate" required type="datetime-local" />
                      <AdminFormInput label="Bank account" name="bankAccount" placeholder="Bank account" />
                      <AdminFormInput
                        label="Attachment evidence"
                        name="attachmentUrl"
                        placeholder="Evidence file URL"
                        required
                      />
                      <AdminFormInput
                        defaultValue={row.settlementNotesDefault}
                        label="Deposit notes"
                        name="notes"
                        placeholder="Deposit notes"
                      />
                      <AdminFormInput
                        label="Finance approver id"
                        name="approvalAdminId"
                        placeholder="Finance approver admin id"
                        required
                      />
                      <AdminFormControlButton className="btn btn-primary" type="submit">
                        Record bank deposit
                      </AdminFormControlButton>
                    </form>
                    <p className="muted admin-mt-8">
                      Partner deposit is not platform revenue. It first settles negative wallet receivable,
                      then becomes partner wallet liability.
                    </p>
                  </>
                ) : null}
                <form action="/cash-settlements" className="inline-form">
                  <input type="hidden" name="confirm" value="settle" />
                  <input type="hidden" name="earningId" value={row.earningId} />
                  <AdminFormSelect
                    defaultValue={row.settlementMethodDefault}
                    label="Settlement method"
                    name="settlementMethod"
                    options={[
                      { label: 'Partner deposit', value: 'PARTNER_DEPOSIT' },
                      { label: 'Admin offset', value: 'ADMIN_OFFSET' },
                    ]}
                  />
                  <AdminFormInput
                    defaultValue={row.settlementReference}
                    label="Settlement reference"
                    name="settlementRef"
                    placeholder="Bank deposit ref or admin offset"
                  />
                  <AdminFormInput
                    defaultValue={row.settlementNotesDefault}
                    label="Settlement notes"
                    name="settlementNotes"
                    placeholder="Evidence note"
                  />
                  <AdminFormControlButton className="btn btn-outline" type="submit">
                    Review settlement
                  </AdminFormControlButton>
                </form>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
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
    </AdminFilterPanel>
  );
}
