import { redirect } from 'next/navigation';

import {
  AdminAuditLog,
  AdminCompletedBookingOperationsSummary,
  AdminBookingMonitorSummary,
  AdminBookingPage,
  AdminOperationalPolicySetting,
  AdminPostMatchCancellationOperationsSummary,
  adminGetResult,
} from '../../lib/admin-api';
import { dashboardSourceState } from '../dashboard-trace-summary';
import { BookingMonitor } from './booking-monitor';
import type { BookingTableGroupKey } from './booking-monitor-list-section';
import {
  bookingMonitorPagePathForView,
  completedBookingViewOptions,
  postMatchCancellationBookingViewOptions,
  realtimeBookingViewOptions,
} from './booking-monitor-options';
import {
  buildBookingMonitorRouteLoadPlan,
  type BookingMonitorRouteKind,
} from './booking-monitor-route-load-plan';
import { bookingMonitorIsRecordsView } from './booking-monitor-realtime';
import { buildBookingsPageModel } from './booking-page-model';
import type { BookingPageView } from './booking-page-params';
import { readPostMatchCancellationReasonFilter } from './booking-post-match-cancellation-reason';

export type BookingMonitorRouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

type BookingMonitorRouteProps = {
  readonly kind: BookingMonitorRouteKind;
  readonly searchParams?: BookingMonitorRouteSearchParams;
};

const bookingMonitorRouteConfig = {
  all: {
    defaultView: 'attention',
    pageDescription: 'Resolve urgent bookings, then monitor matching and services.',
    pagePath: '/bookings',
    pageTitle: 'Live bookings',
    showCompletedCloseoutBoard: false,
    showMatchingEscalation: false,
    showEmptyViewOptions: true,
    showPostMatchCancellationBoard: false,
    summaryLabels: ['Needs action', 'Live bookings', 'Blocked today'],
    tableGroupKeys: ['pre-match', 'post-match-in-progress', 'closed-records'],
    useOperationsTable: true,
    viewOptions: realtimeBookingViewOptions,
  },
  completed: {
    defaultView: 'payment',
    pageDescription:
      'Review completed, refunded, and expired bookings that still need payment or settlement follow-up.',
    pagePath: '/bookings/completed',
    pageTitle: 'Closeout operations',
    showCompletedCloseoutBoard: true,
    showMatchingEscalation: false,
    showEmptyViewOptions: true,
    showPostMatchCancellationBoard: false,
    summaryLabels: ['Closeout checks', 'Payment checks', 'Cash debt', 'Refund review'],
    tableGroupKeys: ['completed', 'closed-records'],
    useOperationsTable: true,
    viewOptions: completedBookingViewOptions,
  },
  postMatchCancellations: {
    defaultView: 'manual-decision',
    pageDescription:
      'Review cancellations after a match, confirm evidence, and decide the Partner fee outcome.',
    pagePath: '/bookings/post-match-cancellations',
    pageTitle: 'Post-match cancellation review',
    showCompletedCloseoutBoard: false,
    showMatchingEscalation: false,
    showEmptyViewOptions: true,
    showPostMatchCancellationBoard: true,
    summaryLabels: ['Needs decision', 'Overdue open', 'Auto-resolved', 'Admin kept fee'],
    tableGroupKeys: ['post-match-cancellations-pending', 'post-match-cancellations-resolved'],
    useOperationsTable: true,
    viewOptions: postMatchCancellationBookingViewOptions,
  },
} satisfies Record<
  BookingMonitorRouteKind,
  {
    readonly defaultView: BookingPageView;
    readonly pageDescription: string;
    readonly pagePath: string;
    readonly pageTitle: string;
    readonly showCompletedCloseoutBoard: boolean;
    readonly showMatchingEscalation: boolean;
    readonly showEmptyViewOptions: boolean;
    readonly showPostMatchCancellationBoard: boolean;
    readonly summaryLabels: readonly string[];
    readonly tableGroupKeys: readonly BookingTableGroupKey[];
    readonly useOperationsTable: boolean;
    readonly viewOptions: typeof realtimeBookingViewOptions;
  }
>;

const EMPTY_BOOKING_PAGE: AdminBookingPage = {
  items: [],
  pagination: { page: 1, pageSize: 20, totalPages: 1, totalRows: 0 },
};

const EMPTY_BOOKING_MONITOR_SUMMARY: AdminBookingMonitorSummary = {
  activeBookings: 0,
  blockedCreateAttemptsToday: 0,
  generatedAt: '',
  matchingNow: 0,
  needsAction: 0,
  serviceInProgress: 0,
};

const EMPTY_COMPLETED_OPERATIONS_SUMMARY: AdminCompletedBookingOperationsSummary = {
  cashDebt: 0,
  closeoutChecks: 0,
  expired: 0,
  generatedAt: '',
  oldestCloseoutAt: null,
  paymentChecks: 0,
  pricingChecks: 0,
  refundReview: 0,
  totalRecords: 0,
};

const EMPTY_POST_MATCH_CANCELLATION_SUMMARY: AdminPostMatchCancellationOperationsSummary = {
  adminApprovedCount: 0,
  adminHeldCount: 0,
  autoResolvedCount: 0,
  generatedAt: '',
  needsDecisionCount: 0,
  noShowReviewCount: 0,
  overdueOpenCount: 0,
  resolvedCount: 0,
  unknownLegacyCount: 0,
};

