import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';

export type ReviewTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly commentLabel: string;
  readonly customerLabel: string;
  readonly customerPhone: string;
  readonly id: string;
  readonly opsHint: string;
  readonly opsSignal: string;
  readonly providerHint: string;
  readonly providerLabel: string;
  readonly reportReasonLabel: string;
  readonly shortIdLabel: string;
  readonly signalClassName: string;
  readonly statusLabel: string;
  readonly statusMeaning: string;
};

type ReviewsTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly ReviewTableRow[];
};

export function ReviewsTableSection({ emptyMessage, rows }: ReviewsTableSectionProps) {
  return (
    <AdminDataTable
      emptyMessage={emptyMessage}
      headers={['Feedback', 'Partner', 'Customer', 'Status', 'Ops record', 'Comment', 'Action']}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          <td>
            <div>Feedback record</div>
            <div className="muted admin-mt-6">
              {row.shortIdLabel}
            </div>
          </td>
          <td>
            <div>{row.providerLabel}</div>
            <div className="muted">{row.providerHint}</div>
          </td>
          <td>
            <div>{row.customerLabel}</div>
            <div className="muted">{row.customerPhone}</div>
          </td>
          <td>
            <div>{row.statusLabel}</div>
            <div className="muted">{row.statusMeaning}</div>
          </td>
          <td>
            <span className={row.signalClassName}>{row.opsSignal}</span>
            <div className="muted admin-mt-6">
              {row.opsHint}
            </div>
          </td>
          <td>
            <div>{row.commentLabel}</div>
            <div className="muted admin-mt-6">
              {row.reportReasonLabel}
            </div>
          </td>
          <td>
            <ActionMenu actions={row.actions} label={row.actionLabel} />
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
