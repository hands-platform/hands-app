import type { BookingPageView } from './booking-page-params';
import type { BookingDateRangeFilter } from './booking-date-range-filter';
import type { AdminQueueAge } from '../../lib/admin-queue-list';

export function emptyBookingMessage(
  view: BookingPageView,
  filters?: {
    readonly age?: AdminQueueAge;
    readonly completedWorkspace?: boolean;
    readonly dateRangeFilter?: BookingDateRangeFilter;
    readonly hasActiveFilters?: boolean;
    readonly queueLabel?: string;
    readonly searchQuery?: string;
  },
) {
  const query = filters?.searchQuery?.trim();
  if (query && filters?.queueLabel) {
    return `No bookings match “${query}” in ${filters.queueLabel}. Reset filters or change the queue.`;
  }
  if (query) {
    return `No records match “${query}” in ${bookingEmptyPeriodLabel(filters?.dateRangeFilter)}. Clear the search or change the period.`;
  }
  if (filters?.queueLabel && (filters.hasActiveFilters || filters.age !== 'all')) {
    return `No bookings match the current filters in ${filters.queueLabel}. Reset filters or change the queue.`;
  }
  if (filters?.completedWorkspace) {
    return completedBookingEmptyMessage(view, filters.age, filters.dateRangeFilter);
  }
  if (
    filters &&
    ((filters.age !== undefined && filters.age !== 'all') ||
      (filters.dateRangeFilter !== undefined && filters.dateRangeFilter !== 'all'))
  ) {
    return 'No records match the current closed-period and waiting-time filters.';
  }
  if (view === 'active') {
    return 'No active bookings match this queue. Dispatch is clear right now.';
  }
  if (view === 'attention') {
    return 'No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.';
  }
  if (view === 'matching') {
    return 'No matching escalation bookings match this queue. First-pick, marketplace supply, customer selection, and chat handoff are clear.';
  }
  if (view === 'in-service') {
    return 'No service is in progress right now.';
  }
  if (view === 'matching-delays') {
    return 'No open matching request is expired or waiting without Partner participation.';
  }
  if (view === 'first-pick') {
    return 'No booking is waiting for a preferred Partner response.';
  }
  if (view === 'marketplace') {
    return 'No booking is open for marketplace Partner participation right now.';
  }
  if (view === 'customer-choice') {
    return 'No customer is waiting to choose from participating Partners.';
  }
  if (view === 'handoff-repair') {
    return 'No matched booking is missing its chat handoff.';
  }
  if (view === 'pre-match-cancelled') {
    return 'No customer cancellation before final match is recorded in this period.';
  }
  if (view === 'preferred-rejected') {
    return 'No booking ended from a preferred Partner rejection in this period.';
  }
  if (view === 'preferred-no-response') {
    return 'No booking ended from a preferred Partner response timeout in this period.';
  }
  if (view === 'matched') {
    return 'No booking currently has a final matched Partner.';
  }
  if (view === 'no-supply') {
    return 'No open matching booking is waiting without Partner supply.';
  }
  if (view === 'blocked-create') {
    return 'Blocked booking create attempts are listed above. No booking row exists because payment and matching did not start.';
  }
  if (view === 'address') {
    return 'No booking is missing a confirmed service address.';
  }
  if (view === 'manual-decision') {
    return 'No manual-decision bookings need review. Cancellation, no-show, refund/release, cash debt, and completed closeout queues are clear.';
  }
  if (view === 'payment') {
    return 'No payment-check bookings match this queue. Capture, release, refund, cash, and Partner refs are clear.';
  }
  if (view === 'cash-debt') {
    return 'No cash booking currently has open Partner fee/tax debt.';
  }
  if (view === 'closeout') {
    return 'No completed closeout-check bookings match this queue. Capture, earning, tax, fee, and wallet records are aligned.';
  }
  if (view === 'pricing') {
    return 'No pricing-check bookings match this queue. Booking prices match active service payout rules.';
  }
  if (view === 'location') {
    return 'No location-check bookings match this queue. Live service location records look acceptable.';
  }
  if (view === 'chat') {
    return 'No chat-live bookings match this queue. No active customer/Partner conversation needs review.';
  }
  if (view === 'chat-repair') {
    return 'No matched or active booking is missing chat right now.';
  }
  if (view === 'chat-evidence') {
    return 'No booking needs chat evidence review. Chat rooms, quiet chats, and manual outcome evidence are clear.';
  }
  if (view === 'evidence-missing') {
    return 'No manual-decision booking is missing retained chat, location, or alert context in this list.';
  }
  if (view === 'refund-review') {
    return 'No booking needs refund review. Cancelled, expired, and no-show payment outcomes are aligned.';
  }
  if (view === 'expired') {
    return 'No expired bookings need review. Timeout closeout and customer communication are clear.';
  }
  if (view === 'no-show') {
    return 'No no-show bookings need review. Customer protection and payment closeout are clear.';
  }
  return 'No booking records are available yet.';
}

function completedBookingEmptyMessage(
  view: BookingPageView,
  age?: AdminQueueAge,
  range?: BookingDateRangeFilter,
) {
  const descriptions: Partial<Record<BookingPageView, readonly [string, string]>> = {
    payment: ['payment exceptions', 'found'],
    'cash-debt': ['cash commission cases', 'found'],
    'refund-review': ['refund mismatch cases', 'found'],
    closeout: ['closeout records', 'found'],
    pricing: ['pricing exceptions', 'found'],
    expired: ['expired records', 'closed'],
    all: ['terminal records', 'closed'],
  };
  const [subject, outcome] = descriptions[view] ?? ['booking records', 'found'];
  const period = bookingEmptyPeriodSuffix(range);

  return age && age !== 'all'
    ? `No ${subject} match the selected waiting-time filter ${period}.`
    : `No ${subject} were ${outcome} ${period}.`;
}

function bookingEmptyPeriodLabel(range?: BookingDateRangeFilter) {
  switch (range) {
    case 'all':
      return 'All dates';
    case 'yesterday':
      return 'Yesterday';
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case 'custom':
      return 'the custom period';
    case 'today':
    default:
      return 'Today';
  }
}

function bookingEmptyPeriodSuffix(range?: BookingDateRangeFilter) {
  switch (range) {
    case 'yesterday':
      return 'yesterday';
    case '7d':
      return 'in the last 7 days';
    case '30d':
      return 'in the last 30 days';
    case 'custom':
      return 'in the selected custom period';
    case 'all':
      return 'in the selected period';
    case 'today':
    default:
      return 'today';
  }
}
