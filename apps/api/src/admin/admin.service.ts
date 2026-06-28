import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  EarningStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  PayoutBatchStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderDocumentStatus,
  ProviderKycStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderStatus,
  ReviewStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { EarningsService } from '../earnings/earnings.service';
import {
  NO_SHOW_ADMIN_REVIEW_REQUIRED,
  NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW,
  NO_SHOW_PARTNER_REPORT_POLICY_KEY,
  OPERATIONAL_POLICY_DEFINITIONS,
} from '../matching/matching.policy';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_LOCALES,
  isNotificationTemplateLocale,
} from '../notifications/notification-template-catalog';
import { notificationRetryAuditMetadata } from '../notifications/notification-retry-audit';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_KYC_DOCUMENT_TYPES } from '../provider-onboarding/provider-onboarding.policy';
import { RedisStateService } from '../redis/redis-state.service';
import { ReferralsService } from '../referrals/referrals.service';
import { groupServiceCatalogOptions } from '../services/service-catalog-groups';
import {
  minutesBetween,
  POST_MATCH_CANCELLATION_APPROVED_REASON,
  POST_MATCH_CANCELLATION_HELD_REASON,
  POST_MATCH_CANCELLATION_REVIEW_MINUTES,
  restorePostMatchCancellationEarning,
} from '../bookings/post-match-cancellation';
import {
  withAdminBookingMatchingEvidence,
  withAdminBookingMatchingEvidenceList,
} from './admin-booking-matching-evidence';
import {
  adminBookingListMetadataPayload,
  withAdminBookingListMetadata,
  withAdminBookingListMetadataList,
} from './admin-booking-list-metadata';
import { appendDatedAdminNote } from './admin-booking-ops-helpers';
import {
  normalizeProviderAccountBlockReason,
  normalizeProviderReportCreateInput,
  normalizeProviderReportUpdateInput,
  normalizeProviderSanctionCreateInput,
  providerAccountBlockAuditMetadata,
  providerAccountBlockedNotification,
  providerAccountUnblockAuditMetadata,
  providerAccountUnblockedNotification,
  providerReportCreateAuditMetadata,
  providerSanctionCreateAuditMetadata,
} from './admin-provider-control-helpers';
import {
  ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT,
  adminBookingListSelect,
  adminChatMessageSummarySelect,
  adminCustomerBookingListSelect,
} from './admin-booking-selects';
import { adminBookingDetailSelect, adminPaymentDetailSelect } from './admin-booking-detail-selects';
import {
  adminEarningSummarySelect,
  adminPaymentCallbackAttemptListSelect,
  adminPaymentCallbackAttemptSummarySelect,
  adminPaymentSummarySelect,
  adminRefundListSelect,
} from './admin-payment-selects';
import { adminCustomerDetailSelect } from './admin-customer-selects';
import {
  bookingAuditLogWhere,
  bulkServicePayoutRuleAuditMetadata,
  customerAuditLogWhere,
  paymentAuditLogWhere,
  providerAuditLogWhere,
  servicePayoutRuleAuditMetadata,
  serviceUpdateAuditMetadata,
  toJson,
} from './admin-audit-helpers';
import {
  normalizeServiceDurationSetInput,
  normalizeServiceInput,
  normalizeServicePayoutRuleInput,
} from './admin-service-input';
import {
  adminBookingServiceSummarySelect,
  adminServiceCatalogSelect,
  adminServiceMutationSelect,
  adminServicePayoutRuleMutationSelect,
  adminServicePayoutRuleWithServiceSelect,
} from './admin-service-selects';
import { normalizeAuditReason, normalizeNullable, slugify } from './admin-text-helpers';
import {
  adminProviderReportListSelect,
  adminProviderSanctionListSelect,
  adminProviderSummarySelect,
} from './admin-provider-selects';
import {
  ADMIN_PROVIDER_COMPACT_LIST_LIMIT,
  ADMIN_PROVIDER_CONTROL_LIST_LIMIT,
  ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT,
  ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT,
  ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,
  ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT,
  ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT,
  adminProviderControlSelect,
  adminProviderDetailSelect,
  adminProviderDirectorySelect,
  adminProviderFileReviewSelect,
  adminProviderFileReviewWhere,
  adminProviderListSelect,
  adminProviderOperationsHandoffSelect,
  adminProviderOperationsPolicySelect,
  adminProviderOverviewSelect,
} from './admin-provider-profile-selects';
import {
  adminAppSessionListSelect,
  adminAppSessionSummarySelect,
  adminNotificationBoardListSelect,
  adminNotificationListSelect,
  adminPushDeviceSummarySelect,
  adminUserAuthSelect,
  adminUserListSelect,
  adminUserSummarySelect,
} from './admin-user-selects';
import {
  VIETNAM_REGION_BUCKETS,
  VietnamRegionCode,
  adminVietnamOverviewDateWhere,
  adminVietnamOverviewRangeWindow,
  normalizeAdminVietnamOverviewRange,
  vietnamRegionCodeFromValues,
  vietnamRegionLabel,
} from './admin-vietnam-region-overview';
import {
  adminUsageDateWhere,
  adminUsageRangeWindow,
  buildAdminUsageRegionRows,
  normalizeAdminUsageRange,
} from './admin-usage-overview';
import {
  AdminMarketingDimensionInput,
  AdminMarketingFilters,
  adminMarketingDateWhere,
  adminMarketingRangeWindow,
  buildMarketingDimensionRows,
  buildMarketingFunnel,
  buildMarketingInsights,
  buildMarketingRegionRows,
  emptyMarketingStats,
  normalizeAdminMarketingRange,
  normalizeMarketingPlatform,
  normalizeMarketingPlatformFilter,
  normalizeMarketingSource,
  normalizeMarketingSourceFilter,
  withMarketingRates,
} from './admin-marketing-analytics';
import type { AdminPushCampaignDto, UpdateNotificationTemplateDto } from './admin.dto';

const ADMIN_APP_SESSION_LIST_LIMIT = 100;
const ADMIN_APP_SESSION_LIVE_WINDOW_MS = 5 * 60_000;
const ADMIN_APP_SESSION_RECENT_WINDOW_MS = 30 * 60_000;
const ADMIN_APP_SESSION_STALE_WINDOW_MS = 24 * 60 * 60_000;
const ADMIN_BOOKING_LIST_LIMIT = 100;
const ADMIN_CHAT_ARCHIVE_LIST_LIMIT = 200;
const ADMIN_USER_LIST_LIMIT = 500;
const ADMIN_CUSTOMER_DIRECTORY_DEFAULT_LIMIT = 25;
const ADMIN_CUSTOMER_DIRECTORY_MAX_LIMIT = 100;
const ADMIN_CUSTOMER_LIST_BOOKING_LIMIT = 10;
const ADMIN_CUSTOMER_LIST_LOCATION_LIMIT = 5;
const ADMIN_CUSTOMER_LIST_SESSION_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_PUSH_DEVICE_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT = 3;
const ADMIN_PROVIDER_REPORT_LIST_LIMIT = 100;
const ADMIN_REFERRAL_PARENT_LIST_LIMIT = 100;
const ADMIN_REFERRAL_ATTRIBUTION_LIST_LIMIT = 50;
const ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT = 500;
const ADMIN_USAGE_OVERVIEW_RANK_LIMIT = 10;
const ADMIN_USAGE_OVERVIEW_REGION_LIMIT = 500;
const ADMIN_MARKETING_REGION_LIMIT = 500;
const ADMIN_MARKETING_CAMPAIGN_LIMIT = 50;
const ADMIN_MARKETING_SPEND_LIMIT = 500;
const ADMIN_VIETNAM_ACTIVE_CUSTOMER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_VIETNAM_ONLINE_PARTNER_WINDOW_MS = 90 * 60 * 1000;
const ADMIN_BOOKING_DETAIL_NOTIFICATION_LIMIT = 100;
const ADMIN_NOTIFICATION_BOARD_DEFAULT_LIMIT = 20;
const ADMIN_NOTIFICATION_BOARD_MAX_LIMIT = 20;
const ADMIN_NOTIFICATION_PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const;
const ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT = 100;
const ADMIN_PUSH_SEGMENT_ALL = 'all';
const ADMIN_PUSH_CUSTOMER_SEGMENTS = new Set([
  ADMIN_PUSH_SEGMENT_ALL,
  'customer_completed_last_7_days',
  'customer_completed_inactive_30_days',
  'customer_never_booked',
  'customer_active_last_3_days_no_booking',
  'customer_referral_parents',
]);
const ADMIN_PUSH_PROVIDER_SEGMENTS = new Set([
  ADMIN_PUSH_SEGMENT_ALL,
  'provider_completed_booking',
  'provider_referral_parents',
  'provider_inactive_last_7_days',
]);
const ADMIN_PUSH_DEFAULT_DESTINATION = 'notificationCenter';
const ADMIN_PUSH_CUSTOMER_DESTINATIONS = new Set([
  ADMIN_PUSH_DEFAULT_DESTINATION,
  'booking',
  'chat',
  'providerProfile',
  'profile',
]);
const ADMIN_PUSH_PROVIDER_DESTINATIONS = new Set([
  ADMIN_PUSH_DEFAULT_DESTINATION,
  'booking',
  'jobs',
  'earnings',
  'chat',
  'providerProfile',
  'profile',
]);
const ADMIN_PUSH_SEGMENT_WINDOWS = {
  customerCompletedRecentMs: 7 * 24 * 60 * 60 * 1000,
  customerInactiveMs: 30 * 24 * 60 * 60 * 1000,
  customerActiveNoBookingMs: 3 * 24 * 60 * 60 * 1000,
  providerInactiveMs: 7 * 24 * 60 * 60 * 1000,
};
const ADMIN_PUSH_CAMPAIGN_HISTORY_DEFAULT_LIMIT = 20;
const ADMIN_PUSH_CAMPAIGN_HISTORY_MAX_LIMIT = 50;
const ADMIN_BOOKING_MARKETPLACE_PROVIDER_LIMIT = 120;
const ADMIN_BOOKING_MARKETPLACE_PROVIDER_RADIUS_METERS = 50_000;
const ADMIN_AUDIT_LOG_LIST_LIMIT = 100;
const ADMIN_PAYMENT_OPERATIONS_DEFAULT_LIMIT = 50;
const ADMIN_PAYMENT_OPERATIONS_MAX_LIMIT = 100;
const ADMIN_PAYMENT_CALLBACK_ATTEMPT_DEFAULT_LIMIT = 50;
const ADMIN_PAYMENT_CALLBACK_ATTEMPT_MAX_LIMIT = 100;
const ADMIN_REFUND_OPERATIONS_DEFAULT_LIMIT = 50;
const ADMIN_REFUND_OPERATIONS_MAX_LIMIT = 100;
const ADMIN_REVIEW_BOARD_DEFAULT_LIMIT = 25;
const ADMIN_REVIEW_BOARD_MAX_LIMIT = 100;

type AdminBookingListQuery = {
  readonly dateFrom?: string;
  readonly dateRange?: string;
  readonly dateTo?: string;
  readonly statusGroup?: string;
  readonly take?: number | string | null;
};
type AdminAppSessionListQuery = {
  readonly platform?: string | null;
  readonly q?: string | null;
  readonly role?: string | null;
  readonly skip?: number | string | null;
  readonly state?: string | null;
  readonly take?: number | string | null;
};
type AdminChatArchiveListQuery = {
  readonly dateFrom?: string;
  readonly dateRange?: string;
  readonly dateTo?: string;
  readonly q?: string | null;
  readonly sender?: string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminPaymentOperationsQuery = {
  readonly range?: string | null;
  readonly review?: string | null;
  readonly take?: number | string | null;
};
type AdminPaymentCallbackAttemptQuery = AdminPaymentOperationsQuery;
type AdminRefundOperationsQuery = AdminPaymentOperationsQuery;
const ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CREATED,
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
]);
const ADMIN_VIETNAM_CANCELLATION_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
  BookingStatus.REFUNDED,
]);
const ADMIN_VIETNAM_REVENUE_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CAPTURED,
  PaymentStatus.RELEASED,
]);
const adminAuditLogSelect = {
  id: true,
  action: true,
  target: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, phone: true, fullName: true } },
} satisfies Prisma.AdminAuditLogSelect;

const adminBookingMarketplaceProviderSelect = {
  id: true,
  displayName: true,
  status: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  blockedAt: true,
  user: { select: { id: true, phone: true, fullName: true } },
  verification: { select: { id: true, status: true } },
  earnings: {
    where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, netAmount: true },
  },
} satisfies Prisma.ProviderProfileSelect;

const adminReferralRewardSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  qualifyingBookingId: true,
  walletLedgerReference: true,
  availableAt: true,
  createdAt: true,
} satisfies Prisma.ReferralRewardSelect;

const REFERRAL_REWARD_DECISION_ACTIONS = [
  'referral_reward.hold',
  'referral_reward.credit',
  'referral_reward.reverse',
] as const;

const adminReferralCodeSelect = {
  id: true,
  code: true,
  active: true,
  createdAt: true,
} satisfies Prisma.ReferralCodeSelect;

const adminCustomerReferralParentSelect = {
  id: true,
  user: { select: adminUserSummarySelect },
  referralCodes: {
    where: { audience: ReferralAudience.CUSTOMER },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: adminReferralCodeSelect,
  },
  referralsMade: {
    where: { audience: ReferralAudience.CUSTOMER },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_REFERRAL_ATTRIBUTION_LIST_LIMIT,
    select: {
      id: true,
      status: true,
      fraudReviewStatus: true,
      installSource: true,
      platform: true,
      createdAt: true,
      referredCustomerProfile: {
        select: { id: true, user: { select: adminUserSummarySelect } },
      },
      rewards: {
        orderBy: { createdAt: 'desc' },
        select: adminReferralRewardSelect,
      },
    },
  },
} satisfies Prisma.CustomerProfileSelect;

const adminPartnerReferralParentSelect = {
  id: true,
  displayName: true,
  level: true,
  status: true,
  user: { select: adminUserSummarySelect },
  referralCodes: {
    where: { audience: ReferralAudience.PARTNER },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: adminReferralCodeSelect,
  },
  referralsMade: {
    where: { audience: ReferralAudience.PARTNER },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_REFERRAL_ATTRIBUTION_LIST_LIMIT,
    select: {
      id: true,
      status: true,
      fraudReviewStatus: true,
      installSource: true,
      platform: true,
      createdAt: true,
      referredProviderProfile: {
        select: {
          id: true,
          displayName: true,
          level: true,
          status: true,
          user: { select: adminUserSummarySelect },
        },
      },
      rewards: {
        orderBy: { createdAt: 'desc' },
        select: adminReferralRewardSelect,
      },
    },
  },
} satisfies Prisma.ProviderProfileSelect;

type AdminAuditLogSummary = Prisma.AdminAuditLogGetPayload<{ select: typeof adminAuditLogSelect }>;

type AdminAuditLogListOptions = {
  action?: string | null;
  bucket?: string | null;
  from?: string | null;
  priority?: string | null;
  q?: string | null;
  skip?: number | string | null;
  take?: number | string | null;
  to?: string | null;
};

type AdminCustomerDirectorySummaryOptions = {
  country?: string | null;
  joinedFrom?: string | null;
  joinedTo?: string | null;
  lastBookingFrom?: string | null;
  lastBookingTo?: string | null;
  lastLoginFrom?: string | null;
  lastLoginTo?: string | null;
  q?: string | null;
};

type AdminCustomerDirectoryQueryOptions = AdminCustomerDirectorySummaryOptions & {
  skip?: number | string | null;
  sort?: string | null;
  take?: number | string | null;
};

type AdminPartnerDirectorySummaryOptions = {
  q?: string | null;
  review?: string | null;
};

type AdminPartnerDirectoryQueryOptions = AdminPartnerDirectorySummaryOptions & {
  skip?: number | string | null;
  take?: number | string | null;
};

type AdminReviewBoardSummaryOptions = {
  bookingId?: string | null;
  customerProfileId?: string | null;
  from?: string | null;
  providerProfileId?: string | null;
  q?: string | null;
  review?: string | null;
  to?: string | null;
};

type AdminReviewBoardQueryOptions = AdminReviewBoardSummaryOptions & {
  skip?: number | string | null;
  sort?: string | null;
  take?: number | string | null;
};

type AdminPartnerCustomerReviewBoardSummaryOptions = Omit<AdminReviewBoardSummaryOptions, 'review'>;

type AdminPartnerCustomerReviewBoardQueryOptions = AdminPartnerCustomerReviewBoardSummaryOptions & {
  skip?: number | string | null;
  sort?: string | null;
  take?: number | string | null;
};

type AdminReferralPolicyRecord = {
  id: string;
  audience: ReferralAudience;
  enabled: boolean;
  rewardMode: ReferralRewardMode;
  commissionPercentBps: number | null;
  fixedRewardAmount: number | null;
  perRewardCapAmount: number | null;
  totalRewardCapAmount: number | null;
  maxRewardedReferrals: number | null;
  maxRewardsPerReferred: number | null;
  holdPeriodDays: number;
  currency: string;
  notes: string | null;
  updatedAt: Date;
};

type AdminReferralRewardSummary = Prisma.ReferralRewardGetPayload<{
  select: typeof adminReferralRewardSelect;
}>;

type AdminReferralRewardLatestDecision = {
  action: string;
  actor: AdminAuditLogSummary['actor'];
  createdAt: Date;
  reason: string | null;
  status: string | null;
  walletLedgerReference: string | null;
};

type AdminReferralRewardDecisionMap = ReadonlyMap<string, AdminReferralRewardLatestDecision>;

type AdminCustomerReferralParent = Prisma.CustomerProfileGetPayload<{
  select: typeof adminCustomerReferralParentSelect;
}>;

type AdminPartnerReferralParent = Prisma.ProviderProfileGetPayload<{
  select: typeof adminPartnerReferralParentSelect;
}>;

type AdminProviderActivitySummary = {
  availablePayout: number;
  completedWorkCount: number;
  grossRevenue: number;
  lastCompletedWorkAt: Date | null;
  pendingPayout: number;
  platformFee: number;
  walletBalance: number;
};

type AdminProviderBookingSummary = {
  activeBookingCount: number;
  adminClosedBookingCount: number;
  bookingCount: number;
  chatMissingCount: number;
  chatRoomCount: number;
  closedBookingCount: number;
  completedBookingCount: number;
  customerClosedBookingCount: number;
  latestBookingAt: Date | null;
  matchingBookingCount: number;
  noShowBookingCount: number;
  participatingBookingCount: number;
  partnerClosedBookingCount: number;
  preferredBookingCount: number;
  selectedBookingCount: number;
  workingBookingCount: number;
};

type AdminProviderBookingSummaryRow = AdminProviderBookingSummary & {
  providerId: string;
};

type AdminCustomerActivitySummary = {
  activeBookingCount: number;
  adminClosedBookingCount: number;
  bookingCount: number;
  closedBookingCount: number;
  completedBookingCount: number;
  customerClosedBookingCount: number;
  lastBookingAt: Date | null;
  lastCompletedBookingAt: Date | null;
  noShowBookingCount: number;
  partnerClosedBookingCount: number;
};

type AdminVietnamOverviewRegion = {
  regionCode: string;
  regionName: string;
  shortName: string;
  customerCount: number;
  activeCustomerCount: number;
  partnerCount: number;
  onlinePartnerCount: number;
  activeBookingCount: number;
  completedBookingCount: number;
  cancellationCount: number;
  revenueAmount: number;
  currency: string;
};

type AdminVietnamOverviewPointKind =
  | 'customers'
  | 'active'
  | 'partners'
  | 'online'
  | 'bookings'
  | 'done'
  | 'cancel';

type AdminVietnamOverviewRealtimePointKind = Extract<
  AdminVietnamOverviewPointKind,
  'active' | 'online' | 'bookings'
>;

type AdminVietnamOverviewPoint = {
  id: string;
  kind: AdminVietnamOverviewPointKind;
  label: string;
  latitude: number;
  longitude: number;
  occurredAt: string;
  regionCode: string;
  source: string;
  addressText?: string | null;
  bookingId?: string | null;
  customerProfileId?: string | null;
  providerProfileId?: string | null;
};

type AdminVietnamOverviewRealtimePoint = AdminVietnamOverviewPoint & {
  kind: AdminVietnamOverviewRealtimePointKind;
};

type AdminAuditLogSummaryRow = {
  id: string;
  action: string;
  target: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actorId: string;
  actorPhone: string;
  actorFullName: string | null;
};

type PostMatchCancellationDecision = 'APPROVED' | 'HELD';

type AdminBookingMarketplaceProvider = Prisma.ProviderProfileGetPayload<{
  select: typeof adminBookingMarketplaceProviderSelect;
}>;

function adminBookingListDateWhere(query: AdminBookingListQuery): Prisma.BookingWhereInput | undefined {
  const bounds = adminBookingListDateBounds(query);
  if (!bounds) {
    return undefined;
  }

  const dateRange: { gte?: Date; lte?: Date } = {};
  if (Number.isFinite(bounds.startMs)) {
    dateRange.gte = new Date(bounds.startMs);
  }
  if (Number.isFinite(bounds.endMs)) {
    dateRange.lte = new Date(bounds.endMs);
  }

  return {
    OR: [
      { openedAt: dateRange },
      { createdAt: dateRange },
      { updatedAt: dateRange },
      { matchedAt: dateRange },
      { closedAt: dateRange },
      { expiresAt: dateRange },
    ],
  };
}

