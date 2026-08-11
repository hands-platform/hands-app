import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';

export type BookingMonitorViewOption = {
  readonly description: string;
  readonly label: string;
  readonly operatorHint: string;
  readonly view: BookingPageView;
};

export const bookingEvidenceFilterOptions: readonly {
  readonly label: string;
  readonly value: BookingEvidenceFilter;
}[] = [
  { value: 'all', label: 'All evidence' },
  { value: 'address', label: 'Address check' },
  { value: 'partner', label: 'Partner selection check' },
  { value: 'chat', label: 'Chat record check' },
  { value: 'money', label: 'Payment / wallet check' },
  { value: 'location', label: 'Location check' },
  { value: 'alerts', label: 'Alert delivery check' },
  { value: 'closeout', label: 'Closeout evidence check' },
];

export const bookingViewOptions: readonly BookingMonitorViewOption[] = [
  {
    view: 'active',
    label: 'Live now',
    description: 'All bookings currently in matching, dispatch, arrival, or service.',
    operatorHint: 'Monitor current movement. Open Needs action when a row stops progressing.',
  },
  {
    view: 'attention',
    label: 'Needs action',
    description: 'Live bookings stalled for 30 minutes, expired matching, or missing matched chat.',
    operatorHint: 'Start here. Open each booking, confirm the evidence, and move or close the case.',
  },
  {
    view: 'data-anomaly',
    label: 'Data anomaly',
    description: 'Active-state bookings not updated for more than 24 hours and excluded from Live now.',
    operatorHint: 'Confirm the retained evidence, then repair or close the stale state without deleting history.',
  },
  {
    view: 'matching',
    label: 'Matching now',
    description: 'Requests still waiting for a final Partner match.',
    operatorHint: 'Check waiting age, available Partners, and the service address before intervening.',
  },
  {
    view: 'in-service',
    label: 'In service',
    description: 'Current bookings where the matched Partner is providing the service.',
    operatorHint: 'Monitor expected completion. Contact the Partner only when service runs late.',
  },
  {
    view: 'matching-delays',
    label: 'Matching delays',
    description: 'Open matching requests that expired or still have no Partner participation.',
    operatorHint:
      'Re-invite available Partners or contact the waiting customer before the request becomes stale.',
  },
  {
    view: 'first-pick',
    label: 'Preferred pending',
    description: 'Open bookings waiting for the preferred Partner inside the 10-minute deadline.',
    operatorHint:
      'Marketplace participation is already open. Check delivery, view, and response timing without extending the deadline.',
  },
  {
    view: 'marketplace',
    label: 'Open matching',
    description: 'Open matching bookings inside the original customer wait window.',
    operatorHint:
      'Check participation and alert delivery without assuming every open request is visible to every Partner.',
  },
  {
    view: 'customer-choice',
    label: 'Customer choice',
    description: 'Open bookings with participating Partners waiting for customer final selection.',
    operatorHint:
      'Joined Partners are candidates, not final matches. Help the customer choose before the original deadline.',
  },
  {
    view: 'pre-match-cancelled',
    label: 'Pre-match cancelled',
    description: 'Customer cancellations recorded before a final Partner match in the selected period.',
    operatorHint: 'Confirm payment release or refund and that all open Partner participation ended.',
  },
  {
    view: 'preferred-rejected',
    label: 'Preferred rejected',
    description: 'Bookings ended when the preferred Partner rejected with a recorded reason.',
    operatorHint:
      'Review the reason and response timing. A rejection does not continue to a replacement match.',
  },
  {
    view: 'preferred-no-response',
    label: 'Preferred no response',
    description: 'Bookings ended when the preferred Partner did not respond before the deadline.',
    operatorHint: 'Confirm the deadline, notification delivery, and payment release or refund.',
  },
  {
    view: 'usage-unresolved',
    label: 'Usage unresolved',
    description: 'Bookings created in the selected period that do not yet have a terminal outcome.',
    operatorHint: 'Review the current booking state and retained evidence before intervening.',
  },
  {
    view: 'matched',
    label: 'Matched / handoff',
    description: 'Current matched, on-the-way, or arrived bookings before service begins.',
    operatorHint: 'The customer can no longer cancel directly. Monitor chat and live service progress.',
  },
  {
    view: 'handoff-repair',
    label: 'Handoff repair',
    description: 'matched bookings whose final Partner is selected but chat handoff is missing.',
    operatorHint:
      'Use this as a dispatch repair queue. Chat must be fixed before arrival, start, and completion flow.',
  },
  {
    view: 'no-supply',
    label: 'Supply intervention',
    description: 'Open matching bookings past the configured wait threshold with no Partner participation.',
    operatorHint:
      'Use this when customers are waiting but no Partner participation is recorded. Call/notify nearby Partners or review location/service pricing.',
  },
  {
    view: 'blocked-create',
    label: 'Creation failures today',
    description: 'Booking create attempts rejected since the start of today.',
    operatorHint:
      'Review optional GPS evidence, service address, and first-pick Partner distance gates before support follow-up.',
  },
  {
    view: 'address',
    label: 'Address check',
    description: 'bookings missing the confirmed customer service address.',
    operatorHint:
      'Use this before dispatch. A confirmed service address protects customer, Partner, and admin records.',
  },
  {
    view: 'manual-decision',
    label: 'Needs decision',
    description: 'Post-match cancellations and no-show records that still need an admin evidence decision.',
    operatorHint:
      'Open the booking evidence, confirm the cancellation timing and fee state, then record the final decision.',
  },
  {
    view: 'payment',
    label: 'All payment exceptions',
    description:
      'Includes cash commission, refund mismatch, unresolved authorization, and payment release exceptions.',
    operatorHint:
      'Review the retained finance evidence for every terminal payment exception in one aggregate queue.',
  },
  {
    view: 'cash-debt',
    label: 'Cash commission',
    description:
      'cash bookings that created Partner fee/tax debt and can block final acceptance, service start, or payout release.',
    operatorHint:
      'Use this with Cash Settlements to confirm deposit or admin offset before final acceptance or service start proceeds.',
  },
  {
    view: 'closeout',
    label: 'Closeout records',
    description: 'Completed services with one or more missing closeout records.',
    operatorHint:
      'Use this after service completion to reconcile payment capture, Partner earning, tax logs, and wallet impact entries.',
  },
  {
    view: 'pricing',
    label: 'Pricing',
    description: 'Completed services whose booked price or Partner payout rule cannot be verified.',
    operatorHint:
      'Use this after changing service prices or payout rules to catch hidden finance mismatches before settlement.',
  },
  {
    view: 'location',
    label: 'Location ops',
    description: 'on-the-way or in-service bookings with missing or stale Partner location records.',
    operatorHint:
      'Use this only for live service states. The MVP tracks last-known location, not live route streaming.',
  },
  {
    view: 'chat',
    label: 'Chat live',
    description: 'bookings where customer/Partner communication is already available.',
    operatorHint:
      'Use this to inspect service handoff quality, quiet chats, and route/location expectations.',
  },
  {
    view: 'chat-repair',
    label: 'Chat repair',
    description: 'matched or active bookings whose chat room is missing.',
    operatorHint:
      'Use this when a matched customer and Partner cannot coordinate. Repair chat before arrival, service start, or completion.',
  },
  {
    view: 'chat-evidence',
    label: 'Chat evidence',
    description:
      'bookings where chat, location, alerts, or notes should be reviewed before a manual outcome.',
    operatorHint:
      'Use this before cancellation, no-show, payment release, refund, or closeout decisions that depend on communication evidence.',
  },
  {
    view: 'evidence-missing',
    label: 'Evidence missing',
    description:
      'manual-decision bookings that do not yet have enough retained chat, location, or alert context.',
    operatorHint:
      'Use this to add an operator note or repair missing records before changing a booking outcome.',
  },
  {
    view: 'refund-review',
    label: 'Refund mismatch',
    description:
      'bookings whose payment or refund state needs admin review after cancellation, expiry, no-show, or dispute.',
    operatorHint:
      'Use this with the evidence board before releasing, refunding, or reconciling customer payment movement.',
  },
  {
    view: 'post-match-cancellations',
    label: 'Resolved records',
    description:
      'matched cancellations whose automatic or Admin decision is already closed.',
    operatorHint:
      'Use this audit history to inspect customer payment closeout and the recorded Partner fee result.',
  },
  {
    view: 'expired',
    label: 'Expired records',
    description: 'Expired booking records closed in the selected period.',
    operatorHint:
      'Use this history view to inspect retained expiry records. Payment exceptions remain in their action queue.',
  },
  {
    view: 'no-show',
    label: 'No-show review',
    description: 'bookings closed as no-show but still needing payment, customer, or Partner review.',
    operatorHint:
      'Use this after marking no-show to confirm payment outcome, Partner debt, and customer communication.',
  },
  {
    view: 'all',
    label: 'Records',
    description: 'Booking history across all states in the selected period.',
    operatorHint:
      'Use this for a quick recent lookup. Use Completed or Post-match Cancellations for dedicated closeout review.',
  },
];

