import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  AdminOperatorPermissionCategory,
  BankReconciliationStatus,
  BookingPaymentClearingStatus,
  BookingPaymentClearingEntryType,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
  BookingStatus,
  CashFeeSettlementMethod,
  EarningStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  MonthlyTaxClosingStatus,
  ManualWalletAdjustmentRequestStatus,
  PartnerBankDepositRequestStatus,
  PayoutBatchStatus,
  PaymentMethod,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentStatus,
  ParticipantStatus,
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
  ProviderWalletWithdrawalRequestStatus,
  ProviderWalletLedgerType,
  ReviewStatus,
  ReferralAttributionStatus,
  Role,
  TaxPolicyStatus,
  VerificationStatus,
} from '@prisma/client';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { hashAdminOperatorPassword, verifyAdminOperatorPassword } from '../auth/admin-operator-credential';
import { EarningsService } from '../earnings/earnings.service';
import {
  allocatePartnerBankDeposit,
  normalizePartnerBankDepositInput,
} from '../earnings/earnings.policy';
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
import {
  paymentCaptureSourceStatuses,
  transitionPaymentStatus,
} from '../payments/payment-status-transition';
import { REQUIRED_KYC_DOCUMENT_TYPES } from '../provider-onboarding/provider-onboarding.policy';
import { RedisStateService } from '../redis/redis-state.service';
import { ReferralsService } from '../referrals/referrals.service';
import {
  settlementMonthlyPeriod,
  VIETNAM_TIME_ZONE,
} from '../settlements/settlements.service';
import { bpsAmount } from '../settlements/settlement-calculator';
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
import {
  type AdminBookingListQuery,
  addLocalDays,
  adminBookingListDateWhere,
  adminBookingListStatusGroupWhere,
  adminBookingListWhere,
  endOfLocalDay,
  startOfLocalDay,
} from './admin-booking-list-query';
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
  adminFileReviewItemSelect,
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
  AssignCompanyBankTransactionImportBatchDto,
  AssignCompanyBankTransactionReviewDto,
  AllocatePartnerBankDepositCashDebtDto,
  AdminPushCampaignDto,
  CreateAdminCalendarEventDto,
  CreateAdminOperatorDto,
  CreateBankReconciliationMatchDto,
  CreateCompanyBankAccountDto,
  CreateCompanyBankTransactionDto,
  CompanyBankTransactionBatchRowDto,
  CreateManualWalletAdjustmentDto,
  CreateManualWalletAdjustmentRequestDto,
  CreatePartnerBankDepositRequestDto,
  DeleteAdminOperatorAccessDto,
  IgnoreCompanyBankTransactionDto,
  ImportCompanyBankTransactionBatchDto,
  PreviewManualWalletAdjustmentDto,
  PreviewCompanyBankTransactionBatchDto,
  RecordPartnerBankDepositDto,
  RepairBookingSettlementGapDto,
  ReverseBankReconciliationMatchDto,
  UpdateAdminCalendarEventDto,
  UpdateAdminOperatorAccessDto,
  UpdateCompanyBankAccountDto,
  UpdateFinanceApproverRoleDto,
  UpdateNotificationTemplateDto,
} from './admin.dto';

type AdminCompanyBankTransactionBatchClassification =
  | 'NEW'
  | 'POTENTIAL_DUPLICATE'
  | 'EXACT_DUPLICATE'
  | 'INVALID';

type AdminCompanyBankTransactionBatchNormalizedRow = {
  amount: number;
  bankAccountId: string;
  counterpartyName: string | null;
  currency: string;
  description: string | null;
  occurredAt: string;
  sourceKey: string;
  transferRef: string | null;
  type: CompanyBankTransactionType;
  valueDate: string | null;
};

type AdminCompanyBankTransactionDuplicateCandidate = {
  id: string;
  amount: number;
  counterpartyName: string | null;
  occurredAt: Date;
  status: BankReconciliationStatus;
  transferRef: string | null;
};

type AdminCompanyBankTransactionBatchAccount = {
  id: string;
  currency: string;
  status: CompanyBankAccountStatus;
};

type AdminCompanyBankTransactionBatchPreviewRow = {
  batchCandidateRowNumbers: number[];
  candidates: AdminCompanyBankTransactionDuplicateCandidate[];
  classification: AdminCompanyBankTransactionBatchClassification;
  errors: string[];
  normalized: AdminCompanyBankTransactionBatchNormalizedRow | null;
  raw: AdminCompanyBankTransactionBatchRawRow;
  rowNumber: number;
};

type AdminCompanyBankTransactionBatchRawRow = {
  amount: string;
  counterpartyName: string;
  occurredAt: string;
  transferRef: string;
  valueDate: string;
};

type AdminCompanyBankTransactionBatchContext = {
  batchImportId: string;
  csvRowNumber: number;
  mappingPreset: ImportCompanyBankTransactionBatchDto['mappingPreset'];
  sourceFileName: string;
  sourceFileSha256: string;
};

type AdminCompanyBankTransactionImportBatchListOptions = {
  q?: string | null;
  range?: string | null;
  review?: string | null;
  skip?: number | string | null;
  take?: number | string | null;
};

type AdminCompanyBankTransactionImportBatchReview =
  | 'all'
  | 'needs-reconciliation'
  | 'stale'
  | 'escalated'
  | 'reconciled';

type AdminCompanyBankTransactionImportBatchPageRow = {
  id: string | null;
  total: bigint | number;
};

type AdminCompanyBankTransactionImportBatchSummaryRow = {
  batchCount: bigint | number;
  escalatedNeedsReconciliationCount: bigint | number;
  needsReconciliationCount: bigint | number;
  noTransactionCount: bigint | number;
  oldestOpenImportedAt: Date | null;
  reconciledCount: bigint | number;
  staleNeedsReconciliationCount: bigint | number;
};

type AdminCompanyBankTransactionImportBatchEscalationRow = {
  assigneeAdminId: string | null;
  batchImportId: string;
  importedAt: Date;
  importerAdminId: string;
  openTransactionCount: bigint | number;
};

type AdminCompanyBankTransactionReviewEscalationRow = {
  assigneeAdminId: string;
  assignedAt: Date;
  assignmentAuditLogId: string;
  bankTransactionId: string;
  bankTransactionStatus: BankReconciliationStatus;
};

type AdminPartnerBankDepositReconciliationEscalationRow = {
  assigneeAdminId: string | null;
  assignedAt: Date | null;
  assignmentAuditLogId: string | null;
  partnerBankDepositRequestId: string;
  reviewStartedAt: Date;
};

type AdminFinanceReviewAssignmentAuditLog = {
  id: string;
  actorId: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  target?: string;
  actor: {
    id: string;
    email: string | null;
    fullName: string | null;
  } | null;
};

type AdminFinanceReviewAssignmentAdmin = {
  id: string;
  email: string | null;
  fullName: string | null;
};

const COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION = 'company_bank_transaction.batch_import';
const COMPANY_BANK_TRANSACTION_BATCH_ASSIGNMENT_ACTION = 'company_bank_transaction.batch_assignment';
const COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION =
  'company_bank_transaction.review_assignment';
const PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION =
  'partner_bank_deposit.reconciliation_assignment';
const PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_ACTION =
  'partner_bank_deposit.reconciliation_escalation';
const PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_RESOLVED_ACTION =
  'partner_bank_deposit.reconciliation_escalation_resolved';
const COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_ACTION =
  'company_bank_transaction.review_escalation';
const COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_RESOLVED_ACTION =
  'company_bank_transaction.review_escalation_resolved';
const COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_ACTION = 'company_bank_transaction.batch_escalation';
const COMPANY_BANK_TRANSACTION_BATCH_STALE_MS = 24 * 60 * 60_000;
const COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_MS = 48 * 60 * 60_000;
const COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_MS = 48 * 60 * 60_000;
const COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_SWEEP_LIMIT = 50;
const COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_SWEEP_LIMIT = 50;
const COMPANY_BANK_TRANSACTION_REVIEW_RESOLUTION_SWEEP_LIMIT = 50;
const PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_MS = 48 * 60 * 60_000;
const PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_SWEEP_LIMIT = 50;
const BANK_RECONCILIATION_WITHDRAWAL_CANDIDATE_WINDOW_MS = 30 * 24 * 60 * 60_000;
const BANK_RECONCILIATION_WITHDRAWAL_CANDIDATE_LIMIT = 25;

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
const ADMIN_NOTIFICATION_FINANCE_OVERDUE_TYPES = [
  'admin.finance.bank_statement_batch.escalated',
  'admin.finance.bank_transaction.review_escalated',
  'admin.finance.partner_bank_deposit.reconciliation_escalated',
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
const ADMIN_BOOKING_SETTLEMENT_GAP_DEFAULT_LIMIT = 20;
const ADMIN_BOOKING_SETTLEMENT_GAP_MAX_LIMIT = 50;
const ADMIN_BOOKING_SETTLEMENT_DRY_RUN_DEFAULT_LIMIT = 100;
const ADMIN_BOOKING_SETTLEMENT_DRY_RUN_MAX_LIMIT = 100;
const ADMIN_BOOKING_SETTLEMENT_DRY_RUN_CONCURRENCY = 5;
const ADMIN_BOOKING_SETTLEMENT_REVIEW_BATCH_SIZE = 10;
const ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_BOOKING_SETTLEMENT_GAP_VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
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
const ADMIN_MANUAL_WALLET_ADJUSTMENT_REQUEST_DEFAULT_LIMIT = 25;
const ADMIN_MANUAL_WALLET_ADJUSTMENT_REQUEST_MAX_LIMIT = 50;
const ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_DEFAULT_LIMIT = 25;
const ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_MAX_LIMIT = 50;
const ADMIN_PAYMENT_FEE_POLICY_DEFAULT_LIMIT = 10;
const ADMIN_PAYMENT_FEE_POLICY_MAX_LIMIT = 20;
const ADMIN_FINANCE_APPROVAL_QUEUE_DEFAULT_LIMIT = 10;
const ADMIN_FINANCE_APPROVAL_QUEUE_MAX_LIMIT = 25;
const ADMIN_PAYMENT_FEE_POLICY_DEFAULT_SAMPLE_AMOUNT = 100_000;
const ADMIN_PAYMENT_FEE_POLICY_MAX_SAMPLE_AMOUNT = 100_000_000;

const adminPaymentFeePolicyVersionSelect = {
  id: true,
  name: true,
  status: true,
  effectiveFrom: true,
  effectiveTo: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  rules: {
    orderBy: [{ method: 'asc' as const }, { createdAt: 'desc' as const }],
    select: {
      id: true,
      method: true,
      feeType: true,
      rateBps: true,
      fixedAmount: true,
      payer: true,
      treatment: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PaymentFeePolicyVersionSelect;

const adminPaymentFeePolicyApprovalRequestSelect = {
  id: true,
  action: true,
  actorId: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AdminAuditLogSelect;

const paymentFeePolicyApprovalActions = [
  'payment_fee_policy.approval_requested',
  'payment_fee_policy.approval_rejected',
  'payment_fee_policy.approval_cancelled',
] as const;

const FINANCE_APPROVAL_QUEUE_WITHDRAWAL_STATUSES = [
  ProviderWalletWithdrawalRequestStatus.REQUESTED,
  ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
  ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
  ProviderWalletWithdrawalRequestStatus.APPROVED,
  ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
  ProviderWalletWithdrawalRequestStatus.HOLD,
] as const;

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
  readonly assigneeAdminId?: string | null;
  readonly assignment?: string | null;
  readonly candidate?: string | null;
  readonly paymentMethod?: string | null;
  readonly period?: string | null;
  readonly q?: string | null;
  readonly providerProfileId?: string | null;
  readonly queue?: string | null;
  readonly range?: string | null;
  readonly reconciliation?: string | null;
  readonly review?: string | null;
  readonly skip?: number | string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
};
type AdminBankReconciliationWithdrawalCandidate = 'eligible' | 'none' | 'review' | 'strong';
type AdminBookingSettlementGapQuery = {
  readonly age?: string | null;
  readonly paymentMethod?: string | null;
  readonly period?: string | null;
  readonly q?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
  readonly track?: string | null;
};
type AdminHistoricalSettlementDryRun = NonNullable<
  Awaited<ReturnType<EarningsService['previewPaidBookingSettlementReconstruction']>>['settlementDryRun']
>;
type AdminBookingSettlementDryRunPreview = {
  readonly blockers: Array<{ code: string; message: string }>;
  readonly bookingId: string;
  readonly canRepair: boolean;
  readonly completedAt: string;
  readonly historicalSettlementDryRun: AdminHistoricalSettlementDryRun | null;
  readonly monthlyClosingStatus: MonthlyTaxClosingStatus | null;
  readonly monthlyPeriod: string;
  readonly payment: { method: PaymentMethod } | null;
};
type AdminBookingSettlementGapAge = 'all' | 'backlog' | 'recent' | '24-72h' | '3-7d' | '7d-plus';
type AdminBookingSettlementGapTrack =
  | 'all'
  | 'canonical'
  | 'historical-ready'
  | 'evidence-blocked'
  | 'manual-review';
type AdminManualWalletAdjustmentQuery = {
  readonly ownerId?: string | null;
  readonly ownerType?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};
type AdminFinanceApprovalQueueQuery = {
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
  paymentFeePolicyVersionId: true,
  paymentFeeRuleSnapshot: true,
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
const adminBookingSettlementGapListSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  customerProfile: {
    select: {
      id: true,
      user: {
        select: {
          fullName: true,
          phone: true,
        },
      },
    },
  },
  selectedProvider: {
    select: {
      id: true,
      displayName: true,
      user: {
        select: {
          fullName: true,
          phone: true,
        },
      },
    },
  },
  payment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
    },
  },
  earning: {
    select: {
      id: true,
      paidAt: true,
      payoutBatchId: true,
      status: true,
    },
  },
  _count: {
    select: {
      platformFeeLogs: true,
      services: true,
      taxLogs: true,
      walletLedgerEntries: true,
    },
  },
} satisfies Prisma.BookingSelect;
const adminBookingSettlementGapPreviewSelect = {
  id: true,
  customerProfileId: true,
  selectedProviderId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  customerProfile: {
    select: {
      id: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  selectedProvider: {
    select: {
      id: true,
      displayName: true,
      user: { select: { fullName: true, phone: true } },
    },
  },
  payment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
    },
  },
  earning: {
    select: {
      id: true,
      status: true,
      grossAmount: true,
      platformFee: true,
      withholdingAmount: true,
      netAmount: true,
      currency: true,
      paidAt: true,
      payoutBatchId: true,
    },
  },
  settlementSnapshot: { select: { id: true } },
  _count: { select: { services: true } },
} satisfies Prisma.BookingSelect;
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
const adminBookingSettlementRepairCheckpointSelect = {
  id: true,
  sourceKey: true,
  bookingId: true,
  paymentId: true,
  providerEarningId: true,
  paymentMethod: true,
  currency: true,
  customerPaymentAmount: true,
  partnerPayoutAmount: true,
  partnerWithholdingTotal: true,
  platformFeeGross: true,
  providerTaxLogIds: true,
  providerPlatformFeeLogId: true,
  providerWalletLedgerEntryIds: true,
  metadata: true,
  accountingJournalBatches: {
    orderBy: { postedAt: 'desc' },
    select: {
      id: true,
      sourceKey: true,
      sourceType: true,
      sourceId: true,
      settlementSnapshotId: true,
      status: true,
      totalDebit: true,
      totalCredit: true,
      metadata: true,
      entries: {
        select: {
          side: true,
          amount: true,
        },
      },
    },
  },
  paymentClearingEntries: {
    orderBy: { occurredAt: 'desc' },
    select: {
      id: true,
      sourceKey: true,
      type: true,
      status: true,
      paymentId: true,
      settlementSnapshotId: true,
      amount: true,
      currency: true,
    },
  },
  providerEarning: {
    select: {
      id: true,
      status: true,
      paidAt: true,
      grossAmount: true,
      netAmount: true,
      currency: true,
      platformFeeLogs: { select: { id: true } },
      taxLogs: { select: { id: true } },
      walletLedgerEntries: {
        select: {
          id: true,
          type: true,
          amount: true,
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
const adminCompanyBankTransactionDuplicateCandidateSelect = {
  id: true,
  amount: true,
  counterpartyName: true,
  occurredAt: true,
  status: true,
  transferRef: true,
} satisfies Prisma.CompanyBankTransactionSelect;
const adminCompanyBankTransactionDetailSelect = {
  ...adminCompanyBankTransactionListSelect,
  metadata: true,
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
          metadata: true,
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
const adminPartnerBankDepositHistoryInclude = {
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      user: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  },
  cashDebtAllocations: { select: { amount: true } },
} satisfies Prisma.PartnerBankDepositRequestInclude;
type AdminPartnerBankDepositHistoryRow = Prisma.PartnerBankDepositRequestGetPayload<{
  include: typeof adminPartnerBankDepositHistoryInclude;
}>;
type AdminOperatorIdentityRecord = {
  id: string;
  email: string | null;
  fullName: string | null;
};

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerWalletWithdrawalPaidByAdminId(metadata: unknown) {
  const bankPayout = recordFromUnknown(recordFromUnknown(metadata)?.bankPayout);
  return typeof bankPayout?.completedByAdminId === 'string'
    ? normalizeNullable(bankPayout.completedByAdminId)
    : null;
}

function financeApprovalAdminIdFromMetadata(metadata: unknown) {
  const record = recordFromUnknown(metadata);
  return typeof record?.approvalAdminId === 'string'
    ? normalizeNullable(record.approvalAdminId)
    : null;
}

function payoutBatchAuditStatus(metadata: unknown) {
  const record = recordFromUnknown(metadata);
  return typeof record?.status === 'string' ? normalizeNullable(record.status) : null;
}

function partnerBankDepositRequestWithOperators<
  T extends {
    requestedByAdminId: string;
    approvedByAdminId?: string | null;
    rejectedByAdminId?: string | null;
  },
>(request: T, adminsById: ReadonlyMap<string, AdminOperatorIdentityRecord>) {
  return {
    ...request,
    requestedBy: adminsById.get(request.requestedByAdminId) ?? null,
    approvedBy: request.approvedByAdminId
      ? (adminsById.get(request.approvedByAdminId) ?? null)
      : null,
    rejectedBy: request.rejectedByAdminId
      ? (adminsById.get(request.rejectedByAdminId) ?? null)
      : null,
  };
}
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

type AdminFileReviewItemListOptions = {
  kind?: string | null;
  q?: string | null;
  review?: string | null;
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
  | 'manualWalletAdjustmentRequest'
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

  async listAdminCalendarEvents(
    options: {
      from?: string | null;
      take?: number | string | null;
      to?: string | null;
    } = {},
  ) {
    const from = parseOptionalAdminCalendarDate(options.from, 'Calendar from date');
    const to = parseOptionalAdminCalendarDate(options.to, 'Calendar to date');
    const where: Prisma.AdminCalendarEventWhereInput = {};

    if (from || to) {
      where.AND = [...(from ? [{ endAt: { gte: from } }] : []), ...(to ? [{ startAt: { lte: to } }] : [])];
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

    return db.user.findFirst({
      where: {
        id: actorId,
        roles: { has: Role.ADMIN },
        ...(normalizedIdentity
          ? { OR: [{ id: normalizedIdentity }, { email: normalizedIdentity }, { phone: normalizedIdentity }] }
          : {}),
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

  async updateAdminOperatorAccess(actorId: string, userId: string, input: UpdateAdminOperatorAccessDto) {
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

  async revokeAdminOperatorAccess(actorId: string, userId: string, input: DeleteAdminOperatorAccessDto = {}) {
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

  async updateUserFinanceApproverRole(actorId: string, userId: string, input: UpdateFinanceApproverRoleDto) {
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
          action: enabled ? 'admin_user.finance_approver.grant' : 'admin_user.finance_approver.revoke',
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

  async getCustomerDetail(customerProfileId: string, options: { includeDiagnostics?: boolean } = {}) {
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

  async dashboardSummary(dateRange?: string) {
    const now = new Date();
    const liveBoundary = new Date(now.getTime() - ADMIN_APP_SESSION_LIVE_WINDOW_MS);
    const liveSessionWhere = adminAppSessionStateWhere('live') ?? {};
    const recentCustomerSessionWhere = adminAppSessionStateWhere('recent') ?? {};
    const staleCustomerSessionWhere = adminAppSessionStateWhere('stale') ?? {};
    const activeStatuses = Array.from(ADMIN_VIETNAM_ACTIVE_BOOKING_STATUSES);
    const locationStaleBoundary = new Date(now.getTime() - 30 * 60_000);
    const settlementBacklogBoundary = new Date(now.getTime() - 24 * 60 * 60_000);
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
      liveBookingStatusRows,
      customerChoiceBookings,
      expiredMatchingBookings,
      matchingWithoutParticipants,
      completedPaymentHolds,
      recentCompletedWithoutSettlement,
      backlogCompletedWithoutSettlement,
      periodBookingStatusRows,
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
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { status: { in: activeStatuses } },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          participants: {
            some: { status: { in: [ParticipantStatus.ACCEPTED, ParticipantStatus.SELECTED] } },
          },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.OPEN_MATCHING,
          expiresAt: { lte: now },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.OPEN_MATCHING,
          participants: { none: {} },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.COMPLETED,
          payment: { is: { status: PaymentStatus.AUTHORIZED } },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.COMPLETED,
          settlementSnapshot: { is: null },
          OR: [
            { closedAt: { gte: settlementBacklogBoundary } },
            { closedAt: null, updatedAt: { gte: settlementBacklogBoundary } },
          ],
        },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.COMPLETED,
          settlementSnapshot: { is: null },
          OR: [
            { closedAt: { lt: settlementBacklogBoundary } },
            { closedAt: null, updatedAt: { lt: settlementBacklogBoundary } },
          ],
        },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: adminBookingListDateWhere({ dateRange }),
      }),
    ]);
    const bookingCustomerRow = bookingCustomerRows[0];
    const partnerStatusCounts = new Map(partnerStatusRows.map((row) => [row.status, row._count._all]));
    const onlineAvailable = partnerStatusCounts.get(ProviderStatus.ONLINE_AVAILABLE) ?? 0;
    const onlineBusy = partnerStatusCounts.get(ProviderStatus.ONLINE_BUSY) ?? 0;
    const onlineAvailableSoon = partnerStatusCounts.get(ProviderStatus.ONLINE_AVAILABLE_SOON) ?? 0;
    const offline = partnerStatusCounts.get(ProviderStatus.OFFLINE) ?? 0;
    const online = onlineAvailable + onlineBusy + onlineAvailableSoon;
    const liveBookingStatusCounts = new Map(
      liveBookingStatusRows.map((row) => [row.status, row._count._all]),
    );
    const periodBookingStatusCounts = new Map(
      periodBookingStatusRows.map((row) => [row.status, row._count._all]),
    );
    const activeDemandBookings = Array.from(liveBookingStatusCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const periodBookingTotal = Array.from(periodBookingStatusCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

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
      bookingActivity: {
        live: {
          active: activeDemandBookings,
          arrived: liveBookingStatusCounts.get(BookingStatus.ARRIVED) ?? 0,
          customerChoice: customerChoiceBookings,
          inService: liveBookingStatusCounts.get(BookingStatus.IN_SERVICE) ?? 0,
          matched: liveBookingStatusCounts.get(BookingStatus.MATCHED) ?? 0,
          onTheWay: liveBookingStatusCounts.get(BookingStatus.PROVIDER_ON_THE_WAY) ?? 0,
          openMatching: liveBookingStatusCounts.get(BookingStatus.OPEN_MATCHING) ?? 0,
        },
        period: {
          cancelled: periodBookingStatusCounts.get(BookingStatus.CANCELLED) ?? 0,
          completed: periodBookingStatusCounts.get(BookingStatus.COMPLETED) ?? 0,
          expired: periodBookingStatusCounts.get(BookingStatus.EXPIRED) ?? 0,
          noShow: periodBookingStatusCounts.get(BookingStatus.NO_SHOW) ?? 0,
          refunded: periodBookingStatusCounts.get(BookingStatus.REFUNDED) ?? 0,
          total: periodBookingTotal,
        },
      },
      actionQueue: {
        completedPaymentHolds,
        completedWithoutSettlement: recentCompletedWithoutSettlement + backlogCompletedWithoutSettlement,
        completedWithoutSettlementBacklog: backlogCompletedWithoutSettlement,
        completedWithoutSettlementRecent: recentCompletedWithoutSettlement,
        customerChoice: customerChoiceBookings,
        matchingExpired: expiredMatchingBookings,
        matchingWithoutParticipants,
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
      const partnerPointOccurredAt = latestDate(lastProviderSeenAt, provider.currentLocationUpdatedAt, now);
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
      status: {
        in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
      },
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
          lastActivityAt:
            latestDate(
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
            secondary: service ? `${service.durationMin} min${service.active ? '' : ' · inactive'}` : null,
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
            secondary:
              [lowestRating ? `Lowest ${lowestRating}/5` : null, profile?.user.phone ?? null]
                .filter(Boolean)
                .join(' · ') || null,
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
    const cancellationStatuses = [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED];
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
          partnerOverviewProviderEligible(
            provider,
            walletBalanceByProvider.get(provider.id),
            locationFreshBoundary,
          ),
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
    const averageResponseSecondsByProvider =
      partnerOverviewAverageResponseSecondsByProvider(areaResponseRows);
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
    const walletBalanceTotal = Array.from(walletBalanceByProvider.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );
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
        partnerOverviewKpi(
          'approvedPartners',
          'Approved Partners',
          approvedPartners,
          'Admin-approved public supply',
        ),
        partnerOverviewKpi(
          'pendingVerification',
          'Pending Verification',
          pendingVerification,
          'Needs approval work',
        ),
        partnerOverviewKpi('onlineNow', 'Online Now', onlineNow, 'Ready, busy, or soon-online Partners'),
        partnerOverviewKpi(
          'locationFreshPartners',
          'Location Fresh Partners',
          locationFreshPartners,
          'Updated in 30 min',
        ),
        partnerOverviewKpi(
          'eligibleToAccept',
          'Eligible To Accept',
          eligibleProviderIds.size,
          'Can accept a booking now',
        ),
        partnerOverviewKpi(
          'activePartners7D',
          'Active Partners 7D',
          activePartners7d,
          'Online or booking activity',
        ),
        partnerOverviewKpi(
          'inactivePartners7D',
          'Inactive Partners 7D',
          inactivePartners7d,
          'Approved with no 7D signal',
        ),
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
          [
            'Profile Completed',
            providerRows.filter((provider) => Boolean(provider.displayName && provider.city)).length,
          ],
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
            partnerFacts.filter(
              (fact) => fact.completedBookings >= 3 || fact.status !== ProviderStatus.OFFLINE,
            ).length,
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
          partnerOverviewKpi(
            'grossBookingAmount',
            'Partner Gross Booking Amount',
            grossBookingAmount,
            'From earnings',
            'money',
          ),
          partnerOverviewKpi(
            'platformFee',
            'Platform Fee',
            platformFee,
            'Company revenue component',
            'money',
          ),
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
          partnerOverviewKpi(
            'partnerWalletBalanceTotal',
            'Partner Wallet Balance Total',
            walletBalanceTotal,
            'Ledger sum',
            'money',
          ),
          partnerOverviewKpi(
            'negativeWalletTotal',
            'Negative Wallet Total',
            negativeWalletTotal,
            'Company receivable',
            'money',
          ),
          partnerOverviewKpi(
            'partnersWithNegativeWallet',
            'Partners With Negative Wallet',
            negativeWalletFacts.length,
            'Receivable partners',
          ),
          partnerOverviewKpi(
            'payoutBlockedPartners',
            'Payout Blocked Partners',
            negativeWalletFacts.length,
            'Policy display only',
          ),
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

  async listFileReviewItems(options: AdminFileReviewItemListOptions = {}) {
    const skip = boundedAdminListSkip(options.skip);
    const take = boundedAdminListLimit(options.take, ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT);
    const where = adminFileReviewItemWhere(options);
    const [files, totalCount] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(skip > 0 ? { skip } : {}),
        take,
        select: adminFileReviewItemSelect,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      rows: files.flatMap((file) => {
        const partner =
          file.providerVerification?.providerProfile ?? file.owner?.providerProfile ?? null;
        if (!partner) {
          return [];
        }
        const kind = file.providerVerificationId ? 'private-verification' : 'public-media';
        return [
          {
            contentType: file.contentType,
            createdAt: file.createdAt,
            id: file.id,
            key: file.key,
            kind,
            partner: {
              displayName: partner.displayName,
              id: partner.id,
              status: partner.status,
              userId: partner.user.id,
              userFullName: partner.user.fullName,
              userPhone: partner.user.phone,
            },
            purpose: file.purpose,
            reviewReason: file.reviewReason,
            reviewStatus: file.reviewStatus,
            sizeBytes: file.sizeBytes,
            uploadedAt: file.uploadedAt,
            uploadStatus: file.uploadStatus,
            url: kind === 'public-media' ? file.url : null,
            visibility: file.visibility,
          },
        ];
      }),
      totalCount,
    };
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

  async getProviderDetail(providerProfileId: string, options: { includeDiagnostics?: boolean } = {}) {
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
    const sharedDeviceMatchesPromise =
      includeDiagnostics && deviceIds.length
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
    const payoutBatchesWithOperatorsPromise = this.withPayoutBatchOperators(
      provider.payoutBatches ?? [],
    );

    const [sharedDeviceMatches, auditLogs, payoutBatches] = await Promise.all([
      sharedDeviceMatchesPromise,
      auditLogsPromise,
      payoutBatchesWithOperatorsPromise,
    ]);

    return { ...provider, payoutBatches, sharedDeviceMatches, auditLogs };
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
        await transitionPaymentStatus(tx, {
          data: { status: PaymentStatus.RELEASED },
          fromStatuses: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
          paymentId: booking.payment.id,
          targetStatus: PaymentStatus.RELEASED,
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
        payment: { select: { id: true, method: true, status: true } },
      },
    });

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be closed out as completed`);
    }
    if (!booking.selectedProviderId) {
      throw new BadRequestException('Completed booking requires a selected partner before closeout');
    }

    const capturedPayment = booking.payment
      ? (
          await transitionPaymentStatus(this.prisma, {
            data: { status: PaymentStatus.CAPTURED },
            fromStatuses: paymentCaptureSourceStatuses(booking.payment.method),
            paymentId: booking.payment.id,
            targetStatus: PaymentStatus.CAPTURED,
          })
        ).payment
      : null;

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
      generatedAt: new Date().toISOString(),
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
      completedCount,
      generatedAt: new Date().toISOString(),
      needsUpdateCount,
      openCount,
      outcomeLinkedCount,
      refundedBookingCount,
      requestedCount,
      totalCount,
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
      bankWithdrawalCandidateSummary,
      monthlyClosingSummary,
      earningsSummary,
      paymentSummary,
      refundSummary,
      cashSummary,
      paymentFeeSummary,
      walletSummary,
      amountSummary,
      financeReviewSlaSummary,
    ] = await Promise.all([
      this.bookingSettlementSnapshotSummary(rangeOptions),
      this.couponFinanceSummary(rangeOptions),
      this.partnerWithholdingTaxSummary(periodOptions),
      this.providerWalletWithdrawalRequestSummary(rangeOptions),
      this.bookingPaymentClearingSummary(clearingOptions),
      this.bankReconciliationSummary(bankOptions),
      this.bankReconciliationWithdrawalCandidateSummary(rangeOptions),
      this.monthlyTaxClosingSummary(periodOptions),
      this.earningsSummary(rangeOptions),
      this.paymentSummary(rangeOptions),
      this.refundSummary(rangeOptions),
      this.cashSettlementSummary(rangeOptions),
      this.paymentFeeSummary(periodOptions),
      this.financeOverviewWalletSummary(),
      this.financeOverviewAmountSummary(rangeOptions),
      this.financeOverviewReviewSlaSummary(rangeOptions),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range: normalizeNullable(options.range) ?? 'today',
      period,
      amountSummary,
      bankSummary,
      bankWithdrawalCandidateSummary,
      cashSummary,
      clearingSummary,
      couponSummary,
      earningsSummary,
      financeReviewSlaSummary,
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

  private async financeOverviewReviewSlaSummary(
    options: Pick<AdminPaymentOperationsQuery, 'range'>,
  ) {
    const over72Before = new Date(Date.now() - 72 * 60 * 60_000);
    const resolvedAt = adminPaymentDateRangeWhere(options.range);
    const [openRows, resolvedInRangeCount] = await Promise.all([
      this.prisma.$queryRaw<Array<{ openOverdueCount: bigint; openOver72Count: bigint }>>(
        Prisma.sql`
          SELECT
            COUNT(*)::bigint AS "openOverdueCount",
            COUNT(*) FILTER (
              WHERE COALESCE(
                assignment."createdAt",
                batch_import."createdAt",
                notification."createdAt"
              ) <= ${over72Before}
            )::bigint AS "openOver72Count"
          FROM "Notification" notification
          LEFT JOIN "AdminAuditLog" assignment
            ON notification."type" = 'admin.finance.bank_transaction.review_escalated'
            AND assignment."id" = notification."data"->>'assignmentAuditLogId'
          LEFT JOIN LATERAL (
            SELECT logs."createdAt"
            FROM "AdminAuditLog" logs
            WHERE notification."type" = 'admin.finance.bank_statement_batch.escalated'
              AND logs."action" = ${COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION}
              AND COALESCE(
                logs."metadata"->>'batchImportId',
                REPLACE(logs."target", 'company_bank_transaction_batch:', '')
              ) = notification."data"->>'batchImportId'
            ORDER BY logs."createdAt" ASC, logs."id" ASC
            LIMIT 1
          ) batch_import ON TRUE
          WHERE notification."type" IN (
            'admin.finance.bank_statement_batch.escalated',
            'admin.finance.bank_transaction.review_escalated'
          )
            AND COALESCE(notification."data"->>'financeReviewStatus', 'OPEN') <> 'RESOLVED'
        `,
      ),
      this.prisma.adminAuditLog.count({
        where: {
          action: COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_RESOLVED_ACTION,
          ...(resolvedAt ? { createdAt: resolvedAt } : {}),
        },
      }),
    ]);
    const openOverdueCount = Number(openRows[0]?.openOverdueCount ?? 0);
    const openOver72Count = Math.min(
      openOverdueCount,
      Number(openRows[0]?.openOver72Count ?? 0),
    );

    return {
      open48To72Count: Math.max(0, openOverdueCount - openOver72Count),
      openOverdueCount,
      openOver72Count,
      resolvedInRangeCount,
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
    const completedRefundWhere = refundWhere
      ? { ...refundWhere, status: 'COMPLETED' }
      : { status: 'COMPLETED' };
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

  async listBookingSettlementGaps(options: AdminBookingSettlementGapQuery = {}) {
    const generatedAt = new Date();
    const where = adminBookingSettlementGapWhere(options, generatedAt);
    const skip = boundedAdminListSkip(options.skip);
    const take = adminBookingSettlementGapTake(options.take);
    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        ...(skip > 0 ? { skip } : {}),
        take,
        select: adminBookingSettlementGapListSelect,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      generatedAt: generatedAt.toISOString(),
      hasNext: skip + rows.length < total,
      items: rows.map((row) => {
        const gapAt = row.closedAt ?? row.updatedAt;
        return {
          ageBucket: adminBookingSettlementGapAgeBucket(gapAt, generatedAt),
          closedAt: row.closedAt,
          createdAt: row.createdAt,
          customerProfile: row.customerProfile,
          earning: row.earning ? { id: row.earning.id, status: row.earning.status } : null,
          gapAt: gapAt.toISOString(),
          id: row.id,
          payment: row.payment,
          repairTrack: adminBookingSettlementGapRepairTrackFromRow(row),
          selectedProvider: row.selectedProvider,
          status: row.status,
          updatedAt: row.updatedAt,
        };
      }),
      skip,
      take,
      total,
    };
  }

  async bookingSettlementGapSummary() {
    const generatedAt = new Date();
    const baseWhere = adminBookingSettlementGapWhere({ age: 'all' }, generatedAt);
    const [
      recent,
      age24To72Hours,
      age3To7Days,
      age7DaysPlus,
      canonical,
      historicalReady,
      evidenceBlocked,
      manualReview,
      oldestClosed,
      oldestWithoutClose,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: 'recent' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: '24-72h' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: '3-7d' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: '7d-plus' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: 'all', track: 'canonical' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: 'all', track: 'historical-ready' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: 'all', track: 'evidence-blocked' }, generatedAt),
      }),
      this.prisma.booking.count({
        where: adminBookingSettlementGapWhere({ age: 'all', track: 'manual-review' }, generatedAt),
      }),
      this.prisma.booking.findFirst({
        where: { AND: [baseWhere, { closedAt: { not: null } }] },
        orderBy: { closedAt: 'asc' },
        select: { closedAt: true, updatedAt: true },
      }),
      this.prisma.booking.findFirst({
        where: { AND: [baseWhere, { closedAt: null }] },
        orderBy: { updatedAt: 'asc' },
        select: { closedAt: true, updatedAt: true },
      }),
    ]);
    const backlog = age24To72Hours + age3To7Days + age7DaysPlus;
    const oldestCandidates = [oldestClosed?.closedAt ?? null, oldestWithoutClose?.updatedAt ?? null].filter(
      (value): value is Date => value instanceof Date,
    );
    const oldestGapAt = oldestCandidates.length
      ? new Date(Math.min(...oldestCandidates.map((value) => value.getTime()))).toISOString()
      : null;

    return {
      age24To72Hours,
      age3To7Days,
      age7DaysPlus,
      backlog,
      canonical,
      evidenceBlocked,
      generatedAt: generatedAt.toISOString(),
      historicalReady,
      manualReview,
      oldestGapAt,
      recent,
      total: recent + backlog,
    };
  }

  async bookingSettlementGapDryRun(options: AdminBookingSettlementGapQuery = {}) {
    const generatedAt = new Date();
    const take = adminBoundedPositiveInteger(
      options.take,
      ADMIN_BOOKING_SETTLEMENT_DRY_RUN_DEFAULT_LIMIT,
      ADMIN_BOOKING_SETTLEMENT_DRY_RUN_MAX_LIMIT,
    );
    const where = adminBookingSettlementGapWhere(
      {
        age: 'all',
        paymentMethod: options.paymentMethod,
        period: options.period,
        track: 'historical-ready',
      },
      generatedAt,
    );
    const [rows, totalMatched] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
        take,
      }),
      this.prisma.booking.count({ where }),
    ]);
    const previews: Awaited<ReturnType<AdminService['previewBookingSettlementGapRepair']>>[] = [];
    for (let index = 0; index < rows.length; index += ADMIN_BOOKING_SETTLEMENT_DRY_RUN_CONCURRENCY) {
      previews.push(
        ...(await Promise.all(
          rows
            .slice(index, index + ADMIN_BOOKING_SETTLEMENT_DRY_RUN_CONCURRENCY)
            .map((row) => this.previewBookingSettlementGapRepair(row.id)),
        )),
      );
    }

    const items = previews.map((preview) => adminBookingSettlementDryRunItem(preview));
    const counts = adminBookingSettlementDryRunCounts(items);
    return {
      counts,
      evaluated: items.length,
      generatedAt: generatedAt.toISOString(),
      items,
      paymentMethods: adminCountBy(items, (item) => item.paymentMethod ?? 'UNKNOWN'),
      policyGate: adminBookingSettlementDryRunPolicyGate(counts),
      periodStatuses: adminCountBy(items, (item) => item.monthlyClosingStatus ?? 'OPEN_OR_UNLINKED'),
      recoveryBatches: adminBookingSettlementDryRunBatches(items),
      blockerCodes: adminCountBy(
        items.flatMap((item) => item.blockers),
        (blocker) => blocker.code,
      ),
      totalMatched,
      totals: adminBookingSettlementDryRunTotals(items),
      truncated: totalMatched > items.length,
    };
  }

  async previewBookingSettlementGapRepair(bookingId: string) {
    const normalizedBookingId = normalizeNullable(bookingId);
    if (!normalizedBookingId) {
      throw new BadRequestException('Booking id is required');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: normalizedBookingId },
      select: adminBookingSettlementGapPreviewSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const occurredAt = booking.closedAt ?? booking.updatedAt;
    const currency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';
    const monthlyPeriod = settlementMonthlyPeriod(occurredAt);
    const monthlyClosing = await this.prisma.monthlyTaxClosing.findUnique({
      where: { period_currency: { period: monthlyPeriod, currency } },
      select: { status: true },
    });
    const blockers: Array<{ code: string; message: string }> = [];
    let repairMode = 'CANONICAL_COMPLETION_SETTLEMENT';
    let historicalEvidenceSummary: {
      platformFeeLogCount: number;
      taxLogCount: number;
      walletLedgerEntryCount: number;
    } | null = null;
    let historicalSettlementDryRun: Awaited<
      ReturnType<EarningsService['previewPaidBookingSettlementReconstruction']>
    >['settlementDryRun'] = null;

    if (booking.status !== BookingStatus.COMPLETED) {
      blockers.push({ code: 'BOOKING_NOT_COMPLETED', message: 'Booking is not completed.' });
    }
    if (!booking.selectedProviderId || !booking.selectedProvider) {
      blockers.push({ code: 'PARTNER_MISSING', message: 'Selected Partner evidence is missing.' });
    }
    if (booking._count.services === 0) {
      blockers.push({ code: 'SERVICE_EVIDENCE_MISSING', message: 'Booking service evidence is missing.' });
    }
    if (!booking.payment) {
      blockers.push({ code: 'PAYMENT_MISSING', message: 'Payment evidence is missing.' });
    } else if (booking.payment.status !== PaymentStatus.CAPTURED) {
      blockers.push({
        code: 'PAYMENT_NOT_CAPTURED',
        message: `Payment status ${booking.payment.status} is not eligible for settlement repair.`,
      });
    }
    if (booking.settlementSnapshot) {
      blockers.push({ code: 'SETTLEMENT_EXISTS', message: 'A settlement snapshot already exists.' });
    }
    if (booking.earning?.status === EarningStatus.PAID && booking.selectedProviderId) {
      repairMode = 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION';
      const historicalAnalysis = await this.earnings.previewPaidBookingSettlementReconstruction(
        booking.id,
        booking.selectedProviderId,
      );
      historicalEvidenceSummary = historicalAnalysis.evidenceSummary;
      historicalSettlementDryRun = historicalAnalysis.settlementDryRun;
      historicalAnalysis.blockers.forEach((blocker) => {
        if (!blockers.some((existing) => existing.code === blocker.code)) {
          blockers.push(blocker);
        }
      });
    } else if (booking.earning?.status === EarningStatus.CANCELLED || booking.earning?.payoutBatchId) {
      blockers.push({
        code: 'EARNING_LOCKED',
        message: 'Cancelled or payout-batched earnings require manual finance review.',
      });
    }
    if (
      monthlyClosing?.status === MonthlyTaxClosingStatus.DECLARED ||
      monthlyClosing?.status === MonthlyTaxClosingStatus.PAID ||
      monthlyClosing?.status === MonthlyTaxClosingStatus.CLOSED
    ) {
      blockers.push({
        code: 'MONTHLY_PERIOD_FINALIZED',
        message: `Monthly period ${monthlyPeriod} is ${monthlyClosing.status} and cannot be repaired directly.`,
      });
    }

    return {
      bookingId: booking.id,
      canRepair: blockers.length === 0,
      blockers,
      bookingStatus: booking.status,
      completedAt: occurredAt.toISOString(),
      currency,
      monthlyPeriod,
      monthlyClosingStatus: monthlyClosing?.status ?? null,
      customer: booking.customerProfile,
      partner: booking.selectedProvider,
      payment: booking.payment,
      earning: booking.earning,
      historicalEvidenceSummary,
      historicalSettlementDryRun,
      settlementSnapshotId: booking.settlementSnapshot?.id ?? null,
      serviceCount: booking._count.services,
      repairMode,
      preservesExistingEarningLifecycle: true,
    };
  }

  async repairBookingSettlementGap(actorId: string, bookingId: string, input: RepairBookingSettlementGapDto) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Booking settlement repair',
    );
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Booking settlement repair');

    const preview = await this.previewBookingSettlementGapRepair(bookingId);
    if (!preview.canRepair || !preview.partner?.id) {
      const reason = preview.blockers.map((blocker) => blocker.message).join(' ');
      throw new BadRequestException(reason || 'Booking settlement repair is not eligible.');
    }

    await this.writeAudit(
      actorId,
      'booking_settlement_gap.repair_requested',
      `booking:${preview.bookingId}`,
      {
        approvalAdminId,
        monthlyPeriod: preview.monthlyPeriod,
        reason: input.reason,
        repairMode: preview.repairMode,
      },
    );

    const repairResult =
      preview.repairMode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION'
        ? await this.earnings.reconstructPaidBookingSettlement(preview.bookingId, preview.partner.id, {
            actorId,
            approvalAdminId,
            reason: input.reason,
          })
        : {
            earningId: (
              await this.earnings.createForCompletedBooking(preview.bookingId, preview.partner.id, {
                preserveExistingLifecycle: true,
              })
            ).id,
          };
    const settlementSnapshot = await this.prisma.bookingSettlementSnapshot.findUnique({
      where: { bookingId: preview.bookingId },
      select: { id: true, sourceKey: true, monthlyPeriod: true },
    });
    if (!settlementSnapshot) {
      throw new BadRequestException(
        'Settlement repair completed without a settlement snapshot. Review API wiring.',
      );
    }

    let checkpoint;
    try {
      checkpoint = await this.verifyBookingSettlementRepair(preview.bookingId);
    } catch {
      checkpoint = {
        blockingFailures: ['CHECKPOINT_UNAVAILABLE'],
        bookingId: preview.bookingId,
        checkedAt: new Date(),
        checks: [
          {
            code: 'CHECKPOINT_UNAVAILABLE',
            message: 'The repair was recorded, but the post-repair accounting checkpoint could not be read.',
            passed: false,
          },
        ],
        passed: false,
        repairMode: preview.repairMode,
        snapshotId: settlementSnapshot.id,
        status: 'FAILED' as const,
      };
    }

    const auditLog = await this.writeAudit(
      actorId,
      preview.repairMode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION'
        ? 'booking_settlement_gap.historical_reconstructed'
        : 'booking_settlement_gap.repaired',
      `booking:${preview.bookingId}`,
      {
        approvalAdminId,
        checkpointBlockingFailures: checkpoint.blockingFailures,
        checkpointStatus: checkpoint.status,
        earningId: repairResult.earningId,
        monthlyPeriod: settlementSnapshot.monthlyPeriod,
        reason: input.reason,
        repairMode: preview.repairMode,
        settlementSnapshotId: settlementSnapshot.id,
        settlementSourceKey: settlementSnapshot.sourceKey,
      },
    );

    return {
      approvalAdminId,
      auditLogId: auditLog.id,
      bookingId: preview.bookingId,
      checkpoint,
      earningId: repairResult.earningId,
      repairMode: preview.repairMode,
      repaired: true,
      settlementSnapshotId: settlementSnapshot.id,
    };
  }

  async verifyBookingSettlementRepair(bookingId: string) {
    const checkedAt = new Date();
    const snapshot = await this.prisma.bookingSettlementSnapshot.findUnique({
      where: { bookingId },
      select: adminBookingSettlementRepairCheckpointSelect,
    });
    if (!snapshot) {
      const checks = [
        {
          code: 'SNAPSHOT_PRESENT',
          message: 'No settlement snapshot exists for this booking.',
          passed: false,
        },
      ];
      return {
        blockingFailures: checks.map((check) => check.code),
        bookingId,
        checkedAt,
        checks,
        passed: false,
        repairMode: null,
        snapshotId: null,
        status: 'FAILED' as const,
      };
    }

    const checks: Array<{
      actual?: number | string | null;
      code: string;
      expected?: number | string | null;
      message: string;
      passed: boolean;
    }> = [];
    const addCheck = (
      code: string,
      passed: boolean,
      message: string,
      expected?: number | string | null,
      actual?: number | string | null,
    ) => checks.push({ code, passed, message, ...(expected !== undefined ? { expected } : {}), ...(actual !== undefined ? { actual } : {}) });
    const metadata = adminJsonObject(snapshot.metadata);
    const historicalReconstruction = metadata?.historicalReconstruction === true;
    const journal = snapshot.accountingJournalBatches[0] ?? null;
    const journalEntryDebit =
      journal?.entries
        .filter((entry) => entry.side === AccountingJournalEntrySide.DEBIT)
        .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const journalEntryCredit =
      journal?.entries
        .filter((entry) => entry.side === AccountingJournalEntrySide.CREDIT)
        .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const journalMetadata = adminJsonObject(journal?.metadata);
    const reconciliationDelta =
      typeof journalMetadata?.reconciliationDelta === 'number'
        ? journalMetadata.reconciliationDelta
        : null;

    addCheck(
      'SNAPSHOT_LINKED',
      snapshot.sourceKey === `booking-settlement:${bookingId}`,
      'Settlement snapshot is linked to the canonical booking source key.',
      `booking-settlement:${bookingId}`,
      snapshot.sourceKey,
    );
    addCheck(
      'SINGLE_SETTLEMENT_JOURNAL',
      snapshot.accountingJournalBatches.length === 1,
      'Exactly one accounting journal batch is linked to the settlement snapshot.',
      1,
      snapshot.accountingJournalBatches.length,
    );
    addCheck(
      'JOURNAL_POSTED',
      Boolean(
        journal &&
          journal.status === AccountingJournalBatchStatus.POSTED &&
          journal.sourceType === AccountingJournalSourceType.BOOKING_SETTLEMENT &&
          journal.sourceId === snapshot.id &&
          journal.settlementSnapshotId === snapshot.id &&
          journal.sourceKey === `accounting-journal:booking-settlement:${bookingId}`,
      ),
      'The linked journal is a posted booking settlement journal.',
    );
    addCheck(
      'JOURNAL_BALANCED',
      Boolean(journal && journal.totalDebit === journal.totalCredit),
      'Journal batch debit and credit totals are balanced.',
      journal?.totalDebit ?? null,
      journal?.totalCredit ?? null,
    );
    addCheck(
      'JOURNAL_ENTRY_TOTALS_MATCH',
      Boolean(
        journal &&
          journalEntryDebit === journal.totalDebit &&
          journalEntryCredit === journal.totalCredit,
      ),
      'Journal entry sums match the persisted batch totals.',
      journal ? `${journal.totalDebit}/${journal.totalCredit}` : null,
      `${journalEntryDebit}/${journalEntryCredit}`,
    );
    addCheck(
      'RECONCILIATION_DELTA_ZERO',
      reconciliationDelta === 0,
      'Journal reconciliation delta is explicitly zero.',
      0,
      reconciliationDelta,
    );

    const expectsClearing =
      snapshot.paymentMethod !== PaymentMethod.CASH &&
      snapshot.paymentMethod !== PaymentMethod.CUSTOMER_WALLET;
    const clearing = snapshot.paymentClearingEntries[0] ?? null;
    const validClearing = Boolean(
      clearing &&
        clearing.sourceKey === `booking-payment-clearing:${bookingId}:settlement` &&
        clearing.type === BookingPaymentClearingEntryType.SETTLEMENT_POSTED &&
        clearing.status !== BookingPaymentClearingStatus.REVERSED &&
        clearing.paymentId === snapshot.paymentId &&
        clearing.settlementSnapshotId === snapshot.id &&
        clearing.amount === snapshot.customerPaymentAmount &&
        clearing.currency === snapshot.currency,
    );
    addCheck(
      'PAYMENT_CLEARING_EXPECTATION',
      expectsClearing
        ? snapshot.paymentClearingEntries.length === 1 && validClearing
        : snapshot.paymentClearingEntries.length === 0,
      expectsClearing
        ? 'External payment settlement has one matching clearing entry.'
        : 'Cash and customer-wallet settlements do not create an external clearing entry.',
      expectsClearing ? 1 : 0,
      snapshot.paymentClearingEntries.length,
    );

    const earning = snapshot.providerEarning;
    addCheck(
      'EARNING_LINKED',
      Boolean(earning && snapshot.providerEarningId === earning.id),
      'Settlement snapshot is linked to the booking earning.',
      snapshot.providerEarningId,
      earning?.id ?? null,
    );

    if (historicalReconstruction) {
      const expectedGrossAmount =
        snapshot.partnerPayoutAmount + snapshot.partnerWithholdingTotal + snapshot.platformFeeGross;
      const platformFeeLogIds = new Set(earning?.platformFeeLogs.map((row) => row.id) ?? []);
      const taxLogIds = new Set(earning?.taxLogs.map((row) => row.id) ?? []);
      const walletEntries = earning?.walletLedgerEntries ?? [];
      const walletEntryIds = new Set(walletEntries.map((row) => row.id));
      const retainedTaxLogIds = adminJsonStringArray(snapshot.providerTaxLogIds);
      const retainedWalletEntryIds = adminJsonStringArray(snapshot.providerWalletLedgerEntryIds);
      const paidWalletLifecyclePresent = Boolean(
        earning &&
          (earning.netAmount === 0 ||
            (walletEntries.some(
              (entry) =>
                entry.type === ProviderWalletLedgerType.BOOKING_EARNING &&
                entry.amount === earning.netAmount,
            ) &&
              walletEntries.some(
                (entry) =>
                  (entry.type === ProviderWalletLedgerType.PAYOUT_PAID ||
                    entry.type === ProviderWalletLedgerType.CASH_FEE_DEBT_SETTLED) &&
                  entry.amount === -earning.netAmount,
              ))),
      );

      addCheck(
        'PAID_EARNING_PRESERVED',
        Boolean(earning?.status === EarningStatus.PAID && earning.paidAt),
        'Historical reconstruction preserves the paid earning lifecycle.',
      );
      addCheck(
        'HISTORICAL_AMOUNTS_RECONCILE',
        Boolean(
          earning &&
            earning.grossAmount === expectedGrossAmount &&
            earning.currency === snapshot.currency,
        ),
        'Historical settlement amounts reconcile to the retained earning.',
        `${expectedGrossAmount} ${snapshot.currency}`,
        earning ? `${earning.grossAmount} ${earning.currency}` : null,
      );
      addCheck(
        'PLATFORM_FEE_EVIDENCE_PRESERVED',
        Boolean(
          snapshot.providerPlatformFeeLogId &&
            platformFeeLogIds.has(snapshot.providerPlatformFeeLogId),
        ),
        'The retained platform fee log is still linked to the earning.',
      );
      addCheck(
        'TAX_EVIDENCE_PRESERVED',
        retainedTaxLogIds.length > 0 && retainedTaxLogIds.every((id) => taxLogIds.has(id)),
        'All retained Partner tax logs still exist on the earning.',
        retainedTaxLogIds.length,
        retainedTaxLogIds.filter((id) => taxLogIds.has(id)).length,
      );
      addCheck(
        'WALLET_EVIDENCE_PRESERVED',
        retainedWalletEntryIds.every((id) => walletEntryIds.has(id)),
        'All retained Partner wallet ledger evidence still exists.',
        retainedWalletEntryIds.length,
        retainedWalletEntryIds.filter((id) => walletEntryIds.has(id)).length,
      );
      addCheck(
        'PAID_WALLET_LIFECYCLE_RECONCILES',
        paidWalletLifecyclePresent,
        'Paid booking earning and payout/debt-settlement ledger entries offset the retained net amount.',
      );
    }

    const blockingFailures = checks.filter((check) => !check.passed).map((check) => check.code);
    return {
      blockingFailures,
      bookingId,
      checkedAt,
      checks,
      passed: blockingFailures.length === 0,
      repairMode: historicalReconstruction
        ? ('HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION' as const)
        : ('CANONICAL_COMPLETION_SETTLEMENT' as const),
      snapshotId: snapshot.id,
      status: blockingFailures.length === 0 ? ('PASSED' as const) : ('FAILED' as const),
    };
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

  async createCompanyBankAccount(actorId: string, input: CreateCompanyBankAccountDto) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Company bank account create',
    );
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Company bank account create');
    const account = normalizeCompanyBankAccountIdentity(input);
    const operatorReason = input.operatorReason.trim();
    const duplicate = await this.prisma.companyBankAccount.findFirst({
      where: {
        accountNumberLast4: account.accountNumberLast4,
        bankName: { equals: account.bankName, mode: 'insensitive' },
        currency: account.currency,
        status: { not: CompanyBankAccountStatus.DISABLED },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('A company bank account with the same bank, currency, and last four digits already exists');
    }

    const created = await this.prisma.companyBankAccount.create({
      data: {
        ...account,
        metadata: toJson({
          approvalAdminId,
          createdByAdminId: actorId,
          operatorReason,
        }),
        status: CompanyBankAccountStatus.ACTIVE,
      },
      select: adminCompanyBankAccountSelect,
    });
    await this.writeAudit(actorId, 'company_bank_account.create', `company_bank_account:${created.id}`, {
      approvalAdminId,
      bankName: account.bankName,
      currency: account.currency,
      operatorReason,
      status: created.status,
    });
    return created;
  }

  async updateCompanyBankAccount(actorId: string, id: string, input: UpdateCompanyBankAccountDto) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Company bank account update',
    );
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Company bank account update');
    const accountId = normalizeRequiredId(id, 'Company bank account id');
    const existing = await this.prisma.companyBankAccount.findUnique({
      where: { id: accountId },
      select: {
        ...adminCompanyBankAccountSelect,
        metadata: true,
        updatedAt: true,
        _count: { select: { transactions: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Company bank account not found');
    }

    const nextName = normalizeNullable(input.name ?? existing.name);
    if (!nextName) {
      throw new BadRequestException('Company bank account name is required');
    }
    const identityInputProvided =
      input.accountNumberLast4 !== undefined ||
      input.accountNumberMasked !== undefined ||
      input.bankName !== undefined ||
      input.currency !== undefined;
    const nextIdentity = identityInputProvided
      ? normalizeCompanyBankAccountIdentity({
          accountNumberLast4: input.accountNumberLast4 ?? existing.accountNumberLast4 ?? '',
          accountNumberMasked:
            input.accountNumberMasked === undefined ? existing.accountNumberMasked : input.accountNumberMasked,
          bankName: input.bankName ?? existing.bankName,
          currency: input.currency ?? existing.currency,
          name: nextName,
        })
      : {
          accountNumberLast4: existing.accountNumberLast4,
          accountNumberMasked: existing.accountNumberMasked,
          bankName: existing.bankName,
          currency: existing.currency,
          name: nextName,
        };
    const nextStatus = input.status ?? existing.status;
    const identityChanged =
      nextIdentity.accountNumberLast4 !== existing.accountNumberLast4 ||
      nextIdentity.accountNumberMasked !== existing.accountNumberMasked ||
      nextIdentity.bankName !== existing.bankName ||
      nextIdentity.currency !== existing.currency;
    if (identityChanged && existing._count.transactions > 0) {
      throw new BadRequestException(
        'Bank identity and currency cannot be changed after transactions exist; create a replacement account instead',
      );
    }
    const changed =
      identityChanged ||
      nextIdentity.name !== existing.name ||
      nextStatus !== existing.status;
    if (!changed) {
      throw new BadRequestException('Company bank account update did not change any managed field');
    }

    const operatorReason = input.operatorReason.trim();
    const updated = await this.prisma.companyBankAccount.updateMany({
      where: { id: accountId, updatedAt: existing.updatedAt },
      data: {
        ...nextIdentity,
        metadata: toJson({
          ...(adminJsonObject(existing.metadata) ?? {}),
          lastApprovalAdminId: approvalAdminId,
          lastOperatorReason: operatorReason,
          lastUpdatedByAdminId: actorId,
        }),
        status: nextStatus,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Company bank account changed during review; reload before retrying');
    }
    const account = await this.prisma.companyBankAccount.findUnique({
      where: { id: accountId },
      select: adminCompanyBankAccountSelect,
    });
    if (!account) {
      throw new NotFoundException('Company bank account not found after update');
    }
    await this.writeAudit(actorId, 'company_bank_account.update', `company_bank_account:${accountId}`, {
      after: {
        accountNumberLast4: account.accountNumberLast4,
        accountNumberMasked: account.accountNumberMasked,
        bankName: account.bankName,
        currency: account.currency,
        name: account.name,
        status: account.status,
      },
      approvalAdminId,
      before: {
        accountNumberLast4: existing.accountNumberLast4,
        accountNumberMasked: existing.accountNumberMasked,
        bankName: existing.bankName,
        currency: existing.currency,
        name: existing.name,
        status: existing.status,
      },
      operatorReason,
    });
    return account;
  }

  async listBankReconciliationTransactions(options: AdminPaymentOperationsQuery = {}) {
    const where = adminBankReconciliationWhere(options);
    const skip = boundedAdminListSkip(options.skip);
    const withdrawalCandidate = adminBankReconciliationWithdrawalCandidate(options.candidate);

    if (withdrawalCandidate) {
      const candidateRows = await this.bankReconciliationWithdrawalCandidatePage({
        candidate: withdrawalCandidate,
        options,
        skip,
        take: adminPaymentOperationsTake(options.take),
      });
      if (candidateRows.length === 0) {
        return [];
      }
      const reviewAssigneesById = await this.financeReviewAssignmentAdminsById(
        candidateRows
          .map((row) => normalizeNullable(row.reviewAssigneeAdminId))
          .filter((adminId): adminId is string => Boolean(adminId)),
      );
      const candidateOrder = new Map(candidateRows.map((row, index) => [row.bankTransactionId, index]));
      const candidateSummaries = new Map(
        candidateRows.map((row) => {
          const candidateCount = numberValue(row.candidateCount);
          const strongCount = numberValue(row.strongCount);
          const reviewAssignedAt = adminIsoDateTime(row.reviewAssignedAt);
          const reviewAssigneeAdminId = normalizeNullable(row.reviewAssigneeAdminId);
          return [
            row.bankTransactionId,
            {
              candidateCount,
              confidence: strongCount > 0 ? 'STRONG' : candidateCount > 0 ? 'REVIEW' : 'NONE',
              reviewCount: Math.max(0, candidateCount - strongCount),
              ...(reviewAssignedAt && reviewAssigneeAdminId
                ? {
                    reviewAssignment: {
                      assignedAt: reviewAssignedAt,
                      assignedByAdminId: normalizeNullable(row.reviewAssignedByAdminId),
                      assignee: reviewAssigneesById.get(reviewAssigneeAdminId) ?? {
                        id: reviewAssigneeAdminId,
                        email: null,
                        fullName: null,
                      },
                      assigneeAdminId: reviewAssigneeAdminId,
                      reason: normalizeNullable(row.reviewAssignmentReason),
                    },
                  }
                : {}),
              strongCount,
            },
          ] as const;
        }),
      );
      const transactions = await this.prisma.companyBankTransaction.findMany({
        where: { id: { in: candidateRows.map((row) => row.bankTransactionId) } },
        select: adminCompanyBankTransactionListSelect,
      });

      return transactions
        .sort(
          (left, right) =>
            (candidateOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (candidateOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((transaction) => {
          const summary = candidateSummaries.get(transaction.id);
          return {
            ...transaction,
            ...(summary?.reviewAssignment
              ? { reviewAssignment: summary.reviewAssignment }
              : {}),
            withdrawalCandidateSummary: summary
              ? {
                  ...summary,
                  ...bankReconciliationWithdrawalCandidateWaitingMeta(transaction.occurredAt),
                }
              : undefined,
          };
        });
    }

    const transactions = await this.prisma.companyBankTransaction.findMany({
      ...(where ? { where } : {}),
      orderBy: { occurredAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminPaymentOperationsTake(options.take),
      select: adminCompanyBankTransactionListSelect,
    });
    const withdrawalCandidateSummaries =
      await this.bankReconciliationWithdrawalCandidateSummaries(transactions);

    const rows = transactions.map((transaction) => {
      const withdrawalCandidateSummary = withdrawalCandidateSummaries.get(transaction.id);
      return withdrawalCandidateSummary
        ? { ...transaction, withdrawalCandidateSummary }
        : transaction;
    });
    return this.withBankTransactionReviewAssignments(rows);
  }

  private bankReconciliationWithdrawalCandidatePage(input: {
    candidate: AdminBankReconciliationWithdrawalCandidate;
    options: AdminPaymentOperationsQuery;
    skip: number;
    take: number;
  }) {
    const candidateSet = adminBankReconciliationWithdrawalCandidateSet(input.options);
    const candidateWhere = adminBankReconciliationWithdrawalCandidateResultWhere(input.candidate);
    const assignmentWhere = adminBankReconciliationReviewAssignmentWhere(input.options);

    return this.prisma.$queryRaw<
      Array<{
        bankTransactionId: string;
        candidateCount: bigint | number;
        reviewAssignedAt: Date | string | null;
        reviewAssigneeAdminId: string | null;
        reviewAssignedByAdminId: string | null;
        reviewAssignmentReason: string | null;
        strongCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH withdrawal_candidates AS (${candidateSet})
      SELECT
        candidates."bankTransactionId",
        candidates."candidateCount",
        candidates."strongCount",
        assignment."metadata"->>'assigneeAdminId' AS "reviewAssigneeAdminId",
        assignment."metadata"->>'assignedByAdminId' AS "reviewAssignedByAdminId",
        assignment."metadata"->>'reason' AS "reviewAssignmentReason",
        assignment."createdAt" AS "reviewAssignedAt"
      FROM withdrawal_candidates candidates
      ${adminBankReconciliationLatestReviewAssignmentJoinSql()}
      WHERE ${candidateWhere} AND ${assignmentWhere}
      ORDER BY candidates."occurredAt" ASC, candidates."bankTransactionId" ASC
      OFFSET ${input.skip}
      LIMIT ${input.take}
    `);
  }

  private async bankReconciliationWithdrawalCandidateSummaries(
    transactions: ReadonlyArray<{
      id: string;
      occurredAt: Date;
      status: BankReconciliationStatus;
      type: CompanyBankTransactionType;
    }>,
  ) {
    const outflowIds = transactions
      .filter(
        (transaction) =>
          transaction.type === CompanyBankTransactionType.OUTFLOW &&
          (transaction.status === BankReconciliationStatus.UNMATCHED ||
            transaction.status === BankReconciliationStatus.PARTIALLY_MATCHED),
      )
      .map((transaction) => transaction.id);
    const summaries = new Map<
      string,
      {
        candidateCount: number;
        confidence: 'NONE' | 'REVIEW' | 'STRONG';
        reviewCount: number;
        slaStatus: 'CURRENT' | 'OVER_24H' | 'OVER_48H';
        strongCount: number;
        waitingHours: number;
      }
    >();

    for (const transaction of transactions) {
      if (!outflowIds.includes(transaction.id)) continue;
      summaries.set(transaction.id, {
        candidateCount: 0,
        confidence: 'NONE',
        reviewCount: 0,
        strongCount: 0,
        ...bankReconciliationWithdrawalCandidateWaitingMeta(transaction.occurredAt),
      });
    }
    if (outflowIds.length === 0) {
      return summaries;
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        bankTransactionId: string;
        candidateCount: bigint | number;
        strongCount: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        bank."id" AS "bankTransactionId",
        COUNT(*)::bigint AS "candidateCount",
        COUNT(*) FILTER (
          WHERE (
            bank."transferRef" IS NOT NULL
            AND withdrawal."transferRef" IS NOT NULL
            AND UPPER(TRIM(bank."transferRef")) = UPPER(TRIM(withdrawal."transferRef"))
          ) OR (
            withdrawal."amount" = bank."amount"
            AND ABS(EXTRACT(EPOCH FROM (
              COALESCE(withdrawal."paidAt", withdrawal."createdAt") - bank."occurredAt"
            ))) <= ${3 * 24 * 60 * 60}
          )
        )::bigint AS "strongCount"
      FROM "CompanyBankTransaction" bank
      INNER JOIN "ProviderWalletWithdrawalRequest" withdrawal
        ON withdrawal."status" = ${ProviderWalletWithdrawalRequestStatus.PAID}::"ProviderWalletWithdrawalRequestStatus"
        AND withdrawal."currency" = bank."currency"
        AND COALESCE(withdrawal."paidAt", withdrawal."createdAt") BETWEEN
          bank."occurredAt" - INTERVAL '30 days'
          AND bank."occurredAt" + INTERVAL '30 days'
        AND (
          ABS(withdrawal."amount" - bank."amount") <= GREATEST(
            10000,
            LEAST(100000, ROUND(bank."amount" * 0.1))
          )
          OR (
            bank."transferRef" IS NOT NULL
            AND withdrawal."transferRef" IS NOT NULL
            AND UPPER(TRIM(bank."transferRef")) = UPPER(TRIM(withdrawal."transferRef"))
          )
        )
      WHERE bank."id" IN (${Prisma.join(outflowIds)})
        AND bank."type" = ${CompanyBankTransactionType.OUTFLOW}::"CompanyBankTransactionType"
        AND bank."status" IN (
          ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
          ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "BankReconciliationMatch" active_match
          WHERE active_match."withdrawalRequestId" = withdrawal."id"
            AND active_match."status" IN (
              ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus",
              ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
            )
        )
      GROUP BY bank."id"
    `);

    for (const row of rows) {
      const candidateCount = numberValue(row.candidateCount);
      const strongCount = numberValue(row.strongCount);
      const existing = summaries.get(row.bankTransactionId);
      if (!existing) continue;
      summaries.set(row.bankTransactionId, {
        ...existing,
        candidateCount,
        confidence: strongCount > 0 ? 'STRONG' : candidateCount > 0 ? 'REVIEW' : 'NONE',
        reviewCount: Math.max(0, candidateCount - strongCount),
        strongCount,
      });
    }

    return summaries;
  }

  async bankReconciliationSummary(options: AdminPaymentOperationsQuery = {}) {
    const withdrawalCandidate = adminBankReconciliationWithdrawalCandidate(options.candidate);
    if (withdrawalCandidate) {
      const candidateSet = adminBankReconciliationWithdrawalCandidateSet(options);
      const candidateWhere = adminBankReconciliationWithdrawalCandidateResultWhere(withdrawalCandidate);
      const assignmentWhere = adminBankReconciliationReviewAssignmentWhere(options);
      const rows = await this.prisma.$queryRaw<
        Array<{
          amount: bigint | number | null;
          count: bigint | number;
          matchedCount: bigint | number;
          unmatchedCount: bigint | number;
        }>
      >(Prisma.sql`
        WITH withdrawal_candidates AS (${candidateSet})
        SELECT
          COUNT(*)::bigint AS "count",
          COALESCE(SUM(candidates."amount"), 0)::bigint AS "amount",
          COUNT(*) FILTER (
            WHERE candidates."status" = ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus"
          )::bigint AS "matchedCount",
          COUNT(*) FILTER (
            WHERE candidates."status" = ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus"
          )::bigint AS "unmatchedCount"
        FROM withdrawal_candidates candidates
        ${adminBankReconciliationLatestReviewAssignmentJoinSql()}
        WHERE ${candidateWhere} AND ${assignmentWhere}
      `);
      const row = rows[0];
      return {
        amount: numberValue(row?.amount),
        count: numberValue(row?.count),
        currency: 'VND',
        matchedCount: numberValue(row?.matchedCount),
        unmatchedCount: numberValue(row?.unmatchedCount),
      };
    }

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

  async bankReconciliationWithdrawalCandidateSummary(
    options: Pick<AdminPaymentOperationsQuery, 'q' | 'range'> = {},
  ) {
    const candidateSet = adminBankReconciliationWithdrawalCandidateSet(options);
    const rows = await this.prisma.$queryRaw<
      Array<{
        assignedCount: bigint | number;
        assignments: Prisma.JsonValue | null;
        eligibleCount: bigint | number;
        noneAmount: bigint | number | null;
        noneCount: bigint | number;
        oldestReviewOccurredAt: Date | string | null;
        oldestStrongOccurredAt: Date | string | null;
        reviewAmount: bigint | number | null;
        reviewCount: bigint | number;
        reviewOver24hCount: bigint | number;
        reviewOver48hCount: bigint | number;
        strongAmount: bigint | number | null;
        strongCount: bigint | number;
        strongOver24hCount: bigint | number;
        strongOver48hCount: bigint | number;
        unassignedCount: bigint | number;
      }>
    >(Prisma.sql`
      WITH withdrawal_candidates AS (${candidateSet}),
      candidate_assignments AS (
        SELECT
          candidates.*,
          assignment."metadata"->>'assigneeAdminId' AS "assigneeAdminId"
        FROM withdrawal_candidates candidates
        ${adminBankReconciliationLatestReviewAssignmentJoinSql()}
      ),
      assignment_groups AS (
        SELECT
          candidates."assigneeAdminId",
          COUNT(*)::bigint AS "count",
          COUNT(*) FILTER (
            WHERE candidates."occurredAt" < NOW() - INTERVAL '24 hours'
          )::bigint AS "over24hCount",
          COUNT(*) FILTER (
            WHERE candidates."occurredAt" < NOW() - INTERVAL '48 hours'
          )::bigint AS "over48hCount"
        FROM candidate_assignments candidates
        WHERE candidates."assigneeAdminId" IS NOT NULL
        GROUP BY candidates."assigneeAdminId"
      )
      SELECT
        COUNT(*)::bigint AS "eligibleCount",
        COUNT(*) FILTER (WHERE candidates."assigneeAdminId" IS NOT NULL)::bigint AS "assignedCount",
        COUNT(*) FILTER (WHERE candidates."assigneeAdminId" IS NULL)::bigint AS "unassignedCount",
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'assigneeAdminId', groups."assigneeAdminId",
              'count', groups."count",
              'over24hCount', groups."over24hCount",
              'over48hCount', groups."over48hCount"
            )
            ORDER BY groups."count" DESC, groups."assigneeAdminId" ASC
          )
          FROM assignment_groups groups
        ), '[]'::jsonb) AS "assignments",
        COUNT(*) FILTER (WHERE candidates."strongCount" > 0)::bigint AS "strongCount",
        COALESCE(SUM(candidates."amount") FILTER (WHERE candidates."strongCount" > 0), 0)::bigint
          AS "strongAmount",
        COUNT(*) FILTER (
          WHERE candidates."candidateCount" > 0 AND candidates."strongCount" = 0
        )::bigint AS "reviewCount",
        COALESCE(SUM(candidates."amount") FILTER (
          WHERE candidates."candidateCount" > 0 AND candidates."strongCount" = 0
        ), 0)::bigint AS "reviewAmount",
        MIN(candidates."occurredAt") FILTER (
          WHERE candidates."candidateCount" > 0 AND candidates."strongCount" = 0
        ) AS "oldestReviewOccurredAt",
        COUNT(*) FILTER (
          WHERE candidates."candidateCount" > 0
            AND candidates."strongCount" = 0
            AND candidates."occurredAt" < NOW() - INTERVAL '24 hours'
        )::bigint AS "reviewOver24hCount",
        COUNT(*) FILTER (
          WHERE candidates."candidateCount" > 0
            AND candidates."strongCount" = 0
            AND candidates."occurredAt" < NOW() - INTERVAL '48 hours'
        )::bigint AS "reviewOver48hCount",
        MIN(candidates."occurredAt") FILTER (
          WHERE candidates."strongCount" > 0
        ) AS "oldestStrongOccurredAt",
        COUNT(*) FILTER (
          WHERE candidates."strongCount" > 0
            AND candidates."occurredAt" < NOW() - INTERVAL '24 hours'
        )::bigint AS "strongOver24hCount",
        COUNT(*) FILTER (
          WHERE candidates."strongCount" > 0
            AND candidates."occurredAt" < NOW() - INTERVAL '48 hours'
        )::bigint AS "strongOver48hCount",
        COUNT(*) FILTER (WHERE candidates."candidateCount" = 0)::bigint AS "noneCount",
        COALESCE(SUM(candidates."amount") FILTER (WHERE candidates."candidateCount" = 0), 0)::bigint
          AS "noneAmount"
      FROM candidate_assignments candidates
    `);
    const row = rows[0];
    const assignments = adminBankReconciliationAssignmentSummaryRows(row?.assignments);
    const reviewAssigneesById = await this.financeReviewAssignmentAdminsById(
      assignments.map((assignment) => assignment.assigneeAdminId),
    );
    return {
      assignedCount: numberValue(row?.assignedCount),
      assignments: assignments.map((assignment) => ({
        ...assignment,
        assignee: reviewAssigneesById.get(assignment.assigneeAdminId) ?? {
          id: assignment.assigneeAdminId,
          email: null,
          fullName: null,
        },
      })),
      currency: 'VND',
      eligibleCount: numberValue(row?.eligibleCount),
      noneAmount: numberValue(row?.noneAmount),
      noneCount: numberValue(row?.noneCount),
      oldestReviewOccurredAt: adminIsoDateTime(row?.oldestReviewOccurredAt),
      oldestStrongOccurredAt: adminIsoDateTime(row?.oldestStrongOccurredAt),
      reviewAmount: numberValue(row?.reviewAmount),
      reviewCount: numberValue(row?.reviewCount),
      reviewOver24hCount: numberValue(row?.reviewOver24hCount),
      reviewOver48hCount: numberValue(row?.reviewOver48hCount),
      strongAmount: numberValue(row?.strongAmount),
      strongCount: numberValue(row?.strongCount),
      strongOver24hCount: numberValue(row?.strongOver24hCount),
      strongOver48hCount: numberValue(row?.strongOver48hCount),
      unassignedCount: numberValue(row?.unassignedCount),
    };
  }

  private async financeReviewAssignmentAdminsById(adminIds: readonly string[]) {
    const uniqueAdminIds = Array.from(new Set(adminIds));
    if (uniqueAdminIds.length === 0) {
      return new Map<string, AdminFinanceReviewAssignmentAdmin>();
    }
    const admins = await this.prisma.user.findMany({
      where: { id: { in: uniqueAdminIds } },
      select: { id: true, email: true, fullName: true },
    });
    return new Map(admins.map((admin) => [admin.id, admin]));
  }

  private async withBankTransactionReviewAssignments<T extends { id: string }>(
    transactions: readonly T[],
  ) {
    if (transactions.length === 0) return [];

    const targetPrefix = 'bank_transaction:';
    const targets = transactions.map((transaction) => `${targetPrefix}${transaction.id}`);
    const assignments = await this.prisma.adminAuditLog.findMany({
      where: {
        action: COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION,
        target: { in: targets },
      },
      distinct: ['target'],
      orderBy: [{ target: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        actorId: true,
        createdAt: true,
        metadata: true,
        target: true,
        actor: { select: { id: true, email: true, fullName: true } },
      },
    });
    const adminsById = await this.financeReviewAssignmentAdminsById(
      adminFinanceReviewAssignmentReferencedIds(assignments),
    );
    const assignmentByTransactionId = new Map(
      assignments.flatMap((assignment) => {
        const transactionId = assignment.target?.startsWith(targetPrefix)
          ? assignment.target.slice(targetPrefix.length)
          : null;
        const history = adminFinanceReviewAssignmentHistory([assignment], adminsById)[0];
        if (!transactionId || !history) return [];
        return [[transactionId, {
          assignedAt: history.assignedAt,
          assignedByAdminId: history.assignedBy?.id ?? assignment.actorId,
          assignee: history.assignee,
          assigneeAdminId: history.assignee.id,
          reason: history.reason,
        }] as const];
      }),
    );

    return transactions.map((transaction) => {
      const reviewAssignment = assignmentByTransactionId.get(transaction.id);
      return reviewAssignment ? { ...transaction, reviewAssignment } : transaction;
    });
  }

  private async withPartnerBankDepositReconciliationAssignments<T extends { id: string }>(
    requests: readonly T[],
  ) {
    if (requests.length === 0) return [];

    const targetPrefix = 'partner_bank_deposit_request:';
    const targets = requests.map((request) => `${targetPrefix}${request.id}`);
    const assignments = await this.prisma.adminAuditLog.findMany({
      where: {
        action: PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION,
        target: { in: targets },
      },
      distinct: ['target'],
      orderBy: [{ target: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        actorId: true,
        createdAt: true,
        metadata: true,
        target: true,
        actor: { select: { id: true, email: true, fullName: true } },
      },
    });
    const adminsById = await this.financeReviewAssignmentAdminsById(
      adminFinanceReviewAssignmentReferencedIds(assignments),
    );
    const assignmentByRequestId = new Map(
      assignments.flatMap((assignment) => {
        const requestId = assignment.target?.startsWith(targetPrefix)
          ? assignment.target.slice(targetPrefix.length)
          : null;
        const history = adminFinanceReviewAssignmentHistory([assignment], adminsById)[0];
        if (!requestId || !history) return [];
        return [[requestId, {
          assignedAt: history.assignedAt,
          assignedByAdminId: history.assignedBy?.id ?? assignment.actorId,
          assignee: history.assignee,
          assigneeAdminId: history.assignee.id,
          reason: history.reason,
        }] as const];
      }),
    );

    return requests.map((request) => {
      const reconciliationReviewAssignment = assignmentByRequestId.get(request.id);
      return reconciliationReviewAssignment
        ? { ...request, reconciliationReviewAssignment }
        : request;
    });
  }

  async listCompanyBankTransactionImportBatches(
    options: AdminCompanyBankTransactionImportBatchListOptions = {},
  ) {
    const skip = adminAuditLogListSkip(options.skip);
    const take = adminBoundedPositiveInteger(options.take, 10, 20);
    const where = adminCompanyBankTransactionImportBatchWhere(options);
    const review = adminCompanyBankTransactionImportBatchReview(options.review);
    let logs: Prisma.AdminAuditLogGetPayload<{ select: typeof adminAuditLogSelect }>[];
    let total: number;
    if (review === 'all') {
      [logs, total] = await Promise.all([
        this.prisma.adminAuditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...(skip > 0 ? { skip } : {}),
          take,
          select: adminAuditLogSelect,
        }),
        this.prisma.adminAuditLog.count({ where }),
      ]);
    } else {
      const pageRows = await this.prisma.$queryRaw<AdminCompanyBankTransactionImportBatchPageRow[]>(
        adminCompanyBankTransactionImportBatchFilteredPageSql(options, review, skip, take),
      );
      const ids = pageRows.map((row) => row.id).filter((id): id is string => Boolean(id));
      total = Number(pageRows[0]?.total ?? 0);
      const unorderedLogs = ids.length
        ? await this.prisma.adminAuditLog.findMany({
            where: { id: { in: ids } },
            select: adminAuditLogSelect,
          })
        : [];
      const orderById = new Map(ids.map((id, index) => [id, index]));
      logs = unorderedLogs.sort(
        (left, right) => (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0),
      );
    }
    const normalized = logs.map(adminCompanyBankTransactionImportBatchHistoryItem);
    const transactionIdsByBatch = new Map(
      normalized.map((item, index) => [
        item.batchImportId,
        adminCompanyBankTransactionImportBatchRowResults(logs[index]?.metadata ?? null)
          .map((row) => row.transactionId)
          .filter((id): id is string => Boolean(id)),
      ]),
    );
    const transactionIds = Array.from(new Set(Array.from(transactionIdsByBatch.values()).flat()));
    const approvalAdminIds = Array.from(
      new Set(normalized.map((item) => item.approvalAdminId).filter((id): id is string => Boolean(id))),
    );
    const assigneeAdminIds = normalized
      .map((item) => item.assigneeAdminId)
      .filter((id): id is string => Boolean(id));
    const identityAdminIds = Array.from(new Set([...approvalAdminIds, ...assigneeAdminIds]));
    const [approvers, transactions] = await Promise.all([
      identityAdminIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: identityAdminIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [],
      transactionIds.length
        ? this.prisma.companyBankTransaction.findMany({
            where: { id: { in: transactionIds } },
            select: { id: true, status: true },
          })
        : [],
    ]);
    const approversById = new Map(approvers.map((approver) => [approver.id, approver]));
    const transactionStatusById = new Map(
      transactions.map((transaction) => [transaction.id, transaction.status]),
    );

    return {
      items: normalized.map((item) => {
        const reconciliation = companyBankTransactionImportBatchReconciliationSummary(
          transactionIdsByBatch.get(item.batchImportId) ?? [],
          transactionStatusById,
          item.createdAt,
        );
        return {
          ...item,
          ...reconciliation,
          assignee: item.assigneeAdminId ? (approversById.get(item.assigneeAdminId) ?? null) : null,
          approver: item.approvalAdminId ? (approversById.get(item.approvalAdminId) ?? null) : null,
        };
      }),
      pagination: { skip, take, total },
    };
  }

  async companyBankTransactionImportBatchSummary() {
    const staleBefore = new Date(Date.now() - COMPANY_BANK_TRANSACTION_BATCH_STALE_MS);
    const escalatedBefore = new Date(Date.now() - COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_MS);
    const [row] = await this.prisma.$queryRaw<AdminCompanyBankTransactionImportBatchSummaryRow[]>(Prisma.sql`
      WITH reconciliation_batches AS (
        SELECT
          transactions."metadata"->>'batchImportId' AS "batchImportId",
          COUNT(*)::int AS "transactionCount",
          COUNT(*) FILTER (
            WHERE transactions."status" IN (
              ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
              ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
            )
          )::int AS "openCount"
        FROM "CompanyBankTransaction" transactions
        WHERE transactions."metadata" ? 'batchImportId'
        GROUP BY transactions."metadata"->>'batchImportId'
      )
      SELECT
        COUNT(*)::bigint AS "batchCount",
        COUNT(*) FILTER (WHERE reconciliation."openCount" > 0)::bigint AS "needsReconciliationCount",
        COUNT(*) FILTER (
          WHERE reconciliation."transactionCount" > 0 AND reconciliation."openCount" = 0
        )::bigint AS "reconciledCount",
        COUNT(*) FILTER (
          WHERE reconciliation."openCount" > 0 AND logs."createdAt" <= ${staleBefore}
        )::bigint AS "staleNeedsReconciliationCount",
        COUNT(*) FILTER (
          WHERE reconciliation."openCount" > 0 AND logs."createdAt" <= ${escalatedBefore}
        )::bigint AS "escalatedNeedsReconciliationCount",
        COUNT(*) FILTER (WHERE reconciliation."batchImportId" IS NULL)::bigint AS "noTransactionCount",
        MIN(logs."createdAt") FILTER (WHERE reconciliation."openCount" > 0) AS "oldestOpenImportedAt"
      FROM "AdminAuditLog" logs
      LEFT JOIN reconciliation_batches reconciliation
        ON reconciliation."batchImportId" = COALESCE(
          logs."metadata"->>'batchImportId',
          REPLACE(logs."target", 'company_bank_transaction_batch:', '')
        )
      WHERE logs."action" = ${COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION}
    `);

    return {
      batchCount: Number(row?.batchCount ?? 0),
      escalatedNeedsReconciliationCount: Number(row?.escalatedNeedsReconciliationCount ?? 0),
      needsReconciliationCount: Number(row?.needsReconciliationCount ?? 0),
      noTransactionCount: Number(row?.noTransactionCount ?? 0),
      oldestOpenImportedAt: row?.oldestOpenImportedAt ?? null,
      reconciledCount: Number(row?.reconciledCount ?? 0),
      staleNeedsReconciliationCount: Number(row?.staleNeedsReconciliationCount ?? 0),
    };
  }

  async syncCompanyBankTransactionImportBatchEscalations(now = new Date()) {
    const escalatedBefore = new Date(
      now.getTime() - COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_MS,
    );
    const candidates = await this.prisma.$queryRaw<
      AdminCompanyBankTransactionImportBatchEscalationRow[]
    >(Prisma.sql`
      WITH reconciliation_batches AS (
        SELECT
          transactions."metadata"->>'batchImportId' AS "batchImportId",
          COUNT(*) FILTER (
            WHERE transactions."status" IN (
              ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
              ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
            )
          )::bigint AS "openTransactionCount"
        FROM "CompanyBankTransaction" transactions
        WHERE transactions."metadata" ? 'batchImportId'
        GROUP BY transactions."metadata"->>'batchImportId'
      )
      SELECT
        COALESCE(
          logs."metadata"->>'batchImportId',
          REPLACE(logs."target", 'company_bank_transaction_batch:', '')
        ) AS "batchImportId",
        logs."actorId" AS "importerAdminId",
        logs."metadata"->>'assigneeAdminId' AS "assigneeAdminId",
        logs."createdAt" AS "importedAt",
        reconciliation."openTransactionCount"
      FROM "AdminAuditLog" logs
      INNER JOIN reconciliation_batches reconciliation
        ON reconciliation."batchImportId" = COALESCE(
          logs."metadata"->>'batchImportId',
          REPLACE(logs."target", 'company_bank_transaction_batch:', '')
        )
      WHERE logs."action" = ${COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION}
        AND logs."createdAt" <= ${escalatedBefore}
        AND reconciliation."openTransactionCount" > 0
        AND NOT EXISTS (
          SELECT 1
          FROM "AdminAuditLog" escalation
          WHERE escalation."action" = ${COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_ACTION}
            AND escalation."target" = logs."target"
        )
      ORDER BY logs."createdAt" ASC, logs."id" ASC
      LIMIT ${COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_SWEEP_LIMIT}
    `);

    const results: Array<'ESCALATED' | 'MISSING_RECIPIENT' | 'SKIPPED'> = [];
    for (const candidate of candidates) {
      results.push(await this.escalateCompanyBankTransactionImportBatch(candidate, now));
    }

    return {
      escalatedCount: results.filter((result) => result === 'ESCALATED').length,
      missingRecipientCount: results.filter((result) => result === 'MISSING_RECIPIENT').length,
      scannedCount: candidates.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  async syncCompanyBankTransactionReviewEscalations(now = new Date()) {
    const escalatedBefore = new Date(
      now.getTime() - COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_MS,
    );
    const candidates = await this.prisma.$queryRaw<
      AdminCompanyBankTransactionReviewEscalationRow[]
    >(Prisma.sql`
      WITH latest_assignments AS (
        SELECT DISTINCT ON (logs."target")
          logs."id" AS "assignmentAuditLogId",
          logs."target",
          logs."metadata"->>'assigneeAdminId' AS "assigneeAdminId",
          logs."createdAt" AS "assignedAt"
        FROM "AdminAuditLog" logs
        WHERE logs."action" = ${COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION}
        ORDER BY logs."target", logs."createdAt" DESC, logs."id" DESC
      )
      SELECT
        assignments."assignmentAuditLogId",
        assignments."assigneeAdminId",
        assignments."assignedAt",
        transactions."id" AS "bankTransactionId",
        transactions."status" AS "bankTransactionStatus"
      FROM latest_assignments assignments
      INNER JOIN "CompanyBankTransaction" transactions
        ON assignments."target" = 'bank_transaction:' || transactions."id"
      WHERE assignments."assigneeAdminId" IS NOT NULL
        AND assignments."assignedAt" <= ${escalatedBefore}
        AND transactions."status" IN (
          ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
          ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "AdminAuditLog" escalation
          WHERE escalation."action" = ${COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_ACTION}
            AND escalation."target" = assignments."target"
            AND escalation."metadata"->>'assignmentAuditLogId' = assignments."assignmentAuditLogId"
        )
      ORDER BY assignments."assignedAt" ASC, assignments."assignmentAuditLogId" ASC
      LIMIT ${COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_SWEEP_LIMIT}
    `);

    const results: Array<'ESCALATED' | 'MISSING_RECIPIENT' | 'SKIPPED'> = [];
    for (const candidate of candidates) {
      results.push(await this.escalateCompanyBankTransactionReview(candidate, now));
    }

    return {
      escalatedCount: results.filter((result) => result === 'ESCALATED').length,
      missingRecipientCount: results.filter((result) => result === 'MISSING_RECIPIENT').length,
      scannedCount: candidates.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  private escalateCompanyBankTransactionReview(
    candidate: AdminCompanyBankTransactionReviewEscalationRow,
    triggeredAt: Date,
  ) {
    const target = `bank_transaction:${candidate.bankTransactionId}`;
    const lockKey = `${target}:assignment:${candidate.assignmentAuditLogId}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const latestAssignment = await tx.adminAuditLog.findFirst({
        where: {
          action: COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION,
          target,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, metadata: true },
      });
      if (
        latestAssignment?.id !== candidate.assignmentAuditLogId ||
        jsonString(jsonObject(latestAssignment.metadata).assigneeAdminId) !==
          candidate.assigneeAdminId
      ) {
        return 'SKIPPED' as const;
      }

      const existing = await tx.adminAuditLog.findFirst({
        where: {
          action: COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_ACTION,
          target,
          metadata: {
            path: ['assignmentAuditLogId'],
            equals: candidate.assignmentAuditLogId,
          },
        },
        select: { id: true },
      });
      if (existing) return 'SKIPPED' as const;

      const openTransaction = await tx.companyBankTransaction.findFirst({
        where: {
          id: candidate.bankTransactionId,
          status: {
            in: [
              BankReconciliationStatus.UNMATCHED,
              BankReconciliationStatus.PARTIALLY_MATCHED,
            ],
          },
        },
        select: { id: true, status: true },
      });
      if (!openTransaction) return 'SKIPPED' as const;

      const recipient =
        (await tx.user.findFirst({
          where: {
            id: candidate.assigneeAdminId,
            roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
          },
          select: { id: true },
        })) ??
        (await tx.user.findFirst({
          where: { roles: { has: Role.MASTER_ADMIN } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        }));
      if (!recipient) return 'MISSING_RECIPIENT' as const;

      const notification = await tx.notification.create({
        data: {
          userId: recipient.id,
          type: 'admin.finance.bank_transaction.review_escalated',
          title: 'Bank transaction review is overdue',
          body: `Bank transaction ${candidate.bankTransactionId} has remained assigned and unresolved for over 48 hours.`,
          data: {
            assignmentAuditLogId: candidate.assignmentAuditLogId,
            bankTransactionId: candidate.bankTransactionId,
            destination: `/finance-tax/bank-reconciliation/${encodeURIComponent(candidate.bankTransactionId)}`,
            financeReviewStatus: 'OPEN',
            source: 'bank_transaction_review_escalation_sweep',
          },
        },
        select: { id: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: recipient.id,
          action: COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_ACTION,
          target,
          metadata: {
            assigneeAdminId: candidate.assigneeAdminId,
            assignedAt: candidate.assignedAt.toISOString(),
            assignmentAuditLogId: candidate.assignmentAuditLogId,
            bankStatus: openTransaction.status,
            bankTransactionId: candidate.bankTransactionId,
            notificationId: notification.id,
            recipientAdminId: recipient.id,
            source: 'system_sweep',
            triggeredAt: triggeredAt.toISOString(),
          },
        },
      });

      return 'ESCALATED' as const;
    });
  }

  async syncPartnerBankDepositReconciliationEscalations(now = new Date()) {
    const escalatedBefore = new Date(
      now.getTime() - PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_MS,
    );
    const candidates = await this.prisma.$queryRaw<
      AdminPartnerBankDepositReconciliationEscalationRow[]
    >(Prisma.sql`
      WITH ${adminPartnerBankDepositReconciliationCteSql({})}
      SELECT
        deposits."assigneeAdminId",
        deposits."assignedAt",
        deposits."assignmentAuditLogId",
        deposits."id" AS "partnerBankDepositRequestId",
        COALESCE(deposits."executedAt", deposits."createdAt") AS "reviewStartedAt"
      FROM "openPartnerBankDeposits" deposits
      WHERE COALESCE(deposits."executedAt", deposits."createdAt") <= ${escalatedBefore}
        AND NOT EXISTS (
          SELECT 1
          FROM "AdminAuditLog" escalation
          INNER JOIN "Notification" notification
            ON notification."id" = escalation."metadata"->>'notificationId'
          WHERE escalation."action" = ${PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_ACTION}
            AND escalation."target" = 'partner_bank_deposit_request:' || deposits."id"
            AND COALESCE(notification."data"->>'financeReviewStatus', 'OPEN') <> 'RESOLVED'
        )
      ORDER BY COALESCE(deposits."executedAt", deposits."createdAt") ASC, deposits."id" ASC
      LIMIT ${PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_SWEEP_LIMIT}
    `);

    const results: Array<'ESCALATED' | 'MISSING_RECIPIENT' | 'SKIPPED'> = [];
    for (const candidate of candidates) {
      results.push(await this.escalatePartnerBankDepositReconciliation(candidate, now));
    }

    return {
      escalatedCount: results.filter((result) => result === 'ESCALATED').length,
      missingRecipientCount: results.filter((result) => result === 'MISSING_RECIPIENT').length,
      scannedCount: candidates.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  private escalatePartnerBankDepositReconciliation(
    candidate: AdminPartnerBankDepositReconciliationEscalationRow,
    triggeredAt: Date,
  ) {
    const target = `partner_bank_deposit_request:${candidate.partnerBankDepositRequestId}`;
    const lockKey = `${target}:reconciliation_escalation`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const latestAssignment = await tx.adminAuditLog.findFirst({
        where: {
          action: PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION,
          target,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, metadata: true },
      });
      const latestAssigneeAdminId = jsonString(
        jsonObject(latestAssignment?.metadata ?? null).assigneeAdminId,
      );
      if (
        (latestAssignment?.id ?? null) !== candidate.assignmentAuditLogId ||
        (latestAssigneeAdminId ?? null) !== candidate.assigneeAdminId
      ) {
        return 'SKIPPED' as const;
      }

      const activeEscalation = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT escalation."id"
        FROM "AdminAuditLog" escalation
        INNER JOIN "Notification" notification
          ON notification."id" = escalation."metadata"->>'notificationId'
        WHERE escalation."action" = ${PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_ACTION}
          AND escalation."target" = ${target}
          AND COALESCE(notification."data"->>'financeReviewStatus', 'OPEN') <> 'RESOLVED'
        LIMIT 1
      `);
      if (activeEscalation.length > 0) return 'SKIPPED' as const;

      const request = await tx.partnerBankDepositRequest.findFirst({
        where: {
          id: candidate.partnerBankDepositRequestId,
          status: PartnerBankDepositRequestStatus.EXECUTED,
        },
        select: { amount: true, bankTransactionId: true, id: true, journalBatchId: true },
      });
      if (!request) return 'SKIPPED' as const;
      const bankCashEntry = request.journalBatchId
        ? await tx.accountingJournalEntry.findFirst({
            where: {
              accountCode: 'company_bank_cash',
              batchId: request.journalBatchId,
              side: AccountingJournalEntrySide.DEBIT,
            },
            select: {
              amount: true,
              bankReconciliationMatches: {
                where: {
                  status: {
                    in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
                  },
                },
                select: { amount: true },
              },
            },
          })
        : null;
      const targetAmount = bankCashEntry?.amount ?? request.amount;
      const matchedAmount = bankCashEntry?.bankReconciliationMatches.reduce(
        (sum, match) => sum + Math.abs(match.amount),
        0,
      ) ?? 0;
      if (matchedAmount >= targetAmount) return 'SKIPPED' as const;

      const recipient = candidate.assigneeAdminId
        ? await tx.user.findFirst({
            where: {
              id: candidate.assigneeAdminId,
              roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
            },
            select: { id: true },
          })
        : null;
      const fallbackRecipient = recipient ?? await tx.user.findFirst({
        where: { roles: { has: Role.MASTER_ADMIN } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!fallbackRecipient) return 'MISSING_RECIPIENT' as const;

      const notification = await tx.notification.create({
        data: {
          userId: fallbackRecipient.id,
          type: 'admin.finance.partner_bank_deposit.reconciliation_escalated',
          title: 'Partner deposit reconciliation is overdue',
          body: `Partner bank deposit ${request.id} has remained unreconciled for over 48 hours.`,
          data: {
            assignmentAuditLogId: candidate.assignmentAuditLogId,
            bankTransactionId: request.bankTransactionId,
            destination: `/finance-tax/partner-bank-deposits/${encodeURIComponent(request.id)}`,
            financeReviewStatus: 'OPEN',
            partnerBankDepositRequestId: request.id,
            source: 'partner_bank_deposit_reconciliation_escalation_sweep',
          },
        },
        select: { id: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: fallbackRecipient.id,
          action: PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_ACTION,
          target,
          metadata: {
            assigneeAdminId: candidate.assigneeAdminId,
            assignedAt: candidate.assignedAt?.toISOString() ?? null,
            assignmentAuditLogId: candidate.assignmentAuditLogId,
            notificationId: notification.id,
            partnerBankDepositRequestId: request.id,
            recipientAdminId: fallbackRecipient.id,
            remainingAmount: Math.max(0, targetAmount - matchedAmount),
            reviewStartedAt: candidate.reviewStartedAt.toISOString(),
            source: 'system_sweep',
            triggeredAt: triggeredAt.toISOString(),
          },
        },
      });

      return 'ESCALATED' as const;
    });
  }

  async syncCompanyBankTransactionReviewEscalationResolutions(now = new Date()) {
    const notifications = await this.prisma.notification.findMany({
      where: notificationFinanceOverdueWhere('open'),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: COMPANY_BANK_TRANSACTION_REVIEW_RESOLUTION_SWEEP_LIMIT,
      select: { data: true, id: true, type: true, userId: true },
    });
    const results: Array<'RESOLVED' | 'OPEN' | 'SKIPPED'> = [];
    for (const notification of notifications) {
      results.push(await this.resolveCompanyBankTransactionReviewEscalation(notification, now));
    }

    return {
      openCount: results.filter((result) => result === 'OPEN').length,
      resolvedCount: results.filter((result) => result === 'RESOLVED').length,
      scannedCount: notifications.length,
      skippedCount: results.filter((result) => result === 'SKIPPED').length,
    };
  }

  private resolveCompanyBankTransactionReviewEscalation(
    notification: { data: Prisma.JsonValue | null; id: string; type: string; userId: string },
    resolvedAt: Date,
  ) {
    const lockKey = `finance_review_escalation_resolution:${notification.id}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const current = await tx.notification.findUnique({
        where: { id: notification.id },
        select: { data: true, id: true, type: true, userId: true },
      });
      if (!current || !ADMIN_NOTIFICATION_FINANCE_OVERDUE_TYPES.includes(
        current.type as (typeof ADMIN_NOTIFICATION_FINANCE_OVERDUE_TYPES)[number],
      )) {
        return 'SKIPPED' as const;
      }
      const data = jsonObject(current.data);
      if (jsonString(data.financeReviewStatus) === 'RESOLVED') return 'SKIPPED' as const;

      const bankTransactionId = jsonString(data.bankTransactionId);
      const batchImportId = jsonString(data.batchImportId);
      const partnerBankDepositRequestId = jsonString(data.partnerBankDepositRequestId);
      let sourceResolved = false;
      if (partnerBankDepositRequestId) {
        const request = await tx.partnerBankDepositRequest.findUnique({
          where: { id: partnerBankDepositRequestId },
          select: { amount: true, journalBatchId: true, status: true },
        });
        if (!request || request.status !== PartnerBankDepositRequestStatus.EXECUTED) {
          sourceResolved = true;
        } else {
          const bankCashEntry = request.journalBatchId
            ? await tx.accountingJournalEntry.findFirst({
                where: {
                  accountCode: 'company_bank_cash',
                  batchId: request.journalBatchId,
                  side: AccountingJournalEntrySide.DEBIT,
                },
                select: {
                  amount: true,
                  bankReconciliationMatches: {
                    where: {
                      status: {
                        in: [
                          BankReconciliationStatus.MATCHED,
                          BankReconciliationStatus.PARTIALLY_MATCHED,
                        ],
                      },
                    },
                    select: { amount: true },
                  },
                },
              })
            : null;
          const targetAmount = bankCashEntry?.amount ?? request.amount;
          const matchedAmount = bankCashEntry?.bankReconciliationMatches.reduce(
            (sum, match) => sum + Math.abs(match.amount),
            0,
          ) ?? 0;
          sourceResolved = matchedAmount >= targetAmount;
        }
      } else if (bankTransactionId) {
        const bankTransaction = await tx.companyBankTransaction.findUnique({
          where: { id: bankTransactionId },
          select: { status: true },
        });
        sourceResolved = Boolean(
          bankTransaction &&
          bankTransaction.status !== BankReconciliationStatus.UNMATCHED &&
          bankTransaction.status !== BankReconciliationStatus.PARTIALLY_MATCHED,
        );
      } else if (batchImportId) {
        const openTransactionCount = await tx.companyBankTransaction.count({
          where: {
            metadata: { path: ['batchImportId'], equals: batchImportId },
            status: {
              in: [
                BankReconciliationStatus.UNMATCHED,
                BankReconciliationStatus.PARTIALLY_MATCHED,
              ],
            },
          },
        });
        sourceResolved = openTransactionCount === 0;
      } else {
        return 'SKIPPED' as const;
      }
      if (!sourceResolved) return 'OPEN' as const;

      const existingAudit = await tx.adminAuditLog.findFirst({
        where: {
          action: partnerBankDepositRequestId
            ? PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_RESOLVED_ACTION
            : COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_RESOLVED_ACTION,
          target: `notification:${current.id}`,
        },
        select: { id: true },
      });
      if (existingAudit) return 'SKIPPED' as const;

      await tx.notification.update({
        where: { id: current.id },
        data: {
          data: {
            ...data,
            financeReviewResolvedAt: resolvedAt.toISOString(),
            financeReviewStatus: 'RESOLVED',
          },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: current.userId,
          action: partnerBankDepositRequestId
            ? PARTNER_BANK_DEPOSIT_RECONCILIATION_ESCALATION_RESOLVED_ACTION
            : COMPANY_BANK_TRANSACTION_REVIEW_ESCALATION_RESOLVED_ACTION,
          target: `notification:${current.id}`,
          metadata: {
            bankTransactionId,
            batchImportId,
            partnerBankDepositRequestId,
            notificationId: current.id,
            notificationType: current.type,
            resolvedAt: resolvedAt.toISOString(),
            source: 'system_sweep',
          },
        },
      });

      return 'RESOLVED' as const;
    });
  }

  private escalateCompanyBankTransactionImportBatch(
    candidate: AdminCompanyBankTransactionImportBatchEscalationRow,
    triggeredAt: Date,
  ) {
    const target = `company_bank_transaction_batch:${candidate.batchImportId}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${target}))`);

      const existing = await tx.adminAuditLog.findFirst({
        where: {
          action: COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_ACTION,
          target,
        },
        select: { id: true },
      });
      if (existing) return 'SKIPPED' as const;

      const preferredRecipientIds = Array.from(
        new Set(
          [candidate.assigneeAdminId, candidate.importerAdminId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      );
      const preferredRecipients = preferredRecipientIds.length
        ? await tx.user.findMany({
            where: {
              id: { in: preferredRecipientIds },
              roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
            },
            select: { id: true },
          })
        : [];
      const preferredRecipientById = new Map(
        preferredRecipients.map((recipient) => [recipient.id, recipient]),
      );
      const recipient = preferredRecipientIds
        .map((id) => preferredRecipientById.get(id))
        .find((value) => Boolean(value)) ?? await tx.user.findFirst({
          where: { roles: { has: Role.MASTER_ADMIN } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
      if (!recipient) return 'MISSING_RECIPIENT' as const;

      const notification = await tx.notification.create({
        data: {
          userId: recipient.id,
          type: 'admin.finance.bank_statement_batch.escalated',
          title: 'Bank statement batch needs escalation',
          body: `Bank statement batch ${candidate.batchImportId} has waited over 48 hours and needs reconciliation.`,
          data: {
            batchImportId: candidate.batchImportId,
            destination: `/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(candidate.batchImportId)}`,
            financeReviewStatus: 'OPEN',
            source: 'bank_statement_batch_escalation_sweep',
          },
        },
        select: { id: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: recipient.id,
          action: COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_ACTION,
          target,
          metadata: {
            assigneeAdminId: candidate.assigneeAdminId,
            batchImportId: candidate.batchImportId,
            importedAt: candidate.importedAt.toISOString(),
            importerAdminId: candidate.importerAdminId,
            notificationId: notification.id,
            openTransactionCount: Number(candidate.openTransactionCount),
            recipientAdminId: recipient.id,
            source: 'system_sweep',
            triggeredAt: triggeredAt.toISOString(),
          },
        },
      });

      return 'ESCALATED' as const;
    });
  }

  async companyBankTransactionImportBatchDetail(batchImportId: string) {
    const normalizedBatchImportId = normalizeRequiredId(batchImportId, 'Bank statement import batch id');
    const log = await this.prisma.adminAuditLog.findFirst({
      where: {
        action: COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION,
        target: `company_bank_transaction_batch:${normalizedBatchImportId}`,
      },
      select: adminAuditLogSelect,
    });
    if (!log) {
      throw new NotFoundException('Bank statement import batch not found');
    }
    const batch = adminCompanyBankTransactionImportBatchHistoryItem(log);
    const rowResults = adminCompanyBankTransactionImportBatchRowResults(log.metadata);
    const transactionIds = Array.from(
      new Set(rowResults.map((row) => row.transactionId).filter((id): id is string => Boolean(id))),
    );
    const [approver, assignee, transactions, assignmentAuditLogs] = await Promise.all([
      batch.approvalAdminId
        ? this.prisma.user.findUnique({
            where: { id: batch.approvalAdminId },
            select: { id: true, email: true, fullName: true },
          })
        : null,
      batch.assigneeAdminId
        ? this.prisma.user.findUnique({
            where: { id: batch.assigneeAdminId },
            select: { id: true, email: true, fullName: true },
          })
        : null,
      transactionIds.length
        ? this.prisma.companyBankTransaction.findMany({
            where: { id: { in: transactionIds } },
            select: {
              id: true,
              amount: true,
              currency: true,
              occurredAt: true,
              status: true,
              transferRef: true,
              type: true,
            },
          })
        : [],
      this.prisma.adminAuditLog.findMany({
        where: {
          action: COMPANY_BANK_TRANSACTION_BATCH_ASSIGNMENT_ACTION,
          target: `company_bank_transaction_batch:${normalizedBatchImportId}`,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          actorId: true,
          createdAt: true,
          metadata: true,
          actor: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);
    const assignmentAdminIds = adminFinanceReviewAssignmentReferencedIds(assignmentAuditLogs);
    const assignmentAdmins = assignmentAdminIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assignmentAdminIds } },
          select: { id: true, email: true, fullName: true },
        })
      : [];
    const assignmentAdminsById = new Map(assignmentAdmins.map((admin) => [admin.id, admin]));
    const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    const transactionStatusById = new Map(
      transactions.map((transaction) => [transaction.id, transaction.status]),
    );

    return {
      ...batch,
      ...companyBankTransactionImportBatchReconciliationSummary(
        transactionIds,
        transactionStatusById,
        batch.createdAt,
      ),
      assignee,
      approver,
      assignmentHistory: adminFinanceReviewAssignmentHistory(
        assignmentAuditLogs,
        assignmentAdminsById,
      ),
      rows: rowResults.map((row) => ({
        ...row,
        transaction: row.transactionId ? (transactionsById.get(row.transactionId) ?? null) : null,
      })),
    };
  }

  async assignCompanyBankTransactionImportBatch(
    actorId: string,
    batchImportId: string,
    input: AssignCompanyBankTransactionImportBatchDto,
  ) {
    const normalizedBatchImportId = normalizeRequiredId(batchImportId, 'Bank statement import batch id');
    const assigneeAdminId = normalizeRequiredId(input.assigneeAdminId, 'Assignee admin id');
    const reason = normalizeAuditReason(input.reason);
    const target = `company_bank_transaction_batch:${normalizedBatchImportId}`;
    const [batchLog, assigneeRecord] = await Promise.all([
      this.prisma.adminAuditLog.findFirst({
        where: { action: COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION, target },
        select: adminAuditLogSelect,
      }),
      this.prisma.user.findFirst({
        where: {
          id: assigneeAdminId,
          roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          adminOperatorPermission: { select: { categories: true } },
        },
      }),
    ]);
    if (!batchLog) throw new NotFoundException('Bank statement import batch not found');
    if (!assigneeRecord) {
      throw new BadRequestException('Finance reconciliation assignee is not an active Admin operator');
    }
    const assigneeCategories = assigneeRecord.adminOperatorPermission?.categories ??
      defaultAdminOperatorPermissionCategories(assigneeRecord.roles);
    if (
      !assigneeRecord.roles.includes(Role.MASTER_ADMIN) &&
      !assigneeCategories.includes(AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION)
    ) {
      throw new BadRequestException('Selected operator does not have Bank Reconciliation access');
    }
    const assignee = {
      id: assigneeRecord.id,
      email: assigneeRecord.email,
      fullName: assigneeRecord.fullName,
    };

    const previousMetadata = jsonObject(batchLog.metadata);
    const previousAssigneeAdminId = jsonString(previousMetadata.assigneeAdminId);
    if (previousAssigneeAdminId === assigneeAdminId) {
      throw new ConflictException('Bank statement import batch is already assigned to this operator');
    }
    const assignedAt = new Date();
    const metadata = {
      ...previousMetadata,
      assigneeAdminId,
      assignedAt: assignedAt.toISOString(),
      assignedByAdminId: actorId,
    } satisfies Prisma.InputJsonObject;
    const [, assignmentAuditLog] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.update({
        where: { id: batchLog.id },
        data: { metadata },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          actorId,
          action: COMPANY_BANK_TRANSACTION_BATCH_ASSIGNMENT_ACTION,
          target,
          metadata: {
            assigneeAdminId,
            assignedAt: assignedAt.toISOString(),
            previousAssigneeAdminId,
            reason,
          },
        },
      }),
    ]);
    const batch = await this.companyBankTransactionImportBatchDetail(normalizedBatchImportId);
    const escalated = batch.reconciliationSlaStatus === 'ESCALATE';
    const notification = await this.notifications.createInApp({
      userId: assigneeAdminId,
      type: escalated
        ? 'admin.finance.bank_statement_batch.escalated'
        : 'admin.finance.bank_statement_batch.assigned',
      resolveTemplate: false,
      title: escalated ? 'Escalated bank statement batch assigned' : 'Bank statement batch assigned',
      body: escalated
        ? `Bank statement batch ${normalizedBatchImportId} has waited over 48 hours and needs reconciliation.`
        : `Bank statement batch ${normalizedBatchImportId} needs reconciliation.`,
      data: {
        batchImportId: normalizedBatchImportId,
        destination: `/finance-tax/bank-reconciliation/import-batches/${encodeURIComponent(normalizedBatchImportId)}`,
        reason,
        source: 'bank_statement_batch_assignment',
      },
    });

    return {
      assignee,
      assignedAt,
      assignedByAdminId: actorId,
      assignmentAuditLogId: assignmentAuditLog.id,
      batchImportId: normalizedBatchImportId,
      notification: { id: notification.id, inAppOnly: true },
      previousAssigneeAdminId,
      reason,
    };
  }

  async assignCompanyBankTransactionReview(
    actorId: string,
    bankTransactionId: string,
    input: AssignCompanyBankTransactionReviewDto,
  ) {
    const normalizedTransactionId = normalizeRequiredId(
      bankTransactionId,
      'Bank transaction id',
    );
    const assigneeAdminId = normalizeRequiredId(input.assigneeAdminId, 'Assignee admin id');
    const reason = normalizeAuditReason(input.reason);
    const target = `bank_transaction:${normalizedTransactionId}`;
    const [transaction, assigneeRecord, previousAssignment] = await Promise.all([
      this.prisma.companyBankTransaction.findUnique({
        where: { id: normalizedTransactionId },
        select: { id: true, status: true },
      }),
      this.prisma.user.findFirst({
        where: {
          id: assigneeAdminId,
          roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          adminOperatorPermission: { select: { categories: true } },
        },
      }),
      this.prisma.adminAuditLog.findFirst({
        where: { action: COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION, target },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { metadata: true },
      }),
    ]);
    if (!transaction) throw new NotFoundException('Bank transaction not found');
    if (
      transaction.status !== BankReconciliationStatus.UNMATCHED &&
      transaction.status !== BankReconciliationStatus.PARTIALLY_MATCHED
    ) {
      throw new BadRequestException('Only an open bank transaction can be assigned for review');
    }
    if (!assigneeRecord) {
      throw new BadRequestException('Finance reconciliation assignee is not an active Admin operator');
    }
    const assigneeCategories =
      assigneeRecord.adminOperatorPermission?.categories ??
      defaultAdminOperatorPermissionCategories(assigneeRecord.roles);
    if (
      !assigneeRecord.roles.includes(Role.MASTER_ADMIN) &&
      !assigneeCategories.includes(AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION)
    ) {
      throw new BadRequestException('Selected operator does not have Bank Reconciliation access');
    }
    const previousAssigneeAdminId = jsonString(
      jsonObject(previousAssignment?.metadata ?? null).assigneeAdminId,
    );
    if (previousAssigneeAdminId === assigneeAdminId) {
      throw new ConflictException('Bank transaction is already assigned to this operator');
    }

    const assignedAt = new Date();
    const assignmentAuditLog = await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION,
        target,
        metadata: {
          assigneeAdminId,
          assignedAt: assignedAt.toISOString(),
          assignedByAdminId: actorId,
          bankStatus: transaction.status,
          bankTransactionId: normalizedTransactionId,
          previousAssigneeAdminId,
          reason,
        },
      },
    });
    const notification = await this.notifications.createInApp({
      userId: assigneeAdminId,
      type: 'admin.finance.bank_transaction.review_assigned',
      resolveTemplate: false,
      title: 'Bank transaction review assigned',
      body: `Bank transaction ${normalizedTransactionId} needs reconciliation evidence review.`,
      data: {
        bankTransactionId: normalizedTransactionId,
        destination: `/finance-tax/bank-reconciliation/${encodeURIComponent(normalizedTransactionId)}`,
        reason,
        source: 'bank_transaction_review_assignment',
      },
    });

    return {
      assignee: {
        id: assigneeRecord.id,
        email: assigneeRecord.email,
        fullName: assigneeRecord.fullName,
      },
      assignedAt,
      assignedByAdminId: actorId,
      assignmentAuditLogId: assignmentAuditLog.id,
      bankTransactionId: normalizedTransactionId,
      notification: { id: notification.id, inAppOnly: true },
      previousAssigneeAdminId,
      reason,
    };
  }

  async assignPartnerBankDepositReconciliationReview(
    actorId: string,
    requestId: string,
    input: AssignCompanyBankTransactionReviewDto,
  ) {
    const normalizedRequestId = normalizeRequiredId(requestId, 'Partner bank deposit request id');
    const assigneeAdminId = normalizeRequiredId(input.assigneeAdminId, 'Assignee admin id');
    const reason = normalizeAuditReason(input.reason);
    const target = `partner_bank_deposit_request:${normalizedRequestId}`;
    const [request, assigneeRecord, previousAssignment] = await Promise.all([
      this.prisma.partnerBankDepositRequest.findUnique({
        where: { id: normalizedRequestId },
        select: {
          amount: true,
          bankTransactionId: true,
          id: true,
          journalBatchId: true,
          status: true,
        },
      }),
      this.prisma.user.findFirst({
        where: {
          id: assigneeAdminId,
          roles: { hasSome: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          adminOperatorPermission: { select: { categories: true } },
        },
      }),
      this.prisma.adminAuditLog.findFirst({
        where: { action: PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION, target },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { metadata: true },
      }),
    ]);
    if (!request) throw new NotFoundException('Partner bank deposit request not found');
    if (request.status !== PartnerBankDepositRequestStatus.EXECUTED) {
      throw new BadRequestException('Only an executed Partner bank deposit can be assigned for reconciliation');
    }
    if (!assigneeRecord) {
      throw new BadRequestException('Finance reconciliation assignee is not an active Admin operator');
    }
    const assigneeCategories =
      assigneeRecord.adminOperatorPermission?.categories ??
      defaultAdminOperatorPermissionCategories(assigneeRecord.roles);
    if (
      !assigneeRecord.roles.includes(Role.MASTER_ADMIN) &&
      !assigneeCategories.includes(AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION)
    ) {
      throw new BadRequestException('Selected operator does not have Bank Reconciliation access');
    }

    const bankCashEntry = request.journalBatchId
      ? await this.prisma.accountingJournalEntry.findFirst({
          where: {
            accountCode: 'company_bank_cash',
            batchId: request.journalBatchId,
            side: AccountingJournalEntrySide.DEBIT,
          },
          select: {
            amount: true,
            bankReconciliationMatches: {
              where: {
                status: {
                  in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
                },
              },
              select: { amount: true },
            },
          },
        })
      : null;
    const targetAmount = bankCashEntry?.amount ?? request.amount;
    const matchedAmount = bankCashEntry?.bankReconciliationMatches.reduce(
      (sum, match) => sum + Math.abs(match.amount),
      0,
    ) ?? 0;
    if (matchedAmount >= targetAmount) {
      throw new ConflictException('Partner bank deposit is already fully reconciled');
    }

    const previousAssigneeAdminId = jsonString(
      jsonObject(previousAssignment?.metadata ?? null).assigneeAdminId,
    );
    if (previousAssigneeAdminId === assigneeAdminId) {
      throw new ConflictException('Partner bank deposit reconciliation is already assigned to this operator');
    }

    const assignedAt = new Date();
    const assignmentAuditLog = await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION,
        target,
        metadata: {
          assigneeAdminId,
          assignedAt: assignedAt.toISOString(),
          assignedByAdminId: actorId,
          bankTransactionId: request.bankTransactionId,
          partnerBankDepositRequestId: normalizedRequestId,
          previousAssigneeAdminId,
          reason,
          remainingAmount: Math.max(0, targetAmount - matchedAmount),
        },
      },
    });
    const notification = await this.notifications.createInApp({
      userId: assigneeAdminId,
      type: 'admin.finance.partner_bank_deposit.reconciliation_assigned',
      resolveTemplate: false,
      title: 'Partner deposit reconciliation assigned',
      body: `Partner bank deposit ${normalizedRequestId} needs bank evidence reconciliation.`,
      data: {
        partnerBankDepositRequestId: normalizedRequestId,
        destination: `/finance-tax/partner-bank-deposits/${encodeURIComponent(normalizedRequestId)}`,
        reason,
        source: 'partner_bank_deposit_reconciliation_assignment',
      },
    });

    return {
      assignee: {
        id: assigneeRecord.id,
        email: assigneeRecord.email,
        fullName: assigneeRecord.fullName,
      },
      assignedAt,
      assignedByAdminId: actorId,
      assignmentAuditLogId: assignmentAuditLog.id,
      notification: { id: notification.id, inAppOnly: true },
      partnerBankDepositRequestId: normalizedRequestId,
      previousAssigneeAdminId,
      reason,
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
    const matchIds = new Set(transaction.reconciliationMatches.map((match) => match.id));
    const matchTargets = [...matchIds].map((matchId) => `bank_reconciliation_match:${matchId}`);
    const [auditLogs, assignmentAuditLogs] = await Promise.all([
      matchIds.size
        ? this.prisma.adminAuditLog.findMany({
          where: {
            OR: [
              {
                action: 'bank_reconciliation.match.create',
                target: `bank_transaction:${id}`,
              },
              {
                action: 'bank_reconciliation.match.reverse',
                target: { in: matchTargets },
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(Math.max(matchIds.size * 4, 20), 200),
          select: {
            action: true,
            actorId: true,
            createdAt: true,
            metadata: true,
            actor: { select: { id: true, email: true, fullName: true } },
          },
        })
        : Promise.resolve([]),
      this.prisma.adminAuditLog.findMany({
        where: {
          action: COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION,
          target: `bank_transaction:${id}`,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          actorId: true,
          createdAt: true,
          metadata: true,
          actor: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);
    const transactionMetadata = jsonObject(transaction.metadata);
    const referencedAdminIds = Array.from(
      new Set(
        [
          ...auditLogs.map((auditLog) => jsonString(jsonObject(auditLog.metadata).approvalAdminId)),
          ...adminFinanceReviewAssignmentReferencedIds(assignmentAuditLogs),
          jsonString(transactionMetadata.approvalAdminId),
          jsonString(transactionMetadata.importedByAdminId),
          jsonString(transactionMetadata.ignoreApprovedByAdminId),
          jsonString(transactionMetadata.ignoredByAdminId),
        ].filter((adminId): adminId is string => Boolean(adminId)),
      ),
    );
    const referencedAdmins = referencedAdminIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: referencedAdminIds } },
          select: { id: true, email: true, fullName: true },
        })
      : [];
    const referencedAdminsById = new Map(referencedAdmins.map((admin) => [admin.id, admin]));
    const createAuditByMatchId = new Map<string, (typeof auditLogs)[number]>();
    const reverseAuditByMatchId = new Map<string, (typeof auditLogs)[number]>();
    for (const auditLog of auditLogs) {
      const matchId = jsonString(jsonObject(auditLog.metadata).matchId);
      if (!matchId || !matchIds.has(matchId)) continue;
      if (
        auditLog.action === 'bank_reconciliation.match.create' &&
        !createAuditByMatchId.has(matchId)
      ) {
        createAuditByMatchId.set(matchId, auditLog);
      }
      if (
        auditLog.action === 'bank_reconciliation.match.reverse' &&
        !reverseAuditByMatchId.has(matchId)
      ) {
        reverseAuditByMatchId.set(matchId, auditLog);
      }
    }
    const withdrawalCandidates = await this.bankReconciliationWithdrawalCandidates(transaction);
    const { metadata, reconciliationMatches, ...publicTransaction } = transaction;
    return {
      ...publicTransaction,
      creationEvidence: adminBankTransactionCreationEvidence(metadata, referencedAdminsById),
      ignoreEvidence: adminBankTransactionIgnoreEvidence(metadata, referencedAdminsById),
      reconciliationMatches: reconciliationMatches.map((match) => ({
        ...match,
        metadata: {
          ...jsonObject(match.metadata),
          ...adminBankReconciliationMatchAuditMetadata(
            createAuditByMatchId.get(match.id),
            referencedAdminsById,
          ),
          ...adminBankReconciliationMatchReversalAuditMetadata(
            reverseAuditByMatchId.get(match.id),
            referencedAdminsById,
          ),
        },
      })),
      assignmentHistory: adminFinanceReviewAssignmentHistory(
        assignmentAuditLogs,
        referencedAdminsById,
      ),
      withdrawalCandidates,
    };
  }

  private async bankReconciliationWithdrawalCandidates(transaction: {
    amount: number;
    currency: string;
    occurredAt: Date;
    status: BankReconciliationStatus;
    transferRef: string | null;
    type: CompanyBankTransactionType;
  }) {
    if (
      transaction.type !== CompanyBankTransactionType.OUTFLOW ||
      (transaction.status !== BankReconciliationStatus.UNMATCHED &&
        transaction.status !== BankReconciliationStatus.PARTIALLY_MATCHED)
    ) {
      return [];
    }

    const targetAmount = Math.abs(transaction.amount);
    const amountTolerance = Math.max(10_000, Math.min(100_000, Math.round(targetAmount * 0.1)));
    const transferRef = normalizeNullable(transaction.transferRef);
    const occurredAt = new Date(transaction.occurredAt);
    const createdAtWindow = {
      gte: new Date(occurredAt.getTime() - BANK_RECONCILIATION_WITHDRAWAL_CANDIDATE_WINDOW_MS),
      lte: new Date(occurredAt.getTime() + BANK_RECONCILIATION_WITHDRAWAL_CANDIDATE_WINDOW_MS),
    };
    const candidates = await this.prisma.providerWalletWithdrawalRequest.findMany({
      where: {
        status: ProviderWalletWithdrawalRequestStatus.PAID,
        currency: transaction.currency,
        createdAt: createdAtWindow,
        bankReconciliationMatches: {
          none: {
            status: {
              in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
            },
          },
        },
        OR: [
          {
            amount: {
              gte: Math.max(1, targetAmount - amountTolerance),
              lte: targetAmount + amountTolerance,
            },
          },
          ...(transferRef
            ? [
                {
                  transferRef: {
                    equals: transferRef,
                    mode: Prisma.QueryMode.insensitive,
                  },
                } satisfies Prisma.ProviderWalletWithdrawalRequestWhereInput,
              ]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: BANK_RECONCILIATION_WITHDRAWAL_CANDIDATE_LIMIT,
      select: {
        id: true,
        amount: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        providerProfileId: true,
        transferRef: true,
        providerProfile: {
          select: {
            displayName: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    return candidates
      .map((candidate) => {
        const evidenceAt = candidate.paidAt ?? candidate.createdAt;
        const dateDeltaDays = Math.round(
          (Math.abs(evidenceAt.getTime() - occurredAt.getTime()) / (24 * 60 * 60_000)) * 10,
        ) / 10;
        const amountDelta = Math.abs(candidate.amount - targetAmount);
        const transferRefMatch = Boolean(
          transferRef && candidate.transferRef?.trim().toUpperCase() === transferRef.toUpperCase(),
        );
        const exactAmount = amountDelta === 0;
        const confidence =
          transferRefMatch || (exactAmount && dateDeltaDays <= 3) ? 'STRONG' : 'REVIEW';
        const score =
          (transferRefMatch ? 1_000_000 : 0) +
          (exactAmount ? 100_000 : Math.max(0, amountTolerance - amountDelta)) +
          Math.max(0, 10_000 - Math.round(dateDeltaDays * 100));

        return {
          amount: candidate.amount,
          amountDelta,
          confidence,
          createdAt: candidate.createdAt,
          currency: candidate.currency,
          dateDeltaDays,
          exactAmount,
          id: candidate.id,
          paidAt: candidate.paidAt,
          providerLabel:
            candidate.providerProfile.displayName ??
            candidate.providerProfile.user.fullName ??
            candidate.providerProfileId,
          providerProfileId: candidate.providerProfileId,
          score,
          transferRef: candidate.transferRef,
          transferRefMatch,
        };
      })
      .sort((left, right) => right.score - left.score)
      .map((candidate) => ({
        amount: candidate.amount,
        amountDelta: candidate.amountDelta,
        confidence: candidate.confidence,
        createdAt: candidate.createdAt,
        currency: candidate.currency,
        dateDeltaDays: candidate.dateDeltaDays,
        exactAmount: candidate.exactAmount,
        id: candidate.id,
        paidAt: candidate.paidAt,
        providerLabel: candidate.providerLabel,
        providerProfileId: candidate.providerProfileId,
        transferRef: candidate.transferRef,
        transferRefMatch: candidate.transferRefMatch,
      }));
  }

  async createCompanyBankTransaction(
    actorId: string,
    input: CreateCompanyBankTransactionDto,
    batchContext?: AdminCompanyBankTransactionBatchContext,
  ) {
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
    const operatorReason = normalizeNullable(input.operatorReason);
    const duplicateCandidates = await this.prisma.companyBankTransaction.findMany({
      where: companyBankTransactionDuplicateCandidateWhere({
        amount,
        bankAccountId,
        counterpartyName,
        currency,
        occurredAt,
        transferRef,
        type,
      }),
      orderBy: { occurredAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        counterpartyName: true,
        occurredAt: true,
        status: true,
        transferRef: true,
      },
    });
    if (duplicateCandidates.length > 0 && input.confirmPotentialDuplicate !== true) {
      throw new ConflictException({
        code: 'BANK_TRANSACTION_POTENTIAL_DUPLICATE',
        message: 'Potential duplicate bank transaction requires explicit operator review',
        candidates: duplicateCandidates,
      });
    }
    const duplicateCandidateIds = duplicateCandidates.map((candidate) => candidate.id);
    const transaction = await this.prisma.companyBankTransaction.create({
      data: {
        amount,
        bankAccountId,
        counterpartyName,
        currency,
        description,
        metadata: toJson({
          approvalAdminId,
          ...(batchContext
            ? {
                batchImportId: batchContext.batchImportId,
                csvRowNumber: batchContext.csvRowNumber,
                mappingPreset: batchContext.mappingPreset,
                sourceFileName: batchContext.sourceFileName,
                sourceFileSha256: batchContext.sourceFileSha256,
              }
            : {}),
          duplicateCandidateIds,
          duplicateReviewConfirmed: duplicateCandidates.length > 0 && input.confirmPotentialDuplicate === true,
          manualImport: true,
          importedByAdminId: actorId,
          ...(operatorReason ? { operatorReason } : {}),
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
        ...(batchContext
          ? {
              batchImportId: batchContext.batchImportId,
              csvRowNumber: batchContext.csvRowNumber,
              mappingPreset: batchContext.mappingPreset,
              sourceFileName: batchContext.sourceFileName,
              sourceFileSha256: batchContext.sourceFileSha256,
            }
          : {}),
        currency,
        duplicateCandidateIds,
        duplicateReviewConfirmed: duplicateCandidates.length > 0 && input.confirmPotentialDuplicate === true,
        occurredAt: occurredAt.toISOString(),
        ...(operatorReason ? { operatorReason } : {}),
        sourceKey,
        transferRef,
        type,
      },
    );

    return transaction;
  }

  async previewCompanyBankTransactionBatch(input: PreviewCompanyBankTransactionBatchDto) {
    const rows: AdminCompanyBankTransactionBatchPreviewRow[] = [];
    const bankAccountCache = new Map<string, AdminCompanyBankTransactionBatchAccount | null>();

    for (const inputRow of input.rows) {
      const row = await this.previewCompanyBankTransactionRow(inputRow, bankAccountCache);
      if (row.normalized && row.classification !== 'INVALID') {
        const priorRows = rows.filter(
          (candidate): candidate is AdminCompanyBankTransactionBatchPreviewRow & {
            normalized: AdminCompanyBankTransactionBatchNormalizedRow;
          } => Boolean(candidate.normalized) && candidate.classification !== 'INVALID',
        );
        const exactBatchDuplicate = priorRows.find(
          (candidate) => candidate.normalized.sourceKey === row.normalized?.sourceKey,
        );
        if (exactBatchDuplicate) {
          row.classification = 'EXACT_DUPLICATE';
          row.batchCandidateRowNumbers = [exactBatchDuplicate.rowNumber];
        } else {
          const potentialBatchDuplicates = priorRows
            .filter((candidate) =>
              companyBankTransactionRowsPotentialDuplicate(candidate.normalized, row.normalized!),
            )
            .map((candidate) => candidate.rowNumber)
            .slice(0, 5);
          if (potentialBatchDuplicates.length > 0 && row.classification === 'NEW') {
            row.classification = 'POTENTIAL_DUPLICATE';
            row.batchCandidateRowNumbers = potentialBatchDuplicates;
          }
        }
      }
      rows.push(row);
    }

    return {
      rows,
      summary: companyBankTransactionBatchSummary(rows),
    };
  }

  async importCompanyBankTransactionBatch(actorId: string, input: ImportCompanyBankTransactionBatchDto) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Company bank transaction batch import',
    );
    await assertFinanceActionApprovalAdmin(
      this.prisma,
      approvalAdminId,
      'Company bank transaction batch import',
    );
    const batchImportId = randomUUID();
    const sourceFileName = input.sourceFileName.replace(/^.*[\\/]/u, '');
    const sourceFileSha256 = input.sourceFileSha256.toLowerCase();
    const preview = await this.previewCompanyBankTransactionBatch({ rows: input.rows });
    const inputRows = new Map(input.rows.map((row) => [row.rowNumber, row]));
    const results: Array<{
      rowNumber: number;
      status: 'IMPORTED' | 'SKIPPED';
      classification: AdminCompanyBankTransactionBatchClassification;
      transactionId?: string;
      message?: string;
    }> = [];

    for (const row of preview.rows) {
      const requestedRow = inputRows.get(row.rowNumber);
      if (!requestedRow || !row.normalized || row.classification === 'INVALID') {
        results.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED',
          classification: row.classification,
          message: row.errors[0] ?? 'Invalid row',
        });
        continue;
      }
      if (row.classification === 'EXACT_DUPLICATE') {
        results.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED',
          classification: row.classification,
          message: 'Exact duplicate rows cannot be imported',
        });
        continue;
      }
      if (row.classification === 'POTENTIAL_DUPLICATE' && requestedRow.confirmPotentialDuplicate !== true) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED',
          classification: row.classification,
          message: 'Potential duplicate review is required',
        });
        continue;
      }

      try {
        const transaction = await this.createCompanyBankTransaction(
          actorId,
          {
            ...row.normalized,
            approvalAdminId,
            confirmPotentialDuplicate: row.classification === 'POTENTIAL_DUPLICATE',
            operatorReason: input.operatorReason,
          },
          {
            batchImportId,
            csvRowNumber: row.rowNumber,
            mappingPreset: input.mappingPreset,
            sourceFileName,
            sourceFileSha256,
          },
        );
        results.push({
          rowNumber: row.rowNumber,
          status: 'IMPORTED',
          classification: row.classification,
          transactionId: transaction.id,
        });
      } catch {
        results.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED',
          classification: row.classification,
          message: 'Row changed during review or could not be imported',
        });
      }
    }

    const importedCount = results.filter((row) => row.status === 'IMPORTED').length;
    await this.writeAudit(
      actorId,
      COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION,
      `company_bank_transaction_batch:${batchImportId}`,
      {
        approvalAdminId,
        batchImportId,
        importedCount,
        mappingPreset: input.mappingPreset,
        ...(input.operatorReason ? { operatorReason: input.operatorReason } : {}),
        requestedCount: input.rows.length,
        rowResults: results.map((row) => ({
          classification: row.classification,
          rowNumber: row.rowNumber,
          status: row.status,
          ...(row.transactionId ? { transactionId: row.transactionId } : {}),
        })),
        skippedCount: results.length - importedCount,
        sourceFileName,
        sourceFileSha256,
      },
    );

    return {
      batchImportId,
      importedCount,
      skippedCount: results.length - importedCount,
      results,
    };
  }

  private async previewCompanyBankTransactionRow(
    input: CompanyBankTransactionBatchRowDto,
    bankAccountCache: Map<string, AdminCompanyBankTransactionBatchAccount | null>,
  ): Promise<AdminCompanyBankTransactionBatchPreviewRow> {
    const errors: string[] = [];
    const bankAccountId = normalizeNullable(input.bankAccountId);
    const type = batchCompanyBankTransactionType(input.type);
    const amount = parseCompanyBankTransactionBatchAmount(input.amount);
    const occurredAt = parseCompanyBankTransactionBatchDate(input.occurredAt);
    const valueDate = input.valueDate ? parseCompanyBankTransactionBatchDate(input.valueDate) : null;
    if (!bankAccountId) errors.push('Bank account is required');
    if (!type) errors.push('Type must be INFLOW or OUTFLOW');
    if (!amount) errors.push('Amount must be a positive whole number');
    if (!occurredAt) errors.push('Occurred at must be a valid date and time');
    if (input.valueDate && !valueDate) errors.push('Value date must be a valid date');

    if (errors.length > 0 || !bankAccountId || !type || !amount || !occurredAt) {
      return companyBankTransactionInvalidBatchRow(input, errors);
    }

    let bankAccount = bankAccountCache.get(bankAccountId);
    if (!bankAccountCache.has(bankAccountId)) {
      bankAccount = await this.prisma.companyBankAccount.findUnique({
        where: { id: bankAccountId },
        select: { id: true, currency: true, status: true },
      });
      bankAccountCache.set(bankAccountId, bankAccount);
    }
    if (!bankAccount) {
      return companyBankTransactionInvalidBatchRow(input, ['Company bank account was not found']);
    }
    if (bankAccount.status !== CompanyBankAccountStatus.ACTIVE) {
      return companyBankTransactionInvalidBatchRow(input, ['Company bank account is not active']);
    }

    const currency = normalizeCompanyBankTransactionCurrency(input.currency, bankAccount.currency);
    const transferRef = normalizeNullable(input.transferRef);
    const counterpartyName = normalizeNullable(input.counterpartyName);
    const normalized: AdminCompanyBankTransactionBatchNormalizedRow = {
      amount,
      bankAccountId,
      counterpartyName,
      currency,
      description: normalizeNullable(input.description),
      occurredAt: occurredAt.toISOString(),
      sourceKey: companyBankTransactionSourceKey({
        amount,
        bankAccountId,
        occurredAt,
        sourceKey: input.sourceKey,
        transferRef,
        type,
      }),
      transferRef,
      type,
      valueDate: valueDate?.toISOString() ?? null,
    };
    const exactDuplicate = await this.prisma.companyBankTransaction.findUnique({
      where: { sourceKey: normalized.sourceKey },
      select: adminCompanyBankTransactionDuplicateCandidateSelect,
    });
    if (exactDuplicate) {
      return {
        batchCandidateRowNumbers: [],
        candidates: [exactDuplicate],
        classification: 'EXACT_DUPLICATE',
        errors: [],
        normalized,
        raw: companyBankTransactionBatchRawRow(input),
        rowNumber: input.rowNumber,
      };
    }

    const candidates = await this.prisma.companyBankTransaction.findMany({
      where: companyBankTransactionDuplicateCandidateWhere({
        amount,
        bankAccountId,
        counterpartyName,
        currency,
        occurredAt,
        transferRef,
        type,
      }),
      orderBy: { occurredAt: 'desc' },
      take: 5,
      select: adminCompanyBankTransactionDuplicateCandidateSelect,
    });
    return {
      batchCandidateRowNumbers: [],
      candidates,
      classification: candidates.length > 0 ? 'POTENTIAL_DUPLICATE' : 'NEW',
      errors: [],
      normalized,
      raw: companyBankTransactionBatchRawRow(input),
      rowNumber: input.rowNumber,
    };
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
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Bank reconciliation match');
    const requestedSource = adminBankReconciliationMatchSource(input);
    return this.prisma.$transaction(async (tx) => {
      const bankTransaction = await tx.companyBankTransaction.findUnique({
        where: { id: bankTransactionId },
        select: {
          id: true,
          amount: true,
          currency: true,
          occurredAt: true,
          status: true,
          transferRef: true,
          type: true,
        },
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

      const source = await this.resolveBankReconciliationSource(tx, requestedSource);
      const sourceSnapshot = await this.validateBankReconciliationSource(
        tx,
        source,
        currency,
        bankTransaction.type,
      );
      const withdrawalEvidence =
        'withdrawalEvidence' in sourceSnapshot ? sourceSnapshot.withdrawalEvidence : null;
      const withdrawalRecommendationEvidence =
        source.type === 'withdrawal' && withdrawalEvidence
          ? bankReconciliationWithdrawalRecommendationEvidence(bankTransaction, withdrawalEvidence)
          : null;
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
          ...(source.accountingJournalEntryId
            ? { accountingJournalEntryId: source.accountingJournalEntryId }
            : {}),
          amount: input.amount,
          currency,
          status: BankReconciliationStatus.MATCHED,
          matchedByAdminId: actorId,
          notes: normalizeNullable(input.notes),
          sourceKey: bankReconciliationMatchSourceKey(bankTransactionId, source),
          metadata: {
            manual: true,
            sourceType: source.type,
            ...(source.accountingJournalEntryId
              ? { accountingJournalEntryId: source.accountingJournalEntryId }
              : {}),
            ...(source.partnerBankDepositRequestId
              ? { partnerBankDepositRequestId: source.partnerBankDepositRequestId }
              : {}),
            ...(withdrawalRecommendationEvidence
              ? { withdrawalRecommendationEvidence }
              : {}),
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
            ...(source.accountingJournalEntryId
              ? { accountingJournalEntryId: source.accountingJournalEntryId }
              : {}),
            ...(source.partnerBankDepositRequestId
              ? { partnerBankDepositRequestId: source.partnerBankDepositRequestId }
              : {}),
            ...(withdrawalRecommendationEvidence
              ? { withdrawalRecommendationEvidence }
              : {}),
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

  async ignoreCompanyBankTransaction(
    actorId: string,
    bankTransactionId: string,
    input: IgnoreCompanyBankTransactionDto,
  ) {
    const approvalAdminId = normalizeFinanceActionApprovalAdminId(
      input.approvalAdminId,
      actorId,
      'Bank transaction ignore',
    );
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Bank transaction ignore');

    return this.prisma.$transaction(async (tx) => {
      const bankTransaction = await tx.companyBankTransaction.findUnique({
        where: { id: bankTransactionId },
        select: {
          id: true,
          amount: true,
          currency: true,
          metadata: true,
          status: true,
        },
      });
      if (!bankTransaction) {
        throw new NotFoundException('Bank transaction not found');
      }
      if (bankTransaction.status !== BankReconciliationStatus.UNMATCHED) {
        throw new BadRequestException('Only an unmatched bank transaction can be ignored');
      }

      const activeMatchCount = await tx.bankReconciliationMatch.count({
        where: {
          bankTransactionId,
          status: { in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED] },
        },
      });
      if (activeMatchCount > 0) {
        throw new BadRequestException('Reverse active reconciliation matches before ignoring this bank transaction');
      }

      const reason = input.reason.trim();
      const ignoredAt = new Date();
      const updatedBankTransaction = await tx.companyBankTransaction.update({
        where: { id: bankTransactionId },
        data: {
          status: BankReconciliationStatus.IGNORED,
          metadata: toJson({
            ...(adminJsonObject(bankTransaction.metadata) ?? {}),
            ignoredAt: ignoredAt.toISOString(),
            ignoredByAdminId: actorId,
            ignoreApprovedByAdminId: approvalAdminId,
            ignoreReason: reason,
          }),
        },
        select: adminCompanyBankTransactionListSelect,
      });
      const auditLog = await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'bank_reconciliation.transaction.ignore',
          target: `bank_transaction:${bankTransactionId}`,
          metadata: {
            amount: bankTransaction.amount,
            approvalAdminId,
            bankStatusBefore: bankTransaction.status,
            bankStatusAfter: updatedBankTransaction.status,
            bankTransactionId,
            currency: bankTransaction.currency,
            ignoredAt: ignoredAt.toISOString(),
            reason,
          },
        },
      });

      return { auditLog, bankTransaction: updatedBankTransaction };
    });
  }

  private async resolveBankReconciliationSource(
    tx: Prisma.TransactionClient,
    source: AdminBankReconciliationMatchSource,
  ): Promise<AdminBankReconciliationMatchSource> {
    if (source.type === 'withdrawal') {
      const request = await tx.providerWalletWithdrawalRequest.findUnique({
        where: { id: source.id },
        select: { id: true, status: true },
      });
      if (!request) {
        throw new NotFoundException('Provider withdrawal request not found');
      }
      if (request.status !== ProviderWalletWithdrawalRequestStatus.PAID) {
        throw new BadRequestException('Only a paid Partner withdrawal can be reconciled');
      }

      const bankCashEntry = await tx.accountingJournalEntry.findFirst({
        where: {
          side: AccountingJournalEntrySide.CREDIT,
          accountCode: 'company_bank_cash',
          batch: {
            sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
            sourceId: request.id,
          },
        },
        select: { id: true },
      });
      if (!bankCashEntry) {
        throw new ConflictException('Provider withdrawal paid bank cash journal entry is missing');
      }

      return { ...source, accountingJournalEntryId: bankCashEntry.id };
    }

    if (source.type !== 'partner-bank-deposit') {
      return source;
    }

    const request = await tx.partnerBankDepositRequest.findUnique({
      where: { id: source.id },
      select: { id: true, status: true, journalBatchId: true },
    });
    if (!request) {
      throw new NotFoundException('Partner bank deposit request not found');
    }
    if (request.status !== PartnerBankDepositRequestStatus.EXECUTED) {
      throw new BadRequestException('Only an executed Partner bank deposit can be reconciled');
    }
    if (!request.journalBatchId) {
      throw new ConflictException('Partner bank deposit journal evidence is incomplete');
    }

    const bankCashEntry = await tx.accountingJournalEntry.findFirst({
      where: {
        batchId: request.journalBatchId,
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: 'company_bank_cash',
      },
      select: { id: true },
    });
    if (!bankCashEntry) {
      throw new ConflictException('Partner bank deposit bank cash journal entry is missing');
    }

    return {
      field: 'accountingJournalEntryId',
      id: bankCashEntry.id,
      key: 'partner-bank-deposit',
      type: 'partner-bank-deposit',
      partnerBankDepositRequestId: request.id,
    };
  }

  private async validateBankReconciliationSource(
    tx: Prisma.TransactionClient,
    source: AdminBankReconciliationMatchSource,
    currency: string,
    bankTransactionType: CompanyBankTransactionType,
  ) {
    if (source.type === 'accounting-journal' || source.type === 'partner-bank-deposit') {
      const row = await tx.accountingJournalEntry.findUnique({
        where: { id: source.id },
        select: {
          amount: true,
          currency: true,
          side: true,
          accountCode: true,
          batch: { select: { sourceType: true } },
        },
      });
      if (!row) {
        throw new NotFoundException('Accounting journal entry not found');
      }
      if (row.currency !== currency) {
        throw new BadRequestException('Match currency must equal accounting journal entry currency');
      }
      if (row.batch.sourceType === AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT) {
        if (bankTransactionType !== CompanyBankTransactionType.INFLOW) {
          throw new BadRequestException('Partner bank deposit journals can only match bank inflows');
        }
        if (row.side !== AccountingJournalEntrySide.DEBIT || row.accountCode !== 'company_bank_cash') {
          throw new BadRequestException('Partner bank deposits must match the company bank cash debit entry');
        }
      }
      if (row.batch.sourceType === AccountingJournalSourceType.PROVIDER_WITHDRAWAL) {
        if (bankTransactionType !== CompanyBankTransactionType.OUTFLOW) {
          throw new BadRequestException('Partner withdrawal journals can only match bank outflows');
        }
        if (row.side !== AccountingJournalEntrySide.CREDIT || row.accountCode !== 'company_bank_cash') {
          throw new BadRequestException('Partner withdrawals must match the company bank cash credit entry');
        }
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
      if (bankTransactionType !== CompanyBankTransactionType.OUTFLOW) {
        throw new BadRequestException('Partner withdrawals can only match bank outflows');
      }
      const row = await tx.providerWalletWithdrawalRequest.findUnique({
        where: { id: source.id },
        select: {
          amount: true,
          createdAt: true,
          currency: true,
          paidAt: true,
          status: true,
          transferRef: true,
        },
      });
      if (!row) {
        throw new NotFoundException('Provider withdrawal request not found');
      }
      if (row.status !== ProviderWalletWithdrawalRequestStatus.PAID) {
        throw new BadRequestException('Only a paid Partner withdrawal can be reconciled');
      }
      if (row.currency !== currency) {
        throw new BadRequestException('Match currency must equal withdrawal currency');
      }
      return {
        amount: row.amount,
        withdrawalEvidence: {
          amount: row.amount,
          createdAt: row.createdAt,
          paidAt: row.paidAt,
          transferRef: row.transferRef,
        },
      };
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
      this.prisma.$queryRaw<
        Array<{
          partnerCountWithRevenue: bigint | number | null;
          partnerDepositReconciliationOpenAmount: bigint | number | null;
          partnerDepositReconciliationOpenCount: bigint | number | null;
          paymentFeeReviewFlagCount: bigint | number | null;
        }>
      >(Prisma.sql`
          WITH ${adminPartnerBankDepositReconciliationCteSql({ period })}
          SELECT
            COUNT(DISTINCT "providerProfileId")::bigint AS "partnerCountWithRevenue",
            COUNT(*) FILTER (
              WHERE "paymentFeePolicyVersionId" IS NULL
                OR COALESCE("paymentFeeRuleSnapshot" ? 'reason', false)
            )::bigint AS "paymentFeeReviewFlagCount",
            (SELECT COUNT(*)::bigint FROM "openPartnerBankDeposits") AS "partnerDepositReconciliationOpenCount",
            (SELECT COALESCE(SUM("remainingAmount"), 0)::bigint FROM "openPartnerBankDeposits") AS "partnerDepositReconciliationOpenAmount"
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
      paymentFeeReviewFlagCount: numberValue(providerCount?.paymentFeeReviewFlagCount),
      partnerDepositReconciliationOpenCount: numberValue(
        providerCount?.partnerDepositReconciliationOpenCount,
      ),
      partnerDepositReconciliationOpenAmount: numberValue(
        providerCount?.partnerDepositReconciliationOpenAmount,
      ),
      cashDebtTotal: (cashTotals._sum.platformFeeGross ?? 0) + (cashTotals._sum.partnerWithholdingTotal ?? 0),
      nonCashPartnerPayoutTotal: nonCashTotals._sum.partnerPayoutAmount ?? 0,
      partnerCountWithRevenue: numberValue(providerCount?.partnerCountWithRevenue),
      openTaxCount,
      paidTaxCount,
      reconciliationDelta:
        customerPaymentAmountTotal - partnerPayoutTotal - partnerWithholdingTotal - platformFeeGrossTotal,
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
    assertMonthlyTaxClosingPaymentFeeEvidenceIsReady(summary, status);
    assertMonthlyTaxClosingPartnerDepositReconciliationIsReady(summary, status);
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
    const generatedAt = new Date();
    const [totals, payerGroups, treatmentGroups, activePolicy] = await Promise.all([
      this.prisma.bookingSettlementSnapshot.aggregate({
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
      this.prisma.paymentFeePolicyVersion.findFirst({
        where: {
          status: TaxPolicyStatus.ACTIVE,
          effectiveFrom: { lte: generatedAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: generatedAt } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
          rules: {
            where: { active: true },
            orderBy: [{ method: 'asc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              method: true,
              feeType: true,
              rateBps: true,
              fixedAmount: true,
              payer: true,
              treatment: true,
            },
          },
        },
      }),
    ]);
    const configuredMethods = Array.from(new Set(activePolicy?.rules.map((rule) => rule.method) ?? []));
    const missingMethods = Object.values(PaymentMethod).filter(
      (method) => !configuredMethods.includes(method),
    );
    const remediationReadiness = adminPaymentFeeRemediationReadiness(activePolicy, period);
    const evidenceCondition = adminPaymentFeeEvidenceSqlCondition();
    const expectedFeeExpression = adminPaymentFeeExpectedAmountSql(activePolicy?.rules ?? []);
    const methodGroups = await this.prisma.$queryRaw<AdminPaymentFeeMethodEvidenceGroupRow[]>(Prisma.sql`
      SELECT
        "paymentMethod"::text AS "paymentMethod",
        COUNT(*)::bigint AS "settlementCount",
        COUNT(*) FILTER (WHERE ${evidenceCondition})::bigint AS "evidenceReviewCount",
        COALESCE(SUM("customerPaymentAmount"), 0)::bigint AS "customerPaymentAmountTotal",
        COALESCE(
          SUM(CASE WHEN ${evidenceCondition} THEN "customerPaymentAmount" ELSE 0 END),
          0
        )::bigint AS "evidenceCustomerPaymentAmountTotal",
        COALESCE(SUM("paymentProcessingFee"), 0)::bigint AS "paymentProcessingFeeTotal",
        COALESCE(
          SUM(CASE WHEN ${evidenceCondition} THEN "paymentProcessingFee" ELSE 0 END),
          0
        )::bigint AS "evidenceRecordedFeeTotal",
        COALESCE(
          SUM(CASE WHEN ${evidenceCondition} THEN ${expectedFeeExpression} ELSE 0 END),
          0
        )::bigint AS "remediationExpectedFeeTotal"
      FROM "BookingSettlementSnapshot"
      WHERE "monthlyPeriod" = ${period}
      GROUP BY "paymentMethod"
      ORDER BY "paymentMethod" ASC
    `);
    const byPaymentMethod = methodGroups.map((group) => {
      const evidenceRecordedFeeTotal = Number(group.evidenceRecordedFeeTotal ?? 0);
      const remediationExpectedFeeTotal = remediationReadiness.ready
        ? Number(group.remediationExpectedFeeTotal ?? 0)
        : null;
      return {
        paymentMethod: group.paymentMethod as PaymentMethod,
        settlementCount: Number(group.settlementCount ?? 0),
        evidenceReviewCount: Number(group.evidenceReviewCount ?? 0),
        customerPaymentAmountTotal: Number(group.customerPaymentAmountTotal ?? 0),
        evidenceCustomerPaymentAmountTotal: Number(group.evidenceCustomerPaymentAmountTotal ?? 0),
        paymentProcessingFeeTotal: Number(group.paymentProcessingFeeTotal ?? 0),
        evidenceRecordedFeeTotal,
        remediationExpectedFeeTotal,
        remediationDelta:
          remediationExpectedFeeTotal === null
            ? null
            : remediationExpectedFeeTotal - evidenceRecordedFeeTotal,
      };
    });
    const remediationPreview = byPaymentMethod.reduce(
      (preview, group) => ({
        ...preview,
        evidenceReviewCount: preview.evidenceReviewCount + group.evidenceReviewCount,
        evidenceCustomerPaymentAmountTotal:
          preview.evidenceCustomerPaymentAmountTotal + group.evidenceCustomerPaymentAmountTotal,
        recordedFeeTotal: preview.recordedFeeTotal + group.evidenceRecordedFeeTotal,
        expectedFeeTotal:
          preview.expectedFeeTotal === null || group.remediationExpectedFeeTotal === null
            ? null
            : preview.expectedFeeTotal + group.remediationExpectedFeeTotal,
        delta:
          preview.delta === null || group.remediationDelta === null
            ? null
            : preview.delta + group.remediationDelta,
      }),
      {
        status: remediationReadiness.ready ? ('READY' as const) : ('BLOCKED' as const),
        policyVersionId: activePolicy?.id ?? null,
        blockers: remediationReadiness.blockers,
        evidenceReviewCount: 0,
        evidenceCustomerPaymentAmountTotal: 0,
        recordedFeeTotal: 0,
        expectedFeeTotal: remediationReadiness.ready ? 0 : null,
        delta: remediationReadiness.ready ? 0 : null,
      },
    );

    return {
      period,
      currency: 'VND',
      settlementCount: totals._count._all,
      customerPaymentAmountTotal: totals._sum.customerPaymentAmount ?? 0,
      paymentProcessingFeeTotal: totals._sum.paymentProcessingFee ?? 0,
      byPaymentMethod,
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
      policyReadiness: {
        activePolicy,
        configuredMethods,
        missingMethods,
        status: !activePolicy
          ? ('MISSING_ACTIVE_POLICY' as const)
          : missingMethods.length
            ? ('MISSING_METHOD_RULES' as const)
            : ('READY' as const),
      },
      remediationPreview,
    };
  }

  listPaymentFeePolicies(options: { take?: number | string | null } = {}) {
    return this.prisma.paymentFeePolicyVersion.findMany({
      take: adminPaymentFeePolicyListTake(options.take),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: adminPaymentFeePolicyVersionSelect,
    });
  }

  async financeApprovalQueue(options: AdminFinanceApprovalQueueQuery = {}) {
    const take = adminBoundedPositiveInteger(
      options.take,
      ADMIN_FINANCE_APPROVAL_QUEUE_DEFAULT_LIMIT,
      ADMIN_FINANCE_APPROVAL_QUEUE_MAX_LIMIT,
    );
    const walletEvidenceFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const withdrawalStatuses = [...FINANCE_APPROVAL_QUEUE_WITHDRAWAL_STATUSES];
    const [
      policyRequests,
      withdrawalRequests,
      withdrawalGroups,
      customerWalletCount,
      partnerWalletCount,
      walletAdjustmentRequests,
      partnerBankDepositRequests,
      partnerBankDepositCompletedLast7dCount,
    ] =
      await Promise.all([
        this.prisma.$queryRaw<AdminFinanceApprovalPolicyRequestRow[]>(Prisma.sql`
          WITH latest_payment_fee_approval AS (
            SELECT DISTINCT ON ("target")
              "id",
              "action",
              "target",
              "metadata",
              "createdAt",
              "actorId"
            FROM "AdminAuditLog"
            WHERE "action" IN (${Prisma.join(paymentFeePolicyApprovalActions)})
              AND "target" LIKE 'payment_fee_policy:%'
            ORDER BY "target", "createdAt" DESC, "id" DESC
          )
          SELECT
            latest."id" AS "requestId",
            latest."metadata",
            latest."createdAt" AS "requestedAt",
            latest."actorId",
            actor."email" AS "actorEmail",
            actor."fullName" AS "actorFullName",
            policy."id" AS "policyId",
            policy."name" AS "policyName",
            policy."effectiveFrom",
            policy."updatedAt" AS "policyUpdatedAt",
            COUNT(*) OVER ()::bigint AS "totalCount"
          FROM latest_payment_fee_approval latest
          JOIN "PaymentFeePolicyVersion" policy
            ON policy."id" = split_part(latest."target", ':', 2)
           AND policy."status" = ${TaxPolicyStatus.DRAFT}::"TaxPolicyStatus"
          JOIN "User" actor ON actor."id" = latest."actorId"
          WHERE latest."action" = 'payment_fee_policy.approval_requested'
          ORDER BY latest."createdAt" DESC, latest."id" DESC
          LIMIT ${take}
        `),
        this.prisma.providerWalletWithdrawalRequest.findMany({
          where: { status: { in: withdrawalStatuses } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take,
          select: {
            id: true,
            providerProfileId: true,
            bankAccountId: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            providerProfile: {
              select: {
                displayName: true,
                user: { select: { fullName: true } },
              },
            },
          },
        }),
        this.prisma.providerWalletWithdrawalRequest.groupBy({
          by: ['status'],
          where: { status: { in: withdrawalStatuses } },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.customerWalletLedgerEntry.count({
          where: {
            ...manualWalletAdjustmentCustomerWhere(null),
            createdAt: { gte: walletEvidenceFrom },
          },
        }),
        this.prisma.providerWalletLedgerEntry.count({
          where: {
            ...manualWalletAdjustmentProviderWhere(null),
            createdAt: { gte: walletEvidenceFrom },
          },
        }),
        this.prisma.$queryRaw<AdminFinanceApprovalWalletAdjustmentRequestRow[]>(Prisma.sql`
          SELECT
            request."id",
            request."ownerType",
            request."ownerId",
            request."direction",
            request."adjustmentType",
            request."amount",
            request."currency",
            request."reason",
            request."monthlyPeriod",
            request."attachmentUrl",
            request."requestedBeforeBalance",
            request."requestedAfterBalance",
            request."requiresAttachment",
            request."requestedByAdminId",
            request."createdAt",
            requester."fullName" AS "requesterFullName",
            requester."email" AS "requesterEmail",
            COALESCE(customer_user."fullName", provider_profile."displayName", provider_user."fullName", request."ownerId")
              AS "ownerName",
            COUNT(*) OVER ()::bigint AS "totalCount"
          FROM "ManualWalletAdjustmentRequest" request
          JOIN "User" requester ON requester."id" = request."requestedByAdminId"
          LEFT JOIN "CustomerProfile" customer_profile
            ON request."ownerType" = 'CUSTOMER' AND customer_profile."id" = request."ownerId"
          LEFT JOIN "User" customer_user ON customer_user."id" = customer_profile."userId"
          LEFT JOIN "ProviderProfile" provider_profile
            ON request."ownerType" = 'PARTNER' AND provider_profile."id" = request."ownerId"
          LEFT JOIN "User" provider_user ON provider_user."id" = provider_profile."userId"
          WHERE request."status" = ${ManualWalletAdjustmentRequestStatus.REQUESTED}::"ManualWalletAdjustmentRequestStatus"
          ORDER BY request."createdAt" DESC, request."id" DESC
          LIMIT ${take}
        `),
        this.prisma.$queryRaw<AdminFinanceApprovalPartnerBankDepositRequestRow[]>(Prisma.sql`
          SELECT
            request."id",
            request."providerProfileId",
            request."amount",
            request."currency",
            request."bankTransactionId",
            request."depositDate",
            request."bankAccount",
            request."attachmentFileId",
            request."attachmentUrl",
            request."notes",
            request."requestedBeforeBalance",
            request."requestedAfterBalance",
            request."requestedReceivableRecovery",
            request."requestedWalletLiabilityIncrease",
            request."requestedByAdminId",
            request."createdAt",
            requester."fullName" AS "requesterFullName",
            requester."email" AS "requesterEmail",
            COALESCE(provider."displayName", provider_user."fullName", request."providerProfileId")
              AS "partnerName",
            COUNT(*) OVER ()::bigint AS "totalCount"
          FROM "PartnerBankDepositRequest" request
          JOIN "User" requester ON requester."id" = request."requestedByAdminId"
          LEFT JOIN "ProviderProfile" provider ON provider."id" = request."providerProfileId"
          LEFT JOIN "User" provider_user ON provider_user."id" = provider."userId"
          WHERE request."status" = ${PartnerBankDepositRequestStatus.REQUESTED}::"PartnerBankDepositRequestStatus"
          ORDER BY request."createdAt" DESC, request."id" DESC
          LIMIT ${take}
        `),
        this.prisma.partnerBankDepositRequest.count({
          where: {
            status: PartnerBankDepositRequestStatus.EXECUTED,
            executedAt: { gte: walletEvidenceFrom },
          },
        }),
      ]);

    const withdrawalStats = new Map(
      withdrawalGroups.map((group) => [
        group.status,
        { amount: group._sum.amount ?? 0, count: group._count._all },
      ]),
    );
    const withdrawalCount = (status: ProviderWalletWithdrawalRequestStatus) =>
      withdrawalStats.get(status)?.count ?? 0;
    const withdrawalOpenCount = withdrawalGroups.reduce((total, group) => total + group._count._all, 0);
    const withdrawalOpenAmount = withdrawalGroups.reduce(
      (total, group) => total + (group._sum.amount ?? 0),
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      limit: take,
      summary: {
        paymentFeePolicyPendingCount: numberValue(policyRequests[0]?.totalCount),
        withdrawalOpenCount,
        withdrawalRequestedCount: withdrawalCount(ProviderWalletWithdrawalRequestStatus.REQUESTED),
        withdrawalReviewRequiredCount: withdrawalCount(
          ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
        ),
        withdrawalBankTransferPendingCount: withdrawalCount(
          ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
        ),
        withdrawalOpenAmount,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: customerWalletCount + partnerWalletCount,
        walletAdjustmentPendingCount: numberValue(walletAdjustmentRequests[0]?.totalCount),
        partnerBankDepositPendingCount: numberValue(partnerBankDepositRequests[0]?.totalCount),
        partnerBankDepositLast7dCount: partnerBankDepositCompletedLast7dCount,
      },
      paymentFeePolicyRequests: policyRequests.map((row) => {
        const metadata = paymentFeePolicyApprovalMetadata(row.metadata);
        return {
          requestId: row.requestId,
          policyId: row.policyId,
          policyName: row.policyName,
          effectiveFrom: row.effectiveFrom,
          policyUpdatedAt: row.policyUpdatedAt,
          reason: metadata.reason ?? null,
          requestedAt: row.requestedAt,
          requestedBy: metadata.requestedBy ?? {
            id: row.actorId,
            email: row.actorEmail,
            fullName: row.actorFullName,
          },
        };
      }),
      withdrawalRequests: withdrawalRequests.map((request) => ({
        id: request.id,
        providerProfileId: request.providerProfileId,
        partnerName:
          request.providerProfile.displayName ?? request.providerProfile.user.fullName ?? request.providerProfileId,
        amount: request.amount,
        currency: request.currency,
        status: request.status,
        hasBankAccount: Boolean(request.bankAccountId),
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })),
      walletAdjustmentRequests: walletAdjustmentRequests.map((request) => ({
        id: request.id,
        ownerType: request.ownerType,
        ownerId: request.ownerId,
        ownerName: request.ownerName,
        direction: request.direction,
        adjustmentType: request.adjustmentType,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
        monthlyPeriod: request.monthlyPeriod,
        attachmentUrl: request.attachmentUrl,
        requestedBeforeBalance: request.requestedBeforeBalance,
        requestedAfterBalance: request.requestedAfterBalance,
        requiresAttachment: request.requiresAttachment,
        createdAt: request.createdAt,
        requestedBy: {
          id: request.requestedByAdminId,
          fullName: request.requesterFullName,
          email: request.requesterEmail,
        },
      })),
      walletAdjustmentEvidence: {
        last7dCount: customerWalletCount + partnerWalletCount,
        pendingQueueSupported: true,
      },
      partnerBankDepositRequests: partnerBankDepositRequests.map((request) => ({
        id: request.id,
        providerProfileId: request.providerProfileId,
        partnerName: request.partnerName,
        amount: request.amount,
        currency: request.currency,
        bankTransactionId: request.bankTransactionId,
        depositDate: request.depositDate,
        bankAccount: request.bankAccount,
        attachmentFileId: request.attachmentFileId,
        attachmentUrl: request.attachmentUrl,
        notes: request.notes,
        requestedBeforeBalance: request.requestedBeforeBalance,
        requestedAfterBalance: request.requestedAfterBalance,
        requestedReceivableRecovery: request.requestedReceivableRecovery,
        requestedWalletLiabilityIncrease: request.requestedWalletLiabilityIncrease,
        createdAt: request.createdAt,
        requestedBy: {
          id: request.requestedByAdminId,
          fullName: request.requesterFullName,
          email: request.requesterEmail,
        },
      })),
    };
  }

  async paymentFeePolicyPreflight(
    policyId: string,
    options: { sampleAmount?: number | string | null } = {},
  ) {
    const policy = await this.prisma.paymentFeePolicyVersion.findUnique({
      where: { id: policyId },
      select: adminPaymentFeePolicyVersionSelect,
    });
    if (!policy) {
      throw new NotFoundException(`Payment fee policy ${policyId} was not found`);
    }

    return paymentFeePolicyPreflightResult(policy, adminPaymentFeePolicySampleAmount(options.sampleAmount));
  }

  async paymentFeePolicyApproval(policyId: string) {
    const policy = await this.prisma.paymentFeePolicyVersion.findUnique({
      where: { id: policyId },
      select: adminPaymentFeePolicyVersionSelect,
    });
    if (!policy) {
      throw new NotFoundException(`Payment fee policy ${policyId} was not found`);
    }
    const event = await this.prisma.adminAuditLog.findFirst({
      where: {
        action: { in: [...paymentFeePolicyApprovalActions] },
        target: `payment_fee_policy:${policyId}`,
      },
      orderBy: { createdAt: 'desc' },
      select: adminPaymentFeePolicyApprovalRequestSelect,
    });

    return paymentFeePolicyApprovalView(policy, event);
  }

  async createPaymentFeePolicy(
    actorId: string,
    input: {
      name: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ) {
    const data = normalizePaymentFeePolicyInput(input);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.paymentFeePolicyVersion.create({
        data: {
          ...data,
          status: TaxPolicyStatus.DRAFT,
          createdById: actorId,
        },
        select: adminPaymentFeePolicyVersionSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'payment_fee_policy.create_draft',
          target: `payment_fee_policy:${policy.id}`,
          metadata: {
            effectiveFrom: policy.effectiveFrom.toISOString(),
            effectiveTo: policy.effectiveTo?.toISOString() ?? null,
            name: policy.name,
            status: policy.status,
          },
        },
      });
      return policy;
    });
  }

  async updatePaymentFeePolicy(
    actorId: string,
    policyId: string,
    input: {
      name?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentFeePolicyVersion.findUnique({
        where: { id: policyId },
        select: {
          id: true,
          status: true,
          name: true,
          effectiveFrom: true,
          effectiveTo: true,
          notes: true,
        },
      });
      assertPaymentFeeDraft(existing, policyId);
      const data = normalizePaymentFeePolicyInput({
        name: input.name ?? existing.name,
        effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom.toISOString(),
        effectiveTo: Object.prototype.hasOwnProperty.call(input, 'effectiveTo')
          ? input.effectiveTo
          : existing.effectiveTo?.toISOString() ?? null,
        notes: Object.prototype.hasOwnProperty.call(input, 'notes') ? input.notes : existing.notes,
      });
      const policy = await tx.paymentFeePolicyVersion.update({
        where: { id: policyId },
        data,
        select: adminPaymentFeePolicyVersionSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'payment_fee_policy.update_draft',
          target: `payment_fee_policy:${policy.id}`,
          metadata: {
            effectiveFrom: policy.effectiveFrom.toISOString(),
            effectiveTo: policy.effectiveTo?.toISOString() ?? null,
            name: policy.name,
          },
        },
      });
      return policy;
    });
  }

  async upsertPaymentFeeRule(
    actorId: string,
    policyId: string,
    input: {
      method: PaymentMethod;
      feeType: PaymentFeeRuleType;
      rateBps: number;
      fixedAmount: number;
      payer: PaymentFeePayer;
      treatment: PaymentFeeTreatment;
    },
  ) {
    assertPaymentFeeRuleValues(input);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.paymentFeePolicyVersion.findUnique({
        where: { id: policyId },
        select: { id: true, status: true },
      });
      assertPaymentFeeDraft(policy, policyId);
      const existingRule = await tx.paymentFeeRule.findFirst({
        where: { policyVersionId: policyId, method: input.method, active: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      const rule = existingRule
        ? await tx.paymentFeeRule.update({
            where: { id: existingRule.id },
            data: input,
          })
        : await tx.paymentFeeRule.create({
            data: { ...input, policyVersionId: policyId, active: true },
          });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'payment_fee_policy.rule_upsert',
          target: `payment_fee_policy:${policyId}`,
          metadata: {
            feeType: rule.feeType,
            fixedAmount: rule.fixedAmount,
            method: rule.method,
            payer: rule.payer,
            rateBps: rule.rateBps,
            ruleId: rule.id,
            treatment: rule.treatment,
          },
        },
      });
      return rule;
    });
  }

  async requestPaymentFeePolicyApproval(
    actorId: string,
    policyId: string,
    input: { reason: string },
    operatorIdentity?: string,
  ) {
    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, operatorIdentity);
    if (!operator) {
      throw new ForbiddenException('Payment fee policy approval requests require a signed-in admin operator');
    }
    const reason = normalizeAuditReason(input.reason);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.paymentFeePolicyVersion.findUnique({
        where: { id: policyId },
        select: adminPaymentFeePolicyVersionSelect,
      });
      assertPaymentFeeDraft(policy, policyId);
      assertPaymentFeePolicyReadyForActivation(policy);
      const policyFingerprint = paymentFeePolicyFingerprint(policy);
      const latestEvent = await tx.adminAuditLog.findFirst({
        where: {
          action: { in: [...paymentFeePolicyApprovalActions] },
          target: `payment_fee_policy:${policyId}`,
        },
        orderBy: { createdAt: 'desc' },
        select: adminPaymentFeePolicyApprovalRequestSelect,
      });
      if (
        latestEvent?.action === 'payment_fee_policy.approval_requested' &&
        paymentFeePolicyApprovalMetadata(latestEvent.metadata).policyFingerprint === policyFingerprint
      ) {
        throw new BadRequestException('Payment fee policy approval is already requested for this draft revision');
      }
      const request = await tx.adminAuditLog.create({
        data: {
          actorId: operator.id,
          action: 'payment_fee_policy.approval_requested',
          target: `payment_fee_policy:${policyId}`,
          metadata: {
            operatorIdentity: operatorIdentity ?? operator.email ?? operator.id,
            policyFingerprint,
            reason,
            requestedByAdminId: actorId,
          },
        },
        select: adminPaymentFeePolicyApprovalRequestSelect,
      });

      return paymentFeePolicyApprovalView(policy, request);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async rejectPaymentFeePolicyApproval(
    actorId: string,
    policyId: string,
    input: { reason: string },
    operatorIdentity?: string,
  ) {
    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, operatorIdentity);
    if (!operator) {
      throw new ForbiddenException('Payment fee policy rejection requires a signed-in admin operator');
    }
    await assertFinanceActionApprovalAdmin(this.prisma, operator.id, 'Payment fee policy rejection');

    return this.closePaymentFeePolicyApproval(
      policyId,
      input.reason,
      operator,
      operatorIdentity,
      'payment_fee_policy.approval_rejected',
    );
  }

  async cancelPaymentFeePolicyApproval(
    actorId: string,
    policyId: string,
    input: { reason: string },
    operatorIdentity?: string,
  ) {
    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, operatorIdentity);
    if (!operator) {
      throw new ForbiddenException('Payment fee policy approval cancellation requires a signed-in admin operator');
    }

    return this.closePaymentFeePolicyApproval(
      policyId,
      input.reason,
      operator,
      operatorIdentity,
      'payment_fee_policy.approval_cancelled',
    );
  }

  private closePaymentFeePolicyApproval(
    policyId: string,
    rawReason: string,
    operator: AdminOperatorAccessSummary,
    operatorIdentity: string | undefined,
    action:
      | 'payment_fee_policy.approval_rejected'
      | 'payment_fee_policy.approval_cancelled',
  ) {
    const reason = normalizeAuditReason(rawReason);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.paymentFeePolicyVersion.findUnique({
        where: { id: policyId },
        select: adminPaymentFeePolicyVersionSelect,
      });
      assertPaymentFeeDraft(policy, policyId);
      const request = await tx.adminAuditLog.findFirst({
        where: {
          action: { in: [...paymentFeePolicyApprovalActions] },
          target: `payment_fee_policy:${policyId}`,
        },
        orderBy: { createdAt: 'desc' },
        select: adminPaymentFeePolicyApprovalRequestSelect,
      });
      if (!request || request.action !== 'payment_fee_policy.approval_requested') {
        throw new BadRequestException('Payment fee policy does not have a pending approval request');
      }
      const requestMetadata = paymentFeePolicyApprovalMetadata(request.metadata);
      if (requestMetadata.policyFingerprint !== paymentFeePolicyFingerprint(policy)) {
        throw new BadRequestException('Payment fee policy changed after approval was requested; request approval again');
      }
      if (action === 'payment_fee_policy.approval_rejected' && request.actorId === operator.id) {
        throw new BadRequestException('Payment fee policy rejection requires a different operator from the requester');
      }
      if (action === 'payment_fee_policy.approval_cancelled' && request.actorId !== operator.id) {
        throw new ForbiddenException('Only the requesting operator can cancel this approval request');
      }
      const event = await tx.adminAuditLog.create({
        data: {
          actorId: operator.id,
          action,
          target: `payment_fee_policy:${policyId}`,
          metadata: {
            operatorIdentity: operatorIdentity ?? operator.email ?? operator.id,
            policyFingerprint: requestMetadata.policyFingerprint,
            reason,
            requestId: request.id,
            requestedAt: request.createdAt.toISOString(),
            requestedBy: request.actor,
          },
        },
        select: adminPaymentFeePolicyApprovalRequestSelect,
      });

      return paymentFeePolicyApprovalView(policy, event);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async activatePaymentFeePolicy(
    actorId: string,
    policyId: string,
    input: { approvalAdminId: string; reason: string },
    operatorIdentity?: string,
  ) {
    const operator = await this.findAdminOperatorForIdentity(this.prisma, actorId, operatorIdentity);
    if (!operator) {
      throw new ForbiddenException('Payment fee policy activation requires a signed-in admin operator');
    }
    const approvalAdminId = normalizeNullable(input.approvalAdminId);
    if (!approvalAdminId || approvalAdminId !== operator.id) {
      throw new BadRequestException('Payment fee policy approval must be completed by the signed-in approver');
    }
    await assertFinanceActionApprovalAdmin(this.prisma, approvalAdminId, 'Payment fee policy activation');
    const reason = normalizeAuditReason(input.reason);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentFeePolicyVersion.findUnique({
        where: { id: policyId },
        select: adminPaymentFeePolicyVersionSelect,
      });
      assertPaymentFeeDraft(existing, policyId);
      assertPaymentFeePolicyReadyForActivation(existing);
      const request = await tx.adminAuditLog.findFirst({
        where: {
          action: { in: [...paymentFeePolicyApprovalActions] },
          target: `payment_fee_policy:${policyId}`,
        },
        orderBy: { createdAt: 'desc' },
        select: adminPaymentFeePolicyApprovalRequestSelect,
      });
      if (!request || request.action !== 'payment_fee_policy.approval_requested') {
        throw new BadRequestException('Payment fee policy activation requires a pending approval request');
      }
      if (request.actorId === approvalAdminId) {
        throw new BadRequestException('Payment fee policy approval requires a different operator from the requester');
      }
      const requestMetadata = paymentFeePolicyApprovalMetadata(request.metadata);
      if (requestMetadata.policyFingerprint !== paymentFeePolicyFingerprint(existing)) {
        throw new BadRequestException('Payment fee policy changed after approval was requested; request approval again');
      }
      await tx.paymentFeePolicyVersion.updateMany({
        where: { id: { not: policyId }, status: TaxPolicyStatus.ACTIVE },
        data: { status: TaxPolicyStatus.INACTIVE },
      });
      const activated = await tx.paymentFeePolicyVersion.updateMany({
        where: { id: policyId, status: TaxPolicyStatus.DRAFT },
        data: { status: TaxPolicyStatus.ACTIVE },
      });
      if (activated.count !== 1) {
        throw new BadRequestException('Payment fee policy is no longer available for activation');
      }
      const policy = await tx.paymentFeePolicyVersion.findUniqueOrThrow({
        where: { id: policyId },
        select: adminPaymentFeePolicyVersionSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: approvalAdminId,
          action: 'payment_fee_policy.activate',
          target: `payment_fee_policy:${policy.id}`,
          metadata: {
            approvalAdminId,
            effectiveFrom: policy.effectiveFrom.toISOString(),
            effectiveTo: policy.effectiveTo?.toISOString() ?? null,
            operatorIdentity: operatorIdentity ?? operator.email ?? operator.id,
            reason,
            requestId: request.id,
            requestedById: request.actorId,
            requestedByAdminId: actorId,
            ruleCount: policy.rules.filter((rule) => rule.active).length,
          },
        },
      });
      return policy;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    if (normalizeNullable(input.settlementMethod)?.toUpperCase() === CashFeeSettlementMethod.PARTNER_DEPOSIT) {
      throw new BadRequestException(
        'Approved Partner deposits must be allocated from the deposit request detail instead of direct mark-paid',
      );
    }
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

  async approvePartnerBankDepositFromLegacyRoute(
    actorId: string,
    input: RecordPartnerBankDepositDto,
  ) {
    if (normalizeNullable(input.approvalAdminId) !== actorId) {
      throw new BadRequestException(
        'Legacy partner bank deposit execution requires the signed-in finance approver',
      );
    }
    const request = await this.prisma.partnerBankDepositRequest.findFirst({
      where: {
        providerProfileId: input.providerProfileId,
        bankTransactionId: input.bankTransactionId,
        status: PartnerBankDepositRequestStatus.REQUESTED,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException('A pending partner bank deposit request was not found');
    }
    const result = await this.approvePartnerBankDepositRequest(actorId, request.id, input);
    return result.ledger;
  }

  async createPartnerBankDepositRequest(actorId: string, input: CreatePartnerBankDepositRequestDto) {
    const deposit = normalizePartnerBankDepositInput({ ...input, adminId: actorId });
    const sourceKey = partnerBankDepositLedgerSourceKey(
      deposit.providerProfileId,
      deposit.bankTransactionId,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const provider = await tx.providerProfile.findUnique({
          where: { id: deposit.providerProfileId },
          select: { id: true },
        });
        if (!provider) {
          throw new NotFoundException('Partner profile not found');
        }
        const [existingLedger, pendingRequest, balance] = await Promise.all([
          tx.providerWalletLedgerEntry.findUnique({ where: { sourceKey }, select: { id: true } }),
          tx.partnerBankDepositRequest.findFirst({
            where: {
              providerProfileId: deposit.providerProfileId,
              bankTransactionId: deposit.bankTransactionId,
              status: PartnerBankDepositRequestStatus.REQUESTED,
            },
            select: { id: true },
          }),
          tx.providerWalletLedgerEntry.aggregate({
            where: { providerProfileId: deposit.providerProfileId },
            _sum: { amount: true },
          }),
        ]);
        if (existingLedger) {
          throw new ConflictException('Partner bank deposit was already recorded');
        }
        if (pendingRequest) {
          throw new ConflictException('A partner bank deposit request is already pending for this reference');
        }

        const allocation = allocatePartnerBankDeposit(balance._sum.amount ?? 0, deposit.amount);
        const accountingPreview = partnerBankDepositAccountingPreview(allocation);
        const request = await tx.partnerBankDepositRequest.create({
          data: {
            providerProfileId: deposit.providerProfileId,
            amount: deposit.amount,
            currency: 'VND',
            bankTransactionId: deposit.bankTransactionId,
            depositDate: deposit.depositDate,
            bankAccount: deposit.bankAccount,
            attachmentFileId: deposit.attachmentFileId,
            attachmentUrl: deposit.attachmentUrl,
            notes: deposit.notes,
            requestedBeforeBalance: allocation.currentWalletBalance,
            requestedAfterBalance: allocation.resultingWalletBalance,
            requestedReceivableRecovery: allocation.amountAppliedToNegativeWallet,
            requestedWalletLiabilityIncrease: allocation.amountCreditedToWalletLiability,
            accountingPreview: toJson(accountingPreview),
            requestedByAdminId: actorId,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'partner_bank_deposit_request.create',
            target: `partner_bank_deposit_request:${request.id}`,
            metadata: toJson({
              providerProfileId: request.providerProfileId,
              amount: request.amount,
              currency: request.currency,
              bankTransactionId: request.bankTransactionId,
              depositDate: request.depositDate,
              requestedBeforeBalance: request.requestedBeforeBalance,
              requestedAfterBalance: request.requestedAfterBalance,
              requestedReceivableRecovery: request.requestedReceivableRecovery,
              requestedWalletLiabilityIncrease: request.requestedWalletLiabilityIncrease,
            }),
          },
        });
        return request;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A partner bank deposit request already exists for this Partner and bank reference',
        );
      }
      throw error;
    }
  }

  async listPartnerBankDepositRequests(
    options: { status?: string | null; take?: number | string | null; skip?: number | string | null } = {},
  ) {
    const status = normalizePartnerBankDepositRequestStatus(options.status);
    const requests = await this.prisma.partnerBankDepositRequest.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: boundedAdminListSkip(options.skip),
      take: boundedAdminListLimit(
        options.take ?? ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_DEFAULT_LIMIT,
        ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_MAX_LIMIT,
      ),
    });
    const adminsById = await this.adminOperatorIdentitiesById(
      requests.flatMap((request) => [
        request.requestedByAdminId,
        request.approvedByAdminId,
        request.rejectedByAdminId,
      ]),
    );

    return requests.map((request) => partnerBankDepositRequestWithOperators(request, adminsById));
  }

  async listPartnerBankDepositRequestHistory(
    options: {
      assigneeAdminId?: string | null;
      owner?: string | null;
      status?: string | null;
      review?: string | null;
      sla?: string | null;
      period?: string | null;
      q?: string | null;
      take?: number | string | null;
      skip?: number | string | null;
    } = {},
  ) {
    const status = normalizePartnerBankDepositRequestStatus(options.status);
    const review = normalizePartnerBankDepositReview(options.review);
    const owner = normalizePartnerBankDepositReconciliationOwner(options.owner);
    const assigneeAdminId = normalizeNullable(options.assigneeAdminId);
    const sla = normalizePartnerBankDepositReconciliationSla(options.sla);
    const period = normalizePartnerBankDepositReconciliationPeriod(options.period);
    const query = normalizeNullable(options.q);
    const searchWhere: Prisma.PartnerBankDepositRequestWhereInput = query
      ? {
          OR: [
            { id: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { bankTransactionId: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { providerProfileId: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { providerProfile: { is: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } } } },
            {
              providerProfile: {
                is: { user: { is: { fullName: { contains: query, mode: Prisma.QueryMode.insensitive } } } },
              },
            },
          ],
        }
      : {};
    const where: Prisma.PartnerBankDepositRequestWhereInput = {
      ...searchWhere,
      ...(status ? { status } : {}),
    };
    const take = boundedAdminListLimit(
      options.take ?? ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_DEFAULT_LIMIT,
      ADMIN_PARTNER_BANK_DEPOSIT_REQUEST_MAX_LIMIT,
    );
    const skip = boundedAdminListSkip(options.skip);
    if (
      review !== 'needs-reconciliation' &&
      (owner !== 'all' || assigneeAdminId || sla !== 'all')
    ) {
      throw new BadRequestException(
        'Partner bank deposit owner and SLA filters require needs-reconciliation review',
      );
    }
    const reconciliationFilters = { assigneeAdminId, owner, period, query, sla, status };
    const reconciliationSummaryPromise = this.prisma.$queryRaw<
      Array<{ openAmount: bigint | number | null; openCount: bigint | number | null }>
    >(Prisma.sql`
      WITH ${adminPartnerBankDepositReconciliationCteSql(reconciliationFilters)}
      SELECT
        COUNT(*)::bigint AS "openCount",
        COALESCE(SUM("remainingAmount"), 0)::bigint AS "openAmount"
      FROM "openPartnerBankDeposits"
    `);
    const statusGroupsPromise = this.prisma.partnerBankDepositRequest.groupBy({
      by: ['status'],
      where: searchWhere,
      _count: { _all: true },
    });
    let items: AdminPartnerBankDepositHistoryRow[];
    let total: number;
    let reconciliationSummaryRows: Array<{
      openAmount: bigint | number | null;
      openCount: bigint | number | null;
    }>;
    let statusGroups: Array<{
      status: PartnerBankDepositRequestStatus;
      _count: { _all: number };
    }>;

    if (review === 'needs-reconciliation') {
      const [queueRows, summaryRows, groups] = await Promise.all([
        this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH ${adminPartnerBankDepositReconciliationCteSql(reconciliationFilters)}
          SELECT "id"
          FROM "openPartnerBankDeposits"
          ORDER BY "depositDate" DESC, "createdAt" DESC, "id" DESC
          LIMIT ${take}
          OFFSET ${skip}
        `),
        reconciliationSummaryPromise,
        statusGroupsPromise,
      ]);
      const queueIds = queueRows.map((row) => row.id);
      const queueItems = queueIds.length
        ? await this.prisma.partnerBankDepositRequest.findMany({
            where: { id: { in: queueIds } },
            include: adminPartnerBankDepositHistoryInclude,
          })
        : [];
      const itemById = new Map(queueItems.map((item) => [item.id, item]));
      items = queueIds.flatMap((id) => {
        const item = itemById.get(id);
        return item ? [item] : [];
      });
      reconciliationSummaryRows = summaryRows;
      statusGroups = groups;
      total = numberValue(summaryRows[0]?.openCount);
    } else {
      const [historyItems, historyTotal, summaryRows, groups] = await Promise.all([
        this.prisma.partnerBankDepositRequest.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include: adminPartnerBankDepositHistoryInclude,
        }),
        this.prisma.partnerBankDepositRequest.count({ where }),
        reconciliationSummaryPromise,
        statusGroupsPromise,
      ]);
      items = historyItems;
      total = historyTotal;
      reconciliationSummaryRows = summaryRows;
      statusGroups = groups;
    }

    const journalBatchIds = items.flatMap((item) => (item.journalBatchId ? [item.journalBatchId] : []));
    const [bankCashEntries, adminsById] = await Promise.all([
      journalBatchIds.length
        ? this.prisma.accountingJournalEntry.findMany({
          where: {
            batchId: { in: journalBatchIds },
            side: AccountingJournalEntrySide.DEBIT,
            accountCode: 'company_bank_cash',
          },
          select: {
            batchId: true,
            amount: true,
            bankReconciliationMatches: {
              where: {
                status: {
                  in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
                },
              },
              select: { amount: true },
            },
          },
        })
        : Promise.resolve([]),
      this.adminOperatorIdentitiesById(
        items.flatMap((request) => [
          request.requestedByAdminId,
          request.approvedByAdminId,
          request.rejectedByAdminId,
        ]),
      ),
    ]);
    const reconciliationByBatchId = new Map(
      bankCashEntries.map((entry) => {
        const matchedAmount = Math.min(
          entry.amount,
          entry.bankReconciliationMatches.reduce((sum, match) => sum + Math.abs(match.amount), 0),
        );
        const remainingAmount = Math.max(0, entry.amount - matchedAmount);
        return [entry.batchId, { matchedAmount, remainingAmount }] as const;
      }),
    );
    const reconciliationSummary = reconciliationSummaryRows[0];

    const responseItems = items.map(({ cashDebtAllocations, ...request }) => ({
        ...partnerBankDepositRequestWithOperators(request, adminsById),
        allocatedCashDebtAmount: cashDebtAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
        ...partnerBankDepositReconciliationState(request, reconciliationByBatchId),
      }));
    const itemsWithAssignments = review === 'needs-reconciliation'
      ? await this.withPartnerBankDepositReconciliationAssignments(responseItems)
      : responseItems;

    return {
      items: itemsWithAssignments,
      pagination: { skip, take, total },
      statusCounts: Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])),
      reconciliationSummary: {
        openAmount: numberValue(reconciliationSummary?.openAmount),
        openCount: numberValue(reconciliationSummary?.openCount),
        period,
      },
    };
  }

  async getPartnerBankDepositRequestDetail(requestId: string) {
    const request = await this.prisma.partnerBankDepositRequest.findUnique({
      where: { id: requestId },
      include: {
        providerProfile: {
          select: {
            id: true,
            displayName: true,
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
        cashDebtAllocations: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            providerEarning: {
              include: {
                booking: {
                  select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    payment: { select: { id: true, amount: true, method: true, status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException(`Partner bank deposit request ${requestId} was not found`);
    }

    const [ledger, journal, openDebts, auditLogs, adminsById] = await Promise.all([
      request.ledgerEntryId
        ? this.prisma.providerWalletLedgerEntry.findUnique({ where: { id: request.ledgerEntryId } })
        : null,
      request.journalBatchId
        ? this.prisma.accountingJournalBatch.findUnique({
            where: { id: request.journalBatchId },
            include: {
              entries: {
                orderBy: [{ side: 'asc' }, { accountCode: 'asc' }],
                include: {
                  bankReconciliationMatches: {
                    orderBy: { matchedAt: 'desc' },
                    include: {
                      bankTransaction: {
                        select: {
                          id: true,
                          sourceKey: true,
                          type: true,
                          amount: true,
                          currency: true,
                          occurredAt: true,
                          transferRef: true,
                          status: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : null,
      this.prisma.providerEarning.findMany({
        where: {
          providerProfileId: request.providerProfileId,
          netAmount: { lt: 0 },
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              payment: { select: { id: true, amount: true, method: true, status: true } },
            },
          },
          bankDepositCashDebtAllocations: { select: { amount: true } },
        },
      }),
      this.prisma.adminAuditLog.findMany({
        where: {
          OR: [
            { target: `partner_bank_deposit_request:${request.id}` },
            ...(request.ledgerEntryId ? [{ target: `provider_wallet_ledger:${request.ledgerEntryId}` }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      this.adminOperatorIdentitiesById([
        request.requestedByAdminId,
        request.approvedByAdminId,
        request.rejectedByAdminId,
        ...request.cashDebtAllocations.map((allocation) => allocation.allocatedByAdminId),
      ]),
    ]);
    const allocatedCashDebtAmount = request.cashDebtAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );

    return {
      request: {
        ...partnerBankDepositRequestWithOperators(request, adminsById),
        cashDebtAllocations: request.cashDebtAllocations.map((allocation) => ({
          ...allocation,
          allocatedBy: adminsById.get(allocation.allocatedByAdminId) ?? null,
        })),
      },
      ledger,
      journal,
      auditLogs,
      allocatedCashDebtAmount,
      remainingReceivableRecovery: Math.max(0, request.requestedReceivableRecovery - allocatedCashDebtAmount),
      availableCashDebts: openDebts
        .map(({ bankDepositCashDebtAllocations, ...earning }) => ({
          ...earning,
          allocatedAmount: bankDepositCashDebtAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
          remainingDebtAmount: Math.max(
            0,
            Math.abs(earning.netAmount) -
              bankDepositCashDebtAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
          ),
        }))
        .filter((earning) => earning.remainingDebtAmount > 0),
    };
  }

  async allocatePartnerBankDepositCashDebt(
    actorId: string,
    requestId: string,
    input: AllocatePartnerBankDepositCashDebtDto,
  ) {
    const allocationNotes = normalizeNullable(input.notes);
    if (!allocationNotes || allocationNotes.length < 12) {
      throw new BadRequestException('Cash debt allocation requires an audit reason of at least 12 characters');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const request = await tx.partnerBankDepositRequest.findUnique({ where: { id: requestId } });
          if (!request) {
            throw new NotFoundException(`Partner bank deposit request ${requestId} was not found`);
          }
          if (request.status !== PartnerBankDepositRequestStatus.EXECUTED) {
            throw new BadRequestException('Only an executed Partner bank deposit can be allocated to cash debt');
          }
          if (!request.ledgerEntryId || !request.journalBatchId) {
            throw new ConflictException('Approved deposit accounting evidence is incomplete');
          }

          const earning = await tx.providerEarning.findUnique({ where: { id: input.earningId } });
          if (!earning) {
            throw new NotFoundException(`Cash debt earning ${input.earningId} was not found`);
          }
          if (earning.providerProfileId !== request.providerProfileId) {
            throw new BadRequestException('Cash debt belongs to a different Partner');
          }
          if (earning.netAmount >= 0) {
            throw new BadRequestException('Only negative cash debt earnings can receive a deposit allocation');
          }
          if (earning.status !== EarningStatus.PENDING && earning.status !== EarningStatus.AVAILABLE) {
            throw new ConflictException('Cash debt is no longer open for deposit allocation');
          }
          if (earning.currency !== request.currency) {
            throw new BadRequestException('Deposit and cash debt currencies must match');
          }

          const [requestAllocation, earningAllocation] = await Promise.all([
            tx.partnerBankDepositCashDebtAllocation.aggregate({
              where: { partnerBankDepositRequestId: request.id },
              _sum: { amount: true },
            }),
            tx.partnerBankDepositCashDebtAllocation.aggregate({
              where: { providerEarningId: earning.id },
              _sum: { amount: true },
            }),
          ]);
          const requestAllocatedAmount = requestAllocation._sum.amount ?? 0;
          const earningAllocatedAmount = earningAllocation._sum.amount ?? 0;
          const remainingReceivableRecovery = request.requestedReceivableRecovery - requestAllocatedAmount;
          const remainingDebtAmount = Math.abs(earning.netAmount) - earningAllocatedAmount;

          if (remainingReceivableRecovery <= 0) {
            throw new BadRequestException('This deposit has no unallocated receivable recovery remaining');
          }
          if (remainingDebtAmount <= 0) {
            throw new ConflictException('Cash debt is already fully allocated');
          }
          if (input.amount > remainingReceivableRecovery) {
            throw new BadRequestException('Allocation exceeds the deposit receivable recovery remaining');
          }
          if (input.amount > remainingDebtAmount) {
            throw new BadRequestException('Allocation exceeds the cash debt remaining');
          }

          const allocation = await tx.partnerBankDepositCashDebtAllocation.create({
            data: {
              partnerBankDepositRequestId: request.id,
              providerEarningId: earning.id,
              amount: input.amount,
              currency: request.currency,
              allocatedByAdminId: actorId,
              notes: allocationNotes,
            },
          });
          const cashDebtFullyAllocated = input.amount === remainingDebtAmount;
          const updatedEarning = cashDebtFullyAllocated
            ? await tx.providerEarning.update({
                where: { id: earning.id },
                data: {
                  status: EarningStatus.PAID,
                  paidAt: new Date(),
                  settlementMethod: CashFeeSettlementMethod.PARTNER_DEPOSIT,
                  settlementRef: request.bankTransactionId,
                  settlementNotes: 'Settled by approved Partner bank deposit evidence allocation',
                },
              })
            : earning;

          await tx.adminAuditLog.create({
            data: {
              actorId,
              action: 'partner_bank_deposit.cash_debt_allocate',
              target: `partner_bank_deposit_request:${request.id}`,
              metadata: toJson({
                allocationId: allocation.id,
                providerProfileId: request.providerProfileId,
                providerEarningId: earning.id,
                bookingId: earning.bookingId,
                amount: allocation.amount,
                currency: allocation.currency,
                notes: allocationNotes,
                cashDebtFullyAllocated,
                ledgerEntryId: request.ledgerEntryId,
                journalBatchId: request.journalBatchId,
                createsWalletLedgerEntry: false,
                createsAccountingJournalEntry: false,
              }),
            },
          });

          return {
            allocation,
            earning: updatedEarning,
            cashDebtFullyAllocated,
            remainingReceivableRecovery: remainingReceivableRecovery - input.amount,
            remainingDebtAmount: remainingDebtAmount - input.amount,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This deposit is already linked to the selected cash debt');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Cash debt allocation changed concurrently; reload and try again');
      }
      throw error;
    }
  }

  approvePartnerBankDepositRequest(
    actorId: string,
    requestId: string,
    expectedLegacyInput?: RecordPartnerBankDepositDto,
  ) {
    const approvalChannel = expectedLegacyInput ? 'LEGACY_COMPAT' : 'REQUEST_APPROVAL';
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.partnerBankDepositRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        throw new NotFoundException(`Partner bank deposit request ${requestId} was not found`);
      }
      assertPartnerBankDepositRequestPending(request.status);
      if (request.requestedByAdminId === actorId) {
        throw new BadRequestException('Partner bank deposit requires approval from a different admin');
      }
      await assertFinanceActionApprovalAdmin(tx, actorId, 'Partner bank deposit');
      if (expectedLegacyInput) {
        assertLegacyPartnerBankDepositRequestMatches(request, expectedLegacyInput, actorId);
      }

      const claimed = await tx.partnerBankDepositRequest.updateMany({
        where: { id: request.id, status: PartnerBankDepositRequestStatus.REQUESTED },
        data: {
          status: PartnerBankDepositRequestStatus.EXECUTED,
          approvedByAdminId: actorId,
          executedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Partner bank deposit request is no longer pending');
      }

      const ledger = await this.earnings.recordPartnerBankDeposit(
        {
          providerProfileId: request.providerProfileId,
          amount: request.amount,
          bankTransactionId: request.bankTransactionId,
          depositDate: request.depositDate,
          bankAccount: request.bankAccount,
          attachmentFileId: request.attachmentFileId,
          attachmentUrl: request.attachmentUrl,
          notes: request.notes,
          adminId: actorId,
        },
        tx,
      );
      const allocation = partnerBankDepositAllocationFromLedger(ledger.metadata, ledger.amount);
      const journal = await upsertPartnerBankDepositJournal(tx, {
        actorId,
        allocation,
        approvalChannel,
        bankTransactionId: request.bankTransactionId,
        currency: ledger.currency,
        depositDate: request.depositDate,
        ledgerId: ledger.id,
        providerProfileId: request.providerProfileId,
        requestId: request.id,
        requestedByAdminId: request.requestedByAdminId,
      });
      const executedRequest = await tx.partnerBankDepositRequest.update({
        where: { id: request.id },
        data: {
          ledgerEntryId: ledger.id,
          journalBatchId: journal.id,
          executedAllocation: toJson(allocation),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'provider_wallet.bank_deposit_received',
          target: `provider_wallet_ledger:${ledger.id}`,
          metadata: toJson({
            partnerBankDepositRequestId: request.id,
            providerProfileId: ledger.providerProfileId,
            amount: ledger.amount,
            currency: ledger.currency,
            reference: ledger.reference,
            sourceKey: ledger.sourceKey,
            requestedByAdminId: request.requestedByAdminId,
            approvalAdminId: actorId,
            approvalChannel,
            journalBatchId: journal.id,
            allocation,
          }),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'partner_bank_deposit_request.execute',
          target: `partner_bank_deposit_request:${request.id}`,
          metadata: toJson({
            requestedByAdminId: request.requestedByAdminId,
            approvedByAdminId: actorId,
            approvalChannel,
            ledgerEntryId: ledger.id,
            journalBatchId: journal.id,
            allocation,
          }),
        },
      });
      return { request: executedRequest, ledger, journal, allocation };
    });
  }

  rejectPartnerBankDepositRequest(actorId: string, requestId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.partnerBankDepositRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        throw new NotFoundException(`Partner bank deposit request ${requestId} was not found`);
      }
      assertPartnerBankDepositRequestPending(request.status);
      if (request.requestedByAdminId === actorId) {
        throw new BadRequestException('Partner bank deposit requires a decision from a different admin');
      }
      await assertFinanceActionApprovalAdmin(tx, actorId, 'Partner bank deposit rejection');
      const decisionReason = normalizeAuditReason(reason);
      const updated = await tx.partnerBankDepositRequest.updateMany({
        where: { id: request.id, status: PartnerBankDepositRequestStatus.REQUESTED },
        data: {
          status: PartnerBankDepositRequestStatus.REJECTED,
          rejectedByAdminId: actorId,
          decisionReason,
          rejectedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Partner bank deposit request is no longer pending');
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'partner_bank_deposit_request.reject',
          target: `partner_bank_deposit_request:${request.id}`,
          metadata: toJson({ requestedByAdminId: request.requestedByAdminId, decisionReason }),
        },
      });
      return tx.partnerBankDepositRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  }

  previewManualWalletAdjustment(actorId: string, input: PreviewManualWalletAdjustmentDto) {
    return this.buildManualWalletAdjustmentPreviewForAdmin(this.prisma, actorId, input, false);
  }

  async approveManualWalletAdjustmentFromLegacyRoute(
    actorId: string,
    input: CreateManualWalletAdjustmentDto,
  ) {
    if (normalizeNullable(input.approvalAdminId) !== actorId) {
      throw new BadRequestException(
        'Legacy manual wallet adjustment execution requires the signed-in finance approver',
      );
    }
    return this.approveManualWalletAdjustmentRequest(actorId, input.approvalId, input);
  }

  createManualWalletAdjustmentRequest(actorId: string, input: CreateManualWalletAdjustmentRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const preview = await this.buildManualWalletAdjustmentPreviewForAdmin(tx, actorId, input, false);
      if (preview.requiresAttachment && !preview.attachmentUrl) {
        throw new BadRequestException('Attachment is required for this manual wallet adjustment');
      }

      const request = await tx.manualWalletAdjustmentRequest.create({
        data: {
          ownerType: preview.ownerType,
          ownerId: preview.ownerId,
          direction: preview.direction,
          adjustmentType: preview.adjustmentType,
          amount: preview.amount,
          currency: preview.currency,
          reason: preview.reason,
          monthlyPeriod: preview.monthlyPeriod,
          attachmentUrl: preview.attachmentUrl,
          requestedBeforeBalance: preview.beforeBalance,
          requestedAfterBalance: preview.afterBalance,
          requestedWalletDelta: preview.walletDelta,
          accountingPreview: toJson(preview.accountingEntries),
          affects: toJson(preview.affects),
          requiresAttachment: preview.requiresAttachment,
          requestedByAdminId: actorId,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'wallet_adjustment_request.create',
          target: `manual_wallet_adjustment_request:${request.id}`,
          metadata: toJson({
            ownerType: request.ownerType,
            ownerId: request.ownerId,
            direction: request.direction,
            adjustmentType: request.adjustmentType,
            amount: request.amount,
            currency: request.currency,
            requestedBeforeBalance: request.requestedBeforeBalance,
            requestedAfterBalance: request.requestedAfterBalance,
            requiresAttachment: request.requiresAttachment,
          }),
        },
      });
      return request;
    });
  }

  async listManualWalletAdjustmentRequests(
    options: { status?: string | null; take?: number | string | null; skip?: number | string | null } = {},
  ) {
    const status = normalizeManualWalletAdjustmentRequestStatus(options.status);
    const requests = await this.prisma.manualWalletAdjustmentRequest.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: boundedAdminListSkip(options.skip),
      take: boundedAdminListLimit(
        options.take ?? ADMIN_MANUAL_WALLET_ADJUSTMENT_REQUEST_DEFAULT_LIMIT,
        ADMIN_MANUAL_WALLET_ADJUSTMENT_REQUEST_MAX_LIMIT,
      ),
    });
    const adminsById = await this.adminOperatorIdentitiesById(
      requests.flatMap((request) => [
        request.requestedByAdminId,
        request.approvedByAdminId,
        request.rejectedByAdminId,
      ]),
    );

    return requests.map((request) => ({
      ...request,
      requestedBy: adminsById.get(request.requestedByAdminId) ?? null,
      approvedBy: request.approvedByAdminId
        ? (adminsById.get(request.approvedByAdminId) ?? null)
        : null,
      rejectedBy: request.rejectedByAdminId
        ? (adminsById.get(request.rejectedByAdminId) ?? null)
        : null,
    }));
  }

  approveManualWalletAdjustmentRequest(
    actorId: string,
    requestId: string,
    expectedLegacyInput?: CreateManualWalletAdjustmentDto,
  ) {
    const approvalChannel = expectedLegacyInput ? 'LEGACY_COMPAT' : 'REQUEST_APPROVAL';
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.manualWalletAdjustmentRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        throw new NotFoundException(`Manual wallet adjustment request ${requestId} was not found`);
      }
      assertManualWalletAdjustmentRequestPending(request.status);
      if (request.requestedByAdminId === actorId) {
        throw new BadRequestException('Manual wallet adjustment requires approval from a different admin');
      }
      await assertFinanceActionApprovalAdmin(tx, actorId, 'Manual wallet adjustment');
      if (expectedLegacyInput) {
        assertLegacyManualWalletAdjustmentRequestMatches(request, expectedLegacyInput);
      }

      const input: CreateManualWalletAdjustmentDto = {
        ownerType: manualWalletAdjustmentOwnerType(request.ownerType),
        ownerId: request.ownerId,
        direction: manualWalletAdjustmentDirection(request.direction),
        adjustmentType: manualWalletAdjustmentType(request.adjustmentType),
        amount: request.amount,
        reason: request.reason,
        currency: request.currency,
        ...(request.monthlyPeriod ? { monthlyPeriod: request.monthlyPeriod } : {}),
        ...(request.attachmentUrl ? { attachmentUrl: request.attachmentUrl } : {}),
        approvalId: request.id,
        approvalAdminId: actorId,
      };
      const preview = await this.buildManualWalletAdjustmentPreviewForAdmin(
        tx,
        request.requestedByAdminId,
        input,
        true,
      );
      if (preview.beforeBalance !== request.requestedBeforeBalance) {
        throw new ConflictException('Wallet balance changed after this request. Create a new adjustment request.');
      }

      const claimed = await tx.manualWalletAdjustmentRequest.updateMany({
        where: { id: request.id, status: ManualWalletAdjustmentRequestStatus.REQUESTED },
        data: {
          status: ManualWalletAdjustmentRequestStatus.EXECUTED,
          approvedByAdminId: actorId,
          executedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Manual wallet adjustment request is no longer pending');
      }

      const result = await this.persistManualWalletAdjustment(tx, actorId, preview);
      const executedRequest = await tx.manualWalletAdjustmentRequest.update({
        where: { id: request.id },
        data: { ledgerEntryId: result.ledger.id },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'wallet_adjustment_request.execute',
          target: `manual_wallet_adjustment_request:${request.id}`,
          metadata: toJson({
            requestedByAdminId: request.requestedByAdminId,
            approvedByAdminId: actorId,
            ledgerEntryId: result.ledger.id,
            beforeBalance: preview.beforeBalance,
            afterBalance: preview.afterBalance,
            approvalChannel,
          }),
        },
      });
      return { request: executedRequest, ...result };
    });
  }

  rejectManualWalletAdjustmentRequest(actorId: string, requestId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.manualWalletAdjustmentRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        throw new NotFoundException(`Manual wallet adjustment request ${requestId} was not found`);
      }
      assertManualWalletAdjustmentRequestPending(request.status);
      if (request.requestedByAdminId === actorId) {
        throw new BadRequestException('Manual wallet adjustment requires a decision from a different admin');
      }
      await assertFinanceActionApprovalAdmin(tx, actorId, 'Manual wallet adjustment rejection');
      const decisionReason = normalizeAuditReason(reason);
      const rejectedAt = new Date();
      const updated = await tx.manualWalletAdjustmentRequest.updateMany({
        where: { id: request.id, status: ManualWalletAdjustmentRequestStatus.REQUESTED },
        data: {
          status: ManualWalletAdjustmentRequestStatus.REJECTED,
          rejectedByAdminId: actorId,
          decisionReason,
          rejectedAt,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Manual wallet adjustment request is no longer pending');
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'wallet_adjustment_request.reject',
          target: `manual_wallet_adjustment_request:${request.id}`,
          metadata: toJson({ requestedByAdminId: request.requestedByAdminId, decisionReason }),
        },
      });
      return tx.manualWalletAdjustmentRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  }

  private async persistManualWalletAdjustment(
    tx: Prisma.TransactionClient,
    actorId: string,
    preview: AdminManualWalletAdjustmentPreview,
  ) {
    if (preview.requiresAttachment && !preview.attachmentUrl) {
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
      const customerIds = orderedRows.filter((row) => row.ownerType === 'CUSTOMER').map((row) => row.id);
      const providerIds = orderedRows.filter((row) => row.ownerType === 'PARTNER').map((row) => row.id);
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

      const rows = orderedRows
        .map((row) => rowsByKey.get(`${row.ownerType}:${row.id}`))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      return this.withManualWalletAdjustmentApprovers(rows);
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

    const rows = [
      ...customerRows.map((row) => manualWalletAdjustmentCustomerRow(row)),
      ...providerRows.map((row) => manualWalletAdjustmentProviderRow(row)),
    ]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, take);

    return this.withManualWalletAdjustmentApprovers(rows);
  }

  private async withManualWalletAdjustmentApprovers(rows: ManualWalletAdjustmentLedgerRow[]) {
    const requestIds = uniqueStrings(rows.map((row) => row.approvalId));
    const requests = requestIds.length
      ? await this.prisma.manualWalletAdjustmentRequest.findMany({
          where: { id: { in: requestIds } },
          select: {
            id: true,
            approvedByAdminId: true,
            requestedByAdminId: true,
          },
        })
      : [];
    const requestById = new Map(requests.map((request) => [request.id, request]));
    const adminsById = await this.adminOperatorIdentitiesById(
      rows.flatMap((row) => {
        const request = row.approvalId ? requestById.get(row.approvalId) : null;
        return [
          row.approvalAdminId ?? request?.approvedByAdminId,
          request?.requestedByAdminId,
        ];
      }),
    );

    return rows.map((row) => {
      const request = row.approvalId ? requestById.get(row.approvalId) : null;
      const approvalAdminId = row.approvalAdminId ?? request?.approvedByAdminId ?? null;
      const requestedByAdminId = request?.requestedByAdminId ?? null;
      return {
        ...row,
        approvalAdminId,
        approvalAdmin: approvalAdminId ? (adminsById.get(approvalAdminId) ?? null) : null,
        requestedByAdminId,
        requestedBy: requestedByAdminId ? (adminsById.get(requestedByAdminId) ?? null) : null,
      };
    });
  }

  private async adminOperatorIdentitiesById(adminIds: readonly (string | null | undefined)[]) {
    const uniqueAdminIds = uniqueStrings([...adminIds]);
    if (uniqueAdminIds.length === 0) {
      return new Map<string, { id: string; email: string | null; fullName: string | null }>();
    }

    const admins = await this.prisma.user.findMany({
      where: { id: { in: uniqueAdminIds } },
      select: { id: true, email: true, fullName: true },
    });
    return new Map(admins.map((admin) => [admin.id, admin]));
  }

  private async withPayoutBatchOperators<T extends { id: string }>(batches: readonly T[]) {
    const targets = batches.map((batch) => `payout_batch:${batch.id}`);
    const auditLogs = targets.length
      ? await this.prisma.adminAuditLog.findMany({
          where: {
            action: { in: ['payout_batch.create', 'payout_batch.update'] },
            target: { in: targets },
          },
          orderBy: { createdAt: 'desc' },
          select: { action: true, actorId: true, metadata: true, target: true },
        })
      : [];
    const evidenceByTarget = new Map<
      string,
      {
        approvalAdminId?: string;
        createdByAdminId?: string;
        lastUpdatedByAdminId?: string;
        paidByAdminId?: string;
      }
    >();

    for (const log of auditLogs) {
      const evidence = evidenceByTarget.get(log.target) ?? {};
      if (log.action === 'payout_batch.create' && !evidence.createdByAdminId) {
        evidence.createdByAdminId = log.actorId;
      }
      if (log.action === 'payout_batch.update' && !evidence.lastUpdatedByAdminId) {
        evidence.lastUpdatedByAdminId = log.actorId;
      }
      if (
        log.action === 'payout_batch.update' &&
        payoutBatchAuditStatus(log.metadata) === PayoutBatchStatus.PAID &&
        !evidence.paidByAdminId
      ) {
        evidence.paidByAdminId = log.actorId;
        evidence.approvalAdminId = financeApprovalAdminIdFromMetadata(log.metadata) ?? undefined;
      }
      evidenceByTarget.set(log.target, evidence);
    }

    const adminsById = await this.adminOperatorIdentitiesById(
      [...evidenceByTarget.values()].flatMap((evidence) => [
        evidence.approvalAdminId,
        evidence.createdByAdminId,
        evidence.lastUpdatedByAdminId,
        evidence.paidByAdminId,
      ]),
    );

    return batches.map((batch) => {
      const evidence = evidenceByTarget.get(`payout_batch:${batch.id}`);
      const createdByAdminId = evidence?.createdByAdminId ?? null;
      const lastUpdatedByAdminId = evidence?.lastUpdatedByAdminId ?? null;
      const paidByAdminId = evidence?.paidByAdminId ?? null;
      const approvalAdminId = evidence?.approvalAdminId ?? null;
      return {
        ...batch,
        createdByAdminId,
        createdBy: createdByAdminId ? (adminsById.get(createdByAdminId) ?? null) : null,
        lastUpdatedByAdminId,
        lastUpdatedBy: lastUpdatedByAdminId
          ? (adminsById.get(lastUpdatedByAdminId) ?? null)
          : null,
        paidByAdminId,
        paidBy: paidByAdminId ? (adminsById.get(paidByAdminId) ?? null) : null,
        approvalAdminId,
        approvalAdmin: approvalAdminId ? (adminsById.get(approvalAdminId) ?? null) : null,
      };
    });
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

  async listProviderWalletWithdrawalRequests(options: AdminPaymentOperationsQuery = {}) {
    const requests = await this.earnings.listProviderWalletWithdrawalRequestsForAdmin(options);
    const paidTargets = requests
      .filter((request) => request.status === ProviderWalletWithdrawalRequestStatus.PAID)
      .map((request) => `provider_wallet_withdrawal_request:${request.id}`);
    const approvalLogs = paidTargets.length
      ? await this.prisma.adminAuditLog.findMany({
          where: {
            action: 'provider_wallet.withdrawal_request.update',
            target: { in: paidTargets },
          },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true, target: true },
        })
      : [];
    const approvalAdminIdByTarget = new Map<string, string>();
    for (const log of approvalLogs) {
      const approvalAdminId = financeApprovalAdminIdFromMetadata(log.metadata);
      if (approvalAdminId && !approvalAdminIdByTarget.has(log.target)) {
        approvalAdminIdByTarget.set(log.target, approvalAdminId);
      }
    }
    const adminsById = await this.adminOperatorIdentitiesById(
      requests.flatMap((request) => {
        const target = `provider_wallet_withdrawal_request:${request.id}`;
        return [
          request.reviewedByAdminId,
          providerWalletWithdrawalPaidByAdminId(request.metadata),
          approvalAdminIdByTarget.get(target),
        ];
      }),
    );

    return requests.map((request) => {
      const target = `provider_wallet_withdrawal_request:${request.id}`;
      const paidByAdminId = providerWalletWithdrawalPaidByAdminId(request.metadata);
      const approvalAdminId = approvalAdminIdByTarget.get(target) ?? null;
      return {
        ...request,
        reviewedBy: request.reviewedByAdminId
          ? (adminsById.get(request.reviewedByAdminId) ?? null)
          : null,
        paidBy: paidByAdminId ? (adminsById.get(paidByAdminId) ?? null) : null,
        approvalAdminId,
        approvalAdmin: approvalAdminId ? (adminsById.get(approvalAdminId) ?? null) : null,
      };
    });
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

  async listPayoutBatches(options: AdminPaymentOperationsQuery = {}) {
    const batches = await this.earnings.listPayoutBatchesForAdmin(options);
    return this.withPayoutBatchOperators(batches);
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

  async listNotifications(options: NotificationBoardQueryOptions = {}) {
    const where = notificationBoardWhere(options);
    const skip = normalizeNotificationBoardSkip(options.skip);
    const take = normalizeNotificationBoardTake(options.take);
    const systemIncidentReview = normalizeNullable(options.review) === 'system-incidents';
    const financeReviewState = notificationFinanceReviewState(options.review);
    const systemIncidentSources = systemIncidentReview
      ? await this.prisma.$queryRaw<NotificationSystemIncidentSourcePageRow[]>(
          notificationSystemIncidentSourcePageQuery(
            options,
            take,
            skip,
          ),
        )
      : [];
    const financeReviewRows = financeReviewState
      ? await this.prisma.$queryRaw<NotificationFinanceReviewPageRow[]>(
          notificationFinanceReviewPageQuery(options, financeReviewState, take, skip),
        )
      : [];
    const args: Prisma.NotificationFindManyArgs = {
      orderBy: { createdAt: 'desc' },
      take,
      select: adminNotificationBoardListSelect,
    };
    if (systemIncidentReview) {
      args.where = { id: { in: systemIncidentSources.map((source) => source.id) } };
    } else if (financeReviewState) {
      args.where = { id: { in: financeReviewRows.map((row) => row.id) } };
    } else if (skip > 0) {
      args.skip = skip;
    }
    if (!systemIncidentReview && !financeReviewState && where) {
      args.where = where;
    }
    const loadedNotifications = await this.prisma.notification.findMany(args);
    const notifications = systemIncidentReview
      ? notificationSystemIncidentSourcePageNotifications(loadedNotifications, systemIncidentSources)
      : financeReviewState
        ? notificationFinanceReviewPageNotifications(loadedNotifications, financeReviewRows)
        : loadedNotifications;
    const incidentIds = [...new Set(notifications.flatMap((notification) => {
      const incidentId = notificationBackgroundJobIncidentId(notification);
      return incidentId ? [incidentId] : [];
    }))];
    if (incidentIds.length === 0) {
      return notifications;
    }

    const recoveries = await this.prisma.adminAuditLog.findMany({
      where: {
        action: 'admin.background_jobs.recurring_incident_recovered',
        OR: incidentIds.map((incidentId) => ({
          metadata: { path: ['openedAuditId'], equals: incidentId },
        })),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: incidentIds.length,
      select: { createdAt: true, metadata: true },
    });
    const recoveryByIncidentId = new Map<string, string>();
    for (const recovery of recoveries) {
      const metadata = jsonObject(recovery.metadata);
      const incidentId = jsonString(metadata.openedAuditId);
      if (!incidentId || recoveryByIncidentId.has(incidentId)) continue;
      recoveryByIncidentId.set(
        incidentId,
        jsonString(metadata.recoveredAt) ?? recovery.createdAt.toISOString(),
      );
    }

    return notifications.map((notification) => {
      const incidentId = notificationBackgroundJobIncidentId(notification);
      if (!incidentId) return notification;
      const recoveredAt = recoveryByIncidentId.get(incidentId) ?? null;
      return {
        ...notification,
        data: {
          ...jsonObject(notification.data),
          incidentRecoveredAt: recoveredAt,
          incidentStatus: recoveredAt ? 'RECOVERED' : 'OPEN',
        },
      };
    });
  }

  async notificationSummary(options: NotificationBoardSummaryOptions = {}) {
    const baseWhere = notificationBoardWhere(options);
    const financeReviewState = notificationFinanceReviewState(options.review);
    const countNotifications = (where?: Prisma.NotificationWhereInput) =>
      this.prisma.notification.count(notificationCountArgs(notificationBoardAndWhere(baseWhere, where)));
    const countSelectedNotifications = financeReviewState
      ? this.prisma.$queryRaw<NotificationFinanceReviewCountRow[]>(
          notificationFinanceReviewCountQuery(options, financeReviewState),
        ).then((rows) => rows[0]?.count ?? 0)
      : countNotifications();
    const financeReviewOwnerSummary = financeReviewState
      ? this.prisma.$queryRaw<NotificationFinanceReviewOwnerCountRow[]>(
          notificationFinanceReviewOwnerSummaryQuery(options, financeReviewState),
        )
      : Promise.resolve([]);
    const includesSystemIncidentSummary = normalizeNullable(options.review) === 'system-incidents';
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
      rawTotalCount,
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
      systemIncidentSourceRows,
      financeReviewOwnerSummaryRows,
    ] = await Promise.all([
      countSelectedNotifications,
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
      includesSystemIncidentSummary
        ? this.prisma.$queryRaw<NotificationSystemIncidentSourceSummarySqlRow[]>(
            notificationSystemIncidentSourceSummaryQuery(options),
          )
        : Promise.resolve([]),
      financeReviewOwnerSummary,
    ]);
    const systemIncidentSummary = notificationSystemIncidentSourceSummaryFromSql(
      systemIncidentSourceRows[0],
      options.incidentState,
    );

    return {
      generatedAt: new Date().toISOString(),
      disabledDevices,
      failed,
      fcmDeliveries,
      financeReviewOwnerSummary: financeReviewOwnerSummaryRows.map((row) => ({
        count: row.count,
        ownerAdminId: row.ownerAdminId,
      })),
      inAppDeliveries,
      legacySystemIncidentCount: systemIncidentSummary.legacy,
      needsRetry,
      noShow,
      openSystemIncidentCount: systemIncidentSummary.open,
      partnerAlertCount,
      payoutSetup,
      pending,
      recoveredSystemIncidentCount: systemIncidentSummary.recovered,
      reviewedSystemIncidentCount: systemIncidentSummary.reviewed,
      sent,
      skipped,
      staleDevices,
      systemIncidentCount: systemIncidentSummary.total,
      systemIncidentNotificationCount: systemIncidentSummary.notificationCount,
      systemIncidentSourceSummaryComplete: true,
      systemIncidentSourceTotalCount: systemIncidentSummary.selected,
      totalCount: includesSystemIncidentSummary ? systemIncidentSummary.selected : rawTotalCount,
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

  async reviewLegacyNotification(actorId: string, notificationId: string, rawReason?: string) {
    const reason = rawReason?.replace(/\s+/g, ' ').trim() ?? '';
    if (reason.length < 12) {
      throw new BadRequestException('Legacy notification review reason must be at least 12 characters');
    }
    if (reason.length > 500) {
      throw new BadRequestException('Legacy notification review reason must be 500 characters or fewer');
    }
    const reviewedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id: notificationId },
        select: { data: true, id: true, type: true },
      });
      if (!notification) {
        throw new NotFoundException('Notification was not found');
      }
      if (!notification.type.startsWith('admin.system.')) {
        throw new BadRequestException('Only Admin system notifications can use legacy review');
      }

      const existingData = jsonObject(notification.data);
      if (jsonString(existingData.incidentId)) {
        throw new BadRequestException('Linked incidents must be resolved from Background Jobs');
      }
      if (jsonString(existingData.incidentStatus)) {
        throw new ConflictException('Notification incident state is already recorded');
      }

      const source = legacyNotificationReviewSource(notification);
      const sourceNotifications = source
        ? await tx.notification.findMany({
            where: {
              AND: [
                { type: notification.type },
                { data: { path: ['queueName'], equals: source.queueName } },
                { data: { path: ['jobId'], equals: source.jobId } },
                { data: { path: ['incidentId'], equals: Prisma.AnyNull } },
                { data: { path: ['incidentStatus'], equals: Prisma.AnyNull } },
              ],
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { data: true, id: true, type: true },
          })
        : [notification];
      if (!sourceNotifications.some((row) => row.id === notification.id)) {
        throw new ConflictException('Notification incident state changed before this review completed');
      }

      for (const sourceNotification of sourceNotifications) {
        const sourceData = jsonObject(sourceNotification.data);
        const update = await tx.notification.updateMany({
          where: {
            data: { path: ['incidentStatus'], equals: Prisma.AnyNull },
            id: sourceNotification.id,
            type: sourceNotification.type,
          },
          data: {
            data: toJson({
              ...sourceData,
              incidentStatus: 'LEGACY_REVIEWED',
              legacyReviewReason: reason,
              legacyReviewedAt: reviewedAt.toISOString(),
              legacyReviewedByAdminId: actorId,
            }),
          },
        });
        if (update.count !== 1) {
          throw new ConflictException('Notification incident state changed before this review completed');
        }
      }

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'notification.legacy_reviewed',
          target: `notification:${notification.id}`,
          metadata: {
            incidentStatus: 'LEGACY_REVIEWED',
            notificationId: notification.id,
            notificationType: notification.type,
            reason,
            reviewedNotificationCount: sourceNotifications.length,
            reviewedAt: reviewedAt.toISOString(),
            source: 'admin_notification_legacy_review',
            sourceKey: source?.sourceKey ?? `notification:${notification.id}`,
          },
        },
      });

      return {
        incidentStatus: 'LEGACY_REVIEWED' as const,
        notificationId: notification.id,
        ok: true,
        reviewedNotificationCount: sourceNotifications.length,
        reviewedAt: reviewedAt.toISOString(),
      };
    });
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

function adminIsoDateTime(value: Date | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function bankReconciliationWithdrawalCandidateWaitingMeta(occurredAt: Date, now = new Date()) {
  const waitingHours = Math.max(
    0,
    Math.floor((now.getTime() - occurredAt.getTime()) / (60 * 60 * 1000)),
  );
  return {
    slaStatus:
      waitingHours >= 48 ? ('OVER_48H' as const) : waitingHours >= 24 ? ('OVER_24H' as const) : ('CURRENT' as const),
    waitingHours,
  };
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
  const startAt =
    input.start === undefined
      ? existing.startAt
      : parseRequiredAdminCalendarDate(input.start, 'Calendar start date');
  const endAt =
    input.end === undefined ? existing.endAt : parseRequiredAdminCalendarDate(input.end, 'Calendar end date');
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

function adminFileReviewItemWhere(
  options: AdminFileReviewItemListOptions,
): Prisma.FileAssetWhereInput {
  const kind = normalizeFileReviewKind(options.kind);
  const stateWhere = adminFileReviewStateWhere(options.review);
  const privateWhere = {
    AND: [adminFileReviewPrivateFileWhere(), stateWhere],
  } satisfies Prisma.FileAssetWhereInput;
  const publicWhere = {
    AND: [
      adminFileReviewPublicMediaWhere(),
      stateWhere,
      { owner: { is: { providerProfile: { isNot: null } } } },
    ],
  } satisfies Prisma.FileAssetWhereInput;
  const scopeWhere =
    kind === 'private-verification'
      ? privateWhere
      : kind === 'public-media'
        ? publicWhere
        : ({ OR: [privateWhere, publicWhere] } satisfies Prisma.FileAssetWhereInput);
  const query = normalizeNullable(options.q);
  if (!query) {
    return scopeWhere;
  }

  return {
    AND: [
      scopeWhere,
      {
        OR: [
          ...adminFileReviewFileSearchConditions(query),
          {
            owner: {
              is: {
                OR: [
                  { fullName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                  { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
                  {
                    providerProfile: {
                      is: { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                    },
                  },
                ],
              },
            },
          },
          {
            providerVerification: {
              is: {
                providerProfile: {
                  is: {
                    OR: [
                      { displayName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                      {
                        user: {
                          is: {
                            OR: [
                              { fullName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                              { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    ],
  };
}

function adminFileReviewFileSearchConditions(query: string): Prisma.FileAssetWhereInput[] {
  const conditions: Prisma.FileAssetWhereInput[] = [
    { key: { contains: query, mode: Prisma.QueryMode.insensitive } },
    { contentType: { contains: query, mode: Prisma.QueryMode.insensitive } },
    { reviewReason: { contains: query, mode: Prisma.QueryMode.insensitive } },
  ];
  const matchingPurposes = adminFileReviewPurposeSearch(query);
  if (matchingPurposes.length > 0) {
    conditions.push({ purpose: { in: matchingPurposes } });
  }
  const matchingStatus = adminFileReviewStatusSearch(query);
  if (matchingStatus) {
    conditions.push(matchingStatus);
  }
  return conditions;
}

function adminFileReviewStateWhere(reviewValue: string | null | undefined): Prisma.FileAssetWhereInput {
  const review = normalizeNullable(reviewValue);
  if (review === 'needs-review') {
    return { reviewStatus: { in: [FileReviewStatus.PENDING_REVIEW, FileReviewStatus.REJECTED] } };
  }
  if (review === 'approved') {
    return { reviewStatus: FileReviewStatus.APPROVED };
  }
  if (review === 'rejected') {
    return { reviewStatus: FileReviewStatus.REJECTED };
  }
  if (review === 'upload-incomplete') {
    return { uploadStatus: { not: FileUploadStatus.UPLOADED } };
  }
  return {};
}

function normalizeFileReviewKind(value: string | null | undefined) {
  const kind = normalizeNullable(value);
  return kind === 'private-verification' || kind === 'public-media' ? kind : null;
}

function adminFileReviewPurposeSearch(query: string): FilePurpose[] {
  const normalized = query.toLowerCase();
  const purposes: FilePurpose[] = [];
  if (normalized.includes('verification')) {
    purposes.push(FilePurpose.PROVIDER_VERIFICATION);
  }
  if (normalized.includes('gallery')) {
    purposes.push(FilePurpose.PROVIDER_GALLERY);
  }
  if (normalized.includes('profile')) {
    purposes.push(FilePurpose.PROFILE_IMAGE);
  }
  return purposes;
}

function adminFileReviewStatusSearch(query: string): Prisma.FileAssetWhereInput | null {
  const normalized = query.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'approved') {
    return { reviewStatus: FileReviewStatus.APPROVED };
  }
  if (normalized === 'rejected') {
    return { reviewStatus: FileReviewStatus.REJECTED };
  }
  if (normalized === 'pendingreview') {
    return { reviewStatus: FileReviewStatus.PENDING_REVIEW };
  }
  if (normalized === 'uploaded') {
    return { uploadStatus: FileUploadStatus.UPLOADED };
  }
  if (normalized === 'uploadfailed' || normalized === 'failed') {
    return { uploadStatus: FileUploadStatus.FAILED };
  }
  if (normalized === 'uploadpending') {
    return { uploadStatus: FileUploadStatus.PENDING };
  }
  return null;
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

function assertLegacyManualWalletAdjustmentRequestMatches(
  request: {
    ownerType: string;
    ownerId: string;
    direction: string;
    adjustmentType: string;
    amount: number;
    currency: string;
    reason: string;
    monthlyPeriod: string | null;
    attachmentUrl: string | null;
  },
  input: CreateManualWalletAdjustmentDto,
) {
  const matches =
    request.ownerType === manualWalletAdjustmentOwnerType(input.ownerType) &&
    request.ownerId === normalizeManualWalletOwnerId(input.ownerId) &&
    request.direction === manualWalletAdjustmentDirection(input.direction) &&
    request.adjustmentType === manualWalletAdjustmentType(input.adjustmentType) &&
    request.amount === integerValue(input.amount) &&
    request.currency === normalizeManualWalletCurrency(input.currency) &&
    request.reason === normalizeAuditReason(input.reason) &&
    request.monthlyPeriod === normalizeManualWalletMonthlyPeriod(input.monthlyPeriod) &&
    request.attachmentUrl === normalizeManualWalletAttachmentUrl(input.attachmentUrl);

  if (!matches) {
    throw new ConflictException(
      'Legacy manual wallet adjustment payload does not match the persisted approval request',
    );
  }
}

function partnerBankDepositLedgerSourceKey(providerProfileId: string, bankTransactionId: string) {
  return `partner-bank-deposit:${providerProfileId}:${bankTransactionId}`;
}

function partnerBankDepositAccountingPreview(
  allocation: ReturnType<typeof allocatePartnerBankDeposit>,
) {
  return [
    {
      side: AccountingJournalEntrySide.DEBIT,
      accountCode: 'company_bank_cash',
      accountName: 'Company bank cash',
      amount: allocation.depositAmount,
    },
    ...(allocation.amountAppliedToNegativeWallet > 0
      ? [
          {
            side: AccountingJournalEntrySide.CREDIT,
            accountCode: 'partner_receivable',
            accountName: 'Partner receivable',
            amount: allocation.amountAppliedToNegativeWallet,
          },
        ]
      : []),
    ...(allocation.amountCreditedToWalletLiability > 0
      ? [
          {
            side: AccountingJournalEntrySide.CREDIT,
            accountCode: 'partner_wallet_liability',
            accountName: 'Partner wallet liability',
            amount: allocation.amountCreditedToWalletLiability,
          },
        ]
      : []),
  ];
}

function assertLegacyPartnerBankDepositRequestMatches(
  request: {
    providerProfileId: string;
    amount: number;
    bankTransactionId: string;
    depositDate: Date;
    bankAccount: string | null;
    attachmentFileId: string | null;
    attachmentUrl: string | null;
    notes: string | null;
  },
  input: RecordPartnerBankDepositDto,
  actorId: string,
) {
  const deposit = normalizePartnerBankDepositInput({ ...input, adminId: actorId });
  const matches =
    request.providerProfileId === deposit.providerProfileId &&
    request.amount === deposit.amount &&
    request.bankTransactionId === deposit.bankTransactionId &&
    request.depositDate.getTime() === deposit.depositDate.getTime() &&
    request.bankAccount === (deposit.bankAccount ?? null) &&
    request.attachmentFileId === (deposit.attachmentFileId ?? null) &&
    request.attachmentUrl === (deposit.attachmentUrl ?? null) &&
    request.notes === (deposit.notes ?? null);

  if (!matches) {
    throw new ConflictException(
      'Legacy partner bank deposit payload does not match the persisted approval request',
    );
  }
}

function normalizePartnerBankDepositRequestStatus(value?: string | null) {
  const normalized = normalizeNullable(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  if (
    Object.values(PartnerBankDepositRequestStatus).includes(
      normalized as PartnerBankDepositRequestStatus,
    )
  ) {
    return normalized as PartnerBankDepositRequestStatus;
  }
  throw new BadRequestException('Partner bank deposit request status is invalid');
}

function normalizePartnerBankDepositReview(value?: string | null) {
  const normalized = normalizeNullable(value)?.toLowerCase();
  if (!normalized || normalized === 'all') {
    return 'all' as const;
  }
  if (normalized === 'needs-reconciliation') {
    return normalized;
  }
  throw new BadRequestException('Partner bank deposit review filter is invalid');
}

function normalizePartnerBankDepositReconciliationOwner(
  value?: string | null,
): 'all' | 'unassigned' {
  const normalized = normalizeNullable(value)?.toLowerCase();
  if (!normalized || normalized === 'all') return 'all' as const;
  if (normalized === 'unassigned') return normalized;
  throw new BadRequestException('Partner bank deposit reconciliation owner filter is invalid');
}

function normalizePartnerBankDepositReconciliationSla(
  value?: string | null,
): 'all' | 'within-24h' | 'over-24h' | 'escalate' {
  const normalized = normalizeNullable(value)?.toLowerCase();
  if (!normalized || normalized === 'all') return 'all' as const;
  if (normalized === 'within-24h' || normalized === 'over-24h' || normalized === 'escalate') {
    return normalized;
  }
  throw new BadRequestException('Partner bank deposit reconciliation SLA filter is invalid');
}

function normalizePartnerBankDepositReconciliationPeriod(value?: string | null) {
  const normalized = normalizeNullable(value);
  if (!normalized) {
    return null;
  }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    return normalized;
  }
  throw new BadRequestException('Partner bank deposit reconciliation period must use YYYY-MM');
}

function partnerBankDepositReconciliationState(
  request: Pick<
    AdminPartnerBankDepositHistoryRow,
    'amount' | 'createdAt' | 'executedAt' | 'journalBatchId' | 'status'
  >,
  reconciliationByBatchId: ReadonlyMap<
    string,
    { matchedAmount: number; remainingAmount: number }
  >,
) {
  if (request.status !== PartnerBankDepositRequestStatus.EXECUTED) {
    return {
      reconciliationMatchedAmount: 0,
      reconciliationRemainingAmount: 0,
      reconciliationSlaStatus: 'NOT_APPLICABLE' as const,
      reconciliationStatus: 'NOT_APPLICABLE' as const,
      reconciliationWaitingHours: null,
    };
  }

  const evidence = request.journalBatchId
    ? reconciliationByBatchId.get(request.journalBatchId)
    : null;
  const matchedAmount = evidence?.matchedAmount ?? 0;
  const remainingAmount = evidence?.remainingAmount ?? request.amount;
  const waitingSince = request.executedAt ?? request.createdAt;
  const reconciliationWaitingHours = remainingAmount > 0
    ? Math.max(0, Math.floor((Date.now() - waitingSince.getTime()) / 3_600_000))
    : null;
  return {
    reconciliationMatchedAmount: matchedAmount,
    reconciliationRemainingAmount: remainingAmount,
    reconciliationSlaStatus: remainingAmount === 0
      ? ('RECONCILED' as const)
      : (reconciliationWaitingHours ?? 0) >= 48
        ? ('ESCALATE' as const)
        : (reconciliationWaitingHours ?? 0) >= 24
          ? ('OVER_24H' as const)
          : ('WITHIN_24H' as const),
    reconciliationStatus: remainingAmount === 0
      ? ('MATCHED' as const)
      : matchedAmount > 0
        ? ('PARTIALLY_MATCHED' as const)
        : ('UNMATCHED' as const),
    reconciliationWaitingHours,
  };
}

function assertPartnerBankDepositRequestPending(status: PartnerBankDepositRequestStatus) {
  if (status !== PartnerBankDepositRequestStatus.REQUESTED) {
    throw new ConflictException('Partner bank deposit request is no longer pending');
  }
}

function partnerBankDepositAllocationFromLedger(
  metadata: Prisma.JsonValue | null,
  depositAmount: number,
): ReturnType<typeof allocatePartnerBankDeposit> {
  const allocation = adminJsonObject(adminJsonObject(metadata)?.allocation);
  const currentWalletBalance = integerJsonValue(allocation?.currentWalletBalance);
  const currentNegativeWalletAmount = integerJsonValue(allocation?.currentNegativeWalletAmount);
  const amountAppliedToNegativeWallet = integerJsonValue(allocation?.amountAppliedToNegativeWallet);
  const amountCreditedToWalletLiability = integerJsonValue(allocation?.amountCreditedToWalletLiability);
  const resultingWalletBalance = integerJsonValue(allocation?.resultingWalletBalance);
  const recordedDepositAmount = integerJsonValue(allocation?.depositAmount);

  if (
    recordedDepositAmount !== depositAmount ||
    currentWalletBalance === null ||
    currentNegativeWalletAmount === null ||
    amountAppliedToNegativeWallet === null ||
    amountCreditedToWalletLiability === null ||
    resultingWalletBalance === null ||
    amountAppliedToNegativeWallet + amountCreditedToWalletLiability !== depositAmount ||
    currentWalletBalance + depositAmount !== resultingWalletBalance
  ) {
    throw new ConflictException('Partner bank deposit allocation evidence is incomplete');
  }

  return {
    depositAmount: recordedDepositAmount,
    currentWalletBalance,
    currentNegativeWalletAmount,
    amountAppliedToNegativeWallet,
    amountCreditedToWalletLiability,
    resultingWalletBalance,
  };
}

function integerJsonValue(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

async function upsertPartnerBankDepositJournal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  input: {
    actorId: string;
    allocation: ReturnType<typeof allocatePartnerBankDeposit>;
    approvalChannel: 'LEGACY_COMPAT' | 'REQUEST_APPROVAL';
    bankTransactionId: string;
    currency: string;
    depositDate: Date;
    ledgerId: string;
    providerProfileId: string;
    requestId: string;
    requestedByAdminId: string;
  },
) {
  const sourceKey = `accounting-journal:provider-bank-deposit:${input.providerProfileId}:${input.bankTransactionId}`;
  const sourceType = AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT;
  const metadata = toJson({
    partnerBankDeposit: true,
    partnerBankDepositRequestId: input.requestId,
    providerProfileId: input.providerProfileId,
    bankTransactionId: input.bankTransactionId,
    requestedByAdminId: input.requestedByAdminId,
    approvedByAdminId: input.actorId,
    approvalChannel: input.approvalChannel,
    ledgerId: input.ledgerId,
    allocation: input.allocation,
  });
  const entries = partnerBankDepositAccountingPreview(input.allocation).map((entry) => ({
    ...entry,
    currency: input.currency,
    memo: `Partner bank deposit ${input.bankTransactionId}`,
    metadata,
    sourceId: input.ledgerId,
    sourceType,
  }));
  const batchData = {
    createdById: input.actorId,
    currency: input.currency,
    entries: { create: entries },
    metadata,
    monthlyPeriod: settlementMonthlyPeriod(input.depositDate),
    providerProfileId: input.providerProfileId,
    sourceId: input.ledgerId,
    sourceType,
    status: AccountingJournalBatchStatus.POSTED,
    totalCredit: input.allocation.depositAmount,
    totalDebit: input.allocation.depositAmount,
  };

  return tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {
      ...batchData,
      entries: { deleteMany: {}, create: entries },
    },
    create: { ...batchData, sourceKey },
  });
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

function adminPaymentFeePolicyListTake(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_PAYMENT_FEE_POLICY_DEFAULT_LIMIT;
  }
  return Math.min(Math.trunc(parsed), ADMIN_PAYMENT_FEE_POLICY_MAX_LIMIT);
}

function adminPaymentFeePolicySampleAmount(value: number | string | null | undefined) {
  if (value === undefined || value === null || value === '') {
    return ADMIN_PAYMENT_FEE_POLICY_DEFAULT_SAMPLE_AMOUNT;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > ADMIN_PAYMENT_FEE_POLICY_MAX_SAMPLE_AMOUNT) {
    throw new BadRequestException(
      `Payment fee sample amount must be an integer between 1 and ${ADMIN_PAYMENT_FEE_POLICY_MAX_SAMPLE_AMOUNT}`,
    );
  }
  return parsed;
}

function normalizePaymentFeePolicyInput(input: {
  name: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new BadRequestException('Payment fee policy name is required');
  }
  const effectiveFrom = new Date(input.effectiveFrom);
  const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new BadRequestException('Payment fee policy effective from is invalid');
  }
  if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
    throw new BadRequestException('Payment fee policy effective to is invalid');
  }
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new BadRequestException('Payment fee policy effective to must be after effective from');
  }
  return {
    name,
    effectiveFrom,
    effectiveTo,
    notes: normalizeNullable(input.notes),
  };
}

function assertPaymentFeeDraft(
  policy: { id: string; status: TaxPolicyStatus } | null,
  policyId: string,
): asserts policy is { id: string; status: 'DRAFT' } {
  if (!policy) {
    throw new NotFoundException(`Payment fee policy ${policyId} was not found`);
  }
  if (policy.status !== TaxPolicyStatus.DRAFT) {
    throw new BadRequestException('Only DRAFT payment fee policies can be changed');
  }
}

type PaymentFeeRuleValidationInput = {
  feeType: PaymentFeeRuleType;
  rateBps: number;
  fixedAmount: number;
};

type PaymentFeePolicyActivationInput = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
  rules: Array<
    PaymentFeeRuleValidationInput & {
      active: boolean;
      method: PaymentMethod;
    }
  >;
};

type PaymentFeePolicyPreflightBlocker = {
  code: string;
  message: string;
  method?: PaymentMethod;
};

type AdminPaymentFeeMethodEvidenceGroupRow = {
  paymentMethod: string;
  settlementCount: bigint | number | null;
  evidenceReviewCount: bigint | number | null;
  customerPaymentAmountTotal: bigint | number | null;
  evidenceCustomerPaymentAmountTotal: bigint | number | null;
  paymentProcessingFeeTotal: bigint | number | null;
  evidenceRecordedFeeTotal: bigint | number | null;
  remediationExpectedFeeTotal: bigint | number | null;
};

type AdminPaymentFeeRemediationPolicy = {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  rules: Array<{
    method: PaymentMethod;
    feeType: PaymentFeeRuleType;
    rateBps: number;
    fixedAmount: number;
  }>;
};

type PaymentFeePolicyPreflightInput = Omit<PaymentFeePolicyActivationInput, 'rules'> & {
  id: string;
  status: TaxPolicyStatus;
  rules: Array<
    PaymentFeePolicyActivationInput['rules'][number] & {
      payer: PaymentFeePayer;
      treatment: PaymentFeeTreatment;
    }
  >;
};

type PaymentFeePolicyApprovalRequest = Prisma.AdminAuditLogGetPayload<{
  select: typeof adminPaymentFeePolicyApprovalRequestSelect;
}>;

type AdminFinanceApprovalPolicyRequestRow = {
  actorEmail: string | null;
  actorFullName: string | null;
  actorId: string;
  effectiveFrom: Date;
  metadata: Prisma.JsonValue | null;
  policyId: string;
  policyName: string;
  policyUpdatedAt: Date;
  requestedAt: Date;
  requestId: string;
  totalCount: bigint | number;
};

type AdminFinanceApprovalWalletAdjustmentRequestRow = {
  adjustmentType: string;
  amount: number;
  attachmentUrl: string | null;
  createdAt: Date;
  currency: string;
  direction: string;
  id: string;
  monthlyPeriod: string | null;
  ownerId: string;
  ownerName: string;
  ownerType: string;
  reason: string;
  requestedAfterBalance: number;
  requestedBeforeBalance: number;
  requestedByAdminId: string;
  requesterEmail: string | null;
  requesterFullName: string | null;
  requiresAttachment: boolean;
  totalCount: bigint | number;
};

type AdminFinanceApprovalPartnerBankDepositRequestRow = {
  amount: number;
  attachmentFileId: string | null;
  attachmentUrl: string | null;
  bankAccount: string | null;
  bankTransactionId: string;
  createdAt: Date;
  currency: string;
  depositDate: Date;
  id: string;
  notes: string | null;
  partnerName: string;
  providerProfileId: string;
  requestedAfterBalance: number;
  requestedBeforeBalance: number;
  requestedByAdminId: string;
  requestedReceivableRecovery: number;
  requestedWalletLiabilityIncrease: number;
  requesterEmail: string | null;
  requesterFullName: string | null;
  totalCount: bigint | number;
};

function paymentFeeRuleValidationMessage(input: PaymentFeeRuleValidationInput) {
  if (!Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10000) {
    return 'Payment fee rate must be between 0 and 10000 basis points';
  }
  if (!Number.isInteger(input.fixedAmount) || input.fixedAmount < 0) {
    return 'Payment fee fixed amount must be a non-negative integer';
  }
  if (input.feeType === PaymentFeeRuleType.RATE && input.fixedAmount !== 0) {
    return 'RATE payment fee rules cannot include a fixed amount';
  }
  if (input.feeType === PaymentFeeRuleType.FIXED && input.rateBps !== 0) {
    return 'FIXED payment fee rules cannot include a rate';
  }
  return null;
}

function assertPaymentFeeRuleValues(input: PaymentFeeRuleValidationInput) {
  const message = paymentFeeRuleValidationMessage(input);
  if (message) {
    throw new BadRequestException(message);
  }
}

function paymentFeePolicyActivationBlockers(
  policy: PaymentFeePolicyActivationInput,
  now = new Date(),
): PaymentFeePolicyPreflightBlocker[] {
  const blockers: PaymentFeePolicyPreflightBlocker[] = [];
  if (!normalizeNullable(policy.notes)) {
    blockers.push({
      code: 'POLICY_EVIDENCE_REQUIRED',
      message: 'Payment fee policy activation requires contract or pricing evidence notes',
    });
  }
  if (policy.effectiveFrom > now) {
    blockers.push({
      code: 'FUTURE_EFFECTIVE_FROM',
      message: 'Future payment fee policies cannot be activated by this immediate activation flow',
    });
  }
  if (policy.effectiveTo && policy.effectiveTo <= now) {
    blockers.push({ code: 'POLICY_EXPIRED', message: 'Expired payment fee policies cannot be activated' });
  }
  if (policy.effectiveTo && policy.effectiveTo <= policy.effectiveFrom) {
    blockers.push({
      code: 'INVALID_EFFECTIVE_WINDOW',
      message: 'Payment fee policy effective window is invalid',
    });
  }
  const activeRules = policy.rules.filter((rule) => rule.active);
  for (const method of Object.values(PaymentMethod)) {
    const methodRules = activeRules.filter((rule) => rule.method === method);
    if (methodRules.length !== 1) {
      blockers.push({
        code: methodRules.length ? 'DUPLICATE_METHOD_RULE' : 'MISSING_METHOD_RULE',
        message: `Payment fee policy requires exactly one active ${method} rule`,
        method,
      });
      continue;
    }
    const validationMessage = paymentFeeRuleValidationMessage(methodRules[0]);
    if (validationMessage) {
      blockers.push({ code: 'INVALID_METHOD_RULE', message: validationMessage, method });
    }
  }
  return blockers;
}

function assertPaymentFeePolicyReadyForActivation(policy: PaymentFeePolicyActivationInput) {
  const blocker = paymentFeePolicyActivationBlockers(policy)[0];
  if (blocker) {
    throw new BadRequestException(blocker.message);
  }
}

function paymentFeePolicyPreflightResult(
  policy: PaymentFeePolicyPreflightInput,
  sampleAmount: number,
) {
  const activeRules = policy.rules.filter((rule) => rule.active);
  const activationBlockers = paymentFeePolicyActivationBlockers(policy);
  const blockers: PaymentFeePolicyPreflightBlocker[] = [
    ...(policy.status === TaxPolicyStatus.DRAFT
      ? []
      : [
          {
            code: 'POLICY_NOT_DRAFT',
            message: 'Only DRAFT payment fee policies can be activated',
          },
        ]),
    ...activationBlockers,
  ];
  const rules = Object.values(PaymentMethod).map((method) => {
    const methodRules = activeRules.filter((rule) => rule.method === method);
    const rule = methodRules.length === 1 ? methodRules[0] : null;
    const validationMessage = rule ? paymentFeeRuleValidationMessage(rule) : null;
    const status = methodRules.length === 0
      ? ('MISSING' as const)
      : methodRules.length > 1
        ? ('DUPLICATE' as const)
        : validationMessage
          ? ('INVALID' as const)
          : ('READY' as const);
    return {
      method,
      ruleCount: methodRules.length,
      feeType: rule?.feeType ?? null,
      rateBps: rule?.rateBps ?? null,
      fixedAmount: rule?.fixedAmount ?? null,
      payer: rule?.payer ?? null,
      treatment: rule?.treatment ?? null,
      estimatedFeeAmount:
        rule && !validationMessage ? bpsAmount(sampleAmount, rule.rateBps) + rule.fixedAmount : null,
      status,
    };
  });

  return {
    policyId: policy.id,
    policyStatus: policy.status,
    sampleAmount,
    currency: 'VND' as const,
    readyForActivation: blockers.length === 0,
    blockers,
    coverage: {
      requiredMethods: Object.values(PaymentMethod).length,
      configuredMethods: rules.filter((rule) => rule.status === 'READY').length,
      missingMethods: rules.filter((rule) => rule.status === 'MISSING').map((rule) => rule.method),
      duplicateMethods: rules.filter((rule) => rule.status === 'DUPLICATE').map((rule) => rule.method),
      invalidMethods: rules.filter((rule) => rule.status === 'INVALID').map((rule) => rule.method),
    },
    rules,
  };
}

function paymentFeePolicyFingerprint(policy: PaymentFeePolicyPreflightInput) {
  const rules = policy.rules
    .map((rule) => ({
      active: rule.active,
      feeType: rule.feeType,
      fixedAmount: rule.fixedAmount,
      method: rule.method,
      payer: rule.payer,
      rateBps: rule.rateBps,
      treatment: rule.treatment,
    }))
    .sort((left, right) => left.method.localeCompare(right.method));
  return createHash('sha256')
    .update(JSON.stringify({
      effectiveFrom: policy.effectiveFrom.toISOString(),
      effectiveTo: policy.effectiveTo?.toISOString() ?? null,
      notes: normalizeNullable(policy.notes),
      rules,
    }))
    .digest('hex');
}

function paymentFeePolicyApprovalMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as {
      policyFingerprint?: string;
      reason?: string;
      requestId?: string;
      requestedAt?: string;
      requestedBy?: { id: string; email: string | null; fullName: string | null };
    };
  }
  const policyFingerprint = typeof value.policyFingerprint === 'string' ? value.policyFingerprint : undefined;
  const reason = typeof value.reason === 'string' ? value.reason : undefined;
  const requestId = typeof value.requestId === 'string' ? value.requestId : undefined;
  const requestedAt = typeof value.requestedAt === 'string' ? value.requestedAt : undefined;
  const requestedByValue = value.requestedBy;
  const requestedBy = requestedByValue && typeof requestedByValue === 'object' && !Array.isArray(requestedByValue)
    && typeof requestedByValue.id === 'string'
    ? {
        id: requestedByValue.id,
        email: typeof requestedByValue.email === 'string' ? requestedByValue.email : null,
        fullName: typeof requestedByValue.fullName === 'string' ? requestedByValue.fullName : null,
      }
    : undefined;
  return { policyFingerprint, reason, requestId, requestedAt, requestedBy };
}

function paymentFeePolicyApprovalView(
  policy: PaymentFeePolicyPreflightInput,
  event: PaymentFeePolicyApprovalRequest | null,
) {
  const metadata = paymentFeePolicyApprovalMetadata(event?.metadata ?? null);
  const status = policy.status === TaxPolicyStatus.ACTIVE
    ? ('ACTIVE' as const)
    : !event
      ? ('NOT_REQUESTED' as const)
      : event.action === 'payment_fee_policy.approval_rejected'
        ? ('REJECTED' as const)
        : event.action === 'payment_fee_policy.approval_cancelled'
          ? ('CANCELLED' as const)
          : metadata.policyFingerprint === paymentFeePolicyFingerprint(policy)
            ? ('REQUESTED' as const)
            : ('STALE' as const);
  const requestEvent = event?.action === 'payment_fee_policy.approval_requested';
  return {
    policyId: policy.id,
    status,
    requestId: requestEvent ? event.id : metadata.requestId ?? null,
    requestedAt: requestEvent ? event.createdAt.toISOString() : metadata.requestedAt ?? null,
    requestedBy: requestEvent ? event.actor : metadata.requestedBy ?? null,
    decisionAt: event && !requestEvent ? event.createdAt.toISOString() : null,
    decidedBy: event && !requestEvent ? event.actor : null,
    reason: metadata.reason ?? null,
  };
}

function adminPaymentFeeRemediationReadiness(
  policy: AdminPaymentFeeRemediationPolicy | null,
  period: string,
) {
  const blockers: Array<{ code: string; message: string }> = [];
  if (!policy) {
    blockers.push({
      code: 'ACTIVE_POLICY_REQUIRED',
      message: 'An active payment fee policy is required before historical fee differences can be previewed.',
    });
    return { blockers, ready: false };
  }

  for (const method of Object.values(PaymentMethod)) {
    const rules = policy.rules.filter((rule) => rule.method === method);
    if (rules.length !== 1) {
      blockers.push({
        code: rules.length ? 'DUPLICATE_METHOD_RULE' : 'MISSING_METHOD_RULE',
        message: `Historical preview requires exactly one active ${method} rule.`,
      });
      continue;
    }
    const validationMessage = paymentFeeRuleValidationMessage(rules[0]);
    if (validationMessage) {
      blockers.push({ code: 'INVALID_METHOD_RULE', message: `${method}: ${validationMessage}` });
    }
  }

  const bounds = adminPaymentFeeRemediationPeriodBounds(period);
  if (policy.effectiveFrom > bounds.start || (policy.effectiveTo && policy.effectiveTo < bounds.end)) {
    blockers.push({
      code: 'POLICY_PERIOD_NOT_COVERED',
      message: `Active policy ${policy.id} does not cover the full ${period} settlement period.`,
    });
  }

  return { blockers, ready: blockers.length === 0 };
}

function adminPaymentFeeRemediationPeriodBounds(period: string) {
  const [year, month] = period.split('-').map(Number);
  const offsetMs = 7 * 60 * 60 * 1000;
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - offsetMs),
    end: new Date(Date.UTC(year, month, 1) - offsetMs),
  };
}

function adminPaymentFeeEvidenceSqlCondition() {
  return Prisma.sql`
    (
      "paymentFeePolicyVersionId" IS NULL
      OR COALESCE("paymentFeeRuleSnapshot" ? 'reason', false)
    )
  `;
}

function adminPaymentFeeExpectedAmountSql(rules: AdminPaymentFeeRemediationPolicy['rules']) {
  if (!rules.length) {
    return Prisma.sql`0::bigint`;
  }
  const branches = rules.map(
    (rule) => Prisma.sql`
      WHEN "paymentMethod" = ${rule.method}::"PaymentMethod"
      THEN ROUND(("customerPaymentAmount"::numeric * ${rule.rateBps}) / 10000)::bigint
        + ${rule.fixedAmount}
    `,
  );
  return Prisma.sql`CASE ${Prisma.join(branches, ' ')} ELSE 0 END`;
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

type ManualWalletAdjustmentLedgerRow = ReturnType<typeof manualWalletAdjustmentLedgerRow>;

const MANUAL_WALLET_ADJUSTMENT_PROVIDER_LEDGER_TYPES: ProviderWalletLedgerType[] = [
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_CREDIT,
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_DEBIT,
  ProviderWalletLedgerType.MANUAL_ADJUSTMENT_REVERSAL,
];

const MANUAL_WALLET_ADJUSTMENT_PROVIDER_SQL_TYPES = MANUAL_WALLET_ADJUSTMENT_PROVIDER_LEDGER_TYPES.map(
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

function normalizeManualWalletAdjustmentRequestStatus(value?: string | null) {
  const normalized = normalizeNullable(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  if (Object.values(ManualWalletAdjustmentRequestStatus).includes(normalized as ManualWalletAdjustmentRequestStatus)) {
    return normalized as ManualWalletAdjustmentRequestStatus;
  }
  throw new BadRequestException('Manual wallet adjustment request status is invalid');
}

function assertManualWalletAdjustmentRequestPending(status: ManualWalletAdjustmentRequestStatus) {
  if (status !== ManualWalletAdjustmentRequestStatus.REQUESTED) {
    throw new ConflictException('Manual wallet adjustment request is no longer pending');
  }
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
    return [
      ProviderStatus.ONLINE_AVAILABLE,
      ProviderStatus.ONLINE_BUSY,
      ProviderStatus.ONLINE_AVAILABLE_SOON,
    ];
  }
  if (normalized === 'available') return [ProviderStatus.ONLINE_AVAILABLE];
  if (normalized === 'busy') return [ProviderStatus.ONLINE_BUSY];
  if (normalized === 'soon') return [ProviderStatus.ONLINE_AVAILABLE_SOON];
  if (normalized === 'offline') return [ProviderStatus.OFFLINE];

  const enumValue = normalized.toUpperCase();
  return Object.values(ProviderStatus).includes(enumValue as ProviderStatus)
    ? [enumValue as ProviderStatus]
    : null;
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
    filters.push({
      id: options.negativeWalletIds.length ? { in: [...options.negativeWalletIds] } : '__none__',
    });
  }
  if (options.walletStatus === 'positive') {
    filters.push({
      id: options.positiveWalletIds.length ? { in: [...options.positiveWalletIds] } : '__none__',
    });
  }
  if (options.walletStatus === 'zero') {
    filters.push({
      id: { notIn: [...new Set([...options.negativeWalletIds, ...options.positiveWalletIds])] },
    });
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

function partnerOverviewAverageResponseSecondsByProvider(
  rows: readonly PartnerOverviewResponseParticipantRow[],
) {
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
    const eligiblePartners = providers.filter((provider) =>
      options.eligibleProviderIds.has(provider.id),
    ).length;
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
  const lastBookingAt = latestDate(
    provider.selectedBookings[0]?.closedAt,
    provider.selectedBookings[0]?.updatedAt,
  );
  const lastActivityAt = latestDate(
    lastOnlineAt,
    lastBookingAt,
    completed?.lastActivityAt,
    cancelled?.lastActivityAt,
    provider.updatedAt,
  );
  const approved =
    provider.verification?.status === VerificationStatus.APPROVED &&
    provider.kyc?.status === ProviderKycStatus.APPROVED;
  const completedBookings = completed?.count ?? 0;
  const cancelledBookings = cancelled?.count ?? 0;
  const cancellationRate = percentageValue(cancelledBookings, completedBookings + cancelledBookings);
  const mediaStats = partnerOverviewProviderMediaStats(provider);
  const priceStats = partnerOverviewProviderPriceStats(provider);
  const inactive7d = !lastActivityAt || lastActivityAt.getTime() < options.active7dStart.getTime();
  const inactive30d = !lastActivityAt || lastActivityAt.getTime() < options.active30dStart.getTime();
  const eligibleToAccept = partnerOverviewProviderEligible(
    provider,
    options.walletBalance,
    options.locationFreshBoundary,
  );
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
      vietnamRegionCodeFromValues([provider.city, provider.residentialAddress, provider.serviceArea], {
        latitude: provider.currentLat,
        longitude: provider.currentLng,
      }),
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
      count: approvedFacts.filter(
        (fact) => fact.status === ProviderStatus.ONLINE_AVAILABLE && fact.eligibleToAccept,
      ).length,
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
  const list = (key: string, title: string, rows: PartnerOverviewProviderFact[], viewAllHref: string) => ({
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
    count: rows.filter((row) => partnerOverviewSelectionIssueMatches(row.readinessFlags, option.issue))
      .length,
  }));
}

function partnerOverviewSelectionIssueMatches(
  flags: readonly string[],
  issue: PartnerOverviewSelectionIssue | null,
) {
  if (!issue) return true;

  switch (issue) {
    case 'availability':
      return flags.some((flag) => ['Available soon', 'Busy now', 'Offline now'].includes(flag));
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
      return (
        partnerOverviewAvailabilityWeight(right.readinessFlags) -
          partnerOverviewAvailabilityWeight(left.readinessFlags) || defaultSort
      );
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
    segment(
      'pending',
      'New Pending',
      facts.filter((fact) => !fact.approved),
      'Needs admin review before marketplace exposure.',
      'Review KYC and profile documents.',
      '/partners?review=unapproved',
      'warning',
    ),
    segment(
      'documents-missing',
      'Documents Missing',
      facts.filter(
        (fact) =>
          fact.verificationStatus !== VerificationStatus.APPROVED ||
          fact.kycStatus !== ProviderKycStatus.APPROVED,
      ),
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
    segment(
      'first-job',
      'First Job Pending',
      facts.filter((fact) => fact.approved && fact.completedBookings === 0),
      'Approved supply without a completed booking.',
      'Check pricing, service coverage, and activation.',
      '/partners?review=marketplace-ready&bookingFlow=first-job-pending',
      'info',
    ),
    segment(
      'high-activity',
      'High Activity',
      facts.filter((fact) => fact.completedBookings >= 3),
      'Reliable supply anchors in the selected range.',
      'Keep available and monitor payout readiness.',
      '/partners?sort=completed-work',
      'success',
    ),
    segment(
      'high-rating',
      'High Rating',
      facts.filter((fact) => fact.rating >= 4.5 && fact.reviewCount >= 3),
      'Partners with strong customer feedback.',
      'Feature in marketplace and retention campaigns.',
      '/partners?sort=rating',
      'success',
    ),
    segment(
      'low-rating',
      'Low Rating',
      facts.filter((fact) => fact.lowReviewCount > 0 || (fact.reviewCount > 0 && fact.rating < 3)),
      'Partners with recent low-quality signals.',
      'Review service records and customer complaints.',
      '/partners?review=quality-risk',
      'danger',
    ),
    segment(
      'high-cancellation',
      'High Cancellation',
      facts.filter((fact) => fact.cancellationRate >= 20),
      'Cancellation risk that can hurt matching.',
      'Audit work schedule and cancellation reasons.',
      '/partners?review=high-cancellation',
      'warning',
    ),
    segment(
      'no-show',
      'No-show Risk',
      facts.filter((fact) => fact.noShowReports > 0),
      'Open no-show evidence needs operator attention.',
      'Review no-show reports and possible sanctions.',
      '/partners?review=no-show-risk',
      'danger',
    ),
    segment(
      'negative-wallet',
      'Negative Wallet',
      facts.filter((fact) => fact.walletBalance < 0),
      'Company receivable exposure from partner wallet.',
      'Resolve deposit or receivable workflow.',
      '/partners?review=unsettled',
      'danger',
    ),
    segment(
      'payout-blocked',
      'Payout Blocked',
      facts.filter((fact) => fact.walletBalance < 0 || fact.taxStatus !== ProviderTaxProfileStatus.APPROVED),
      'Payout readiness is blocked by wallet debt or missing finance profile review.',
      'Review wallet, withdrawal setup, and tax readiness.',
      '/partners?review=payout-blocked',
      'danger',
    ),
    segment(
      'churn-risk',
      'Churn Risk',
      facts.filter((fact) => fact.approved && fact.inactive30d),
      'Approved supply without recent activity.',
      'Send reactivation push or call.',
      '/partners?review=marketplace-ready&activity=inactive-30d',
      'warning',
    ),
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

function partnerOverviewAverageDetailDurationSeconds(rows: Array<{ metadata: Prisma.JsonValue | null }>) {
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
      key: label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      label,
      count,
      conversionRate:
        typeof count === 'number' && conversionBase ? percentageValue(count, conversionBase) : null,
      dropoffRate:
        typeof count === 'number' && dropoffBase
          ? Math.max(0, 100 - percentageValue(count, dropoffBase))
          : null,
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

function usageOverviewClosedAtSql(dateWhere: ReturnType<typeof adminUsageDateWhere>, tableAlias?: string) {
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
    categories:
      operator.adminOperatorPermission?.categories ??
      defaultAdminOperatorPermissionCategories(operator.roles),
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

function adminBookingSettlementDryRunItem(preview: AdminBookingSettlementDryRunPreview) {
  const dryRun = preview.historicalSettlementDryRun;
  const paymentFeeRule = adminJsonObject(dryRun?.paymentFeeRuleSnapshot);
  const paymentFeeRuleStatus = !dryRun
    ? 'UNAVAILABLE'
    : typeof paymentFeeRule?.ruleId === 'string'
      ? 'MATCHED_POLICY_RULE'
      : 'DEFAULTED';

  return {
    blockers: preview.blockers,
    bookingId: preview.bookingId,
    canRepair: preview.canRepair,
    completedAt: preview.completedAt,
    expected: dryRun
      ? {
          companyOutputVat: dryRun.amounts.companyOutputVat,
          customerPaymentAmount: dryRun.customerPaymentAmount,
          journalBalanced: dryRun.journal.totalDebit === dryRun.journal.totalCredit,
          journalReconciliationDelta: dryRun.journal.reconciliationDelta,
          journalTotalCredit: dryRun.journal.totalCredit,
          journalTotalDebit: dryRun.journal.totalDebit,
          partnerPayoutAmount: dryRun.partnerPayoutAmount,
          partnerWithholdingTotal: dryRun.amounts.partnerWithholdingTotal,
          paymentProcessingFee: dryRun.amounts.paymentProcessingFee,
          platformFeeGross: dryRun.platformFeeGross,
          platformFeeNetRevenue: dryRun.amounts.platformFeeNetRevenue,
        }
      : null,
    monthlyClosingStatus: preview.monthlyClosingStatus,
    monthlyPeriod: preview.monthlyPeriod,
    paymentFeeDefaultReason:
      typeof paymentFeeRule?.reason === 'string' ? paymentFeeRule.reason : null,
    paymentFeePolicyVersionId: dryRun?.paymentFeePolicyVersionId ?? null,
    paymentFeeRuleStatus,
    paymentMethod: preview.payment?.method ?? null,
    platformFeePolicyVersionId: dryRun?.platformFeePolicyVersionId ?? null,
    platformVatEvidenceStatus: adminPlatformVatEvidenceStatus(dryRun),
    platformVatRateBps: dryRun?.platformVatRateBps ?? null,
  };
}

type AdminBookingSettlementDryRunItem = ReturnType<typeof adminBookingSettlementDryRunItem>;

function adminBookingSettlementDryRunCounts(items: AdminBookingSettlementDryRunItem[]) {
  return items.reduce(
    (counts, item) => {
      counts.eligible += item.canRepair ? 1 : 0;
      counts.blocked += item.canRepair ? 0 : 1;
      counts.journalBalanced += item.expected?.journalBalanced ? 1 : 0;
      counts.reconciliationReview += item.expected?.journalReconciliationDelta ? 1 : 0;
      counts.paymentFeePolicyMatched += item.paymentFeeRuleStatus === 'MATCHED_POLICY_RULE' ? 1 : 0;
      counts.paymentFeeDefaulted += item.paymentFeeRuleStatus === 'DEFAULTED' ? 1 : 0;
      counts.companyOutputVatPositive += (item.expected?.companyOutputVat ?? 0) > 0 ? 1 : 0;
      counts.companyOutputVatZero += item.expected?.companyOutputVat === 0 ? 1 : 0;
      counts.platformVatEvidenceReady += isAdminPlatformVatEvidenceReady(item.platformVatEvidenceStatus) ? 1 : 0;
      counts.platformVatExplicitZeroServiceRule +=
        item.platformVatEvidenceStatus === 'EXPLICIT_ZERO_SERVICE_PAYOUT_RULE' ? 1 : 0;
      counts.platformVatUnexplainedZero += item.platformVatEvidenceStatus === 'ZERO_UNEXPLAINED' ? 1 : 0;
      counts.platformVatZeroFromPolicy += item.platformVatEvidenceStatus === 'ZERO_FROM_POLICY' ? 1 : 0;
      return counts;
    },
    {
      blocked: 0,
      companyOutputVatPositive: 0,
      companyOutputVatZero: 0,
      eligible: 0,
      journalBalanced: 0,
      paymentFeeDefaulted: 0,
      paymentFeePolicyMatched: 0,
      platformVatEvidenceReady: 0,
      platformVatExplicitZeroServiceRule: 0,
      platformVatUnexplainedZero: 0,
      platformVatZeroFromPolicy: 0,
      reconciliationReview: 0,
    },
  );
}

function adminBookingSettlementDryRunPolicyGate(
  counts: ReturnType<typeof adminBookingSettlementDryRunCounts>,
) {
  const issues = [
    ...(counts.blocked
      ? [
          {
            code: 'PREVIEW_BLOCKED',
            count: counts.blocked,
            message: 'Blocked previews must be resolved before any repair approval.',
          },
        ]
      : []),
    ...(counts.reconciliationReview
      ? [
          {
            code: 'JOURNAL_RECONCILIATION_REVIEW',
            count: counts.reconciliationReview,
            message: 'A non-zero journal reconstruction delta requires Finance review.',
          },
        ]
      : []),
    ...(counts.paymentFeeDefaulted
      ? [
          {
            code: 'PAYMENT_FEE_POLICY_DEFAULTED',
            count: counts.paymentFeeDefaulted,
            message: 'Historical payment fee evidence defaulted to zero without a matched policy rule.',
          },
        ]
      : []),
    ...(counts.platformVatUnexplainedZero
      ? [
          {
            code: 'PLATFORM_VAT_EVIDENCE_UNEXPLAINED',
            count: counts.platformVatUnexplainedZero,
            message: 'Zero company output VAT has no retained service rule or platform policy evidence.',
          },
        ]
      : []),
  ];

  return {
    issues,
    status: issues.length ? ('REVIEW_REQUIRED' as const) : ('READY_FOR_INDIVIDUAL_APPROVAL' as const),
  };
}

function adminBookingSettlementDryRunBatches(items: AdminBookingSettlementDryRunItem[]) {
  const grouped = new Map<string, AdminBookingSettlementDryRunItem[]>();
  items.forEach((item) => {
    const paymentMethod = item.paymentMethod ?? 'UNKNOWN';
    const current = grouped.get(paymentMethod) ?? [];
    current.push(item);
    grouped.set(paymentMethod, current);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([paymentMethod, methodItems]) =>
      Array.from(
        { length: Math.ceil(methodItems.length / ADMIN_BOOKING_SETTLEMENT_REVIEW_BATCH_SIZE) },
        (_, batchIndex) => {
          const batchItems = methodItems.slice(
            batchIndex * ADMIN_BOOKING_SETTLEMENT_REVIEW_BATCH_SIZE,
            (batchIndex + 1) * ADMIN_BOOKING_SETTLEMENT_REVIEW_BATCH_SIZE,
          );
          const counts = adminBookingSettlementDryRunCounts(batchItems);
          const requiresPolicyReview =
            counts.blocked > 0 ||
            counts.reconciliationReview > 0 ||
            counts.paymentFeeDefaulted > 0 ||
            counts.platformVatUnexplainedZero > 0;
          return {
            batchKey: `${paymentMethod.toLowerCase()}-${batchIndex + 1}`,
            bookingIds: batchItems.map((item) => item.bookingId),
            counts,
            executionStatus: requiresPolicyReview
              ? ('REVIEW_REQUIRED' as const)
              : ('READY_FOR_INDIVIDUAL_APPROVAL' as const),
            paymentMethod,
            recordCount: batchItems.length,
            totals: adminBookingSettlementDryRunTotals(batchItems),
          };
        },
      ),
    );
}

type AdminPlatformVatEvidenceStatus =
  | 'EXPLICIT_ZERO_SERVICE_PAYOUT_RULE'
  | 'POSITIVE'
  | 'UNAVAILABLE'
  | 'ZERO_FROM_POLICY'
  | 'ZERO_UNEXPLAINED';

function adminPlatformVatEvidenceStatus(
  dryRun: AdminHistoricalSettlementDryRun | null,
): AdminPlatformVatEvidenceStatus {
  if (!dryRun) return 'UNAVAILABLE';
  if (dryRun.amounts.companyOutputVat > 0 || dryRun.platformVatRateBps > 0) return 'POSITIVE';

  const ruleSnapshot = adminJsonObject(dryRun.platformFeeRuleSnapshot);
  const lines = Array.isArray(ruleSnapshot?.lines) ? ruleSnapshot.lines : [];
  const hasExplicitZeroServiceRules =
    ruleSnapshot?.source === 'SERVICE_PAYOUT_RULE' &&
    lines.length > 0 &&
    lines.every((line) => adminJsonObject(line)?.vatBps === 0);
  if (hasExplicitZeroServiceRules) return 'EXPLICIT_ZERO_SERVICE_PAYOUT_RULE';
  if (dryRun.platformFeePolicyVersionId) return 'ZERO_FROM_POLICY';
  return 'ZERO_UNEXPLAINED';
}

function isAdminPlatformVatEvidenceReady(status: AdminPlatformVatEvidenceStatus) {
  return status !== 'UNAVAILABLE' && status !== 'ZERO_UNEXPLAINED';
}

function adminBookingSettlementDryRunTotals(items: AdminBookingSettlementDryRunItem[]) {
  return items.reduce(
    (totals, item) => {
      const expected = item.expected;
      if (!expected) return totals;
      totals.companyOutputVat += expected.companyOutputVat;
      totals.customerPaymentAmount += expected.customerPaymentAmount;
      totals.journalReconciliationDelta += expected.journalReconciliationDelta;
      totals.journalTotalCredit += expected.journalTotalCredit;
      totals.journalTotalDebit += expected.journalTotalDebit;
      totals.partnerPayoutAmount += expected.partnerPayoutAmount;
      totals.partnerWithholdingTotal += expected.partnerWithholdingTotal;
      totals.paymentProcessingFee += expected.paymentProcessingFee;
      totals.platformFeeGross += expected.platformFeeGross;
      totals.platformFeeNetRevenue += expected.platformFeeNetRevenue;
      return totals;
    },
    {
      companyOutputVat: 0,
      customerPaymentAmount: 0,
      journalReconciliationDelta: 0,
      journalTotalCredit: 0,
      journalTotalDebit: 0,
      partnerPayoutAmount: 0,
      partnerWithholdingTotal: 0,
      paymentProcessingFee: 0,
      platformFeeGross: 0,
      platformFeeNetRevenue: 0,
    },
  );
}

function adminCountBy<T>(items: T[], keyForItem: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyForItem(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function adminJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function adminBankTransactionCreationEvidence(
  value: unknown,
  adminsById: ReadonlyMap<string, AdminOperatorIdentityRecord>,
) {
  const metadata = adminJsonObject(value);
  const importedByAdminId = adminJsonString(metadata?.importedByAdminId);
  if (!importedByAdminId) {
    return null;
  }
  const approvalAdminId = adminJsonString(metadata?.approvalAdminId);
  return {
    approvalAdminId,
    approvalAdmin: approvalAdminId ? (adminsById.get(approvalAdminId) ?? null) : null,
    batchImportId: adminJsonString(metadata?.batchImportId),
    csvRowNumber:
      typeof metadata?.csvRowNumber === 'number' && Number.isSafeInteger(metadata.csvRowNumber)
        ? metadata.csvRowNumber
        : null,
    importedByAdminId,
    importedBy: adminsById.get(importedByAdminId) ?? null,
    operatorReason: adminJsonString(metadata?.operatorReason),
    sourceFileName: adminJsonString(metadata?.sourceFileName),
  };
}

function adminBankTransactionIgnoreEvidence(
  value: unknown,
  adminsById: ReadonlyMap<string, AdminOperatorIdentityRecord>,
) {
  const metadata = adminJsonObject(value);
  const reason = adminJsonString(metadata?.ignoreReason);
  if (!reason) {
    return null;
  }

  const approvalAdminId = adminJsonString(metadata?.ignoreApprovedByAdminId);
  const ignoredByAdminId = adminJsonString(metadata?.ignoredByAdminId);
  return {
    approvalAdminId,
    approvalAdmin: approvalAdminId ? (adminsById.get(approvalAdminId) ?? null) : null,
    ignoredAt: adminJsonString(metadata?.ignoredAt),
    ignoredByAdminId,
    ignoredBy: ignoredByAdminId ? (adminsById.get(ignoredByAdminId) ?? null) : null,
    reason,
  };
}

function adminJsonString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function adminJsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function adminPaymentOperationsTake(value: number | string | null | undefined) {
  return adminBoundedPositiveInteger(
    value,
    ADMIN_PAYMENT_OPERATIONS_DEFAULT_LIMIT,
    ADMIN_PAYMENT_OPERATIONS_MAX_LIMIT,
  );
}

function adminBookingSettlementGapTake(value: number | string | null | undefined) {
  return adminBoundedPositiveInteger(
    value,
    ADMIN_BOOKING_SETTLEMENT_GAP_DEFAULT_LIMIT,
    ADMIN_BOOKING_SETTLEMENT_GAP_MAX_LIMIT,
  );
}

function adminBookingSettlementGapWhere(
  options: AdminBookingSettlementGapQuery,
  now: Date,
): Prisma.BookingWhereInput {
  const filters: Prisma.BookingWhereInput[] = [
    { status: BookingStatus.COMPLETED },
    { settlementSnapshot: { is: null } },
  ];
  const ageWhere = adminBookingSettlementGapAgeWhere(normalizeAdminBookingSettlementGapAge(options.age), now);
  if (ageWhere) {
    filters.push(ageWhere);
  }
  const trackWhere = adminBookingSettlementGapRepairTrackWhere(
    normalizeAdminBookingSettlementGapTrack(options.track),
  );
  if (trackWhere) {
    filters.push(trackWhere);
  }
  const periodWhere = adminBookingSettlementGapPeriodWhere(options.period);
  if (periodWhere) {
    filters.push(periodWhere);
  }
  const paymentMethod = normalizeAdminBookingSettlementGapPaymentMethod(options.paymentMethod);
  if (paymentMethod) {
    filters.push({ payment: { is: { method: paymentMethod } } });
  }

  const query = normalizeNullable(options.q)?.slice(0, 80);
  if (query) {
    const textFilter = { contains: query, mode: Prisma.QueryMode.insensitive };
    const userSearch = {
      OR: [{ fullName: textFilter }, { phone: textFilter }],
    };
    filters.push({
      OR: [
        { id: textFilter },
        { customerProfile: { is: { user: { is: userSearch } } } },
        { selectedProvider: { is: { displayName: textFilter } } },
        { selectedProvider: { is: { user: { is: userSearch } } } },
      ],
    });
  }

  return { AND: filters };
}

function normalizeAdminBookingSettlementGapTrack(
  value: string | null | undefined,
): AdminBookingSettlementGapTrack {
  switch (normalizeNullable(value)?.toLowerCase()) {
    case 'canonical':
      return 'canonical';
    case 'historical-ready':
      return 'historical-ready';
    case 'evidence-blocked':
      return 'evidence-blocked';
    case 'manual-review':
      return 'manual-review';
    case 'all':
    default:
      return 'all';
  }
}

function adminBookingSettlementGapRepairTrackWhere(
  track: AdminBookingSettlementGapTrack,
): Prisma.BookingWhereInput | undefined {
  if (track === 'all') {
    return undefined;
  }

  const canonical: Prisma.BookingWhereInput = {
    OR: [
      { earning: { is: null } },
      {
        earning: {
          is: {
            payoutBatchId: null,
            status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          },
        },
      },
    ],
  };
  const historicalReady: Prisma.BookingWhereInput = {
    earning: { is: { paidAt: { not: null }, status: EarningStatus.PAID } },
    payment: { is: { status: PaymentStatus.CAPTURED } },
    platformFeeLogs: { some: {} },
    selectedProviderId: { not: null },
    services: { some: {} },
    taxLogs: { some: {} },
    walletLedgerEntries: { some: {} },
  };
  const evidenceBlocked: Prisma.BookingWhereInput = {
    AND: [
      { earning: { is: { status: EarningStatus.PAID } } },
      {
        OR: [
          { earning: { is: { paidAt: null } } },
          { payment: { is: null } },
          { payment: { is: { status: { not: PaymentStatus.CAPTURED } } } },
          { platformFeeLogs: { none: {} } },
          { selectedProviderId: null },
          { services: { none: {} } },
          { taxLogs: { none: {} } },
          { walletLedgerEntries: { none: {} } },
        ],
      },
    ],
  };

  switch (track) {
    case 'canonical':
      return canonical;
    case 'historical-ready':
      return historicalReady;
    case 'evidence-blocked':
      return evidenceBlocked;
    case 'manual-review':
      return { NOT: { OR: [canonical, historicalReady, evidenceBlocked] } };
    default:
      return undefined;
  }
}

function normalizeAdminBookingSettlementGapPaymentMethod(
  value: string | null | undefined,
): PaymentMethod | null {
  const normalized = normalizeNullable(value)?.toUpperCase();
  return normalized && Object.values(PaymentMethod).includes(normalized as PaymentMethod)
    ? (normalized as PaymentMethod)
    : null;
}

function adminBookingSettlementGapPeriodWhere(
  value: string | null | undefined,
): Prisma.BookingWhereInput | undefined {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalizeNullable(value) ?? '');
  if (!match) {
    return undefined;
  }
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1) - ADMIN_BOOKING_SETTLEMENT_GAP_VIETNAM_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthIndex + 1, 1) - ADMIN_BOOKING_SETTLEMENT_GAP_VIETNAM_OFFSET_MS);
  return adminBookingSettlementGapTimeWhere({ gte: start, lt: end });
}

type AdminBookingSettlementGapListRow = Prisma.BookingGetPayload<{
  select: typeof adminBookingSettlementGapListSelect;
}>;

function adminBookingSettlementGapRepairTrackFromRow(
  row: AdminBookingSettlementGapListRow,
): Exclude<AdminBookingSettlementGapTrack, 'all'> {
  if (
    !row.earning ||
    ((row.earning.status === EarningStatus.PENDING || row.earning.status === EarningStatus.AVAILABLE) &&
      !row.earning.payoutBatchId)
  ) {
    return 'canonical';
  }
  if (row.earning.status !== EarningStatus.PAID) {
    return 'manual-review';
  }
  if (
    row.earning.paidAt &&
    row.selectedProvider &&
    row.payment?.status === PaymentStatus.CAPTURED &&
    row._count.platformFeeLogs > 0 &&
    row._count.services > 0 &&
    row._count.taxLogs > 0 &&
    row._count.walletLedgerEntries > 0
  ) {
    return 'historical-ready';
  }
  return 'evidence-blocked';
}

function normalizeAdminBookingSettlementGapAge(
  value: string | null | undefined,
): AdminBookingSettlementGapAge {
  switch (normalizeNullable(value)?.toLowerCase()) {
    case 'all':
      return 'all';
    case 'recent':
      return 'recent';
    case '24-72h':
      return '24-72h';
    case '3-7d':
      return '3-7d';
    case '7d-plus':
      return '7d-plus';
    case 'backlog':
    default:
      return 'backlog';
  }
}

function adminBookingSettlementGapAgeWhere(
  age: AdminBookingSettlementGapAge,
  now: Date,
): Prisma.BookingWhereInput | undefined {
  if (age === 'all') {
    return undefined;
  }

  const boundary24Hours = new Date(now.getTime() - ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS);
  const boundary72Hours = new Date(now.getTime() - 3 * ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS);
  const boundary7Days = new Date(now.getTime() - 7 * ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS);

  switch (age) {
    case 'recent':
      return adminBookingSettlementGapTimeWhere({ gte: boundary24Hours });
    case '24-72h':
      return adminBookingSettlementGapTimeWhere({ gte: boundary72Hours, lt: boundary24Hours });
    case '3-7d':
      return adminBookingSettlementGapTimeWhere({ gte: boundary7Days, lt: boundary72Hours });
    case '7d-plus':
      return adminBookingSettlementGapTimeWhere({ lt: boundary7Days });
    case 'backlog':
      return adminBookingSettlementGapTimeWhere({ lt: boundary24Hours });
    default:
      return undefined;
  }
}

function adminBookingSettlementGapTimeWhere(dateFilter: Prisma.DateTimeFilter): Prisma.BookingWhereInput {
  return {
    OR: [{ closedAt: dateFilter }, { closedAt: null, updatedAt: dateFilter }],
  };
}

function adminBookingSettlementGapAgeBucket(gapAt: Date, now: Date) {
  const ageMs = Math.max(0, now.getTime() - gapAt.getTime());
  if (ageMs < ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS) return 'RECENT';
  if (ageMs < 3 * ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS) return '24_TO_72_HOURS';
  if (ageMs < 7 * ADMIN_BOOKING_SETTLEMENT_GAP_DAY_MS) return '3_TO_7_DAYS';
  return '7_DAYS_PLUS';
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
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizeNullable(options.period) ?? '')) {
    filters.push({ monthlyPeriod: normalizeNullable(options.period) as string });
  }
  const paymentMethod = normalizeNullable(options.paymentMethod)?.toUpperCase();
  if (paymentMethod && Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
    filters.push({ paymentMethod: paymentMethod as PaymentMethod });
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
    case 'payment-fee-evidence':
      return {
        OR: [
          { paymentFeePolicyVersionId: null },
          { paymentFeeRuleSnapshot: { path: ['reason'], not: Prisma.JsonNull } },
        ],
      };
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
  const query = normalizeNullable(options.q);

  if (dateRange) {
    filters.push({ occurredAt: dateRange });
  }
  if (reviewWhere) {
    filters.push(reviewWhere);
  }
  if (query) {
    filters.push({
      OR: [
        { transferRef: { contains: query, mode: 'insensitive' } },
        { counterpartyName: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { sourceKey: { contains: query, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.length === 0) {
    return undefined;
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminBankReconciliationWithdrawalCandidate(
  value: string | null | undefined,
): AdminBankReconciliationWithdrawalCandidate | undefined {
  switch (normalizeNullable(value)?.toLowerCase()) {
    case 'eligible':
      return 'eligible';
    case 'none':
      return 'none';
    case 'review':
      return 'review';
    case 'strong':
      return 'strong';
    default:
      return undefined;
  }
}

function adminBankReconciliationWithdrawalCandidateSet(options: AdminPaymentOperationsQuery) {
  const filters: Prisma.Sql[] = [
    Prisma.sql`bank."type" = ${CompanyBankTransactionType.OUTFLOW}::"CompanyBankTransactionType"`,
    Prisma.sql`bank."status" IN (
      ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
      ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
    )`,
  ];
  const bounds = adminPaymentDateRangeBounds(options.range);
  if (bounds) {
    filters.push(
      Prisma.sql`bank."occurredAt" BETWEEN ${new Date(bounds.startMs)} AND ${new Date(bounds.endMs)}`,
    );
  }
  const review = normalizeNullable(options.review ?? options.status)?.toLowerCase();
  switch (review) {
    case 'needs-action':
    case 'unmatched':
      filters.push(
        Prisma.sql`bank."status" = ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus"`,
      );
      break;
    case 'partial':
    case 'partially-matched':
      filters.push(
        Prisma.sql`bank."status" = ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"`,
      );
      break;
    case 'matched':
    case 'ignored':
    case 'reversed':
    case 'inflow':
      filters.push(Prisma.sql`FALSE`);
      break;
    default:
      break;
  }
  const query = normalizeNullable(options.q);
  if (query) {
    const queryPattern = `%${query.replace(/[!%_]/g, '!$&')}%`;
    filters.push(Prisma.sql`(
      bank."transferRef" ILIKE ${queryPattern} ESCAPE '!'
      OR bank."counterpartyName" ILIKE ${queryPattern} ESCAPE '!'
      OR bank."description" ILIKE ${queryPattern} ESCAPE '!'
      OR bank."sourceKey" ILIKE ${queryPattern} ESCAPE '!'
    )`);
  }

  return Prisma.sql`
    SELECT
      bank."id" AS "bankTransactionId",
      bank."amount",
      bank."occurredAt",
      bank."status",
      COUNT(withdrawal."id")::bigint AS "candidateCount",
      COUNT(withdrawal."id") FILTER (
        WHERE (
          bank."transferRef" IS NOT NULL
          AND withdrawal."transferRef" IS NOT NULL
          AND UPPER(TRIM(bank."transferRef")) = UPPER(TRIM(withdrawal."transferRef"))
        ) OR (
          withdrawal."amount" = bank."amount"
          AND ABS(EXTRACT(EPOCH FROM (
            COALESCE(withdrawal."paidAt", withdrawal."createdAt") - bank."occurredAt"
          ))) <= ${3 * 24 * 60 * 60}
        )
      )::bigint AS "strongCount"
    FROM "CompanyBankTransaction" bank
    LEFT JOIN "ProviderWalletWithdrawalRequest" withdrawal
      ON withdrawal."status" = ${ProviderWalletWithdrawalRequestStatus.PAID}::"ProviderWalletWithdrawalRequestStatus"
      AND withdrawal."currency" = bank."currency"
      AND COALESCE(withdrawal."paidAt", withdrawal."createdAt") BETWEEN
        bank."occurredAt" - INTERVAL '30 days'
        AND bank."occurredAt" + INTERVAL '30 days'
      AND (
        ABS(withdrawal."amount" - bank."amount") <= GREATEST(
          10000,
          LEAST(100000, ROUND(bank."amount" * 0.1))
        )
        OR (
          bank."transferRef" IS NOT NULL
          AND withdrawal."transferRef" IS NOT NULL
          AND UPPER(TRIM(bank."transferRef")) = UPPER(TRIM(withdrawal."transferRef"))
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "BankReconciliationMatch" active_match
        WHERE active_match."withdrawalRequestId" = withdrawal."id"
          AND active_match."status" IN (
            ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus",
            ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
          )
      )
    WHERE ${Prisma.join(filters, ' AND ')}
    GROUP BY bank."id"
  `;
}

function adminBankReconciliationWithdrawalCandidateResultWhere(
  candidate: AdminBankReconciliationWithdrawalCandidate,
) {
  switch (candidate) {
    case 'eligible':
      return Prisma.sql`TRUE`;
    case 'strong':
      return Prisma.sql`candidates."strongCount" > 0`;
    case 'review':
      return Prisma.sql`candidates."candidateCount" > 0 AND candidates."strongCount" = 0`;
    case 'none':
      return Prisma.sql`candidates."candidateCount" = 0`;
  }
}

function adminBankReconciliationLatestReviewAssignmentJoinSql() {
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT assignment_log."metadata", assignment_log."createdAt"
      FROM "AdminAuditLog" assignment_log
      WHERE assignment_log."action" = ${COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION}
        AND assignment_log."target" = 'bank_transaction:' || candidates."bankTransactionId"
      ORDER BY assignment_log."createdAt" DESC, assignment_log."id" DESC
      LIMIT 1
    ) assignment ON TRUE
  `;
}

function adminBankReconciliationReviewAssignmentWhere(options: AdminPaymentOperationsQuery) {
  const assigneeAdminId = normalizeNullable(options.assigneeAdminId);
  if (assigneeAdminId) {
    return Prisma.sql`assignment."metadata"->>'assigneeAdminId' = ${assigneeAdminId}`;
  }
  switch (normalizeNullable(options.assignment)?.toLowerCase()) {
    case 'assigned':
      return Prisma.sql`assignment."metadata"->>'assigneeAdminId' IS NOT NULL`;
    case 'unassigned':
      return Prisma.sql`assignment."metadata"->>'assigneeAdminId' IS NULL`;
    default:
      return Prisma.sql`TRUE`;
  }
}

function adminBankReconciliationAssignmentSummaryRows(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = jsonObject(item);
    const assigneeAdminId = jsonString(record.assigneeAdminId);
    if (!assigneeAdminId) return [];
    return [{
      assigneeAdminId,
      count: jsonNonNegativeInteger(record.count),
      over24hCount: jsonNonNegativeInteger(record.over24hCount),
      over48hCount: jsonNonNegativeInteger(record.over48hCount),
    }];
  });
}

function bankReconciliationWithdrawalRecommendationEvidence(
  bankTransaction: {
    readonly amount: number;
    readonly occurredAt: Date;
    readonly transferRef: string | null;
  },
  withdrawal: {
    readonly amount: number;
    readonly createdAt: Date;
    readonly paidAt: Date | null;
    readonly transferRef: string | null;
  },
) {
  const withdrawalEvidenceAt = withdrawal.paidAt ?? withdrawal.createdAt;
  const amountDelta = Math.abs(withdrawal.amount - bankTransaction.amount);
  const dateDeltaDays =
    Math.round(
      (Math.abs(withdrawalEvidenceAt.getTime() - bankTransaction.occurredAt.getTime()) /
        (24 * 60 * 60_000)) *
        10,
    ) / 10;
  const bankTransferRef = normalizeNullable(bankTransaction.transferRef)?.toUpperCase() ?? null;
  const withdrawalTransferRef = normalizeNullable(withdrawal.transferRef)?.toUpperCase() ?? null;
  const transferRefMatch = Boolean(
    bankTransferRef && withdrawalTransferRef && bankTransferRef === withdrawalTransferRef,
  );
  const exactAmount = amountDelta === 0;

  return {
    amountDelta,
    bankOccurredAt: bankTransaction.occurredAt.toISOString(),
    bankTransferRef,
    confidence: transferRefMatch || (exactAmount && dateDeltaDays <= 3) ? 'STRONG' : 'REVIEW',
    dateDeltaDays,
    exactAmount,
    rankingVersion: 'withdrawal-candidate-v1',
    source: 'SERVER_RECOMPUTED',
    transferRefMatch,
    withdrawalEvidenceAt: withdrawalEvidenceAt.toISOString(),
    withdrawalTransferRef,
  };
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

function normalizeCompanyBankAccountIdentity(input: {
  accountNumberLast4: string;
  accountNumberMasked?: string | null;
  bankName: string;
  currency: string;
  name: string;
}) {
  const name = normalizeNullable(input.name);
  const bankName = normalizeNullable(input.bankName);
  const accountNumberLast4 = normalizeNullable(input.accountNumberLast4);
  const currency = normalizeNullable(input.currency)?.toUpperCase();
  if (!name || !bankName) {
    throw new BadRequestException('Company bank account name and bank name are required');
  }
  if (!accountNumberLast4 || !/^\d{4}$/u.test(accountNumberLast4)) {
    throw new BadRequestException('Company bank account last four digits must contain exactly four digits');
  }
  if (!currency || !/^[A-Z]{3}$/u.test(currency)) {
    throw new BadRequestException('Company bank account currency must be a three-letter code');
  }
  const providedMasked = normalizeNullable(input.accountNumberMasked);
  const compactMasked = providedMasked?.replace(/[\s-]/gu, '') ?? '';
  if (/^\d{5,}$/u.test(compactMasked)) {
    throw new BadRequestException('Full bank account numbers must not be stored; provide a masked value only');
  }
  const maskedDigits = providedMasked?.replace(/\D/gu, '') ?? '';
  if (maskedDigits.length >= 4 && maskedDigits.slice(-4) !== accountNumberLast4) {
    throw new BadRequestException('Masked bank account number must end with accountNumberLast4');
  }
  return {
    accountNumberLast4,
    accountNumberMasked: providedMasked ?? `****${accountNumberLast4}`,
    bankName,
    currency,
    name,
  };
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

function companyBankTransactionDuplicateCandidateWhere(input: {
  amount: number;
  bankAccountId: string;
  counterpartyName: string | null;
  currency: string;
  occurredAt: Date;
  transferRef: string | null;
  type: CompanyBankTransactionType;
}): Prisma.CompanyBankTransactionWhereInput {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sameEconomicEvent: Prisma.CompanyBankTransactionWhereInput = {
    amount: input.amount,
    occurredAt: {
      gte: new Date(input.occurredAt.getTime() - oneDayMs),
      lte: new Date(input.occurredAt.getTime() + oneDayMs),
    },
    ...(input.counterpartyName
      ? { counterpartyName: { equals: input.counterpartyName, mode: Prisma.QueryMode.insensitive } }
      : {}),
  };
  const candidateSignals: Prisma.CompanyBankTransactionWhereInput[] = [sameEconomicEvent];
  if (input.transferRef) {
    candidateSignals.unshift({
      transferRef: { equals: input.transferRef, mode: Prisma.QueryMode.insensitive },
    });
  }

  return {
    bankAccountId: input.bankAccountId,
    currency: input.currency,
    type: input.type,
    OR: candidateSignals,
  };
}

function batchCompanyBankTransactionType(value: string) {
  const normalized = value.trim().toUpperCase();
  return Object.values(CompanyBankTransactionType).includes(normalized as CompanyBankTransactionType)
    ? (normalized as CompanyBankTransactionType)
    : null;
}

function parseCompanyBankTransactionBatchAmount(value: string) {
  const unsigned = value
    .trim()
    .replace(/VND/giu, '')
    .replace(/[₫\s]/gu, '')
    .replace(/^\+/u, '');
  let normalized = unsigned;
  if (/^\d{1,3}(?:[.,]\d{3})+$/u.test(unsigned)) {
    normalized = unsigned.replace(/[.,]/gu, '');
  } else if (/^\d+[.,]00$/u.test(unsigned)) {
    normalized = unsigned.slice(0, -3);
  }
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 10_000_000_000 ? amount : null;
}

function parseCompanyBankTransactionBatchDate(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/u.test(normalized)) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const dayFirst = normalized.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u,
  );
  if (dayFirst) {
    return vietnamLocalDate({
      day: Number(dayFirst[1]),
      hour: Number(dayFirst[4] ?? 0),
      minute: Number(dayFirst[5] ?? 0),
      month: Number(dayFirst[2]),
      second: Number(dayFirst[6] ?? 0),
      year: Number(dayFirst[3]),
    });
  }
  const yearFirst = normalized.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/u,
  );
  if (!yearFirst) {
    return null;
  }
  return vietnamLocalDate({
    day: Number(yearFirst[3]),
    hour: Number(yearFirst[4] ?? 0),
    minute: Number(yearFirst[5] ?? 0),
    month: Number(yearFirst[2]),
    second: Number(yearFirst[6] ?? 0),
    year: Number(yearFirst[1]),
  });
}

function companyBankTransactionInvalidBatchRow(
  input: CompanyBankTransactionBatchRowDto,
  errors: string[],
): AdminCompanyBankTransactionBatchPreviewRow {
  return {
    batchCandidateRowNumbers: [],
    candidates: [],
    classification: 'INVALID',
    errors: errors.length > 0 ? errors : ['Invalid bank statement row'],
    normalized: null,
    raw: companyBankTransactionBatchRawRow(input),
    rowNumber: input.rowNumber,
  };
}

function companyBankTransactionBatchRawRow(
  input: CompanyBankTransactionBatchRowDto,
): AdminCompanyBankTransactionBatchRawRow {
  return {
    amount: input.amount,
    counterpartyName: input.counterpartyName ?? '',
    occurredAt: input.occurredAt,
    transferRef: input.transferRef ?? '',
    valueDate: input.valueDate ?? '',
  };
}

function vietnamLocalDate(input: {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}) {
  if (
    input.year < 2000 ||
    input.year > 2100 ||
    input.month < 1 ||
    input.month > 12 ||
    input.day < 1 ||
    input.day > new Date(Date.UTC(input.year, input.month, 0)).getUTCDate() ||
    input.hour < 0 ||
    input.hour > 23 ||
    input.minute < 0 ||
    input.minute > 59 ||
    input.second < 0 ||
    input.second > 59
  ) {
    return null;
  }
  return new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour - 7, input.minute, input.second),
  );
}

function companyBankTransactionRowsPotentialDuplicate(
  candidate: AdminCompanyBankTransactionBatchNormalizedRow,
  row: AdminCompanyBankTransactionBatchNormalizedRow,
) {
  if (
    candidate.bankAccountId !== row.bankAccountId ||
    candidate.currency !== row.currency ||
    candidate.type !== row.type
  ) {
    return false;
  }
  if (
    row.transferRef &&
    candidate.transferRef &&
    row.transferRef.toLocaleLowerCase() === candidate.transferRef.toLocaleLowerCase()
  ) {
    return true;
  }
  if (candidate.amount !== row.amount) {
    return false;
  }
  const withinOneDay = Math.abs(new Date(candidate.occurredAt).getTime() - new Date(row.occurredAt).getTime()) <= 86_400_000;
  if (!withinOneDay) {
    return false;
  }
  return row.counterpartyName
    ? candidate.counterpartyName?.toLocaleLowerCase() === row.counterpartyName.toLocaleLowerCase()
    : true;
}

function companyBankTransactionBatchSummary(rows: AdminCompanyBankTransactionBatchPreviewRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.classification === 'NEW') summary.new += 1;
      if (row.classification === 'POTENTIAL_DUPLICATE') summary.potentialDuplicate += 1;
      if (row.classification === 'EXACT_DUPLICATE') summary.exactDuplicate += 1;
      if (row.classification === 'INVALID') summary.invalid += 1;
      return summary;
    },
    { exactDuplicate: 0, invalid: 0, new: 0, potentialDuplicate: 0, total: 0 },
  );
}

function adminCompanyBankTransactionImportBatchHistoryItem(
  log: Prisma.AdminAuditLogGetPayload<{ select: typeof adminAuditLogSelect }>,
) {
  const metadata = jsonObject(log.metadata);
  const targetBatchId = log.target.startsWith('company_bank_transaction_batch:')
    ? log.target.slice('company_bank_transaction_batch:'.length)
    : log.id;
  return {
    approvalAdminId: jsonString(metadata.approvalAdminId),
    assigneeAdminId: jsonString(metadata.assigneeAdminId),
    assignedAt: jsonString(metadata.assignedAt),
    assignedByAdminId: jsonString(metadata.assignedByAdminId),
    batchImportId: jsonString(metadata.batchImportId) ?? targetBatchId,
    createdAt: log.createdAt,
    importedCount: jsonNonNegativeInteger(metadata.importedCount),
    mappingPreset: jsonString(metadata.mappingPreset),
    operator: log.actor,
    requestedCount: jsonNonNegativeInteger(metadata.requestedCount),
    skippedCount: jsonNonNegativeInteger(metadata.skippedCount),
    sourceFileName: jsonString(metadata.sourceFileName),
    sourceFileSha256: jsonSha256(metadata.sourceFileSha256),
  };
}

function adminCompanyBankTransactionImportBatchWhere(
  options: AdminCompanyBankTransactionImportBatchListOptions,
): Prisma.AdminAuditLogWhereInput {
  const filters: Prisma.AdminAuditLogWhereInput[] = [
    { action: COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION },
  ];
  const createdAt = adminPaymentDateRangeWhere(options.range);
  const query = normalizeNullable(options.q);
  if (createdAt) filters.push({ createdAt });
  if (query) {
    filters.push({
      OR: [
        { target: { contains: query, mode: Prisma.QueryMode.insensitive } },
        { actor: { id: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { actor: { email: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        { actor: { fullName: { contains: query, mode: Prisma.QueryMode.insensitive } } },
        {
          metadata: {
            path: ['batchImportId'],
            mode: Prisma.QueryMode.insensitive,
            string_contains: query,
          },
        },
        {
          metadata: {
            path: ['sourceFileName'],
            mode: Prisma.QueryMode.insensitive,
            string_contains: query,
          },
        },
      ],
    });
  }
  return filters.length === 1 ? filters[0] : { AND: filters };
}

function adminCompanyBankTransactionImportBatchReview(
  value: string | null | undefined,
): AdminCompanyBankTransactionImportBatchReview {
  if (
    value === 'needs-reconciliation' ||
    value === 'stale' ||
    value === 'escalated' ||
    value === 'reconciled'
  ) return value;
  return 'all';
}

function adminCompanyBankTransactionImportBatchFilteredPageSql(
  options: AdminCompanyBankTransactionImportBatchListOptions,
  review: Exclude<AdminCompanyBankTransactionImportBatchReview, 'all'>,
  skip: number,
  take: number,
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`logs."action" = ${COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION}`,
  ];
  const createdAt = adminPaymentDateRangeWhere(options.range);
  const query = normalizeNullable(options.q);
  if (createdAt?.gte instanceof Date) conditions.push(Prisma.sql`logs."createdAt" >= ${createdAt.gte}`);
  if (createdAt?.lte instanceof Date) conditions.push(Prisma.sql`logs."createdAt" <= ${createdAt.lte}`);
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(Prisma.sql`(
      logs."target" ILIKE ${pattern}
      OR actor."id" ILIKE ${pattern}
      OR actor."email" ILIKE ${pattern}
      OR actor."fullName" ILIKE ${pattern}
      OR logs."metadata"->>'batchImportId' ILIKE ${pattern}
      OR logs."metadata"->>'sourceFileName' ILIKE ${pattern}
    )`);
  }
  const staleBefore = new Date(Date.now() - COMPANY_BANK_TRANSACTION_BATCH_STALE_MS);
  const escalatedBefore = new Date(Date.now() - COMPANY_BANK_TRANSACTION_BATCH_ESCALATION_MS);
  conditions.push(
    review === 'needs-reconciliation'
      ? Prisma.sql`reconciliation."openCount" > 0`
      : review === 'stale'
        ? Prisma.sql`reconciliation."openCount" > 0 AND logs."createdAt" <= ${staleBefore}`
        : review === 'escalated'
          ? Prisma.sql`reconciliation."openCount" > 0 AND logs."createdAt" <= ${escalatedBefore}`
        : Prisma.sql`reconciliation."transactionCount" > 0 AND reconciliation."openCount" = 0`,
  );

  return Prisma.sql`
    WITH reconciliation_batches AS (
      SELECT
        transactions."metadata"->>'batchImportId' AS "batchImportId",
        COUNT(*)::int AS "transactionCount",
        COUNT(*) FILTER (
          WHERE transactions."status" IN (
            ${BankReconciliationStatus.UNMATCHED}::"BankReconciliationStatus",
            ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
          )
        )::int AS "openCount"
      FROM "CompanyBankTransaction" transactions
      WHERE transactions."metadata" ? 'batchImportId'
      GROUP BY transactions."metadata"->>'batchImportId'
    ),
    filtered_logs AS (
      SELECT logs."id", logs."createdAt"
      FROM "AdminAuditLog" logs
      INNER JOIN "User" actor ON actor."id" = logs."actorId"
      INNER JOIN reconciliation_batches reconciliation
        ON reconciliation."batchImportId" = COALESCE(
          logs."metadata"->>'batchImportId',
          REPLACE(logs."target", 'company_bank_transaction_batch:', '')
        )
      WHERE ${Prisma.join(conditions, ' AND ')}
    ),
    totals AS (
      SELECT COUNT(*)::bigint AS "total"
      FROM filtered_logs
    )
    SELECT page."id", totals."total"
    FROM totals
    LEFT JOIN LATERAL (
      SELECT filtered_logs."id"
      FROM filtered_logs
      ORDER BY filtered_logs."createdAt" ${review === 'stale' || review === 'escalated' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, filtered_logs."id" DESC
      LIMIT ${take}
      OFFSET ${skip}
    ) page ON TRUE
  `;
}

function adminCompanyBankTransactionImportBatchRowResults(metadataValue: Prisma.JsonValue | null) {
  const rowResults = jsonObject(metadataValue).rowResults;
  if (!Array.isArray(rowResults)) return [];
  return rowResults.flatMap((value) => {
    const row = jsonObject(value);
    const rowNumber = jsonPositiveInteger(row.rowNumber);
    const classification = jsonString(row.classification);
    const status = jsonString(row.status);
    if (
      !rowNumber ||
      !classification ||
      !['NEW', 'POTENTIAL_DUPLICATE', 'EXACT_DUPLICATE', 'INVALID'].includes(classification) ||
      !status ||
      !['IMPORTED', 'SKIPPED'].includes(status)
    ) {
      return [];
    }
    return [{
      classification,
      rowNumber,
      status,
      transactionId: jsonString(row.transactionId),
    }];
  });
}

function companyBankTransactionImportBatchReconciliationSummary(
  transactionIds: string[],
  transactionStatusById: ReadonlyMap<string, BankReconciliationStatus>,
  importedAt: Date,
  now = new Date(),
) {
  const reconciledTransactionCount = transactionIds.filter((transactionId) => {
    const status = transactionStatusById.get(transactionId);
    return status === BankReconciliationStatus.MATCHED ||
      status === BankReconciliationStatus.IGNORED ||
      status === BankReconciliationStatus.REVERSED;
  }).length;
  const reconciliationTransactionCount = transactionIds.length;
  const reconciliationNeedsActionCount = reconciliationTransactionCount - reconciledTransactionCount;
  const reconciliationWaitingHours = reconciliationNeedsActionCount > 0
    ? Math.max(0, Math.floor((now.getTime() - importedAt.getTime()) / 3_600_000))
    : null;
  const reconciliationSlaStatus = reconciliationTransactionCount === 0
    ? 'NO_TRANSACTIONS'
    : reconciliationNeedsActionCount === 0
      ? 'RECONCILED'
      : (reconciliationWaitingHours ?? 0) >= 48
        ? 'ESCALATE'
        : (reconciliationWaitingHours ?? 0) >= 24
          ? 'OVER_24H'
          : 'WITHIN_24H';

  return {
    reconciliationNeedsActionCount,
    reconciliationProgressPercent: reconciliationTransactionCount > 0
      ? Math.round((reconciledTransactionCount / reconciliationTransactionCount) * 100)
      : null,
    reconciliationTransactionCount,
    reconciliationSlaStatus,
    reconciliationWaitingHours,
    reconciledTransactionCount,
  };
}

function adminFinanceReviewAssignmentReferencedIds(
  auditLogs: readonly AdminFinanceReviewAssignmentAuditLog[],
) {
  return Array.from(new Set(auditLogs.flatMap((auditLog) => {
    const metadata = jsonObject(auditLog.metadata);
    return [
      jsonString(metadata.assigneeAdminId),
      jsonString(metadata.assignedByAdminId) ?? auditLog.actorId,
      jsonString(metadata.previousAssigneeAdminId),
    ].filter((adminId): adminId is string => Boolean(adminId));
  })));
}

function adminFinanceReviewAssignmentHistory(
  auditLogs: readonly AdminFinanceReviewAssignmentAuditLog[],
  adminsById: ReadonlyMap<string, AdminFinanceReviewAssignmentAdmin>,
) {
  return auditLogs.flatMap((auditLog) => {
    const metadata = jsonObject(auditLog.metadata);
    const assigneeAdminId = jsonString(metadata.assigneeAdminId);
    if (!assigneeAdminId) return [];

    const assignedByAdminId = jsonString(metadata.assignedByAdminId) ?? auditLog.actorId;
    const previousAssigneeAdminId = jsonString(metadata.previousAssigneeAdminId);
    return [{
      id: auditLog.id,
      assignedAt: jsonString(metadata.assignedAt) ?? auditLog.createdAt.toISOString(),
      assignee: adminsById.get(assigneeAdminId) ?? {
        id: assigneeAdminId,
        email: null,
        fullName: null,
      },
      assignedBy: adminsById.get(assignedByAdminId) ?? auditLog.actor,
      previousAssignee: previousAssigneeAdminId
        ? adminsById.get(previousAssigneeAdminId) ?? {
            id: previousAssigneeAdminId,
            email: null,
            fullName: null,
          }
        : null,
      reason: jsonString(metadata.reason),
    }];
  });
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function adminBankReconciliationMatchAuditMetadata(
  auditLog:
    | {
        action: string;
        actor: { id: string; email: string | null; fullName: string | null };
        actorId: string;
        createdAt: Date;
        metadata: Prisma.JsonValue | null;
      }
    | undefined,
  approvalAdminsById: ReadonlyMap<
    string,
    { id: string; email: string | null; fullName: string | null }
  >,
): Prisma.InputJsonObject {
  if (!auditLog) return {};
  const metadata = jsonObject(auditLog.metadata);
  const approvalAdminId = jsonString(metadata.approvalAdminId);
  const approvalAdmin = approvalAdminId ? approvalAdminsById.get(approvalAdminId) : null;
  const optionalFields = [
    'bankStatusBefore',
    'bankStatusAfter',
    'paymentClearingStatusBefore',
    'paymentClearingStatusAfter',
  ] as const;
  return {
    auditAction: auditLog.action,
    auditActorId: auditLog.actorId,
    ...(auditLog.actor.email ? { auditActorEmail: auditLog.actor.email } : {}),
    ...(auditLog.actor.fullName ? { auditActorName: auditLog.actor.fullName } : {}),
    auditAt: auditLog.createdAt.toISOString(),
    ...(approvalAdminId ? { approvalAdminId } : {}),
    ...(approvalAdmin?.email ? { approvalAdminEmail: approvalAdmin.email } : {}),
    ...(approvalAdmin?.fullName ? { approvalAdminName: approvalAdmin.fullName } : {}),
    matchActorId: auditLog.actorId,
    ...(auditLog.actor.email ? { matchActorEmail: auditLog.actor.email } : {}),
    ...(auditLog.actor.fullName ? { matchActorName: auditLog.actor.fullName } : {}),
    matchAuditAt: auditLog.createdAt.toISOString(),
    ...(approvalAdminId ? { matchApprovalAdminId: approvalAdminId } : {}),
    ...(approvalAdmin?.email ? { matchApprovalAdminEmail: approvalAdmin.email } : {}),
    ...(approvalAdmin?.fullName ? { matchApprovalAdminName: approvalAdmin.fullName } : {}),
    ...Object.fromEntries(
      optionalFields.flatMap((key) => {
        const value = jsonString(metadata[key]);
        return value ? [[key, value]] : [];
      }),
    ),
  };
}

function adminBankReconciliationMatchReversalAuditMetadata(
  auditLog:
    | {
        action: string;
        actor: { id: string; email: string | null; fullName: string | null };
        actorId: string;
        createdAt: Date;
        metadata: Prisma.JsonValue | null;
      }
    | undefined,
  approvalAdminsById: ReadonlyMap<string, AdminOperatorIdentityRecord>,
): Prisma.InputJsonObject {
  if (!auditLog) return {};
  const metadata = jsonObject(auditLog.metadata);
  const approvalAdminId = jsonString(metadata.approvalAdminId);
  const approvalAdmin = approvalAdminId ? approvalAdminsById.get(approvalAdminId) : null;
  const reason = jsonString(metadata.reason);
  const optionalFields = ['bankStatusBefore', 'bankStatusAfter'] as const;
  return {
    auditAction: auditLog.action,
    auditActorId: auditLog.actorId,
    ...(auditLog.actor.email ? { auditActorEmail: auditLog.actor.email } : {}),
    ...(auditLog.actor.fullName ? { auditActorName: auditLog.actor.fullName } : {}),
    auditAt: auditLog.createdAt.toISOString(),
    ...(approvalAdminId ? { approvalAdminId } : {}),
    ...(approvalAdmin?.email ? { approvalAdminEmail: approvalAdmin.email } : {}),
    ...(approvalAdmin?.fullName ? { approvalAdminName: approvalAdmin.fullName } : {}),
    reversedByAdminId: auditLog.actorId,
    ...(auditLog.actor.email ? { reversedByAdminEmail: auditLog.actor.email } : {}),
    ...(auditLog.actor.fullName ? { reversedByAdminName: auditLog.actor.fullName } : {}),
    reversedAuditAt: auditLog.createdAt.toISOString(),
    ...(approvalAdminId ? { reversalApprovalAdminId: approvalAdminId } : {}),
    ...(approvalAdmin?.email ? { reversalApprovalAdminEmail: approvalAdmin.email } : {}),
    ...(approvalAdmin?.fullName ? { reversalApprovalAdminName: approvalAdmin.fullName } : {}),
    ...(reason ? { reversalReason: reason } : {}),
    ...Object.fromEntries(
      optionalFields.flatMap((key) => {
        const value = jsonString(metadata[key]);
        return value ? [[key, value]] : [];
      }),
    ),
  };
}

function jsonString(value: Prisma.JsonValue | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function jsonNonNegativeInteger(value: Prisma.JsonValue | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function jsonPositiveInteger(value: Prisma.JsonValue | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function jsonSha256(value: Prisma.JsonValue | undefined) {
  const normalized = jsonString(value)?.toLowerCase() ?? null;
  return normalized && /^[a-f0-9]{64}$/u.test(normalized) ? normalized : null;
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
  readonly type:
    | 'accounting-journal'
    | 'partner-bank-deposit'
    | 'payment-clearing'
    | 'withdrawal'
    | 'payout-batch';
  readonly accountingJournalEntryId?: string;
  readonly partnerBankDepositRequestId?: string;
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
      field: 'accountingJournalEntryId',
      id: normalizeNullable(input.partnerBankDepositRequestId) ?? '',
      key: 'partner-bank-deposit',
      type: 'partner-bank-deposit',
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
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.OPEN}::"BookingSettlementTaxStatus"`;
    case 'declared':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.DECLARED}::"BookingSettlementTaxStatus"`;
    case 'paid':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.PAID}::"BookingSettlementTaxStatus"`;
    case 'closed':
      return Prisma.sql`"taxStatus" = ${BookingSettlementTaxStatus.CLOSED}::"BookingSettlementTaxStatus"`;
    case 'posted':
      return Prisma.sql`"settlementStatus" = ${BookingSettlementStatus.POSTED}::"BookingSettlementStatus"`;
    case 'reversed':
      return Prisma.sql`("settlementStatus" = ${BookingSettlementStatus.REVERSED}::"BookingSettlementStatus" OR "taxStatus" = ${BookingSettlementTaxStatus.REVERSED}::"BookingSettlementTaxStatus")`;
    case 'cash':
      return Prisma.sql`"paymentMethod" = ${PaymentMethod.CASH}::"PaymentMethod"`;
    case 'non-cash':
      return Prisma.sql`"paymentMethod" <> ${PaymentMethod.CASH}::"PaymentMethod"`;
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

function adminPartnerBankDepositReconciliationCteSql(options: {
  assigneeAdminId?: string | null;
  owner?: 'all' | 'unassigned';
  period?: string | null;
  query?: string | null;
  sla?: 'all' | 'within-24h' | 'over-24h' | 'escalate';
  status?: PartnerBankDepositRequestStatus | null;
}): Prisma.Sql {
  const assigneeAdminId = options.assigneeAdminId ?? '';
  const owner = options.owner ?? 'all';
  const period = options.period ?? '';
  const query = options.query ?? '';
  const queryPattern = `%${query}%`;
  const sla = options.sla ?? 'all';
  const status = options.status ?? '';

  return Prisma.sql`
    "latestPartnerBankDepositAssignments" AS (
      SELECT DISTINCT ON (logs."target")
        logs."id" AS "assignmentAuditLogId",
        logs."target",
        logs."metadata"->>'assigneeAdminId' AS "assigneeAdminId",
        logs."createdAt" AS "assignedAt"
      FROM "AdminAuditLog" logs
      WHERE logs."action" = ${PARTNER_BANK_DEPOSIT_RECONCILIATION_ASSIGNMENT_ACTION}
      ORDER BY logs."target", logs."createdAt" DESC, logs."id" DESC
    ),
    "partnerBankDepositEvidence" AS (
      SELECT
        request."id",
        request."depositDate",
        request."createdAt",
        request."executedAt",
        COALESCE(MAX(entry."amount"), request."amount")::bigint AS "targetAmount",
        COALESCE(
          SUM(
            CASE
              WHEN match."status" IN (
                ${BankReconciliationStatus.MATCHED}::"BankReconciliationStatus",
                ${BankReconciliationStatus.PARTIALLY_MATCHED}::"BankReconciliationStatus"
              ) THEN ABS(match."amount")
              ELSE 0
            END
          ),
          0
        )::bigint AS "matchedAmount"
      FROM "PartnerBankDepositRequest" request
      LEFT JOIN "ProviderProfile" provider ON provider."id" = request."providerProfileId"
      LEFT JOIN "User" partnerUser ON partnerUser."id" = provider."userId"
      LEFT JOIN "AccountingJournalBatch" batch ON batch."id" = request."journalBatchId"
      LEFT JOIN "AccountingJournalEntry" entry
        ON entry."batchId" = batch."id"
        AND batch."sourceType" = ${AccountingJournalSourceType.PROVIDER_BANK_DEPOSIT}::"AccountingJournalSourceType"
        AND batch."status" = ${AccountingJournalBatchStatus.POSTED}::"AccountingJournalBatchStatus"
        AND entry."side" = ${AccountingJournalEntrySide.DEBIT}::"AccountingJournalEntrySide"
        AND entry."accountCode" = 'company_bank_cash'
      LEFT JOIN "BankReconciliationMatch" match
        ON match."accountingJournalEntryId" = entry."id"
      WHERE request."status" = ${PartnerBankDepositRequestStatus.EXECUTED}::"PartnerBankDepositRequestStatus"
        AND (${status} = '' OR ${status} = ${PartnerBankDepositRequestStatus.EXECUTED})
        AND (
          ${period} = ''
          OR COALESCE(
            batch."monthlyPeriod",
            TO_CHAR(request."depositDate" AT TIME ZONE ${VIETNAM_TIME_ZONE}, 'YYYY-MM')
          ) = ${period}
        )
        AND (
          ${query} = ''
          OR request."id" ILIKE ${queryPattern}
          OR request."bankTransactionId" ILIKE ${queryPattern}
          OR request."providerProfileId" ILIKE ${queryPattern}
          OR provider."displayName" ILIKE ${queryPattern}
          OR partnerUser."fullName" ILIKE ${queryPattern}
        )
      GROUP BY request."id", request."amount", request."depositDate", request."createdAt", request."executedAt"
    ),
    "openPartnerBankDeposits" AS (
      SELECT
        evidence."id",
        evidence."depositDate",
        evidence."createdAt",
        evidence."executedAt",
        assignments."assignmentAuditLogId",
        assignments."assigneeAdminId",
        assignments."assignedAt",
        GREATEST(evidence."targetAmount" - LEAST(evidence."targetAmount", evidence."matchedAmount"), 0)::bigint AS "remainingAmount"
      FROM "partnerBankDepositEvidence" evidence
      LEFT JOIN "latestPartnerBankDepositAssignments" assignments
        ON assignments."target" = 'partner_bank_deposit_request:' || evidence."id"
      WHERE evidence."matchedAmount" < evidence."targetAmount"
        AND (${owner} <> 'unassigned' OR assignments."assigneeAdminId" IS NULL)
        AND (${assigneeAdminId} = '' OR assignments."assigneeAdminId" = ${assigneeAdminId})
        AND (
          ${sla} = 'all'
          OR (
            ${sla} = 'within-24h'
            AND COALESCE(evidence."executedAt", evidence."createdAt") > NOW() - INTERVAL '24 hours'
          )
          OR (
            ${sla} = 'over-24h'
            AND COALESCE(evidence."executedAt", evidence."createdAt") <= NOW() - INTERVAL '24 hours'
            AND COALESCE(evidence."executedAt", evidence."createdAt") > NOW() - INTERVAL '48 hours'
          )
          OR (
            ${sla} = 'escalate'
            AND COALESCE(evidence."executedAt", evidence."createdAt") <= NOW() - INTERVAL '48 hours'
          )
        )
    )
  `;
}

function adminPartnerWithholdingTaxPeriod(value: string | null | undefined) {
  const normalized = normalizeNullable(value);
  if (normalized && /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    return normalized;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
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

function assertMonthlyTaxClosingPaymentFeeEvidenceIsReady(
  summary: { paymentFeeReviewFlagCount: number },
  nextStatus: MonthlyTaxClosingStatus,
) {
  if (nextStatus === MonthlyTaxClosingStatus.DRAFT || nextStatus === MonthlyTaxClosingStatus.REVIEWED) {
    return;
  }
  if (summary.paymentFeeReviewFlagCount > 0) {
    throw new BadRequestException(
      `Monthly close has ${summary.paymentFeeReviewFlagCount} settlement(s) without resolved payment fee policy evidence. Review and activate the applicable payment fee policy before declaration.`,
    );
  }
}

function assertMonthlyTaxClosingPartnerDepositReconciliationIsReady(
  summary: { partnerDepositReconciliationOpenCount: number },
  nextStatus: MonthlyTaxClosingStatus,
) {
  if (nextStatus === MonthlyTaxClosingStatus.DRAFT || nextStatus === MonthlyTaxClosingStatus.REVIEWED) {
    return;
  }
  if (summary.partnerDepositReconciliationOpenCount > 0) {
    throw new BadRequestException(
      `Monthly close has ${summary.partnerDepositReconciliationOpenCount} executed Partner bank deposit(s) without complete bank reconciliation. Match the retained bank evidence before declaration.`,
    );
  }
}

async function assertMonthlyTaxClosingPostedJournalsAreBalanced(
  prisma:
    | Pick<PrismaService, 'accountingJournalBatch'>
    | Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
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
    case '90d':
      return { startMs: addLocalDays(todayStartMs, -89), endMs: todayEndMs };
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
  readonly financeAge?: string;
  readonly financeOwner?: string;
  readonly from?: string;
  readonly incidentState?: string;
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
  const incidentStateWhere = notificationBoardIncidentStateWhere(options.incidentState);

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
  if (incidentStateWhere) {
    filters.push(incidentStateWhere);
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
    case 'finance-overdue':
      return notificationFinanceOverdueWhere('open');
    case 'finance-overdue-history':
      return notificationFinanceOverdueWhere('resolved');
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
    case 'system-incidents':
      return { type: { startsWith: 'admin.system.' } };
    default:
      return undefined;
  }
}

function notificationFinanceOverdueWhere(
  state: 'open' | 'resolved',
): Prisma.NotificationWhereInput {
  const typeWhere: Prisma.NotificationWhereInput = {
    type: { in: [...ADMIN_NOTIFICATION_FINANCE_OVERDUE_TYPES] },
  };
  if (state === 'resolved') {
    return {
      AND: [
        typeWhere,
        { data: { path: ['financeReviewStatus'], equals: 'RESOLVED' } },
      ],
    };
  }
  return {
    AND: [
      typeWhere,
      {
        OR: [
          { data: { path: ['financeReviewStatus'], equals: Prisma.AnyNull } },
          { data: { path: ['financeReviewStatus'], not: 'RESOLVED' } },
        ],
      },
    ],
  };
}

function notificationBackgroundJobIncidentId(notification: {
  readonly data: Prisma.JsonValue | null;
  readonly type: string;
}) {
  if (!notification.type.startsWith('admin.system.background_job')) return null;
  return jsonString(jsonObject(notification.data).incidentId);
}

function legacyNotificationReviewSource(notification: {
  readonly data: Prisma.JsonValue | null;
  readonly id: string;
  readonly type: string;
}) {
  if (!notification.type.startsWith('admin.system.background_job')) return null;
  const data = jsonObject(notification.data);
  const queueName = jsonString(data.queueName);
  const jobId = jsonString(data.jobId);
  if (!queueName || !jobId) return null;
  return { jobId, queueName, sourceKey: `job:${queueName}:${jobId}` };
}

type NotificationSystemIncidentSourcePageRow = {
  readonly id: string;
  readonly notificationCount: number;
  readonly recipientCount: number;
  readonly sourceKey: string;
};

type NotificationFinanceReviewPageRow = {
  readonly id: string;
  readonly ownerAdminId: string | null;
  readonly ownerEmail: string | null;
  readonly ownerFullName: string | null;
  readonly reviewAgeHours: number;
  readonly reviewStartedAt: Date;
};

type NotificationFinanceReviewCountRow = {
  readonly count: number;
};

type NotificationFinanceReviewOwnerCountRow = {
  readonly count: number;
  readonly ownerAdminId: string | null;
};

type NotificationSystemIncidentSourceSummarySqlRow = {
  readonly legacy: number;
  readonly notificationCount: number;
  readonly open: number;
  readonly recovered: number;
  readonly reviewed: number;
  readonly total: number;
};

function notificationFinanceReviewState(value: string | undefined) {
  const review = normalizeNullable(value);
  if (review === 'finance-overdue') return 'open' as const;
  if (review === 'finance-overdue-history') return 'resolved' as const;
  return null;
}

function notificationFinanceReviewPageQuery(
  options: NotificationBoardSummaryOptions,
  state: 'open' | 'resolved',
  take: number,
  skip: number,
) {
  const order = state === 'open'
    ? Prisma.sql`finance_reviews."reviewStartedAt" ASC, finance_reviews.id ASC`
    : Prisma.sql`finance_reviews."resolvedAt" DESC NULLS LAST, finance_reviews.id DESC`;

  return Prisma.sql`
    WITH finance_reviews AS (
      ${notificationFinanceReviewFilteredSql(options, state)}
    )
    SELECT
      finance_reviews.id,
      finance_reviews."reviewStartedAt",
      finance_reviews."ownerAdminId",
      owner.email AS "ownerEmail",
      owner."fullName" AS "ownerFullName",
      finance_reviews."reviewAgeHours"
    FROM finance_reviews
    LEFT JOIN "User" owner ON owner.id = finance_reviews."ownerAdminId"
    ORDER BY ${order}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

function notificationFinanceReviewCountQuery(
  options: NotificationBoardSummaryOptions,
  state: 'open' | 'resolved',
) {
  return Prisma.sql`
    WITH finance_reviews AS (
      ${notificationFinanceReviewFilteredSql(options, state)}
    )
    SELECT COUNT(*)::integer AS count
    FROM finance_reviews
  `;
}

function notificationFinanceReviewOwnerSummaryQuery(
  options: NotificationBoardSummaryOptions,
  state: 'open' | 'resolved',
) {
  return Prisma.sql`
    WITH finance_reviews AS (
      ${notificationFinanceReviewFilteredSql({ ...options, financeOwner: undefined }, state)}
    )
    SELECT
      finance_reviews."ownerAdminId",
      COUNT(*)::integer AS count
    FROM finance_reviews
    GROUP BY finance_reviews."ownerAdminId"
    ORDER BY count DESC, finance_reviews."ownerAdminId" ASC NULLS FIRST
  `;
}

function notificationFinanceReviewFilteredSql(
  options: NotificationBoardSummaryOptions,
  state: 'open' | 'resolved',
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`notification."type" IN (
      'admin.finance.bank_statement_batch.escalated',
      'admin.finance.bank_transaction.review_escalated'
    )`,
  ];
  conditions.push(state === 'resolved'
    ? Prisma.sql`notification."data"->>'financeReviewStatus' = 'RESOLVED'`
    : Prisma.sql`COALESCE(notification."data"->>'financeReviewStatus', 'OPEN') <> 'RESOLVED'`);

  const from = normalizeNotificationDateBoundary(options.from, 'from');
  const to = normalizeNotificationDateBoundary(options.to, 'to');
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);
  const booking = normalizeNullable(options.booking);
  if (booking) conditions.push(Prisma.sql`notification."data"->>'bookingId' = ${booking}`);
  const user = normalizeNullable(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);
  const age = normalizeNotificationFinanceAge(options.financeAge);
  const owner = normalizeNotificationFinanceOwner(options.financeOwner);
  const reviewFilters: Prisma.Sql[] = [];
  if (age === '48-72') {
    reviewFilters.push(Prisma.sql`review_rows."reviewAgeHours" >= 48`);
    reviewFilters.push(Prisma.sql`review_rows."reviewAgeHours" < 72`);
  } else if (age === '72-plus') {
    reviewFilters.push(Prisma.sql`review_rows."reviewAgeHours" >= 72`);
  }
  if (owner === 'unassigned') {
    reviewFilters.push(Prisma.sql`review_rows."ownerAdminId" IS NULL`);
  } else if (owner) {
    reviewFilters.push(Prisma.sql`review_rows."ownerAdminId" = ${owner}`);
  }
  const reviewWhere = reviewFilters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(reviewFilters, ' AND ')}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT review_rows.*
    FROM (
      SELECT
        notification.id,
        COALESCE(
          assignment."createdAt",
          batch_import."createdAt",
          notification."createdAt"
        ) AS "reviewStartedAt",
        NULLIF(notification."data"->>'financeReviewResolvedAt', '')::timestamptz AS "resolvedAt",
        COALESCE(
          current_assignment."metadata"->>'assigneeAdminId',
          assignment."metadata"->>'assigneeAdminId',
          batch_import."metadata"->>'assigneeAdminId'
        ) AS "ownerAdminId",
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (
            COALESCE(
              NULLIF(notification."data"->>'financeReviewResolvedAt', '')::timestamptz,
              NOW()
            ) - COALESCE(
              assignment."createdAt",
              batch_import."createdAt",
              notification."createdAt"
            )
          )) / 3600)
        )::integer AS "reviewAgeHours"
      FROM "Notification" notification
      LEFT JOIN "AdminAuditLog" assignment
        ON assignment.id = notification."data"->>'assignmentAuditLogId'
      LEFT JOIN LATERAL (
        SELECT logs."metadata"
        FROM "AdminAuditLog" logs
        WHERE logs."action" = ${COMPANY_BANK_TRANSACTION_REVIEW_ASSIGNMENT_ACTION}
          AND logs."target" = 'bank_transaction:' || (notification."data"->>'bankTransactionId')
        ORDER BY logs."createdAt" DESC, logs.id DESC
        LIMIT 1
      ) current_assignment ON notification."data"->>'bankTransactionId' IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT logs."createdAt", logs."metadata"
        FROM "AdminAuditLog" logs
        WHERE logs."action" = ${COMPANY_BANK_TRANSACTION_BATCH_IMPORT_ACTION}
          AND COALESCE(
            logs."metadata"->>'batchImportId',
            regexp_replace(logs."target", '^company_bank_transaction_batch:', '')
          ) = notification."data"->>'batchImportId'
        ORDER BY logs."createdAt" ASC, logs.id ASC
        LIMIT 1
      ) batch_import ON TRUE
      WHERE ${Prisma.join(conditions, ' AND ')}
    ) review_rows
    ${reviewWhere}
  `;
}

function normalizeNotificationFinanceAge(value: string | undefined) {
  const age = normalizeNullable(value)?.toLowerCase();
  if (!age || age === 'all') return 'all' as const;
  if (age === '48-72' || age === '72-plus') return age;
  throw new BadRequestException('Notification Finance age filter is invalid');
}

function normalizeNotificationFinanceOwner(value: string | undefined) {
  const owner = normalizeNullable(value);
  if (!owner || owner === 'all') return null;
  if (owner === 'unassigned') return owner;
  if (
    owner.length > 128 ||
    Array.from(owner).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new BadRequestException('Notification Finance owner filter is invalid');
  }
  return owner;
}

function notificationFinanceReviewPageNotifications<
  T extends { readonly data: Prisma.JsonValue | null; readonly id: string },
>(notifications: readonly T[], rows: readonly NotificationFinanceReviewPageRow[]): T[] {
  const notificationById = new Map(notifications.map((notification) => [notification.id, notification]));
  return rows.flatMap((row) => {
    const notification = notificationById.get(row.id);
    if (!notification) return [];
    return [{
      ...notification,
      data: toJson({
        ...jsonObject(notification.data),
        financeReviewAgeHours: row.reviewAgeHours,
        financeReviewOwner: {
          email: row.ownerEmail,
          fullName: row.ownerFullName,
          id: row.ownerAdminId,
        },
        financeReviewSlaBand: row.reviewAgeHours >= 72 ? 'OVER_72H' : 'OVER_48H',
        financeReviewStartedAt: row.reviewStartedAt.toISOString(),
      }),
    } as T];
  });
}

function notificationSystemIncidentSourcePageQuery(
  options: NotificationBoardSummaryOptions,
  take: number,
  skip: number,
) {
  const stateRank = notificationSystemIncidentSelectedStateRank(options.incidentState);
  const stateFilter = stateRank === null
    ? Prisma.empty
    : Prisma.sql`AND grouped."resolvedStateRank" = ${stateRank}`;

  return Prisma.sql`
    WITH filtered AS (
      ${notificationSystemIncidentFilteredSourceSql(options)}
    ), ranked AS (
      SELECT
        filtered.*,
        ROW_NUMBER() OVER (
          PARTITION BY filtered."sourceKey"
          ORDER BY filtered."stateRank" ASC, filtered."createdAt" DESC, filtered.id DESC
        ) AS "representativeRank"
      FROM filtered
    ), grouped AS (
      SELECT
        filtered."sourceKey",
        MIN(filtered."stateRank")::integer AS "resolvedStateRank",
        COUNT(*)::integer AS "notificationCount",
        COUNT(DISTINCT filtered."userId")::integer AS "recipientCount"
      FROM filtered
      GROUP BY filtered."sourceKey"
    )
    SELECT
      ranked.id,
      grouped."sourceKey",
      grouped."notificationCount",
      grouped."recipientCount"
    FROM ranked
    INNER JOIN grouped ON grouped."sourceKey" = ranked."sourceKey"
    WHERE ranked."representativeRank" = 1
      ${stateFilter}
    ORDER BY ranked."createdAt" DESC, ranked.id DESC
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

function notificationSystemIncidentSourceSummaryQuery(options: NotificationBoardSummaryOptions) {
  return Prisma.sql`
    WITH filtered AS (
      ${notificationSystemIncidentFilteredSourceSql(options)}
    ), grouped AS (
      SELECT
        filtered."sourceKey",
        MIN(filtered."stateRank")::integer AS "resolvedStateRank",
        COUNT(*)::integer AS "notificationCount"
      FROM filtered
      GROUP BY filtered."sourceKey"
    )
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE grouped."resolvedStateRank" = 1)::integer AS open,
      COUNT(*) FILTER (WHERE grouped."resolvedStateRank" = 2)::integer AS legacy,
      COUNT(*) FILTER (WHERE grouped."resolvedStateRank" = 3)::integer AS recovered,
      COUNT(*) FILTER (WHERE grouped."resolvedStateRank" = 4)::integer AS reviewed,
      COALESCE(SUM(grouped."notificationCount"), 0)::integer AS "notificationCount"
    FROM grouped
  `;
}

function notificationSystemIncidentFilteredSourceSql(options: NotificationBoardSummaryOptions) {
  const conditions: Prisma.Sql[] = [Prisma.sql`notification."type" LIKE 'admin.system.%'`];
  const from = normalizeNotificationDateBoundary(options.from, 'from');
  const to = normalizeNotificationDateBoundary(options.to, 'to');
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);
  const booking = normalizeNullable(options.booking);
  if (booking) conditions.push(Prisma.sql`notification."data"->>'bookingId' = ${booking}`);
  const user = normalizeNullable(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);

  return Prisma.sql`
    SELECT
      notification.id,
      notification."userId",
      notification."createdAt",
      CASE
        WHEN COALESCE(notification."data"->>'incidentId', '') <> ''
          THEN 'incident:' || (notification."data"->>'incidentId')
        WHEN notification."type" LIKE 'admin.system.background_job%'
          AND COALESCE(notification."data"->>'queueName', '') <> ''
          AND COALESCE(notification."data"->>'jobId', '') <> ''
          THEN 'job:' || (notification."data"->>'queueName') || ':' || (notification."data"->>'jobId')
        ELSE 'notification:' || notification.id
      END AS "sourceKey",
      CASE
        WHEN notification."data"->>'incidentStatus' = 'OPEN' THEN 1
        WHEN notification."data"->>'incidentStatus' = 'RECOVERED' THEN 3
        WHEN notification."data"->>'incidentStatus' = 'LEGACY_REVIEWED' THEN 4
        WHEN COALESCE(notification."data"->>'incidentId', '') <> '' THEN 1
        ELSE 2
      END AS "stateRank"
    FROM "Notification" notification
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}

function notificationSystemIncidentSelectedStateRank(value: string | undefined) {
  const state = normalizeNullable(value)?.toLowerCase();
  if (state === 'open') return 1;
  if (state === 'legacy') return 2;
  if (state === 'recovered') return 3;
  if (state === 'reviewed') return 4;
  return null;
}

function notificationSystemIncidentSourceSummaryFromSql(
  row: NotificationSystemIncidentSourceSummarySqlRow | undefined,
  selectedStateValue: string | undefined,
) {
  const counts = row ?? { legacy: 0, notificationCount: 0, open: 0, recovered: 0, reviewed: 0, total: 0 };
  const selectedState = normalizeNullable(selectedStateValue)?.toLowerCase();
  const selected = selectedState === 'open'
    ? counts.open
    : selectedState === 'recovered'
      ? counts.recovered
      : selectedState === 'legacy'
        ? counts.legacy
        : selectedState === 'reviewed'
          ? counts.reviewed
          : counts.total;
  return { ...counts, selected };
}

function notificationSystemIncidentSourcePageNotifications<
  T extends { readonly data: Prisma.JsonValue | null; readonly id: string },
>(notifications: readonly T[], sources: readonly NotificationSystemIncidentSourcePageRow[]): T[] {
  const notificationById = new Map(notifications.map((notification) => [notification.id, notification]));
  return sources.flatMap((source) => {
    const notification = notificationById.get(source.id);
    if (!notification) return [];
    return [{
      ...notification,
      data: toJson({
        ...jsonObject(notification.data),
        systemIncidentNotificationCount: source.notificationCount,
        systemIncidentRecipientCount: source.recipientCount,
        systemIncidentSourceKey: source.sourceKey,
      }),
    } as T];
  });
}

function notificationBoardIncidentStateWhere(
  value: string | undefined,
): Prisma.NotificationWhereInput | undefined {
  const incidentState = normalizeNullable(value)?.toLowerCase();
  if (!incidentState || incidentState === 'all') return undefined;
  const systemIncidentWhere: Prisma.NotificationWhereInput = {
    type: { startsWith: 'admin.system.' },
  };
  if (incidentState === 'open') {
    return {
      AND: [systemIncidentWhere, { data: { path: ['incidentStatus'], equals: 'OPEN' } }],
    };
  }
  if (incidentState === 'recovered') {
    return {
      AND: [systemIncidentWhere, { data: { path: ['incidentStatus'], equals: 'RECOVERED' } }],
    };
  }
  if (incidentState === 'reviewed') {
    return {
      AND: [systemIncidentWhere, { data: { path: ['incidentStatus'], equals: 'LEGACY_REVIEWED' } }],
    };
  }
  if (incidentState === 'legacy') {
    return {
      AND: [systemIncidentWhere, { data: { path: ['incidentStatus'], equals: Prisma.AnyNull } }],
    };
  }
  return undefined;
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