function adminBookingListWhere(query: AdminBookingListQuery): Prisma.BookingWhereInput | undefined {
  const filters = [
    adminBookingListDateWhere(query),
    adminBookingListStatusGroupWhere(query.statusGroup),
  ].filter((filter): filter is Prisma.BookingWhereInput => Boolean(filter));

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

function adminBookingListStatusGroupWhere(statusGroup?: string): Prisma.BookingWhereInput | undefined {
  switch (statusGroup) {
    case 'realtime':
      return {
        status: {
          in: [
            BookingStatus.CREATED,
            BookingStatus.OPEN_MATCHING,
            BookingStatus.MATCHED,
            BookingStatus.PROVIDER_ON_THE_WAY,
            BookingStatus.ARRIVED,
            BookingStatus.IN_SERVICE,
          ],
        },
      };
    case 'completed':
      return {
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
        },
      };
    case 'post-match-cancellations':
      return {
        status: {
          in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      };
    default:
      return undefined;
  }
}

function adminBookingListDateBounds(query: AdminBookingListQuery) {
  const nowMs = Date.now();
  const todayStartMs = startOfLocalDay(nowMs);
  const todayEndMs = endOfLocalDay(todayStartMs);

  switch (query.dateRange) {
    case 'today':
      return { startMs: todayStartMs, endMs: todayEndMs };
    case 'yesterday': {
      const startMs = addLocalDays(todayStartMs, -1);
      return { startMs, endMs: endOfLocalDay(startMs) };
    }
    case '7d':
      return { startMs: addLocalDays(todayStartMs, -6), endMs: todayEndMs };
    case '30d':
      return { startMs: addLocalDays(todayStartMs, -29), endMs: todayEndMs };
    case 'custom':
      return adminBookingListCustomDateBounds(query.dateFrom, query.dateTo);
    default:
      return undefined;
  }
}

function adminBookingListCustomDateBounds(dateFrom?: string, dateTo?: string) {
  const fromMs = parseAdminBookingListDate(dateFrom);
  const toMs = parseAdminBookingListDate(dateTo);

  if (fromMs === null && toMs === null) {
    return undefined;
  }

  const startMs = fromMs ?? Number.NEGATIVE_INFINITY;
  const endMs = toMs === null ? Number.POSITIVE_INFINITY : endOfLocalDay(toMs);

  return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
}

function parseAdminBookingListDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(startMs: number) {
  return addLocalDays(startMs, 1) - 1;
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earnings: EarningsService,
    private readonly notifications: NotificationsService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly redisState: RedisStateService,
    private readonly referrals: ReferralsService,
  ) {}

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: ADMIN_USER_LIST_LIMIT,
      select: adminUserListSelect,
    });
  }

  async listCustomers(options: AdminCustomerDirectoryQueryOptions = {}) {
    const where = adminCustomerDirectoryWhere(options);
    const skip = adminCustomerDirectorySkip(options.skip);
    const customers = await this.prisma.customerProfile.findMany({
      orderBy: adminCustomerDirectoryOrderBy(options.sort),
      ...(skip > 0 ? { skip } : {}),
      take: adminCustomerDirectoryTake(options.take),
      ...(where ? { where } : {}),
      select: {
        id: true,
        userId: true,
        addresses: true,
        user: {
          select: {
            ...adminUserSummarySelect,
            appSessions: {
              orderBy: { lastSeenAt: 'desc' },
              take: ADMIN_CUSTOMER_LIST_SESSION_LIMIT,
              select: adminAppSessionSummarySelect,
            },
            pushDevices: {
              orderBy: { updatedAt: 'desc' },
              take: ADMIN_CUSTOMER_LIST_PUSH_DEVICE_LIMIT,
              select: adminPushDeviceSummarySelect,
            },
          },
        },
        selectedLocations: {
          orderBy: { createdAt: 'desc' },
          take: ADMIN_CUSTOMER_LIST_LOCATION_LIMIT,
          select: {
            id: true,
            latitude: true,
            longitude: true,
            addressText: true,
            createdAt: true,
          },
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: ADMIN_CUSTOMER_LIST_BOOKING_LIMIT,
          select: adminCustomerBookingListSelect,
        },
      },
    });

    if (customers.length === 0) {
      return customers;
    }

    const customerIds = customers.map((customer) => customer.id);
    const [activitySummaries, { logsByTarget, countByTarget }] = await Promise.all([
      this.getCustomerListActivitySummaries(customerIds),
      this.getAuditLogSummaryByTargets(
        customerIds.map((customerId) => `customer:${customerId}`),
        ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT,
      ),
    ]);

    return customers.map((customer) => ({
      ...customer,
      activitySummary: activitySummaries.get(customer.id) ?? emptyCustomerActivitySummary(),
      auditLogs: logsByTarget.get(`customer:${customer.id}`) ?? [],
      auditLogCount: countByTarget.get(`customer:${customer.id}`) ?? 0,
    }));
  }

  async customerSummary(options: AdminCustomerDirectorySummaryOptions = {}) {
    const where = adminCustomerDirectoryWhere(options);
    const totalCount = await this.prisma.customerProfile.count({
      ...(where ? { where } : {}),
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
    };
  }

  async getCustomerDetail(customerProfileId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: adminCustomerDetailSelect,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: customerAuditLogWhere(customerProfileId, customer.userId),
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminAuditLogSelect,
    });

    return { ...customer, auditLogs };
  }

  async addCustomerOpsNote(
    actorId: string,
    customerProfileId: string,
    input: { note?: string; preset?: string; bookingId?: string | null },
  ) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Customer operation note is required');
    }

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { id: true, userId: true, user: { select: { id: true, phone: true, fullName: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const bookingId = normalizeNullable(input.bookingId);
    if (bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, customerProfileId },
        select: { id: true, status: true },
      });
      if (!booking) {
        throw new BadRequestException('Booking does not belong to this customer');
      }
    }

    const auditLog = await this.writeAudit(
      actorId,
      'customer.ops_note.add',
      `customer:${customerProfileId}`,
      {
        customerProfileId,
        customerUserId: customer.userId,
        customerPhone: customer.user.phone,
        customerName: customer.user.fullName,
        bookingId,
        note: content,
        preset,
      },
    );

    return { ok: true, auditLog };
  }

  listAppSessions(options: AdminAppSessionListQuery = {}) {
    const where = adminAppSessionListWhere(options);
    const skip = adminAppSessionListSkip(options.skip);
    return this.prisma.appSession.findMany({
      ...(where ? { where } : {}),
      orderBy: { lastSeenAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminAppSessionListTake(options.take),
      select: adminAppSessionListSelect,
    });
  }

  async listReferralPolicies() {
    const policies = await this.prisma.referralPolicy.findMany({
      orderBy: { audience: 'asc' },
    });

    return {
      customer: adminReferralPolicyView(
        ReferralAudience.CUSTOMER,
        policies.find((policy) => policy.audience === ReferralAudience.CUSTOMER) ?? null,
      ),
      partner: adminReferralPolicyView(
        ReferralAudience.PARTNER,
        policies.find((policy) => policy.audience === ReferralAudience.PARTNER) ?? null,
      ),
    };
  }

  async updateReferralPolicy(
    actorId: string,
    audienceInput: string,
    input: {
      commissionPercentBps?: number | null;
      currency?: string;
      enabled?: boolean;
      fixedRewardAmount?: number | null;
      holdPeriodDays?: number;
      maxRewardedReferrals?: number | null;
      maxRewardsPerReferred?: number | null;
      notes?: string | null;
      perRewardCapAmount?: number | null;
      reason?: string;
      rewardMode?: ReferralRewardMode;
      totalRewardCapAmount?: number | null;
    },
  ) {
    const audience = normalizeReferralAudienceInput(audienceInput);
    const rewardMode = input.rewardMode ?? defaultReferralRewardMode(audience);
    const expectedMode = defaultReferralRewardMode(audience);
    if (rewardMode !== expectedMode) {
      throw new BadRequestException(
        audience === ReferralAudience.CUSTOMER
          ? 'Customer referral policy must use commission percent rewards'
          : 'Partner referral policy must use fixed amount rewards',
      );
    }

    const enabled = input.enabled ?? false;
    const commissionPercentBps =
      rewardMode === ReferralRewardMode.COMMISSION_PERCENT ? (input.commissionPercentBps ?? 0) : null;
    const fixedRewardAmount =
      rewardMode === ReferralRewardMode.FIXED_AMOUNT ? (input.fixedRewardAmount ?? 0) : null;

    if (
      enabled &&
      rewardMode === ReferralRewardMode.COMMISSION_PERCENT &&
      Number(commissionPercentBps) <= 0
    ) {
      throw new BadRequestException(
        'Customer referral commission percent must be greater than zero when enabled',
      );
    }
    if (enabled && rewardMode === ReferralRewardMode.FIXED_AMOUNT && Number(fixedRewardAmount) <= 0) {
      throw new BadRequestException(
        'Partner referral fixed reward amount must be greater than zero when enabled',
      );
    }

    const previous = await this.prisma.referralPolicy.findUnique({ where: { audience } });
    const policy = await this.prisma.referralPolicy.upsert({
      where: { audience },
      create: {
        audience,
        enabled,
        rewardMode,
        commissionPercentBps,
        fixedRewardAmount,
        perRewardCapAmount: input.perRewardCapAmount ?? null,
        totalRewardCapAmount: input.totalRewardCapAmount ?? null,
        maxRewardedReferrals: input.maxRewardedReferrals ?? null,
        maxRewardsPerReferred: input.maxRewardsPerReferred ?? null,
        holdPeriodDays: input.holdPeriodDays ?? 7,
        currency: normalizeReferralCurrency(input.currency),
        notes: normalizeNullable(input.notes),
        createdById: actorId,
        updatedById: actorId,
      },
      update: {
        enabled,
        rewardMode,
        commissionPercentBps,
        fixedRewardAmount,
        perRewardCapAmount: input.perRewardCapAmount ?? null,
        totalRewardCapAmount: input.totalRewardCapAmount ?? null,
        maxRewardedReferrals: input.maxRewardedReferrals ?? null,
        maxRewardsPerReferred: input.maxRewardsPerReferred ?? null,
        holdPeriodDays: input.holdPeriodDays ?? 7,
        currency: normalizeReferralCurrency(input.currency),
        notes: normalizeNullable(input.notes),
        updatedById: actorId,
      },
    });
    const result = adminReferralPolicyView(audience, policy);

    await this.writeAudit(actorId, 'referral_policy.update', `referral_policy:${audience}`, {
      audience,
      previous: previous ? adminReferralPolicyView(audience, previous) : null,
      value: result,
      reason: normalizeAuditReason(input.reason),
    });

    return result;
  }

  async releaseAvailableReferralRewards(actorId: string) {
    const result = await this.referrals.releaseAvailableRewards();

    await this.writeAudit(actorId, 'referral_reward.release_available', 'referral_rewards:available', {
      releasedCount: result.releasedCount,
      walletCreditCreated: false,
    });

    return result;
  }

  async holdReferralReward(actorId: string, rewardId: string, input: { reason?: string } = {}) {
    const reward = await this.referrals.holdRewardCandidate(rewardId);

    await this.writeAudit(actorId, 'referral_reward.hold', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      currency: reward.currency,
      reason: normalizeAuditReason(input.reason),
      status: reward.status,
      walletCreditCreated: false,
    });

    return reward;
  }

  async creditReferralReward(actorId: string, rewardId: string, input: { reason?: string } = {}) {
    const reward = await this.referrals.creditRewardCandidate(rewardId);

    await this.writeAudit(actorId, 'referral_reward.credit', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      currency: reward.currency,
      reason: normalizeAuditReason(input.reason),
      status: reward.status,
      walletCreditCreated: true,
      walletLedgerReference: reward.walletLedgerReference,
    });

    return reward;
  }

  async reverseReferralReward(actorId: string, rewardId: string, input: { reason?: string } = {}) {
    const reward = await this.referrals.reverseRewardCandidate(rewardId);

    await this.writeAudit(actorId, 'referral_reward.reverse', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      currency: reward.currency,
      reason: normalizeAuditReason(input.reason),
      status: reward.status,
      walletCreditCreated: false,
    });

    return reward;
  }

  async listCustomerReferralParents() {
    const rows = await this.prisma.customerProfile.findMany({
      where: { referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } },
      orderBy: { id: 'desc' },
      take: ADMIN_REFERRAL_PARENT_LIST_LIMIT,
      select: adminCustomerReferralParentSelect,
    });
    const decisions = await this.listLatestReferralRewardDecisions(adminCustomerReferralRewardIds(rows));

    return rows.map((row) => adminCustomerReferralParentView(row, decisions));
  }

  async getCustomerReferralParent(customerProfileId: string) {
    const row = await this.prisma.customerProfile.findFirst({
      where: {
        id: customerProfileId,
        referralsMade: { some: { audience: ReferralAudience.CUSTOMER } },
      },
      select: adminCustomerReferralParentSelect,
    });
    if (!row) {
      throw new NotFoundException('Customer referral parent was not found');
    }
    const decisions = await this.listLatestReferralRewardDecisions(adminCustomerReferralRewardIds([row]));

    return adminCustomerReferralParentView(row, decisions);
  }

  async listPartnerReferralParents() {
    const rows = await this.prisma.providerProfile.findMany({
      where: { referralsMade: { some: { audience: ReferralAudience.PARTNER } } },
      orderBy: { id: 'desc' },
      take: ADMIN_REFERRAL_PARENT_LIST_LIMIT,
      select: adminPartnerReferralParentSelect,
    });
    const decisions = await this.listLatestReferralRewardDecisions(adminPartnerReferralRewardIds(rows));

    return rows.map((row) => adminPartnerReferralParentView(row, decisions));
  }

  async getPartnerReferralParent(providerProfileId: string) {
    const row = await this.prisma.providerProfile.findFirst({
      where: {
        id: providerProfileId,
        referralsMade: { some: { audience: ReferralAudience.PARTNER } },
      },
      select: adminPartnerReferralParentSelect,
    });
    if (!row) {
      throw new NotFoundException('Partner referral parent was not found');
    }
    const decisions = await this.listLatestReferralRewardDecisions(adminPartnerReferralRewardIds([row]));

    return adminPartnerReferralParentView(row, decisions);
  }

  private async listLatestReferralRewardDecisions(rewardIds: readonly string[]) {
    const targets = [...new Set(rewardIds.map(referralRewardAuditTarget))];
    if (targets.length === 0) {
      return new Map<string, AdminReferralRewardLatestDecision>();
    }

    const logs = await this.prisma.adminAuditLog.findMany({
      where: {
        action: { in: [...REFERRAL_REWARD_DECISION_ACTIONS] },
        target: { in: targets },
      },
      orderBy: { createdAt: 'desc' },
      select: adminAuditLogSelect,
    });
    const decisions = new Map<string, AdminReferralRewardLatestDecision>();
    for (const log of logs) {
      const rewardId = referralRewardIdFromAuditTarget(log.target);
      if (rewardId && !decisions.has(rewardId)) {
        decisions.set(rewardId, referralRewardLatestDecisionView(log));
      }
    }

    return decisions;
  }

  async getVietnamOverview(rangeInput?: string) {
    const now = new Date();
    const window = adminVietnamOverviewRangeWindow(normalizeAdminVietnamOverviewRange(rangeInput), now);
    const dateWhere = adminVietnamOverviewDateWhere(window);
    const bookingWhere: Prisma.BookingWhereInput = dateWhere
      ? {
          OR: [{ createdAt: dateWhere }, { updatedAt: dateWhere }, { closedAt: dateWhere }],
        }
      : {};
    const activeCustomerSince = new Date(now.getTime() - ADMIN_VIETNAM_ACTIVE_CUSTOMER_WINDOW_MS);
    const onlinePartnerSince = new Date(now.getTime() - ADMIN_VIETNAM_ONLINE_PARTNER_WINDOW_MS);
    const regions = new Map<string, AdminVietnamOverviewRegion>(
      VIETNAM_REGION_BUCKETS.map((bucket) => [
        bucket.code,
        {
          regionCode: bucket.code,
          regionName: bucket.name,
          shortName: bucket.shortName,
          customerCount: 0,
          activeCustomerCount: 0,
          partnerCount: 0,
          onlinePartnerCount: 0,
          activeBookingCount: 0,
          completedBookingCount: 0,
          cancellationCount: 0,
          revenueAmount: 0,
          currency: 'VND',
        },
      ]),
    );

    const [customers, providers, bookings, realtimeBookings] = await Promise.all([
      this.prisma.customerProfile.findMany({
        orderBy: { id: 'desc' },
        take: ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT,
        select: {
          id: true,
          addresses: true,
          selectedLocations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              addressText: true,
              latitude: true,
              longitude: true,
              createdAt: true,
            },
          },
          user: {
            select: {
              appSessions: {
                where: {
                  role: Role.CUSTOMER,
                },
                orderBy: { lastSeenAt: 'desc' },
                take: 1,
                select: {
                  lastLoginAddress: true,
                  lastSeenAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.providerProfile.findMany({
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT,
        select: {
          id: true,
          displayName: true,
          city: true,
          residentialAddress: true,
          serviceArea: true,
          status: true,
          currentLat: true,
          currentLng: true,
          currentLocationUpdatedAt: true,
        },
      }),
      this.prisma.booking.findMany({
        where: bookingWhere,
        orderBy: { createdAt: 'desc' },
        take: ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT,
        select: {
          id: true,
          status: true,
          address: true,
          lat: true,
          lng: true,
          createdAt: true,
          updatedAt: true,
          closedAt: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
          payment: {
            select: {
              amount: true,
              currency: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: Array.from(ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES) },
        },
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT,
        select: {
          id: true,
          address: true,
          lat: true,
          lng: true,
          createdAt: true,
          updatedAt: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
    ]);
    const realtimePoints: AdminVietnamOverviewRealtimePoint[] = [];

    for (const customer of customers) {
      const selectedLocation = customer.selectedLocations[0];
      const region = ensureVietnamOverviewRegion(
        regions,
        vietnamRegionCodeFromValues(
          [selectedLocation?.addressText, customer.addresses, customer.user.appSessions[0]?.lastLoginAddress],
          {
            latitude: selectedLocation?.latitude,
            longitude: selectedLocation?.longitude,
          },
        ),
      );
      region.customerCount += 1;

      const lastSeenAt = customer.user.appSessions[0]?.lastSeenAt;
      if (lastSeenAt && (!dateWhere || lastSeenAt >= activeCustomerSince)) {
        region.activeCustomerCount += 1;
        const activePoint = vietnamOverviewEventPoint({
          id: `active-customer:${customer.id}:${lastSeenAt.toISOString()}`,
          kind: 'active',
          label: 'Active customer session anchored to saved location',
          latitude: selectedLocation?.latitude,
          longitude: selectedLocation?.longitude,
          occurredAt: lastSeenAt,
          source: 'customer-session-selected-location',
          addressText: selectedLocation?.addressText ?? customer.user.appSessions[0]?.lastLoginAddress,
          customerProfileId: customer.id,
        });
        if (activePoint) {
          realtimePoints.push(activePoint);
        }
      }
    }

    for (const provider of providers) {
      const region = ensureVietnamOverviewRegion(
        regions,
        vietnamRegionCodeFromValues([provider.city, provider.residentialAddress, provider.serviceArea], {
          latitude: provider.currentLat,
          longitude: provider.currentLng,
        }),
      );
      region.partnerCount += 1;

      if (
        provider.status !== ProviderStatus.OFFLINE &&
        provider.currentLocationUpdatedAt &&
        provider.currentLocationUpdatedAt >= onlinePartnerSince
      ) {
        region.onlinePartnerCount += 1;
        const onlinePoint = vietnamOverviewEventPoint({
          id: `online-partner:${provider.id}:${provider.currentLocationUpdatedAt.toISOString()}`,
          kind: 'online',
          label: provider.displayName,
          latitude: provider.currentLat,
          longitude: provider.currentLng,
          occurredAt: provider.currentLocationUpdatedAt,
          source: 'partner-online-heartbeat-location',
          addressText: provider.residentialAddress ?? provider.city,
          providerProfileId: provider.id,
        });
        if (onlinePoint) {
          realtimePoints.push(onlinePoint);
        }
      }
    }

    for (const booking of bookings) {
      const bookingAddressLatitude = booking.addressSnapshot?.latitude ?? booking.lat;
      const bookingAddressLongitude = booking.addressSnapshot?.longitude ?? booking.lng;
      const region = ensureVietnamOverviewRegion(
        regions,
        vietnamRegionCodeFromValues(
          [booking.addressSnapshot?.addressText, booking.address, booking.addressSnapshot?.address],
          {
            latitude: bookingAddressLatitude,
            longitude: bookingAddressLongitude,
          },
        ),
      );

      if (booking.status === BookingStatus.COMPLETED) {
        region.completedBookingCount += 1;
      }

      if (ADMIN_VIETNAM_CANCELLATION_STATUSES.has(booking.status)) {
        region.cancellationCount += 1;
      }

      if (booking.payment && ADMIN_VIETNAM_REVENUE_STATUSES.has(booking.payment.status)) {
        region.revenueAmount += numberValue(booking.payment.amount);
        region.currency = booking.payment.currency || region.currency;
      }
    }

    for (const booking of realtimeBookings) {
      const activeBookingAddressText: string | null =
        typeof booking.addressSnapshot?.addressText === 'string'
          ? booking.addressSnapshot.addressText
          : typeof booking.addressSnapshot?.address === 'string'
            ? booking.addressSnapshot.address
            : typeof booking.address === 'string'
              ? booking.address
              : null;
      const activeBookingLatitude = booking.addressSnapshot?.latitude ?? booking.lat;
      const activeBookingLongitude = booking.addressSnapshot?.longitude ?? booking.lng;
      const region = ensureVietnamOverviewRegion(
        regions,
        vietnamRegionCodeFromValues([activeBookingAddressText], {
          latitude: activeBookingLatitude,
          longitude: activeBookingLongitude,
        }),
      );
      const activeBookingPoint = vietnamOverviewEventPoint({
        id: `booking:${booking.id}:active`,
        kind: 'bookings',
        label: 'Active booking service address',
        latitude: activeBookingLatitude,
        longitude: activeBookingLongitude,
        occurredAt: latestDate(booking.updatedAt, booking.createdAt),
        source: 'booking-address-snapshot',
        addressText: activeBookingAddressText,
        bookingId: booking.id,
      });
      if (activeBookingPoint) {
        region.activeBookingCount += 1;
        realtimePoints.push(activeBookingPoint);
      }
    }

    const regionRows = Array.from(regions.values());

    return {
      generatedAt: now.toISOString(),
      refreshSeconds: 60,
      source: 'stored-address-aggregates',
      range: window.range,
      rangeLabel: window.label,
      windowStartAt: window.startAt?.toISOString() ?? null,
      windowEndAt: window.endAt?.toISOString() ?? null,
      totals: {
        customerCount: regionRows.reduce((total, region) => total + region.customerCount, 0),
        activeCustomerCount: regionRows.reduce((total, region) => total + region.activeCustomerCount, 0),
        partnerCount: regionRows.reduce((total, region) => total + region.partnerCount, 0),
        onlinePartnerCount: regionRows.reduce((total, region) => total + region.onlinePartnerCount, 0),
        activeBookingCount: regionRows.reduce((total, region) => total + region.activeBookingCount, 0),
        completedBookingCount: regionRows.reduce((total, region) => total + region.completedBookingCount, 0),
        cancellationCount: regionRows.reduce((total, region) => total + region.cancellationCount, 0),
        revenueAmount: regionRows.reduce((total, region) => total + region.revenueAmount, 0),
        currency: 'VND',
      },
      regions: regionRows,
      points: realtimePoints,
      realtimePoints,
    };
  }

  async getUsageOverview(rangeInput?: string) {
    const window = adminUsageRangeWindow(normalizeAdminUsageRange(rangeInput));
    const dateWhere = adminUsageDateWhere(window);
    const sessionWhere = {
      role: Role.CUSTOMER,
      ...(dateWhere ? { lastSeenAt: dateWhere } : {}),
    };
    const completedBookingWhere = {
      status: BookingStatus.COMPLETED,
      ...(dateWhere ? { closedAt: dateWhere } : {}),
    };
    const bookingRequestWhere = {
      preferredProviderId: { not: null },
      ...(dateWhere ? { createdAt: dateWhere } : {}),
    };
    const completedPartnerBookingWhere = {
      status: BookingStatus.COMPLETED,
      selectedProviderId: { not: null },
      ...(dateWhere ? { closedAt: dateWhere } : {}),
    };
    const profileViewWhere = dateWhere ? { lastViewedAt: dateWhere } : {};

    const [
      customerSessionRows,
      completedCustomerRows,
      viewedPartnerRows,
      requestedPartnerRows,
      completedPartnerRows,
      regionSessionRows,
      regionBookingRequestRows,
      regionCompletedBookingRows,
      customerSessionCount,
      completedBookingCount,
      profileViewCount,
      bookingRequestCount,
    ] = await Promise.all([
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: sessionWhere,
        _count: { _all: true },
        _max: { lastSeenAt: true },
        orderBy: { _count: { userId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.booking.groupBy({
        by: ['customerProfileId'],
        where: completedBookingWhere,
        _count: { _all: true },
        _max: { closedAt: true, updatedAt: true },
        orderBy: { _count: { customerProfileId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.customerProviderProfileView.groupBy({
        by: ['providerProfileId'],
        where: profileViewWhere,
        _count: { _all: true },
        _sum: { viewCount: true },
        _max: { lastViewedAt: true },
        orderBy: { _sum: { viewCount: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.booking.groupBy({
        by: ['preferredProviderId'],
        where: bookingRequestWhere,
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _count: { preferredProviderId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.booking.groupBy({
        by: ['selectedProviderId'],
        where: completedPartnerBookingWhere,
        _count: { _all: true },
        _max: { closedAt: true, updatedAt: true },
        orderBy: { _count: { selectedProviderId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.appSession.findMany({
        where: sessionWhere,
        orderBy: { lastSeenAt: 'desc' },
        take: ADMIN_USAGE_OVERVIEW_REGION_LIMIT,
        select: { lastLoginAddress: true },
      }),
      this.prisma.booking.findMany({
        where: bookingRequestWhere,
        orderBy: { createdAt: 'desc' },
        take: ADMIN_USAGE_OVERVIEW_REGION_LIMIT,
        select: {
          address: true,
          lat: true,
          lng: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: completedBookingWhere,
        orderBy: { closedAt: 'desc' },
        take: ADMIN_USAGE_OVERVIEW_REGION_LIMIT,
        select: {
          address: true,
          lat: true,
          lng: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.appSession.count({ where: sessionWhere }),
      this.prisma.booking.count({ where: completedBookingWhere }),
      this.prisma.customerProviderProfileView.count({ where: profileViewWhere }),
      this.prisma.booking.count({ where: bookingRequestWhere }),
    ]);

    const customerUserIds = customerSessionRows.map((row) => row.userId);
    const customerProfileIds = completedCustomerRows.map((row) => row.customerProfileId);
    const providerProfileIds = uniqueStrings([
      ...viewedPartnerRows.map((row) => row.providerProfileId),
      ...requestedPartnerRows.map((row) => row.preferredProviderId),
      ...completedPartnerRows.map((row) => row.selectedProviderId),
    ]);

    const [customerUsers, customerProfiles, providers] = await Promise.all([
      customerUserIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: customerUserIds } },
            select: {
              id: true,
              phone: true,
              fullName: true,
              customerProfile: { select: { id: true } },
            },
          })
        : [],
      customerProfileIds.length
        ? this.prisma.customerProfile.findMany({
            where: { id: { in: customerProfileIds } },
            select: {
              id: true,
              user: {
                select: {
                  phone: true,
                  fullName: true,
                },
              },
            },
          })
        : [],
      providerProfileIds.length
        ? this.prisma.providerProfile.findMany({
            where: { id: { in: providerProfileIds } },
            select: {
              id: true,
              displayName: true,
              city: true,
              user: {
                select: {
                  phone: true,
                },
              },
            },
          })
        : [],
    ]);

    const customerUserMap = new Map(customerUsers.map((user) => [user.id, user]));
    const customerProfileMap = new Map(customerProfiles.map((profile) => [profile.id, profile]));
    const providerMap = new Map(providers.map((provider) => [provider.id, provider]));

    return {
      generatedAt: new Date().toISOString(),
      refreshSeconds: 60,
      source: 'stored-usage-aggregates',
      range: window.range,
      rangeLabel: window.label,
      windowStartAt: window.startAt?.toISOString() ?? null,
      windowEndAt: window.endAt?.toISOString() ?? null,
      totals: {
        customerSessionCount,
        completedBookingCount,
        partnerProfileViewCount: profileViewCount,
        partnerBookingRequestCount: bookingRequestCount,
      },
      customerUsage: {
        mostActiveCustomers: customerSessionRows.map((row, index) => {
          const user = customerUserMap.get(row.userId);

          return {
            rank: index + 1,
            id: user?.customerProfile?.id ?? row.userId,
            userId: row.userId,
            label: user?.fullName ?? user?.phone ?? 'Unknown customer',
            secondary: user?.phone ?? null,
            href: user?.customerProfile?.id ? `/customers/${user.customerProfile.id}` : null,
            value: row._count._all,
            valueLabel: 'sessions',
            lastActivityAt: row._max.lastSeenAt?.toISOString() ?? null,
          };
        }),
        completedBookingCustomers: completedCustomerRows.map((row, index) => {
          const profile = customerProfileMap.get(row.customerProfileId);

          return {
            rank: index + 1,
            id: row.customerProfileId,
            label: profile?.user.fullName ?? profile?.user.phone ?? 'Unknown customer',
            secondary: profile?.user.phone ?? null,
            href: `/customers/${row.customerProfileId}`,
            value: row._count._all,
            valueLabel: 'completed',
            lastActivityAt: latestDate(row._max.closedAt, row._max.updatedAt)?.toISOString() ?? null,
          };
        }),
      },
      regionUsage: buildAdminUsageRegionRows([
        ...regionSessionRows.map((row) => ({
          regionValues: [row.lastLoginAddress],
          customerSessionCount: 1,
        })),
        ...regionBookingRequestRows.map((booking) => ({
          regionValues: [
            booking.addressSnapshot?.addressText,
            booking.addressSnapshot?.address,
            booking.address,
          ],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          bookingRequestCount: 1,
        })),
        ...regionCompletedBookingRows.map((booking) => ({
          regionValues: [
            booking.addressSnapshot?.addressText,
            booking.addressSnapshot?.address,
            booking.address,
          ],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          completedBookingCount: 1,
        })),
      ]),
      partnerUsage: {
        mostViewedPartners: viewedPartnerRows.map((row, index) =>
          providerUsageRow(
            row.providerProfileId,
            row._sum.viewCount ?? row._count._all,
            'views',
            row._max.lastViewedAt,
            index,
            providerMap,
          ),
        ),
        requestedPartners: requestedPartnerRows
          .filter((row) => Boolean(row.preferredProviderId))
          .map((row, index) =>
            providerUsageRow(
              row.preferredProviderId as string,
              row._count._all,
              'requests',
              row._max.createdAt,
              index,
              providerMap,
            ),
          ),
        completedPartners: completedPartnerRows
          .filter((row) => Boolean(row.selectedProviderId))
          .map((row, index) =>
            providerUsageRow(
              row.selectedProviderId as string,
              row._count._all,
              'completed',
              latestDate(row._max.closedAt, row._max.updatedAt),
              index,
              providerMap,
            ),
          ),
      },
    };
  }

  async getMarketingOverview(
    query: {
      range?: string;
      source?: string;
      platform?: string;
      regionCode?: string;
      campaignId?: string;
    } = {},
  ) {
    const window = adminMarketingRangeWindow(normalizeAdminMarketingRange(query.range));
    const dateWhere = adminMarketingDateWhere(window);
    const sourceFilter = normalizeMarketingSourceFilter(query.source);
    const platformFilter = normalizeMarketingPlatformFilter(query.platform);
    const regionCodeFilter = query.regionCode
      ? (VIETNAM_REGION_BUCKETS.find((bucket) => bucket.code === query.regionCode)?.code ?? null)
      : null;
    const campaignIdFilter =
      typeof query.campaignId === 'string' && query.campaignId.trim() ? query.campaignId.trim() : null;
    const filters: AdminMarketingFilters = {
      source: sourceFilter,
      platform: platformFilter,
      regionCode: regionCodeFilter,
      campaignId: campaignIdFilter,
    };
    const customerSignupWhere = {
      roles: { has: Role.CUSTOMER },
      createdAt: dateWhere,
    } satisfies Prisma.UserWhereInput;
    const appFirstOpenWhere = {
      role: Role.CUSTOMER,
      createdAt: dateWhere,
    } satisfies Prisma.AppSessionWhereInput;
    const bookingCreatedWhere = {
      createdAt: dateWhere,
    } satisfies Prisma.BookingWhereInput;
    const bookingCompletedWhere = {
      status: BookingStatus.COMPLETED,
      closedAt: dateWhere,
    } satisfies Prisma.BookingWhereInput;
    const bookingCancelledWhere = {
      status: { in: Array.from(ADMIN_VIETNAM_CANCELLATION_STATUSES) },
      OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }],
    } satisfies Prisma.BookingWhereInput;
    const referralAttributionWhere = {
      audience: ReferralAudience.CUSTOMER,
      createdAt: dateWhere,
    } satisfies Prisma.ReferralAttributionWhereInput;
    const marketingSpendWhere = {
      spendDate: dateWhere,
      ...(sourceFilter ? { source: sourceFilter } : {}),
      ...(platformFilter ? { platform: platformFilter } : {}),
      ...(regionCodeFilter ? { regionCode: regionCodeFilter } : {}),
      ...(campaignIdFilter ? { campaignId: campaignIdFilter } : {}),
    } satisfies Prisma.MarketingSpendDailyWhereInput;

    const [
      firstOpenPlatformRows,
      firstOpenCount,
      signupCount,
      referralSignupCount,
      addressSaveCount,
      bookingCreatedCount,
      bookingCompletedCount,
      bookingCancelledCount,
      grossBookingValue,
      platformFeeRevenue,
      refundAmount,
      firstRepeatCompleted,
      regionAddressRows,
      regionBookingCreatedRows,
      regionBookingCompletedRows,
      regionBookingCancelledRows,
      referralCampaignRows,
      marketingSpendRows,
    ] = await Promise.all([
      this.prisma.appSession.groupBy({
        by: ['platform'],
        where: appFirstOpenWhere,
        _count: { _all: true },
      }),
      this.prisma.appSession.count({ where: appFirstOpenWhere }),
      this.prisma.user.count({ where: customerSignupWhere }),
      this.prisma.referralAttribution.count({ where: referralAttributionWhere }),
      this.prisma.customerSelectedLocation.count({ where: { createdAt: dateWhere } }),
      this.prisma.booking.count({ where: bookingCreatedWhere }),
      this.prisma.booking.count({ where: bookingCompletedWhere }),
      this.prisma.booking.count({ where: bookingCancelledWhere }),
      this.prisma.payment.aggregate({
        where: {
          status: { in: Array.from(ADMIN_VIETNAM_REVENUE_STATUSES) },
          booking: bookingCompletedWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.providerPlatformFeeLog.aggregate({
        where: { createdAt: dateWhere },
        _sum: { platformFeeAmount: true },
      }),
      this.prisma.refund.aggregate({
        where: { createdAt: dateWhere },
        _sum: { amount: true },
      }),
      this.completedBookingRepeatBreakdown(window),
      this.prisma.customerSelectedLocation.findMany({
        where: { createdAt: dateWhere },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_MARKETING_REGION_LIMIT,
        select: {
          addressText: true,
          latitude: true,
          longitude: true,
        },
      }),
      this.prisma.booking.findMany({
        where: bookingCreatedWhere,
        orderBy: { createdAt: 'desc' },
        take: ADMIN_MARKETING_REGION_LIMIT,
        select: {
          address: true,
          lat: true,
          lng: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: bookingCompletedWhere,
        orderBy: { closedAt: 'desc' },
        take: ADMIN_MARKETING_REGION_LIMIT,
        select: {
          address: true,
          lat: true,
          lng: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: bookingCancelledWhere,
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_MARKETING_REGION_LIMIT,
        select: {
          address: true,
          lat: true,
          lng: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),
      this.prisma.referralAttribution.findMany({
        where: referralAttributionWhere,
        orderBy: { createdAt: 'desc' },
        take: ADMIN_MARKETING_CAMPAIGN_LIMIT,
        select: {
          id: true,
          installSource: true,
          platform: true,
          createdAt: true,
          referralCode: {
            select: {
              id: true,
              code: true,
            },
          },
          rewards: {
            where: {
              createdAt: dateWhere,
            },
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.marketingSpendDaily.findMany({
        where: marketingSpendWhere,
        orderBy: [{ spendDate: 'desc' }, { updatedAt: 'desc' }],
        take: ADMIN_MARKETING_SPEND_LIMIT,
        select: {
          spendDate: true,
          source: true,
          platform: true,
          regionCode: true,
          campaignId: true,
          campaignName: true,
          spendAmount: true,
          currency: true,
        },
      }),
    ]);
    const marketingSpendDimensionRows: AdminMarketingDimensionInput[] = marketingSpendRows.map((row) => {
      const regionCode = normalizeMarketingSpendRegionCode(row.regionCode, { allowAll: true });
      return {
        source: normalizeMarketingSource(row.source),
        platform: normalizeMarketingPlatform(row.platform),
        regionCode: regionCode ?? undefined,
        regionName: regionCode ? vietnamRegionLabel(regionCode) : undefined,
        campaignId: row.campaignId === 'all' ? null : row.campaignId,
        campaignName: row.campaignName,
        stats: { adSpend: numberValue(row.spendAmount) },
      };
    });
    const manualAdSpend = marketingSpendRows.reduce((total, row) => total + numberValue(row.spendAmount), 0);

    const stats = {
      ...emptyMarketingStats(),
      firstOpens: firstOpenCount,
      signups: signupCount,
      addressSaves: addressSaveCount,
      bookingCreated: bookingCreatedCount,
      bookingCompleted: bookingCompletedCount,
      bookingCancelled: bookingCancelledCount,
      firstBookingCompleted: firstRepeatCompleted.firstBookingCompleted,
      repeatBookingCompleted: firstRepeatCompleted.repeatBookingCompleted,
      grossBookingValue: numberValue(grossBookingValue._sum.amount),
      platformFeeRevenue: numberValue(platformFeeRevenue._sum.platformFeeAmount),
      refundAmount: numberValue(refundAmount._sum.amount),
      adSpend: manualAdSpend,
    };
    const referralRewardCount = referralCampaignRows.reduce(
      (total, row) =>
        total + row.rewards.filter((reward) => reward.status !== ReferralRewardStatus.CANCELLED).length,
      0,
    );
    const referralRewardAmount = referralCampaignRows.reduce(
      (total, row) =>
        total +
        row.rewards
          .filter((reward) => reward.status !== ReferralRewardStatus.CANCELLED)
          .reduce((sum, reward) => sum + numberValue(reward.amount), 0),
      0,
    );
    const unknownStats = {
      ...stats,
      signups: Math.max(0, signupCount - referralSignupCount),
      firstBookingCompleted: Math.max(0, stats.firstBookingCompleted - referralRewardCount),
      platformFeeRevenue: Math.max(0, stats.platformFeeRevenue - referralRewardAmount),
    };
    const referralStats = {
      ...emptyMarketingStats(),
      signups: referralSignupCount,
      firstBookingCompleted: referralRewardCount,
      platformFeeRevenue: referralRewardAmount,
    };
    const sourceRows = buildMarketingDimensionRows(
      [
        { source: 'unknown', stats: unknownStats },
        { source: 'referral', stats: referralStats },
        ...marketingSpendDimensionRows,
      ],
      { source: filters.source },
    );
    const campaignRows = buildMarketingDimensionRows(
      [
        ...referralCampaignRows.map((row) => ({
          source: normalizeMarketingSource(row.installSource ?? 'referral'),
          platform: normalizeMarketingPlatform(row.platform),
          campaignId: row.referralCode.code,
          campaignName: `Referral ${row.referralCode.code}`,
          stats: {
            signups: 1,
            firstBookingCompleted: row.rewards.length,
            platformFeeRevenue: row.rewards.reduce((sum, reward) => sum + numberValue(reward.amount), 0),
          },
        })),
        ...marketingSpendDimensionRows,
      ],
      filters,
    );
    const regionRows = buildMarketingRegionRows(
      [
        ...regionAddressRows.map((row) => ({
          regionValues: [row.addressText],
          coordinates: { latitude: row.latitude, longitude: row.longitude },
          stats: { addressSaves: 1 },
        })),
        ...regionBookingCreatedRows.map((booking) => ({
          regionValues: [
            booking.addressSnapshot?.addressText,
            booking.addressSnapshot?.address,
            booking.address,
          ],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          stats: { bookingCreated: 1 },
        })),
        ...regionBookingCompletedRows.map((booking) => ({
          regionValues: [
            booking.addressSnapshot?.addressText,
            booking.addressSnapshot?.address,
            booking.address,
          ],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          stats: { bookingCompleted: 1 },
        })),
        ...regionBookingCancelledRows.map((booking) => ({
          regionValues: [
            booking.addressSnapshot?.addressText,
            booking.addressSnapshot?.address,
            booking.address,
          ],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          stats: { bookingCancelled: 1 },
        })),
        ...marketingSpendRows.map((row) => ({
          regionValues: [row.regionCode === 'all' ? null : vietnamRegionLabel(row.regionCode)],
          stats: { adSpend: numberValue(row.spendAmount) },
        })),
      ],
      filters,
    );
    const platformRows = buildMarketingDimensionRows(
      [
        ...firstOpenPlatformRows.map((row) => ({
          source: 'unknown' as const,
          platform: normalizeMarketingPlatform(row.platform),
          stats: { firstOpens: row._count._all },
        })),
        ...marketingSpendDimensionRows,
      ],
      filters,
    );

    return {
      generatedAt: new Date().toISOString(),
      refreshSeconds: 300,
      source: 'stored-marketing-aggregates',
      range: window.range,
      rangeLabel: window.label,
      windowStartAt: window.startAt.toISOString(),
      windowEndAt: window.endAt.toISOString(),
      filters: {
        source: filters.source ?? null,
        platform: filters.platform ?? null,
        regionCode: filters.regionCode ?? null,
        campaignId: filters.campaignId ?? null,
      },
      totals: withMarketingRates(stats),
      funnel: buildMarketingFunnel(stats),
      bySource: sourceRows,
      byPlatform: platformRows,
      byRegion: regionRows,
      byCampaign: campaignRows,
      topInsights: buildMarketingInsights(stats, sourceRows),
      dataGaps: [
        'Attribution is currently derived from stored referrals and app sessions; non-referral paid campaign attribution falls back to unknown.',
        'Manual ad spend rows are supported; paid campaign install attribution still needs mobile/deep-link capture before source-level conversion is exact.',
        'No live ad-network API, MMP, exact customer location, phone number, or ad identifier is returned by this endpoint.',
      ],
    };
  }

  async upsertMarketingSpendDaily(
    actorId: string,
    input: {
      spendDate?: string;
      source?: string;
      platform?: string;
      regionCode?: string;
      campaignId?: string;
      campaignName?: string | null;
      spendAmount?: number;
      currency?: string;
      notes?: string | null;
    },
  ) {
    const spendDate = normalizeMarketingSpendDate(input.spendDate);
    const source = normalizeMarketingSpendSource(input.source);
    const platform = normalizeMarketingSpendPlatform(input.platform);
    const regionCode = normalizeMarketingSpendRegionCode(input.regionCode);
    const campaignId = normalizeMarketingSpendCampaignId(input.campaignId);
    const spendAmount = normalizeMarketingSpendAmount(input.spendAmount);
    const currency = normalizeNullable(input.currency)?.toUpperCase() ?? 'VND';
    const campaignName = normalizeNullable(input.campaignName);
    const notes = normalizeNullable(input.notes);
    const row = await this.prisma.marketingSpendDaily.upsert({
      where: {
        spendDate_source_platform_regionCode_campaignId: {
          spendDate,
          source,
          platform,
          regionCode,
          campaignId,
        },
      },
      create: {
        spendDate,
        source,
        platform,
        regionCode,
        campaignId,
        campaignName,
        spendAmount,
        currency,
        notes,
        createdById: actorId,
        updatedById: actorId,
      },
      update: {
        campaignName,
        spendAmount,
        currency,
        notes,
        updatedById: actorId,
      },
    });
    await this.writeAudit(
      actorId,
      'marketing_spend_daily.upsert',
      `marketing_spend_daily:${source}:${platform}:${regionCode}:${campaignId}:${marketingSpendDateKey(spendDate)}`,
      {
        spendAmount,
        currency,
      },
    );

    return row;
  }

  private async completedBookingRepeatBreakdown(window: { startAt: Date; endAt: Date }) {
    const rows = await this.prisma.$queryRaw<
      Array<{ firstBookingCompleted: bigint | number; repeatBookingCompleted: bigint | number }>
    >(Prisma.sql`
      WITH ranked_completed_bookings AS (
        SELECT
          "id",
          "customerProfileId",
          "closedAt",
          row_number() OVER (
            PARTITION BY "customerProfileId"
            ORDER BY "closedAt" ASC, "id" ASC
          ) AS rn
        FROM "Booking"
        WHERE "status" = 'COMPLETED'
          AND "closedAt" IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE rn = 1)::bigint AS "firstBookingCompleted",
        COUNT(*) FILTER (WHERE rn > 1)::bigint AS "repeatBookingCompleted"
      FROM ranked_completed_bookings
      WHERE "closedAt" >= ${window.startAt}
        AND "closedAt" < ${window.endAt}
    `);
    const row = rows[0];

    return {
      firstBookingCompleted: numberValue(row?.firstBookingCompleted),
      repeatBookingCompleted: numberValue(row?.repeatBookingCompleted),
    };
  }

  async listProviders() {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT,
      select: adminProviderListSelect,
    });

    if (providers.length === 0) {
      return providers;
    }

    const providerIds = providers.map((provider) => provider.id);
    const [bookingSummaries, activitySummaries, { logsByTarget, countByTarget }] = await Promise.all([
      this.getProviderListBookingSummaries(providerIds),
      this.getProviderListActivitySummaries(providerIds),
      this.getAuditLogSummaryByTargets(
        providerIds.map((providerId) => `provider:${providerId}`),
        ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,
      ),
    ]);

    return providers.map((provider) => ({
      ...provider,
      bookingSummary: bookingSummaries.get(provider.id) ?? emptyProviderBookingSummary(),
      activitySummary: activitySummaries.get(provider.id) ?? emptyProviderActivitySummary(),
      auditLogs: logsByTarget.get(`provider:${provider.id}`) ?? [],
      auditLogCount: countByTarget.get(`provider:${provider.id}`) ?? 0,
    }));
  }

  async listPartnerDirectoryProviders(options: AdminPartnerDirectoryQueryOptions = {}) {
    const where = adminPartnerDirectoryWhere(options);
    const skip = adminPartnerDirectorySkip(options.skip);
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPartnerDirectoryTake(options.take),
      ...(where ? { where } : {}),
      select: adminProviderDirectorySelect,
    });

    if (providers.length === 0) {
      return providers;
    }

    const providerIds = providers.map((provider) => provider.id);
    const [bookingSummaries, activitySummaries, { logsByTarget, countByTarget }] = await Promise.all([
      this.getProviderListBookingSummaries(providerIds),
      this.getProviderListActivitySummaries(providerIds),
      this.getAuditLogSummaryByTargets(
        providerIds.map((providerId) => `provider:${providerId}`),
        ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,
      ),
    ]);

    return providers.map((provider) => ({
      ...provider,
      bookingSummary: bookingSummaries.get(provider.id) ?? emptyProviderBookingSummary(),
      activitySummary: activitySummaries.get(provider.id) ?? emptyProviderActivitySummary(),
      auditLogs: logsByTarget.get(`provider:${provider.id}`) ?? [],
      auditLogCount: countByTarget.get(`provider:${provider.id}`) ?? 0,
    }));
  }

  async partnerDirectorySummary(options: AdminPartnerDirectorySummaryOptions = {}) {
    const where = adminPartnerDirectoryWhere(options);
    const totalCount = await this.prisma.providerProfile.count({
      ...(where ? { where } : {}),
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
    };
  }

  listFileReviewProviders() {
    return this.prisma.providerProfile.findMany({
      where: adminProviderFileReviewWhere,
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT,
      select: adminProviderFileReviewSelect,
    });
  }

  async listOperationsHandoffProviders() {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT,
      select: adminProviderOperationsHandoffSelect,
    });

    if (providers.length === 0) {
      return providers;
    }

    const activitySummaries = await this.getProviderListActivitySummaries(
      providers.map((provider) => provider.id),
    );

    return providers.map((provider) => ({
      ...provider,
      activitySummary: activitySummaries.get(provider.id) ?? emptyProviderActivitySummary(),
    }));
  }

  async listOperationsPolicyProviders() {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT,
      select: adminProviderOperationsPolicySelect,
    });

    if (providers.length === 0) {
      return providers;
    }

    const activitySummaries = await this.getProviderListActivitySummaries(
      providers.map((provider) => provider.id),
    );

    return providers.map((provider) => {
      const activitySummary = activitySummaries.get(provider.id) ?? emptyProviderActivitySummary();
      return {
        ...provider,
        activitySummary,
        earnings: [{ netAmount: activitySummary.walletBalance }],
      };
    });
  }

  async listPartnerControlProviders() {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_CONTROL_LIST_LIMIT,
      select: adminProviderControlSelect,
    });

    if (providers.length === 0) {
      return providers;
    }

    const activitySummaries = await this.getProviderListActivitySummaries(
      providers.map((provider) => provider.id),
    );

    return providers.map((provider) => {
      const activitySummary = activitySummaries.get(provider.id) ?? emptyProviderActivitySummary();
      return {
        ...provider,
        activitySummary,
        earnings: [{ netAmount: activitySummary.walletBalance, status: EarningStatus.PENDING }],
      };
    });
  }

  async getProviderDetail(providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: adminProviderDetailSelect,
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }

    const deviceIds = Array.from(
      new Set(
        [
          ...provider.devices.map((device) => device.deviceId),
          ...provider.sessions.map((session) => session.deviceId),
        ].filter((deviceId): deviceId is string => Boolean(deviceId)),
      ),
    );
    const sharedDeviceMatchesPromise = deviceIds.length
      ? this.prisma.providerDevice.findMany({
          where: {
            deviceId: { in: deviceIds },
            providerProfileId: { not: provider.id },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 20,
          select: {
            id: true,
            deviceId: true,
            platform: true,
            enabled: true,
            lastSeenAt: true,
            blockedAt: true,
            providerProfile: {
              select: {
                id: true,
                displayName: true,
                user: { select: { phone: true } },
              },
            },
          },
        })
      : Promise.resolve([]);

    const auditLogsPromise = this.prisma.adminAuditLog.findMany({
      where: providerAuditLogWhere(providerProfileId),
      orderBy: { createdAt: 'desc' },
      take: 75,
      select: adminAuditLogSelect,
    });

    const [sharedDeviceMatches, auditLogs] = await Promise.all([
      sharedDeviceMatchesPromise,
      auditLogsPromise,
    ]);

    return { ...provider, sharedDeviceMatches, auditLogs };
  }

  async getProviderOverview(providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: adminProviderOverviewSelect,
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }

    return provider;
  }

  async addProviderOpsNote(
    actorId: string,
    providerProfileId: string,
    input: { note?: string; preset?: string },
  ) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Partner operation note is required');
    }

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        legalName: true,
        status: true,
        user: { select: { phone: true, fullName: true } },
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }

    const auditLog = await this.writeAudit(
      actorId,
      'provider.ops_note.add',
      `provider:${providerProfileId}`,
      {
        providerProfileId,
        providerUserId: provider.userId,
        providerPhone: provider.user.phone,
        providerName: provider.displayName ?? provider.legalName ?? provider.user.fullName,
        status: provider.status,
        note: content,
        preset,
      },
    );

    return { ok: true, auditLog };
  }

  async enablePushDevice(actorId: string, pushDeviceId: string) {
    const device = await this.prisma.pushDevice.update({
      where: { id: pushDeviceId },
      data: { enabled: true },
    });

    await this.writeAudit(actorId, 'push_device.enable', `push_device:${pushDeviceId}`, {
      pushDeviceId,
      userId: device.userId,
      platform: device.platform,
    });

    return { ok: true, pushDeviceId: device.id };
  }

  async blockProviderDevice(actorId: string, providerDeviceId: string, reason?: string) {
    const blockReason = normalizeNullable(reason);
    if (!blockReason) {
      throw new BadRequestException('Block reason is required');
    }

    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: false,
        blockedAt: new Date(),
        blockReason,
      },
    });

    await this.writeAudit(actorId, 'provider_device.block', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
      reason: blockReason,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async unblockProviderDevice(actorId: string, providerDeviceId: string) {
    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: true,
        blockedAt: null,
        blockReason: null,
      },
    });

    await this.writeAudit(actorId, 'provider_device.unblock', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async blockProviderAccount(actorId: string, providerProfileId: string, reason?: string) {
    const blockReason = normalizeProviderAccountBlockReason(reason);

    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        status: ProviderStatus.OFFLINE,
        blockedAt: new Date(),
        blockedReason: blockReason,
      },
      select: { id: true, userId: true, status: true, blockedAt: true, blockedReason: true },
    });
    await this.redisState.setProviderStatus(provider.id, ProviderStatus.OFFLINE);

    await this.writeAudit(
      actorId,
      'provider_account.block',
      `provider:${providerProfileId}`,
      providerAccountBlockAuditMetadata(providerProfileId, blockReason),
    );

    await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
        reason: blockReason,
        issuedById: actorId,
        metadata: toJson({ source: 'admin_account_block' }),
      },
    });

    await this.notifications.create({
      userId: provider.userId,
      ...providerAccountBlockedNotification(providerProfileId, blockReason),
    });

    return { ok: true, providerProfileId: provider.id, blockedAt: provider.blockedAt };
  }

  async unblockProviderAccount(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        blockedAt: null,
        blockedReason: null,
      },
      select: { id: true, userId: true },
    });

    await this.writeAudit(
      actorId,
      'provider_account.unblock',
      `provider:${providerProfileId}`,
      providerAccountUnblockAuditMetadata(providerProfileId),
    );

    await this.prisma.providerSanction.updateMany({
      where: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
      },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
    });

    await this.notifications.create({
      userId: provider.userId,
      ...providerAccountUnblockedNotification(providerProfileId),
    });

    return { ok: true, providerProfileId: provider.id };
  }

  listProviderReports() {
    return this.prisma.providerReport.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: ADMIN_PROVIDER_REPORT_LIST_LIMIT,
      select: adminProviderReportListSelect,
    });
  }

  async createProviderReport(
    actorId: string,
    input: {
      providerProfileId?: string;
      bookingId?: string | null;
      source?: ProviderReportSource;
      severity?: ProviderReportSeverity;
      category?: string;
      summary?: string;
      details?: string | null;
    },
  ) {
    const reportInput = normalizeProviderReportCreateInput(input);

    const report = await this.prisma.providerReport.create({
      data: {
        ...reportInput,
        reporterUserId: actorId,
        assignedAdminId: actorId,
      },
      select: adminProviderReportListSelect,
    });

    await this.writeAudit(
      actorId,
      'provider_report.create',
      `provider_report:${report.id}`,
      providerReportCreateAuditMetadata({
        providerProfileId: reportInput.providerProfileId,
        category: reportInput.category,
        severity: report.severity,
      }),
    );
    return report;
  }

  async updateProviderReport(
    actorId: string,
    reportId: string,
    input: {
      status?: ProviderReportStatus;
      severity?: ProviderReportSeverity;
      resolutionNote?: string | null;
    },
  ) {
    const reportInput = normalizeProviderReportUpdateInput(input);
    const report = await this.prisma.providerReport.update({
      where: { id: reportId },
      data: reportInput.data,
    });

    await this.writeAudit(
      actorId,
      'provider_report.update',
      `provider_report:${reportId}`,
      reportInput.auditMetadata,
    );
    return report;
  }

  listProviderSanctions() {
    return this.prisma.providerSanction.findMany({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      take: 100,
      select: adminProviderSanctionListSelect,
    });
  }

  async createProviderSanction(
    actorId: string,
    providerProfileId: string,
    input: {
      type?: ProviderSanctionType;
      reason?: string;
      reportId?: string | null;
      expiresAt?: string | null;
    },
  ) {
    const sanctionInput = normalizeProviderSanctionCreateInput(input);
    const { type, reason, reportId } = sanctionInput;
    if (type === ProviderSanctionType.ACCOUNT_BLOCK) {
      await this.blockProviderAccount(actorId, providerProfileId, reason);
      const accountBlock = await this.prisma.providerSanction.findFirstOrThrow({
        where: {
          providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
          reason,
        },
        orderBy: { createdAt: 'desc' },
      });
      const updated = reportId
        ? await this.prisma.providerSanction.update({
            where: { id: accountBlock.id },
            data: { reportId },
          })
        : accountBlock;
      await this.writeAudit(
        actorId,
        'provider_sanction.create',
        `provider_sanction:${updated.id}`,
        providerSanctionCreateAuditMetadata({ providerProfileId, reportId, type }),
      );
      return updated;
    }

    const sanction = await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        reportId,
        type,
        reason,
        expiresAt: sanctionInput.expiresAt,
        issuedById: actorId,
      },
    });

    await this.writeAudit(
      actorId,
      'provider_sanction.create',
      `provider_sanction:${sanction.id}`,
      providerSanctionCreateAuditMetadata({ providerProfileId, reportId, type }),
    );
    return sanction;
  }

  async liftProviderSanction(actorId: string, sanctionId: string) {
    const sanction = await this.prisma.providerSanction.update({
      where: { id: sanctionId },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
    });

    if (sanction.type === ProviderSanctionType.ACCOUNT_BLOCK) {
      const remainingAccountBlocks = await this.prisma.providerSanction.count({
        where: {
          providerProfileId: sanction.providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
        },
      });

      if (remainingAccountBlocks === 0) {
        const provider = await this.prisma.providerProfile.update({
          where: { id: sanction.providerProfileId },
          data: {
            blockedAt: null,
            blockedReason: null,
          },
          select: { id: true, userId: true },
        });

        await this.notifications.create({
          userId: provider.userId,
          ...providerAccountUnblockedNotification(provider.id, sanctionId),
        });
      }
    }

    await this.writeAudit(actorId, 'provider_sanction.lift', `provider_sanction:${sanctionId}`, {
      providerProfileId: sanction.providerProfileId,
      type: sanction.type,
    });
    return sanction;
  }

  async reviewProvider(
    actorId: string,
    providerProfileId: string,
    status: VerificationStatus,
    reason?: string,
  ) {
    const verification = await this.prisma.providerVerification.upsert({
      where: { providerProfileId },
      update: {
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        reviewedAt: new Date(),
      },
      create: {
        providerProfileId,
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await this.writeAudit(actorId, `provider.${status.toLowerCase()}`, `provider:${providerProfileId}`, {
      reason,
    });

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: { userId: true },
    });
    let supabaseRoleSync = null;
    if (provider) {
      await this.notifications.create({
        userId: provider.userId,
        targetRole: Role.PROVIDER,
        type: `provider.verification.${status.toLowerCase()}`,
        title:
          status === VerificationStatus.APPROVED ? 'Verification approved' : 'Verification needs updates',
        body:
          status === VerificationStatus.APPROVED
            ? 'You can now receive matching jobs.'
            : 'Please review the latest verification update in the app.',
        data: { providerProfileId, status, reason },
      });

      if (status === VerificationStatus.APPROVED) {
        supabaseRoleSync = await this.syncProviderSupabaseRole(actorId, providerProfileId);
      }
    }

    return { ...verification, supabaseRoleSync };
  }

  async syncProviderSupabaseRole(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerProfileId },
      select: {
        id: true,
        userId: true,
        user: { select: adminUserAuthSelect },
        verification: { select: { status: true } },
      },
    });

    if (provider.verification?.status !== VerificationStatus.APPROVED) {
      const result = {
        status: 'SKIPPED' as const,
        configured: false,
        supabaseUserId: provider.user.supabaseUserId,
        reason: 'Partner must be approved before Supabase provider role sync.',
      };
      await this.writeAudit(actorId, 'provider.supabase_role_sync.skipped', `provider:${providerProfileId}`, {
        result,
      });
      return result;
    }

    const result = await this.supabaseAdmin.grantProviderRole(provider.user.supabaseUserId);
    await this.writeAudit(
      actorId,
      `provider.supabase_role_sync.${result.status.toLowerCase()}`,
      `provider:${providerProfileId}`,
      {
        result,
        userId: provider.userId,
      },
    );
    return result;
  }

  async reviewPublicProviderMedia(
    actorId: string,
    fileId: string,
    status: FileReviewStatus,
    reason?: string,
  ) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        purpose: true,
        visibility: true,
        uploadStatus: true,
        ownerUserId: true,
        owner: { select: { providerProfile: { select: { id: true } } } },
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (
      file.visibility !== FileVisibility.PUBLIC ||
      (file.purpose !== FilePurpose.PROFILE_IMAGE && file.purpose !== FilePurpose.PROVIDER_GALLERY)
    ) {
      throw new BadRequestException('Only public provider media can be reviewed here');
    }
    if (file.uploadStatus !== FileUploadStatus.UPLOADED) {
      throw new BadRequestException('Only completed uploads can be reviewed');
    }
    const normalizedReason = status === FileReviewStatus.REJECTED ? normalizeNullable(reason) : null;
    if (status === FileReviewStatus.REJECTED && !normalizedReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewReason: normalizedReason,
      },
    });
    await this.writeAudit(actorId, `provider_media.${status.toLowerCase()}`, `file:${fileId}`, {
      fileId,
      purpose: file.purpose,
      ownerUserId: file.ownerUserId,
      providerProfileId: file.owner?.providerProfile?.id,
      reason: normalizedReason,
    });
    if (file.ownerUserId) {
      await this.notifications.create({
        userId: file.ownerUserId,
        targetRole: Role.PROVIDER,
        type: `provider.media.${status.toLowerCase()}`,
        title:
          status === FileReviewStatus.APPROVED ? 'Profile media approved' : 'Profile media needs changes',
        body:
          status === FileReviewStatus.APPROVED
            ? 'Your public profile media is now visible to customers.'
            : 'Please review the latest profile media update in the app.',
        data: { fileId, purpose: file.purpose, status, reason: normalizedReason },
      });
    }
    return { ok: true, file: updated };
  }

  async listBookings(query: AdminBookingListQuery = {}) {
    const bookings = await this.prisma.booking.findMany({
      where: adminBookingListWhere(query),
      orderBy: { createdAt: 'desc' },
      take: adminBookingListLimit(query.take),
      select: adminBookingListSelect,
    });
    return withAdminBookingListMetadataList(withAdminBookingMatchingEvidenceList(bookings)).map(
      (booking) => ({
        ...booking,
        metadata: adminBookingListMetadataPayload(booking.metadata),
      }),
    );
  }

  listChatArchive(query: AdminChatArchiveListQuery = {}) {
    return this.prisma.booking.findMany({
      where: adminChatArchiveWhere(query),
      orderBy: { updatedAt: 'desc' },
      take: adminChatArchiveListTake(query.take),
      select: {
        id: true,
        customerProfileId: true,
        preferredProviderId: true,
        selectedProviderId: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        createdAt: true,
        updatedAt: true,
        customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
        preferredProvider: { select: adminProviderSummarySelect },
        selectedProvider: { select: adminProviderSummarySelect },
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            providerProfileId: true,
            status: true,
            joinedAt: true,
            respondedAt: true,
            providerProfile: { select: adminProviderSummarySelect },
          },
        },
        services: { select: adminBookingServiceSummarySelect },
        payment: { select: adminPaymentSummarySelect },
        review: true,
        chatRoom: {
          select: {
            id: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 200,
              select: {
                id: true,
                body: true,
                createdAt: true,
                sender: { select: { id: true, phone: true, fullName: true, roles: true } },
              },
            },
          },
        },
      },
    });
  }

  async getBookingDetail(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: adminBookingDetailSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: bookingAuditLogWhere(id, booking.createdAt),
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminAuditLogSelect,
    });

    return withAdminBookingListMetadata(withAdminBookingMatchingEvidence({ ...booking, auditLogs }));
  }

  listBookingNotifications(bookingId: string) {
    return this.prisma.notification.findMany({
      where: { data: { path: ['bookingId'], equals: bookingId } },
      orderBy: { createdAt: 'desc' },
      take: ADMIN_BOOKING_DETAIL_NOTIFICATION_LIMIT,
      select: adminNotificationListSelect,
    });
  }

  async listBookingChatMessages(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        chatRoom: {
          select: {
            id: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              take: ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT + 1,
              select: adminChatMessageSummarySelect,
            },
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const retainedMessages = booking.chatRoom?.messages ?? [];
    return {
      bookingId: booking.id,
      chatRoomId: booking.chatRoom?.id ?? null,
      limit: ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT,
      messages: retainedMessages.slice(0, ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT),
      truncated: retainedMessages.length > ADMIN_BOOKING_CHAT_MESSAGE_LIST_LIMIT,
    };
  }

  async listBookingMarketplaceProviders(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        preferredProviderId: true,
        selectedProviderId: true,
        lat: true,
        lng: true,
        addressSnapshot: { select: { latitude: true, longitude: true } },
        participants: { select: { providerProfileId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const relatedProviderIds = Array.from(
      new Set(
        [
          booking.preferredProviderId,
          booking.selectedProviderId,
          ...booking.participants.map((participant) => participant.providerProfileId),
        ].filter((providerId): providerId is string => Boolean(providerId)),
      ),
    );
    const pin = adminBookingMarketplacePin(booking);
    const bounds = pin
      ? adminBookingMarketplaceBounds(pin.lat, pin.lng, ADMIN_BOOKING_MARKETPLACE_PROVIDER_RADIUS_METERS)
      : null;

    const relatedProvidersPromise =
      relatedProviderIds.length > 0
        ? this.prisma.providerProfile.findMany({
            where: { id: { in: relatedProviderIds } },
            select: adminBookingMarketplaceProviderSelect,
          })
        : Promise.resolve([]);
    const nearbyProvidersPromise = bounds
      ? this.prisma.providerProfile.findMany({
          where: {
            currentLat: { gte: bounds.minLat, lte: bounds.maxLat },
            currentLng: { gte: bounds.minLng, lte: bounds.maxLng },
          },
          orderBy: [{ currentLocationUpdatedAt: 'desc' }, { id: 'desc' }],
          take: ADMIN_BOOKING_MARKETPLACE_PROVIDER_LIMIT,
          select: adminBookingMarketplaceProviderSelect,
        })
      : Promise.resolve([]);

    const [relatedProviders, nearbyProviders] = await Promise.all([
      relatedProvidersPromise,
      nearbyProvidersPromise,
    ]);

    return uniqueAdminBookingMarketplaceProviders([...relatedProviders, ...nearbyProviders]);
  }

  async addBookingOpsNote(actorId: string, bookingId: string, input: { note?: string; preset?: string }) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Operation note is required');
    }

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, notes: true, status: true },
    });
    const notes = appendDatedAdminNote(booking.notes, content);
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { notes },
    });

    await this.writeAudit(actorId, 'booking.ops_note.add', `booking:${bookingId}`, {
      bookingId,
      status: booking.status,
      note: content,
      preset,
    });

    return updated;
  }

  async repairBookingChatRoom(actorId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        selectedProviderId: true,
        chatRoom: { select: { id: true } },
      },
    });

    if (!booking.selectedProviderId) {
      throw new BadRequestException('Final partner selection is required before repairing chat room');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { chatRoom: { upsert: { create: {}, update: {} } } },
      select: adminBookingDetailSelect,
    });

    await this.writeAudit(actorId, 'booking.chat_room.repair', `booking:${bookingId}`, {
      bookingId,
      status: booking.status,
      selectedProviderId: booking.selectedProviderId,
      previousChatRoomId: booking.chatRoom?.id ?? null,
      repairedChatRoomId: updated.chatRoom?.id ?? null,
    });

    return updated;
  }

  async markBookingNoShow(actorId: string, bookingId: string, input: { reason?: string }) {
    const reason = normalizeNullable(input.reason);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        payment: { select: { id: true, status: true } },
      },
    });

    const noShowEligibleStatuses: BookingStatus[] = [
      BookingStatus.OPEN_MATCHING,
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
    ];
    if (!noShowEligibleStatuses.includes(booking.status)) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be marked as no-show`);
    }

    const noShowPolicy = await this.readOperationalPolicyValue(
      NO_SHOW_PARTNER_REPORT_POLICY_KEY,
      NO_SHOW_ADMIN_REVIEW_REQUIRED,
    );
    const policyNote =
      noShowPolicy === NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW
        ? 'Policy: evidence-assisted admin review is active; verify evidence trail before payment closeout.'
        : 'Policy: admin review required before any payment or closeout decision.';
    const notes = appendDatedAdminNote(
      booking.notes,
      `No-show marked by operations${reason ? `: ${reason}. ` : '. '}${policyNote}`,
    );
    const paymentReviewNote =
      reason ??
      (noShowPolicy === NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW
        ? 'No-show marked; evidence-assisted admin review active, verify evidence before closeout.'
        : 'No-show requires payment and customer communication review.');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.NO_SHOW,
        closedAt: new Date(),
        closedByRole: Role.ADMIN,
        closedReason: 'admin_no_show',
        closedNote: paymentReviewNote,
        notes,
        opsTasks: {
          upsert: {
            where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
            update: {
              status: BookingOpsTaskStatus.BLOCKED,
              note: paymentReviewNote,
              actorId,
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: BookingOpsTaskStatus.BLOCKED,
              note: paymentReviewNote,
              actorId,
            },
          },
        },
      },
      select: adminBookingDetailSelect,
    });

    await this.writeAudit(actorId, 'booking.no_show.mark', `booking:${bookingId}`, {
      bookingId,
      previousStatus: booking.status,
      paymentStatus: booking.payment?.status,
      reason,
      noShowPolicy,
    });

    await this.notifications.create({
      userId: updated.customerProfile.userId,
      targetRole: Role.CUSTOMER,
      type: 'booking.no_show',
      title: 'No-show under review',
      body: 'HANDS operations marked this booking as no-show. Payment and support review is pending.',
      data: { bookingId, reason, noShowPolicy },
    });

    const partnerUserIds = new Set<string>();
    if (updated.selectedProvider?.userId) {
      partnerUserIds.add(updated.selectedProvider.userId);
    }
    if (updated.preferredProvider?.userId) {
      partnerUserIds.add(updated.preferredProvider.userId);
    }
    for (const participant of updated.participants) {
      if (participant.providerProfile.userId) {
        partnerUserIds.add(participant.providerProfile.userId);
      }
    }

    await Promise.all(
      [...partnerUserIds].map((userId) =>
        this.notifications.create({
          userId,
          targetRole: Role.PROVIDER,
          type: 'booking.no_show',
          title: 'Booking marked no-show',
          body: 'HANDS operations marked this booking as no-show. Check the booking note before fee or payout follow-up.',
          data: { bookingId, reason, noShowPolicy },
        }),
      ),
    );

    return updated;
  }

  async expireBooking(actorId: string, bookingId: string, input: { reason?: string }) {
    const reason = normalizeNullable(input.reason);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be expired`);
    }

    const notes = appendDatedAdminNote(
      booking.notes,
      `Matching expired by operations${reason ? `: ${reason}` : '.'}`,
    );
    const terminalPaymentStatuses: PaymentStatus[] = [
      PaymentStatus.CAPTURED,
      PaymentStatus.REFUNDED,
      PaymentStatus.RELEASED,
    ];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.payment && !terminalPaymentStatuses.includes(booking.payment.status)) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.RELEASED },
        });
      }

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.EXPIRED,
          expiresAt: new Date(),
          closedAt: new Date(),
          closedByRole: Role.ADMIN,
          closedReason: 'admin_expired',
          closedNote: reason ?? 'Matching expired; customer communication should be confirmed.',
          notes,
          opsTasks: {
            upsert: {
              where: { bookingId_type: { bookingId, type: BookingOpsTaskType.CUSTOMER_CONTACTED } },
              update: {
                status: BookingOpsTaskStatus.PENDING,
                note: reason ?? 'Matching expired; customer communication should be confirmed.',
                actorId,
              },
              create: {
                type: BookingOpsTaskType.CUSTOMER_CONTACTED,
                status: BookingOpsTaskStatus.PENDING,
                note: reason ?? 'Matching expired; customer communication should be confirmed.',
                actorId,
              },
            },
          },
        },
        select: adminBookingDetailSelect,
      });
    });

    await this.redisState.closeMatching(bookingId);
    await this.writeAudit(actorId, 'booking.expire.manual', `booking:${bookingId}`, {
      bookingId,
      previousStatus: booking.status,
      paymentId: booking.payment?.id,
      paymentReleased: Boolean(booking.payment && !terminalPaymentStatuses.includes(booking.payment.status)),
      reason,
    });

    return updated;
  }

  async closeoutCompletedBooking(actorId: string, bookingId: string, input: { note?: string }) {
    const note = normalizeNullable(input.note);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        selectedProviderId: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be closed out as completed`);
    }
    if (!booking.selectedProviderId) {
      throw new BadRequestException('Completed booking requires a selected partner before closeout');
    }

    const capturedPayment =
      booking.payment && booking.payment.status !== PaymentStatus.CAPTURED
        ? await this.prisma.payment.update({
            where: { id: booking.payment.id },
            data: { status: PaymentStatus.CAPTURED },
          })
        : booking.payment;

    const earning = await this.earnings.createForCompletedBooking(bookingId, booking.selectedProviderId);
    const notes = appendDatedAdminNote(
      booking.notes,
      `Completed booking closeout reconciled by operations${note ? `: ${note}` : '.'}`,
    );

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        notes,
        opsTasks: {
          upsert: {
            where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
            update: {
              status: BookingOpsTaskStatus.DONE,
              note: note ?? 'Payment, earning, tax, and wallet closeout reconciled.',
              actorId,
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: BookingOpsTaskStatus.DONE,
              note: note ?? 'Payment, earning, tax, and wallet closeout reconciled.',
              actorId,
            },
          },
        },
      },
      select: adminBookingDetailSelect,
    });
    const referralRewards = await this.referrals.createRewardsForCompletedBooking(bookingId);

    await this.writeAudit(actorId, 'booking.completed.closeout', `booking:${bookingId}`, {
      bookingId,
      paymentId: capturedPayment?.id,
      paymentStatus: capturedPayment?.status,
      earningId: earning.id,
      netAmount: earning.netAmount,
      note,
      referralRewards: {
        customerRewardId: referralRewards.customerReward?.id ?? null,
        partnerRewardId: referralRewards.partnerReward?.id ?? null,
      },
    });

    return updated;
  }

  async approvePostMatchCancellation(actorId: string, bookingId: string, input: { note?: string } = {}) {
    return this.resolvePostMatchCancellation(actorId, bookingId, 'APPROVED', input);
  }

  async holdPostMatchCancellation(actorId: string, bookingId: string, input: { note?: string } = {}) {
    return this.resolvePostMatchCancellation(actorId, bookingId, 'HELD', input);
  }

  private async resolvePostMatchCancellation(
    actorId: string,
    bookingId: string,
    decision: PostMatchCancellationDecision,
    input: { note?: string },
  ) {
    const normalizedNote = normalizeNullable(input.note);

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          notes: true,
          matchedAt: true,
          selectedProviderId: true,
          closedAt: true,
          closedByRole: true,
          closedReason: true,
          closedNote: true,
          earning: {
            select: {
              id: true,
              bookingId: true,
              providerProfileId: true,
              netAmount: true,
              currency: true,
              status: true,
            },
          },
        },
      });

      if (booking.status !== BookingStatus.CANCELLED) {
        throw new BadRequestException(`Booking status ${booking.status} is not a cancellation review`);
      }
      if (!booking.matchedAt && !booking.selectedProviderId) {
        throw new BadRequestException('Post-match cancellation requires matching evidence');
      }
      if (
        booking.closedReason === POST_MATCH_CANCELLATION_APPROVED_REASON ||
        booking.closedReason === POST_MATCH_CANCELLATION_HELD_REASON
      ) {
        throw new BadRequestException('Post-match cancellation has already been resolved');
      }

      const minutesAfterMatch = minutesBetween(booking.matchedAt, booking.closedAt ?? new Date());
      const autoApprovalWindow =
        minutesAfterMatch !== null && minutesAfterMatch <= POST_MATCH_CANCELLATION_REVIEW_MINUTES;
      const decisionVerb = decision === 'APPROVED' ? 'approved' : 'held';
      const defaultNote =
        decision === 'APPROVED'
          ? autoApprovalWindow
            ? 'Approved within 15-minute post-match cancellation window.'
            : 'Approved after admin chat evidence review.'
          : 'Held after admin chat evidence review; Partner fee deduction remains.';
      const closureNote = normalizedNote ?? defaultNote;
      const notes = appendDatedAdminNote(
        booking.notes,
        `Post-match cancellation ${decisionVerb} by operations: ${closureNote}`,
      );
      const earningResult =
        decision === 'APPROVED'
          ? await restorePostMatchCancellationEarning(tx, booking.earning)
          : { skipped: true, reason: 'FEE_HELD_BY_ADMIN_DECISION' };
      const closedReason =
        decision === 'APPROVED'
          ? POST_MATCH_CANCELLATION_APPROVED_REASON
          : POST_MATCH_CANCELLATION_HELD_REASON;

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          closedByRole: Role.ADMIN,
          closedReason,
          closedNote: closureNote,
          notes,
          opsTasks: {
            upsert: {
              where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
              update: {
                status: BookingOpsTaskStatus.DONE,
                note: closureNote,
                actorId,
              },
              create: {
                type: BookingOpsTaskType.PAYMENT_REVIEWED,
                status: BookingOpsTaskStatus.DONE,
                note: closureNote,
                actorId,
              },
            },
          },
        },
        select: adminBookingDetailSelect,
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action:
            decision === 'APPROVED'
              ? 'booking.post_match_cancellation.approve'
              : 'booking.post_match_cancellation.hold',
          target: `booking:${bookingId}`,
          metadata: toJson({
            bookingId,
            previousClosedByRole: booking.closedByRole,
            previousClosedReason: booking.closedReason,
            previousClosedNote: booking.closedNote,
            minutesAfterMatch,
            autoApprovalWindow,
            decision,
            note: closureNote,
            earningResult,
          }),
        },
      });

      return updated;
    });
  }

  async updateBookingOpsTask(
    actorId: string,
    bookingId: string,
    input: { type: BookingOpsTaskType; status: BookingOpsTaskStatus; note?: string },
  ) {
    if (!Object.values(BookingOpsTaskType).includes(input.type)) {
      throw new BadRequestException('Invalid operation task type');
    }
    if (!Object.values(BookingOpsTaskStatus).includes(input.status)) {
      throw new BadRequestException('Invalid operation task status');
    }

    const note = normalizeNullable(input.note);
    const task = await this.prisma.bookingOpsTask.upsert({
      where: { bookingId_type: { bookingId, type: input.type } },
      update: {
        status: input.status,
        note,
        actorId,
      },
      create: {
        bookingId,
        type: input.type,
        status: input.status,
        note,
        actorId,
      },
      include: { actor: { select: { phone: true, fullName: true } } },
    });

    await this.writeAudit(actorId, 'booking.ops_task.update', `booking:${bookingId}`, {
      bookingId,
      type: input.type,
      status: input.status,
      note,
    });

    return task;
  }

  listPayments(options: AdminPaymentOperationsQuery = {}) {
    const where = adminPaymentOperationsWhere(options);

    return this.prisma.payment.findMany({
      ...(where ? { where } : {}),
      orderBy: { id: 'desc' },
      take: adminPaymentOperationsTake(options.take),
      select: {
        ...adminPaymentSummarySelect,
        booking: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
            selectedProvider: {
              select: {
                id: true,
                displayName: true,
                user: { select: adminUserSummarySelect },
              },
            },
            earning: { select: adminEarningSummarySelect },
          },
        },
        callbackAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: adminPaymentCallbackAttemptSummarySelect,
        },
      },
    });
  }

  async getPaymentDetail(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: adminPaymentDetailSelect,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const callbackAttemptsPromise = this.prisma.paymentCallbackAttempt.findMany({
      where: {
        OR: [
          { paymentId: payment.id },
          ...(payment.providerRef ? [{ providerRef: payment.providerRef }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminPaymentCallbackAttemptSummarySelect,
    });

    const auditLogsPromise = this.prisma.adminAuditLog.findMany({
      where: paymentAuditLogWhere(payment.id, payment.bookingId),
      orderBy: { createdAt: 'desc' },
      take: 75,
      select: adminAuditLogSelect,
    });

    const [callbackAttempts, auditLogs] = await Promise.all([callbackAttemptsPromise, auditLogsPromise]);

    return { ...payment, callbackAttempts, auditLogs };
  }

  listPaymentCallbackAttempts(options: AdminPaymentCallbackAttemptQuery = {}) {
    const where = adminPaymentCallbackAttemptWhere(options);

    return this.prisma.paymentCallbackAttempt.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      take: adminPaymentCallbackAttemptTake(options.take),
      select: adminPaymentCallbackAttemptListSelect,
    });
  }

  listRefunds(options: AdminRefundOperationsQuery = {}) {
    const where = adminRefundOperationsWhere(options);

    return this.prisma.refund.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      take: adminRefundOperationsTake(options.take),
      select: adminRefundListSelect,
    });
  }

  listEarnings(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listForAdmin(options);
  }

  listCashSettlementEarnings(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listCashSettlementDebtForAdmin(options);
  }

  cashSettlementSummary() {
    return this.earnings.cashSettlementSummaryForAdmin();
  }

  earningsSummary() {
    return this.earnings.adminSummary();
  }

  listServices() {
    return this.prisma.massageService.findMany({
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
      select: adminServiceCatalogSelect,
    });
  }

  async listServiceGroups() {
    return groupServiceCatalogOptions(await this.listServices());
  }

  async createService(
    actorId: string,
    input: {
      serviceGroupKey?: string;
      name?: string;
      nameTranslations?: unknown;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const data = normalizeServiceInput(input, true) as Prisma.MassageServiceUncheckedCreateInput;
    return this.prisma.$transaction(async (tx) => {
      await ensureServiceDurationIsUnique(tx, {
        serviceGroupKey: data.serviceGroupKey as string,
        durationMin: data.durationMin as number,
      });
      const service = await tx.massageService.create({
        data,
        select: adminServiceMutationSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.create',
          target: `service:${service.id}`,
          metadata: toJson(data),
        },
      });
      return service;
    });
  }

  async createServiceDurationSet(
    actorId: string,
    input: {
      serviceGroupKey?: string;
      name?: string;
      nameTranslations?: unknown;
      description?: string | null;
      priceStep?: number;
      displayOrder?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      durations?: Array<{
        durationMin?: number;
        basePrice?: number;
        providerPayoutAmount?: number | null;
      }>;
    },
  ) {
    const { name, groupKey, priceStep, displayOrder, durationRows, durationMins } =
      normalizeServiceDurationSetInput(input);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.massageService.findMany({
        where: { serviceGroupKey: groupKey, durationMin: { in: durationMins } },
        select: { id: true, durationMin: true },
      });
      if (existing.length > 0) {
        throw new BadRequestException(
          `Service duration already exists for ${groupKey}: ${existing
            .map((service) => `${service.durationMin} min`)
            .join(', ')}`,
        );
      }

      const created: string[] = [];
      for (const row of durationRows) {
        const serviceData = normalizeServiceInput(
          {
            serviceGroupKey: groupKey,
            name,
            nameTranslations: input.nameTranslations,
            description: input.description,
            durationMin: row.durationMin,
            basePrice: row.basePrice,
            priceStep,
            displayOrder: displayOrder + (row.durationMin ?? 0),
            active: input.active ?? true,
          },
          true,
        ) as Prisma.MassageServiceUncheckedCreateInput;
        const service = await tx.massageService.create({
          data: serviceData,
          select: adminServiceMutationSelect,
        });
        const providerPayoutAmount = row.providerPayoutAmount;
        if (providerPayoutAmount !== undefined && providerPayoutAmount !== null) {
          const payoutRuleData = normalizeServicePayoutRuleInput(
            { basePrice: service.basePrice, priceStep: service.priceStep },
            {
              customerPrice: service.basePrice,
              providerPayoutAmount,
              vatBps: input.vatBps,
              otherCostAmount: input.otherCostAmount,
              active: true,
              notes: 'Base payout rule created with the service duration set.',
            },
            true,
          );
          await tx.servicePayoutRule.create({
            data: { ...payoutRuleData, serviceId: service.id },
          });
        }
        created.push(service.id);
      }

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.duration_set.create',
          target: `service_group:${groupKey}`,
          metadata: toJson({
            groupKey,
            name,
            durationMins: [...durationMins].sort((left, right) => left - right),
            serviceIds: created,
          }),
        },
      });

      return tx.massageService.findMany({
        where: { id: { in: created } },
        orderBy: { durationMin: 'asc' },
        select: adminServiceMutationSelect,
      });
    });
  }

  async updateService(
    actorId: string,
    serviceId: string,
    input: {
      serviceGroupKey?: string | null;
      name?: string;
      nameTranslations?: unknown;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const data = normalizeServiceInput(input, false, existing) as Prisma.MassageServiceUncheckedUpdateInput;
    return this.prisma.$transaction(async (tx) => {
      await ensureServiceDurationIsUnique(tx, {
        serviceGroupKey:
          typeof data.serviceGroupKey === 'string'
            ? data.serviceGroupKey
            : (existing.serviceGroupKey ?? slugify(existing.name)),
        durationMin: typeof data.durationMin === 'number' ? data.durationMin : existing.durationMin,
        excludeServiceId: serviceId,
      });
      const service = await tx.massageService.update({
        where: { id: serviceId },
        data,
        select: adminServiceMutationSelect,
      });
      let adjustedProviderPrices = 0;
      const nextBasePrice = typeof data.basePrice === 'number' ? data.basePrice : undefined;
      if (nextBasePrice !== undefined) {
        const adjusted = await tx.providerService.updateMany({
          where: { serviceId, price: { lt: nextBasePrice } },
          data: { price: nextBasePrice },
        });
        adjustedProviderPrices = adjusted.count;
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.update',
          target: `service:${serviceId}`,
          metadata: toJson(serviceUpdateAuditMetadata(existing, service, adjustedProviderPrices)),
        },
      });
      return service;
    });
  }

  async upsertServicePayoutRule(
    actorId: string,
    serviceId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const service = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const data = normalizeServicePayoutRuleInput(service, input, true);
    const existingRule = await this.prisma.servicePayoutRule.findUnique({
      where: {
        serviceId_customerPrice: {
          serviceId,
          customerPrice: data.customerPrice,
        },
      },
      select: adminServicePayoutRuleMutationSelect,
    });
    const rule = await this.prisma.servicePayoutRule.upsert({
      where: {
        serviceId_customerPrice: {
          serviceId,
          customerPrice: data.customerPrice,
        },
      },
      update: data,
      create: {
        ...data,
        serviceId,
      },
      select: adminServicePayoutRuleMutationSelect,
    });
    await this.writeAudit(
      actorId,
      'service_payout_rule.upsert',
      `service:${serviceId}`,
      toJson(servicePayoutRuleAuditMetadata(service, existingRule, rule)),
    );
    return rule;
  }

  async bulkUpsertServicePayoutRules(
    actorId: string,
    serviceId: string,
    input: {
      rules?: Array<{
        customerPrice?: number;
        providerPayoutAmount?: number;
        vatBps?: number;
        otherCostAmount?: number;
        active?: boolean;
        notes?: string | null;
      }>;
    },
  ) {
    const service = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const rows = input.rules ?? [];
    if (rows.length === 0) {
      throw new BadRequestException('At least one payout rule is required');
    }
    const seenPrices = new Set<number>();
    const data = rows.map((row) => {
      const normalized = normalizeServicePayoutRuleInput(service, row, true);
      if (seenPrices.has(normalized.customerPrice)) {
        throw new BadRequestException(
          `Duplicate customer price in payout rule import: ${normalized.customerPrice}`,
        );
      }
      seenPrices.add(normalized.customerPrice);
      return normalized;
    });

    return this.prisma.$transaction(async (tx) => {
      const existingRules = await tx.servicePayoutRule.findMany({
        where: { serviceId, customerPrice: { in: data.map((row) => row.customerPrice) } },
        select: adminServicePayoutRuleMutationSelect,
      });
      const saved = [];
      for (const row of data) {
        const rule = await tx.servicePayoutRule.upsert({
          where: {
            serviceId_customerPrice: {
              serviceId,
              customerPrice: row.customerPrice,
            },
          },
          update: row,
          create: {
            ...row,
            serviceId,
          },
          select: adminServicePayoutRuleMutationSelect,
        });
        saved.push(rule);
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service_payout_rule.bulk_upsert',
          target: `service:${serviceId}`,
          metadata: toJson(bulkServicePayoutRuleAuditMetadata(service, saved, existingRules)),
        },
      });
      return saved.sort((left, right) => left.customerPrice - right.customerPrice);
    });
  }

  async updateServicePayoutRule(
    actorId: string,
    ruleId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const existing = await this.prisma.servicePayoutRule.findUniqueOrThrow({
      where: { id: ruleId },
      select: adminServicePayoutRuleWithServiceSelect,
    });
    const data = normalizeServicePayoutRuleInput(existing.service, input, false, existing);
    const rule = await this.prisma.servicePayoutRule.update({
      where: { id: ruleId },
      data,
      select: adminServicePayoutRuleWithServiceSelect,
    });
    await this.writeAudit(
      actorId,
      'service_payout_rule.update',
      `service_payout_rule:${ruleId}`,
      toJson(servicePayoutRuleAuditMetadata(existing.service, existing, rule)),
    );
    return rule;
  }

  async markEarningPaid(
    actorId: string,
    earningId: string,
    input: {
      settlementRef?: string | null;
      settlementNotes?: string | null;
      settlementMethod?: string | null;
    } = {},
  ) {
    const earning = await this.earnings.markPaid(earningId, input);
    await this.writeAudit(
      actorId,
      earning.netAmount < 0 ? 'earning.cash_fee_settled' : 'earning.paid',
      `earning:${earning.id}`,
      {
        bookingId: earning.bookingId,
        providerProfileId: earning.providerProfileId,
        netAmount: earning.netAmount,
        settlementRef: earning.settlementRef,
        settlementMethod: earning.settlementMethod,
      },
    );
    return earning;
  }

  listPayoutBatches(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listPayoutBatchesForAdmin(options);
  }

  async createPayoutBatch(
    actorId: string,
    input: { providerProfileId: string; transferRef?: string; notes?: string },
  ) {
    const batch = await this.earnings.createProviderPayoutBatch(input);
    await this.writeAudit(actorId, 'payout_batch.create', `payout_batch:${batch.id}`, {
      providerProfileId: batch.providerProfileId,
      totalNetAmount: batch.totalNetAmount,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  async updatePayoutBatch(
    actorId: string,
    payoutBatchId: string,
    input: { status?: PayoutBatchStatus; transferRef?: string | null; notes?: string | null },
  ) {
    const batch = await this.earnings.updatePayoutBatch(payoutBatchId, input);
    await this.writeAudit(actorId, 'payout_batch.update', `payout_batch:${batch.id}`, {
      status: batch.status,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  listReviews(options: AdminReviewBoardQueryOptions = {}) {
    return this.prisma.review.findMany({
      orderBy: adminReviewBoardOrderBy(options.sort),
      skip: adminReviewBoardSkip(options.skip),
      take: adminReviewBoardTake(options.take),
      where: adminReviewBoardWhere(options),
      select: {
        id: true,
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
        rating: true,
        comment: true,
        status: true,
        reportReason: true,
        moderatedAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            openedAt: true,
            createdAt: true,
            services: {
              select: {
                id: true,
                service: {
                  select: {
                    id: true,
                    name: true,
                    durationMin: true,
                  },
                },
              },
            },
          },
        },
        customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
        providerProfile: { select: adminProviderSummarySelect },
      },
    });
  }

  async reviewSummary(options: AdminReviewBoardSummaryOptions = {}) {
    const where = adminReviewBoardWhere(options);
    const [totalCount, statusRows, ratingAggregate] = await Promise.all([
      this.prisma.review.count({ ...(where ? { where } : {}) }),
      this.prisma.review.groupBy({
        by: ['status'],
        ...(where ? { where } : {}),
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        ...(where ? { where } : {}),
        _avg: { rating: true },
      }),
    ]);
    const statusCounts = adminReviewStatusCounts(statusRows);

    return {
      averageRating: ratingAggregate._avg.rating ?? 0,
      generatedAt: new Date().toISOString(),
      held: statusCounts[ReviewStatus.HIDDEN],
      published: statusCounts[ReviewStatus.PUBLISHED],
      reported: statusCounts[ReviewStatus.REPORTED],
      totalCount,
    };
  }

  listPartnerCustomerReviews(options: AdminPartnerCustomerReviewBoardQueryOptions = {}) {
    return this.prisma.providerCustomerReview.findMany({
      orderBy: adminPartnerCustomerReviewBoardOrderBy(options.sort),
      skip: adminReviewBoardSkip(options.skip),
      take: adminReviewBoardTake(options.take),
      where: adminPartnerCustomerReviewBoardWhere(options),
      select: {
        id: true,
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
        comment: true,
        status: true,
        reportReason: true,
        moderatedAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            openedAt: true,
            createdAt: true,
            services: {
              select: {
                id: true,
                service: {
                  select: {
                    id: true,
                    name: true,
                    durationMin: true,
                  },
                },
              },
            },
          },
        },
        customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
        providerProfile: { select: adminProviderSummarySelect },
      },
    });
  }

  async partnerCustomerReviewSummary(options: AdminPartnerCustomerReviewBoardSummaryOptions = {}) {
    const where = adminPartnerCustomerReviewBoardWhere(options);
    const totalCount = await this.prisma.providerCustomerReview.count({ ...(where ? { where } : {}) });

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
    };
  }

  async moderateReview(
    actorId: string,
    reviewId: string,
    input: { status: ReviewStatus; rating?: number; comment?: string; reportReason?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const normalizedComment = input.comment === undefined ? undefined : normalizeNullable(input.comment);
      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: input.status,
          rating: input.rating,
          comment: normalizedComment,
          reportReason: input.reportReason,
          moderatedAt: new Date(),
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { providerProfileId: review.providerProfileId, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.providerProfile.update({
        where: { id: review.providerProfileId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.rating,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'review.moderate',
          target: `review:${review.id}`,
          metadata: toJson({
            status: input.status,
            rating: input.rating,
            comment: normalizedComment,
            reportReason: input.reportReason,
          }),
        },
      });

      return review;
    });
  }

  async listCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      take: 100,
    });
    const recentUsageBookings = await this.recentCouponUsageBookings();
    const couponsByCode = new Map(coupons.map((coupon) => [coupon.code.toUpperCase(), coupon.id]));
    const usageByCouponId = new Map<string, ReturnType<typeof couponUsageBookingView>[]>();

    for (const booking of recentUsageBookings) {
      const metadata = recordFromJsonValue(booking.payment?.rawMeta ?? null);
      const couponId = stringFromRecord(metadata, 'couponId');
      const couponCode = stringFromRecord(metadata, 'couponCode')?.toUpperCase();
      const resolvedCouponId = couponId ?? (couponCode ? couponsByCode.get(couponCode) : null);
      if (!resolvedCouponId) {
        continue;
      }

      const usage = usageByCouponId.get(resolvedCouponId) ?? [];
      if (usage.length < 20) {
        usage.push(couponUsageBookingView(booking));
      }
      usageByCouponId.set(resolvedCouponId, usage);
    }

    return coupons.map((coupon) => ({
      ...coupon,
      usageBookings: usageByCouponId.get(coupon.id) ?? [],
    }));
  }

  private recentCouponUsageBookings() {
    return this.prisma.booking.findMany({
      where: {
        payment: {
          isNot: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        createdAt: true,
        scheduledStartAt: true,
        closedAt: true,
        customerProfile: {
          select: {
            user: {
              select: {
                email: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        payment: {
          select: {
            amount: true,
            currency: true,
            method: true,
            rawMeta: true,
            status: true,
          },
        },
        selectedProvider: {
          select: {
            displayName: true,
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        services: {
          select: {
            price: true,
            service: {
              select: {
                durationMin: true,
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });
  }

  async createCoupon(
    actorId: string,
    input: {
      code: string;
      description?: string;
      discount: unknown;
      active?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(),
        description: input.description,
        discount: toJson(input.discount),
        active: input.active ?? true,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });

    await this.writeAudit(actorId, 'coupon.create', `coupon:${coupon.id}`, { code: coupon.code });
    return coupon;
  }

  async updateCoupon(
    actorId: string,
    id: string,
    input: {
      description?: string;
      discount?: unknown;
      active?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        description: input.description,
        discount: input.discount === undefined ? undefined : toJson(input.discount),
        active: input.active,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    await this.writeAudit(actorId, 'coupon.update', `coupon:${coupon.id}`, { active: coupon.active });
    return coupon;
  }

  async deleteCoupon(actorId: string, id: string) {
    const coupon = await this.prisma.coupon.delete({
      where: { id },
    });

    await this.writeAudit(actorId, 'coupon.delete', `coupon:${coupon.id}`, { code: coupon.code });
    return { ok: true, couponId: coupon.id };
  }

  listAuditLogs(options: AdminAuditLogListOptions = {}) {
    const where = adminAuditLogWhere(options);
    const skip = adminAuditLogListSkip(options.skip);
    return this.prisma.adminAuditLog.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminAuditLogListLimit(options.take),
      select: adminAuditLogSelect,
    });
  }

  async auditLogSummary(options: AdminAuditLogListOptions = {}) {
    const where = adminAuditLogWhere(options);
    const totalCount = await this.prisma.adminAuditLog.count({
      ...(where ? { where } : {}),
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
    };
  }

  async addOperationsHandoffNote(actorId: string, input: { note?: string; preset?: string; owner?: string }) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const owner = normalizeNullable(input.owner) ?? 'Shift handoff';
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Operations handoff note is required');
    }

    const auditLog = await this.writeAudit(actorId, 'operations.handoff_note.add', 'operations:handoff', {
      owner,
      note: content,
      preset,
    });

    return { ok: true, auditLog };
  }

  async listOperationalPolicySettings() {
    const savedSettings = await this.prisma.operationalPolicySetting.findMany({
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    const savedByKey = new Map(savedSettings.map((setting) => [setting.key, setting]));

    return OPERATIONAL_POLICY_DEFINITIONS.map((definition) => {
      const saved = savedByKey.get(definition.key);
      const savedValue =
        saved && this.isOperationalPolicyValueSupported(definition, saved.value)
          ? saved.value
          : definition.value;
      return {
        ...definition,
        value: savedValue,
        recommendedValue: definition.recommendedValue,
        options: definition.options ?? null,
        requiresRestart: definition.requiresRestart ?? false,
        updatedAt: saved?.updatedAt ?? null,
        updatedBy: saved?.updatedBy ?? null,
      };
    });
  }

  async updateOperationalPolicySetting(
    actorId: string,
    key: string,
    input: { value?: unknown; reason?: string },
  ) {
    const definition = OPERATIONAL_POLICY_DEFINITIONS.find((item) => item.key === key);
    if (!definition) {
      throw new NotFoundException('Operational policy setting not found');
    }

    const value = this.validateOperationalPolicyValue(definition, input.value);
    const previous = await this.prisma.operationalPolicySetting.findUnique({ where: { key } });
    const setting = await this.prisma.operationalPolicySetting.upsert({
      where: { key },
      create: {
        key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: toJson(value),
        recommendedValue: toJson(definition.recommendedValue),
        options: definition.options ? toJson(definition.options) : undefined,
        requiresRestart: definition.requiresRestart ?? false,
        updatedById: actorId,
      },
      update: {
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: toJson(value),
        recommendedValue: toJson(definition.recommendedValue),
        options: definition.options ? toJson(definition.options) : Prisma.DbNull,
        requiresRestart: definition.requiresRestart ?? false,
        updatedById: actorId,
      },
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
    });

    await this.writeAudit(actorId, 'operational_policy.update', `operational_policy:${key}`, {
      key,
      previousValue: previous?.value ?? definition.value,
      value,
      reason: normalizeAuditReason(input.reason),
      enforced: definition.enforced,
    });

    return {
      ...definition,
      value: setting.value,
      recommendedValue: setting.recommendedValue ?? definition.recommendedValue,
      options: setting.options ?? definition.options ?? null,
      requiresRestart: setting.requiresRestart,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  }

  private async readOperationalPolicyValue(key: string, fallback: string) {
    const setting = await this.prisma.operationalPolicySetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return typeof setting?.value === 'string' ? setting.value : fallback;
  }

  private validateOperationalPolicyValue(
    definition: (typeof OPERATIONAL_POLICY_DEFINITIONS)[number],
    value: unknown,
  ) {
    if (typeof definition.value === 'number') {
      const parsed = Number(value);
      const min = definition.min ?? Number.MIN_SAFE_INTEGER;
      const max = definition.max ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new BadRequestException(`${definition.label} must be an integer between ${min} and ${max}`);
      }
      return parsed;
    }

    if (definition.options?.length) {
      const raw = String(value ?? '').trim();
      if (!definition.options.some((option) => option.value === raw)) {
        throw new BadRequestException(`${definition.label} has an unsupported option`);
      }
      return raw;
    }

    if (typeof definition.value === 'boolean') {
      return value === true || value === 'true';
    }

    return String(value ?? '').trim();
  }

  private isOperationalPolicyValueSupported(
    definition: (typeof OPERATIONAL_POLICY_DEFINITIONS)[number],
    value: unknown,
  ) {
    if (typeof definition.value === 'number') {
      const parsed = Number(value);
      const min = definition.min ?? Number.MIN_SAFE_INTEGER;
      const max = definition.max ?? Number.MAX_SAFE_INTEGER;
      return Number.isInteger(parsed) && parsed >= min && parsed <= max;
    }

    if (definition.options?.length) {
      const raw = String(value ?? '').trim();
      return definition.options.some((option) => option.value === raw);
    }

    if (typeof definition.value === 'boolean') {
      return value === true || value === false || value === 'true' || value === 'false';
    }

    return typeof value === 'string';
  }

  listNotifications(options: NotificationBoardQueryOptions = {}) {
    const where = notificationBoardWhere(options);
    const skip = normalizeNotificationBoardSkip(options.skip);
    const args: Prisma.NotificationFindManyArgs = {
      orderBy: { createdAt: 'desc' },
      take: normalizeNotificationBoardTake(options.take),
      select: adminNotificationBoardListSelect,
    };
    if (skip > 0) {
      args.skip = skip;
    }
    if (where) {
      args.where = where;
    }
    return this.prisma.notification.findMany(args);
  }

  async notificationSummary(options: NotificationBoardSummaryOptions = {}) {
    const baseWhere = notificationBoardWhere(options);
    const countNotifications = (where?: Prisma.NotificationWhereInput) =>
      this.prisma.notification.count(notificationCountArgs(notificationBoardAndWhere(baseWhere, where)));
    const countDeliveries = (where: Prisma.NotificationDeliveryWhereInput) =>
      this.prisma.notificationDelivery.count({
        where: {
          ...where,
          ...(baseWhere ? { notification: baseWhere } : {}),
        },
      });

    const [
      totalCount,
      failed,
      sent,
      skipped,
      pending,
      disabledDevices,
      staleDevices,
      needsRetry,
      noShow,
      payoutSetup,
      partnerAlertCount,
      fcmDeliveries,
      inAppDeliveries,
    ] = await Promise.all([
      countNotifications(),
      countNotifications(notificationDeliveryStatusWhere('FAILED')),
      countDeliveries({ status: 'SENT' }),
      countDeliveries({ status: 'SKIPPED' }),
      countNotifications({ deliveries: { none: {} } }),
      countNotifications({ user: { pushDevices: { some: { enabled: false } } } }),
      countNotifications(notificationStaleDeliveryCandidateWhere()),
      countNotifications(notificationBoardReviewWhere('needs-retry')),
      countNotifications({ type: 'booking.no_show' }),
      countNotifications({ type: 'provider.payout_setup_required' }),
      countNotifications({ type: { in: [...ADMIN_NOTIFICATION_PARTNER_ALERT_TYPES] } }),
      countDeliveries({ provider: 'FCM' }),
      countDeliveries({ provider: 'IN_APP_ONLY' }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      disabledDevices,
      failed,
      fcmDeliveries,
      inAppDeliveries,
      needsRetry,
      noShow,
      partnerAlertCount,
      payoutSetup,
      pending,
      sent,
      skipped,
      staleDevices,
      totalCount,
    };
  }

  async listNotificationTemplates() {
    await this.ensureDefaultNotificationTemplates();

    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ audience: 'asc' }, { key: 'asc' }],
      include: {
        translations: { orderBy: { locale: 'asc' } },
      },
    });
  }

  async updateNotificationTemplate(actorId: string, key: string, input: UpdateNotificationTemplateDto) {
    const templateKey = normalizeNotificationTemplateKey(key);
    const locale = normalizeNotificationTemplateLocale(input.locale);
    await this.ensureDefaultNotificationTemplates();

    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key: templateKey },
      select: { id: true, key: true },
    });
    if (!template) {
      throw new NotFoundException('Notification template was not found');
    }

    const [updatedTemplate] = await this.prisma.$transaction([
      this.prisma.notificationTemplate.update({
        where: { id: template.id },
        data: typeof input.enabled === 'boolean' ? { enabled: input.enabled } : {},
        include: { translations: { orderBy: { locale: 'asc' } } },
      }),
      this.prisma.notificationTemplateTranslation.upsert({
        where: { templateId_locale: { templateId: template.id, locale } },
        create: {
          templateId: template.id,
          locale,
          title: input.title,
          body: input.body,
        },
        update: {
          title: input.title,
          body: input.body,
        },
      }),
      this.writeAudit(actorId, 'notification_template.update', `notification_template:${template.key}`, {
        key: template.key,
        locale,
        enabled: input.enabled,
      }),
    ]);

    return updatedTemplate;
  }

  listAdminPushCampaigns(
    options: { readonly from?: string; readonly skip?: string; readonly take?: string; readonly to?: string } = {},
  ) {
    const where = adminPushCampaignHistoryDateWhere(options);
    return this.prisma.adminPushCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      skip: normalizeAdminPushCampaignHistorySkip(options.skip),
      take: normalizeAdminPushCampaignHistoryTake(options.take),
      ...(where ? { where } : {}),
      include: {
        recipients: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async adminPushCampaignSummary(
    options: { readonly from?: string; readonly to?: string } = {},
  ) {
    const where = adminPushCampaignHistoryDateWhere(options);
    const aggregate = await this.prisma.adminPushCampaign.aggregate({
      _count: { _all: true },
      _sum: {
        notificationCount: true,
        recipientCount: true,
      },
      ...(where ? { where } : {}),
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount: aggregate._count._all,
      totalNotifications: aggregate._sum.notificationCount ?? 0,
      totalRecipients: aggregate._sum.recipientCount ?? 0,
    };
  }

  async previewAdminPushCampaign(input: AdminPushCampaignDto) {
    const targetRole = normalizeAdminPushTargetRole(input.targetRole);
    const targetSegment = normalizeAdminPushTargetSegment(targetRole, input.targetSegment);
    const appDestination = normalizeAdminPushAppDestination(targetRole, input.appDestination);
    const where = adminPushRecipientWhere(targetRole, input.targetUserId, targetSegment);
    const [recipientCount, sampleRecipients] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          phone: true,
          fullName: true,
          roles: true,
          customerProfile: { select: { id: true } },
          providerProfile: { select: { id: true, displayName: true, status: true } },
          pushDevices: {
            where: { role: targetRole, enabled: true },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { id: true, platform: true, role: true, updatedAt: true },
          },
        },
      }),
    ]);

    return {
      targetRole,
      targetUserId: normalizeNullable(input.targetUserId),
      targetSegment,
      appDestination,
      recipientCount,
      sendLimit: ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT,
      willSendCount: Math.min(recipientCount, ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT),
      capped: recipientCount > ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT,
      sampleRecipients,
    };
  }

  async createAdminPushCampaign(actorId: string, input: AdminPushCampaignDto) {
    const targetRole = normalizeAdminPushTargetRole(input.targetRole);
    const targetSegment = normalizeAdminPushTargetSegment(targetRole, input.targetSegment);
    const appDestination = normalizeAdminPushAppDestination(targetRole, input.appDestination);
    const where = adminPushRecipientWhere(targetRole, input.targetUserId, targetSegment);
    const recipients = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT,
      select: { id: true },
    });

    if (recipients.length === 0) {
      throw new BadRequestException('No active push recipients were found for this target');
    }

    const campaign = await this.prisma.adminPushCampaign.create({
      data: {
        targetRole,
        targetUserId: normalizeNullable(input.targetUserId),
        locale: normalizeNullable(input.locale),
        title: input.title,
        body: input.body,
        createdById: actorId,
        recipientCount: recipients.length,
        metadata: toJson({
          source: 'admin_manual_push',
          sendLimit: ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT,
          targetSegment,
          appDestination,
        }),
        sentAt: new Date(),
      },
    });

    let notificationCount = 0;
    for (const recipient of recipients) {
      const notification = await this.notifications.create({
        userId: recipient.id,
        targetRole,
        type: 'admin.push.broadcast',
        resolveTemplate: false,
        title: input.title,
        body: input.body,
        data: {
          campaignId: campaign.id,
          source: 'admin_manual_push',
          targetSegment,
          destination: appDestination,
        },
      });
      notificationCount += 1;

      await this.prisma.adminPushCampaignRecipient.create({
        data: {
          campaignId: campaign.id,
          userId: recipient.id,
          notificationId: notification.id,
          status: 'QUEUED',
        },
      });
    }

    const updatedCampaign = await this.prisma.adminPushCampaign.update({
      where: { id: campaign.id },
      data: { notificationCount },
      include: { recipients: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    await this.writeAudit(actorId, 'admin_push_campaign.create', `admin_push_campaign:${campaign.id}`, {
      campaignId: campaign.id,
      targetRole,
      targetUserId: normalizeNullable(input.targetUserId),
      targetSegment,
      appDestination,
      recipientCount: recipients.length,
      notificationCount,
    });

    return updatedCampaign;
  }

  async retryNotification(actorId: string, notificationId: string) {
    const result = await this.notifications.retry(notificationId);
    await this.writeAudit(
      actorId,
      'notification.retry',
      `notification:${notificationId}`,
      notificationRetryAuditMetadata(notificationId, result),
    );
    return result;
  }

  private async ensureDefaultNotificationTemplates() {
    for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
      const row = await this.prisma.notificationTemplate.upsert({
        where: { key: template.key },
        create: {
          key: template.key,
          audience: template.audience,
          channel: template.channel,
          description: template.description,
          variables: toJson(template.variables),
          enabled: true,
        },
        update: {
          audience: template.audience,
          channel: template.channel,
          description: template.description,
          variables: toJson(template.variables),
        },
        select: { id: true },
      });

      await this.prisma.notificationTemplateTranslation.createMany({
        data: NOTIFICATION_TEMPLATE_LOCALES.map((locale) => ({
          templateId: row.id,
          locale,
          title: template.title,
          body: template.body,
        })),
        skipDuplicates: true,
      });
    }
  }

  writeAudit(actorId: string, action: string, target: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata,
      },
    });
  }

  private async getAuditLogSummaryByTargets(targets: string[], perTargetLimit: number) {
    if (targets.length === 0 || perTargetLimit <= 0) {
      return {
        logsByTarget: new Map<string, AdminAuditLogSummary[]>(),
        countByTarget: new Map<string, number>(),
      };
    }

    const [logs, counts] = await Promise.all([
      this.findRecentAuditLogsByTargets(targets, perTargetLimit),
      this.prisma.adminAuditLog.groupBy({
        by: ['target'],
        where: { target: { in: targets } },
        _count: { _all: true },
      }),
    ]);

    const logsByTarget = new Map<string, AdminAuditLogSummary[]>();
    for (const log of logs) {
      const bucket = logsByTarget.get(log.target) ?? [];
      bucket.push(log);
      logsByTarget.set(log.target, bucket);
    }

    return {
      logsByTarget,
      countByTarget: new Map(counts.map((entry) => [entry.target, entry._count._all])),
    };
  }

  private async findRecentAuditLogsByTargets(targets: string[], perTargetLimit: number) {
    const rows = await this.prisma.$queryRaw<AdminAuditLogSummaryRow[]>(Prisma.sql`
      WITH ranked_logs AS (
        SELECT
          logs."id",
          logs."action",
          logs."target",
          logs."metadata",
          logs."createdAt",
          actor."id" AS "actorId",
          actor."phone" AS "actorPhone",
          actor."fullName" AS "actorFullName",
          ROW_NUMBER() OVER (PARTITION BY logs."target" ORDER BY logs."createdAt" DESC) AS "targetRank"
        FROM "AdminAuditLog" logs
        INNER JOIN "User" actor ON actor."id" = logs."actorId"
        WHERE logs."target" IN (${Prisma.join(targets)})
      )
      SELECT
        "id",
        "action",
        "target",
        "metadata",
        "createdAt",
        "actorId",
        "actorPhone",
        "actorFullName"
      FROM ranked_logs
      WHERE "targetRank" <= ${perTargetLimit}
      ORDER BY "target" ASC, "createdAt" DESC
      LIMIT ${targets.length * perTargetLimit}
    `);

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      target: row.target,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actor: {
        id: row.actorId,
        phone: row.actorPhone,
        fullName: row.actorFullName,
      },
    })) satisfies AdminAuditLogSummary[];
  }

  private async getCustomerListActivitySummaries(customerIds: string[]) {
    const summaries = new Map<string, AdminCustomerActivitySummary>(
      customerIds.map((customerId) => [customerId, emptyCustomerActivitySummary()]),
    );

    const customerWhere = { customerProfileId: { in: customerIds } };
    const [bookingRows, completedRows, statusRows] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['customerProfileId'],
        where: customerWhere,
        _count: { _all: true },
        _max: { updatedAt: true, createdAt: true },
      }),
      this.prisma.booking.groupBy({
        by: ['customerProfileId'],
        where: { ...customerWhere, status: BookingStatus.COMPLETED },
        _count: { _all: true },
        _max: { updatedAt: true, createdAt: true },
      }),
      this.prisma.booking.groupBy({
        by: ['customerProfileId', 'status', 'closedByRole'],
        where: customerWhere,
        _count: { _all: true },
      }),
    ]);

    for (const row of bookingRows) {
      const summary = ensureCustomerActivitySummary(summaries, row.customerProfileId);
      summary.bookingCount = row._count._all;
      summary.lastBookingAt = latestDate(row._max.updatedAt, row._max.createdAt);
    }
    for (const row of completedRows) {
      const summary = ensureCustomerActivitySummary(summaries, row.customerProfileId);
      summary.completedBookingCount = row._count._all;
      summary.lastCompletedBookingAt = latestDate(row._max.updatedAt, row._max.createdAt);
    }
    for (const row of statusRows) {
      const summary = ensureCustomerActivitySummary(summaries, row.customerProfileId);
      const count = integerValue(row._count._all);
      if (ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES.has(row.status)) {
        summary.activeBookingCount += count;
      }
      if (ADMIN_VIETNAM_CANCELLATION_STATUSES.has(row.status)) {
        summary.closedBookingCount += count;
      }
      if (row.status === BookingStatus.NO_SHOW) {
        summary.noShowBookingCount += count;
      }
      if (row.closedByRole === Role.CUSTOMER) {
        summary.customerClosedBookingCount += count;
      }
      if (row.closedByRole === Role.ADMIN) {
        summary.adminClosedBookingCount += count;
      }
      if (row.closedByRole === Role.PROVIDER) {
        summary.partnerClosedBookingCount += count;
      }
    }

    return summaries;
  }

  private async getProviderListBookingSummaries(providerIds: string[]) {
    const summaries = new Map<string, AdminProviderBookingSummary>(
      providerIds.map((providerId) => [providerId, emptyProviderBookingSummary()]),
    );
    if (providerIds.length === 0) {
      return summaries;
    }

    const rows = await this.prisma.$queryRaw<AdminProviderBookingSummaryRow[]>(Prisma.sql`
      WITH relation_rows AS (
        SELECT
          bookings."preferredProviderId" AS "providerId",
          bookings."id" AS "bookingId",
          TRUE AS "preferred",
          FALSE AS "selected",
          FALSE AS "participating"
        FROM "Booking" bookings
        WHERE bookings."preferredProviderId" IN (${Prisma.join(providerIds)})

        UNION ALL

        SELECT
          bookings."selectedProviderId" AS "providerId",
          bookings."id" AS "bookingId",
          FALSE AS "preferred",
          TRUE AS "selected",
          FALSE AS "participating"
        FROM "Booking" bookings
        WHERE bookings."selectedProviderId" IN (${Prisma.join(providerIds)})

        UNION ALL

        SELECT
          participants."providerProfileId" AS "providerId",
          participants."bookingId",
          FALSE AS "preferred",
          FALSE AS "selected",
          TRUE AS "participating"
        FROM "BookingParticipant" participants
        WHERE participants."providerProfileId" IN (${Prisma.join(providerIds)})
      ),
      provider_bookings AS (
        SELECT
          relation_rows."providerId",
          relation_rows."bookingId",
          BOOL_OR(relation_rows."preferred") AS "preferred",
          BOOL_OR(relation_rows."selected") AS "selected",
          BOOL_OR(relation_rows."participating") AS "participating"
        FROM relation_rows
        WHERE relation_rows."providerId" IS NOT NULL
        GROUP BY relation_rows."providerId", relation_rows."bookingId"
      ),
      chat_bookings AS (
        SELECT DISTINCT "bookingId"
        FROM "ChatRoom"
      )
      SELECT
        provider_bookings."providerId",
        COUNT(*)::int AS "bookingCount",
        COUNT(*) FILTER (WHERE provider_bookings."preferred")::int AS "preferredBookingCount",
        COUNT(*) FILTER (WHERE provider_bookings."selected")::int AS "selectedBookingCount",
        COUNT(*) FILTER (WHERE provider_bookings."participating")::int AS "participatingBookingCount",
        COUNT(*) FILTER (
          WHERE bookings."status"::text IN (
            'CREATED',
            'OPEN_MATCHING',
            'MATCHED',
            'PROVIDER_ON_THE_WAY',
            'ARRIVED',
            'IN_SERVICE'
          )
        )::int AS "activeBookingCount",
        COUNT(*) FILTER (
          WHERE bookings."status"::text IN ('CREATED', 'OPEN_MATCHING')
        )::int AS "matchingBookingCount",
        COUNT(*) FILTER (
          WHERE bookings."status"::text IN (
            'MATCHED',
            'PROVIDER_ON_THE_WAY',
            'ARRIVED',
            'IN_SERVICE'
          )
        )::int AS "workingBookingCount",
        COUNT(*) FILTER (WHERE bookings."status"::text = 'COMPLETED')::int AS "completedBookingCount",
        COUNT(*) FILTER (
          WHERE bookings."status"::text IN ('CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW')
        )::int AS "closedBookingCount",
        COUNT(*) FILTER (WHERE bookings."closedByRole"::text = 'CUSTOMER')::int AS "customerClosedBookingCount",
        COUNT(*) FILTER (WHERE bookings."closedByRole"::text = 'ADMIN')::int AS "adminClosedBookingCount",
        COUNT(*) FILTER (WHERE bookings."closedByRole"::text = 'PROVIDER')::int AS "partnerClosedBookingCount",
        COUNT(*) FILTER (WHERE bookings."status"::text = 'NO_SHOW')::int AS "noShowBookingCount",
        COUNT(*) FILTER (WHERE chat_bookings."bookingId" IS NOT NULL)::int AS "chatRoomCount",
        COUNT(*) FILTER (
          WHERE chat_bookings."bookingId" IS NULL
            AND bookings."status"::text IN (
              'MATCHED',
              'PROVIDER_ON_THE_WAY',
              'ARRIVED',
              'IN_SERVICE',
              'COMPLETED'
            )
        )::int AS "chatMissingCount",
        MAX(COALESCE(bookings."updatedAt", bookings."createdAt")) AS "latestBookingAt"
      FROM provider_bookings
      INNER JOIN "Booking" bookings ON bookings."id" = provider_bookings."bookingId"
      LEFT JOIN chat_bookings ON chat_bookings."bookingId" = bookings."id"
      GROUP BY provider_bookings."providerId"
    `);

    for (const row of rows) {
      summaries.set(row.providerId, {
        activeBookingCount: integerValue(row.activeBookingCount),
        adminClosedBookingCount: integerValue(row.adminClosedBookingCount),
        bookingCount: integerValue(row.bookingCount),
        chatMissingCount: integerValue(row.chatMissingCount),
        chatRoomCount: integerValue(row.chatRoomCount),
        closedBookingCount: integerValue(row.closedBookingCount),
        completedBookingCount: integerValue(row.completedBookingCount),
        customerClosedBookingCount: integerValue(row.customerClosedBookingCount),
        latestBookingAt: latestDate(row.latestBookingAt),
        matchingBookingCount: integerValue(row.matchingBookingCount),
        noShowBookingCount: integerValue(row.noShowBookingCount),
        participatingBookingCount: integerValue(row.participatingBookingCount),
        partnerClosedBookingCount: integerValue(row.partnerClosedBookingCount),
        preferredBookingCount: integerValue(row.preferredBookingCount),
        selectedBookingCount: integerValue(row.selectedBookingCount),
        workingBookingCount: integerValue(row.workingBookingCount),
      });
    }

    return summaries;
  }

  private async getProviderListActivitySummaries(providerIds: string[]) {
    const summaries = new Map<string, AdminProviderActivitySummary>(
      providerIds.map((providerId) => [providerId, emptyProviderActivitySummary()]),
    );

    const providerWhere = { providerProfileId: { in: providerIds } };
    const [grossRows, pendingRows, availableRows, walletRows, completedRows] = await Promise.all([
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          ...providerWhere,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] },
        },
        _sum: { grossAmount: true, platformFee: true },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          ...providerWhere,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          ...providerWhere,
          status: EarningStatus.AVAILABLE,
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          ...providerWhere,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          payoutBatchId: null,
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          ...providerWhere,
          status: { in: [EarningStatus.AVAILABLE, EarningStatus.PAID] },
        },
        _count: { _all: true },
        _max: { paidAt: true, availableAt: true, createdAt: true },
      }),
    ]);

    for (const row of grossRows) {
      const summary = ensureProviderActivitySummary(summaries, row.providerProfileId);
      summary.grossRevenue = numberValue(row._sum.grossAmount);
      summary.platformFee = numberValue(row._sum.platformFee);
    }
    for (const row of pendingRows) {
      ensureProviderActivitySummary(summaries, row.providerProfileId).pendingPayout = numberValue(
        row._sum.netAmount,
      );
    }
    for (const row of availableRows) {
      ensureProviderActivitySummary(summaries, row.providerProfileId).availablePayout = numberValue(
        row._sum.netAmount,
      );
    }
    for (const row of walletRows) {
      ensureProviderActivitySummary(summaries, row.providerProfileId).walletBalance = numberValue(
        row._sum.netAmount,
      );
    }
    for (const row of completedRows) {
      const summary = ensureProviderActivitySummary(summaries, row.providerProfileId);
      summary.completedWorkCount = row._count._all;
      summary.lastCompletedWorkAt = latestDate(row._max.paidAt, row._max.availableAt, row._max.createdAt);
    }

    return summaries;
  }
}

function emptyCustomerActivitySummary(): AdminCustomerActivitySummary {
  return {
    activeBookingCount: 0,
    adminClosedBookingCount: 0,
    bookingCount: 0,
    closedBookingCount: 0,
    completedBookingCount: 0,
    customerClosedBookingCount: 0,
    lastBookingAt: null,
    lastCompletedBookingAt: null,
    noShowBookingCount: 0,
    partnerClosedBookingCount: 0,
  };
}

function ensureCustomerActivitySummary(
  summaries: Map<string, AdminCustomerActivitySummary>,
  customerId: string,
) {
  const existing = summaries.get(customerId);
  if (existing) return existing;

  const summary = emptyCustomerActivitySummary();
  summaries.set(customerId, summary);
  return summary;
}

function emptyProviderActivitySummary(): AdminProviderActivitySummary {
  return {
    availablePayout: 0,
    completedWorkCount: 0,
    grossRevenue: 0,
    lastCompletedWorkAt: null,
    pendingPayout: 0,
    platformFee: 0,
    walletBalance: 0,
  };
}

function ensureProviderActivitySummary(
  summaries: Map<string, AdminProviderActivitySummary>,
  providerId: string,
) {
  const existing = summaries.get(providerId);
  if (existing) return existing;

  const summary = emptyProviderActivitySummary();
  summaries.set(providerId, summary);
  return summary;
}

function emptyProviderBookingSummary(): AdminProviderBookingSummary {
  return {
    activeBookingCount: 0,
    adminClosedBookingCount: 0,
    bookingCount: 0,
    chatMissingCount: 0,
    chatRoomCount: 0,
    closedBookingCount: 0,
    completedBookingCount: 0,
    customerClosedBookingCount: 0,
    latestBookingAt: null,
    matchingBookingCount: 0,
    noShowBookingCount: 0,
    participatingBookingCount: 0,
    partnerClosedBookingCount: 0,
    preferredBookingCount: 0,
    selectedBookingCount: 0,
    workingBookingCount: 0,
  };
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMarketingSpendDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new BadRequestException('Marketing spend date must use YYYY-MM-DD');
  }

  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Marketing spend date is invalid');
  }

  return date;
}

function marketingSpendDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeMarketingSpendSource(value: unknown) {
  const source = normalizeMarketingSource(value);
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (source === 'unknown' && raw !== 'unknown') {
    throw new BadRequestException('Marketing spend source is unsupported');
  }

  return source;
}

function normalizeMarketingSpendPlatform(value: unknown) {
  if (value === undefined || value === null || `${value}`.trim() === '') {
    return 'unknown';
  }

  const platform = normalizeMarketingPlatform(value);
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (platform === 'unknown' && raw !== 'unknown') {
    throw new BadRequestException('Marketing spend platform is unsupported');
  }

  return platform;
}

function normalizeMarketingSpendRegionCode(
  value: unknown,
  options: { allowAll: true },
): VietnamRegionCode | null;
function normalizeMarketingSpendRegionCode(
  value?: unknown,
  options?: { allowAll?: false },
): VietnamRegionCode | 'all';
function normalizeMarketingSpendRegionCode(
  value: unknown,
  options: { allowAll?: boolean } = {},
): VietnamRegionCode | 'all' | null {
  if (value === undefined || value === null || `${value}`.trim() === '' || `${value}`.trim() === 'all') {
    return options.allowAll ? null : 'all';
  }

  const normalized = `${value}`.trim();
  const regionCode = VIETNAM_REGION_BUCKETS.find((bucket) => bucket.code === normalized)?.code;
  if (!regionCode) {
    throw new BadRequestException('Marketing spend region is unsupported');
  }

  return regionCode;
}

function normalizeMarketingSpendCampaignId(value: unknown) {
  const normalized = value === undefined || value === null ? null : normalizeNullable(String(value));
  return normalized ?? 'all';
}

function adminAuditLogListLimit(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_AUDIT_LOG_LIST_LIMIT);
}

function adminAuditLogListSkip(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(numeric), 0), 10_000);
}

function adminAppSessionListTake(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_APP_SESSION_LIST_LIMIT);
}

function adminAppSessionListSkip(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(numeric), 0), 10_000);
}

function adminAppSessionListWhere(
  options: AdminAppSessionListQuery,
): Prisma.AppSessionWhereInput | undefined {
  const filters: Prisma.AppSessionWhereInput[] = [];
  const role = normalizeAdminAppSessionRole(options.role);
  const platform = normalizeNullable(options.platform)?.toUpperCase();
  const stateWhere = adminAppSessionStateWhere(options.state);
  const q = normalizeNullable(options.q);

  if (role) {
    filters.push({ role });
  }
  if (platform) {
    filters.push({ platform: { equals: platform, mode: 'insensitive' } });
  }
  if (stateWhere) {
    filters.push(stateWhere);
  }
  if (q) {
    filters.push({
      OR: [
        { user: { phone: { contains: q, mode: 'insensitive' } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { deviceId: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return filters.length > 0 ? { AND: filters } : undefined;
}

function normalizeAdminAppSessionRole(value: string | null | undefined): Role | undefined {
  const normalized = normalizeNullable(value)?.toUpperCase();
  if (normalized === 'PARTNER' || normalized === Role.PROVIDER) {
    return Role.PROVIDER;
  }
  if (normalized === Role.CUSTOMER) {
    return Role.CUSTOMER;
  }
  return undefined;
}

function adminAppSessionStateWhere(value: string | null | undefined): Prisma.AppSessionWhereInput | undefined {
  const state = normalizeNullable(value)?.toLowerCase();
  const now = new Date();
  const liveBoundary = new Date(now.getTime() - ADMIN_APP_SESSION_LIVE_WINDOW_MS);
  const recentBoundary = new Date(now.getTime() - ADMIN_APP_SESSION_RECENT_WINDOW_MS);
  const staleBoundary = new Date(now.getTime() - ADMIN_APP_SESSION_STALE_WINDOW_MS);
  const activeExpiryWhere = { active: true, expiresAt: { gte: now } };

  switch (state) {
    case 'live':
      return { OR: [activeExpiryWhere, { lastSeenAt: { gte: liveBoundary } }] };
    case 'recent':
      return {
        AND: [
          { lastSeenAt: { gte: recentBoundary, lt: liveBoundary } },
          { NOT: activeExpiryWhere },
        ],
      };
    case 'stale':
      return {
        AND: [
          { lastSeenAt: { gte: staleBoundary, lt: recentBoundary } },
          { NOT: activeExpiryWhere },
        ],
      };
    case 'expired':
      return { AND: [{ lastSeenAt: { lt: staleBoundary } }, { NOT: activeExpiryWhere }] };
    default:
      return undefined;
  }
}

function adminChatArchiveListTake(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_CHAT_ARCHIVE_LIST_LIMIT);
}

function adminChatArchiveWhere(query: AdminChatArchiveListQuery): Prisma.BookingWhereInput {
  return {
    AND: [
      { chatRoom: { isNot: null } },
      adminBookingListDateWhere(query),
      adminChatArchiveStatusWhere(query.status),
      adminChatArchiveSenderWhere(query.sender),
      adminChatArchiveSearchWhere(query.q),
    ].filter((filter): filter is Prisma.BookingWhereInput => Boolean(filter)),
  };
}

function adminChatArchiveStatusWhere(status: string | null | undefined): Prisma.BookingWhereInput | undefined {
  switch (normalizeNullable(status)?.toLowerCase()) {
    case 'active':
      return adminBookingListStatusGroupWhere('realtime');
    case 'completed':
      return { status: BookingStatus.COMPLETED };
    case 'closed':
      return {
        status: {
          in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.REFUNDED, BookingStatus.NO_SHOW],
        },
      };
    case 'no-message':
      return { chatRoom: { is: { messages: { none: {} } } } };
    case 'missing-room':
      return { chatRoom: { is: null } };
    default:
      return undefined;
  }
}

function adminChatArchiveSenderWhere(sender: string | null | undefined): Prisma.BookingWhereInput | undefined {
  const role = adminChatArchiveSenderRole(sender);
  if (!role) {
    return undefined;
  }

  return {
    chatRoom: {
      is: {
        messages: {
          some: {
            sender: { roles: { has: role } },
          },
        },
      },
    },
  };
}

function adminChatArchiveSenderRole(sender: string | null | undefined): Role | undefined {
  switch (normalizeNullable(sender)?.toLowerCase()) {
    case 'customer':
      return Role.CUSTOMER;
    case 'partner':
      return Role.PROVIDER;
    case 'admin':
      return Role.ADMIN;
    default:
      return undefined;
  }
}

function adminChatArchiveSearchWhere(q: string | null | undefined): Prisma.BookingWhereInput | undefined {
  const query = normalizeNullable(q);
  if (!query) {
    return undefined;
  }

  const textFilter = { contains: query, mode: Prisma.QueryMode.insensitive };
  const userSearch = {
    OR: [
      { phone: textFilter },
      { fullName: textFilter },
    ],
  };
  const providerSearch = {
    OR: [
      { id: textFilter },
      { displayName: textFilter },
      { user: { is: userSearch } },
    ],
  };

  return {
    OR: [
      { id: textFilter },
      { customerProfileId: textFilter },
      { preferredProviderId: textFilter },
      { selectedProviderId: textFilter },
      { customerProfile: { is: { id: textFilter } } },
      { customerProfile: { is: { user: { is: userSearch } } } },
      { preferredProvider: { is: providerSearch } },
      { selectedProvider: { is: providerSearch } },
      { chatRoom: { is: { id: textFilter } } },
      {
        chatRoom: {
          is: {
            messages: {
              some: { body: textFilter },
            },
          },
        },
      },
    ],
  };
}

function adminAuditLogWhere(options: AdminAuditLogListOptions): Prisma.AdminAuditLogWhereInput | undefined {
  const filters: Prisma.AdminAuditLogWhereInput[] = [];
  const action = normalizeNullable(options.action);
  const q = normalizeNullable(options.q);
  const bucket = normalizeNullable(options.bucket);
  const priority = normalizeNullable(options.priority);
  const createdAt = adminAuditLogDateWhere(options.from, options.to);
  const bucketWhere = adminAuditLogBucketWhere(bucket);
  const priorityWhere = adminAuditLogPriorityWhere(priority);

  if (action) {
    filters.push({ action });
  }
  if (createdAt) {
    filters.push(createdAt);
  }
  if (q) {
    filters.push({
      OR: [
        { action: { contains: q, mode: 'insensitive' } },
        { target: { contains: q, mode: 'insensitive' } },
        { actor: { fullName: { contains: q, mode: 'insensitive' } } },
        { actor: { phone: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  if (bucketWhere) {
    filters.push(bucketWhere);
  }
  if (priorityWhere) {
    filters.push(priorityWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

function adminAuditLogDateWhere(
  from: string | null | undefined,
  to: string | null | undefined,
): Prisma.AdminAuditLogWhereInput | undefined {
  const fromDate = adminAuditLogDateBoundary(from, 'from');
  const toDate = adminAuditLogDateBoundary(to, 'to');

  if (!fromDate && !toDate) {
    return undefined;
  }
  if (fromDate && toDate && fromDate.getTime() >= toDate.getTime()) {
    throw new BadRequestException('Audit log date range is invalid');
  }

  return {
    createdAt: {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lt: toDate } : {}),
    },
  };
}

function adminAuditLogDateBoundary(value: string | null | undefined, label: 'from' | 'to'): Date | undefined {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Audit log ${label} date is invalid`);
  }

  return date;
}

