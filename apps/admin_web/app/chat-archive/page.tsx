import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Filter, MessageSquare, RefreshCw, ShieldCheck, X } from 'lucide-react';

import { AdminTablePaginationFooter } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState } from '../../components/admin-surface';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { type AdminChatArchiveMessage, adminGetResult } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { shortId, shortRecordId } from '../../lib/admin-format';
import { ChatArchiveDateRangeFields } from './chat-archive-date-range-fields';
import {
  buildChatArchiveLoadPlan,
  CHAT_ARCHIVE_QUERY_MAX_LENGTH,
  type ChatArchiveDateFilters,
  type ChatArchiveFilters,
} from './chat-archive-page-model';

type ChatArchiveSearchParams = Promise<Record<string, string | string[] | undefined>>;

type ChatArchiveSummary = {
  readonly generatedAt?: string;
  readonly latestMessageAt?: string | null;
  readonly matchingMessages?: number;
  readonly roomsRepresented?: number;
};

export default async function ChatArchivePage({ searchParams }: { searchParams?: ChatArchiveSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const plan = buildChatArchiveLoadPlan(params);

  if (plan.needsCanonicalFilterRedirect || plan.needsCanonicalPageRedirect) {
    redirect(plan.archivePageHref(1));
  }

  const [summaryResult, messagesResult] = await Promise.all([
    plan.archiveSummaryHref
      ? adminGetResult<ChatArchiveSummary>(plan.archiveSummaryHref, {})
      : Promise.resolve(null),
    plan.archiveHref
      ? adminGetResult<AdminChatArchiveMessage[]>(plan.archiveHref, [])
      : Promise.resolve(null),
  ]);
  const matchingMessages = summaryResult?.ok
    ? nonNegativeInteger(summaryResult.data.matchingMessages)
    : null;
  const totalPages = matchingMessages === null
    ? 1
    : Math.max(1, Math.ceil(matchingMessages / plan.archivePageSize));

  if (summaryResult?.ok && plan.activePage > totalPages) {
    redirect(plan.archivePageHref(totalPages));
  }

  const messages = messagesResult?.ok ? messagesResult.data : [];
  const visibleFrom = messages.length > 0 ? (plan.activePage - 1) * plan.archivePageSize + 1 : 0;
  const visibleTo = messages.length > 0 ? visibleFrom + messages.length - 1 : 0;
  const hasFilters = Boolean(
    plan.filters.q ||
      plan.filters.sender ||
      plan.filters.status ||
      plan.dateFilters.range !== 'all' ||
      plan.filters.sort !== 'newest',
  );

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href="/audit-log?bucket=Booking">
          <MessageSquare aria-hidden="true" size={16} />
          Booking audit log
        </AdminFormControlLink>
      }
      contentClassName="chat-archive-page"
      description="Search retained booking messages across customers and Partners."
      title="Chat Evidence Search"
    >
      <div className="chat-evidence-trust-line" role="status">
        <ShieldCheck aria-hidden="true" size={18} />
        <strong>Restricted internal evidence · Read only</strong>
        <span>Open a booking transcript for complete context.</span>
      </div>

      <AdminFilterPanel
        className="chat-archive-filter-panel admin-mb-16"
        resultLabel={
          plan.validationError ? 'Search not run' : messagesResult?.ok === false ? 'Search unavailable' : undefined
        }
        resultTone="danger"
        title="Search retained messages"
      >
        <AdminFormGrid action="/chat-archive" className="chat-evidence-filter-grid" key={plan.currentHref}>
          <AdminFormSearch
            className="admin-directory-filter-search"
            defaultValue={plan.filters.q}
            label="Search messages and records"
            labelVisibility="visible"
            maxLength={CHAT_ARCHIVE_QUERY_MAX_LENGTH}
            name="q"
            placeholder="Message, booking, room, customer, Partner"
          />
          <AdminFormSelect
            defaultValue={plan.filters.status}
            label="Booking status"
            labelVisibility="visible"
            name="status"
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Active or matching', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Canceled, expired, or refunded', value: 'closed' },
            ]}
          />
          <AdminFormSelect
            defaultValue={plan.filters.sender}
            label="Message sender"
            labelVisibility="visible"
            name="sender"
            options={[
              { label: 'All senders', value: '' },
              { label: 'Customer', value: 'customer' },
              { label: 'Partner', value: 'partner' },
              { label: 'Admin', value: 'admin' },
            ]}
          />
          <ChatArchiveDateRangeFields
            initialFrom={plan.dateFilters.from}
            initialRange={plan.dateFilters.range}
            initialTo={plan.dateFilters.to}
            validationError={plan.validationError}
          />
          <AdminFormSelect
            defaultValue={plan.filters.sort}
            label="Sort"
            labelVisibility="visible"
            name="sort"
            options={[
              { label: 'Newest sent', value: 'newest' },
              { label: 'Oldest sent', value: 'oldest' },
            ]}
          />
          <AdminFormActionRow className="actions" wide={false}>
            <AdminFormControlButton className="button-primary" type="submit">
              <Filter aria-hidden="true" size={16} />
              Apply filters
            </AdminFormControlButton>
            {hasFilters ? (
              <AdminFormControlLink className="button-secondary" href="/chat-archive">
                <X aria-hidden="true" size={16} />
                Clear filters
              </AdminFormControlLink>
            ) : null}
          </AdminFormActionRow>
        </AdminFormGrid>
        {plan.validationError ? (
          <p className="chat-evidence-filter-error" id="chat-archive-date-error" role="alert">
            {plan.validationError}
          </p>
        ) : null}
        <AdminFilterSummary
          ariaLabel="Active chat evidence filters"
          labels={buildActiveFilterLabels(plan.filters, plan.dateFilters)}
          tone="info"
        />
      </AdminFilterPanel>

      <AdminTableSection
        className="admin-mb-16 chat-evidence-results-section"
        description={chatArchiveResultsDescription(plan.validationError, summaryResult)}
        statusLabel={chatArchiveResultsStatus(plan.validationError, summaryResult)}
        statusTone={plan.validationError || summaryResult?.ok === false ? 'danger' : 'info'}
        title="Matching messages"
      >
        {plan.validationError ? (
          <AdminEmptyState
            framed
            message="Correct the custom From and To dates, then apply the filters again."
            title="Search not run"
          />
        ) : messagesResult?.ok === false ? (
          <AdminErrorState
            action={
              <AdminFormControlLink className="button-secondary" href={plan.currentHref}>
                <RefreshCw aria-hidden="true" size={16} />
                Retry search
              </AdminFormControlLink>
            }
            message={chatArchiveListErrorMessage(messagesResult.status)}
            title="Chat evidence could not be loaded"
          />
        ) : messages.length === 0 ? (
          <AdminEmptyState
            framed
            message={
              hasFilters
                ? 'No messages match the current search and filters. A missing result does not confirm that no conversation occurred.'
                : 'No retained booking messages are available in this scope. A missing result does not confirm that no conversation occurred.'
            }
            title={hasFilters ? 'No matching messages' : 'No retained messages'}
          />
        ) : (
          <div aria-label="Matching chat messages" className="chat-evidence-results" role="table">
            <div className="chat-evidence-result chat-evidence-result-header" role="row">
              <span role="columnheader">Sent</span>
              <span role="columnheader">Matching message</span>
              <span role="columnheader">People</span>
              <span role="columnheader">Booking</span>
              <span role="columnheader">Open transcript</span>
            </div>
            {messages.map((message) => (
              <ChatEvidenceResult
                currentHref={plan.currentHref}
                key={message.id}
                message={message}
                query={plan.filters.q}
              />
            ))}
          </div>
        )}

        {summaryResult?.ok && matchingMessages !== null ? (
          <AdminTablePaginationFooter
            activePage={plan.activePage}
            ariaLabel="Chat evidence pages"
            from={visibleFrom}
            hrefForPage={plan.archivePageHref}
            itemLabel="messages"
            paginationClassName="admin-mt-16"
            to={visibleTo}
            totalPages={totalPages}
            totalRows={matchingMessages}
          />
        ) : null}
      </AdminTableSection>
    </AdminPageTemplate>
  );
}

