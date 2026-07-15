import type { AdminBookingSettlementGapRepairPreview } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
import { AdminDataTable, AdminTableSubstack } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';

type FinanceCloseoutSettlementBatchPreviewSectionProps = {
  readonly clearHref: string;
  readonly hrefForRepair: (bookingId: string) => string;
  readonly previews: readonly AdminBookingSettlementGapRepairPreview[];
};

export function FinanceCloseoutSettlementBatchPreviewSection({
  clearHref,
  hrefForRepair,
  previews,
}: FinanceCloseoutSettlementBatchPreviewSectionProps) {
  if (!previews.length) {
    return null;
  }

  return (
    <AdminTableSection
      actions={<AdminTextLink href={clearHref}>Clear selected review</AdminTextLink>}
      bodyClassName="admin-table-section-body"
      description="Read-only comparison for the selected settlement gaps. Eligible means the full preview passed; each write still requires its own governed dual-approval action."
      scrollable
      title={`Selected settlement review (${previews.length})`}
    >
      <AdminDataTable
        emptyMessage="No selected settlement previews are available."
        headers={[
          'Booking',
          'Completed',
          'Repair mode',
          'Preview result',
          'Expected accounting',
          'Evidence / blockers',
          'Action',
        ]}
        rowCount={previews.length}
      >
        {previews.map((preview) => (
          <tr key={preview.bookingId}>
            <td>
              <strong>{preview.bookingId}</strong>
            </td>
            <td>{formatDateTime(preview.completedAt)}</td>
            <td>{repairModeLabel(preview.repairMode)}</td>
            <td>
              <StatusBadge tone={preview.canRepair ? 'success' : 'danger'}>
                {preview.canRepair ? 'Eligible' : 'Blocked'}
              </StatusBadge>
            </td>
            <td>
              {preview.historicalSettlementDryRun ? (
                <AdminTableSubstack>
                  <span>
                    Payment{' '}
                    <MoneyText
                      amount={preview.historicalSettlementDryRun.customerPaymentAmount}
                      currency={preview.currency}
                    />{' '}
                    · Partner{' '}
                    <MoneyText
                      amount={preview.historicalSettlementDryRun.partnerPayoutAmount}
                      currency={preview.currency}
                    />
                  </span>
                  <span className="muted">
                    VAT{' '}
                    <MoneyText
                      amount={preview.historicalSettlementDryRun.amounts.companyOutputVat}
                      currency={preview.currency}
                    />{' '}
                    · Journal {preview.historicalSettlementDryRun.journal.totalDebit ===
                    preview.historicalSettlementDryRun.journal.totalCredit
                      ? 'balanced'
                      : 'unbalanced'}
                    {preview.historicalSettlementDryRun.journal.reconciliationDelta
                      ? ` · delta ${preview.historicalSettlementDryRun.journal.reconciliationDelta}`
                      : ''}
                  </span>
                </AdminTableSubstack>
              ) : (
                <span className="muted">Available for historical paid-evidence rows.</span>
              )}
            </td>
            <td>
              <AdminTableSubstack>
                {preview.historicalEvidenceSummary ? (
                  <span className="muted">
                    {preview.historicalEvidenceSummary.platformFeeLogCount} fee ·{' '}
                    {preview.historicalEvidenceSummary.taxLogCount} tax ·{' '}
                    {preview.historicalEvidenceSummary.walletLedgerEntryCount} wallet
                  </span>
                ) : null}
                {preview.blockers.length ? (
                  <span>{preview.blockers.map((blocker) => blocker.message).join(' ')}</span>
                ) : (
                  <span>Full preview passed.</span>
                )}
              </AdminTableSubstack>
            </td>
            <td>
              <AdminTextLink href={hrefForRepair(preview.bookingId)}>
                {preview.canRepair ? 'Open governed repair' : 'Open evidence review'}
              </AdminTextLink>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableSection>
  );
}

function repairModeLabel(mode: AdminBookingSettlementGapRepairPreview['repairMode']) {
  return mode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION'
    ? 'Historical paid evidence'
    : 'Canonical completion';
}
