import type { AdminUser } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormCheckbox, AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { formatDateTime } from '../../lib/admin-format';
import {
  createAdminOperator,
  revokeAdminOperatorAccess,
  updateAdminOperatorAccess,
} from './actions';

const ADMIN_ROLE = 'ADMIN';
const FINANCE_APPROVER_ROLE = 'FINANCE_APPROVER';
const MASTER_ADMIN_ROLE = 'MASTER_ADMIN';

const permissionCategories = [
  {
    key: 'BOOKINGS',
    label: 'Bookings',
    scope: 'Booking monitor, cancellation approval, chat evidence, booking detail',
    defaultOwner: 'Operations Admin',
  },
  {
    key: 'CUSTOMERS',
    label: 'Customers',
    scope: 'Customer directory, customer detail, wallet evidence, retained booking history',
    defaultOwner: 'Support Admin',
  },
  {
    key: 'PARTNERS',
    label: 'Partners',
    scope: 'Partner approval, KYC/document review, partner detail, account holds',
    defaultOwner: 'Partner Admin',
  },
  {
    key: 'FINANCE',
    label: 'Finance',
    scope: 'Wallet adjustments, settlement, tax, bank reconciliation, payout closeout',
    defaultOwner: 'Finance Approver',
  },
  {
    key: 'NOTIFICATIONS',
    label: 'Notifications',
    scope: 'Templates, push send, delivery evidence, failed delivery review',
    defaultOwner: 'Support Admin',
  },
  {
    key: 'SYSTEM',
    label: 'System',
    scope: 'Operations policy, services, coupons, audit log, setup, operator access',
    defaultOwner: 'Master Admin',
  },
] as const;

const operatorRoleFields = [
  { label: 'Master Admin', value: MASTER_ADMIN_ROLE },
  { label: 'Finance Approver', value: FINANCE_APPROVER_ROLE },
] as const;

type AdminOperatorsPageProps = {
  readonly searchParams?: Promise<{ readonly operatorNotice?: string }>;
};

