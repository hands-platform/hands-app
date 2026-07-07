import type { BookingPageView } from './booking-page-params';

export function emptyBookingMessage(view: BookingPageView) {
  if (view === 'active') {
    return 'No active bookings match this queue. Dispatch is clear right now.';
  }
  if (view === 'attention') {
    return 'No attention-queue bookings match this queue. Expired matching, missing chat, and payment closeout are clear.';
  }
  if (view === 'matching') {
    return 'No matching escalation bookings match this queue. First-pick, marketplace supply, customer selection, and chat handoff are clear.';
  }
  if (view === 'first-pick') {
    return 'No Stage 1 first-pick bookings are waiting. The direct Partner response window is clear.';
  }
  if (view === 'marketplace') {
    return 'No Stage 2 marketplace bookings need Partner participation review right now.';
  }
  if (view === 'customer-choice') {
    return 'No Stage 3 customer choice bookings are waiting. Participating/accepted Partners are not blocked on customer selection.';
  }
  if (view === 'handoff-repair') {
    return 'No Stage 4 handoff repair bookings are missing chat.';
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
  return 'No bookings loaded. Start the API and run the smoke flow to populate this table.';
}
