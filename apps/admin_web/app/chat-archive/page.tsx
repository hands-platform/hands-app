import Link from 'next/link';
import { Briefcase, CalendarCheck, Download, Filter, MessageSquare, User, Users, Wrench, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { MetricCard } from '../../components/metric-card';
import { AdminBookingDetail, AdminChatMessage, adminGet } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { formatDateTime as formatDate, shortId } from '../../lib/admin-format';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';
import {
  detailDateRangeOptions,
  isWithinDetailDateFilter,
  readDetailDateFilters,
} from '../../lib/detail-date-filter';

type ChatArchiveSearchParams = Promise<Record<string, string | string[] | undefined>>;
type ChatArchiveFilters = {
  q: string;
  status: string;
  sender: string;
};

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

export default async function ChatArchivePage({ searchParams }: { searchParams?: ChatArchiveSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const dateFilters = readDetailDateFilters(params);
  const filters = readChatArchiveFilters(params);
  const [bookings, allBookings] = await Promise.all([
    adminGet<AdminBookingDetail[]>('/admin/chat-archive', []),
    adminGet<AdminBookingDetail[]>('/admin/bookings', []),
  ]);
  const rooms = filterChatRooms(bookings.map(buildChatRoomRow), filters, dateFilters);
  const repairRows = filterChatRepairRows(
    buildChatRepairRows(allBookings, bookings.map(buildChatRoomRow)),
    filters,
    dateFilters,
  );
  const summary = buildChatArchiveSummary(rooms);
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
    <div className="chat-archive-page">
      <section className="toolbar">
        <div>
          <h1>Chat Archive</h1>
          <p className="muted">
            Completed booking chats disappear from active mobile app flow, but the full admin archive remains
            searchable by customer, Partner, booking, date, status, and sender role.
          </p>
        </div>
        <div className="actions">
          <Link className="button button-secondary" href="/bookings?view=chat">
            <MessageSquare aria-hidden="true" size={16} />
            Booking chat handoff
          </Link>
          <Link className="button button-secondary" href="/customers">
            <User aria-hidden="true" size={16} />
            Customers
          </Link>
          <Link className="button button-secondary" href="/partners">
            <Users aria-hidden="true" size={16} />
            Partners
          </Link>
        </div>
      </section>

      <section className="card admin-mb-16">
        <form className="form-grid" action="/chat-archive">
          <label>
            Search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Booking, room, customer, Partner, message"
            />
          </label>
          <label>
            Booking status
            <select name="status" defaultValue={filters.status}>
              <option value="">All</option>
              <option value="active">Active or matching</option>
              <option value="completed">Completed</option>
              <option value="closed">Cancelled / expired / refunded</option>
              <option value="no-message">Room without messages</option>
              <option value="missing-room">Matched without room</option>
            </select>
          </label>
          <label>
            Sender
            <select name="sender" defaultValue={filters.sender}>
              <option value="">All</option>
              <option value="customer">Customer messages</option>
              <option value="partner">Partner messages</option>
              <option value="admin">Admin/system messages</option>
            </select>
          </label>
          <label>
            Preset
            <select name="range" defaultValue={dateFilters.range}>
              {detailDateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={dateFilters.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={dateFilters.to} />
          </label>
          <div className="actions full-span">
            <button className="button button-primary" type="submit">
              <Filter aria-hidden="true" size={16} />
              Apply filters
            </button>
            <Link className="button button-secondary" href="/chat-archive">
              <X aria-hidden="true" size={16} />
              Clear
            </Link>
            <a className="button button-secondary" download="hands-chat-archive.csv" href={messageCsvHref}>
              <Download aria-hidden="true" size={16} />
              Export messages CSV
            </a>
            <span className="muted">
              {rooms.length} room(s), {summary.messageCount} message(s)
            </span>
          </div>
        </form>
      </section>

      <section className="grid admin-mb-16">
        <MetricCard label="Rooms loaded" value={rooms.length.toString()} helper={dateFilters.label} />
        <MetricCard
          label="Messages"
          value={summary.messageCount.toString()}
          helper={`${summary.customerMessages} customer / ${summary.partnerMessages} Partner`}
        />
        <MetricCard label="Completed rooms" value={summary.completedRooms.toString()} helper="Service done" />
        <MetricCard
          label="Active rooms"
          value={summary.activeRooms.toString()}
          helper="Open operational flow"
        />
        <MetricCard
          label="Empty rooms"
          value={summary.emptyRooms.toString()}
          helper="Chat room exists but no message"
        />
        <MetricCard
          label="Missing rooms"
          value={repairSummary.missingRooms.toString()}
          helper="Matched booking needs a chat room"
        />
        <MetricCard label="Latest message" value={summary.latestMessageAt} helper="Newest loaded message" />
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Chat integrity repair queue</h2>
            <p className="muted">
              Matched and completed bookings should have an admin-retained chat archive. Use this queue to
              find missing rooms or rooms where no message has been stored yet.
            </p>
          </div>
          <Link className="button button-secondary" href="/bookings?view=chat-repair">
            <Wrench aria-hidden="true" size={16} />
            Booking chat repair
          </Link>
        </div>
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
                    <p className="muted">{formatDate(row.booking.updatedAt ?? row.booking.createdAt)}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.pillClass}`}>{row.issue}</span>
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
                      <Link
                        className="button button-secondary chat-inline-action"
                        href={`/bookings/${row.booking.id}#chat`}
                      >
                        <CalendarCheck aria-hidden="true" size={14} />
                        Booking
                      </Link>
                      {row.customerId ? (
                        <Link
                          className="button button-secondary chat-inline-action"
                          href={`/customers/${row.customerId}#chat-history`}
                        >
                          <User aria-hidden="true" size={14} />
                          Customer
                        </Link>
                      ) : null}
                      {row.partnerId ? (
                        <Link
                          className="button button-secondary chat-inline-action"
                          href={`/partners/${row.partnerId}#booking-chat-records`}
                        >
                          <Briefcase aria-hidden="true" size={14} />
                          Partner
                        </Link>
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
      </section>

      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Chat archive index</h2>
            <p className="muted">
              One row per booking chat room. Open booking, customer, or Partner detail for full operational
              context.
            </p>
          </div>
          <span className="pill pill-info">{rooms.length} row(s)</span>
        </div>
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={
              <>
                <strong>No chat rooms found</strong>
                <p className="muted">Clear filters or wait until matched bookings create chat rooms.</p>
              </>
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
                  <span className={`pill ${statusPillClass(room.booking.status)}`}>
                    {room.booking.status}
                  </span>
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
                <td>{room.messages.length}</td>
                <td>{room.latestMessageAt ? formatDate(room.latestMessageAt) : 'No message'}</td>
                <td>
                  <div className="actions">
                    <Link
                      className="button button-secondary chat-inline-action"
                      href={`/bookings/${room.booking.id}#chat`}
                    >
                      <CalendarCheck aria-hidden="true" size={14} />
                      Booking
                    </Link>
                    {room.customerId ? (
                      <Link
                        className="button button-secondary chat-inline-action"
                        href={`/customers/${room.customerId}#chat-history`}
                      >
                        <User aria-hidden="true" size={14} />
                        Customer
                      </Link>
                    ) : null}
                    {room.partnerId ? (
                      <Link
                        className="button button-secondary chat-inline-action"
                        href={`/partners/${room.partnerId}#booking-chat-records`}
                      >
                        <Briefcase aria-hidden="true" size={14} />
                        Partner
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>

      <section className="card">
        <div className="ops-section-header">
          <div>
            <h2>Message transcript preview</h2>
            <p className="muted">
              Recent room transcripts. This is an admin archive only; it does not reopen completed chats in
              the mobile apps.
            </p>
          </div>
          <span className="pill pill-info">Admin retained</span>
        </div>
        <div className="setup-stage-list admin-mt-16 chat-transcript-list">
          {rooms.slice(0, 12).map((room) => (
            <article className="card chat-transcript-room" key={`${room.roomId}-messages`}>
              <div className="ops-section-header">
                <div>
                  <h3>
                    {room.customerName} / {room.partnerName}
                  </h3>
                  <p className="muted">
                    Booking {shortId(room.booking.id)} / {room.booking.status} / {room.serviceLabel}
                  </p>
                </div>
                <Link
                  className="button button-secondary chat-inline-action"
                  href={`/bookings/${room.booking.id}#chat`}
                >
                  <CalendarCheck aria-hidden="true" size={14} />
                  Open booking
                </Link>
              </div>
              <div className="admin-grid-gap-10 admin-mt-12 chat-transcript-messages">
                {room.messages.length > 0 ? (
                  room.messages.slice(-8).map((message) => (
                    <ChatTranscriptMessage key={message.id} message={message} />
                  ))
                ) : (
                  <p className="muted">Chat room exists, but no messages have been sent yet.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

type ChatTranscriptMessageProps = {
  readonly message: AdminChatMessage;
};

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

function ChatTranscriptMessage({ message }: ChatTranscriptMessageProps) {
  const role = senderRole(message);
  const roleClass = role === 'CUSTOMER' ? 'is-customer' : role === 'PROVIDER' ? 'is-partner' : 'is-system';

  return (
    <div className={`chat-transcript-bubble ${roleClass}`}>
      <strong>{senderLabel(message)}</strong>
      <p>{message.body}</p>
      <small className="muted">{formatDate(message.createdAt)}</small>
    </div>
  );
}

function readChatArchiveFilters(params: Record<string, string | string[] | undefined>): ChatArchiveFilters {
  return {
    q: readParam(params.q),
    status: readParam(params.status),
    sender: readParam(params.sender),
  };
}

function filterChatRooms(
  rooms: ReturnType<typeof buildChatRoomRow>[],
  filters: ChatArchiveFilters,
  dateFilters: ReturnType<typeof readDetailDateFilters>,
) {
  const query = filters.q.toLowerCase();
  return rooms.filter((room) => {
    const messagesInDate = room.messages.filter((message) =>
      isWithinDetailDateFilter(message.createdAt, dateFilters),
    );
    const roomInDate =
      messagesInDate.length > 0 ||
      isWithinDetailDateFilter(room.booking.createdAt, dateFilters) ||
      isWithinDetailDateFilter(room.booking.updatedAt, dateFilters);
    if (!roomInDate) return false;

    if (query && !room.searchText.includes(query)) return false;
    if (filters.status === 'active' && !isActiveStatus(room.booking.status)) return false;
    if (filters.status === 'completed' && room.booking.status !== 'COMPLETED') return false;
    if (filters.status === 'closed' && !isClosedStatus(room.booking.status)) return false;
    if (filters.status === 'no-message' && room.messages.length > 0) return false;
    if (filters.status === 'missing-room') return false;
    if (filters.sender && !room.messages.some((message) => senderFilterMatch(message, filters.sender))) {
      return false;
    }
    return true;
  });
}

function buildChatRoomRow(booking: AdminBookingDetail) {
  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => dateMs(left.createdAt) - dateMs(right.createdAt),
  );
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
      const messages = archive?.messages ?? [];
      if (booking.chatRoom && messages.length > 0) return null;
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
  dateFilters: ReturnType<typeof readDetailDateFilters>,
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
  const latestMessageAt = messages
    .map((message) => message.createdAt)
    .filter(Boolean)
    .sort((left, right) => dateMs(right) - dateMs(left))[0];

  return {
    messageCount: messages.length,
    customerMessages: messages.filter((message) => senderRole(message) === 'CUSTOMER').length,
    partnerMessages: messages.filter((message) => senderRole(message) === 'PROVIDER').length,
    completedRooms: rooms.filter((room) => room.booking.status === 'COMPLETED').length,
    activeRooms: rooms.filter((room) => isActiveStatus(room.booking.status)).length,
    emptyRooms: rooms.filter((room) => room.messages.length === 0).length,
    latestMessageAt: latestMessageAt ? formatDate(latestMessageAt) : 'None',
  };
}

function senderFilterMatch(message: AdminChatMessage, sender: string) {
  const role = senderRole(message);
  if (sender === 'customer') return role === 'CUSTOMER';
  if (sender === 'partner') return role === 'PROVIDER';
  if (sender === 'admin') return role === 'ADMIN' || role === 'SYSTEM';
  return true;
}

function senderRole(message: AdminChatMessage) {
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

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
