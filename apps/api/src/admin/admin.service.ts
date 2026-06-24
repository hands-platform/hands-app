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
  PaymentStatus,
  Prisma,
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
import { notificationRetryAuditMetadata } from '../notifications/notification-retry-audit';
import { PrismaService } from '../prisma/prisma.service';
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
import { adminBookingListSelect, adminCustomerBookingListSelect } from './admin-booking-selects';
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
  adminNotificationListSelect,
  adminPushDeviceSummarySelect,
  adminUserAuthSelect,
  adminUserListSelect,
  adminUserSummarySelect,
} from './admin-user-selects';
import {
  VIETNAM_REGION_BUCKETS,
  adminVietnamOverviewDateWhere,
  adminVietnamOverviewRangeWindow,
  normalizeAdminVietnamOverviewRange,
  vietnamRegionCodeFromValues,
} from './admin-vietnam-region-overview';
import {
  adminUsageDateWhere,
  adminUsageRangeWindow,
  buildAdminUsageRegionRows,
  normalizeAdminUsageRange,
} from './admin-usage-overview';

const ADMIN_APP_SESSION_LIST_LIMIT = 500;
const ADMIN_BOOKING_LIST_LIMIT = 100;
const ADMIN_CHAT_ARCHIVE_LIST_LIMIT = 200;
const ADMIN_CUSTOMER_LIST_LIMIT = 500;
const ADMIN_CUSTOMER_LIST_BOOKING_LIMIT = 25;
const ADMIN_CUSTOMER_LIST_LOCATION_LIMIT = 5;
const ADMIN_CUSTOMER_LIST_SESSION_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_PUSH_DEVICE_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT = 3;
const ADMIN_REFERRAL_PARENT_LIST_LIMIT = 100;
const ADMIN_REFERRAL_ATTRIBUTION_LIST_LIMIT = 50;
const ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT = 500;
const ADMIN_USAGE_OVERVIEW_RANK_LIMIT = 10;
const ADMIN_USAGE_OVERVIEW_REGION_LIMIT = 500;
const ADMIN_VIETNAM_ACTIVE_CUSTOMER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_VIETNAM_ONLINE_PARTNER_WINDOW_MS = 90 * 60 * 1000;
const ADMIN_BOOKING_DETAIL_NOTIFICATION_LIMIT = 100;
const ADMIN_BOOKING_MARKETPLACE_PROVIDER_LIMIT = 120;
const ADMIN_BOOKING_MARKETPLACE_PROVIDER_RADIUS_METERS = 50_000;
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

type AdminReferralRewardSummary = Prisma.ReferralRewardGetPayload<{ select: typeof adminReferralRewardSelect }>;

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
  bookingCount: number;
  completedBookingCount: number;
  lastBookingAt: Date | null;
  lastCompletedBookingAt: Date | null;
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
      select: adminUserListSelect,
    });
  }

  async listCustomers() {
    const customers = await this.prisma.customerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_CUSTOMER_LIST_LIMIT,
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

  listAppSessions() {
    return this.prisma.appSession.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: ADMIN_APP_SESSION_LIST_LIMIT,
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
      rewardMode === ReferralRewardMode.COMMISSION_PERCENT ? input.commissionPercentBps ?? 0 : null;
    const fixedRewardAmount =
      rewardMode === ReferralRewardMode.FIXED_AMOUNT ? input.fixedRewardAmount ?? 0 : null;

    if (enabled && rewardMode === ReferralRewardMode.COMMISSION_PERCENT && Number(commissionPercentBps) <= 0) {
      throw new BadRequestException('Customer referral commission percent must be greater than zero when enabled');
    }
    if (enabled && rewardMode === ReferralRewardMode.FIXED_AMOUNT && Number(fixedRewardAmount) <= 0) {
      throw new BadRequestException('Partner referral fixed reward amount must be greater than zero when enabled');
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
    const window = adminVietnamOverviewRangeWindow(
      normalizeAdminVietnamOverviewRange(rangeInput),
      now,
    );
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
          [
            selectedLocation?.addressText,
            customer.addresses,
            customer.user.appSessions[0]?.lastLoginAddress,
          ],
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
        vietnamRegionCodeFromValues(
          [
            provider.city,
            provider.residentialAddress,
            provider.serviceArea,
          ],
          {
            latitude: provider.currentLat,
            longitude: provider.currentLng,
          },
        ),
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
          [
            booking.addressSnapshot?.addressText,
            booking.address,
            booking.addressSnapshot?.address,
          ],
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
        vietnamRegionCodeFromValues(
          [activeBookingAddressText],
          {
            latitude: activeBookingLatitude,
            longitude: activeBookingLongitude,
          },
        ),
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
          regionValues: [booking.addressSnapshot?.addressText, booking.addressSnapshot?.address, booking.address],
          coordinates: {
            latitude: booking.addressSnapshot?.latitude ?? booking.lat,
            longitude: booking.addressSnapshot?.longitude ?? booking.lng,
          },
          bookingRequestCount: 1,
        })),
        ...regionCompletedBookingRows.map((booking) => ({
          regionValues: [booking.addressSnapshot?.addressText, booking.addressSnapshot?.address, booking.address],
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

  async listPartnerDirectoryProviders() {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT,
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
      take: 250,
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

  async listBookings() {
    const bookings = await this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: ADMIN_BOOKING_LIST_LIMIT,
      select: adminBookingListSelect,
    });
    return withAdminBookingListMetadataList(withAdminBookingMatchingEvidenceList(bookings));
  }

  listChatArchive() {
    return this.prisma.booking.findMany({
      where: {
        chatRoom: { isNot: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: ADMIN_CHAT_ARCHIVE_LIST_LIMIT,
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
      ? adminBookingMarketplaceBounds(
          pin.lat,
          pin.lng,
          ADMIN_BOOKING_MARKETPLACE_PROVIDER_RADIUS_METERS,
        )
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

  listPayments() {
    return this.prisma.payment.findMany({
      orderBy: { id: 'desc' },
      take: 100,
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

  listPaymentCallbackAttempts() {
    return this.prisma.paymentCallbackAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminPaymentCallbackAttemptListSelect,
    });
  }

  listRefunds() {
    return this.prisma.refund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminRefundListSelect,
    });
  }

  listEarnings() {
    return this.earnings.listForAdmin();
  }

  listCashSettlementEarnings() {
    return this.earnings.listCashSettlementDebtForAdmin();
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

  listPayoutBatches() {
    return this.earnings.listPayoutBatchesForAdmin();
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

  listReviews() {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
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

  listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      take: 100,
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

  listAuditLogs() {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminAuditLogSelect,
    });
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

  listNotifications() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminNotificationListSelect,
    });
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
    const [bookingRows, completedRows] = await Promise.all([
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
    bookingCount: 0,
    completedBookingCount: 0,
    lastBookingAt: null,
    lastCompletedBookingAt: null,
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

function ensureVietnamOverviewRegion(
  regions: Map<string, AdminVietnamOverviewRegion>,
  regionCode: string,
) {
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
  const occurredAt = input.occurredAt instanceof Date
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
  return uniqueReferralRewardIds(rows.flatMap((row) => row.referralsMade.flatMap((referral) => referral.rewards)));
}

function adminPartnerReferralRewardIds(rows: readonly AdminPartnerReferralParent[]) {
  return uniqueReferralRewardIds(rows.flatMap((row) => row.referralsMade.flatMap((referral) => referral.rewards)));
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

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
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
  addressSnapshot?: { latitude: Prisma.Decimal | number | string; longitude: Prisma.Decimal | number | string } | null;
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
