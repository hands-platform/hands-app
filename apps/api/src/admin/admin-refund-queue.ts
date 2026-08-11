import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';

import { adminBookingProductionDataSql } from './admin-booking-list-query';

export const ADMIN_REFUND_ACTIVE_STATUSES = [
  'REQUESTED',
  'APPROVAL_PROCESSING',
  'PROVIDER_PROCESSING',
  'GATEWAY_CONFIRMED',
] as const;

export const ADMIN_REFUND_PROCESSING_STATUSES = [
  'APPROVAL_PROCESSING',
  'PROVIDER_PROCESSING',
  'GATEWAY_CONFIRMED',
] as const;

export type AdminRefundQueueAge =
  | 'all'
  | 'under-1h'
  | '1-4h'
  | '4-24h'
  | '1-3d'
  | '3-7d'
  | 'over-7d';

export type AdminRefundOperationalStage =
  | 'STATE_MISMATCH'
  | 'AWAITING_DECISION'
  | 'PAYMENT_PROCESSING'
  | 'CLOSED'
  | 'REJECTED'
  | 'REVIEW_REQUIRED';

type AdminRefundStateRecord = {
  booking?: { status?: string | null } | null;
  payment?: { status?: string | null } | null;
  status: string;
};

type AdminRefundQueueMetaQueryOptions = {
  readonly age?: string | null;
  readonly customerProfileId?: string | null;
  readonly from?: Date;
  readonly overdueBefore?: Date;
  readonly q?: string | null;
  readonly review?: string | null;
  readonly slaAfter?: Date;
  readonly slaBefore?: Date;
  readonly to?: Date;
};

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export function adminRefundStateMismatchWhere(): Prisma.RefundWhereInput {
  return {
    OR: [
      {
        status: 'COMPLETED',
        OR: [
          { payment: { status: { not: PaymentStatus.REFUNDED } } },
          { booking: { status: { not: BookingStatus.REFUNDED } } },
        ],
      },
      {
        status: { not: 'COMPLETED' },
        OR: [
          { payment: { status: PaymentStatus.REFUNDED } },
          { booking: { status: BookingStatus.REFUNDED } },
        ],
      },
    ],
  };
}

export function adminRefundReviewWhere(
  review: string | null | undefined,
): Prisma.RefundWhereInput | undefined {
  const mismatch = adminRefundStateMismatchWhere();
  const aligned = { NOT: mismatch } satisfies Prisma.RefundWhereInput;

  switch (normalizeNullable(review)) {
    case 'open':
      return {
        OR: [
          mismatch,
          {
            AND: [aligned, { status: { notIn: ['COMPLETED', 'REJECTED'] } }],
          },
        ],
      };
    case 'requested':
      return { AND: [{ status: 'REQUESTED' }, aligned] };
    case 'processing':
      return {
        AND: [{ status: { in: [...ADMIN_REFUND_PROCESSING_STATUSES] } }, aligned],
      };
    case 'state-mismatch':
    case 'needs-update':
      return mismatch;
    case 'refunded-booking':
      return { booking: { status: BookingStatus.REFUNDED } };
    case 'completed':
      return { AND: [{ status: 'COMPLETED' }, aligned] };
    case 'rejected':
      return { AND: [{ status: 'REJECTED' }, aligned] };
    default:
      return undefined;
  }
}

export function adminRefundOperationalStage(
  refund: AdminRefundStateRecord,
): AdminRefundOperationalStage {
  if (adminRefundStateMismatchReason(refund)) return 'STATE_MISMATCH';
  if (refund.status === 'REQUESTED') return 'AWAITING_DECISION';
  if (ADMIN_REFUND_PROCESSING_STATUSES.some((status) => status === refund.status)) {
    return 'PAYMENT_PROCESSING';
  }
  if (refund.status === 'COMPLETED') return 'CLOSED';
  if (refund.status === 'REJECTED') return 'REJECTED';
  return 'REVIEW_REQUIRED';
}