function adminAuditLogBucketWhere(bucket: string | null): Prisma.AdminAuditLogWhereInput | undefined {
  switch (bucket) {
    case 'Dispatch':
      return {
        OR: [
          { action: { startsWith: 'booking.' } },
          { action: { startsWith: 'provider.' } },
          { action: { startsWith: 'provider_' } },
          { action: { startsWith: 'provider-' } },
        ],
      };
    case 'Operations/Policy':
      return { action: { startsWith: 'operational_policy.' } };
    case 'Payment':
      return { OR: [{ action: { startsWith: 'payment.' } }, { action: { startsWith: 'refund.' } }] };
    case 'Finance/Closeout':
      return {
        OR: [
          { action: { startsWith: 'payment.' } },
          { action: { startsWith: 'refund.' } },
          { action: { startsWith: 'payout.' } },
          { action: { startsWith: 'payout_batch.' } },
          { action: { startsWith: 'earning.' } },
          { action: { startsWith: 'provider_wallet.' } },
          { action: { startsWith: 'wallet_ledger.' } },
          { action: 'booking.completed.closeout' },
          { action: 'booking.expire.manual' },
          { action: 'booking.no_show.mark' },
        ],
      };
    case 'Service/Pricing':
      return {
        OR: [{ action: { startsWith: 'service.' } }, { action: { startsWith: 'service_payout_rule.' } }],
      };
    case 'Notification':
      return {
        OR: [{ action: { startsWith: 'notification.' } }, { action: { startsWith: 'push_device.' } }],
      };
    case 'Partner':
      return {
        OR: [
          { action: { startsWith: 'provider_' } },
          { action: { startsWith: 'provider-' } },
          { action: { startsWith: 'provider-verification.' } },
        ],
      };
    case 'Tax':
      return { action: { startsWith: 'tax_' } };
    case 'System':
      return {
        NOT: {
          OR: [
            { action: { startsWith: 'booking.' } },
            { action: { startsWith: 'provider.' } },
            { action: { startsWith: 'provider_' } },
            { action: { startsWith: 'provider-' } },
            { action: { startsWith: 'operational_policy.' } },
            { action: { startsWith: 'payment.' } },
            { action: { startsWith: 'refund.' } },
            { action: { startsWith: 'payout.' } },
            { action: { startsWith: 'payout_batch.' } },
            { action: { startsWith: 'earning.' } },
            { action: { startsWith: 'provider_wallet.' } },
            { action: { startsWith: 'wallet_ledger.' } },
            { action: { startsWith: 'service.' } },
            { action: { startsWith: 'service_payout_rule.' } },
            { action: { startsWith: 'notification.' } },
            { action: { startsWith: 'push_device.' } },
            { action: { startsWith: 'tax_' } },
          ],
        },
      };
    default:
      return undefined;
  }
}

