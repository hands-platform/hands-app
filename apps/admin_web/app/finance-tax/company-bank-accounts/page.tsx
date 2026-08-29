import { randomUUID } from 'node:crypto';

import { AlertTriangle, Archive, Pencil, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { AdminDirectoryFilterForm } from '../../../components/admin-directory-filter-form';
import {
  AdminFormControlLink,
  AdminFormControlButton,
  AdminDrawerActionFooter,
  AdminDrawerFormGridFields,
  AdminFormInput,
  AdminFormSelect,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDisclosure, AdminNoticeCard } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAuditLog, AdminAuditLogPage, AdminCompanyBankAccount } from '../../../lib/admin-api';
import {
  AdminApiRequestError,
  adminDeleteOrThrow,
  adminGetResult,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../../lib/admin-api';
import { formatWholeNumber, readPlainRecord } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceTablePanel } from '../finance-table-panel';
import {
  COMPANY_BANK_ACCOUNT_CLASSIFICATION_INTENT,
  COMPANY_BANK_ACCOUNT_CREATE_INTENT,
  COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH,
  COMPANY_BANK_ACCOUNT_STATUS_INTENT,
  COMPANY_BANK_ACCOUNT_UPDATE_INTENT,
  isConfirmedCompanyBankAccountAction,
} from './company-bank-account-action-validation';
import {
  CompanyBankAccountDrawerCancelButton,
  CompanyBankAccountDrawerShell,
} from './company-bank-account-drawer-shell';
import {
  CompanyBankAccountFieldError,
  CompanyBankAccountLast4Input,
  CompanyBankAccountRequestForm,
  type CompanyBankAccountRequestFormState,
} from './company-bank-account-request-form';
import { CompanyBankAccountStatusDialog } from './company-bank-account-status-dialog';

type CompanyBankAccountsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CompanyBankAccountApproverReadiness = {
  eligibleApproverCount: number;
  ready: boolean;
};

type CompanyBankAccountOperationalProfile = {
  bankCode: string | null;
  direction: string | null;
  evidenceObjectId: string | null;
  isPrimary: boolean;
  legalOwnerName: string | null;
  purpose: string | null;
  statementImportTestedAt: string | null;
  verificationMethod: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  verifiedByAdminId: string | null;
};

type CompanyBankAccountOperationsRow = AdminCompanyBankAccount & {
  createdAt: string;
  dataScope: 'PRODUCTION' | 'SYNTHETIC' | 'UNKNOWN';
  lifecycleStatus: string;
  operationalProfile: CompanyBankAccountOperationalProfile;
  operations: {
    lastActivityAt: string | null;
    openReconciliationCount: number;
    transactionCount: number;
  };
};

type CompanyBankAccountOperationsPage = {
  filterContract: CompanyBankAccountFilterContract;
  filters: CompanyBankAccountListFilters;
  generatedAt: string;
  items: CompanyBankAccountOperationsRow[];
  pagination: { skip: number; take: number; totalCount: number };
  summary: {
    productionCount: number;
    syntheticCount: number;
    unknownDataScopeCount: number;
    lastRecordedStatementImport: {
      account: AdminCompanyBankAccount;
      importedAt: string;
    } | null;
    oldestPendingRequestedAt: string | null;
    pendingApprovalCount: number;
    reconciliationHealth: 'ATTENTION' | 'HEALTHY';
    unmatchedCount: number;
    usableRealAccountCount: number;
  };
  view: CompanyBankAccountView;
};

type CompanyBankAccountView = 'archived' | 'current' | 'pending' | 'remediation';

type CompanyBankAccountRecentChangesPage = AdminAuditLogPage & {
  actionableRequestIds: string[];
  accountSnapshots: Array<{
    accountNumberMasked: string | null;
    bankName: string;
    id: string;
    name: string;
  }>;
};

type CompanyBankAccountListFilters = {
  currency: string;
  health: string;
  purpose: string;
  status: string;
  verification: string;
};

type CompanyBankAccountFilterContract = Record<keyof CompanyBankAccountListFilters, string[]>;

type CompanyBankAccountStatusPreflight = {
  accountId: string;
  archiveImpact: {
    ready: boolean;
    sources: Array<{
      coverage: 'COMPLETE' | 'ERROR' | 'INCOMPLETE' | 'NOT_APPLICABLE' | 'TIMEOUT';
      openCount: number | null;
      reason?: string | null;
      source: string;
      totalCount: number | null;
    }>;
  };
  blockers: Array<{ code: string; label: string }>;
  duplicateCandidate: {
    accountNumberMasked: string | null;
    bankName: string;
    dataScope: string;
    id: string;
    name: string;
  } | null;
  eligibleApproverCount: number;
  generatedAt: string;
  impact: {
    incompleteImportBatchCount: number;
    lastOpenActivityAt: string | null;
    openTransactionCount: number;
    scheduledReferenceCount: number | null;
    totalTransactionCount: number;
  };
  mode: 'ACTIVATION' | 'ARCHIVE';
  preflightHash: string;
  ready: boolean;
  replacementAccount: { id: string; name: string; updatedAt?: string } | null;
  replacementCandidates: Array<{ accountNumberMasked: string | null; bankName: string; id: string; name: string }>;
  statementImportEvidence: { id: string; importedAt: string } | null;
};

