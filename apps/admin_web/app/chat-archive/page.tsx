import {
  Briefcase,
  CalendarCheck,
  Download,
  Filter,
  MessageSquare,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  AdminChatWindow,
  type AdminChatWindowMessage,
  type AdminChatWindowMessageRole,
} from '../../components/admin-chat-window';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminDisclosureCard, AdminSection } from '../../components/admin-surface';
import { AdminTableSection } from '../../components/admin-table-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormDate,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { AdminBookingDetail, AdminChatMessage, adminGet } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { formatDateTime as formatDate, shortId } from '../../lib/admin-format';
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

const CHAT_REPAIR_HEADERS = [
  'Booking',
  'Issue',
  'Customer',
  'Partner',
  'Service',
  'Operator action',
  'Open',
] as const;
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
    repairBookingsHref,
  } = buildChatArchiveLoadPlan(params);
  const [bookings, archiveSummaryResponse, allBookings] = await Promise.all([
    adminGet<AdminBookingDetail[]>(archiveHref, []),
    adminGet<unknown>(archiveSummaryHref, null),
    adminGet<AdminBookingDetail[]>(repairBookingsHref, []),
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
  const repairRows = filterChatRepairRows(
    buildChatRepairRows(allBookings, bookings.map(buildChatRoomRow)),
    filters,
    dateFilters,
  );
  const repairSummary = buildChatRepairSummary(repairRows);
  const visibleRepairRows = repairRows.slice(0, 30);
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
          <AdminFormControlLink className="button-secondary" href="/customers">
            <User aria-hidden="true" size={16} />
            Customers
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/partners">
            <Users aria-hidden="true" size={16} />
            Partners
          </AdminFormControlLink>
        </>
      }
      contentClassName="chat-archive-page"
      description="Audit-only search for retained booking chat evidence. Day-to-day review stays inside booking, customer, and Partner detail pages; use this page when an operator needs cross-record evidence."
      metrics={[
        {
          label: 'Rooms loaded',
          value: totalRooms.toString(),
          helper: `${rooms.length} shown / ${dateFilters.label}`,
        },
        {
          label: 'Messages',
          value: summary.messageCount.toString(),
          helper: `${summary.customerMessages} customer / ${summary.partnerMessages} Partner`,
        },
        { label: 'Completed rooms', value: summary.completedRooms.toString(), helper: 'Service done' },
        {
          label: 'Active rooms',
          value: summary.activeRooms.toString(),
          helper: 'Open operational flow',
        },
        {
          label: 'Empty rooms',
          value: summary.emptyRooms.toString(),
          helper: 'Chat room exists but no message',
        },
        {
          label: 'Missing rooms',
          value: repairSummary.missingRooms.toString(),
          helper: 'Matched booking needs a chat room',
        },
        { label: 'Latest message', value: summary.latestMessageAt, helper: 'Newest loaded message' },
      ]}
      title="Chat Evidence Search"
    >

      <AdminSection className="admin-mb-16" title="Chat evidence filters">
        <AdminFormGrid action="/chat-archive">
          <AdminFormInput
            className="admin-directory-filter-search"
            defaultValue={filters.q}
            label="Search"
            labelVisibility="visible"
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
              { label: 'Matched without room', value: 'missing-room' },
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
              Export evidence CSV
            </AdminFormControlLink>
            <span className="muted">
              {rooms.length} room(s), {summary.messageCount} message(s)
            </span>
          </AdminFormActionRow>
        </AdminFormGrid>
      </AdminSection>

      <AdminTableSection
        actions={
          <AdminFormControlLink className="button-secondary" href="/bookings?view=chat-repair">
            <Wrench aria-hidden="true" size={16} />
            Booking chat repair
          </AdminFormControlLink>
        }
        className="admin-mb-16"
        description="Matched and completed bookings should have retained chat evidence. Use this audit queue to find missing rooms or rooms where no message has been stored yet."
        title="Chat integrity repair queue"
      >
        <div className="service-trace-summary admin-mt-12">
          <div>
            <span>Repair rows</span>
            <strong>{repairRows.length}</strong>
            <small>{dateFilters.label}</small>
          </div>
          <div>
            <span>Missing room</span>
            <strong>{repairSummary.missingRooms}</strong>
            <small>Matched booking has no room.</small>
          </div>
          <div>
            <span>Empty room</span>
            <strong>{repairSummary.emptyRooms}</strong>
            <small>Room exists with no retained message.</small>
          </div>
          <div>
            <span>Completed affected</span>
            <strong>{repairSummary.completedRows}</strong>
            <small>Completed work needing archive confirmation.</small>
          </div>
        </div>
        {repairRows.length ? (
          <AdminTableScroll>
            <AdminDataTable emptyMessage={null} headers={CHAT_REPAIR_HEADERS} rowCount={visibleRepairRows.length}>
              {visibleRepairRows.map((row) => (
                <tr key={`${row.booking.id}-${row.issue}`}>
                  <td>
                    <strong>{shortId(row.booking.id)}</strong>
                    <p className="muted">
                      <DateTimeText value={row.booking.updatedAt ?? row.booking.createdAt} />
                    </p>
                  </td>
                  <td>
                    <StatusBadge tone={statusBadgeToneFromPillClass(row.pillClass)}>{row.issue}</StatusBadge>
                    <p className="muted">{row.detail}</p>
                  </td>
                  <td>
                    <ChatArchivePersonCell
                      avatarStatus={row.customerAvatarStatus}
                      href={row.customerId ? `/customers/${row.customerId}#chat-history` : null}
                      label={row.customerName}
                      phone={row.customerPhone}
                    />
                  </td>
                  <td>
                    <ChatArchivePersonCell
                      avatarStatus={row.partnerAvatarStatus}
                      href={row.partnerId ? `/partners/${row.partnerId}#booking-chat-records` : null}
                      label={row.partnerName}
                      phone={row.partnerPhone}
                      variant="partner"
                    />
                  </td>
                  <td>{row.serviceLabel}</td>
                  <td>{row.operatorAction}</td>
                  <td>
                    <div className="actions">
                      <AdminFormControlLink
                        className="button-secondary chat-inline-action"
                        href={`/bookings/${row.booking.id}#chat`}
                      >
                        <CalendarCheck aria-hidden="true" size={14} />
                        Booking
                      </AdminFormControlLink>
                      {row.customerId ? (
                        <AdminFormControlLink
                          className="button-secondary chat-inline-action"
                          href={`/customers/${row.customerId}#chat-history`}
                        >
                          <User aria-hidden="true" size={14} />
                          Customer
                        </AdminFormControlLink>
                      ) : null}
                      {row.partnerId ? (
                        <AdminFormControlLink
                          className="button-secondary chat-inline-action"
                          href={`/partners/${row.partnerId}#booking-chat-records`}
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
        ) : (
          <p className="muted admin-mt-12">
            No chat repair row matches this filter.
          </p>
        )}
      </AdminTableSection>

      <AdminTableSection
        className="admin-mb-16"
        description="One row per retained booking chat room. The list loads a bounded message preview; open the booking, customer, or Partner detail for full operational context before making an admin decision."
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
                  <StatusBadge tone={statusBadgeToneFromPillClass(statusPillClass(room.booking.status))}>
                    {room.booking.status}
                  </StatusBadge>
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
                      href={`#${chatRoomDomId(room.roomId)}`}
                    >
                      <MessageSquare aria-hidden="true" size={14} />
                      Chat
                    </AdminFormControlLink>
                    <AdminFormControlLink
                      className="button-secondary chat-inline-action"
                      href={`/bookings/${room.booking.id}#chat`}
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

      <AdminSection
        description="Open a preview here for quick audit triage. Full retained chat stays available from the connected booking, customer, and Partner detail pages."
        statusLabel="Admin retained"
        statusTone="info"
        title="Chat window previews"
      >
        <div className="setup-stage-list admin-mt-16 chat-transcript-list">
          {rooms.slice(0, 12).map((room) => (
            <AdminDisclosureCard
              className="chat-transcript-room admin-chat-transcript-disclosure"
              id={chatRoomDomId(room.roomId)}
              key={`${room.roomId}-messages`}
              open={rooms.length === 1}
            >
              <summary className="admin-chat-transcript-summary">
                <div>
                  <h3>
                    {room.customerName} / {room.partnerName}
                  </h3>
                  <p className="muted">
                    Booking {shortId(room.booking.id)} / {room.booking.status} / {room.serviceLabel}
                  </p>
                </div>
                <StatusBadge tone="info">
                  {room.messages.length} shown / {room.messageCount} total
                </StatusBadge>
              </summary>
              <AdminChatWindow
                avatarLabel={room.customerName}
                className="admin-mt-12"
                messages={chatArchiveWindowMessages(room.messages)}
                subtitle={`${room.partnerName} / ${room.serviceLabel}`}
                title={room.customerName}
              />
            </AdminDisclosureCard>
          ))}
        </div>
      </AdminSection>
    </AdminPageTemplate>
  );
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
    latestMessageAt: summary.latestMessageAt ? formatDate(summary.latestMessageAt) : fallback.latestMessageAt,
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
    if (filters.status === 'missing-room') return false;
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

function buildChatRepairRows(
  bookings: AdminBookingDetail[],
  archiveRows: ReturnType<typeof buildChatRoomRow>[],
) {
  const archiveByBookingId = new Map(archiveRows.map((row) => [row.booking.id, row]));
  return bookings
    .filter((booking) => shouldHaveChatArchive(booking.status))
    .map((booking) => {
      const archive = archiveByBookingId.get(booking.id);
      const messageCount = archive?.messageCount ?? bookingChatMessageCount(booking);
      if (booking.chatRoom && messageCount > 0) return null;
      const customerName =
        booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
      const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
      const partner = booking.selectedProvider ?? booking.preferredProvider;
      const partnerName = partnerDisplayText(
        partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'No Partner',
      );
      const partnerPhone = partner?.user?.phone ?? 'No phone';
      const missingRoom = !booking.chatRoom;

      return {
        booking,
        issue: missingRoom ? 'Missing room' : 'No message',
        detail: missingRoom
          ? 'Matched booking should create a customer and Partner chat room.'
          : 'Chat room exists, but no retained message is stored yet.',
        operatorAction: missingRoom
          ? 'Open booking detail and verify chat creation handoff.'
          : 'Confirm whether the first service message was sent or needs follow-up.',
        customerId: booking.customerProfileId,
        customerName,
        customerPhone,
        customerAvatarStatus: bookingCustomerChatAvatarStatus(booking),
        partnerId: partner?.id,
        partnerName,
        partnerPhone,
        partnerAvatarStatus: bookingPartnerChatAvatarStatus(booking),
        serviceLabel: bookingServiceLabel(booking),
        pillClass: missingRoom ? 'pill-danger' : 'pill-warn',
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort(
      (left, right) =>
        dateMs(right.booking.updatedAt ?? right.booking.createdAt) -
        dateMs(left.booking.updatedAt ?? left.booking.createdAt),
    );
}

function filterChatRepairRows(
  rows: ReturnType<typeof buildChatRepairRows>,
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
) {
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    const rowInDate =
      isWithinDetailDateFilter(row.booking.createdAt, dateFilters) ||
      isWithinDetailDateFilter(row.booking.updatedAt, dateFilters);
    if (!rowInDate) return false;
    if (filters.status === 'active' && !isActiveStatus(row.booking.status)) return false;
    if (filters.status === 'completed' && row.booking.status !== 'COMPLETED') return false;
    if (filters.status === 'closed' && !isClosedStatus(row.booking.status)) return false;
    if (filters.status === 'no-message' && row.issue !== 'No message') return false;
    if (filters.status === 'missing-room' && row.issue !== 'Missing room') return false;
    if (filters.sender) return false;
    if (!query) return true;
    return [
      row.booking.id,
      row.booking.status,
      row.customerId,
      row.customerName,
      row.customerPhone,
      row.partnerId,
      row.partnerName,
      row.partnerPhone,
      row.serviceLabel,
      row.issue,
      row.detail,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function buildChatRepairSummary(rows: ReturnType<typeof buildChatRepairRows>) {
  return {
    missingRooms: rows.filter((row) => row.issue === 'Missing room').length,
    emptyRooms: rows.filter((row) => row.issue === 'No message').length,
    completedRows: rows.filter((row) => row.booking.status === 'COMPLETED').length,
  };
}

function shouldHaveChatArchive(status: string) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(status);
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
    latestMessageAt: latestMessageAt ? formatDate(latestMessageAt) : 'None',
  };
}

function chatArchiveWindowMessages(messages: readonly AdminChatMessage[]): AdminChatWindowMessage[] {
  return messages.map((message) => {
    const role = senderRole(message);
    return {
      body: message.body,
      createdDateTime: message.createdAt,
      id: message.id,
      role,
      senderLabel: senderLabel(message),
    };
  });
}

function senderRole(message: AdminChatMessage): AdminChatWindowMessageRole {
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

function chatRoomDomId(roomId: string) {
  return `chat-room-${roomId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
