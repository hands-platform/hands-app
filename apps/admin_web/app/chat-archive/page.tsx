import {
  Briefcase,
  CalendarCheck,
  Download,
  Filter,
  MessageSquare,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminTableSection } from '../../components/admin-table-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { AdminBookingDetail, AdminChatMessage, adminGet } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { shortId } from '../../lib/admin-format';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { buildCsvDataHref } from '../../lib/csv-export';
import { bookingChatMessageCount } from '../bookings/booking-chat-message-count';
import {
  type DetailDateFilters,
  detailDateRangeOptions,
  isWithinDetailDateFilter,
} from '../../lib/detail-date-filter';
import {
  buildChatArchiveLoadPlan,
  type ChatArchiveFilters,
} from './chat-archive-page-model';

type ChatArchiveSearchParams = Promise<Record<string, string | string[] | undefined>>;
type ChatArchiveSenderRole = 'ADMIN' | 'CUSTOMER' | 'PROVIDER' | 'SYSTEM';

const CHAT_ARCHIVE_INDEX_HEADERS = [
  'Booking',
  'Status',
  'Customer',
  'Partner',
  'Service',
  'Messages',
  'Latest message',
  'Open',
] as const;

type ChatArchiveServerSummary = {
  readonly activeRooms?: number;
  readonly completedRooms?: number;
  readonly customerMessages?: number;
  readonly emptyRooms?: number;
  readonly generatedAt?: string;
  readonly latestMessageAt?: string | null;
  readonly messageCount?: number;
  readonly partnerMessages?: number;
  readonly totalCount?: number;
};

