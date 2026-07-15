import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ActionMenu } from '../../../components/action-menu';
import {
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDisclosure } from '../../../components/admin-surface';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type { AdminAuditLog, AdminCompanyBankAccount, AdminUser } from '../../../lib/admin-api';
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
import { buildCompanyBankAccountApproverOptions } from './company-bank-account-approver-model';

type CompanyBankAccountsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const COMPANY_BANK_ACCOUNTS_PATH = '/finance-tax/company-bank-accounts';

export default async function CompanyBankAccountsPage({ searchParams }: CompanyBankAccountsPageProps = {}) {
  const params = searchParams ? await searchParams : {};
  const dialog = readParam(params, 'dialog');
  const requestedAccountId = readParam(params, 'accountId');
  const statusConfirmationRequested = readParam(params, 'confirm') === 'status';
  const needsApproverDirectory = dialog === 'new' || dialog === 'edit' || statusConfirmationRequested;
  const [accounts, auditLogs, currentOperatorAccess, approverUsers] = await Promise.all([
    adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ALL', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs?q=company_bank_account&take=20', []),
    needsApproverDirectory ? getCurrentAdminOperatorAccess() : Promise.resolve(null),
    needsApproverDirectory
      ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
      : Promise.resolve([]),
  ]);
  const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length;
  const inactiveCount = Math.max(accounts.length - activeCount, 0);
  const accountAuditLogs = auditLogs.filter((log) => log.target.startsWith('company_bank_account:'));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const approverOptions = buildCompanyBankAccountApproverOptions(
    approverUsers,
    currentOperatorAccess?.id ?? null,
  );
  const editingAccount = dialog === 'edit' ? accounts.find((account) => account.id === requestedAccountId) ?? null : null;
  const statusAccount =
    statusConfirmationRequested
      ? accounts.find((account) => account.id === requestedAccountId) ?? null
      : null;
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
        <CompanyBankAccountCreateForm approverOptions={approverOptions} />
      ) : dialog === 'edit' && editingAccount ? (
        <CompanyBankAccountEditForm account={editingAccount} approverOptions={approverOptions} />
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
          disabled={approverOptions.length === 0}
          selectInputs={[
            {
              label: 'Separate Finance approver',
              name: 'approvalAdminId',
              options: [{ label: 'Select Finance approver', value: '' }, ...approverOptions],
              required: true,
            },
          ]}
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
          title={`${nextStatus === 'ACTIVE' ? 'Activate' : 'Archive'} ${statusAccount.name}?`}
          tone={nextStatus === 'ACTIVE' ? 'success' : 'warning'}
        />
      ) : statusConfirmationRequested ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          The requested status action is no longer available. Reload the account list before retrying.
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        grouped
        description="Creating, renaming, activating, and archiving an account requires a different Finance approver and records before/after audit evidence. Account identity cannot be edited after transactions exist."
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
                <span className="muted">#{account.id}</span>
              </td>
              <td>{account.bankName}</td>
              <td>{account.accountNumberMasked ?? account.accountNumberLast4 ?? 'Not provided'}</td>
              <td>{account.currency}</td>
              <td>
                <StatusBadge tone={statusTone(account.status)}>{account.status}</StatusBadge>
              </td>
              <td>
                <ActionMenu
                  actions={[
                    {
                      href: `${COMPANY_BANK_ACCOUNTS_PATH}?dialog=edit&accountId=${encodeURIComponent(account.id)}`,
                      icon: Pencil,
                      kind: 'link',
                      label: 'Edit name',
                      tone: 'info',
                    },
                    account.status === 'ACTIVE'
                      ? {
                          href: companyBankAccountStatusHref(account.id, 'INACTIVE'),
                          icon: Archive,
                          kind: 'link' as const,
                          label: 'Archive',
                          tone: 'warning' as const,
                        }
                      : {
                          href: companyBankAccountStatusHref(account.id, 'ACTIVE'),
                          icon: RotateCcw,
                          kind: 'link' as const,
                          label: 'Activate',
                          tone: 'success' as const,
                        },
                  ]}
                  label={`Actions for ${account.name}`}
                  variant="dropdown"
                />
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
            const metadata = readPlainRecord(log.metadata);
            return (
              <tr key={log.id}>
                <td><DateTimeText value={log.createdAt} /></td>
                <td>
                  <strong>{accountById.get(accountId)?.name ?? accountId}</strong>
                  <span className="muted">#{accountId}</span>
                </td>
                <td><StatusBadge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</StatusBadge></td>
                <td>{adminAuditActorLabel(log)}</td>
                <td>{typeof metadata?.operatorReason === 'string' ? metadata.operatorReason : 'Evidence retained in audit log'}</td>
              </tr>
            );
          })}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function CompanyBankAccountCreateForm({
  approverOptions,
}: {
  readonly approverOptions: readonly { readonly label: string; readonly value: string }[];
}) {
  return (
    <AdminDisclosure className="admin-mb-16" open>
      <summary>
        <span>Add company bank account</span>
        <small>Store only a masked account number and its last four digits.</small>
      </summary>
      {approverOptions.length === 0 ? (
        <AdminInlineNotice className="admin-mt-12" role="alert" tone="warning">
          No other Finance approver is available. Assign the FINANCE_APPROVER role before creating an account.
        </AdminInlineNotice>
      ) : null}
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
        <AdminFormSelect
          label="Separate Finance approver"
          labelVisibility="visible"
          name="approvalAdminId"
          options={[{ label: 'Select Finance approver', value: '' }, ...approverOptions]}
          required
        />
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
          confirmLabel="Confirm approved account creation"
          detail="Creates an active import account. Only the masked number and last four digits are stored."
          disabled={approverOptions.length === 0}
          secondaryAction={<AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>Cancel</AdminFormControlLink>}
          title="Review bank account creation"
        />
      </AdminFormGrid>
    </AdminDisclosure>
  );
}

