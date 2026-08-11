import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import {
  AdminFinanceOperatorEvidence,
  type AdminFinanceOperatorEvidenceLine,
} from '../../../components/admin-finance-operator-evidence';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminDetailGrid, AdminTaskCard, AdminTaskGrid } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass, type StatusBadgeTone } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerPayoutOperationsTone = 'done' | 'pending' | 'blocked';

export type PartnerPayoutOperationsCard = {
  readonly action: string;
  readonly actionNode?: ReactNode;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutOperationsView = {
  readonly blockers: readonly string[];
  readonly cards: readonly PartnerPayoutOperationsCard[];
  readonly hold?: {
    readonly expiresAt?: string | null;
    readonly reason?: string | null;
    readonly startsAt?: string | null;
  } | null;
  readonly status: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutEarningRow = {
  readonly amountLine: ReactNode;
  readonly detailLine: string;
  readonly detailLineNode?: ReactNode;
  readonly id: string;
  readonly settlementNotes?: string | null;
  readonly settlementRef?: string | null;
  readonly smallLabel: string;
  readonly smallLabelNode?: ReactNode;
  readonly statusLabel: string;
  readonly title: ReactNode;
  readonly walletLines: readonly ReactNode[];
};

export type PartnerPayoutBatchRow = {
  readonly createdLine: string;
  readonly createdLineNode?: ReactNode;
  readonly href: string;
  readonly id: string;
  readonly operatorEvidence?: readonly AdminFinanceOperatorEvidenceLine[];
  readonly paidLine?: string | null;
  readonly paidLineNode?: ReactNode;
  readonly status: string;
  readonly totalNetLabel: ReactNode;
};

type PartnerDetailPayoutOperationsSectionProps = {
  readonly cardClassForTone: (tone: PartnerPayoutOperationsTone) => string;
  readonly earningsRows: readonly PartnerPayoutEarningRow[];
  readonly hasCashFeeDebt: boolean;
  readonly operations: PartnerPayoutOperationsView;
  readonly partnerControlsHref: string;
  readonly payoutBatchRows: readonly PartnerPayoutBatchRow[];
  readonly pillClassForTone: (tone: PartnerPayoutOperationsTone) => string;
};

export function PartnerDetailPayoutOperationsSection({
  cardClassForTone,
  earningsRows,
  hasCashFeeDebt,
  operations,
  partnerControlsHref,
  payoutBatchRows,
  pillClassForTone,
}: PartnerDetailPayoutOperationsSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Settlement view for unpaid earnings, withholding, payout batches, and payout holds."
      id="payout-operations"
      resultLabel={operations.status}
      resultTone={payoutOperationsStatusTone(operations.tone)}
      title="Payout operations"
    >
      <AdminTaskGrid>
        {operations.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.actionNode ?? card.action}
            className={cardClassForTone(card.tone)}
            detail={card.detailNode ?? card.detail}
            key={card.title}
            leading={
              <StatusBadgeFromPillClass pillClass={pillClassForTone(card.tone)}>
                {card.status}
              </StatusBadgeFromPillClass>
            }
            title={card.title}
          />
        ))}
      </AdminTaskGrid>
      {operations.hold ? (
        <>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={<AdminEmptyState message="No active payout hold." />}
              headers={payoutHoldHeaders}
              rowCount={1}
            >
              <tr>
                <td>
                  <StatusBadge tone="danger">On hold</StatusBadge>
                  <p>
                    <strong>Active payout hold</strong>
                  </p>
                </td>
                <td>
                  {operations.hold.reason ? (
                    <p className="muted">{operations.hold.reason}</p>
                  ) : (
                    <AdminInlineFallback>No hold reason recorded.</AdminInlineFallback>
                  )}
                </td>
                <td>
                  <span className="muted">
                    Started <DateTimeText fallback="Missing" value={operations.hold.startsAt} />
                  </span>
                  <p className="muted">
                    Expires <DateTimeText fallback="Missing" value={operations.hold.expiresAt} />
                  </p>
                </td>
                <td>
                  <AdminTextLink href={partnerControlsHref}>
                    Reports desk
                  </AdminTextLink>
                </td>
              </tr>
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={1} />
        </>
      ) : null}
      {operations.blockers.length ? (
        <>
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={<AdminEmptyState message="No payout blockers." />}
              headers={payoutBlockerHeaders}
              rowCount={operations.blockers.length}
            >
              {operations.blockers.map((blocker) => (
                <tr key={blocker}>
                  <td>
                    <StatusBadge tone="warning">GATE</StatusBadge>
                    <p>
                      <strong>Payout blocker</strong>
                    </p>
                  </td>
                  <td>
                    <p className="muted">{blocker}</p>
                  </td>
                  <td>
                    <span className="muted">Resolve</span>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={operations.blockers.length} />
        </>
      ) : null}
      <AdminDetailGrid className="admin-mt-16">
        <div>
          <AdminSectionHeader
            actions={(
              <div className="actions">
              {hasCashFeeDebt ? (
                <AdminTextLink href="/cash-settlements">
                  Cash debt queue
                </AdminTextLink>
              ) : null}
              <AdminTextLink href="/earnings">
                Open earnings
              </AdminTextLink>
              </div>
            )}
            title="Recent earnings"
          />
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={
                <AdminEmptyState message="No earnings yet. Payout eligibility starts after the first completed service." />
              }
              headers={earningHeaders}
              rowCount={earningsRows.length}
            >
              {earningsRows.map((earning) => (
                <tr key={earning.id}>
                  <td>
                    <span className="muted">{earning.statusLabel}</span>
                    <p>
                      <strong>{earning.title}</strong>
                    </p>
                    <p className="muted">{earning.detailLineNode ?? earning.detailLine}</p>
                  </td>
                  <td>
                    <span>{earning.amountLine}</span>
                  </td>
                  <td>
                    {earning.settlementRef ? (
                      <span className="muted">Settlement ref {earning.settlementRef}</span>
                    ) : (
                      <AdminInlineFallback>No settlement ref</AdminInlineFallback>
                    )}
                    {earning.settlementNotes ? <p className="muted">{earning.settlementNotes}</p> : null}
                  </td>
                  <td>
                    {earning.walletLines.length ? (
                      earning.walletLines.map((line, index) => (
                        <p className="muted" key={`${earning.id}-wallet-${index}`}>
                          {line}
                        </p>
                      ))
                    ) : (
                      <AdminInlineFallback>No wallet adjustment</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    <span className="muted">{earning.smallLabelNode ?? earning.smallLabel}</span>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={earningsRows.length} />
        </div>
        <div>
          <AdminSectionHeader
            actions={(
              <AdminTextLink href="/payouts">
                Open payouts
              </AdminTextLink>
            )}
            title="Recent payout batches"
          />
          <AdminTableScroll>
            <AdminDataTable
              className={partnerDetailReviewTableClassName}
              emptyMessage={
                <AdminEmptyState message="No payout batch has been created for this partner yet." />
              }
              headers={payoutBatchHeaders}
              rowCount={payoutBatchRows.length}
            >
              {payoutBatchRows.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <strong>{batch.totalNetLabel}</strong>
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={payoutBatchPill(batch.status)}>
                      {batch.status}
                    </StatusBadgeFromPillClass>
                    <AdminFinanceOperatorEvidence lines={batch.operatorEvidence ?? []} />
                  </td>
                  <td>
                    <span className="muted">{batch.createdLineNode ?? batch.createdLine}</span>
                    {batch.paidLine || batch.paidLineNode ? (
                      <p className="muted">{batch.paidLineNode ?? batch.paidLine}</p>
                    ) : null}
                  </td>
                  <td>
                    <AdminTextLink href={batch.href}>
                      View
                    </AdminTextLink>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={payoutBatchRows.length} />
        </div>
      </AdminDetailGrid>
    </PartnerDetailVuexyTablePanel>
  );
}

const payoutHoldHeaders = ['Hold', 'Reason', 'Timeline', 'Action'] as const;
const payoutBlockerHeaders = ['Gate', 'Detail', 'Action'] as const;
const earningHeaders = ['Earning', 'Amount', 'Settlement', 'Wallet', 'Action'] as const;
const payoutBatchHeaders = ['Batch', 'Status', 'Timeline', 'Action'] as const;

function payoutBatchPill(status: string) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus.includes('PAID') || normalizedStatus.includes('COMPLETED')) {
    return 'pill-success';
  }
  if (normalizedStatus.includes('FAILED') || normalizedStatus.includes('HELD')) {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function payoutOperationsStatusTone(tone: PartnerPayoutOperationsTone): StatusBadgeTone {
  if (tone === 'done') return 'success';
  if (tone === 'blocked') return 'danger';
  return 'warning';
}
