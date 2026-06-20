import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
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
                <AdminPersonCell
                  avatarClassName="vuexy-customer-avatar"
                  avatarStatus={row.avatarStatus}
                  className="vuexy-booking-person vuexy-customer-person"
                  copyClassName="vuexy-booking-person-copy"
                  helper={row.phone}
                  href={row.detailHref}
                  initials={row.initials}
                  label={row.name}
                  linkClassName="vuexy-booking-person-link"
                />
              </td>
              <td>
                <CustomerCountryCell row={row} />
              </td>
              <td>
                <strong>{row.genderLabel}</strong>
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
  'Country',
  'Gender',
  'Sign-up Date',
  'Last Login Date',
  'Last Login Address',
  'Total Reservations Completed',
  'Total Wallet Amount',
] as const;

function CustomerCountryCell({ row }: { readonly row: CustomerManagementTableRow }) {
  return (
    <div className="vuexy-booking-country-cell">
      <span aria-label={row.countryFlagLabel} className="vuexy-booking-country-flag" role="img">
        {row.countryFlag ?? '--'}
      </span>
      <strong title={row.deviceLanguageLabel}>{row.countryLabel}</strong>
    </div>
  );
}

function CustomerTableEmptyState() {
  return (
    <>
      <strong>No customers found</strong>
      <p className="muted">Change the filters or clear the search to view customer records.</p>
    </>
  );
}
