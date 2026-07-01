import Link from 'next/link';
import { redirect } from 'next/navigation';

import type { AdminBankReconciliationSummary, AdminCompanyBankTransaction } from '../../../lib/admin-api';
import { adminGet, adminPostOrThrow } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  BANK_RECONCILIATION_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  bankReconciliationDetailHref,
  bankReconciliationHref,
  buildBankReconciliationApiHref,
  buildBankReconciliationSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBankReconciliationSummary,
  financeAccountingReviewLabel,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type BankReconciliationPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

export default async function BankReconciliationPage({ searchParams }: BankReconciliationPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'unmatched');
  const importNotice = readParam(params, 'bankImported');
  const importError = readParam(params, 'bankImportError');
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, transactions] = await Promise.all([
    adminGet<AdminBankReconciliationSummary>(
      buildBankReconciliationSummaryApiHref(filters),
      emptyBankReconciliationSummary(),
    ),
    adminGet<AdminCompanyBankTransaction[]>(buildBankReconciliationApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(transactions, filters, summary.count);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters: filters,
            current: 'bank-reconciliation',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Company bank transaction lookup for manual reconciliation against payments, withdrawals, payout batches, and accounting evidence."
      metrics={[
        {
          helper: 'Bank transactions matching the current filters.',
          label: 'Transactions',
          value: summary.count,
        },
        {
          helper: 'Transactions that still need matching.',
          label: 'Unmatched',
          value: summary.unmatchedCount,
        },
        {
          helper: 'Transactions already matched to accounting evidence.',
          label: 'Matched',
          value: summary.matchedCount,
        },
        {
          helper: 'Total amount in the selected bank transaction scope.',
          label: 'Amount',
          value: formatMoney(summary.amount, summary.currency),
        },
      ]}
      title="Bank Reconciliation"
    >
      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, BANK_RECONCILIATION_REVIEW_LINKS)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Bank reconciliation filters"
      >
        <div className="participant-list">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={bankReconciliationHref({ ...filters, page: 1, range })}
              key={range}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {BANK_RECONCILIATION_REVIEW_LINKS.map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={bankReconciliationHref({ ...filters, page: 1, review: item.review })}
              key={item.review}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => (
            <Link
              className={`pill ${filters.take === take ? 'pill-success' : 'pill-neutral'}`}
              href={bankReconciliationHref({ ...filters, page: 1, take })}
              key={take}
            >
              {take} rows
            </Link>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Create one bank statement row from manual evidence. Imported rows start unmatched and can be reconciled from the transaction detail page."
        resultLabel={importNotice === '1' ? 'Bank transaction imported' : importError ? 'Import failed' : undefined}
        resultTone={importNotice === '1' ? 'success' : importError ? 'danger' : 'info'}
        title="Manual bank transaction import"
      >
        {importError ? (
          <p className="muted admin-mt-8">
            Bank transaction import failed. Check approval admin, bank account, type, amount, and occurred date before
            trying again.
          </p>
        ) : null}
        <form action={createCompanyBankTransactionAction} className="form-grid compact-form admin-mt-16">
          <input
            name="redirectTo"
            type="hidden"
            value={bankReconciliationHref({ ...filters, page: 1, review: 'unmatched' })}
          />
          <AdminFormInput label="Approving admin ID" name="approvalAdminId" required />
          <AdminFormInput label="Bank account ID" name="bankAccountId" required />
          <AdminFormSelect
            defaultValue="INFLOW"
            label="Type"
            name="type"
            options={[
              { label: 'Inflow', value: 'INFLOW' },
              { label: 'Outflow', value: 'OUTFLOW' },
            ]}
          />
          <AdminFormInput label="Amount" min={1} name="amount" required step={1} type="number" />
          <AdminFormInput label="Occurred at" name="occurredAt" required type="datetime-local" />
          <AdminFormInput label="Value date" name="valueDate" type="date" />
          <AdminFormInput label="Transfer reference" name="transferRef" />
          <AdminFormInput label="Counterparty" name="counterpartyName" />
          <AdminFormTextarea className="admin-grid-span-2" label="Description" name="description" rows={2} />
          <div className="form-actions form-grid-wide">
            <AdminFormControlButton className="button button-primary">
              Import bank transaction
            </AdminFormControlButton>
          </div>
        </form>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="The list keeps match details collapsed. Use transfer reference, bank account, and source key to open the related evidence only when needed."
        resultLabel={`${pagination.totalRows} transaction(s)`}
        resultTone="info"
        title="Company bank transactions"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No bank transactions match the current filters."
            headers={[
              'Transaction',
              'Bank account',
              'Counterparty',
              'Amount',
              'Value date',
              'Match',
              'Status',
              'Evidence',
            ]}
            rowCount={pagination.rows.length}
          >
            {pagination.rows.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <Link className="text-link" href={bankReconciliationDetailHref(transaction.id)}>
                    <strong>{transaction.transferRef ?? shortId(transaction.sourceKey)}</strong>
                  </Link>
                  <div className="muted">{transaction.type}</div>
                  <div className="muted">{shortId(transaction.id)}</div>
                </td>
                <td>
                  <strong>{transaction.bankAccount?.name ?? 'Unknown account'}</strong>
                  <div className="muted">{transaction.bankAccount?.bankName ?? '-'}</div>
                  <div className="muted">
                    {transaction.bankAccount?.accountNumberMasked ??
                      transaction.bankAccount?.accountNumberLast4 ??
                      '-'}
                  </div>
                </td>
                <td>
                  <strong>{transaction.counterpartyName ?? '-'}</strong>
                  <div className="muted">{transaction.description ?? '-'}</div>
                </td>
                <td>
                  <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
                  <div className="muted">
                    {transaction.type === 'INFLOW' ? 'Bank inflow' : 'Bank outflow'}
                  </div>
                </td>
                <td>
                  <strong>{formatDateTime(transaction.occurredAt)}</strong>
                  {transaction.valueDate ? (
                    <div className="muted">Value {formatDateTime(transaction.valueDate)}</div>
                  ) : null}
                </td>
                <td>
                  <strong>{transaction._count?.reconciliationMatches ?? 0} match</strong>
                  <div className="muted">{shortId(transaction.sourceKey)}</div>
                </td>
                <td>
                  <span className={`pill ${statusPill(transaction.status)}`}>{transaction.status}</span>
                </td>
                <td>
                  <Link className="pill pill-info" href={bankReconciliationDetailHref(transaction.id)}>
                    Open detail
                  </Link>
                  <div className="muted">{transaction._count?.reconciliationMatches ?? 0} match</div>
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
            ariaLabel="Bank reconciliation pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => bankReconciliationHref({ ...filters, page })}
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

async function createCompanyBankTransactionAction(formData: FormData) {
  'use server';

  const redirectTo = String(formData.get('redirectTo') ?? '/finance-tax/bank-reconciliation');
  const occurredAt = formDateTimeToIso(formData.get('occurredAt'));
  const valueDate = String(formData.get('valueDate') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const approvalAdminId = String(formData.get('approvalAdminId') ?? '').trim();
  const bankAccountId = String(formData.get('bankAccountId') ?? '').trim();
  const type = String(formData.get('type') ?? 'INFLOW').trim();

  if (
    !approvalAdminId ||
    !bankAccountId ||
    !isBankTransactionType(type) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !occurredAt
  ) {
    redirect(appendQueryParam(redirectTo, 'bankImportError', 'invalid'));
  }

  try {
    await adminPostOrThrow('/admin/bank-reconciliation/transactions', {
      amount,
      approvalAdminId,
      bankAccountId,
      counterpartyName: String(formData.get('counterpartyName') ?? '').trim() || null,
      description: String(formData.get('description') ?? '').trim() || null,
      occurredAt,
      transferRef: String(formData.get('transferRef') ?? '').trim() || null,
      type,
      valueDate: valueDate ? `${valueDate}T00:00:00.000Z` : null,
    });
  } catch {
    redirect(appendQueryParam(redirectTo, 'bankImportError', 'failed'));
  }

  redirect(appendQueryParam(redirectTo, 'bankImported', '1'));
}

function formDateTimeToIso(value: FormDataEntryValue | null) {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function statusPill(status: string) {
  if (status === 'MATCHED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_MATCHED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function isBankTransactionType(value: string) {
  return value === 'INFLOW' || value === 'OUTFLOW';
}

function appendQueryParam(href: string, key: string, value: string) {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
