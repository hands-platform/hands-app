import type { AdminUser } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { formatDateTime } from '../../lib/admin-format';

const ADMIN_ROLE = 'ADMIN';
const FINANCE_APPROVER_ROLE = 'FINANCE_APPROVER';

const permissionCategories = [
  {
    key: 'bookings',
    label: 'Bookings',
    scope: 'Booking monitor, cancellation approval, chat evidence, booking detail',
    defaultOwner: 'Operations Admin',
  },
  {
    key: 'customers',
    label: 'Customers',
    scope: 'Customer directory, customer detail, wallet evidence, retained booking history',
    defaultOwner: 'Support Admin',
  },
  {
    key: 'partners',
    label: 'Partners',
    scope: 'Partner approval, KYC/document review, partner detail, account holds',
    defaultOwner: 'Partner Admin',
  },
  {
    key: 'finance',
    label: 'Finance',
    scope: 'Wallet adjustments, settlement, tax, bank reconciliation, payout closeout',
    defaultOwner: 'Finance Approver',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    scope: 'Templates, push send, delivery evidence, failed delivery review',
    defaultOwner: 'Support Admin',
  },
  {
    key: 'system',
    label: 'System',
    scope: 'Operations policy, services, coupons, audit log, setup, operator access',
    defaultOwner: 'Master Admin',
  },
] as const;

const operatorRoleOptions = [
  { label: 'Master Admin', value: 'MASTER_ADMIN' },
  { label: 'Operations Admin', value: 'OPERATIONS_ADMIN' },
  { label: 'Support Admin', value: 'SUPPORT_ADMIN' },
  { label: 'Partner Admin', value: 'PARTNER_ADMIN' },
  { label: 'Finance Approver', value: FINANCE_APPROVER_ROLE },
];

export default async function AdminOperatorsPage() {
  const users = await adminGet<AdminUser[]>('/admin/users?take=100', []);
  const adminUsers = users.filter((user) => user.roles.includes(ADMIN_ROLE));
  const financeApproverCount = adminUsers.filter((user) => user.roles.includes(FINANCE_APPROVER_ROLE)).length;
  const activeSessionCount = adminUsers.filter((user) => user.appSessions?.some((session) => session.active)).length;

  return (
    <AdminPageTemplate
      description="Master Admin workspace for operator visibility, category permissions, and the future add/delete access workflow."
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
          helper: 'Second-control admins for money, tax, payout, and bank actions.',
          label: 'Finance approvers',
          value: financeApproverCount,
        },
      ]}
      title="Admin Operators"
    >
      <AdminFilterPanel
        className="admin-operator-master-card admin-mb-16"
        description="Use this as the Master Admin access desk. Creation, deletion, and fine-grained permission persistence need a dedicated API before they can write to the database."
        resultLabel="Master admin control"
        resultTone="warning"
        title="Master admin control"
      >
        <div className="admin-operator-control-grid">
          <form className="admin-operator-control-card" aria-label="Add operator request">
            <div>
              <h3>Add operator</h3>
              <p className="muted">Prepare a new admin account request with category access before API wiring.</p>
            </div>
            <AdminFormInput label="Operator email" name="email" placeholder="operator@hands.vn" type="email" />
            <AdminFormInput label="Operator name" name="fullName" placeholder="Full name" />
            <AdminFormSelect
              label="Operator role"
              name="role"
              options={operatorRoleOptions}
              defaultValue="OPERATIONS_ADMIN"
            />
            <AdminFormControlButton className="btn btn-primary" disabled type="button">
              Add operator
            </AdminFormControlButton>
            <span className="pill pill-warn">API required</span>
          </form>

          <form className="admin-operator-control-card" aria-label="Delete operator request">
            <div>
              <h3>Delete operator</h3>
              <p className="muted">Deletion should become a deactivation flow with audit reason and session revocation.</p>
            </div>
            <AdminFormInput label="Admin user ID" name="userId" placeholder="Admin user id" />
            <AdminFormInput label="Delete reason" name="reason" placeholder="Access removal reason" />
            <AdminFormControlButton className="btn btn-outline" disabled type="button">
              Delete operator
            </AdminFormControlButton>
            <span className="pill pill-warn">API required</span>
          </form>
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-operator-permission-card admin-mb-16"
        description="Category permissions are shown as the target operating model: a Master Admin grants only the page categories each operator needs."
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
              <div className="admin-operator-permission-toggle-row">
                <AdminFormCheckbox
                  defaultChecked={category.key !== 'finance'}
                  disabled
                  label={`${category.label} read`}
                >
                  <span>Read</span>
                </AdminFormCheckbox>
                <AdminFormCheckbox
                  defaultChecked={category.key === 'system' || category.key === 'finance'}
                  disabled
                  label={`${category.label} approve`}
                >
                  <span>Approve</span>
                </AdminFormCheckbox>
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
                  <div className="muted">{user.phone ?? user.id}</div>
                  <div className="muted">{user.id}</div>
                </td>
                <td>
                  <div className="participant-list">
                    {user.roles.map((role) => (
                      <span className={`pill ${role === FINANCE_APPROVER_ROLE ? 'pill-success' : 'pill-neutral'}`} key={role}>
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
                    <button className="button button-secondary admin-inline-action" disabled type="button">
                      Edit permissions
                    </button>
                    <button className="button button-secondary admin-inline-action" disabled type="button">
                      Delete operator
                    </button>
                    <span className="pill pill-warn">API required</span>
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

function latestSessionLabel(user: AdminUser) {
  const latest = user.appSessions?.[0];
  return latest?.lastSeenAt ? formatDateTime(latest.lastSeenAt) : 'No recent session';
}

function operatorAccessLabels(user: AdminUser) {
  if (user.roles.includes(FINANCE_APPROVER_ROLE)) {
    return ['Bookings', 'Finance', 'System'];
  }

  return ['Bookings', 'Customers', 'Partners'];
}