function ChatEvidenceResult({
  currentHref,
  message,
  query,
}: {
  readonly currentHref: string;
  readonly message: AdminChatArchiveMessage;
  readonly query: string;
}) {
  const booking = message.chatRoom.booking;
  const partner = booking.selectedProvider ?? booking.preferredProvider;
  const role = senderRole(message.sender?.roles);
  const senderName = partnerDisplayText(message.sender?.fullName ?? role);
  const customerName = booking.customerProfile?.user?.fullName ?? `Customer ${shortId(booking.customerProfileId)}`;
  const partnerName = partnerDisplayText(
    partner?.displayName ?? partner?.user?.fullName ?? (partner?.id ? `Partner ${shortId(partner.id)}` : 'No Partner'),
  );
  const transcriptHref = `/bookings/${booking.id}?overview=activity&returnTo=${encodeURIComponent(currentHref)}#booking-chat-history`;

  return (
    <div className="chat-evidence-result" role="row">
      <div className="chat-evidence-sent" role="cell">
        <span className="chat-evidence-cell-label">Sent</span>
        <DateTimeText value={message.createdAt} />
        <StatusBadgeFromPillClass pillClass="pill-neutral">{role}</StatusBadgeFromPillClass>
      </div>
      <div className="chat-evidence-message" role="cell">
        <span className="chat-evidence-cell-label">Matching message</span>
        <p className="chat-evidence-message-body">
          {highlightChatEvidenceText(message.body || 'Attachment-only message', query)}
        </p>
        <span className="chat-evidence-message-sender muted">
          Sent by {highlightChatEvidenceText(senderName, query)}
        </span>
        <span className="muted">
          Room {highlightChatEvidenceText(shortId(message.chatRoom.id), query)} · Message{' '}
          {highlightChatEvidenceText(shortId(message.id), query)}
          {message.attachmentCount > 0 ? ` · Attachment ${message.attachmentCount}` : ''}
        </span>
      </div>
      <div className="chat-evidence-people" role="cell">
        <span className="chat-evidence-cell-label">People</span>
        {booking.customerProfileId ? (
          <Link className="table-link" href={`/customers/${booking.customerProfileId}`} prefetch={false}>
            {highlightChatEvidenceText(customerName, query)}
          </Link>
        ) : <span>{highlightChatEvidenceText(customerName, query)}</span>}
        {partner?.id ? (
          <Link className="table-link" href={`/partners/${partner.id}`} prefetch={false}>
            {highlightChatEvidenceText(partnerName, query)}
          </Link>
        ) : <span className="muted">{highlightChatEvidenceText(partnerName, query)}</span>}
      </div>
      <div className="chat-evidence-booking" role="cell">
        <span className="chat-evidence-cell-label">Booking</span>
        <span
          aria-label={`Booking ${booking.id}`}
          className="chat-evidence-booking-id"
          title={`Booking ${booking.id}`}
        >
          {highlightChatEvidenceText(shortRecordId(booking.id), query)}
        </span>
        <StatusBadgeFromPillClass pillClass={statusPillClass(booking.status)}>
          {booking.status}
        </StatusBadgeFromPillClass>
        <span className="muted">{highlightChatEvidenceText(bookingServiceLabel(booking), query)}</span>
      </div>
      <div className="chat-evidence-open" role="cell">
        <span className="chat-evidence-cell-label">Open transcript</span>
        <AdminFormControlLink className="button-secondary chat-inline-action" href={transcriptHref}>
          <MessageSquare aria-hidden="true" size={15} />
          Open transcript
        </AdminFormControlLink>
      </div>
    </div>
  );
}

