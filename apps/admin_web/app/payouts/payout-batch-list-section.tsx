import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutBatchListSectionProps = {
  readonly rows: readonly PayoutBatchTableRow[];
  readonly updateTransferRefAction: FormAction;
};

export function PayoutBatchListSection({ rows, updateTransferRefAction }: PayoutBatchListSectionProps) {
  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <p className="muted">
            Partner settlement batches ordered so unresolved money movement stays at the top.
          </p>
        </div>
        <div className="participant-list">
          <span className="pill pill-success">Newest active first</span>
          <span className="pill pill-info">Payout record</span>
          <span className="pill pill-warn">Reconciliation</span>
          <a className="pill" href="/earnings">
            Review earnings
          </a>
        </div>
      </div>

      <PayoutBatchTable rows={rows} updateTransferRefAction={updateTransferRefAction} />
    </div>
  );
}
