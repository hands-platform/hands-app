import { Download, ExternalLink, FileClock, MessageSquare } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminQueueAgeSortControls } from '../../components/admin-queue-age-sort-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';
import { formatRelativeTime } from '../../lib/admin-format';
import type { AdminQueueAge, AdminQueueSort } from '../../lib/admin-queue-list';
import type { ActivityStreamRow } from './operations-handoff-activity-stream';
import {
  OPERATIONS_HANDOFF_ACTIVITY_REVIEW_OPTIONS,
  OPERATIONS_HANDOFF_ACTIVITY_BACKLOG_OPTIONS,
  OPERATIONS_HANDOFF_ACTIVITY_SOURCE_OPTIONS,
  type OperationsHandoffActivityBacklog,
  operationsHandoffActivityReasonOptions,
  type OperationsHandoffActivityReason,
  type OperationsHandoffActivityReasonCounts,
  type OperationsHandoffActivityReview,
  type OperationsHandoffActivitySource,
} from './operations-handoff-page-model';
import {
  OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
  OperationsHandoffPaginationFooter,
  type OperationsHandoffPagination,
} from './operations-handoff-pagination';

type OperationsHandoffActivityStreamSectionProps = {
  readonly activeAge: AdminQueueAge;
  readonly activeBacklog: OperationsHandoffActivityBacklog;
  readonly activeReason: OperationsHandoffActivityReason;
  readonly activeReview: OperationsHandoffActivityReview;
  readonly activeSort: AdminQueueSort;
  readonly activeSource: OperationsHandoffActivitySource;
  readonly csvHref: string;
  readonly hrefForAge: (age: AdminQueueAge) => string;
  readonly hrefForBacklog: (backlog: OperationsHandoffActivityBacklog) => string;
  readonly hrefForOver24h: (reason: OperationsHandoffActivityReason) => string;
  readonly hrefForReason: (reason: OperationsHandoffActivityReason) => string;
  readonly hrefForReview: (review: OperationsHandoffActivityReview) => string;
  readonly hrefForSort: (sort: AdminQueueSort) => string;
  readonly hrefForSource: (source: OperationsHandoffActivitySource) => string;
  readonly pagination: OperationsHandoffPagination;
  readonly backlogCounts: {
    readonly all: number;
    readonly current: number;
    readonly legacy: number;
  };
  readonly over24hCounts: OperationsHandoffActivityReasonCounts;
  readonly reasonCounts: OperationsHandoffActivityReasonCounts;
  readonly rows: readonly ActivityStreamRow[];
};

const ACTIVITY_STREAM_HEADERS = ['When', 'Area', 'Record', 'Summary', 'Review reason', 'Continue'] as const;

export function OperationsHandoffActivityStreamSection({
  activeAge,
  activeBacklog,
  activeReason,
  activeReview,
  activeSort,
  activeSource,
  csvHref,
  hrefForAge,
  hrefForBacklog,
  hrefForOver24h,
  hrefForReason,
  hrefForReview,
  hrefForSort,
  hrefForSource,
  pagination,
  backlogCounts,
  over24hCounts,
  reasonCounts,
  rows,
}: OperationsHandoffActivityStreamSectionProps) {
  const visibleRows = rows.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalRows / OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
  );
  const start = (pagination.activePage - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE;
  const from = visibleRows.length === 0 ? 0 : start + 1;
  const to = visibleRows.length === 0 ? 0 : start + visibleRows.length;
  const reasonOptions = operationsHandoffActivityReasonOptions(activeSource);

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
      {activeReview === 'needs-review' ? (
        <div className="booking-date-filter-bar admin-mb-12" aria-label="24h+ priority">
          <span className="payment-filter-group-label">24h+ priority</span>
          <div className="participant-list admin-filter-chip-group">
            {over24hCounts.all > 0 ? (
              <>
                <StatusBadgeLink
                  ariaCurrent={
                    activeAge === 'over-24h' && activeReason === 'all' ? 'page' : undefined
                  }
                  ariaLabel={`Open all ${over24hCounts.all} records waiting over 24 hours`}
                  href={hrefForOver24h('all')}
                  tone="warning"
                >
                  All {over24hCounts.all}
                </StatusBadgeLink>
                {reasonOptions
                  .filter(
                    (option) =>
                      option.value !== 'all' && over24hCounts[option.value] > 0,
                  )
                  .map((option) => (
                    <StatusBadgeLink
                      ariaCurrent={
                        activeAge === 'over-24h' && activeReason === option.value
                          ? 'page'
                          : undefined
                      }
                      ariaLabel={`Open ${over24hCounts[option.value]} ${option.label.toLowerCase()} records waiting over 24 hours`}
                      href={hrefForOver24h(option.value)}
                      key={option.value}
                      tone="warning"
                    >
                      {option.label} {over24hCounts[option.value]}
                    </StatusBadgeLink>
                  ))}
              </>
            ) : (
              <StatusBadge tone="success">Clear</StatusBadge>
            )}
          </div>
        </div>
      ) : null}
      <div className="admin-form-control-stack admin-mb-12">
        <span className="admin-form-label">Review</span>
        <AdminSegmentedControl
          activeValue={activeReview}
          ariaLabel="Activity review"
          options={OPERATIONS_HANDOFF_ACTIVITY_REVIEW_OPTIONS.map((option) => ({
            href: hrefForReview(option.value),
            label: option.label,
            value: option.value,
          }))}
        />
      </div>
      {activeReview === 'needs-review' ? (
        <div className="admin-form-control-stack admin-mb-12">
          <span className="admin-form-label">Queue scope</span>
          <AdminSegmentedControl
            activeValue={activeBacklog}
            ariaLabel="Activity backlog scope"
            options={OPERATIONS_HANDOFF_ACTIVITY_BACKLOG_OPTIONS.map((option) => ({
              href: hrefForBacklog(option.value),
              label: `${option.label} (${backlogCounts[option.value]})`,
              value: option.value,
            }))}
          />
        </div>
      ) : null}
      <div className="admin-form-control-stack admin-mb-12">
        <span className="admin-form-label">Source</span>
        <AdminSegmentedControl
          activeValue={activeSource}
          ariaLabel="Activity source"
          options={OPERATIONS_HANDOFF_ACTIVITY_SOURCE_OPTIONS.map((option) => ({
            href: hrefForSource(option.value),
            label: option.label,
            value: option.value,
          }))}
        />
      </div>
      {activeReview === 'needs-review' && reasonOptions.length > 1 ? (
        <div className="admin-form-control-stack admin-mb-12">
          <span className="admin-form-label">Reason</span>
          <AdminSegmentedControl
            activeValue={activeReason}
            ariaLabel="Activity review reason"
            options={reasonOptions.map((option) => ({
              href: hrefForReason(option.value),
              label: `${option.label} (${reasonCounts[option.value]})`,
              value: option.value,
            }))}
          />
        </div>
      ) : null}
      {activeReview === 'needs-review' ? (
        <AdminQueueAgeSortControls
          age={activeAge}
          ageHref={hrefForAge}
          sort={activeSort}
          sortHref={hrefForSort}
          sortOptions={
            activeReason === 'all'
              ? [
                  { label: 'Priority then oldest', value: 'oldest' },
                  { label: 'Newest first', value: 'newest' },
                ]
              : undefined
          }
        />
      ) : null}
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No recent activity stream rows."
          headers={ACTIVITY_STREAM_HEADERS}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((item) => (
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
          from={from}
          pagination={pagination}
          to={to}
          totalPages={totalPages}
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
