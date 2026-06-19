import { redirect } from 'next/navigation';

import { AdminAuditLog, AdminBooking, AdminOperationalPolicySetting, adminGet } from '../../lib/admin-api';
import { BookingMonitor } from './booking-monitor';
import type { BookingTableGroupKey } from './booking-monitor-list-section';
import {
  bookingMonitorPagePathForView,
  completedBookingViewOptions,
  postMatchCancellationBookingViewOptions,
  realtimeBookingViewOptions,
} from './booking-monitor-options';
import { buildBookingsPageModel } from './booking-page-model';
import type { BookingPageView } from './booking-page-params';

export type BookingMonitorRouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

type BookingMonitorRouteKind = 'all' | 'completed' | 'postMatchCancellations';

type BookingMonitorRouteProps = {
  readonly kind: BookingMonitorRouteKind;
  readonly searchParams?: BookingMonitorRouteSearchParams;
};

const bookingMonitorRouteConfig = {
  all: {
    defaultView: 'all',
    pageDescription: 'Live operational view for request intake, matching, Partner handoff, chat, and active service checks.',
    pagePath: '/bookings',
    pageTitle: 'Booking Monitor',
    showMatchingEscalation: false,
    showEmptyViewOptions: false,
    showPostMatchCancellationBoard: false,
    summaryLabels: [
      'Active bookings',
      'Open matching',
      'Matched',
      'Follow-up queue',
      'Blocked create attempts',
    ],
    tableGroupKeys: ['pre-match', 'post-match-in-progress'],
    viewOptions: realtimeBookingViewOptions,
  },
  completed: {
    defaultView: 'closeout',
    pageDescription: 'Completed booking workspace for closeout, payment, wallet debt, pricing, refund, and expired records.',
    pagePath: '/bookings/completed',
    pageTitle: 'Completed Bookings',
    showMatchingEscalation: false,
    showEmptyViewOptions: true,
    showPostMatchCancellationBoard: false,
    summaryLabels: [
      'Closeout checks',
      'Payment checks',
      'Pricing checks',
      'Refund review',
      'Expired',
    ],
    tableGroupKeys: ['completed'],
    viewOptions: completedBookingViewOptions,
  },
  postMatchCancellations: {
    defaultView: 'post-match-cancellations',
    pageDescription: 'Post-match cancellation workspace for fee restoration, evidence review, no-show checks, and final admin decisions.',
    pagePath: '/bookings/post-match-cancellations',
    pageTitle: 'Post-match Cancellations',
    showMatchingEscalation: false,
    showEmptyViewOptions: true,
    showPostMatchCancellationBoard: false,
    summaryLabels: [
      'No-show',
      'Chat evidence review',
      'Evidence missing',
      'Payment checks',
      'Follow-up queue',
    ],
    tableGroupKeys: ['post-match-cancellations-pending', 'post-match-cancellations-resolved'],
    viewOptions: postMatchCancellationBookingViewOptions,
  },
} satisfies Record<
  BookingMonitorRouteKind,
  {
    readonly defaultView: BookingPageView;
    readonly pageDescription: string;
    readonly pagePath: string;
    readonly pageTitle: string;
    readonly showMatchingEscalation: boolean;
    readonly showEmptyViewOptions: boolean;
    readonly showPostMatchCancellationBoard: boolean;
    readonly summaryLabels: readonly string[];
    readonly tableGroupKeys: readonly BookingTableGroupKey[];
    readonly viewOptions: typeof realtimeBookingViewOptions;
  }
>;

export async function renderBookingMonitorRoute({ kind, searchParams }: BookingMonitorRouteProps) {
  const [bookings, auditLogs, policySettings] = await Promise.all([
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const params = await searchParams;
  const model = buildBookingsPageModel({
    auditLogs,
    params,
    policySettings,
  });
  const targetPath = bookingMonitorPagePathForView(model.initialView);

  if (kind === 'all' && targetPath !== '/bookings') {
    redirect(`${targetPath}${queryStringForRedirect(params, model.initialView)}`);
  }

  const config = bookingMonitorRouteConfig[kind];
  const initialView = resolveInitialViewForRoute(model.initialView, config.defaultView, config.viewOptions);

  return (
    <BookingMonitor
      bookings={bookings}
      bookingCreateRejections={model.bookingCreateRejections}
      dateRangePath={config.pagePath}
      dateRangeSearchParams={searchParamEntries(params)}
      initialCustomDateFrom={model.initialCustomDateFrom}
      initialCustomDateTo={model.initialCustomDateTo}
      initialDateRangeFilter={model.initialDateRangeFilter}
      initialView={initialView}
      initialNowMs={Date.now()}
      initialEvidenceFilter={model.initialEvidenceFilter}
      initialGateFilter={model.initialGateFilter}
      liveOperationsPolicy={model.liveOperationsPolicy}
      pageDescription={config.pageDescription}
      pageTitle={config.pageTitle}
      showEmptyViewOptions={config.showEmptyViewOptions}
      showMatchingEscalation={config.showMatchingEscalation}
      showPostMatchCancellationBoard={config.showPostMatchCancellationBoard}
      summaryLabels={config.summaryLabels}
      tableGroupKeys={config.tableGroupKeys}
      viewOptions={config.viewOptions}
    />
  );
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
