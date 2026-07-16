import { BellRing, CalendarClock, HandCoins, ListChecks, ReceiptText, Sparkles } from 'lucide-react';
import {
  AdminAuditLog,
  AdminBooking,
  AdminChatArchiveBooking,
  AdminCashSettlementSummary,
  AdminCustomerDirectoryRow,
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
import { AdminActionCard, AdminDetailGrid, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
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
import { paginateOperationsHandoffRows } from './operations-handoff-pagination';
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
  operationsHandoffDetailPageHref,
} from './operations-handoff-page-model';
import { OperationsHandoffReadinessChecklistSection } from './operations-handoff-readiness-checklist-section';
import {
  buildCustomerSignals,
  buildPartnerSignals,
} from './operations-handoff-signals';
import { OperationsHandoffShiftBriefSection } from './operations-handoff-shift-brief-section';
import {
  OperationsHandoffReviewOrderSection,
  type OperationsHandoffReviewOrderItem,
} from './operations-handoff-review-order-section';

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
      ? adminGet<AdminCustomerDirectoryRow[]>(dataHrefs.customersHref, [])
      : Promise.resolve<AdminCustomerDirectoryRow[]>([]),
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
      ? adminGet<AdminChatArchiveBooking[]>(dataHrefs.chatArchiveHref, [])
      : Promise.resolve<AdminChatArchiveBooking[]>([]),
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
  const partnerAttentionSignals = partnerSignals.rows.filter((partner) => partner.attention);
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
  const issueLaneCount = immediateActions.filter((item) => !item.statusClass.includes('success')).length;
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
    ? buildActivityStreamCsvHref(
        paginateOperationsHandoffRows(activityStream, filters.detailPages.activity).rows,
      )
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
  const currentMode = shouldRenderFullDetails ? 'all' : 'summary';
  const reviewOrderItems: OperationsHandoffReviewOrderItem[] = [
    {
      count: checklistNeedsReview,
      detail: 'Open handoff checks still need a final operator decision.',
      href: operationsHandoffSectionHref(filters.range, currentMode, 'operations-handoff-review-checklist'),
      id: 'review-checks',
      label: 'Open review checks',
      priority: 1,
      tone: 'warn',
    },
    {
      count: issueLaneCount,
      detail: 'Historical issue lanes still need booking, chat, cash, alert, or note follow-up.',
      href: operationsHandoffSectionHref(filters.range, currentMode, 'operations-handoff-issue-signals'),
      id: 'issue-lanes',
      label: 'Issue signals',
      priority: 2,
      tone: 'warn',
    },
    {
      count: partnerAttentionSignals.length,
      detail: 'Partner history rows need location, identity, bank, wallet, or payout follow-up.',
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-partner-history'),
      id: 'partner-signals',
      label: 'Partner signals',
      priority: 3,
      tone: 'warn',
    },
    {
      count: customerSignals.length,
      detail: 'Customer history rows show booking, payment, address, and chat evidence.',
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-customer-history'),
      id: 'customer-signals',
      label: 'Customer history',
      priority: 4,
      tone: 'info',
    },
    {
      count: financeRows.length,
      detail: 'Finance rows should be checked before period closeout or later reversal review.',
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-finance-closeout'),
      id: 'finance-rows',
      label: 'Finance rows',
      priority: 5,
      tone: 'info',
    },
    {
      count: bookingQueue.length,
      detail: 'Booking rows preserve booking state, payment, Partner, chat, and next action context.',
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-booking-history'),
      id: 'booking-rows',
      label: 'Booking history',
      priority: 6,
      tone: 'info',
    },
    {
      count: activityStream.length,
      detail: 'The unified stream shows dated booking, chat, notification, audit, and finance movement.',
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-activity-stream'),
      id: 'activity-stream',
      label: 'Activity stream',
      priority: 7,
      tone: 'info',
    },
  ];
  const operationsHistoryMetrics = [
    {
      href: operationsHandoffSectionHref(filters.range, currentMode, 'operations-handoff-review-checklist'),
      icon: ListChecks,
      label: 'Open review checks',
      value: checklistNeedsReview,
      helper: 'Checklist items that still need operator review.',
    },
    {
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-booking-history'),
      icon: CalendarClock,
      label: 'Booking rows',
      value: bookingQueue.length,
      helper: 'Bookings returned for the selected history window.',
    },
    {
      href: '/notifications',
      icon: BellRing,
      label: 'Failed alerts',
      value: failedNotificationCount,
      helper: 'Notification delivery failures found in the selected range.',
    },
    {
      href: '/cash-settlements',
      icon: HandCoins,
      label: 'Cash debt partners',
      value: cashSummary.providerCount,
      helper: 'Partners with cash booking debt in the settlement summary.',
    },
    {
      href: operationsHandoffSectionHref(filters.range, 'all', 'operations-handoff-finance-closeout'),
      icon: ReceiptText,
      label: 'Finance rows',
      value: financeRows.length,
      helper: 'Finance history rows loaded for closeout review.',
    },
  ];

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink className="button-secondary" href="/">
            <Sparkles aria-hidden="true" size={16} />
            Start Shift
          </AdminFormControlLink>
          <AdminFormControlLink
            className={shouldRenderFullDetails ? 'button-secondary' : 'button-primary'}
            href={operationsHandoffModeHref(filters.range, shouldRenderFullDetails ? 'summary' : 'all')}
          >
            <ListChecks aria-hidden="true" size={16} />
            {shouldRenderFullDetails ? 'Summary view' : 'Full history'}
          </AdminFormControlLink>
        </>
      }
      contentClassName="operations-handoff-page"
      description="Review past operations across bookings, chat, wallet, finance, alerts, and operator notes without mixing them into the live Start Shift board."
      metrics={operationsHistoryMetrics}
      title="Operations History"
    >
      <OperationsHandoffDateRangeSection detailsMode={filters.detailsMode} range={filters.range} />

      <OperationsHandoffReviewOrderSection items={reviewOrderItems} />

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
          <OperationsHandoffActivityStreamSection
            csvHref={activityStreamCsvHref}
            pagination={{
              activePage: filters.detailPages.activity,
              ariaLabel: 'Operations activity pagination',
              hrefForPage: operationsHandoffDetailPageHref(filters, 'activity'),
              itemLabel: 'activity rows',
              totalRows: activityStream.length,
            }}
            rows={activityStream}
          />

          <OperationsHandoffBookingQueueSection
            bookings={bookingQueue}
            pagination={{
              activePage: filters.detailPages.bookings,
              ariaLabel: 'Operations booking history pagination',
              hrefForPage: operationsHandoffDetailPageHref(filters, 'bookings'),
              itemLabel: 'booking rows',
              totalRows: bookingQueue.length,
            }}
          />

          <OperationsHandoffCustomerPartnerSection
            customerPagination={{
              activePage: filters.detailPages.customers,
              ariaLabel: 'Operations customer signal pagination',
              hrefForPage: operationsHandoffDetailPageHref(filters, 'customers'),
              itemLabel: 'customer signals',
              totalRows: customerSignals.length,
            }}
            customers={customerSignals}
            partnerPagination={{
              activePage: filters.detailPages.partners,
              ariaLabel: 'Operations Partner signal pagination',
              hrefForPage: operationsHandoffDetailPageHref(filters, 'partners'),
              itemLabel: 'partner signals',
              totalRows: partnerAttentionSignals.length,
            }}
            partners={partnerSignals.rows}
          />

          <OperationsHandoffFinanceCloseoutSection
            pagination={{
              activePage: filters.detailPages.finance,
              ariaLabel: 'Operations finance history pagination',
              hrefForPage: operationsHandoffDetailPageHref(filters, 'finance'),
              itemLabel: 'finance rows',
              totalRows: financeRows.length,
            }}
            rows={financeRows}
          />
        </>
      ) : (
        <OperationsHandoffFullDetailsLink range={filters.range} />
      )}
    </AdminPageTemplate>
  );
}