function adminAuditLogPriorityWhere(priority: string | null): Prisma.AdminAuditLogWhereInput | undefined {
  switch (priority) {
    case '4':
      return {
        OR: [
          { action: { startsWith: 'operational_policy.' } },
          { action: { startsWith: 'service_payout_rule.' } },
          { action: 'booking.completed.closeout' },
          { action: { endsWith: '.refund' } },
          { action: { contains: 'reject' } },
          { action: { endsWith: '.retry' } },
        ],
      };
    case '3':
      return {
        OR: [
          { action: { startsWith: 'payout_batch.' } },
          { action: { startsWith: 'service.' } },
          { action: { startsWith: 'payment.' } },
          { action: { startsWith: 'refund.' } },
        ],
      };
    case '2':
      return {
        OR: [{ action: { startsWith: 'booking.' } }, { action: { startsWith: 'notification.' } }],
      };
    case '1':
      return {
        NOT: {
          OR: [
            { action: { startsWith: 'operational_policy.' } },
            { action: { startsWith: 'service_payout_rule.' } },
            { action: 'booking.completed.closeout' },
            { action: { endsWith: '.refund' } },
            { action: { contains: 'reject' } },
            { action: { endsWith: '.retry' } },
            { action: { startsWith: 'payout_batch.' } },
            { action: { startsWith: 'service.' } },
            { action: { startsWith: 'payment.' } },
            { action: { startsWith: 'refund.' } },
            { action: { startsWith: 'booking.' } },
            { action: { startsWith: 'notification.' } },
          ],
        },
      };
    default:
      return undefined;
  }
}