export function adminRefundStateMismatchReason(refund: AdminRefundStateRecord) {
  const paymentRefunded = refund.payment?.status === PaymentStatus.REFUNDED;
  const bookingRefunded = refund.booking?.status === BookingStatus.REFUNDED;

  if (refund.status === 'COMPLETED') {
    if (!paymentRefunded && !bookingRefunded) {
      return 'Refund is closed, but payment and booking are not refunded.';
    }
    if (!paymentRefunded) {
      return 'Refund and booking are closed, but payment is not refunded.';
    }
    if (!bookingRefunded) {
      return 'Refund and payment are closed, but booking is not refunded.';
    }
    return null;
  }

  if (paymentRefunded && bookingRefunded) {
    return 'Payment and booking are refunded, but the refund case is not closed.';
  }
  if (paymentRefunded) {
    return 'Payment is refunded before the refund case and booking are closed.';
  }
  if (bookingRefunded) {
    return 'Booking is refunded before the refund case and payment are closed.';
  }
  return null;
}

export function normalizeAdminRefundQueueAge(value: string | null | undefined): AdminRefundQueueAge {
  return value === 'under-1h' ||
    value === '1-4h' ||
    value === '4-24h' ||
    value === '1-3d' ||
    value === '3-7d' ||
    value === 'over-7d'
    ? value
    : 'all';
}

export function adminRefundQueueAgeDateWhere(
  value: string | null | undefined,
  now = new Date(),
): Prisma.DateTimeFilter | undefined {
  const nowMs = now.getTime();
  switch (normalizeAdminRefundQueueAge(value)) {
    case 'under-1h':
      return { gte: new Date(nowMs - HOUR_MS), lte: now };
    case '1-4h':
      return { gte: new Date(nowMs - 4 * HOUR_MS), lt: new Date(nowMs - HOUR_MS) };
    case '4-24h':
      return { gte: new Date(nowMs - DAY_MS), lt: new Date(nowMs - 4 * HOUR_MS) };
    case '1-3d':
      return { gte: new Date(nowMs - 3 * DAY_MS), lt: new Date(nowMs - DAY_MS) };
    case '3-7d':
      return { gte: new Date(nowMs - 7 * DAY_MS), lt: new Date(nowMs - 3 * DAY_MS) };
    case 'over-7d':
      return { lt: new Date(nowMs - 7 * DAY_MS) };
    case 'all':
    default:
      return undefined;
  }
}

