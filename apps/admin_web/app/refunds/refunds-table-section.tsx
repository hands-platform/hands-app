import type { ReactNode } from 'react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { RefundRowsTable } from './refund-rows-table';

export type RefundChecklistRow = {
  readonly detail: string;
  readonly label: string;
  readonly missingCategory?: 'action-blocker' | 'historical-evidence';
  readonly pillClass: string;
  readonly required: boolean;
  readonly status: string;
};

export type RefundTableRow = {
  readonly ageLabel: string;
  readonly amount: number;
  readonly bookingHref: string;
  readonly bookingId: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly checklistCompleted: number;
  readonly checklistRows: readonly RefundChecklistRow[];
  readonly currency: string;
  readonly customerHref: string | null;
  readonly customerLabel: string;
  readonly evidenceBlockerLabel: string;
  readonly evidenceLabel: string;
  readonly id: string;
  readonly opsHint: string;
  readonly opsTone: 'info' | 'ok' | 'warn';
  readonly paymentHref: string;
  readonly paymentId: string;
  readonly paymentLabel: string;
  readonly primaryActionHref: string;
  readonly primaryActionLabel: string;
  readonly reason: string;
  readonly requestSource: string;
  readonly shortId: string;
  readonly stageLabel: string;
  readonly workstreamLabel: string;
  readonly createdAtLabel: string;
};

type RefundsTableSectionProps = {
  readonly emptyMessage: ReactNode;
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly RefundTableRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

export function RefundsTableSection({ emptyMessage, pagination }: RefundsTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminTablePanel
      className="refund-cases-panel"
      description="Each case appears in one operational workstream. Open the full-width checklist without losing table comparison."
      title="Cases"
    >
      <AdminTableScroll ariaLabel="Refund cases table" className="refund-table-scroll">
        {rows.length > 0 ? (
          <RefundRowsTable rows={rows} />
        ) : (
          <AdminDataTable
            className="refund-operations-table"
            emptyMessage={emptyMessage}
            headers={['Stage', 'Customer / booking', 'Amount / payment', 'Reason / source', 'Control readiness', 'Owner / action']}
            rowCount={0}
          >
            {null}
          </AdminDataTable>
        )}
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Refund pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        itemLabel="refund cases"
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}
