import type { AdminDateRange } from '../../lib/date-range';
import type { PaymentFilterLink, PaymentRangeLink } from './payment-filter-board-section';

export function paymentFilterLinks(): PaymentFilterLink[] {
  return [
    { href: '/payments?review=all', label: 'All payments', review: 'all' },
    { href: '/payments?review=capture', label: 'Capture review', review: 'capture' },
    { href: '/payments?review=missing-ref', label: 'Missing refs', review: 'missing-ref' },
    { href: '/payments?review=authorized', label: 'Authorized holds', review: 'authorized' },
    { href: '/payments?review=cash', label: 'Cash collection', review: 'cash' },
    { href: '/payments?review=cash-debt', label: 'Cash fee debt', review: 'cash-debt' },
    { href: '/payments?review=needs-action', label: 'Needs action', review: 'needs-action' },
    { href: '/payments?review=callback-review', label: 'Callback review', review: 'callback-review' },
    { href: '/payments?review=callback-verified', label: 'Callback verified', review: 'callback-verified' },
    { href: '/payments?review=refunded', label: 'Refunded', review: 'refunded' },
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
  if (review === 'capture') {
    return 'authorized payments tied to completed services, ready for capture review.';
  }
  if (review === 'missing-ref') {
    return 'authorized payments that do not yet have a gateway reference.';
  }
  if (review === 'authorized') {
    return 'active authorization holds that still need service or payment resolution.';
  }
  if (review === 'cash') {
    return 'cash bookings waiting for collection confirmation.';
  }
  if (review === 'cash-debt') {
    return 'completed cash bookings where the partner still owes HANDS fee or tax wallet debt.';
  }
  if (review === 'needs-action') {
    return 'payments that are not settled, released, or refunded yet.';
  }
  if (review === 'callback-review') {
    return 'MoMo or VNPay callbacks that were received without a verified gateway signature.';
  }
  if (review === 'callback-verified') {
    return 'MoMo or VNPay callbacks already accepted with gateway signature evidence.';
  }
  if (review === 'refunded') {
    return 'payments already moved into the refund path.';
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