export async function renderBookingMonitorRoute({ kind, searchParams }: BookingMonitorRouteProps) {
  const params = await searchParams;
  const loadPlan = buildBookingMonitorRouteLoadPlan(params, kind);
  const [bookingPageResult, auditLogsResult, policySettingsResult, routeSummaryResult] = await Promise.all([
    adminGetResult<AdminBookingPage>(loadPlan.bookingsHref, EMPTY_BOOKING_PAGE),
    adminGetResult<AdminAuditLog[]>(loadPlan.bookingGateAuditHref, []),
    adminGetResult<AdminOperationalPolicySetting[]>(loadPlan.policySettingsHref, []),
    bookingSummaryRequest(kind, loadPlan.summaryHref),
  ]);
  const bookingPage = bookingPageResult.data;
  const routeSummary = routeSummaryResult.data;
  const unavailableSourceCount = [
    bookingPageResult,
    auditLogsResult,
    policySettingsResult,
    routeSummaryResult,
  ].filter((result) => !result.ok).length;
  const model = buildBookingsPageModel({
    auditLogs: auditLogsResult.data,
    params,
    policySettings: policySettingsResult.data,
  });
  const targetPath = bookingMonitorPagePathForView(model.initialView);

  if (kind === 'all' && targetPath !== '/bookings') {
    redirect(`${targetPath}${queryStringForRedirect(params, model.initialView)}`);
  }

  const config = bookingMonitorRouteConfig[kind];
  const initialView = resolveInitialViewForRoute(model.initialView, config.defaultView, config.viewOptions);
  const isRecordsView = kind === 'all' && bookingMonitorIsRecordsView('/bookings', initialView);

  return (
    <BookingMonitor
      bookings={bookingPage.items}
      bookingListLoadFailed={!bookingPageResult.ok}
      bookingCreateRejections={model.bookingCreateRejections}
      queueAgeCounts={bookingPage.queueAgeCounts}
      queueSla={bookingPage.queueSla}
      dateRangePath={config.pagePath}
      dateRangeSearchParams={searchParamEntries(params)}
      dataGeneratedAt={routeSummary.generatedAt}
      dataPartialSourceCount={unavailableSourceCount}
      dataScope={kind === 'all' && !isRecordsView ? 'all-open' : 'historical'}
      dataSourceState={
        unavailableSourceCount === 4
          ? 'unavailable'
          : dashboardSourceState(routeSummary, routeSummary.generatedAt)
      }
      initialCustomDateFrom={model.initialCustomDateFrom}
      initialCustomDateTo={model.initialCustomDateTo}
      initialDateRangeFilter={
        kind === 'postMatchCancellations' && initialView === 'post-match-cancellations' && !params?.dateRange
          ? '30d'
          : model.initialDateRangeFilter
      }
      initialView={initialView}
      initialNowMs={Date.now()}
      initialEvidenceFilter={model.initialEvidenceFilter}
      initialGateFilter={model.initialGateFilter}
      initialSearchQuery={singleSearchParam(params?.q) ?? ''}
      initialCancellationReasonFilter={
        kind === 'postMatchCancellations' && initialView === 'no-show'
          ? 'all'
          : readPostMatchCancellationReasonFilter(params?.cancellationReason)
      }
      liveOperationsPolicy={model.liveOperationsPolicy}
      pageDescription={
        isRecordsView
          ? 'Search booking history in the selected period. Newest records appear first by default.'
          : config.pageDescription
      }
      pageTitle={isRecordsView ? 'Booking records' : config.pageTitle}
      completedOperationsSummary={
        kind === 'completed' ? (routeSummary as AdminCompletedBookingOperationsSummary) : undefined
      }
      overviewSummary={kind === 'all' ? (routeSummary as AdminBookingMonitorSummary) : undefined}
      postMatchCancellationOperationsSummary={
        kind === 'postMatchCancellations'
          ? (routeSummary as AdminPostMatchCancellationOperationsSummary)
          : undefined
      }
      serverPagination={bookingPage.pagination}
      showCompletedCloseoutBoard={config.showCompletedCloseoutBoard}
      showEmptyViewOptions={config.showEmptyViewOptions}
      showMatchingEscalation={config.showMatchingEscalation}
      showPostMatchCancellationBoard={config.showPostMatchCancellationBoard}
      summaryLabels={config.summaryLabels}
      tableGroupKeys={config.tableGroupKeys}
      useOperationsTable={config.useOperationsTable}
      viewOptions={config.viewOptions}
    />
  );
}

function bookingSummaryRequest(kind: BookingMonitorRouteKind, href: string) {
  switch (kind) {
    case 'completed':
      return adminGetResult<AdminCompletedBookingOperationsSummary>(
        href,
        EMPTY_COMPLETED_OPERATIONS_SUMMARY,
      );
    case 'postMatchCancellations':
      return adminGetResult<AdminPostMatchCancellationOperationsSummary>(
        href,
        EMPTY_POST_MATCH_CANCELLATION_SUMMARY,
      );
    case 'all':
    default:
      return adminGetResult<AdminBookingMonitorSummary>(href, EMPTY_BOOKING_MONITOR_SUMMARY);
  }
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function searchParamEntries(params: Record<string, string | string[] | undefined> | undefined) {
  const entries: Array<readonly [string, string]> = [];

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => entries.push([key, item]));
    } else if (value !== undefined) {
      entries.push([key, value]);
    }
  }

  return entries;
}

function resolveInitialViewForRoute(
  requestedView: BookingPageView,
  defaultView: BookingPageView,
  viewOptions: readonly { readonly view: BookingPageView }[],
) {
  return viewOptions.some((option) => option.view === requestedView) ? requestedView : defaultView;
}

function queryStringForRedirect(
  params: Record<string, string | string[] | undefined> | undefined,
  view: BookingPageView,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  searchParams.set('view', view);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
