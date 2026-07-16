import { Download, ExternalLink, FileClock, MessageSquare } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { formatRelativeTime } from '../../lib/admin-format';
import type { ActivityStreamRow } from './operations-handoff-activity-stream';
import {
  OperationsHandoffPaginationFooter,
  type OperationsHandoffPagination,
  paginateOperationsHandoffRows,
} from './operations-handoff-pagination';

type OperationsHandoffActivityStreamSectionProps = {
  readonly csvHref: string;
  readonly pagination: OperationsHandoffPagination;
  readonly rows: readonly ActivityStreamRow[];
};

const ACTIVITY_STREAM_HEADERS = ['When', 'Area', 'Record', 'Summary', 'Review reason', 'Continue'] as const;

export function OperationsHandoffActivityStreamSection({
  csvHref,
  pagination,
  rows,
}: OperationsHandoffActivityStreamSectionProps) {
  const pagedRows = paginateOperationsHandoffRows(rows, pagination.activePage);

  return (
    <AdminSection
      actions={
        <div className="actions">
          <AdminFormControlLink
            className="button-secondary"
            download="hands-operations-history-activity.csv"
            href={csvHref}
          >
            <Download aria-hidden="true" size={16} />
            Export visible rows
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/audit-log">
            <FileClock aria-hidden="true" size={16} />
            Audit trail
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/bookings?view=chat">
            <MessageSquare aria-hidden="true" size={16} />
            Booking chats
          </AdminFormControlLink>
        </div>
      }
      className="admin-mb-16 operations-handoff-activity-stream-card"
      description="Recent booking movement, chat archive messages, operator notes, notification failures, and finance rows in one chronological trail."
      id="operations-handoff-activity-stream"
      title="Unified activity stream"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No recent activity stream rows."
          headers={ACTIVITY_STREAM_HEADERS}
          rowCount={pagedRows.rows.length}
        >
          {pagedRows.rows.map((item) => (
            <tr key={item.id}>
              <td>
                <div>{relativeTime(item.createdAt)}</div>
                <DateTimeText value={item.createdAt} />
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
                <small className="muted">{item.reviewReason}</small>
              </td>
              <td>
                <AdminFormControlLink className="button-secondary admin-inline-action" href={item.href}>
                  <ExternalLink aria-hidden="true" size={14} />
                  Open
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
        <OperationsHandoffPaginationFooter
          from={pagedRows.from}
          pagination={pagination}
          to={pagedRows.to}
          totalPages={pagedRows.totalPages}
        />
      </AdminTableScroll>
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
