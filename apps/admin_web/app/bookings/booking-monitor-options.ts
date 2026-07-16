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
    label: 'Active only',
    description: 'live dispatch work across matching, arrival, and in-service states.',
    operatorHint:
      'Use this during operations to catch stalled matching, missing location, or unresolved payment follow-up.',
  },
  {
    view: 'attention',
    label: 'Follow-up queue',
    description: 'bookings with expired matching, unresolved payment, or missing chat after matching.',
    operatorHint: 'Use this as the first dispatch checklist view when the dashboard shows attention needed.',
  },
  {
    view: 'matching',
    label: 'Matching ops',
    description:
      'direct first-pick, marketplace participant, final customer selection, and chat handoff work.',
    operatorHint:
      'Use this during live dispatch to manage the 10-minute Partner response window and marketplace participant escalation.',
  },
  {
    view: 'first-pick',
    label: 'Stage 1 first-pick',
    description: 'open bookings where the selected Partner still has the first response window.',
    operatorHint:
      'Use this to monitor the 10-minute response window, push delivery, KYC, wallet gate, and Partner decision timing.',
  },
  {
    view: 'marketplace',
    label: 'Stage 2 marketplace',
    description: 'open bookings where marketplace Partners can participate or need a dispatch nudge.',
    operatorHint:
      'Use this to manage the marketplace participant pool, stale location checks, and availability alert delivery.',
  },
  {
    view: 'customer-choice',
    label: 'Stage 3 choice',
    description: 'open bookings with participating/accepted Partners waiting for customer final selection.',
    operatorHint:
      'Use this when customer support should guide the customer to choose one final Partner before matched chat opens.',
  },
  {
    view: 'handoff-repair',
    label: 'Stage 4 repair',
    description: 'matched bookings whose final Partner is selected but chat handoff is missing.',
    operatorHint:
      'Use this as a dispatch repair queue. Chat must be fixed before arrival, start, and completion flow.',
  },
  {
    view: 'no-supply',
    label: 'No supply',
    description: 'open matching bookings with no Partner participation yet.',
    operatorHint:
      'Use this when customers are waiting but no Partner participation is recorded. Call/notify nearby Partners or review location/service pricing.',
  },
  {
    view: 'blocked-create',
    label: 'Blocked create',
    description: 'booking create attempts rejected before payment authorization and matching.',
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
    label: 'Manual decision',
    description:
      'cancelled, expired, no-show, cash-debt, or completed closeout bookings that need admin evidence review.',
    operatorHint:
      'Use this before changing outcomes, refunds, cash fee settlement, or closeout records. Decide from factual evidence only.',
  },
  {
    view: 'payment',
    label: 'Payment ops',
    description: 'bookings whose payment state can block closeout, refund, capture, or settlement.',
    operatorHint:
      'Use this to catch completed authorized payments, cancelled unresolved holds, cash pending, and missing refs.',
  },
  {
    view: 'cash-debt',
    label: 'Cash debt',
    description:
      'cash bookings that created Partner fee/tax debt and can block final acceptance, service start, or payout release.',
    operatorHint:
      'Use this with Cash Settlements to confirm deposit or admin offset before final acceptance or service start proceeds.',
  },
  {
    view: 'closeout',
    label: 'Closeout ops',
    description: 'completed bookings missing capture, earning, tax, platform fee, or wallet impact records.',
    operatorHint:
      'Use this after service completion to reconcile payment capture, Partner earning, tax logs, and wallet impact entries.',
  },
  {
    view: 'pricing',
    label: 'Pricing ops',
    description: 'bookings whose service price is not backed by the active service payout matrix.',
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
    label: 'Refund review',
    description:
      'bookings whose payment or refund state needs admin review after cancellation, expiry, no-show, or dispute.',
    operatorHint:
      'Use this with the evidence board before releasing, refunding, or reconciling customer payment movement.',
  },
  {
    view: 'post-match-cancellations',
    label: 'Post-match cancellations',
    description: 'matched bookings cancelled after Partner commitment and waiting for approval or fee-hold review.',
    operatorHint:
      'Use this to open chat evidence, approve cancellation fee restoration, or hold the Partner fee deduction.',
  },
  {
    view: 'expired',
    label: 'Expired',
    description: 'bookings closed by timeout and waiting for payment release or customer follow-up review.',
    operatorHint:
      'Use this after manual or automatic expiry to confirm payment release, refund decision, and customer communication.',
  },
  {
    view: 'no-show',
    label: 'No-show',
    description: 'bookings closed as no-show but still needing payment, customer, or Partner review.',
    operatorHint:
      'Use this after marking no-show to confirm payment outcome, Partner debt, and customer communication.',
  },
  {
    view: 'all',
    label: 'Recent records',
    description: 'latest booking records across all states within the selected period.',
    operatorHint:
      'Use this for a quick recent lookup. Use Completed or Post-match Cancellations for dedicated closeout review.',
  },
];

const realtimeBookingMonitorViews = new Set<BookingPageView>([
  'active',
  'attention',
  'matching',
  'first-pick',
  'marketplace',
  'customer-choice',
  'handoff-repair',
  'no-supply',
  'blocked-create',
  'address',
  'location',
  'chat',
  'chat-repair',
  'all',
]);

const completedBookingMonitorViews = new Set<BookingPageView>([
  'payment',
  'cash-debt',
  'closeout',
  'pricing',
  'refund-review',
  'expired',
]);

const postMatchCancellationBookingMonitorViews = new Set<BookingPageView>([
  'manual-decision',
  'chat-evidence',
  'evidence-missing',
  'post-match-cancellations',
  'no-show',
]);

export const realtimeBookingViewOptions = bookingViewOptions.filter((option) =>
  realtimeBookingMonitorViews.has(option.view),
);

export const completedBookingViewOptions = bookingViewOptions.filter((option) =>
  completedBookingMonitorViews.has(option.view),
);

export const postMatchCancellationBookingViewOptions = bookingViewOptions.filter((option) =>
  postMatchCancellationBookingMonitorViews.has(option.view),
);

export function bookingMonitorPagePathForView(view: BookingPageView) {
  if (completedBookingMonitorViews.has(view)) {
    return '/bookings/completed';
  }
  if (postMatchCancellationBookingMonitorViews.has(view)) {
    return '/bookings/post-match-cancellations';
  }
  return '/bookings';
}
