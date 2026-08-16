import {
  AppUsageOrigin,
  BookingStatus,
  PaymentStatus,
  Prisma,
  ReviewStatus,
  Role,
} from '@prisma/client';

import { appUsageDay } from '../app-usage/app-usage-daily-aggregate';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_BOOKING_RESOLVED_STATUSES,
  adminBookingUnknownOriginSql,
  adminBookingVerifiedProductionSql,
} from './admin-booking-list-query';
import {
  type AdminUsageOverviewWindow,
  adminUsageComparisonWindow,
  adminUsageRangeWindow,
  normalizeAdminUsageRange,
} from './admin-usage-overview';

const RANK_LIMIT = 10;
const REGION_LIMIT = 5;
export const APP_USAGE_DELAY_THRESHOLD_MS = 48 * 60 * 60 * 1_000;
const RESOLVED_BOOKING_STATUS_SQL = Prisma.join(
  ADMIN_BOOKING_RESOLVED_STATUSES.map((status) => Prisma.sql`${status}::"BookingStatus"`),
);

type UsageOverviewQuery = {
  from?: string;
  range?: string;
  to?: string;
};

type PeriodSummaryRow = {
  activeCustomerCount: bigint | number | null;
  appOpenCount: bigint | number | null;
  bookingCustomerCount: bigint | number | null;
  cancellationCount: bigint | number | null;
  completedBookingCount: bigint | number | null;
  completedCustomerCount: bigint | number | null;
  couponBookingCount: bigint | number | null;
  createdBookingCount: bigint | number | null;
  firstCompletedCustomerCount: bigint | number | null;
  issueCustomerCount: bigint | number | null;
  lowReviewCount: bigint | number | null;
  noShowCount: bigint | number | null;
  expiredCount: bigint | number | null;
  newCustomerCount: bigint | number | null;
  newUnbookedCustomerCount: bigint | number | null;
  partnerBookingRequestCount: bigint | number | null;
  partnerProfileViewCount: bigint | number | null;
  paymentFailureCount: bigint | number | null;
  refundAmount: bigint | number | null;
  refundCount: bigint | number | null;
  unresolvedCount: bigint | number | null;
  repeatCustomerCount: bigint | number | null;
  sessionStartCount: bigint | number | null;
  totalEventCount: bigint | number | null;
  vipCustomerCount: bigint | number | null;
};

type CurrentCustomerBaseRow = {
  active30dCustomerCount: bigint | number | null;
  active7dCustomerCount: bigint | number | null;
  activeTodayCustomerCount: bigint | number | null;
  churnRiskCustomerCount: bigint | number | null;
  neverBookedCustomerCount: bigint | number | null;
};

type FreshnessRow = {
  bookingActivityThroughAt: Date | string | null;
  unknownBookingCount: bigint | number | null;
  reviewActivityThroughAt: Date | string | null;
  refundActivityThroughAt: Date | string | null;
  unknownAggregateCount: bigint | number | null;
  usageAggregatedThroughAt: Date | string | null;
};

type FunnelRow = {
  activeCustomerCount: bigint | number | null;
  bookingCustomerCount: bigint | number | null;
  completedCustomerCount: bigint | number | null;
  viewedCustomerCount: bigint | number | null;
};

type RetentionRow = {
  eligibleCustomerCount: bigint | number | null;
  milestone: bigint | number | null;
  returnedCustomerCount: bigint | number | null;
};

type TrendRow = {
  appOpenCount: bigint | number | null;
  createdBookingCount: bigint | number | null;
  completedBookingCount: bigint | number | null;
  label: string;
  periodStart: Date | string;
  preferredRequestCount: bigint | number | null;
  providerProfileViewCount: bigint | number | null;
  sessionStartCount: bigint | number | null;
};

type CustomerRankingRow = {
  appOpenCount: bigint | number | null;
  completedBookingCount: bigint | number | null;
  customerProfileId: string;
  fullName: string | null;
  issueCount: bigint | number | null;
  lastActivityAt: Date | null;
  phone: string | null;
  providerProfileViewCount: bigint | number | null;
  sessionStartCount: bigint | number | null;
  totalEventCount: bigint | number | null;
  userId: string;
};

type PartnerRankingRow = {
  city: string | null;
  completedCount: bigint | number | null;
  displayName: string | null;
  lastActivityAt: Date | null;
  phone: string | null;
  providerProfileId: string;
  requestCount: bigint | number | null;
  viewCount: bigint | number | null;
};

type PaymentMethodRow = {
  amount: bigint | number | null;
  bookingCount: bigint | number | null;
  method: string;
};

type PopularServiceRow = {
  active: boolean;
  amount: bigint | number | null;
  bookingCount: bigint | number | null;
  durationMin: number;
  name: string;
  quantity: bigint | number | null;
  serviceId: string;
};

type RegionRow = {
  bookingRequestCount: bigint | number | null;
  cancellationCount: bigint | number | null;
  completedBookingCount: bigint | number | null;
  expiredCount: bigint | number | null;
  noShowCount: bigint | number | null;
  refundedCount: bigint | number | null;
  regionCode: string;
  unresolvedCount: bigint | number | null;
};

