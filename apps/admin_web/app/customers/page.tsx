import { CalendarClock, Star } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminTextLink } from '../../components/admin-text-link';
import { adminGet } from '../../lib/admin-api';
import type { AdminCustomer, AdminCustomerSummary } from '../../lib/admin-api';
import {
  buildCustomerActiveFilters,
  buildCustomerDataHrefs,
  buildCustomerExportHref,
  buildCustomerFilters,
  customerSortLabel,
} from './customer-filters';
import { CustomerFilterBoard } from './customer-filter-board';
import {
  buildCustomerRow,
  buildCustomerSummary,
  buildServerCustomerPagination,
} from './customer-list-model';
import {
  buildCustomerManagementMetrics,
  buildCustomerManagementTableRows,
} from './customer-management-view-model';
import { CustomersTableSection } from './customers-table-section';

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams?: CustomersPageSearchParams }) {
  const filters = buildCustomerFilters(searchParams ? await searchParams : {});
  const dataHrefs = buildCustomerDataHrefs(filters);
  const [customers, serverSummary] = await Promise.all([
    adminGet<AdminCustomer[]>(dataHrefs.listHref, []),
    adminGet<AdminCustomerSummary>(dataHrefs.summaryHref, { totalCount: 0 }),
  ]);
  const rows = customers.map(buildCustomerRow);
  const rowSummary = buildCustomerSummary(rows);
  const allSummary = {
    ...rowSummary,
    total: serverSummary.totalCount,
    genderBreakdown: serverSummary.genderBreakdown ?? rowSummary.genderBreakdown,
    todayJoined: serverSummary.todayJoined ?? rowSummary.todayJoined,
    todayJoinedGenderBreakdown: serverSummary.todayJoinedGenderBreakdown ?? rowSummary.todayJoinedGenderBreakdown,
    todaySeen: serverSummary.todaySeen ?? rowSummary.todaySeen,
    todaySeenGenderBreakdown: serverSummary.todaySeenGenderBreakdown ?? rowSummary.todaySeenGenderBreakdown,
    monthSeen: serverSummary.monthSeen ?? rowSummary.monthSeen,
    monthSeenGenderBreakdown: serverSummary.monthSeenGenderBreakdown ?? rowSummary.monthSeenGenderBreakdown,
  };
  const activeFilters = buildCustomerActiveFilters(filters);
  const metrics = buildCustomerManagementMetrics(allSummary);
  const pagination = buildServerCustomerPagination(rows, filters, serverSummary.totalCount);
  const tableRows = buildCustomerManagementTableRows(pagination.rows);
  const tablePagination = { ...pagination, rows: tableRows };
  const customerListCsvHref = buildCustomerExportHref(filters);

  return (
    <AdminPageTemplate
      title="Customer Management"
      description="Customer list aligned to the Vuexy management table using live customer profile, reservation, session, and wallet data."
      metrics={metrics}
      actions={
        <>
          <AdminFormControlLink className="button-secondary" href="/bookings">
            <CalendarClock aria-hidden="true" size={16} />
            Open bookings
          </AdminFormControlLink>
          <AdminTextLink href="/payments">
            Open payments
          </AdminTextLink>
          <AdminFormControlLink className="button-secondary" href="/reviews">
            <Star aria-hidden="true" size={16} />
            Open reviews
          </AdminFormControlLink>
        </>
      }
    >
      <CustomerFilterBoard
        activeFilters={activeFilters}
        csvHref={customerListCsvHref}
        filteredCount={rows.length}
        filters={filters}
        totalCount={serverSummary.totalCount}
      />

      <CustomersTableSection
        filters={filters}
        pagination={tablePagination}
        sortLabel={customerSortLabel(filters.sort)}
      />
    </AdminPageTemplate>
  );
}
