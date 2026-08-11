import type { AdminBookingSettlementGapRepairPreview } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
import { AdminDataTable, AdminTableSubstack } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { CommandCopyButton } from '../../components/command-copy-button';
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
      description="Read-only comparison using the same technical and policy gate enforced by repair submission. Review-required records stay locked."
      scrollable
      title={`Selected settlement review (${previews.length})`}
    >
      <AdminDataTable
        className="finance-closeout-comparison-table"
        emptyMessage="No selected settlement previews are available."
        headers={['Record', 'Policy', 'Expected accounting', 'Evidence', 'Action']}
        rowCount={previews.length}
      >
        {previews.map((preview) => (
          <tr key={preview.bookingId}>
            <td>
              <AdminTableSubstack>
                <span className="finance-closeout-record-id">
                  <strong title={preview.bookingId}>{shortBookingId(preview.bookingId)}</strong>
                  <CommandCopyButton
                    copiedLabel="Booking ID copied"
                    failedLabel="Copy booking ID failed"
                    label="Copy full booking ID"
                    value={preview.bookingId}
                  />
                </span>
                <span>{customerLabel(preview)} · {partnerLabel(preview)}</span>
                <span className="muted">Completed {formatDateTime(preview.completedAt)}</span>
              </AdminTableSubstack>
            </td>
            <td>
              <AdminTableSubstack>
                <StatusBadge
                  tone={
                    preview.policyDecision === 'APPROVED'
                      ? 'success'
                      : preview.policyDecision === 'REVIEW_REQUIRED'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {preview.policyDecision === 'APPROVED'
                    ? 'Approved'
                    : preview.policyDecision === 'REVIEW_REQUIRED'
                      ? 'Review required'
                      : 'Blocked'}
                </StatusBadge>
                <span>{repairModeLabel(preview.repairMode)}</span>
                <span className="muted">{primaryReviewReason(preview)}</span>
                {preview.blockers.length + preview.policyReasons.length > 1 ? (
                  <details className="finance-closeout-comparison-details">
                    <summary>All review reasons</summary>
                    <ul>
                      {preview.blockers.map((blocker) => (
                        <li key={blocker.code}>{blocker.message}</li>
                      ))}
                      {preview.policyReasons.map((reason, index) => (
                        <li key={`${preview.policyExceptionCodes[index] ?? 'policy'}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </AdminTableSubstack>
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
                  <span>
                    {preview.historicalEvidenceSummary.platformFeeLogCount} fee ·{' '}
                    {preview.historicalEvidenceSummary.taxLogCount} tax ·{' '}
                    {preview.historicalEvidenceSummary.walletLedgerEntryCount} wallet
                  </span>
                ) : null}
                {preview.blockers.length || preview.policyReasons.length ? null : (
                  <span>Technical and policy preview passed.</span>
                )}
                <span className="muted">
                  Source version {preview.sourceVersion ? 'captured' : 'unavailable'} · Monthly close{' '}
                  {preview.monthlyClosingStatus ?? 'not created'}
                </span>
              </AdminTableSubstack>
            </td>
            <td className="finance-closeout-comparison-action">
              <AdminTextLink href={hrefForRepair(preview.bookingId)}>
                {preview.policyDecision === 'APPROVED'
                  ? 'Review & repair'
                  : 'Review evidence'}
              </AdminTextLink>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableSection>
  );
}

function shortBookingId(bookingId: string) {
  return bookingId.length > 12 ? `${bookingId.slice(0, 10)}…` : bookingId;
}

function customerLabel(preview: AdminBookingSettlementGapRepairPreview) {
  return (
    preview.customer?.user?.fullName ||
    preview.customer?.user?.phone ||
    preview.customer?.id ||
    'Customer unavailable'
  );
}

function partnerLabel(preview: AdminBookingSettlementGapRepairPreview) {
  return (
    preview.partner?.displayName ||
    preview.partner?.user?.fullName ||
    preview.partner?.user?.phone ||
    preview.partner?.id ||
    'Partner unavailable'
  );
}

function primaryReviewReason(preview: AdminBookingSettlementGapRepairPreview) {
  return (
    preview.blockers[0]?.message ||
    preview.policyReasons[0] ||
    'Technical and policy evidence passed.'
  );
}

function repairModeLabel(mode: AdminBookingSettlementGapRepairPreview['repairMode']) {
  return mode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION'
    ? 'Historical paid evidence'
    : 'Canonical completion';
}