export async function getAdminUsageOverview(
  prisma: PrismaService,
  query: UsageOverviewQuery = {},
) {
  const window = adminUsageRangeWindow(
    normalizeAdminUsageRange(query.range),
    new Date(),
    query.from,
    query.to,
  );
  const comparisonWindow = adminUsageComparisonWindow(window);
  const generatedAt = new Date();

  const [
    currentSummaryRows,
    comparisonSummaryRows,
    funnelRows,
    retentionRows,
    trendRows,
    customerRankingRows,
    partnerRankingRows,
    paymentMethodRows,
    popularServiceRows,
    regionRows,
    currentCustomerBaseRows,
    freshnessRows,
  ] = await Promise.all([
    queryPeriodSummary(prisma, window),
    comparisonWindow ? queryPeriodSummary(prisma, comparisonWindow) : Promise.resolve([]),
    queryFunnel(prisma, window),
    queryRetention(prisma, window),
    queryTrend(prisma, window),
    queryCustomerRankings(prisma, window),
    queryPartnerRankings(prisma, window),
    queryPaymentMethods(prisma, window),
    queryPopularServices(prisma, window),
    queryRegions(prisma, window),
    queryCurrentCustomerBase(prisma, generatedAt),
    queryFreshness(prisma, window),
  ]);

  const summary = normalizeSummary(currentSummaryRows[0]);
  const previous = normalizeSummary(comparisonSummaryRows[0]);
  const currentCustomerBase = normalizeCurrentCustomerBase(currentCustomerBaseRows[0]);
  const funnel = normalizeFunnel(funnelRows[0]);
  const freshnessRow = freshnessRows[0];
  const usageAggregatedThroughAt = dateValue(freshnessRow?.usageAggregatedThroughAt);
  const unknownAggregateCount = numberValue(freshnessRow?.unknownAggregateCount);
  const unknownBookingCount = numberValue(freshnessRow?.unknownBookingCount);
  const retention = [1, 7, 30].map((milestone) => {
    const row = retentionRows.find((candidate) => numberValue(candidate.milestone) === milestone);
    const eligibleCustomerCount = numberValue(row?.eligibleCustomerCount);
    const returnedCustomerCount = numberValue(row?.returnedCustomerCount);

    return {
      eligibleCustomerCount,
      milestone,
      rate: eligibleCustomerCount > 0 ? percentage(returnedCustomerCount, eligibleCustomerCount) : null,
      returnedCustomerCount,
    };
  });
  const trend = trendRows.map((row) => ({
    appOpenCount: numberValue(row.appOpenCount),
    createdBookingCount: numberValue(row.createdBookingCount),
    completedBookingCount: numberValue(row.completedBookingCount),
    label: row.label,
    periodStart: dateValue(row.periodStart)?.toISOString() ?? null,
    preferredRequestCount: numberValue(row.preferredRequestCount),
    providerProfileViewCount: numberValue(row.providerProfileViewCount),
    sessionStartCount: numberValue(row.sessionStartCount),
  }));
  const customerRankings = customerRankingRows
    .filter((row) => Boolean(row.customerProfileId && row.userId))
    .map((row, index) => ({
    appOpenCount: numberValue(row.appOpenCount),
    completedBookingCount: numberValue(row.completedBookingCount),
    href: `/customers/${row.customerProfileId}`,
    id: row.customerProfileId,
    issueCount: numberValue(row.issueCount),
    label: row.fullName ?? maskPhone(row.phone) ?? 'Unknown customer',
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    providerProfileViewCount: numberValue(row.providerProfileViewCount),
    rank: index + 1,
    secondary: maskPhone(row.phone),
    sessionStartCount: numberValue(row.sessionStartCount),
    totalEventCount: numberValue(row.totalEventCount),
    userId: row.userId,
    }));
  const partnerRankings = partnerRankingRows
    .filter((row) => Boolean(row.providerProfileId))
    .map((row, index) => ({
    completedCount: numberValue(row.completedCount),
    href: `/partners/${row.providerProfileId}`,
    id: row.providerProfileId,
    label: row.displayName ?? maskPhone(row.phone) ?? 'Unknown Partner',
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
    rank: index + 1,
    requestCount: numberValue(row.requestCount),
    secondary: row.city ?? maskPhone(row.phone),
    viewCount: numberValue(row.viewCount),
    }));
  const regionUsage = regionRows.filter((row) => Boolean(row.regionCode)).slice(0, REGION_LIMIT).map((row) => {
    const meta = regionMeta(row.regionCode);
    return {
      bookingRequestCount: numberValue(row.bookingRequestCount),
      cancellationCount: numberValue(row.cancellationCount),
      completedBookingCount: numberValue(row.completedBookingCount),
      customerSessionCount: 0,
      regionCode: row.regionCode,
      regionName: meta.name,
      expiredCount: numberValue(row.expiredCount),
      noShowCount: numberValue(row.noShowCount),
      refundedCount: numberValue(row.refundedCount),
      shortName: meta.shortName,
      unresolvedCount: numberValue(row.unresolvedCount),
    };
  });

  return {
    behavior: {
      hourlyActivity: trend
        .filter((row) => /^\d{2}:00$/.test(row.label))
        .map((row) => ({
          bookingRequestCount: row.preferredRequestCount,
          customerSessionCount: row.sessionStartCount,
          hour: Number(row.label.slice(0, 2)),
          label: row.label,
          totalActivityCount:
            row.appOpenCount +
            row.sessionStartCount +
            row.providerProfileViewCount +
            row.createdBookingCount,
        })),
      popularServices: popularServiceRows
        .filter((row) => Boolean(row.serviceId && row.name))
        .map((row, index) => ({
        amount: numberValue(row.amount),
        bookingCount: numberValue(row.bookingCount),
        id: row.serviceId,
        label: row.name,
        quantity: numberValue(row.quantity),
        rank: index + 1,
        secondary: `${row.durationMin} min${row.active ? '' : ' · inactive'}`,
        })),
      trend,
    },
    bookingQuality: {
      cancellationCount: summary.cancellationCount,
      createdBookingCount: summary.createdBookingCount,
      expiredCount: summary.expiredCount,
      lowReviewCount: summary.lowReviewCount,
      noShowCount: summary.noShowCount,
      refundCount: summary.refundCount,
      unresolvedCount: summary.unresolvedCount,
    },
    comparison: {
      fromDate: comparisonWindow?.fromDate ?? null,
      rangeLabel: 'Previous period',
      toDate: comparisonWindow?.toDate ?? null,
      totals: comparisonTotals(previous),
      windowEndAt: comparisonWindow?.endAt?.toISOString() ?? null,
      windowStartAt: comparisonWindow?.startAt?.toISOString() ?? null,
    },
    customerLifecycle: {
      active30dCustomerCount: currentCustomerBase.active30dCustomerCount,
      active7dCustomerCount: currentCustomerBase.active7dCustomerCount,
      activeCustomerCount: summary.activeCustomerCount,
      activeTodayCustomerCount: currentCustomerBase.activeTodayCustomerCount,
      churnRiskCustomerCount: currentCustomerBase.churnRiskCustomerCount,
      completedCustomerCount: summary.completedCustomerCount,
      neverBookedCustomerCount: currentCustomerBase.neverBookedCustomerCount,
      newCustomerCount: summary.newCustomerCount,
      repeatCustomerCount: summary.repeatCustomerCount,
    },
    customerRankings,
    customerSegments: {
      churnRiskCustomerCount: currentCustomerBase.churnRiskCustomerCount,
      firstCompletedCustomerCount: summary.firstCompletedCustomerCount,
      issueCustomerCount: summary.issueCustomerCount,
      newUnbookedCustomerCount: summary.newUnbookedCustomerCount,
      repeatCustomerCount: summary.repeatCustomerCount,
      vipCustomerCount: summary.vipCustomerCount,
    },
    customerUsage: {
      completedBookingCustomers: customerRankings
        .filter((row) => row.completedBookingCount > 0)
        .map((row) => legacyRankRow(row, row.completedBookingCount, 'completed')),
      lowReviewCustomers: [],
      mostActiveCustomers: customerRankings.map((row) =>
        legacyRankRow(row, row.totalEventCount, 'events'),
      ),
      qualityRiskCustomers: customerRankings
        .filter((row) => row.issueCount > 0)
        .map((row) => legacyRankRow(row, row.issueCount, 'signals')),
    },
    funnel: [
      funnelStep('active', 'Active customers', funnel.activeCustomerCount, null),
      funnelStep('viewed', 'Viewed a Partner', funnel.viewedCustomerCount, funnel.activeCustomerCount),
      funnelStep('booking', 'Created a booking', funnel.bookingCustomerCount, funnel.viewedCustomerCount),
      funnelStep('completed', 'Completed work', funnel.completedCustomerCount, funnel.bookingCustomerCount),
    ],
    dataThroughAt: usageAggregatedThroughAt?.toISOString() ?? null,
    freshness: {
      bookingActivityThroughAt: dateValue(freshnessRow?.bookingActivityThroughAt)?.toISOString() ?? null,
      reportGeneratedAt: generatedAt.toISOString(),
      reviewActivityThroughAt: dateValue(freshnessRow?.reviewActivityThroughAt)?.toISOString() ?? null,
      refundActivityThroughAt: dateValue(freshnessRow?.refundActivityThroughAt)?.toISOString() ?? null,
      usageAggregatedThroughAt: usageAggregatedThroughAt?.toISOString() ?? null,
      usageStatus: usageFreshnessStatus(usageAggregatedThroughAt, window, generatedAt),
    },
    generatedAt: generatedAt.toISOString(),
    partnerRankings,
    partnerUsage: {
      completedPartners: partnerRankings
        .filter((row) => row.completedCount > 0)
        .map((row) => legacyPartnerRankRow(row, row.completedCount, 'completed')),
      discoveryConversion: partnerRankings.map((row) => ({
        ...row,
        completedCount: row.completedCount,
        requestToCompleteRate: null,
        viewToRequestRate: null,
      })),
      mostViewedPartners: partnerRankings.map((row) =>
        legacyPartnerRankRow(row, row.viewCount, 'views'),
      ),
      requestedPartners: partnerRankings
        .filter((row) => row.requestCount > 0)
        .map((row) => legacyPartnerRankRow(row, row.requestCount, 'requests')),
    },
    paymentAndCoupon: {
      couponBookingCount: summary.couponBookingCount,
      paymentFailureCount: summary.paymentFailureCount,
      paymentMethodMix: paymentMethodRows.filter((row) => Boolean(row.method)).map((row) => ({
        amount: numberValue(row.amount),
        bookingCount: numberValue(row.bookingCount),
        method: row.method,
      })),
      refundAmount: summary.refundAmount,
    },
    platformUsage: [],
    range: window.range,
    rangeLabel: window.label,
    appliedRange: {
      dayCount: window.dayCount,
      fromDate: window.fromDate,
      granularity: window.granularity,
      toDate: window.toDate,
    },
    regionUsage,
    retention,
    source: 'stored-usage-aggregates' as const,
    provenance: {
      booking: unknownBookingCount === 0 ? 'guaranteed' as const : 'incomplete' as const,
      unknownBookingCount,
      unknownUsageAggregateCount: unknownAggregateCount,
      usage: unknownAggregateCount === 0 ? 'guaranteed' as const : 'incomplete' as const,
    },
    timeZone: 'Asia/Ho_Chi_Minh' as const,
    totals: {
      activeCustomerCount: summary.activeCustomerCount,
      appOpenCount: summary.appOpenCount,
      bookingCustomerCount: summary.bookingCustomerCount,
      completedBookingCount: summary.completedBookingCount,
      completedCustomerCount: summary.completedCustomerCount,
      customerSessionCount: summary.sessionStartCount,
      partnerBookingRequestCount: summary.partnerBookingRequestCount,
      partnerProfileViewCount: summary.partnerProfileViewCount,
      totalEventCount: summary.totalEventCount,
    },
    windowEndAt: window.endAt?.toISOString() ?? null,
    windowStartAt: window.startAt?.toISOString() ?? null,
  };
}

