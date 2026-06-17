import Link from 'next/link';
import { Eye, MessageSquareText, ReceiptText } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
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
          {rows.map((row) => (
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
                  <Link aria-label={`Open ${row.name}`} className="vuexy-customer-icon-action" href={row.detailHref}>
                    <Eye aria-hidden="true" size={16} />
                  </Link>
                  <Link
                    aria-label={`Open ${row.name} payments`}
                    className="vuexy-customer-icon-action"
                    href={row.paymentsHref}
                  >
                    <ReceiptText aria-hidden="true" size={16} />
                  </Link>
                  <Link
                    aria-label={`Open ${row.name} chats`}
                    className="vuexy-customer-icon-action"
                    href={row.chatHref}
                  >
                    <MessageSquareText aria-hidden="true" size={16} />
                  </Link>
                  <CustomerActionDropdown
                    chatHref={row.chatHref}
                    detailHref={row.detailHref}
                    label={`More actions for ${row.name}`}
                    paymentsHref={row.paymentsHref}
                  />
                </div>
              </td>
            </tr>
          ))}
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