export default async function ChatArchivePage({ searchParams }: { searchParams?: ChatArchiveSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const {
    activePage,
    archiveHref,
    archivePageHref,
    archivePageSize,
    archiveSummaryHref,
    dateFilters,
    filters,
  } = buildChatArchiveLoadPlan(params);
  const [bookings, archiveSummaryResponse] = await Promise.all([
    adminGet<AdminBookingDetail[]>(archiveHref, []),
    adminGet<unknown>(archiveSummaryHref, null),
  ]);
  const rooms = filterChatRooms(bookings.map(buildChatRoomRow), filters, dateFilters);
  const pageSummary = buildChatArchiveSummary(rooms);
  const summary = buildChatArchiveSummaryView(archiveSummaryResponse, pageSummary, rooms.length);
  const totalRooms = summary.totalCount;
  const totalPages = Math.max(1, Math.ceil(totalRooms / archivePageSize));
  const visibleFrom = totalRooms === 0 || rooms.length === 0 ? 0 : (activePage - 1) * archivePageSize + 1;
  const visibleTo =
    totalRooms === 0 || rooms.length === 0
      ? 0
      : Math.min(totalRooms, (activePage - 1) * archivePageSize + rooms.length);
  const messageCsvHref = buildCsvDataHref(
    rooms.flatMap((room) =>
      room.messages.map((message) => ({
        booking_id: room.booking.id,
        chat_room_id: room.roomId,
        booking_status: room.booking.status,
        service: room.serviceLabel,
        customer: room.customerName,
        customer_phone: room.customerPhone,
        partner: room.partnerName,
        partner_phone: room.partnerPhone,
        sender: senderLabel(message),
        sender_role: senderRole(message),
        message: message.body,
        created_at: message.createdAt,
      })),
    ),
    [
      'booking_id',
      'chat_room_id',
      'booking_status',
      'service',
      'customer',
      'customer_phone',
      'partner',
      'partner_phone',
      'sender',
      'sender_role',
      'message',
      'created_at',
    ],
  );

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink className="button-secondary" href="/audit-log?bucket=Booking">
            <MessageSquare aria-hidden="true" size={16} />
            Audit log
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/bookings?view=chat-repair">
            <Wrench aria-hidden="true" size={16} />
            Chat repair
          </AdminFormControlLink>
        </>
      }
      contentClassName="chat-archive-page"
      description="Audit-only search for retained booking chat evidence. Day-to-day review stays inside booking, customer, and Partner detail pages; use this page when an operator needs cross-record evidence."
      metrics={[
        {
          label: 'Rooms loaded',
          value: totalRooms.toString(),
          kind: 'record',
          scope: dateFilters.label,
          helper: `${rooms.length} shown / ${dateFilters.label}`,
        },
        {
          label: 'Messages',
          value: summary.messageCount.toString(),
          kind: 'record',
          scope: dateFilters.label,
          helper: `${summary.customerMessages} customer / ${summary.partnerMessages} Partner`,
        },
        {
          label: 'Completed rooms',
          value: summary.completedRooms.toString(),
          kind: 'record',
          scope: dateFilters.label,
          helper: 'Service done',
        },
        {
          label: 'Active rooms',
          value: summary.activeRooms.toString(),
          kind: 'live',
          scope: 'Current open',
          helper: 'Open operational flow',
        },
        {
          label: 'Empty rooms',
          value: summary.emptyRooms.toString(),
          kind: 'risk',
          scope: 'Needs action',
          helper: 'Chat room exists but no message',
        },
        {
          label: 'Latest message',
          value: 'None',
          valueDateTimeFallback: 'None',
          valueDateTimeValue: summary.latestMessageAt,
          kind: 'record',
          scope: 'Latest record',
          helper: 'Newest loaded message',
        },
      ]}
      title="Chat Evidence Search"
    >

      <AdminFilterPanel
        className="chat-archive-filter-panel admin-mb-16"
        resultLabel={`${rooms.length} room(s), ${summary.messageCount} message(s)`}
        resultTone="info"
        title="Chat evidence filters"
      >
        <AdminFormGrid action="/chat-archive">
          <AdminFormSearch
            className="admin-directory-filter-search"
            defaultValue={filters.q}
            label="Search chat evidence"
            name="q"
            placeholder="Booking, room, customer, Partner, message"
          />
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={filters.status}
            label="Booking status"
            labelVisibility="visible"
            name="status"
            options={[
              { label: 'All', value: '' },
              { label: 'Active or matching', value: 'active' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled / expired / refunded', value: 'closed' },
              { label: 'Room without messages', value: 'no-message' },
            ]}
          />
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={filters.sender}
            label="Sender"
            labelVisibility="visible"
            name="sender"
            options={[
              { label: 'All', value: '' },
              { label: 'Customer messages', value: 'customer' },
              { label: 'Partner messages', value: 'partner' },
              { label: 'Admin/system messages', value: 'admin' },
            ]}
          />
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={dateFilters.range}
            label="Preset"
            labelVisibility="visible"
            name="range"
            options={detailDateRangeOptions}
          />
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={dateFilters.from}
            label="From"
            labelVisibility="visible"
            name="from"
          />
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={dateFilters.to}
            label="To"
            labelVisibility="visible"
            name="to"
          />
          <AdminFormActionRow className="actions full-span">
            <AdminFormControlButton className="button-primary" type="submit">
              <Filter aria-hidden="true" size={16} />
              Apply filters
            </AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href="/chat-archive">
              <X aria-hidden="true" size={16} />
              Clear
            </AdminFormControlLink>
            <AdminFormControlLink
              className="button-secondary"
              download="hands-chat-archive.csv"
              href={messageCsvHref}
            >
              <Download aria-hidden="true" size={16} />
              Export page preview CSV
            </AdminFormControlLink>
            <span className="muted">
              {rooms.length} room(s), {summary.messageCount} message(s)
            </span>
          </AdminFormActionRow>
        </AdminFormGrid>
        <AdminFilterSummary
          ariaLabel="Active chat evidence filters"
          labels={buildChatArchiveActiveFilterLabels(filters, dateFilters)}
          tone="info"
        />
      </AdminFilterPanel>

      <AdminTableSection
        className="admin-mb-16"
        description="One row per retained booking chat room. The list loads only the latest message timestamp; open the booking Activity workspace for the complete retained conversation."
        statusLabel={`${rooms.length} row(s)`}
        statusTone="info"
        title="Chat evidence index"
      >
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={
              <AdminEmptyState
                message="Clear filters or wait until matched bookings create chat rooms."
                title="No chat rooms found"
              />
            }
            headers={CHAT_ARCHIVE_INDEX_HEADERS}
            rowCount={rooms.length}
          >
            {rooms.map((room) => (
              <tr key={room.roomId}>
                <td>
                  <strong>{shortId(room.booking.id)}</strong>
                  <p className="muted">Room {shortId(room.roomId)}</p>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={statusPillClass(room.booking.status)}>
                    {room.booking.status}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <ChatArchivePersonCell
                    avatarStatus={room.customerAvatarStatus}
                    href={room.customerId ? `/customers/${room.customerId}#chat-history` : null}
                    label={room.customerName}
                    phone={room.customerPhone}
                  />
                </td>
                <td>
                  <ChatArchivePersonCell
                    avatarStatus={room.partnerAvatarStatus}
                    href={room.partnerId ? `/partners/${room.partnerId}#booking-chat-records` : null}
                    label={room.partnerName}
                    phone={room.partnerPhone}
                    variant="partner"
                  />
                </td>
                <td>{room.serviceLabel}</td>
                <td>{room.messageCount}</td>
                <td>
                  <DateTimeText fallback="No message" value={room.latestMessageAt} />
                </td>
                <td>
                  <div className="actions">
                    <AdminFormControlLink
                      className="button-secondary chat-inline-action"
                      href={`/bookings/${room.booking.id}?overview=activity#booking-chat-history`}
                    >
                      <MessageSquare aria-hidden="true" size={14} />
                      Chat
                    </AdminFormControlLink>
                    <AdminFormControlLink
                      className="button-secondary chat-inline-action"
                      href={`/bookings/${room.booking.id}?overview=activity#booking-chat-history`}
                    >
                      <CalendarCheck aria-hidden="true" size={14} />
                      Booking
                    </AdminFormControlLink>
                    {room.customerId ? (
                      <AdminFormControlLink
                        className="button-secondary chat-inline-action"
                        href={`/customers/${room.customerId}#chat-history`}
                      >
                        <User aria-hidden="true" size={14} />
                        Customer
                      </AdminFormControlLink>
                    ) : null}
                    {room.partnerId ? (
                      <AdminFormControlLink
                        className="button-secondary chat-inline-action"
                        href={`/partners/${room.partnerId}#booking-chat-records`}
                      >
                        <Briefcase aria-hidden="true" size={14} />
                        Partner
                      </AdminFormControlLink>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <AdminTablePaginationFooter
          activePage={activePage}
          ariaLabel="Chat evidence pages"
          from={visibleFrom}
          hrefForPage={archivePageHref}
          itemLabel="rooms"
          paginationClassName="admin-mt-16"
          to={visibleTo}
          totalPages={totalPages}
          totalRows={totalRooms}
        />
      </AdminTableSection>

    </AdminPageTemplate>
  );
}

function buildChatArchiveActiveFilterLabels(filters: ChatArchiveFilters, dateFilters: DetailDateFilters) {
  const labels = [`Date: ${dateFilters.label}`];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  if (filters.status) {
    labels.push(`Status: ${chatArchiveStatusFilterLabel(filters.status)}`);
  }
  if (filters.sender) {
    labels.push(`Sender: ${chatArchiveSenderFilterLabel(filters.sender)}`);
  }
  return labels;
}

function chatArchiveStatusFilterLabel(status: string) {
  switch (status) {
    case 'active':
      return 'Active or matching';
    case 'completed':
      return 'Completed';
    case 'closed':
      return 'Cancelled / expired / refunded';
    case 'no-message':
      return 'Room without messages';
    default:
      return status;
  }
}

function chatArchiveSenderFilterLabel(sender: string) {
  switch (sender) {
    case 'customer':
      return 'Customer messages';
    case 'partner':
      return 'Partner messages';
    case 'admin':
      return 'Admin/system messages';
    default:
      return sender;
  }
}

function buildChatArchiveSummaryView(
  value: unknown,
  fallback: ReturnType<typeof buildChatArchiveSummary>,
  fallbackTotalCount: number,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...fallback,
      totalCount: fallbackTotalCount,
    };
  }
  const summary = value as Partial<ChatArchiveServerSummary>;

  return {
    activeRooms: readChatArchiveSummaryNumber(summary.activeRooms) ?? fallback.activeRooms,
    completedRooms: readChatArchiveSummaryNumber(summary.completedRooms) ?? fallback.completedRooms,
    customerMessages: readChatArchiveSummaryNumber(summary.customerMessages) ?? fallback.customerMessages,
    emptyRooms: readChatArchiveSummaryNumber(summary.emptyRooms) ?? fallback.emptyRooms,
    latestMessageAt: summary.latestMessageAt ?? fallback.latestMessageAt,
    messageCount: readChatArchiveSummaryNumber(summary.messageCount) ?? fallback.messageCount,
    partnerMessages: readChatArchiveSummaryNumber(summary.partnerMessages) ?? fallback.partnerMessages,
    totalCount: readChatArchiveSummaryNumber(summary.totalCount) ?? fallbackTotalCount,
  };
}

function readChatArchiveSummaryNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

type ChatArchivePersonCellProps = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly href?: string | null;
  readonly label: string;
  readonly phone: string;
  readonly variant?: 'customer' | 'partner';
};

function ChatArchivePersonCell({
  avatarStatus,
  href,
  label,
  phone,
  variant = 'customer',
}: ChatArchivePersonCellProps) {
  return (
    <AdminPersonCell
      avatarClassName={`vuexy-booking-avatar${variant === 'partner' ? ' is-partner' : ''}`}
      avatarStatus={avatarStatus}
      className="vuexy-booking-person"
      helper={phone}
      href={href}
      label={label}
      linkClassName="table-link"
    />
  );
}

function filterChatRooms(
  rooms: ReturnType<typeof buildChatRoomRow>[],
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
) {
  return rooms.filter((room) => {
    const messagesInDate = room.messages.filter((message) =>
      isWithinDetailDateFilter(message.createdAt, dateFilters),
    );
    const roomInDate =
      messagesInDate.length > 0 ||
      isWithinDetailDateFilter(room.booking.createdAt, dateFilters) ||
      isWithinDetailDateFilter(room.booking.updatedAt, dateFilters);
    if (!roomInDate) return false;

    if (filters.status === 'active' && !isActiveStatus(room.booking.status)) return false;
    if (filters.status === 'completed' && room.booking.status !== 'COMPLETED') return false;
    if (filters.status === 'closed' && !isClosedStatus(room.booking.status)) return false;
    if (filters.status === 'no-message' && room.messageCount > 0) return false;
    return true;
  });
}

function buildChatRoomRow(booking: AdminBookingDetail) {
  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => dateMs(left.createdAt) - dateMs(right.createdAt),
  );
  const messageCount = bookingChatMessageCount(booking);
  const customerName =
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
  const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
  const partner = booking.selectedProvider ?? booking.preferredProvider;
  const partnerName = partnerDisplayText(
    partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'No Partner',
  );
  const partnerPhone = partner?.user?.phone ?? 'No phone';
  const serviceLabel = bookingServiceLabel(booking);
  const roomId = booking.chatRoom?.id ?? `booking-${booking.id}`;
  const latestMessageAt = messages[messages.length - 1]?.createdAt;
  const searchText = [
    booking.id,
    roomId,
    booking.status,
    booking.customerProfileId,
    customerName,
    customerPhone,
    partner?.id,
    partnerName,
    partnerPhone,
    serviceLabel,
    ...messages.map((message) => `${senderLabel(message)} ${message.body}`),
  ]
    .join(' ')
    .toLowerCase();

  return {
    booking,
    roomId,
    messages,
    customerId: booking.customerProfileId,
    customerName,
    customerPhone,
    customerAvatarStatus: bookingCustomerChatAvatarStatus(booking),
    partnerId: partner?.id,
    partnerName,
    partnerPhone,
    partnerAvatarStatus: bookingPartnerChatAvatarStatus(booking),
    serviceLabel,
    messageCount,
    latestMessageAt,
    searchText,
  };
}

function buildChatArchiveSummary(rooms: ReturnType<typeof buildChatRoomRow>[]) {
  const messages = rooms.flatMap((room) => room.messages);
  const messageCount = rooms.reduce((sum, room) => sum + room.messageCount, 0);
  const latestMessageAt = messages
    .map((message) => message.createdAt)
    .filter(Boolean)
    .sort((left, right) => dateMs(right) - dateMs(left))[0];

  return {
    messageCount,
    customerMessages: messages.filter((message) => senderRole(message) === 'CUSTOMER').length,
    partnerMessages: messages.filter((message) => senderRole(message) === 'PROVIDER').length,
    completedRooms: rooms.filter((room) => room.booking.status === 'COMPLETED').length,
    activeRooms: rooms.filter((room) => isActiveStatus(room.booking.status)).length,
    emptyRooms: rooms.filter((room) => room.messageCount === 0).length,
    latestMessageAt: latestMessageAt ?? null,
  };
}

function senderRole(message: AdminChatMessage): ChatArchiveSenderRole {
  const roles = message.sender?.roles ?? [];
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  if (roles.includes('PROVIDER')) return 'PROVIDER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return 'SYSTEM';
}

function senderLabel(message: AdminChatMessage) {
  return partnerDisplayText(
    message.sender?.fullName ?? message.sender?.phone ?? displaySenderRole(senderRole(message)),
  );
}

function displaySenderRole(role: string) {
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'PROVIDER') return 'Partner';
  if (role === 'ADMIN') return 'Admin';
  return 'System';
}

function bookingServiceLabel(booking: AdminBookingDetail) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function isActiveStatus(status: string) {
  return ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(
    status,
  );
}

function isClosedStatus(status: string) {
  return ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(status);
}

function bookingCustomerChatAvatarStatus(booking: AdminBookingDetail): AdminAvatarStatus {
  if (isWorkingStatus(booking.status)) return 'working';
  if (booking.status === 'OPEN_MATCHING' || booking.status === 'CREATED') return 'matching';
  return 'offline';
}

function bookingPartnerChatAvatarStatus(booking: AdminBookingDetail): AdminAvatarStatus {
  if (isWorkingStatus(booking.status)) return 'working';
  if (booking.status === 'OPEN_MATCHING') return 'matching';
  if (booking.selectedProvider || booking.preferredProvider) return 'offline';
  return 'offline';
}

function isWorkingStatus(status: string) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status);
}

function statusPillClass(status: string) {
  if (status === 'COMPLETED') return 'pill-success';
  if (isActiveStatus(status)) return 'pill-info';
  if (isClosedStatus(status)) return 'pill-warn';
  return 'pill-neutral';
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