async function queryPeriodSummary(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const aggregateDay = aggregateDaySql(window);
  const createdAt = bookingTimestampSql('booking."createdAt"', window);
  const closedAt = bookingTimestampSql('booking."closedAt"', window);
  const userCreatedAt = timestampSql('customer_user."createdAt"', window);
  const reviewCreatedAt = timestampSql('review."createdAt"', window);
  const refundCreatedAt = timestampSql('refund."createdAt"', window);

  return prisma.$queryRaw<PeriodSummaryRow[]>(Prisma.sql`
    WITH usage AS (
      SELECT
        COUNT(DISTINCT usage_daily."userId")::bigint AS "activeCustomerCount",
        COALESCE(SUM(usage_daily."totalEventCount"), 0)::bigint AS "totalEventCount",
        COALESCE(SUM(usage_daily."appOpenCount"), 0)::bigint AS "appOpenCount",
        COALESCE(SUM(usage_daily."sessionStartCount"), 0)::bigint AS "sessionStartCount",
        COALESCE(SUM(usage_daily."providerProfileViewCount"), 0)::bigint AS "partnerProfileViewCount"
      FROM "AppUsageDailyAggregate" usage_daily
      WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role"
      AND ${usageAggregateProductionSql()}
      ${aggregateDay}
    ), booking_period AS (
      SELECT booking.* FROM "Booking" booking WHERE TRUE ${createdAt}
    ), closed_period AS (
      SELECT booking.* FROM "Booking" booking WHERE TRUE ${closedAt}
    ), completed_by_customer AS (
      SELECT booking."customerProfileId", COUNT(*)::bigint AS count
      FROM booking_period booking
      WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus"
      GROUP BY booking."customerProfileId"
    )
    SELECT
      usage."activeCustomerCount",
      usage."totalEventCount",
      usage."appOpenCount",
      usage."sessionStartCount",
      usage."partnerProfileViewCount",
      (SELECT COUNT(DISTINCT booking."customerProfileId") FROM booking_period booking)::bigint AS "bookingCustomerCount",
      (SELECT COUNT(*) FROM booking_period)::bigint AS "createdBookingCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus")::bigint AS "completedBookingCount",
      (SELECT COUNT(DISTINCT booking."customerProfileId") FROM booking_period booking WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus")::bigint AS "completedCustomerCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."preferredProviderId" IS NOT NULL)::bigint AS "partnerBookingRequestCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" = ${BookingStatus.CANCELLED}::"BookingStatus")::bigint AS "cancellationCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" = ${BookingStatus.NO_SHOW}::"BookingStatus")::bigint AS "noShowCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" = ${BookingStatus.EXPIRED}::"BookingStatus")::bigint AS "expiredCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" = ${BookingStatus.REFUNDED}::"BookingStatus")::bigint AS "refundCount",
      (SELECT COUNT(*) FROM booking_period booking WHERE booking."status" NOT IN (${RESOLVED_BOOKING_STATUS_SQL}))::bigint AS "unresolvedCount",
      (SELECT COUNT(DISTINCT booking."customerProfileId") FROM closed_period booking WHERE booking."status" IN (${BookingStatus.CANCELLED}::"BookingStatus", ${BookingStatus.NO_SHOW}::"BookingStatus", ${BookingStatus.EXPIRED}::"BookingStatus", ${BookingStatus.REFUNDED}::"BookingStatus"))::bigint AS "issueCustomerCount",
      (SELECT COUNT(*) FROM "User" customer_user INNER JOIN "CustomerProfile" customer ON customer."userId" = customer_user."id" WHERE TRUE ${userCreatedAt} AND customer_user."fixtureKind" IS NULL)::bigint AS "newCustomerCount",
      (SELECT COUNT(*) FROM "User" customer_user INNER JOIN "CustomerProfile" customer ON customer."userId" = customer_user."id" WHERE TRUE ${userCreatedAt} AND customer_user."fixtureKind" IS NULL AND NOT EXISTS (SELECT 1 FROM "Booking" booking WHERE booking."customerProfileId" = customer."id" AND ${usageBookingProductionSql()}))::bigint AS "newUnbookedCustomerCount",
      (SELECT COUNT(*) FROM completed_by_customer WHERE count = 1)::bigint AS "firstCompletedCustomerCount",
      (SELECT COUNT(*) FROM completed_by_customer WHERE count >= 2)::bigint AS "repeatCustomerCount",
      (SELECT COUNT(*) FROM completed_by_customer WHERE count >= 3)::bigint AS "vipCustomerCount",
      (SELECT COUNT(*) FROM "Review" review INNER JOIN "Booking" booking ON booking."id" = review."bookingId" WHERE review."status" = ${ReviewStatus.PUBLISHED}::"ReviewStatus" AND review."rating" <= 2 ${reviewCreatedAt} AND ${usageBookingProductionSql()})::bigint AS "lowReviewCount",
      (SELECT COUNT(*) FROM "Payment" payment INNER JOIN "Booking" booking ON booking."id" = payment."bookingId" WHERE payment."status" = ${PaymentStatus.FAILED}::"PaymentStatus" ${createdAt})::bigint AS "paymentFailureCount",
      (SELECT COALESCE(SUM(refund."amount"), 0) FROM "Refund" refund INNER JOIN "Booking" booking ON booking."id" = refund."bookingId" WHERE TRUE ${refundCreatedAt} AND ${usageBookingProductionSql()})::bigint AS "refundAmount",
      (SELECT COUNT(DISTINCT payment."bookingId") FROM "Payment" payment INNER JOIN closed_period booking ON booking."id" = payment."bookingId" WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" AND (payment."rawMeta" ? 'couponId' OR payment."rawMeta" ? 'couponCode' OR payment."rawMeta" ? 'couponCodeSnapshot'))::bigint AS "couponBookingCount"
    FROM usage
  `);
}

