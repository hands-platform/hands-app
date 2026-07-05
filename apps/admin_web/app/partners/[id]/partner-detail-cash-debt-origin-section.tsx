import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName}${hasCashFeeDebt ? ' card-danger' : ''} admin-mb-16`}
      description="Partner wallet debt is reviewed by why it became negative and whether a company-fee deposit or approved offset has evidence. Marketplace visibility is not logged here; direct first-pick and already-matched service flow are not retroactively blocked by wallet debt."
      id="cash-debt-origin"
      resultLabel={hasCashFeeDebt ? `${openRowCount} open row(s)` : 'No open cash debt'}
      resultTone={hasCashFeeDebt ? 'danger' : 'success'}
      title="Cash debt origin and settlement"
    >
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Total open debt</span>
          <strong>{openDebtLabel}</strong>
          <small>From cash-service fee/tax settlement rows.</small>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{hasSettlementRef ? 'Some refs' : 'Needs ref'}</strong>
          <small>Deposit reference or admin offset is required to clear debt.</small>
        </div>
        <div>
          <span>Marketplace</span>
          <strong>{hasCashFeeDebt ? 'Warning state' : 'Participation open'}</strong>
          <small>
            Partner visibility and participation stay open; final acceptance and service start wait.
          </small>
        </div>
        <div>
          <span>Direct first-pick</span>
          <strong>Not wallet-blocked</strong>
          <small>Use account, KYC, location, push, pricing, and wallet settlement gates for direct flow.</small>
        </div>
        <div>
          <span>Payout release</span>
          <strong>{hasCashFeeDebt ? 'Held' : 'Open'}</strong>
          <small>Finance should not release payout while HANDS fee/tax debt is open.</small>
        </div>
        <div>
          <span>Next action</span>
          <strong>{hasCashFeeDebt ? 'Collect/offset' : 'Monitor'}</strong>
          <small>
            {hasCashFeeDebt ? 'Use Cash Settlements to clear the wallet.' : 'No finance action needed.'}
          </small>
        </div>
      </div>
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
                  <div className="participant-list">
                    <StatusBadge tone="danger">HANDS fee {row.handsFeeLabel}</StatusBadge>
                    <StatusBadge tone="warning">Tax {row.taxLabel}</StatusBadge>
                  </div>
                </td>
                <td>
                  <p className="muted">
                    Settlement rule: once deposit reference or admin offset clears this debt, final
                    acceptance, service start, and payout release can resume.
                  </p>
                  <div className="participant-list">
                    <StatusBadge tone="info">{row.evidenceLabel}</StatusBadge>
                    <StatusBadge tone="info">Direct first-pick not wallet-blocked</StatusBadge>
                  </div>
                </td>
                <td>
                  <div className="button-row">
                    {row.bookingHref ? (
                      <Link className="text-link" href={row.bookingHref}>
                        Booking evidence
                      </Link>
                    ) : null}
                    <Link className="text-link" href="/cash-settlements">
                      Settle
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}