function adminBookingListLimit(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_BOOKING_LIST_LIMIT);
}

function boundedAdminListLimit(value: number | string | null | undefined, max: number): number {
  if (value === null || value === undefined || value === '') {
    return max;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return max;
  }

  return Math.min(Math.max(Math.trunc(numeric), 1), max);
}

function normalizeMarketingSpendAmount(value: unknown) {
  const amount = numberValue(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new BadRequestException('Marketing spend amount must be a positive integer or zero');
  }

  return amount;
}

function ensureVietnamOverviewRegion(regions: Map<string, AdminVietnamOverviewRegion>, regionCode: string) {
  const region = regions.get(regionCode) ?? regions.get('other-vietnam');
  if (region) return region;

  return {
    regionCode: 'other-vietnam',
    regionName: 'Other Vietnam',
    shortName: 'VN',
    customerCount: 0,
    activeCustomerCount: 0,
    partnerCount: 0,
    onlinePartnerCount: 0,
    activeBookingCount: 0,
    completedBookingCount: 0,
    cancellationCount: 0,
    revenueAmount: 0,
    currency: 'VND',
  };
}

function vietnamOverviewEventPoint<TKind extends AdminVietnamOverviewPointKind>(input: {
  id: string;
  kind: TKind;
  label: string;
  latitude: unknown;
  longitude: unknown;
  occurredAt: Date | string | null | undefined;
  source: string;
  addressText?: string | null;
  bookingId?: string | null;
  customerProfileId?: string | null;
  providerProfileId?: string | null;
}): (AdminVietnamOverviewPoint & { kind: TKind }) | null {
  const latitude = coordinateValue(input.latitude);
  const longitude = coordinateValue(input.longitude);
  const occurredAt =
    input.occurredAt instanceof Date
      ? input.occurredAt
      : input.occurredAt
        ? new Date(input.occurredAt)
        : null;

  if (
    latitude === null ||
    longitude === null ||
    !isStoredVietnamCoordinate(latitude, longitude) ||
    !occurredAt ||
    !Number.isFinite(occurredAt.getTime())
  ) {
    return null;
  }

  const regionCode = vietnamRegionCodeFromValues([input.addressText, input.label], {
    latitude,
    longitude,
  });

  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    latitude,
    longitude,
    occurredAt: occurredAt.toISOString(),
    regionCode,
    source: input.source,
    addressText: input.addressText ?? null,
    bookingId: input.bookingId ?? null,
    customerProfileId: input.customerProfileId ?? null,
    providerProfileId: input.providerProfileId ?? null,
  };
}

function coordinateValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isStoredVietnamCoordinate(latitude: number, longitude: number) {
  return latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110;
}

function integerValue(value: unknown) {
  return Math.trunc(numberValue(value));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function providerUsageRow(
  providerProfileId: string,
  value: number,
  valueLabel: string,
  lastActivityAt: Date | null | undefined,
  index: number,
  providerMap: Map<
    string,
    {
      id: string;
      displayName: string;
      city: string | null;
      user: { phone: string };
    }
  >,
) {
  const provider = providerMap.get(providerProfileId);

  return {
    rank: index + 1,
    id: providerProfileId,
    label: provider?.displayName ?? 'Unknown Partner',
    secondary: provider?.city ?? provider?.user.phone ?? null,
    href: `/partners/${providerProfileId}`,
    value,
    valueLabel,
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
  };
}

function latestDate(...values: Array<Date | string | null | undefined>) {
  let latest: Date | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();
    if (!Number.isFinite(timestamp) || timestamp <= latestMs) continue;

    latest = date;
    latestMs = timestamp;
  }

  return latest;
}

function adminReferralPolicyView(audience: ReferralAudience, policy: AdminReferralPolicyRecord | null) {
  return {
    policyId: policy?.id ?? null,
    audience,
    enabled: policy?.enabled ?? false,
    rewardMode: policy?.rewardMode ?? defaultReferralRewardMode(audience),
    commissionPercentBps: policy?.commissionPercentBps ?? null,
    fixedRewardAmount: policy?.fixedRewardAmount ?? null,
    perRewardCapAmount: policy?.perRewardCapAmount ?? null,
    totalRewardCapAmount: policy?.totalRewardCapAmount ?? null,
    maxRewardedReferrals: policy?.maxRewardedReferrals ?? null,
    maxRewardsPerReferred: policy?.maxRewardsPerReferred ?? null,
    holdPeriodDays: policy?.holdPeriodDays ?? 7,
    currency: policy?.currency ?? 'VND',
    notes: policy?.notes ?? null,
    source: policy ? 'stored-policy' : 'default-disabled',
    updatedAt: policy?.updatedAt ?? null,
  };
}

