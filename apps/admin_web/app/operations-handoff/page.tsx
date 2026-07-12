import {
  AdminAuditLog,
  AdminBooking,
  AdminBookingDetail,
  AdminCashSettlementSummary,
  AdminCustomer,
  AdminEarning,
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminPayment,
  AdminPayoutBatch,
  AdminProvider,
  AdminRefund,
  adminGet,
} from '../../lib/admin-api';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { AdminPageTemplate } from '../../components/admin-page-template';
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
import { buildOperatorNotes } from './operations-handoff-operator-notes';
import { OperationsHandoffOperatorNotesSection } from './operations-handoff-operator-notes-section';
import {
  buildHandoffReadinessChecklist,
  countOpenHandoffChecklistItems,
} from './operations-handoff-readiness-checklist';
import {
  buildActivityStreamCsvHref,
  buildOperationsHandoffDataHrefs,
  buildOperationsHandoffFailedNotificationCount,
  buildOperationsHandoffFilters,
  buildOperationsHandoffRangeData,
  emptyCashSettlementSummary,
} from './operations-handoff-page-model';
import { OperationsHandoffReadinessChecklistSection } from './operations-handoff-readiness-checklist-section';
import {
  buildCustomerSignals,
  buildPartnerSignals,
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
    notificationSummary,
    auditLogs,
    cashSummary,
    chatArchive,
  ] = await Promise.all([
    adminGet<AdminBooking[]>(dataHrefs.bookingsHref, []),
    dataHrefs.customersHref
      ? adminGet<AdminCustomer[]>(dataHrefs.customersHref, [])
      : Promise.resolve<AdminCustomer[]>([]),
    dataHrefs.partnersHref
      ? adminGet<AdminProvider[]>(dataHrefs.partnersHref, [])
      : Promise.resolve<AdminProvider[]>([]),
    adminGet<AdminEarning[]>(dataHrefs.earningsHref, []),
    adminGet<AdminPayment[]>(dataHrefs.paymentsHref, []),
    adminGet<AdminRefund[]>(dataHrefs.refundsHref, []),
    adminGet<AdminPayoutBatch[]>(dataHrefs.payoutBatchesHref, []),
    dataHrefs.notificationsHref
      ? adminGet<AdminNotification[]>(dataHrefs.notificationsHref, [])
      : Promise.resolve<AdminNotification[]>([]),
    adminGet<AdminNotificationBoardSummary | null>(dataHrefs.notificationSummaryHref, null),
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
  const financeRows = buildFinanceRows(rangeEarnings);
  const financeHandoffActions = buildFinanceHandoffActionMap({
    payments: rangePayments,
    refunds: rangeRefunds,
    payouts: rangePayouts,
    earnings: rangeEarnings,
    cashSummary,
  });
  const customerSignals = buildCustomerSignals(customers);
  const partnerSignals = buildPartnerSignals(partners, cashSummary);
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const failedNotificationCount = buildOperationsHandoffFailedNotificationCount(
    notifications,
    notificationSummary,
  );
  const immediateActions = buildImmediateActionQueue({
    bookings,
    matchingBookings,
    inServiceBookings,
    failedNotificationCount,
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
    failedNotificationCount,
    failedNotifications,
    cashSummary,
    partnerSignals,
    customerSignals,
    operatorNotes,
  });
  const checklistNeedsReview = countOpenHandoffChecklistItems(handoffChecklist);

  return (
    <AdminPageTemplate
      contentClassName="operations-handoff-page"
      description="Review past operations across bookings, chat, wallet, finance, alerts, and operator notes without mixing them into the live Start Shift board."
      title="Operations History"
    >
      <OperationsHandoffDateRangeSection range={filters.range} />

      <OperationsHandoffReadinessChecklistSection
        openCount={checklistNeedsReview}
        rows={handoffChecklist}
      />

      <OperationsHandoffImmediateActionSection actions={immediateActions} />

      <OperationsHandoffFinanceActionSection actions={financeHandoffActions} />

      <AdminDetailGrid ariaLabel="Operations brief and history notes" className="admin-mb-16">
        <OperationsHandoffShiftBriefSection
          activeBookingCount={activeBookings.length}
          cashDebtPartnerCount={cashSummary.providerCount}
          customerSignalCount={customerSignals.length}
          failedNotificationCount={failedNotificationCount}
          matchingBookingCount={matchingBookings.length}
          partnerIssueCount={partnerSignals.attentionCount}
        />
        <OperationsHandoffOperatorNotesSection notes={operatorNotes} />
      </AdminDetailGrid>

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
    </AdminPageTemplate>
  );
}

function OperationsHandoffFullDetailsLink({ range }: { readonly range: string }) {
  const query = new URLSearchParams({ details: 'all' });
  if (range !== 'today') {
    query.set('range', range);
  }

  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href={`/operations-handoff?${query.toString()}`}>
          Load full history details
        </AdminFormControlLink>
      }
      className="admin-mb-16 operations-handoff-full-details-card"
      description="Activity stream, retained chat archive, booking queue, customer/Partner signal lists, and finance closeout rows are loaded only when an operator opens full history details."
      title="Detailed history lists"
    />
  );
}
