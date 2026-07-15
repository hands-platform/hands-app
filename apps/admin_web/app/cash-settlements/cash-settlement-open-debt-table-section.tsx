import type { ReactNode } from 'react';

import { AdminTablePaginationFooter } from '../../components/admin-data-table';

import { ActionMenu } from '../../components/action-menu';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminInlineForm } from '../../components/admin-inline-action-form';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminNotePanel } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import { FinanceDataTable } from '../finance-tax/finance-data-table';
import { recordPartnerBankDeposit } from './actions';
import { cashSettlementHref } from './cash-settlement-page-filters';
import type { CashSettlementFilters, CashSettlementPagination } from './cash-settlement-page-types';

export type CashSettlementOpenDebtActionExecutionRow = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: ReactNode;
  readonly status: string;
};

export type CashSettlementOpenDebtTableRow = {
  readonly actionRows: readonly CashSettlementOpenDebtActionExecutionRow[];
  readonly bookingAmount: number;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly cashAccountingPreview: readonly ReactNode[];
  readonly cashCouponOffsetAmount: number | null;
  readonly createdAtLabel: string;
  readonly currency: string;
  readonly debtAmount: number;
  readonly depositAmountDefault: string;
  readonly debtOrigin: string;
  readonly earningId: string;
  readonly lastLedgerRef: string | null;
  readonly nextAction: string;
  readonly partnerHref: string;
  readonly paymentMethod: string;
  readonly platformFee: number;
  readonly providerProfileId: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly serviceLabel: string;
  readonly settlementEvidence: string;
  readonly settlementMethodDefault: string;
  readonly settlementMethodLabel: string;
  readonly settlementNotesDefault: string;
  readonly settlementReference: string;
  readonly taxAmount: number;
  readonly walletDeductionBreakdown: readonly ReactNode[];
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
    <AdminTablePanel
      description="Approved Partner deposits are allocated from their immutable deposit detail. Direct settlement here is reserved for documented admin offsets."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'warning' : 'success'}
      title="Open cash fee debt rows"
    >
      <AdminFilterChipGroup ariaLabel="Open cash debt links" className="admin-mb-12">
        <AdminTextLink href="/payments?review=cash-debt">
          Payment debt view
        </AdminTextLink>
        <AdminTextLink href="/finance-tax/partner-bank-deposits">
          Partner deposit history
        </AdminTextLink>
      </AdminFilterChipGroup>
      <FinanceDataTable
        emptyMessage="No cash fee debt is waiting for settlement."
        headers={['Partner', 'Booking', 'Debt', 'Fee / Tax', 'Evidence', 'Settlement']}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.earningId}>
            <td>
              <strong>{row.providerName}</strong>
              <div className="muted">{row.providerPhone}</div>
              <AdminFilterChipGroup ariaLabel={`${row.providerName} debt status actions`} className="admin-mt-8">
                <ActionMenu
                  actions={[{ href: row.partnerHref, kind: 'link', label: 'Partner', tone: 'info' }]}
                  label={`${row.providerName} partner actions`}
                />
                <StatusBadge tone="danger">Final acceptance blocked</StatusBadge>
              </AdminFilterChipGroup>
            </td>
            <td>
              <AdminTextLink href={row.bookingHref}>
                {row.bookingLabel}
              </AdminTextLink>
              <div className="muted">{row.createdAtLabel}</div>
              <div className="muted">{row.serviceLabel}</div>
            </td>
            <td>
              <strong>
                <MoneyText amount={row.debtAmount} currency={row.currency} />
              </strong>
              <div className="muted">
                Cash collected: <MoneyText amount={row.bookingAmount} currency={row.currency} />
              </div>
              {row.cashCouponOffsetAmount ? (
                <div className="muted">
                  Company coupon offset: <MoneyText amount={row.cashCouponOffsetAmount} currency={row.currency} />
                </div>
              ) : null}
              <div className="muted">{row.debtOrigin}</div>
              {showOperationsEvidence && row.cashAccountingPreview.length ? (
                <div
                  className="admin-mini-ledger"
                  aria-label={`Cash accounting preview for ${row.earningId}`}
                >
                  <span>Accounting preview</span>
                  {row.cashAccountingPreview.map((item, index) => (
                    <small key={`${row.earningId}-cash-accounting-${index}`}>{item}</small>
                  ))}
                </div>
              ) : null}
            </td>
            <td>
              <div>
                HANDS fee <MoneyText amount={row.platformFee} currency={row.currency} />
              </div>
              <div className="muted">
                Tax <MoneyText amount={row.taxAmount} currency={row.currency} />
              </div>
              {showOperationsEvidence && row.walletDeductionBreakdown.length ? (
                <div className="service-matrix-cell admin-mt-8">
                  {row.walletDeductionBreakdown.map((item, index) => (
                    <small key={`${row.earningId}-wallet-deduction-${index}`}>{item}</small>
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
                <AdminNotePanel className="admin-mt-10">
                  <strong>Cash settlement action execution map</strong>
                  <AdminStageList className="admin-mt-8">
                    {row.actionRows.map((item) => (
                      <AdminStageItem key={`${row.earningId}-${item.action}`}>
                        <StatusBadgeFromPillClass pillClass={item.pillClass}>{item.status}</StatusBadgeFromPillClass>
                        <div>
                          <strong>{item.action}</strong>
                          <p className="muted">{item.reason}</p>
                          <small>{item.operatorRule}</small>
                        </div>
                      </AdminStageItem>
                    ))}
                  </AdminStageList>
                </AdminNotePanel>
              ) : null}
            </td>
            <td>
              {showOperationsEvidence ? (
                <>
                  <AdminInlineForm action={recordPartnerBankDeposit}>
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
                    <AdminFormDateTime label="Deposit date" name="depositDate" required />
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
                    <AdminFormControlButton className="button-primary" type="submit">
                      Request bank deposit approval
                    </AdminFormControlButton>
                  </AdminInlineForm>
                  <p className="muted admin-mt-8">
                    This creates an immutable request. A different finance approver must execute it before
                    the wallet, GL, or audit settlement evidence changes.
                  </p>
                </>
              ) : null}
              <AdminInlineForm action="/cash-settlements">
                <input type="hidden" name="confirm" value="settle" />
                <input type="hidden" name="earningId" value={row.earningId} />
                <AdminFormSelect
                  defaultValue="ADMIN_OFFSET"
                  label="Settlement method"
                  name="settlementMethod"
                  options={[{ label: 'Admin offset', value: 'ADMIN_OFFSET' }]}
                />
                <AdminFormInput
                  defaultValue={row.settlementReference}
                  label="Settlement reference"
                  name="settlementRef"
                  placeholder="Approved admin offset reference"
                />
                <AdminFormInput
                  defaultValue={`Admin offset review for cash debt ${row.earningId}`}
                  label="Settlement notes"
                  name="settlementNotes"
                  placeholder="Evidence note"
                />
                <AdminFormControlButton className="button-outline" type="submit">
                  Review settlement
                </AdminFormControlButton>
              </AdminInlineForm>
              <AdminFormControlLink
                className="button-secondary admin-mt-8"
                href={`/finance-tax/partner-bank-deposits?${new URLSearchParams({ q: row.providerProfileId }).toString()}`}
              >
                Allocate approved deposit
              </AdminFormControlLink>
            </td>
          </tr>
        ))}
      </FinanceDataTable>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Cash settlement debt pages"
        from={pagination.from}
        hrefForPage={(page) =>
          cashSettlementHref({
            page,
            pageSize: filters.pageSize,
            q: filters.q,
            queue: filters.queue,
            range: filters.range,
          })
        }
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}