function buildActiveFilterLabels(filters: ChatArchiveFilters, dates: ChatArchiveDateFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.sender) labels.push(`Sender: ${senderFilterLabel(filters.sender)}`);
  if (filters.status) labels.push(`Booking: ${statusFilterLabel(filters.status)}`);
  if (dates.range !== 'all') labels.push(`Sent: ${dates.label}`);
  if (filters.sort === 'oldest') labels.push('Sort: Oldest first');
  return labels;
}

function chatArchiveResultsStatus(
  validationError: string | null,
  result: Awaited<ReturnType<typeof adminGetResult<ChatArchiveSummary>>> | null,
) {
  if (validationError) return 'Search not run';
  if (!result) return undefined;
  if (!result.ok) return 'Summary unavailable';
  const messages = nonNegativeInteger(result.data.matchingMessages);
  const rooms = nonNegativeInteger(result.data.roomsRepresented);
  return `${messages} ${messages === 1 ? 'message' : 'messages'} · ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
}

function chatArchiveResultsDescription(
  validationError: string | null,
  result: Awaited<ReturnType<typeof adminGetResult<ChatArchiveSummary>>> | null,
) {
  if (validationError) return 'No API request was sent.';
  if (!result) return undefined;
  if (!result.ok) return 'Rows may still be available. Retry before relying on totals.';
  return (
    <>
      Latest matching message: <DateTimeText fallback="none retained" value={result.data.latestMessageAt} />
    </>
  );
}

function highlightChatEvidenceText(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match = lowerText.indexOf(lowerNeedle);

  while (match >= 0) {
    if (match > cursor) parts.push(text.slice(cursor, match));
    const end = match + needle.length;
    parts.push(<mark key={`${match}-${end}`}>{text.slice(match, end)}</mark>);
    cursor = end;
    match = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function chatArchiveListErrorMessage(status: number | null) {
  if (status === 403) return 'Your operator account does not have Booking Detail access.';
  if (status === 400) return 'The search filters were rejected. Check the date range and try again.';
  return 'The message search failed. Retry before using this page for an evidence decision.';
}

function statusFilterLabel(status: string) {
  if (status === 'active') return 'Active or matching';
  if (status === 'completed') return 'Completed';
  if (status === 'closed') return 'Canceled, expired, or refunded';
  return status;
}

function senderFilterLabel(sender: string) {
  if (sender === 'customer') return 'Customer';
  if (sender === 'partner') return 'Partner';
  if (sender === 'admin') return 'Admin';
  return sender;
}

function senderRole(roles: string[] | undefined) {
  if (roles?.includes('CUSTOMER')) return 'Customer';
  if (roles?.includes('PROVIDER')) return 'Partner';
  if (roles?.includes('ADMIN')) return 'Admin';
  return 'System';
}

function bookingServiceLabel(booking: AdminChatArchiveMessage['chatRoom']['booking']) {
  const service = booking.services?.[0]?.service;
  if (!service) return 'Service not recorded';
  return `${service.name ?? 'Service'}${service.durationMin ? ` · ${service.durationMin} min` : ''}`;
}

function statusPillClass(status: string) {
  if (status === 'COMPLETED') return 'pill-success';
  if (['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status)) {
    return 'pill-info';
  }
  if (['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(status)) return 'pill-warn';
  return 'pill-neutral';
}

function nonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
