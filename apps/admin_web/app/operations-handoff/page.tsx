import Link from 'next/link';
import {
  AdminAppSession,
  AdminAuditLog,
  AdminBooking,
  AdminBookingDetail,
  AdminCashSettlementSummary,
  AdminCustomer,
  AdminEarning,
  AdminNotification,
  AdminPayment,
  AdminPayoutBatch,
  AdminProvider,
  AdminRefund,
  adminGet,
} from '../../lib/admin-api';
import { formatDateTime, formatMoney, formatRelativeTime, shortDisplayId } from '../../lib/admin-format';
import {
  formatFcmSentDeliveryDetail,
  latestFcmSentNotificationDelivery,
} from '../../lib/admin-notification-delivery';
import { isInDateRange, normalizeDateRange, readSearchParam } from '../../lib/date-range';
import { buildCsvDataHref } from '../../lib/csv-export';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { addOperationsHandoffNote } from './actions';
import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { OperationsHandoffMetricGridSection } from './operations-handoff-metric-grid-section';

const activeBookingStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);
type OperationsHandoffSearchParams = Promise<Record<string, string | string[] | undefined>>;
type OperationsHandoffFilters = {
  range: ReturnType<typeof normalizeDateRange>;
};

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

function buildOperationsHandoffFilters(
  params: Record<string, string | string[] | undefined>,
): OperationsHandoffFilters {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

export default async function OperationsHandoffPage({
  searchParams,
}: {
  searchParams?: OperationsHandoffSearchParams;
}) {
  const filters = buildOperationsHandoffFilters(searchParams ? await searchParams : {});
  const [
    bookings,
    customers,
    partners,
    earnings,
    payments,
    refunds,
    payouts,
    notifications,
    sessions,
    auditLogs,
    cashSummary,
    chatArchive,
  ] = await Promise.all([
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminCustomer[]>('/admin/customers', []),
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminPayment[]>('/admin/payments', []),
    adminGet<AdminRefund[]>('/admin/refunds', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminAppSession[]>('/admin/app-sessions', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
    adminGet<AdminCashSettlementSummary>('/admin/cash-settlement-summary', emptyCashSettlementSummary()),
    adminGet<AdminBookingDetail[]>('/admin/chat-archive', []),
  ]);

  const activeBookings = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const matchingBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const inServiceBookings = bookings.filter((booking) => booking.status === 'IN_SERVICE');
  const bookingQueue = buildBookingHandoffQueue(bookings);
  const rangePayments = payments.filter((payment) =>
    isInDateRange(payment.booking?.createdAt, filters.range),
  );
  const rangeRefunds = refunds.filter((refund) => isInDateRange(refund.createdAt, filters.range));
  const rangePayouts = payouts.filter((payout) => isInDateRange(payout.createdAt, filters.range));
  const rangeEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const rangeAuditLogs = auditLogs.filter((log) => isInDateRange(log.createdAt, filters.range));
  const operatorNotes = buildOperatorNotes(rangeAuditLogs);
  const chatSignals = buildChatSignals(bookings);
  const financeRows = buildFinanceRows(rangeEarnings);
  const financeHandoffActions = buildFinanceHandoffActionMap({
    payments: rangePayments,
    refunds: rangeRefunds,
    payouts: rangePayouts,
    earnings: rangeEarnings,
    cashSummary,
  });
  const presence = buildPresence(sessions);
  const customerSignals = buildCustomerSignals(customers);
  const partnerSignals = buildPartnerSignals(partners, cashSummary);
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const latestFcmSent = latestFcmSentNotificationDelivery(notifications);
  const latestFcmSentSummary = latestFcmSent
    ? {
        helper: formatFcmSentDeliveryDetail(latestFcmSent.notification, latestFcmSent.delivery),
        value: formatDateTime(latestFcmSent.delivery.attemptedAt),
      }
    : null;
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
  const activityStream = filterActivityStreamByRange(
    buildUnifiedActivityStream({
      bookings,
      chatArchive,
      auditLogs,
      notifications,
      financeRows,
    }),
    filters.range,
  );
  const activityStreamCsvHref = buildCsvDataHref(
    activityStream.map((item) => ({
      created_at: item.createdAt,
      relative_time: relativeTime(item.createdAt),
      area: item.area,
      source: item.source,
      record: item.record,
      summary: item.summary,
      href: item.href,
    })),
    ['created_at', 'relative_time', 'area', 'source', 'record', 'summary', 'href'],
  );
  const handoffChecklist = buildHandoffReadinessChecklist({
    bookings,
    matchingBookings,
    inServiceBookings,
    failedNotifications,
    cashSummary,
    partnerSignals,
    customerSignals,
    operatorNotes,
  });
  const checklistNeedsReview = handoffChecklist.filter((item) => item.tone !== 'success').length;

  return (
    <>
      <h1>Operations Handoff</h1>
      <p className="muted">
        One shift handoff board for factual Customer, Partner, booking, chat, wallet, and app activity. Use
        this before changing operators so open work keeps context.
      </p>

      <OperationsHandoffDateRangeSection range={filters.range} />

      <OperationsHandoffMetricGridSection
        activeBookingCount={activeBookings.length}
        matchingBookingCount={matchingBookings.length}
        inServiceBookingCount={inServiceBookings.length}
        cashSummary={cashSummary}
        presence={presence}
        chatSignals={chatSignals}
        failedNotificationCount={failedNotifications.length}
        latestFcmSent={latestFcmSentSummary}
      />

      <section className="card admin-mb-16">
        <div className="toolbar">
          <div>
            <h2>Shift handoff checklist</h2>
            <p className="muted">
              A factual close-of-shift list for the next operator: live bookings, chat continuity, cash
              settlement, alerts, app presence, customer context, and written notes.
            </p>
          </div>
          <span className={checklistNeedsReview ? 'pill pill-warn' : 'pill pill-success'}>
            {checklistNeedsReview ? `${checklistNeedsReview} check(s) open` : 'Ready to hand over'}
          </span>
        </div>
        <div className="ops-task-grid">
          {handoffChecklist.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.id}>
              <span className={item.badgeClass}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.countLabel}</span>
                <span className={item.badgeClass}>{item.owner}</span>
              </div>
              <small>{item.operatorAction}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
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

      <section className="card admin-mb-16">
        <div className="toolbar">
          <div>
            <h2>Finance handoff action map</h2>
            <p className="muted">
              Money-flow lanes the next operator should verify before continuing the shift: payment state,
              refund rows, cash wallet debt, payout release, and tax/reference trace.
            </p>
          </div>
          <Link className="text-link" href="/finance-closeout">
            Open Finance Closeout
          </Link>
        </div>
        <div className="ops-task-grid">
          {financeHandoffActions.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.id}>
              <span className={item.className}>{item.owner}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className={item.statusClass}>{item.status}</span>
                <span className="pill">{item.countLabel}</span>
              </div>
              <small>{item.nextAction}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="detail-grid admin-mb-16">
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
              <p className="muted">Shift, Customer, Partner, and booking notes written by admins.</p>
            </div>
            <Link className="text-link" href="/audit-log">
              Open audit log
            </Link>
          </div>
          <form action={addOperationsHandoffNote} className="ops-note-form admin-mb-14">
            <div className="form-grid compact-form">
              <label>
                Owner lane
                <select name="owner" defaultValue="Shift handoff">
                  <option value="Shift handoff">Shift handoff</option>
                  <option value="Dispatch">Dispatch</option>
                  <option value="Support">Support</option>
                  <option value="Partner Ops">Partner Ops</option>
                  <option value="Finance">Finance</option>
                  <option value="Alerts">Alerts</option>
                </select>
              </label>
              <label>
                Preset
                <select name="preset" defaultValue="">
                  <option value="">No preset</option>
                  <option value="Next operator should review live matching, chat, and cash settlement lanes first.">
                    Review live matching, chat, and cash settlement first.
                  </option>
                  <option value="Customer support handoff: recent customer contacts and chat archives reviewed.">
                    Customer support handoff reviewed.
                  </option>
                  <option value="Partner operations handoff: KYC, wallet, location, and app session facts reviewed.">
                    Partner operations handoff reviewed.
                  </option>
                  <option value="Finance handoff: cash debt, payout evidence, and completed closeout rows reviewed.">
                    Finance handoff reviewed.
                  </option>
                </select>
              </label>
            </div>
            <label>
              Shift note
              <textarea
                name="note"
                placeholder="Write the factual shift handoff note for the next operator."
              />
            </label>
            <button type="submit">Save handoff note</button>
          </form>
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
            {operatorNotes.length === 0 ? (
              <p className="muted">No operator note has been written yet.</p>
            ) : null}
          </div>
        </div>
      </section>

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
              className="text-link"
              download="hands-operations-handoff-activity.csv"
              href={activityStreamCsvHref}
            >
              Export activity CSV
            </a>
            <Link className="text-link" href="/audit-log">
              Audit trail
            </Link>
            <Link className="text-link" href="/chat-archive">
              Chat archive
            </Link>
          </div>
        </div>
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
            {activityStream.map((item) => (
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
            {activityStream.length === 0 ? (
              <tr>
                <td colSpan={5}>No recent activity stream rows.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card admin-mb-16">
        <div className="toolbar">
          <div>
            <h2>Booking handoff queue</h2>
            <p className="muted">
              Open and recently changed bookings with payment, chat, Partner, and next action.
            </p>
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
                    {shortDisplayId(booking.id)}
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

      <section className="detail-grid admin-mb-16">
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
              <p className="muted">Partner state from app, wallet, identity, location, and work facts.</p>
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
                    {shortDisplayId(row.bookingId)}
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

function buildHandoffReadinessChecklist(input: {
  bookings: AdminBooking[];
  matchingBookings: AdminBooking[];
  inServiceBookings: AdminBooking[];
  failedNotifications: AdminNotification[];
  cashSummary: AdminCashSettlementSummary;
  partnerSignals: ReturnType<typeof buildPartnerSignals>;
  customerSignals: ReturnType<typeof buildCustomerSignals>;
  operatorNotes: ReturnType<typeof buildOperatorNotes>;
}) {
  const chatMissing = input.bookings.filter(
    (booking) =>
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
      !booking.chatRoom?.id,
  );
  const completedWithoutEvidence = input.bookings.filter(
    (booking) =>
      booking.status === 'COMPLETED' && (!booking.payment || !booking.earning || !booking.chatRoom?.id),
  );
  const latestNote = input.operatorNotes[0] ?? null;
  const hasFreshHandoffNote = Boolean(latestNote && recentlyChanged(latestNote.createdAt, 480));

  const rows = [
    {
      id: 'live-matching-reviewed',
      owner: 'Dispatch',
      title: 'Live matching reviewed',
      detail:
        'Open matching rows need Partner response, marketplace participant, and customer final-choice continuity.',
      href: '/bookings?view=matching',
      count: input.matchingBookings.length,
      countLabel: `${input.matchingBookings.length} open`,
      status: input.matchingBookings.length ? 'Check live' : 'Clear',
      operatorAction: 'Open booking monitor and confirm no customer is waiting without a visible next step.',
      tone: input.matchingBookings.length ? 'warn' : 'success',
    },
    {
      id: 'active-service-reviewed',
      owner: 'Dispatch',
      title: 'Active service reviewed',
      detail: 'In-service bookings keep chat visible until the Partner completes the work.',
      href: '/bookings?view=closeout',
      count: input.inServiceBookings.length,
      countLabel: `${input.inServiceBookings.length} active`,
      status: input.inServiceBookings.length ? 'Watch' : 'Clear',
      operatorAction: 'Check active service rows, completion timing, payment evidence, and chat continuity.',
      tone: input.inServiceBookings.length ? 'info' : 'success',
    },
    {
      id: 'chat-continuity-reviewed',
      owner: 'Support',
      title: 'Chat continuity reviewed',
      detail: 'Matched and active bookings should have a retained chat room for admin archive and support.',
      href: '/bookings?view=chat-repair',
      count: chatMissing.length,
      countLabel: `${chatMissing.length} missing`,
      status: chatMissing.length ? 'Repair' : 'Ready',
      operatorAction: 'Repair or inspect rows where the booking is matched but no chat room exists.',
      tone: chatMissing.length ? 'danger' : 'success',
    },
    {
      id: 'cash-settlement-reviewed',
      owner: 'Finance',
      title: 'Cash settlement reviewed',
      detail: 'Cash bookings can leave Partner wallet fee debt until deposit or offset evidence is recorded.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      operatorAction: 'Check cash fee debt, missing payment evidence, and settlement notes.',
      tone: input.cashSummary.providerCount ? 'danger' : 'success',
    },
    {
      id: 'closeout-evidence-reviewed',
      owner: 'Finance',
      title: 'Completed closeout reviewed',
      detail: 'Completed bookings should retain payment, earning, tax/wallet, and chat evidence.',
      href: '/bookings?view=closeout',
      count: completedWithoutEvidence.length,
      countLabel: `${completedWithoutEvidence.length} row(s)`,
      status: completedWithoutEvidence.length ? 'Check' : 'Ready',
      operatorAction: 'Open completed rows that do not yet show all closeout evidence.',
      tone: completedWithoutEvidence.length ? 'warn' : 'success',
    },
    {
      id: 'failed-alerts-reviewed',
      owner: 'Alerts',
      title: 'Failed alerts reviewed',
      detail: 'Failed delivery rows can hide customer status changes or Partner booking requests.',
      href: '/notifications?review=failed',
      count: input.failedNotifications.length,
      countLabel: `${input.failedNotifications.length} failed`,
      status: input.failedNotifications.length ? 'Retry/check' : 'Clear',
      operatorAction: 'Open notification failures and inspect retry/device state before handover.',
      tone: input.failedNotifications.length ? 'warn' : 'success',
    },
    {
      id: 'partner-facts-reviewed',
      owner: 'Partner Ops',
      title: 'Partner facts reviewed',
      detail: 'Partner list groups KYC, bank, wallet, app session, service, and location facts.',
      href: '/partners',
      count: input.partnerSignals.attentionCount,
      countLabel: `${input.partnerSignals.attentionCount} fact(s)`,
      status: input.partnerSignals.attentionCount ? 'Review' : 'Clear',
      operatorAction: 'Open Partner filters only for factual follow-up, not personal evaluation.',
      tone: input.partnerSignals.attentionCount ? 'warn' : 'success',
    },
    {
      id: 'customer-context-reviewed',
      owner: 'Support',
      title: 'Customer context reviewed',
      detail:
        'Customer records show booking, payment/refund, chat archive, saved address, session, and notes.',
      href: '/customers',
      count: input.customerSignals.length,
      countLabel: `${input.customerSignals.length} record(s)`,
      status: input.customerSignals.length ? 'Available' : 'No rows',
      operatorAction: 'Use customer detail pages for support handoff when a customer contacts the team.',
      tone: input.customerSignals.length ? 'info' : 'success',
    },
    {
      id: 'handoff-note-written',
      owner: 'Handoff',
      title: 'Written note prepared',
      detail: latestNote
        ? `Latest note: ${relativeTime(latestNote.createdAt)} by ${latestNote.actor}.`
        : 'No handoff note has been written yet.',
      href: '/operations-handoff',
      count: hasFreshHandoffNote ? 1 : 0,
      countLabel: hasFreshHandoffNote ? 'fresh note' : 'needs note',
      status: hasFreshHandoffNote ? 'Ready' : 'Write note',
      operatorAction: 'Write a short factual note before ending the shift if open work remains.',
      tone: hasFreshHandoffNote ? 'success' : 'warn',
    },
  ];

  return rows
    .map((row) => ({
      ...row,
      badgeClass: checklistToneClass(row.tone),
    }))
    .sort((a, b) => checklistToneWeight(b.tone) - checklistToneWeight(a.tone) || b.count - a.count);
}

function checklistToneClass(tone: string) {
  if (tone === 'danger') return 'pill pill-danger';
  if (tone === 'warn') return 'pill pill-warn';
  if (tone === 'info') return 'pill pill-info';
  return 'pill pill-success';
}

function checklistToneWeight(tone: string) {
  if (tone === 'danger') return 4;
  if (tone === 'warn') return 3;
  if (tone === 'info') return 2;
  return 1;
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
      booking.status === 'COMPLETED' && (!booking.payment || !booking.earning || !booking.chatRoom?.id),
  );
  const recentNotes = input.operatorNotes.filter((note) => recentlyChanged(note.createdAt, 240));

  const rows = [
    {
      id: 'matching-live-window',
      owner: 'Dispatch',
      title: 'Open matching windows',
      detail:
        'Customers are waiting while first-pick and nearby Partner participation windows are still open.',
      href: '/bookings?view=matching',
      count: input.matchingBookings.length,
      countLabel: `${input.matchingBookings.length} booking(s)`,
      status: input.matchingBookings.length ? 'Monitor now' : 'Clear',
      nextAction:
        'Open the matching board and check Partner response, participant list, and customer choice.',
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
      nextAction: 'Track completion and prepare payment, wallet, and chat archive closeout.',
      className: input.inServiceBookings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: input.inServiceBookings.length ? 'pill pill-info' : 'pill pill-success',
    },
    {
      id: 'cash-fee-debt',
      owner: 'Finance',
      title: 'Cash fee wallet gate',
      detail:
        'Partners with negative wallet from cash bookings can stay visible, but marketplace alerts, participation, and payout release wait for settlement.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Collect/offset' : 'Clear',
      nextAction:
        'Open cash settlements and record deposit or offset before future marketplace participation.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'notification-delivery',
      owner: 'Alerts',
      title: 'Notification delivery failures',
      detail: 'Failed delivery rows can hide booking requests, Partner updates, or customer status changes.',
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
      detail:
        'Partner list groups KYC, bank, wallet, location, app session, marketplace, and payout gate facts.',
      href: '/partners',
      count: input.partnerSignals.attentionCount,
      countLabel: `${input.partnerSignals.attentionCount} Partner fact(s)`,
      status: input.partnerSignals.attentionCount ? 'Review' : 'Clear',
      nextAction: 'Open Partner list and continue from the relevant factual filter.',
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
      detail: 'New Customer, Partner, or booking notes should be read before taking over the shift.',
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
      item.statusClass.includes('danger')
        ? 4
        : item.statusClass.includes('warn')
          ? 3
          : item.statusClass.includes('info')
            ? 2
            : 1;
    return classWeight(b) - classWeight(a) || b.count - a.count;
  });
}

function buildFinanceHandoffActionMap(input: {
  payments: AdminPayment[];
  refunds: AdminRefund[];
  payouts: AdminPayoutBatch[];
  earnings: AdminEarning[];
  cashSummary: AdminCashSettlementSummary;
}) {
  const openPaymentRows = input.payments.filter(
    (payment) =>
      payment.status === 'AUTHORIZED' || (payment.method === 'CASH' && payment.status === 'PENDING'),
  );
  const missingPaymentRefs = input.payments.filter(
    (payment) =>
      ['AUTHORIZED', 'PENDING'].includes(payment.status) && payment.method !== 'CASH' && !payment.providerRef,
  );
  const openRefundRows = input.refunds.filter((refund) => refund.status !== 'COMPLETED');
  const openPayoutRows = input.payouts.filter((payout) => !['PAID', 'CANCELLED'].includes(payout.status));
  const payoutMissingRefs = input.payouts.filter(
    (payout) => ['PROCESSING', 'PAID'].includes(payout.status) && !payout.transferRef,
  );
  const earningsWithoutTaxLogs = input.earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const pendingEarnings = input.earnings.filter(
    (earning) => earning.status === 'PENDING' || earning.status === 'AVAILABLE',
  );
  const totalOpenPaymentAmount = openPaymentRows.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOpenRefundAmount = openRefundRows.reduce((sum, refund) => sum + refund.amount, 0);
  const totalOpenPayoutAmount = openPayoutRows.reduce((sum, payout) => sum + payout.totalNetAmount, 0);
  const currency =
    input.cashSummary.currency ||
    input.payments[0]?.currency ||
    input.refunds[0]?.payment?.currency ||
    input.payouts[0]?.currency ||
    'VND';

  const rows = [
    {
      id: 'finance-payment-state',
      owner: 'Finance',
      title: 'Payment state handoff',
      detail: `${formatMoney(totalOpenPaymentAmount, currency)} in visible open payment state for this range.`,
      href: '/payments?review=needs-action',
      count: openPaymentRows.length,
      countLabel: `${openPaymentRows.length} row(s)`,
      status: openPaymentRows.length ? 'Open' : 'Clear',
      nextAction: 'Capture, release, refund, or record cash collection evidence before handoff closes.',
      className: openPaymentRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: openPaymentRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-refund-state',
      owner: 'Finance',
      title: 'Refund state handoff',
      detail: `${formatMoney(totalOpenRefundAmount, currency)} in refund rows still needing final evidence.`,
      href: '/refunds?review=open',
      count: openRefundRows.length,
      countLabel: `${openRefundRows.length} row(s)`,
      status: openRefundRows.length ? 'Open' : 'Clear',
      nextAction: 'Keep refund state aligned with booking, payment ledger, and customer message history.',
      className: openRefundRows.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: openRefundRows.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-cash-debt',
      owner: 'Finance',
      title: 'Cash wallet debt handoff',
      detail: `${formatMoney(input.cashSummary.totalDebtAmount, input.cashSummary.currency)} open HANDS fee debt from cash bookings.`,
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      nextAction:
        'Record deposit reference or approved offset before marketplace alerts, participation, or payout release reopens.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-payout-release',
      owner: 'Finance',
      title: 'Payout release handoff',
      detail: `${formatMoney(totalOpenPayoutAmount, currency)} in open payout batch amount for the selected window.`,
      href: '/payouts',
      count: openPayoutRows.length,
      countLabel: `${openPayoutRows.length} batch(es)`,
      status: openPayoutRows.length ? 'Review' : 'Clear',
      nextAction: 'Paid status needs bank reference, earning trace, tax logs, and no payout blocker.',
      className: openPayoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: openPayoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-reference-trace',
      owner: 'Finance',
      title: 'Reference and tax trace',
      detail: `${missingPaymentRefs.length + payoutMissingRefs.length} missing reference check(s), ${earningsWithoutTaxLogs.length} earning row(s) without tax log.`,
      href: '/finance-closeout',
      count: missingPaymentRefs.length + payoutMissingRefs.length + earningsWithoutTaxLogs.length,
      countLabel: `${missingPaymentRefs.length + payoutMissingRefs.length + earningsWithoutTaxLogs.length} check(s)`,
      status:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'Check'
          : 'Ready',
      nextAction: 'Open Finance Closeout and keep historical payment, bank, and tax snapshots stable.',
      className:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'signal signal-warn'
          : 'signal signal-ok',
      statusClass:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'pill pill-warn'
          : 'pill pill-success',
    },
    {
      id: 'finance-earning-release',
      owner: 'Finance',
      title: 'Earning release handoff',
      detail: `${pendingEarnings.length} earning row(s) are pending or available for batch review.`,
      href: '/earnings',
      count: pendingEarnings.length,
      countLabel: `${pendingEarnings.length} row(s)`,
      status: pendingEarnings.length ? 'Review' : 'Clear',
      nextAction: 'Use earnings as the source record before payout batch movement.',
      className: pendingEarnings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: pendingEarnings.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => {
    const classWeight = (item: (typeof rows)[number]) =>
      item.statusClass.includes('danger')
        ? 4
        : item.statusClass.includes('warn')
          ? 3
          : item.statusClass.includes('info')
            ? 2
            : 1;
    return classWeight(b) - classWeight(a) || b.count - a.count;
  });
}

function buildUnifiedActivityStream(input: {
  bookings: AdminBooking[];
  chatArchive: AdminBookingDetail[];
  auditLogs: AdminAuditLog[];
  notifications: AdminNotification[];
  financeRows: ReturnType<typeof buildFinanceRows>;
}) {
  const bookingRows = input.bookings.slice(0, 25).map((booking) => ({
    id: `booking-${booking.id}`,
    area: 'Booking',
    source: booking.status,
    record: shortDisplayId(booking.id),
    summary: bookingActivitySummary(booking),
    href: `/bookings/${booking.id}`,
    className: bookingStatusClass(booking.status),
    createdAt: booking.updatedAt ?? booking.createdAt ?? new Date(0).toISOString(),
  }));

  const chatRows = input.chatArchive.flatMap((booking) =>
    (
      (
        booking.chatRoom as {
          messages?: Array<{
            id: string;
            body: string;
            createdAt: string;
            sender?: { fullName?: string | null; phone?: string | null; roles?: string[] };
          }>;
        } | null
      )?.messages ?? []
    )
      .slice(-5)
      .map((message) => ({
        id: `chat-${message.id}`,
        area: 'Chat',
        source: message.sender?.roles?.includes('PROVIDER') ? 'Partner message' : 'Customer/admin message',
        record: `Room ${shortDisplayId(booking.chatRoom?.id)}`,
        summary: operatorDisplayText(
          `${message.sender?.fullName ?? message.sender?.phone ?? 'User'}: ${trimText(message.body, 110)}`,
        ),
        href: `/bookings/${booking.id}`,
        className: 'pill pill-info',
        createdAt: message.createdAt,
      })),
  );

  const auditRows = input.auditLogs.slice(0, 30).map((log) => ({
    id: `audit-${log.id}`,
    area: auditActivityArea(log),
    source: operatorDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'System'),
    record: shortTarget(log.target),
    summary: auditActivitySummary(log),
    href: relatedHref(log),
    className: auditActivityClassName(log),
    createdAt: log.createdAt,
  }));

  const notificationRows = input.notifications
    .filter((notification) =>
      (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
    )
    .slice(0, 20)
    .map((notification) => ({
      id: `notification-${notification.id}`,
      area: 'Notification',
      source: notification.type,
      record: shortDisplayId(notification.id),
      summary: operatorDisplayText(`${notification.title}: ${trimText(notification.body, 100)}`),
      href: '/notifications?review=failed',
      className: 'pill pill-warn',
      createdAt: notification.createdAt,
    }));

  const financeRows = input.financeRows.slice(0, 20).map((row) => ({
    id: `finance-${row.id}`,
    area: 'Finance',
    source: row.status,
    record: shortDisplayId(row.bookingId),
    summary: `${row.partnerName} / wallet effect ${formatMoney(row.netAmount, row.currency)} / fee ${formatMoney(
      row.platformFee,
      row.currency,
    )}`,
    href: row.netAmount < 0 ? '/cash-settlements' : `/bookings/${row.bookingId}`,
    className: row.statusClass,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  }));

  return [...bookingRows, ...chatRows, ...auditRows, ...notificationRows, ...financeRows]
    .filter((item) => dateValue(item.createdAt) > 0)
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    .slice(0, 40);
}

function filterActivityStreamByRange(
  rows: ReturnType<typeof buildUnifiedActivityStream>,
  range: OperationsHandoffFilters['range'],
) {
  return rows.filter((row) => isInDateRange(row.createdAt, range));
}

function bookingActivitySummary(booking: AdminBooking) {
  const customer =
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
  const payment = booking.payment
    ? `${booking.payment.method} ${booking.payment.status} ${formatMoney(booking.payment.amount, booking.payment.currency ?? 'VND')}`
    : 'No payment row';
  return operatorDisplayText(`${customer} / ${bookingPartnerName(booking)} / ${payment}`);
}

function auditActivitySummary(log: AdminAuditLog) {
  const metadata = asRecord(log.metadata);
  const note =
    stringValue(metadata.note) ??
    stringValue(metadata.preset) ??
    stringValue(metadata.reason) ??
    stringValue(metadata.status);
  return operatorDisplayText(note ? trimText(note, 140) : humanizeAction(log.action));
}

function shortTarget(target?: string | null) {
  if (!target) return '-';
  const [kind, id] = target.split(':');
  return id ? `${kind}:${shortDisplayId(id)}` : shortDisplayId(target);
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function buildBookingHandoffQueue(bookings: AdminBooking[]) {
  return bookings
    .filter(
      (booking) =>
        activeBookingStatuses.has(booking.status) || recentlyChanged(booking.updatedAt ?? booking.createdAt),
    )
    .slice(0, 18)
    .map((booking) => {
      const selectedPartner = booking.selectedProvider ?? null;
      const preferredPartner = booking.preferredProvider ?? null;
      const participantCount = booking.participants?.length ?? 0;
      const walletAmount = booking.earning?.netAmount ?? 0;
      const chatReady = Boolean(booking.chatRoom?.id);
      return {
        id: booking.id,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        customerName: booking.customerProfile?.user?.fullName ?? 'Customer',
        customerPhone: booking.customerProfile?.user?.phone ?? '-',
        partnerName: operatorDisplayText(bookingPartnerName(booking)),
        partnerDetail: selectedPartner
          ? 'Selected Partner'
          : preferredPartner
            ? `Preferred Partner / ${participantCount} participant(s)`
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

function bookingPartnerName(booking: AdminBooking) {
  const participantLabel = participantNames(booking).join(', ');
  const directPartnerName = booking.selectedProvider?.displayName ?? booking.preferredProvider?.displayName;
  return directPartnerName || participantLabel || 'No Partner yet';
}

function buildOperatorNotes(logs: AdminAuditLog[]) {
  return logs
    .filter((log) => log.action.endsWith('.ops_note.add') || log.action === 'operations.handoff_note.add')
    .map((log) => {
      const metadata = asRecord(log.metadata);
      const area =
        log.action === 'operations.handoff_note.add'
          ? 'Shift'
          : log.action.startsWith('booking')
            ? 'Booking'
            : log.action.startsWith('customer')
              ? 'Customer'
              : 'Partner';
      return {
        id: log.id,
        area,
        note: operatorDisplayText(
          stringValue(metadata.note) ?? stringValue(metadata.preset) ?? humanizeAction(log.action),
        ),
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
      action: 'Open booking monitor and check the 10-minute Partner response window first.',
      href: '/bookings?view=matching',
      className: input.matchingBookings ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Partner Ops',
      title: `${input.partnerIssueCount} Partner facts to check`,
      detail: 'KYC, wallet, location, push device, and app session facts are grouped on Partner detail.',
      action: 'Open Partner list with operational filters.',
      href: '/partners',
      className: input.partnerIssueCount ? 'signal signal-warn' : 'signal signal-ok',
    },
    {
      owner: 'Finance',
      title: `${input.cashDebtPartners} cash wallet gate(s)`,
      detail: 'Cash bookings can create negative Partner wallet rows until HANDS fee settlement is posted.',
      action: 'Open cash settlement queue before approving more cash work.',
      href: '/cash-settlements',
      className: input.cashDebtPartners ? 'signal signal-danger' : 'signal signal-ok',
    },
    {
      owner: 'Support',
      title: `${input.customerSignalCount} recent customer record(s)`,
      detail:
        'Customer pages retain profile, bookings, chat archive, wallet-like payments, addresses, and notes.',
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
      ((booking.chatRoom as { messages?: Array<{ createdAt?: string }> } | null)?.messages ?? []).filter(
        (message) => recentlyChanged(message.createdAt),
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
      partnerName: operatorDisplayText(
        earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Partner',
      ),
      grossAmount: earning.grossAmount,
      platformFee: earning.platformFee,
      withholdingAmount: earning.withholdingAmount,
      netAmount: earning.netAmount,
      currency: earning.currency,
      status: earning.status,
      createdAt: earning.createdAt,
      statusClass:
        earning.netAmount < 0
          ? 'pill pill-danger'
          : earning.status === 'AVAILABLE'
            ? 'pill pill-info'
            : 'pill pill-warn',
    }));
}

function buildPresence(sessions: AdminAppSession[]) {
  const customerSessions = sessions.filter((session) => session.role === 'CUSTOMER');
  const partnerSessions = sessions.filter(
    (session) => session.role === 'PROVIDER' || session.role === 'PARTNER',
  );
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
        lastWorkLabel: lastWork
          ? `Last booking ${shortDisplayId(lastWork.id)} / ${relativeTime(lastWork.updatedAt ?? lastWork.createdAt)}`
          : 'No booking yet',
        sortTime: dateValue(
          lastWork?.updatedAt ?? lastWork?.createdAt ?? customer.user?.updatedAt ?? customer.user?.createdAt,
        ),
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
      const hasBankPending = (partner.bankAccounts ?? []).some((account) =>
        ['pending', 'PENDING', 'SUBMITTED'].includes(account.status),
      );
      const hasFreshLocation = recentlyChanged(partner.currentLocationUpdatedAt, 30);
      const completed = (partner.selectedBookings ?? []).filter(
        (booking) => booking.status === 'COMPLETED',
      ).length;
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
        name: operatorDisplayText(
          partner.displayName ?? partner.legalName ?? partner.user?.fullName ?? 'Partner',
        ),
        status,
        detail: `${completed} completed booking(s), ${partner.status}, location ${partner.currentLocationUpdatedAt ? relativeTime(partner.currentLocationUpdatedAt) : 'not shared'}.`,
        action: hasCashDebt
          ? 'Open cash settlement before marketplace alerts, participation, or payout release.'
          : hasKycPending
            ? 'Open Partner documents for review.'
            : hasBankPending
              ? 'Open payout account review.'
              : 'Continue normal operational watch.',
        className: hasCashDebt
          ? 'pill pill-danger'
          : hasKycPending || hasBankPending
            ? 'pill pill-warn'
            : 'pill pill-success',
        attention: hasCashDebt || hasKycPending || hasBankPending || !hasFreshLocation,
        sortPriority:
          (hasCashDebt ? 5 : 0) +
          (hasKycPending ? 3 : 0) +
          (hasBankPending ? 2 : 0) +
          (!hasFreshLocation ? 1 : 0),
      };
    })
    .sort((a, b) => b.sortPriority - a.sortPriority);
  return { rows, attentionCount: rows.filter((row) => row.attention).length };
}

function participantNames(booking: AdminBooking) {
  return (booking.participants ?? [])
    .map((participant) =>
      operatorDisplayText(
        participant.providerProfile?.displayName ?? participant.providerProfile?.user?.fullName,
      ),
    )
    .filter(Boolean) as string[];
}

function bookingNextAction(booking: AdminBooking) {
  if (booking.status === 'OPEN_MATCHING') return 'Monitor Partner response window and customer choice list.';
  if (booking.status === 'MATCHED')
    return 'Confirm Partner starts service when ready; chat should be available.';
  if (booking.status === 'IN_SERVICE') return 'Keep chat visible until Partner completion.';
  if (booking.status === 'COMPLETED')
    return 'Check payment, earning, tax, wallet, and chat archive closeout.';
  if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED')
    return 'Check payment release, refund, and customer notice.';
  return 'Open booking detail for the latest factual state.';
}

function bookingStatusClass(status: string) {
  if (status === 'OPEN_MATCHING') return 'pill pill-warn';
  if (status === 'IN_SERVICE' || status === 'MATCHED') return 'pill pill-info';
  if (status === 'COMPLETED') return 'pill pill-success';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'pill pill-danger';
  return 'pill';
}

export function auditActivityArea(log: AdminAuditLog) {
  if (isNotificationAuditLog(log)) {
    return 'Notification audit';
  }
  return 'Ops note';
}

function auditActivityClassName(log: AdminAuditLog) {
  if (isNotificationAuditLog(log)) {
    return 'pill pill-info';
  }
  return log.action.endsWith('.ops_note.add') ? 'pill pill-info' : 'pill';
}

export function relatedHref(log: AdminAuditLog) {
  const metadata = asRecord(log.metadata);
  const bookingId = stringValue(metadata.bookingId);
  const customerId = stringValue(metadata.customerProfileId);
  const notificationId = stringValue(metadata.notificationId) ?? notificationTargetId(log.target);
  const providerId =
    stringValue(metadata.providerProfileId) ??
    stringValue(metadata.partnerProfileId) ??
    stringValue(metadata.providerId);
  if (bookingId) return `/bookings/${bookingId}`;
  if (customerId) return `/customers/${customerId}`;
  if (notificationId) {
    return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
  }
  if (providerId) return `/partners/${providerId}`;
  if (log.target.startsWith('booking:')) return `/bookings/${log.target.slice('booking:'.length)}`;
  if (log.target.startsWith('customer:')) return `/customers/${log.target.slice('customer:'.length)}`;
  if (log.target.startsWith('provider:')) return `/partners/${log.target.slice('provider:'.length)}`;
  if (isNotificationAuditLog(log)) return '/audit-log?bucket=Notification&range=all';
  if (log.target === 'operations:handoff') return '/operations-handoff';
  return '/audit-log';
}

function isNotificationAuditLog(log: AdminAuditLog) {
  return log.action.startsWith('notification.') || log.target.startsWith('notification:');
}

function notificationTargetId(target: string) {
  return target.startsWith('notification:') ? target.slice('notification:'.length) : null;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function humanizeAction(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
