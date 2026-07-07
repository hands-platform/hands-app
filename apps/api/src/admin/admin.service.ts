import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  AccountingJournalBatchStatus,
  AccountingJournalSourceType,
  AdminOperatorPermissionCategory,
  BankReconciliationStatus,
  BookingPaymentClearingStatus,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
  BookingStatus,
  EarningStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  MonthlyTaxClosingStatus,
  PayoutBatchStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  CustomerWalletLedgerType,
  ProviderBankAccountStatus,
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
  ProviderTaxProfileStatus,
  ProviderWalletLedgerType,
  ReviewStatus,
  ReferralAttributionStatus,
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
import {
  buildManualWalletAdjustmentPreview,
  type ManualWalletAdjustmentDirection,
  type ManualWalletAdjustmentInput,
  type ManualWalletAdjustmentOwnerType,
  type ManualWalletAdjustmentPreview,
  type ManualWalletAdjustmentType,
} from '../wallet-adjustments/wallet-adjustments.accounting';
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
import {
  adminCustomerDetailSelect,
  adminCustomerDetailWithoutDiagnosticsSelect,
} from './admin-customer-selects';
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
  adminProviderDetailWithoutDiagnosticsSelect,
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
  adminFinanceApproverDirectoryUserSelect,
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
  AdminMarketingDimensionRow,
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
import type {
  AdminCalendarActorDto,
  AdminPushCampaignDto,
  CreateAdminCalendarEventDto,
  CreateAdminOperatorDto,
  CreateBankReconciliationMatchDto,
  CreateCompanyBankTransactionDto,
  CreateManualWalletAdjustmentDto,
  DeleteAdminOperatorAccessDto,
  PreviewManualWalletAdjustmentDto,
  RecordPartnerBankDepositDto,
  ReverseBankReconciliationMatchDto,
  UpdateAdminCalendarEventDto,
  UpdateAdminOperatorAccessDto,
  UpdateFinanceApproverRoleDto,
  UpdateNotificationTemplateDto,
} from './admin.dto';

const ADMIN_APP_SESSION_LIST_LIMIT = 50;
const ADMIN_APP_SESSION_LIVE_WINDOW_MS = 5 * 60_000;
const ADMIN_APP_SESSION_RECENT_WINDOW_MS = 30 * 60_000;
const ADMIN_APP_SESSION_STALE_WINDOW_MS = 24 * 60 * 60_000;
const ADMIN_BOOKING_LIST_LIMIT = 50;
const ADMIN_CALENDAR_EVENT_LIST_LIMIT = 200;
const ADMIN_CHAT_ARCHIVE_LIST_LIMIT = 50;
const ADMIN_CHAT_ARCHIVE_MESSAGE_PREVIEW_LIMIT = 25;
const ADMIN_USER_LIST_LIMIT = 50;
const ADMIN_OPERATOR_ROLES = [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] as const;
const ADMIN_OPERATOR_PASSWORD_HASH_BYTES = 64;
const ADMIN_OPERATOR_PASSWORD_SALT_BYTES = 16;
const ADMIN_OPERATOR_PASSWORD_MIN_LENGTH = 8;
const ADMIN_OPERATOR_PERMISSION_CATEGORIES = [
  AdminOperatorPermissionCategory.BOOKINGS,
  AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
  AdminOperatorPermissionCategory.BOOKINGS_IN_PROGRESS,
  AdminOperatorPermissionCategory.BOOKINGS_COMPLETED,
  AdminOperatorPermissionCategory.BOOKINGS_CANCELLATIONS,
  AdminOperatorPermissionCategory.BOOKINGS_DETAIL,
  AdminOperatorPermissionCategory.CUSTOMERS,
  AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY,
  AdminOperatorPermissionCategory.CUSTOMERS_DETAIL,
  AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS,
  AdminOperatorPermissionCategory.PARTNERS,
  AdminOperatorPermissionCategory.PARTNERS_DIRECTORY,
  AdminOperatorPermissionCategory.PARTNERS_UNAPPROVED,
  AdminOperatorPermissionCategory.PARTNERS_DETAIL,
  AdminOperatorPermissionCategory.PARTNERS_KYC,
  AdminOperatorPermissionCategory.FINANCE,
  AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
  AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER,
  AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
  AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
  AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
  AdminOperatorPermissionCategory.FINANCE_TAX,
  AdminOperatorPermissionCategory.NOTIFICATIONS,
  AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES,
  AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH,
  AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY,
  AdminOperatorPermissionCategory.SYSTEM,
  AdminOperatorPermissionCategory.SYSTEM_SERVICES,
  AdminOperatorPermissionCategory.SYSTEM_COUPONS,
  AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
  AdminOperatorPermissionCategory.SYSTEM_POLICY,
  AdminOperatorPermissionCategory.SYSTEM_AUDIT,
  AdminOperatorPermissionCategory.SYSTEM_SETUP,
] as const;
const ADMIN_CUSTOMER_DIRECTORY_DEFAULT_LIMIT = 25;
const ADMIN_CUSTOMER_DIRECTORY_MAX_LIMIT = 100;
const ADMIN_CUSTOMER_LIST_BOOKING_LIMIT = 10;
const ADMIN_CUSTOMER_LIST_LOCATION_LIMIT = 5;
const ADMIN_CUSTOMER_LIST_SESSION_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_PUSH_DEVICE_LIMIT = 3;
const ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT = 3;
const ADMIN_PARTNER_CONTROL_LOCATION_FRESHNESS_MINUTES = 90;
const ADMIN_PROVIDER_REPORT_LIST_LIMIT = 50;
const ADMIN_REFERRAL_PARENT_LIST_DEFAULT_LIMIT = 10;
const ADMIN_REFERRAL_PARENT_LIST_MAX_LIMIT = 50;
const ADMIN_REFERRAL_CASHOUT_LIST_DEFAULT_LIMIT = 10;
const ADMIN_REFERRAL_CASHOUT_LIST_MAX_LIMIT = 50;
const ADMIN_REFERRAL_ATTRIBUTION_LIST_LIMIT = 50;
const ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT = 50;
const ADMIN_VIETNAM_REALTIME_POINT_LIST_LIMIT = 20;
const ADMIN_VIETNAM_REALTIME_POINT_MAX_LIMIT = 50;
const ADMIN_VIETNAM_STALE_PARTNER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_USAGE_OVERVIEW_RANK_LIMIT = 10;
const ADMIN_USAGE_OVERVIEW_REGION_LIMIT = 100;
const ADMIN_PARTNER_OVERVIEW_PARTNER_SCAN_LIMIT = 500;
const ADMIN_PARTNER_OVERVIEW_BOOKING_SCAN_LIMIT = 150;
const ADMIN_PARTNER_OVERVIEW_SERVICE_LIMIT = 80;
const ADMIN_PARTNER_OVERVIEW_RANK_LIMIT = 10;
const ADMIN_MARKETING_REGION_LIMIT = 100;
const ADMIN_MARKETING_CAMPAIGN_LIMIT = 50;
const ADMIN_MARKETING_DIMENSION_PAGE_LIMIT = 10;
const ADMIN_MARKETING_DIMENSION_PAGE_MAX_LIMIT = 20;
const ADMIN_MARKETING_DIMENSIONS = ['source', 'platform', 'region', 'campaign'] as const;
const ADMIN_MARKETING_DATA_GAPS = [
  'Attribution is currently derived from stored referrals and app sessions; non-referral paid campaign attribution falls back to unknown.',
  'Manual ad spend rows are supported; paid campaign install attribution still needs mobile/deep-link capture before source-level conversion is exact.',
  'No live ad-network API, MMP, exact customer location, phone number, or ad identifier is returned by this endpoint.',
] as const;

type AdminMarketingDimensionKey = (typeof ADMIN_MARKETING_DIMENSIONS)[number];
const ADMIN_VIETNAM_ACTIVE_CUSTOMER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_BOOKING_DETAIL_NOTIFICATION_LIMIT = 25;
const ADMIN_NOTIFICATION_BOARD_DEFAULT_LIMIT = 20;
const ADMIN_NOTIFICATION_BOARD_MAX_LIMIT = 20;
const ADMIN_NOTIFICATION_TEMPLATE_LIST_LIMIT = 50;
const ADMIN_NOTIFICATION_PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const;
const ADMIN_PARTNER_OVERVIEW_REQUEST_NOTIFICATION_TYPES = [
  'booking.requested',
  'booking.backup_available',
] as const;
const ADMIN_PARTNER_OVERVIEW_SERVICE_STARTED_NOTIFICATION_TYPE = 'service.started';
const ADMIN_PARTNER_OVERVIEW_REQUEST_LIST_VIEWED_EVENT = 'OPEN_REQUEST_LIST_VIEWED';
const ADMIN_PARTNER_OVERVIEW_REQUEST_DETAIL_VIEWED_EVENT = 'OPEN_REQUEST_DETAIL_VIEWED';
const ADMIN_PARTNER_OVERVIEW_REQUEST_DETAIL_DURATION_EVENTS = [
  'OPEN_REQUEST_DETAIL_HEARTBEAT',
  'OPEN_REQUEST_DETAIL_CLOSED',
] as const;
const ADMIN_PARTNER_OVERVIEW_DETAIL_DURATION_EVENT_SCAN_LIMIT = 2000;
const ADMIN_PARTNER_OVERVIEW_RESPONSE_EVENT_SCAN_LIMIT = 2000;
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
const ADMIN_AUDIT_LOG_LIST_LIMIT = 50;
const ADMIN_PAYMENT_OPERATIONS_DEFAULT_LIMIT = 50;
const ADMIN_PAYMENT_OPERATIONS_MAX_LIMIT = 100;
const ADMIN_PAYMENT_CALLBACK_ATTEMPT_DEFAULT_LIMIT = 50;
const ADMIN_PAYMENT_CALLBACK_ATTEMPT_MAX_LIMIT = 100;
const ADMIN_REFUND_OPERATIONS_DEFAULT_LIMIT = 50;
const ADMIN_REFUND_OPERATIONS_MAX_LIMIT = 100;
const ADMIN_REVIEW_BOARD_DEFAULT_LIMIT = 25;
const ADMIN_REVIEW_BOARD_MAX_LIMIT = 100;
const ADMIN_COUPON_LIST_DEFAULT_LIMIT = 10;
const ADMIN_COUPON_LIST_MAX_LIMIT = 50;
const ADMIN_COUPON_USAGE_LIST_LIMIT = 20;
const ADMIN_MANUAL_WALLET_ADJUSTMENT_DEFAULT_LIMIT = 25;
const ADMIN_MANUAL_WALLET_ADJUSTMENT_MAX_LIMIT = 100;

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
  readonly skip?: number | string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminReferralParentListQuery = {
  readonly q?: string | null;
  readonly reward?: string | null;
  readonly skip?: number | string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminReferralCashoutQueueQuery = {
  readonly audience?: string | null;
  readonly q?: string | null;
  readonly skip?: number | string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminBookingDetailPreviewQuery = {
  readonly take?: number | string | null;
};
type AdminPaymentOperationsQuery = {
  readonly q?: string | null;
  readonly providerProfileId?: string | null;
  readonly queue?: string | null;
  readonly range?: string | null;
  readonly review?: string | null;
  readonly skip?: number | string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminManualWalletAdjustmentQuery = {
  readonly ownerId?: string | null;
  readonly ownerType?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};
type AdminPartnerWithholdingTaxQuery = {
  readonly period?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};
type AdminMonthlyTaxClosingQuery = {
  readonly period?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};
type AdminMonthlyTaxClosingStatusInput = {
  readonly status?: MonthlyTaxClosingStatus | string | null;
  readonly approvalAdminId?: string | null;
  readonly notes?: string | null;
  readonly paidAt?: string | null;
  readonly remittanceChannel?: string | null;
  readonly remittanceEvidenceUrl?: string | null;
  readonly remittanceTransferRef?: string | null;
};
type AdminPaymentCallbackAttemptQuery = AdminPaymentOperationsQuery;
type AdminRefundOperationsQuery = AdminPaymentOperationsQuery;
type AdminFinanceOverviewQuery = {
  readonly period?: string | null;
  readonly range?: string | null;
};
const adminMonthlyTaxClosingListSelect = {
  id: true,
  period: true,
  currency: true,
  status: true,
  platformFeeGrossTotal: true,
  platformFeeNetRevenueTotal: true,
  companyOutputVatTotal: true,
  partnerVatWithheldTotal: true,
  partnerPitWithheldTotal: true,
  partnerWithholdingTotal: true,
  paymentProcessingFeeTotal: true,
  cashDebtTotal: true,
  nonCashPartnerPayoutTotal: true,
  settlementCount: true,
  declaredAt: true,
  paidAt: true,
  closedAt: true,
  notes: true,
  remittanceMetadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MonthlyTaxClosingSelect;
const adminBookingSettlementSnapshotListSelect = {
  id: true,
  bookingId: true,
  customerProfileId: true,
  providerProfileId: true,
  paymentId: true,
  providerEarningId: true,
  paymentMethod: true,
  currency: true,
  customerPaymentAmount: true,
  partnerPayoutAmount: true,
  partnerTaxableRevenue: true,
  partnerVatAmount: true,
  partnerPitAmount: true,
  partnerWithholdingTotal: true,
  platformFeeGross: true,
  platformFeeNetRevenue: true,
  companyOutputVat: true,
  paymentProcessingFee: true,
  settlementStatus: true,
  taxStatus: true,
  monthlyPeriod: true,
  postedAt: true,
  closedAt: true,
  booking: {
    select: {
      id: true,
      status: true,
      closedAt: true,
    },
  },
  customerProfile: {
    select: {
      id: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
} satisfies Prisma.BookingSettlementSnapshotSelect;
const adminBookingSettlementSnapshotDetailSelect = {
  ...adminBookingSettlementSnapshotListSelect,
  metadata: true,
  paymentFeeFixedAmount: true,
  paymentFeePayer: true,
  paymentFeePolicyVersionId: true,
  paymentFeeRateBps: true,
  paymentFeeRuleSnapshot: true,
  paymentFeeTreatment: true,
  accountingJournalBatches: {
    orderBy: { postedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      sourceKey: true,
      sourceType: true,
      status: true,
      totalDebit: true,
      totalCredit: true,
      postedAt: true,
    },
  },
  paymentClearingEntries: {
    orderBy: { occurredAt: 'desc' },
    take: 3,
    select: {
      id: true,
      sourceKey: true,
      status: true,
      type: true,
      amount: true,
      currency: true,
      occurredAt: true,
    },
  },
  reversalEntries: {
    orderBy: { occurredAt: 'desc' },
    take: 3,
    select: {
      id: true,
      sourceKey: true,
      settlementStatus: true,
      taxStatus: true,
      occurredAt: true,
      reason: true,
      accountingJournalBatches: {
        orderBy: { postedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          sourceKey: true,
          status: true,
          postedAt: true,
        },
      },
      paymentClearingEntries: {
        orderBy: { occurredAt: 'desc' },
        take: 1,
        select: {
          id: true,
          sourceKey: true,
          status: true,
          type: true,
          amount: true,
          currency: true,
          occurredAt: true,
        },
      },
    },
  },
} satisfies Prisma.BookingSettlementSnapshotSelect;
const adminCouponFinanceSnapshotListSelect = {
  ...adminBookingSettlementSnapshotListSelect,
  metadata: true,
} satisfies Prisma.BookingSettlementSnapshotSelect;
const adminBookingSettlementReversalEntryListSelect = {
  id: true,
  sourceKey: true,
  originalSettlementSnapshotId: true,
  bookingId: true,
  customerProfileId: true,
  providerProfileId: true,
  paymentId: true,
  providerEarningId: true,
  paymentMethod: true,
  currency: true,
  customerPaymentAmount: true,
  partnerPayoutAmount: true,
  partnerTaxableRevenue: true,
  partnerVatAmount: true,
  partnerPitAmount: true,
  partnerWithholdingTotal: true,
  platformFeeGross: true,
  platformFeeNetRevenue: true,
  companyOutputVat: true,
  paymentProcessingFee: true,
  settlementStatus: true,
  taxStatus: true,
  monthlyPeriod: true,
  originalMonthlyPeriod: true,
  originalMonthlyClosingId: true,
  occurredAt: true,
  reason: true,
  accountingJournalBatches: {
    orderBy: { postedAt: 'desc' },
    take: 1,
    select: {
      id: true,
      sourceKey: true,
      status: true,
      totalCredit: true,
      totalDebit: true,
      postedAt: true,
    },
  },
  paymentClearingEntries: {
    orderBy: { occurredAt: 'desc' },
    take: 1,
    select: {
      id: true,
      sourceKey: true,
      status: true,
      type: true,
      amount: true,
      currency: true,
      occurredAt: true,
    },
  },
  originalSettlementSnapshot: {
    select: {
      id: true,
      customerProfile: {
        select: {
          id: true,
          user: { select: { fullName: true, phone: true } },
        },
      },
      providerProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { fullName: true, phone: true } },
        },
      },
    },
  },
} satisfies Prisma.BookingSettlementReversalEntrySelect;
const adminBookingSettlementReversalEntryDetailSelect = {
  ...adminBookingSettlementReversalEntryListSelect,
  accountingJournalBatches: {
    orderBy: { postedAt: 'desc' },
    take: 1,
    select: {
      id: true,
      metadata: true,
      postedAt: true,
      sourceKey: true,
      status: true,
      totalCredit: true,
      totalDebit: true,
    },
  },
  paymentClearingEntries: {
    orderBy: { occurredAt: 'desc' },
    take: 1,
    select: {
      id: true,
      sourceKey: true,
      status: true,
      type: true,
      amount: true,
      currency: true,
      occurredAt: true,
      bankReconciliationMatches: {
        orderBy: { matchedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          sourceKey: true,
          bankTransactionId: true,
          amount: true,
          currency: true,
          status: true,
          matchedAt: true,
          bankTransaction: {
            select: {
              id: true,
              sourceKey: true,
              type: true,
              amount: true,
              currency: true,
              occurredAt: true,
              transferRef: true,
              counterpartyName: true,
              status: true,
            },
          },
        },
      },
    },
  },
  originalSettlementSnapshot: {
    select: {
      id: true,
      monthlyPeriod: true,
      postedAt: true,
      settlementStatus: true,
      taxStatus: true,
      booking: { select: { id: true, status: true, createdAt: true, closedAt: true } },
      customerProfile: {
        select: {
          id: true,
          user: { select: { id: true, fullName: true, phone: true } },
        },
      },
      providerProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
  },
} satisfies Prisma.BookingSettlementReversalEntrySelect;
const adminAccountingJournalBatchListSelect = {
  id: true,
  sourceKey: true,
  sourceType: true,
  sourceId: true,
  bookingId: true,
  customerProfileId: true,
  providerProfileId: true,
  paymentId: true,
  settlementSnapshotId: true,
  settlementReversalEntryId: true,
  monthlyPeriod: true,
  currency: true,
  status: true,
  totalDebit: true,
  totalCredit: true,
  postedAt: true,
  reversedAt: true,
  _count: { select: { entries: true } },
  booking: { select: { status: true } },
  customerProfile: {
    select: {
      user: { select: { fullName: true, phone: true } },
    },
  },
  providerProfile: {
    select: {
      displayName: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
} satisfies Prisma.AccountingJournalBatchSelect;
const adminAccountingJournalBatchDetailSelect = {
  ...adminAccountingJournalBatchListSelect,
  metadata: true,
  payment: { select: { id: true, method: true, status: true, amount: true, currency: true } },
  settlementSnapshot: {
    select: {
      id: true,
      currency: true,
      paymentMethod: true,
      customerPaymentAmount: true,
      partnerPayoutAmount: true,
      platformFeeNetRevenue: true,
      companyOutputVat: true,
      partnerWithholdingTotal: true,
      paymentFeeFixedAmount: true,
      paymentFeePayer: true,
      paymentFeePolicyVersionId: true,
      paymentFeeRateBps: true,
      paymentFeeRuleSnapshot: true,
      paymentFeeTreatment: true,
      paymentProcessingFee: true,
      settlementStatus: true,
      taxStatus: true,
      monthlyPeriod: true,
      postedAt: true,
      closedAt: true,
    },
  },
  settlementReversalEntry: {
    select: {
      id: true,
      currency: true,
      paymentMethod: true,
      customerPaymentAmount: true,
      partnerPayoutAmount: true,
      platformFeeNetRevenue: true,
      companyOutputVat: true,
      partnerWithholdingTotal: true,
      paymentProcessingFee: true,
      settlementStatus: true,
      taxStatus: true,
      monthlyPeriod: true,
      occurredAt: true,
      reason: true,
    },
  },
  entries: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      side: true,
      accountCode: true,
      accountName: true,
      amount: true,
      currency: true,
      memo: true,
      sourceType: true,
      sourceId: true,
      metadata: true,
      createdAt: true,
      bankReconciliationMatches: {
        select: {
          id: true,
          sourceKey: true,
          bankTransactionId: true,
          paymentClearingEntryId: true,
          amount: true,
          currency: true,
          status: true,
          matchedAt: true,
        },
      },
    },
  },
} satisfies Prisma.AccountingJournalBatchSelect;
const adminBookingPaymentClearingEntryListSelect = {
  id: true,
  sourceKey: true,
  type: true,
  status: true,
  bookingId: true,
  paymentId: true,
  settlementSnapshotId: true,
  settlementReversalEntryId: true,
  amount: true,
  currency: true,
  occurredAt: true,
  clearedAt: true,
  booking: { select: { status: true } },
  payment: { select: { method: true, status: true, amount: true, currency: true } },
  _count: { select: { bankReconciliationMatches: true } },
} satisfies Prisma.BookingPaymentClearingEntrySelect;
const adminBookingPaymentClearingEntryDetailSelect = {
  ...adminBookingPaymentClearingEntryListSelect,
  settlementSnapshot: {
    select: {
      id: true,
      currency: true,
      paymentMethod: true,
      customerPaymentAmount: true,
      partnerPayoutAmount: true,
      platformFeeNetRevenue: true,
      companyOutputVat: true,
      partnerWithholdingTotal: true,
      paymentFeeFixedAmount: true,
      paymentFeePayer: true,
      paymentFeePolicyVersionId: true,
      paymentFeeRateBps: true,
      paymentFeeRuleSnapshot: true,
      paymentFeeTreatment: true,
      paymentProcessingFee: true,
      settlementStatus: true,
      taxStatus: true,
      monthlyPeriod: true,
      postedAt: true,
      closedAt: true,
    },
  },
  settlementReversalEntry: {
    select: {
      id: true,
      paymentMethod: true,
      customerPaymentAmount: true,
      partnerPayoutAmount: true,
      platformFeeNetRevenue: true,
      companyOutputVat: true,
      partnerWithholdingTotal: true,
      paymentProcessingFee: true,
      settlementStatus: true,
      taxStatus: true,
      monthlyPeriod: true,
      occurredAt: true,
      reason: true,
    },
  },
  bankReconciliationMatches: {
    orderBy: { matchedAt: 'desc' },
    select: {
      id: true,
      sourceKey: true,
      accountingJournalEntryId: true,
      bankTransactionId: true,
      amount: true,
      currency: true,
      status: true,
      matchedAt: true,
      notes: true,
      accountingJournalEntry: {
        select: {
          id: true,
          batchId: true,
          accountCode: true,
          accountName: true,
        },
      },
      bankTransaction: {
        select: {
          id: true,
          sourceKey: true,
          type: true,
          amount: true,
          currency: true,
          occurredAt: true,
          valueDate: true,
          transferRef: true,
          counterpartyName: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.BookingPaymentClearingEntrySelect;
const adminCompanyBankAccountSelect = {
  id: true,
  name: true,
  bankName: true,
  accountNumberMasked: true,
  accountNumberLast4: true,
  currency: true,
  status: true,
} satisfies Prisma.CompanyBankAccountSelect;
const adminCompanyBankTransactionListSelect = {
  id: true,
  sourceKey: true,
  bankAccountId: true,
  type: true,
  amount: true,
  currency: true,
  occurredAt: true,
  valueDate: true,
  transferRef: true,
  counterpartyName: true,
  description: true,
  status: true,
  _count: { select: { reconciliationMatches: true } },
  bankAccount: {
    select: adminCompanyBankAccountSelect,
  },
} satisfies Prisma.CompanyBankTransactionSelect;
const adminCompanyBankTransactionDetailSelect = {
  ...adminCompanyBankTransactionListSelect,
  reconciliationMatches: {
    orderBy: { matchedAt: 'desc' },
    select: {
      id: true,
      sourceKey: true,
      accountingJournalEntryId: true,
      paymentClearingEntryId: true,
      withdrawalRequestId: true,
      payoutBatchId: true,
      amount: true,
      currency: true,
      status: true,
      matchedAt: true,
      notes: true,
      metadata: true,
      accountingJournalEntry: {
        select: {
          id: true,
          batchId: true,
          side: true,
          accountCode: true,
          accountName: true,
          amount: true,
          currency: true,
          memo: true,
          sourceType: true,
          sourceId: true,
        },
      },
      paymentClearingEntry: {
        select: {
          id: true,
          sourceKey: true,
          type: true,
          status: true,
          bookingId: true,
          amount: true,
          currency: true,
          occurredAt: true,
          clearedAt: true,
        },
      },
      withdrawalRequest: {
        select: {
          id: true,
          providerProfileId: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          transferRef: true,
        },
      },
      payoutBatch: {
        select: {
          id: true,
          status: true,
          totalNetAmount: true,
          currency: true,
          createdAt: true,
          paidAt: true,
          transferRef: true,
        },
      },
    },
  },
} satisfies Prisma.CompanyBankTransactionSelect;
const ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CREATED,
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
]);
const ADMIN_PROVIDER_CHAT_REQUIRED_BOOKING_STATUSES = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
  BookingStatus.COMPLETED,
] as const;
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
  actor: { select: { id: true, email: true, phone: true, fullName: true } },
} satisfies Prisma.AdminAuditLogSelect;

const adminOperatorAccessSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  roles: true,
  adminOperatorPermission: {
    select: {
      categories: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

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
  calculationSnapshot: true,
  currency: true,
  status: true,
  qualifyingBookingId: true,
  walletLedgerReference: true,
  availableAt: true,
  createdAt: true,
} satisfies Prisma.ReferralRewardSelect;

const adminReferralCashoutRewardSelect = {
  ...adminReferralRewardSelect,
  attribution: {
    select: {
      id: true,
      audience: true,
      status: true,
      fraudReviewStatus: true,
      installSource: true,
      platform: true,
      createdAt: true,
      referrerCustomerProfile: {
        select: { id: true, user: { select: adminUserSummarySelect } },
      },
      referrerProviderProfile: {
        select: {
          id: true,
          displayName: true,
          level: true,
          status: true,
          user: { select: adminUserSummarySelect },
          bankAccounts: {
            orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
            take: 3,
            select: {
              id: true,
              bankName: true,
              accountHolderName: true,
              accountNumberMasked: true,
              accountNumberLast4: true,
              status: true,
              isPrimary: true,
              reviewedAt: true,
              rejectionReason: true,
              updatedAt: true,
            },
          },
        },
      },
      referredCustomerProfile: {
        select: { id: true, user: { select: adminUserSummarySelect } },
      },
      referredProviderProfile: {
        select: {
          id: true,
          displayName: true,
          level: true,
          status: true,
          user: { select: adminUserSummarySelect },
        },
      },
    },
  },
} satisfies Prisma.ReferralRewardSelect;

const REFERRAL_REWARD_DECISION_ACTIONS = [
  'referral_reward.hold',
  'referral_reward.credit',
  'referral_reward.reverse',
  'referral_reward.cashout_approve',
  'referral_reward.tax_review_required',
  'referral_reward.cashout_paid',
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
type AdminOperatorAccessSummary = Prisma.UserGetPayload<{ select: typeof adminOperatorAccessSelect }>;
const ADMIN_BOOKING_DETAIL_AUDIT_LOG_LIMIT = 40;
const ADMIN_CUSTOMER_DETAIL_AUDIT_LOG_LIMIT = 10;
const ADMIN_PROVIDER_DETAIL_AUDIT_LOG_LIMIT = 20;
const ADMIN_PROVIDER_DETAIL_SHARED_DEVICE_LIMIT = 8;
const ADMIN_PAYMENT_DETAIL_AUDIT_LOG_LIMIT = 20;
const ADMIN_PAYMENT_DETAIL_CALLBACK_ATTEMPT_LIMIT = 25;

type AdminUserListOptions = {
  role?: Role | string | null;
  skip?: number | string | null;
  take?: number | string | null;
  view?: string | null;
};

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

type AdminOperationalPolicyListOptions = {
  keys?: string | string[] | null;
};

type AdminCustomerDirectorySummaryOptions = {
  country?: string | null;
  gender?: string | null;
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

type AdminCustomerGenderBreakdown = {
  female: number;
  male: number;
  other: number;
  unknown: number;
};

type AdminCustomerGenderGroupRow = {
  gender: string | null;
  _count: { _all: number };
};

type AdminPartnerDirectorySummaryOptions = {
  bookingFlow?: string | null;
  kyc?: string | null;
  providerStatus?: string | null;
  q?: string | null;
  review?: string | null;
  verification?: string | null;
};

type AdminPartnerDirectoryQueryOptions = AdminPartnerDirectorySummaryOptions & {
  skip?: number | string | null;
  sort?: string | null;
  take?: number | string | null;
};

type AdminOperationsHandoffProviderListOptions = {
  take?: number | string | null;
};

type AdminOperationsPolicyProviderListOptions = {
  take?: number | string | null;
};

type AdminProviderControlEvidenceListOptions = {
  take?: number | string | null;
};

type AdminPartnerControlProviderListOptions = {
  take?: number | string | null;
};

type AdminFileReviewProviderListOptions = {
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
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
};

type AdminReferralRewardSummary = Prisma.ReferralRewardGetPayload<{
  select: typeof adminReferralRewardSelect;
}>;

type AdminReferralCashoutReward = Prisma.ReferralRewardGetPayload<{
  select: typeof adminReferralCashoutRewardSelect;
}>;
type AdminReferralCashoutProviderProfile = NonNullable<
  AdminReferralCashoutReward['attribution']['referrerProviderProfile']
>;
type AdminReferralCashoutBankAccount = AdminReferralCashoutProviderProfile['bankAccounts'][number];

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

type AdminDashboardAppPresenceIntersectionRow = {
  activeBookingCustomers: unknown;
  liveActiveBookingCustomers: unknown;
  liveOpenMatchingCustomers: unknown;
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
  | 'offline-partners'
  | 'stale-partners'
  | 'bookings'
  | 'done'
  | 'cancel';

type AdminVietnamOverviewRealtimePointKind = Extract<
  AdminVietnamOverviewPointKind,
  'customers' | 'active' | 'online' | 'offline-partners' | 'stale-partners' | 'bookings'
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
  actorEmail: string | null;
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
    case '90d':
      return { startMs: addLocalDays(todayStartMs, -89), endMs: todayEndMs };
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

function normalizeOperationalPolicyKeys(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .flatMap((item) => String(item ?? '').split(','))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

type ManualWalletAdjustmentDb = Pick<
  Prisma.TransactionClient,
  | 'adminAuditLog'
  | 'customerProfile'
  | 'customerWalletLedgerEntry'
  | 'monthlyTaxClosing'
  | 'providerProfile'
  | 'providerWalletLedgerEntry'
  | 'user'
>;

type FinanceApprovalLookupDb = Partial<Pick<Prisma.TransactionClient, 'user'>>;
type AdminOperatorAccessDb = Pick<
  Prisma.TransactionClient,
  'adminAuditLog' | 'adminOperatorCredential' | 'adminOperatorPermission' | 'user'
>;

type AdminManualWalletAdjustmentPreview = ManualWalletAdjustmentPreview & {
  readonly approvalAdminId: string | null;
  readonly currency: string;
  readonly monthlyPeriod: string | null;
  readonly ownerId: string;
};

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

  listUsers(options: AdminUserListOptions = {}) {
    const skip = adminUserListSkip(options.skip);
    const role = normalizeAdminUserListRole(options.role);

    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      ...(role ? { where: { roles: { has: role } } } : {}),
      ...(skip > 0 ? { skip } : {}),
      take: adminUserListTake(options.take),
      select: adminUserListSelectForView(options.view),
    });
  }

  async getAdminOperatorAccess(actorId: string, identity?: string) {
    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, identity);
    if (!operator) {
      return null;
    }

    return adminOperatorAccessView(operator);
  }

  async recordAdminOperatorActivity(
    actorId: string,
    input: { action?: string; operatorIdentity?: string; target?: string; metadata?: unknown },
  ) {
    const action = normalizeNullable(input.action);
    const target = normalizeNullable(input.target);
    if (!action) {
      throw new BadRequestException('Admin operator activity action is required');
    }
    if (!target) {
      throw new BadRequestException('Admin operator activity target is required');
    }

    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, input.operatorIdentity);
    const operatorIdentity = normalizeNullable(input.operatorIdentity);
    const auditLog = await this.prisma.adminAuditLog.create({
      data: {
        actorId: operator?.id ?? actorId,
        action,
        target,
        metadata: {
          ...adminOperatorActivityMetadata(input.metadata),
          ...(operatorIdentity ? { operatorIdentity } : {}),
          requestedByAdminId: actorId,
        },
      },
    });

    return { ok: true, auditLog };
  }

  async listAdminCalendarEvents(options: {
    from?: string | null;
    take?: number | string | null;
    to?: string | null;
  } = {}) {
    const from = parseOptionalAdminCalendarDate(options.from, 'Calendar from date');
    const to = parseOptionalAdminCalendarDate(options.to, 'Calendar to date');
    const where: Prisma.AdminCalendarEventWhereInput = {};

    if (from || to) {
      where.AND = [
        ...(from ? [{ endAt: { gte: from } }] : []),
        ...(to ? [{ startAt: { lte: to } }] : []),
      ];
    }

    const events = await this.prisma.adminCalendarEvent.findMany({
      ...(Object.keys(where).length ? { where } : {}),
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
      take: adminCalendarEventListTake(options.take),
    });

    return events.map(adminCalendarEventView);
  }

  async createAdminCalendarEvent(actorId: string, input: CreateAdminCalendarEventDto) {
    const actor = adminCalendarActor(actorId, input);
    const data = adminCalendarCreateData(input, actor);
    const event = await this.prisma.adminCalendarEvent.create({ data });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: 'calendar_event.create',
        target: `calendar_event:${event.id}`,
        metadata: {
          operatorIdentity: actor.id,
          title: event.title,
        },
      },
    });

    return adminCalendarEventView(event);
  }

  async updateAdminCalendarEvent(actorId: string, id: string, input: UpdateAdminCalendarEventDto) {
    const eventId = normalizeNullable(id);
    if (!eventId) {
      throw new BadRequestException('Calendar event id is required');
    }

    const existing = await this.prisma.adminCalendarEvent.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new NotFoundException('Calendar event not found');
    }

    const actor = adminCalendarActor(actorId, input);
    if (existing.authorId !== actor.id) {
      throw new ForbiddenException('Only the calendar event author can update this event');
    }

    const event = await this.prisma.adminCalendarEvent.update({
      where: { id: eventId },
      data: adminCalendarUpdateData(input, existing, actor),
    });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: 'calendar_event.update',
        target: `calendar_event:${event.id}`,
        metadata: {
          operatorIdentity: actor.id,
          title: event.title,
        },
      },
    });

    return adminCalendarEventView(event);
  }

  async deleteAdminCalendarEvent(actorId: string, id: string, input: AdminCalendarActorDto = {}) {
    const eventId = normalizeNullable(id);
    if (!eventId) {
      throw new BadRequestException('Calendar event id is required');
    }

    const existing = await this.prisma.adminCalendarEvent.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new NotFoundException('Calendar event not found');
    }

    const actor = adminCalendarActor(actorId, input);
    if (existing.authorId !== actor.id) {
      throw new ForbiddenException('Only the calendar event author can delete this event');
    }

    await this.prisma.adminCalendarEvent.delete({ where: { id: eventId } });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: 'calendar_event.delete',
        target: `calendar_event:${eventId}`,
        metadata: {
          operatorIdentity: actor.id,
          title: existing.title,
        },
      },
    });

    return { ok: true, id: eventId };
  }

  private findAdminOperatorForIdentity(
    db: Pick<Prisma.TransactionClient, 'user'>,
    actorId: string,
    identity?: string | null,
  ) {
    const normalizedIdentity = normalizeNullable(identity);
    const lookup = normalizedIdentity ?? actorId;

    return db.user.findFirst({
      where: {
        roles: { has: Role.ADMIN },
        OR: [{ id: lookup }, { email: lookup }, { phone: lookup }],
      },
      select: adminOperatorAccessSelect,
    });
  }

  async createAdminOperator(actorId: string, input: CreateAdminOperatorDto) {
    const email = normalizeAdminOperatorEmail(input.email);
    if (!email) {
      throw new BadRequestException('Operator email is required');
    }
    const password = normalizeNullable(input.password);
    if (!password || password.length < ADMIN_OPERATOR_PASSWORD_MIN_LENGTH) {
      throw new BadRequestException('Operator password must be at least 8 characters');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertMasterAdminAccess(tx, actorId);
      const existingCredential = await tx.adminOperatorCredential.findUnique({
        where: { email },
        select: { userId: true },
      });
      const adminPhone = normalizeNullable(input.phone) ?? generatedAdminOperatorPhone(email);
      const existingUser = existingCredential
        ? await tx.user.findUnique({
            where: { id: existingCredential.userId },
            select: {
              id: true,
              roles: true,
            },
          })
        : await tx.user.findFirst({
            where: {
              OR: [{ email }, { phone: adminPhone }],
            },
            select: {
              id: true,
              roles: true,
            },
          });
      const nextRoles = mergeAdminOperatorRoles(existingUser?.roles ?? [], input.roles);
      const nextCategories = normalizeAdminOperatorPermissionCategories(
        nextRoles,
        input.permissionCategories,
      );
      const reason = normalizeAuditReason(input.reason);
      const userId = existingUser?.id;
      const user = userId
        ? await tx.user.update({
            where: { id: userId },
            data: {
              email,
              ...(input.fullName !== undefined ? { fullName: normalizeNullable(input.fullName) } : {}),
              roles: { set: nextRoles },
            },
            select: adminUserListSelect,
          })
        : await tx.user.create({
            data: {
              phone: adminPhone,
              email,
              fullName: normalizeNullable(input.fullName),
              roles: nextRoles,
            },
            select: adminUserListSelect,
          });

      const passwordCredential = hashAdminOperatorPassword(password);
      await tx.adminOperatorCredential.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          email,
          passwordHash: passwordCredential.passwordHash,
          passwordSalt: passwordCredential.passwordSalt,
        },
        update: {
          email,
          passwordHash: passwordCredential.passwordHash,
          passwordSalt: passwordCredential.passwordSalt,
        },
      });
      const permission = await tx.adminOperatorPermission.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          categories: { set: nextCategories },
        },
        update: {
          categories: { set: nextCategories },
        },
      });
      const hydratedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: adminUserListSelect,
      });
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: userId ? 'admin_operator.access.grant' : 'admin_operator.create',
          target: `user:${user.id}`,
          metadata: {
            permissionId: permission.id,
            previousRoles: existingUser?.roles ?? [],
            nextRoles,
            permissionCategories: nextCategories,
            reason,
          },
        },
      });

      return { user: hydratedUser ?? user, auditLog };
    });
  }

  async verifyAdminOperatorLogin(input: { email?: string | null; password?: string | null }) {
    const email = normalizeAdminOperatorEmail(input.email);
    const password = normalizeNullable(input.password);
    if (!email || !password) {
      throw new UnauthorizedException('Invalid admin operator credentials');
    }

    const credential = await this.prisma.adminOperatorCredential.findUnique({
      where: { email },
      select: {
        passwordHash: true,
        passwordSalt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roles: true,
          },
        },
      },
    });
    if (!credential?.user.roles.includes(Role.ADMIN) || !verifyAdminOperatorPassword(password, credential)) {
      throw new UnauthorizedException('Invalid admin operator credentials');
    }

    return {
      authenticated: true,
      user: {
        id: credential.user.id,
        email: credential.user.email,
        fullName: credential.user.fullName,
        roles: credential.user.roles,
      },
    };
  }

  async updateAdminOperatorAccess(
    actorId: string,
    userId: string,
    input: UpdateAdminOperatorAccessDto,
  ) {
    const targetUserId = normalizeNullable(userId);
    if (!targetUserId) {
      throw new BadRequestException('Admin user id is required');
    }
    if (actorId === targetUserId) {
      throw new BadRequestException('Master Admin access changes cannot target the acting admin');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertMasterAdminAccess(tx, actorId);
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          roles: true,
          adminOperatorPermission: { select: { categories: true } },
        },
      });
      if (!targetUser || !targetUser.roles.includes(Role.ADMIN)) {
        throw new NotFoundException('Admin operator not found');
      }

      const previousRoles = [...targetUser.roles];
      const nextRoles = mergeAdminOperatorRoles(previousRoles, input.roles ?? previousRoles);
      await assertAdminOperatorProtectedRoleRemoval(tx, targetUserId, previousRoles, nextRoles);
      const nextCategories = normalizeAdminOperatorPermissionCategories(
        nextRoles,
        input.permissionCategories ?? targetUser.adminOperatorPermission?.categories,
      );
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { roles: { set: nextRoles } },
        select: adminUserListSelect,
      });
      const permission = await tx.adminOperatorPermission.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          categories: { set: nextCategories },
        },
        update: {
          categories: { set: nextCategories },
        },
      });
      const hydratedUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: adminUserListSelect,
      });
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'admin_operator.access.update',
          target: `user:${targetUserId}`,
          metadata: {
            permissionId: permission.id,
            previousRoles,
            nextRoles,
            permissionCategories: nextCategories,
            reason: normalizeAuditReason(input.reason),
          },
        },
      });

      return { user: hydratedUser ?? user, auditLog };
    });
  }

  async revokeAdminOperatorAccess(
    actorId: string,
    userId: string,
    input: DeleteAdminOperatorAccessDto = {},
  ) {
    const targetUserId = normalizeNullable(userId);
    if (!targetUserId) {
      throw new BadRequestException('Admin user id is required');
    }
    if (actorId === targetUserId) {
      throw new BadRequestException('Master Admin access revocation cannot target the acting admin');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertMasterAdminAccess(tx, actorId);
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          roles: true,
          adminOperatorPermission: { select: { id: true, categories: true } },
        },
      });
      if (!targetUser || !targetUser.roles.includes(Role.ADMIN)) {
        throw new NotFoundException('Admin operator not found');
      }

      const previousRoles = [...targetUser.roles];
      const nextRoles = previousRoles.filter((role) => !isAdminOperatorRole(role));
      await assertAdminOperatorProtectedRoleRemoval(tx, targetUserId, previousRoles, nextRoles);
      await tx.adminOperatorPermission.deleteMany({ where: { userId: targetUserId } });
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { roles: { set: nextRoles } },
        select: adminUserListSelect,
      });
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'admin_operator.access.revoke',
          target: `user:${targetUserId}`,
          metadata: {
            permissionId: targetUser.adminOperatorPermission?.id ?? null,
            previousRoles,
            nextRoles,
            previousPermissionCategories: targetUser.adminOperatorPermission?.categories ?? [],
            reason: normalizeAuditReason(input.reason),
          },
        },
      });

      return { ok: true, user, auditLog };
    });
  }

  private async assertMasterAdminAccess(db: AdminOperatorAccessDb, actorId: string) {
    const actor = await db.user.findUnique({
      where: { id: actorId },
      select: { id: true, roles: true },
    });
    if (!actor?.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin access is required');
    }
    if (actor.roles.includes(Role.MASTER_ADMIN)) {
      return actor;
    }

    const masterAdminCount = await db.user.count({
      where: { roles: { has: Role.MASTER_ADMIN } },
    });
    if (masterAdminCount === 0) {
      return actor;
    }

    throw new ForbiddenException('Master Admin role is required for operator access changes');
  }

  async updateUserFinanceApproverRole(
    actorId: string,
    userId: string,
    input: UpdateFinanceApproverRoleDto,
  ) {
    const targetUserId = userId.trim();
    if (!targetUserId) {
      throw new BadRequestException('Admin user id is required');
    }
    if (actorId === targetUserId) {
      throw new BadRequestException('Finance approver role changes cannot target the acting admin');
    }

    return this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          phone: true,
          fullName: true,
          roles: true,
        },
      });
      if (!targetUser) {
        throw new NotFoundException('Admin user not found');
      }
      if (!targetUser.roles.includes(Role.ADMIN)) {
        throw new BadRequestException('Finance approver role can only be assigned to admin users');
      }

      const previousRoles = [...targetUser.roles];
      const enabled = input.enabled;
      const currentlyEnabled = previousRoles.includes(Role.FINANCE_APPROVER);
      if (!enabled && currentlyEnabled) {
        const remainingApprovers = await tx.user.count({
          where: {
            id: { not: targetUserId },
            roles: { has: Role.FINANCE_APPROVER },
          },
        });
        if (remainingApprovers === 0) {
          throw new BadRequestException('Cannot remove the last finance approver');
        }
      }

      const nextRoles = enabled
        ? Array.from(new Set([...previousRoles, Role.FINANCE_APPROVER]))
        : previousRoles.filter((role) => role !== Role.FINANCE_APPROVER);
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { roles: { set: nextRoles } },
        select: adminUserListSelect,
      });
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: enabled
            ? 'admin_user.finance_approver.grant'
            : 'admin_user.finance_approver.revoke',
          target: `user:${targetUserId}`,
          metadata: {
            enabled,
            reason: normalizeAuditReason(input.reason),
            previousRoles,
            nextRoles,
          },
        },
      });

      return { user, auditLog };
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
        gender: true,
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
    const todayStartMs = startOfLocalDay(Date.now());
    const todayEndMs = addLocalDays(todayStartMs, 1);
    const monthStartMs = addLocalDays(todayStartMs, -29);
    const todayJoinedWhere = adminCustomerSummaryWhere(
      where,
      adminCustomerCreatedAtWindowWhere(todayStartMs, todayEndMs),
    );
    const todaySeenWhere = adminCustomerSummaryWhere(
      where,
      adminCustomerLastSeenWindowWhere(todayStartMs, todayEndMs),
    );
    const monthSeenWhere = adminCustomerSummaryWhere(
      where,
      adminCustomerLastSeenWindowWhere(monthStartMs, todayEndMs),
    );
    const [totalCount, genderRows, todayJoinedRows, todaySeenRows, monthSeenRows] = await Promise.all([
      this.prisma.customerProfile.count({
        ...(where ? { where } : {}),
      }),
      this.prisma.customerProfile.groupBy({
        by: ['gender'],
        ...(where ? { where } : {}),
        _count: { _all: true },
      }),
      this.prisma.customerProfile.groupBy({
        by: ['gender'],
        where: todayJoinedWhere,
        _count: { _all: true },
      }),
      this.prisma.customerProfile.groupBy({
        by: ['gender'],
        where: todaySeenWhere,
        _count: { _all: true },
      }),
      this.prisma.customerProfile.groupBy({
        by: ['gender'],
        where: monthSeenWhere,
        _count: { _all: true },
      }),
    ]);
    const genderBreakdown = adminCustomerGenderBreakdown(genderRows);
    const todayJoinedGenderBreakdown = adminCustomerGenderBreakdown(todayJoinedRows);
    const todaySeenGenderBreakdown = adminCustomerGenderBreakdown(todaySeenRows);
    const monthSeenGenderBreakdown = adminCustomerGenderBreakdown(monthSeenRows);

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
      genderBreakdown,
      todayJoined: adminCustomerGenderBreakdownTotal(todayJoinedGenderBreakdown),
      todayJoinedGenderBreakdown,
      todaySeen: adminCustomerGenderBreakdownTotal(todaySeenGenderBreakdown),
      todaySeenGenderBreakdown,
      monthSeen: adminCustomerGenderBreakdownTotal(monthSeenGenderBreakdown),
      monthSeenGenderBreakdown,
    };
  }

  async getCustomerDetail(
    customerProfileId: string,
    options: { includeDiagnostics?: boolean } = {},
  ) {
    const includeDiagnostics = options.includeDiagnostics !== false;
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: includeDiagnostics ? adminCustomerDetailSelect : adminCustomerDetailWithoutDiagnosticsSelect,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const auditLogs = includeDiagnostics
      ? await this.prisma.adminAuditLog.findMany({
          where: customerAuditLogWhere(customerProfileId, customer.userId),
          orderBy: { createdAt: 'desc' },
          take: ADMIN_CUSTOMER_DETAIL_AUDIT_LOG_LIMIT,
          select: adminAuditLogSelect,
        })
      : undefined;

    return includeDiagnostics ? { ...customer, auditLogs } : customer;
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

  async appSessionSummary(options: AdminAppSessionListQuery = {}) {
    const where = adminAppSessionListWhere(options);
    const liveStateWhere = adminAppSessionStateWhere('live') ?? {};
    const recentStateWhere = adminAppSessionStateWhere('recent') ?? {};
    const [totalCount, liveCustomers, livePartners, recentCustomers, recentPartners, recent, stale, expired] =
      await Promise.all([
        this.prisma.appSession.count({ ...(where ? { where } : {}) }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, { role: Role.CUSTOMER }, liveStateWhere),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, { role: Role.PROVIDER }, liveStateWhere),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, { role: Role.CUSTOMER }, recentStateWhere),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, { role: Role.PROVIDER }, recentStateWhere),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, recentStateWhere),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, adminAppSessionStateWhere('stale') ?? {}),
        }),
        this.prisma.appSession.count({
          where: withAdminAppSessionWhere(where, adminAppSessionStateWhere('expired') ?? {}),
        }),
      ]);

    return {
      expired,
      generatedAt: new Date().toISOString(),
      liveCustomers,
      livePartners,
      recent,
      recentCustomers,
      recentPartners,
      stale,
      totalCount,
    };
  }

  async dashboardSummary() {
    const now = new Date();
    const liveBoundary = new Date(now.getTime() - ADMIN_APP_SESSION_LIVE_WINDOW_MS);
    const liveSessionWhere = adminAppSessionStateWhere('live') ?? {};
    const recentCustomerSessionWhere = adminAppSessionStateWhere('recent') ?? {};
    const staleCustomerSessionWhere = adminAppSessionStateWhere('stale') ?? {};
    const activeStatuses = Array.from(ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES);
    const locationStaleBoundary = new Date(now.getTime() - 30 * 60_000);
    const revenueStatuses = [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID];

    const [
      totalCustomers,
      liveCustomerSessions,
      liveProviderSessions,
      recentCustomerSessions,
      staleCustomerSessions,
      reachableCustomers,
      disabledPushCustomers,
      bookingCustomerRows,
      totalPartners,
      partnerStatusRows,
      staleLocationPartners,
      noLocationPartners,
      pendingVerificationPartners,
      approvedVerificationPartners,
      kycApprovedPartners,
      bankApprovedPartners,
      firstRevenuePartnerRows,
      withdrawalProfileReadyPartners,
      level2ActivePartners,
      blockedPartners,
      activeDemandBookings,
    ] = await Promise.all([
      this.prisma.customerProfile.count(),
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: { role: Role.CUSTOMER, ...liveSessionWhere },
      }),
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: { role: Role.PROVIDER, ...liveSessionWhere },
      }),
      this.prisma.appSession.count({
        where: { role: Role.CUSTOMER, ...recentCustomerSessionWhere },
      }),
      this.prisma.appSession.count({
        where: { role: Role.CUSTOMER, ...staleCustomerSessionWhere },
      }),
      this.prisma.user.count({
        where: {
          customerProfile: { isNot: null },
          pushDevices: { some: { enabled: true, role: Role.CUSTOMER } },
        },
      }),
      this.prisma.user.count({
        where: {
          customerProfile: { isNot: null },
          pushDevices: { some: { role: Role.CUSTOMER } },
          NOT: { pushDevices: { some: { enabled: true, role: Role.CUSTOMER } } },
        },
      }),
      this.prisma.$queryRaw<AdminDashboardAppPresenceIntersectionRow[]>(Prisma.sql`
        WITH live_customer_users AS (
          SELECT DISTINCT sessions."userId"
          FROM "AppSession" sessions
          WHERE sessions."role"::text = ${Role.CUSTOMER}
            AND (
              (sessions."active" = TRUE AND sessions."expiresAt" >= ${now})
              OR sessions."lastSeenAt" >= ${liveBoundary}
            )
        ),
        active_booking_customer_users AS (
          SELECT DISTINCT customers."userId"
          FROM "Booking" bookings
          INNER JOIN "CustomerProfile" customers ON customers."id" = bookings."customerProfileId"
          WHERE bookings."status"::text IN (${Prisma.join(activeStatuses)})
        ),
        open_matching_customer_users AS (
          SELECT DISTINCT customers."userId"
          FROM "Booking" bookings
          INNER JOIN "CustomerProfile" customers ON customers."id" = bookings."customerProfileId"
          WHERE bookings."status"::text = ${BookingStatus.OPEN_MATCHING}
        )
        SELECT
          (SELECT COUNT(*) FROM active_booking_customer_users)::bigint AS "activeBookingCustomers",
          (
            SELECT COUNT(*)
            FROM active_booking_customer_users active_users
            INNER JOIN live_customer_users live_users ON live_users."userId" = active_users."userId"
          )::bigint AS "liveActiveBookingCustomers",
          (
            SELECT COUNT(*)
            FROM open_matching_customer_users matching_users
            INNER JOIN live_customer_users live_users ON live_users."userId" = matching_users."userId"
          )::bigint AS "liveOpenMatchingCustomers"
      `),
      this.prisma.providerProfile.count(),
      this.prisma.providerProfile.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.providerProfile.count({
        where: { currentLocationUpdatedAt: { lt: locationStaleBoundary } },
      }),
      this.prisma.providerProfile.count({
        where: { OR: [{ currentLat: null }, { currentLng: null }] },
      }),
      this.prisma.providerProfile.count({
        where: { verification: { is: { status: VerificationStatus.SUBMITTED } } },
      }),
      this.prisma.providerProfile.count({
        where: { verification: { is: { status: VerificationStatus.APPROVED } } },
      }),
      this.prisma.providerProfile.count({
        where: { kyc: { is: { status: ProviderKycStatus.APPROVED } } },
      }),
      this.prisma.providerProfile.count({
        where: { bankAccounts: { some: { status: ProviderBankAccountStatus.APPROVED } } },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: { status: { in: revenueStatuses } },
      }),
      this.prisma.providerProfile.count({
        where: {
          AND: [
            { residentialAddress: { not: null } },
            { NOT: { residentialAddress: '' } },
            { earnings: { some: { status: { in: revenueStatuses } } } },
          ],
        },
      }),
      this.prisma.providerProfile.count({
        where: {
          kyc: { is: { status: ProviderKycStatus.APPROVED } },
          verification: { is: { status: VerificationStatus.APPROVED } },
        },
      }),
      this.prisma.providerProfile.count({
        where: {
          OR: [
            { blockedAt: { not: null } },
            { sanctions: { some: { status: ProviderSanctionStatus.ACTIVE } } },
          ],
        },
      }),
      this.prisma.booking.count({
        where: { status: { in: activeStatuses } },
      }),
    ]);
    const bookingCustomerRow = bookingCustomerRows[0];
    const partnerStatusCounts = new Map(partnerStatusRows.map((row) => [row.status, row._count._all]));
    const onlineAvailable = partnerStatusCounts.get(ProviderStatus.ONLINE_AVAILABLE) ?? 0;
    const onlineBusy = partnerStatusCounts.get(ProviderStatus.ONLINE_BUSY) ?? 0;
    const onlineAvailableSoon = partnerStatusCounts.get(ProviderStatus.ONLINE_AVAILABLE_SOON) ?? 0;
    const offline = partnerStatusCounts.get(ProviderStatus.OFFLINE) ?? 0;
    const online = onlineAvailable + onlineBusy + onlineAvailableSoon;

    return {
      generatedAt: now.toISOString(),
      appPresence: {
        activeBookingCustomers: integerValue(bookingCustomerRow?.activeBookingCustomers),
        disabledPushCustomers,
        liveActiveBookingCustomers: integerValue(bookingCustomerRow?.liveActiveBookingCustomers),
        liveAppCustomers: liveCustomerSessions.length,
        liveAppPartners: liveProviderSessions.length,
        liveOpenMatchingCustomers: integerValue(bookingCustomerRow?.liveOpenMatchingCustomers),
        reachableCustomers,
        recentCustomerSessions,
        staleCustomerSessions,
        totalCustomers,
      },
      partnerSupply: {
        approvedVerification: approvedVerificationPartners,
        bankApproved: bankApprovedPartners,
        blocked: blockedPartners,
        cashDebtPartners: 0,
        firstRevenue: firstRevenuePartnerRows.length,
        kycApproved: kycApprovedPartners,
        level2Active: level2ActivePartners,
        liveSessions: liveProviderSessions.length,
        noLocation: noLocationPartners,
        offline,
        online,
        onlineAvailable,
        onlineAvailableSoon,
        onlineBusy,
        pendingVerification: pendingVerificationPartners,
        staleLocation: staleLocationPartners,
        supplyPressureLabel:
          onlineAvailable > 0 ? `${(activeDemandBookings / onlineAvailable).toFixed(1)}x` : 'No supply',
        total: totalPartners,
        withdrawalProfileReady: withdrawalProfileReadyPartners,
      },
    };
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
      platformFeeVatRateBps?: number | null;
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
        metadata: referralPolicyMetadata(input.platformFeeVatRateBps),
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
        metadata: referralPolicyMetadata(input.platformFeeVatRateBps),
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

  async approveReferralRewardCashout(actorId: string, rewardId: string, input: { reason?: string } = {}) {
    const reward = await this.referrals.approveRewardCashoutRequest(rewardId);

    await this.writeAudit(actorId, 'referral_reward.cashout_approve', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      cashoutApproved: true,
      currency: reward.currency,
      reason: normalizeAuditReason(input.reason),
      status: reward.status,
      walletCreditCreated: false,
      walletLedgerReference: reward.walletLedgerReference,
    });

    return reward;
  }

  async requireReferralRewardTaxReview(actorId: string, rewardId: string, input: { reason?: string } = {}) {
    const reward = await this.referrals.requireRewardTaxReview(rewardId);

    await this.writeAudit(actorId, 'referral_reward.tax_review_required', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      currency: reward.currency,
      reason: normalizeAuditReason(input.reason),
      status: reward.status,
      taxReviewRequired: true,
      walletCreditCreated: false,
      walletLedgerReference: reward.walletLedgerReference,
    });

    return reward;
  }

  async markReferralRewardCashoutPaid(
    actorId: string,
    rewardId: string,
    input: { approvalAdminId?: string | null; reason?: string; transferRef: string },
  ) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Referral reward cashout paid closeout',
    );
    await assertFinanceActionApprovalAdmin(
      this.prisma,
      approvalAdminId,
      'Referral reward cashout paid closeout',
    );
    const reason = normalizeAuditReason(input.reason);
    if (!normalizeNullable(input.transferRef)) {
      throw new BadRequestException('Referral cashout paid closeout requires a transfer reference');
    }
    const transferRef = normalizeAuditReason(input.transferRef);
    const reward = await this.referrals.payRewardCashout(rewardId, {
      notes: reason,
      reference: transferRef,
    });

    await this.writeAudit(actorId, 'referral_reward.cashout_paid', `referral_reward:${rewardId}`, {
      amount: reward.amount,
      approvalAdminId,
      cashoutPaid: true,
      currency: reward.currency,
      reason,
      status: reward.status,
      transferRef,
      walletCreditCreated: false,
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

  async listCustomerReferralParents(options: AdminReferralParentListQuery = {}) {
    const skip = adminReferralParentListSkip(options.skip);
    const rows = await this.prisma.customerProfile.findMany({
      where: adminCustomerReferralParentWhere(options),
      orderBy: { id: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminReferralParentListTake(options.take),
      select: adminCustomerReferralParentSelect,
    });
    const decisions = await this.listLatestReferralRewardDecisions(adminCustomerReferralRewardIds(rows));

    return rows.map((row) => adminCustomerReferralParentView(row, decisions));
  }

  async customerReferralParentSummary(options: AdminReferralParentListQuery = {}) {
    const [totalCount, rewardGroups] = await Promise.all([
      this.prisma.customerProfile.count({
        where: adminCustomerReferralParentWhere(options),
      }),
      this.prisma.referralReward.groupBy({
        by: ['status'],
        where: { attribution: adminCustomerReferralAttributionWhere(options, { includeReward: true }) },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCount,
      rewardQueueSummaries: adminReferralRewardQueueSummaries(rewardGroups),
    };
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

  async listPartnerReferralParents(options: AdminReferralParentListQuery = {}) {
    const skip = adminReferralParentListSkip(options.skip);
    const rows = await this.prisma.providerProfile.findMany({
      where: adminPartnerReferralParentWhere(options),
      orderBy: { id: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminReferralParentListTake(options.take),
      select: adminPartnerReferralParentSelect,
    });
    const decisions = await this.listLatestReferralRewardDecisions(adminPartnerReferralRewardIds(rows));

    return rows.map((row) => adminPartnerReferralParentView(row, decisions));
  }

  async partnerReferralParentSummary(options: AdminReferralParentListQuery = {}) {
    const [totalCount, rewardGroups] = await Promise.all([
      this.prisma.providerProfile.count({
        where: adminPartnerReferralParentWhere(options),
      }),
      this.prisma.referralReward.groupBy({
        by: ['status'],
        where: { attribution: adminPartnerReferralAttributionWhere(options, { includeReward: true }) },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCount,
      rewardQueueSummaries: adminReferralRewardQueueSummaries(rewardGroups),
    };
  }

  async listReferralCashoutQueue(options: AdminReferralCashoutQueueQuery = {}) {
    const skip = adminReferralCashoutListSkip(options.skip);
    const rows = await this.prisma.referralReward.findMany({
      where: adminReferralCashoutWhere(options),
      orderBy: { createdAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminReferralCashoutListTake(options.take),
      select: adminReferralCashoutRewardSelect,
    });
    const decisions = await this.listLatestReferralRewardDecisions(uniqueReferralRewardIds(rows));

    return rows.map((row) => adminReferralCashoutQueueRowView(row, decisions));
  }

  async referralCashoutQueueSummary(options: AdminReferralCashoutQueueQuery = {}) {
    const where = adminReferralCashoutWhere(options);
    const [totalCount, rewardGroups] = await Promise.all([
      this.prisma.referralReward.count({ where }),
      this.prisma.referralReward.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return adminReferralCashoutQueueSummary(totalCount, rewardGroups);
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
    return this.buildVietnamOverview(rangeInput, {
      includePeriodMetrics: true,
      includeRealtimePoints: true,
    });
  }

  async getVietnamOverviewSummary(rangeInput?: string) {
    const overview = await this.buildVietnamOverview(rangeInput, {
      includePeriodMetrics: true,
      includeRealtimePoints: false,
    });
    const { realtimePoints, ...summary } = overview;
    void realtimePoints;

    return summary;
  }

  async getVietnamOverviewRealtimePoints(
    rangeInput?: string,
    options: { readonly take?: number | string | null } = {},
  ) {
    const overview = await this.buildVietnamOverview(rangeInput, {
      includePeriodMetrics: false,
      includeRealtimePoints: true,
      realtimeListLimit: adminVietnamRealtimePointLimit(options.take),
    });

    return {
      generatedAt: overview.generatedAt,
      refreshSeconds: overview.refreshSeconds,
      source: overview.source,
      range: overview.range,
      rangeLabel: overview.rangeLabel,
      windowStartAt: overview.windowStartAt,
      windowEndAt: overview.windowEndAt,
      realtimePoints: overview.realtimePoints ?? [],
    };
  }

  private async buildVietnamOverview(
    rangeInput: string | undefined,
    options: {
      includePeriodMetrics: boolean;
      includeRealtimePoints: boolean;
      realtimeListLimit?: number;
    },
  ) {
    const now = new Date();
    const window = adminVietnamOverviewRangeWindow(normalizeAdminVietnamOverviewRange(rangeInput), now);
    const dateWhere = adminVietnamOverviewDateWhere(window);
    const bookingWhere: Prisma.BookingWhereInput = dateWhere
      ? {
          OR: [{ createdAt: dateWhere }, { updatedAt: dateWhere }, { closedAt: dateWhere }],
        }
      : {};
    const activeCustomerSince = new Date(now.getTime() - ADMIN_VIETNAM_ACTIVE_CUSTOMER_WINDOW_MS);
    const activeCustomerSessionWhere: Prisma.AppSessionWhereInput = {
      active: true,
      lastSeenAt: { gte: activeCustomerSince },
      role: Role.CUSTOMER,
    };
    const stalePartnerSince = new Date(now.getTime() - ADMIN_VIETNAM_STALE_PARTNER_WINDOW_MS);
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
    const sourceListLimit = options.includePeriodMetrics
      ? ADMIN_VIETNAM_OVERVIEW_LIST_LIMIT
      : (options.realtimeListLimit ?? ADMIN_VIETNAM_REALTIME_POINT_LIST_LIMIT);

    const [customers, providers, bookings, realtimeBookings] = await Promise.all([
      this.prisma.customerProfile.findMany({
        orderBy: { id: 'desc' },
        take: sourceListLimit,
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
                  ...activeCustomerSessionWhere,
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
        take: sourceListLimit,
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
          user: {
            select: {
              appSessions: {
                where: {
                  role: Role.PROVIDER,
                },
                orderBy: { lastSeenAt: 'desc' },
                take: 1,
                select: {
                  lastSeenAt: true,
                },
              },
            },
          },
        },
      }),
      options.includePeriodMetrics
        ? this.prisma.booking.findMany({
            where: bookingWhere,
            orderBy: { createdAt: 'desc' },
            take: sourceListLimit,
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
          })
        : Promise.resolve([]),
      options.includePeriodMetrics || options.includeRealtimePoints
        ? this.prisma.booking.findMany({
            where: {
              status: { in: Array.from(ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES) },
            },
            orderBy: { updatedAt: 'desc' },
            take: sourceListLimit,
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
          })
        : Promise.resolve([]),
    ]);
    const realtimePoints: AdminVietnamOverviewRealtimePoint[] = [];

    for (const customer of customers) {
      const selectedLocation = customer.selectedLocations[0];
      const region = options.includePeriodMetrics
        ? ensureVietnamOverviewRegion(
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
          )
        : null;
      if (region) {
        region.customerCount += 1;
      }

      if (options.includeRealtimePoints) {
        const customerPointOccurredAt = latestDate(
          selectedLocation?.createdAt,
          customer.user.appSessions[0]?.lastSeenAt,
          now,
        );
        const customerPoint = vietnamOverviewEventPoint({
          id: `customer:${customer.id}:saved-location`,
          kind: 'customers',
          label: 'Customer saved address location',
          latitude: selectedLocation?.latitude,
          longitude: selectedLocation?.longitude,
          occurredAt: customerPointOccurredAt,
          source: 'customer-selected-location',
          addressText: selectedLocation?.addressText ?? customer.user.appSessions[0]?.lastLoginAddress,
          customerProfileId: customer.id,
        });
        if (customerPoint) {
          realtimePoints.push(customerPoint);
        }
      }

      const lastSeenAt = customer.user.appSessions[0]?.lastSeenAt;
      const isCustomerCurrentlyActive = Boolean(lastSeenAt && lastSeenAt >= activeCustomerSince);
      if (lastSeenAt && (!dateWhere || lastSeenAt >= activeCustomerSince)) {
        if (region) {
          region.activeCustomerCount += 1;
        }
        if (options.includeRealtimePoints && isCustomerCurrentlyActive) {
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
    }

    for (const provider of providers) {
      const region = options.includePeriodMetrics
        ? ensureVietnamOverviewRegion(
            regions,
            vietnamRegionCodeFromValues([provider.city, provider.residentialAddress, provider.serviceArea], {
              latitude: provider.currentLat,
              longitude: provider.currentLng,
            }),
          )
        : null;
      if (region) {
        region.partnerCount += 1;
      }

      const lastProviderSeenAt = provider.user.appSessions[0]?.lastSeenAt ?? null;
      const partnerPointOccurredAt = latestDate(
        lastProviderSeenAt,
        provider.currentLocationUpdatedAt,
        now,
      );
      const isStalePartner = !lastProviderSeenAt || lastProviderSeenAt < stalePartnerSince;
      const isReadyPartner = provider.status === ProviderStatus.ONLINE_AVAILABLE && !isStalePartner;
      const partnerPointKind: AdminVietnamOverviewRealtimePointKind = isReadyPartner
        ? 'online'
        : isStalePartner
          ? 'stale-partners'
          : 'offline-partners';

      if (isReadyPartner) {
        if (region) {
          region.onlinePartnerCount += 1;
        }
      }

      if (options.includeRealtimePoints) {
        const partnerPoint = vietnamOverviewEventPoint({
          id: `${partnerPointKind}:${provider.id}:${partnerPointOccurredAt?.toISOString() ?? 'unknown'}`,
          kind: partnerPointKind,
          label: provider.displayName,
          latitude: provider.currentLat,
          longitude: provider.currentLng,
          occurredAt: partnerPointOccurredAt,
          source: isReadyPartner
            ? 'partner-ready-status-last-location'
            : isStalePartner
              ? 'partner-stale-app-session-last-location'
              : 'partner-offline-status-last-location',
          addressText: provider.residentialAddress ?? provider.city,
          providerProfileId: provider.id,
        });
        if (partnerPoint) {
          realtimePoints.push(partnerPoint);
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
        if (options.includePeriodMetrics) {
          region.activeBookingCount += 1;
        }
        if (options.includeRealtimePoints) {
          realtimePoints.push(activeBookingPoint);
        }
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
      points: [],
      realtimePoints,
    };
  }

  async getUsageOverview(rangeInput?: string) {
    const window = adminUsageRangeWindow(normalizeAdminUsageRange(rangeInput));
    const dateWhere = adminUsageDateWhere(window);
    const now = new Date();
    const todayStart = usageOverviewUtcDayStart(now);
    const tomorrowStart = usageOverviewAddUtcDays(todayStart, 1);
    const active7dStart = usageOverviewAddUtcDays(todayStart, -6);
    const active30dStart = usageOverviewAddUtcDays(todayStart, -29);
    const sessionWhere = {
      role: Role.CUSTOMER,
      ...(dateWhere ? { lastSeenAt: dateWhere } : {}),
    };
    const activeTodaySessionWhere = {
      role: Role.CUSTOMER,
      lastSeenAt: { gte: todayStart, lt: tomorrowStart },
    };
    const active7dSessionWhere = {
      role: Role.CUSTOMER,
      lastSeenAt: { gte: active7dStart, lt: tomorrowStart },
    };
    const active30dSessionWhere = {
      role: Role.CUSTOMER,
      lastSeenAt: { gte: active30dStart, lt: tomorrowStart },
    };
    const completedBookingWhere = {
      status: BookingStatus.COMPLETED,
      ...(dateWhere ? { closedAt: dateWhere } : {}),
    };
    const createdBookingWhere = {
      ...(dateWhere ? { createdAt: dateWhere } : {}),
    };
    const cancellationBookingWhere = {
      status: { in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED] },
      ...(dateWhere ? { OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }] } : {}),
    };
    const refundedBookingWhere = {
      status: BookingStatus.REFUNDED,
      ...(dateWhere ? { OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }] } : {}),
    };
    const issueCustomerBookingWhere = {
      status: { in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED, BookingStatus.REFUNDED] },
      ...(dateWhere ? { OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }] } : {}),
    };
    const lowReviewWhere = {
      rating: { lte: 2 },
      status: ReviewStatus.PUBLISHED,
      ...(dateWhere ? { createdAt: dateWhere } : {}),
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
      platformUsageRows,
      completedCustomerRows,
      qualityRiskCustomerRows,
      viewedPartnerRows,
      requestedPartnerRows,
      completedPartnerRows,
      regionSessionRows,
      regionBookingRequestRows,
      regionCompletedBookingRows,
      customerSessionCount,
      completedBookingCount,
      profileViewAggregate,
      bookingRequestCount,
      newCustomerCount,
      activeCustomerCount,
      activeTodayCustomerCount,
      active7dCustomerCount,
      active30dCustomerCount,
      completedCustomerCount,
      churnRiskCustomerCount,
      neverBookedCustomerCount,
      newUnbookedCustomerCount,
      createdBookingCount,
      cancellationCount,
      refundCount,
      lowReviewCount,
      paymentFailureCount,
      refundAmount,
      paymentMethodRows,
      popularServiceRows,
      hourlyActivityRows,
      repeatCustomerRows,
      couponBookingRows,
      firstCompletedCustomerRows,
      vipCustomerRows,
      issueCustomerRows,
      lowReviewCustomerRows,
    ] = await Promise.all([
      this.prisma.appSession.groupBy({
        by: ['userId'],
        where: sessionWhere,
        _count: { _all: true },
        _max: { lastSeenAt: true },
        orderBy: { _count: { userId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.appSession.groupBy({
        by: ['platform'],
        where: sessionWhere,
        _count: { _all: true },
        _max: { lastSeenAt: true },
        orderBy: { _count: { platform: 'desc' } },
      }),
      this.prisma.booking.groupBy({
        by: ['customerProfileId'],
        where: completedBookingWhere,
        _count: { _all: true },
        _max: { closedAt: true, updatedAt: true },
        orderBy: { _count: { customerProfileId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.booking.groupBy({
        by: ['customerProfileId'],
        where: issueCustomerBookingWhere,
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
      this.prisma.customerProviderProfileView.aggregate({
        where: profileViewWhere,
        _sum: { viewCount: true },
      }),
      this.prisma.booking.count({ where: bookingRequestWhere }),
      this.prisma.user.count({
        where: {
          roles: { has: Role.CUSTOMER },
          ...(dateWhere ? { createdAt: dateWhere } : {}),
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          user: {
            appSessions: {
              some: sessionWhere,
            },
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          user: {
            appSessions: {
              some: activeTodaySessionWhere,
            },
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          user: {
            appSessions: {
              some: active7dSessionWhere,
            },
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          user: {
            appSessions: {
              some: active30dSessionWhere,
            },
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          bookings: {
            some: completedBookingWhere,
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          bookings: {
            some: {
              status: BookingStatus.COMPLETED,
              closedAt: { lt: active30dStart },
            },
          },
          user: {
            appSessions: {
              none: {
                role: Role.CUSTOMER,
                lastSeenAt: { gte: active30dStart },
              },
            },
          },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          bookings: { none: {} },
        },
      }),
      this.prisma.customerProfile.count({
        where: {
          bookings: { none: {} },
          user: {
            ...(dateWhere ? { createdAt: dateWhere } : {}),
          },
        },
      }),
      this.prisma.booking.count({ where: createdBookingWhere }),
      this.prisma.booking.count({ where: cancellationBookingWhere }),
      this.prisma.booking.count({ where: refundedBookingWhere }),
      this.prisma.review.count({ where: lowReviewWhere }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.FAILED,
          booking: createdBookingWhere,
        },
      }),
      this.prisma.refund.aggregate({
        where: dateWhere ? { createdAt: dateWhere } : {},
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          booking: completedBookingWhere,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.bookingService.groupBy({
        by: ['serviceId'],
        where: {
          booking: { is: createdBookingWhere },
        },
        _count: { _all: true },
        _sum: { price: true, quantity: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.$queryRaw<
        Array<{
          hour: bigint | number | null;
          customerSessionCount: bigint | number | null;
          bookingRequestCount: bigint | number | null;
        }>
      >(Prisma.sql`
        SELECT
          usage_hours."hour" AS "hour",
          SUM(usage_hours."customerSessionCount")::bigint AS "customerSessionCount",
          SUM(usage_hours."bookingRequestCount")::bigint AS "bookingRequestCount"
        FROM (
          SELECT
            EXTRACT(HOUR FROM "lastSeenAt")::int AS "hour",
            COUNT(*)::bigint AS "customerSessionCount",
            0::bigint AS "bookingRequestCount"
          FROM "AppSession"
          WHERE "role" = ${Role.CUSTOMER}::"Role"
          ${usageOverviewLastSeenAtSql(dateWhere)}
          GROUP BY 1
          UNION ALL
          SELECT
            EXTRACT(HOUR FROM "createdAt")::int AS "hour",
            0::bigint AS "customerSessionCount",
            COUNT(*)::bigint AS "bookingRequestCount"
          FROM "Booking"
          WHERE "preferredProviderId" IS NOT NULL
          ${usageOverviewCreatedAtSql(dateWhere)}
          GROUP BY 1
        ) usage_hours
        GROUP BY usage_hours."hour"
        ORDER BY usage_hours."hour" ASC
      `),
      this.prisma.$queryRaw<Array<{ count: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM (
          SELECT "customerProfileId"
          FROM "Booking"
          WHERE "status" = ${BookingStatus.COMPLETED}::"BookingStatus"
          ${usageOverviewClosedAtSql(dateWhere)}
          GROUP BY "customerProfileId"
          HAVING COUNT(*) >= 2
        ) repeat_customers
      `),
      this.prisma.$queryRaw<Array<{ count: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM "Payment" payment
        INNER JOIN "Booking" booking ON booking."id" = payment."bookingId"
        WHERE booking."status" = ${BookingStatus.COMPLETED}::"BookingStatus"
        ${usageOverviewClosedAtSql(dateWhere, 'booking')}
        AND (
          payment."rawMeta" ? 'couponId'
          OR payment."rawMeta" ? 'couponCode'
          OR payment."rawMeta" ? 'couponCodeSnapshot'
        )
      `),
      this.prisma.$queryRaw<Array<{ count: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM (
          SELECT "customerProfileId"
          FROM "Booking"
          WHERE "status" = ${BookingStatus.COMPLETED}::"BookingStatus"
          ${usageOverviewClosedAtSql(dateWhere)}
          GROUP BY "customerProfileId"
          HAVING COUNT(*) = 1
        ) first_completed_customers
      `),
      this.prisma.$queryRaw<Array<{ count: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM (
          SELECT "customerProfileId"
          FROM "Booking"
          WHERE "status" = ${BookingStatus.COMPLETED}::"BookingStatus"
          ${usageOverviewClosedAtSql(dateWhere)}
          GROUP BY "customerProfileId"
          HAVING COUNT(*) >= 3
        ) vip_customers
      `),
      this.prisma.$queryRaw<Array<{ count: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "customerProfileId")::bigint AS "count"
        FROM "Booking"
        WHERE "status" IN (
          ${BookingStatus.CANCELLED}::"BookingStatus",
          ${BookingStatus.NO_SHOW}::"BookingStatus",
          ${BookingStatus.EXPIRED}::"BookingStatus",
          ${BookingStatus.REFUNDED}::"BookingStatus"
        )
        ${usageOverviewClosedOrUpdatedAtSql(dateWhere)}
      `),
      this.prisma.review.groupBy({
        by: ['customerProfileId'],
        where: lowReviewWhere,
        _count: { _all: true },
        _min: { rating: true },
        _max: { createdAt: true },
        orderBy: { _count: { customerProfileId: 'desc' } },
        take: ADMIN_USAGE_OVERVIEW_RANK_LIMIT,
      }),
    ]);

    const customerUserIds = customerSessionRows.map((row) => row.userId);
    const customerProfileIds = uniqueStrings([
      ...completedCustomerRows.map((row) => row.customerProfileId),
      ...qualityRiskCustomerRows.map((row) => row.customerProfileId),
      ...lowReviewCustomerRows.map((row) => row.customerProfileId),
    ]);
    const providerProfileIds = uniqueStrings([
      ...viewedPartnerRows.map((row) => row.providerProfileId),
      ...requestedPartnerRows.map((row) => row.preferredProviderId),
      ...completedPartnerRows.map((row) => row.selectedProviderId),
    ]);
    const popularServiceIds = popularServiceRows.map((row) => row.serviceId);

    const [customerUsers, customerProfiles, providers, popularServices] = await Promise.all([
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
      popularServiceIds.length
        ? this.prisma.massageService.findMany({
            where: { id: { in: popularServiceIds } },
            select: {
              id: true,
              active: true,
              durationMin: true,
              name: true,
            },
          })
        : [],
    ]);

    const customerUserMap = new Map(customerUsers.map((user) => [user.id, user]));
    const customerProfileMap = new Map(customerProfiles.map((profile) => [profile.id, profile]));
    const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
    const popularServiceMap = new Map(popularServices.map((service) => [service.id, service]));
    const viewedPartnerMap = new Map(
      viewedPartnerRows.map((row) => [
        row.providerProfileId,
        {
          count: row._sum.viewCount ?? row._count._all,
          lastActivityAt: row._max.lastViewedAt,
        },
      ]),
    );
    const requestedPartnerMap = new Map(
      requestedPartnerRows
        .filter((row) => Boolean(row.preferredProviderId))
        .map((row) => [
          row.preferredProviderId as string,
          {
            count: row._count._all,
            lastActivityAt: row._max.createdAt,
          },
        ]),
    );
    const completedPartnerMap = new Map(
      completedPartnerRows
        .filter((row) => Boolean(row.selectedProviderId))
        .map((row) => [
          row.selectedProviderId as string,
          {
            count: row._count._all,
            lastActivityAt: latestDate(row._max.closedAt, row._max.updatedAt),
          },
        ]),
    );
    const partnerDiscoveryConversionRows = providerProfileIds
      .map((providerProfileId) => {
        const provider = providerMap.get(providerProfileId);
        const viewCount = viewedPartnerMap.get(providerProfileId)?.count ?? 0;
        const requestCount = requestedPartnerMap.get(providerProfileId)?.count ?? 0;
        const completedCount = completedPartnerMap.get(providerProfileId)?.count ?? 0;

        return {
          rank: 0,
          id: providerProfileId,
          label: provider?.displayName ?? provider?.user.phone ?? 'Unknown partner',
          secondary: provider?.city ?? provider?.user.phone ?? null,
          href: `/partners/${providerProfileId}?section=full`,
          viewCount,
          requestCount,
          completedCount,
          viewToRequestRate: percentageValue(requestCount, viewCount),
          requestToCompleteRate: percentageValue(completedCount, requestCount),
          lastActivityAt: latestDate(
            viewedPartnerMap.get(providerProfileId)?.lastActivityAt,
            requestedPartnerMap.get(providerProfileId)?.lastActivityAt,
            completedPartnerMap.get(providerProfileId)?.lastActivityAt,
          )?.toISOString() ?? null,
        };
      })
      .filter((row) => row.viewCount > 0 || row.requestCount > 0 || row.completedCount > 0)
      .sort(
        (left, right) =>
          right.viewCount - left.viewCount ||
          right.requestCount - left.requestCount ||
          right.completedCount - left.completedCount,
      )
      .slice(0, ADMIN_USAGE_OVERVIEW_RANK_LIMIT)
      .map((row, index) => ({ ...row, rank: index + 1 }));

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
        partnerProfileViewCount: profileViewAggregate._sum.viewCount ?? 0,
        partnerBookingRequestCount: bookingRequestCount,
      },
      customerLifecycle: {
        newCustomerCount,
        activeCustomerCount,
        activeTodayCustomerCount,
        active7dCustomerCount,
        active30dCustomerCount,
        completedCustomerCount,
        repeatCustomerCount: numberValue(repeatCustomerRows[0]?.count),
        churnRiskCustomerCount,
        neverBookedCustomerCount,
      },
      bookingQuality: {
        createdBookingCount,
        cancellationCount,
        refundCount,
        lowReviewCount,
      },
      paymentAndCoupon: {
        couponBookingCount: numberValue(couponBookingRows[0]?.count),
        paymentFailureCount,
        refundAmount: numberValue(refundAmount._sum.amount),
        paymentMethodMix: paymentMethodRows
          .map((row) => ({
            method: row.method,
            bookingCount: row._count._all,
            amount: row._sum.amount ?? 0,
          }))
          .sort((left, right) => right.amount - left.amount),
      },
      customerSegments: {
        newUnbookedCustomerCount,
        firstCompletedCustomerCount: numberValue(firstCompletedCustomerRows[0]?.count),
        repeatCustomerCount: numberValue(repeatCustomerRows[0]?.count),
        vipCustomerCount: numberValue(vipCustomerRows[0]?.count),
        churnRiskCustomerCount,
        issueCustomerCount: numberValue(issueCustomerRows[0]?.count),
      },
      platformUsage: platformUsageRows.map((row) => ({
        platform: normalizeUsageOverviewPlatform(row.platform),
        sessionCount: row._count._all,
        lastActivityAt: row._max.lastSeenAt?.toISOString() ?? null,
      })),
      behavior: {
        popularServices: popularServiceRows.map((row, index) => {
          const service = popularServiceMap.get(row.serviceId);

          return {
            rank: index + 1,
            id: row.serviceId,
            label: service?.name ?? 'Unknown service',
            secondary: service
              ? `${service.durationMin} min${service.active ? '' : ' · inactive'}`
              : null,
            bookingCount: row._count._all,
            quantity: row._sum.quantity ?? row._count._all,
            amount: row._sum.price ?? 0,
          };
        }),
        hourlyActivity: buildUsageOverviewHourlyActivity(hourlyActivityRows),
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
        qualityRiskCustomers: qualityRiskCustomerRows.map((row, index) => {
          const profile = customerProfileMap.get(row.customerProfileId);

          return {
            rank: index + 1,
            id: row.customerProfileId,
            label: profile?.user.fullName ?? profile?.user.phone ?? 'Unknown customer',
            secondary: profile?.user.phone ?? null,
            href: `/customers/${row.customerProfileId}`,
            value: row._count._all,
            valueLabel: 'signals',
            lastActivityAt: latestDate(row._max.closedAt, row._max.updatedAt)?.toISOString() ?? null,
          };
        }),
        lowReviewCustomers: lowReviewCustomerRows.map((row, index) => {
          const profile = customerProfileMap.get(row.customerProfileId);
          const lowestRating = row._min.rating ?? null;

          return {
            rank: index + 1,
            id: row.customerProfileId,
            label: profile?.user.fullName ?? profile?.user.phone ?? 'Unknown customer',
            secondary: [
              lowestRating ? `Lowest ${lowestRating}/5` : null,
              profile?.user.phone ?? null,
            ].filter(Boolean).join(' · ') || null,
            href: `/customers/${row.customerProfileId}`,
            value: row._count._all,
            valueLabel: 'low reviews',
            lastActivityAt: row._max.createdAt?.toISOString() ?? null,
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
        discoveryConversion: partnerDiscoveryConversionRows,
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

  async getPartnerOverview(
    query: {
      range?: string;
      city?: string;
      serviceId?: string;
      verificationStatus?: string;
      onlineStatus?: string;
      walletStatus?: string;
      riskStatus?: string;
      selectionIssue?: string;
      selectionSort?: string;
    } = {},
  ) {
    const now = new Date();
    const window = adminPartnerOverviewRangeWindow(normalizeAdminPartnerOverviewRange(query.range));
    const dateWhere = adminPartnerOverviewDateWhere(window);
    const active7dStart = partnerOverviewAddUtcDays(partnerOverviewUtcDayStart(now), -6);
    const active30dStart = partnerOverviewAddUtcDays(partnerOverviewUtcDayStart(now), -29);
    const locationFreshBoundary = new Date(now.getTime() - 30 * 60 * 1000);
    const serviceIdFilter = normalizeOptionalText(query.serviceId);
    const verificationStatusFilter = normalizeVerificationStatusFilter(query.verificationStatus);
    const onlineStatusesFilter = normalizePartnerOnlineStatusFilter(query.onlineStatus);
    const riskStatusFilter = normalizePartnerRiskStatusFilter(query.riskStatus);
    const selectionIssueFilter = normalizePartnerSelectionIssueFilter(query.selectionIssue);
    const selectionSort = normalizePartnerSelectionSort(query.selectionSort);

    const walletRows = await this.prisma.providerWalletLedgerEntry.groupBy({
      by: ['providerProfileId'],
      _sum: { amount: true },
    });
    const walletBalanceByProvider = new Map(
      walletRows.map((row) => [row.providerProfileId, numberValue(row._sum.amount)]),
    );
    const negativeWalletIds = Array.from(walletBalanceByProvider.entries())
      .filter(([, amount]) => amount < 0)
      .map(([providerProfileId]) => providerProfileId);
    const positiveWalletIds = Array.from(walletBalanceByProvider.entries())
      .filter(([, amount]) => amount > 0)
      .map(([providerProfileId]) => providerProfileId);
    const walletStatusFilter = normalizePartnerWalletStatusFilter(query.walletStatus);
    const baseWhere = partnerOverviewProviderWhere({
      city: query.city,
      negativeWalletIds,
      onlineStatuses: onlineStatusesFilter,
      positiveWalletIds,
      serviceId: serviceIdFilter,
      verificationStatus: verificationStatusFilter,
      walletStatus: walletStatusFilter,
    });
    const onlineStatuses = [
      ProviderStatus.ONLINE_AVAILABLE,
      ProviderStatus.ONLINE_BUSY,
      ProviderStatus.ONLINE_AVAILABLE_SOON,
    ];
    const cancellationStatuses = [
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
      BookingStatus.EXPIRED,
    ];
    const completedBookingWhere = {
      status: BookingStatus.COMPLETED,
      ...(dateWhere ? { closedAt: dateWhere } : {}),
    } satisfies Prisma.BookingWhereInput;
    const bookingRequestWhere = {
      preferredProviderId: { not: null },
      ...(dateWhere ? { createdAt: dateWhere } : {}),
      ...(serviceIdFilter ? { services: { some: { serviceId: serviceIdFilter } } } : {}),
    } satisfies Prisma.BookingWhereInput;

    const [
      totalPartners,
      approvedPartners,
      pendingVerification,
      onlineNow,
      locationFreshPartners,
      activePartners7d,
      inactivePartners7d,
      averageRating,
      providerRows,
      openBookingRows,
      failedBookingRows,
      serviceCatalogRows,
      openServiceRows,
      completedServiceRows,
      completedByProviderRows,
      cancelledByProviderRows,
      lowReviewRows,
      noShowReportRows,
      grossEarnings,
      pendingEarnings,
      paidEarnings,
      payoutReadyRows,
      payoutPaidRows,
      responseTimeRows,
      areaResponseRows,
      requestViewedProviderRows,
      requestDetailedProviderRows,
      requestDetailDurationRows,
      requestNotificationUserRows,
      serviceStartedUserRows,
      profileViewRows,
      favoriteProviderRows,
    ] = await Promise.all([
      this.prisma.providerProfile.count({ where: baseWhere }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, {
          verification: { is: { status: VerificationStatus.APPROVED } },
        }),
      }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, {
          OR: [
            { verification: { is: { status: VerificationStatus.SUBMITTED } } },
            { kyc: { is: { status: ProviderKycStatus.PENDING } } },
            { documents: { some: { status: ProviderDocumentStatus.PENDING_REVIEW, deletedAt: null } } },
          ],
        }),
      }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, { status: { in: onlineStatuses } }),
      }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, {
          currentLocationUpdatedAt: { gte: locationFreshBoundary },
        }),
      }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, {
          OR: [
            { sessions: { some: { lastSeenAt: { gte: active7dStart } } } },
            { participants: { some: { joinedAt: { gte: active7dStart } } } },
            { selectedBookings: { some: { updatedAt: { gte: active7dStart } } } },
          ],
        }),
      }),
      this.prisma.providerProfile.count({
        where: partnerOverviewAnd(baseWhere, {
          verification: { is: { status: VerificationStatus.APPROVED } },
          sessions: { none: { lastSeenAt: { gte: active7dStart } } },
          participants: { none: { joinedAt: { gte: active7dStart } } },
          selectedBookings: { none: { updatedAt: { gte: active7dStart } } },
        }),
      }),
      this.prisma.review.aggregate({
        where: {
          status: ReviewStatus.PUBLISHED,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.providerProfile.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_PARTNER_OVERVIEW_PARTNER_SCAN_LIMIT,
        select: {
          id: true,
          displayName: true,
          city: true,
          residentialAddress: true,
          serviceArea: true,
          status: true,
          ratingAvg: true,
          reviewCount: true,
          currentLat: true,
          currentLng: true,
          currentLocationUpdatedAt: true,
          nextAvailableAt: true,
          blockedAt: true,
          blockedReason: true,
          updatedAt: true,
          user: {
            select: {
              createdAt: true,
              fileAssets: {
                where: {
                  purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                  visibility: FileVisibility.PUBLIC,
                  uploadStatus: FileUploadStatus.UPLOADED,
                  reviewStatus: FileReviewStatus.APPROVED,
                },
                orderBy: { createdAt: 'desc' },
                take: 6,
                select: {
                  purpose: true,
                  url: true,
                },
              },
              fullName: true,
              phone: true,
            },
          },
          verification: {
            select: {
              reviewedAt: true,
              status: true,
              submittedAt: true,
            },
          },
          kyc: {
            select: {
              reviewedAt: true,
              status: true,
              submittedAt: true,
            },
          },
          taxProfile: {
            select: {
              status: true,
            },
          },
          services: {
            where: { active: true },
            select: {
              price: true,
              serviceId: true,
              service: {
                select: {
                  active: true,
                  basePrice: true,
                  durationMin: true,
                  id: true,
                  name: true,
                },
              },
            },
          },
          sessions: {
            orderBy: { lastSeenAt: 'desc' },
            take: 1,
            select: {
              appVersion: true,
              lastSeenAt: true,
            },
          },
          selectedBookings: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              closedAt: true,
              id: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.booking.findMany({
        where: { ...bookingRequestWhere, status: BookingStatus.OPEN_MATCHING },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_PARTNER_OVERVIEW_BOOKING_SCAN_LIMIT,
        select: {
          address: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
          lat: true,
          lng: true,
        },
      }),
      this.prisma.booking.findMany({
        where: {
          status: { in: cancellationStatuses },
          ...(dateWhere ? { OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }] } : {}),
          ...(serviceIdFilter ? { services: { some: { serviceId: serviceIdFilter } } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_PARTNER_OVERVIEW_BOOKING_SCAN_LIMIT,
        select: {
          address: true,
          addressSnapshot: {
            select: {
              address: true,
              addressText: true,
              latitude: true,
              longitude: true,
            },
          },
          lat: true,
          lng: true,
        },
      }),
      this.prisma.massageService.findMany({
        where: {
          active: true,
          ...(serviceIdFilter ? { id: serviceIdFilter } : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: ADMIN_PARTNER_OVERVIEW_SERVICE_LIMIT,
        select: {
          durationMin: true,
          id: true,
          name: true,
        },
      }),
      this.prisma.bookingService.groupBy({
        by: ['serviceId'],
        where: {
          ...(serviceIdFilter ? { serviceId: serviceIdFilter } : {}),
          booking: { is: { ...bookingRequestWhere, status: BookingStatus.OPEN_MATCHING } },
        },
        _count: { _all: true },
      }),
      this.prisma.bookingService.groupBy({
        by: ['serviceId'],
        where: {
          ...(serviceIdFilter ? { serviceId: serviceIdFilter } : {}),
          booking: { is: completedBookingWhere },
        },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['selectedProviderId'],
        where: {
          selectedProviderId: { not: null },
          ...completedBookingWhere,
        },
        _count: { _all: true },
        _max: { closedAt: true, updatedAt: true },
        orderBy: { _count: { selectedProviderId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.booking.groupBy({
        by: ['selectedProviderId'],
        where: {
          selectedProviderId: { not: null },
          status: { in: cancellationStatuses },
          ...(dateWhere ? { OR: [{ closedAt: dateWhere }, { updatedAt: dateWhere }] } : {}),
        },
        _count: { _all: true },
        _max: { closedAt: true, updatedAt: true },
        orderBy: { _count: { selectedProviderId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.review.groupBy({
        by: ['providerProfileId'],
        where: {
          rating: { lte: 2 },
          status: ReviewStatus.PUBLISHED,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
        },
        _count: { _all: true },
        _min: { rating: true },
        _max: { createdAt: true },
        orderBy: { _count: { providerProfileId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.providerReport.groupBy({
        by: ['providerProfileId'],
        where: {
          status: ProviderReportStatus.OPEN,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          OR: [
            { category: { contains: 'no-show', mode: 'insensitive' } },
            { summary: { contains: 'no-show', mode: 'insensitive' } },
            { details: { contains: 'no-show', mode: 'insensitive' } },
          ],
        },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _count: { providerProfileId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.providerEarning.aggregate({
        where: {
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        _sum: { grossAmount: true, platformFee: true, netAmount: true },
      }),
      this.prisma.providerEarning.aggregate({
        where: {
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.aggregate({
        where: {
          status: EarningStatus.PAID,
          ...(dateWhere ? { paidAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          ...(dateWhere ? { createdAt: dateWhere } : {}),
        },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          status: EarningStatus.PAID,
          ...(dateWhere ? { paidAt: dateWhere } : {}),
        },
      }),
      this.prisma.$queryRaw<Array<{ avgSeconds: number | null }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM ("respondedAt" - "joinedAt")))::float AS "avgSeconds"
        FROM "BookingParticipant"
        WHERE "respondedAt" IS NOT NULL
        ${partnerOverviewJoinedAtSql(dateWhere)}
      `),
      this.prisma.bookingParticipant.findMany({
        where: {
          respondedAt: { not: null },
          ...(dateWhere ? { joinedAt: dateWhere } : {}),
          ...(serviceIdFilter
            ? { booking: { is: { services: { some: { serviceId: serviceIdFilter } } } } }
            : {}),
          providerProfile: { is: baseWhere },
        },
        orderBy: { joinedAt: 'desc' },
        take: ADMIN_PARTNER_OVERVIEW_RESPONSE_EVENT_SCAN_LIMIT,
        select: {
          providerProfileId: true,
          joinedAt: true,
          respondedAt: true,
          booking: {
            select: {
              address: true,
              addressSnapshot: {
                select: {
                  address: true,
                  addressText: true,
                  latitude: true,
                  longitude: true,
                },
              },
              lat: true,
              lng: true,
            },
          },
        },
      }),
      this.prisma.providerBookingRequestEvent.groupBy({
        by: ['providerProfileId'],
        where: {
          eventType: ADMIN_PARTNER_OVERVIEW_REQUEST_LIST_VIEWED_EVENT,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
      }),
      this.prisma.providerBookingRequestEvent.groupBy({
        by: ['providerProfileId'],
        where: {
          eventType: ADMIN_PARTNER_OVERVIEW_REQUEST_DETAIL_VIEWED_EVENT,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
      }),
      this.prisma.providerBookingRequestEvent.findMany({
        where: {
          eventType: { in: [...ADMIN_PARTNER_OVERVIEW_REQUEST_DETAIL_DURATION_EVENTS] },
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_PARTNER_OVERVIEW_DETAIL_DURATION_EVENT_SCAN_LIMIT,
        select: { metadata: true },
      }),
      this.prisma.notification.groupBy({
        by: ['userId'],
        where: {
          type: { in: [...ADMIN_PARTNER_OVERVIEW_REQUEST_NOTIFICATION_TYPES] },
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          user: { is: { providerProfile: { is: baseWhere } } },
        },
      }),
      this.prisma.notification.groupBy({
        by: ['userId'],
        where: {
          type: ADMIN_PARTNER_OVERVIEW_SERVICE_STARTED_NOTIFICATION_TYPE,
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          user: { is: { providerProfile: { is: baseWhere } } },
        },
      }),
      this.prisma.customerProviderProfileView.groupBy({
        by: ['providerProfileId'],
        where: {
          ...(dateWhere ? { lastViewedAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        _count: { _all: true },
        _sum: { viewCount: true },
        _max: { lastViewedAt: true },
        orderBy: { _count: { providerProfileId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
      this.prisma.customerFavoriteProvider.groupBy({
        by: ['providerProfileId'],
        where: {
          ...(dateWhere ? { createdAt: dateWhere } : {}),
          providerProfile: { is: baseWhere },
        },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _count: { providerProfileId: 'desc' } },
        take: ADMIN_PARTNER_OVERVIEW_RANK_LIMIT,
      }),
    ]);

    const completedMap = new Map(
      completedByProviderRows
        .filter((row) => Boolean(row.selectedProviderId))
        .map((row) => [
          row.selectedProviderId as string,
          {
            count: row._count._all,
            lastActivityAt: latestDate(row._max.closedAt, row._max.updatedAt),
          },
        ]),
    );
    const cancelledMap = new Map(
      cancelledByProviderRows
        .filter((row) => Boolean(row.selectedProviderId))
        .map((row) => [
          row.selectedProviderId as string,
          {
            count: row._count._all,
            lastActivityAt: latestDate(row._max.closedAt, row._max.updatedAt),
          },
        ]),
    );
    const lowReviewMap = new Map(
      lowReviewRows.map((row) => [
        row.providerProfileId,
        {
          count: row._count._all,
          lastActivityAt: row._max.createdAt,
          rating: row._min.rating,
        },
      ]),
    );
    const noShowReportMap = new Map(
      noShowReportRows.map((row) => [
        row.providerProfileId,
        {
          count: row._count._all,
          lastActivityAt: row._max.createdAt,
        },
      ]),
    );
    const payoutReadyProviderIds = new Set(payoutReadyRows.map((row) => row.providerProfileId));
    const payoutPaidProviderIds = new Set(payoutPaidRows.map((row) => row.providerProfileId));
    const eligibleProviderIds = new Set(
      providerRows
        .filter((provider) =>
          partnerOverviewProviderEligible(provider, walletBalanceByProvider.get(provider.id), locationFreshBoundary),
        )
        .map((provider) => provider.id),
    );
    const documentsSubmittedCount = providerRows.filter(
      (provider) => provider.verification?.submittedAt || provider.kyc?.submittedAt,
    ).length;
    const firstOnlineCount = providerRows.filter((provider) => provider.sessions[0]?.lastSeenAt).length;
    const locationUpdatedCount = providerRows.filter((provider) => provider.currentLocationUpdatedAt).length;
    const servicesSetCount = providerRows.filter((provider) => provider.services.length > 0).length;
    const joinedRequestProviderCount = new Set([
      ...completedByProviderRows.map((row) => row.selectedProviderId).filter(Boolean),
      ...cancelledByProviderRows.map((row) => row.selectedProviderId).filter(Boolean),
    ]).size;
    const completedProviderCount = new Set(
      completedByProviderRows.map((row) => row.selectedProviderId).filter(Boolean),
    ).size;
    const averageResponseSeconds = Math.round(numberValue(responseTimeRows[0]?.avgSeconds));
    const averageDetailViewSeconds = partnerOverviewAverageDetailDurationSeconds(requestDetailDurationRows);
    const requestViewedProviderCount = requestViewedProviderRows.length;
    const requestDetailedProviderCount = requestDetailedProviderRows.length;
    const requestNotificationProviderCount = requestNotificationUserRows.length;
    const serviceStartedProviderCount = serviceStartedUserRows.length;
    const averageResponseSecondsByRegion = partnerOverviewAreaAverageResponseSeconds(areaResponseRows);
    const averageResponseSecondsByProvider = partnerOverviewAverageResponseSecondsByProvider(areaResponseRows);
    const profileViewMap = partnerOverviewProfileViewMap(profileViewRows);
    const favoriteMap = partnerOverviewFavoriteMap(favoriteProviderRows);

    const areaRows = partnerOverviewAreaRows({
      averageResponseSecondsByRegion,
      eligibleProviderIds,
      failedBookingRows,
      locationFreshBoundary,
      openBookingRows,
      providerRows,
    });
    const serviceRows = partnerOverviewServiceRows({
      completedServiceRows,
      eligibleProviderIds,
      openServiceRows,
      providerRows,
      serviceCatalogRows,
    });
    const partnerFacts = providerRows.map((provider) =>
      partnerOverviewProviderFact({
        active7dStart,
        active30dStart,
        cancelledMap,
        completedMap,
        locationFreshBoundary,
        lowReviewMap,
        noShowReportMap,
        provider,
        walletBalance: walletBalanceByProvider.get(provider.id) ?? 0,
      }),
    );
    const displayPartnerFacts = riskStatusFilter
      ? partnerFacts.filter((fact) => fact.riskLevel === riskStatusFilter)
      : partnerFacts;
    const negativeWalletFacts = displayPartnerFacts
      .filter((fact) => fact.walletBalance < 0)
      .sort((left, right) => left.walletBalance - right.walletBalance);
    const qualityRiskFacts = displayPartnerFacts
      .filter(
        (fact) =>
          fact.riskLevel === 'critical' ||
          fact.riskLevel === 'high' ||
          fact.cancellationRate >= 20 ||
          fact.lowReviewCount > 0 ||
          fact.noShowReports > 0,
      )
      .sort(
        (left, right) =>
          partnerOverviewRiskWeight(right.riskLevel) - partnerOverviewRiskWeight(left.riskLevel) ||
          right.lowReviewCount - left.lowReviewCount ||
          right.cancellationRate - left.cancellationRate,
      );

    const actionLists = partnerOverviewActionLists(displayPartnerFacts);
    const selectionFriction = partnerOverviewSelectionFrictionRows({
      averageResponseSecondsByProvider,
      favoriteMap,
      profileViewMap,
      providerFacts: displayPartnerFacts,
      selectionIssue: selectionIssueFilter,
      selectionSort,
    });
    const grossBookingAmount = numberValue(grossEarnings._sum.grossAmount);
    const platformFee = numberValue(grossEarnings._sum.platformFee);
    const walletBalanceTotal = Array.from(walletBalanceByProvider.values()).reduce((sum, amount) => sum + amount, 0);
    const negativeWalletTotal = Array.from(walletBalanceByProvider.values())
      .filter((amount) => amount < 0)
      .reduce((sum, amount) => sum + amount, 0);

    return {
      generatedAt: now.toISOString(),
      refreshSeconds: 60,
      source: 'stored-partner-supply-aggregates',
      range: window.range,
      rangeLabel: window.label,
      windowStartAt: window.startAt?.toISOString() ?? null,
      windowEndAt: window.endAt?.toISOString() ?? null,
      filters: {
        city: normalizeOptionalText(query.city),
        onlineStatus: normalizeOptionalText(query.onlineStatus),
        riskStatus: riskStatusFilter,
        selectionIssue: selectionIssueFilter,
        selectionSort,
        serviceId: serviceIdFilter,
        verificationStatus: normalizeOptionalText(query.verificationStatus),
        walletStatus: walletStatusFilter,
      },
      summaryKpis: [
        partnerOverviewKpi('totalPartners', 'Total Partners', totalPartners, 'Registered Partner accounts'),
        partnerOverviewKpi('approvedPartners', 'Approved Partners', approvedPartners, 'Admin-approved public supply'),
        partnerOverviewKpi('pendingVerification', 'Pending Verification', pendingVerification, 'Needs approval work'),
        partnerOverviewKpi('onlineNow', 'Online Now', onlineNow, 'Ready, busy, or soon-online Partners'),
        partnerOverviewKpi('locationFreshPartners', 'Location Fresh Partners', locationFreshPartners, 'Updated in 30 min'),
        partnerOverviewKpi('eligibleToAccept', 'Eligible To Accept', eligibleProviderIds.size, 'Can accept a booking now'),
        partnerOverviewKpi('activePartners7D', 'Active Partners 7D', activePartners7d, 'Online or booking activity'),
        partnerOverviewKpi('inactivePartners7D', 'Inactive Partners 7D', inactivePartners7d, 'Approved with no 7D signal'),
        partnerOverviewKpi(
          'averageResponseTime',
          'Average Response Time',
          averageResponseSeconds > 0 ? averageResponseSeconds : null,
          'Joined/response proxy',
          'seconds',
        ),
        partnerOverviewKpi(
          'averageDetailViewTime',
          'Average Detail View Time',
          averageDetailViewSeconds,
          'Heartbeat/close telemetry',
          'seconds',
        ),
        partnerOverviewKpi(
          'averageRating',
          'Average Rating',
          averageRating._count.rating > 0 ? Number(averageRating._avg.rating ?? 0) : null,
          `${averageRating._count.rating} published reviews`,
          'rating',
        ),
      ],
      operatingStatus: {
        cards: partnerOverviewOperatingStatusCards(displayPartnerFacts),
      },
      supplyHealth: {
        areas: areaRows,
        services: serviceRows,
      },
      funnel: {
        steps: partnerOverviewFunnelSteps([
          ['Signed Up', totalPartners],
          ['Profile Completed', providerRows.filter((provider) => Boolean(provider.displayName && provider.city)).length],
          ['Documents Submitted', documentsSubmittedCount],
          ['Approved', approvedPartners],
          ['First Online', firstOnlineCount],
          ['Location Updated', locationUpdatedCount],
          ['Services & Prices Set', servicesSetCount],
          ['Request Notification Received', requestNotificationProviderCount],
          ['Request Viewed', requestViewedProviderCount],
          ['Request Detailed', requestDetailedProviderCount],
          ['Joined / Accepted Request', joinedRequestProviderCount],
          ['Customer Selected', completedProviderCount],
          ['Service Started', serviceStartedProviderCount],
          ['Service Completed', completedProviderCount],
          ['Payout Ready', payoutReadyProviderIds.size],
          ['Payout Completed', payoutPaidProviderIds.size],
        ]),
      },
      activityRetention: {
        cards: [
          partnerOverviewKpi(
            'approvedNeverOnline',
            'Approved but never online',
            partnerFacts.filter((fact) => fact.approved && !fact.lastOnlineAt).length,
            'Needs activation follow-up',
          ),
          partnerOverviewKpi(
            'approvedNoCompletedBooking',
            'Approved but no completed booking',
            partnerFacts.filter((fact) => fact.approved && fact.completedBookings === 0).length,
            'First job pending',
          ),
          partnerOverviewKpi(
            'inactive7d',
            'No activity in last 7 days',
            partnerFacts.filter((fact) => fact.approved && fact.inactive7d).length,
            'Recently cold supply',
          ),
          partnerOverviewKpi(
            'inactive30d',
            'No activity in last 30 days',
            partnerFacts.filter((fact) => fact.approved && fact.inactive30d).length,
            'Churn risk supply',
          ),
          partnerOverviewKpi(
            'highActivity',
            'High activity partners',
            partnerFacts.filter((fact) => fact.completedBookings >= 3 || fact.status !== ProviderStatus.OFFLINE).length,
            'Active supply anchors',
          ),
        ],
      },
      bookingQuality: {
        kpis: [
          partnerOverviewKpi(
            'completionRate',
            'Completion Rate',
            percentageValue(completedProviderCount, joinedRequestProviderCount || totalPartners),
            'Completed Partner cohort',
            'percent',
          ),
          partnerOverviewKpi(
            'partnerCancellationRate',
            'Partner Cancellation Rate',
            percentageValue(
              cancelledByProviderRows.reduce((sum, row) => sum + row._count._all, 0),
              completedByProviderRows.reduce((sum, row) => sum + row._count._all, 0) +
                cancelledByProviderRows.reduce((sum, row) => sum + row._count._all, 0),
            ),
            'Cancelled / completed + cancelled',
            'percent',
          ),
          partnerOverviewKpi(
            'noShowReports',
            'No-show Reports',
            noShowReportRows.reduce((sum, row) => sum + row._count._all, 0),
            'Open report records',
          ),
          partnerOverviewKpi(
            'lowRatingReviews',
            'Low Rating Reviews',
            lowReviewRows.reduce((sum, row) => sum + row._count._all, 0),
            'Published <= 2 stars',
          ),
          partnerOverviewKpi(
            'reviewCount',
            'Review Count',
            averageRating._count.rating,
            'Published reviews in range',
          ),
        ],
        riskPartners: qualityRiskFacts.slice(0, ADMIN_PARTNER_OVERVIEW_RANK_LIMIT),
      },
      financeWalletRisk: {
        kpis: [
          partnerOverviewKpi('grossBookingAmount', 'Partner Gross Booking Amount', grossBookingAmount, 'From earnings', 'money'),
          partnerOverviewKpi('platformFee', 'Platform Fee', platformFee, 'Company revenue component', 'money'),
          partnerOverviewKpi(
            'partnerPayoutPending',
            'Partner Payout Pending',
            numberValue(pendingEarnings._sum.netAmount),
            'Withdrawal payable exposure',
            'money',
          ),
          partnerOverviewKpi(
            'partnerPayoutCompleted',
            'Partner Payout Completed',
            numberValue(paidEarnings._sum.netAmount),
            'Paid earning rows',
            'money',
          ),
          partnerOverviewKpi('partnerWalletBalanceTotal', 'Partner Wallet Balance Total', walletBalanceTotal, 'Ledger sum', 'money'),
          partnerOverviewKpi('negativeWalletTotal', 'Negative Wallet Total', negativeWalletTotal, 'Company receivable', 'money'),
          partnerOverviewKpi('partnersWithNegativeWallet', 'Partners With Negative Wallet', negativeWalletFacts.length, 'Receivable partners'),
          partnerOverviewKpi('payoutBlockedPartners', 'Payout Blocked Partners', negativeWalletFacts.length, 'Policy display only'),
          partnerOverviewKpi(
            'taxInfoMissingPartners',
            'Tax Info Missing Partners',
            partnerFacts.filter((fact) => fact.taxStatus !== ProviderTaxProfileStatus.APPROVED).length,
            'Tax profile not approved',
          ),
        ],
        negativeWalletPartners: negativeWalletFacts.slice(0, ADMIN_PARTNER_OVERVIEW_RANK_LIMIT),
        policyNote:
          'Negative wallet Partners can still join requests, but final booking acceptance may be blocked by wallet policy.',
      },
      selectionFriction: {
        ...selectionFriction,
      },
      actionLists,
      segments: partnerOverviewSegments(displayPartnerFacts),
      dataNotes: [
        'Request viewed and detailed are counted from persisted Partner request view events.',
        'Detailed online duration uses bounded heartbeat/close telemetry when available.',
        'Request notification received and service started are counted from persisted Partner notification records.',
        'Eligible To Accept uses current approval, KYC, online status, fresh location, active services, block state, and wallet balance.',
      ],
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
      this.marketingSpendDimensionRows(marketingSpendWhere),
    ]);
    const manualAdSpend = marketingSpendRows.reduce(
      (total, row) => total + numberValue(row.stats.adSpend),
      0,
    );

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
    const unknownStats = {
      ...stats,
      signups: Math.max(0, signupCount - referralSignupCount),
      firstBookingCompleted: Math.max(0, stats.firstBookingCompleted - referralRewardCount),
    };
    const referralStats = {
      ...emptyMarketingStats(),
      signups: referralSignupCount,
      firstBookingCompleted: referralRewardCount,
    };
    const sourceRows = buildMarketingDimensionRows(
      [
        { source: 'unknown', stats: unknownStats },
        { source: 'referral', stats: referralStats },
        ...marketingSpendRows,
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
            firstBookingCompleted: row.rewards.filter(
              (reward) => reward.status !== ReferralRewardStatus.CANCELLED,
            ).length,
          },
        })),
        ...marketingSpendRows,
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
          regionValues: [row.regionName, row.regionCode],
          stats: { adSpend: numberValue(row.stats.adSpend) },
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
        ...marketingSpendRows,
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
      dataGaps: ADMIN_MARKETING_DATA_GAPS,
    };
  }

  async listMarketingDimensionRows(
    query: {
      dimension?: string;
      range?: string;
      source?: string;
      platform?: string;
      regionCode?: string;
      campaignId?: string;
      take?: number | string;
      skip?: number | string;
    } = {},
  ) {
    const dimension = normalizeAdminMarketingDimensionKey(query.dimension);
    const take = adminMarketingDimensionTake(query.take);
    const skip = boundedAdminListSkip(query.skip);
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
    let rows: AdminMarketingDimensionRow[] = [];

    if (dimension === 'platform') {
      const [firstOpenPlatformRows, marketingSpendRows] = await Promise.all([
        this.prisma.appSession.groupBy({
          by: ['platform'],
          where: {
            role: Role.CUSTOMER,
            createdAt: dateWhere,
          },
          _count: { _all: true },
        }),
        this.marketingSpendDimensionRows(marketingSpendWhere),
      ]);

      rows = buildMarketingDimensionRows(
        [
          ...firstOpenPlatformRows.map((row) => ({
            source: 'unknown' as const,
            platform: normalizeMarketingPlatform(row.platform),
            stats: { firstOpens: row._count._all },
          })),
          ...marketingSpendRows,
        ],
        filters,
      );
    }

    if (dimension === 'campaign') {
      const [referralCampaignRows, marketingSpendRows] = await Promise.all([
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
        this.marketingSpendDimensionRows(marketingSpendWhere),
      ]);

      rows = buildMarketingDimensionRows(
        [
          ...referralCampaignRows.map((row) => ({
            source: normalizeMarketingSource(row.installSource ?? 'referral'),
            platform: normalizeMarketingPlatform(row.platform),
            campaignId: row.referralCode.code,
            campaignName: `Referral ${row.referralCode.code}`,
            stats: {
              signups: 1,
              firstBookingCompleted: row.rewards.filter(
                (reward) => reward.status !== ReferralRewardStatus.CANCELLED,
              ).length,
            },
          })),
          ...marketingSpendRows,
        ],
        filters,
      );
    }

    if (dimension === 'region') {
      const [
        regionAddressRows,
        regionBookingCreatedRows,
        regionBookingCompletedRows,
        regionBookingCancelledRows,
        marketingSpendRows,
      ] = await Promise.all([
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
        this.marketingSpendDimensionRows(marketingSpendWhere),
      ]);

      rows = buildMarketingRegionRows(
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
            regionValues: [row.regionName, row.regionCode],
            stats: { adSpend: row.stats.adSpend },
          })),
        ],
        filters,
      );
    }

    if (dimension === 'source') {
      const customerSignupWhere = {
        roles: { has: Role.CUSTOMER },
        createdAt: dateWhere,
      } satisfies Prisma.UserWhereInput;
      const [
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
        referralCampaignRows,
        marketingSpendRows,
      ] = await Promise.all([
        this.prisma.appSession.count({
          where: {
            role: Role.CUSTOMER,
            createdAt: dateWhere,
          },
        }),
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
        this.marketingSpendDimensionRows(marketingSpendWhere),
      ]);
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
        adSpend: marketingSpendRows.reduce((total, row) => total + numberValue(row.stats.adSpend), 0),
      };
      const referralRewardCount = referralCampaignRows.reduce(
        (total, row) =>
          total + row.rewards.filter((reward) => reward.status !== ReferralRewardStatus.CANCELLED).length,
        0,
      );

      rows = buildMarketingDimensionRows(
        [
          {
            source: 'unknown',
            stats: {
              ...stats,
              signups: Math.max(0, signupCount - referralSignupCount),
              firstBookingCompleted: Math.max(0, stats.firstBookingCompleted - referralRewardCount),
            },
          },
          {
            source: 'referral',
            stats: {
              ...emptyMarketingStats(),
              signups: referralSignupCount,
              firstBookingCompleted: referralRewardCount,
            },
          },
          ...marketingSpendRows,
        ],
        { source: filters.source },
      );
    }

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
      dimension,
      rows: rows.slice(skip, skip + take),
      skip,
      take,
      totalCount: rows.length,
    };
  }

  private async marketingSpendDimensionRows(
    where: Prisma.MarketingSpendDailyWhereInput,
  ): Promise<AdminMarketingDimensionInput[]> {
    const rows = await this.prisma.marketingSpendDaily.groupBy({
      by: ['source', 'platform', 'regionCode', 'campaignId', 'campaignName'],
      where,
      _sum: { spendAmount: true },
    });

    return rows.map((row) => {
      const regionCode = normalizeMarketingSpendRegionCode(row.regionCode, { allowAll: true });

      return {
        source: normalizeMarketingSource(row.source),
        platform: normalizeMarketingPlatform(row.platform),
        regionCode: regionCode ?? undefined,
        regionName: regionCode ? vietnamRegionLabel(regionCode) : undefined,
        campaignId: row.campaignId === 'all' ? null : row.campaignId,
        campaignName: row.campaignName,
        stats: { adSpend: numberValue(row._sum.spendAmount) },
      };
    });
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

  async getMarketingSummary(
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
    const marketingSpendWhere = {
      spendDate: dateWhere,
      ...(sourceFilter ? { source: sourceFilter } : {}),
      ...(platformFilter ? { platform: platformFilter } : {}),
      ...(regionCodeFilter ? { regionCode: regionCodeFilter } : {}),
      ...(campaignIdFilter ? { campaignId: campaignIdFilter } : {}),
    } satisfies Prisma.MarketingSpendDailyWhereInput;

    const [
      firstOpenCount,
      signupCount,
      addressSaveCount,
      bookingCreatedCount,
      bookingCompletedCount,
      bookingCancelledCount,
      grossBookingValue,
      platformFeeRevenue,
      refundAmount,
      firstRepeatCompleted,
      manualAdSpend,
    ] = await Promise.all([
      this.prisma.appSession.count({ where: appFirstOpenWhere }),
      this.prisma.user.count({ where: customerSignupWhere }),
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
      this.prisma.marketingSpendDaily.aggregate({
        where: marketingSpendWhere,
        _sum: { spendAmount: true },
      }),
    ]);
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
      adSpend: numberValue(manualAdSpend._sum.spendAmount),
    };

    return {
      generatedAt: new Date().toISOString(),
      refreshSeconds: 300,
      source: 'stored-marketing-aggregates',
      range: window.range,
      rangeLabel: window.label,
      windowStartAt: window.startAt.toISOString(),
      windowEndAt: window.endAt.toISOString(),
      filters: {
        source: sourceFilter ?? null,
        platform: platformFilter ?? null,
        regionCode: regionCodeFilter ?? null,
        campaignId: campaignIdFilter ?? null,
      },
      totals: withMarketingRates(stats),
      funnel: buildMarketingFunnel(stats),
      topInsights: buildMarketingInsights(stats, []),
      dataGaps: ADMIN_MARKETING_DATA_GAPS,
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
    const where = await this.partnerDirectoryWhere(options);
    const skip = adminPartnerDirectorySkip(options.skip);
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: adminPartnerDirectoryOrderBy(options.sort),
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
    const where = await this.partnerDirectoryWhere(options);
    const totalCount = await this.prisma.providerProfile.count({
      ...(where ? { where } : {}),
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
    };
  }

  private async partnerDirectoryWhere(options: AdminPartnerDirectorySummaryOptions) {
    const whereClauses = [adminPartnerDirectoryWhere(options)];
    const unsettledWhere = await this.partnerDirectoryUnsettledWhere(options.review);

    if (unsettledWhere) {
      whereClauses.push(unsettledWhere);
    }

    return adminPartnerDirectoryAndWhere(whereClauses);
  }

  private async partnerDirectoryUnsettledWhere(reviewValue: string | null | undefined) {
    const review = normalizeNullable(reviewValue);

    if (review !== 'unsettled' && review !== 'cash-debt') {
      return undefined;
    }

    const rows = await this.prisma.providerEarning.groupBy({
      by: ['providerProfileId'],
      where: {
        payoutBatchId: null,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
      },
      _sum: { netAmount: true },
    });
    const providerIds = rows
      .filter((row) => numberValue(row._sum.netAmount) < 0)
      .map((row) => row.providerProfileId);

    return {
      id: { in: providerIds },
    } satisfies Prisma.ProviderProfileWhereInput;
  }

  listFileReviewProviders(options: AdminFileReviewProviderListOptions = {}) {
    const skip = boundedAdminListSkip(options.skip);
    return this.prisma.providerProfile.findMany({
      where: adminProviderFileReviewWhere,
      orderBy: { id: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: boundedAdminListLimit(options.take, ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT),
      select: adminProviderFileReviewSelect,
    });
  }

  async fileReviewSummary() {
    const privateFileWhere = adminFileReviewPrivateFileWhere();
    const publicMediaWhere = adminFileReviewPublicMediaWhere();
    const fileWhere = adminFileReviewFileWhere();
    const [privateFiles, publicMedia, approved, rejected, uploadIncomplete, totalProviders] =
      await Promise.all([
        this.prisma.fileAsset.count({ where: privateFileWhere }),
        this.prisma.fileAsset.count({ where: publicMediaWhere }),
        this.prisma.fileAsset.count({
          where: {
            AND: [fileWhere, { reviewStatus: FileReviewStatus.APPROVED }],
          },
        }),
        this.prisma.fileAsset.count({
          where: {
            AND: [fileWhere, { reviewStatus: FileReviewStatus.REJECTED }],
          },
        }),
        this.prisma.fileAsset.count({
          where: {
            AND: [privateFileWhere, { uploadStatus: { not: FileUploadStatus.UPLOADED } }],
          },
        }),
        this.prisma.providerProfile.count({ where: adminProviderFileReviewWhere }),
      ]);
    const total = privateFiles + publicMedia;

    return {
      approved,
      generatedAt: new Date().toISOString(),
      pendingReview: Math.max(0, total - approved),
      privateFiles,
      publicMedia,
      rejected,
      total,
      totalProviders,
      uploadIncomplete,
    };
  }

  async listOperationsHandoffProviders(options: AdminOperationsHandoffProviderListOptions = {}) {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: boundedAdminListLimit(options.take, ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT),
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

  async listOperationsPolicyProviders(options: AdminOperationsPolicyProviderListOptions = {}) {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: adminOperationsPolicyProviderListTake(options.take),
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

  async partnerControlSummary() {
    const staleLocationBefore = new Date(
      Date.now() - ADMIN_PARTNER_CONTROL_LOCATION_FRESHNESS_MINUTES * 60_000,
    );
    const [
      openReports,
      urgentMajorReports,
      activeControls,
      blockedAccounts,
      locationGaps,
      onboardingGaps,
      walletRows,
      sharedDeviceRows,
    ] = await Promise.all([
      this.prisma.providerReport.count({
        where: { status: { in: [ProviderReportStatus.OPEN, ProviderReportStatus.INVESTIGATING] } },
      }),
      this.prisma.providerReport.count({
        where: { severity: { in: [ProviderReportSeverity.CRITICAL, ProviderReportSeverity.HIGH] } },
      }),
      this.prisma.providerSanction.count({ where: { status: ProviderSanctionStatus.ACTIVE } }),
      this.prisma.providerProfile.count({ where: { blockedAt: { not: null } } }),
      this.prisma.providerProfile.count({
        where: {
          OR: [
            { currentLat: null },
            { currentLng: null },
            { currentLocationUpdatedAt: null },
            { currentLocationUpdatedAt: { lt: staleLocationBefore } },
          ],
          status: {
            in: [
              ProviderStatus.ONLINE_AVAILABLE,
              ProviderStatus.ONLINE_BUSY,
              ProviderStatus.ONLINE_AVAILABLE_SOON,
            ],
          },
        },
      }),
      this.prisma.providerProfile.count({
        where: {
          OR: [
            { kyc: { is: null } },
            { kyc: { is: { status: { not: ProviderKycStatus.APPROVED } } } },
            { bankAccounts: { none: { status: ProviderBankAccountStatus.APPROVED } } },
            { taxProfile: { is: null } },
            { taxProfile: { is: { status: { not: ProviderTaxProfileStatus.APPROVED } } } },
          ],
        },
      }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId'],
        where: {
          payoutBatchId: null,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
        _sum: { netAmount: true },
      }),
      this.prisma.providerDevice.groupBy({
        by: ['deviceId'],
        where: { blockedAt: null, enabled: true },
        _count: { providerProfileId: true },
      }),
    ]);
    const sharedDeviceIds = sharedDeviceRows
      .filter((row) => numberValue(row._count.providerProfileId) > 1)
      .map((row) => row.deviceId)
      .filter((deviceId): deviceId is string => Boolean(deviceId));
    const sharedDeviceProviders = sharedDeviceIds.length
      ? await this.prisma.providerDevice.findMany({
          distinct: ['providerProfileId'],
          select: { providerProfileId: true },
          where: { blockedAt: null, deviceId: { in: sharedDeviceIds }, enabled: true },
        })
      : [];

    return {
      activeControls,
      blockedAccounts,
      locationGaps,
      onboardingGaps,
      openReports,
      sharedDevices: sharedDeviceProviders.length,
      urgentMajorReports,
      walletDebt: walletRows.filter((row) => numberValue(row._sum.netAmount) < 0).length,
    };
  }

  async listPartnerControlProviders(options: AdminPartnerControlProviderListOptions = {}) {
    const providers = await this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      take: boundedAdminListLimit(options.take, ADMIN_PROVIDER_CONTROL_LIST_LIMIT),
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

  async getProviderDetail(
    providerProfileId: string,
    options: { includeDiagnostics?: boolean } = {},
  ) {
    const includeDiagnostics = options.includeDiagnostics !== false;
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: includeDiagnostics ? adminProviderDetailSelect : adminProviderDetailWithoutDiagnosticsSelect,
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }
    const providerDevices = includeDiagnostics && Array.isArray(provider.devices) ? provider.devices : [];
    const providerSessions = includeDiagnostics && Array.isArray(provider.sessions) ? provider.sessions : [];

    const deviceIds = Array.from(
      new Set(
        [
          ...providerDevices.map((device) => device.deviceId),
          ...providerSessions.map((session) => session.deviceId),
        ].filter((deviceId): deviceId is string => Boolean(deviceId)),
      ),
    );
    const sharedDeviceMatchesPromise = includeDiagnostics && deviceIds.length
      ? this.prisma.providerDevice.findMany({
          where: {
            deviceId: { in: deviceIds },
            providerProfileId: { not: provider.id },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: ADMIN_PROVIDER_DETAIL_SHARED_DEVICE_LIMIT,
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
      take: ADMIN_PROVIDER_DETAIL_AUDIT_LOG_LIMIT,
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

  listProviderReports(options: AdminProviderControlEvidenceListOptions = {}) {
    return this.prisma.providerReport.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: boundedAdminListLimit(options.take, ADMIN_PROVIDER_REPORT_LIST_LIMIT),
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

  listProviderSanctions(options: AdminProviderControlEvidenceListOptions = {}) {
    return this.prisma.providerSanction.findMany({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      take: boundedAdminListLimit(options.take, ADMIN_PROVIDER_REPORT_LIST_LIMIT),
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
    const skip = adminChatArchiveListSkip(query.skip);

    return this.prisma.booking.findMany({
      where: adminChatArchiveWhere(query),
      orderBy: { updatedAt: 'desc' },
      skip: skip > 0 ? skip : undefined,
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
            _count: { select: { messages: true } },
            messages: {
              orderBy: { createdAt: 'asc' },
              take: ADMIN_CHAT_ARCHIVE_MESSAGE_PREVIEW_LIMIT,
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

  async chatArchiveSummary(query: AdminChatArchiveListQuery = {}) {
    const bookingWhere = adminChatArchiveWhere(query);
    const messageWhere: Prisma.ChatMessageWhereInput = {
      chatRoom: {
        is: {
          booking: bookingWhere,
        },
      },
    };

    const [
      totalCount,
      completedRooms,
      activeRooms,
      emptyRooms,
      messageCount,
      customerMessages,
      partnerMessages,
      latestMessage,
    ] = await Promise.all([
      this.prisma.booking.count({ where: bookingWhere }),
      this.prisma.booking.count({
        where: { AND: [bookingWhere, { status: BookingStatus.COMPLETED }] },
      }),
      this.prisma.booking.count({
        where: { AND: [bookingWhere, adminBookingListStatusGroupWhere('realtime') ?? {}] },
      }),
      this.prisma.booking.count({
        where: { AND: [bookingWhere, { chatRoom: { is: { messages: { none: {} } } } }] },
      }),
      this.prisma.chatMessage.count({ where: messageWhere }),
      this.prisma.chatMessage.count({
        where: { AND: [messageWhere, { sender: { roles: { has: Role.CUSTOMER } } }] },
      }),
      this.prisma.chatMessage.count({
        where: { AND: [messageWhere, { sender: { roles: { has: Role.PROVIDER } } }] },
      }),
      this.prisma.chatMessage.findFirst({
        where: messageWhere,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      activeRooms,
      completedRooms,
      customerMessages,
      emptyRooms,
      generatedAt: new Date().toISOString(),
      latestMessageAt: latestMessage?.createdAt ? new Date(latestMessage.createdAt).toISOString() : null,
      messageCount,
      partnerMessages,
      totalCount,
    };
  }

  async getBookingDetail(id: string, options: { includeDiagnostics?: boolean } = {}) {
    const includeDiagnostics = options.includeDiagnostics !== false;
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: adminBookingDetailSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const auditLogs = includeDiagnostics
      ? await this.prisma.adminAuditLog.findMany({
          where: bookingAuditLogWhere(id, booking.createdAt),
          orderBy: { createdAt: 'desc' },
          take: ADMIN_BOOKING_DETAIL_AUDIT_LOG_LIMIT,
          select: adminAuditLogSelect,
        })
      : undefined;

    return withAdminBookingListMetadata(
      withAdminBookingMatchingEvidence(includeDiagnostics ? { ...booking, auditLogs } : booking),
    );
  }

  listBookingNotifications(bookingId: string, options: AdminBookingDetailPreviewQuery = {}) {
    return this.prisma.notification.findMany({
      where: { data: { path: ['bookingId'], equals: bookingId } },
      orderBy: { createdAt: 'desc' },
      take: boundedAdminListLimit(options.take, ADMIN_BOOKING_DETAIL_NOTIFICATION_LIMIT),
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

  async listBookingMarketplaceProviders(bookingId: string, options: AdminBookingDetailPreviewQuery = {}) {
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
          take: boundedAdminListLimit(options.take, ADMIN_BOOKING_MARKETPLACE_PROVIDER_LIMIT),
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
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.payment.findMany({
      ...(where ? { where } : {}),
      orderBy: { id: 'desc' },
      ...(skip > 0 ? { skip } : {}),
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

  async paymentSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminPaymentOperationsWhere(options);
    const callbackAttemptWhere = adminPaymentCallbackAttemptWhere(options);
    const callbackReviewWhere = adminMergePaymentCallbackAttemptWhere(
      callbackAttemptWhere,
      adminPaymentCallbackAttemptNeedsReviewWhere(),
    );
    const callbackVerifiedWhere = adminMergePaymentCallbackAttemptWhere(
      callbackAttemptWhere,
      adminPaymentCallbackAttemptVerifiedWhere(),
    );

    const [
      totalCount,
      authorized,
      pendingCash,
      cashDebt,
      captured,
      refunded,
      needsAction,
      linkedRefunds,
      callbackReview,
      callbackVerified,
    ] = await Promise.all([
      this.prisma.payment.count(adminPaymentCountArgs(where)),
      this.prisma.payment.count(
        adminPaymentCountArgs(adminMergePaymentOperationsWhere(where, { status: PaymentStatus.AUTHORIZED })),
      ),
      this.prisma.payment.count(
        adminPaymentCountArgs(
          adminMergePaymentOperationsWhere(where, {
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          }),
        ),
      ),
      this.prisma.payment.count(
        adminPaymentCountArgs(
          adminMergePaymentOperationsWhere(where, adminPaymentReviewWhere('cash-debt') ?? {}),
        ),
      ),
      this.prisma.payment.count(
        adminPaymentCountArgs(adminMergePaymentOperationsWhere(where, { status: PaymentStatus.CAPTURED })),
      ),
      this.prisma.payment.count(
        adminPaymentCountArgs(adminMergePaymentOperationsWhere(where, { status: PaymentStatus.REFUNDED })),
      ),
      this.prisma.payment.count(
        adminPaymentCountArgs(
          adminMergePaymentOperationsWhere(where, {
            status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.RELEASED] },
          }),
        ),
      ),
      this.prisma.refund.count(adminLinkedRefundCountArgs(where)),
      this.prisma.paymentCallbackAttempt.count(adminPaymentCallbackAttemptCountArgs(callbackReviewWhere)),
      this.prisma.paymentCallbackAttempt.count(adminPaymentCallbackAttemptCountArgs(callbackVerifiedWhere)),
    ]);

    return {
      authorized,
      callbackReview,
      callbackVerified,
      captured,
      cashDebt,
      linkedRefunds,
      needsAction,
      pendingCash,
      refunded,
      totalCount,
    };
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
      take: ADMIN_PAYMENT_DETAIL_CALLBACK_ATTEMPT_LIMIT,
      select: adminPaymentCallbackAttemptSummarySelect,
    });

    const auditLogsPromise = this.prisma.adminAuditLog.findMany({
      where: paymentAuditLogWhere(payment.id, payment.bookingId),
      orderBy: { createdAt: 'desc' },
      take: ADMIN_PAYMENT_DETAIL_AUDIT_LOG_LIMIT,
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
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.refund.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminRefundOperationsTake(options.take),
      select: adminRefundListSelect,
    });
  }

  async refundSummary(options: AdminRefundOperationsQuery = {}) {
    const where = adminRefundOperationsWhere(options);
    const requestedWhere = adminMergeRefundOperationsWhere(where, { status: 'REQUESTED' });
    const refundedBookingWhere = adminMergeRefundOperationsWhere(where, {
      booking: { status: BookingStatus.REFUNDED },
    });
    const needsUpdateWhere = adminMergeRefundOperationsWhere(where, {
      payment: { status: { not: PaymentStatus.REFUNDED } },
      status: 'REQUESTED',
    });
    const completedWhere = adminMergeRefundOperationsWhere(where, { status: 'COMPLETED' });
    const openWhere = adminMergeRefundOperationsWhere(where, { status: { not: 'COMPLETED' } });
    const outcomeLinkedWhere = adminMergeRefundOperationsWhere(where, {
      booking: {
        status: {
          in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW, BookingStatus.REFUNDED],
        },
      },
    });

    const [
      totalCount,
      requestedCount,
      refundedBookingCount,
      needsUpdateCount,
      completedCount,
      openCount,
      outcomeLinkedCount,
    ] = await Promise.all([
      this.prisma.refund.count(adminRefundCountArgs(where)),
      this.prisma.refund.count(adminRefundCountArgs(requestedWhere)),
      this.prisma.refund.count(adminRefundCountArgs(refundedBookingWhere)),
      this.prisma.refund.count(adminRefundCountArgs(needsUpdateWhere)),
      this.prisma.refund.count(adminRefundCountArgs(completedWhere)),
      this.prisma.refund.count(adminRefundCountArgs(openWhere)),
      this.prisma.refund.count(adminRefundCountArgs(outcomeLinkedWhere)),
    ]);

    return {
      totalCount,
      requestedCount,
      refundedBookingCount,
      needsUpdateCount,
      completedCount,
      openCount,
      outcomeLinkedCount,
    };
  }

  async financeOverviewSummary(options: AdminFinanceOverviewQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const rangeOptions = { range: options.range };
    const periodOptions = { period };
    const clearingOptions = { range: options.range, review: 'open' };
    const bankOptions = { range: options.range, review: 'unmatched' };

    const [
      settlementSummary,
      couponSummary,
      partnerWithholdingSummary,
      withdrawalSummary,
      clearingSummary,
      bankSummary,
      monthlyClosingSummary,
      earningsSummary,
      paymentSummary,
      refundSummary,
      cashSummary,
      paymentFeeSummary,
      walletSummary,
      amountSummary,
    ] = await Promise.all([
      this.bookingSettlementSnapshotSummary(rangeOptions),
      this.couponFinanceSummary(rangeOptions),
      this.partnerWithholdingTaxSummary(periodOptions),
      this.providerWalletWithdrawalRequestSummary(rangeOptions),
      this.bookingPaymentClearingSummary(clearingOptions),
      this.bankReconciliationSummary(bankOptions),
      this.monthlyTaxClosingSummary(periodOptions),
      this.earningsSummary(rangeOptions),
      this.paymentSummary(rangeOptions),
      this.refundSummary(rangeOptions),
      this.cashSettlementSummary(rangeOptions),
      this.paymentFeeSummary(periodOptions),
      this.financeOverviewWalletSummary(),
      this.financeOverviewAmountSummary(rangeOptions),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range: normalizeNullable(options.range) ?? 'today',
      period,
      amountSummary,
      bankSummary,
      cashSummary,
      clearingSummary,
      couponSummary,
      earningsSummary,
      monthlyClosingSummary,
      partnerWithholdingSummary,
      paymentFeeSummary,
      paymentSummary,
      payoutSummary: null,
      refundSummary,
      settlementSummary,
      walletSummary,
      withdrawalSummary,
    };
  }

  private async financeOverviewWalletSummary() {
    const [customerGroups, partnerGroups] = await Promise.all([
      this.prisma.customerWalletLedgerEntry.groupBy({
        by: ['customerProfileId', 'currency'],
        _sum: { amount: true },
      }),
      this.prisma.providerWalletLedgerEntry.groupBy({
        by: ['providerProfileId', 'currency'],
        _sum: { amount: true },
      }),
    ]);
    const customerPositiveBalances = customerGroups
      .map((group) => group._sum.amount ?? 0)
      .filter((amount) => amount > 0);
    const partnerPositiveBalances = partnerGroups
      .map((group) => group._sum.amount ?? 0)
      .filter((amount) => amount > 0);
    const partnerNegativeBalances = partnerGroups
      .map((group) => group._sum.amount ?? 0)
      .filter((amount) => amount < 0);

    return {
      currency: 'VND',
      customerWalletAccountCount: customerPositiveBalances.length,
      customerWalletLiabilityAmount: sumNumbers(customerPositiveBalances),
      partnerPositiveWalletAccountCount: partnerPositiveBalances.length,
      partnerWalletLiabilityAmount: sumNumbers(partnerPositiveBalances),
      partnerNegativeWalletAccountCount: partnerNegativeBalances.length,
      negativePartnerWalletAmount: Math.abs(sumNumbers(partnerNegativeBalances)),
    };
  }

  private async financeOverviewAmountSummary(options: Pick<AdminPaymentOperationsQuery, 'range'>) {
    const refundWhere = adminRefundOperationsWhere(options);
    const pendingRefundWhere = refundWhere
      ? { ...refundWhere, status: { not: 'COMPLETED' } }
      : { status: { not: 'COMPLETED' } };
    const completedRefundWhere = refundWhere ? { ...refundWhere, status: 'COMPLETED' } : { status: 'COMPLETED' };
    const paymentWhere = adminPaymentOperationsWhere(options);
    const failedPaymentWhere = paymentWhere
      ? { ...paymentWhere, status: PaymentStatus.FAILED }
      : { status: PaymentStatus.FAILED };
    const [pendingRefunds, completedRefunds, failedPayments] = await Promise.all([
      this.prisma.refund.aggregate({
        where: pendingRefundWhere,
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: completedRefundWhere,
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: failedPaymentWhere,
        _sum: { amount: true },
      }),
    ]);

    return {
      currency: 'VND',
      refundPendingAmount: pendingRefunds._sum.amount ?? 0,
      refundCompletedAmount: completedRefunds._sum.amount ?? 0,
      paymentFailedAmount: failedPayments._sum.amount ?? 0,
    };
  }

  listEarnings(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listForAdmin(options);
  }

  listCashSettlementEarnings(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listCashSettlementDebtForAdmin(options);
  }

  cashSettlementSummary(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.cashSettlementSummaryForAdmin(options);
  }

  earningsSummary(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.adminSummary(options);
  }

  listBookingSettlementSnapshots(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingSettlementSnapshotWhere(options);
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.bookingSettlementSnapshot.findMany({
      ...(where ? { where } : {}),
      orderBy: { postedAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminBookingSettlementSnapshotListSelect,
    });
  }

  getBookingSettlementSnapshot(id: string) {
    return this.prisma.bookingSettlementSnapshot.findUnique({
      where: { id },
      select: adminBookingSettlementSnapshotDetailSelect,
    });
  }

  async listCouponFinanceSnapshots(options: AdminPaymentOperationsQuery = {}) {
    const take = adminPaymentOperationsTake(options.take);
    const skip = boundedAdminListSkip(options.skip);
    const idRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BookingSettlementSnapshot"
      ${adminCouponFinanceSqlWhere(options)}
      ORDER BY "postedAt" DESC
      LIMIT ${take}
      OFFSET ${skip}
    `);
    const ids = idRows.map((row) => row.id).filter(Boolean);
    if (!ids.length) {
      return [];
    }

    const snapshots = await this.prisma.bookingSettlementSnapshot.findMany({
      where: { id: { in: ids } },
      select: adminCouponFinanceSnapshotListSelect,
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    return snapshots.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  async bookingSettlementSnapshotSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingSettlementSnapshotWhere(options);
    const openTaxWhere = adminMergeBookingSettlementSnapshotWhere(where, {
      taxStatus: BookingSettlementTaxStatus.OPEN,
    });
    const paidTaxWhere = adminMergeBookingSettlementSnapshotWhere(where, {
      taxStatus: BookingSettlementTaxStatus.PAID,
    });
    const [count, sums, openTaxCount, paidTaxCount] = await Promise.all([
      this.prisma.bookingSettlementSnapshot.count(adminBookingSettlementSnapshotCountArgs(where)),
      this.prisma.bookingSettlementSnapshot.aggregate({
        ...(where ? { where } : {}),
        _sum: {
          customerPaymentAmount: true,
          partnerPayoutAmount: true,
          partnerWithholdingTotal: true,
          platformFeeGross: true,
          platformFeeNetRevenue: true,
          companyOutputVat: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.count(adminBookingSettlementSnapshotCountArgs(openTaxWhere)),
      this.prisma.bookingSettlementSnapshot.count(adminBookingSettlementSnapshotCountArgs(paidTaxWhere)),
    ]);

    return {
      count,
      currency: 'VND',
      customerPaymentAmount: sums._sum.customerPaymentAmount ?? 0,
      partnerPayoutAmount: sums._sum.partnerPayoutAmount ?? 0,
      partnerWithholdingTotal: sums._sum.partnerWithholdingTotal ?? 0,
      platformFeeGross: sums._sum.platformFeeGross ?? 0,
      platformFeeNetRevenue: sums._sum.platformFeeNetRevenue ?? 0,
      companyOutputVat: sums._sum.companyOutputVat ?? 0,
      paymentProcessingFee: sums._sum.paymentProcessingFee ?? 0,
      openTaxCount,
      paidTaxCount,
    };
  }

  listBookingSettlementReversals(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingSettlementReversalWhere(options);
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.bookingSettlementReversalEntry.findMany({
      ...(where ? { where } : {}),
      orderBy: { occurredAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminBookingSettlementReversalEntryListSelect,
    });
  }

  getBookingSettlementReversal(id: string) {
    return this.prisma.bookingSettlementReversalEntry.findUnique({
      select: adminBookingSettlementReversalEntryDetailSelect,
      where: { id },
    });
  }

  async bookingSettlementReversalSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingSettlementReversalWhere(options);
    const cashWhere = adminMergeBookingSettlementReversalWhere(where, { paymentMethod: PaymentMethod.CASH });
    const nonCashWhere = adminMergeBookingSettlementReversalWhere(where, {
      paymentMethod: { not: PaymentMethod.CASH },
    });
    const [count, sums, cashCount, nonCashCount] = await Promise.all([
      this.prisma.bookingSettlementReversalEntry.count(adminBookingSettlementReversalCountArgs(where)),
      this.prisma.bookingSettlementReversalEntry.aggregate({
        ...(where ? { where } : {}),
        _sum: {
          customerPaymentAmount: true,
          partnerPayoutAmount: true,
          partnerWithholdingTotal: true,
          platformFeeGross: true,
          platformFeeNetRevenue: true,
          companyOutputVat: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementReversalEntry.count(adminBookingSettlementReversalCountArgs(cashWhere)),
      this.prisma.bookingSettlementReversalEntry.count(adminBookingSettlementReversalCountArgs(nonCashWhere)),
    ]);

    return {
      count,
      currency: 'VND',
      customerPaymentAmount: sums._sum.customerPaymentAmount ?? 0,
      partnerPayoutAmount: sums._sum.partnerPayoutAmount ?? 0,
      partnerWithholdingTotal: sums._sum.partnerWithholdingTotal ?? 0,
      platformFeeGross: sums._sum.platformFeeGross ?? 0,
      platformFeeNetRevenue: sums._sum.platformFeeNetRevenue ?? 0,
      companyOutputVat: sums._sum.companyOutputVat ?? 0,
      paymentProcessingFee: sums._sum.paymentProcessingFee ?? 0,
      cashCount,
      nonCashCount,
    };
  }

  listAccountingJournalBatches(options: AdminPaymentOperationsQuery = {}) {
    const where = adminAccountingJournalBatchWhere(options);
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.accountingJournalBatch.findMany({
      ...(where ? { where } : {}),
      orderBy: { postedAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminAccountingJournalBatchListSelect,
    });
  }

  async accountingJournalBatchSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminAccountingJournalBatchWhere(options);
    const postedWhere = adminMergeAccountingJournalBatchWhere(where, {
      status: AccountingJournalBatchStatus.POSTED,
    });
    const reversedWhere = adminMergeAccountingJournalBatchWhere(where, {
      status: AccountingJournalBatchStatus.REVERSED,
    });
    const [count, sums, postedCount, reversedCount] = await Promise.all([
      this.prisma.accountingJournalBatch.count(adminAccountingJournalBatchCountArgs(where)),
      this.prisma.accountingJournalBatch.aggregate({
        ...(where ? { where } : {}),
        _sum: { totalCredit: true, totalDebit: true },
      }),
      this.prisma.accountingJournalBatch.count(adminAccountingJournalBatchCountArgs(postedWhere)),
      this.prisma.accountingJournalBatch.count(adminAccountingJournalBatchCountArgs(reversedWhere)),
    ]);

    return {
      count,
      currency: 'VND',
      postedCount,
      reversedCount,
      totalCredit: sums._sum.totalCredit ?? 0,
      totalDebit: sums._sum.totalDebit ?? 0,
    };
  }

  async accountingJournalBatchDetail(id: string) {
    const batch = await this.prisma.accountingJournalBatch.findUnique({
      where: { id },
      select: adminAccountingJournalBatchDetailSelect,
    });
    if (!batch) {
      throw new NotFoundException('Accounting journal batch not found');
    }
    return batch;
  }

  listBookingPaymentClearingEntries(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingPaymentClearingWhere(options);
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.bookingPaymentClearingEntry.findMany({
      ...(where ? { where } : {}),
      orderBy: { occurredAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminBookingPaymentClearingEntryListSelect,
    });
  }

  async bookingPaymentClearingSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBookingPaymentClearingWhere(options);
    const openWhere = adminMergeBookingPaymentClearingWhere(where, {
      status: BookingPaymentClearingStatus.OPEN,
    });
    const clearedWhere = adminMergeBookingPaymentClearingWhere(where, {
      status: BookingPaymentClearingStatus.CLEARED,
    });
    const [count, sums, openCount, clearedCount] = await Promise.all([
      this.prisma.bookingPaymentClearingEntry.count(adminBookingPaymentClearingCountArgs(where)),
      this.prisma.bookingPaymentClearingEntry.aggregate({
        ...(where ? { where } : {}),
        _sum: { amount: true },
      }),
      this.prisma.bookingPaymentClearingEntry.count(adminBookingPaymentClearingCountArgs(openWhere)),
      this.prisma.bookingPaymentClearingEntry.count(adminBookingPaymentClearingCountArgs(clearedWhere)),
    ]);

    return {
      amount: sums._sum.amount ?? 0,
      clearedCount,
      count,
      currency: 'VND',
      openCount,
    };
  }

  async bookingPaymentClearingEntryDetail(id: string) {
    const entry = await this.prisma.bookingPaymentClearingEntry.findUnique({
      where: { id },
      select: adminBookingPaymentClearingEntryDetailSelect,
    });
    if (!entry) {
      throw new NotFoundException('Booking payment clearing entry not found');
    }
    return entry;
  }

  listCompanyBankAccounts(options: { status?: string | null } = {}) {
    const status =
      normalizeNullable(options.status)?.toUpperCase() === 'ALL'
        ? undefined
        : CompanyBankAccountStatus.ACTIVE;

    return this.prisma.companyBankAccount.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      select: adminCompanyBankAccountSelect,
    });
  }

  listBankReconciliationTransactions(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBankReconciliationWhere(options);
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.companyBankTransaction.findMany({
      ...(where ? { where } : {}),
      orderBy: { occurredAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminCompanyBankTransactionListSelect,
    });
  }

  async bankReconciliationSummary(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBankReconciliationWhere(options);
    const unmatchedWhere = adminMergeBankReconciliationWhere(where, {
      status: BankReconciliationStatus.UNMATCHED,
    });
    const matchedWhere = adminMergeBankReconciliationWhere(where, {
      status: BankReconciliationStatus.MATCHED,
    });
    const [count, sums, unmatchedCount, matchedCount] = await Promise.all([
      this.prisma.companyBankTransaction.count(adminBankReconciliationCountArgs(where)),
      this.prisma.companyBankTransaction.aggregate({
        ...(where ? { where } : {}),
        _sum: { amount: true },
      }),
      this.prisma.companyBankTransaction.count(adminBankReconciliationCountArgs(unmatchedWhere)),
      this.prisma.companyBankTransaction.count(adminBankReconciliationCountArgs(matchedWhere)),
    ]);

    return {
      amount: sums._sum.amount ?? 0,
      count,
      currency: 'VND',
      matchedCount,
      unmatchedCount,
    };
  }

  async bankReconciliationTransactionDetail(id: string) {
    const transaction = await this.prisma.companyBankTransaction.findUnique({
      where: { id },
      select: adminCompanyBankTransactionDetailSelect,
    });
    if (!transaction) {
      throw new NotFoundException('Bank reconciliation transaction not found');
    }
    return transaction;
  }

  async createCompanyBankTransaction(actorId: string, input: CreateCompanyBankTransactionDto) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Company bank transaction manual create',
    );
    await assertFinanceActionApprovalAdmin(
      this.prisma,
      approvalAdminId,
      'Company bank transaction manual create',
    );
    const type = companyBankTransactionType(input.type);
    const amount = integerValue(input.amount);
    if (amount <= 0) {
      throw new BadRequestException('Bank transaction amount must be positive');
    }
    const occurredAt = requiredAdminDate(input.occurredAt, 'Bank transaction occurredAt');
    const valueDate = optionalAdminDate(input.valueDate, 'Bank transaction valueDate');
    const bankAccountId = normalizeRequiredId(input.bankAccountId, 'Company bank account id');
    const bankAccount = await this.prisma.companyBankAccount.findUnique({
      where: { id: bankAccountId },
      select: { id: true, currency: true, status: true },
    });
    if (!bankAccount) {
      throw new NotFoundException('Company bank account not found');
    }
    if (bankAccount.status !== CompanyBankAccountStatus.ACTIVE) {
      throw new BadRequestException('Company bank account must be active before importing transactions');
    }

    const currency = normalizeCompanyBankTransactionCurrency(input.currency, bankAccount.currency);
    const sourceKey = companyBankTransactionSourceKey({
      amount,
      bankAccountId,
      occurredAt,
      sourceKey: input.sourceKey,
      transferRef: input.transferRef,
      type,
    });
    const transferRef = normalizeNullable(input.transferRef);
    const counterpartyName = normalizeNullable(input.counterpartyName);
    const description = normalizeNullable(input.description);
    const transaction = await this.prisma.companyBankTransaction.create({
      data: {
        amount,
        bankAccountId,
        counterpartyName,
        currency,
        description,
        metadata: toJson({
          approvalAdminId,
          manualImport: true,
          importedByAdminId: actorId,
        }),
        occurredAt,
        sourceKey,
        transferRef,
        type,
        valueDate,
      },
      select: adminCompanyBankTransactionListSelect,
    });

    await this.writeAudit(
      actorId,
      'company_bank_transaction.manual_create',
      `company_bank_transaction:${transaction.id}`,
      {
        amount,
        approvalAdminId,
        bankAccountId,
        currency,
        occurredAt: occurredAt.toISOString(),
        sourceKey,
        transferRef,
        type,
      },
    );

    return transaction;
  }

  async createBankReconciliationMatch(
    actorId: string,
    bankTransactionId: string,
    input: CreateBankReconciliationMatchDto,
  ) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Bank reconciliation match',
    );
    await assertFinanceActionApprovalAdmin(
      this.prisma,
      approvalAdminId,
      'Bank reconciliation match',
    );
    const source = adminBankReconciliationMatchSource(input);
    return this.prisma.$transaction(async (tx) => {
      const bankTransaction = await tx.companyBankTransaction.findUnique({
        where: { id: bankTransactionId },
        select: { id: true, amount: true, currency: true, status: true },
      });
      if (!bankTransaction) {
        throw new NotFoundException('Bank transaction not found');
      }
      if (
        bankTransaction.status === BankReconciliationStatus.IGNORED ||
        bankTransaction.status === BankReconciliationStatus.REVERSED
      ) {
        throw new BadRequestException('Bank transaction cannot be matched in its current status');
      }

      const currency = normalizeNullable(input.currency)?.toUpperCase() ?? bankTransaction.currency;
      if (currency !== bankTransaction.currency) {
        throw new BadRequestException('Match currency must equal bank transaction currency');
      }

      const sourceSnapshot = await this.validateBankReconciliationSource(tx, source, currency);
      const sourceAmount = sourceSnapshot.amount;
      if (Math.abs(input.amount) > Math.abs(sourceAmount)) {
        throw new BadRequestException('Match amount exceeds source amount');
      }
      const currentSourceMatched = await tx.bankReconciliationMatch.aggregate({
        where: {
          [source.field]: source.id,
          status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
        } as Prisma.BankReconciliationMatchWhereInput,
        _sum: { amount: true },
      });
      const nextSourceMatchedAmount =
        Math.abs(currentSourceMatched._sum.amount ?? 0) + Math.abs(input.amount);
      if (nextSourceMatchedAmount > Math.abs(sourceAmount)) {
        throw new BadRequestException('Match amount exceeds remaining reconciliation source amount');
      }
      const currentBankMatched = await tx.bankReconciliationMatch.aggregate({
        where: {
          bankTransactionId,
          status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
        },
        _sum: { amount: true },
      });
      const nextMatchedAmount = Math.abs(currentBankMatched._sum.amount ?? 0) + Math.abs(input.amount);
      if (nextMatchedAmount > Math.abs(bankTransaction.amount)) {
        throw new BadRequestException('Match amount exceeds remaining bank transaction amount');
      }

      const match = await tx.bankReconciliationMatch.create({
        data: {
          bankTransactionId,
          [source.field]: source.id,
          amount: input.amount,
          currency,
          status: BankReconciliationStatus.MATCHED,
          matchedByAdminId: actorId,
          notes: normalizeNullable(input.notes),
          sourceKey: bankReconciliationMatchSourceKey(bankTransactionId, source),
          metadata: {
            manual: true,
            sourceType: source.type,
          },
        } as Prisma.BankReconciliationMatchUncheckedCreateInput,
      });

      const bankMatched = await tx.bankReconciliationMatch.aggregate({
        where: {
          bankTransactionId,
          status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
        },
        _sum: { amount: true },
      });
      const bankStatus = bankReconciliationStatusForAmount(
        bankMatched._sum.amount ?? 0,
        bankTransaction.amount,
      );
      const updatedBankTransaction = await tx.companyBankTransaction.update({
        where: { id: bankTransactionId },
        data: { status: bankStatus },
        select: adminCompanyBankTransactionListSelect,
      });

      const updatedPaymentClearingEntry =
        source.type === 'payment-clearing'
          ? await this.updatePaymentClearingReconciliationStatus(tx, source.id)
          : null;

      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'bank_reconciliation.match.create',
          target: `bank_transaction:${bankTransactionId}`,
          metadata: {
            amount: input.amount,
            approvalAdminId,
            bankTransactionId,
            bankStatusBefore: bankTransaction.status,
            bankStatusAfter: updatedBankTransaction.status,
            currency,
            matchId: match.id,
            notes: normalizeNullable(input.notes),
            [source.field]: source.id,
            sourceType: source.type,
            ...(source.type === 'payment-clearing'
              ? {
                  paymentClearingStatusBefore: sourceSnapshot.status,
                  paymentClearingStatusAfter: updatedPaymentClearingEntry?.status ?? null,
                }
              : {}),
          },
        },
      });

      return {
        auditLog,
        bankTransaction: updatedBankTransaction,
        match,
        paymentClearingEntry: updatedPaymentClearingEntry,
      };
    });
  }

  async reverseBankReconciliationMatch(
    actorId: string,
    bankTransactionId: string,
    matchId: string,
    input: ReverseBankReconciliationMatchDto,
  ) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Bank reconciliation match reversal',
    );
    await assertFinanceActionApprovalAdmin(
      this.prisma,
      approvalAdminId,
      'Bank reconciliation match reversal',
    );
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.bankReconciliationMatch.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          bankTransactionId: true,
          paymentClearingEntryId: true,
          status: true,
          amount: true,
          currency: true,
          bankTransaction: {
            select: {
              amount: true,
              currency: true,
              status: true,
            },
          },
        },
      });
      if (!match) {
        throw new NotFoundException('Bank reconciliation match not found');
      }
      if (match.bankTransactionId !== bankTransactionId) {
        throw new BadRequestException('Bank reconciliation match does not belong to this bank transaction');
      }
      if (match.status === BankReconciliationStatus.REVERSED) {
        throw new BadRequestException('Bank reconciliation match is already reversed');
      }

      const reason = normalizeNullable(input.reason);
      const reversedMatch = await tx.bankReconciliationMatch.update({
        where: { id: matchId },
        data: {
          status: BankReconciliationStatus.REVERSED,
          ...(reason ? { notes: reason } : {}),
        },
      });

      const bankMatched = await tx.bankReconciliationMatch.aggregate({
        where: {
          bankTransactionId,
          status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
        },
        _sum: { amount: true },
      });
      const bankStatus = bankReconciliationStatusForAmount(
        bankMatched._sum.amount ?? 0,
        match.bankTransaction.amount,
      );
      const updatedBankTransaction = await tx.companyBankTransaction.update({
        where: { id: bankTransactionId },
        data: { status: bankStatus },
        select: adminCompanyBankTransactionListSelect,
      });

      const updatedPaymentClearingEntry = match.paymentClearingEntryId
        ? await this.updatePaymentClearingReconciliationStatus(tx, match.paymentClearingEntryId)
        : null;

      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'bank_reconciliation.match.reverse',
          target: `bank_reconciliation_match:${matchId}`,
          metadata: {
            amount: match.amount,
            approvalAdminId,
            bankTransactionId,
            bankStatusBefore: match.bankTransaction.status,
            bankStatusAfter: updatedBankTransaction.status,
            currency: match.currency,
            matchId,
            paymentClearingEntryId: match.paymentClearingEntryId,
            paymentClearingStatusAfter: updatedPaymentClearingEntry?.status ?? null,
            reason,
          },
        },
      });

      return {
        auditLog,
        bankTransaction: updatedBankTransaction,
        match: reversedMatch,
        paymentClearingEntry: updatedPaymentClearingEntry,
      };
    });
  }

  private async validateBankReconciliationSource(
    tx: Prisma.TransactionClient,
    source: AdminBankReconciliationMatchSource,
    currency: string,
  ) {
    if (source.type === 'accounting-journal') {
      const row = await tx.accountingJournalEntry.findUnique({
        where: { id: source.id },
        select: { amount: true, currency: true },
      });
      if (!row) {
        throw new NotFoundException('Accounting journal entry not found');
      }
      if (row.currency !== currency) {
        throw new BadRequestException('Match currency must equal accounting journal entry currency');
      }
      return { amount: row.amount };
    }
    if (source.type === 'payment-clearing') {
      const row = await tx.bookingPaymentClearingEntry.findUnique({
        where: { id: source.id },
        select: { amount: true, currency: true, status: true },
      });
      if (!row) {
        throw new NotFoundException('Booking payment clearing entry not found');
      }
      if (row.status === BookingPaymentClearingStatus.REVERSED) {
        throw new BadRequestException('Reversed booking payment clearing entries cannot be matched');
      }
      if (row.currency !== currency) {
        throw new BadRequestException('Match currency must equal payment clearing currency');
      }
      return { amount: row.amount, status: row.status };
    }
    if (source.type === 'withdrawal') {
      const row = await tx.providerWalletWithdrawalRequest.findUnique({
        where: { id: source.id },
        select: { amount: true, currency: true },
      });
      if (!row) {
        throw new NotFoundException('Provider withdrawal request not found');
      }
      if (row.currency !== currency) {
        throw new BadRequestException('Match currency must equal withdrawal currency');
      }
      return { amount: row.amount };
    }

    const row = await tx.providerPayoutBatch.findUnique({
      where: { id: source.id },
      select: { totalNetAmount: true, currency: true },
    });
    if (!row) {
      throw new NotFoundException('Provider payout batch not found');
    }
    if (row.currency !== currency) {
      throw new BadRequestException('Match currency must equal payout batch currency');
    }
    return { amount: row.totalNetAmount };
  }

  private async updatePaymentClearingReconciliationStatus(
    tx: Prisma.TransactionClient,
    paymentClearingEntryId: string,
  ) {
    const entry = await tx.bookingPaymentClearingEntry.findUnique({
      where: { id: paymentClearingEntryId },
      select: { amount: true },
    });
    if (!entry) {
      throw new NotFoundException('Booking payment clearing entry not found');
    }

    const matched = await tx.bankReconciliationMatch.aggregate({
      where: {
        paymentClearingEntryId,
        status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
      },
      _sum: { amount: true },
    });
    const status = bookingPaymentClearingStatusForAmount(matched._sum.amount ?? 0, entry.amount);

    return tx.bookingPaymentClearingEntry.update({
      where: { id: paymentClearingEntryId },
      data: {
        status,
        clearedAt: status === BookingPaymentClearingStatus.CLEARED ? new Date() : null,
      },
      select: adminBookingPaymentClearingEntryListSelect,
    });
  }

  async couponFinanceSummary(options: AdminPaymentOperationsQuery = {}) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        bookingServiceAmount: bigint | number | null;
        companyCouponExpense: bigint | number | null;
        couponDiscountAmount: bigint | number | null;
        couponReviewFlagCount: bigint | number | null;
        couponSettlementCount: bigint | number | null;
        customerPaidAmount: bigint | number | null;
        partnerFundedCouponAmount: bigint | number | null;
        platformFeeDiscountAmount: bigint | number | null;
        reversedCompanyCouponExpense: bigint | number | null;
        reversedCouponDiscountAmount: bigint | number | null;
        settlementBaseAmount: bigint | number | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "couponSettlementCount",
        COALESCE(SUM(${adminJsonIntSql('bookingServiceAmount')}), 0)::bigint AS "bookingServiceAmount",
        COALESCE(SUM(${adminJsonIntSql('customerPaidAmount')}), 0)::bigint AS "customerPaidAmount",
        COALESCE(SUM(${adminJsonIntSql('settlementBaseAmount')}), 0)::bigint AS "settlementBaseAmount",
        COALESCE(SUM(${adminJsonIntSql('couponDiscountAmount')}), 0)::bigint AS "couponDiscountAmount",
        COALESCE(SUM(${adminJsonIntSql('companyCouponExpense')}), 0)::bigint AS "companyCouponExpense",
        COALESCE(SUM(${adminJsonIntSql('partnerFundedCouponAmount')}), 0)::bigint AS "partnerFundedCouponAmount",
        COALESCE(SUM(${adminJsonIntSql('platformFeeDiscountAmount')}), 0)::bigint AS "platformFeeDiscountAmount",
        COALESCE(SUM(${adminJsonIntSql('reversedCouponDiscountAmount')}), 0)::bigint AS "reversedCouponDiscountAmount",
        COALESCE(SUM(${adminJsonIntSql('reversedCompanyCouponExpense')}), 0)::bigint AS "reversedCompanyCouponExpense",
        COUNT(*) FILTER (WHERE "metadata" ? 'couponReviewFlag')::bigint AS "couponReviewFlagCount"
      FROM "BookingSettlementSnapshot"
      ${adminCouponFinanceSqlWhere(options)}
    `);
    const row = rows[0];

    return {
      bookingServiceAmount: numberValue(row?.bookingServiceAmount),
      companyCouponExpense: numberValue(row?.companyCouponExpense),
      couponDiscountAmount: numberValue(row?.couponDiscountAmount),
      couponReviewFlagCount: numberValue(row?.couponReviewFlagCount),
      couponSettlementCount: numberValue(row?.couponSettlementCount),
      currency: 'VND',
      customerPaidAmount: numberValue(row?.customerPaidAmount),
      partnerFundedCouponAmount: numberValue(row?.partnerFundedCouponAmount),
      platformFeeDiscountAmount: numberValue(row?.platformFeeDiscountAmount),
      reversedCompanyCouponExpense: numberValue(row?.reversedCompanyCouponExpense),
      reversedCouponDiscountAmount: numberValue(row?.reversedCouponDiscountAmount),
      settlementBaseAmount: numberValue(row?.settlementBaseAmount),
    };
  }

  async listPartnerWithholdingTax(options: AdminPartnerWithholdingTaxQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const where = adminPartnerWithholdingTaxWhere(period);
    const skip = boundedAdminListSkip(options.skip);
    const groups = await this.prisma.bookingSettlementSnapshot.groupBy({
      by: ['providerProfileId', 'monthlyPeriod', 'currency'],
      where,
      _count: { _all: true },
      _sum: {
        customerPaymentAmount: true,
        partnerPayoutAmount: true,
        partnerVatAmount: true,
        partnerPitAmount: true,
        partnerWithholdingTotal: true,
      },
      orderBy: [{ monthlyPeriod: 'desc' }, { providerProfileId: 'asc' }],
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
    });

    if (groups.length === 0) {
      return [];
    }

    const providers = await this.prisma.providerProfile.findMany({
      where: { id: { in: groups.map((group) => group.providerProfileId) } },
      select: {
        id: true,
        displayName: true,
        user: { select: { fullName: true, phone: true } },
      },
    });
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));

    return groups.map((group) => {
      const provider = providerById.get(group.providerProfileId);
      return {
        providerProfileId: group.providerProfileId,
        partnerName: provider?.displayName ?? provider?.user?.fullName ?? 'Unknown partner',
        partnerPhone: provider?.user?.phone ?? null,
        period: group.monthlyPeriod,
        currency: group.currency,
        completedBookingCount: group._count._all,
        grossServiceRevenue: group._sum.customerPaymentAmount ?? 0,
        partnerPayoutTotal: group._sum.partnerPayoutAmount ?? 0,
        partnerVatWithheldTotal: group._sum.partnerVatAmount ?? 0,
        partnerPitWithheldTotal: group._sum.partnerPitAmount ?? 0,
        totalPartnerTaxWithheld: group._sum.partnerWithholdingTotal ?? 0,
      };
    });
  }

  async partnerWithholdingTaxSummary(options: AdminPartnerWithholdingTaxQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const where = adminPartnerWithholdingTaxWhere(period);
    const [totals, providerCountRows] = await Promise.all([
      this.prisma.bookingSettlementSnapshot.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          partnerPayoutAmount: true,
          partnerVatAmount: true,
          partnerPitAmount: true,
          partnerWithholdingTotal: true,
        },
      }),
      this.prisma.$queryRaw<Array<{ partnerCountWithRevenue: bigint | number | null }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "providerProfileId")::bigint AS "partnerCountWithRevenue"
        FROM "BookingSettlementSnapshot"
        ${adminPartnerWithholdingTaxSqlWhere(period)}
      `),
    ]);
    const providerCount = providerCountRows[0];

    return {
      period,
      currency: 'VND',
      partnerCountWithRevenue: numberValue(providerCount?.partnerCountWithRevenue),
      taxableBookingCount: totals._count._all,
      grossServiceRevenue: totals._sum.customerPaymentAmount ?? 0,
      partnerPayoutTotal: totals._sum.partnerPayoutAmount ?? 0,
      partnerVatWithheldTotal: totals._sum.partnerVatAmount ?? 0,
      partnerPitWithheldTotal: totals._sum.partnerPitAmount ?? 0,
      totalPartnerTaxWithheld: totals._sum.partnerWithholdingTotal ?? 0,
    };
  }

  listMonthlyTaxClosings(options: AdminMonthlyTaxClosingQuery = {}) {
    const period = normalizeNullable(options.period);
    const where = period ? { period: adminPartnerWithholdingTaxPeriod(period) } : undefined;
    const skip = boundedAdminListSkip(options.skip);

    return this.prisma.monthlyTaxClosing.findMany({
      ...(where ? { where } : {}),
      orderBy: { period: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminMonthlyTaxClosingListSelect,
    });
  }

  async monthlyTaxClosingSummary(options: AdminMonthlyTaxClosingQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const where = { monthlyPeriod: period };
    const [
      closing,
      totals,
      cashTotals,
      nonCashTotals,
      providerCountRows,
      openTaxCount,
      paidTaxCount,
      couponTotals,
    ] = await Promise.all([
      this.prisma.monthlyTaxClosing.findUnique({
        where: { period_currency: { period, currency: 'VND' } },
      }),
      this.prisma.bookingSettlementSnapshot.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          partnerPayoutAmount: true,
          platformFeeGross: true,
          platformFeeNetRevenue: true,
          companyOutputVat: true,
          partnerVatAmount: true,
          partnerPitAmount: true,
          partnerWithholdingTotal: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.aggregate({
        where: { ...where, paymentMethod: PaymentMethod.CASH },
        _sum: {
          platformFeeGross: true,
          partnerWithholdingTotal: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.aggregate({
        where: { ...where, paymentMethod: { not: PaymentMethod.CASH } },
        _sum: {
          partnerPayoutAmount: true,
        },
      }),
      this.prisma.$queryRaw<Array<{ partnerCountWithRevenue: bigint | number | null }>>(Prisma.sql`
          SELECT COUNT(DISTINCT "providerProfileId")::bigint AS "partnerCountWithRevenue"
          FROM "BookingSettlementSnapshot"
          ${adminPartnerWithholdingTaxSqlWhere(period)}
        `),
      this.prisma.bookingSettlementSnapshot.count({
        where: { ...where, taxStatus: BookingSettlementTaxStatus.OPEN },
      }),
      this.prisma.bookingSettlementSnapshot.count({
        where: { ...where, taxStatus: BookingSettlementTaxStatus.PAID },
      }),
      this.prisma.$queryRaw<
        Array<{
          companyCouponExpense: bigint | number | null;
          couponDiscountAmount: bigint | number | null;
          couponReviewFlagCount: bigint | number | null;
          couponSettlementCount: bigint | number | null;
          partnerFundedCouponAmount: bigint | number | null;
          platformFeeDiscountAmount: bigint | number | null;
        }>
      >(Prisma.sql`
          SELECT
            COUNT(*)::bigint AS "couponSettlementCount",
            COALESCE(SUM(${adminJsonIntSql('couponDiscountAmount')}), 0)::bigint AS "couponDiscountAmount",
            COALESCE(SUM(${adminJsonIntSql('companyCouponExpense')}), 0)::bigint AS "companyCouponExpense",
            COALESCE(SUM(${adminJsonIntSql('partnerFundedCouponAmount')}), 0)::bigint AS "partnerFundedCouponAmount",
            COALESCE(SUM(${adminJsonIntSql('platformFeeDiscountAmount')}), 0)::bigint AS "platformFeeDiscountAmount",
            COUNT(*) FILTER (WHERE "metadata" ? 'couponReviewFlag')::bigint AS "couponReviewFlagCount"
          FROM "BookingSettlementSnapshot"
          WHERE "monthlyPeriod" = ${period}
            AND ("metadata" ? 'couponDiscountAmount' OR "metadata" ? 'couponCodeSnapshot' OR "metadata" ? 'couponId')
        `),
    ]);

    const customerPaymentAmountTotal = totals._sum.customerPaymentAmount ?? 0;
    const partnerPayoutTotal = totals._sum.partnerPayoutAmount ?? 0;
    const partnerWithholdingTotal = totals._sum.partnerWithholdingTotal ?? 0;
    const paymentProcessingFeeTotal = totals._sum.paymentProcessingFee ?? 0;
    const platformFeeGrossTotal = totals._sum.platformFeeGross ?? 0;
    const companyOutputVatTotal = totals._sum.companyOutputVat ?? 0;
    const platformFeeNetRevenueTotal = totals._sum.platformFeeNetRevenue ?? 0;
    const providerCount = providerCountRows[0];
    const couponSummary = couponTotals[0];

    return {
      id: closing?.id ?? null,
      period,
      currency: closing?.currency ?? 'VND',
      status: closing?.status ?? 'DRAFT',
      settlementCount: totals._count._all,
      customerPaymentAmountTotal,
      partnerPayoutTotal,
      platformFeeGrossTotal,
      platformFeeNetRevenueTotal,
      companyOutputVatTotal,
      partnerVatWithheldTotal: totals._sum.partnerVatAmount ?? 0,
      partnerPitWithheldTotal: totals._sum.partnerPitAmount ?? 0,
      partnerWithholdingTotal,
      paymentProcessingFeeTotal,
      couponSettlementCount: numberValue(couponSummary?.couponSettlementCount),
      couponDiscountAmountTotal: numberValue(couponSummary?.couponDiscountAmount),
      companyCouponExpenseTotal: numberValue(couponSummary?.companyCouponExpense),
      partnerFundedCouponAmountTotal: numberValue(couponSummary?.partnerFundedCouponAmount),
      platformFeeDiscountAmountTotal: numberValue(couponSummary?.platformFeeDiscountAmount),
      couponReviewFlagCount: numberValue(couponSummary?.couponReviewFlagCount),
      cashDebtTotal: (cashTotals._sum.platformFeeGross ?? 0) + (cashTotals._sum.partnerWithholdingTotal ?? 0),
      nonCashPartnerPayoutTotal: nonCashTotals._sum.partnerPayoutAmount ?? 0,
      partnerCountWithRevenue: numberValue(providerCount?.partnerCountWithRevenue),
      openTaxCount,
      paidTaxCount,
      reconciliationDelta:
        customerPaymentAmountTotal -
        partnerPayoutTotal -
        partnerWithholdingTotal -
        platformFeeGrossTotal,
      netRevenueDelta: platformFeeGrossTotal - companyOutputVatTotal - platformFeeNetRevenueTotal,
      declaredAt: closing?.declaredAt ?? null,
      paidAt: closing?.paidAt ?? null,
      closedAt: closing?.closedAt ?? null,
      notes: closing?.notes ?? null,
      remittanceMetadata: closing?.remittanceMetadata ?? null,
    };
  }

  async updateMonthlyTaxClosingStatus(
    actorId: string,
    periodInput: string,
    input: AdminMonthlyTaxClosingStatusInput,
  ) {
    const period = adminPartnerWithholdingTaxPeriod(periodInput);
    const status = monthlyTaxClosingStatus(input.status);
    const notes = normalizeNullable(input.notes);
    const existing = await this.prisma.monthlyTaxClosing.findUnique({
      where: { period_currency: { period, currency: 'VND' } },
    });

    if (existing?.status === MonthlyTaxClosingStatus.CLOSED && status !== MonthlyTaxClosingStatus.CLOSED) {
      throw new BadRequestException('Closed monthly periods require reversal entries, not direct edits.');
    }
    assertMonthlyTaxClosingStatusTransition(existing?.status ?? MonthlyTaxClosingStatus.DRAFT, status);
    const remittance = monthlyTaxClosingRemittanceMetadata(status, input, actorId);
    if (remittance?.approvedByAdminId) {
      await assertFinanceActionApprovalAdmin(
        this.prisma,
        remittance.approvedByAdminId,
        'Partner withholding remittance paid closeout',
      );
    }

    const summary = await this.monthlyTaxClosingSummary({ period });
    assertMonthlyTaxClosingReconciliationIsBalanced(summary, status);
    await assertMonthlyTaxClosingPostedJournalsAreBalanced(this.prisma, period, status);
    const now = new Date();
    const statusData = monthlyTaxClosingStatusMutationData(status, actorId, remittance?.paidAtDate ?? now);
    const remittanceData = remittance
      ? {
          remittanceMetadata: toJson(remittance.metadata),
        }
      : {};
    const totalsData = {
      platformFeeGrossTotal: summary.platformFeeGrossTotal,
      platformFeeNetRevenueTotal: summary.platformFeeNetRevenueTotal,
      companyOutputVatTotal: summary.companyOutputVatTotal,
      partnerVatWithheldTotal: summary.partnerVatWithheldTotal,
      partnerPitWithheldTotal: summary.partnerPitWithheldTotal,
      partnerWithholdingTotal: summary.partnerWithholdingTotal,
      paymentProcessingFeeTotal: summary.paymentProcessingFeeTotal,
      cashDebtTotal: summary.cashDebtTotal,
      nonCashPartnerPayoutTotal: summary.nonCashPartnerPayoutTotal,
      settlementCount: summary.settlementCount,
    };

    return this.prisma.$transaction(async (tx) => {
      const closing = await tx.monthlyTaxClosing.upsert({
        where: {
          period_currency: {
            period,
            currency: summary.currency,
          },
        },
        create: {
          period,
          currency: summary.currency,
          status,
          createdById: actorId,
          notes,
          ...totalsData,
          ...statusData,
          ...remittanceData,
        },
        update: {
          status,
          notes,
          ...totalsData,
          ...statusData,
          ...remittanceData,
        },
        select: adminMonthlyTaxClosingListSelect,
      });
      const settlementTaxStatus = monthlyTaxClosingSettlementTaxStatus(status);
      let linkedSettlementSnapshotCount = 0;
      if (settlementTaxStatus) {
        const linkedSettlementSnapshots = await tx.bookingSettlementSnapshot.updateMany({
          where: {
            monthlyPeriod: period,
            currency: summary.currency,
            settlementStatus: BookingSettlementStatus.POSTED,
          },
          data: {
            monthlyClosingId: closing.id,
            taxStatus: settlementTaxStatus,
          },
        });
        linkedSettlementSnapshotCount = linkedSettlementSnapshots.count;
      }
      await upsertWithholdingRemittanceJournal(tx, {
        actorId,
        closingId: closing.id,
        currency: summary.currency,
        period,
        remittanceMetadata: remittance?.metadata ?? null,
        total: summary.partnerWithholdingTotal,
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'monthly_tax_closing.status_update',
          target: `monthly_tax_closing:${period}:${summary.currency}`,
          metadata: toJson({
            fromStatus: existing?.status ?? summary.status,
            toStatus: status,
            period,
            currency: summary.currency,
            linkedSettlementSnapshotCount,
            settlementCount: summary.settlementCount,
            customerPaymentAmountTotal: summary.customerPaymentAmountTotal,
            partnerPayoutTotal: summary.partnerPayoutTotal,
            platformFeeGrossTotal: summary.platformFeeGrossTotal,
            platformFeeNetRevenueTotal: summary.platformFeeNetRevenueTotal,
            companyOutputVatTotal: summary.companyOutputVatTotal,
            partnerWithholdingTotal: summary.partnerWithholdingTotal,
            paymentProcessingFeeTotal: summary.paymentProcessingFeeTotal,
            couponSettlementCount: summary.couponSettlementCount,
            couponDiscountAmountTotal: summary.couponDiscountAmountTotal,
            companyCouponExpenseTotal: summary.companyCouponExpenseTotal,
            partnerFundedCouponAmountTotal: summary.partnerFundedCouponAmountTotal,
            platformFeeDiscountAmountTotal: summary.platformFeeDiscountAmountTotal,
            couponReviewFlagCount: summary.couponReviewFlagCount,
            reconciliationDelta: summary.reconciliationDelta,
            netRevenueDelta: summary.netRevenueDelta,
            remittance: remittance?.metadata ?? null,
            notes,
          }),
        },
      });

      return closing;
    });
  }

  async platformVatSummary(options: AdminMonthlyTaxClosingQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const where = { monthlyPeriod: period };
    const [totals, rateGroups] = await Promise.all([
      this.prisma.bookingSettlementSnapshot.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          platformFeeGross: true,
          platformFeeNetRevenue: true,
          companyOutputVat: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.groupBy({
        by: ['platformVatRateBps'],
        where,
        _count: { _all: true },
        _sum: {
          platformFeeGross: true,
          platformFeeNetRevenue: true,
          companyOutputVat: true,
        },
      }),
    ]);

    const platformFeeGrossTotal = totals._sum.platformFeeGross ?? 0;
    const platformFeeNetRevenueTotal = totals._sum.platformFeeNetRevenue ?? 0;
    const companyOutputVatTotal = totals._sum.companyOutputVat ?? 0;

    return {
      period,
      currency: 'VND',
      settlementCount: totals._count._all,
      platformFeeGrossTotal,
      platformFeeNetRevenueTotal,
      companyOutputVatTotal,
      netRevenueDelta: platformFeeGrossTotal - companyOutputVatTotal - platformFeeNetRevenueTotal,
      rateBreakdown: rateGroups.map((group) => ({
        category: platformVatCategory(group.platformVatRateBps),
        platformVatRateBps: group.platformVatRateBps,
        settlementCount: group._count._all,
        platformFeeGrossTotal: group._sum.platformFeeGross ?? 0,
        platformFeeNetRevenueTotal: group._sum.platformFeeNetRevenue ?? 0,
        companyOutputVatTotal: group._sum.companyOutputVat ?? 0,
      })),
    };
  }

  async paymentFeeSummary(options: AdminMonthlyTaxClosingQuery = {}) {
    const period = adminPartnerWithholdingTaxPeriod(options.period);
    const where = { monthlyPeriod: period };
    const [totals, methodGroups, payerGroups, treatmentGroups] = await Promise.all([
      this.prisma.bookingSettlementSnapshot.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.groupBy({
        by: ['paymentFeePayer'],
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          paymentProcessingFee: true,
        },
      }),
      this.prisma.bookingSettlementSnapshot.groupBy({
        by: ['paymentFeeTreatment'],
        where,
        _count: { _all: true },
        _sum: {
          customerPaymentAmount: true,
          paymentProcessingFee: true,
        },
      }),
    ]);

    return {
      period,
      currency: 'VND',
      settlementCount: totals._count._all,
      customerPaymentAmountTotal: totals._sum.customerPaymentAmount ?? 0,
      paymentProcessingFeeTotal: totals._sum.paymentProcessingFee ?? 0,
      byPaymentMethod: methodGroups.map((group) => ({
        paymentMethod: group.paymentMethod,
        settlementCount: group._count._all,
        customerPaymentAmountTotal: group._sum.customerPaymentAmount ?? 0,
        paymentProcessingFeeTotal: group._sum.paymentProcessingFee ?? 0,
      })),
      byPayer: payerGroups.map((group) => ({
        paymentFeePayer: group.paymentFeePayer,
        settlementCount: group._count._all,
        customerPaymentAmountTotal: group._sum.customerPaymentAmount ?? 0,
        paymentProcessingFeeTotal: group._sum.paymentProcessingFee ?? 0,
      })),
      byTreatment: treatmentGroups.map((group) => ({
        paymentFeeTreatment: group.paymentFeeTreatment,
        settlementCount: group._count._all,
        customerPaymentAmountTotal: group._sum.customerPaymentAmount ?? 0,
        paymentProcessingFeeTotal: group._sum.paymentProcessingFee ?? 0,
      })),
    };
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

  async recordPartnerBankDeposit(actorId: string, input: RecordPartnerBankDepositDto) {
    const { approvalAdminId: rawApprovalAdminId, ...depositInput } = input;
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      rawApprovalAdminId,
      actorId,
      'Partner bank deposit',
    );
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Partner bank deposit');

    const ledger = await this.earnings.recordPartnerBankDeposit({
      ...depositInput,
      adminId: actorId,
    });
    await this.writeAudit(
      actorId,
      'provider_wallet.bank_deposit_received',
      `provider_wallet_ledger:${ledger.id}`,
      {
        providerProfileId: ledger.providerProfileId,
        amount: ledger.amount,
        currency: ledger.currency,
        reference: ledger.reference,
        sourceKey: ledger.sourceKey,
        approvalAdminId,
      },
    );
    return ledger;
  }

  previewManualWalletAdjustment(actorId: string, input: PreviewManualWalletAdjustmentDto) {
    return this.buildManualWalletAdjustmentPreviewForAdmin(this.prisma, actorId, input, false);
  }

  createManualWalletAdjustment(actorId: string, input: CreateManualWalletAdjustmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const preview = await this.buildManualWalletAdjustmentPreviewForAdmin(tx, actorId, input, true);

      if (preview.requiresAttachment && !normalizeNullable(input.attachmentUrl)) {
        throw new BadRequestException('Attachment is required for this manual wallet adjustment');
      }

      const metadata = manualWalletAdjustmentMetadata(preview, preview.attachmentUrl);
      const ledger =
        preview.ownerType === 'CUSTOMER'
          ? await tx.customerWalletLedgerEntry.create({
              data: {
                customerProfileId: preview.ownerId,
                type: CustomerWalletLedgerType.ADMIN_ADJUSTMENT,
                sourceKey: manualWalletAdjustmentSourceKey(preview),
                amount: preview.walletDelta,
                currency: preview.currency,
                reference: preview.approvalId,
                notes: preview.reason,
                metadata,
              },
            })
          : await tx.providerWalletLedgerEntry.create({
              data: {
                providerProfileId: preview.ownerId,
                type: providerManualWalletAdjustmentLedgerType(preview),
                sourceKey: manualWalletAdjustmentSourceKey(preview),
                amount: preview.walletDelta,
                currency: preview.currency,
                reference: preview.approvalId,
                notes: preview.reason,
                metadata,
              },
            });

      await upsertManualWalletAdjustmentJournal(tx, preview, ledger.id, actorId);

      const target =
        preview.ownerType === 'CUSTOMER'
          ? `customer_wallet_ledger:${ledger.id}`
          : `provider_wallet_ledger:${ledger.id}`;
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'wallet_ledger.manual_adjustment.create',
          target,
          metadata,
        },
      });

      return { preview, ledger, auditLog };
    });
  }

  async listManualWalletAdjustments(options: AdminManualWalletAdjustmentQuery = {}) {
    const take = boundedAdminListLimit(
      options.take ?? ADMIN_MANUAL_WALLET_ADJUSTMENT_DEFAULT_LIMIT,
      ADMIN_MANUAL_WALLET_ADJUSTMENT_MAX_LIMIT,
    );
    const skip = boundedAdminListSkip(options.skip);
    const ownerType = normalizeManualWalletAdjustmentOwnerTypeFilter(options.ownerType);
    const ownerId = normalizeNullable(options.ownerId);

    if (!ownerType) {
      const orderedRows = await this.prisma.$queryRaw<ManualWalletAdjustmentLedgerIdRow[]>(Prisma.sql`
        SELECT "id", 'CUSTOMER' AS "ownerType", "createdAt"
        FROM "CustomerWalletLedgerEntry"
        WHERE "type" = ${CustomerWalletLedgerType.ADMIN_ADJUSTMENT}::"CustomerWalletLedgerType"
          AND "sourceKey" LIKE 'manual-wallet-adjustment:%'
          ${ownerId ? Prisma.sql`AND "customerProfileId" = ${ownerId}` : Prisma.empty}
        UNION ALL
        SELECT "id", 'PARTNER' AS "ownerType", "createdAt"
        FROM "ProviderWalletLedgerEntry"
        WHERE "type" IN (${Prisma.join(MANUAL_WALLET_ADJUSTMENT_PROVIDER_SQL_TYPES)})
          AND "sourceKey" LIKE 'manual-wallet-adjustment:%'
          ${ownerId ? Prisma.sql`AND "providerProfileId" = ${ownerId}` : Prisma.empty}
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT ${take}
        OFFSET ${skip}
      `);
      const customerIds = orderedRows
        .filter((row) => row.ownerType === 'CUSTOMER')
        .map((row) => row.id);
      const providerIds = orderedRows
        .filter((row) => row.ownerType === 'PARTNER')
        .map((row) => row.id);
      const [customerRows, providerRows] = await Promise.all([
        customerIds.length
          ? this.prisma.customerWalletLedgerEntry.findMany({
              where: {
                ...manualWalletAdjustmentCustomerWhere(ownerId),
                id: { in: customerIds },
              },
              select: manualWalletAdjustmentCustomerListSelect,
            })
          : [],
        providerIds.length
          ? this.prisma.providerWalletLedgerEntry.findMany({
              where: {
                ...manualWalletAdjustmentProviderWhere(ownerId),
                id: { in: providerIds },
              },
              select: manualWalletAdjustmentProviderListSelect,
            })
          : [],
      ]);
      const rowsByKey = new Map([
        ...customerRows.map((row) => [`CUSTOMER:${row.id}`, manualWalletAdjustmentCustomerRow(row)] as const),
        ...providerRows.map((row) => [`PARTNER:${row.id}`, manualWalletAdjustmentProviderRow(row)] as const),
      ]);

      return orderedRows
        .map((row) => rowsByKey.get(`${row.ownerType}:${row.id}`))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }

    const [customerRows, providerRows] = await Promise.all([
      ownerType === 'PARTNER'
        ? []
        : this.prisma.customerWalletLedgerEntry.findMany({
            where: manualWalletAdjustmentCustomerWhere(ownerId),
            orderBy: { createdAt: 'desc' },
            ...(skip > 0 ? { skip } : {}),
            take,
            select: manualWalletAdjustmentCustomerListSelect,
          }),
      ownerType === 'CUSTOMER'
        ? []
        : this.prisma.providerWalletLedgerEntry.findMany({
            where: manualWalletAdjustmentProviderWhere(ownerId),
            orderBy: { createdAt: 'desc' },
            ...(skip > 0 ? { skip } : {}),
            take,
            select: manualWalletAdjustmentProviderListSelect,
          }),
    ]);

    return [
      ...customerRows.map((row) => manualWalletAdjustmentCustomerRow(row)),
      ...providerRows.map((row) => manualWalletAdjustmentProviderRow(row)),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, take);
  }

  async manualWalletAdjustmentSummary(options: AdminManualWalletAdjustmentQuery = {}) {
    const ownerType = normalizeManualWalletAdjustmentOwnerTypeFilter(options.ownerType);
    const ownerId = normalizeNullable(options.ownerId);
    const [customerCount, providerCount] = await Promise.all([
      ownerType === 'PARTNER'
        ? Promise.resolve(0)
        : this.prisma.customerWalletLedgerEntry.count({
            where: manualWalletAdjustmentCustomerWhere(ownerId),
          }),
      ownerType === 'CUSTOMER'
        ? Promise.resolve(0)
        : this.prisma.providerWalletLedgerEntry.count({
            where: manualWalletAdjustmentProviderWhere(ownerId),
          }),
    ]);

    return {
      total: customerCount + providerCount,
    };
  }

  private async buildManualWalletAdjustmentPreviewForAdmin(
    db: ManualWalletAdjustmentDb,
    actorId: string,
    input: PreviewManualWalletAdjustmentDto | CreateManualWalletAdjustmentDto,
    requireApproval: boolean,
  ): Promise<AdminManualWalletAdjustmentPreview> {
    const ownerType = manualWalletAdjustmentOwnerType(input.ownerType);
    const direction = manualWalletAdjustmentDirection(input.direction);
    const adjustmentType = manualWalletAdjustmentType(input.adjustmentType);
    const ownerId = normalizeManualWalletOwnerId(input.ownerId);
    const currency = normalizeManualWalletCurrency(input.currency);
    const monthlyPeriod = normalizeManualWalletMonthlyPeriod(input.monthlyPeriod);
    const approvalId = normalizeManualWalletApprovalId(input.approvalId, requireApproval);
    const approvalAdminId = normalizeManualWalletApprovalAdminId(
      input.approvalAdminId,
      actorId,
      requireApproval,
    );
    const attachmentUrl = normalizeManualWalletAttachmentUrl(input.attachmentUrl);
    if (approvalAdminId) {
      await assertFinanceActionApprovalAdmin(db, approvalAdminId, 'Manual wallet adjustment');
    }
    const [currentBalance, monthlyPeriodStatus] = await Promise.all([
      this.manualWalletCurrentBalance(db, ownerType, ownerId, currency),
      this.manualWalletMonthlyPeriodStatus(db, monthlyPeriod, currency),
    ]);

    try {
      const preview = buildManualWalletAdjustmentPreview({
        adminId: actorId,
        adjustmentType,
        amount: integerValue(input.amount),
        approvalId,
        attachmentUrl,
        currentBalance,
        direction,
        monthlyPeriodStatus,
        ownerType,
        reason: normalizeAuditReason(input.reason),
      });
      return { ...preview, approvalAdminId, currency, monthlyPeriod, ownerId };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Manual wallet adjustment is invalid',
      );
    }
  }

  private async manualWalletCurrentBalance(
    db: ManualWalletAdjustmentDb,
    ownerType: ManualWalletAdjustmentOwnerType,
    ownerId: string,
    currency: string,
  ) {
    if (ownerType === 'CUSTOMER') {
      await assertManualWalletOwnerExists(
        db.customerProfile.findUniqueOrThrow({
          where: { id: ownerId },
          select: { id: true },
        }),
      );
      const aggregate = await db.customerWalletLedgerEntry.aggregate({
        where: { customerProfileId: ownerId, currency },
        _sum: { amount: true },
      });
      return integerValue(aggregate._sum.amount);
    }

    await assertManualWalletOwnerExists(
      db.providerProfile.findUniqueOrThrow({
        where: { id: ownerId },
        select: { id: true },
      }),
    );
    const aggregate = await db.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId: ownerId, currency },
      _sum: { amount: true },
    });
    return integerValue(aggregate._sum.amount);
  }

  private async manualWalletMonthlyPeriodStatus(
    db: ManualWalletAdjustmentDb,
    monthlyPeriod: string | null,
    currency: string,
  ): Promise<ManualWalletAdjustmentInput['monthlyPeriodStatus']> {
    if (!monthlyPeriod) {
      return undefined;
    }

    const closing = await db.monthlyTaxClosing.findFirst({
      where: { period: monthlyPeriod, currency },
      select: { status: true },
    });
    return closing?.status as ManualWalletAdjustmentInput['monthlyPeriodStatus'];
  }

  listProviderWalletWithdrawalRequests(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listProviderWalletWithdrawalRequestsForAdmin(options);
  }

  providerWalletWithdrawalRequestSummary(
    options: Pick<AdminPaymentOperationsQuery, 'range' | 'providerProfileId'> = {},
  ) {
    return this.earnings.providerWalletWithdrawalRequestSummaryForAdmin(options);
  }

  async updateProviderWalletWithdrawalRequest(
    actorId: string,
    requestId: string,
    input: {
      approvalAdminId?: string | null;
      status?: string | null;
      transferRef?: string | null;
      bankTransferDate?: string | Date | null;
      attachmentFileId?: string | null;
      attachmentUrl?: string | null;
      adminNote?: string | null;
      correctionReason?: string | null;
    },
  ) {
    const { approvalAdminId: rawApprovalAdminId, ...earningsInput } = input;
    const approvalAdminId =
      input.status === 'PAID'
        ? normalizeFinanceActionApprovalAdminId(
            rawApprovalAdminId,
            actorId,
            'Provider wallet withdrawal paid closeout',
          )
        : normalizeNullable(rawApprovalAdminId);
    if (input.status === 'PAID' && approvalAdminId) {
      await assertFinanceActionApprovalAdmin(
        this.prisma,
        approvalAdminId,
        'Provider wallet withdrawal paid closeout',
      );
    }
    const request = await this.earnings.updateProviderWalletWithdrawalRequestForAdmin(
      requestId,
      earningsInput,
      actorId,
    );
    const withdrawalStatusChange = providerWalletWithdrawalStatusChangeForAudit(request.metadata ?? null);
    const previousStatus =
      typeof withdrawalStatusChange?.previousStatus === 'string'
        ? withdrawalStatusChange.previousStatus
        : null;
    await this.writeAudit(
      actorId,
      'provider_wallet.withdrawal_request.update',
      `provider_wallet_withdrawal_request:${request.id}`,
      {
        providerProfileId: request.providerProfileId,
        ...(approvalAdminId ? { approvalAdminId } : {}),
        amount: request.amount,
        currency: request.currency,
        status: request.status,
        previousStatus,
        withdrawalStatusChange,
        transferRef: request.transferRef,
        bankTransferDate: input.bankTransferDate,
        attachmentFileId: input.attachmentFileId,
        attachmentUrl: input.attachmentUrl,
      },
    );
    return request;
  }

  listPayoutBatches(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.listPayoutBatchesForAdmin(options);
  }

  payoutBatchSummary(options: AdminPaymentOperationsQuery = {}) {
    return this.earnings.payoutBatchSummaryForAdmin(options);
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
    input: {
      approvalAdminId?: string | null;
      status?: PayoutBatchStatus;
      transferRef?: string | null;
      notes?: string | null;
    },
  ) {
    const { approvalAdminId: rawApprovalAdminId, ...earningsInput } = input;
    const approvalAdminId =
      input.status === PayoutBatchStatus.PAID
        ? normalizeFinanceActionApprovalAdminId(rawApprovalAdminId, actorId, 'Payout batch paid closeout')
        : normalizeNullable(rawApprovalAdminId);
    if (input.status === PayoutBatchStatus.PAID && approvalAdminId) {
      await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Payout batch paid closeout');
    }
    if (input.status === PayoutBatchStatus.PAID && !normalizeNullable(input.transferRef)) {
      throw new BadRequestException('Payout batch paid closeout requires a transfer reference');
    }
    const batch = await this.earnings.updatePayoutBatch(payoutBatchId, earningsInput);
    await this.writeAudit(actorId, 'payout_batch.update', `payout_batch:${batch.id}`, {
      ...(approvalAdminId ? { approvalAdminId } : {}),
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

  async listCoupons(options: { skip?: number | string | null; take?: number | string | null } = {}) {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      skip: adminCouponListSkip(options.skip),
      take: adminCouponListTake(options.take),
    });

    return coupons.map((coupon) => ({ ...coupon, usageBookings: [] }));
  }

  async couponSummary() {
    const now = new Date();
    const [totalCount, liveCount, scheduledCount, expiredCount, pausedCount] = await Promise.all([
      this.prisma.coupon.count(),
      this.prisma.coupon.count({
        where: {
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      }),
      this.prisma.coupon.count({
        where: { active: true, startsAt: { gt: now } },
      }),
      this.prisma.coupon.count({
        where: { active: true, endsAt: { lt: now } },
      }),
      this.prisma.coupon.count({
        where: { active: false },
      }),
    ]);

    return {
      expiredCount,
      generatedAt: now.toISOString(),
      liveCount,
      pausedCount,
      scheduledCount,
      totalCount,
    };
  }

  async listCouponUsageBookings(
    couponId: string,
    options: { skip?: number | string | null; take?: number | string | null } = {},
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { code: true, id: true },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const skip = adminCouponUsageListSkip(options.skip);
    const take = adminCouponUsageListTake(options.take);
    const where = adminCouponUsageBookingWhere(coupon);
    const [totalCount, bookings] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
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
      }),
    ]);

    return {
      couponCode: coupon.code,
      couponId: coupon.id,
      rows: bookings.map(couponUsageBookingView),
      skip,
      take,
      totalCount,
    };
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
    const recentHourSince = new Date(Date.now() - 60 * 60 * 1000);
    const [totalCount, recentHour, actionGroups] = await Promise.all([
      this.prisma.adminAuditLog.count({
        ...(where ? { where } : {}),
      }),
      this.prisma.adminAuditLog.count({
        where: withAdminAuditLogWhere(where, { createdAt: { gte: recentHourSince } }),
      }),
      this.prisma.adminAuditLog.groupBy({
        by: ['action'],
        ...(where ? { where } : {}),
        _count: { _all: true },
      }),
    ]);
    const actionSummary = adminAuditLogActionSummary(actionGroups);

    return {
      ...actionSummary,
      generatedAt: new Date().toISOString(),
      recentHour,
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

  async listOperationalPolicySettings(options: AdminOperationalPolicyListOptions = {}) {
    const requestedKeys = normalizeOperationalPolicyKeys(options.keys);
    const savedSettings = await this.prisma.operationalPolicySetting.findMany({
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
      ...(requestedKeys.length > 0 ? { where: { key: { in: requestedKeys } } } : {}),
    });
    const savedByKey = new Map(savedSettings.map((setting) => [setting.key, setting]));
    const definitions =
      requestedKeys.length > 0
        ? OPERATIONAL_POLICY_DEFINITIONS.filter((definition) => requestedKeys.includes(definition.key))
        : OPERATIONAL_POLICY_DEFINITIONS;

    return definitions.map((definition) => {
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
    const notificationDeliveryCountWhere = (
      where?: Prisma.NotificationDeliveryWhereInput,
    ): Prisma.NotificationDeliveryWhereInput | undefined => {
      const filters: Prisma.NotificationDeliveryWhereInput[] = [];
      if (baseWhere) {
        filters.push({ notification: baseWhere });
      }
      if (where) {
        filters.push(where);
      }
      if (filters.length === 0) {
        return undefined;
      }
      if (filters.length === 1) {
        return filters[0];
      }
      return { AND: filters };
    };
    const countNotificationDeliveries = (where?: Prisma.NotificationDeliveryWhereInput) =>
      this.prisma.notificationDelivery.count({ where: notificationDeliveryCountWhere(where) });

    const [
      totalCount,
      failed,
      fcmDeliveries,
      inAppDeliveries,
      sent,
      skipped,
      pending,
      disabledDevices,
      staleDevices,
      needsRetry,
      noShow,
      payoutSetup,
      partnerAlertCount,
    ] = await Promise.all([
      countNotifications(),
      countNotifications(notificationDeliveryStatusWhere('FAILED')),
      countNotificationDeliveries({ provider: 'FCM' }),
      countNotificationDeliveries({ provider: 'IN_APP_ONLY' }),
      countNotificationDeliveries({ status: 'SENT' }),
      countNotificationDeliveries({ status: 'SKIPPED' }),
      countNotifications({ deliveries: { none: {} } }),
      countNotifications({ user: { pushDevices: { some: { enabled: false } } } }),
      countNotifications(notificationStaleDeliveryCandidateWhere()),
      countNotifications(notificationBoardReviewWhere('needs-retry')),
      countNotifications({ type: 'booking.no_show' }),
      countNotifications({ type: 'provider.payout_setup_required' }),
      countNotifications({ type: { in: [...ADMIN_NOTIFICATION_PARTNER_ALERT_TYPES] } }),
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

  async listNotificationTemplates(options: AdminNotificationTemplateListQuery = {}) {
    await this.ensureDefaultNotificationTemplates();

    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ audience: 'asc' }, { key: 'asc' }],
      skip: boundedAdminListSkip(options.skip),
      take: boundedAdminListLimit(options.take, ADMIN_NOTIFICATION_TEMPLATE_LIST_LIMIT),
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
    options: {
      readonly from?: string;
      readonly skip?: string;
      readonly take?: string;
      readonly to?: string;
    } = {},
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

  async adminPushCampaignSummary(options: { readonly from?: string; readonly to?: string } = {}) {
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
          actor."email" AS "actorEmail",
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
        "actorEmail",
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
        email: row.actorEmail,
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

function sumNumbers(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function percentageValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;

  return Math.round((numerator / denominator) * 100);
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

function adminCouponListTake(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return ADMIN_COUPON_LIST_DEFAULT_LIMIT;
  }

  return boundedAdminListLimit(value, ADMIN_COUPON_LIST_MAX_LIMIT);
}

function adminCouponListSkip(value: number | string | null | undefined): number {
  return boundedAdminListSkip(value);
}

function adminCouponUsageListTake(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_COUPON_USAGE_LIST_LIMIT);
}

function adminCouponUsageListSkip(value: number | string | null | undefined): number {
  return boundedAdminListSkip(value);
}

function adminCouponUsageBookingWhere(coupon: { code: string; id: string }): Prisma.BookingWhereInput {
  return {
    payment: {
      is: {
        OR: [
          { rawMeta: { path: ['couponId'], equals: coupon.id } },
          { rawMeta: { path: ['couponCode'], equals: coupon.code } },
        ],
      },
    },
  };
}

function adminAppSessionListTake(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_APP_SESSION_LIST_LIMIT);
}

function adminAppSessionListSkip(value: number | string | null | undefined): number {
  return boundedAdminListSkip(value);
}

function adminReferralParentListTake(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return ADMIN_REFERRAL_PARENT_LIST_DEFAULT_LIMIT;
  }

  return boundedAdminListLimit(value, ADMIN_REFERRAL_PARENT_LIST_MAX_LIMIT);
}

function adminReferralParentListSkip(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(numeric), 0), 10_000);
}

function adminReferralCashoutListTake(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return ADMIN_REFERRAL_CASHOUT_LIST_DEFAULT_LIMIT;
  }

  return boundedAdminListLimit(value, ADMIN_REFERRAL_CASHOUT_LIST_MAX_LIMIT);
}

function adminReferralCashoutListSkip(value: number | string | null | undefined): number {
  return boundedAdminListSkip(value);
}

function adminReferralCashoutWhere(options: AdminReferralCashoutQueueQuery): Prisma.ReferralRewardWhereInput {
  const filters: Prisma.ReferralRewardWhereInput[] = [
    { status: { in: adminReferralCashoutStatuses(options.status) } },
  ];
  const audience = adminReferralCashoutAudience(options.audience);
  const q = normalizeNullable(options.q);

  if (audience) {
    filters.push({ attribution: { audience } });
  }
  if (q) {
    filters.push({ OR: adminReferralCashoutSearchFilters(q) });
  }

  return { AND: filters };
}

function adminReferralCashoutStatuses(value: string | null | undefined): ReferralRewardStatus[] {
  const normalized = normalizeNullable(value);
  if (normalized === 'requested') return [ReferralRewardStatus.CASHOUT_REQUESTED];
  if (normalized === 'approved') return [referralRewardStatus('CASHOUT_APPROVED')];
  if (normalized === 'tax-review') return [referralRewardStatus('TAX_REVIEW_REQUIRED')];
  if (normalized === 'paid') return [referralRewardStatus('PAID')];
  if (normalized === 'all') return referralCashoutLifecycleStatuses();
  return [
    ReferralRewardStatus.CASHOUT_REQUESTED,
    referralRewardStatus('CASHOUT_APPROVED'),
    referralRewardStatus('TAX_REVIEW_REQUIRED'),
  ];
}

function adminReferralCashoutAudience(value: string | null | undefined): ReferralAudience | null {
  const normalized = normalizeNullable(value)?.toUpperCase();
  if (normalized === ReferralAudience.CUSTOMER) return ReferralAudience.CUSTOMER;
  if (normalized === ReferralAudience.PARTNER) return ReferralAudience.PARTNER;
  return null;
}

function adminReferralCashoutSearchFilters(q: string): Prisma.ReferralRewardWhereInput[] {
  const textFilter = adminInsensitiveContains(q);
  return [
    { id: textFilter },
    { qualifyingBookingId: textFilter },
    { attribution: { id: textFilter } },
    { attribution: { installSource: textFilter } },
    { attribution: { platform: textFilter } },
    { attribution: { referralCode: { code: textFilter } } },
    { attribution: { referrerCustomerProfile: { is: { user: { fullName: textFilter } } } } },
    { attribution: { referrerCustomerProfile: { is: { user: { phone: textFilter } } } } },
    { attribution: { referrerCustomerProfile: { is: { user: { email: textFilter } } } } },
    { attribution: { referrerProviderProfile: { is: { displayName: textFilter } } } },
    { attribution: { referrerProviderProfile: { is: { user: { fullName: textFilter } } } } },
    { attribution: { referrerProviderProfile: { is: { user: { phone: textFilter } } } } },
    { attribution: { referrerProviderProfile: { is: { user: { email: textFilter } } } } },
    { attribution: { referredCustomerProfile: { is: { user: { fullName: textFilter } } } } },
    { attribution: { referredCustomerProfile: { is: { user: { phone: textFilter } } } } },
    { attribution: { referredProviderProfile: { is: { displayName: textFilter } } } },
    { attribution: { referredProviderProfile: { is: { user: { fullName: textFilter } } } } },
    { attribution: { referredProviderProfile: { is: { user: { phone: textFilter } } } } },
  ];
}

function adminCustomerReferralParentWhere(
  options: AdminReferralParentListQuery,
): Prisma.CustomerProfileWhereInput {
  const filters: Prisma.CustomerProfileWhereInput[] = [
    { referralsMade: { some: { audience: ReferralAudience.CUSTOMER } } },
  ];
  const q = normalizeNullable(options.q);
  const attributionStatuses = adminReferralAttributionStatusFilter(options.status);
  const rewardStatuses = adminReferralRewardStatusFilter(options.reward);

  if (q) {
    filters.push({ OR: adminCustomerReferralParentSearchFilters(q) });
  }
  if (attributionStatuses) {
    filters.push({
      referralsMade: {
        some: {
          audience: ReferralAudience.CUSTOMER,
          status: { in: attributionStatuses },
        },
      },
    });
  }
  if (rewardStatuses) {
    filters.push({
      referralsMade: {
        some: {
          audience: ReferralAudience.CUSTOMER,
          rewards: { some: { status: { in: rewardStatuses } } },
        },
      },
    });
  }

  return { AND: filters };
}

function adminPartnerReferralParentWhere(
  options: AdminReferralParentListQuery,
): Prisma.ProviderProfileWhereInput {
  const filters: Prisma.ProviderProfileWhereInput[] = [
    { referralsMade: { some: { audience: ReferralAudience.PARTNER } } },
  ];
  const q = normalizeNullable(options.q);
  const attributionStatuses = adminReferralAttributionStatusFilter(options.status);
  const rewardStatuses = adminReferralRewardStatusFilter(options.reward);

  if (q) {
    filters.push({ OR: adminPartnerReferralParentSearchFilters(q) });
  }
  if (attributionStatuses) {
    filters.push({
      referralsMade: {
        some: {
          audience: ReferralAudience.PARTNER,
          status: { in: attributionStatuses },
        },
      },
    });
  }
  if (rewardStatuses) {
    filters.push({
      referralsMade: {
        some: {
          audience: ReferralAudience.PARTNER,
          rewards: { some: { status: { in: rewardStatuses } } },
        },
      },
    });
  }

  return { AND: filters };
}

function adminCustomerReferralAttributionWhere(
  options: AdminReferralParentListQuery,
  config: { includeReward: boolean },
): Prisma.ReferralAttributionWhereInput {
  const filters: Prisma.ReferralAttributionWhereInput[] = [{ audience: ReferralAudience.CUSTOMER }];
  const q = normalizeNullable(options.q);
  const attributionStatuses = adminReferralAttributionStatusFilter(options.status);
  const rewardStatuses = config.includeReward ? adminReferralRewardStatusFilter(options.reward) : null;

  if (q) {
    filters.push({ OR: adminCustomerReferralAttributionSearchFilters(q) });
  }
  if (attributionStatuses) {
    filters.push({ status: { in: attributionStatuses } });
  }
  if (rewardStatuses) {
    filters.push({ rewards: { some: { status: { in: rewardStatuses } } } });
  }

  return { AND: filters };
}

function adminPartnerReferralAttributionWhere(
  options: AdminReferralParentListQuery,
  config: { includeReward: boolean },
): Prisma.ReferralAttributionWhereInput {
  const filters: Prisma.ReferralAttributionWhereInput[] = [{ audience: ReferralAudience.PARTNER }];
  const q = normalizeNullable(options.q);
  const attributionStatuses = adminReferralAttributionStatusFilter(options.status);
  const rewardStatuses = config.includeReward ? adminReferralRewardStatusFilter(options.reward) : null;

  if (q) {
    filters.push({ OR: adminPartnerReferralAttributionSearchFilters(q) });
  }
  if (attributionStatuses) {
    filters.push({ status: { in: attributionStatuses } });
  }
  if (rewardStatuses) {
    filters.push({ rewards: { some: { status: { in: rewardStatuses } } } });
  }

  return { AND: filters };
}

function adminCustomerReferralParentSearchFilters(q: string): Prisma.CustomerProfileWhereInput[] {
  const textFilter = adminInsensitiveContains(q);
  return [
    { id: textFilter },
    { user: { fullName: textFilter } },
    { user: { phone: textFilter } },
    { user: { email: textFilter } },
    { referralCodes: { some: { audience: ReferralAudience.CUSTOMER, code: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.CUSTOMER, id: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.CUSTOMER, installSource: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.CUSTOMER, platform: textFilter } } },
    {
      referralsMade: {
        some: {
          audience: ReferralAudience.CUSTOMER,
          referredCustomerProfile: {
            is: {
              user: {
                OR: [{ fullName: textFilter }, { phone: textFilter }, { email: textFilter }],
              },
            },
          },
        },
      },
    },
  ];
}

function adminPartnerReferralParentSearchFilters(q: string): Prisma.ProviderProfileWhereInput[] {
  const textFilter = adminInsensitiveContains(q);
  return [
    { id: textFilter },
    { displayName: textFilter },
    { user: { fullName: textFilter } },
    { user: { phone: textFilter } },
    { user: { email: textFilter } },
    { referralCodes: { some: { audience: ReferralAudience.PARTNER, code: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.PARTNER, id: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.PARTNER, installSource: textFilter } } },
    { referralsMade: { some: { audience: ReferralAudience.PARTNER, platform: textFilter } } },
    {
      referralsMade: {
        some: {
          audience: ReferralAudience.PARTNER,
          referredProviderProfile: {
            is: {
              OR: [
                { displayName: textFilter },
                { user: { fullName: textFilter } },
                { user: { phone: textFilter } },
                { user: { email: textFilter } },
              ],
            },
          },
        },
      },
    },
  ];
}

function adminCustomerReferralAttributionSearchFilters(q: string): Prisma.ReferralAttributionWhereInput[] {
  const textFilter = adminInsensitiveContains(q);
  return [
    { id: textFilter },
    { installSource: textFilter },
    { platform: textFilter },
    { referralCode: { code: textFilter } },
    { referrerCustomerProfile: { is: { OR: adminCustomerReferralParentSearchFilters(q) } } },
    {
      referredCustomerProfile: {
        is: {
          user: {
            OR: [{ fullName: textFilter }, { phone: textFilter }, { email: textFilter }],
          },
        },
      },
    },
  ];
}

function adminPartnerReferralAttributionSearchFilters(q: string): Prisma.ReferralAttributionWhereInput[] {
  const textFilter = adminInsensitiveContains(q);
  return [
    { id: textFilter },
    { installSource: textFilter },
    { platform: textFilter },
    { referralCode: { code: textFilter } },
    { referrerProviderProfile: { is: { OR: adminPartnerReferralParentSearchFilters(q) } } },
    {
      referredProviderProfile: {
        is: {
          OR: [
            { displayName: textFilter },
            { user: { fullName: textFilter } },
            { user: { phone: textFilter } },
            { user: { email: textFilter } },
          ],
        },
      },
    },
  ];
}

function adminReferralAttributionStatusFilter(
  value: string | null | undefined,
): ReferralAttributionStatus[] | null {
  const normalized = normalizeNullable(value);
  if (normalized === 'qualified') {
    return [ReferralAttributionStatus.QUALIFIED, ReferralAttributionStatus.REWARDED];
  }
  if (normalized === 'blocked') {
    return [ReferralAttributionStatus.BLOCKED, ReferralAttributionStatus.CANCELLED];
  }
  if (normalized === 'pending') {
    return [ReferralAttributionStatus.REGISTERED];
  }
  return null;
}

function adminReferralRewardStatusFilter(value: string | null | undefined): ReferralRewardStatus[] | null {
  const normalized = normalizeNullable(value);
  if (normalized === 'available') return [ReferralRewardStatus.AVAILABLE];
  if (normalized === 'credited') return creditedReferralRewardStatuses();
  if (normalized === 'pending') return [ReferralRewardStatus.PENDING];
  if (normalized === 'held') return [ReferralRewardStatus.HELD];
  return null;
}

function adminInsensitiveContains(value: string): Prisma.StringFilter {
  return { contains: value, mode: 'insensitive' };
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

function withAdminAppSessionWhere(
  baseWhere: Prisma.AppSessionWhereInput | undefined,
  ...nextWhere: Prisma.AppSessionWhereInput[]
): Prisma.AppSessionWhereInput {
  const filters = [baseWhere, ...nextWhere].filter(
    (filter): filter is Prisma.AppSessionWhereInput => filter !== undefined && Object.keys(filter).length > 0,
  );

  if (filters.length === 0) {
    return {};
  }
  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
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

function adminAppSessionStateWhere(
  value: string | null | undefined,
): Prisma.AppSessionWhereInput | undefined {
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
        AND: [{ lastSeenAt: { gte: recentBoundary, lt: liveBoundary } }, { NOT: activeExpiryWhere }],
      };
    case 'stale':
      return {
        AND: [{ lastSeenAt: { gte: staleBoundary, lt: recentBoundary } }, { NOT: activeExpiryWhere }],
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

function adminChatArchiveListSkip(value: number | string | null | undefined): number {
  return boundedAdminListSkip(value);
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

function adminChatArchiveStatusWhere(
  status: string | null | undefined,
): Prisma.BookingWhereInput | undefined {
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

function adminChatArchiveSenderWhere(
  sender: string | null | undefined,
): Prisma.BookingWhereInput | undefined {
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
    OR: [{ phone: textFilter }, { fullName: textFilter }],
  };
  const providerSearch = {
    OR: [{ id: textFilter }, { displayName: textFilter }, { user: { is: userSearch } }],
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
        { actor: { id: { contains: q, mode: 'insensitive' } } },
        { actor: { email: { contains: q, mode: 'insensitive' } } },
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

function withAdminAuditLogWhere(
  baseWhere: Prisma.AdminAuditLogWhereInput | undefined,
  nextWhere: Prisma.AdminAuditLogWhereInput,
): Prisma.AdminAuditLogWhereInput {
  if (!baseWhere) {
    return nextWhere;
  }

  return { AND: [baseWhere, nextWhere] };
}

function adminAuditLogActionSummary(actionGroups: Array<{ action: string; _count: { _all: number } }>) {
  return actionGroups.reduce(
    (summary, group) => {
      const count = group._count._all;
      if (isAdminAuditDispatchAction(group.action)) {
        summary.dispatch += count;
      }
      if (isAdminAuditPaymentAction(group.action)) {
        summary.payments += count;
      }
      if (isAdminAuditFinanceCloseoutAction(group.action)) {
        summary.financeCloseout += count;
      }
      if (isAdminAuditServicePricingAction(group.action)) {
        summary.servicePricing += count;
      }
      if (isAdminAuditNotificationAction(group.action)) {
        summary.notifications += count;
      }
      if (adminAuditLogActionPriority(group.action) >= 3) {
        summary.needsReview += count;
      }
      return summary;
    },
    {
      dispatch: 0,
      financeCloseout: 0,
      needsReview: 0,
      notifications: 0,
      payments: 0,
      servicePricing: 0,
    },
  );
}

function adminAuditLogActionPriority(action: string) {
  if (action.startsWith('operational_policy.')) {
    return 4;
  }
  if (action.startsWith('service_payout_rule.')) {
    return 4;
  }
  if (action === 'booking.completed.closeout') {
    return 4;
  }
  if (action.startsWith('payout_batch.')) {
    return 3;
  }
  if (action.startsWith('service.')) {
    return 3;
  }
  if (action.endsWith('.refund') || action.includes('reject') || action.endsWith('.retry')) {
    return 4;
  }
  if (action.startsWith('payment.') || action.startsWith('refund.')) {
    return 3;
  }
  if (action === 'admin_web.access_denied' || action === 'admin_web.action_denied') {
    return 3;
  }
  if (action.startsWith('booking.') || action.startsWith('notification.')) {
    return 2;
  }
  return 1;
}

function isAdminAuditDispatchAction(action: string) {
  return (
    action.startsWith('booking.') ||
    action.startsWith('provider.') ||
    action.startsWith('provider_') ||
    action.startsWith('provider-')
  );
}

function isAdminAuditPaymentAction(action: string) {
  return action.startsWith('payment.') || action.startsWith('refund.');
}

function isAdminAuditPayoutAction(action: string) {
  return action.startsWith('payout.') || action.startsWith('payout_batch.');
}

function isAdminAuditFinanceCloseoutAction(action: string) {
  return (
    isAdminAuditPaymentAction(action) ||
    isAdminAuditPayoutAction(action) ||
    action === 'booking.completed.closeout' ||
    action === 'booking.expire.manual' ||
    action === 'booking.no_show.mark' ||
    action.startsWith('earning.') ||
    action.startsWith('provider_wallet.') ||
    action.startsWith('wallet_ledger.')
  );
}

function isAdminAuditNotificationAction(action: string) {
  return action.startsWith('notification.') || action.startsWith('push_device.');
}

function isAdminAuditServicePricingAction(action: string) {
  return action.startsWith('service.') || action.startsWith('service_payout_rule.');
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
    case 'Admin Web':
      return { action: { startsWith: 'admin_web.' } };
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
            { action: { startsWith: 'admin_web.' } },
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

function adminCalendarEventListTake(value: number | string | null | undefined): number {
  return boundedAdminListLimit(value, ADMIN_CALENDAR_EVENT_LIST_LIMIT);
}

function adminCalendarActor(
  actorId: string,
  input: { operatorIdentity?: string | null; operatorName?: string | null },
) {
  const id = normalizeNullable(input.operatorIdentity) ?? actorId;
  const name = normalizeNullable(input.operatorName) ?? displayAdminCalendarActorName(id);

  return { id, name };
}

function adminCalendarCreateData(
  input: CreateAdminCalendarEventDto,
  actor: { id: string; name: string },
): Prisma.AdminCalendarEventCreateInput {
  const title = normalizeRequiredAdminCalendarTitle(input.title);
  const startAt = parseRequiredAdminCalendarDate(input.start, 'Calendar start date');
  const endAt = parseRequiredAdminCalendarDate(input.end, 'Calendar end date');
  assertAdminCalendarDateRange(startAt, endAt);

  return {
    allDay: Boolean(input.allDay),
    authorId: actor.id,
    authorName: actor.name,
    description: normalizeNullable(input.description),
    endAt,
    location: normalizeNullable(input.location),
    startAt,
    tags: normalizeAdminCalendarTags(input.tags) as Prisma.InputJsonValue,
    title,
    updatedById: actor.id,
    url: normalizeNullable(input.url),
  };
}

function adminCalendarUpdateData(
  input: UpdateAdminCalendarEventDto,
  existing: { startAt: Date; endAt: Date },
  actor: { id: string },
): Prisma.AdminCalendarEventUpdateInput {
  const data: Prisma.AdminCalendarEventUpdateInput = {
    updatedById: actor.id,
  };
  const startAt = input.start === undefined ? existing.startAt : parseRequiredAdminCalendarDate(input.start, 'Calendar start date');
  const endAt = input.end === undefined ? existing.endAt : parseRequiredAdminCalendarDate(input.end, 'Calendar end date');
  assertAdminCalendarDateRange(startAt, endAt);

  if (input.title !== undefined) {
    data.title = normalizeRequiredAdminCalendarTitle(input.title);
  }
  if (input.start !== undefined) {
    data.startAt = startAt;
  }
  if (input.end !== undefined) {
    data.endAt = endAt;
  }
  if (input.allDay !== undefined) {
    data.allDay = Boolean(input.allDay);
  }
  if (input.description !== undefined) {
    data.description = normalizeNullable(input.description);
  }
  if (input.location !== undefined) {
    data.location = normalizeNullable(input.location);
  }
  if (input.tags !== undefined) {
    data.tags = normalizeAdminCalendarTags(input.tags) as Prisma.InputJsonValue;
  }
  if (input.url !== undefined) {
    data.url = normalizeNullable(input.url);
  }

  return data;
}

function adminCalendarEventView(event: {
  allDay: boolean;
  authorId: string;
  authorName: string;
  createdAt: Date;
  description: string | null;
  endAt: Date;
  id: string;
  location: string | null;
  startAt: Date;
  tags: Prisma.JsonValue | null;
  title: string;
  updatedAt: Date;
  updatedById: string | null;
  url: string | null;
}) {
  return {
    allDay: event.allDay,
    authorId: event.authorId,
    authorName: event.authorName,
    createdAt: event.createdAt.toISOString(),
    description: event.description ?? '',
    end: event.endAt.toISOString(),
    id: event.id,
    location: event.location ?? '',
    start: event.startAt.toISOString(),
    tags: normalizeAdminCalendarTags(event.tags),
    title: event.title,
    updatedAt: event.updatedAt.toISOString(),
    updatedById: event.updatedById,
    url: event.url ?? '',
  };
}

function normalizeRequiredAdminCalendarTitle(value: unknown) {
  const title = typeof value === 'string' ? normalizeNullable(value) : null;
  if (!title) {
    throw new BadRequestException('Calendar event title is required');
  }

  return title.slice(0, 160);
}

function parseOptionalAdminCalendarDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return parseRequiredAdminCalendarDate(value, label);
}

function parseRequiredAdminCalendarDate(value: unknown, label: string) {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadRequestException(`${label} is required`);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException(`${label} is invalid`);
  }

  return date;
}

function assertAdminCalendarDateRange(startAt: Date, endAt: Date) {
  if (endAt < startAt) {
    throw new BadRequestException('Calendar event end date cannot be before the start date');
  }
}

function normalizeAdminCalendarTags(value: unknown): string[] {
  const tags = Array.isArray(value) ? value : [];

  return [
    ...new Set(
      tags
        .map((tag) => normalizeAdminCalendarTag(String(tag ?? '')))
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
}

function normalizeAdminCalendarTag(value: string) {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .toLowerCase()
    .slice(0, 50);
}

function displayAdminCalendarActorName(identity: string) {
  const [name] = identity.split('@');

  return (
    name
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || identity
  );
}

function adminMarketingDimensionTake(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return ADMIN_MARKETING_DIMENSION_PAGE_LIMIT;
  }

  return boundedAdminListLimit(value, ADMIN_MARKETING_DIMENSION_PAGE_MAX_LIMIT);
}

function adminVietnamRealtimePointLimit(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return ADMIN_VIETNAM_REALTIME_POINT_LIST_LIMIT;
  }

  return boundedAdminListLimit(value, ADMIN_VIETNAM_REALTIME_POINT_MAX_LIMIT);
}

function normalizeAdminMarketingDimensionKey(value: unknown): AdminMarketingDimensionKey {
  if (typeof value !== 'string') {
    throw new BadRequestException('Marketing dimension is required');
  }

  const normalized = value.trim().toLowerCase();
  if (ADMIN_MARKETING_DIMENSIONS.includes(normalized as AdminMarketingDimensionKey)) {
    return normalized as AdminMarketingDimensionKey;
  }

  throw new BadRequestException('Unsupported marketing dimension');
}

function boundedAdminListSkip(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(numeric), 0), 10_000);
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

function adminFileReviewPrivateFileWhere(): Prisma.FileAssetWhereInput {
  return {
    providerVerificationId: { not: null },
  };
}

function adminFileReviewPublicMediaWhere(): Prisma.FileAssetWhereInput {
  return {
    purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
    visibility: FileVisibility.PUBLIC,
    uploadStatus: FileUploadStatus.UPLOADED,
  };
}

function adminFileReviewFileWhere(): Prisma.FileAssetWhereInput {
  return {
    OR: [adminFileReviewPrivateFileWhere(), adminFileReviewPublicMediaWhere()],
  };
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

const MANUAL_WALLET_ADJUSTMENT_TYPES = new Set<ManualWalletAdjustmentType>([
  'PROMOTION_CREDIT',
  'CUSTOMER_COMPENSATION',
  'PARTNER_BONUS',
  'REFERRAL_CORRECTION',
  'ERROR_CORRECTION',
  'PENALTY',
  'CASH_BOOKING_DEDUCTION',
  'RECEIVABLE_WRITE_OFF',
  'MANUAL_REVERSAL',
]);

function manualWalletAdjustmentOwnerType(value: string): ManualWalletAdjustmentOwnerType {
  if (value === 'CUSTOMER' || value === 'PARTNER') {
    return value;
  }
  throw new BadRequestException('Manual wallet adjustment owner type is invalid');
}

function manualWalletAdjustmentDirection(value: string): ManualWalletAdjustmentDirection {
  if (value === 'CREDIT' || value === 'DEBIT') {
    return value;
  }
  throw new BadRequestException('Manual wallet adjustment direction is invalid');
}

function manualWalletAdjustmentType(value: string): ManualWalletAdjustmentType {
  if (MANUAL_WALLET_ADJUSTMENT_TYPES.has(value as ManualWalletAdjustmentType)) {
    return value as ManualWalletAdjustmentType;
  }
  throw new BadRequestException('Manual wallet adjustment type is invalid');
}

function normalizeManualWalletOwnerId(value: string) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    throw new BadRequestException('Wallet owner id is required');
  }
  return normalized;
}

function normalizeManualWalletCurrency(value?: string | null) {
  const normalized = normalizeNullable(value) ?? 'VND';
  if (normalized !== 'VND') {
    throw new BadRequestException('Manual wallet adjustments currently support VND only');
  }
  return normalized;
}

function normalizeManualWalletMonthlyPeriod(value?: string | null) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!match) {
    throw new BadRequestException('Monthly period must use YYYY-MM with month 01-12');
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new BadRequestException('Monthly period must use YYYY-MM with month 01-12');
  }
  return normalized;
}

function normalizeManualWalletApprovalId(value: string | undefined, requireApproval: boolean) {
  const normalized = normalizeNullable(value);
  if (requireApproval && !normalized) {
    throw new BadRequestException('Approval id is required for manual wallet adjustment');
  }
  return normalized ?? 'PREVIEW_ONLY';
}

function normalizeManualWalletApprovalAdminId(
  value: string | undefined,
  actorId: string,
  requireApproval: boolean,
) {
  const normalized = normalizeNullable(value);
  if (requireApproval && !normalized) {
    throw new BadRequestException('Approving admin id is required for manual wallet adjustment');
  }
  if (normalized && normalized === actorId) {
    throw new BadRequestException('Manual wallet adjustment requires approval from a different admin');
  }
  return normalized;
}

function normalizeFinanceActionApprovalAdminId(
  value: string | null | undefined,
  actorId: string,
  actionLabel: string,
) {
  const normalized = normalizeNullable(value);
  if (!normalized || normalized === actorId) {
    throw new BadRequestException(`${actionLabel} requires approval from a different admin`);
  }
  return normalized;
}

async function assertFinanceActionApprovalAdmin(
  db: FinanceApprovalLookupDb,
  approvalAdminId: string,
  actionLabel: string,
) {
  const userDelegate = db.user;
  if (!userDelegate?.findFirst) {
    return;
  }

  const approver = await userDelegate.findFirst({
    where: { id: approvalAdminId, roles: { has: Role.FINANCE_APPROVER } },
    select: { id: true },
  });
  if (!approver) {
    throw new BadRequestException(`${actionLabel} requires approval from a finance approver`);
  }
}

function normalizeManualWalletAttachmentUrl(value?: string | null) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new BadRequestException('Attachment URL must use http or https');
  }
}

async function assertManualWalletOwnerExists(ownerLookup: Promise<unknown>) {
  try {
    await ownerLookup;
  } catch {
    throw new BadRequestException('Manual wallet adjustment owner was not found');
  }
}

function providerManualWalletAdjustmentLedgerType(preview: AdminManualWalletAdjustmentPreview) {
  if (preview.adjustmentType === 'MANUAL_REVERSAL') {
    return ProviderWalletLedgerType.MANUAL_ADJUSTMENT_REVERSAL;
  }
  return preview.direction === 'CREDIT'
    ? ProviderWalletLedgerType.MANUAL_ADJUSTMENT_CREDIT
    : ProviderWalletLedgerType.MANUAL_ADJUSTMENT_DEBIT;
}

function manualWalletAdjustmentSourceKey(preview: AdminManualWalletAdjustmentPreview) {
  return `manual-wallet-adjustment:${preview.ownerType}:${preview.ownerId}:${preview.approvalId}`;
}

async function upsertManualWalletAdjustmentJournal(
  tx: Prisma.TransactionClient,
  preview: AdminManualWalletAdjustmentPreview,
  ledgerId: string,
  actorId: string,
) {
  const sourceKey = `accounting-journal:${manualWalletAdjustmentSourceKey(preview)}`;
  const sourceType = 'MANUAL_WALLET_ADJUSTMENT' as const;
  const metadata = toJson({
    manualWalletAdjustment: true,
    ownerType: preview.ownerType,
    ownerId: preview.ownerId,
    adjustmentType: preview.adjustmentType,
    direction: preview.direction,
    approvalId: preview.approvalId,
    approvalAdminId: preview.approvalAdminId,
    ledgerId,
    reason: preview.reason,
  });
  const journalEntries = preview.accountingEntries.flatMap((entry) => [
    {
      accountCode: manualWalletJournalAccountCode(entry.accountDebit),
      accountName: manualWalletJournalAccountName(entry.accountDebit),
      amount: entry.amount,
      currency: preview.currency,
      memo: preview.reason,
      metadata,
      side: 'DEBIT' as const,
      sourceId: ledgerId,
      sourceType,
    },
    {
      accountCode: manualWalletJournalAccountCode(entry.accountCredit),
      accountName: manualWalletJournalAccountName(entry.accountCredit),
      amount: entry.amount,
      currency: preview.currency,
      memo: preview.reason,
      metadata,
      side: 'CREDIT' as const,
      sourceId: ledgerId,
      sourceType,
    },
  ]);
  const totalDebit = preview.accountingEntries.reduce((total, entry) => total + entry.amount, 0);
  const totalCredit = totalDebit;
  const batchData = {
    currency: preview.currency,
    customerProfileId: preview.ownerType === 'CUSTOMER' ? preview.ownerId : null,
    createdById: actorId,
    entries: {
      create: journalEntries,
    },
    metadata,
    monthlyPeriod: preview.monthlyPeriod,
    providerProfileId: preview.ownerType === 'PARTNER' ? preview.ownerId : null,
    sourceId: ledgerId,
    sourceType,
    status: 'POSTED' as const,
    totalCredit,
    totalDebit,
  };

  await tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {
      ...batchData,
      entries: {
        deleteMany: {},
        create: journalEntries,
      },
    },
    create: {
      ...batchData,
      sourceKey,
    },
  });
}

function manualWalletJournalAccountCode(value: string) {
  return value.trim().toLowerCase();
}

function manualWalletJournalAccountName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function manualWalletAdjustmentMetadata(
  preview: AdminManualWalletAdjustmentPreview,
  attachmentUrl?: string | null,
) {
  return toJson({
    manualWalletAdjustment: true,
    ownerType: preview.ownerType,
    ownerId: preview.ownerId,
    direction: preview.direction,
    adjustmentType: preview.adjustmentType,
    amount: preview.amount,
    currency: preview.currency,
    approvalId: preview.approvalId,
    approvalAdminId: preview.approvalAdminId,
    reason: preview.reason,
    monthlyPeriod: preview.monthlyPeriod,
    attachmentUrl: normalizeNullable(attachmentUrl),
    beforeBalance: preview.beforeBalance,
    afterBalance: preview.afterBalance,
    walletDelta: preview.walletDelta,
    requiresApproval: preview.requiresApproval,
    requiresAttachment: preview.requiresAttachment,
    affects: preview.affects,
    accountingEntries: preview.accountingEntries,
    bankCashAmount: preview.bankCashAmount,
    companyOutputVat: preview.companyOutputVat,
    expenseAmount: preview.expenseAmount,
    expenseContraAmount: preview.expenseContraAmount,
    partnerReceivableDecrease: preview.partnerReceivableDecrease,
    partnerReceivableIncrease: preview.partnerReceivableIncrease,
    platformRevenueAmount: preview.platformRevenueAmount,
    revenueAccount: preview.revenueAccount,
    revenueAmount: preview.revenueAmount,
    walletLiabilityDecrease: preview.walletLiabilityDecrease,
    walletLiabilityIncrease: preview.walletLiabilityIncrease,
  });
}

type ManualWalletAdjustmentLedgerIdRow = {
  createdAt: Date;
  id: string;
  ownerType: ManualWalletAdjustmentOwnerType;
};

const MANUAL_WALLET_ADJUSTMENT_PROVIDER_LEDGER_TYPES: ProviderWalletLedgerType[] = [
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_CREDIT,
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_DEBIT,
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_REVERSAL,
];

const MANUAL_WALLET_ADJUSTMENT_PROVIDER_SQL_TYPES =
  MANUAL_WALLET_ADJUSTMENT_PROVIDER_LEDGER_TYPES.map(
    (type) => Prisma.sql`${type}::"ProviderWalletLedgerType"`,
  );

const manualWalletAdjustmentCustomerListSelect = {
  id: true,
  customerProfileId: true,
  type: true,
  sourceKey: true,
  amount: true,
  currency: true,
  reference: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  customerProfile: {
    select: {
      user: {
        select: {
          fullName: true,
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.CustomerWalletLedgerEntrySelect;

const manualWalletAdjustmentProviderListSelect = {
  id: true,
  providerProfileId: true,
  type: true,
  sourceKey: true,
  amount: true,
  currency: true,
  reference: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  providerProfile: {
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
} satisfies Prisma.ProviderWalletLedgerEntrySelect;

function normalizeManualWalletAdjustmentOwnerTypeFilter(value?: string | null) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }
  return manualWalletAdjustmentOwnerType(normalized);
}

function manualWalletAdjustmentCustomerWhere(
  ownerId: string | null,
): Prisma.CustomerWalletLedgerEntryWhereInput {
  return {
    type: CustomerWalletLedgerType.ADMIN_ADJUSTMENT,
    sourceKey: { startsWith: 'manual-wallet-adjustment:' },
    ...(ownerId ? { customerProfileId: ownerId } : {}),
  };
}

function manualWalletAdjustmentProviderWhere(
  ownerId: string | null,
): Prisma.ProviderWalletLedgerEntryWhereInput {
  return {
    type: { in: MANUAL_WALLET_ADJUSTMENT_PROVIDER_LEDGER_TYPES },
    sourceKey: { startsWith: 'manual-wallet-adjustment:' },
    ...(ownerId ? { providerProfileId: ownerId } : {}),
  };
}

function manualWalletAdjustmentCustomerRow(row: {
  amount: number;
  createdAt: Date;
  currency: string;
  customerProfile: {
    user: {
      fullName: string | null;
      phone: string;
    };
  };
  customerProfileId: string;
  id: string;
  metadata: Prisma.JsonValue | null;
  notes: string | null;
  reference: string | null;
  sourceKey: string;
  type: CustomerWalletLedgerType;
  updatedAt: Date;
}) {
  const metadata = recordFromJsonValue(row.metadata);
  return manualWalletAdjustmentLedgerRow({
    amount: row.amount,
    createdAt: row.createdAt,
    currency: row.currency,
    ledgerType: row.type,
    metadata,
    notes: row.notes,
    ownerId: row.customerProfileId,
    ownerLabel: row.customerProfile.user.fullName ?? row.customerProfile.user.phone,
    ownerPhone: row.customerProfile.user.phone,
    ownerType: 'CUSTOMER',
    reference: row.reference,
    sourceKey: row.sourceKey,
    updatedAt: row.updatedAt,
    id: row.id,
  });
}

function manualWalletAdjustmentProviderRow(row: {
  amount: number;
  createdAt: Date;
  currency: string;
  id: string;
  metadata: Prisma.JsonValue | null;
  notes: string | null;
  providerProfile: {
    displayName: string | null;
    user: {
      fullName: string | null;
      phone: string;
    };
  };
  providerProfileId: string;
  reference: string | null;
  sourceKey: string;
  type: ProviderWalletLedgerType;
  updatedAt: Date;
}) {
  const metadata = recordFromJsonValue(row.metadata);
  return manualWalletAdjustmentLedgerRow({
    amount: row.amount,
    createdAt: row.createdAt,
    currency: row.currency,
    ledgerType: row.type,
    metadata,
    notes: row.notes,
    ownerId: row.providerProfileId,
    ownerLabel:
      row.providerProfile.displayName ?? row.providerProfile.user.fullName ?? row.providerProfile.user.phone,
    ownerPhone: row.providerProfile.user.phone,
    ownerType: 'PARTNER',
    reference: row.reference,
    sourceKey: row.sourceKey,
    updatedAt: row.updatedAt,
    id: row.id,
  });
}

function manualWalletAdjustmentLedgerRow(input: {
  amount: number;
  createdAt: Date;
  currency: string;
  id: string;
  ledgerType: string;
  metadata: Record<string, unknown>;
  notes: string | null;
  ownerId: string;
  ownerLabel: string;
  ownerPhone: string;
  ownerType: ManualWalletAdjustmentOwnerType;
  reference: string | null;
  sourceKey: string;
  updatedAt: Date;
}) {
  return {
    id: input.id,
    adjustmentType: stringFromRecord(input.metadata, 'adjustmentType') ?? input.ledgerType,
    affects: objectFromRecord(input.metadata, 'affects'),
    afterBalance: numberFromRecord(input.metadata, 'afterBalance'),
    amount: input.amount,
    approvalAdminId: stringFromRecord(input.metadata, 'approvalAdminId'),
    approvalId: stringFromRecord(input.metadata, 'approvalId') ?? input.reference,
    attachmentUrl: stringFromRecord(input.metadata, 'attachmentUrl'),
    beforeBalance: numberFromRecord(input.metadata, 'beforeBalance'),
    createdAt: input.createdAt,
    currency: input.currency,
    direction: stringFromRecord(input.metadata, 'direction') ?? (input.amount >= 0 ? 'CREDIT' : 'DEBIT'),
    ledgerType: input.ledgerType,
    monthlyPeriod: stringFromRecord(input.metadata, 'monthlyPeriod'),
    ownerId: input.ownerId,
    ownerLabel: input.ownerLabel,
    ownerPhone: input.ownerPhone,
    ownerType: input.ownerType,
    reason: stringFromRecord(input.metadata, 'reason') ?? input.notes,
    sourceKey: input.sourceKey,
    updatedAt: input.updatedAt,
    walletDelta: numberFromRecord(input.metadata, 'walletDelta') ?? input.amount,
  };
}

function objectFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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

type AdminPartnerOverviewRange = 'today' | '7d' | '30d' | '90d';
type PartnerOverviewSelectionIssue = 'availability' | 'price' | 'profile' | 'response' | 'service';
type PartnerOverviewSelectionSort = 'availability' | 'favorites' | 'price' | 'response' | 'views';

const PARTNER_OVERVIEW_SELECTION_ISSUE_OPTIONS: Array<{
  key: PartnerOverviewSelectionIssue | 'all';
  label: string;
  issue: PartnerOverviewSelectionIssue | null;
}> = [
  { key: 'all', label: 'All', issue: null },
  { key: 'availability', label: 'Availability', issue: 'availability' },
  { key: 'profile', label: 'Profile', issue: 'profile' },
  { key: 'price', label: 'Price', issue: 'price' },
  { key: 'response', label: 'Response', issue: 'response' },
  { key: 'service', label: 'Service', issue: 'service' },
];

type AdminPartnerOverviewWindow = {
  range: AdminPartnerOverviewRange;
  label: string;
  startAt: Date;
  endAt: Date;
};

type PartnerOverviewProviderRow = {
  id: string;
  displayName: string;
  city: string | null;
  residentialAddress: string | null;
  serviceArea: Prisma.JsonValue | null;
  status: ProviderStatus;
  ratingAvg: unknown;
  reviewCount: number;
  currentLat: unknown;
  currentLng: unknown;
  currentLocationUpdatedAt: Date | null;
  nextAvailableAt: Date | null;
  blockedAt: Date | null;
  blockedReason: string | null;
  updatedAt: Date;
  user: {
    createdAt: Date;
    fileAssets: Array<{
      purpose: FilePurpose;
      url: string | null;
    }>;
    fullName: string | null;
    phone: string;
  };
  verification: {
    reviewedAt: Date | null;
    status: VerificationStatus;
    submittedAt: Date | null;
  } | null;
  kyc: {
    reviewedAt: Date | null;
    status: ProviderKycStatus;
    submittedAt: Date | null;
  } | null;
  taxProfile: {
    status: ProviderTaxProfileStatus;
  } | null;
  services: Array<{
    price: number;
    serviceId: string;
    service: {
      active: boolean;
      basePrice: number;
      durationMin: number;
      id: string;
      name: string;
    };
  }>;
  sessions: Array<{
    appVersion: string | null;
    lastSeenAt: Date;
  }>;
  selectedBookings: Array<{
    closedAt: Date | null;
    id: string;
    status: BookingStatus;
    updatedAt: Date;
  }>;
};

type PartnerOverviewBookingPointRow = {
  address: unknown;
  addressSnapshot: {
    address: unknown;
    addressText: string | null;
    latitude: unknown;
    longitude: unknown;
  } | null;
  lat: unknown;
  lng: unknown;
};

type PartnerOverviewResponseParticipantRow = {
  providerProfileId: string;
  joinedAt: Date;
  respondedAt: Date | null;
  booking: PartnerOverviewBookingPointRow;
};

type PartnerOverviewServiceRow = {
  durationMin: number;
  id: string;
  name: string;
};

type PartnerOverviewServiceCountRow = {
  serviceId: string;
  _count: {
    _all: number;
  };
};

type PartnerOverviewProfileViewRow = {
  providerProfileId: string;
  _count: {
    _all: number;
  };
  _sum: {
    viewCount: unknown;
  };
  _max: {
    lastViewedAt: Date | null;
  };
};

type PartnerOverviewFavoriteRow = {
  providerProfileId: string;
  _count: {
    _all: number;
  };
  _max: {
    createdAt: Date | null;
  };
};

type PartnerOverviewSelectionSortableRow = {
  readonly averageResponseSeconds: number | null;
  readonly completedBookings: number;
  readonly favoriteCount: number;
  readonly lastIntentAt: string | null;
  readonly maxServicePrice: number | null;
  readonly profileViews: number;
  readonly readinessFlags: readonly string[];
};

type PartnerOverviewProviderFact = {
  partnerId: string;
  partnerName: string;
  phone: string | null;
  area: string;
  status: ProviderStatus;
  verificationStatus: VerificationStatus | null;
  kycStatus: ProviderKycStatus | null;
  taxStatus: ProviderTaxProfileStatus | null;
  approved: boolean;
  activeServiceCount: number;
  availabilityStatus: string;
  lastOnlineAt: string | null;
  lastActivityAt: string | null;
  lastBookingAt: string | null;
  nextAvailableAt: string | null;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  galleryImageCount: number;
  hasProfileImage: boolean;
  maxServicePrice: number | null;
  maxServicePriceRatio: number | null;
  minServicePrice: number | null;
  noShowReports: number;
  lowReviewCount: number;
  rating: number;
  reviewCount: number;
  walletBalance: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mainReason: string;
  recommendedAction: string;
  href: string;
  inactive7d: boolean;
  inactive30d: boolean;
  blocked: boolean;
  eligibleToAccept: boolean;
};

type PartnerOverviewOperatingStatusCard = {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

const ADMIN_PARTNER_OVERVIEW_RANGE_LABELS: Record<AdminPartnerOverviewRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

function normalizeAdminPartnerOverviewRange(value: unknown): AdminPartnerOverviewRange {
  return value === '7d' || value === '30d' || value === '90d' ? value : 'today';
}

function adminPartnerOverviewRangeWindow(rangeInput: AdminPartnerOverviewRange): AdminPartnerOverviewWindow {
  const range = normalizeAdminPartnerOverviewRange(rangeInput);
  const todayStart = partnerOverviewUtcDayStart(new Date());
  const days = range === '90d' ? 90 : range === '30d' ? 30 : range === '7d' ? 7 : 1;

  return {
    range,
    label: ADMIN_PARTNER_OVERVIEW_RANGE_LABELS[range],
    startAt: partnerOverviewAddUtcDays(todayStart, -(days - 1)),
    endAt: partnerOverviewAddUtcDays(todayStart, 1),
  };
}

function adminPartnerOverviewDateWhere(window: AdminPartnerOverviewWindow) {
  return {
    gte: window.startAt,
    lt: window.endAt,
  };
}

function partnerOverviewUtcDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function partnerOverviewAddUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeVerificationStatusFilter(value: unknown) {
  const normalized = normalizeOptionalText(value)?.toUpperCase();
  if (!normalized) return null;
  return Object.values(VerificationStatus).includes(normalized as VerificationStatus)
    ? (normalized as VerificationStatus)
    : null;
}

function normalizePartnerOnlineStatusFilter(value: unknown): ProviderStatus[] | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (!normalized) return null;

  if (normalized === 'online') {
    return [ProviderStatus.ONLINE_AVAILABLE, ProviderStatus.ONLINE_BUSY, ProviderStatus.ONLINE_AVAILABLE_SOON];
  }
  if (normalized === 'available') return [ProviderStatus.ONLINE_AVAILABLE];
  if (normalized === 'busy') return [ProviderStatus.ONLINE_BUSY];
  if (normalized === 'soon') return [ProviderStatus.ONLINE_AVAILABLE_SOON];
  if (normalized === 'offline') return [ProviderStatus.OFFLINE];

  const enumValue = normalized.toUpperCase();
  return Object.values(ProviderStatus).includes(enumValue as ProviderStatus) ? [enumValue as ProviderStatus] : null;
}

function normalizePartnerWalletStatusFilter(value: unknown) {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'negative' || normalized === 'positive' || normalized === 'zero' ? normalized : null;
}

function normalizePartnerRiskStatusFilter(value: unknown): PartnerOverviewProviderFact['riskLevel'] | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical'
    ? normalized
    : null;
}

function normalizePartnerSelectionIssueFilter(value: unknown): PartnerOverviewSelectionIssue | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'availability' ||
    normalized === 'price' ||
    normalized === 'profile' ||
    normalized === 'response' ||
    normalized === 'service'
    ? normalized
    : null;
}

function normalizePartnerSelectionSort(value: unknown): PartnerOverviewSelectionSort {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'availability' ||
    normalized === 'favorites' ||
    normalized === 'price' ||
    normalized === 'response' ||
    normalized === 'views'
    ? normalized
    : 'views';
}

function partnerOverviewProviderWhere(options: {
  readonly city?: string;
  readonly negativeWalletIds: readonly string[];
  readonly onlineStatuses: readonly ProviderStatus[] | null;
  readonly positiveWalletIds: readonly string[];
  readonly serviceId: string | null;
  readonly verificationStatus: VerificationStatus | null;
  readonly walletStatus: 'negative' | 'positive' | 'zero' | null;
}): Prisma.ProviderProfileWhereInput {
  const filters: Prisma.ProviderProfileWhereInput[] = [{ deletedAt: null }];
  const city = normalizeOptionalText(options.city);

  if (city) {
    const citySearchTerms = partnerOverviewCitySearchTerms(city);
    filters.push({
      OR: citySearchTerms.flatMap((term) => [
        { city: { contains: term, mode: 'insensitive' } },
        { residentialAddress: { contains: term, mode: 'insensitive' } },
      ]),
    });
  }
  if (options.serviceId) {
    filters.push({ services: { some: { active: true, serviceId: options.serviceId } } });
  }
  if (options.verificationStatus) {
    filters.push({ verification: { is: { status: options.verificationStatus } } });
  }
  if (options.onlineStatuses?.length) {
    filters.push({ status: { in: [...options.onlineStatuses] } });
  }
  if (options.walletStatus === 'negative') {
    filters.push({ id: options.negativeWalletIds.length ? { in: [...options.negativeWalletIds] } : '__none__' });
  }
  if (options.walletStatus === 'positive') {
    filters.push({ id: options.positiveWalletIds.length ? { in: [...options.positiveWalletIds] } : '__none__' });
  }
  if (options.walletStatus === 'zero') {
    filters.push({ id: { notIn: [...new Set([...options.negativeWalletIds, ...options.positiveWalletIds])] } });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

export function partnerOverviewCitySearchTerms(city: string) {
  const normalized = city.trim().toLowerCase();
  if (['hcm', 'hcmc', 'ho chi minh', 'ho chi minh city', 'sai gon', 'saigon'].includes(normalized)) {
    return ['hcm', 'hcmc', 'ho chi minh', 'sai gon', 'saigon'];
  }
  if (['hn', 'hanoi', 'ha noi'].includes(normalized)) {
    return ['hn', 'hanoi', 'ha noi'];
  }
  return [city];
}

function partnerOverviewAnd(
  baseWhere: Prisma.ProviderProfileWhereInput,
  extraWhere: Prisma.ProviderProfileWhereInput,
): Prisma.ProviderProfileWhereInput {
  if (Object.keys(baseWhere).length === 0) return extraWhere;
  if (Object.keys(extraWhere).length === 0) return baseWhere;
  return { AND: [baseWhere, extraWhere] };
}

function partnerOverviewJoinedAtSql(dateWhere: ReturnType<typeof adminPartnerOverviewDateWhere> | undefined) {
  if (!dateWhere) return Prisma.empty;

  return Prisma.sql`AND "joinedAt" >= ${dateWhere.gte} AND "joinedAt" < ${dateWhere.lt}`;
}

function partnerOverviewProviderEligible(
  provider: PartnerOverviewProviderRow,
  walletBalance = 0,
  locationFreshBoundary: Date,
) {
  return (
    provider.verification?.status === VerificationStatus.APPROVED &&
    provider.kyc?.status === ProviderKycStatus.APPROVED &&
    provider.status === ProviderStatus.ONLINE_AVAILABLE &&
    !provider.blockedAt &&
    provider.services.length > 0 &&
    walletBalance >= 0 &&
    Boolean(
      provider.currentLocationUpdatedAt &&
        provider.currentLocationUpdatedAt.getTime() >= locationFreshBoundary.getTime(),
    )
  );
}

function partnerOverviewProviderMediaStats(provider: PartnerOverviewProviderRow) {
  const publicMedia = provider.user.fileAssets ?? [];
  return {
    galleryImageCount: publicMedia.filter((file) => file.purpose === FilePurpose.PROVIDER_GALLERY && file.url)
      .length,
    hasProfileImage: publicMedia.some((file) => file.purpose === FilePurpose.PROFILE_IMAGE && file.url),
  };
}

function partnerOverviewProviderPriceStats(provider: PartnerOverviewProviderRow) {
  const prices = provider.services
    .map((providerService) => providerService.price)
    .filter((price) => Number.isFinite(price) && price > 0);
  const basePrices = provider.services
    .map((providerService) => providerService.service.basePrice)
    .filter((price) => Number.isFinite(price) && price > 0);
  const priceRatios = provider.services
    .map((providerService) => {
      const price = providerService.price;
      const basePrice = providerService.service.basePrice;
      return Number.isFinite(price) && Number.isFinite(basePrice) && basePrice > 0 ? price / basePrice : 0;
    })
    .filter((ratio) => ratio > 0);

  return {
    maxBasePrice: basePrices.length ? Math.max(...basePrices) : null,
    maxPriceRatio: priceRatios.length ? Math.max(...priceRatios) : null,
    maxServicePrice: prices.length ? Math.max(...prices) : null,
    minServicePrice: prices.length ? Math.min(...prices) : null,
  };
}

function partnerOverviewAvailabilityStatus(provider: PartnerOverviewProviderRow) {
  switch (provider.status) {
    case ProviderStatus.ONLINE_AVAILABLE:
      return 'Available now';
    case ProviderStatus.ONLINE_BUSY:
      return 'Busy now';
    case ProviderStatus.ONLINE_AVAILABLE_SOON:
      return 'Available soon';
    default:
      return provider.nextAvailableAt ? 'Scheduled offline' : 'Offline now';
  }
}

function partnerOverviewBookingRegion(row: PartnerOverviewBookingPointRow): VietnamRegionCode {
  return vietnamRegionCodeFromValues(
    [row.addressSnapshot?.address, row.addressSnapshot?.addressText, row.address],
    {
      latitude: row.addressSnapshot?.latitude ?? row.lat,
      longitude: row.addressSnapshot?.longitude ?? row.lng,
    },
  );
}

function partnerOverviewAreaAverageResponseSeconds(rows: readonly PartnerOverviewResponseParticipantRow[]) {
  const totals = new Map<VietnamRegionCode, { count: number; totalSeconds: number }>();

  for (const row of rows) {
    if (!row.respondedAt) continue;
    const responseSeconds = Math.round((row.respondedAt.getTime() - row.joinedAt.getTime()) / 1000);
    if (!Number.isFinite(responseSeconds) || responseSeconds < 0) continue;

    const region = partnerOverviewBookingRegion(row.booking);
    const total = totals.get(region) ?? { count: 0, totalSeconds: 0 };
    total.count += 1;
    total.totalSeconds += responseSeconds;
    totals.set(region, total);
  }

  return new Map(
    Array.from(totals.entries()).map(([region, total]) => [
      region,
      Math.round(total.totalSeconds / total.count),
    ]),
  );
}

function partnerOverviewAverageResponseSecondsByProvider(rows: readonly PartnerOverviewResponseParticipantRow[]) {
  const totals = new Map<string, { count: number; totalSeconds: number }>();

  for (const row of rows) {
    if (!row.respondedAt) continue;
    const responseSeconds = Math.round((row.respondedAt.getTime() - row.joinedAt.getTime()) / 1000);
    if (!Number.isFinite(responseSeconds) || responseSeconds < 0) continue;

    const total = totals.get(row.providerProfileId) ?? { count: 0, totalSeconds: 0 };
    total.count += 1;
    total.totalSeconds += responseSeconds;
    totals.set(row.providerProfileId, total);
  }

  return new Map(
    Array.from(totals.entries()).map(([providerProfileId, total]) => [
      providerProfileId,
      Math.round(total.totalSeconds / total.count),
    ]),
  );
}

function partnerOverviewProfileViewMap(rows: readonly PartnerOverviewProfileViewRow[]) {
  return new Map(
    rows.map((row) => [
      row.providerProfileId,
      {
        profileViewCustomers: row._count._all,
        profileViews: Math.max(row._count._all, numberValue(row._sum.viewCount)),
        lastViewedAt: row._max.lastViewedAt,
      },
    ]),
  );
}

function partnerOverviewFavoriteMap(rows: readonly PartnerOverviewFavoriteRow[]) {
  return new Map(
    rows.map((row) => [
      row.providerProfileId,
      {
        favoriteCount: row._count._all,
        lastFavoritedAt: row._max.createdAt,
      },
    ]),
  );
}

function partnerOverviewAreaRows(options: {
  readonly averageResponseSecondsByRegion: ReadonlyMap<VietnamRegionCode, number>;
  readonly eligibleProviderIds: ReadonlySet<string>;
  readonly failedBookingRows: readonly PartnerOverviewBookingPointRow[];
  readonly locationFreshBoundary: Date;
  readonly openBookingRows: readonly PartnerOverviewBookingPointRow[];
  readonly providerRows: readonly PartnerOverviewProviderRow[];
}) {
  const rows = new Map(
    VIETNAM_REGION_BUCKETS.map((bucket) => [
      bucket.code,
      {
        areaCode: bucket.code,
        area: bucket.name,
        totalPartners: 0,
        onlinePartners: 0,
        locationFreshPartners: 0,
        eligiblePartners: 0,
        openRequests: 0,
        failedRequests: 0,
        matchingFailureRate: 0,
        averageResponseSeconds: null as number | null,
        status: 'No Supply',
        riskLevel: 'medium',
      },
    ]),
  );

  for (const provider of options.providerRows) {
    const code = vietnamRegionCodeFromValues(
      [provider.city, provider.residentialAddress, provider.serviceArea],
      { latitude: provider.currentLat, longitude: provider.currentLng },
    );
    const row = rows.get(code);
    if (!row) continue;

    row.totalPartners += 1;
    if (provider.status !== ProviderStatus.OFFLINE) row.onlinePartners += 1;
    if (
      provider.currentLocationUpdatedAt &&
      provider.currentLocationUpdatedAt.getTime() >= options.locationFreshBoundary.getTime()
    ) {
      row.locationFreshPartners += 1;
    }
    if (options.eligibleProviderIds.has(provider.id)) row.eligiblePartners += 1;
  }

  for (const booking of options.openBookingRows) {
    const row = rows.get(partnerOverviewBookingRegion(booking));
    if (row) row.openRequests += 1;
  }
  for (const booking of options.failedBookingRows) {
    const row = rows.get(partnerOverviewBookingRegion(booking));
    if (row) row.failedRequests += 1;
  }

  return VIETNAM_REGION_BUCKETS.map((bucket) => {
    const row = rows.get(bucket.code);
    if (!row) throw new Error(`Missing Vietnam region bucket ${bucket.code}`);
    row.matchingFailureRate = percentageValue(row.failedRequests, row.openRequests + row.failedRequests);
    row.averageResponseSeconds = options.averageResponseSecondsByRegion.get(bucket.code) ?? null;
    if (row.eligiblePartners === 0 && row.openRequests > 0) {
      row.status = 'No Eligible Partner';
      row.riskLevel = 'critical';
    } else if (row.onlinePartners > 0 && row.locationFreshPartners === 0) {
      row.status = 'No Fresh Location';
      row.riskLevel = 'high';
    } else if (row.matchingFailureRate >= 20) {
      row.status = 'High Failure';
      row.riskLevel = 'high';
    } else if (row.eligiblePartners < 3) {
      row.status = 'Low Supply';
      row.riskLevel = 'medium';
    } else {
      row.status = 'Healthy';
      row.riskLevel = 'low';
    }
    return row;
  });
}

function partnerOverviewServiceRows(options: {
  readonly completedServiceRows: readonly PartnerOverviewServiceCountRow[];
  readonly eligibleProviderIds: ReadonlySet<string>;
  readonly openServiceRows: readonly PartnerOverviewServiceCountRow[];
  readonly providerRows: readonly PartnerOverviewProviderRow[];
  readonly serviceCatalogRows: readonly PartnerOverviewServiceRow[];
}) {
  const openMap = new Map(options.openServiceRows.map((row) => [row.serviceId, row._count._all]));
  const completedMap = new Map(options.completedServiceRows.map((row) => [row.serviceId, row._count._all]));

  return options.serviceCatalogRows.map((service) => {
    const providers = options.providerRows.filter((provider) =>
      provider.services.some((providerService) => providerService.serviceId === service.id),
    );
    const onlinePartners = providers.filter((provider) => provider.status !== ProviderStatus.OFFLINE).length;
    const eligiblePartners = providers.filter((provider) => options.eligibleProviderIds.has(provider.id)).length;
    const openRequests = openMap.get(service.id) ?? 0;
    const completedBookings = completedMap.get(service.id) ?? 0;
    const completionRate = percentageValue(completedBookings, openRequests + completedBookings);
    const avgRatingSource = providers.filter((provider) => numberValue(provider.ratingAvg) > 0);
    const avgRating =
      avgRatingSource.length > 0
        ? Number(
            (
              avgRatingSource.reduce((sum, provider) => sum + numberValue(provider.ratingAvg), 0) /
              avgRatingSource.length
            ).toFixed(2),
          )
        : null;

    return {
      serviceId: service.id,
      serviceName: `${service.name} · ${service.durationMin} min`,
      partnersOffering: providers.length,
      onlinePartners,
      eligiblePartners,
      openRequests,
      completedBookings,
      completionRate,
      avgRating,
      status:
        eligiblePartners === 0 && openRequests > 0
          ? 'No Eligible Partner'
          : onlinePartners === 0 && providers.length > 0
            ? 'Offline Supply'
            : providers.length === 0
              ? 'No Partner'
              : 'Healthy',
      riskLevel:
        eligiblePartners === 0 && openRequests > 0
          ? 'critical'
          : onlinePartners === 0 || completionRate < 50
            ? 'medium'
            : 'low',
    };
  });
}

function partnerOverviewProviderFact(options: {
  readonly active7dStart: Date;
  readonly active30dStart: Date;
  readonly cancelledMap: Map<string, { count: number; lastActivityAt: Date | null }>;
  readonly completedMap: Map<string, { count: number; lastActivityAt: Date | null }>;
  readonly locationFreshBoundary: Date;
  readonly lowReviewMap: Map<string, { count: number; lastActivityAt: Date | null; rating: number | null }>;
  readonly noShowReportMap: Map<string, { count: number; lastActivityAt: Date | null }>;
  readonly provider: PartnerOverviewProviderRow;
  readonly walletBalance: number;
}): PartnerOverviewProviderFact {
  const provider = options.provider;
  const completed = options.completedMap.get(provider.id);
  const cancelled = options.cancelledMap.get(provider.id);
  const lowReview = options.lowReviewMap.get(provider.id);
  const noShow = options.noShowReportMap.get(provider.id);
  const lastOnlineAt = provider.sessions[0]?.lastSeenAt ?? null;
  const lastBookingAt = latestDate(provider.selectedBookings[0]?.closedAt, provider.selectedBookings[0]?.updatedAt);
  const lastActivityAt = latestDate(lastOnlineAt, lastBookingAt, completed?.lastActivityAt, cancelled?.lastActivityAt, provider.updatedAt);
  const approved = provider.verification?.status === VerificationStatus.APPROVED && provider.kyc?.status === ProviderKycStatus.APPROVED;
  const completedBookings = completed?.count ?? 0;
  const cancelledBookings = cancelled?.count ?? 0;
  const cancellationRate = percentageValue(cancelledBookings, completedBookings + cancelledBookings);
  const mediaStats = partnerOverviewProviderMediaStats(provider);
  const priceStats = partnerOverviewProviderPriceStats(provider);
  const inactive7d = !lastActivityAt || lastActivityAt.getTime() < options.active7dStart.getTime();
  const inactive30d = !lastActivityAt || lastActivityAt.getTime() < options.active30dStart.getTime();
  const eligibleToAccept = partnerOverviewProviderEligible(provider, options.walletBalance, options.locationFreshBoundary);
  const blocked = Boolean(provider.blockedAt);
  const riskLevel =
    blocked || options.walletBalance < 0 || (noShow?.count ?? 0) >= 2
      ? 'critical'
      : cancellationRate >= 30 || (lowReview?.count ?? 0) >= 2 || inactive30d
        ? 'high'
        : !approved || inactive7d || cancelledBookings > 0
          ? 'medium'
          : 'low';
  const mainReason = partnerOverviewProviderRiskReason({
    approved,
    blocked,
    cancellationRate,
    inactive30d,
    inactive7d,
    lowReviewCount: lowReview?.count ?? 0,
    noShowReports: noShow?.count ?? 0,
    walletBalance: options.walletBalance,
  });

  return {
    partnerId: provider.id,
    partnerName: provider.displayName || provider.user.fullName || 'Unknown Partner',
    phone: provider.user.phone || null,
    area: vietnamRegionLabel(
      vietnamRegionCodeFromValues(
        [provider.city, provider.residentialAddress, provider.serviceArea],
        { latitude: provider.currentLat, longitude: provider.currentLng },
      ),
    ),
    status: provider.status,
    verificationStatus: provider.verification?.status ?? null,
    kycStatus: provider.kyc?.status ?? null,
    taxStatus: provider.taxProfile?.status ?? null,
    approved,
    activeServiceCount: provider.services.length,
    availabilityStatus: partnerOverviewAvailabilityStatus(provider),
    lastOnlineAt: lastOnlineAt?.toISOString() ?? null,
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
    lastBookingAt: lastBookingAt?.toISOString() ?? null,
    nextAvailableAt: provider.nextAvailableAt?.toISOString() ?? null,
    completedBookings,
    cancelledBookings,
    cancellationRate,
    galleryImageCount: mediaStats.galleryImageCount,
    hasProfileImage: mediaStats.hasProfileImage,
    maxServicePrice: priceStats.maxServicePrice,
    maxServicePriceRatio: priceStats.maxPriceRatio,
    minServicePrice: priceStats.minServicePrice,
    noShowReports: noShow?.count ?? 0,
    lowReviewCount: lowReview?.count ?? 0,
    rating: Number(numberValue(provider.ratingAvg).toFixed(2)),
    reviewCount: provider.reviewCount,
    walletBalance: options.walletBalance,
    riskLevel,
    mainReason,
    recommendedAction: partnerOverviewProviderAction(mainReason),
    href: `/partners/${provider.id}?section=full`,
    inactive7d,
    inactive30d,
    blocked,
    eligibleToAccept,
  };
}

function partnerOverviewProviderRiskReason(input: {
  readonly approved: boolean;
  readonly blocked: boolean;
  readonly cancellationRate: number;
  readonly inactive30d: boolean;
  readonly inactive7d: boolean;
  readonly lowReviewCount: number;
  readonly noShowReports: number;
  readonly walletBalance: number;
}) {
  if (input.blocked) return 'Account blocked';
  if (input.walletBalance < 0) return 'Negative wallet';
  if (input.noShowReports > 0) return 'No-show report';
  if (input.lowReviewCount > 0) return 'Low review';
  if (input.cancellationRate >= 20) return 'High cancellation';
  if (!input.approved) return 'Verification incomplete';
  if (input.inactive30d) return 'Inactive 30D';
  if (input.inactive7d) return 'Inactive 7D';
  return 'Healthy';
}

function partnerOverviewProviderAction(reason: string) {
  switch (reason) {
    case 'Account blocked':
      return 'Review block reason';
    case 'Negative wallet':
      return 'Review wallet receivable';
    case 'No-show report':
      return 'Open quality investigation';
    case 'Low review':
      return 'Review recent feedback';
    case 'High cancellation':
      return 'Check scheduling and penalties';
    case 'Verification incomplete':
      return 'Finish KYC approval';
    case 'Inactive 30D':
    case 'Inactive 7D':
      return 'Send reactivation push';
    default:
      return 'Monitor';
  }
}

function partnerOverviewRiskWeight(riskLevel: PartnerOverviewProviderFact['riskLevel']) {
  switch (riskLevel) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function partnerOverviewOperatingStatusCards(
  facts: readonly PartnerOverviewProviderFact[],
): PartnerOverviewOperatingStatusCard[] {
  const approvedFacts = facts.filter((fact) => fact.approved);

  return [
    {
      key: 'ready-now',
      label: 'Ready now',
      count: approvedFacts.filter((fact) => fact.status === ProviderStatus.ONLINE_AVAILABLE && fact.eligibleToAccept).length,
      detail: 'Approved, online, fresh location, active services, and wallet eligible',
      href: '/partners?review=marketplace-ready&onlineStatus=available',
      tone: 'success',
    },
    {
      key: 'available-soon',
      label: 'Available soon',
      count: approvedFacts.filter((fact) => fact.status === ProviderStatus.ONLINE_AVAILABLE_SOON).length,
      detail: 'Partner marked available soon instead of ready now',
      href: '/partners?review=marketplace-ready&onlineStatus=soon',
      tone: 'info',
    },
    {
      key: 'busy',
      label: 'Busy / in service',
      count: approvedFacts.filter((fact) => fact.status === ProviderStatus.ONLINE_BUSY).length,
      detail: 'Booked, dispatch-locked, or otherwise cannot accept another request',
      href: '/partners?review=marketplace-ready&onlineStatus=busy',
      tone: 'warning',
    },
    {
      key: 'offline',
      label: 'Offline',
      count: approvedFacts.filter((fact) => fact.status === ProviderStatus.OFFLINE).length,
      detail: 'Manual off, outside schedule, app off, blocked, or not ready',
      href: '/partners?review=marketplace-ready&onlineStatus=offline',
      tone: 'neutral',
    },
    {
      key: 'inactive-7d',
      label: 'Inactive 7D',
      count: approvedFacts.filter((fact) => fact.inactive7d).length,
      detail: 'Auto-offline follow-up queue for approved partners',
      href: '/partners?review=marketplace-ready&activity=inactive-7d',
      tone: 'danger',
    },
  ];
}

function partnerOverviewActionLists(facts: readonly PartnerOverviewProviderFact[]) {
  const ranked = [...facts].sort(
    (left, right) =>
      partnerOverviewRiskWeight(right.riskLevel) - partnerOverviewRiskWeight(left.riskLevel) ||
      (right.lastActivityAt ?? '').localeCompare(left.lastActivityAt ?? ''),
  );
  const list = (
    key: string,
    title: string,
    rows: PartnerOverviewProviderFact[],
    viewAllHref: string,
  ) => ({
    key,
    title,
    totalCount: rows.length,
    viewAllHref,
    rows: rows.slice(0, ADMIN_PARTNER_OVERVIEW_RANK_LIMIT).map(partnerOverviewActionRow),
  });

  return [
    list(
      'pending-verification',
      'Pending Verification',
      ranked.filter((fact) => !fact.approved),
      '/partners?review=unapproved',
    ),
    list(
      'approved-never-online',
      'Approved But Never Online',
      ranked.filter((fact) => fact.approved && !fact.lastOnlineAt),
      '/partners?review=marketplace-ready&activity=never-online',
    ),
    list(
      'approved-no-first-booking',
      'Approved With No Completed Booking',
      ranked.filter((fact) => fact.approved && fact.completedBookings === 0),
      '/partners?review=marketplace-ready&bookingFlow=first-job-pending',
    ),
    list(
      'inactive-7d',
      'Inactive 7D',
      ranked.filter((fact) => fact.approved && fact.inactive7d),
      '/partners?review=marketplace-ready&activity=inactive-7d',
    ),
    list(
      'inactive-30d',
      'Inactive 30D',
      ranked.filter((fact) => fact.approved && fact.inactive30d),
      '/partners?review=marketplace-ready&activity=inactive-30d',
    ),
    list(
      'high-cancellation',
      'High Cancellation',
      ranked.filter((fact) => fact.cancellationRate >= 20),
      '/partners?review=high-cancellation',
    ),
    list(
      'no-show-risk',
      'No-show Risk',
      ranked.filter((fact) => fact.noShowReports > 0),
      '/partners?review=no-show-risk',
    ),
    list(
      'low-rating',
      'Low Rating',
      ranked.filter((fact) => fact.lowReviewCount > 0 || (fact.reviewCount > 0 && fact.rating < 3)),
      '/partners?review=quality-risk',
    ),
    list(
      'negative-wallet',
      'Negative Wallet',
      ranked.filter((fact) => fact.walletBalance < 0),
      '/partners?review=unsettled',
    ),
    list(
      'payout-blocked',
      'Payout Blocked',
      ranked.filter((fact) => fact.walletBalance < 0 || fact.taxStatus !== ProviderTaxProfileStatus.APPROVED),
      '/partners?review=payout-blocked',
    ),
    list(
      'tax-info-missing',
      'Tax Info Missing',
      ranked.filter((fact) => fact.taxStatus !== ProviderTaxProfileStatus.APPROVED),
      '/partners?review=tax-info-missing',
    ),
  ];
}

function partnerOverviewActionRow(fact: PartnerOverviewProviderFact) {
  return {
    partnerId: fact.partnerId,
    partnerName: fact.partnerName,
    phone: fact.phone,
    area: fact.area,
    status: fact.status,
    lastActivityAt: fact.lastActivityAt,
    mainReason: fact.mainReason,
    recommendedAction: fact.recommendedAction,
    href: fact.href,
    riskLevel: fact.riskLevel,
  };
}

function partnerOverviewSelectionFrictionRows(options: {
  readonly averageResponseSecondsByProvider: ReadonlyMap<string, number>;
  readonly favoriteMap: ReadonlyMap<string, { favoriteCount: number; lastFavoritedAt: Date | null }>;
  readonly profileViewMap: ReadonlyMap<
    string,
    { profileViewCustomers: number; profileViews: number; lastViewedAt: Date | null }
  >;
  readonly providerFacts: readonly PartnerOverviewProviderFact[];
  readonly selectionIssue: PartnerOverviewSelectionIssue | null;
  readonly selectionSort: PartnerOverviewSelectionSort;
}) {
  const rows = options.providerFacts
    .map((fact) => {
      const viewStats = options.profileViewMap.get(fact.partnerId);
      const favoriteStats = options.favoriteMap.get(fact.partnerId);
      const profileViews = viewStats?.profileViews ?? 0;
      const favoriteCount = favoriteStats?.favoriteCount ?? 0;
      if (profileViews <= 0 && favoriteCount <= 0) return null;

      const selectionRate = percentageValue(fact.completedBookings, profileViews);
      const lastIntentAt = latestDate(viewStats?.lastViewedAt, favoriteStats?.lastFavoritedAt);
      const averageResponseSeconds = options.averageResponseSecondsByProvider.get(fact.partnerId) ?? null;
      const readinessFlags = partnerOverviewSelectionReadinessFlags(fact, averageResponseSeconds);
      const mainReason = partnerOverviewSelectionFrictionReason({
        completedBookings: fact.completedBookings,
        favoriteCount,
        profileViews,
        riskLevel: fact.riskLevel,
      });

      return {
        ...partnerOverviewActionRow({
          ...fact,
          mainReason,
          recommendedAction: partnerOverviewSelectionFrictionAction(mainReason),
        }),
        activeServiceCount: fact.activeServiceCount,
        availabilityStatus: fact.availabilityStatus,
        averageResponseSeconds,
        completedBookings: fact.completedBookings,
        favoriteCount,
        galleryImageCount: fact.galleryImageCount,
        hasProfileImage: fact.hasProfileImage,
        lastIntentAt: lastIntentAt?.toISOString() ?? null,
        maxServicePrice: fact.maxServicePrice,
        minServicePrice: fact.minServicePrice,
        nextAvailableAt: fact.nextAvailableAt,
        profileViewCustomers: viewStats?.profileViewCustomers ?? 0,
        profileViews,
        rating: fact.rating,
        readinessFlags,
        reviewCount: fact.reviewCount,
        selectionRate,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    issueCounts: partnerOverviewSelectionIssueCounts(rows),
    rows: rows
      .filter((row) => partnerOverviewSelectionIssueMatches(row.readinessFlags, options.selectionIssue))
      .sort((left, right) => partnerOverviewSelectionSortRows(left, right, options.selectionSort))
      .slice(0, ADMIN_PARTNER_OVERVIEW_RANK_LIMIT),
  };
}

function partnerOverviewSelectionIssueCounts(rows: readonly PartnerOverviewSelectionSortableRow[]) {
  return PARTNER_OVERVIEW_SELECTION_ISSUE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    count: rows.filter((row) => partnerOverviewSelectionIssueMatches(row.readinessFlags, option.issue)).length,
  }));
}

function partnerOverviewSelectionIssueMatches(
  flags: readonly string[],
  issue: PartnerOverviewSelectionIssue | null,
) {
  if (!issue) return true;

  switch (issue) {
    case 'availability':
      return flags.some((flag) =>
        ['Available soon', 'Busy now', 'Offline now'].includes(flag),
      );
    case 'price':
      return flags.includes('High partner price');
    case 'profile':
      return flags.includes('No approved profile image') || flags.includes('No approved gallery image');
    case 'response':
      return flags.includes('Slow response');
    case 'service':
      return flags.includes('No active service');
  }
}

function partnerOverviewSelectionSortRows(
  left: PartnerOverviewSelectionSortableRow,
  right: PartnerOverviewSelectionSortableRow,
  sort: PartnerOverviewSelectionSort,
) {
  const defaultSort =
    right.profileViews - left.profileViews ||
    right.favoriteCount - left.favoriteCount ||
    right.completedBookings - left.completedBookings ||
    (right.lastIntentAt ?? '').localeCompare(left.lastIntentAt ?? '');

  switch (sort) {
    case 'availability':
      return partnerOverviewAvailabilityWeight(right.readinessFlags) -
        partnerOverviewAvailabilityWeight(left.readinessFlags) ||
        defaultSort;
    case 'favorites':
      return right.favoriteCount - left.favoriteCount || defaultSort;
    case 'price':
      return (right.maxServicePrice ?? -1) - (left.maxServicePrice ?? -1) || defaultSort;
    case 'response':
      return (right.averageResponseSeconds ?? -1) - (left.averageResponseSeconds ?? -1) || defaultSort;
    default:
      return defaultSort;
  }
}

function partnerOverviewAvailabilityWeight(flags: readonly string[]) {
  if (flags.includes('Offline now')) return 4;
  if (flags.includes('Busy now')) return 3;
  if (flags.includes('Available soon')) return 2;
  if (flags.includes('Not eligible now')) return 1;
  return 0;
}

function partnerOverviewSelectionReadinessFlags(
  fact: PartnerOverviewProviderFact,
  averageResponseSeconds: number | null,
) {
  const flags: string[] = [];

  if (!fact.hasProfileImage) flags.push('No approved profile image');
  if (fact.galleryImageCount === 0) flags.push('No approved gallery image');
  if (fact.activeServiceCount === 0) flags.push('No active service');
  if (fact.maxServicePriceRatio !== null && fact.maxServicePriceRatio >= 1.5) {
    flags.push('High partner price');
  }
  if (fact.status === ProviderStatus.ONLINE_AVAILABLE_SOON) {
    flags.push('Available soon');
  } else if (fact.status === ProviderStatus.ONLINE_BUSY) {
    flags.push('Busy now');
  } else if (fact.status === ProviderStatus.OFFLINE) {
    flags.push('Offline now');
  }
  if (averageResponseSeconds !== null && averageResponseSeconds >= 180) {
    flags.push('Slow response');
  }
  if (!fact.eligibleToAccept) flags.push('Not eligible now');

  return flags.length > 0 ? flags : ['No obvious blocker'];
}

function partnerOverviewSelectionFrictionReason(input: {
  readonly completedBookings: number;
  readonly favoriteCount: number;
  readonly profileViews: number;
  readonly riskLevel: PartnerOverviewProviderFact['riskLevel'];
}) {
  if (input.completedBookings === 0 && input.profileViews >= 5) return 'High views, no completed booking';
  if (input.completedBookings === 0 && input.favoriteCount > 0) return 'Favorited but not selected';
  if (input.riskLevel === 'critical' || input.riskLevel === 'high') return 'Risk blocking conversion';
  return 'Monitor profile conversion';
}

function partnerOverviewSelectionFrictionAction(reason: string) {
  switch (reason) {
    case 'High views, no completed booking':
      return 'Review profile pricing and photos';
    case 'Favorited but not selected':
      return 'Check availability and direct request readiness';
    case 'Risk blocking conversion':
      return 'Resolve operational risk first';
    default:
      return 'Monitor profile conversion';
  }
}

function partnerOverviewSegments(facts: readonly PartnerOverviewProviderFact[]) {
  const segment = (
    key: string,
    label: string,
    rows: PartnerOverviewProviderFact[],
    explanation: string,
    recommendedAction: string,
    href: string,
    tone: 'success' | 'warning' | 'danger' | 'info' = 'info',
  ) => ({
    key,
    label,
    count: rows.length,
    explanation,
    recommendedAction,
    href,
    tone,
  });

  return [
    segment('pending', 'New Pending', facts.filter((fact) => !fact.approved), 'Needs admin review before marketplace exposure.', 'Review KYC and profile documents.', '/partners?review=unapproved', 'warning'),
    segment(
      'documents-missing',
      'Documents Missing',
      facts.filter((fact) => fact.verificationStatus !== VerificationStatus.APPROVED || fact.kycStatus !== ProviderKycStatus.APPROVED),
      'Partners that still need approval-ready KYC or profile evidence.',
      'Request missing documents or review submitted files.',
      '/partners?review=unapproved&documentStatus=missing',
      'warning',
    ),
    segment(
      'approved-inactive',
      'Approved But Inactive',
      facts.filter((fact) => fact.approved && fact.inactive7d),
      'Approved Partners without recent online, booking, or request activity.',
      'Send reactivation message or operator follow-up.',
      '/partners?review=marketplace-ready&activity=inactive-7d',
      'warning',
    ),
    segment('first-job', 'First Job Pending', facts.filter((fact) => fact.approved && fact.completedBookings === 0), 'Approved supply without a completed booking.', 'Check pricing, service coverage, and activation.', '/partners?review=marketplace-ready&bookingFlow=first-job-pending', 'info'),
    segment('high-activity', 'High Activity', facts.filter((fact) => fact.completedBookings >= 3), 'Reliable supply anchors in the selected range.', 'Keep available and monitor payout readiness.', '/partners?sort=completed-work', 'success'),
    segment('high-rating', 'High Rating', facts.filter((fact) => fact.rating >= 4.5 && fact.reviewCount >= 3), 'Partners with strong customer feedback.', 'Feature in marketplace and retention campaigns.', '/partners?sort=rating', 'success'),
    segment(
      'low-rating',
      'Low Rating',
      facts.filter((fact) => fact.lowReviewCount > 0 || (fact.reviewCount > 0 && fact.rating < 3)),
      'Partners with recent low-quality signals.',
      'Review service records and customer complaints.',
      '/partners?review=quality-risk',
      'danger',
    ),
    segment('high-cancellation', 'High Cancellation', facts.filter((fact) => fact.cancellationRate >= 20), 'Cancellation risk that can hurt matching.', 'Audit work schedule and cancellation reasons.', '/partners?review=high-cancellation', 'warning'),
    segment('no-show', 'No-show Risk', facts.filter((fact) => fact.noShowReports > 0), 'Open no-show evidence needs operator attention.', 'Review no-show reports and possible sanctions.', '/partners?review=no-show-risk', 'danger'),
    segment('negative-wallet', 'Negative Wallet', facts.filter((fact) => fact.walletBalance < 0), 'Company receivable exposure from partner wallet.', 'Resolve deposit or receivable workflow.', '/partners?review=unsettled', 'danger'),
    segment(
      'payout-blocked',
      'Payout Blocked',
      facts.filter((fact) => fact.walletBalance < 0 || fact.taxStatus !== ProviderTaxProfileStatus.APPROVED),
      'Payout readiness is blocked by wallet debt or missing finance profile review.',
      'Review wallet, withdrawal setup, and tax readiness.',
      '/partners?review=payout-blocked',
      'danger',
    ),
    segment('churn-risk', 'Churn Risk', facts.filter((fact) => fact.approved && fact.inactive30d), 'Approved supply without recent activity.', 'Send reactivation push or call.', '/partners?review=marketplace-ready&activity=inactive-30d', 'warning'),
    segment(
      'overpriced',
      'Overpriced',
      [],
      'Requires partner pricing policy comparison before automated classification.',
      'Review service pricing outliers once pricing telemetry is connected.',
      '/partners?review=pricing-risk',
      'info',
    ),
  ];
}

function partnerOverviewKpi(
  key: string,
  label: string,
  value: number | null,
  detail: string,
  unit: 'count' | 'money' | 'percent' | 'seconds' | 'rating' = 'count',
) {
  return {
    key,
    label,
    value,
    detail,
    unit,
    deltaPercent: null,
  };
}

function partnerOverviewAverageDetailDurationSeconds(
  rows: Array<{ metadata: Prisma.JsonValue | null }>,
) {
  const values = rows
    .map((row) => partnerOverviewDetailDurationSeconds(row.metadata))
    .filter((value): value is number => typeof value === 'number');
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function partnerOverviewDetailDurationSeconds(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    return null;
  }
  const durationSeconds = (metadata as Record<string, unknown>).durationSeconds;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return null;
  }
  return Math.trunc(durationSeconds);
}

function partnerOverviewFunnelSteps(steps: Array<[string, number | null]>) {
  const firstKnown = steps.find(([, count]) => typeof count === 'number')?.[1] ?? null;

  return steps.map(([label, count], index) => {
    const previousKnown = steps
      .slice(0, index)
      .reverse()
      .find(([, previousCount]) => typeof previousCount === 'number')?.[1];
    const conversionBase = typeof firstKnown === 'number' && firstKnown > 0 ? firstKnown : null;
    const dropoffBase = typeof previousKnown === 'number' && previousKnown > 0 ? previousKnown : null;

    return {
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      count,
      conversionRate: typeof count === 'number' && conversionBase ? percentageValue(count, conversionBase) : null,
      dropoffRate:
        typeof count === 'number' && dropoffBase ? Math.max(0, 100 - percentageValue(count, dropoffBase)) : null,
      dataStatus: typeof count === 'number' ? 'available' : 'not_enough_data',
    };
  });
}

function usageOverviewUtcDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function usageOverviewAddUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function usageOverviewClosedAtSql(
  dateWhere: ReturnType<typeof adminUsageDateWhere>,
  tableAlias?: string,
) {
  if (!dateWhere) return Prisma.empty;

  if (tableAlias === 'booking') {
    return Prisma.sql`AND booking."closedAt" >= ${dateWhere.gte} AND booking."closedAt" < ${dateWhere.lt}`;
  }

  return Prisma.sql`AND "closedAt" >= ${dateWhere.gte} AND "closedAt" < ${dateWhere.lt}`;
}

function usageOverviewLastSeenAtSql(dateWhere: ReturnType<typeof adminUsageDateWhere>) {
  if (!dateWhere) return Prisma.empty;

  return Prisma.sql`AND "lastSeenAt" >= ${dateWhere.gte} AND "lastSeenAt" < ${dateWhere.lt}`;
}

function usageOverviewCreatedAtSql(dateWhere: ReturnType<typeof adminUsageDateWhere>) {
  if (!dateWhere) return Prisma.empty;

  return Prisma.sql`AND "createdAt" >= ${dateWhere.gte} AND "createdAt" < ${dateWhere.lt}`;
}

function usageOverviewClosedOrUpdatedAtSql(dateWhere: ReturnType<typeof adminUsageDateWhere>) {
  if (!dateWhere) return Prisma.empty;

  return Prisma.sql`
    AND (
      ("closedAt" >= ${dateWhere.gte} AND "closedAt" < ${dateWhere.lt})
      OR ("updatedAt" >= ${dateWhere.gte} AND "updatedAt" < ${dateWhere.lt})
    )
  `;
}

function normalizeUsageOverviewPlatform(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'android' || normalized === 'ios' || normalized === 'web') {
    return normalized;
  }

  return 'unknown';
}

function buildUsageOverviewHourlyActivity(
  rows: Array<{
    hour: bigint | number | null;
    customerSessionCount: bigint | number | null;
    bookingRequestCount: bigint | number | null;
  }>,
) {
  const hourlyMap = new Map(
    rows
      .map((row) => {
        const hour = numberValue(row.hour);

        if (hour < 0 || hour > 23) return null;

        return [
          hour,
          {
            bookingRequestCount: numberValue(row.bookingRequestCount),
            customerSessionCount: numberValue(row.customerSessionCount),
          },
        ] as const;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
  );

  return Array.from({ length: 24 }, (_, hour) => {
    const row = hourlyMap.get(hour);
    const customerSessionCount = row?.customerSessionCount ?? 0;
    const bookingRequestCount = row?.bookingRequestCount ?? 0;

    return {
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      customerSessionCount,
      bookingRequestCount,
      totalActivityCount: customerSessionCount + bookingRequestCount,
    };
  });
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
    platformFeeVatRateBps: referralPolicyPlatformFeeVatRateBps(policy?.metadata ?? null),
    currency: policy?.currency ?? 'VND',
    notes: policy?.notes ?? null,
    source: policy ? 'stored-policy' : 'default-disabled',
    updatedAt: policy?.updatedAt ?? null,
  };
}

function referralPolicyMetadata(platformFeeVatRateBps: number | null | undefined): Prisma.InputJsonObject {
  return {
    platformFeeVatRateBps: normalizeReferralPolicyPlatformFeeVatRateBps(platformFeeVatRateBps),
  };
}

function referralPolicyPlatformFeeVatRateBps(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return normalizeReferralPolicyPlatformFeeVatRateBps(null);
  }

  const value = metadata.platformFeeVatRateBps;

  return normalizeReferralPolicyPlatformFeeVatRateBps(typeof value === 'number' ? value : null);
}

function normalizeReferralPolicyPlatformFeeVatRateBps(value: number | null | undefined) {
  if (value === null || value === undefined) return 800;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new BadRequestException('Platform fee VAT rate must be between 0% and 100%');
  }

  return value;
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

function adminReferralCashoutQueueRowView(
  reward: AdminReferralCashoutReward,
  decisions: AdminReferralRewardDecisionMap,
) {
  const audience = reward.attribution.audience;
  const parent =
    audience === ReferralAudience.PARTNER
      ? adminReferralProviderPersonView(reward.attribution.referrerProviderProfile, 'Unknown Partner')
      : adminReferralCustomerPersonView(reward.attribution.referrerCustomerProfile, 'Unknown customer');
  const referred =
    audience === ReferralAudience.PARTNER
      ? adminReferralProviderPersonView(
          reward.attribution.referredProviderProfile,
          'Unknown referred Partner',
        )
      : adminReferralCustomerPersonView(
          reward.attribution.referredCustomerProfile,
          'Unknown referred customer',
        );
  const latestDecision = decisions.get(reward.id);

  return {
    id: reward.id,
    audience,
    amount: reward.amount,
    calculationSnapshot: reward.calculationSnapshot,
    currency: reward.currency,
    status: reward.status,
    qualifyingBookingId: reward.qualifyingBookingId,
    walletLedgerReference: reward.walletLedgerReference,
    availableAt: reward.availableAt,
    createdAt: reward.createdAt,
    latestDecision,
    parent,
    payoutProfile: adminReferralCashoutPayoutProfile(reward),
    referred,
    detailHref:
      audience === ReferralAudience.PARTNER
        ? `/referrals/partners/${encodeURIComponent(parent.id)}`
        : `/referrals/customers/${encodeURIComponent(parent.id)}`,
    attribution: {
      id: reward.attribution.id,
      audience: reward.attribution.audience,
      status: reward.attribution.status,
      fraudReviewStatus: reward.attribution.fraudReviewStatus,
      installSource: reward.attribution.installSource,
      platform: reward.attribution.platform,
      createdAt: reward.attribution.createdAt,
    },
  };
}

function adminReferralCashoutPayoutProfile(reward: AdminReferralCashoutReward) {
  if (reward.attribution.audience !== ReferralAudience.PARTNER) {
    return {
      account: null,
      helper:
        'Customer referral rewards credit to the customer wallet; bank cashout details are not collected in MVP.',
      label: 'Customer wallet reward',
      status: 'WALLET_ONLY',
      type: 'CUSTOMER_WALLET',
    };
  }

  return adminReferralPartnerCashoutPayoutProfile(
    reward.attribution.referrerProviderProfile?.bankAccounts ?? [],
  );
}

function adminReferralPartnerCashoutPayoutProfile(bankAccounts: readonly AdminReferralCashoutBankAccount[]) {
  const account = adminReferralPreferredCashoutBankAccount(bankAccounts);
  if (!account) {
    return {
      account: null,
      helper: 'Partner has not submitted bank information yet.',
      label: 'Bank info missing',
      status: 'MISSING',
      type: 'PROVIDER_BANK_ACCOUNT',
    };
  }
  if (account.status === ProviderBankAccountStatus.APPROVED) {
    return {
      account: adminReferralCashoutBankAccountView(account),
      helper: 'Approved bank account is available for manual transfer closeout.',
      label: 'Bank ready',
      status: 'READY',
      type: 'PROVIDER_BANK_ACCOUNT',
    };
  }
  if (account.status === ProviderBankAccountStatus.REJECTED) {
    return {
      account: adminReferralCashoutBankAccountView(account),
      helper: account.rejectionReason ?? 'Bank details were rejected; request corrected payout information.',
      label: 'Bank correction required',
      status: 'CORRECTION_REQUIRED',
      type: 'PROVIDER_BANK_ACCOUNT',
    };
  }

  return {
    account: adminReferralCashoutBankAccountView(account),
    helper: 'Bank details are waiting for admin review before manual transfer closeout.',
    label: 'Bank review needed',
    status: 'NEEDS_REVIEW',
    type: 'PROVIDER_BANK_ACCOUNT',
  };
}

function adminReferralPreferredCashoutBankAccount(bankAccounts: readonly AdminReferralCashoutBankAccount[]) {
  return (
    bankAccounts.find((account) => account.status === ProviderBankAccountStatus.APPROVED) ??
    bankAccounts.find((account) => account.status === ProviderBankAccountStatus.REJECTED) ??
    bankAccounts.find((account) => account.status === ProviderBankAccountStatus.PENDING_REVIEW) ??
    bankAccounts[0] ??
    null
  );
}

function adminReferralCashoutBankAccountView(account: AdminReferralCashoutBankAccount) {
  return {
    id: account.id,
    bankName: account.bankName,
    accountHolderName: account.accountHolderName,
    accountNumberMasked: account.accountNumberMasked,
    accountNumberLast4: account.accountNumberLast4,
    status: account.status,
    isPrimary: account.isPrimary,
    reviewedAt: account.reviewedAt,
    rejectionReason: account.rejectionReason,
    updatedAt: account.updatedAt,
  };
}

function adminReferralCustomerPersonView(
  profile: {
    id: string;
    user: {
      email: string | null;
      fullName: string | null;
      phone: string;
    };
  } | null,
  fallback: string,
) {
  const user = profile?.user;
  return {
    id: profile?.id ?? '',
    label: user?.fullName ?? user?.phone ?? user?.email ?? fallback,
    phone: user?.phone ?? null,
    href: profile?.id ? `/customers/${encodeURIComponent(profile.id)}` : null,
  };
}

function adminReferralProviderPersonView(
  profile: {
    displayName: string;
    id: string;
    user: {
      email: string | null;
      fullName: string | null;
      phone: string;
    };
  } | null,
  fallback: string,
) {
  const user = profile?.user;
  return {
    id: profile?.id ?? '',
    label: profile?.displayName ?? user?.fullName ?? user?.phone ?? user?.email ?? fallback,
    phone: user?.phone ?? null,
    href: profile?.id ? `/partners/${encodeURIComponent(profile.id)}` : null,
  };
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

function providerWalletWithdrawalStatusChangeForAudit(
  metadata: Prisma.JsonValue | null,
): Prisma.InputJsonObject | null {
  const record = recordFromJsonValue(metadata);
  const statusChange = recordFromJsonValue((record.lastStatusChange as Prisma.JsonValue) ?? null);
  return Object.keys(statusChange).length > 0 ? (statusChange as Prisma.InputJsonObject) : null;
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
    reversalStatus: couponUsageReversalStatus(booking),
    scheduledStartAt: booking.scheduledStartAt,
    serviceName: service ? `${service.service.name} / ${service.service.durationMin} min` : null,
    servicePrice: service?.price ?? null,
    status: booking.status,
  };
}

function couponUsageReversalStatus(booking: {
  payment: { status: PaymentStatus } | null;
  status: BookingStatus;
}) {
  return booking.payment?.status === PaymentStatus.REFUNDED || booking.status === BookingStatus.REFUNDED
    ? 'REVERSED'
    : 'ACTIVE';
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
    rewardedRewardCount: countReferralRewardsByStatuses(rewards, creditedReferralRewardStatuses()),
    reversedRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.REVERSED),
    cancelledRewardCount: countReferralRewardsByStatus(rewards, ReferralRewardStatus.CANCELLED),
    pendingRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.PENDING),
    availableRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.AVAILABLE),
    heldRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.HELD),
    rewardedRewardAmount: sumReferralRewardsByStatuses(rewards, creditedReferralRewardStatuses()),
    reversedRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.REVERSED),
    cancelledRewardAmount: sumReferralRewardsByStatus(rewards, ReferralRewardStatus.CANCELLED),
    totalRewardAmount: rewards.reduce((total, reward) => total + reward.amount, 0),
  };
}

function adminReferralRewardQueueSummaries(
  rewardGroups: readonly {
    readonly status: ReferralRewardStatus;
    readonly _count: { readonly _all: number };
    readonly _sum: { readonly amount: number | null };
  }[],
) {
  const byStatus = new Map(
    rewardGroups.map((group) => [
      group.status,
      {
        amount: group._sum.amount ?? 0,
        count: group._count._all,
      },
    ]),
  );
  const statusSummary = (status: ReferralRewardStatus) => byStatus.get(status) ?? { amount: 0, count: 0 };
  const aggregateStatusSummaries = (statuses: readonly ReferralRewardStatus[]) =>
    statuses.reduce(
      (summary, status) => {
        const nextSummary = statusSummary(status);
        return {
          amount: summary.amount + nextSummary.amount,
          count: summary.count + nextSummary.count,
        };
      },
      { amount: 0, count: 0 },
    );
  const allSummary = rewardGroups.reduce(
    (summary, group) => ({
      amount: summary.amount + (group._sum.amount ?? 0),
      count: summary.count + group._count._all,
    }),
    { amount: 0, count: 0 },
  );

  return [
    { reward: 'all', ...allSummary },
    { reward: 'available', ...statusSummary(ReferralRewardStatus.AVAILABLE) },
    { reward: 'pending', ...statusSummary(ReferralRewardStatus.PENDING) },
    { reward: 'held', ...statusSummary(ReferralRewardStatus.HELD) },
    { reward: 'credited', ...aggregateStatusSummaries(creditedReferralRewardStatuses()) },
  ];
}

function adminReferralCashoutQueueSummary(
  totalCount: number,
  rewardGroups: readonly {
    readonly status: ReferralRewardStatus;
    readonly _count: { readonly _all: number };
    readonly _sum: { readonly amount: number | null };
  }[],
) {
  const byStatus = new Map(
    rewardGroups.map((group) => [
      group.status,
      {
        amount: group._sum.amount ?? 0,
        count: group._count._all,
      },
    ]),
  );
  const statusSummary = (status: ReferralRewardStatus, slug: string) => ({
    status: slug,
    ...(byStatus.get(status) ?? { amount: 0, count: 0 }),
  });
  const statusSummaries = [
    statusSummary(ReferralRewardStatus.CASHOUT_REQUESTED, 'requested'),
    statusSummary(referralRewardStatus('CASHOUT_APPROVED'), 'approved'),
    statusSummary(referralRewardStatus('TAX_REVIEW_REQUIRED'), 'tax-review'),
    statusSummary(referralRewardStatus('PAID'), 'paid'),
  ];

  return {
    totalCount,
    totalAmount: statusSummaries.reduce((total, summary) => total + summary.amount, 0),
    statusSummaries,
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

function countReferralRewardsByStatuses(
  rewards: AdminReferralRewardSummary[],
  statuses: readonly ReferralRewardStatus[],
) {
  const statusSet = new Set(statuses);
  return rewards.filter((reward) => statusSet.has(reward.status)).length;
}

function sumReferralRewardsByStatuses(
  rewards: AdminReferralRewardSummary[],
  statuses: readonly ReferralRewardStatus[],
) {
  const statusSet = new Set(statuses);
  return rewards
    .filter((reward) => statusSet.has(reward.status))
    .reduce((total, reward) => total + reward.amount, 0);
}

function creditedReferralRewardStatuses() {
  return [ReferralRewardStatus.REWARDED, referralRewardStatus('CREDITED')];
}

function referralCashoutLifecycleStatuses() {
  return [
    ReferralRewardStatus.CASHOUT_REQUESTED,
    referralRewardStatus('CASHOUT_APPROVED'),
    referralRewardStatus('TAX_REVIEW_REQUIRED'),
    referralRewardStatus('PAID'),
  ];
}

function referralRewardStatus(value: string): ReferralRewardStatus {
  return value as ReferralRewardStatus;
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

function mergeAdminOperatorRoles(currentRoles: readonly Role[], requestedRoles: readonly Role[] | undefined) {
  const preservedRoles = currentRoles.filter((role) => !isAdminOperatorRole(role));
  const nextOperatorRoles = normalizeAdminOperatorRoles(requestedRoles);
  return [...preservedRoles, ...nextOperatorRoles];
}

function normalizeAdminOperatorRoles(requestedRoles: readonly Role[] | undefined) {
  const roles = new Set<Role>([Role.ADMIN]);
  for (const role of requestedRoles ?? []) {
    if (isAdminOperatorRole(role)) {
      roles.add(role);
    }
  }

  return [...roles];
}

function isAdminOperatorRole(role: Role) {
  return ADMIN_OPERATOR_ROLES.includes(role as (typeof ADMIN_OPERATOR_ROLES)[number]);
}

function adminOperatorAccessView(operator: AdminOperatorAccessSummary) {
  return {
    id: operator.id,
    email: operator.email,
    phone: operator.phone,
    fullName: operator.fullName,
    roles: operator.roles,
    categories: operator.adminOperatorPermission?.categories ?? defaultAdminOperatorPermissionCategories(operator.roles),
    updatedAt: operator.adminOperatorPermission?.updatedAt.toISOString() ?? null,
  };
}

function adminOperatorActivityMetadata(metadata: unknown): Prisma.InputJsonObject {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Prisma.InputJsonObject;
  }
  if (metadata === undefined) {
    return {};
  }

  return { value: metadata as Prisma.InputJsonValue };
}

function normalizeAdminOperatorPermissionCategories(
  roles: readonly Role[],
  requestedCategories: readonly AdminOperatorPermissionCategory[] | undefined,
) {
  if (roles.includes(Role.MASTER_ADMIN)) {
    return [...ADMIN_OPERATOR_PERMISSION_CATEGORIES];
  }

  const categories =
    requestedCategories && requestedCategories.length > 0
      ? requestedCategories
      : defaultAdminOperatorPermissionCategories(roles);
  const allowed = new Set<AdminOperatorPermissionCategory>(ADMIN_OPERATOR_PERMISSION_CATEGORIES);
  return [...new Set(categories.filter((category) => allowed.has(category)))];
}

function defaultAdminOperatorPermissionCategories(roles: readonly Role[]) {
  if (roles.includes(Role.MASTER_ADMIN)) {
    return [...ADMIN_OPERATOR_PERMISSION_CATEGORIES];
  }

  const categories: AdminOperatorPermissionCategory[] = [
    AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
    AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY,
    AdminOperatorPermissionCategory.PARTNERS_DIRECTORY,
    AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH,
  ];
  if (roles.includes(Role.FINANCE_APPROVER)) {
    categories.push(
      AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
      AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER,
      AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
      AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
      AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
      AdminOperatorPermissionCategory.FINANCE_TAX,
    );
  }

  return categories;
}

function normalizeAdminOperatorEmail(value: string | null | undefined) {
  return normalizeNullable(value)?.toLowerCase() ?? null;
}

function generatedAdminOperatorPhone(email: string) {
  return `admin:${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
}

function hashAdminOperatorPassword(password: string) {
  const passwordSalt = randomBytes(ADMIN_OPERATOR_PASSWORD_SALT_BYTES).toString('base64url');
  const passwordHash = scryptSync(password, passwordSalt, ADMIN_OPERATOR_PASSWORD_HASH_BYTES).toString('base64url');

  return { passwordHash, passwordSalt };
}

function verifyAdminOperatorPassword(
  password: string,
  credential: { readonly passwordHash: string; readonly passwordSalt: string },
) {
  const candidateHash = scryptSync(
    password,
    credential.passwordSalt,
    ADMIN_OPERATOR_PASSWORD_HASH_BYTES,
  ).toString('base64url');
  const candidate = Buffer.from(candidateHash);
  const expected = Buffer.from(credential.passwordHash);

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function assertAdminOperatorProtectedRoleRemoval(
  db: AdminOperatorAccessDb,
  targetUserId: string,
  previousRoles: readonly Role[],
  nextRoles: readonly Role[],
) {
  if (previousRoles.includes(Role.MASTER_ADMIN) && !nextRoles.includes(Role.MASTER_ADMIN)) {
    const remainingMasterAdmins = await db.user.count({
      where: {
        id: { not: targetUserId },
        roles: { has: Role.MASTER_ADMIN },
      },
    });
    if (remainingMasterAdmins === 0) {
      throw new BadRequestException('Cannot remove the last master admin');
    }
  }

  if (previousRoles.includes(Role.FINANCE_APPROVER) && !nextRoles.includes(Role.FINANCE_APPROVER)) {
    const remainingApprovers = await db.user.count({
      where: {
        id: { not: targetUserId },
        roles: { has: Role.FINANCE_APPROVER },
      },
    });
    if (remainingApprovers === 0) {
      throw new BadRequestException('Cannot remove the last finance approver');
    }
  }
}

function adminUserListTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_USER_LIST_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_USER_LIST_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_USER_LIST_LIMIT);
}

function adminUserListSkip(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 10_000);
}

function normalizeAdminUserListRole(value: Role | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  return Object.values(Role).includes(normalized as Role) ? (normalized as Role) : null;
}

function adminUserListSelectForView(value: string | null | undefined) {
  return value === 'finance-approver-directory'
    ? adminFinanceApproverDirectoryUserSelect
    : adminUserListSelect;
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

function adminPartnerDirectoryOrderBy(
  sortValue: string | null | undefined,
): Prisma.ProviderProfileOrderByWithRelationInput | Prisma.ProviderProfileOrderByWithRelationInput[] {
  const sort = normalizeNullable(sortValue);

  if (sort === 'name') {
    return [{ displayName: 'asc' }, { legalName: 'asc' }, { id: 'asc' }];
  }

  return { id: 'desc' };
}

function adminOperationsPolicyProviderListTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT);
}

function adminPartnerDirectoryWhere(
  options: AdminPartnerDirectorySummaryOptions,
): Prisma.ProviderProfileWhereInput | undefined {
  return adminPartnerDirectoryAndWhere([
    adminPartnerDirectorySearchWhere(options.q),
    adminPartnerDirectoryVerificationWhere(options.verification),
    adminPartnerDirectoryProviderStatusWhere(options.providerStatus),
    adminPartnerDirectoryKycWhere(options.kyc),
    adminPartnerDirectoryBookingFlowWhere(options.bookingFlow),
    adminPartnerDirectoryReviewWhere(options.review),
  ]);
}

function adminPartnerDirectoryAndWhere(
  whereValues: Array<Prisma.ProviderProfileWhereInput | undefined>,
): Prisma.ProviderProfileWhereInput | undefined {
  const whereClauses = whereValues.filter(Boolean) as Prisma.ProviderProfileWhereInput[];

  if (whereClauses.length === 0) return undefined;
  if (whereClauses.length === 1) return whereClauses[0];

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

function adminPartnerDirectoryVerificationWhere(
  value: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const verification = normalizeNullable(value);

  if (!verification) {
    return undefined;
  }
  if (verification === 'BLOCKED') {
    return { blockedAt: { not: null } };
  }
  if (!isVerificationStatus(verification)) {
    return undefined;
  }

  return { verification: { is: { status: verification } } };
}

function adminPartnerDirectoryProviderStatusWhere(
  value: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const status = normalizeNullable(value);

  if (!status || !isProviderStatus(status)) {
    return undefined;
  }

  return { status };
}

function adminPartnerDirectoryKycWhere(
  value: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const status = normalizeNullable(value);

  if (!status || !isProviderKycStatus(status)) {
    return undefined;
  }

  return { kyc: { is: { status } } };
}

function adminPartnerDirectoryReviewWhere(
  reviewValue: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const review = normalizeNullable(reviewValue);

  if (review === 'blocked') {
    return { blockedAt: { not: null } };
  }
  if (review === 'documents') {
    return {
      documents: {
        some: {
          status: { in: [ProviderDocumentStatus.PENDING_REVIEW, ProviderDocumentStatus.REJECTED] },
        },
      },
    };
  }
  if (review === 'public-media') {
    return {
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
    };
  }
  if (review === 'bank') {
    return {
      AND: [
        { bankAccounts: { some: {} } },
        { bankAccounts: { none: { status: ProviderBankAccountStatus.APPROVED } } },
      ],
    };
  }
  if (review === 'tax') {
    return {
      taxProfile: {
        is: {
          status: { in: [ProviderTaxProfileStatus.PENDING_REVIEW, ProviderTaxProfileStatus.REJECTED] },
        },
      },
    };
  }
  if (review === 'reports') {
    return {
      OR: [
        {
          reports: {
            some: {
              status: { in: [ProviderReportStatus.OPEN, ProviderReportStatus.INVESTIGATING] },
            },
          },
        },
        { sanctions: { some: { status: ProviderSanctionStatus.ACTIVE } } },
      ],
    };
  }
  if (review === 'kyc') {
    return {
      OR: [
        { kyc: { is: null } },
        { kyc: { is: { status: { not: ProviderKycStatus.APPROVED } } } },
        {
          documents: {
            some: {
              type: { in: [...REQUIRED_KYC_DOCUMENT_TYPES] },
              status: { in: [ProviderDocumentStatus.PENDING_REVIEW, ProviderDocumentStatus.REJECTED] },
            },
          },
        },
      ],
    };
  }
  if (review === 'push') {
    return {
      user: {
        pushDevices: {
          none: {
            enabled: true,
          },
        },
      },
    };
  }

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

function adminPartnerDirectoryBookingFlowWhere(
  bookingFlowValue: string | null | undefined,
): Prisma.ProviderProfileWhereInput | undefined {
  const bookingFlow = normalizeNullable(bookingFlowValue);
  const relatedBooking = (where: Prisma.BookingWhereInput): Prisma.ProviderProfileWhereInput => ({
    OR: [
      { preferredBookings: { some: where } },
      { selectedBookings: { some: where } },
      { participants: { some: { booking: where } } },
    ],
  });

  if (bookingFlow === 'active-booking') {
    return relatedBooking({ status: { in: Array.from(ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES) } });
  }
  if (bookingFlow === 'first-pick') {
    return { preferredBookings: { some: {} } };
  }
  if (bookingFlow === 'marketplace-joined') {
    return { participants: { some: {} } };
  }
  if (bookingFlow === 'final-partner') {
    return { selectedBookings: { some: {} } };
  }
  if (bookingFlow === 'chat-live') {
    return relatedBooking({ chatRoom: { isNot: null } });
  }
  if (bookingFlow === 'chat-missing') {
    return relatedBooking({
      status: { in: [...ADMIN_PROVIDER_CHAT_REQUIRED_BOOKING_STATUSES] },
      chatRoom: { is: null },
    });
  }
  if (bookingFlow === 'completed-work') {
    return relatedBooking({ status: BookingStatus.COMPLETED });
  }
  if (bookingFlow === 'no-work') {
    return {
      AND: [
        { preferredBookings: { none: { status: BookingStatus.COMPLETED } } },
        { selectedBookings: { none: { status: BookingStatus.COMPLETED } } },
        { participants: { none: { booking: { status: BookingStatus.COMPLETED } } } },
      ],
    };
  }

  return undefined;
}

function isVerificationStatus(value: string): value is VerificationStatus {
  return (Object.values(VerificationStatus) as string[]).includes(value);
}

function isProviderStatus(value: string): value is ProviderStatus {
  return (Object.values(ProviderStatus) as string[]).includes(value);
}

function isProviderKycStatus(value: string): value is ProviderKycStatus {
  return (Object.values(ProviderKycStatus) as string[]).includes(value);
}

function adminCustomerDirectoryWhere(
  options: AdminCustomerDirectorySummaryOptions,
): Prisma.CustomerProfileWhereInput | undefined {
  const where: Prisma.CustomerProfileWhereInput = {};
  const userWhere: Prisma.UserWhereInput = {};
  const q = normalizeNullable(options.q);
  const genderWhere = adminCustomerDirectoryGenderWhere(options.gender);
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

  if (genderWhere) {
    Object.assign(where, genderWhere);
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

function adminCustomerSummaryWhere(
  baseWhere: Prisma.CustomerProfileWhereInput | undefined,
  extraWhere: Prisma.CustomerProfileWhereInput,
): Prisma.CustomerProfileWhereInput {
  return baseWhere ? { AND: [baseWhere, extraWhere] } : extraWhere;
}

function adminCustomerCreatedAtWindowWhere(startMs: number, endMs: number): Prisma.CustomerProfileWhereInput {
  return {
    user: {
      createdAt: {
        gte: new Date(startMs),
        lt: new Date(endMs),
      },
    },
  };
}

function adminCustomerLastSeenWindowWhere(startMs: number, endMs: number): Prisma.CustomerProfileWhereInput {
  return {
    user: {
      appSessions: {
        some: {
          lastSeenAt: {
            gte: new Date(startMs),
            lt: new Date(endMs),
          },
        },
      },
    },
  };
}

function adminCustomerGenderBreakdown(rows: AdminCustomerGenderGroupRow[]): AdminCustomerGenderBreakdown {
  return rows.reduce<AdminCustomerGenderBreakdown>(
    (breakdown, row) => {
      const count = row._count._all;
      switch (row.gender?.toLowerCase()) {
        case 'female':
          breakdown.female += count;
          break;
        case 'male':
          breakdown.male += count;
          break;
        case 'other':
          breakdown.other += count;
          break;
        default:
          breakdown.unknown += count;
          break;
      }

      return breakdown;
    },
    { female: 0, male: 0, other: 0, unknown: 0 },
  );
}

function adminCustomerGenderBreakdownTotal(breakdown: AdminCustomerGenderBreakdown) {
  return breakdown.female + breakdown.male + breakdown.other + breakdown.unknown;
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

function adminCustomerDirectoryGenderWhere(
  value: string | null | undefined,
): Prisma.CustomerProfileWhereInput | undefined {
  const gender = normalizeNullable(value)?.toLowerCase();
  if (!gender) {
    return undefined;
  }

  if (gender === 'unknown') {
    return {
      OR: [
        { gender: null },
        { gender: { equals: '' } },
        { gender: { equals: 'unknown', mode: 'insensitive' } },
        { gender: { equals: 'not captured', mode: 'insensitive' } },
      ],
    };
  }

  if (!['female', 'male', 'other'].includes(gender)) {
    return undefined;
  }

  return { gender: { equals: gender, mode: 'insensitive' } };
}

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

  if (
    !ADMIN_CUSTOMER_DIRECTORY_COUNTRIES.includes(
      country as (typeof ADMIN_CUSTOMER_DIRECTORY_COUNTRIES)[number],
    )
  ) {
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

function adminBookingSettlementSnapshotWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.BookingSettlementSnapshotWhereInput | undefined {
  const filters: Prisma.BookingSettlementSnapshotWhereInput[] = [];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  const reviewWhere = adminBookingSettlementSnapshotReviewWhere(options.review);

  if (dateRange) {
    filters.push({ postedAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminMergeBookingSettlementSnapshotWhere(
  base: Prisma.BookingSettlementSnapshotWhereInput | undefined,
  next: Prisma.BookingSettlementSnapshotWhereInput,
): Prisma.BookingSettlementSnapshotWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminBookingSettlementSnapshotCountArgs(
  where: Prisma.BookingSettlementSnapshotWhereInput | undefined,
): Prisma.BookingSettlementSnapshotCountArgs {
  return where ? { where } : {};
}

function adminBookingSettlementSnapshotReviewWhere(
  review: string | null | undefined,
): Prisma.BookingSettlementSnapshotWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'needs-action':
    case 'open':
      return { taxStatus: BookingSettlementTaxStatus.OPEN };
    case 'declared':
      return { taxStatus: BookingSettlementTaxStatus.DECLARED };
    case 'paid':
      return { taxStatus: BookingSettlementTaxStatus.PAID };
    case 'closed':
      return { taxStatus: BookingSettlementTaxStatus.CLOSED };
    case 'posted':
      return { settlementStatus: BookingSettlementStatus.POSTED };
    case 'reversed':
      return {
        OR: [
          { settlementStatus: BookingSettlementStatus.REVERSED },
          { taxStatus: BookingSettlementTaxStatus.REVERSED },
        ],
      };
    case 'cash':
      return { paymentMethod: PaymentMethod.CASH };
    case 'non-cash':
      return { paymentMethod: { not: PaymentMethod.CASH } };
    default:
      return undefined;
  }
}

function adminBookingSettlementReversalWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.BookingSettlementReversalEntryWhereInput | undefined {
  const filters: Prisma.BookingSettlementReversalEntryWhereInput[] = [];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  const reviewWhere = adminBookingSettlementReversalReviewWhere(options.review);

  if (dateRange) {
    filters.push({ occurredAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminMergeBookingSettlementReversalWhere(
  base: Prisma.BookingSettlementReversalEntryWhereInput | undefined,
  next: Prisma.BookingSettlementReversalEntryWhereInput,
): Prisma.BookingSettlementReversalEntryWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminBookingSettlementReversalCountArgs(
  where: Prisma.BookingSettlementReversalEntryWhereInput | undefined,
): Prisma.BookingSettlementReversalEntryCountArgs {
  return where ? { where } : {};
}

function adminBookingSettlementReversalReviewWhere(
  review: string | null | undefined,
): Prisma.BookingSettlementReversalEntryWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'cash':
      return { paymentMethod: PaymentMethod.CASH };
    case 'non-cash':
      return { paymentMethod: { not: PaymentMethod.CASH } };
    case 'reversed':
    case 'refund':
    case 'closed-period':
      return {
        OR: [
          { settlementStatus: BookingSettlementStatus.REVERSED },
          { taxStatus: BookingSettlementTaxStatus.REVERSED },
        ],
      };
    default:
      return undefined;
  }
}

function adminAccountingJournalBatchWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.AccountingJournalBatchWhereInput | undefined {
  const filters: Prisma.AccountingJournalBatchWhereInput[] = [];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  const reviewWhere = adminAccountingJournalBatchReviewWhere(options.review ?? options.status);

  if (dateRange) {
    filters.push({ postedAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminAccountingJournalBatchReviewWhere(
  review: string | null | undefined,
): Prisma.AccountingJournalBatchWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'draft':
      return { status: AccountingJournalBatchStatus.DRAFT };
    case 'posted':
    case 'open':
      return { status: AccountingJournalBatchStatus.POSTED };
    case 'reversed':
      return { status: AccountingJournalBatchStatus.REVERSED };
    default:
      return undefined;
  }
}

function adminMergeAccountingJournalBatchWhere(
  base: Prisma.AccountingJournalBatchWhereInput | undefined,
  next: Prisma.AccountingJournalBatchWhereInput,
): Prisma.AccountingJournalBatchWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminAccountingJournalBatchCountArgs(
  where: Prisma.AccountingJournalBatchWhereInput | undefined,
): Prisma.AccountingJournalBatchCountArgs {
  return where ? { where } : {};
}

function adminBookingPaymentClearingWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.BookingPaymentClearingEntryWhereInput | undefined {
  const filters: Prisma.BookingPaymentClearingEntryWhereInput[] = [];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  const reviewWhere = adminBookingPaymentClearingReviewWhere(options.review ?? options.status);

  if (dateRange) {
    filters.push({ occurredAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminBookingPaymentClearingReviewWhere(
  review: string | null | undefined,
): Prisma.BookingPaymentClearingEntryWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'needs-action':
    case 'open':
      return { status: BookingPaymentClearingStatus.OPEN };
    case 'partial':
    case 'partially-cleared':
      return { status: BookingPaymentClearingStatus.PARTIALLY_CLEARED };
    case 'cleared':
      return { status: BookingPaymentClearingStatus.CLEARED };
    case 'reversed':
      return { status: BookingPaymentClearingStatus.REVERSED };
    default:
      return undefined;
  }
}

function adminMergeBookingPaymentClearingWhere(
  base: Prisma.BookingPaymentClearingEntryWhereInput | undefined,
  next: Prisma.BookingPaymentClearingEntryWhereInput,
): Prisma.BookingPaymentClearingEntryWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminBookingPaymentClearingCountArgs(
  where: Prisma.BookingPaymentClearingEntryWhereInput | undefined,
): Prisma.BookingPaymentClearingEntryCountArgs {
  return where ? { where } : {};
}

function adminBankReconciliationWhere(
  options: AdminPaymentOperationsQuery,
): Prisma.CompanyBankTransactionWhereInput | undefined {
  const filters: Prisma.CompanyBankTransactionWhereInput[] = [];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  const reviewWhere = adminBankReconciliationReviewWhere(options.review ?? options.status);

  if (dateRange) {
    filters.push({ occurredAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminBankReconciliationReviewWhere(
  review: string | null | undefined,
): Prisma.CompanyBankTransactionWhereInput | undefined {
  switch (normalizeNullable(review)) {
    case 'needs-action':
    case 'unmatched':
      return { status: BankReconciliationStatus.UNMATCHED };
    case 'matched':
      return { status: BankReconciliationStatus.MATCHED };
    case 'partial':
    case 'partially-matched':
      return { status: BankReconciliationStatus.PARTIALLY_MATCHED };
    case 'ignored':
      return { status: BankReconciliationStatus.IGNORED };
    case 'reversed':
      return { status: BankReconciliationStatus.REVERSED };
    case 'inflow':
      return { type: CompanyBankTransactionType.INFLOW };
    case 'outflow':
      return { type: CompanyBankTransactionType.OUTFLOW };
    default:
      return undefined;
  }
}

function adminMergeBankReconciliationWhere(
  base: Prisma.CompanyBankTransactionWhereInput | undefined,
  next: Prisma.CompanyBankTransactionWhereInput,
): Prisma.CompanyBankTransactionWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminBankReconciliationCountArgs(
  where: Prisma.CompanyBankTransactionWhereInput | undefined,
): Prisma.CompanyBankTransactionCountArgs {
  return where ? { where } : {};
}

function companyBankTransactionType(value: string | CompanyBankTransactionType) {
  if (Object.values(CompanyBankTransactionType).includes(value as CompanyBankTransactionType)) {
    return value as CompanyBankTransactionType;
  }
  throw new BadRequestException('Valid bank transaction type is required');
}

function normalizeCompanyBankTransactionCurrency(
  value: string | null | undefined,
  fallback: string | null | undefined,
) {
  return (normalizeNullable(value) ?? fallback ?? 'VND').toUpperCase();
}

function companyBankTransactionSourceKey(input: {
  amount: number;
  bankAccountId: string;
  occurredAt: Date;
  sourceKey?: string | null;
  transferRef?: string | null;
  type: CompanyBankTransactionType;
}) {
  const sourceKey = normalizeNullable(input.sourceKey);
  if (sourceKey) {
    return sourceKey;
  }
  const transferRef = normalizeNullable(input.transferRef);
  const uniquePart = transferRef ?? `${input.occurredAt.toISOString()}:${input.amount}`;
  return `manual-bank-transaction:${input.bankAccountId}:${input.type}:${uniquePart}`;
}

function normalizeRequiredId(value: string | null | undefined, label: string) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    throw new BadRequestException(`${label} is required`);
  }
  return normalized;
}

function requiredAdminDate(value: string | Date | null | undefined, label: string) {
  const date = optionalAdminDate(value, label);
  if (!date) {
    throw new BadRequestException(`${label} is required`);
  }
  return date;
}

function optionalAdminDate(value: string | Date | null | undefined, label: string) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid date`);
  }
  return date;
}

type AdminBankReconciliationMatchSource = {
  readonly field:
    | 'accountingJournalEntryId'
    | 'paymentClearingEntryId'
    | 'withdrawalRequestId'
    | 'payoutBatchId';
  readonly id: string;
  readonly key: string;
  readonly type: 'accounting-journal' | 'payment-clearing' | 'withdrawal' | 'payout-batch';
};

function adminBankReconciliationMatchSource(
  input: CreateBankReconciliationMatchDto,
): AdminBankReconciliationMatchSource {
  const candidates: AdminBankReconciliationMatchSource[] = [
    {
      field: 'accountingJournalEntryId',
      id: normalizeNullable(input.accountingJournalEntryId) ?? '',
      key: 'accounting-journal',
      type: 'accounting-journal',
    },
    {
      field: 'paymentClearingEntryId',
      id: normalizeNullable(input.paymentClearingEntryId) ?? '',
      key: 'payment-clearing',
      type: 'payment-clearing',
    },
    {
      field: 'withdrawalRequestId',
      id: normalizeNullable(input.withdrawalRequestId) ?? '',
      key: 'withdrawal',
      type: 'withdrawal',
    },
    {
      field: 'payoutBatchId',
      id: normalizeNullable(input.payoutBatchId) ?? '',
      key: 'payout-batch',
      type: 'payout-batch',
    },
  ];
  const sources = candidates.filter((source) => source.id.length > 0);

  if (sources.length !== 1) {
    throw new BadRequestException('Select exactly one reconciliation source');
  }

  return sources[0]!;
}

function bankReconciliationMatchSourceKey(
  bankTransactionId: string,
  source: AdminBankReconciliationMatchSource,
) {
  return `bank-reconciliation-match:${bankTransactionId}:${source.key}:${source.id}`;
}

function bankReconciliationStatusForAmount(matchedAmount: number, transactionAmount: number) {
  const matched = Math.abs(matchedAmount);
  const target = Math.abs(transactionAmount);
  if (matched <= 0) {
    return BankReconciliationStatus.UNMATCHED;
  }
  return matched >= target ? BankReconciliationStatus.MATCHED : BankReconciliationStatus.PARTIALLY_MATCHED;
}

function bookingPaymentClearingStatusForAmount(matchedAmount: number, clearingAmount: number) {
  const matched = Math.abs(matchedAmount);
  const target = Math.abs(clearingAmount);
  if (matched <= 0) {
    return BookingPaymentClearingStatus.OPEN;
  }
  return matched >= target
    ? BookingPaymentClearingStatus.CLEARED
    : BookingPaymentClearingStatus.PARTIALLY_CLEARED;
}

function adminCouponFinanceSqlWhere(options: AdminPaymentOperationsQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`("metadata" ? 'couponDiscountAmount' OR "metadata" ? 'couponCodeSnapshot' OR "metadata" ? 'couponId')`,
  ];
  const dateRange = adminPaymentDateRangeWhere(options.range);
  if (dateRange?.gte instanceof Date) {
    conditions.push(Prisma.sql`"postedAt" >= ${dateRange.gte}`);
  }
  if (dateRange?.lte instanceof Date) {
    conditions.push(Prisma.sql`"postedAt" <= ${dateRange.lte}`);
  }

  const reviewSql = adminCouponFinanceReviewSql(options.review);
  if (reviewSql) {
    conditions.push(reviewSql);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function adminCouponFinanceReviewSql(review: string | null | undefined): Prisma.Sql | null {
  switch (normalizeNullable(review)) {
    case 'needs-action':
    case 'open':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.OPEN}`;
    case 'declared':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.DECLARED}`;
    case 'paid':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.PAID}`;
    case 'closed':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.CLOSED}`;
    case 'posted':
      return Prisma.sql`"settlementStatus" = ${BookingSettlementStatus.POSTED}`;
    case 'reversed':
      return Prisma.sql`("settlementStatus" = ${BookingSettlementStatus.REVERSED} OR "taxStatus" = ${BookingSettlementTaxStatus.REVERSED})`;
    case 'cash':
      return Prisma.sql`"paymentMethod" = ${PaymentMethod.CASH}`;
    case 'non-cash':
      return Prisma.sql`"paymentMethod" <> ${PaymentMethod.CASH}`;
    default:
      return null;
  }
}

function adminJsonIntSql(key: string): Prisma.Sql {
  return Prisma.sql`
    CASE
      WHEN "metadata" ? ${key} AND ("metadata"->>${key}) ~ '^-?[0-9]+$'
      THEN ("metadata"->>${key})::bigint
      ELSE 0
    END
  `;
}

function adminPartnerWithholdingTaxWhere(period: string): Prisma.BookingSettlementSnapshotWhereInput {
  return {
    monthlyPeriod: period,
    OR: [{ customerPaymentAmount: { gt: 0 } }, { partnerWithholdingTotal: { gt: 0 } }],
  };
}

function adminPartnerWithholdingTaxSqlWhere(period: string): Prisma.Sql {
  return Prisma.sql`
    WHERE "monthlyPeriod" = ${period}
      AND ("customerPaymentAmount" > 0 OR "partnerWithholdingTotal" > 0)
  `;
}

function adminPartnerWithholdingTaxPeriod(value: string | null | undefined) {
  const normalized = normalizeNullable(value);
  if (normalized && /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    return normalized;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function monthlyTaxClosingStatus(value: MonthlyTaxClosingStatus | string | null | undefined) {
  if (value && Object.values(MonthlyTaxClosingStatus).includes(value as MonthlyTaxClosingStatus)) {
    return value as MonthlyTaxClosingStatus;
  }

  throw new BadRequestException('Valid monthly tax closing status is required.');
}

function assertMonthlyTaxClosingReconciliationIsBalanced(
  summary: { reconciliationDelta: number },
  nextStatus: MonthlyTaxClosingStatus,
) {
  if (nextStatus === MonthlyTaxClosingStatus.DRAFT) {
    return;
  }
  if (summary.reconciliationDelta !== 0) {
    throw new BadRequestException(
      'Monthly close requires reconciliation delta to be zero before status can advance.',
    );
  }
}

async function assertMonthlyTaxClosingPostedJournalsAreBalanced(
  prisma: Pick<PrismaService, 'accountingJournalBatch'> | Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  period: string,
  nextStatus: MonthlyTaxClosingStatus,
) {
  if (nextStatus === MonthlyTaxClosingStatus.DRAFT) {
    return;
  }

  const imbalancedJournal = await prisma.accountingJournalBatch.findFirst({
    where: {
      monthlyPeriod: period,
      status: AccountingJournalBatchStatus.POSTED,
      metadata: {
        path: ['reconciliationDelta'],
        not: 0,
      },
    },
    select: { id: true, sourceKey: true },
  });

  if (imbalancedJournal) {
    throw new BadRequestException(
      'Monthly close requires posted journal reconciliation deltas to be cleared before status can advance.',
    );
  }
}

async function upsertWithholdingRemittanceJournal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  input: {
    readonly actorId: string;
    readonly closingId: string;
    readonly currency: string;
    readonly period: string;
    readonly remittanceMetadata: Prisma.InputJsonObject | null;
    readonly total: number;
  },
) {
  if (!input.remittanceMetadata || input.total <= 0) {
    return;
  }

  const sourceKey = `accounting-journal:withholding-remittance:${input.period}:${input.currency}`;
  const entries = [
    {
      accountCode: 'partner_vat_pit_payable',
      accountName: 'Partner VAT/PIT payable',
      amount: input.total,
      currency: input.currency,
      memo: `Withholding remittance paid for ${input.period}`,
      side: 'DEBIT' as const,
      sourceId: input.closingId,
      sourceType: AccountingJournalSourceType.WITHHOLDING_REMITTANCE,
    },
    {
      accountCode: 'company_bank_cash',
      accountName: 'Company bank cash',
      amount: input.total,
      currency: input.currency,
      memo: `Manual withholding remittance transfer for ${input.period}`,
      side: 'CREDIT' as const,
      sourceId: input.closingId,
      sourceType: AccountingJournalSourceType.WITHHOLDING_REMITTANCE,
    },
  ];
  const batchData = {
    createdById: input.actorId,
    currency: input.currency,
    entries: {
      create: entries,
    },
    metadata: toJson({
      monthlyTaxClosingId: input.closingId,
      partnerWithholdingRemittance: true,
      remittance: input.remittanceMetadata,
    }),
    monthlyPeriod: input.period,
    sourceId: input.closingId,
    sourceType: AccountingJournalSourceType.WITHHOLDING_REMITTANCE,
    status: AccountingJournalBatchStatus.POSTED,
    totalCredit: input.total,
    totalDebit: input.total,
  };

  await tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {
      ...batchData,
      entries: {
        deleteMany: {},
        create: entries,
      },
    },
    create: {
      ...batchData,
      sourceKey,
    },
  });
}

function monthlyTaxClosingRemittanceMetadata(
  status: MonthlyTaxClosingStatus,
  input: AdminMonthlyTaxClosingStatusInput,
  actorId: string,
) {
  if (status !== MonthlyTaxClosingStatus.PAID) {
    return null;
  }

  const approvedByAdminId = normalizeFinanceActionApprovalAdminId(
    input.approvalAdminId,
    actorId,
    'Partner withholding remittance paid closeout',
  );
  const transferRef = normalizeNullable(input.remittanceTransferRef);
  if (!transferRef) {
    throw new BadRequestException(
      'Partner withholding remittance transfer reference is required before marking paid.',
    );
  }
  const evidenceUrl = normalizeNullable(input.remittanceEvidenceUrl);
  if (!evidenceUrl) {
    throw new BadRequestException(
      'Partner withholding remittance evidence URL is required before marking paid.',
    );
  }

  const paidAtDate = monthlyTaxClosingPaidAtDate(input.paidAt);
  return {
    approvedByAdminId,
    paidAtDate,
    metadata: {
      transferRef,
      channel: normalizeNullable(input.remittanceChannel),
      evidenceUrl,
      paidAt: paidAtDate.toISOString(),
      remittedByAdminId: actorId,
      approvedByAdminId,
    },
  };
}

function monthlyTaxClosingPaidAtDate(value: string | null | undefined) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return new Date();
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Valid partner withholding remittance paidAt is required.');
  }
  return parsed;
}

function monthlyTaxClosingStatusMutationData(status: MonthlyTaxClosingStatus, actorId: string, at: Date) {
  switch (status) {
    case MonthlyTaxClosingStatus.REVIEWED:
      return { reviewedById: actorId };
    case MonthlyTaxClosingStatus.DECLARED:
      return { declaredAt: at, declaredById: actorId };
    case MonthlyTaxClosingStatus.PAID:
      return { paidAt: at, paidById: actorId };
    case MonthlyTaxClosingStatus.CLOSED:
      return { closedAt: at, closedById: actorId };
    default:
      return {};
  }
}

function monthlyTaxClosingSettlementTaxStatus(
  status: MonthlyTaxClosingStatus,
): BookingSettlementTaxStatus | null {
  switch (status) {
    case MonthlyTaxClosingStatus.DECLARED:
      return BookingSettlementTaxStatus.DECLARED;
    case MonthlyTaxClosingStatus.PAID:
      return BookingSettlementTaxStatus.PAID;
    case MonthlyTaxClosingStatus.CLOSED:
      return BookingSettlementTaxStatus.CLOSED;
    default:
      return null;
  }
}

const MONTHLY_TAX_CLOSING_STATUS_ORDER: readonly MonthlyTaxClosingStatus[] = [
  MonthlyTaxClosingStatus.DRAFT,
  MonthlyTaxClosingStatus.REVIEWED,
  MonthlyTaxClosingStatus.DECLARED,
  MonthlyTaxClosingStatus.PAID,
  MonthlyTaxClosingStatus.CLOSED,
];

function assertMonthlyTaxClosingStatusTransition(
  currentStatus: MonthlyTaxClosingStatus,
  nextStatus: MonthlyTaxClosingStatus,
) {
  if (currentStatus === nextStatus) {
    return;
  }

  const currentIndex = MONTHLY_TAX_CLOSING_STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = MONTHLY_TAX_CLOSING_STATUS_ORDER.indexOf(nextStatus);
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
    throw new BadRequestException(
      'Monthly tax closing status must move in order: REVIEWED, DECLARED, PAID, CLOSED.',
    );
  }
}

function platformVatCategory(rateBps: number) {
  if (rateBps === 800) {
    return 'REDUCED_8';
  }
  if (rateBps === 1000) {
    return 'STANDARD_10';
  }
  return 'MANUAL_REVIEW';
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

function adminMergePaymentOperationsWhere(
  base: Prisma.PaymentWhereInput | undefined,
  next: Prisma.PaymentWhereInput,
): Prisma.PaymentWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminPaymentCountArgs(where: Prisma.PaymentWhereInput | undefined): Prisma.PaymentCountArgs {
  return where ? { where } : {};
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

function adminMergePaymentCallbackAttemptWhere(
  base: Prisma.PaymentCallbackAttemptWhereInput | undefined,
  next: Prisma.PaymentCallbackAttemptWhereInput,
): Prisma.PaymentCallbackAttemptWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminPaymentCallbackAttemptCountArgs(
  where: Prisma.PaymentCallbackAttemptWhereInput | undefined,
): Prisma.PaymentCallbackAttemptCountArgs {
  return where ? { where } : {};
}

function adminLinkedRefundCountArgs(where: Prisma.PaymentWhereInput | undefined): Prisma.RefundCountArgs {
  return where ? { where: { payment: { is: where } } } : {};
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

function adminPaymentBookingDateWhere(
  range: string | null | undefined,
): Prisma.BookingWhereInput | undefined {
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

function adminMergeRefundOperationsWhere(
  base: Prisma.RefundWhereInput | undefined,
  next: Prisma.RefundWhereInput,
): Prisma.RefundWhereInput {
  return base ? { AND: [base, next] } : next;
}

function adminRefundCountArgs(where: Prisma.RefundWhereInput | undefined): Prisma.RefundCountArgs {
  return where ? { where } : {};
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
  readonly user?: string;
};

type NotificationBoardQueryOptions = NotificationBoardSummaryOptions & {
  readonly skip?: string;
  readonly take?: string;
};

type AdminNotificationTemplateListQuery = {
  readonly skip?: string;
  readonly take?: string;
};

function notificationBoardWhere(
  options: NotificationBoardSummaryOptions,
): Prisma.NotificationWhereInput | undefined {
  const where: Prisma.NotificationWhereInput = {};
  const dateWhere = notificationBoardDateWhere(options);
  const filters: Prisma.NotificationWhereInput[] = [];
  const booking = normalizeNullable(options.booking);
  const user = normalizeNullable(options.user);
  const reviewWhere = notificationBoardReviewWhere(options.review);

  if (dateWhere) {
    Object.assign(where, dateWhere);
  }
  if (booking) {
    filters.push({ data: { path: ['bookingId'], equals: booking } });
  }
  if (user) {
    filters.push({ userId: user });
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
