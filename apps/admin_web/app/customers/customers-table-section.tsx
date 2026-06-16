import Link from 'next/link';
import { Eye, MessageSquareText, ReceiptText } from 'lucide-react';
import { AdminTableScroll } from '../../components/admin-data-table';
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
        <table className="table vuexy-customer-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Device Language</th>
              <th>Sign-up Date</th>
              <th>Last Login Date</th>
              <th>Last Login Address</th>
              <th>Total Reservations Completed</th>
              <th>Total Wallet Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <strong>No customers found</strong>
                  <p className="muted">Change the filters or clear the search to view customer records.</p>
                </td>
              </tr>
            ) : null}
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
          </tbody>
        </table>
      </AdminTableScroll>
    </section>
  );
}
