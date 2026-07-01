import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';

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
  readonly reason: string;
  readonly status: string;
};

export type PayoutBatchServiceEvidencePill = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export type PayoutBatchTableRow = {
  readonly actionExecutionItems: readonly PayoutBatchActionExecutionItem[];
  readonly actionMenuItems: readonly ActionMenuItem[];
  readonly blockingActionSummary: string;
  readonly blockingReasons: readonly PayoutBatchBlockingReason[];
  readonly checklist: readonly PayoutBatchChecklistItem[];
  readonly earningCount: number;
  readonly earningsHint: string;
  readonly id: string;
  readonly notes: string;
  readonly opsHint: string;
  readonly opsSignal: string;
  readonly opsSignalClassName: string;
  readonly paidAtLabel: string;
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
  readonly totalAmountLabel: string;
  readonly transferRef: string;
  readonly updatedLabel: string;
  readonly withholdingAmountLabel: string;
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
                <span className="pill pill-danger">Payout hold</span>
              </div>
            ) : null}
          </td>
          <td>
            <div>{row.statusLabel}</div>
            <div className="muted">{row.phase}</div>
          </td>
          <td>
            <span className={row.opsSignalClassName}>{row.opsSignal}</span>
            <div className="muted admin-mt-6">
              {row.opsHint}
            </div>
          </td>
          <td>
            <div className="participant-list">
              {row.blockingReasons.length ? (
                row.blockingReasons.map((reason) => (
                  <span className={`pill ${reason.pillClass}`} key={reason.label} title={reason.detail}>
                    {reason.label}
                  </span>
                ))
              ) : (
                <span className="pill pill-success">Clear</span>
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
                <span className="pill pill-info" key={`${row.id}-${item.key}`}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          </td>
          <td>
            <div className="participant-list">
              {row.checklist.map((item) => (
                <span className={item.ok ? 'pill pill-success' : 'pill pill-warn'} key={item.label} title={item.detail}>
                  {item.label}
                </span>
              ))}
            </div>
            <div className="muted admin-mt-6">
              {row.readinessSummary}
            </div>
          </td>
          <td>{row.totalAmountLabel}</td>
          <td>
            <div>{row.withholdingAmountLabel}</div>
            <div className="muted">{row.taxLogCount} tax log(s)</div>
          </td>
          <td>
            <div>{row.paidAtLabel}</div>
            <div className="muted">{row.paidAtRelativeLabel}</div>
          </td>
          <td>
            <div className="ops-task-note admin-mb-10">
              <strong>Payout action execution map</strong>
              <div className="setup-stage-list admin-mt-8">
                {row.actionExecutionItems.map((item) => (
                  <div className="setup-stage-item" key={`${row.id}-${item.action}`}>
                    <span className={`pill ${item.pillClass}`}>{item.status}</span>
                    <div>
                      <strong>{item.action}</strong>
                      <p className="muted">{item.reason}</p>
                      <small>{item.operatorRule}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <form className="actions" action={updateTransferRefAction}>
              <input type="hidden" name="payoutBatchId" value={row.id} />
              <AdminFormInput
                defaultValue={row.transferRef}
                label="Transfer reference"
                name="transferRef"
                placeholder="Bank ref"
              />
              <AdminFormInput defaultValue={row.notes} label="Transfer notes" name="notes" placeholder="Notes" />
              <AdminFormControlButton className="btn btn-primary" type="submit">
                Save
              </AdminFormControlButton>
            </form>
            <div className="actions admin-mt-8">
              <ActionMenu actions={row.actionMenuItems} label={`Payout actions for ${row.shortId}`} />
              {row.payoutHold ? (
                <a className="pill pill-danger" href={row.partnerChecksHref}>
                  Open partner checks
                </a>
              ) : null}
              {row.paidBlockedByReleaseCheck ? (
                <span className="pill pill-warn">Resolve blockers before paid</span>
              ) : null}
              {row.statusLabel === 'Paid' || row.statusLabel === 'Cancelled' ? (
                <span className="muted">No status action</span>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
