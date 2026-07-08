import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
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
    <AdminTablePanel
      className="vuexy-customer-table-card"
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
            <tr key={row.id}>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar"
                  avatarStatus={row.avatarStatus}
                  className="vuexy-booking-person vuexy-customer-person"
                  copyClassName="vuexy-booking-person-copy"
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
                <DateTimeText fallback="Join date missing" value={row.joinedAt} />
              </td>
              <td>
                <DateTimeText fallback="Not captured" value={row.lastSeenAt} />
              </td>
              <td>
                <strong>{row.lastLoginAddressLabel}</strong>
              </td>
              <td>
                <strong>
                  <DateTimeText fallback="No completed work" value={row.lastCompletedAt} />{' '}
                  {`(${row.completedBookings})`}
                </strong>
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.totalWalletAmount} />
                </strong>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Customer directory pages"
        className="vuexy-customer-table-footer"
        from={pagination.from}
        hrefForPage={(page) => buildCustomerListHref(filters, { page })}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
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
    <AdminEmptyState
      message="Change the filters or clear the search to view customer records."
      title="No customers found"
    />
  );
}
