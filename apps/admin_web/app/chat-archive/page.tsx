import Link from 'next/link';
import { AdminBookingDetail, AdminChatMessage, adminGet } from '../../lib/admin-api';
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

export default async function ChatArchivePage({ searchParams }: { searchParams?: ChatArchiveSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const dateFilters = readDetailDateFilters(params);
  const filters = readChatArchiveFilters(params);
  const bookings = await adminGet<AdminBookingDetail[]>('/admin/chat-archive', []);
  const rooms = filterChatRooms(bookings.map(buildChatRoomRow), filters, dateFilters);
  const summary = buildChatArchiveSummary(rooms);
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
    <>
      <section className="toolbar">
        <div>
          <h1>Chat Archive</h1>
          <p className="muted">
            Completed booking chats disappear from active mobile app flow, but the full admin archive remains
            searchable by customer, partner, booking, date, status, and sender role.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/bookings?view=chat">
            Booking chat handoff
          </Link>
          <Link className="text-link" href="/customers">
            Customers
          </Link>
          <Link className="text-link" href="/partners">
            Partners
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/chat-archive">
          <label>
            Search
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Booking, room, customer, partner, message"
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
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/chat-archive">
              Clear
            </Link>
            <a className="text-link" download="hands-chat-archive.csv" href={messageCsvHref}>
              Export messages CSV
            </a>
            <span className="muted">
              {rooms.length} room(s), {summary.messageCount} message(s)
            </span>
          </div>
        </form>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Rooms loaded" value={rooms.length.toString()} helper={dateFilters.label} />
        <MetricCard
          label="Messages"
          value={summary.messageCount.toString()}
          helper={`${summary.customerMessages} customer / ${summary.partnerMessages} partner`}
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
        <MetricCard label="Latest message" value={summary.latestMessageAt} helper="Newest loaded message" />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Chat archive index</h2>
            <p className="muted">
              One row per booking chat room. Open booking, customer, or partner detail for full operational
              context.
            </p>
          </div>
          <span className="pill pill-info">{rooms.length} row(s)</span>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Partner</th>
                <th>Service</th>
                <th>Messages</th>
                <th>Latest message</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
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
                    <strong>{room.customerName}</strong>
                    <p className="muted">{room.customerPhone}</p>
                  </td>
                  <td>
                    <strong>{room.partnerName}</strong>
                    <p className="muted">{room.partnerPhone}</p>
                  </td>
                  <td>{room.serviceLabel}</td>
                  <td>{room.messages.length}</td>
                  <td>{room.latestMessageAt ? formatDate(room.latestMessageAt) : 'No message'}</td>
                  <td>
                    <div className="actions">
                      <Link className="text-link" href={`/bookings/${room.booking.id}#chat`}>
                        Booking
                      </Link>
                      {room.customerId ? (
                        <Link className="text-link" href={`/customers/${room.customerId}#chat-history`}>
                          Customer
                        </Link>
                      ) : null}
                      {room.partnerId ? (
                        <Link className="text-link" href={`/partners/${room.partnerId}#booking-chat-records`}>
                          Partner
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <strong>No chat rooms found</strong>
                    <p className="muted">Clear filters or wait until matched bookings create chat rooms.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>Message transcript preview</h2>
            <p className="muted">
              Recent room transcripts. This is an admin archive only; it does not reopen completed chats in
              the mobile apps.
            </p>
          </div>
          <span className="pill pill-info">Admin retained</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {rooms.slice(0, 12).map((room) => (
            <article className="card" key={`${room.roomId}-messages`}>
              <div className="risk-watch-header">
                <div>
                  <h3>
                    {room.customerName} / {room.partnerName}
                  </h3>
                  <p className="muted">
                    Booking {shortId(room.booking.id)} / {room.booking.status} / {room.serviceLabel}
                  </p>
                </div>
                <Link className="text-link" href={`/bookings/${room.booking.id}#chat`}>
                  Open booking
                </Link>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {room.messages.length > 0 ? (
                  room.messages.slice(-8).map((message) => (
                    <div
                      key={message.id}
                      style={{
                        justifySelf: senderRole(message) === 'CUSTOMER' ? 'start' : 'end',
                        maxWidth: '78%',
                        border: '1px solid #dfe7dc',
                        borderRadius: 8,
                        padding: 12,
                        background: senderRole(message) === 'CUSTOMER' ? '#ffffff' : '#eef7e8',
                      }}
                    >
                      <strong>{senderLabel(message)}</strong>
                      <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {message.body}
                      </p>
                      <small className="muted">{formatDate(message.createdAt)}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">Chat room exists, but no messages have been sent yet.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="card">
      <span className="muted">{label}</span>
      <h2>{value}</h2>
      <p className="muted">{helper}</p>
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
    partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'No partner',
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
    partnerId: partner?.id,
    partnerName,
    partnerPhone,
    serviceLabel,
    latestMessageAt,
    searchText,
  };
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
  return partnerDisplayText(message.sender?.fullName ?? message.sender?.phone ?? senderRole(message));
}

function partnerDisplayText(value: string) {
  return value.replace(/\bProvider\b/g, 'Partner').replace(/\bprovider\b/g, 'partner');
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

function statusPillClass(status: string) {
  if (status === 'COMPLETED') return 'pill-success';
  if (isActiveStatus(status)) return 'pill-info';
  if (isClosedStatus(status)) return 'pill-warn';
  return 'pill-neutral';
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function shortId(id?: string) {
  if (!id) return 'unknown';
  return id.slice(0, 8);
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}