export default async function AdminOperatorsPage({ searchParams }: AdminOperatorsPageProps) {
  const params = searchParams ? await searchParams : {};
  const users = await adminGet<AdminUser[]>('/admin/users?take=100', []);
  const adminUsers = users.filter((user) => user.roles.includes(ADMIN_ROLE));
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
          <form action={createAdminOperator} className="admin-operator-control-card" aria-label="Add operator">
            <div>
              <h3>Add operator</h3>
              <p className="muted">Creates a new admin user or grants admin access to an existing phone number.</p>
            </div>
            <AdminFormInput label="Operator phone" name="phone" placeholder="+84900000001" required />
            <AdminFormInput label="Operator email" name="email" placeholder="operator@hands.vn" type="email" />
            <AdminFormInput label="Operator name" name="fullName" placeholder="Full name" />
            <div className="admin-operator-permission-toggle-row" aria-label="Operator roles">
              {operatorRoleFields.map((role) => (
                <AdminFormCheckbox key={role.value} label={role.label} name="roles" value={role.value}>
                  <span>{role.label}</span>
                </AdminFormCheckbox>
              ))}
            </div>
            <CategoryCheckboxGrid defaults={['BOOKINGS', 'CUSTOMERS', 'PARTNERS', 'NOTIFICATIONS']} />
            <AdminFormInput label="Reason" name="reason" placeholder="Access request reason" />
            <AdminFormControlButton className="btn btn-primary" type="submit">
              Add operator
            </AdminFormControlButton>
          </form>

          <form
            action={revokeAdminOperatorAccess}
            className="admin-operator-control-card"
            aria-label="Delete operator access"
          >
            <div>
              <h3>Delete operator</h3>
              <p className="muted">Revokes Admin roles and category access while keeping audit history intact.</p>
            </div>
            <AdminFormInput label="Admin user ID" name="userId" placeholder="Admin user id" required />
            <AdminFormInput label="Delete reason" name="reason" placeholder="Access removal reason" />
            <AdminFormControlButton className="btn btn-outline" type="submit">
              Delete operator
            </AdminFormControlButton>
          </form>
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-operator-permission-card admin-mb-16"
        description="Category permissions are stored separately from the broad Admin role so each operator can be granted only the page groups they need."
        resultLabel={`${permissionCategories.length} categories`}
        resultTone="info"
        title="Category permissions"
      >
        <div className="admin-operator-permission-grid">
          {permissionCategories.map((category) => (
            <article className="admin-operator-permission-item" key={category.key}>
              <div>
                <strong>{category.label}</strong>
                <p className="muted">{category.scope}</p>
              </div>
              <small>{category.defaultOwner}</small>
            </article>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="This table uses the existing bounded /admin/users API and only displays users with the ADMIN role."
        resultLabel={`${adminUsers.length} admin(s)`}
        resultTone="info"
        title="Operator directory"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-operator-table"
            emptyMessage="No admin operators were returned by the bounded admin user API."
            headers={['Operator', 'Roles', 'Latest session', 'Category access', 'Master action']}
            rowCount={adminUsers.length}
          >
            {adminUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.fullName ?? user.phone ?? user.id}</strong>
                  <div className="muted">{user.email ?? user.phone ?? user.id}</div>
                  <div className="muted">{user.id}</div>
                </td>
                <td>
                  <div className="participant-list">
                    {user.roles.map((role) => (
                      <span className={operatorRolePillClassName(role)} key={role}>
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <strong>{latestSessionLabel(user)}</strong>
                  <div className="muted">{user.appSessions?.[0]?.platform ?? 'No platform'}</div>
                </td>
                <td>
                  <div className="admin-operator-access-pills">
                    {operatorAccessLabels(user).map((label) => (
                      <span className="pill pill-info" key={`${user.id}:${label}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="admin-operator-action-stack">
                    <form action={updateAdminOperatorAccess} className="admin-operator-inline-form">
                      <input name="userId" type="hidden" value={user.id} />
                      <div className="admin-operator-permission-toggle-row" aria-label={`${user.id} roles`}>
                        {operatorRoleFields.map((role) => (
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
                      <CategoryCheckboxGrid defaults={operatorPermissionCategoryKeys(user)} compact />
                      <AdminFormInput label="Update reason" name="reason" placeholder="Reason" />
                      <AdminFormControlButton className="button button-secondary admin-inline-action" type="submit">
                        Save permissions
                      </AdminFormControlButton>
                    </form>
                    <form action={revokeAdminOperatorAccess} className="admin-operator-inline-form">
                      <input name="userId" type="hidden" value={user.id} />
                      <AdminFormInput label="Delete reason" name="reason" placeholder="Removal reason" />
                      <AdminFormControlButton className="button button-secondary admin-inline-action" type="submit">
                        Delete operator
                      </AdminFormControlButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

function OperatorNotice({ notice }: { readonly notice: string }) {
  const message =
    {
      'admin-auth': 'Admin API authentication failed. Refresh the admin session and try again.',
      created: 'Operator access was created.',
      failed: 'Operator access update failed. Check master admin permission, duplicate phone, or last role guard.',
      'missing-phone': 'Operator phone is required.',
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
      {permissionCategories.map((category) => (
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

function latestSessionLabel(user: AdminUser) {
  const latest = user.appSessions?.[0];
  return latest?.lastSeenAt ? formatDateTime(latest.lastSeenAt) : 'No recent session';
}

function operatorAccessLabels(user: AdminUser) {
  const categories = operatorPermissionCategoryKeys(user);
  if (categories.length > 0) {
    return categories.map((key) => permissionCategories.find((category) => category.key === key)?.label ?? key);
  }

  if (user.roles.includes(MASTER_ADMIN_ROLE)) {
    return permissionCategories.map((category) => category.label);
  }
  if (user.roles.includes(FINANCE_APPROVER_ROLE)) {
    return ['Bookings', 'Finance', 'System'];
  }

  return ['Bookings', 'Customers', 'Partners'];
}

function operatorPermissionCategoryKeys(user: AdminUser) {
  return user.adminOperatorPermission?.categories ?? [];
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
