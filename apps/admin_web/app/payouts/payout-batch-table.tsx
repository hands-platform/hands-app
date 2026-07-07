import type { ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminActionsForm } from '../../components/admin-inline-action-form';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminNotePanel } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import {
  AdminSignal,
  adminSignalToneFromClassName,
  StatusBadge,
  StatusBadgeFromPillClass,
  StatusBadgeLink,
} from '../../components/status-badge';

type FormAction = (formData: FormData) => void | Promise<void>;

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
  readonly blockingActionSummary: string;
  readonly blockingReasons: readonly PayoutBatchBlockingReason[];
  readonly checklist: readonly PayoutBatchChecklistItem[];
  readonly currency: string;
  readonly earningCount: number;
  readonly earningsHint: string;
  readonly id: string;
  readonly notes: string;
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
  readonly updateTransferRefAction: FormAction;
};

const payoutBatchTableHeaders = [
  'Batch',
  'Partner',
  'Status',
  'Ops record',
  'Blocking reasons',
  'Transfer ref',
  'Earnings',
  'Checklist',
  'Total',
  'Tax withheld',
  'Paid at',
  'Actions',
] as const;

export function PayoutBatchTable({ rows, updateTransferRefAction }: PayoutBatchTableProps) {
  return (
    <AdminDataTable
      className="vuexy-booking-table"
      emptyMessage="No payout batches loaded."
      headers={payoutBatchTableHeaders}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr id={row.id} key={row.id}>
          <td>
            <div>{row.shortId}</div>
            <div className="muted">{row.updatedLabel}</div>
          </td>
          <td>
            <div>{row.partnerLabel}</div>
            <div className="muted">{row.partnerPhone}</div>
            {row.payoutHold ? (
              <div className="admin-mt-6">
                <StatusBadge tone="danger">Payout hold</StatusBadge>
              </div>
            ) : null}
          </td>
          <td>
            <div>{row.statusLabel}</div>
            <div className="muted">{row.phase}</div>
          </td>
          <td>
            <AdminSignal
              className={row.opsSignalClassName}
              tone={adminSignalToneFromClassName(row.opsSignalClassName)}
            >
              {row.opsSignal}
            </AdminSignal>
            <div className="muted admin-mt-6">
              {row.opsHint}
            </div>
          </td>
          <td>
            <div className="participant-list">
              {row.blockingReasons.length ? (
                row.blockingReasons.map((reason) => (
                  <StatusBadgeFromPillClass
                    key={reason.label}
                    title={reason.detail}
                    pillClass={reason.pillClass}
                  >
                    {reason.label}
                  </StatusBadgeFromPillClass>
                ))
              ) : (
                <StatusBadge tone="success">Clear</StatusBadge>
              )}
            </div>
            <div className="muted admin-mt-6">
              {row.blockingActionSummary}
            </div>
          </td>
          <td>
            <div>{row.transferRef || '-'}</div>
            <div className="muted">{row.notes}</div>
          </td>
          <td>
            <div>{row.earningCount} item(s)</div>
            <div className="muted">{row.earningsHint}</div>
            <div className="participant-list admin-mt-8">
              {row.serviceEvidencePills.map((item) => (
                <StatusBadge key={`${row.id}-${item.key}`} tone="info">
                  {item.label}: <MoneyText amount={item.amount} currency={item.currency} />
                </StatusBadge>
              ))}
            </div>
          </td>
          <td>
            <div className="participant-list">
              {row.checklist.map((item) => (
                <StatusBadge key={item.label} title={item.detail} tone={item.ok ? 'success' : 'warning'}>
                  {item.label}
                </StatusBadge>
              ))}
            </div>
            <div className="muted admin-mt-6">
              {row.readinessSummary}
            </div>
          </td>
          <td>
            <MoneyText amount={row.totalAmount} currency={row.currency} />
          </td>
          <td>
            <div>
              <MoneyText amount={row.withholdingAmount} currency={row.currency} />
            </div>
            <div className="muted">{row.taxLogCount} tax log(s)</div>
          </td>
          <td>
            <DateTimeText fallback="-" value={row.paidAt} />
            <div className="muted">{row.paidAtRelativeLabel}</div>
          </td>
          <td>
            <AdminNotePanel className="admin-mb-10">
              <strong>Payout action execution map</strong>
              <AdminStageList className="admin-mt-8">
                {row.actionExecutionItems.map((item) => (
                  <AdminStageItem key={`${row.id}-${item.action}`}>
                    <StatusBadgeFromPillClass pillClass={item.pillClass}>
                      {item.status}
                    </StatusBadgeFromPillClass>
                    <div>
                      <strong>{item.action}</strong>
                      <p className="muted">{item.reason}</p>
                      <small>{item.operatorRule}</small>
                    </div>
                  </AdminStageItem>
                ))}
              </AdminStageList>
            </AdminNotePanel>
            <AdminActionsForm action={updateTransferRefAction}>
              <input type="hidden" name="payoutBatchId" value={row.id} />
              <AdminFormInput
                defaultValue={row.transferRef}
                label="Transfer reference"
                name="transferRef"
                placeholder="Bank ref"
              />
              <AdminFormInput defaultValue={row.notes} label="Transfer notes" name="notes" placeholder="Notes" />
              <AdminFormControlButton className="button-primary" type="submit">
                Save
              </AdminFormControlButton>
            </AdminActionsForm>
            <div className="actions admin-mt-8">
              <ActionMenu actions={row.actionMenuItems} label={`Payout actions for ${row.shortId}`} />
              {row.payoutHold ? (
                <StatusBadgeLink href={row.partnerChecksHref} tone="danger">
                  Open partner checks
                </StatusBadgeLink>
              ) : null}
              {row.paidBlockedByReleaseCheck ? (
                <StatusBadge tone="warning">Resolve blockers before paid</StatusBadge>
              ) : null}
              {row.statusLabel === 'Paid' || row.statusLabel === 'Cancelled' ? (
                <AdminInlineFallback>No status action</AdminInlineFallback>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