function defaultReferralRewardMode(audience: ReferralAudience) {
  return audience === ReferralAudience.CUSTOMER
    ? ReferralRewardMode.COMMISSION_PERCENT
    : ReferralRewardMode.FIXED_AMOUNT;
}

function normalizeReferralAudienceInput(input: string) {
  const value = input.trim().toUpperCase();
  if (value === ReferralAudience.CUSTOMER) {
    return ReferralAudience.CUSTOMER;
  }
  if (value === ReferralAudience.PARTNER) {
    return ReferralAudience.PARTNER;
  }
  throw new BadRequestException('Unsupported referral policy audience');
}

function normalizeReferralCurrency(input?: string) {
  const value = (input ?? 'VND').trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(value)) {
    throw new BadRequestException('Referral policy currency must be an uppercase currency code');
  }
  return value;
}

function adminCustomerReferralParentView(
  row: AdminCustomerReferralParent,
  decisions: AdminReferralRewardDecisionMap = new Map(),
) {
  const rewards = row.referralsMade.flatMap((referral) => referral.rewards);

  return {
    referrer: {
      id: row.id,
      user: row.user,
    },
    referralCode: row.referralCodes[0] ?? null,
    totals: adminReferralRewardTotals(row.referralsMade.length, rewards),
    referrals: row.referralsMade.map((referral) => ({
      id: referral.id,
      status: referral.status,
      fraudReviewStatus: referral.fraudReviewStatus,
      installSource: referral.installSource,
      platform: referral.platform,
      createdAt: referral.createdAt,
      referredCustomer: referral.referredCustomerProfile,
      rewards: referral.rewards.map((reward) => adminReferralRewardView(reward, decisions)),
    })),
  };
}

function adminPartnerReferralParentView(
  row: AdminPartnerReferralParent,
  decisions: AdminReferralRewardDecisionMap = new Map(),
) {
  const rewards = row.referralsMade.flatMap((referral) => referral.rewards);

  return {
    referrer: {
      id: row.id,
      displayName: row.displayName,
      level: row.level,
      status: row.status,
      user: row.user,
    },
    referralCode: row.referralCodes[0] ?? null,
    totals: adminReferralRewardTotals(row.referralsMade.length, rewards),
    referrals: row.referralsMade.map((referral) => ({
      id: referral.id,
      status: referral.status,
      fraudReviewStatus: referral.fraudReviewStatus,
      installSource: referral.installSource,
      platform: referral.platform,
      createdAt: referral.createdAt,
      referredPartner: referral.referredProviderProfile,
      rewards: referral.rewards.map((reward) => adminReferralRewardView(reward, decisions)),
    })),
  };
}

function adminReferralRewardView(
  reward: AdminReferralRewardSummary,
  decisions: AdminReferralRewardDecisionMap,
) {
  const latestDecision = decisions.get(reward.id);
  return latestDecision ? { ...reward, latestDecision } : reward;
}

function adminCustomerReferralRewardIds(rows: readonly AdminCustomerReferralParent[]) {
  return uniqueReferralRewardIds(
    rows.flatMap((row) => row.referralsMade.flatMap((referral) => referral.rewards)),
  );
}

function adminPartnerReferralRewardIds(rows: readonly AdminPartnerReferralParent[]) {
  return uniqueReferralRewardIds(
    rows.flatMap((row) => row.referralsMade.flatMap((referral) => referral.rewards)),
  );
}

function uniqueReferralRewardIds(rewards: readonly AdminReferralRewardSummary[]) {
  return [...new Set(rewards.map((reward) => reward.id))];
}

function referralRewardAuditTarget(rewardId: string) {
  return `referral_reward:${rewardId}`;
}

function referralRewardIdFromAuditTarget(target: string) {
  const prefix = 'referral_reward:';
  return target.startsWith(prefix) ? target.slice(prefix.length) : null;
}

function referralRewardLatestDecisionView(log: AdminAuditLogSummary): AdminReferralRewardLatestDecision {
  const metadata = recordFromJsonValue(log.metadata);
  return {
    action: log.action,
    actor: log.actor,
    createdAt: log.createdAt,
    reason: stringFromRecord(metadata, 'reason'),
    status: stringFromRecord(metadata, 'status'),
    walletLedgerReference: stringFromRecord(metadata, 'walletLedgerReference'),
  };
}

function recordFromJsonValue(value: Prisma.JsonValue | null) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function couponUsageBookingView(booking: {
  closedAt: Date | null;
  createdAt: Date;
  customerProfile: {
    user: {
      email: string | null;
      fullName: string | null;
      phone: string;
    };
  };
  id: string;
  payment: {
    amount: number;
    currency: string;
    method: unknown;
    rawMeta: Prisma.JsonValue | null;
    status: PaymentStatus;
  } | null;
  scheduledStartAt: Date;
  selectedProvider: {
    displayName: string;
    user: {
      fullName: string | null;
      phone: string;
    };
  } | null;
  services: Array<{
    price: number;
    service: {
      durationMin: number;
      name: string;
    };
  }>;
  status: BookingStatus;
}) {
  const metadata = recordFromJsonValue(booking.payment?.rawMeta ?? null);
  const service = booking.services[0];
  const customerUser = booking.customerProfile.user;

  return {
    amount: booking.payment?.amount ?? null,
    bookingId: booking.id,
    closedAt: booking.closedAt,
    couponCode: stringFromRecord(metadata, 'couponCode'),
    currency: booking.payment?.currency ?? 'VND',
    customerName: customerUser.fullName ?? customerUser.phone ?? customerUser.email ?? 'Unknown customer',
    customerPhone: customerUser.phone,
    discountAmount: numberFromRecord(metadata, 'discountAmount'),
    originalAmount: numberFromRecord(metadata, 'originalAmount'),
    partnerName:
      booking.selectedProvider?.displayName ??
      booking.selectedProvider?.user.fullName ??
      booking.selectedProvider?.user.phone ??
      null,
    paymentMethod: booking.payment?.method ?? null,
    paymentStatus: booking.payment?.status ?? null,
    requestTime: booking.createdAt,
    scheduledStartAt: booking.scheduledStartAt,
    serviceName: service ? `${service.service.name} / ${service.service.durationMin} min` : null,
    servicePrice: service?.price ?? null,
    status: booking.status,
  };
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function adminReferralRewardTotals(referralCount: number, rewards: AdminReferralRewardSummary[]) {
  return {
    referralCount,
    rewardCount: rewards.length,
    pendingRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.PENDING),
    availableRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.AVAILABLE),
    heldRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.HELD),
    rewardedRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.REWARDED),
    reversedRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.REVERSED),
    cancelledRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.CANCELLED),
    pendingRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.PENDING),
    availableRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.AVAILABLE),
    heldRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.HELD),
    rewardedRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.REWARDED),
    reversedRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.REVERSED),
    cancelledRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.CANCELLED),
    totalRewardAmount: rewards.reduce((total, reward) => total + reward.amount, 0),
  };
}

function countReferralRewardsByStatus(rewards: AdminReferralRewardSummary[], status: ReferralRewardStatus) {
  return rewards.filter((reward) => reward.status === status).length;
}

function sumReferralRewardsByStatus(rewards: AdminReferralRewardSummary[], status: ReferralRewardStatus) {
  return rewards
    .filter((reward) => reward.status === status)
    .reduce((total, reward) => total + reward.amount, 0);
}

function adminBookingMarketplacePin(booking: {
  addressSnapshot?: {
    latitude: Prisma.Decimal | number | string;
    longitude: Prisma.Decimal | number | string;
  } | null;
  lat: Prisma.Decimal | number | string;
  lng: Prisma.Decimal | number | string;
}) {
  const lat = Number(booking.addressSnapshot?.latitude ?? booking.lat);
  const lng = Number(booking.addressSnapshot?.longitude ?? booking.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function adminBookingMarketplaceBounds(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320;
  const lngDenominator = 111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const lngDelta = radiusMeters / lngDenominator;
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

function uniqueAdminBookingMarketplaceProviders(providers: AdminBookingMarketplaceProvider[]) {
  const seen = new Set<string>();
  return providers.filter((provider) => {
    if (seen.has(provider.id)) {
      return false;
    }
    seen.add(provider.id);
    return true;
  });
}

function adminCustomerDirectoryTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_CUSTOMER_DIRECTORY_DEFAULT_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_CUSTOMER_DIRECTORY_DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_CUSTOMER_DIRECTORY_MAX_LIMIT);
}

function adminCustomerDirectorySkip(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 10_000);
}

function adminPartnerDirectoryTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT);
}

function adminPartnerDirectorySkip(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 10_000);
}

function adminPartnerDirectoryWhere(
  options: AdminPartnerDirectorySummaryOptions,
): Prisma.ProviderProfileWhereInput | undefined {
  const whereClauses = [
    adminPartnerDirectorySearchWhere(options.q),
    adminPartnerDirectoryReviewWhere(options.review),
  ].filter(Boolean) as Prisma.ProviderProfileWhereInput[];

  if (whereClauses.length === 0) {
    return undefined;
  }

  if (whereClauses.length === 1) {
    return whereClauses[0];
  }

  return { AND: whereClauses };
}

function adminPartnerDirectorySearchWhere(
  qValue: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const q = normalizeNullable(qValue);

  if (!q) {
    return undefined;
  }

  return {
    OR: [
      { displayName: { contains: q, mode: 'insensitive' } },
      { legalName: { contains: q, mode: 'insensitive' } },
      { activityNickname: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    ],
  };
}

function adminPartnerDirectoryReviewWhere(
  reviewValue: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const review = normalizeNullable(reviewValue);

  if (review !== 'unapproved') {
    return undefined;
  }

  return {
    OR: [
      { blockedAt: { not: null } },
      { verification: { is: null } },
      { verification: { is: { status: { not: VerificationStatus.APPROVED } } } },
      { kyc: { is: null } },
      { kyc: { is: { status: { not: ProviderKycStatus.APPROVED } } } },
      {
        documents: {
          some: {
            status: { in: [ProviderDocumentStatus.PENDING_REVIEW, ProviderDocumentStatus.REJECTED] },
          },
        },
      },
      ...REQUIRED_KYC_DOCUMENT_TYPES.map((type) => ({
        documents: {
          none: {
            type,
            status: ProviderDocumentStatus.APPROVED,
          },
        },
      })),
      {
        user: {
          fileAssets: {
            some: {
              purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
              uploadStatus: FileUploadStatus.UPLOADED,
              visibility: FileVisibility.PUBLIC,
              reviewStatus: { in: [FileReviewStatus.PENDING_REVIEW, FileReviewStatus.REJECTED] },
            },
          },
        },
      },
    ],
  };
}

function adminCustomerDirectoryWhere(
  options: AdminCustomerDirectorySummaryOptions,
): Prisma.CustomerProfileWhereInput | undefined {
  const where: Prisma.CustomerProfileWhereInput = {};
  const userWhere: Prisma.UserWhereInput = {};
  const q = normalizeNullable(options.q);
  const countrySessionWhere = adminCustomerDirectoryCountrySessionWhere(options.country);
  const joinedFrom = adminCustomerDirectoryDateBoundary(options.joinedFrom, 'joinedFrom');
  const joinedTo = adminCustomerDirectoryDateBoundary(options.joinedTo, 'joinedTo', true);
  const lastBookingFrom = adminCustomerDirectoryDateBoundary(options.lastBookingFrom, 'lastBookingFrom');
  const lastBookingTo = adminCustomerDirectoryDateBoundary(options.lastBookingTo, 'lastBookingTo', true);
  const lastLoginFrom = adminCustomerDirectoryDateBoundary(options.lastLoginFrom, 'lastLoginFrom');
  const lastLoginTo = adminCustomerDirectoryDateBoundary(options.lastLoginTo, 'lastLoginTo', true);
  const lastBookingWhere = adminCustomerDirectoryLastBookingWhere(lastBookingFrom, lastBookingTo);

  if (lastBookingWhere) {
    where.bookings = lastBookingWhere;
  }

  if (q) {
    userWhere.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (joinedFrom || joinedTo) {
    userWhere.createdAt = {
      ...(joinedFrom ? { gte: joinedFrom } : {}),
      ...(joinedTo ? { lt: joinedTo } : {}),
    };
  }

  if (countrySessionWhere || lastLoginFrom || lastLoginTo) {
    userWhere.appSessions = {
      some: {
        ...(countrySessionWhere ?? {}),
        ...(lastLoginFrom || lastLoginTo
          ? {
              lastSeenAt: {
                ...(lastLoginFrom ? { gte: lastLoginFrom } : {}),
                ...(lastLoginTo ? { lt: lastLoginTo } : {}),
              },
            }
          : {}),
      },
    };
  }

  if (Object.keys(userWhere).length > 0) {
    where.user = userWhere;
  }

  if (Object.keys(where).length === 0) {
    return undefined;
  }

  return where;
}

function adminCustomerDirectoryLastBookingWhere(
  from: Date | undefined,
  to: Date | undefined,
): NonNullable<Prisma.CustomerProfileWhereInput['bookings']> | undefined {
  if (!from && !to) return undefined;

  return {
    some: from ? { updatedAt: { gte: from } } : {},
    ...(to ? { none: { updatedAt: { gte: to } } } : {}),
  };
}

function adminCustomerDirectoryOrderBy(
  value: string | null | undefined,
): Prisma.CustomerProfileOrderByWithRelationInput | Prisma.CustomerProfileOrderByWithRelationInput[] {
  switch (normalizeNullable(value)) {
    case 'booking-count':
      return [{ bookings: { _count: 'desc' } }, { id: 'desc' }];
    case 'booking-count-asc':
      return [{ bookings: { _count: 'asc' } }, { id: 'desc' }];
    default:
      return { id: 'desc' };
  }
}

const ADMIN_CUSTOMER_DIRECTORY_COUNTRIES = ['VN', 'KR', 'JP', 'CN', 'SG'] as const;

function adminCustomerDirectoryCountrySessionWhere(
  value: string | null | undefined,
): Prisma.AppSessionWhereInput | undefined {
  const country = normalizeNullable(value)?.toUpperCase();
  if (!country) {
    return undefined;
  }

  if (country === 'UNKNOWN') {
    return {
      OR: [
        { deviceLanguage: null },
        { deviceLanguage: { equals: '' } },
        { NOT: { OR: ADMIN_CUSTOMER_DIRECTORY_COUNTRIES.flatMap(adminCustomerKnownCountryLanguageClauses) } },
      ],
    };
  }

  if (!ADMIN_CUSTOMER_DIRECTORY_COUNTRIES.includes(country as (typeof ADMIN_CUSTOMER_DIRECTORY_COUNTRIES)[number])) {
    return undefined;
  }

  return {
    OR: adminCustomerKnownCountryLanguageClauses(country),
  };
}

function adminCustomerKnownCountryLanguageClauses(country: string): Prisma.AppSessionWhereInput[] {
  const clauses: Prisma.AppSessionWhereInput[] = [
    { deviceLanguage: { endsWith: `-${country}`, mode: 'insensitive' } },
  ];

  if (country === 'VN') {
    clauses.push({ deviceLanguage: { equals: 'vi', mode: 'insensitive' } });
  }

  return clauses;
}

function adminCustomerDirectoryDateBoundary(
  value: string | null | undefined,
  field: string,
  endExclusive = false,
) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return undefined;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const date = new Date(isDateOnly ? `${normalized}T00:00:00.000Z` : normalized);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException(`Invalid customer ${field} date`);
  }

  if (endExclusive && isDateOnly) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

function adminReviewBoardTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_REVIEW_BOARD_DEFAULT_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_REVIEW_BOARD_DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_REVIEW_BOARD_MAX_LIMIT);
}

