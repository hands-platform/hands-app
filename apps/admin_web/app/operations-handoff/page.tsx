import Link from 'next/link';
import {
  AdminAppSession,
  AdminAuditLog,
  AdminBooking,
  AdminCashSettlementSummary,
  AdminCustomer,
  AdminEarning,
  AdminNotification,
  AdminProvider,
  adminGet,
} from '../../lib/admin-api';

const activeBookingStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

function emptyCashSettlementSummary(): AdminCashSettlementSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    currency: 'VND',
    rowCount: 0,
    providerCount: 0,
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    oldestOpenAt: null,
    oldestOpenAgeMinutes: 0,
    staleDebtRowCount: 0,
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    cashPaymentRowCount: 0,
    topProviderGroups: [],
  };
}

export default async function OperationsHandoffPage() {
  const [bookings, customers, partners, earnings, notifications, sessions, auditLogs, cashSummary] =
    await Promise.all([
      adminGet<AdminBooking[]>('/admin/bookings', []),
      adminGet<AdminCustomer[]>('/admin/customers', []),
      adminGet<AdminProvider[]>('/admin/partners', []),
      adminGet<AdminEarning[]>('/admin/earnings', []),
      adminGet<AdminNotification[]>('/admin/notifications', []),
      adminGet<AdminAppSession[]>('/admin/app-sessions', []),
      adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
      adminGet<AdminCashSettlementSummary>('/admin/cash-settlement-summary', emptyCashSettlementSummary()),
    ]);

  const activeBookings = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const matchingBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const inServiceBookings = bookings.filter((booking) => booking.status === 'IN_SERVICE');
  const bookingQueue = buildBookingHandoffQueue(bookings);
  const operatorNotes = buildOperatorNotes(auditLogs);
  const chatSignals = buildChatSignals(bookings);
  const financeRows = buildFinanceRows(earnings);
  const presence = buildPresence(sessions);
  const customerSignals = buildCustomerSignals(customers);
  const partnerSignals = buildPartnerSignals(partners, cashSummary);
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const immediateActions = buildImmediateActionQueue({
    bookings,
    matchingBookings,
    inServiceBookings,
    failedNotifications,
    cashSummary,
    partnerSignals,
    operatorNotes,
    financeRows,
  });

  return (
    <>
      <h1>Operations Handoff</h1>
      <p className="muted">
        One shift handoff board for factual customer, partner, booking, chat, wallet, and app activity. Use
        this before changing operators so open work keeps context.
      </p>

      <section className="grid" style={{ marginTop: 16, marginBottom: 16 }}>
        <MetricCard label="Active bookings" value={activeBookings.length} helper="Matching, on the way, arrived, or in service" href="/bookings?view=attention" />
        <MetricCard label="Matching wait" value={matchingBookings.length} helper="Customer can still receive partner candidates" href="/bookings?view=matching" />
        <MetricCard label="In service" value={inServiceBookings.length} helper="Chat should be live until partner completion" href="/bookings?view=closeout" />
        <MetricCard label="Cash fee debt" value={cashSummary.providerCount} helper={`${formatMoney(cashSummary.totalDebtAmount, cashSummary.currency)} across partner wallet gates`} href="/cash-settlements" />
        <MetricCard label="Customer app online" value={presence.customerLive} helper={`${presence.customerRecent} customer session(s) seen recently`} href="/app-sessions?role=CUSTOMER&state=live" />
        <MetricCard label="Partner app online" value={presence.partnerLive} helper={`${presence.partnerRecent} partner session(s) seen recently`} href="/app-sessions?role=PROVIDER&state=live" />
        <MetricCard label="Chat rooms" value={chatSignals.roomCount} helper={`${chatSignals.recentMessageCount} recent message(s) visible to admin`} href="/chat-archive" />
        <MetricCard label="Failed notifications" value={failedNotifications.length} helper="Push/SMS/app delivery rows needing retry or device check" href="/notifications?review=failed" />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <div>
            <h2>Immediate action queue</h2>
            <p className="muted">
              Ordered by operational state only: live booking stage, chat availability, cash settlement,
              notification delivery, and written handoff notes.
            </p>
          </div>
          <span className="pill pill-info">{immediateActions.length} action lane(s)</span>
        </div>
        <div className="ops-task-grid">
          {immediateActions.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.id}>
              <span className={item.className}>{item.owner}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.countLabel}</span>
                <span className={item.statusClass}>{item.status}</span>
              </div>
              <small>{item.nextAction}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="detail-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Shift brief</h2>
              <p className="muted">Recommended opening order for the next operator.</p>
            </div>
            <span className="pill pill-info">Factual queue</span>
          </div>
          <div className="ops-task-grid">
            {buildShiftBriefItems({
              matchingBookings: matchingBookings.length,
              activeBookings: activeBookings.length,
              cashDebtPartners: cashSummary.providerCount,
              failedNotificationCount: failedNotifications.length,
              partnerIssueCount: partnerSignals.attentionCount,
              customerSignalCount: customerSignals.length,
            }).map((item) => (
              <Link className="ops-task-card" href={item.href} key={item.title}>
                <span className={item.className}>{item.owner}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <small>{item.action}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Latest operator notes</h2>
              <p className="muted">Customer, partner, and booking notes written by admins.</p>
            </div>
            <Link className="text-link" href="/audit-log">
              Open audit log
            </Link>
          </div>
          <div className="stack">
            {operatorNotes.slice(0, 8).map((note) => (
              <Link className="ops-signal-card" href={note.href} key={note.id}>
                <span className="pill pill-info">{note.area}</span>
                <strong>{note.note}</strong>
                <small>
                  {note.actor} / {relativeTime(note.createdAt)}
                </small>
              </Link>
            ))}
            {operatorNotes.length === 0 ? <p className="muted">No operator note has been written yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <div>
            <h2>Booking handoff queue</h2>
            <p className="muted">Open and recently changed bookings with payment, chat, partner, and next action.</p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/bookings?view=attention">
              Booking monitor
            </Link>
            <Link className="text-link" href="/chat-archive">
              Chat archive
            </Link>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Payment / wallet</th>
              <th>Chat</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {bookingQueue.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Link className="text-link" href={`/bookings/${booking.id}`}>
                    {shortId(booking.id)}
                  </Link>
                  <div className="muted">{relativeTime(booking.updatedAt ?? booking.createdAt)}</div>
                </td>
                <td>
                  <div>{booking.customerName}</div>
                  <small className="muted">{booking.customerPhone}</small>
                </td>
                <td>
                  <div>{booking.partnerName}</div>
                  <small className="muted">{booking.partnerDetail}</small>
                </td>
                <td>
                  <span className={booking.statusClass}>{booking.status}</span>
                </td>
                <td>
                  <div>{booking.paymentLabel}</div>
                  <small className="muted">{booking.walletLabel}</small>
                </td>
                <td>
                  <span className={booking.chatClass}>{booking.chatLabel}</span>
                </td>
                <td>{booking.nextAction}</td>
              </tr>
            ))}
            {bookingQueue.length === 0 ? (
              <tr>
                <td colSpan={7}>No active booking handoff rows.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="detail-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Customer handoff</h2>
              <p className="muted">Recent customers with booking, payment, address, and chat evidence.</p>
            </div>
            <Link className="text-link" href="/customers">
              Customer list
            </Link>
          </div>
          <div className="stack">
            {customerSignals.slice(0, 8).map((customer) => (
              <Link className="ops-signal-card" href={`/customers/${customer.id}`} key={customer.id}>
                <span className="pill pill-success">{customer.completedCount} completed</span>
                <strong>{customer.name}</strong>
                <p>{customer.detail}</p>
                <small>{customer.lastWorkLabel}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="toolbar">
            <div>
              <h2>Partner handoff</h2>
              <p className="muted">Partner state without scoring: app, wallet, identity, location, and work facts.</p>
            </div>
            <Link className="text-link" href="/partners">
              Partner list
            </Link>
          </div>
          <div className="stack">
            {partnerSignals.rows.slice(0, 8).map((partner) => (
              <Link className="ops-signal-card" href={`/partners/${partner.id}`} key={partner.id}>
                <span className={partner.className}>{partner.status}</span>
                <strong>{partner.name}</strong>
                <p>{partner.detail}</p>
                <small>{partner.action}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <div>
            <h2>Finance and chat closeout</h2>
            <p className="muted">
              Cash debt, payout evidence, and chat records that an operator should not lose at handoff.
            </p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/cash-settlements">
              Cash settlements
            </Link>
            <Link className="text-link" href="/payouts">
              Payouts
            </Link>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Gross</th>
              <th>HANDS fee</th>
              <th>Withholding</th>
              <th>Wallet effect</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {financeRows.slice(0, 12).map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="text-link" href={`/partners/${row.providerId}`}>
                    {row.partnerName}
                  </Link>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${row.bookingId}`}>
                    {shortId(row.bookingId)}
                  </Link>
                </td>
                <td>{formatMoney(row.grossAmount, row.currency)}</td>
                <td>{formatMoney(row.platformFee, row.currency)}</td>
                <td>{formatMoney(row.withholdingAmount, row.currency)}</td>
                <td>{formatMoney(row.netAmount, row.currency)}</td>
                <td>
                  <span className={row.statusClass}>{row.status}</span>
                </td>
              </tr>
            ))}
            {financeRows.length === 0 ? (
              <tr>
                <td colSpan={7}>No finance rows need handoff.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

function buildImmediateActionQueue(input: {
  bookings: AdminBooking[];
  matchingBookings: AdminBooking[];
  inServiceBookings: AdminBooking[];
  failedNotifications: AdminNotification[];
  cashSummary: AdminCashSettlementSummary;
  partnerSignals: ReturnType<typeof buildPartnerSignals>;
  operatorNotes: ReturnType<typeof buildOperatorNotes>;
  financeRows: ReturnType<typeof buildFinanceRows>;
}) {
  const chatMissing = input.bookings.filter(
    (booking) =>
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
      !booking.chatRoom?.id,
  );
  const closeoutRows = input.bookings.filter(
    (booking) =>
      booking.status === 'COMPLETED' &&
      (!booking.payment || !booking.earning || !booking.chatRoom?.id),
  );
  const recentNotes = input.operatorNotes.filter((note) => recentlyChanged(note.createdAt, 240));

  const rows = [
    {
      id: 'matching-live-window',
      owner: 'Dispatch',
      title: 'Open matching windows',
      detail:
        'Customers are waiting while first-pick and nearby partner participation windows are still open.',
      href: '/bookings?view=matching',
      count: input.matchingBookings.length,
      countLabel: `${input.matchingBookings.length} booking(s)`,
      status: input.matchingBookings.length ? 'Watch now' : 'Clear',
      nextAction: 'Open the matching board and check partner response, participant list, and customer choice.',
      className: input.matchingBookings.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: input.matchingBookings.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'chat-creation',
      owner: 'Support',
      title: 'Matched booking chat',
      detail: 'A matched or in-service booking should have an admin-retained chat room.',
      href: '/bookings?view=chat-repair',
      count: chatMissing.length,
      countLabel: `${chatMissing.length} missing chat`,
      status: chatMissing.length ? 'Repair' : 'Ready',
      nextAction: 'Open chat repair queue if any matched booking has no chat room.',
      className: chatMissing.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: chatMissing.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'in-service-watch',
      owner: 'Dispatch',
      title: 'Services in progress',
      detail: 'Partner and customer are inside the work window; chat remains active until completion.',
      href: '/bookings?view=closeout',
      count: input.inServiceBookings.length,
      countLabel: `${input.inServiceBookings.length} in service`,
      status: input.inServiceBookings.length ? 'Monitor' : 'Clear',
      nextAction: 'Watch completion and prepare payment, wallet, and chat archive closeout.',
      className: input.inServiceBookings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: input.inServiceBookings.length ? 'pill pill-info' : 'pill pill-success',
    },
    {
      id: 'cash-fee-debt',
      owner: 'Finance',
      title: 'Cash fee wallet gate',
      detail: 'Partners with negative wallet from cash bookings cannot accept more work until settlement.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} partner(s)`,
      status: input.cashSummary.providerCount ? 'Collect/offset' : 'Clear',
      nextAction: 'Open cash settlements and record deposit or offset before future acceptance.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'notification-delivery',
      owner: 'Alerts',
      title: 'Notification delivery failures',
      detail: 'Failed delivery rows can hide booking requests, partner updates, or customer status changes.',
      href: '/notifications?review=failed',
      count: input.failedNotifications.length,
      countLabel: `${input.failedNotifications.length} failed`,
      status: input.failedNotifications.length ? 'Retry/check' : 'Clear',
      nextAction: 'Retry delivery or inspect disabled push devices before relying on app alerts.',
      className: input.failedNotifications.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: input.failedNotifications.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'partner-admin-facts',
      owner: 'Partner Ops',
      title: 'Partner factual follow-up',
      detail: 'Partner list groups KYC, bank, wallet, location, app session, and acceptance gate facts.',
      href: '/partners',
      count: input.partnerSignals.attentionCount,
      countLabel: `${input.partnerSignals.attentionCount} partner fact(s)`,
      status: input.partnerSignals.attentionCount ? 'Review' : 'Clear',
      nextAction: 'Open partner list and continue from the relevant factual filter.',
      className: input.partnerSignals.attentionCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: input.partnerSignals.attentionCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'completed-closeout',
      owner: 'Finance',
      title: 'Completed closeout evidence',
      detail: 'Completed bookings should have payment, earning, wallet/tax evidence, and retained chat.',
      href: '/bookings?view=closeout',
      count: closeoutRows.length,
      countLabel: `${closeoutRows.length} booking(s)`,
      status: closeoutRows.length ? 'Check' : 'Ready',
      nextAction: 'Open closeout queue and compare payment, earning, tax, wallet, and chat rows.',
      className: closeoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: closeoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'recent-operator-notes',
      owner: 'Handoff',
      title: 'Recent written notes',
      detail: 'New customer, partner, or booking notes should be read before taking over the shift.',
      href: '/audit-log',
      count: recentNotes.length,
      countLabel: `${recentNotes.length} recent note(s)`,
      status: recentNotes.length ? 'Read' : 'None',
      nextAction: 'Open the latest operator notes and continue from the related detail page.',
      className: recentNotes.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: recentNotes.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => {
    const classWeight = (item: (typeof rows)[number]) =>
      item.statusClass.includes('danger') ? 4 : item.statusClass.includes('warn') ? 3 : item.statusClass.includes('info') ? 2 : 1;
    return classWeight(b) - classWeight(a) || b.count - a.count;
  });
}

function MetricCard({
  label,
  value,
  helper,
  href,
}: {
  label: string;
  value: number | string;
  helper: string;
  href: string;
}) {
  return (
    <Link className="card" href={href}>
      <p>{label}</p>
      <h2>{value}</h2>
      <small className="muted">{helper}</small>
    </Link>
  );
}

function buildBookingHandoffQueue(bookings: AdminBooking[]) {
  return bookings
    .filter((booking) => activeBookingStatuses.has(booking.status) || recentlyChanged(booking.updatedAt ?? booking.createdAt))
    .slice(0, 18)
    .map((booking) => {
      const selectedPartner = booking.selectedProvider ?? null;
      const preferredPartner = booking.preferredProvider ?? null;
      const partnerName =
        selectedPartner?.displayName ?? preferredPartner?.displayName ?? participantNames(booking).join(', ') ?? 'No partner yet';
      const participantCount = booking.participants?.length ?? 0;
      const walletAmount = booking.earning?.netAmount ?? 0;
      const chatReady = Boolean(booking.chatRoom?.id);
      return {
        id: booking.id,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        customerName: booking.customerProfile?.user?.fullName ?? 'Customer',
        customerPhone: booking.customerProfile?.user?.phone ?? '-',
        partnerName,
        partnerDetail: selectedPartner
          ? 'Selected partner'
          : preferredPartner
            ? `Preferred partner / ${participantCount} participant(s)`
            : `${participantCount} participant(s)`,
        status: booking.status,
        statusClass: bookingStatusClass(booking.status),
        paymentLabel: booking.payment
          ? `${booking.payment.method} / ${booking.payment.status} / ${formatMoney(booking.payment.amount, booking.payment.currency ?? 'VND')}`
          : 'No payment row',
        walletLabel: booking.earning
          ? `Wallet effect ${formatMoney(walletAmount, booking.earning.currency)}`
          : 'No earning row yet',
        chatLabel: chatReady ? 'Chat archived' : 'Chat not created',
        chatClass: chatReady ? 'pill pill-success' : 'pill pill-warn',
        nextAction: bookingNextAction(booking),
      };
    });
}

function buildOperatorNotes(logs: AdminAuditLog[]) {
  return logs
    .filter((log) => log.action.endsWith('.ops_note.add'))
    .map((log) => {
      const metadata = asRecord(log.metadata);
      const area = log.action.startsWith('booking')
        ? 'Booking'
        : log.action.startsWith('customer')
          ? 'Customer'
          : 'Partner';
      return {
        id: log.id,
        area,
        note: stringValue(metadata.note) ?? stringValue(metadata.preset) ?? humanizeAction(log.action),
        href: relatedHref(log),
        actor: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        createdAt: log.createdAt,
      };
    });
}

function buildShiftBriefItems(input: {
  matchingBookings: number;
  activeBookings: number;
  cashDebtPartners: number;
  failedNotificationCount: number;
  partnerIssueCount: number;
  customerSignalCount: number;
}) {
  return [
    {
      owner: 'Dispatch',
      title: `${input.matchingBookings} matching wait`,
      detail: `${input.activeBookings} active booking(s) need status continuity across the shift.`,
      action: 'Open booking monitor and check the 10-minute partner response window first.',
      href: '/bookings?view=matching',
      className: input.matchingBookings ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Partner Ops',
      title: `${input.partnerIssueCount} partner facts to check`,
      detail: 'KYC, wallet, location, push device, and app session facts are grouped on partner detail.',
      action: 'Open partner list with operational filters.',
      href: '/partners',
      className: input.partnerIssueCount ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Finance',
      title: `${input.cashDebtPartners} cash wallet gate(s)`,
      detail: 'Cash bookings can create negative partner wallet rows until HANDS fee settlement is posted.',
      action: 'Open cash settlement queue before approving more cash work.',
      href: '/cash-settlements',
      className: input.cashDebtPartners ? 'signal signal-danger' : 'signal signal-ok',
    },
    {
      owner: 'Support',
      title: `${input.customerSignalCount} recent customer record(s)`,
      detail: 'Customer pages retain profile, bookings, chat archive, wallet-like payments, addresses, and notes.',
      action: 'Open customer list when a customer asks about a booking.',
      href: '/customers',
      className: 'signal signal-info',
    },
    {
      owner: 'Alerts',
      title: `${input.failedNotificationCount} failed delivery row(s)`,
      detail: 'Notification deliveries show failed code and disabled device context where available.',
      action: 'Retry or inspect push device state.',
      href: '/notifications?review=failed',
      className: input.failedNotificationCount ? 'signal signal-warn' : 'signal signal-ok',
    },
  ];
}

function buildChatSignals(bookings: AdminBooking[]) {
  const withRooms = bookings.filter((booking) => booking.chatRoom?.id);
  const recentMessageCount = withRooms.reduce(
    (sum, booking) =>
      sum +
      ((booking.chatRoom as { messages?: Array<{ createdAt?: string }> } | null)?.messages ?? []).filter((message) =>
        recentlyChanged(message.createdAt),
      ).length,
    0,
  );
  return { roomCount: withRooms.length, recentMessageCount };
}

function buildFinanceRows(earnings: AdminEarning[]) {
  return earnings
    .filter((earning) => earning.netAmount < 0 || earning.status !== 'PAID')
    .slice(0, 40)
    .map((earning) => ({
      id: earning.id,
      providerId: earning.providerProfileId,
      bookingId: earning.bookingId,
      partnerName: earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Partner',
      grossAmount: earning.grossAmount,
      platformFee: earning.platformFee,
      withholdingAmount: earning.withholdingAmount,
      netAmount: earning.netAmount,
      currency: earning.currency,
      status: earning.status,
      statusClass: earning.netAmount < 0 ? 'pill pill-danger' : earning.status === 'AVAILABLE' ? 'pill pill-info' : 'pill pill-warn',
    }));
}

function buildPresence(sessions: AdminAppSession[]) {
  const customerSessions = sessions.filter((session) => session.role === 'CUSTOMER');
  const partnerSessions = sessions.filter((session) => session.role === 'PROVIDER' || session.role === 'PARTNER');
  return {
    customerLive: customerSessions.filter((session) => session.active).length,
    partnerLive: partnerSessions.filter((session) => session.active).length,
    customerRecent: customerSessions.filter((session) => recentlyChanged(session.lastSeenAt, 30)).length,
    partnerRecent: partnerSessions.filter((session) => recentlyChanged(session.lastSeenAt, 30)).length,
  };
}

function buildCustomerSignals(customers: AdminCustomer[]) {
  return customers
    .map((customer) => {
      const bookings = customer.bookings ?? [];
      const completed = bookings.filter((booking) => booking.status === 'COMPLETED');
      const lastWork = completed[0] ?? bookings[0] ?? null;
      const paidAmount = bookings.reduce((sum, booking) => sum + (booking.payment?.amount ?? 0), 0);
      return {
        id: customer.id,
        name: customer.user?.fullName ?? customer.user?.phone ?? 'Customer',
        completedCount: completed.length,
        detail: `${bookings.length} booking(s), ${formatMoney(paidAmount, 'VND')} payment total, ${
          customer.selectedLocations?.length ?? 0
        } saved location(s).`,
        lastWorkLabel: lastWork ? `Last booking ${shortId(lastWork.id)} / ${relativeTime(lastWork.updatedAt ?? lastWork.createdAt)}` : 'No booking yet',
        sortTime: dateValue(lastWork?.updatedAt ?? lastWork?.createdAt ?? customer.user?.updatedAt ?? customer.user?.createdAt),
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

function buildPartnerSignals(partners: AdminProvider[], cashSummary: AdminCashSettlementSummary) {
  const cashDebtPartnerIds = new Set(cashSummary.topProviderGroups.map((group) => group.providerProfileId));
  const rows = partners
    .map((partner) => {
      const hasCashDebt = cashDebtPartnerIds.has(partner.id);
      const hasKycPending = ['pending', 'PENDING', 'SUBMITTED'].includes(partner.kyc?.status ?? '');
      const hasBankPending = (partner.bankAccounts ?? []).some((account) => ['pending', 'PENDING', 'SUBMITTED'].includes(account.status));
      const hasFreshLocation = recentlyChanged(partner.currentLocationUpdatedAt, 30);
      const completed = (partner.selectedBookings ?? []).filter((booking) => booking.status === 'COMPLETED').length;
      const status = hasCashDebt
        ? 'Cash settlement'
        : hasKycPending
          ? 'KYC review'
          : hasBankPending
            ? 'Bank review'
            : hasFreshLocation
              ? 'Location fresh'
              : 'Location stale';
      return {
        id: partner.id,
        name: partner.displayName ?? partner.legalName ?? partner.user?.fullName ?? 'Partner',
        status,
        detail: `${completed} completed booking(s), ${partner.status}, location ${partner.currentLocationUpdatedAt ? relativeTime(partner.currentLocationUpdatedAt) : 'not shared'}.`,
        action: hasCashDebt
          ? 'Open cash settlement before more booking acceptance.'
          : hasKycPending
            ? 'Open partner documents for review.'
            : hasBankPending
              ? 'Open payout account review.'
              : 'Continue normal operational watch.',
        className: hasCashDebt ? 'pill pill-danger' : hasKycPending || hasBankPending ? 'pill pill-warn' : 'pill pill-success',
        attention: hasCashDebt || hasKycPending || hasBankPending || !hasFreshLocation,
        sortScore: (hasCashDebt ? 5 : 0) + (hasKycPending ? 3 : 0) + (hasBankPending ? 2 : 0) + (!hasFreshLocation ? 1 : 0),
      };
    })
    .sort((a, b) => b.sortScore - a.sortScore);
  return { rows, attentionCount: rows.filter((row) => row.attention).length };
}

function participantNames(booking: AdminBooking) {
  return (booking.participants ?? [])
    .map((participant) => participant.providerProfile?.displayName ?? participant.providerProfile?.user?.fullName)
    .filter(Boolean) as string[];
}

function bookingNextAction(booking: AdminBooking) {
  if (booking.status === 'OPEN_MATCHING') return 'Watch partner response window and customer shortlist.';
  if (booking.status === 'MATCHED') return 'Confirm partner starts service when ready; chat should be available.';
  if (booking.status === 'IN_SERVICE') return 'Keep chat visible until partner completion.';
  if (booking.status === 'COMPLETED') return 'Check payment, earning, tax, wallet, and chat archive closeout.';
  if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') return 'Check payment release, refund, and customer notice.';
  return 'Open booking detail for the latest factual state.';
}

function bookingStatusClass(status: string) {
  if (status === 'OPEN_MATCHING') return 'pill pill-warn';
  if (status === 'IN_SERVICE' || status === 'MATCHED') return 'pill pill-info';
  if (status === 'COMPLETED') return 'pill pill-success';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'pill pill-danger';
  return 'pill';
}

function relatedHref(log: AdminAuditLog) {
  const metadata = asRecord(log.metadata);
  const bookingId = stringValue(metadata.bookingId);
  const customerId = stringValue(metadata.customerProfileId);
  const providerId =
    stringValue(metadata.providerProfileId) ?? stringValue(metadata.partnerProfileId) ?? stringValue(metadata.providerId);
  if (bookingId) return `/bookings/${bookingId}`;
  if (customerId) return `/customers/${customerId}`;
  if (providerId) return `/partners/${providerId}`;
  if (log.target.startsWith('booking:')) return `/bookings/${log.target.slice('booking:'.length)}`;
  if (log.target.startsWith('customer:')) return `/customers/${log.target.slice('customer:'.length)}`;
  if (log.target.startsWith('provider:')) return `/partners/${log.target.slice('provider:'.length)}`;
  return '/audit-log';
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function humanizeAction(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(id?: string | null) {
  if (!id) return '-';
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

function formatMoney(amount: number, currency = 'VND') {
  return `${Math.round(amount).toLocaleString()} ${currency}`;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recentlyChanged(value?: string | null, minutes = 120) {
  const timestamp = dateValue(value);
  if (!timestamp) return false;
  return Date.now() - timestamp <= minutes * 60_000;
}

function relativeTime(value?: string | null) {
  const timestamp = dateValue(value);
  if (!timestamp) return 'unknown time';
  const diffMs = Date.now() - timestamp;
  const absMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (absMinutes < 1) return 'just now';
  if (absMinutes < 60) return `${absMinutes}m ago`;
  const hours = Math.round(absMinutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
