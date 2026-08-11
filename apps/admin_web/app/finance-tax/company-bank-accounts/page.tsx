import { Archive, Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { redirect } from 'next/navigation';

import {
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminIconLink } from '../../../components/admin-icon-link';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDisclosure } from '../../../components/admin-surface';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAuditLog, AdminCompanyBankAccount } from '../../../lib/admin-api';
import {
  AdminApiRequestError,
  adminGet,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../../lib/admin-api';
import { formatWholeNumber, readPlainRecord } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceActionConfirmationDisclosure } from '../finance-action-confirmation-disclosure';
import { FinanceTablePanel } from '../finance-table-panel';
import {
  COMPANY_BANK_ACCOUNT_CREATE_INTENT,
  COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH,
  COMPANY_BANK_ACCOUNT_STATUS_INTENT,
  COMPANY_BANK_ACCOUNT_UPDATE_INTENT,
  isConfirmedCompanyBankAccountAction,
} from './company-bank-account-action-validation';

type CompanyBankAccountsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const COMPANY_BANK_ACCOUNTS_PATH = '/finance-tax/company-bank-accounts';

export default async function CompanyBankAccountsPage({ searchParams }: CompanyBankAccountsPageProps) {
  const params = searchParams ? await searchParams : {};
  const dialog = readParam(params, 'dialog');
  const requestedAccountId = readParam(params, 'accountId');
  const statusConfirmationRequested = readParam(params, 'confirm') === 'status';
  const requestedDecision = readParam(params, 'decision').toUpperCase();
  const approvalDecision =
    requestedDecision === 'APPROVE' || requestedDecision === 'REJECT'
      ? requestedDecision
      : null;
  const [accounts, auditLogs, currentOperatorAccess] = await Promise.all([
    adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ALL', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs?q=company_bank_account&take=20', []),
    getCurrentAdminOperatorAccess(),
  ]);
  const pendingApprovals = new Map(
    accounts
      .map((account) => [account.id, readCompanyBankAccountPendingApproval(account.metadata)] as const)
      .filter((entry): entry is readonly [string, CompanyBankAccountPendingApproval] => Boolean(entry[1])),
  );
  const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length;
  const inactiveCount = Math.max(accounts.length - activeCount, 0);
  const pendingCount = pendingApprovals.size;
  const accountAuditLogs = auditLogs.filter((log) => log.target.startsWith('company_bank_account:'));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const editingAccount = dialog === 'edit' ? accounts.find((account) => account.id === requestedAccountId) ?? null : null;
  const statusAccount =
    statusConfirmationRequested
      ? accounts.find((account) => account.id === requestedAccountId) ?? null
      : null;
  const approvalAccount =
    approvalDecision
      ? accounts.find((account) => account.id === requestedAccountId) ?? null
      : null;
  const approvalRequest = approvalAccount ? pendingApprovals.get(approvalAccount.id) ?? null : null;
  const approvalIsOwnRequest =
    approvalRequest?.requestedByAdminId === currentOperatorAccess?.id;
  const nextStatus = readParam(params, 'nextStatus') === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  const notice = readParam(params, 'notice');
  const error = readParam(params, 'error');

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink className="button-primary" href={`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=new`}>
            <Plus aria-hidden="true" size={16} />
            Add bank account
          </AdminFormControlLink>
          <AdminFormControlLink className="button-outline" href="/finance-tax/bank-reconciliation">
            Open bank reconciliation
          </AdminFormControlLink>
        </>
      }
      description="Approved company settlement accounts used for bank statement import and reconciliation evidence. Raw account numbers are never stored."
      metrics={[
        {
          helper: 'Accounts retained for reconciliation and bank import evidence.',
          kind: 'record',
          label: 'Total accounts',
          scope: 'Bank records',
          value: formatWholeNumber(accounts.length),
        },
        {
          helper: 'Accounts currently selectable for transaction import.',
          kind: 'live',
          label: 'Active accounts',
          scope: 'Live',
          value: formatWholeNumber(activeCount),
        },
        {
          helper: 'Creation or account changes waiting for another Finance approver.',
          kind: pendingCount > 0 ? 'risk' : 'action',
          label: 'Pending approval',
          scope: 'Needs action',
          value: formatWholeNumber(pendingCount),
        },
        {
          helper: 'Inactive accounts retained only for historical matching.',
          kind: 'record',
          label: 'Inactive accounts',
          scope: 'Audit records',
          value: formatWholeNumber(inactiveCount),
        },
      ]}
      title="Company Bank Accounts"
    >
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

      {dialog === 'new' ? (
        <CompanyBankAccountCreateForm />
      ) : dialog === 'edit' && editingAccount ? (
        <CompanyBankAccountEditForm account={editingAccount} />
      ) : dialog === 'edit' ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested bank account is not available. Reload the account list before editing.
        </AdminInlineNotice>
      ) : null}

      {statusAccount ? (
        <ConfirmDialog
          action={updateCompanyBankAccountStatusAction}
          cancelHref={COMPANY_BANK_ACCOUNTS_PATH}
          confirmLabel={nextStatus === 'ACTIVE' ? 'Activate account' : 'Archive account'}
          description={
            nextStatus === 'ACTIVE'
              ? 'The account becomes selectable for new statement imports. Historical evidence remains unchanged.'
              : 'The account is removed from new imports but remains available in historical transactions and reconciliation evidence.'
          }
          hiddenInputs={[
            { name: 'accountId', value: statusAccount.id },
            { name: 'confirmationAccountId', value: statusAccount.id },
            { name: 'confirmationIntent', value: COMPANY_BANK_ACCOUNT_STATUS_INTENT },
            { name: 'nextStatus', value: nextStatus },
          ]}
          id={`company-bank-account-status-${statusAccount.id}`}
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
      ) : statusConfirmationRequested ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested status action is no longer available. Reload the account list before retrying.
        </AdminInlineNotice>
      ) : null}

      {approvalAccount && approvalRequest && approvalDecision ? (
        <>
          {approvalIsOwnRequest ? (
            <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
              This request was submitted by the current operator. A different Finance approver must decide it.
            </AdminInlineNotice>
          ) : null}
          <ConfirmDialog
            action={decideCompanyBankAccountChangeAction}
            cancelHref={COMPANY_BANK_ACCOUNTS_PATH}
            confirmLabel={approvalDecision === 'APPROVE' ? 'Approve change' : 'Reject change'}
            description={
              approvalDecision === 'APPROVE'
                ? 'Applies the exact pending account proposal. The request maker cannot approve their own change.'
                : 'Keeps the current account unchanged and closes the pending request with rejection evidence.'
            }
            disabled={approvalIsOwnRequest}
            hiddenInputs={[
              { name: 'accountId', value: approvalAccount.id },
              { name: 'decision', value: approvalDecision },
              { name: 'requestId', value: approvalRequest.requestId },
            ]}
            id={`company-bank-account-decision-${approvalRequest.requestId}`}
            textInputs={[
              {
                label: approvalDecision === 'APPROVE' ? 'Approval evidence' : 'Rejection reason',
                maxLength: 500,
                minLength: COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH,
                name: 'operatorReason',
                placeholder:
                  approvalDecision === 'APPROVE'
                    ? 'What evidence confirms this account change?'
                    : 'Why should this request not be applied?',
                required: true,
              },
            ]}
            title={`${approvalDecision === 'APPROVE' ? 'Approve' : 'Reject'} ${approvalAccount.name}?`}
            tone={approvalDecision === 'APPROVE' ? 'success' : 'danger'}
          />
        </>
      ) : approvalDecision ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested approval is no longer available. Reload the account list before retrying.
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        grouped
        description="Operators submit account changes first. A different Finance approver applies or rejects the exact pending proposal. Account identity cannot be edited after transactions exist."
        resultLabel={`${formatWholeNumber(accounts.length)} account(s)`}
        resultTone="info"
        title="Bank account management"
      >
        <FinanceDataTable
          emptyMessage="No company bank accounts were returned by the bounded admin API."
          headers={['Account', 'Bank', 'Masked number', 'Currency', 'Status', 'Actions']}
          rowCount={accounts.length}
        >
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <strong>{account.name}</strong>
              </td>
              <td>{account.bankName}</td>
              <td>{account.accountNumberMasked ?? account.accountNumberLast4 ?? 'Not provided'}</td>
              <td>{account.currency}</td>
              <td>
                <StatusBadge tone={statusTone(account.status)}>{account.status}</StatusBadge>
                {pendingApprovals.has(account.id) ? (
                  <StatusBadge tone="warning">
                    {pendingApprovalLabel(pendingApprovals.get(account.id)?.operation)}
                  </StatusBadge>
                ) : null}
              </td>
              <td>
                <div className="actions">
                  {pendingApprovals.has(account.id) ? (
                    <>
                      <AdminIconLink
                        aria-label={`Approve pending change for ${account.name}`}
                        href={companyBankAccountDecisionHref(account.id, 'APPROVE')}
                        title="Approve pending change"
                      >
                        <Check aria-hidden="true" size={16} />
                      </AdminIconLink>
                      <AdminIconLink
                        aria-label={`Reject pending change for ${account.name}`}
                        href={companyBankAccountDecisionHref(account.id, 'REJECT')}
                        title="Reject pending change"
                      >
                        <X aria-hidden="true" size={16} />
                      </AdminIconLink>
                    </>
                  ) : (
                    <>
                      <AdminIconLink
                        aria-label={`Edit ${account.name}`}
                        href={`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=edit&accountId=${encodeURIComponent(account.id)}`}
                        title="Edit account name"
                      >
                        <Pencil aria-hidden="true" size={16} />
                      </AdminIconLink>
                      <AdminIconLink
                        aria-label={`${account.status === 'ACTIVE' ? 'Archive' : 'Activate'} ${account.name}`}
                        href={
                          account.status === 'ACTIVE'
                            ? companyBankAccountStatusHref(account.id, 'INACTIVE')
                            : companyBankAccountStatusHref(account.id, 'ACTIVE')
                        }
                        title={account.status === 'ACTIVE' ? 'Archive account' : 'Activate account'}
                      >
                        {account.status === 'ACTIVE' ? (
                          <Archive aria-hidden="true" size={16} />
                        ) : (
                          <RotateCcw aria-hidden="true" size={16} />
                        )}
                      </AdminIconLink>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        actions={<AdminFormControlLink className="button-secondary" href="/audit-log?q=company_bank_account">Open full audit log</AdminFormControlLink>}
        description="Latest 20 account create, rename, activation, and archive records. Full evidence remains in the Audit Log."
        resultLabel={`${formatWholeNumber(accountAuditLogs.length)} recent change(s)`}
        resultTone={accountAuditLogs.length > 0 ? 'warning' : 'success'}
        title="Recent account changes"
      >
        <FinanceDataTable
          emptyMessage="No recent company bank account changes were returned."
          headers={['Time', 'Account', 'Action', 'Operator', 'Evidence']}
          rowCount={accountAuditLogs.length}
        >
          {accountAuditLogs.map((log) => {
            const accountId = log.target.slice('company_bank_account:'.length);
            const account = accountById.get(accountId);
            const metadata = readPlainRecord(log.metadata);
            return (
              <tr key={log.id}>
                <td><DateTimeText value={log.createdAt} /></td>
                <td>
                  <strong>{account?.name ?? accountId}</strong>
                  {account ? (
                    <span className="muted">
                      {account.bankName} · {account.accountNumberMasked ?? account.accountNumberLast4 ?? 'Masked'}
                    </span>
                  ) : null}
                </td>
                <td><StatusBadge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</StatusBadge></td>
                <td>{adminAuditActorLabel(log)}</td>
                <td>
                  {typeof metadata?.decisionReason === 'string'
                    ? metadata.decisionReason
                    : typeof metadata?.operatorReason === 'string'
                      ? metadata.operatorReason
                      : 'Evidence retained in audit log'}
                </td>
              </tr>
            );
          })}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function CompanyBankAccountCreateForm() {
  return (
    <AdminDisclosure className="admin-mb-16" open>
      <summary>
        <span>Add company bank account</span>
        <small>Store only a masked account number and its last four digits.</small>
      </summary>
      <AdminFormGrid action={createCompanyBankAccountAction} className="compact-form admin-mt-12">
        <input name="confirmationIntent" type="hidden" value={COMPANY_BANK_ACCOUNT_CREATE_INTENT} />
        <AdminFormInput label="Account name" labelVisibility="visible" maxLength={120} name="name" required />
        <AdminFormInput label="Bank name" labelVisibility="visible" maxLength={120} name="bankName" required />
        <AdminFormInput
          label="Masked account number"
          labelVisibility="visible"
          maxLength={64}
          name="accountNumberMasked"
          placeholder="****1234"
        />
        <AdminFormInput
          label="Last four digits"
          labelVisibility="visible"
          maxLength={4}
          minLength={4}
          name="accountNumberLast4"
          placeholder="1234"
          required
        />
        <AdminFormInput defaultValue="VND" label="Currency" labelVisibility="visible" maxLength={3} name="currency" required />
        <AdminFormTextarea
          className="form-grid-wide"
          label="Creation evidence"
          labelVisibility="visible"
          maxLength={500}
          minLength={COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH}
          name="operatorReason"
          placeholder="Why is this company account required, and what evidence was reviewed?"
          required
        />
        <FinanceActionConfirmationDisclosure
          className="form-grid-wide"
          confirmLabel="Submit creation request"
          detail="Creates an inactive account request. A different Finance approver must activate it before statement import."
          secondaryAction={<AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>Cancel</AdminFormControlLink>}
          title="Review creation request"
        />
      </AdminFormGrid>
    </AdminDisclosure>
  );
}

function CompanyBankAccountEditForm({
  account,
}: {
  readonly account: AdminCompanyBankAccount;
}) {
  return (
    <AdminDisclosure className="admin-mb-16" open>
      <summary>
        <span>Edit account name</span>
        <small>{account.bankName} · {account.accountNumberMasked ?? account.accountNumberLast4 ?? account.id}</small>
      </summary>
      <AdminFormGrid action={updateCompanyBankAccountNameAction} className="compact-form admin-mt-12">
        <input name="accountId" type="hidden" value={account.id} />
        <input name="confirmationAccountId" type="hidden" value={account.id} />
        <input name="confirmationIntent" type="hidden" value={COMPANY_BANK_ACCOUNT_UPDATE_INTENT} />
        <AdminFormInput
          defaultValue={account.name}
          label="Account name"
          labelVisibility="visible"
          maxLength={120}
          name="name"
          required
        />
        <AdminFormTextarea
          className="form-grid-wide"
          label="Update evidence"
          labelVisibility="visible"
          maxLength={500}
          minLength={COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH}
          name="operatorReason"
          placeholder="Why should the account display name change?"
          required
        />
        <FinanceActionConfirmationDisclosure
          className="form-grid-wide"
          confirmLabel="Submit name change"
          detail={`Requests a rename for ${account.name}. The current name remains until another Finance approver approves it.`}
          secondaryAction={<AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>Cancel</AdminFormControlLink>}
          title="Review name change request"
        />
      </AdminFormGrid>
    </AdminDisclosure>
  );
}

async function createCompanyBankAccountAction(formData: FormData) {
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
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=new&error=confirmation-required`);
  }
  try {
    await adminPostOrThrow('/admin/company-bank-accounts', {
      accountNumberLast4: readFormString(formData, 'accountNumberLast4'),
      accountNumberMasked: readFormString(formData, 'accountNumberMasked') || undefined,
      bankName: readFormString(formData, 'bankName'),
      currency: readFormString(formData, 'currency'),
      name: readFormString(formData, 'name'),
      operatorReason,
    });
  } catch (error) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?dialog=new&error=${companyBankAccountActionError(error)}`);
  }
  redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?notice=created`);
}

async function updateCompanyBankAccountNameAction(formData: FormData) {
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
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=confirmation-required`);
  }
  try {
    await adminPatchOrThrow(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`, {
      name: readFormString(formData, 'name'),
      operatorReason,
    });
  } catch (error) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=${companyBankAccountActionError(error)}`);
  }
  redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?notice=updated`);
}

async function updateCompanyBankAccountStatusAction(formData: FormData) {
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
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=confirmation-required`);
  }
  try {
    await adminPatchOrThrow(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`, {
      operatorReason,
      status: nextStatus,
    });
  } catch (error) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=${companyBankAccountActionError(error)}`);
  }
  redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?notice=status-updated`);
}

async function decideCompanyBankAccountChangeAction(formData: FormData) {
  'use server';
  const accountId = readFormString(formData, 'accountId');
  const decision = readFormString(formData, 'decision').toUpperCase();
  const operatorReason = readFormString(formData, 'operatorReason');
  const requestId = readFormString(formData, 'requestId');
  if (
    !accountId ||
    (decision !== 'APPROVE' && decision !== 'REJECT') ||
    !requestId ||
    operatorReason.length < COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH
  ) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=confirmation-required`);
  }
  try {
    await adminPostOrThrow(
      `/admin/company-bank-accounts/${encodeURIComponent(accountId)}/approval-decision`,
      {
        decision,
        operatorReason,
        requestId,
      },
    );
  } catch (error) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=${companyBankAccountActionError(error)}`);
  }
  redirect(
    `${COMPANY_BANK_ACCOUNTS_PATH}?notice=${decision === 'APPROVE' ? 'approved' : 'rejected'}`,
  );
}

function companyBankAccountStatusHref(accountId: string, nextStatus: 'ACTIVE' | 'INACTIVE') {
  const search = new URLSearchParams({ accountId, confirm: 'status', nextStatus });
  return `${COMPANY_BANK_ACCOUNTS_PATH}?${search.toString()}`;
}

function companyBankAccountDecisionHref(accountId: string, decision: 'APPROVE' | 'REJECT') {
  const search = new URLSearchParams({ accountId, decision });
  return `${COMPANY_BANK_ACCOUNTS_PATH}?${search.toString()}`;
}

function companyBankAccountActionError(error: unknown) {
  if (error instanceof AdminApiRequestError && error.status === 409) return 'conflict';
  if (error instanceof AdminApiRequestError && error.status === 400) return 'invalid';
  return 'failed';
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
  if (error === 'conflict') return 'The account already exists or changed during review. Reload before retrying.';
  if (error === 'invalid') return 'The bank account action was rejected. Check role separation, masking, status, and evidence.';
  return 'The bank account action failed. No confirmed result was saved.';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

type CompanyBankAccountPendingApproval = {
  operation: 'CREATE' | 'UPDATE';
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
    (operation !== 'CREATE' && operation !== 'UPDATE') ||
    !requestedByAdminId ||
    !requestId
  ) {
    return null;
  }
  return { operation, requestedByAdminId, requestId };
}

function pendingApprovalLabel(operation: CompanyBankAccountPendingApproval['operation'] | undefined) {
  return operation === 'CREATE' ? 'Creation pending' : 'Change pending';
}

function adminAuditActorLabel(log: AdminAuditLog) {
  return log.actor?.fullName ?? log.actor?.email ?? log.actor?.phone ?? log.actor?.id ?? 'Unknown operator';
}

function auditActionLabel(action: string) {
  if (action === 'company_bank_account.approval_requested') return 'Approval requested';
  if (action === 'company_bank_account.approval_rejected') return 'Rejected';
  if (action === 'company_bank_account.create') return 'Created';
  if (action === 'company_bank_account.update') return 'Updated';
  return action.replaceAll('_', ' ').replaceAll('.', ' ');
}

function auditActionTone(action: string) {
  if (action === 'company_bank_account.approval_rejected') return 'danger' as const;
  if (action === 'company_bank_account.approval_requested') return 'warning' as const;
  return action === 'company_bank_account.create' ? 'success' as const : 'info' as const;
}

function statusTone(status: string) {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}
