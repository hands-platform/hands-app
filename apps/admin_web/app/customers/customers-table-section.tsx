import { ChevronRight, LockKeyhole } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type { CustomerFilters } from './customer-filters';
import { buildCustomerListHref } from './customer-filters';
import type { CustomerPagination } from './customer-list-model';
import type { CustomerManagementTableRow } from './customer-management-view-model';

type CustomersTableSectionProps = {
  readonly allCustomerCount: number;
  readonly filters: CustomerFilters;
  readonly pagination: CustomerPagination<CustomerManagementTableRow>;
  readonly sortLabel: string;
};

export function CustomersTableSection({
  allCustomerCount,
  filters,
  pagination,
  sortLabel,
}: CustomersTableSectionProps) {
  const rows = pagination.rows;
  const needsActionView = filters.view === 'needs-action';
  const usageNewUnbooked = filters.segment === 'usage-new-unbooked';

  return (
    <AdminTablePanel
      className="vuexy-customer-table-card"
      description={
        needsActionView
          ? 'Failed payments, requested refunds, and reported reviews that require operator attention.'
          : `Sorted by ${sortLabel}`
      }
      id="customer-directory"
      resultLabel={`${pagination.totalRows} ${pagination.totalRows === 1 ? 'customer' : 'customers'} · ${sortLabel}`}
      resultTone="info"
      title={needsActionView ? 'Payment and review queue' : 'Customer directory'}
    >
      <AdminTableScroll ariaLabel="Customer directory table">
        <AdminDataTable
          className="vuexy-customer-table"
          emptyMessage={<CustomerTableEmptyState allCustomerCount={allCustomerCount} filters={filters} />}
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
                  linkSuffix={
                    <ChevronRight aria-hidden="true" className="vuexy-customer-open-icon" size={16} />
                  }
                  helper={
                    <>
                      <span className="vuexy-customer-identity-meta">
                        <span>{row.phone}</span>
                        <span>{`ID ${row.shortId}`}</span>
                      </span>
                      {row.detailHref ? null : (
                        <span className="vuexy-customer-detail-lock">
                          <LockKeyhole aria-hidden="true" size={13} /> Customer detail access required
                        </span>
                      )}
                    </>
                  }
                />
              </td>
              <td>
                {row.bookingStatusLabel === 'No open booking' && !row.lastSeenAt ? (
                  <span className="muted">No booking · No app activity</span>
                ) : (
                  <div className="vuexy-customer-status-cell">
                    <StatusBadge tone={row.bookingStatusTone}>{row.bookingStatusLabel}</StatusBadge>
                    {row.bookingUpdatedAt ? (
                      <span>
                        Booking updated <DateTimeText value={row.bookingUpdatedAt} />
                      </span>
                    ) : null}
                    {row.lastSeenAt ? (
                      <span>
                        App seen <DateTimeText value={row.lastSeenAt} />
                      </span>
                    ) : (
                      <span className="muted">No app activity</span>
                    )}
                  </div>
                )}
              </td>
              <td>
                {usageNewUnbooked ? (
                  <div className="vuexy-customer-booking-cell">
                    <strong>No verified production booking</strong>
                    {row.bookingCount > 0 ? (
                      <span>{`${row.bookingCount} unverified or non-production ${row.bookingCount === 1 ? 'record' : 'records'} excluded`}</span>
                    ) : null}
                  </div>
                ) : row.bookingCount === 0 ? (
                  <span className="muted">No bookings yet</span>
                ) : (
                  <div className="vuexy-customer-booking-cell">
                    <strong>{`${row.completedBookings} completed · ${row.bookingCount} total`}</strong>
                    {row.lastCompletedAt ? (
                      <span>
                        Last completed <DateTimeText value={row.lastCompletedAt} />
                      </span>
                    ) : null}
                  </div>
                )}
              </td>
              <td>
                {row.openSignals.length > 0 ? (
                  <div className="vuexy-customer-attention-list">
                    {row.openSignals.map((signal) => (
                      <StatusBadge key={`${signal.label}-${signal.tone}`} tone={signal.tone}>
                        {signal.label}
                      </StatusBadge>
                    ))}
                  </div>
                ) : (
                  <span className="muted">None</span>
                )}
                {row.historySignals.length > 0 ? (
                  <div className="vuexy-customer-history-signals">
                    <small>History</small>
                    <span>{row.historySignals.map((signal) => signal.label).join(' / ')}</span>
                  </div>
                ) : null}
              </td>
              <td>
                <div className="vuexy-customer-value-cell">
                  <span>
                    <small>Captured payments</small>
                    <strong>
                      <MoneyText amount={row.totalPaid} />
                    </strong>
                  </span>
                  <span>
                    <small>Wallet balance</small>
                    <strong>
                      <MoneyText amount={row.customerWalletBalance} />
                    </strong>
                  </span>
                </div>
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
  'Current situation',
  'Booking history',
  'Open work',
  'Payments & wallet',
] as const;

function CustomerTableEmptyState({
  allCustomerCount,
  filters,
}: {
  readonly allCustomerCount: number;
  readonly filters: CustomerFilters;
}) {
  const hasActiveFilters = Boolean(
    filters.q || filters.segment || filters.country || filters.gender || filters.dateRange,
  );

  if (hasActiveFilters) {
    if (filters.view === 'needs-action') {
      return (
        <AdminEmptyState
          message="Change or clear the active filters to view this queue."
          title="No payment or review issues match these filters"
        />
      );
    }
    if (filters.view === 'new-today') {
      return (
        <AdminEmptyState
          message="Change or clear the active filters."
          title="No new customers match these filters"
        />
      );
    }
    if (filters.view === 'active-today') {
      return (
        <AdminEmptyState
          message="Change or clear the active filters."
          title="No app-active customers match these filters"
        />
      );
    }
    return (
      <AdminEmptyState
        message="Change or clear the active filters to view customer records."
        title="No customers match these filters"
      />
    );
  }

  if (allCustomerCount === 0) {
    return (
      <AdminEmptyState
        message="No customer accounts have been created yet."
        title="No customer profiles found"
      />
    );
  }

  if (filters.view === 'needs-action') {
    return (
      <div className="vuexy-customer-empty-actions">
        <AdminEmptyState
          message="There are no failed payments, requested refunds, or reported reviews to process."
          title="No payment or review work"
        />
        <AdminFormControlLink href={buildCustomerListHref(filters, { view: 'all' })}>
          {`Browse all ${allCustomerCount} customers`}
        </AdminFormControlLink>
      </div>
    );
  }

  if (filters.view === 'new-today') {
    return (
      <AdminEmptyState message="No customer profiles were created today." title="No customers joined today" />
    );
  }

  if (filters.view === 'active-today') {
    return (
      <AdminEmptyState
        message="No customer app sessions were observed today."
        title="No app activity today"
      />
    );
  }

  return (
    <AdminEmptyState message="No customer accounts are available in this view." title="No customers found" />
  );
}
