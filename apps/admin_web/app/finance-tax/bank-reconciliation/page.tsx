import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Landmark, ReceiptText } from 'lucide-react';
import { redirect } from 'next/navigation';

import type {
  AdminBankReconciliationSummary,
  AdminCompanyBankAccount,
  AdminCompanyBankTransaction,
} from '../../../lib/admin-api';
import { adminGet, adminPostOrThrow } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormActionRow,
  AdminFormDate,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDisclosure } from '../../../components/admin-surface';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import { formatDateTime, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { financeBankReconciliationStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
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

export default async function BankReconciliationPage({ searchParams }: BankReconciliationPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'unmatched');
  const importNotice = readParam(params, 'bankImported');
  const importError = readParam(params, 'bankImportError');
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, transactions, companyBankAccounts] = await Promise.all([
    adminGet<AdminBankReconciliationSummary>(
      buildBankReconciliationSummaryApiHref(filters),
      emptyBankReconciliationSummary(),
    ),
    adminGet<AdminCompanyBankTransaction[]>(buildBankReconciliationApiHref(filters), []),
    adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ACTIVE', []),
  ]);
  const pagination = buildTaxSettlementServerPagination(transactions, filters, summary.count);
  const shouldOpenImportDisclosure = importNotice === '1' || Boolean(importError);
  const bankAccountOptions = companyBankAccounts.length
    ? companyBankAccounts.map((account) => ({
        label: companyBankAccountOptionLabel(account),
        value: account.id,
      }))
    : [{ label: 'No active company bank account', value: '' }];

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
          value: <MoneyText amount={summary.amount} currency={summary.currency} />,
        },
      ]}
      title="Bank Reconciliation"
    >
      <FinanceListCommandBoard ariaLabel="Bank command board">
        <FinanceListCommandCard
          detail={`${summary.unmatchedCount} bank transaction(s) still need source evidence matching.`}
          href={bankReconciliationHref({ ...filters, page: 1, review: 'unmatched' })}
          icon={AlertTriangle}
          label="Unmatched ratio"
          tone={summary.unmatchedCount > 0 ? 'danger' : 'success'}
          value={formatFinancePercent(summary.unmatchedCount, summary.count)}
        />
        <FinanceListCommandCard
          detail={`${summary.matchedCount} bank transaction(s) already matched to accounting evidence.`}
          href={bankReconciliationHref({ ...filters, page: 1, review: 'matched' })}
          icon={CheckCircle2}
          label="Matched ratio"
          tone={summary.matchedCount > 0 ? 'success' : 'neutral'}
          value={formatFinancePercent(summary.matchedCount, summary.count)}
        />
        <FinanceListCommandCard
          detail="Total bank statement amount in the selected reconciliation scope."
          href={bankReconciliationHref({ ...filters, page: 1 })}
          icon={Landmark}
          label="Bank amount"
          tone={summary.amount > 0 ? 'primary' : 'neutral'}
          value={<MoneyText amount={summary.amount} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Open transaction detail to match bank money against clearing, journal, withdrawal, or payout evidence."
          href={
            summary.unmatchedCount > 0
              ? bankReconciliationHref({ ...filters, page: 1, review: 'unmatched' })
              : '/finance-overview'
          }
          icon={ReceiptText}
          label="Match status"
          tone={summary.unmatchedCount > 0 ? 'warning' : 'success'}
          value={summary.unmatchedCount > 0 ? 'Needs match' : 'Matched'}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, BANK_RECONCILIATION_REVIEW_LINKS)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Bank reconciliation filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: bankReconciliationHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: BANK_RECONCILIATION_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: bankReconciliationHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: bankReconciliationHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Create one bank statement row from manual evidence. Imported rows start unmatched and can be reconciled from the transaction detail page."
        resultLabel={importNotice === '1' ? 'Bank transaction imported' : importError ? 'Import failed' : undefined}
        resultTone={importNotice === '1' ? 'success' : importError ? 'danger' : 'info'}
        title="Manual bank transaction import"
      >
        <AdminDisclosure className="finance-reconciliation-import-disclosure" open={shouldOpenImportDisclosure}>
          <summary>
            <span>Bank import form</span>
            <small>Open only when a bank statement row is missing from the reconciliation list.</small>
          </summary>
          {importError ? (
            <p className="muted admin-mt-8">
              Bank transaction import failed. Check approval admin, bank account, type, amount, and occurred date before
              trying again.
            </p>
          ) : null}
          <AdminFormGrid action={createCompanyBankTransactionAction} className="compact-form admin-mt-16">
            <input
              name="redirectTo"
              type="hidden"
              value={bankReconciliationHref({ ...filters, page: 1, review: 'unmatched' })}
            />
            <AdminFormInput label="Approving admin ID" labelVisibility="visible" name="approvalAdminId" required />
            <AdminFormSelect
              defaultValue={bankAccountOptions[0]?.value ?? ''}
              disabled={!companyBankAccounts.length}
              label="Bank account"
              labelVisibility="visible"
              name="bankAccountId"
              options={bankAccountOptions}
              required
            />
            <AdminFormSelect
              defaultValue="INFLOW"
              label="Type"
              labelVisibility="visible"
              name="type"
              options={[
                { label: 'Inflow', value: 'INFLOW' },
                { label: 'Outflow', value: 'OUTFLOW' },
              ]}
            />
            <AdminFormInput label="Amount" labelVisibility="visible" min={1} name="amount" required step={1} type="number" />
            <AdminFormDateTime label="Occurred at" labelVisibility="visible" name="occurredAt" required />
            <AdminFormDate label="Value date" labelVisibility="visible" name="valueDate" />
            <AdminFormInput label="Transfer reference" labelVisibility="visible" name="transferRef" />
            <AdminFormInput label="Counterparty" labelVisibility="visible" name="counterpartyName" />
            <AdminFormTextarea className="admin-grid-span-2" label="Description" labelVisibility="visible" name="description" rows={2} />
            <AdminFormActionRow>
              <AdminFormControlButton className="button-primary" disabled={!companyBankAccounts.length}>
                Import bank transaction
              </AdminFormControlButton>
            </AdminFormActionRow>
          </AdminFormGrid>
        </AdminDisclosure>
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="The list keeps match details collapsed. Use transfer reference, bank account, and source key to open the related evidence only when needed."
        resultLabel={`${pagination.totalRows} transaction(s)`}
        resultTone="info"
        title="Company bank transactions"
      >
        <FinanceDataTable
          emptyMessage="No bank transactions match the current filters."
          headers={['Transaction', 'Bank account', 'Counterparty', 'Amount', 'Value date', 'Match', 'Status', 'Evidence']}
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
                  {transaction.bankAccount?.accountNumberMasked ?? transaction.bankAccount?.accountNumberLast4 ?? '-'}
                </div>
              </td>
              <td>
                <strong>{transaction.counterpartyName ?? '-'}</strong>
                <div className="muted">{transaction.description ?? '-'}</div>
              </td>
              <td>
                <strong>
                  <MoneyText amount={transaction.amount} currency={transaction.currency} />
                </strong>
                <div className="muted">{transaction.type === 'INFLOW' ? 'Bank inflow' : 'Bank outflow'}</div>
              </td>
              <td>
                <strong>{formatDateTime(transaction.occurredAt)}</strong>
                {transaction.valueDate ? <div className="muted">Value {formatDateTime(transaction.valueDate)}</div> : null}
              </td>
              <td>
                <strong>{transaction._count?.reconciliationMatches ?? 0} match</strong>
                <div className="muted">{shortId(transaction.sourceKey)}</div>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(financeBankReconciliationStatusPill(transaction.status))}>
                  {transaction.status}
                </StatusBadge>
              </td>
              <td>
                <ActionMenu
                  actions={[{ href: bankReconciliationDetailHref(transaction.id), kind: 'link', label: 'Open detail', tone: 'info' }]}
                  label={`Bank reconciliation evidence actions for ${transaction.id}`}
                />
                <div className="muted">{transaction._count?.reconciliationMatches ?? 0} match</div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Bank reconciliation pages"
          hrefForPage={(page) => bankReconciliationHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
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

function companyBankAccountOptionLabel(account: AdminCompanyBankAccount) {
  const masked = account.accountNumberMasked ?? (account.accountNumberLast4 ? `****${account.accountNumberLast4}` : '');
  return [account.name, account.bankName, masked, account.currency].filter(Boolean).join(' - ');
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
