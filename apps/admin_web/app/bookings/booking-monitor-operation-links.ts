import type { BookingPageView } from './booking-page-params';

const BOOKING_SUMMARY_VIEWS: Readonly<Record<string, BookingPageView>> = {
  'Blocked today': 'blocked-create',
  'Cash debt': 'cash-debt',
  'Closeout checks': 'closeout',
  'Data anomaly': 'data-anomaly',
  Expired: 'expired',
  'Live bookings': 'active',
  'Matching now': 'matching',
  'Service in progress': 'in-service',
  'Needs action': 'attention',
  'Needs admin review': 'manual-decision',
  'No-show': 'no-show',
  'Payment checks': 'payment',
  'Pricing checks': 'pricing',
  'Refund review': 'refund-review',
};

export function bookingMonitorSummaryView(label: string): BookingPageView | null {
  return BOOKING_SUMMARY_VIEWS[label] ?? null;
}

export function bookingMonitorDetailHrefSuffix(
  pagePath: string,
  view: BookingPageView,
  bookingStatus?: string,
) {
  if (pagePath === '/bookings/post-match-cancellations') {
    return bookingStatus === 'NO_SHOW' || view === 'no-show'
      ? '#booking-outcome-review'
      : '#booking-post-match-cancellation-decision';
  }

  if (pagePath === '/bookings/completed') {
    if (view === 'closeout') return '#booking-outcome-review';
    if (
      view === 'payment' ||
      view === 'cash-debt' ||
      view === 'pricing' ||
      view === 'refund-review'
    ) {
      return '?overview=activity#booking-finance-system-detail';
    }
    return '#booking-unified-detail';
  }

  if (
    view === 'attention' ||
    view === 'active' ||
    view === 'matching' ||
    view === 'matching-delays'
  ) {
    return '#booking-command-decision-strip';
  }

  return '#booking-unified-detail';
}
