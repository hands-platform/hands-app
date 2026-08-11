import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerCashDebtOriginRow = {
  readonly amountLabel: ReactNode;
  readonly bookingHref?: string;
  readonly bookingLabel: string;
  readonly createdAt?: string | null;
  readonly evidenceLabel: string;
  readonly handsFeeLabel: ReactNode;
  readonly id: string;
  readonly originLabel: string;
  readonly paymentMethod: string;
  readonly taxLabel: ReactNode;
};

type PartnerDetailCashDebtOriginSectionProps = {
  readonly hasCashFeeDebt: boolean;
  readonly hasSettlementRef: boolean;
  readonly openDebtLabel: ReactNode;
  readonly openRowCount: number;
  readonly rows: readonly PartnerCashDebtOriginRow[];
};

const cashDebtOriginHeaders = ['Debt', 'Origin', 'Booking', 'Fees', 'Evidence', 'Action'];

export function PartnerDetailCashDebtOriginSection({
  hasCashFeeDebt,
  hasSettlementRef,
  openDebtLabel,
  openRowCount,
  rows,
}: PartnerDetailCashDebtOriginSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className={`${hasCashFeeDebt ? 'card-danger ' : ''}admin-mb-16`}
      description="Partner wallet debt is reviewed by why it became negative and whether a company-fee deposit or approved offset has evidence. Marketplace visibility is not logged here; direct first-pick and already-matched service flow are not retroactively blocked by wallet debt."
      id="cash-debt-origin"
      resultLabel={hasCashFeeDebt ? `${openRowCount} open row(s)` : 'No open cash debt'}
      resultTone={hasCashFeeDebt ? 'danger' : 'success'}
      title="Cash debt origin and settlement"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'From cash-service fee/tax settlement rows.',
            label: 'Total open debt',
            value: openDebtLabel,
          },
          {
            detail: 'Deposit reference or admin offset is required to clear debt.',
            label: 'Evidence',
            value: hasSettlementRef ? 'Some refs' : 'Needs ref',
          },
          {
            detail: 'Partner visibility and participation stay open; final acceptance and service start wait.',
            label: 'Marketplace',
            value: hasCashFeeDebt ? 'Warning state' : 'Participation open',
          },
          {
            detail: 'Use account, KYC, location, push, pricing, and wallet settlement gates for direct flow.',
            label: 'Direct first-pick',
            value: 'Not wallet-blocked',
          },
          {
            detail: 'Finance should not release payout while HANDS fee/tax debt is open.',
            label: 'Payout release',
            value: hasCashFeeDebt ? 'Blocked by cash debt' : 'Available',
          },
          {
            detail: hasCashFeeDebt ? 'Use Cash Settlements to clear the wallet.' : 'No finance action needed.',
            label: 'Next action',
            value: hasCashFeeDebt ? 'Collect/offset' : 'Monitor',
          },
        ]}
      />
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={
              <AdminEmptyState framed message="No open cash-service fee debt is visible for this partner." />
            }
            headers={cashDebtOriginHeaders}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.amountLabel}</strong>
                  <p className="muted">Cash debt</p>
                </td>
                <td>
                  <p className="muted">{row.originLabel}</p>
                </td>
                <td>
                  <p className="muted">
                    Booking {row.bookingLabel} / payment {row.paymentMethod} / created{' '}
                    <DateTimeText fallback="Missing" value={row.createdAt} />
                  </p>
                </td>
                <td>
                  <AdminFilterChipGroup ariaLabel={`${row.bookingLabel} cash debt fees`}>
                    <StatusBadge tone="danger">HANDS fee {row.handsFeeLabel}</StatusBadge>
                    <StatusBadge tone="warning">Tax {row.taxLabel}</StatusBadge>
                  </AdminFilterChipGroup>
                </td>
                <td>
                  <p className="muted">
                    Settlement rule: once deposit reference or admin offset clears this debt, final
                    acceptance, service start, and payout release can resume.
                  </p>
                  <AdminFilterChipGroup ariaLabel={`${row.bookingLabel} cash debt evidence`}>
                    <StatusBadge tone="info">{row.evidenceLabel}</StatusBadge>
                    <StatusBadge tone="info">Direct first-pick not wallet-blocked</StatusBadge>
                  </AdminFilterChipGroup>
                </td>
                <td>
                  <div className="button-row">
                    {row.bookingHref ? (
                      <AdminTextLink href={row.bookingHref}>
                        Booking evidence
                      </AdminTextLink>
                    ) : null}
                    <AdminTextLink href="/cash-settlements">
                      Settle
                    </AdminTextLink>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}
