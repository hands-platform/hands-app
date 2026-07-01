import type { AdminAuditLog, AdminUser } from '../../lib/admin-api';
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
    group: 'Bookings',
    key: 'BOOKINGS_REALTIME',
    label: 'Realtime bookings',
    scope: 'Open matching queue and live booking monitor',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_IN_PROGRESS',
    label: 'Post-match / In progress',
    scope: 'Matched bookings, live work state, partner progress evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_COMPLETED',
    label: 'Completed bookings',
    scope: 'Completed booking lists, closeout detail, settlement evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_CANCELLATIONS',
    label: 'Booking cancellations',
    scope: 'Pre-match and post-match cancellation review',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_DETAIL',
    label: 'Booking detail',
    scope: 'Booking detail, chat evidence, customer/partner operational evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Customers',
    key: 'CUSTOMERS_DIRECTORY',
    label: 'Customer directory',
    scope: 'Customer list, filters, customer summary',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Customers',
    key: 'CUSTOMERS_DETAIL',
    label: 'Customer detail',
    scope: 'Customer profile, addresses, booking history, wallet evidence',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Customers',
    key: 'CUSTOMERS_REVIEWS',
    label: 'Customer reviews',
    scope: 'Customer reviews and partner customer evaluations',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_DIRECTORY',
    label: 'Partner directory',
    scope: 'Partner list, marketplace-ready and unsettled partner views',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_UNAPPROVED',
    label: 'Unapproved partners',
    scope: 'KYC review, registration hold, approval and reject workflows',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_DETAIL',
    label: 'Partner detail',
    scope: 'Partner profile, service pricing, wallet, reviews and controls',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_KYC',
    label: 'Partner KYC',
    scope: 'Document evidence, verification files, sanctions and hold reasons',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Finance',
    key: 'FINANCE_PAYMENT_CLEARING',
    label: 'Payment clearing',
    scope: 'Booking payment clearing and payment fee evidence',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_GENERAL_LEDGER',
    label: 'General ledger',
    scope: 'Journal batches, entries, accounting evidence',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_BANK_RECONCILIATION',
    label: 'Bank reconciliation',
    scope: 'Bank transactions, matching, reconciliation delta review',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_WALLET_ADJUSTMENTS',
    label: 'Wallet adjustments',
    scope: 'Customer and partner manual wallet adjustment approval',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_SETTLEMENTS',
    label: 'Settlements',
    scope: 'Cash settlements, earnings, withdrawals, payout closeout',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_TAX',
    label: 'Tax and VAT',
    scope: 'Finance tax, platform VAT, withholding and monthly close',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Notifications',
    key: 'NOTIFICATIONS_TEMPLATES',
    label: 'Notification templates',
    scope: 'Notification wording, language variants, template controls',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Notifications',
    key: 'NOTIFICATIONS_PUSH',
    label: 'Push send',
    scope: 'Push audience filters, campaign send and deep link targets',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Notifications',
    key: 'NOTIFICATIONS_DELIVERY',
    label: 'Delivery evidence',
    scope: 'Push delivery log, failed deliveries and notification history',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_SERVICES',
    label: 'Services',
    scope: 'Service catalog, duration options, pricing and payout defaults',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_COUPONS',
    label: 'Coupons',
    scope: 'Coupon creation, usage, edit and delete workflows',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_ADMIN_OPERATORS',
    label: 'Admin operators',
    scope: 'Operator creation, role assignment, category access and revocation',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_POLICY',
    label: 'Operations policy',
    scope: 'Operations policy, partner levels, wallet and bank policy settings',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_AUDIT',
    label: 'Audit log',
    scope: 'Admin action history, operator activity and retained evidence search',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'System',
    key: 'SYSTEM_SETUP',
    label: 'Setup',
    scope: 'Setup, usage overview, Vietnam overview and marketing analytics',
    defaultOwner: 'Master Admin',
  },
] as const;