async function queryCurrentCustomerBase(prisma: PrismaService, now: Date) {
  const today = appUsageDay(now);
  const sevenDay = appUsageDay(new Date(now.getTime() - 6 * 86_400_000));
  const thirtyDay = appUsageDay(new Date(now.getTime() - 29 * 86_400_000));

  return prisma.$queryRaw<CurrentCustomerBaseRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM "CustomerProfile" customer INNER JOIN "User" customer_user ON customer_user.id = customer."userId" WHERE customer_user."fixtureKind" IS NULL AND NOT EXISTS (
        SELECT 1 FROM "Booking" booking
        WHERE booking."customerProfileId" = customer."id" AND ${usageBookingProductionSql()}
      ))::bigint AS "neverBookedCustomerCount",
      (SELECT COUNT(*) FROM "CustomerProfile" customer INNER JOIN "User" customer_user ON customer_user.id = customer."userId" WHERE customer_user."fixtureKind" IS NULL AND EXISTS (
        SELECT 1 FROM "Booking" booking
        WHERE booking."customerProfileId" = customer."id"
          AND booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus"
          AND booking."closedAt" < ${thirtyDay}
          AND ${usageBookingProductionSql()}
      ) AND NOT EXISTS (
        SELECT 1 FROM "AppUsageDailyAggregate" recent_usage
        WHERE recent_usage."userId" = customer."userId"
          AND recent_usage."role" = ${Role.CUSTOMER}::"Role"
          AND ${recentUsageAggregateProductionSql()}
          AND recent_usage."day" >= ${thirtyDay}
      ))::bigint AS "churnRiskCustomerCount",
      (SELECT COUNT(DISTINCT usage_daily."userId") FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} AND usage_daily."day" = ${today})::bigint AS "activeTodayCustomerCount",
      (SELECT COUNT(DISTINCT usage_daily."userId") FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} AND usage_daily."day" >= ${sevenDay})::bigint AS "active7dCustomerCount",
      (SELECT COUNT(DISTINCT usage_daily."userId") FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} AND usage_daily."day" >= ${thirtyDay})::bigint AS "active30dCustomerCount"
  `);
}

async function queryFreshness(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const aggregateDay = aggregateDaySql(window);
  const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
  const bookingWindowAt = timestampSql('booking."createdAt"', window);
  const reviewCreatedAt = timestampSql('review."createdAt"', window);
  const refundCreatedAt = timestampSql('refund."createdAt"', window);

  return prisma.$queryRaw<FreshnessRow[]>(Prisma.sql`
    SELECT
      (
        SELECT MAX(usage_daily."lastOccurredAt")
        FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role"
          AND ${usageAggregateProductionSql()}
          ${aggregateDay}
      ) AS "usageAggregatedThroughAt",
      (
        SELECT MAX(booking."updatedAt")
        FROM "Booking" booking
        WHERE TRUE ${bookingCreatedAt}
      ) AS "bookingActivityThroughAt",
      (
        SELECT MAX(review."createdAt")
        FROM "Review" review
        INNER JOIN "Booking" booking ON booking."id" = review."bookingId"
        WHERE TRUE ${reviewCreatedAt} AND ${usageBookingProductionSql()}
      ) AS "reviewActivityThroughAt",
      (
        SELECT MAX(refund."createdAt")
        FROM "Refund" refund
        INNER JOIN "Booking" booking ON booking."id" = refund."bookingId"
        WHERE TRUE ${refundCreatedAt} AND ${usageBookingProductionSql()}
      ) AS "refundActivityThroughAt",
      (
        SELECT COUNT(*)
      FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role"
          AND usage_daily."origin" = ${AppUsageOrigin.UNKNOWN}::"AppUsageOrigin"
          ${aggregateDay}
      )::bigint AS "unknownAggregateCount"
      ,(
        SELECT COUNT(*)
        FROM "Booking" booking
        WHERE TRUE ${bookingWindowAt}
          AND ${adminBookingUnknownOriginSql()}
      )::bigint AS "unknownBookingCount"
  `);
}

async function queryFunnel(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const aggregateDay = aggregateDaySql(window);
  const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
  return prisma.$queryRaw<FunnelRow[]>(Prisma.sql`
    WITH active_users AS (
      SELECT usage_daily."userId", SUM(usage_daily."providerProfileViewCount") AS views
      FROM "AppUsageDailyAggregate" usage_daily
      WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} ${aggregateDay}
      GROUP BY usage_daily."userId"
    ), viewed_users AS (
      SELECT "userId" FROM active_users WHERE views > 0
    ), booking_users AS (
      SELECT DISTINCT customer."userId"
      FROM viewed_users viewed
      INNER JOIN "CustomerProfile" customer ON customer."userId" = viewed."userId"
      INNER JOIN "Booking" booking ON booking."customerProfileId" = customer."id"
      WHERE TRUE ${bookingCreatedAt}
    ), completed_users AS (
      SELECT DISTINCT customer."userId"
      FROM booking_users booked
      INNER JOIN "CustomerProfile" customer ON customer."userId" = booked."userId"
      INNER JOIN "Booking" booking ON booking."customerProfileId" = customer."id"
      WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" ${bookingCreatedAt}
    )
    SELECT
      (SELECT COUNT(*) FROM active_users)::bigint AS "activeCustomerCount",
      (SELECT COUNT(*) FROM viewed_users)::bigint AS "viewedCustomerCount",
      (SELECT COUNT(*) FROM booking_users)::bigint AS "bookingCustomerCount",
      (SELECT COUNT(*) FROM completed_users)::bigint AS "completedCustomerCount"
  `);
}

async function queryRetention(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const startDay = appUsageDay(window.startAt ?? new Date(0));
  const endDay = appUsageDay(new Date(Math.max(0, (window.endAt ?? new Date()).getTime() - 1)));
  return prisma.$queryRaw<RetentionRow[]>(Prisma.sql`
    WITH milestones("milestone") AS (VALUES (1), (7), (30)), cohorts AS (
      SELECT customer_user."id" AS "userId", (customer_user."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS "cohortDay"
      FROM "User" customer_user
      INNER JOIN "CustomerProfile" customer ON customer."userId" = customer_user."id"
      WHERE customer_user."fixtureKind" IS NULL
    )
    SELECT
      milestone."milestone"::bigint AS "milestone",
      COUNT(cohort."userId")::bigint AS "eligibleCustomerCount",
      COUNT(cohort."userId") FILTER (WHERE EXISTS (
        SELECT 1 FROM "AppUsageDailyAggregate" usage_daily
        WHERE usage_daily."userId" = cohort."userId"
          AND usage_daily."role" = ${Role.CUSTOMER}::"Role"
          AND ${usageAggregateProductionSql()}
          AND usage_daily."day" = cohort."cohortDay" + milestone."milestone"
      ))::bigint AS "returnedCustomerCount"
    FROM milestones milestone
    LEFT JOIN cohorts cohort
      ON cohort."cohortDay" + milestone."milestone" BETWEEN ${startDay}::date AND ${endDay}::date
    GROUP BY milestone."milestone"
    ORDER BY milestone."milestone"
  `);
}

async function queryTrend(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const startAt = window.startAt ?? new Date(0);
  const endAt = window.endAt ?? new Date();
  const durationDays = Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000);
  if (durationDays <= 2) {
    const eventAt = timestampSql('event."occurredAt"', window);
    const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
    const bookingClosedAt = bookingTimestampSql('booking."closedAt"', window);
    return prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      WITH hours AS (
        SELECT generate_series(0, 23) AS hour
      ), events AS (
        SELECT
          EXTRACT(HOUR FROM event."occurredAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
          COUNT(*) FILTER (WHERE event."eventType" = 'APP_OPEN')::bigint AS "appOpenCount",
          COUNT(*) FILTER (WHERE event."eventType" = 'SESSION_START')::bigint AS "sessionStartCount",
          COUNT(*) FILTER (WHERE event."eventType" = 'PROVIDER_PROFILE_VIEW')::bigint AS "providerProfileViewCount"
        FROM "AppUsageEvent" event
        WHERE event."role" = ${Role.CUSTOMER}::"Role" ${eventAt} AND ${usageEventProductionSql()}
        GROUP BY 1
      ), created AS (
        SELECT EXTRACT(HOUR FROM booking."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour, COUNT(*)::bigint AS count
        FROM "Booking" booking WHERE TRUE ${bookingCreatedAt} GROUP BY 1
      ), preferred AS (
        SELECT EXTRACT(HOUR FROM booking."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour, COUNT(*)::bigint AS count
        FROM "Booking" booking WHERE booking."preferredProviderId" IS NOT NULL ${bookingCreatedAt} GROUP BY 1
      ), completed AS (
        SELECT EXTRACT(HOUR FROM booking."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour, COUNT(*)::bigint AS count
        FROM "Booking" booking WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" ${bookingClosedAt} GROUP BY 1
      )
      SELECT
        MAKE_INTERVAL(hours => hours.hour) + ${startAt} AS "periodStart",
        LPAD(hours.hour::text, 2, '0') || ':00' AS label,
        COALESCE(events."appOpenCount", 0)::bigint AS "appOpenCount",
        COALESCE(events."sessionStartCount", 0)::bigint AS "sessionStartCount",
        COALESCE(events."providerProfileViewCount", 0)::bigint AS "providerProfileViewCount",
        COALESCE(created.count, 0)::bigint AS "createdBookingCount",
        COALESCE(preferred.count, 0)::bigint AS "preferredRequestCount",
        COALESCE(completed.count, 0)::bigint AS "completedBookingCount"
      FROM hours
      LEFT JOIN events USING (hour)
      LEFT JOIN created USING (hour)
      LEFT JOIN preferred USING (hour)
      LEFT JOIN completed USING (hour)
      ORDER BY hours.hour
    `);
  }

  const aggregateDay = aggregateDaySql(window);
  const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
  const bookingClosedAt = bookingTimestampSql('booking."closedAt"', window);
  return prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    WITH usage AS (
      SELECT usage_daily."day",
        SUM(usage_daily."appOpenCount")::bigint AS "appOpenCount",
        SUM(usage_daily."sessionStartCount")::bigint AS "sessionStartCount",
        SUM(usage_daily."providerProfileViewCount")::bigint AS "providerProfileViewCount"
      FROM "AppUsageDailyAggregate" usage_daily
      WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} ${aggregateDay}
      GROUP BY usage_daily."day"
    ), created AS (
      SELECT (booking."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, COUNT(*)::bigint AS count
      FROM "Booking" booking WHERE TRUE ${bookingCreatedAt} GROUP BY 1
    ), preferred AS (
      SELECT (booking."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, COUNT(*)::bigint AS count
      FROM "Booking" booking WHERE booking."preferredProviderId" IS NOT NULL ${bookingCreatedAt} GROUP BY 1
    ), completed AS (
      SELECT (booking."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, COUNT(*)::bigint AS count
      FROM "Booking" booking WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" ${bookingClosedAt} GROUP BY 1
    ), days AS (
      SELECT generate_series(${appUsageDay(startAt)}::date, ${appUsageDay(new Date(endAt.getTime() - 1))}::date, interval '1 day')::date AS day
    )
    SELECT
      days.day AS "periodStart",
      TO_CHAR(days.day, 'MM/DD') AS label,
      COALESCE(usage."appOpenCount", 0)::bigint AS "appOpenCount",
      COALESCE(usage."sessionStartCount", 0)::bigint AS "sessionStartCount",
      COALESCE(usage."providerProfileViewCount", 0)::bigint AS "providerProfileViewCount",
      COALESCE(created.count, 0)::bigint AS "createdBookingCount",
      COALESCE(preferred.count, 0)::bigint AS "preferredRequestCount",
      COALESCE(completed.count, 0)::bigint AS "completedBookingCount"
    FROM days
    LEFT JOIN usage USING (day)
    LEFT JOIN created USING (day)
    LEFT JOIN preferred USING (day)
    LEFT JOIN completed USING (day)
    ORDER BY days.day
  `);
}

async function queryCustomerRankings(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const aggregateDay = aggregateDaySql(window);
  const bookingClosedAt = bookingTimestampSql('booking."closedAt"', window);
  return prisma.$queryRaw<CustomerRankingRow[]>(Prisma.sql`
    WITH usage AS (
      SELECT usage_daily."userId",
        SUM(usage_daily."totalEventCount")::bigint AS "totalEventCount",
        SUM(usage_daily."appOpenCount")::bigint AS "appOpenCount",
        SUM(usage_daily."sessionStartCount")::bigint AS "sessionStartCount",
        SUM(usage_daily."providerProfileViewCount")::bigint AS "providerProfileViewCount",
        MAX(usage_daily."lastOccurredAt") AS "lastActivityAt"
      FROM "AppUsageDailyAggregate" usage_daily
      WHERE usage_daily."role" = ${Role.CUSTOMER}::"Role" AND ${usageAggregateProductionSql()} ${aggregateDay}
      GROUP BY usage_daily."userId"
    ), bookings AS (
      SELECT booking."customerProfileId",
        COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus")::bigint AS "completedBookingCount",
        COUNT(*) FILTER (WHERE booking."status" IN (${BookingStatus.CANCELLED}::"BookingStatus", ${BookingStatus.NO_SHOW}::"BookingStatus", ${BookingStatus.EXPIRED}::"BookingStatus", ${BookingStatus.REFUNDED}::"BookingStatus"))::bigint AS "issueCount",
        MAX(booking."closedAt") AS "lastActivityAt"
      FROM "Booking" booking WHERE TRUE ${bookingClosedAt}
      GROUP BY booking."customerProfileId"
    )
    SELECT customer."id" AS "customerProfileId", customer."userId", customer_user."fullName", customer_user."phone",
      COALESCE(usage."totalEventCount", 0)::bigint AS "totalEventCount",
      COALESCE(usage."appOpenCount", 0)::bigint AS "appOpenCount",
      COALESCE(usage."sessionStartCount", 0)::bigint AS "sessionStartCount",
      COALESCE(usage."providerProfileViewCount", 0)::bigint AS "providerProfileViewCount",
      COALESCE(bookings."completedBookingCount", 0)::bigint AS "completedBookingCount",
      COALESCE(bookings."issueCount", 0)::bigint AS "issueCount",
      usage."lastActivityAt" AS "lastActivityAt"
    FROM "CustomerProfile" customer
    INNER JOIN "User" customer_user ON customer_user."id" = customer."userId"
    INNER JOIN usage ON usage."userId" = customer."userId" AND usage."totalEventCount" > 0
    LEFT JOIN bookings ON bookings."customerProfileId" = customer."id"
    ORDER BY COALESCE(usage."totalEventCount", 0) DESC, COALESCE(bookings."completedBookingCount", 0) DESC, "lastActivityAt" DESC NULLS LAST
    LIMIT ${RANK_LIMIT}
  `);
}

async function queryPartnerRankings(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const eventAt = timestampSql('event."occurredAt"', window);
  const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
  const bookingClosedAt = bookingTimestampSql('booking."closedAt"', window);
  return prisma.$queryRaw<PartnerRankingRow[]>(Prisma.sql`
    WITH views AS (
      SELECT event."subjectId" AS "providerProfileId", COUNT(*)::bigint AS count, MAX(event."occurredAt") AS "lastActivityAt"
      FROM "AppUsageEvent" event
      WHERE event."eventType" = 'PROVIDER_PROFILE_VIEW'::"AppUsageEventType"
        AND event."subjectType" = 'PROVIDER_PROFILE'
        AND event."subjectId" IS NOT NULL ${eventAt} AND ${usageEventProductionSql()}
      GROUP BY event."subjectId"
    ), requests AS (
      SELECT booking."preferredProviderId" AS "providerProfileId", COUNT(*)::bigint AS count, MAX(booking."createdAt") AS "lastActivityAt"
      FROM "Booking" booking WHERE booking."preferredProviderId" IS NOT NULL ${bookingCreatedAt} GROUP BY booking."preferredProviderId"
    ), completed AS (
      SELECT booking."selectedProviderId" AS "providerProfileId", COUNT(*)::bigint AS count, MAX(booking."closedAt") AS "lastActivityAt"
      FROM "Booking" booking WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" AND booking."selectedProviderId" IS NOT NULL ${bookingClosedAt} GROUP BY booking."selectedProviderId"
    ), ids AS (
      SELECT "providerProfileId" FROM views UNION SELECT "providerProfileId" FROM requests UNION SELECT "providerProfileId" FROM completed
    )
    SELECT provider."id" AS "providerProfileId", provider."displayName", provider.city, provider_user.phone,
      COALESCE(views.count, 0)::bigint AS "viewCount",
      COALESCE(requests.count, 0)::bigint AS "requestCount",
      COALESCE(completed.count, 0)::bigint AS "completedCount",
      GREATEST(views."lastActivityAt", requests."lastActivityAt", completed."lastActivityAt") AS "lastActivityAt"
    FROM ids
    INNER JOIN "ProviderProfile" provider ON provider."id" = ids."providerProfileId"
    INNER JOIN "User" provider_user ON provider_user."id" = provider."userId"
    LEFT JOIN views ON views."providerProfileId" = provider."id"
    LEFT JOIN requests ON requests."providerProfileId" = provider."id"
    LEFT JOIN completed ON completed."providerProfileId" = provider."id"
    ORDER BY COALESCE(views.count, 0) DESC, COALESCE(requests.count, 0) DESC, COALESCE(completed.count, 0) DESC
    LIMIT ${RANK_LIMIT}
  `);
}

async function queryPaymentMethods(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const bookingClosedAt = bookingTimestampSql('booking."closedAt"', window);
  return prisma.$queryRaw<PaymentMethodRow[]>(Prisma.sql`
    SELECT payment.method::text AS method, COUNT(DISTINCT payment."bookingId")::bigint AS "bookingCount", COALESCE(SUM(payment.amount), 0)::bigint AS amount
    FROM "Payment" payment
    INNER JOIN "Booking" booking ON booking."id" = payment."bookingId"
    WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus" ${bookingClosedAt}
    GROUP BY payment.method ORDER BY amount DESC
  `);
}

async function queryPopularServices(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const bookingCreatedAt = bookingTimestampSql('booking."createdAt"', window);
  return prisma.$queryRaw<PopularServiceRow[]>(Prisma.sql`
    SELECT service."id" AS "serviceId", service.name, service."durationMin", service.active,
      COUNT(DISTINCT booking."id")::bigint AS "bookingCount",
      COALESCE(SUM(booking_service.quantity), 0)::bigint AS quantity,
      COALESCE(SUM(booking_service.price * booking_service.quantity), 0)::bigint AS amount
    FROM "BookingService" booking_service
    INNER JOIN "Booking" booking ON booking."id" = booking_service."bookingId"
    INNER JOIN "MassageService" service ON service."id" = booking_service."serviceId"
    WHERE TRUE ${bookingCreatedAt}
    GROUP BY service."id", service.name, service."durationMin", service.active
    ORDER BY "bookingCount" DESC, amount DESC
    LIMIT ${RANK_LIMIT}
  `);
}

async function queryRegions(prisma: PrismaService, window: AdminUsageOverviewWindow) {
  const createdAt = bookingTimestampSql('booking."createdAt"', window);
  const region = Prisma.sql`CASE
    WHEN booking.lat BETWEEN 10.3 AND 11.2 AND booking.lng BETWEEN 106.2 AND 107.3 THEN 'hcm'
    WHEN booking.lat BETWEEN 10.2 AND 10.65 AND booking.lng BETWEEN 106.95 AND 107.45 THEN 'vung-tau'
    WHEN booking.lat BETWEEN 20.75 AND 21.35 AND booking.lng BETWEEN 105.5 AND 106.15 THEN 'hanoi'
    WHEN booking.lat BETWEEN 15.85 AND 16.25 AND booking.lng BETWEEN 107.85 AND 108.45 THEN 'da-nang'
    WHEN booking.lat BETWEEN 12.1 AND 12.4 AND booking.lng BETWEEN 109.0 AND 109.4 THEN 'nha-trang'
    WHEN booking.lat BETWEEN 11.75 AND 12.1 AND booking.lng BETWEEN 108.25 AND 108.65 THEN 'da-lat'
    WHEN booking.lat BETWEEN 9.8 AND 10.2 AND booking.lng BETWEEN 105.55 AND 106.1 THEN 'can-tho'
    ELSE 'other-vietnam' END`;
  return prisma.$queryRaw<RegionRow[]>(Prisma.sql`
    SELECT
      ${region} AS "regionCode",
      COUNT(*)::bigint AS "bookingRequestCount",
      COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus")::bigint AS "completedBookingCount",
      COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.CANCELLED}::"BookingStatus")::bigint AS "cancellationCount",
      COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.NO_SHOW}::"BookingStatus")::bigint AS "noShowCount",
      COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.EXPIRED}::"BookingStatus")::bigint AS "expiredCount",
      COUNT(*) FILTER (WHERE booking."status" = ${BookingStatus.REFUNDED}::"BookingStatus")::bigint AS "refundedCount",
      COUNT(*) FILTER (WHERE booking."status" NOT IN (${RESOLVED_BOOKING_STATUS_SQL}))::bigint AS "unresolvedCount"
    FROM "Booking" booking
    WHERE TRUE ${createdAt}
    GROUP BY 1
    ORDER BY "bookingRequestCount" DESC
    LIMIT ${REGION_LIMIT}
  `);
}

function aggregateDaySql(window: AdminUsageOverviewWindow) {
  if (!window.startAt || !window.endAt) return Prisma.empty;
  const startDay = appUsageDay(window.startAt);
  const endDay = appUsageDay(new Date(window.endAt.getTime() - 1));
  return Prisma.sql`AND usage_daily."day" >= ${startDay} AND usage_daily."day" <= ${endDay}`;
}

function timestampSql(column: string, window: AdminUsageOverviewWindow) {
  if (!window.startAt || !window.endAt) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.raw(column)} >= ${window.startAt} AND ${Prisma.raw(column)} < ${window.endAt}`;
}

