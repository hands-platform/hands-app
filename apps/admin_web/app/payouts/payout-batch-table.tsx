import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';
import {
  AdminFinanceOperatorEvidence,
  type AdminFinanceOperatorEvidenceLine,
} from '../../components/admin-finance-operator-evidence';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import {
  AdminSignal,
  adminSignalToneFromClassName,
  StatusBadge,
  StatusBadgeFromPillClass,
  StatusBadgeLink,
} from '../../components/status-badge';

export type PayoutBatchBlockingReason = {
  readonly detail: string;
  readonly label: string;
  readonly pillClass: string;
};

export type PayoutBatchChecklistItem = {
  readonly detail: string;
  readonly label: string;
  readonly ok: boolean;
};

export type PayoutBatchActionExecutionItem = {
  readonly action: string;
  readonly operatorRule: string;
  readonly pillClass: string;
  readonly reason: ReactNode;
  readonly status: string;
};

export type PayoutBatchServiceEvidencePill = {
  readonly amount: number;
  readonly currency: string;
  readonly key: string;
  readonly label: string;
};

export type PayoutBatchTableRow = {
  readonly actionExecutionItems: readonly PayoutBatchActionExecutionItem[];
  readonly actionMenuItems: readonly ActionMenuItem[];
  readonly bankAccountDetail?: string;
  readonly bankAccountLabel?: string;
  readonly bankReconciliationRemainingAmount?: number;
  readonly blockingActionSummary: string;
  readonly blockingReasons: readonly PayoutBatchBlockingReason[];
  readonly checklist: readonly PayoutBatchChecklistItem[];
  readonly currency: string;
  readonly earningCount: number;
  readonly earningsHint: string;
  readonly id: string;
  readonly notes: string;
  readonly operatorEvidence?: readonly AdminFinanceOperatorEvidenceLine[];
  readonly opsHint: string;
  readonly opsSignal: string;
  readonly opsSignalClassName: string;
  readonly paidAt: string | null;
  readonly paidAtRelativeLabel: string;
  readonly paidBlockedByReleaseCheck: boolean;
  readonly partnerChecksHref: string;
  readonly partnerLabel: string;
  readonly partnerPhone: string;
  readonly payoutHold: boolean;
  readonly phase: string;
  readonly readinessSummary: string;
  readonly rawStatus?: string;
  readonly reviewHref?: string;
  readonly riskDetail?: string;
  readonly riskLabel?: string;
  readonly serviceEvidencePills: readonly PayoutBatchServiceEvidencePill[];
  readonly shortId: string;
  readonly statusLabel: string;
  readonly taxLogCount: number;
  readonly totalAmount: number;
  readonly transferRef: string;
  readonly updatedLabel: string;
  readonly withholdingAmount: number;
};

type PayoutBatchTableProps = {
  readonly rows: readonly PayoutBatchTableRow[];
  readonly showOperatorEvidence?: boolean;
};

const payoutBatchTableHeaders = [
  'Partner / batch',
  'Amount',
  'Stage',
  'Primary issue',
  'Transfer evidence',
  'Action',
] as const;

