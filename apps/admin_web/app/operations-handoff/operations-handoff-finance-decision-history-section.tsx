import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/admin-format';
import type { OperationsHandoffFinanceDecisionRow } from './operations-handoff-finance-decisions';
import {
  OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
  OperationsHandoffPaginationFooter,
  type OperationsHandoffPagination,
} from './operations-handoff-pagination';

type OperationsHandoffFinanceDecisionHistorySectionProps = {
  readonly pagination: OperationsHandoffPagination;
  readonly rows: readonly OperationsHandoffFinanceDecisionRow[];
};

const FINANCE_DECISION_HEADERS = [
  'Decision',
  'Record',
  'Outcome',
  'Completed by',
  'Completed at',
] as const;

export function OperationsHandoffFinanceDecisionHistorySection({
  pagination,
  rows,
}: OperationsHandoffFinanceDecisionHistorySectionProps) {
  const visibleRows = rows.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalRows / OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
  );
  const start = (pagination.activePage - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE;
  const from = visibleRows.length === 0 ? 0 : start + 1;
  const to = visibleRows.length === 0 ? 0 : start + visibleRows.length;

  return (
    <AdminSection
      actions={
        <div className="actions">
          <AdminTextLink href="/finance-tax/approval-queue">Approval queue</AdminTextLink>
          <AdminTextLink href="/finance-tax/bank-reconciliation">Bank reconciliation</AdminTextLink>
        </div>
      }
      className="operations-handoff-finance-decision-card"
      description="Completed approvals, bank reconciliation decisions, refunds, executions, remittances, monthly close decisions, rejections, reversals, and resolved Finance SLA alerts only. Open work remains in Shift command and Finance Overview."
      id="operations-handoff-finance-decisions"
      title="Finance decision history"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No completed Finance decisions in this period."
          headers={FINANCE_DECISION_HEADERS}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.title}</strong>
                <small className="muted admin-table-cell-block">{row.detail}</small>
              </td>
              <td>
                <AdminTextLink href={row.href}>{row.recordLabel}</AdminTextLink>
              </td>
              <td>
                <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
              </td>
              <td>{row.actorLabel}</td>
              <td>{formatDateTime(row.completedAt)}</td>
            </tr>
          ))}
        </AdminDataTable>
        <OperationsHandoffPaginationFooter
          from={from}
          pagination={pagination}
          to={to}
          totalPages={totalPages}
        />
      </AdminTableScroll>
    </AdminSection>
  );
}
