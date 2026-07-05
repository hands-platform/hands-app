import { ShieldCheck, UserCheck, UserCog, UsersRound } from 'lucide-react';

import type { AdminUser } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFormControlButton, AdminFormInput } from '../../../components/admin-form-controls';
import { AdminInlineActionForm } from '../../../components/admin-inline-action-form';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { ADMIN_OPERATOR_BASE_ROLE, FINANCE_APPROVER_ROLE } from '../../../lib/admin-operator-permissions';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { FinanceStageList } from '../finance-stage-list';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildTaxFinanceWorkflowLinks,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';
import { updateFinanceApproverRole } from './actions';

type FinanceApproversPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceApproversPage({ searchParams }: FinanceApproversPageProps) {
  const params = searchParams ? await searchParams : {};
  const users = await adminGet<AdminUser[]>('/admin/users?take=100', []);
  const adminUsers = users.filter((user) => user.roles.includes(ADMIN_OPERATOR_BASE_ROLE));
  const approverCount = adminUsers.filter((user) => isFinanceApprover(user)).length;
  const nonApproverCount = Math.max(adminUsers.length - approverCount, 0);
  const settlementFilters = readBookingSettlementFilters(params);
  const accountingFilters = readFinanceAccountingFilters(params, 'all');
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const roleNotice = readSearchParam(params.roleNotice);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters,
            current: 'finance-approvers',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Grant or revoke the second finance approval role used by settlement, payout, withdrawal, bank, and wallet money actions."
      metrics={[
        {
          helper: 'Admin users returned by the bounded admin user API.',
          label: 'Admin users',
          value: adminUsers.length,
        },
        {
          helper: 'Users allowed to approve finance money actions after maker submission.',
          label: 'Finance approvers',
          value: approverCount,
        },
        {
          helper: 'System keeps at least one finance approver and blocks self role changes.',
          label: 'Guard status',
          value: 'Protected',
        },
      ]}
      title="Finance Approvers"
    >
      <FinanceListCommandBoard ariaLabel="Approver command board">
        <FinanceListCommandCard
          detail="Share of admin users who can approve finance money actions after maker submission."
          href="/finance-tax/finance-approvers"
          icon={UserCheck}
          label="Approver coverage"
          tone={approverCount > 0 ? 'success' : 'danger'}
          value={formatFinancePercent(approverCount, adminUsers.length)}
        />
        <FinanceListCommandCard
          detail="Admin users returned by the bounded admin user API."
          href="/admin-operators"
          icon={UsersRound}
          label="Admin operators"
          tone={adminUsers.length > 0 ? 'info' : 'warning'}
          value={String(adminUsers.length)}
        />
        <FinanceListCommandCard
          detail="Admins without finance approval authority. Grant only when dual-control ownership is needed."
          href="/finance-tax/finance-approvers"
          icon={UserCog}
          label="Non-approver admins"
          tone={nonApproverCount > 0 ? 'warning' : 'success'}
          value={String(nonApproverCount)}
        />
        <FinanceListCommandCard
          detail="Self-change and final approver removal stay blocked by the API."
          href="/finance-tax/finance-approvers"
          icon={ShieldCheck}
          label="Dual-control guard"
          tone="success"
          value="Protected"
        />
      </FinanceListCommandBoard>

      {roleNotice ? (
        <AdminFilterPanel
          className={`admin-mb-16 ${roleNotice === 'updated' ? 'surface-success' : 'surface-danger'}`}
          description={roleNoticeMessage(roleNotice)}
          resultLabel={roleNotice}
          resultTone={roleNotice === 'updated' ? 'success' : 'danger'}
          title="Role update notice"
        />
      ) : null}

      <AdminFilterPanel
        className="admin-mb-16"
        description="Finance approver is not a generic menu count. It is a second-control role for actions that move money, recognize tax, or close finance evidence."
        resultLabel="Dual control"
        resultTone="warning"
        title="Finance approver operating rule"
      >
        <FinanceStageList
          items={[
            {
              helper:
                'Only admin users can receive the finance approver role. Customer or Partner accounts are rejected by the API.',
              key: 'admin-base-permission',
              label: 'Admin role remains the base permission',
              signal: '1',
              value: `${adminUsers.length} admins`,
            },
            {
              helper:
                'Payout, withdrawal, manual wallet, bank reconciliation, and tax closeout approvals require this role in addition to Admin.',
              key: 'money-approval-role',
              label: 'Finance approver is required for money approval',
              signal: '2',
              value: `${approverCount} approvers`,
            },
            {
              helper:
                'The API prevents an acting admin from changing their own finance role and prevents removing the final approver.',
              key: 'self-change-last-approver-guard',
              label: 'Self-change and last-approver removal are blocked',
              signal: '3',
              value: 'Safe guard',
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Use a reason for every role change. The API writes an immutable admin audit log with previous and next role sets."
        resultLabel={`${adminUsers.length} admin(s)`}
        resultTone="info"
        title="Finance approver directory"
      >
        <FinanceDataTable
            emptyMessage="No admin users were returned by the bounded admin user API."
            headers={['Admin', 'Roles', 'Latest session', 'Push devices', 'Finance approver']}
            rowCount={adminUsers.length}
          >
            {adminUsers.map((user) => {
              const enabled = isFinanceApprover(user);
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName ?? user.phone ?? user.id}</strong>
                    <div className="muted">{user.phone ?? user.id}</div>
                    <div className="muted">{user.id}</div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {user.roles.map((role) => (
                        <StatusBadge
                          key={role}
                          tone={role === FINANCE_APPROVER_ROLE ? 'success' : 'neutral'}
                        >
                          {role}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong>
                      {user.appSessions?.[0]?.lastSeenAt ? (
                        <DateTimeText value={user.appSessions[0].lastSeenAt} />
                      ) : (
                        'No recent session'
                      )}
                    </strong>
                    <div className="muted">{user.appSessions?.[0]?.platform ?? 'No platform'}</div>
                  </td>
                  <td>
                    <strong>{user.pushDevices?.filter((device) => device.enabled).length ?? 0} enabled</strong>
                    <div className="muted">{user.pushDevices?.length ?? 0} registered</div>
                  </td>
                  <td>
                    <AdminInlineActionForm
                      action={updateFinanceApproverRole}
                      className="inline-admin-action-form"
                    >
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="enabled" type="hidden" value={enabled ? 'false' : 'true'} />
                      <input name="returnTo" type="hidden" value="/finance-tax/finance-approvers" />
                      <AdminFormInput
                        label="Reason"
                        labelVisibility="visible"
                        name="reason"
                        placeholder={enabled ? 'Rotation or access removal reason' : 'Finance approval owner reason'}
                        required
                      />
                      <AdminFormControlButton
                        className={`btn ${enabled ? 'btn-outline' : 'btn-primary'}`}
                        type="submit"
                      >
                        {enabled ? 'Revoke approver' : 'Grant approver'}
                      </AdminFormControlButton>
                    </AdminInlineActionForm>
                  </td>
                </tr>
              );
            })}
          </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function isFinanceApprover(user: AdminUser) {
  return user.roles.includes(FINANCE_APPROVER_ROLE);
}

function roleNoticeMessage(notice: string) {
  switch (notice) {
    case 'updated':
      return 'Finance approver role was updated and the finance pages were refreshed.';
    case 'invalid':
      return 'No target admin user was provided. No role change was sent to the API.';
    case 'failed':
      return 'The API rejected this role update. Check that the target is an admin user and that at least one approver remains.';
    default:
      return 'Finance approver role action finished.';
  }
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