const realtimeBookingMonitorViews = new Set<BookingPageView>([
  'active',
  'attention',
  'data-anomaly',
  'matching',
  'in-service',
  'matching-delays',
  'first-pick',
  'marketplace',
  'customer-choice',
  'pre-match-cancelled',
  'preferred-rejected',
  'preferred-no-response',
  'usage-unresolved',
  'matched',
  'handoff-repair',
  'no-supply',
  'blocked-create',
  'all',
]);

const completedBookingMonitorViews = new Set<BookingPageView>([
  'payment',
  'cash-debt',
  'closeout',
  'pricing',
  'refund-review',
  'expired',
  'all',
]);

const postMatchCancellationBookingMonitorViews = new Set<BookingPageView>([
  'manual-decision',
  'post-match-cancellations',
  'no-show',
]);

const completedBookingRouteViews = new Set<BookingPageView>([
  'payment',
  'cash-debt',
  'closeout',
  'pricing',
  'refund-review',
  'expired',
]);

const postMatchCancellationBookingRouteViews = new Set<BookingPageView>([
  'manual-decision',
  'chat-evidence',
  'evidence-missing',
  'post-match-cancellations',
  'no-show',
]);

export const realtimeBookingViewOptions = bookingViewOptions.filter((option) =>
  realtimeBookingMonitorViews.has(option.view),
);

export const completedBookingViewOptions = bookingViewOptions
  .filter((option) => completedBookingMonitorViews.has(option.view))
  .map((option) =>
    option.view === 'all'
      ? {
          ...option,
          label: 'Terminal records',
          description: 'Completed, refunded, and expired records closed in the selected period.',
          operatorHint: 'Use this to review terminal records, with the most recently closed first.',
        }
      : option,
  );

export const postMatchCancellationBookingViewOptions = bookingViewOptions.filter((option) =>
  postMatchCancellationBookingMonitorViews.has(option.view),
);

export function bookingMonitorPagePathForView(view: BookingPageView) {
  if (completedBookingRouteViews.has(view)) {
    return '/bookings/completed';
  }
  if (postMatchCancellationBookingRouteViews.has(view)) {
    return '/bookings/post-match-cancellations';
  }
  return '/bookings';
}
