import { ActionMenu } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { DateTimeText } from '../../components/date-time-text';
import {
  AdminSignal,
  StatusBadge,
  adminSignalToneFromClassName,
  type StatusBadgeTone,
} from '../../components/status-badge';

export type AuditLogMetadataHighlight = {
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export type AuditLogTableRow = {
  readonly actionLabel: string;
  readonly actorLabel: string;
  readonly bucketClassName: string;
  readonly bucketLabel: string;
  readonly createdAt: string | null;
  readonly id: string;
  readonly metadataHighlights: readonly AuditLogMetadataHighlight[];
  readonly metadataPreview: string;
  readonly opsDetail: string;
  readonly opsHint: string;
  readonly priorityLabel: string;
  readonly relatedBoardHref: string;
  readonly relatedBoardLabel: string;
  readonly relativeTimeLabel: string;
  readonly shortTargetLabel: string;
  readonly targetLabel: string;
};

type AuditLogTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly AuditLogTableRow[];
};

export function AuditLogTableSection({ emptyMessage, rows }: AuditLogTableSectionProps) {
  return (
    <AdminDataTable
      emptyMessage={emptyMessage}
      headers={['When', 'Action', 'Actor', 'Target', 'Related board', 'Ops record', 'Metadata']}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          <td>
            <div>
              <DateTimeText value={row.createdAt} />
            </div>
            <div className="muted">{row.relativeTimeLabel}</div>
          </td>
          <td>
            <div className="admin-mb-6">{row.actionLabel}</div>
            <AdminSignal className={row.bucketClassName} tone={adminSignalToneFromClassName(row.bucketClassName)}>
              {row.bucketLabel}
            </AdminSignal>
          </td>
          <td>{row.actorLabel}</td>
          <td>
            <div>{row.shortTargetLabel}</div>
            <div className="muted">{row.targetLabel}</div>
          </td>
          <td>
            <ActionMenu
              actions={[
                {
                  href: row.relatedBoardHref,
                  kind: 'link',
                  label: row.relatedBoardLabel,
                  tone: 'info',
                },
              ]}
              label={`${row.id} related board actions`}
            />
            <div className="muted admin-mt-6">{row.priorityLabel}</div>
          </td>
          <td>
            <div>{row.opsHint}</div>
            <div className="muted admin-mt-6">{row.opsDetail}</div>
          </td>
          <td>
            {row.metadataHighlights.length > 0 ? (
              <AdminFilterChipGroup ariaLabel={`${row.id} metadata highlights`} className="admin-mb-8">
                {row.metadataHighlights.map((item, index) => (
                  <StatusBadge tone={item.tone} key={`${item.label}-${index}`}>
                    {item.label}
                  </StatusBadge>
                ))}
              </AdminFilterChipGroup>
            ) : null}
            <pre className="admin-pre-wrap">{row.metadataPreview}</pre>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
