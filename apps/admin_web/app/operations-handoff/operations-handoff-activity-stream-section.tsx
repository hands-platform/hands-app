import Link from 'next/link';
import { Download, ExternalLink, FileClock, MessageSquare } from 'lucide-react';
import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import type { ActivityStreamRow } from './operations-handoff-activity-stream';

type OperationsHandoffActivityStreamSectionProps = {
  readonly csvHref: string;
  readonly rows: readonly ActivityStreamRow[];
};

const ACTIVITY_STREAM_HEADERS = ['When', 'Area', 'Record', 'Summary', 'Continue'] as const;

export function OperationsHandoffActivityStreamSection({
  csvHref,
  rows,
}: OperationsHandoffActivityStreamSectionProps) {
  return (
    <AdminSection
      actions={
        <div className="actions">
          <a
            className="button button-secondary"
            download="hands-operations-handoff-activity.csv"
            href={csvHref}
          >
            <Download aria-hidden="true" size={16} />
            Export activity CSV
          </a>
          <Link className="button button-secondary" href="/audit-log">
            <FileClock aria-hidden="true" size={16} />
            Audit trail
          </Link>
          <Link className="button button-secondary" href="/chat-archive">
            <MessageSquare aria-hidden="true" size={16} />
            Chat archive
          </Link>
        </div>
      }
      className="admin-mb-16 operations-handoff-activity-stream-card"
      description="Recent booking movement, chat archive messages, operator notes, notification failures, and finance rows in one chronological trail."
      title="Unified activity stream"
    >
      <div className="admin-table-scroll">
        <AdminDataTable
          emptyMessage="No recent activity stream rows."
          headers={ACTIVITY_STREAM_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <div>{relativeTime(item.createdAt)}</div>
                <small className="muted">{formatDateTime(item.createdAt)}</small>
              </td>
              <td>
                <span className={item.className}>{item.area}</span>
              </td>
              <td>
                <div>{item.record}</div>
                <small className="muted">{item.source}</small>
              </td>
              <td>{item.summary}</td>
              <td>
                <Link className="button button-secondary admin-inline-action" href={item.href}>
                  <ExternalLink aria-hidden="true" size={14} />
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </div>
    </AdminSection>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
