import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../../components/status-badge';
import { walletLedgerLabel } from './partner-detail-format';
import type { PartnerWalletReviewTone, PartnerWalletSummary } from './partner-detail-wallet-model';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type PartnerDetailWalletSummarySectionProps = {
  readonly summary: PartnerWalletSummary;
};

const walletHeaders = ['Ledger row', 'Amount', 'Allocation summary', 'Evidence'];

export function PartnerDetailWalletSummarySection({
  summary,
}: PartnerDetailWalletSummarySectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Partner wallet balance, manual bank deposits, negative-wallet recovery, and cash-service deductions. This is a bounded detail-page evidence window; full ledger/audit remains owned by finance APIs."
      id="partner-wallet-detail"
      resultLabel={
        summary.negativeWalletReceivable > 0 ? (
          <>
            <MoneyText amount={summary.negativeWalletReceivable} currency={summary.currency} /> receivable
          </>
        ) : (
          'Wallet clear'
        )
      }
      resultTone={resultTone(summary.reviewTone)}
      title="Partner wallet detail"
    >
      <AdminTraceSummary
        className="admin-mt-12 partner-wallet-summary-grid"
        metrics={[
          {
            detail: 'Positive balance is HANDS liability/prepaid value held for the partner.',
            label: 'Current balance',
            value: <MoneyText amount={summary.currentBalance} currency={summary.currency} />,
          },
          {
            detail: 'Used for withdrawal review or future prepaid deduction, depending on policy.',
            label: 'Available / liability',
            value: <MoneyText amount={summary.partnerWalletLiability} currency={summary.currency} />,
          },
          {
            detail: 'Finance follow-up amount still owed by the partner.',
            label: 'Negative receivable',
            value: <MoneyText amount={summary.negativeWalletReceivable} currency={summary.currency} />,
          },
          {
            detail: 'Visible manually recorded partner bank deposits.',
            label: 'Bank deposits',
            value: <MoneyText amount={summary.manualBankDeposits} currency={summary.currency} />,
          },
          {
            detail: 'Deposit allocation applied to existing negative wallet balance.',
            label: 'Negative wallet cleared',
            value: <MoneyText amount={summary.appliedToNegativeWallet} currency={summary.currency} />,
          },
          {
            detail: (
              <>
                Fee <MoneyText amount={summary.cashPlatformFeeDeductions} currency={summary.currency} /> / VAT{' '}
                <MoneyText amount={summary.cashCompanyVatDeductions} currency={summary.currency} /> / tax{' '}
                <MoneyText amount={summary.cashPartnerTaxDeductions} currency={summary.currency} />
              </>
            ),
            label: 'Cash-service deductions',
            value: (
              <MoneyText
                amount={
                  summary.cashPlatformFeeDeductions +
                  summary.cashCompanyVatDeductions +
                  summary.cashPartnerTaxDeductions
                }
                currency={summary.currency}
              />
            ),
          },
        ]}
      />

      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={
              <AdminEmptyState
                framed
                message="No recent partner wallet ledger row is loaded for this detail page."
              />
            }
            headers={walletHeaders}
            rowCount={summary.visibleLedgerRows.length}
          >
            {summary.visibleLedgerRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{walletLedgerLabel(row.type)}</strong>
                  <p className="muted">{row.type}</p>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={row.amount} currency={row.currency} />
                  </strong>
                  <p className="muted">
                    <DateTimeText fallback="Missing" value={row.createdAt} />
                  </p>
                </td>
                <td>
                  <AdminFilterChipGroup ariaLabel={`${walletLedgerLabel(row.type)} allocation summary`}>
                    {row.type === 'PARTNER_BANK_DEPOSIT_RECEIVED' ? (
                      <>
                        <StatusBadge tone="success">
                          Cleared <MoneyText amount={summary.appliedToNegativeWallet} currency={summary.currency} />
                        </StatusBadge>
                        <StatusBadge tone="info">
                          Prepaid <MoneyText amount={summary.recordedAsPrepaidBalance} currency={summary.currency} />
                        </StatusBadge>
                      </>
                    ) : (
                      <StatusBadge tone="info">Cash-service wallet movement</StatusBadge>
                    )}
                  </AdminFilterChipGroup>
                </td>
                <td>
                  {row.reference ? (
                    <p className="muted">Reference {row.reference}</p>
                  ) : (
                    <AdminInlineFallback>No reference saved</AdminInlineFallback>
                  )}
                  {row.notes ? <p className="muted">{row.notes}</p> : null}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={summary.visibleLedgerRows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

function resultTone(tone: PartnerWalletReviewTone): StatusBadgeTone {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warning';
  return 'success';
}