function adminReviewBoardSkip(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 10_000);
}

function adminReviewBoardWhere(options: AdminReviewBoardSummaryOptions): Prisma.ReviewWhereInput | undefined {
  const where: Prisma.ReviewWhereInput = {};
  const bookingId = normalizeNullable(options.bookingId);
  const customerProfileId = normalizeNullable(options.customerProfileId);
  const dateWhere = adminReviewBoardDateWhere(options);
  const providerProfileId = normalizeNullable(options.providerProfileId);
  const statusWhere = adminReviewBoardStatusWhere(options.review);
  const q = normalizeNullable(options.q);

  if (bookingId) {
    where.bookingId = bookingId;
  }
  if (customerProfileId) {
    where.customerProfileId = customerProfileId;
  }
  if (dateWhere) {
    Object.assign(where, dateWhere);
  }
  if (providerProfileId) {
    where.providerProfileId = providerProfileId;
  }
  if (statusWhere) {
    Object.assign(where, statusWhere);
  }
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { bookingId: { contains: q, mode: 'insensitive' } },
      { comment: { contains: q, mode: 'insensitive' } },
      { reportReason: { contains: q, mode: 'insensitive' } },
      { customerProfile: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
      { customerProfile: { user: { phone: { contains: q, mode: 'insensitive' } } } },
      { providerProfile: { displayName: { contains: q, mode: 'insensitive' } } },
      { providerProfile: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
      { providerProfile: { user: { phone: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminPartnerCustomerReviewBoardWhere(
  options: AdminPartnerCustomerReviewBoardSummaryOptions,
): Prisma.ProviderCustomerReviewWhereInput | undefined {
  const where: Prisma.ProviderCustomerReviewWhereInput = {};
  const bookingId = normalizeNullable(options.bookingId);
  const customerProfileId = normalizeNullable(options.customerProfileId);
  const dateWhere = adminPartnerCustomerReviewBoardDateWhere(options);
  const providerProfileId = normalizeNullable(options.providerProfileId);
  const q = normalizeNullable(options.q);

  if (bookingId) {
    where.bookingId = bookingId;
  }
  if (customerProfileId) {
    where.customerProfileId = customerProfileId;
  }
  if (dateWhere) {
    Object.assign(where, dateWhere);
  }
  if (providerProfileId) {
    where.providerProfileId = providerProfileId;
  }
  if (q) {
    where.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { bookingId: { contains: q, mode: 'insensitive' } },
      { comment: { contains: q, mode: 'insensitive' } },
      { reportReason: { contains: q, mode: 'insensitive' } },
      { customerProfile: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
      { customerProfile: { user: { phone: { contains: q, mode: 'insensitive' } } } },
      { providerProfile: { displayName: { contains: q, mode: 'insensitive' } } },
      { providerProfile: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
      { providerProfile: { user: { phone: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminReviewBoardDateWhere(options: {
  readonly from?: string | null;
  readonly to?: string | null;
}): Prisma.ReviewWhereInput | undefined {
  const from = normalizeAdminReviewBoardDateBoundary(options.from, 'from');
  const to = normalizeAdminReviewBoardDateBoundary(options.to, 'to');
  if (!from && !to) {
    return undefined;
  }
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Review date range is invalid');
  }

  return {
    createdAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function adminPartnerCustomerReviewBoardDateWhere(options: {
  readonly from?: string | null;
  readonly to?: string | null;
}): Prisma.ProviderCustomerReviewWhereInput | undefined {
  const from = normalizeAdminReviewBoardDateBoundary(options.from, 'from');
  const to = normalizeAdminReviewBoardDateBoundary(options.to, 'to');
  if (!from && !to) {
    return undefined;
  }
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Partner customer evaluation date range is invalid');
  }

  return {
    createdAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function normalizeAdminReviewBoardDateBoundary(value: string | null | undefined, field: string) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return undefined;
  }

  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException(`Review ${field} date is invalid`);
  }

  return new Date(timestamp);
}

function adminReviewBoardStatusWhere(value: string | null | undefined): Prisma.ReviewWhereInput | undefined {
  const normalized = normalizeNullable(value);
  switch (normalized) {
    case 'held':
    case 'hidden':
      return { status: ReviewStatus.HIDDEN };
    case 'published':
      return { status: ReviewStatus.PUBLISHED };
    case 'reported':
    case 'follow-up':
      return { status: ReviewStatus.REPORTED };
    default:
      return undefined;
  }
}

function adminReviewBoardOrderBy(
  value: string | null | undefined,
): Prisma.ReviewOrderByWithRelationInput | Prisma.ReviewOrderByWithRelationInput[] {
  switch (normalizeNullable(value)) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'rating-asc':
      return [{ rating: 'asc' }, { createdAt: 'desc' }];
    case 'rating-desc':
      return [{ rating: 'desc' }, { createdAt: 'desc' }];
    default:
      return { createdAt: 'desc' };
  }
}

function adminPartnerCustomerReviewBoardOrderBy(
  value: string | null | undefined,
): Prisma.ProviderCustomerReviewOrderByWithRelationInput {
  return normalizeNullable(value) === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };
}

function adminReviewStatusCounts(
  rows: Array<{ status: ReviewStatus; _count: { _all: number } }>,
): Record<ReviewStatus, number> {
  return rows.reduce<Record<ReviewStatus, number>>(
    (counts, row) => ({
      ...counts,
      [row.status]: row._count._all,
    }),
    {
      [ReviewStatus.HIDDEN]: 0,
      [ReviewStatus.PUBLISHED]: 0,
      [ReviewStatus.REPORTED]: 0,
    },
  );
}

function adminPaymentOperationsTake(value: number | string | null | undefined) {
  return adminBoundedPositiveInteger(
    value,
    ADMIN_PAYMENT_OPERATIONS_DEFAULT_LIMIT,
    ADMIN_PAYMENT_OPERATIONS_MAX_LIMIT,
  );
}

function adminPaymentCallbackAttemptTake(value: number | string | null | undefined) {
  return adminBoundedPositiveInteger(
    value,
    ADMIN_PAYMENT_CALLBACK_ATTEMPT_DEFAULT_LIMIT,
    ADMIN_PAYMENT_CALLBACK_ATTEMPT_MAX_LIMIT,
  );
}

function adminRefundOperationsTake(value: number | string | null | undefined) {
  return adminBoundedPositiveInteger(
    value,
    ADMIN_REFUND_OPERATIONS_DEFAULT_LIMIT,
    ADMIN_REFUND_OPERATIONS_MAX_LIMIT,
  );
}

function adminPaymentOperationsWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.PaymentWhereInput | undefined {
  const where = adminPaymentReviewWhere(options.review) ?? {};
  const bookingDateWhere = adminPaymentBookingDateWhere(options.range);

  if (bookingDateWhere) {
    where.booking = adminMergePaymentBookingWhere(where.booking, bookingDateWhere);
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminPaymentCallbackAttemptWhere(
  options: AdminPaymentCallbackAttemptQuery,
): Prisma.PaymentCallbackAttemptWhereInput | undefined {
  const filters: Prisma.PaymentCallbackAttemptWhereInput[] = [];
  const dateWhere = adminPaymentCallbackAttemptDateWhere(options.range);
  const reviewWhere = adminPaymentCallbackAttemptReviewWhere(options.review);

  if (dateWhere) {
    filters.push(dateWhere);
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminPaymentReviewWhere(review: string | null | undefined): Prisma.PaymentWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'capture':
      return { booking: { status: BookingStatus.COMPLETED }, status: PaymentStatus.AUTHORIZED };
    case 'missing-ref':
      return { providerRef: null, status: PaymentStatus.AUTHORIZED };
    case 'authorized':
      return { status: PaymentStatus.AUTHORIZED };
    case 'cash':
      return { method: PaymentMethod.CASH, status: PaymentStatus.PENDING };
    case 'cash-debt':
      return {
        booking: {
          earning: {
            is: {
              netAmount: { lt: 0 },
              status: { not: EarningStatus.PAID },
            },
          },
        },
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
      };
    case 'needs-action':
      return { status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.RELEASED] } };
    case 'callback-review':
      return { callbackAttempts: { some: adminPaymentCallbackAttemptNeedsReviewWhere() } };
    case 'callback-verified':
      return { callbackAttempts: { some: adminPaymentCallbackAttemptVerifiedWhere() } };
    case 'refunded':
      return { status: PaymentStatus.REFUNDED };
    default:
      return undefined;
  }
}

function adminPaymentCallbackAttemptReviewWhere(
  review: string | null | undefined,
): Prisma.PaymentCallbackAttemptWhereInput | undefined {
  if (normalizeNullable(review) === 'callback-review') {
    return adminPaymentCallbackAttemptNeedsReviewWhere();
  }
  if (normalizeNullable(review) === 'callback-verified') {
    return adminPaymentCallbackAttemptVerifiedWhere();
  }
  return undefined;
}

function adminPaymentCallbackAttemptNeedsReviewWhere(): Prisma.PaymentCallbackAttemptWhereInput {
  return {
    OR: [
      { outcome: { notIn: ['ACCEPTED', 'REPLAY'] } },
      { outcome: { in: ['ACCEPTED', 'REPLAY'] }, signatureVerified: { not: true } },
    ],
  };
}

function adminPaymentCallbackAttemptVerifiedWhere(): Prisma.PaymentCallbackAttemptWhereInput {
  return {
    outcome: { in: ['ACCEPTED', 'REPLAY'] },
    signatureVerified: true,
  };
}

function adminPaymentBookingDateWhere(range: string | null | undefined): Prisma.BookingWhereInput | undefined {
  const dateRange = adminPaymentDateRangeWhere(range);
  return dateRange ? { OR: [{ createdAt: dateRange }] } : undefined;
}

function adminPaymentCallbackAttemptDateWhere(
  range: string | null | undefined,
): Prisma.PaymentCallbackAttemptWhereInput | undefined {
  const dateRange = adminPaymentDateRangeWhere(range);
  return dateRange ? { createdAt: dateRange } : undefined;
}

function adminPaymentDateRangeWhere(range: string | null | undefined): Prisma.DateTimeFilter | undefined {
  const bounds = adminPaymentDateRangeBounds(range);
  if (!bounds) {
    return undefined;
  }

  return {
    gte: new Date(bounds.startMs),
    lte: new Date(bounds.endMs),
  };
}

function adminPaymentDateRangeBounds(range: string | null | undefined) {
  const nowMs = Date.now();
  const todayStartMs = startOfLocalDay(nowMs);
  const todayEndMs = endOfLocalDay(todayStartMs);

  switch (normalizeNullable(range) ?? 'today') {
    case '7d':
      return { startMs: addLocalDays(todayStartMs, -6), endMs: todayEndMs };
    case '30d':
      return { startMs: addLocalDays(todayStartMs, -29), endMs: todayEndMs };
    case 'all':
      return undefined;
    case 'today':
    default:
      return { startMs: todayStartMs, endMs: todayEndMs };
  }
}

function adminMergePaymentBookingWhere(
  existing: Prisma.BookingWhereInput | undefined,
  next: Prisma.BookingWhereInput,
): Prisma.BookingWhereInput {
  return existing ? { ...existing, ...next } : next;
}

function adminRefundOperationsWhere(
  options: AdminRefundOperationsQuery,
): Prisma.RefundWhereInput | undefined {
  const where = adminRefundReviewWhere(options.review) ?? {};
  const dateRange = adminPaymentDateRangeWhere(options.range);

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminRefundReviewWhere(review: string | null | undefined): Prisma.RefundWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'open':
      return { status: { not: 'COMPLETED' } };
    case 'requested':
      return { status: 'REQUESTED' };
    case 'needs-update':
      return { payment: { status: { not: PaymentStatus.REFUNDED } }, status: 'REQUESTED' };
    case 'refunded-booking':
      return { booking: { status: BookingStatus.REFUNDED } };
    case 'completed':
      return { status: 'COMPLETED' };
    default:
      return undefined;
  }
}

function adminBoundedPositiveInteger(
  value: number | string | null | undefined,
  defaultValue: number,
  maxValue: number,
) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(Math.trunc(parsed), maxValue);
}

function normalizeNotificationBoardTake(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_NOTIFICATION_BOARD_DEFAULT_LIMIT;
  }
  return Math.min(parsed, ADMIN_NOTIFICATION_BOARD_MAX_LIMIT);
}

function normalizeNotificationBoardSkip(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, 10000);
}

function notificationCountArgs(where?: Prisma.NotificationWhereInput): Prisma.NotificationCountArgs {
  return where ? { where } : {};
}

function notificationBoardAndWhere(
  baseWhere?: Prisma.NotificationWhereInput,
  extraWhere?: Prisma.NotificationWhereInput,
): Prisma.NotificationWhereInput | undefined {
  const filters = [baseWhere, extraWhere].filter(Boolean) as Prisma.NotificationWhereInput[];
  if (filters.length === 0) {
    return undefined;
  }
  if (filters.length === 1) {
    return filters[0];
  }
  return { AND: filters };
}

type NotificationBoardSummaryOptions = {
  readonly booking?: string;
  readonly from?: string;
  readonly review?: string;
  readonly to?: string;
};

type NotificationBoardQueryOptions = NotificationBoardSummaryOptions & {
  readonly skip?: string;
  readonly take?: string;
};

function notificationBoardWhere(options: NotificationBoardSummaryOptions): Prisma.NotificationWhereInput | undefined {
  const where: Prisma.NotificationWhereInput = {};
  const dateWhere = notificationBoardDateWhere(options);
  const filters: Prisma.NotificationWhereInput[] = [];
  const booking = normalizeNullable(options.booking);
  const reviewWhere = notificationBoardReviewWhere(options.review);

  if (dateWhere) {
    Object.assign(where, dateWhere);
  }
  if (booking) {
    filters.push({ data: { path: ['bookingId'], equals: booking } });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }
  if (filters.length > 0) {
    where.AND = filters;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function notificationBoardReviewWhere(value: string | undefined): Prisma.NotificationWhereInput | undefined {
  const review = normalizeNullable(value);
  switch (review) {
    case 'disabled-device':
      return { user: { pushDevices: { some: { enabled: false } } } };
    case 'failed':
      return notificationDeliveryStatusWhere('FAILED');
    case 'fcm':
      return notificationDeliveryProviderWhere('FCM');
    case 'in-app-route':
      return notificationDeliveryProviderWhere('IN_APP_ONLY');
    case 'needs-retry':
      return {
        OR: [
          notificationDeliveryStatusWhere('FAILED'),
          { user: { pushDevices: { some: { enabled: false } } } },
          notificationStaleDeliveryCandidateWhere(),
        ],
      };
    case 'no-show':
      return { type: 'booking.no_show' };
    case 'partner-alerts':
      return { type: { in: [...ADMIN_NOTIFICATION_PARTNER_ALERT_TYPES] } };
    case 'payout-setup':
      return { type: 'provider.payout_setup_required' };
    case 'pending':
      return { deliveries: { none: {} } };
    case 'sent':
      return notificationDeliveryStatusWhere('SENT');
    case 'skipped':
      return notificationDeliveryStatusWhere('SKIPPED');
    case 'stale-device':
      return notificationStaleDeliveryCandidateWhere();
    default:
      return undefined;
  }
}

function notificationDeliveryStatusWhere(status: string): Prisma.NotificationWhereInput {
  return { deliveries: { some: { status } } };
}

function notificationDeliveryProviderWhere(provider: string): Prisma.NotificationWhereInput {
  return { deliveries: { some: { provider } } };
}

function notificationStaleDeliveryCandidateWhere(): Prisma.NotificationWhereInput {
  return {
    deliveries: {
      some: {
        pushDevice: {
          enabled: true,
          lastSeenAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  };
}

function notificationBoardDateWhere(options: {
  readonly from?: string;
  readonly to?: string;
}): Prisma.NotificationWhereInput | undefined {
  const from = normalizeNotificationDateBoundary(options.from, 'from');
  const to = normalizeNotificationDateBoundary(options.to, 'to');
  if (!from && !to) {
    return undefined;
  }
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }

  return {
    createdAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function normalizeNotificationDateBoundary(value: string | undefined, field: string) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return undefined;
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException(`Notification ${field} date is invalid`);
  }
  return new Date(timestamp);
}

function normalizeAdminPushCampaignHistoryTake(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_PUSH_CAMPAIGN_HISTORY_DEFAULT_LIMIT;
  }
  return Math.min(parsed, ADMIN_PUSH_CAMPAIGN_HISTORY_MAX_LIMIT);
}

function normalizeAdminPushCampaignHistorySkip(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, 10000);
}

function adminPushCampaignHistoryDateWhere(options: {
  readonly from?: string;
  readonly to?: string;
}): Prisma.AdminPushCampaignWhereInput | undefined {
  const from = normalizeAdminPushCampaignDateBoundary(options.from, 'from');
  const to = normalizeAdminPushCampaignDateBoundary(options.to, 'to');
  if (!from && !to) {
    return undefined;
  }
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Push campaign date range is invalid');
  }

  return {
    createdAt: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function normalizeAdminPushCampaignDateBoundary(value: string | undefined, field: string) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return undefined;
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new BadRequestException(`Push campaign ${field} date is invalid`);
  }
  return new Date(timestamp);
}

function normalizeNotificationTemplateKey(value: string) {
  const key = normalizeNullable(value);
  if (!key || !/^[a-z0-9_.-]+$/i.test(key)) {
    throw new BadRequestException('Unsupported notification template key');
  }
  return key;
}

function normalizeNotificationTemplateLocale(value: string) {
  const locale = normalizeNullable(value);
  if (!locale || !isNotificationTemplateLocale(locale)) {
    throw new BadRequestException('Unsupported notification locale');
  }
  return locale;
}

function normalizeAdminPushTargetRole(value: Role) {
  if (value === Role.CUSTOMER || value === Role.PROVIDER) {
    return value;
  }
  throw new BadRequestException('Manual push target role must be CUSTOMER or PROVIDER');
}

function normalizeAdminPushTargetSegment(targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>, value?: string) {
  const segment = normalizeNullable(value) ?? ADMIN_PUSH_SEGMENT_ALL;
  const allowedSegments =
    targetRole === Role.PROVIDER ? ADMIN_PUSH_PROVIDER_SEGMENTS : ADMIN_PUSH_CUSTOMER_SEGMENTS;
  if (allowedSegments.has(segment)) {
    return segment;
  }
  throw new BadRequestException(`Unsupported manual push target segment for ${targetRole}`);
}

function normalizeAdminPushAppDestination(
  targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>,
  value?: string,
) {
  const destination = normalizeNullable(value) ?? ADMIN_PUSH_DEFAULT_DESTINATION;
  const allowedDestinations =
    targetRole === Role.PROVIDER ? ADMIN_PUSH_PROVIDER_DESTINATIONS : ADMIN_PUSH_CUSTOMER_DESTINATIONS;
  if (allowedDestinations.has(destination)) {
    return destination;
  }
  throw new BadRequestException(`Unsupported manual push app destination for ${targetRole}`);
}

function adminPushRecipientWhere(
  targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>,
  targetUserId?: string,
  targetSegment = ADMIN_PUSH_SEGMENT_ALL,
  now = new Date(),
): Prisma.UserWhereInput {
  const normalizedTargetUserId = normalizeNullable(targetUserId);
  const baseWhere: Prisma.UserWhereInput = {
    ...(normalizedTargetUserId ? { id: normalizedTargetUserId } : {}),
    roles: { has: targetRole },
    pushDevices: {
      some: {
        enabled: true,
        role: targetRole,
      },
    },
  };
  const segmentWhere = adminPushSegmentWhere(targetRole, targetSegment, now);
  return Object.keys(segmentWhere).length ? { AND: [baseWhere, segmentWhere] } : baseWhere;
}

function adminPushSegmentWhere(
  targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>,
  targetSegment: string,
  now: Date,
): Prisma.UserWhereInput {
  if (targetSegment === ADMIN_PUSH_SEGMENT_ALL) {
    return {};
  }

  if (targetRole === Role.CUSTOMER) {
    return adminPushCustomerSegmentWhere(targetSegment, now);
  }
  return adminPushProviderSegmentWhere(targetSegment, now);
}

function adminPushCustomerSegmentWhere(targetSegment: string, now: Date): Prisma.UserWhereInput {
  const since7Days = new Date(now.getTime() - ADMIN_PUSH_SEGMENT_WINDOWS.customerCompletedRecentMs);
  const since30Days = new Date(now.getTime() - ADMIN_PUSH_SEGMENT_WINDOWS.customerInactiveMs);
  const since3Days = new Date(now.getTime() - ADMIN_PUSH_SEGMENT_WINDOWS.customerActiveNoBookingMs);

  if (targetSegment === 'customer_completed_last_7_days') {
    return {
      customerProfile: {
        is: {
          bookings: { some: completedBookingWhere(since7Days) },
        },
      },
    };
  }

  if (targetSegment === 'customer_completed_inactive_30_days') {
    return {
      customerProfile: {
        is: {
          bookings: { some: completedBookingWhere() },
        },
      },
      appSessions: {
        none: {
          role: Role.CUSTOMER,
          lastSeenAt: { gte: since30Days },
        },
      },
    };
  }

  if (targetSegment === 'customer_never_booked') {
    return {
      customerProfile: {
        is: {
          bookings: { none: {} },
        },
      },
    };
  }

  if (targetSegment === 'customer_active_last_3_days_no_booking') {
    return {
      customerProfile: {
        is: {
          bookings: { none: {} },
        },
      },
      appSessions: {
        some: {
          role: Role.CUSTOMER,
          lastSeenAt: { gte: since3Days },
        },
      },
    };
  }

  if (targetSegment === 'customer_referral_parents') {
    return {
      customerProfile: {
        is: {
          referralsMade: { some: { audience: ReferralAudience.CUSTOMER } },
        },
      },
    };
  }

  throw new BadRequestException('Unsupported customer push segment');
}

function adminPushProviderSegmentWhere(targetSegment: string, now: Date): Prisma.UserWhereInput {
  const since7Days = new Date(now.getTime() - ADMIN_PUSH_SEGMENT_WINDOWS.providerInactiveMs);

  if (targetSegment === 'provider_completed_booking') {
    return {
      providerProfile: {
        is: {
          selectedBookings: { some: completedBookingWhere() },
        },
      },
    };
  }

  if (targetSegment === 'provider_referral_parents') {
    return {
      providerProfile: {
        is: {
          referralsMade: { some: { audience: ReferralAudience.PARTNER } },
        },
      },
    };
  }

  if (targetSegment === 'provider_inactive_last_7_days') {
    return {
      appSessions: {
        none: {
          role: Role.PROVIDER,
          lastSeenAt: { gte: since7Days },
        },
      },
    };
  }

  throw new BadRequestException('Unsupported partner push segment');
}

function completedBookingWhere(since?: Date): Prisma.BookingWhereInput {
  if (!since) {
    return { status: BookingStatus.COMPLETED };
  }
  return {
    status: BookingStatus.COMPLETED,
    OR: [
      { closedAt: { gte: since } },
      {
        closedAt: null,
        updatedAt: { gte: since },
      },
    ],
  };
}

async function ensureServiceDurationIsUnique(
  tx: Prisma.TransactionClient,
  input: { serviceGroupKey: string; durationMin: number; excludeServiceId?: string },
) {
  const existing = await tx.massageService.findFirst({
    where: {
      serviceGroupKey: input.serviceGroupKey,
      durationMin: input.durationMin,
      ...(input.excludeServiceId ? { id: { not: input.excludeServiceId } } : {}),
    },
    select: { id: true, name: true, durationMin: true },
  });

  if (existing) {
    throw new BadRequestException(
      `Service duration already exists for ${input.serviceGroupKey}: ${existing.durationMin} min`,
    );
  }
}
