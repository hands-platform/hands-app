import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminDetailGrid, AdminTaskCard } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass, type StatusBadgeTone } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerPayoutOperationsTone = 'done' | 'pending' | 'blocked';

export type PartnerPayoutOperationsCard = {
  readonly action: string;
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
  readonly id: string;
  readonly settlementNotes?: string | null;
  readonly settlementRef?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: ReactNode;
  readonly walletLines: readonly ReactNode[];
};

export type PartnerPayoutBatchRow = {
  readonly createdLine: string;
  readonly href: string;
  readonly id: string;
  readonly paidLine?: string | null;
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
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Settlement view for unpaid earnings, withholding, payout batches, and payout holds."
      id="payout-operations"
      resultLabel={operations.status}
      resultTone={payoutOperationsStatusTone(operations.tone)}
      title="Payout operations"
    >
      <div className="ops-task-grid">
        {operations.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.action}
            className={cardClassForTone(card.tone)}
            detail={card.detailNode ?? card.detail}
            key={card.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(pillClassForTone(card.tone))}>
                {card.status}
              </StatusBadge>
            }
            title={card.title}
          />
        ))}
      </div>
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
                  <StatusBadge tone="danger">HELD</StatusBadge>
                  <p>
                    <strong>Active payout hold</strong>
                  </p>
                </td>
                <td>
                  <p className="muted">{operations.hold.reason ?? 'No hold reason recorded.'}</p>
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
                  <Link className="text-link" href={partnerControlsHref}>
                    Reports desk
                  </Link>
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
                <Link className="text-link" href="/cash-settlements">
                  Cash debt queue
                </Link>
              ) : null}
              <Link className="text-link" href="/earnings">
                Open earnings
              </Link>
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
                    <p className="muted">{earning.detailLine}</p>
                  </td>
                  <td>
                    <span>{earning.amountLine}</span>
                  </td>
                  <td>
                    {earning.settlementRef ? (
                      <span className="muted">Settlement ref {earning.settlementRef}</span>
                    ) : (
                      <span className="muted">No settlement ref</span>
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
                      <span className="muted">No wallet adjustment</span>
                    )}
                  </td>
                  <td>
                    <span className="muted">{earning.smallLabel}</span>
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
              <Link className="text-link" href="/payouts">
                Open payouts
              </Link>
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
                    <StatusBadge tone={statusBadgeToneFromPillClass(payoutBatchPill(batch.status))}>
                      {batch.status}
                    </StatusBadge>
                  </td>
                  <td>
                    <span className="muted">{batch.createdLine}</span>
                    {batch.paidLine ? <p className="muted">{batch.paidLine}</p> : null}
                  </td>
                  <td>
                    <Link className="text-link" href={batch.href}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <PartnerDetailVuexyTableFooter rowCount={payoutBatchRows.length} />
        </div>
      </AdminDetailGrid>
    </AdminFilterPanel>
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