function bookingTimestampSql(column: string, window: AdminUsageOverviewWindow) {
  return Prisma.sql`${timestampSql(column, window)} AND ${usageBookingProductionSql()}`;
}

function usageBookingProductionSql() {
  return adminBookingVerifiedProductionSql();
}

function usageEventProductionSql() {
  return Prisma.sql`event."origin" = ${AppUsageOrigin.PRODUCTION}::"AppUsageOrigin"`;
}

function usageAggregateProductionSql() {
  return Prisma.sql`usage_daily."origin" = ${AppUsageOrigin.PRODUCTION}::"AppUsageOrigin"`;
}

function recentUsageAggregateProductionSql() {
  return Prisma.sql`recent_usage."origin" = ${AppUsageOrigin.PRODUCTION}::"AppUsageOrigin"`;
}

export function usageFreshnessStatus(
  usageAggregatedThroughAt: Date | null,
  window: AdminUsageOverviewWindow,
  generatedAt: Date,
) {
  if (!usageAggregatedThroughAt) return 'unknown' as const;
  const expectedThroughAt = Math.min(window.endAt?.getTime() ?? generatedAt.getTime(), generatedAt.getTime());
  return expectedThroughAt - usageAggregatedThroughAt.getTime() > APP_USAGE_DELAY_THRESHOLD_MS
    ? 'delayed' as const
    : 'fresh' as const;
}

