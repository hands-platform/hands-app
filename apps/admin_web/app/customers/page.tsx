import { RefreshCw } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { adminGetResult } from '../../lib/admin-api';
import type { AdminCustomerDirectoryRow, AdminCustomerSummary } from '../../lib/admin-api';
import { readSearchParam } from '../../lib/date-range';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import {
  buildCustomerActiveFilters,
  buildCustomerDataHrefs,
  buildCustomerFilters,
  buildCustomerListHref,
  customerSortLabel,
  customerViewTotal,
} from './customer-filters';
import { CustomerFilterBoard } from './customer-filter-board';
import { buildCustomerRow, buildServerCustomerPagination } from './customer-list-model';
import { buildCustomerManagementTableRows } from './customer-management-view-model';
import { CustomersTableSection } from './customers-table-section';

type CustomersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: { searchParams?: CustomersPageSearchParams }) {
  const rawSearchParams = searchParams ? await searchParams : {};
  const filters = buildCustomerFilters(rawSearchParams);
  const currentHref = buildCustomerListHref(filters, { page: filters.page });

  if (hasInvalidCustomDateRange(rawSearchParams, filters)) {
    redirect(buildCustomerListHref(filters));
  }

  const summaryHref = buildCustomerDataHrefs(filters).summaryHref;
  const [summaryResult, listResult, operatorAccess] = await Promise.all([
    adminGetResult<AdminCustomerSummary>(summaryHref, { totalCount: 0 }),
    adminGetResult<AdminCustomerDirectoryRow[]>(buildCustomerDataHrefs(filters).listHref, []),
    getCurrentAdminOperatorAccess(),
  ]);
  if (!summaryResult.ok) {
    return <CustomerLoadError href={currentHref} />;
  }

  const serverSummary = summaryResult.data;
  const selectedTotalCount = customerViewTotal(
    filters.view,
    serverSummary.viewCounts,
    serverSummary.totalCount,
  );
  const lastPage = Math.max(1, Math.ceil(selectedTotalCount / filters.pageSize));
  if (filters.page > lastPage) {
    redirect(buildCustomerListHref(filters, { page: lastPage }));
  }

  if (!listResult.ok) {
    return (
      <AdminPageTemplate
        actions={<CustomerRefreshAction generatedAt={serverSummary.generatedAt} href={currentHref} />}
        description="Find customer accounts and resolve payment, refund, or reported-review issues."
        title="Customers"
      >
        <CustomerFilterBoard
          activeFilters={buildCustomerActiveFilters(filters)}
          filters={filters}
          viewCounts={serverSummary.viewCounts ?? emptyCustomerViewCounts(serverSummary)}
        />
        <AdminErrorState
          action={<AdminFormControlLink href={currentHref}>Refresh</AdminFormControlLink>}
          message="Customer data could not be loaded. Refresh the page and try again."
          title="Unable to load customers"
        />
      </AdminPageTemplate>
    );
  }

  const customers = listResult.data;
  const rows = customers.map(buildCustomerRow);
  const activeFilters = buildCustomerActiveFilters(filters);
  const pagination = buildServerCustomerPagination(rows, filters, selectedTotalCount);
  const canViewCustomerDetail = hasAdminOperatorCategory(operatorAccess, 'CUSTOMERS_DETAIL');
  const tableRows = buildCustomerManagementTableRows(pagination.rows, currentHref, canViewCustomerDetail);
  const tablePagination = { ...pagination, rows: tableRows };

  return (
    <AdminPageTemplate
      title="Customers"
      description="Find customer accounts and resolve payment, refund, or reported-review issues."
      actions={<CustomerRefreshAction generatedAt={serverSummary.generatedAt} href={currentHref} />}
    >
      <CustomerFilterBoard
        activeFilters={activeFilters}
        filters={filters}
        viewCounts={serverSummary.viewCounts ?? emptyCustomerViewCounts(serverSummary)}
      />

      <CustomersTableSection
        allCustomerCount={serverSummary.viewCounts?.all ?? serverSummary.totalCount}
        filters={filters}
        pagination={tablePagination}
        sortLabel={customerSortLabel(filters.sort)}
      />
    </AdminPageTemplate>
  );
}

function CustomerLoadError({ href }: { readonly href: string }) {
  return (
    <AdminPageTemplate
      description="Find customer accounts and resolve payment, refund, or reported-review issues."
      title="Customers"
    >
      <AdminErrorState
        action={<AdminFormControlLink href={href}>Refresh</AdminFormControlLink>}
        message="Customer data could not be loaded. Refresh the page and try again."
        title="Unable to load customers"
      />
    </AdminPageTemplate>
  );
}

function CustomerRefreshAction({
  generatedAt,
  href,
}: {
  readonly generatedAt?: string;
  readonly href: string;
}) {
  return (
    <>
      <span className="admin-page-refresh-status">
        Updated <DateTimeText fallback="time unavailable" value={generatedAt} />
      </span>
      <AdminFormControlLink className="button-secondary" href={href}>
        <RefreshCw aria-hidden="true" size={16} /> Refresh
      </AdminFormControlLink>
    </>
  );
}

function emptyCustomerViewCounts(summary: AdminCustomerSummary) {
  return {
    activeToday: summary.todaySeen ?? 0,
    all: summary.totalCount,
    needsAction: summary.needsActionCount ?? 0,
    newToday: summary.todayJoined ?? 0,
  };
}

function hasInvalidCustomDateRange(
  params: Record<string, string | string[] | undefined>,
  filters: ReturnType<typeof buildCustomerFilters>,
) {
  const requestedCustomRange = [
    params.dateRange,
    params.joinedRange,
    params.lastBookingRange,
    params.lastLoginRange,
  ].some((value) => readSearchParam(value) === 'custom');
  return requestedCustomRange && filters.dateRange !== 'custom';
}
