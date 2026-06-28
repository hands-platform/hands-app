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
import {
  buildUnifiedActivityStream,
  filterActivityStreamByRange,
} from './operations-handoff-activity-stream';
import { OperationsHandoffActivityStreamSection } from './operations-handoff-activity-stream-section';
import {
  ACTIVE_BOOKING_STATUSES,
  buildBookingHandoffQueue,
} from './operations-handoff-booking-queue';
import { OperationsHandoffBookingQueueSection } from './operations-handoff-booking-queue-section';
import { OperationsHandoffCustomerPartnerSection } from './operations-handoff-customer-partner-section';
import { OperationsHandoffDateRangeSection } from './operations-handoff-date-range-section';
import { buildFinanceHandoffActionMap } from './operations-handoff-finance-actions';
import { OperationsHandoffFinanceActionSection } from './operations-handoff-finance-action-section';
import { OperationsHandoffFinanceCloseoutSection } from './operations-handoff-finance-closeout-section';
import { buildFinanceRows } from './operations-handoff-finance-rows';
import { buildImmediateActionQueue } from './operations-handoff-immediate-actions';
import { OperationsHandoffImmediateActionSection } from './operations-handoff-immediate-action-section';
import { OperationsHandoffMetricGridSection } from './operations-handoff-metric-grid-section';
import { buildOperatorNotes } from './operations-handoff-operator-notes';
import { OperationsHandoffOperatorNotesSection } from './operations-handoff-operator-notes-section';
import {
  buildHandoffReadinessChecklist,
  countOpenHandoffChecklistItems,
} from './operations-handoff-readiness-checklist';
import {
  buildActivityStreamCsvHref,
  buildLatestFcmSentSummary,
  buildOperationsHandoffDataHrefs,
  buildOperationsHandoffFilters,
  buildOperationsHandoffRangeData,
  emptyCashSettlementSummary,
} from './operations-handoff-page-model';
import { OperationsHandoffReadinessChecklistSection } from './operations-handoff-readiness-checklist-section';
import {
  buildChatSignals,
  buildCustomerSignals,
  buildPartnerSignals,
  buildPresence,
} from './operations-handoff-signals';
import { OperationsHandoffShiftBriefSection } from './operations-handoff-shift-brief-section';

type OperationsHandoffSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsHandoffPage({
  searchParams,
}: {
  searchParams?: OperationsHandoffSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = buildOperationsHandoffFilters(resolvedSearchParams);
  const dataHrefs = buildOperationsHandoffDataHrefs(resolvedSearchParams);
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
    adminGet<AdminBooking[]>(dataHrefs.bookingsHref, []),
    adminGet<AdminCustomer[]>(dataHrefs.customersHref, []),
    adminGet<AdminProvider[]>(dataHrefs.partnersHref, []),
    adminGet<AdminEarning[]>(dataHrefs.earningsHref, []),
    adminGet<AdminPayment[]>(dataHrefs.paymentsHref, []),
    adminGet<AdminRefund[]>(dataHrefs.refundsHref, []),
    adminGet<AdminPayoutBatch[]>(dataHrefs.payoutBatchesHref, []),
    adminGet<AdminNotification[]>(dataHrefs.notificationsHref, []),
    adminGet<AdminAppSession[]>(dataHrefs.appSessionsHref, []),
    adminGet<AdminAuditLog[]>(dataHrefs.auditLogsHref, []),
    adminGet<AdminCashSettlementSummary>(
      dataHrefs.cashSettlementSummaryHref,
      emptyCashSettlementSummary(),
    ),
    dataHrefs.chatArchiveHref
      ? adminGet<AdminBookingDetail[]>(dataHrefs.chatArchiveHref, [])
      : Promise.resolve<AdminBookingDetail[]>([]),
  ]);
  const shouldRenderFullDetails = filters.detailsMode === 'all';

  const activeBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status));
  const matchingBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const inServiceBookings = bookings.filter((booking) => booking.status === 'IN_SERVICE');
  const bookingQueue = buildBookingHandoffQueue(bookings);
  const { rangeAuditLogs, rangeEarnings, rangePayments, rangePayouts, rangeRefunds } =
    buildOperationsHandoffRangeData(
      {
        auditLogs,
        earnings,
        payments,
        payouts,
        refunds,
      },
      filters.range,
    );
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
  const latestFcmSentSummary = buildLatestFcmSentSummary(notifications);
  const immediateActions = buildImmediateActionQueue({
    bookings,
    matchingBookings,
    inServiceBookings,
    failedNotifications,
    cashSummary,
    partnerSignals,
    operatorNotes,
  });
  const activityStream = shouldRenderFullDetails
    ? filterActivityStreamByRange(
        buildUnifiedActivityStream({
          bookings,
          chatArchive,
          auditLogs,
          notifications,
          financeRows,
        }),
        filters.range,
      )
    : [];
  const activityStreamCsvHref = shouldRenderFullDetails
    ? buildActivityStreamCsvHref(activityStream)
    : '';
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
    <div className="operations-handoff-page">
      <div className="toolbar">
        <div>
          <h1>Operations Handoff</h1>
          <p className="muted">
            One shift handoff board for factual Customer, Partner, booking, chat, wallet, and app
            activity. Use this before changing operators so open work keeps context.
          </p>
        </div>
      </div>

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

      <OperationsHandoffReadinessChecklistSection
        openCount={checklistNeedsReview}
        rows={handoffChecklist}
      />

      <OperationsHandoffImmediateActionSection actions={immediateActions} />

      <OperationsHandoffFinanceActionSection actions={financeHandoffActions} />

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

      {shouldRenderFullDetails ? (
        <>
          <OperationsHandoffActivityStreamSection csvHref={activityStreamCsvHref} rows={activityStream} />

          <OperationsHandoffBookingQueueSection bookings={bookingQueue} />

          <OperationsHandoffCustomerPartnerSection
            customers={customerSignals}
            partners={partnerSignals.rows}
          />

          <OperationsHandoffFinanceCloseoutSection rows={financeRows} />
        </>
      ) : (
        <OperationsHandoffFullDetailsLink range={filters.range} />
      )}
    </div>
  );
}

function OperationsHandoffFullDetailsLink({ range }: { readonly range: string }) {
  const query = new URLSearchParams({ details: 'all' });
  if (range !== 'today') {
    query.set('range', range);
  }

  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Detailed handoff lists</h2>
          <p className="muted">
            Activity stream, retained chat archive, booking queue, customer/Partner signal lists, and
            finance closeout rows are loaded only when an operator opens full handoff details.
          </p>
        </div>
        <a className="button button-secondary" href={`/operations-handoff?${query.toString()}`}>
          Load full handoff details
        </a>
      </div>
    </section>
  );
}