function normalizeSummary(row?: PeriodSummaryRow) {
  return {
    activeCustomerCount: numberValue(row?.activeCustomerCount),
    appOpenCount: numberValue(row?.appOpenCount),
    bookingCustomerCount: numberValue(row?.bookingCustomerCount),
    cancellationCount: numberValue(row?.cancellationCount),
    completedBookingCount: numberValue(row?.completedBookingCount),
    completedCustomerCount: numberValue(row?.completedCustomerCount),
    couponBookingCount: numberValue(row?.couponBookingCount),
    createdBookingCount: numberValue(row?.createdBookingCount),
    firstCompletedCustomerCount: numberValue(row?.firstCompletedCustomerCount),
    issueCustomerCount: numberValue(row?.issueCustomerCount),
    lowReviewCount: numberValue(row?.lowReviewCount),
    noShowCount: numberValue(row?.noShowCount),
    expiredCount: numberValue(row?.expiredCount),
    newCustomerCount: numberValue(row?.newCustomerCount),
    newUnbookedCustomerCount: numberValue(row?.newUnbookedCustomerCount),
    partnerBookingRequestCount: numberValue(row?.partnerBookingRequestCount),
    partnerProfileViewCount: numberValue(row?.partnerProfileViewCount),
    paymentFailureCount: numberValue(row?.paymentFailureCount),
    refundAmount: numberValue(row?.refundAmount),
    refundCount: numberValue(row?.refundCount),
    unresolvedCount: numberValue(row?.unresolvedCount),
    repeatCustomerCount: numberValue(row?.repeatCustomerCount),
    sessionStartCount: numberValue(row?.sessionStartCount),
    totalEventCount: numberValue(row?.totalEventCount),
    vipCustomerCount: numberValue(row?.vipCustomerCount),
  };
}