const COMPANY_BANK_ACCOUNTS_PATH = '/finance-tax/company-bank-accounts';
const COMPANY_BANK_ACCOUNT_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const COMPANY_BANK_ACCOUNT_EVIDENCE_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export default async function CompanyBankAccountsPage({ searchParams }: CompanyBankAccountsPageProps) {
  const params = searchParams ? await searchParams : {};
  const dialog = readParam(params, 'dialog');
  const view = companyBankAccountView(readParam(params, 'view'));
  const page = Math.max(Number.parseInt(readParam(params, 'page') || '1', 10) || 1, 1);
  const take = 25;
  const skip = (page - 1) * take;
  const requestedFilters: CompanyBankAccountListFilters = {
    currency: readParam(params, 'currency'),
    health: readParam(params, 'health'),
    purpose: readParam(params, 'purpose'),
    status: readParam(params, 'status'),
    verification: readParam(params, 'verification'),
  };
  const operationsQuery = new URLSearchParams({
    view,
    skip: String(skip),
    take: String(take),
  });
  for (const [key, value] of Object.entries(requestedFilters)) {
    if (value) operationsQuery.set(key, value);
  }
  const requestedAccountId = readParam(params, 'accountId');
  const statusConfirmationRequested = readParam(params, 'confirm') === 'status';
  const [accountsResult, accountAuditResult, approverReadinessResult, currentOperatorAccess] = await Promise.all([
    adminGetResult<CompanyBankAccountOperationsPage>(
      `/admin/company-bank-accounts/operations-page?${operationsQuery.toString()}`,
      emptyCompanyBankAccountOperationsPage(view, skip, take),
    ),
    adminGetResult<CompanyBankAccountRecentChangesPage>('/admin/company-bank-accounts/recent-changes?take=20', {
      actionableRequestIds: [],
      accountSnapshots: [],
      items: [],
      skip: 0,
      take: 20,
      totalCount: 0,
    }),
    adminGetResult<CompanyBankAccountApproverReadiness>(
      '/admin/company-bank-accounts/approver-readiness',
      { eligibleApproverCount: 0, ready: false },
    ),
    getCurrentAdminOperatorAccess(),
  ]);
  const filters = accountsResult.ok
    ? (accountsResult.data.filters ?? requestedFilters)
    : requestedFilters;
  const filterContract = accountsResult.ok
    ? (accountsResult.data.filterContract ?? emptyCompanyBankAccountFilterContract(view))
    : emptyCompanyBankAccountFilterContract(view);
  if (accountsResult.ok && accountsResult.data.filters && !companyBankAccountFiltersEqual(requestedFilters, filters)) {
    redirect(companyBankAccountPageHref({ filters, view }));
  }
  const filtersActive = Object.values(filters).some(Boolean);
  const listHref = companyBankAccountPageHref({ filters, page, view });
  const accounts = accountsResult.data.items;
  const operationsSummary = accountsResult.data.summary;
  const operationalReadiness = companyBankAccountOperationalReadiness(operationsSummary);
  const accountAuditPage = accountAuditResult.data;
  const pendingApprovals = new Map(
    accounts
      .map((account) => [account.id, readCompanyBankAccountPendingApproval(account.metadata)] as const)
      .filter((entry): entry is readonly [string, CompanyBankAccountPendingApproval] => Boolean(entry[1])),
  );
  const pendingCount = operationsSummary.pendingApprovalCount;
  const accountAuditLogs = accountAuditPage.items;
  const actionableAuditRequestIds = new Set(accountAuditPage.actionableRequestIds ?? []);
  const accountAuditLifecycles = prioritizeCompanyBankAccountAuditLifecycles(
    groupCompanyBankAccountAuditLifecycles(accountAuditLogs),
    {
      actionableRequestIds: actionableAuditRequestIds,
      visibleAccountIds: new Set(accounts.map((account) => account.id)),
      view,
    },
  );
  const canOpenFullAuditLog = hasAdminOperatorCategory(currentOperatorAccess, 'SYSTEM_AUDIT');
  const canRequestChanges = hasAdminOperatorCategory(currentOperatorAccess, 'SYSTEM_POLICY');
  const canSubmitRequest = canRequestChanges && approverReadinessResult.ok && approverReadinessResult.data.ready;
  const accountById = new Map([
    ...(accountAuditPage.accountSnapshots ?? []).map((account) => [account.id, account] as const),
    ...accounts.map((account) => [account.id, {
      accountNumberMasked: account.accountNumberMasked ?? null,
      bankName: account.bankName,
      id: account.id,
      name: account.name,
    }] as const),
  ]);
  const editingAccount = dialog === 'edit' ? accounts.find((account) => account.id === requestedAccountId) ?? null : null;
  const classificationAccount = dialog === 'classification'
    ? accounts.find((account) => account.id === requestedAccountId && account.dataScope === 'UNKNOWN') ?? null
    : null;
  const statusAccount =
    statusConfirmationRequested
      ? accounts.find((account) => account.id === requestedAccountId) ?? null
      : null;
  const nextStatus = readParam(params, 'nextStatus') === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  const replacementAccountId = readParam(params, 'replacementAccountId');
  const statusPreflightResult = statusAccount
    ? await adminGetResult<CompanyBankAccountStatusPreflight>(
        `/admin/company-bank-accounts/${encodeURIComponent(statusAccount.id)}/status-preflight?nextStatus=${nextStatus}${replacementAccountId ? `&replacementAccountId=${encodeURIComponent(replacementAccountId)}` : ''}`,
        emptyCompanyBankAccountStatusPreflight(statusAccount.id, nextStatus),
      )
    : null;
  const statusIdempotencyKey = randomUUID();
  const notice = readParam(params, 'notice');
  const error = readParam(params, 'error');

  return (
    <AdminPageTemplate
      actions={
        <>
          {canSubmitRequest ? (
            <AdminFormControlLink className="button-primary" href={`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=new`}>
              <Plus aria-hidden="true" size={16} />
              Add bank account
            </AdminFormControlLink>
          ) : null}
          <AdminFormControlLink className="button-outline" href="/finance-tax/bank-reconciliation">
            Open bank reconciliation
          </AdminFormControlLink>
        </>
      }
      description="Manage verified company accounts used for collections, refunds, payouts, and bank reconciliation."
      title="Company bank accounts"
    >
      {accountsResult.ok ? (
        <AdminInlineNotice className="admin-mb-16 company-bank-account-refresh" role="status" tone="info">
          Last refreshed <DateTimeText value={accountsResult.data.generatedAt} /> · {formatWholeNumber(accountsResult.data.pagination.totalCount)} records in this view
          <AdminFormControlLink className="button-secondary" href={listHref}>
            Refresh now
          </AdminFormControlLink>
        </AdminInlineNotice>
      ) : null}
      {accountsResult.ok ? (
        <AdminInlineNotice
          className="admin-mb-16 company-bank-account-readiness-strip"
          role="status"
          tone={operationalReadiness.tone}
        >
          <strong>Operational readiness: {operationalReadiness.label}</strong>
          <span>{operationalReadiness.detail}</span>
          <span>Eligible separate approvers: {approverReadinessResult.ok ? formatWholeNumber(approverReadinessResult.data.eligibleApproverCount) : 'Unavailable'}</span>
        </AdminInlineNotice>
      ) : null}
      {accountsResult.ok && (
        operationsSummary.unknownDataScopeCount > 0 ||
        operationsSummary.syntheticCount > 0 ||
        !approverReadinessResult.ok ||
        !canRequestChanges ||
        !approverReadinessResult.data.ready
      ) ? (
        <AdminNoticeCard
          className="company-bank-account-resolution-panel"
          tone={operationsSummary.unknownDataScopeCount > 0 ? 'danger' : 'warning'}
        >
          <strong>Resolve Finance account readiness</strong>
          <ul>
            {operationsSummary.unknownDataScopeCount > 0 || operationsSummary.syntheticCount > 0 ? (
              <li>
                {formatWholeNumber(operationsSummary.unknownDataScopeCount)} unclassified and {formatWholeNumber(operationsSummary.syntheticCount)} synthetic records remain isolated from imports and transactions until authoritative evidence is reviewed.
              </li>
            ) : null}
            {!approverReadinessResult.ok ? (
              <li>Approver readiness is unavailable, so account records remain read-only for change requests.</li>
            ) : !canRequestChanges ? (
              <li>System Policy permission is required to submit a maker request; current access is read-only.</li>
            ) : !approverReadinessResult.data.ready ? (
              <li>No separate eligible Finance checker is available for maker/checker approval.</li>
            ) : null}
          </ul>
          <div className="actions">
            {view !== 'remediation' && operationsSummary.unknownDataScopeCount > 0 ? (
              <AdminFormControlLink className="button-secondary" href={`${COMPANY_BANK_ACCOUNTS_PATH}?view=remediation`}>
                Open remediation
              </AdminFormControlLink>
            ) : null}
            {canRequestChanges && (!approverReadinessResult.ok || !approverReadinessResult.data.ready) ? (
              <AdminFormControlLink className="button-secondary" href="/finance-tax/finance-approvers">
                Review Finance approvers
              </AdminFormControlLink>
            ) : null}
          </div>
        </AdminNoticeCard>
      ) : null}
      {notice ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="success">
          {companyBankAccountNotice(notice)}
        </AdminInlineNotice>
      ) : null}
      {error ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          {companyBankAccountError(error)}
        </AdminInlineNotice>
      ) : null}

      {!accountsResult.ok ? (
        <AdminNoticeCard tone="danger">
          <strong>{companyBankAccountReadFailureTitle(accountsResult.status)}</strong>
          <p>{companyBankAccountReadFailureMessage(accountsResult.status)}</p>
          {accountsResult.requestId ? <p className="muted">Request ID: {accountsResult.requestId}</p> : null}
          <AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>
            {accountsResult.status === 401 ? 'Sign in again' : 'Retry account data'}
          </AdminFormControlLink>
        </AdminNoticeCard>
      ) : null}

      {dialog === 'new' && canSubmitRequest ? (
        <CompanyBankAccountCreateForm returnHref={listHref} />
      ) : dialog === 'classification' && classificationAccount && canSubmitRequest ? (
        <CompanyBankAccountClassificationForm account={classificationAccount} returnHref={listHref} />
      ) : dialog === 'classification' && canSubmitRequest ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          This unclassified account is no longer available for classification. Reload Remediation before retrying.
        </AdminInlineNotice>
      ) : dialog === 'edit' && editingAccount && canSubmitRequest ? (
        <CompanyBankAccountEditForm account={editingAccount} returnHref={listHref} />
      ) : dialog === 'edit' && canSubmitRequest ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested bank account is not available. Reload the account list before editing.
        </AdminInlineNotice>
      ) : null}

      {statusAccount && canSubmitRequest && statusPreflightResult?.ok ? (
        <CompanyBankAccountStatusDialog
          action={updateCompanyBankAccountStatusAction}
          cancelHref={COMPANY_BANK_ACCOUNTS_PATH}
          confirmLabel={nextStatus === 'ACTIVE' ? 'Submit activation request' : 'Submit archive request'}
          description={
            <CompanyBankAccountPreflightSummary preflight={statusPreflightResult.data} />
          }
          disabled={!statusPreflightResult.data.ready}
          hiddenInputs={[
            { name: 'accountId', value: statusAccount.id },
            { name: 'confirmationAccountId', value: statusAccount.id },
            { name: 'confirmationIntent', value: COMPANY_BANK_ACCOUNT_STATUS_INTENT },
            { name: 'idempotencyKey', value: statusIdempotencyKey },
            { name: 'nextStatus', value: nextStatus },
            ...(replacementAccountId ? [{ name: 'replacementAccountId', value: replacementAccountId }] : []),
          ]}
          id={`company-bank-account-status-${statusAccount.id}`}
          supportingLinks={companyBankAccountPreflightLinks(statusPreflightResult.data, listHref)}
          textInputs={[
            {
              label: 'Status change evidence',
              maxLength: 500,
              minLength: COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH,
              name: 'operatorReason',
              placeholder: 'Why should this account status change now?',
              required: true,
            },
          ]}
          title={`Request ${nextStatus === 'ACTIVE' ? 'activation' : 'archive'} for ${statusAccount.name}?`}
          tone={nextStatus === 'ACTIVE' ? 'success' : 'warning'}
        />
      ) : statusConfirmationRequested && accountsResult.ok && canSubmitRequest ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested status action is no longer available. Reload the account list before retrying.
        </AdminInlineNotice>
      ) : null}

      {accountsResult.ok ? <FinanceTablePanel
        actions={(
          <div className="actions" aria-label="Account record views">
            <AdminFormControlLink
              aria-current={view === 'current' ? 'page' : undefined}
              className={view === 'current' ? 'button-primary' : 'button-secondary'}
              href={companyBankAccountPageHref({ filters, view: 'current' })}
            >
              Current
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={view === 'archived' ? 'page' : undefined}
              className={view === 'archived' ? 'button-primary' : 'button-secondary'}
              href={companyBankAccountPageHref({ filters, view: 'archived' })}
            >
              Archived
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={view === 'pending' ? 'page' : undefined}
              className={view === 'pending' ? 'button-primary' : 'button-secondary'}
              href={companyBankAccountPageHref({ filters, view: 'pending' })}
            >
              Pending {pendingCount > 0 ? `(${formatWholeNumber(pendingCount)})` : ''}
            </AdminFormControlLink>
            <AdminFormControlLink
              aria-current={view === 'remediation' ? 'page' : undefined}
              className={view === 'remediation' ? 'button-primary' : 'button-secondary'}
              href={companyBankAccountPageHref({ filters, view: 'remediation' })}
            >
              Remediation {operationsSummary.unknownDataScopeCount > 0 ? `(${formatWholeNumber(operationsSummary.unknownDataScopeCount)})` : ''}
            </AdminFormControlLink>
          </div>
        )}
        grouped
        description={companyBankAccountViewDescription(view)}
        resultLabel={pluralizeCompanyBankAccounts(accountsResult.data.pagination.totalCount)}
        resultTone="info"
        title={companyBankAccountViewTitle(view)}
      >
        <AdminDirectoryFilterForm className="company-bank-account-filters" method="get">
          <input name="view" type="hidden" value={view} />
          {filterContract.purpose.length > 0 ? <AdminFormSelect defaultValue={filters.purpose} label="Purpose" labelVisibility="visible" name="purpose" options={companyBankAccountFilterOptions('purpose', filterContract.purpose)} /> : null}
          {filterContract.currency.length > 0 ? <AdminFormSelect defaultValue={filters.currency} label="Currency" labelVisibility="visible" name="currency" options={companyBankAccountFilterOptions('currency', filterContract.currency)} /> : null}
          {filterContract.verification.length > 0 ? <AdminFormSelect defaultValue={filters.verification} label="Verification" labelVisibility="visible" name="verification" options={companyBankAccountFilterOptions('verification', filterContract.verification)} /> : null}
          {filterContract.health.length > 0 ? <AdminFormSelect defaultValue={filters.health} label="Health" labelVisibility="visible" name="health" options={companyBankAccountFilterOptions('health', filterContract.health)} /> : null}
          {filterContract.status.length > 0 ? <AdminFormSelect defaultValue={filters.status} label="Status" labelVisibility="visible" name="status" options={companyBankAccountFilterOptions('status', filterContract.status)} /> : null}
          <div className="actions company-bank-account-filter-actions">
            <AdminFormControlButton className="button-primary" type="submit">Apply filters</AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href={`${COMPANY_BANK_ACCOUNTS_PATH}?view=${view}`}>Reset</AdminFormControlLink>
          </div>
        </AdminDirectoryFilterForm>
        <FinanceDataTable
          scrollClassName="company-bank-account-table"
          emptyMessage={filtersActive
            ? 'No company bank accounts match the active filters. Reset filters to review the full record set.'
            : companyBankAccountViewEmptyMessage(view)}
          headers={[
            'Account',
            'Operational use',
            'Readiness',
            'Reconciliation',
            'Last activity',
            'Actions',
          ]}
          rowCount={accounts.length}
        >
          {accounts.map((account) => {
            const profile = account.operationalProfile;
            const pending = pendingApprovals.get(account.id);
            return (
              <tr key={account.id}>
                <td>
                  <strong title={account.name}>{account.name}</strong>
                  <span className="muted">{account.bankName} · {account.accountNumberMasked ?? 'Masked number unavailable'}</span>
                  <span className="muted">{profile.legalOwnerName ?? 'Legal owner not recorded'}</span>
                  <div className="company-bank-account-cell-badges">
                    <StatusBadge tone={companyBankAccountScopeTone(account.dataScope)}>
                      {companyBankAccountScopeLabel(account.dataScope)}
                    </StatusBadge>
                    <StatusBadge tone={lifecycleTone(account.lifecycleStatus)}>
                      {lifecycleLabel(account.lifecycleStatus)}
                    </StatusBadge>
                  </div>
                </td>
                <td>
                  <strong>{companyBankAccountPurposeLabel(profile.purpose)}</strong>
                  <span className="muted">{companyBankAccountDirectionLabel(profile.direction)}</span>
                  <span className="muted">{account.currency}</span>
                  {profile.isPrimary ? <StatusBadge tone="info">Primary</StatusBadge> : null}
                </td>
                <td>
                  <StatusBadge tone={verificationTone(profile.verificationStatus)}>
                    {verificationLabel(profile.verificationStatus)}
                  </StatusBadge>
                  <span className="muted">{profile.verificationMethod ?? 'Method not recorded'}</span>
                  {account.dataScope !== 'PRODUCTION' ? (
                    <span className="muted">Blocked from operational use until authoritative scope evidence exists.</span>
                  ) : null}
                </td>
                <td>
                  <StatusBadge tone={account.operations.openReconciliationCount > 0 ? 'warning' : 'success'}>
                    {account.operations.openReconciliationCount > 0
                      ? `${formatWholeNumber(account.operations.openReconciliationCount)} open`
                      : 'No open matches'}
                  </StatusBadge>
                  <span className="muted">{pluralizeTransactions(account.operations.transactionCount)}</span>
                </td>
                <td>
                  <DateTimeText value={account.operations.lastActivityAt} />
                  <span className="muted">Latest account or reconciliation activity</span>
                </td>
                <td>
                  <div className="actions company-bank-account-row-actions">
                    {pending ? (
                      <AdminFormControlLink
                        className="button-secondary"
                        href={companyBankAccountApprovalQueueHref(pending.requestId)}
                      >
                        Review exact request
                      </AdminFormControlLink>
                    ) : view === 'remediation' ? (
                      canSubmitRequest ? (
                        <AdminFormControlLink
                          className="button-secondary"
                          href={companyBankAccountPageHref({
                            accountId: account.id,
                            dialog: 'classification',
                            filters,
                            page,
                            view,
                          })}
                        >
                          <ShieldCheck aria-hidden="true" size={16} />
                          Start classification review
                        </AdminFormControlLink>
                      ) : (
                        <>
                          <AdminFormControlButton
                            className="button-secondary"
                            disabled
                            title={companyBankAccountClassificationDisabledReason({
                              approverCheckAvailable: approverReadinessResult.ok,
                              canRequestChanges,
                              checkerReady: approverReadinessResult.data.ready,
                            })}
                            type="button"
                          >
                            Start classification review
                          </AdminFormControlButton>
                          <span className="muted">
                            {companyBankAccountClassificationDisabledReason({
                              approverCheckAvailable: approverReadinessResult.ok,
                              canRequestChanges,
                              checkerReady: approverReadinessResult.data.ready,
                            })}
                          </span>
                        </>
                      )
                    ) : canSubmitRequest ? (
                      <>
                        <AdminFormControlLink
                          className="button-secondary"
                          href={companyBankAccountPageHref({
                            accountId: account.id,
                            dialog: 'edit',
                            filters,
                            page,
                            view,
                          })}
                        >
                          <Pencil aria-hidden="true" size={16} />
                          Edit account
                        </AdminFormControlLink>
                        <AdminFormControlLink
                          className="button-secondary"
                          href={companyBankAccountStatusHref(
                            account.id,
                            account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            view,
                            undefined,
                            filters,
                          )}
                        >
                          {account.status === 'ACTIVE' ? <Archive aria-hidden="true" size={16} /> : <RotateCcw aria-hidden="true" size={16} />}
                          {account.status === 'ACTIVE' ? 'Review archive' : 'Review activation'}
                        </AdminFormControlLink>
                      </>
                    ) : <span className="muted">Read only</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </FinanceDataTable>
        <CompanyBankAccountPagination
          currentPage={page}
          take={take}
          totalCount={accountsResult.data.pagination.totalCount}
          filters={filters}
          view={view}
        />
      </FinanceTablePanel> : null}

      {accountsResult.ok && !accountAuditResult.ok ? (
        <AdminNoticeCard tone="warning">
          <strong>Account timeline could not be loaded</strong>
          <p>The account list remains available. Retry before using recent changes as approval evidence.</p>
          {accountAuditResult.requestId ? <p className="muted">Request ID: {accountAuditResult.requestId}</p> : null}
          <AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>Retry timeline</AdminFormControlLink>
        </AdminNoticeCard>
      ) : accountsResult.ok ? <FinanceTablePanel
        actions={canOpenFullAuditLog ? (
          <AdminFormControlLink
            className="button-secondary"
            href="/audit-log?range=all&targetPrefix=company_bank_account%3A"
          >
            Open full audit log
          </AdminFormControlLink>
        ) : undefined}
        description="Latest account requests and decisions, filtered by the account target before the 20-event limit."
        resultLabel={`Showing ${formatWholeNumber(accountAuditLogs.length)} of ${pluralizeChanges(accountAuditPage.totalCount)} · ${pluralizeRequestLifecycles(accountAuditLifecycles.length)}`}
        resultTone={accountAuditLogs.length > 0 ? 'warning' : 'success'}
        title="Recent account changes"
      >
        {accountAuditLifecycles.length === 0 ? (
          <p className="empty-state">No recent company bank account changes were returned.</p>
        ) : (
        <>
          <ol aria-label="Recent company bank account request lifecycles" className="company-bank-account-lifecycle-list">
            {accountAuditLifecycles.slice(0, 5).map((lifecycle) => companyBankAccountAuditLifecycleItem({
              account: companyBankAccountAuditLifecycleAccount(lifecycle, accountById),
              actionable: Boolean(lifecycle.requestId && actionableAuditRequestIds.has(lifecycle.requestId)),
              lifecycle,
            }))}
          </ol>
          {accountAuditLifecycles.length > 5 ? (
            <AdminDisclosure className="company-bank-account-recent-disclosure">
              <summary>Show {formatWholeNumber(accountAuditLifecycles.length - 5)} more</summary>
              <ol aria-label="Additional company bank account request lifecycles" className="company-bank-account-lifecycle-list" start={6}>
                {accountAuditLifecycles.slice(5).map((lifecycle) => companyBankAccountAuditLifecycleItem({
                  account: companyBankAccountAuditLifecycleAccount(lifecycle, accountById),
                  actionable: Boolean(lifecycle.requestId && actionableAuditRequestIds.has(lifecycle.requestId)),
                  lifecycle,
                }))}
              </ol>
            </AdminDisclosure>
          ) : null}
        </>
        )}
      </FinanceTablePanel> : null}
    </AdminPageTemplate>
  );
}

function CompanyBankAccountCreateForm({ returnHref }: { readonly returnHref: string }) {
  const idempotencyKey = randomUUID();
  return (
    <CompanyBankAccountDrawerShell
      returnFocusHref={`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=new`}
      returnHref={returnHref}
      title="Add company bank account"
    >
      <CompanyBankAccountRequestForm action={createCompanyBankAccountAction} className="company-bank-account-drawer-form">
        <input name="confirmationIntent" type="hidden" value={COMPANY_BANK_ACCOUNT_CREATE_INTENT} />
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <AdminDrawerFormGridFields>
          <div className="company-bank-account-form-section" aria-labelledby="bank-account-identity-title" role="group">
            <h3 id="bank-account-identity-title">1. Account identity</h3>
            <p className="muted">Full account numbers are not accepted or stored.</p>
            <AdminFormInput label="Account name" labelVisibility="visible" maxLength={120} name="name" required />
            <CompanyBankAccountFieldError field="name" />
            <AdminFormSelect
              defaultValue="VCB"
              label="Bank"
              labelVisibility="visible"
              name="bankCode"
              options={companyBankOptions}
              required
            />
            <CompanyBankAccountFieldError field="bankCode" />
            <AdminFormInput
              label="Legal account owner"
              labelVisibility="visible"
              maxLength={160}
              name="legalOwnerName"
              required
            />
            <CompanyBankAccountFieldError field="legalOwnerName" />
            <CompanyBankAccountLast4Input />
            <CompanyBankAccountFieldError field="accountNumberLast4" />
            <AdminFormStaticValue hiddenName="currency" hiddenValue="VND" label="Currency" labelVisibility="visible" value="VND" />
          </div>
          <div className="company-bank-account-form-section" aria-labelledby="bank-account-purpose-title" role="group">
            <h3 id="bank-account-purpose-title">2. Purpose and direction</h3>
            <AdminFormSelect label="Purpose" labelVisibility="visible" name="purpose" options={companyBankPurposeOptions} required />
            <AdminFormSelect label="Money direction" labelVisibility="visible" name="direction" options={companyBankDirectionOptions} required />
            <AdminFormSelect label="Primary for this use" labelVisibility="visible" name="isPrimary" options={companyBankPrimaryOptions} required />
          </div>
          <div className="company-bank-account-form-section" aria-labelledby="bank-account-verification-title" role="group">
            <h3 id="bank-account-verification-title">3. Verification boundary</h3>
            <AdminInlineNotice role="status" tone="warning">
              This request creates an unclassified, inactive record. Verification, production classification, and a successful statement import must come from authoritative system evidence before activation.
            </AdminInlineNotice>
          </div>
          <div className="company-bank-account-form-section" aria-labelledby="bank-account-review-title" role="group">
            <h3 id="bank-account-review-title">4. Review and submit</h3>
            <AdminFormTextarea
              label="Why is this account needed?"
              labelVisibility="visible"
              maxLength={500}
              minLength={COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH}
              name="operatorReason"
              placeholder="Describe the legal ownership evidence, intended money flow, and reviewed statement test."
              required
              rows={4}
            />
            <CompanyBankAccountFieldError field="operatorReason" />
            <AdminInlineNotice role="status" tone="info">
              Approval creates an inactive record. Activation is a separate preflight and checker decision.
            </AdminInlineNotice>
          </div>
        </AdminDrawerFormGridFields>
        <AdminDrawerActionFooter className="company-bank-account-drawer-footer">
          <CompanyBankAccountDrawerCancelButton />
          <AdminFormControlButton className="button-primary" type="submit">Submit for approval</AdminFormControlButton>
        </AdminDrawerActionFooter>
      </CompanyBankAccountRequestForm>
    </CompanyBankAccountDrawerShell>
  );
}

function CompanyBankAccountClassificationForm({
  account,
  returnHref,
}: {
  readonly account: CompanyBankAccountOperationsRow;
  readonly returnHref: string;
}) {
  return (
    <CompanyBankAccountDrawerShell
      returnFocusHref={`${COMPANY_BANK_ACCOUNTS_PATH}?view=remediation&dialog=classification&accountId=${encodeURIComponent(account.id)}`}
      returnHref={returnHref}
      title="Start production classification review"
    >
      <CompanyBankAccountRequestForm action={createCompanyBankAccountClassificationAction} className="company-bank-account-drawer-form">
        <input name="accountId" type="hidden" value={account.id} />
        <input name="confirmationAccountId" type="hidden" value={account.id} />
        <input name="confirmationIntent" type="hidden" value={COMPANY_BANK_ACCOUNT_CLASSIFICATION_INTENT} />
        <input name="expectedAccountUpdatedAt" type="hidden" value={account.updatedAt} />
        <input name="idempotencyKey" type="hidden" value={randomUUID()} />
        <AdminDrawerFormGridFields>
          <div className="company-bank-account-form-section">
            <h3>Account under review</h3>
            <AdminFormStaticValue
              label="Restricted account identity"
              labelVisibility="visible"
              value={`${account.bankName} · ${account.accountNumberMasked ?? 'Masked identity unavailable'}`}
            />
            <AdminInlineNotice role="status" tone="warning">
              Classification changes only the data scope after a separate checker verifies retained ownership evidence. It does not activate the account.
            </AdminInlineNotice>
          </div>
          <div className="company-bank-account-form-section">
            <h3>Restricted ownership evidence</h3>
            <AdminFormInput
              accept="application/pdf,image/jpeg,image/png,image/webp"
              ariaDescribedBy="company-bank-account-classification-file-help"
              label="Ownership evidence file"
              labelVisibility="visible"
              name="evidenceFile"
              required
              type="file"
            />
            <p className="muted" id="company-bank-account-classification-file-help">
              PDF, JPEG, PNG, or WebP; maximum 10 MB. The file is retained as private Finance evidence.
            </p>
            <CompanyBankAccountFieldError field="evidenceFile" />
          </div>
          <div className="company-bank-account-form-section">
            <h3>Maker evidence</h3>
            <AdminFormTextarea
              label="Why does this evidence establish company ownership?"
              labelVisibility="visible"
              maxLength={500}
              minLength={COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH}
              name="operatorReason"
              placeholder="Identify the legal owner and the controlled source reviewed. Do not enter a full account number."
              required
              rows={4}
            />
            <CompanyBankAccountFieldError field="operatorReason" />
          </div>
        </AdminDrawerFormGridFields>
        <AdminDrawerActionFooter className="company-bank-account-drawer-footer">
          <CompanyBankAccountDrawerCancelButton />
          <AdminFormControlButton className="button-primary" type="submit">
            Submit classification request
          </AdminFormControlButton>
        </AdminDrawerActionFooter>
      </CompanyBankAccountRequestForm>
    </CompanyBankAccountDrawerShell>
  );
}

function CompanyBankAccountEditForm({
  account,
  returnHref,
}: {
  readonly account: CompanyBankAccountOperationsRow;
  readonly returnHref: string;
}) {
  const idempotencyKey = randomUUID();
  const profile = account.operationalProfile;
  return (
    <CompanyBankAccountDrawerShell
      returnFocusHref={`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=edit&accountId=${encodeURIComponent(account.id)}`}
      returnHref={returnHref}
      title="Edit company bank account"
    >
      <CompanyBankAccountRequestForm action={updateCompanyBankAccountNameAction} className="company-bank-account-drawer-form">
        <input name="accountId" type="hidden" value={account.id} />
        <input name="confirmationAccountId" type="hidden" value={account.id} />
        <input name="confirmationIntent" type="hidden" value={COMPANY_BANK_ACCOUNT_UPDATE_INTENT} />
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <AdminDrawerFormGridFields>
          <div className="company-bank-account-form-section">
            <h3>Account record</h3>
            <AdminFormStaticValue label="Immutable bank identity" labelVisibility="visible" value={`${account.bankName} · ${account.accountNumberMasked ?? 'Masked'}`} />
            <p className="muted">Bank identity and currency cannot change after transaction history exists.</p>
            <AdminFormInput defaultValue={account.name} label="Account name" labelVisibility="visible" maxLength={120} name="name" required />
            <CompanyBankAccountFieldError field="name" />
            <AdminFormInput defaultValue={profile.legalOwnerName ?? ''} label="Legal account owner" labelVisibility="visible" maxLength={160} name="legalOwnerName" required />
            <CompanyBankAccountFieldError field="legalOwnerName" />
            {account.operations.transactionCount > 0 ? (
              <AdminFormStaticValue hiddenName="bankCode" hiddenValue={profile.bankCode ?? ''} label="Controlled bank code" labelVisibility="visible" value={profile.bankCode ?? 'Not recorded'} />
            ) : (
              <AdminFormSelect defaultValue={profile.bankCode ?? 'VCB'} label="Controlled bank code" labelVisibility="visible" name="bankCode" options={companyBankOptions} required />
            )}
            <CompanyBankAccountFieldError field="bankCode" />
          </div>
          <div className="company-bank-account-form-section">
            <h3>Purpose and direction</h3>
            <AdminFormSelect defaultValue={profile.purpose ?? ''} label="Purpose" labelVisibility="visible" name="purpose" options={companyBankPurposeOptions} required />
            <AdminFormSelect defaultValue={profile.direction ?? ''} label="Money direction" labelVisibility="visible" name="direction" options={companyBankDirectionOptions} required />
            <AdminFormSelect defaultValue={String(profile.isPrimary)} label="Primary for this use" labelVisibility="visible" name="isPrimary" options={companyBankPrimaryOptions} required />
            <AdminInlineNotice role="status" tone="info">
              Verification and production classification cannot be changed in this record editor.
            </AdminInlineNotice>
          </div>
          <div className="company-bank-account-form-section">
            <h3>Review and submit</h3>
            <AdminFormTextarea
              label="Change evidence"
              labelVisibility="visible"
              maxLength={500}
              minLength={COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH}
              name="operatorReason"
              placeholder="Explain the source evidence and why this controlled record should change."
              required
              rows={4}
            />
            <CompanyBankAccountFieldError field="operatorReason" />
          </div>
        </AdminDrawerFormGridFields>
        <AdminDrawerActionFooter className="company-bank-account-drawer-footer">
          <CompanyBankAccountDrawerCancelButton />
          <AdminFormControlButton className="button-primary" type="submit">Submit for approval</AdminFormControlButton>
        </AdminDrawerActionFooter>
      </CompanyBankAccountRequestForm>
    </CompanyBankAccountDrawerShell>
  );
}

async function createCompanyBankAccountAction(
  _previousState: CompanyBankAccountRequestFormState,
  formData: FormData,
): Promise<CompanyBankAccountRequestFormState> {
  'use server';
  const confirmationIntent = readFormString(formData, 'confirmationIntent');
  const operatorReason = readFormString(formData, 'operatorReason');
  if (
    !isConfirmedCompanyBankAccountAction({
      confirmationIntent,
      evidence: operatorReason,
      expectedIntent: COMPANY_BANK_ACCOUNT_CREATE_INTENT,
    })
  ) {
    return companyBankAccountFormErrorState('confirmation-required');
  }
  try {
    const bankCode = readFormString(formData, 'bankCode');
    const created = await adminPostOrThrow<AdminCompanyBankAccount>('/admin/company-bank-accounts', {
      accountNumberLast4: readFormString(formData, 'accountNumberLast4'),
      bankCode,
      bankName: companyBankNameFromCode(bankCode),
      currency: readFormString(formData, 'currency'),
      direction: readFormString(formData, 'direction'),
      idempotencyKey: readFormString(formData, 'idempotencyKey'),
      isPrimary: readFormString(formData, 'isPrimary') === 'true',
      legalOwnerName: readFormString(formData, 'legalOwnerName'),
      name: readFormString(formData, 'name'),
      operatorReason,
      purpose: readFormString(formData, 'purpose'),
    });
    revalidatePath(COMPANY_BANK_ACCOUNTS_PATH);
    return companyBankAccountReceiptState(created);
  } catch (error) {
    return companyBankAccountFormErrorState(companyBankAccountActionError(error), error);
  }
}

async function createCompanyBankAccountClassificationAction(
  _previousState: CompanyBankAccountRequestFormState,
  formData: FormData,
): Promise<CompanyBankAccountRequestFormState> {
  'use server';
  const accountId = readFormString(formData, 'accountId');
  const operatorReason = readFormString(formData, 'operatorReason');
  if (
    !accountId ||
    !isConfirmedCompanyBankAccountAction({
      accountId,
      confirmationAccountId: readFormString(formData, 'confirmationAccountId'),
      confirmationIntent: readFormString(formData, 'confirmationIntent'),
      evidence: operatorReason,
      expectedIntent: COMPANY_BANK_ACCOUNT_CLASSIFICATION_INTENT,
    })
  ) {
    return companyBankAccountFormErrorState('confirmation-required');
  }
  const evidenceFile = formData.get('evidenceFile');
  if (!(evidenceFile instanceof File) || evidenceFile.size === 0) {
    return companyBankAccountEvidenceFileError('Choose a retained ownership evidence file.');
  }
  const contentType = evidenceFile.type.trim().toLowerCase();
  if (!COMPANY_BANK_ACCOUNT_EVIDENCE_CONTENT_TYPES.has(contentType)) {
    return companyBankAccountEvidenceFileError('Use a PDF, JPEG, PNG, or WebP evidence file.');
  }
  if (evidenceFile.size > COMPANY_BANK_ACCOUNT_EVIDENCE_MAX_BYTES) {
    return companyBankAccountEvidenceFileError('Ownership evidence files must be 10 MB or smaller.');
  }

  let fileAssetId = '';
  try {
    const presigned = await adminPostOrThrow<{
      file: { id: string };
      upload: { headers?: Record<string, string>; method: string; url: string };
    }>('/files/presign', {
      contentType,
      fileName: evidenceFile.name,
      purpose: 'finance-evidence',
      sizeBytes: evidenceFile.size,
      visibility: 'PRIVATE',
    });
    fileAssetId = presigned.file.id;
    if (!/^https?:\/\//u.test(presigned.upload.url)) {
      await adminDeleteOrThrow(`/files/${encodeURIComponent(fileAssetId)}`).catch(() => undefined);
      fileAssetId = '';
      return companyBankAccountEvidenceFileError('Private Finance evidence storage is unavailable.');
    }
    const upload = await fetch(presigned.upload.url, {
      body: Buffer.from(await evidenceFile.arrayBuffer()),
      headers: presigned.upload.headers ?? { 'content-type': contentType },
      method: presigned.upload.method || 'PUT',
    });
    if (!upload.ok) {
      await adminDeleteOrThrow(`/files/${encodeURIComponent(fileAssetId)}`).catch(() => undefined);
      fileAssetId = '';
      return companyBankAccountEvidenceFileError('Evidence upload failed. Choose the file and try again.');
    }
    await adminPostOrThrow(`/files/${encodeURIComponent(fileAssetId)}/complete`, {
      sizeBytes: evidenceFile.size,
    });
    const requested = await adminPostOrThrow<AdminCompanyBankAccount>(
      `/admin/company-bank-accounts/${encodeURIComponent(accountId)}/evidence-review-requests`,
      {
        expectedAccountUpdatedAt: readFormString(formData, 'expectedAccountUpdatedAt'),
        fileAssetId,
        idempotencyKey: readFormString(formData, 'idempotencyKey'),
        intent: 'CLASSIFY_PRODUCTION',
        operatorReason,
      },
    );
    revalidatePath(COMPANY_BANK_ACCOUNTS_PATH);
    return companyBankAccountReceiptState(requested);
  } catch (error) {
    if (fileAssetId) {
      await adminDeleteOrThrow(`/files/${encodeURIComponent(fileAssetId)}`).catch(() => undefined);
    }
    return companyBankAccountFormErrorState(companyBankAccountActionError(error), error);
  }
}

function companyBankAccountEvidenceFileError(message: string): CompanyBankAccountRequestFormState {
  return {
    error: 'The classification request was not submitted. Review the evidence file.',
    fieldErrors: { evidenceFile: message },
    status: 'error',
  };
}

async function updateCompanyBankAccountNameAction(
  _previousState: CompanyBankAccountRequestFormState,
  formData: FormData,
): Promise<CompanyBankAccountRequestFormState> {
  'use server';
  const accountId = readFormString(formData, 'accountId');
  const confirmationAccountId = readFormString(formData, 'confirmationAccountId');
  const confirmationIntent = readFormString(formData, 'confirmationIntent');
  const operatorReason = readFormString(formData, 'operatorReason');
  if (
    !accountId ||
    !isConfirmedCompanyBankAccountAction({
      accountId,
      confirmationAccountId,
      confirmationIntent,
      evidence: operatorReason,
      expectedIntent: COMPANY_BANK_ACCOUNT_UPDATE_INTENT,
    })
  ) {
    return companyBankAccountFormErrorState('confirmation-required');
  }
  try {
    const updated = await adminPatchOrThrow<AdminCompanyBankAccount>(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`, {
      bankCode: readFormString(formData, 'bankCode'),
      direction: readFormString(formData, 'direction'),
      idempotencyKey: readFormString(formData, 'idempotencyKey'),
      isPrimary: readFormString(formData, 'isPrimary') === 'true',
      legalOwnerName: readFormString(formData, 'legalOwnerName'),
      name: readFormString(formData, 'name'),
      operatorReason,
      purpose: readFormString(formData, 'purpose'),
    });
    revalidatePath(COMPANY_BANK_ACCOUNTS_PATH);
    return companyBankAccountReceiptState(updated);
  } catch (error) {
    return companyBankAccountFormErrorState(companyBankAccountActionError(error), error);
  }
}

async function updateCompanyBankAccountStatusAction(
  _previousState: CompanyBankAccountRequestFormState,
  formData: FormData,
): Promise<CompanyBankAccountRequestFormState> {
  'use server';
  const accountId = readFormString(formData, 'accountId');
  const confirmationAccountId = readFormString(formData, 'confirmationAccountId');
  const confirmationIntent = readFormString(formData, 'confirmationIntent');
  const operatorReason = readFormString(formData, 'operatorReason');
  const nextStatus = readFormString(formData, 'nextStatus') === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  if (
    !accountId ||
    !isConfirmedCompanyBankAccountAction({
      accountId,
      confirmationAccountId,
      confirmationIntent,
      evidence: operatorReason,
      expectedIntent: COMPANY_BANK_ACCOUNT_STATUS_INTENT,
    })
  ) {
    return companyBankAccountFormErrorState('confirmation-required');
  }
  try {
    const updated = await adminPatchOrThrow<AdminCompanyBankAccount>(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`, {
      idempotencyKey: readFormString(formData, 'idempotencyKey'),
      operatorReason,
      replacementAccountId: readFormString(formData, 'replacementAccountId') || undefined,
      status: nextStatus,
    });
    revalidatePath(COMPANY_BANK_ACCOUNTS_PATH);
    return companyBankAccountReceiptState(updated);
  } catch (error) {
    return companyBankAccountFormErrorState(companyBankAccountActionError(error), error);
  }
}

function companyBankAccountStatusHref(
  accountId: string,
  nextStatus: 'ACTIVE' | 'INACTIVE',
  view: CompanyBankAccountView,
  replacementAccountId?: string,
  filters?: CompanyBankAccountListFilters,
) {
  const search = new URLSearchParams({ accountId, confirm: 'status', nextStatus, view });
  if (filters) addCompanyBankAccountFilters(search, filters);
  if (replacementAccountId) search.set('replacementAccountId', replacementAccountId);
  return `${COMPANY_BANK_ACCOUNTS_PATH}?${search.toString()}`;
}

function companyBankAccountPageHref({
  accountId,
  dialog,
  filters,
  page,
  view,
}: {
  readonly accountId?: string;
  readonly dialog?: string;
  readonly filters?: CompanyBankAccountListFilters;
  readonly page?: number;
  readonly view: CompanyBankAccountView;
}) {
  const search = new URLSearchParams({ view });
  if (filters) addCompanyBankAccountFilters(search, filters);
  if (page && page > 1) search.set('page', String(page));
  if (dialog) search.set('dialog', dialog);
  if (accountId) search.set('accountId', accountId);
  return `${COMPANY_BANK_ACCOUNTS_PATH}?${search.toString()}`;
}

function addCompanyBankAccountFilters(search: URLSearchParams, filters: CompanyBankAccountListFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
}

function companyBankAccountApprovalQueueHref(requestId?: string) {
  const base = '/finance-tax/approval-queue?view=bank-accounts';
  return requestId ? `${base}#approval-${encodeURIComponent(requestId)}` : base;
}

function companyBankAccountReadFailureTitle(status: number | null) {
  if (status === 401) return 'Admin session expired';
  if (status === 403) return 'Company bank account access denied';
  return 'Company bank accounts could not be loaded';
}

function companyBankAccountReadFailureMessage(status: number | null) {
  if (status === 401) return 'Sign in again before using this Finance workspace.';
  if (status === 403) {
    return 'Finance bank reconciliation access is required. This is not an empty account list.';
  }
  return 'Retry before using account availability or status for statement import decisions.';
}

function companyBankAccountActionError(error: unknown) {
  const code = error instanceof AdminApiRequestError ? readPlainRecord(error.payload)?.code : null;
  if (code === 'COMPANY_BANK_ACCOUNT_POTENTIAL_DUPLICATE') return 'potential-duplicate';
  if (code === 'COMPANY_BANK_ACCOUNT_VERSION_CONFLICT') return 'version-conflict';
  if (code === 'COMPANY_BANK_ACCOUNT_APPROVER_UNAVAILABLE') return 'approver-unavailable';
  if (code === 'COMPANY_BANK_ACCOUNT_ACTIVATION_NOT_READY') return 'activation-not-ready';
  if (code === 'COMPANY_BANK_ACCOUNT_ARCHIVE_BLOCKED') return 'archive-blocked';
  if (error instanceof AdminApiRequestError && error.status === 409) return 'conflict';
  if (error instanceof AdminApiRequestError && error.status === 400) return 'invalid';
  return 'failed';
}

function companyBankAccountFormErrorState(
  code: string,
  error?: unknown,
): CompanyBankAccountRequestFormState {
  return {
    error: companyBankAccountError(code),
    fieldErrors: companyBankAccountFieldErrors(error),
    status: 'error',
  };
}

function companyBankAccountReceiptState(account: AdminCompanyBankAccount): CompanyBankAccountRequestFormState {
  const metadata = readPlainRecord(account.metadata);
  const pending = readPlainRecord(metadata?.pendingApproval);
  const requestId = typeof pending?.requestId === 'string' ? pending.requestId : '';
  const makerId = typeof pending?.requestedByAdminId === 'string' ? pending.requestedByAdminId : null;
  const submittedAt = typeof pending?.requestedAt === 'string' ? pending.requestedAt : null;
  if (!requestId) {
    return companyBankAccountFormErrorState('failed');
  }
  return {
    receipt: {
      makerId,
      queueHref: companyBankAccountApprovalQueueHref(requestId),
      requestId,
      submittedAt,
    },
    status: 'success',
  };
}

function companyBankAccountFieldErrors(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) return undefined;
  const payload = readPlainRecord(error.payload);
  const field = typeof payload?.field === 'string' ? payload.field : null;
  const message = typeof payload?.message === 'string' ? payload.message : null;
  return field && message ? { [field]: message } : undefined;
}

function companyBankAccountNotice(notice: string) {
  if (notice === 'created') return 'The company bank account creation request is waiting for approval.';
  if (notice === 'updated') return 'The account name change is waiting for approval.';
  if (notice === 'status-updated') return 'The account status change is waiting for approval.';
  if (notice === 'approved') return 'The pending company bank account change was approved and applied.';
  if (notice === 'rejected') return 'The pending company bank account change was rejected.';
  return 'The bank account action completed.';
}

function companyBankAccountError(error: string) {
  if (error === 'confirmation-required') return 'Review confirmation and at least 12 characters of evidence are required.';
  if (error === 'potential-duplicate') return 'A possible account with the same bank, currency, and last four digits already exists. Review the current records before submitting.';
  if (error === 'version-conflict') return 'This account changed while you were reviewing it. Refresh and review the latest values.';
  if (error === 'approver-unavailable') return 'No different Finance approver is available. Assign a backup approver before submitting.';
  if (error === 'activation-not-ready') return 'Activation readiness changed before submission. Reopen the preflight and resolve every blocker.';
  if (error === 'archive-blocked') return 'Archive impact changed before submission. Resolve open reconciliation references and review the replacement account.';
  if (error === 'conflict') return 'The pending request is no longer current. Reload before retrying.';
  if (error === 'invalid') return 'The bank account action was rejected. Check role separation, masking, status, and evidence.';
  return 'The bank account action failed. No confirmed result was saved.';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function companyBankAccountView(value: string): CompanyBankAccountView {
  if (value === 'archived' || value === 'pending' || value === 'remediation') return value;
  return 'current';
}

function companyBankAccountViewTitle(view: CompanyBankAccountView) {
  if (view === 'archived') return 'Archived account history';
  if (view === 'pending') return 'Pending account changes';
  if (view === 'remediation') return 'Account data remediation';
  return 'Current production accounts';
}

function companyBankAccountViewDescription(view: CompanyBankAccountView) {
  if (view === 'archived') return 'Production records removed from new operational use and retained for evidence.';
  if (view === 'pending') return 'Exact maker requests waiting for a different eligible Finance checker.';
  if (view === 'remediation') return 'Unclassified legacy records isolated from imports and transactions until authoritative evidence exists.';
  return 'Active production-classified accounts available to Finance operations.';
}

function companyBankAccountViewEmptyMessage(view: CompanyBankAccountView) {
  if (view === 'archived') return 'No archived production account records are retained.';
  if (view === 'pending') return 'No company bank account change is waiting for approval.';
  if (view === 'remediation') return 'No unclassified company bank account record requires remediation.';
  return 'No active production company bank account is registered.';
}

function companyBankAccountOperationalReadiness(summary: CompanyBankAccountOperationsPage['summary']) {
  if (summary.usableRealAccountCount === 0) {
    return {
      detail: 'No production account is available; reconciliation health is not applicable.',
      label: 'NOT APPLICABLE',
      tone: 'info' as const,
    };
  }
  if (!summary.lastRecordedStatementImport) {
    return {
      detail: 'An active production account exists, but a successful statement import is not proven.',
      label: 'NOT PROVEN',
      tone: 'warning' as const,
    };
  }
  if (summary.unmatchedCount > 0 || summary.pendingApprovalCount > 0 || summary.unknownDataScopeCount > 0) {
    return {
      detail: `${formatWholeNumber(summary.unmatchedCount)} open reconciliation items, ${formatWholeNumber(summary.pendingApprovalCount)} pending approvals, and ${formatWholeNumber(summary.unknownDataScopeCount)} remediation records require attention.`,
      label: 'ATTENTION',
      tone: 'warning' as const,
    };
  }
  return {
    detail: 'A production account and successful statement import are available with no open reconciliation items.',
    label: 'READY',
    tone: 'success' as const,
  };
}

function companyBankAccountClassificationDisabledReason(input: {
  approverCheckAvailable: boolean;
  canRequestChanges: boolean;
  checkerReady: boolean;
}) {
  if (!input.canRequestChanges) return 'System Policy permission is required to start classification.';
  if (!input.approverCheckAvailable) return 'Approver readiness must be restored before classification.';
  if (!input.checkerReady) return 'A separate eligible Finance checker is required.';
  return 'Classification is not available for this record.';
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

type CompanyBankAccountPendingApproval = {
  operation: 'CLASSIFY_PRODUCTION' | 'CREATE' | 'UPDATE' | 'VERIFY_STATEMENT';
  requestedByAdminId: string;
  requestId: string;
};

function readCompanyBankAccountPendingApproval(value: unknown): CompanyBankAccountPendingApproval | null {
  const metadata = readPlainRecord(value);
  const pending = readPlainRecord(metadata?.pendingApproval);
  const operation = pending?.operation;
  const requestedByAdminId =
    typeof pending?.requestedByAdminId === 'string' ? pending.requestedByAdminId.trim() : '';
  const requestId = typeof pending?.requestId === 'string' ? pending.requestId.trim() : '';
  if (
    (operation !== 'CREATE' &&
      operation !== 'UPDATE' &&
      operation !== 'CLASSIFY_PRODUCTION' &&
      operation !== 'VERIFY_STATEMENT') ||
    !requestedByAdminId ||
    !requestId
  ) {
    return null;
  }
  return { operation, requestedByAdminId, requestId };
}

function adminAuditActorLabel(log: AdminAuditLog) {
  return log.actor?.fullName ?? log.actor?.email ?? log.actor?.phone ?? log.actor?.id ?? 'Unknown operator';
}

type CompanyBankAccountAuditLifecycle = {
  decision: AdminAuditLog | null;
  events: AdminAuditLog[];
  id: string;
  requested: AdminAuditLog | null;
  requestId: string | null;
};

type CompanyBankAccountAuditSnapshot = {
  accountNumberMasked: string | null;
  bankName: string;
  id: string;
  name: string;
};

function groupCompanyBankAccountAuditLifecycles(logs: AdminAuditLog[]): CompanyBankAccountAuditLifecycle[] {
  const lifecycles = new Map<string, CompanyBankAccountAuditLifecycle>();
  for (const log of logs) {
    const metadata = readPlainRecord(log.metadata);
    const requestId = typeof metadata?.requestId === 'string' && metadata.requestId.trim()
      ? metadata.requestId.trim()
      : null;
    const key = requestId ?? log.id;
    const lifecycle = lifecycles.get(key) ?? {
      decision: null,
      events: [],
      id: key,
      requested: null,
      requestId,
    };
    lifecycle.events.push(log);
    if (log.action === 'company_bank_account.approval_requested') {
      lifecycle.requested ??= log;
    } else {
      lifecycle.decision ??= log;
    }
    lifecycles.set(key, lifecycle);
  }
  return [...lifecycles.values()];
}

function prioritizeCompanyBankAccountAuditLifecycles(
  lifecycles: CompanyBankAccountAuditLifecycle[],
  input: {
    actionableRequestIds: ReadonlySet<string>;
    view: CompanyBankAccountView;
    visibleAccountIds: ReadonlySet<string>;
  },
) {
  return lifecycles
    .map((lifecycle, index) => {
      const latest = lifecycle.decision ?? lifecycle.requested ?? lifecycle.events[0];
      const accountId = latest?.target.startsWith('company_bank_account:')
        ? latest.target.slice('company_bank_account:'.length)
        : '';
      const actionable = Boolean(lifecycle.requestId && input.actionableRequestIds.has(lifecycle.requestId));
      const priority = input.view === 'pending'
        ? actionable ? 2 : input.visibleAccountIds.has(accountId) ? 1 : 0
        : input.visibleAccountIds.has(accountId) ? 1 : 0;
      return { index, lifecycle, priority };
    })
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .map(({ lifecycle }) => lifecycle);
}

function companyBankAccountAuditLifecycleAccount(
  lifecycle: CompanyBankAccountAuditLifecycle,
  accounts: ReadonlyMap<string, CompanyBankAccountAuditSnapshot>,
) {
  const latest = lifecycle.decision ?? lifecycle.requested ?? lifecycle.events[0];
  if (!latest?.target.startsWith('company_bank_account:')) return undefined;
  return accounts.get(latest.target.slice('company_bank_account:'.length));
}

function companyBankAccountAuditLifecycleItem({
  account,
  actionable,
  lifecycle,
}: {
  account?: CompanyBankAccountAuditSnapshot;
  actionable: boolean;
  lifecycle: CompanyBankAccountAuditLifecycle;
}) {
  const { decision, requested } = lifecycle;
  const latest = decision ?? requested ?? lifecycle.events[0];
  if (!latest) return null;
  const approvalLifecycle = isCompanyBankAccountApprovalLifecycle(lifecycle);
  const requestMetadata = readPlainRecord(requested?.metadata);
  const decisionMetadata = readPlainRecord(decision?.metadata);
  const before = decisionMetadata?.before ?? requestMetadata?.before ?? null;
  const after = decisionMetadata?.after ?? requestMetadata?.proposed ?? null;
  const changes = companyBankAccountAuditChanges(before, after);
  const state = { accountExists: Boolean(account), actionable };
  return (
    <li className="company-bank-account-lifecycle-item" key={lifecycle.id}>
      <div className="company-bank-account-lifecycle-heading">
        <div>
          <strong>{account?.name ?? 'Account record unavailable'}</strong>
          {account ? (
            <span className="muted">
              {account.bankName} · {account.accountNumberMasked ?? 'Masked identity unavailable'}
            </span>
          ) : null}
        </div>
        <StatusBadge tone={auditLifecycleTone(lifecycle, state)}>
          {auditLifecycleLabel(lifecycle, state)}
        </StatusBadge>
      </div>
      <div className="company-bank-account-audit-lifecycle">
        {approvalLifecycle && requested ? <span><strong>Requested</strong><DateTimeText value={requested.createdAt} /></span> : null}
        {approvalLifecycle && decision ? <span><strong>Decided</strong><DateTimeText value={decision.createdAt} /></span> : null}
        {!approvalLifecycle ? <span><strong>Recorded</strong><DateTimeText value={latest.createdAt} /></span> : null}
      </div>
      <div className="company-bank-account-audit-actors">
        {approvalLifecycle ? (
          <>
            <span><strong>Maker</strong>{requested ? adminAuditActorLabel(requested) : 'Not recorded'}</span>
            <span><strong>Checker</strong>{decision ? adminAuditActorLabel(decision) : actionable ? 'Awaiting decision' : 'No longer actionable'}</span>
          </>
        ) : (
          <span><strong>Operator</strong>{adminAuditActorLabel(latest)}</span>
        )}
      </div>
      <div className="company-bank-account-audit-evidence">
        <strong>{lifecycle.requestId ? `Request ${shortIdentifier(lifecycle.requestId)}` : 'Request ID unavailable'}</strong>
        <span className="muted">
          {typeof decisionMetadata?.decisionReason === 'string'
            ? decisionMetadata.decisionReason
            : typeof decisionMetadata?.operatorReason === 'string'
              ? decisionMetadata.operatorReason
            : typeof requestMetadata?.operatorReason === 'string'
              ? requestMetadata.operatorReason
              : 'Evidence retained in audit log'}
        </span>
        {changes.length > 0 ? (
          <details>
            <summary>Review {formatWholeNumber(changes.length)} changed fields</summary>
            <dl className="company-bank-account-change-list">
              {changes.map((change) => (
                <div key={change.field}>
                  <dt>{change.label}</dt>
                  <dd><span>{change.before}</span><span aria-hidden="true">→</span><strong>{change.after}</strong></dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function auditLifecycleLabel(
  lifecycle: CompanyBankAccountAuditLifecycle,
  state: { accountExists: boolean; actionable: boolean },
) {
  if (!lifecycle.decision && lifecycle.requested) {
    if (state.actionable) return 'Awaiting checker';
    return state.accountExists ? 'No longer actionable' : 'Orphaned request evidence';
  }
  if (!lifecycle.decision) return 'Evidence recorded';
  if (lifecycle.decision.action === 'company_bank_account.approval_rejected') return 'Rejected';
  if (
    isCompanyBankAccountApprovalLifecycle(lifecycle) &&
    (lifecycle.decision.action === 'company_bank_account.create' ||
      lifecycle.decision.action === 'company_bank_account.update')
  ) {
    return 'Approved';
  }
  return auditActionLabel(lifecycle.decision.action);
}

function isCompanyBankAccountApprovalLifecycle(lifecycle: CompanyBankAccountAuditLifecycle) {
  if (lifecycle.requested || lifecycle.decision?.action === 'company_bank_account.approval_rejected') return true;
  const metadata = readPlainRecord(lifecycle.decision?.metadata);
  return metadata?.decision === 'APPROVE' || metadata?.decision === 'REJECT';
}

function auditLifecycleTone(
  lifecycle: CompanyBankAccountAuditLifecycle,
  state: { accountExists: boolean; actionable: boolean },
) {
  if (lifecycle.decision?.action === 'company_bank_account.approval_rejected') return 'danger' as const;
  if (!lifecycle.decision && lifecycle.requested) return state.actionable ? 'warning' as const : 'neutral' as const;
  return lifecycle.decision ? 'success' as const : 'info' as const;
}

function auditActionLabel(action: string) {
  if (action === 'company_bank_account.approval_requested') return 'Approval requested';
  if (action === 'company_bank_account.approval_rejected') return 'Rejected';
  if (action === 'company_bank_account.create') return 'Created';
  if (action === 'company_bank_account.update') return 'Updated';
  return action.replaceAll('_', ' ').replaceAll('.', ' ');
}

function shortIdentifier(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
}

const companyBankAccountAuditedFields = [
  ['name', 'Account name'],
  ['bankCode', 'Bank code'],
  ['bankName', 'Bank'],
  ['accountNumberMasked', 'Masked account'],
  ['currency', 'Currency'],
  ['legalOwnerName', 'Legal owner'],
  ['purpose', 'Purpose'],
  ['direction', 'Direction'],
  ['isPrimary', 'Primary account'],
  ['dataScope', 'Data scope'],
  ['status', 'Lifecycle status'],
] as const;

function companyBankAccountAuditChanges(beforeValue: unknown, afterValue: unknown) {
  const before = readPlainRecord(beforeValue) ?? {};
  const after = readPlainRecord(afterValue) ?? {};
  return companyBankAccountAuditedFields.flatMap(([field, label]) => {
    const beforeField = before[field];
    const afterField = after[field];
    if (afterField === undefined || Object.is(beforeField, afterField)) return [];
    return [{
      after: companyBankAccountAuditValue(afterField),
      before: companyBankAccountAuditValue(beforeField),
      field,
      label,
    }];
  });
}

function companyBankAccountAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return 'Structured value changed';
}

function companyBankAccountScopeLabel(value: CompanyBankAccountOperationsRow['dataScope']) {
  if (value === 'PRODUCTION') return 'Production';
  if (value === 'SYNTHETIC') return 'Synthetic';
  return 'Unclassified';
}

function companyBankAccountScopeTone(value: CompanyBankAccountOperationsRow['dataScope']) {
  if (value === 'PRODUCTION') return 'success' as const;
  if (value === 'SYNTHETIC') return 'info' as const;
  return 'warning' as const;
}

function companyBankAccountArchiveSourceLabel(value: string) {
  const labels: Record<string, string> = {
    BANK_TRANSACTIONS: 'Bank transactions',
    PAYOUTS: 'Payouts',
    REFUNDS: 'Refunds',
    SETTLEMENTS: 'Settlements',
    STATEMENT_IMPORTS: 'Statement imports',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}

function companyBankAccountPreflightLinks(preflight: CompanyBankAccountStatusPreflight, listHref: string) {
  const codes = new Set(preflight.blockers.map((blocker) => blocker.code));
  const links: Array<{ description: string; href: string; label: string }> = [];
  if (
    ['BANK_CODE_MISSING', 'DIRECTION_MISSING', 'LEGAL_OWNER_MISSING', 'PURPOSE_MISSING'].some((code) =>
      codes.has(code),
    )
  ) {
    links.push({
      description: 'Complete the controlled bank identity and operating profile for this account.',
      href: `${listHref}${listHref.includes('?') ? '&' : '?'}dialog=edit&accountId=${encodeURIComponent(preflight.accountId)}`,
      label: 'Edit account profile',
    });
  }
  if (codes.has('STATEMENT_IMPORT_TEST_MISSING')) {
    links.push({
      description: 'Upload and review a statement import that records a successful transaction for this account.',
      href: '/finance-tax/bank-reconciliation?workspace=imports',
      label: 'Open statement imports',
    });
  }
  if (codes.has('OPEN_RECONCILIATION_REFERENCES')) {
    links.push({
      description: 'Resolve unmatched and partially matched bank transactions.',
      href: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
      label: 'Open bank reconciliation',
    });
  }
  if (codes.has('APPROVER_UNAVAILABLE')) {
    links.push({
      description: 'Assign a different eligible Finance checker.',
      href: '/finance-tax/finance-approvers',
      label: 'Review Finance approvers',
    });
  }
  if (codes.has('POTENTIAL_DUPLICATE')) {
    links.push({
      description: 'Compare the possible duplicate before continuing.',
      href: preflight.duplicateCandidate
        ? `${COMPANY_BANK_ACCOUNTS_PATH}?view=remediation&dialog=edit&accountId=${encodeURIComponent(preflight.duplicateCandidate.id)}`
        : `${COMPANY_BANK_ACCOUNTS_PATH}?view=remediation`,
      label: 'Compare duplicate account',
    });
  }
  return links;
}

function pluralizeRequestLifecycles(count: number) {
  return `${formatWholeNumber(count)} request ${count === 1 ? 'lifecycle' : 'lifecycles'}`;
}

const companyBankOptions = [
  { label: 'Vietcombank (VCB)', value: 'VCB' },
  { label: 'Techcombank (TCB)', value: 'TCB' },
  { label: 'BIDV (BIDV)', value: 'BIDV' },
  { label: 'ACB (ACB)', value: 'ACB' },
  { label: 'MB Bank (MBB)', value: 'MBB' },
] as const;

const companyBankPurposeOptions = [
  { label: 'Select purpose', value: '' },
  { label: 'Collections', value: 'COLLECTION' },
  { label: 'Refunds', value: 'REFUND' },
  { label: 'Partner payouts', value: 'PAYOUT' },
  { label: 'Reconciliation', value: 'RECONCILIATION' },
  { label: 'Adjustments', value: 'ADJUSTMENT' },
] as const;

const companyBankAccountFilterLabels: Record<keyof CompanyBankAccountListFilters, Record<string, string>> = {
  currency: { VND: 'VND' },
  health: { ATTENTION: 'Needs reconciliation', HEALTHY: 'Healthy' },
  purpose: {
    ADJUSTMENT: 'Adjustments',
    COLLECTION: 'Collections',
    PAYOUT: 'Partner payouts',
    RECONCILIATION: 'Reconciliation',
    REFUND: 'Refunds',
  },
  status: {
    ARCHIVED_WITH_HISTORY: 'Archived with history',
    DISABLED_BY_SYSTEM: 'Disabled by system',
    NEVER_ACTIVATED: 'Never activated',
    PENDING_ACTIVATION: 'Pending activation',
    PENDING_CHANGE: 'Pending change',
    REJECTED: 'Rejected',
  },
  verification: {
    EVIDENCE_SUBMITTED: 'Evidence submitted',
    FAILED: 'Failed verification',
    UNVERIFIED: 'Unverified',
    VERIFIED: 'Verified',
  },
};

const companyBankAccountFilterAllLabels: Record<keyof CompanyBankAccountListFilters, string> = {
  currency: 'All currencies',
  health: 'All reconciliation health',
  purpose: 'All purposes',
  status: 'All lifecycle states',
  verification: 'All verification states',
};

function companyBankAccountFilterOptions(
  key: keyof CompanyBankAccountListFilters,
  values: readonly string[],
) {
  return [
    { label: companyBankAccountFilterAllLabels[key], value: '' },
    ...values.map((value) => ({
      label: companyBankAccountFilterLabels[key][value] ?? value.replaceAll('_', ' ').toLowerCase(),
      value,
    })),
  ];
}

function emptyCompanyBankAccountFilterContract(view: CompanyBankAccountView): CompanyBankAccountFilterContract {
  return {
    currency: ['VND'],
    health: view === 'remediation' ? [] : ['HEALTHY', 'ATTENTION'],
    purpose: ['COLLECTION', 'REFUND', 'PAYOUT', 'RECONCILIATION', 'ADJUSTMENT'],
    status: view === 'pending'
      ? ['PENDING_ACTIVATION', 'PENDING_CHANGE']
      : view === 'archived'
        ? ['NEVER_ACTIVATED', 'REJECTED', 'ARCHIVED_WITH_HISTORY', 'DISABLED_BY_SYSTEM']
        : [],
    verification: ['UNVERIFIED', 'EVIDENCE_SUBMITTED', 'VERIFIED', 'FAILED'],
  };
}

function companyBankAccountFiltersEqual(
  left: CompanyBankAccountListFilters,
  right: CompanyBankAccountListFilters,
) {
  return (Object.keys(left) as Array<keyof CompanyBankAccountListFilters>)
    .every((key) => left[key].toUpperCase() === right[key].toUpperCase());
}

const companyBankDirectionOptions = [
  { label: 'Select direction', value: '' },
  { label: 'Inbound', value: 'INBOUND' },
  { label: 'Outbound', value: 'OUTBOUND' },
  { label: 'Inbound and outbound', value: 'BOTH' },
] as const;

const companyBankPrimaryOptions = [
  { label: 'No', value: 'false' },
  { label: 'Yes', value: 'true' },
] as const;

const companyBankVerificationOptions = [
  { label: 'Unverified', value: 'UNVERIFIED' },
  { label: 'Evidence submitted', value: 'EVIDENCE_SUBMITTED' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Failed verification', value: 'FAILED' },
] as const;

function companyBankNameFromCode(bankCode: string) {
  return companyBankOptions.find((option) => option.value === bankCode)?.label.replace(/ \([A-Z]+\)$/u, '') ?? bankCode;
}

function emptyCompanyBankAccountOperationsPage(
  view: CompanyBankAccountView,
  skip: number,
  take: number,
): CompanyBankAccountOperationsPage {
  return {
    filterContract: emptyCompanyBankAccountFilterContract(view),
    filters: { currency: '', health: '', purpose: '', status: '', verification: '' },
    generatedAt: new Date(0).toISOString(),
    items: [],
    pagination: { skip, take, totalCount: 0 },
    summary: {
      productionCount: 0,
      syntheticCount: 0,
      unknownDataScopeCount: 0,
      lastRecordedStatementImport: null,
      oldestPendingRequestedAt: null,
      pendingApprovalCount: 0,
      reconciliationHealth: 'HEALTHY',
      unmatchedCount: 0,
      usableRealAccountCount: 0,
    },
    view,
  };
}

function emptyCompanyBankAccountStatusPreflight(
  accountId: string,
  nextStatus: 'ACTIVE' | 'INACTIVE',
): CompanyBankAccountStatusPreflight {
  return {
    accountId,
    archiveImpact: { ready: false, sources: [] },
    blockers: [{ code: 'PREFLIGHT_UNAVAILABLE', label: 'Status preflight could not be loaded' }],
    duplicateCandidate: null,
    eligibleApproverCount: 0,
    generatedAt: new Date(0).toISOString(),
    impact: {
      incompleteImportBatchCount: 0,
      lastOpenActivityAt: null,
      openTransactionCount: 0,
      scheduledReferenceCount: null,
      totalTransactionCount: 0,
    },
    mode: nextStatus === 'ACTIVE' ? 'ACTIVATION' : 'ARCHIVE',
    preflightHash: '',
    ready: false,
    replacementAccount: null,
    replacementCandidates: [],
    statementImportEvidence: null,
  };
}

function CompanyBankAccountPreflightSummary({
  preflight,
}: {
  readonly preflight: CompanyBankAccountStatusPreflight;
}) {
  return (
    <div className="company-bank-account-preflight">
      <p>
        {preflight.mode === 'ACTIVATION'
          ? 'Activation makes this account available to new statement imports after checker approval.'
          : 'Archive removes this account from new imports while preserving all historical evidence.'}
      </p>
      <dl>
        <div><dt>Separate approvers</dt><dd>{formatWholeNumber(preflight.eligibleApproverCount)}</dd></div>
        <div><dt>Transaction references</dt><dd>{formatWholeNumber(preflight.impact.totalTransactionCount)}</dd></div>
        <div><dt>Open reconciliation</dt><dd>{formatWholeNumber(preflight.impact.openTransactionCount)}</dd></div>
        <div><dt>Incomplete import batches</dt><dd>{formatWholeNumber(preflight.impact.incompleteImportBatchCount)}</dd></div>
      </dl>
      <p className="muted">Preflight generated <DateTimeText value={preflight.generatedAt} /></p>
      {preflight.statementImportEvidence ? (
        <p className="company-bank-account-preflight-ready">
          <ShieldCheck aria-hidden="true" size={16} /> Successful statement import recorded <DateTimeText value={preflight.statementImportEvidence.importedAt} />
        </p>
      ) : null}
      {preflight.duplicateCandidate ? (
        <AdminInlineNotice role="alert" tone="warning">
          Potential duplicate: {preflight.duplicateCandidate.name} · {preflight.duplicateCandidate.bankName} {preflight.duplicateCandidate.accountNumberMasked ?? ''}
        </AdminInlineNotice>
      ) : null}
      {preflight.blockers.length > 0 ? (
        <div className="company-bank-account-preflight-blockers" role="alert">
          <strong><AlertTriangle aria-hidden="true" size={16} /> Resolve before submitting</strong>
          <ul>{preflight.blockers.map((blocker) => <li key={blocker.code}>{blocker.label}</li>)}</ul>
        </div>
      ) : (
        <p className="company-bank-account-preflight-ready"><ShieldCheck aria-hidden="true" size={16} /> Preflight checks passed.</p>
      )}
      {preflight.mode === 'ARCHIVE' && preflight.replacementCandidates.length > 0 ? (
        <div className="company-bank-account-replacement-options">
          <strong>{preflight.replacementAccount ? 'Selected replacement account' : 'Select an active replacement account'}</strong>
          <div className="actions">
            {preflight.replacementCandidates.map((candidate) => (
              <AdminFormControlLink
                aria-current={preflight.replacementAccount?.id === candidate.id ? 'true' : undefined}
                className={preflight.replacementAccount?.id === candidate.id ? 'button-primary' : 'button-secondary'}
                href={companyBankAccountStatusHref(preflight.accountId, 'INACTIVE', 'current', candidate.id)}
                key={candidate.id}
              >
                {candidate.name} · {candidate.bankName} {candidate.accountNumberMasked ?? ''}
              </AdminFormControlLink>
            ))}
          </div>
        </div>
      ) : null}
      {preflight.mode === 'ARCHIVE' ? (
        <div className="company-bank-account-reference-coverage">
          <strong>Reference coverage</strong>
          <dl>
            {(preflight.archiveImpact?.sources ?? []).map((source) => (
              <div key={source.source}>
                <dt>{companyBankAccountArchiveSourceLabel(source.source)}</dt>
                <dd>
                  <StatusBadge tone={source.coverage === 'COMPLETE' ? 'success' : source.coverage === 'NOT_APPLICABLE' ? 'neutral' : 'warning'}>{source.coverage.replaceAll('_', ' ')}</StatusBadge>
                  <span>
                    {typeof source.totalCount === 'number' && Number.isFinite(source.totalCount)
                      ? `${formatWholeNumber(source.totalCount)} linked`
                      : 'Linked total unavailable'}
                  </span>
                  {source.reason ? <span className="muted">{source.reason}</span> : null}
                  <span>
                    {typeof source.openCount === 'number' && Number.isFinite(source.openCount)
                      ? `${formatWholeNumber(source.openCount)} open`
                      : 'Open total unavailable'}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted">Incomplete reference coverage blocks archive. Unsupported sources are not reported as zero.</p>
        </div>
      ) : null}
    </div>
  );
}

function CompanyBankAccountPagination({
  currentPage,
  filters,
  take,
  totalCount,
  view,
}: {
  readonly currentPage: number;
  readonly filters: CompanyBankAccountListFilters;
  readonly take: number;
  readonly totalCount: number;
  readonly view: CompanyBankAccountView;
}) {
  const totalPages = Math.max(Math.ceil(totalCount / take), 1);
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Company bank account pages" className="actions company-bank-account-pagination">
      {currentPage > 1 ? (
        <AdminFormControlLink className="button-secondary" href={companyBankAccountPageHref({ filters, page: currentPage - 1, view })}>Previous</AdminFormControlLink>
      ) : null}
      <span>Page {formatWholeNumber(currentPage)} of {formatWholeNumber(totalPages)}</span>
      {currentPage < totalPages ? (
        <AdminFormControlLink className="button-secondary" href={companyBankAccountPageHref({ filters, page: currentPage + 1, view })}>Next</AdminFormControlLink>
      ) : null}
    </nav>
  );
}

function pluralizeCompanyBankAccounts(count: number) {
  return `${formatWholeNumber(count)} ${count === 1 ? 'account' : 'accounts'}`;
}

function pluralizeTransactions(count: number) {
  return `${formatWholeNumber(count)} ${count === 1 ? 'transaction' : 'transactions'}`;
}

function pluralizeChanges(count: number) {
  return `${formatWholeNumber(count)} ${count === 1 ? 'change' : 'changes'}`;
}

function companyBankAccountPurposeLabel(value: string | null) {
  return companyBankPurposeOptions.find((option) => option.value === value)?.label ?? 'Purpose not recorded';
}

function companyBankAccountDirectionLabel(value: string | null) {
  return companyBankDirectionOptions.find((option) => option.value === value)?.label ?? 'Direction not recorded';
}

function verificationLabel(value: string) {
  return companyBankVerificationOptions.find((option) => option.value === value)?.label ?? 'Verification unknown';
}

function verificationTone(value: string) {
  if (value === 'VERIFIED') return 'success' as const;
  if (value === 'FAILED') return 'danger' as const;
  return value === 'EVIDENCE_SUBMITTED' ? 'warning' as const : 'neutral' as const;
}

function lifecycleLabel(value: string) {
  const labels: Record<string, string> = {
    ACTIVE: 'Active',
    ARCHIVED_WITH_HISTORY: 'Archived with history',
    DISABLED_BY_SYSTEM: 'Disabled by system',
    NEVER_ACTIVATED: 'Never activated',
    PENDING_ACTIVATION: 'Pending activation',
    PENDING_CHANGE: 'Pending change',
    REJECTED: 'Rejected',
    TEST_FIXTURE: 'Test fixture',
  };
  return labels[value] ?? 'Status unavailable';
}

function lifecycleTone(value: string) {
  if (value === 'ACTIVE') return 'success' as const;
  if (value.startsWith('PENDING')) return 'warning' as const;
  if (value === 'REJECTED' || value === 'DISABLED_BY_SYSTEM' || value === 'TEST_FIXTURE') return 'danger' as const;
  return 'neutral' as const;
}