function CompanyBankAccountEditForm({
  account,
  approverOptions,
}: {
  readonly account: AdminCompanyBankAccount;
  readonly approverOptions: readonly { readonly label: string; readonly value: string }[];
}) {
  return (
    <AdminDisclosure className="admin-mb-16" open>
      <summary>
        <span>Edit account name</span>
        <small>{account.bankName} · {account.accountNumberMasked ?? account.accountNumberLast4 ?? account.id}</small>
      </summary>
      {approverOptions.length === 0 ? (
        <AdminInlineNotice className="admin-mt-12" role="alert" tone="warning">
          No other Finance approver is available. Assign the FINANCE_APPROVER role before editing this account.
        </AdminInlineNotice>
      ) : null}
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
        <AdminFormSelect
          label="Separate Finance approver"
          labelVisibility="visible"
          name="approvalAdminId"
          options={[{ label: 'Select Finance approver', value: '' }, ...approverOptions]}
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
          confirmLabel="Confirm approved name change"
          detail={`Renames ${account.name}. Bank identity, currency, status, and historical evidence remain unchanged.`}
          disabled={approverOptions.length === 0}
          secondaryAction={<AdminFormControlLink className="button-secondary" href={COMPANY_BANK_ACCOUNTS_PATH}>Cancel</AdminFormControlLink>}
          title="Review account name change"
        />
      </AdminFormGrid>
    </AdminDisclosure>
  );
}

async function createCompanyBankAccountAction(formData: FormData) {
  'use server';
  const confirmationIntent = readFormString(formData, 'confirmationIntent');
  const operatorReason = readFormString(formData, 'operatorReason');
  const approvalAdminId = readFormString(formData, 'approvalAdminId');
  if (
    !approvalAdminId ||
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
      approvalAdminId,
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
  const approvalAdminId = readFormString(formData, 'approvalAdminId');
  if (
    !accountId ||
    !approvalAdminId ||
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
      approvalAdminId,
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
  const approvalAdminId = readFormString(formData, 'approvalAdminId');
  const nextStatus = readFormString(formData, 'nextStatus') === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  if (
    !accountId ||
    !approvalAdminId ||
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
      approvalAdminId,
      operatorReason,
      status: nextStatus,
    });
  } catch (error) {
    redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?error=${companyBankAccountActionError(error)}`);
  }
  redirect(`${COMPANY_BANK_ACCOUNTS_PATH}?notice=status-updated`);
}

function companyBankAccountStatusHref(accountId: string, nextStatus: 'ACTIVE' | 'INACTIVE') {
  const search = new URLSearchParams({ accountId, confirm: 'status', nextStatus });
  return `${COMPANY_BANK_ACCOUNTS_PATH}?${search.toString()}`;
}

function companyBankAccountActionError(error: unknown) {
  if (error instanceof AdminApiRequestError && error.status === 409) return 'conflict';
  if (error instanceof AdminApiRequestError && error.status === 400) return 'invalid';
  return 'failed';
}

function companyBankAccountNotice(notice: string) {
  if (notice === 'created') return 'The approved company bank account was created.';
  if (notice === 'updated') return 'The approved account name change was saved.';
  if (notice === 'status-updated') return 'The approved account status change was saved.';
  return 'The bank account action completed.';
}

function companyBankAccountError(error: string) {
  if (error === 'confirmation-required') return 'Review confirmation, a separate approver, and at least 12 characters of evidence are required.';
  if (error === 'conflict') return 'The account already exists or changed during review. Reload before retrying.';
  if (error === 'invalid') return 'The bank account action was rejected. Check masking, approval, status, and evidence.';
  return 'The bank account action failed. No confirmed result was saved.';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function adminAuditActorLabel(log: AdminAuditLog) {
  return log.actor?.fullName ?? log.actor?.email ?? log.actor?.phone ?? log.actor?.id ?? 'Unknown operator';
}

function auditActionLabel(action: string) {
  if (action === 'company_bank_account.create') return 'Created';
  if (action === 'company_bank_account.update') return 'Updated';
  return action.replaceAll('_', ' ').replaceAll('.', ' ');
}

function auditActionTone(action: string) {
  return action === 'company_bank_account.create' ? 'success' as const : 'info' as const;
}

function statusTone(status: string) {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}