function normalizeCurrentCustomerBase(row?: CurrentCustomerBaseRow) {
  return {
    active30dCustomerCount: numberValue(row?.active30dCustomerCount),
    active7dCustomerCount: numberValue(row?.active7dCustomerCount),
    activeTodayCustomerCount: numberValue(row?.activeTodayCustomerCount),
    churnRiskCustomerCount: numberValue(row?.churnRiskCustomerCount),
    neverBookedCustomerCount: numberValue(row?.neverBookedCustomerCount),
  };
}

function comparisonTotals(summary: ReturnType<typeof normalizeSummary>) {
  return {
    activeCustomerCount: summary.activeCustomerCount,
    appOpenCount: summary.appOpenCount,
    cancellationCount: summary.cancellationCount,
    completedBookingCount: summary.completedBookingCount,
    createdBookingCount: summary.createdBookingCount,
    newCustomerCount: summary.newCustomerCount,
    partnerBookingRequestCount: summary.partnerBookingRequestCount,
    partnerProfileViewCount: summary.partnerProfileViewCount,
    sessionStartCount: summary.sessionStartCount,
    unresolvedCount: summary.unresolvedCount,
  };
}

function normalizeFunnel(row?: FunnelRow) {
  return {
    activeCustomerCount: numberValue(row?.activeCustomerCount),
    bookingCustomerCount: numberValue(row?.bookingCustomerCount),
    completedCustomerCount: numberValue(row?.completedCustomerCount),
    viewedCustomerCount: numberValue(row?.viewedCustomerCount),
  };
}

