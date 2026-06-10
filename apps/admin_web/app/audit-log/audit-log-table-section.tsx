import Link from 'next/link';

import { AdminDataTable } from '../../components/admin-data-table';

export type AuditLogMetadataHighlight = {
  readonly className: string;
  readonly label: string;
};

export type AuditLogTableRow = {
  readonly actionLabel: string;
  readonly actorLabel: string;
  readonly bucketClassName: string;
  readonly bucketLabel: string;
  readonly createdAtLabel: string;
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
            <div>{row.createdAtLabel}</div>
            <div className="muted">{row.relativeTimeLabel}</div>
          </td>
          <td>
            <div style={{ marginBottom: 6 }}>{row.actionLabel}</div>
            <span className={row.bucketClassName}>{row.bucketLabel}</span>
          </td>
          <td>{row.actorLabel}</td>
          <td>
            <div>{row.shortTargetLabel}</div>
            <div className="muted">{row.targetLabel}</div>
          </td>
          <td>
            <Link className="pill pill-info" href={row.relatedBoardHref}>
              {row.relatedBoardLabel}
            </Link>
            <div className="muted" style={{ marginTop: 6 }}>
              {row.priorityLabel}
            </div>
          </td>
          <td>
            <div>{row.opsHint}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {row.opsDetail}
            </div>
          </td>
          <td>
            {row.metadataHighlights.length > 0 ? (
              <div className="participant-list" style={{ marginBottom: 8 }}>
                {row.metadataHighlights.map((item, index) => (
                  <span className={item.className} key={`${item.label}-${index}`}>
                    {item.label}
                  </span>
                ))}
              </div>
            ) : null}
            <pre
              style={{
                color: '#475569',
                fontSize: 12,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {row.metadataPreview}
            </pre>
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
