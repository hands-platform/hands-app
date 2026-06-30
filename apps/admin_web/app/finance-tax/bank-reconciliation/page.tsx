import Link from 'next/link';
import { redirect } from 'next/navigation';

import type { AdminBankReconciliationSummary, AdminCompanyBankTransaction } from '../../../lib/admin-api';
import { adminGet, adminPostOrThrow } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
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
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, BANK_RECONCILIATION_REVIEW_LINKS)}.`}
          status={<span className="pill pill-success">{pagination.pageSize} per page</span>}
          title="Bank reconciliation filters"
        />
        <div className="participant-list admin-mt-12">
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
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Create one bank statement row from manual evidence. Imported rows start unmatched and can be reconciled from the transaction detail page."
          title="Manual bank transaction import"
        />
        <form action={createCompanyBankTransactionAction} className="form-grid compact-form admin-mt-16">
          <input
            name="redirectTo"
            type="hidden"
            value={bankReconciliationHref({ ...filters, page: 1, review: 'unmatched' })}
          />
          <label>
            Approving admin ID
            <input className="form-input" name="approvalAdminId" required />
          </label>
          <label>
            Bank account ID
            <input className="form-input" name="bankAccountId" required />
          </label>
          <label>
            Type
            <select className="form-input" name="type" required defaultValue="INFLOW">
              <option value="INFLOW">Inflow</option>
              <option value="OUTFLOW">Outflow</option>
            </select>
          </label>
          <label>
            Amount
            <input className="form-input" inputMode="numeric" min={1} name="amount" required type="number" />
          </label>
          <label>
            Occurred at
            <input className="form-input" name="occurredAt" required type="datetime-local" />
          </label>
          <label>
            Value date
            <input className="form-input" name="valueDate" type="date" />
          </label>
          <label>
            Transfer reference
            <input className="form-input" name="transferRef" />
          </label>
          <label>
            Counterparty
            <input className="form-input" name="counterpartyName" />
          </label>
          <label className="form-grid-wide">
            Description
            <textarea className="form-input" name="description" rows={2} />
          </label>
          <div className="form-actions form-grid-wide">
            <button className="btn btn-primary" type="submit">
              Import bank transaction
            </button>
          </div>
        </form>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="The list keeps match details collapsed. Use transfer reference, bank account, and source key to open the related evidence only when needed."
          title="Company bank transactions"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No bank transactions match the current filters."
            headers={[
              'Transaction',
              'Bank account',
              'Counterparty',
              'Amount',
              'Value date',
              'Match',
              'Status',
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
      </section>
    </AdminPageTemplate>
  );
}

async function createCompanyBankTransactionAction(formData: FormData) {
  'use server';

  const redirectTo = String(formData.get('redirectTo') ?? '/finance-tax/bank-reconciliation');
  const occurredAt = formDateTimeToIso(formData.get('occurredAt'));
  const valueDate = String(formData.get('valueDate') ?? '').trim();
  await adminPostOrThrow('/admin/bank-reconciliation/transactions', {
    amount: Number(formData.get('amount')),
    approvalAdminId: String(formData.get('approvalAdminId') ?? '').trim(),
    bankAccountId: String(formData.get('bankAccountId') ?? '').trim(),
    counterpartyName: String(formData.get('counterpartyName') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    occurredAt,
    transferRef: String(formData.get('transferRef') ?? '').trim() || null,
    type: String(formData.get('type') ?? 'INFLOW').trim(),
    valueDate: valueDate ? `${valueDate}T00:00:00.000Z` : null,
  });
  redirect(redirectTo);
}

function formDateTimeToIso(value: FormDataEntryValue | null) {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }
  return new Date(input).toISOString();
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
