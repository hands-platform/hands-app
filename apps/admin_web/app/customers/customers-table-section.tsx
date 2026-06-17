import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { customerActionLinks, type CustomerActionLink } from './customer-action-links';
import { CustomerActionDropdown } from './customer-action-dropdown';
import type { CustomerManagementTableRow } from './customer-management-view-model';

type CustomersTableSectionProps = {
  readonly rows: readonly CustomerManagementTableRow[];
  readonly sortLabel: string;
};

export function CustomersTableSection({ rows, sortLabel }: CustomersTableSectionProps) {
  return (
    <section className="vuexy-customer-table-card" aria-labelledby="customer-directory-title">
      <div className="vuexy-customer-toolbar">
        <div>
          <h2 id="customer-directory-title">Customer directory</h2>
        </div>
        <div className="participant-list">
          <span className="pill pill-info">{rows.length} rows</span>
          <span className="pill pill-neutral">Sorted by {sortLabel}</span>
        </div>
      </div>

      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-customer-table"
          emptyMessage={<CustomerTableEmptyState />}
          headers={customerTableHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => {
            const actions = customerActionLinks(row);

            return (
              <tr key={row.customerIdLabel}>
                <td>
                  <div className="vuexy-customer-person">
                    <span className="vuexy-customer-avatar">{row.initials}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.phone}</span>
                      <small>{row.customerIdLabel}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{row.deviceLanguageLabel}</strong>
                </td>
                <td>
                  <strong>{row.joinedLabel}</strong>
                </td>
                <td>
                  <strong>{row.lastLoginDateLabel}</strong>
                </td>
                <td>
                  <strong>{row.lastLoginAddressLabel}</strong>
                </td>
                <td>
                  <strong>{row.totalReservationsCompletedLabel}</strong>
                </td>
                <td>
                  <strong>{row.totalWalletAmountLabel}</strong>
                </td>
                <td>
                  <div className="vuexy-customer-actions vuexy-customer-actions-row">
                    {actions.map((action) => (
                      <CustomerIconAction action={action} key={action.label} />
                    ))}
                    <CustomerActionDropdown actions={actions} label={`More actions for ${row.name}`} />
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminTableScroll>
    </section>
  );
}

const customerTableHeaders = [
  'Customer',
  'Device Language',
  'Sign-up Date',
  'Last Login Date',
  'Last Login Address',
  'Total Reservations Completed',
  'Total Wallet Amount',
  'Actions',
] as const;

function CustomerTableEmptyState() {
  return (
    <>
      <strong>No customers found</strong>
      <p className="muted">Change the filters or clear the search to view customer records.</p>
    </>
  );
}

function CustomerIconAction({ action }: { readonly action: CustomerActionLink }) {
  const Icon = action.icon;

  return (
    <Link aria-label={action.ariaLabel} className="vuexy-customer-icon-action" href={action.href}>
      <Icon aria-hidden="true" size={16} />
    </Link>
  );
}
