import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import type { CustomerFilters } from './customer-filters';
import { buildCustomerListHref } from './customer-filters';
import type { CustomerPagination } from './customer-list-model';
import type { CustomerManagementTableRow } from './customer-management-view-model';

type CustomersTableSectionProps = {
  readonly filters: CustomerFilters;
  readonly pagination: CustomerPagination<CustomerManagementTableRow>;
  readonly sortLabel: string;
};

export function CustomersTableSection({ filters, pagination, sortLabel }: CustomersTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-customer-table-card"
      description={`Sorted by ${sortLabel}`}
      id="customer-directory"
      resultLabel={`${pagination.totalRows} customer(s)`}
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
                  avatarClassName="vuexy-booking-avatar"
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
                <strong>{row.lastCompletedLabel}</strong>
              </td>
              <td>
                <strong>{row.totalWalletAmountLabel}</strong>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <div className="vuexy-booking-table-footer vuexy-customer-table-footer">
        <span>
          Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
        </span>
        <AdminRoundedPagination
          activePage={pagination.page}
          ariaLabel="Customer directory pages"
          className="vuexy-booking-pagination"
          hrefForPage={(page) => buildCustomerListHref(filters, { page })}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={pagination.totalPages}
        />
      </div>
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
  'Last Completed',
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