function funnelStep(key: string, label: string, count: number, previous: number | null) {
  return {
    conversionRate: previous === null ? null : percentage(count, previous),
    count,
    key,
    label,
  };
}

type LegacyCustomerRankingInput = {
  href: string;
  id: string;
  label: string;
  lastActivityAt: string | null;
  rank: number;
  secondary: string | null;
  userId: string;
};

function legacyRankRow(
  row: LegacyCustomerRankingInput,
  value: number,
  valueLabel: string,
) {
  return {
    href: row.href,
    id: row.id,
    label: row.label,
    lastActivityAt: row.lastActivityAt,
    rank: row.rank,
    secondary: row.secondary,
    userId: row.userId,
    value,
    valueLabel,
  };
}

function legacyPartnerRankRow(
  row: {
    href: string;
    id: string;
    label: string;
    lastActivityAt: string | null;
    rank: number;
    secondary: string | null;
  },
  value: number,
  valueLabel: string,
) {
  return { ...row, value, valueLabel };
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  const suffix = digits.slice(-4);
  const prefix = value.trim().startsWith('+') && digits.length > 4 ? `+${digits.slice(0, 2)}` : '';
  return `${prefix}••••••${suffix}`;
}

function numberValue(value: bigint | number | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dateValue(value: Date | string | null | undefined) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function regionMeta(code: string) {
  const values: Record<string, { name: string; shortName: string }> = {
    'can-tho': { name: 'Can Tho', shortName: 'CT' },
    'da-lat': { name: 'Da Lat', shortName: 'DL' },
    'da-nang': { name: 'Da Nang', shortName: 'DN' },
    hanoi: { name: 'Ha Noi', shortName: 'HN' },
    hcm: { name: 'Ho Chi Minh City', shortName: 'HCMC' },
    'nha-trang': { name: 'Nha Trang', shortName: 'NT' },
    'other-vietnam': { name: 'Other Vietnam', shortName: 'VN' },
    'vung-tau': { name: 'Vung Tau', shortName: 'VT' },
  };
  return values[code] ?? values['other-vietnam']!;
}
