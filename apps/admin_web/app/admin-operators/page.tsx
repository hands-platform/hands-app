import type { AdminAuditLog, AdminUser } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormCheckbox, AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminInlineActionForm } from '../../components/admin-inline-action-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminCard, AdminFormCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import {
  createAdminOperator,
  revokeAdminOperatorAccess,
  updateAdminOperatorAccess,
} from './actions';
import {
  ADMIN_OPERATOR_BASE_ROLE,
  FINANCE_APPROVER_ROLE,
  MASTER_ADMIN_ROLE,
  adminOperatorAssignableRoleFields,
  adminOperatorPermissionCategoryDefinitions,
  expandLegacyAdminOperatorCategories,
} from '../../lib/admin-operator-permissions';

type AdminOperatorsPageProps = {
  readonly searchParams?: Promise<{ readonly operatorNotice?: string }>;
};

export default async function AdminOperatorsPage({ searchParams }: AdminOperatorsPageProps) {
  const params = searchParams ? await searchParams : {};
  const [users, operatorActivityLogs] = await Promise.all([
    adminGet<AdminUser[]>('/admin/users?take=100', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs?bucket=Admin%20Web&take=30', []),
  ]);
  const adminUsers = users.filter((user) => user.roles.includes(ADMIN_OPERATOR_BASE_ROLE));
  const masterAdminCount = adminUsers.filter((user) => user.roles.includes(MASTER_ADMIN_ROLE)).length;
  const financeApproverCount = adminUsers.filter((user) => user.roles.includes(FINANCE_APPROVER_ROLE)).length;
  const activeSessionCount = adminUsers.filter((user) => user.appSessions?.some((session) => session.active)).length;

  return (
    <AdminPageTemplate
      description="Master Admin workspace for operator creation, access removal, category permissions, and audited role control."
      metrics={[
        {
          helper: 'Admin role users returned by the bounded Admin API.',
          label: 'Admin operators',
          value: adminUsers.length,
        },
        {
          helper: 'Operators with an active Admin Web or app session record.',
          label: 'Active sessions',
          value: activeSessionCount,
        },
        {
          helper: 'Operators allowed to manage all admin operator access.',
          label: 'Master admins',
          value: masterAdminCount,
        },
        {
          helper: 'Second-control admins for money, tax, payout, and bank actions.',
          label: 'Finance approvers',
          value: financeApproverCount,
        },
      ]}
      title="Admin Operators"
    >
      {params.operatorNotice ? <OperatorNotice notice={params.operatorNotice} /> : null}

      <AdminFilterPanel
        className="admin-operator-master-card admin-mb-16"
        description="Create admin operators, grant category access, or revoke admin access without deleting the underlying user account."
        resultLabel="Master admin control"
        resultTone="info"
        title="Master admin control"
      >
        <div className="admin-operator-control-grid">
          <AdminFormCard action={createAdminOperator} className="admin-operator-control-card" ariaLabel="Add operator">
            <div>
              <h3>Add operator</h3>
              <p className="muted">Creates a new operator login and grants Admin Web access by email.</p>
            </div>
            <AdminFormInput label="Operator email" name="email" placeholder="operator@hands.vn" required type="email" />
            <AdminFormInput label="Temporary password" name="password" placeholder="Set initial password" required type="password" />
            <AdminFormInput label="Operator name" name="fullName" placeholder="Full name" />
            <div className="admin-operator-permission-toggle-row" aria-label="Operator roles">
              {adminOperatorAssignableRoleFields.map((role) => (
                <AdminFormCheckbox key={role.value} label={role.label} name="roles" value={role.value}>
                  <span>{role.label}</span>
                </AdminFormCheckbox>
              ))}
            </div>
            <CategoryCheckboxGrid defaults={['BOOKINGS_REALTIME', 'CUSTOMERS_DIRECTORY', 'PARTNERS_DIRECTORY', 'NOTIFICATIONS_PUSH']} />
            <AdminFormInput label="Reason" name="reason" placeholder="Access request reason" />
            <AdminFormControlButton className="button-primary" type="submit">
              Add operator
            </AdminFormControlButton>
          </AdminFormCard>
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-operator-permission-card admin-mb-16"
        description="Category permissions are stored separately from the broad Admin role so each operator can be granted only the page groups they need."
        resultLabel={`${adminOperatorPermissionCategoryDefinitions.length} categories`}
        resultTone="info"
        title="Category permissions"
      >
        <div className="admin-operator-permission-grid">
          {adminOperatorPermissionCategoryDefinitions.map((category) => (
            <AdminCard className="admin-operator-permission-item" key={category.key}>
              <div>
                <strong>{category.label}</strong>
                <StatusBadge tone="neutral">{category.group}</StatusBadge>
                <p className="muted">{category.scope}</p>
              </div>
              <small>{category.defaultOwner}</small>
            </AdminCard>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminTablePanel
        description="Recent Admin Web page visits and server actions are stored in the shared audit log by resolved operator identity."
        resultLabel={`${operatorActivityLogs.length} recent action(s)`}
        resultTone="info"
        title="Operator activity log"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-operator-table"
            emptyMessage="No Admin Web operator activity has been recorded yet."
            headers={['Operator', 'Activity', 'Target', 'Time']}
            rowCount={operatorActivityLogs.length}
          >
            {operatorActivityLogs.map((log) => (
              <tr key={log.id}>
                <td>
                  <strong>{log.actor?.fullName ?? log.actor?.email ?? log.actor?.phone ?? log.actor?.id ?? 'Admin'}</strong>
                  <div className="muted">{log.actor?.email ?? log.actor?.phone ?? log.actor?.id ?? 'Unknown operator'}</div>
                </td>
                <td>
                  <strong>{operatorActivityLabel(log.action)}</strong>
                  <div className="muted">{operatorActivityMetadataLabel(log.metadata)}</div>
                </td>
                <td>
                  <span className="muted">{log.target}</span>
                </td>
                <td>
                  <DateTimeText value={log.createdAt} />
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminTablePanel>

      <AdminTablePanel
        description="This table uses the existing bounded /admin/users API and only displays users with the ADMIN role."
        resultLabel={`${adminUsers.length} admin(s)`}
        resultTone="info"
        title="Operator directory"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-operator-table"
            emptyMessage="No admin operators were returned by the bounded admin user API."
            headers={['Operator', 'Roles', 'Latest session', 'Category access', 'Actions']}
            rowCount={adminUsers.length}
          >
            {adminUsers.map((user) => {
              const isMasterAdmin = user.roles.includes(MASTER_ADMIN_ROLE);

              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName ?? user.phone ?? user.id}</strong>
                    <div className="muted">{user.email ?? user.phone ?? user.id}</div>
                    <div className="muted">{user.id}</div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {user.roles.map((role) => (
                        <StatusBadge tone={statusBadgeToneFromPillClass(operatorRolePillClassName(role))} key={role}>
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
                        <AdminInlineFallback>No recent session</AdminInlineFallback>
                      )}
                    </strong>
                    {user.appSessions?.[0]?.platform ? (
                      <div className="muted">{user.appSessions[0].platform}</div>
                    ) : (
                      <AdminInlineFallback className="admin-mt-6">No platform</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    {isMasterAdmin ? (
                      <div className="admin-operator-master-access" role="note">
                        <StatusBadge tone="primary">All categories</StatusBadge>
                      </div>
                    ) : (
                      <div className="admin-operator-access-pills">
                        {operatorAccessLabels(user).map((label) => (
                          <StatusBadge tone="info" key={`${user.id}:${label}`}>
                            {label}
                          </StatusBadge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="admin-operator-action-stack">
                      <AdminInlineActionForm
                        action={updateAdminOperatorAccess}
                        className="admin-operator-inline-form"
                      >
                        <input name="userId" type="hidden" value={user.id} />
                        <div className="admin-operator-permission-toggle-row" aria-label={`${user.id} roles`}>
                          {adminOperatorAssignableRoleFields.map((role) => (
                            <AdminFormCheckbox
                              defaultChecked={user.roles.includes(role.value)}
                              key={role.value}
                              label={role.label}
                              name="roles"
                              value={role.value}
                            >
                              <span>{role.label}</span>
                            </AdminFormCheckbox>
                          ))}
                        </div>
                        {isMasterAdmin ? (
                          null
                        ) : (
                          <CategoryCheckboxGrid defaults={operatorPermissionCategoryKeys(user)} compact />
                        )}
                        <AdminFormInput label="Update reason" name="reason" placeholder="Reason" />
                        <div className="admin-operator-row-actions">
                          <AdminFormControlButton className="button-secondary admin-inline-action" type="submit">
                            Save permissions
                          </AdminFormControlButton>
                        </div>
                      </AdminInlineActionForm>
                      <AdminInlineActionForm
                        action={revokeAdminOperatorAccess}
                        className="admin-operator-inline-delete-form"
                      >
                        <input name="userId" type="hidden" value={user.id} />
                        <input name="reason" type="hidden" value="Master Admin row action" />
                        <AdminFormControlButton className="button-danger admin-inline-action" type="submit">
                          Delete operator
                        </AdminFormControlButton>
                      </AdminInlineActionForm>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminTablePanel>
    </AdminPageTemplate>
  );
}

function OperatorNotice({ notice }: { readonly notice: string }) {
  const message =
    {
      'admin-auth': 'Admin API authentication failed. Refresh the admin session and try again.',
      created: 'Operator access was created.',
      failed: 'Operator access update failed. Check master admin permission, duplicate phone, or last role guard.',
      'missing-email': 'Operator email is required.',
      'missing-phone': 'Operator phone is required.',
      'missing-password': 'Temporary password is required.',
      'missing-user': 'Admin user ID is required.',
      revoked: 'Operator access was revoked.',
      updated: 'Operator access was updated.',
    }[notice] ?? 'Operator action finished.';

  return (
    <AdminFilterPanel
      className="admin-mb-16"
      description={message}
      resultLabel={notice}
      resultTone={notice === 'created' || notice === 'updated' || notice === 'revoked' ? 'success' : 'warning'}
      title="Operator action"
    />
  );
}

function CategoryCheckboxGrid({
  compact = false,
  defaults,
}: {
  readonly compact?: boolean;
  readonly defaults: readonly string[];
}) {
  return (
    <div className={compact ? 'admin-operator-access-pills' : 'admin-operator-permission-toggle-row'}>
      {adminOperatorPermissionCategoryDefinitions.map((category) => (
        <AdminFormCheckbox
          defaultChecked={defaults.includes(category.key)}
          key={category.key}
          label={category.label}
          name="permissionCategories"
          value={category.key}
        >
          <span>{category.label}</span>
        </AdminFormCheckbox>
      ))}
    </div>
  );
}

function operatorAccessLabels(user: AdminUser) {
  const categories = operatorPermissionCategoryKeys(user);
  if (categories.length > 0) {
    return categories.map(
      (key) => adminOperatorPermissionCategoryDefinitions.find((category) => category.key === key)?.label ?? key,
    );
  }

  if (user.roles.includes(MASTER_ADMIN_ROLE)) {
    return adminOperatorPermissionCategoryDefinitions.map((category) => category.label);
  }
  if (user.roles.includes(FINANCE_APPROVER_ROLE)) {
    return ['Bookings', 'Finance', 'Tax & Accounting'];
  }

  return ['Bookings', 'Users', 'Partners'];
}

function operatorPermissionCategoryKeys(user: AdminUser) {
  const categories = user.adminOperatorPermission?.categories ?? [];
  return expandLegacyAdminOperatorCategories(categories);
}

function operatorRolePillClassName(role: string) {
  if (role === MASTER_ADMIN_ROLE) {
    return 'pill pill-primary';
  }
  if (role === FINANCE_APPROVER_ROLE) {
    return 'pill pill-success';
  }
  return 'pill pill-neutral';
}

function operatorActivityLabel(action: string) {
  return action.replace(/^admin_web\./u, '').replace(/_/gu, ' ');
}

function operatorActivityMetadataLabel(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'No metadata';
  }

  const record = metadata as Record<string, unknown>;
  const parts = [
    typeof record.category === 'string' ? record.category : null,
    typeof record.status === 'number' ? `HTTP ${record.status}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' · ') : 'No metadata';
}
