import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminAvatar } from '../../components/admin-person-cell';
import type { CustomerManagementTableRow } from './customer-management-view-model';

type CustomersTableSectionProps = {
  readonly rows: readonly CustomerManagementTableRow[];
  readonly sortLabel: string;
};

export function CustomersTableSection({ rows, sortLabel }: CustomersTableSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card"
      description={`Sorted by ${sortLabel}`}
      id="customer-directory"
      resultLabel={`${rows.length} customer(s)`}
      resultTone="info"
      title="Customer directory"
    >
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
                  <AdminAvatar
                    className="vuexy-customer-avatar"
                    initials={row.initials}
                    status={row.avatarStatus}
                  />
                  <div>
                    <Link className="vuexy-customer-person-link" href={row.detailHref}>
                      <strong>{row.name}</strong>
                    </Link>
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
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminFilterPanel>
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
] as const;

function CustomerTableEmptyState() {
  return (
    <>
      <strong>No customers found</strong>
      <p className="muted">Change the filters or clear the search to view customer records.</p>
    </>
  );
}
