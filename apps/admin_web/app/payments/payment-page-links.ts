import type { AdminDateRange } from '../../lib/date-range';
import type { PaymentFilterLink, PaymentRangeLink } from './payment-filter-board-section';

export function paymentFilterLinks(): PaymentFilterLink[] {
  return [
    { group: 'live', href: '/payments?review=capture-ready', label: 'Capture ready', review: 'capture-ready' },
    { group: 'live', href: '/payments?review=release-recommended', label: 'Release recommended', review: 'release-recommended' },
    { group: 'live', href: '/payments?review=active-cash', label: 'Active cash collection', review: 'active-cash' },
    { group: 'exception', href: '/payments?review=terminal-cash-cleanup', label: 'Terminal cash cleanup', review: 'terminal-cash-cleanup' },
    { group: 'exception', href: '/payments?review=completed-authorization-blocked', label: 'Completed authorization blocked', review: 'completed-authorization-blocked' },
    { group: 'exception', href: '/payments?review=missing-gateway-evidence', label: 'Missing gateway evidence', review: 'missing-gateway-evidence' },
    { group: 'exception', href: '/payments?review=failed-active', label: 'Failed active payment', review: 'failed-active' },
    { group: 'exception', href: '/payments?review=evidence-conflict', label: 'Gateway evidence conflict', review: 'evidence-conflict' },
    { group: 'exception', href: '/payments?review=cash-debt', label: 'Cash debt', review: 'cash-debt' },
    { group: 'history', href: '/payments?review=history-captured', label: 'Captured', review: 'history-captured' },
    { group: 'history', href: '/payments?review=history-released', label: 'Released', review: 'history-released' },
    { group: 'history', href: '/payments?review=history-refunded', label: 'Refunded', review: 'history-refunded' },
    { group: 'history', href: '/payments?review=callback-verified', label: 'Verified callback history', review: 'callback-verified' },
    { group: 'history', href: '/payments?review=authorized', label: 'All authorized', review: 'authorized' },
    { group: 'history', href: '/payments?review=all', label: 'All payments', review: 'all' },
  ];
}

export function paymentRangeLinks(review: string): PaymentRangeLink[] {
  return [
    { href: withPaymentReview('/payments', review), label: 'All dates', range: 'all' },
    { href: withPaymentReview('/payments?range=today', review), label: 'Today', range: 'today' },
    { href: withPaymentReview('/payments?range=7d', review), label: 'Last 7 days', range: '7d' },
    { href: withPaymentReview('/payments?range=30d', review), label: 'Last 30 days', range: '30d' },
  ];
}

export function withPaymentRange(href: string, range: AdminDateRange): string {
  if (range === 'all') {
    return href;
  }
  return withPaymentQuery(href, 'range', range);
}

export function paymentFilterDescription(review: string): string {
  if (review === 'capture-ready' || review === 'capture') {
    return 'completed bookings whose payment evidence has passed the server capture policy.';
  }
  if (review === 'release-recommended') {
    return 'non-capture terminal bookings whose authorization should be released.';
  }
  if (review === 'evidence-conflict' || review === 'callback-review') {
    return 'payments with callback signature, amount, or outcome evidence conflicts.';
  }
  if (review === 'active-cash' || review === 'cash') {
    return 'cash payments attached to bookings that are still operationally active.';
  }
  if (review === 'terminal-cash-cleanup' || review === 'stale-mismatch') {
    return 'terminal bookings whose cash payment record still needs non-mutating cleanup review.';
  }
  if (review === 'completed-authorization-blocked') {
    return 'completed bookings whose authorization cannot be captured with the retained evidence.';
  }
  if (review === 'authorized') {
    return 'all authorization holds, including blocked and recommended decisions.';
  }
  if (review === 'failed-active') {
    return 'failed payments attached to bookings that are still active.';
  }
  if (review === 'missing-gateway-evidence') {
    return 'external gateway payments missing a reference or verified callback evidence.';
  }
  if (review === 'cash-debt') {
    return 'cash payments whose linked Partner earning still has an unsettled negative balance.';
  }
  if (review === 'history-captured') {
    return 'captured payment history.';
  }
  if (review === 'history-released') {
    return 'released authorization history.';
  }
  if (review === 'history-refunded') {
    return 'refunded payment history.';
  }
  if (review === 'callback-verified') {
    return 'payments with accepted and signature-verified callback history.';
  }
  return 'all payment records.';
}

export function emptyPaymentMessage(review: string): string {
  if (!review) {
    return 'No payments loaded.';
  }
  return `No payments currently match this queue. ${paymentFilterDescription(review)}`;
}

function withPaymentReview(href: string, review: string): string {
  if (!review) {
    return href;
  }
  return withPaymentQuery(href, 'review', review);
}

function withPaymentQuery(href: string, key: 'range' | 'review', value: string): string {
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}${key}=${value}`;
}
