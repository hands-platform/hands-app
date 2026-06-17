import Link from 'next/link';
import { Download, FileClock, MessageSquare } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import type { ActivityStreamRow } from './operations-handoff-activity-stream';

type OperationsHandoffActivityStreamSectionProps = {
  readonly csvHref: string;
  readonly rows: readonly ActivityStreamRow[];
};

export function OperationsHandoffActivityStreamSection({
  csvHref,
  rows,
}: OperationsHandoffActivityStreamSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Unified activity stream</h2>
          <p className="muted">
            Recent booking movement, chat archive messages, operator notes, notification failures, and
            finance rows in one chronological trail.
          </p>
        </div>
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
      </div>
      <div className="admin-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Area</th>
              <th>Record</th>
              <th>Summary</th>
              <th>Continue</th>
            </tr>
          </thead>
          <tbody>
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
                  <Link className="text-link" href={item.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No recent activity stream rows.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
