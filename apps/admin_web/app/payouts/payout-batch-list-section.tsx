import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';
import { AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';
import {
  PayoutTransferEvidenceDrawer,
  type PayoutTransferEvidenceDrawerModel,
} from './payout-transfer-evidence-drawer';
import type { PayoutServerPagination } from './payouts-page-model';
import { formatMoney } from '../../lib/admin-format';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutBatchListSectionProps = {
  readonly pagination: PayoutServerPagination<PayoutBatchTableRow>;
  readonly paginationHrefForPage: (page: number) => string;
  readonly rows: readonly PayoutBatchTableRow[];
  readonly selectedRowLoaded?: boolean;
  readonly selectedRowRequested?: boolean;
  readonly selectedRow?: PayoutBatchTableRow | null;
  readonly selectionClearHref?: string;
  readonly showOperatorEvidence?: boolean;
  readonly updateTransferRefAction: FormAction;
};

export function PayoutBatchListSection({
  pagination,
  paginationHrefForPage,
  rows,
  selectedRowLoaded = true,
  selectedRowRequested = false,
  selectedRow = null,
  selectionClearHref = '/payouts',
  showOperatorEvidence = false,
  updateTransferRefAction,
}: PayoutBatchListSectionProps) {
  const drawerDetail: PayoutTransferEvidenceDrawerModel | null = selectedRow
    ? {
        amountLabel: formatMoney(selectedRow.totalAmount, selectedRow.currency),
        bankAccountDetail: selectedRow.bankAccountDetail ?? 'No approved payout account is available.',
        bankAccountLabel: selectedRow.bankAccountLabel ?? 'Missing',
        expectedStatus: selectedRow.rawStatus ?? selectedRow.statusLabel,
        id: selectedRow.id,
        notes: selectedRow.notes,
        partnerLabel: selectedRow.partnerLabel,
        partnerPhone: selectedRow.partnerPhone,
        phase: selectedRow.phase,
        riskDetail: selectedRow.riskDetail ?? selectedRow.readinessSummary,
        riskLabel: selectedRow.riskLabel ?? (selectedRow.blockingReasons.length ? 'Review required' : 'Clear'),
        shortId: selectedRow.shortId,
        statusLabel: selectedRow.statusLabel,
        transferRef: selectedRow.transferRef,
      }
    : null;

  return (
    <>
      {selectedRowRequested ? (
        <PayoutTransferEvidenceDrawer
          action={updateTransferRefAction}
          closeHref={selectionClearHref}
          detail={drawerDetail}
          detailLoaded={selectedRowLoaded}
        />
      ) : null}
      <AdminTablePanel
        className="payout-batch-list-card"
        description="Partner settlement batches ordered so unresolved money movement stays at the top."
        resultLabel={`${pagination.totalRows} ${pagination.totalRows === 1 ? 'batch' : 'batches'}`}
        resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
        title="Payout batch list"
      >
      <AdminFilterChipGroup ariaLabel="Payout batch toolbar" className="admin-mb-12">
        <StatusBadge tone="success">Newest active first</StatusBadge>
        <StatusBadge tone="info">Payout record</StatusBadge>
        <StatusBadge tone="warning">Reconciliation</StatusBadge>
        <StatusBadgeLink href="/earnings" tone="neutral">
          Review earnings
        </StatusBadgeLink>
      </AdminFilterChipGroup>

      {!selectedRowRequested ? (
        <AdminInlineNotice className="admin-mb-16" tone="info">
          Choose Review transfer on one payout batch to edit its bank reference and note.
        </AdminInlineNotice>
      ) : null}

      <AdminTableScroll>
        <PayoutBatchTable
          rows={rows}
          showOperatorEvidence={showOperatorEvidence}
        />
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Payout batch pages"
        from={pagination.from}
        hrefForPage={paginationHrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
      </AdminTablePanel>
    </>
  );
}