export function PayoutBatchTable({
  rows,
  showOperatorEvidence = false,
}: PayoutBatchTableProps) {
  return (
    <AdminDataTable
      className="vuexy-booking-table payout-batch-compact-table"
      emptyMessage="No payout batches loaded."
      headers={payoutBatchTableHeaders}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr id={`payout-batch-${row.id}`} key={row.id} tabIndex={-1}>
          <td>
            <AdminTextLink href={row.partnerChecksHref}>{row.partnerLabel}</AdminTextLink>
            <div className="muted">{row.partnerPhone}</div>
            <div className="muted admin-mt-6">{row.shortId} · {row.updatedLabel}</div>
            {row.payoutHold ? (
              <div className="admin-mt-6">
                <StatusBadge tone="danger">Payout hold</StatusBadge>
              </div>
            ) : null}
          </td>
          <td>
            <strong>
              <MoneyText amount={row.totalAmount} currency={row.currency} />
            </strong>
            <div className="muted admin-mt-6">
              Withholding <MoneyText amount={row.withholdingAmount} currency={row.currency} />
            </div>
          </td>
          <td>
            <strong>{row.statusLabel}</strong>
            <div className="muted">{row.phase}</div>
            <div className="admin-mt-6">
              <AdminSignal
                className={row.opsSignalClassName}
                tone={adminSignalToneFromClassName(row.opsSignalClassName)}
              >
                {row.opsSignal}
              </AdminSignal>
            </div>
          </td>
          <td>
            <PrimaryPayoutIssue row={row} showOperatorEvidence={showOperatorEvidence} />
          </td>
          <td>
            <strong>{row.bankAccountLabel ?? 'Bank not linked'}</strong>
            <div className="muted">{row.transferRef ? `Ref ${row.transferRef}` : 'Reference not recorded'}</div>
            {row.notes ? <div className="muted admin-mt-6">{row.notes}</div> : null}
            {row.paidAt ? (
              <div className="muted admin-mt-6">
                Paid <DateTimeText value={row.paidAt} />
              </div>
            ) : (
              <div className="muted admin-mt-6">{row.paidAtRelativeLabel}</div>
            )}
          </td>
          <td>
            <div className="actions">
              {row.reviewHref ? (
                <span id={`payout-transfer-trigger-${row.id}`}>
                  <StatusBadgeLink
                    ariaLabel={`${row.statusLabel === 'Paid' ? 'Repair transfer evidence' : 'Review transfer'} for ${row.partnerLabel} (${row.shortId})`}
                    href={row.reviewHref}
                    tone="info"
                  >
                    {row.statusLabel === 'Paid' ? 'Repair transfer evidence' : 'Review transfer'}
                  </StatusBadgeLink>
                </span>
              ) : null}
              <ActionMenu actions={row.actionMenuItems} label={`Payout actions for ${row.shortId}`} />
              {row.payoutHold ? (
                <StatusBadgeLink href={row.partnerChecksHref} tone="danger">
                  Open partner checks
                </StatusBadgeLink>
              ) : null}
              {row.paidBlockedByReleaseCheck ? (
                <StatusBadge tone="warning">Resolve blockers before paid</StatusBadge>
              ) : null}
              {(row.statusLabel === 'Paid' || row.statusLabel === 'Cancelled') &&
              row.actionMenuItems.length === 0 ? (
                <AdminInlineFallback>No status action</AdminInlineFallback>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

function PrimaryPayoutIssue({
  row,
  showOperatorEvidence,
}: {
  readonly row: PayoutBatchTableRow;
  readonly showOperatorEvidence: boolean;
}) {
  const firstReason = row.blockingReasons[0];
  const isPaid = row.statusLabel === 'Paid';
  const issueLabel = firstReason?.label ??
    (row.riskLabel && row.riskLabel !== 'Clear' ? row.riskLabel : isPaid ? 'Closeout evidence complete' : 'Ready for next finance action');
  const issueDetail = firstReason?.detail ?? row.riskDetail ?? row.opsHint;
  const tone = issueLabel.includes('complete') || issueLabel.includes('Ready') ? 'success' : 'warning';

  return (
    <div className="payout-batch-primary-issue">
      {firstReason ? (
        <StatusBadgeFromPillClass pillClass={firstReason.pillClass} title={firstReason.detail}>
          {firstReason.label}
        </StatusBadgeFromPillClass>
      ) : (
        <StatusBadge tone={tone}>{issueLabel}</StatusBadge>
      )}
      <p className="muted admin-mt-6">{issueDetail}</p>
      <details
        aria-label={`${isPaid ? 'Reconciliation findings' : 'Release checks'} for ${row.shortId}`}
        className="payout-batch-row-details"
      >
        <summary>{isPaid ? 'Reconciliation findings' : 'Release checks'}</summary>
        <div className="admin-mt-8">
          <p>{row.opsHint}</p>
          <p className="muted admin-mt-6">{row.blockingActionSummary}</p>
          <p className="muted admin-mt-6">
            {row.earningCount} linked {row.earningCount === 1 ? 'earning' : 'earnings'} · {row.taxLogCount}{' '}
            payout deduction {row.taxLogCount === 1 ? 'record' : 'records'}
          </p>
          {row.bankReconciliationRemainingAmount !== undefined ? (
            <p className="muted admin-mt-6">
              Bank match remaining{' '}
              <MoneyText amount={row.bankReconciliationRemainingAmount} currency={row.currency} />
            </p>
          ) : null}
          {showOperatorEvidence ? (
            <AdminFinanceOperatorEvidence lines={row.operatorEvidence ?? []} />
          ) : null}
        </div>
      </details>
    </div>
  );
}
