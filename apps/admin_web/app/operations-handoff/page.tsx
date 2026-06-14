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
import {
  buildUnifiedActivityStream,
  filterActivityStreamByRange,
} from './operations-handoff-activity-stream';
import { OperationsHandoffActivityStreamSection } from './operations-handoff-activity-stream-section';
import {
  ACTIVE_BOOKING_STATUSES,
  bookingPartnerName,
  bookingStatusClass,
  buildBookingHandoffQueue,
} from './operations-handoff-booking-queue';
import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { buildFinanceHandoffActionMap } from './operations-handoff-finance-actions';
import { buildFinanceRows } from './operations-handoff-finance-rows';
import { buildImmediateActionQueue } from './operations-handoff-immediate-actions';
import { OperationsHandoffMetricGridSection } from './operations-handoff-metric-grid-section';
import { buildOperatorNotes } from './operations-handoff-operator-notes';
import { OperationsHandoffOperatorNotesSection } from './operations-handoff-operator-notes-section';
import {
  buildHandoffReadinessChecklist,
  countOpenHandoffChecklistItems,
} from './operations-handoff-readiness-checklist';
import {
  buildChatSignals,
  buildCustomerSignals,
  buildPartnerSignals,
  buildPresence,
} from './operations-handoff-signals';
import { OperationsHandoffShiftBriefSection } from './operations-handoff-shift-brief-section';

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

  const activeBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status));
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
  const checklistNeedsReview = countOpenHandoffChecklistItems(handoffChecklist);

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
        <OperationsHandoffShiftBriefSection
          activeBookingCount={activeBookings.length}
          cashDebtPartnerCount={cashSummary.providerCount}
          customerSignalCount={customerSignals.length}
          failedNotificationCount={failedNotifications.length}
          matchingBookingCount={matchingBookings.length}
          partnerIssueCount={partnerSignals.attentionCount}
        />
        <OperationsHandoffOperatorNotesSection notes={operatorNotes} />
      </section>

      <OperationsHandoffActivityStreamSection csvHref={activityStreamCsvHref} rows={activityStream} />

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

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