function OperationsHandoffFullDetailsLink({ range }: { readonly range: string }) {
  const fullHistoryHref = operationsHandoffModeHref(range, 'all');
  const fullHistorySections = [
    {
      detail: 'Dated booking, chat, notification, audit, and finance movement.',
      href: `${fullHistoryHref}#operations-handoff-activity-stream`,
      label: 'Activity stream',
      value: 'Timeline',
    },
    {
      detail: 'Past booking state, payment, Partner, chat, and next action context.',
      href: `${fullHistoryHref}#operations-handoff-booking-history`,
      label: 'Booking history',
      value: 'Bookings',
    },
    {
      detail: 'Customer support evidence and Partner follow-up rows for the selected window.',
      href: `${fullHistoryHref}#operations-handoff-customer-history`,
      label: 'Customer and Partner signals',
      value: 'People',
    },
    {
      detail: 'Earning, payment, payout, refund, and cash debt rows for closeout review.',
      href: `${fullHistoryHref}#operations-handoff-finance-closeout`,
      label: 'Finance closeout',
      value: 'Money',
    },
  ];

  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href={fullHistoryHref}>
          Load full history details
        </AdminFormControlLink>
      }
      className="admin-mb-16 operations-handoff-full-details-card"
      description="Full history opens these paginated review tables without loading them on the summary page."
      title="Detailed history lists"
    >
      <AdminTaskGrid>
        {fullHistorySections.map((section) => (
          <AdminActionCard
            actionLabel="Open in full history"
            detail={section.detail}
            href={section.href}
            key={section.label}
            title={section.label}
            value={section.value}
            variant="ops-task"
          />
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function operationsHandoffModeHref(range: string, mode: 'all' | 'summary') {
  const query = new URLSearchParams();

  if (mode === 'all') {
    query.set('details', 'all');
  }

  if (range !== '7d') {
    query.set('range', range);
  } else if (mode === 'all') {
    query.set('range', range);
  }

  const search = query.toString();
  return search ? `/operations-handoff?${search}` : '/operations-handoff';
}

function operationsHandoffSectionHref(range: string, mode: 'all' | 'summary', sectionId: string) {
  return `${operationsHandoffModeHref(range, mode)}#${sectionId}`;
}