export function adminRefundQueueMetaQuery(
  options: AdminRefundQueueMetaQueryOptions,
  now = new Date(),
) {
  const baseFilters: Prisma.Sql[] = [adminBookingProductionDataSql(Prisma.sql`booking`)];
  const query = normalizeNullable(options.q);
  const customerProfileId = normalizeNullable(options.customerProfileId);

  if (options.from) baseFilters.push(Prisma.sql`refund."createdAt" >= ${options.from}`);
  if (options.to) baseFilters.push(Prisma.sql`refund."createdAt" <= ${options.to}`);
  if (customerProfileId) {
    baseFilters.push(Prisma.sql`booking."customerProfileId" = ${customerProfileId}`);
  }
  if (query) {
    const contains = `%${query}%`;
    baseFilters.push(Prisma.sql`(
      refund.id ILIKE ${contains}
      OR refund."bookingId" ILIKE ${contains}
      OR refund."paymentId" ILIKE ${contains}
      OR customer_user."fullName" ILIKE ${contains}
      OR customer_user.phone ILIKE ${contains}
    )`);
  }

  const base = Prisma.join(baseFilters, ' AND ');
  const agePredicate = adminRefundAgeSql(options.age, now);
  const slaPredicates = [
    ...(options.slaAfter ? [Prisma.sql`refund."createdAt" > ${options.slaAfter}`] : []),
    ...(options.slaBefore ? [Prisma.sql`refund."createdAt" <= ${options.slaBefore}`] : []),
  ];
  const selectedScope = Prisma.join([agePredicate, ...slaPredicates], ' AND ');
  const reviewPredicate = adminRefundReviewSql(options.review);
  const selectedPredicate = Prisma.join([reviewPredicate, selectedScope], ' AND ');
  const mismatch = adminRefundStateMismatchSql();
  const aligned = Prisma.sql`NOT (${mismatch})`;
  const requested = Prisma.sql`refund.status = 'REQUESTED' AND ${aligned}`;
  const processing = Prisma.sql`
    refund.status IN (${Prisma.join(ADMIN_REFUND_PROCESSING_STATUSES)}) AND ${aligned}
  `;
  const closed = Prisma.sql`refund.status = 'COMPLETED' AND ${aligned}`;
  const rejected = Prisma.sql`refund.status = 'REJECTED' AND ${aligned}`;
  const reviewRequired = Prisma.sql`
    ${aligned}
    AND refund.status NOT IN (
      'REQUESTED',
      ${Prisma.join(ADMIN_REFUND_PROCESSING_STATUSES)},
      'COMPLETED',
      'REJECTED'
    )
  `;
  const open = adminRefundOpenSql();
  const ageReviewScope = Prisma.join([reviewPredicate, ...slaPredicates], ' AND ');
  const overdue = options.overdueBefore
    ? Prisma.sql`${open} AND refund."createdAt" <= ${options.overdueBefore}`
    : Prisma.sql`FALSE`;

  return Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE ${selectedPredicate})::bigint AS "selectedTotal",
      COUNT(*) FILTER (WHERE ${requested} AND ${selectedScope})::bigint AS "requestedCount",
      COUNT(*) FILTER (WHERE ${processing} AND ${selectedScope})::bigint AS "processingCount",
      COUNT(*) FILTER (WHERE ${mismatch} AND ${selectedScope})::bigint AS "stateMismatchCount",
      COUNT(*) FILTER (WHERE ${reviewRequired} AND ${selectedScope})::bigint AS "reviewRequiredCount",
      COUNT(*) FILTER (WHERE ${closed} AND ${selectedScope})::bigint AS "completedCount",
      COUNT(*) FILTER (WHERE ${rejected} AND ${selectedScope})::bigint AS "rejectedCount",
      COUNT(*) FILTER (WHERE ${open} AND ${selectedScope})::bigint AS "openCount",
      MIN(refund."createdAt") FILTER (WHERE ${open} AND ${selectedScope}) AS "oldestOpenAt",
      COUNT(*) FILTER (WHERE ${overdue} AND ${agePredicate})::bigint AS "overdueCount",
      COUNT(*) FILTER (WHERE ${ageReviewScope})::bigint AS "ageAll",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" >= ${new Date(now.getTime() - HOUR_MS)})::bigint AS "ageUnder1h",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" >= ${new Date(now.getTime() - 4 * HOUR_MS)} AND refund."createdAt" < ${new Date(now.getTime() - HOUR_MS)})::bigint AS "age1To4h",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" >= ${new Date(now.getTime() - DAY_MS)} AND refund."createdAt" < ${new Date(now.getTime() - 4 * HOUR_MS)})::bigint AS "age4To24h",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" >= ${new Date(now.getTime() - 3 * DAY_MS)} AND refund."createdAt" < ${new Date(now.getTime() - DAY_MS)})::bigint AS "age1To3d",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" >= ${new Date(now.getTime() - 7 * DAY_MS)} AND refund."createdAt" < ${new Date(now.getTime() - 3 * DAY_MS)})::bigint AS "age3To7d",
      COUNT(*) FILTER (WHERE ${ageReviewScope} AND refund."createdAt" < ${new Date(now.getTime() - 7 * DAY_MS)})::bigint AS "ageOver7d",
      (
        SELECT COUNT(*)::bigint
        FROM "Refund" global_refund
        INNER JOIN "Payment" global_payment ON global_payment.id = global_refund."paymentId"
        INNER JOIN "Booking" global_booking ON global_booking.id = global_refund."bookingId"
        WHERE ${adminBookingProductionDataSql(Prisma.sql`global_booking`)}
          AND ${adminRefundOpenSql(
            Prisma.sql`global_refund`,
            Prisma.sql`global_payment`,
            Prisma.sql`global_booking`,
          )}
      ) AS "globalOpenCount"
    FROM "Refund" refund
    INNER JOIN "Payment" payment ON payment.id = refund."paymentId"
    INNER JOIN "Booking" booking ON booking.id = refund."bookingId"
    INNER JOIN "CustomerProfile" customer ON customer.id = booking."customerProfileId"
    INNER JOIN "User" customer_user ON customer_user.id = customer."userId"
    WHERE ${base}
  `;
}

function adminRefundReviewSql(
  review: string | null | undefined,
  refund = Prisma.sql`refund`,
  payment = Prisma.sql`payment`,
  booking = Prisma.sql`booking`,
) {
  const mismatch = adminRefundStateMismatchSql(refund, payment, booking);
  const aligned = Prisma.sql`NOT (${mismatch})`;
  switch (normalizeNullable(review)) {
    case 'open':
      return adminRefundOpenSql(refund, payment, booking);
    case 'requested':
      return Prisma.sql`${refund}.status = 'REQUESTED' AND ${aligned}`;
    case 'processing':
      return Prisma.sql`${refund}.status IN (${Prisma.join(ADMIN_REFUND_PROCESSING_STATUSES)}) AND ${aligned}`;
    case 'state-mismatch':
    case 'needs-update':
      return mismatch;
    case 'completed':
      return Prisma.sql`${refund}.status = 'COMPLETED' AND ${aligned}`;
    case 'rejected':
      return Prisma.sql`${refund}.status = 'REJECTED' AND ${aligned}`;
    case 'refunded-booking':
      return Prisma.sql`${booking}.status = ${BookingStatus.REFUNDED}::"BookingStatus"`;
    default:
      return Prisma.sql`TRUE`;
  }
}

function adminRefundOpenSql(
  refund = Prisma.sql`refund`,
  payment = Prisma.sql`payment`,
  booking = Prisma.sql`booking`,
) {
  const mismatch = adminRefundStateMismatchSql(refund, payment, booking);
  return Prisma.sql`(
    ${mismatch}
    OR (NOT (${mismatch}) AND ${refund}.status NOT IN ('COMPLETED', 'REJECTED'))
  )`;
}

function adminRefundStateMismatchSql(
  refund = Prisma.sql`refund`,
  payment = Prisma.sql`payment`,
  booking = Prisma.sql`booking`,
) {
  return Prisma.sql`(
    (
      ${refund}.status = 'COMPLETED'
      AND (
        ${payment}.status <> ${PaymentStatus.REFUNDED}::"PaymentStatus"
        OR ${booking}.status <> ${BookingStatus.REFUNDED}::"BookingStatus"
      )
    )
    OR (
      ${refund}.status <> 'COMPLETED'
      AND (
        ${payment}.status = ${PaymentStatus.REFUNDED}::"PaymentStatus"
        OR ${booking}.status = ${BookingStatus.REFUNDED}::"BookingStatus"
      )
    )
  )`;
}

function adminRefundAgeSql(value: string | null | undefined, now: Date) {
  const nowMs = now.getTime();
  switch (normalizeAdminRefundQueueAge(value)) {
    case 'under-1h':
      return Prisma.sql`refund."createdAt" >= ${new Date(nowMs - HOUR_MS)} AND refund."createdAt" <= ${now}`;
    case '1-4h':
      return Prisma.sql`refund."createdAt" >= ${new Date(nowMs - 4 * HOUR_MS)} AND refund."createdAt" < ${new Date(nowMs - HOUR_MS)}`;
    case '4-24h':
      return Prisma.sql`refund."createdAt" >= ${new Date(nowMs - DAY_MS)} AND refund."createdAt" < ${new Date(nowMs - 4 * HOUR_MS)}`;
    case '1-3d':
      return Prisma.sql`refund."createdAt" >= ${new Date(nowMs - 3 * DAY_MS)} AND refund."createdAt" < ${new Date(nowMs - DAY_MS)}`;
    case '3-7d':
      return Prisma.sql`refund."createdAt" >= ${new Date(nowMs - 7 * DAY_MS)} AND refund."createdAt" < ${new Date(nowMs - 3 * DAY_MS)}`;
    case 'over-7d':
      return Prisma.sql`refund."createdAt" < ${new Date(nowMs - 7 * DAY_MS)}`;
    case 'all':
    default:
      return Prisma.sql`TRUE`;
  }
}

function normalizeNullable(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