const legacyPermissionGroups: Record<string, readonly string[]> = {
  BOOKINGS: ['BOOKINGS_REALTIME', 'BOOKINGS_IN_PROGRESS', 'BOOKINGS_COMPLETED', 'BOOKINGS_CANCELLATIONS', 'BOOKINGS_DETAIL'],
  CUSTOMERS: ['CUSTOMERS_DIRECTORY', 'CUSTOMERS_DETAIL', 'CUSTOMERS_REVIEWS'],
  FINANCE: [
    'FINANCE_PAYMENT_CLEARING',
    'FINANCE_GENERAL_LEDGER',
    'FINANCE_BANK_RECONCILIATION',
    'FINANCE_WALLET_ADJUSTMENTS',
    'FINANCE_SETTLEMENTS',
    'FINANCE_TAX',
  ],
  NOTIFICATIONS: ['NOTIFICATIONS_TEMPLATES', 'NOTIFICATIONS_PUSH', 'NOTIFICATIONS_DELIVERY'],
  PARTNERS: ['PARTNERS_DIRECTORY', 'PARTNERS_UNAPPROVED', 'PARTNERS_DETAIL', 'PARTNERS_KYC'],
  SYSTEM: ['SYSTEM_SERVICES', 'SYSTEM_COUPONS', 'SYSTEM_ADMIN_OPERATORS', 'SYSTEM_POLICY', 'SYSTEM_AUDIT', 'SYSTEM_SETUP'],
};

const operatorRoleFields = [
  { label: 'Master Admin', value: MASTER_ADMIN_ROLE },
  { label: 'Finance Approver', value: FINANCE_APPROVER_ROLE },
] as const;

type AdminOperatorsPageProps = {
  readonly searchParams?: Promise<{ readonly operatorNotice?: string }>;
};

export default async function AdminOperatorsPage({ searchParams }: AdminOperatorsPageProps) {
  const params = searchParams ? await searchParams : {};
  const [users, operatorActivityLogs] = await Promise.all([
    adminGet<AdminUser[]>('/admin/users?take=100', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs?bucket=Admin%20Web&take=30', []),
  ]);
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
            <p className="muted">Creates a new operator login and grants Admin Web access by email.</p>
            </div>
            <AdminFormInput label="Operator email" name="email" placeholder="operator@hands.vn" required type="email" />
            <AdminFormInput label="Temporary password" name="password" placeholder="Set initial password" required type="password" />
            <AdminFormInput label="Operator name" name="fullName" placeholder="Full name" />
            <div className="admin-operator-permission-toggle-row" aria-label="Operator roles">
              {operatorRoleFields.map((role) => (
                <AdminFormCheckbox key={role.value} label={role.label} name="roles" value={role.value}>
                  <span>{role.label}</span>
                </AdminFormCheckbox>
              ))}
            </div>
            <CategoryCheckboxGrid defaults={['BOOKINGS_REALTIME', 'CUSTOMERS_DIRECTORY', 'PARTNERS_DIRECTORY', 'NOTIFICATIONS_PUSH']} />
            <AdminFormInput label="Reason" name="reason" placeholder="Access request reason" />
            <AdminFormControlButton className="btn btn-primary" type="submit">
              Add operator
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
                <span className="pill pill-neutral">{category.group}</span>
                <p className="muted">{category.scope}</p>
              </div>
              <small>{category.defaultOwner}</small>
            </article>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
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
                <td>{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
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
                    {isMasterAdmin ? (
                      <div className="admin-operator-master-access" role="note">
                        <span className="pill pill-primary">All categories</span>
                      </div>
                    ) : (
                      <div className="admin-operator-access-pills">
                        {operatorAccessLabels(user).map((label) => (
                          <span className="pill pill-info" key={`${user.id}:${label}`}>
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
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
                        {isMasterAdmin ? (
                          null
                        ) : (
                          <CategoryCheckboxGrid defaults={operatorPermissionCategoryKeys(user)} compact />
                        )}
                        <AdminFormInput label="Update reason" name="reason" placeholder="Reason" />
                        <div className="admin-operator-row-actions">
                          <AdminFormControlButton className="button button-secondary admin-inline-action" type="submit">
                            Save permissions
                          </AdminFormControlButton>
                        </div>
                      </form>
                      <form action={revokeAdminOperatorAccess} className="admin-operator-inline-delete-form">
                        <input name="userId" type="hidden" value={user.id} />
                        <input name="reason" type="hidden" value="Master Admin row action" />
                        <AdminFormControlButton className="button button-danger admin-inline-action" type="submit">
                          Delete operator
                        </AdminFormControlButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
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
  const categories = user.adminOperatorPermission?.categories ?? [];
  return [...new Set(categories.flatMap((category) => legacyPermissionGroups[category] ?? [category]))];
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
