import type { AdminPayment } from '../../lib/admin-api';
import {
  buildPaymentOperationsApiHref,
  buildPaymentPageHref,
  buildPaymentPageModel,
  buildPaymentResetHref,
  buildPaymentSummaryApiHref,
} from './payment-page-model';

describe('payment page model', () => {
  it('defaults to the all-time capture-ready queue with oldest work first', () => {
    const model = buildPaymentPageModel({ params: {}, payments: [] });

    expect(model.filters).toMatchObject({ range: 'all', review: 'capture-ready', sort: 'oldest' });
    expect(model.dateRangeLabel).toBe('All dates');
    expect(model.activeFilter?.label).toBe('Capture ready');
    expect(buildPaymentOperationsApiHref(model.filters)).toBe(
      '/admin/payments?take=10&range=all&sort=oldest&review=capture-ready',
    );
    expect(buildPaymentSummaryApiHref(model.filters)).toBe(
      '/admin/payments/summary?range=all&sort=oldest&review=capture-ready',
    );
  });

  it('does not reclassify server-filtered rows in the browser model', () => {
    const rows = [
      payment({ id: 'server-capture-row', status: 'AUTHORIZED' }),
      payment({ id: 'server-conflict-row', status: 'FAILED' }),
    ];
    const model = buildPaymentPageModel({
      params: { range: 'all', review: 'capture-ready' },
      payments: rows,
    });

    expect(model.payments.map((item) => item.id)).toEqual(['server-capture-row', 'server-conflict-row']);
  });

  it('uses exact server summary counts instead of the loaded page sample', () => {
    const model = buildPaymentPageModel({
      params: { range: '7d', review: 'evidence-conflict' },
      paymentSummary: {
        activeCashCollection: 4,
        authorized: 12,
        callbackReview: 13,
        callbackVerified: 14,
        captureReady: 3,
        captured: 15,
        cashDebt: 16,
        evidenceConflicts: 2,
        linkedRefunds: 17,
        needsAction: 18,
        pendingCash: 19,
        refunded: 20,
        releaseRecommended: 5,
        staleMismatch: 6,
        totalCount: 50,
      },
      payments: [payment()],
    });

    expect(model.metrics).toMatchObject({
      activeCashCollection: 4,
      captureReady: 3,
      evidenceConflicts: 2,
      releaseRecommended: 5,
      staleMismatch: 6,
    });
    expect(model.totalCount).toBe(50);
  });

  it('forwards search, directory, evidence, age, SLA, sort, and paging filters', () => {
    const model = buildPaymentPageModel({
      params: {
        age: 'over-24h',
        bookingStatus: 'completed',
        evidence: 'conflict',
        page: '2',
        paymentMethod: 'vnpay',
        paymentStatus: 'authorized',
        q: 'customer / gateway',
        range: '30d',
        review: 'authorized',
        sla: 'overdue',
        sort: 'oldest',
      },
      payments: [],
    });
    const listHref = buildPaymentOperationsApiHref(model.filters);
    const summaryHref = buildPaymentSummaryApiHref(model.filters);

    for (const href of [listHref, summaryHref]) {
      const url = new URL(href, 'http://admin.local');
      expect(url.searchParams.get('q')).toBe('customer / gateway');
      expect(url.searchParams.get('paymentMethod')).toBe('VNPAY');
      expect(url.searchParams.get('paymentStatus')).toBe('AUTHORIZED');
      expect(url.searchParams.get('bookingStatus')).toBe('COMPLETED');
      expect(url.searchParams.get('evidence')).toBe('conflict');
      expect(url.searchParams.get('sort')).toBe('oldest');
      expect(url.searchParams.get('sla')).toBe('overdue');
    }
    expect(new URL(listHref, 'http://admin.local').searchParams.get('skip')).toBe('10');
    expect(new URL(summaryHref, 'http://admin.local').searchParams.has('skip')).toBe(false);
  });

  it('preserves directory context in queue, range, and pagination links', () => {
    const model = buildPaymentPageModel({
      params: {
        customerProfileId: 'customer/profile 1',
        evidence: 'missing',
        q: 'booking-1',
        range: 'all',
        review: 'capture-ready',
      },
      payments: [],
    });

    for (const href of [model.reviewLinks[0]?.href, model.rangeLinks[0]?.href, buildPaymentPageHref(model.filters, 2)]) {
      const url = new URL(href ?? '', 'http://admin.local');
      expect(url.searchParams.get('customerProfileId')).toBe('customer/profile 1');
      expect(url.searchParams.get('q')).toBe('booking-1');
      expect(url.searchParams.get('evidence')).toBe('missing');
    }
  });

  it('keeps all payments as an explicit broad queue', () => {
    const model = buildPaymentPageModel({
      params: { range: 'all', review: 'all', sort: 'newest' },
      payments: [],
    });

    expect(buildPaymentOperationsApiHref(model.filters)).toBe('/admin/payments?take=10&range=all');
    expect(buildPaymentSummaryApiHref(model.filters)).toBe('/admin/payments/summary?range=all');
  });

  it.each(['release-recommended', 'terminal-cash-cleanup', 'authorized'])(
    'resets directory filters without leaving the %s queue or customer scope',
    (review) => {
      const model = buildPaymentPageModel({
        params: {
          age: 'over-24h',
          bookingStatus: 'expired',
          customerProfileId: 'customer-1',
          evidence: 'missing',
          page: '3',
          paymentMethod: 'momo',
          paymentStatus: 'authorized',
          q: 'booking-1',
          range: '30d',
          review,
          sla: 'critical',
          sort: 'oldest',
        },
        payments: [],
      });
      const url = new URL(buildPaymentResetHref(model.filters), 'http://admin.local');

      expect(url.searchParams.get('review')).toBe(review);
      expect(url.searchParams.get('customerProfileId')).toBe('customer-1');
      expect(url.searchParams.get('sort')).toBe('oldest');
      for (const key of ['age', 'bookingStatus', 'evidence', 'page', 'paymentMethod', 'paymentStatus', 'q', 'range', 'sla']) {
        expect(url.searchParams.has(key)).toBe(false);
      }
    },
  );
});

function payment(input: Partial<AdminPayment> = {}): AdminPayment {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: 'CARD',
    status: 'AUTHORIZED',
    ...input,
    booking: {
      createdAt: '2026-06-10T08:00:00.000Z',
      ...input.booking,
    },
  };
}
