import { AdminTablePaginationFooter } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import { FinanceDataTable } from '../finance-tax/finance-data-table';
import {
  cashSettlementHref,
  cashSettlementQueueLabel,
  cashSettlementReviewHref,
} from './cash-settlement-page-filters';
import type { CashSettlementFilters, CashSettlementPagination } from './cash-settlement-page-types';

export type CashSettlementOpenDebtTableRow = {
  readonly allocatedAmount: number;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly createdAtLabel: string;
  readonly currency: string;
  readonly earningId: string;
  readonly isOverdue: boolean;
  readonly nextAction: string;
  readonly originalDebtAmount: number;
  readonly partnerHref: string;
  readonly paymentMethod: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly remainingDebtAmount: number;
  readonly serviceLabel: string;
  readonly settlementEvidence: string;
};

type CashSettlementOpenDebtTableSectionProps = {
  readonly filters: CashSettlementFilters;
  readonly globalRowCount: number;
  readonly pagination: CashSettlementPagination<CashSettlementOpenDebtTableRow>;
};

export function CashSettlementOpenDebtTableSection({
  filters,
  globalRowCount,
  pagination,
}: CashSettlementOpenDebtTableSectionProps) {
  const rows = pagination.rows;
  const returnTo = cashSettlementHref(filters);

  return (
    <AdminTablePanel
      className="cash-settlement-table-panel"
      description="Remaining exposure is authoritative after approved deposit allocations. Review evidence before recording another allocation."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'warning' : 'success'}
      title="Filtered cash settlement queue"
    >
      {rows.length === 0 ? (
        <div className="cash-settlement-empty-state">
          <AdminEmptyState
            message={cashSettlementEmptyDescription(filters, globalRowCount)}
            title={cashSettlementEmptyTitle(filters)}
          />
          <AdminFilterChipGroup ariaLabel="Cash settlement empty state actions" className="admin-mt-12">
            <AdminTextLink href={cashSettlementHref({ ...filters, page: 1, queue: 'all' })}>
              Return to All open ({globalRowCount})
            </AdminTextLink>
            <AdminTextLink href="/cash-settlements">Clear filters</AdminTextLink>
          </AdminFilterChipGroup>
        </div>
      ) : (
        <>
          <AdminFilterChipGroup ariaLabel="Open cash debt links" className="admin-mb-12">
            <AdminTextLink href="/payments?review=cash-debt">Payment debt view</AdminTextLink>
            <AdminTextLink href="/finance-tax/partner-bank-deposits">Partner deposit history</AdminTextLink>
          </AdminFilterChipGroup>
          <FinanceDataTable
            ariaLabel="Filtered cash settlement receivables table"
            emptyMessage={null}
            headers={[
              'Partner / Booking',
              'Remaining exposure',
              'Age / Evidence',
              'Recommended action',
              'Review',
            ]}
            rowCount={rows.length}
            scrollClassName="cash-settlement-workbench-table-scroll"
          >
            {rows.map((row) => (
              <tr key={row.earningId}>
                <td>
                  <strong>{row.providerName}</strong>
                  <div className="muted">{row.providerPhone}</div>
                  <div className="cash-settlement-row-links">
                    <AdminTextLink href={row.partnerHref}>Partner</AdminTextLink>
                    <AdminTextLink href={row.bookingHref}>Booking {row.bookingLabel}</AdminTextLink>
                  </div>
                  <div className="muted">{row.serviceLabel}</div>
                </td>
                <td>
                  <span className="cash-settlement-remaining-label">Remaining</span>
                  <strong className="cash-settlement-remaining-amount">
                    <MoneyText amount={row.remainingDebtAmount} currency={row.currency} />
                  </strong>
                  {row.allocatedAmount > 0 ? (
                    <div className="muted cash-settlement-exposure-breakdown">
                      Original <MoneyText amount={row.originalDebtAmount} currency={row.currency} /> · Allocated{' '}
                      <MoneyText amount={row.allocatedAmount} currency={row.currency} />
                    </div>
                  ) : (
                    <div className="muted">No approved allocation yet</div>
                  )}
                </td>
                <td>
                  <StatusBadge tone={row.isOverdue ? 'danger' : 'info'}>
                    {row.isOverdue ? 'Overdue' : 'Within SLA'}
                  </StatusBadge>
                  <div className="muted admin-mt-8">Opened {row.createdAtLabel}</div>
                  <div className="admin-mt-8">
                    <StatusBadge tone={row.allocatedAmount > 0 ? 'info' : 'warning'}>
                      {row.allocatedAmount > 0 ? 'Evidence linked' : 'Missing settlement evidence'}
                    </StatusBadge>
                  </div>
                </td>
                <td>
                  <strong>{row.nextAction}</strong>
                  <div className="muted admin-mt-8">
                    {row.paymentMethod === 'CASH' ? row.settlementEvidence : `Payment: ${row.paymentMethod}`}
                  </div>
                </td>
                <td>
                  <AdminTextLink href={cashSettlementReviewHref(returnTo, row.earningId)}>Review</AdminTextLink>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
          <AdminTablePaginationFooter
            activePage={pagination.page}
            ariaLabel="Cash settlement debt pages"
            from={pagination.from}
            hrefForPage={(page) => cashSettlementHref({ ...filters, page })}
            to={pagination.to}
            totalPages={pagination.totalPages}
            totalRows={pagination.totalRows}
          />
        </>
      )}
    </AdminTablePanel>
  );
}

function cashSettlementEmptyTitle(filters: CashSettlementFilters) {
  switch (filters.queue) {
    case 'payment-check':
      return 'No booking-payment anomalies need review';
    case 'high-debt':
      return 'No high-exposure receivables match this scope';
    case 'missing-evidence':
      return 'No receivables are missing settlement evidence';
    case 'stale':
      return 'No overdue cash receivables match this scope';
    case 'all':
    default:
      return filters.q || filters.age !== 'all' || filters.sla !== 'all' || filters.range !== 'all'
        ? 'No open receivables match these filters'
        : 'No cash settlement debt is open';
  }
}

function cashSettlementEmptyDescription(filters: CashSettlementFilters, globalRowCount: number) {
  return `Selected queue: ${cashSettlementQueueLabel(filters.queue)}. The global all-date backlog still contains ${globalRowCount} open receivable(s).`;
}
