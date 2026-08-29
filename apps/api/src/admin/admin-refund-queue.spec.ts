import { BookingStatus, PaymentStatus } from '@prisma/client';

import {
  adminRefundOperationalStage,
  adminRefundQueueAgeDateWhere,
  adminRefundQueueMetaQuery,
  adminRefundReviewWhere,
} from './admin-refund-queue';

describe('admin refund queue contract', () => {
  it('keeps requested, processing, other, mismatch, and closed queues mutually explicit', () => {
    const requested = JSON.stringify(adminRefundReviewWhere('requested'));
    const processing = JSON.stringify(adminRefundReviewWhere('processing'));
    const other = JSON.stringify(adminRefundReviewWhere('other'));
    const mismatch = JSON.stringify(adminRefundReviewWhere('state-mismatch'));
    const completed = JSON.stringify(adminRefundReviewWhere('completed'));

    expect(requested).toContain('"status":"REQUESTED"');
    expect(requested).toContain('"NOT":{"OR"');
    expect(processing).toContain(
      '"in":["APPROVAL_PROCESSING","PROVIDER_PROCESSING","GATEWAY_CONFIRMED"]',
    );
    expect(processing).toContain('"NOT":{"OR"');
    expect(other).toContain('"NOT":{"OR"');
    expect(other).toContain(
      '"notIn":["REQUESTED","APPROVAL_PROCESSING","PROVIDER_PROCESSING","GATEWAY_CONFIRMED","COMPLETED","REJECTED"]',
    );
    expect(mismatch).toContain('"status":"COMPLETED"');
    expect(mismatch).toContain('"status":{"not":"COMPLETED"}');
    expect(completed).toContain('"status":"COMPLETED"');
    expect(completed).toContain('"NOT":{"OR"');
  });

  it('uses the same aligned unknown-status predicate for Other review metadata totals', () => {
    const query = adminRefundQueueMetaQuery({ review: 'other' }) as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    const sql = query.strings.join('?');

    expect(sql).toContain('NOT IN');
    expect(sql).toContain("'REQUESTED'");
    expect(sql).toContain("'COMPLETED'");
    expect(sql).toContain("'REJECTED'");
    expect(query.values).toEqual(expect.arrayContaining([
      'APPROVAL_PROCESSING',
      'PROVIDER_PROCESSING',
      'GATEWAY_CONFIRMED',
    ]));
  });

  it.each([
    ['REQUESTED', PaymentStatus.CAPTURED, BookingStatus.CANCELLED, 'AWAITING_DECISION'],
    ['PROVIDER_PROCESSING', PaymentStatus.CAPTURED, BookingStatus.CANCELLED, 'PAYMENT_PROCESSING'],
    ['COMPLETED', PaymentStatus.REFUNDED, BookingStatus.REFUNDED, 'CLOSED'],
    ['REJECTED', PaymentStatus.CAPTURED, BookingStatus.CANCELLED, 'REJECTED'],
    ['COMPLETED', PaymentStatus.CAPTURED, BookingStatus.CANCELLED, 'STATE_MISMATCH'],
    ['REQUESTED', PaymentStatus.REFUNDED, BookingStatus.REFUNDED, 'STATE_MISMATCH'],
  ] as const)(
    'classifies %s / %s / %s as %s',
    (status, paymentStatus, bookingStatus, expected) => {
      expect(
        adminRefundOperationalStage({
          booking: { status: bookingStatus },
          payment: { status: paymentStatus },
          status,
        }),
      ).toBe(expected);
    },
  );

  it('uses non-overlapping operational age boundaries', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');

    expect(adminRefundQueueAgeDateWhere('under-1h', now)).toEqual({
      gte: new Date('2026-08-09T11:00:00.000Z'),
      lte: now,
    });
    expect(adminRefundQueueAgeDateWhere('1-4h', now)).toEqual({
      gte: new Date('2026-08-09T08:00:00.000Z'),
      lt: new Date('2026-08-09T11:00:00.000Z'),
    });
    expect(adminRefundQueueAgeDateWhere('3-7d', now)).toEqual({
      gte: new Date('2026-08-02T12:00:00.000Z'),
      lt: new Date('2026-08-06T12:00:00.000Z'),
    });
    expect(adminRefundQueueAgeDateWhere('over-7d', now)).toEqual({
      lt: new Date('2026-08-02T12:00:00.000Z'),
    });
  });

  it('builds one parameterized metadata query for search, scope, age, and queue totals', () => {
    const query = adminRefundQueueMetaQuery(
      {
        age: '3-7d',
        customerProfileId: 'customer-1',
        from: new Date('2026-08-01T00:00:00.000Z'),
        overdueBefore: new Date('2026-08-09T08:00:00.000Z'),
        q: 'Customer One',
        review: 'open',
        slaBefore: new Date('2026-08-09T08:00:00.000Z'),
        to: new Date('2026-08-09T23:59:59.999Z'),
      },
      new Date('2026-08-09T12:00:00.000Z'),
    ) as { strings: readonly string[]; values: readonly unknown[] };
    const sql = query.strings.join('?');

    expect(sql).toContain('AS "selectedTotal"');
    expect(sql).toContain('AS "globalOpenCount"');
    expect(sql).toContain('customer_user."fullName" ILIKE');
    expect(sql).toContain('refund."createdAt"');
    expect(sql).toContain('FROM "Refund" refund');
    expect(query.values).toContain('%Customer One%');
    expect(query.values).toContain('customer-1');
  });
});
