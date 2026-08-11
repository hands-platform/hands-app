import { headers } from 'next/headers';
import { cache } from 'react';

import { getAdminWebSession } from './admin-session';
import { createAdminWebApiToken } from './admin-api-token';
import { resolveEnvMasterAdminAccess } from './admin-env-master-access';
import {
  adminOperatorCategoryForAdminApiPath,
  adminOperatorUncategorizedWriteApiAllowlistReason,
  hasAdminOperatorCategory,
  type AdminOperatorPermissionCategory,
} from './admin-operator-access-model';
import type { AdminQueueAgeCounts, AdminQueueSlaSummary } from './admin-queue-list';

const API_BASE_URL = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';

export type AdminBookingStatus =
  | 'CREATED'
  | 'OPEN_MATCHING'
  | 'MATCHED'
  | 'PROVIDER_ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'REFUNDED';

export type AdminBookingMatchSource = 'FIRST_PICK_ACCEPTED_FIRST' | 'CUSTOMER_SELECTED_PARTNER';
export type AdminParticipantStatus = 'JOINED' | 'ACCEPTED' | 'REJECTED' | 'SELECTED' | 'EXPIRED';
export type AdminProviderStatus = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'ONLINE_AVAILABLE_SOON';
export type AdminPaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'RELEASED';
export type AdminPaymentMethod =
  | 'MOMO'
  | 'VNPAY'
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CUSTOMER_WALLET'
  | 'MANUAL';
export type AdminReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'REPORTED';
export type AdminEarningStatus = 'PENDING' | 'AVAILABLE' | 'PAID' | 'CANCELLED';
export type AdminPayoutBatchStatus = 'DRAFT' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type AdminProviderReportStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
export type AdminProviderSanctionType = 'WARNING' | 'ACCOUNT_BLOCK' | 'PAYOUT_HOLD' | 'TRUST_BADGE_REMOVAL';
export type AdminProviderSanctionStatus = 'ACTIVE' | 'LIFTED' | 'EXPIRED';
export type AdminProviderWalletLedgerType =
  | 'BOOKING_EARNING'
  | 'CASH_BOOKING_PLATFORM_FEE_CHARGE'
  | 'CASH_BOOKING_COMPANY_OUTPUT_VAT_CHARGE'
  | 'CASH_BOOKING_PARTNER_TAX_CHARGE'
  | 'PARTNER_NEGATIVE_WALLET_CREATED'
  | 'PARTNER_BANK_DEPOSIT_RECEIVED'
  | 'SETTLE_NEGATIVE_WALLET'
  | 'PARTNER_WALLET_PREPAID_BALANCE'
  | 'PARTNER_WALLET_LIABILITY_USED'
  | 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED'
  | 'CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED'
  | 'CASH_BOOKING_PARTNER_TAX_DEDUCTED'
  | 'CASH_FEE_DEBT_SETTLED'
  | 'PAYOUT_PAID'
  | 'PARTNER_WALLET_WITHDRAWAL_PAID'
  | 'REFUND_REVERSAL'
  | 'REFERRAL_REWARD'
  | 'PARTNER_REFERRAL_EARNED'
  | 'PARTNER_REFERRAL_TAX_WITHHELD'
  | 'OFFSET_PLATFORM_FEE'
  | 'OFFSET_PARTNER_TAX'
  | 'OFFSET_NEGATIVE_WALLET'
  | 'PARTNER_REFERRAL_CASHOUT'
  | 'PARTNER_REFERRAL_REVERSED'
  | 'ADMIN_ADJUSTMENT'
  | 'MANUAL_ADJUSTMENT_CREDIT'
  | 'MANUAL_ADJUSTMENT_DEBIT'
  | 'MANUAL_ADJUSTMENT_REVERSAL';
export type AdminReferralAudience = 'CUSTOMER' | 'PARTNER';
export type AdminReferralRewardMode = 'COMMISSION_PERCENT' | 'FIXED_AMOUNT';
export type AdminReferralRewardStatus =
  | 'PENDING'
  | 'AVAILABLE'
  | 'APPROVED'
  | 'LOCKED'
  | 'CREDITED'
  | 'USED_FOR_SERVICE'
  | 'OFFSET'
  | 'CASHOUT_REQUESTED'
  | 'CASHOUT_APPROVED'
  | 'PAID'
  | 'TAX_REVIEW_REQUIRED'
  | 'REWARDED'
  | 'HELD'
  | 'REVERSED'
  | 'CANCELLED';

export type AdminUser = {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  roles: string[];
  adminOperatorPermission?: {
    id: string;
    categories: string[];
    updatedAt: string;
  } | null;
  providerProfile?: AdminProvider | null;
  customerProfile?: { id: string; userId: string; addresses?: unknown } | null;
  appSessions?: Array<{
    id: string;
    role: string;
    deviceId: string;
    platform?: string | null;
    appVersion?: string | null;
    active: boolean;
    lastSeenAt: string;
    expiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  pushDevices?: Array<{
    id: string;
    role?: string;
    platform: string;
    enabled: boolean;
    lastSeenAt?: string;
    createdAt?: string;
    updatedAt?: string;
    deliveries?: Array<{
      id: string;
      status: string;
      attemptedAt: string;
      provider: string;
      response?: unknown;
    }>;
  }>;
};

export type AdminOperatorAccess = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  roles: string[];
  categories: string[];
  updatedAt?: string | null;
};

export type AdminReferralPolicy = {
  audience: AdminReferralAudience;
  commissionPercentBps?: number | null;
  currency: string;
  enabled: boolean;
  fixedRewardAmount?: number | null;
  holdPeriodDays: number;
  maxRewardedReferrals?: number | null;
  maxRewardsPerReferred?: number | null;
  notes?: string | null;
  platformFeeVatRateBps: number;
  perRewardCapAmount?: number | null;
  policyId?: string | null;
  rewardMode: AdminReferralRewardMode;
  source: 'stored-policy' | 'default-disabled';
  totalRewardCapAmount?: number | null;
  updatedAt?: string | null;
};

export type AdminReferralPolicies = {
  customer: AdminReferralPolicy;
  partner: AdminReferralPolicy;
};

export type AdminReferralUserSummary = {
  id: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminReferralCode = {
  id: string;
  code: string;
  active: boolean;
  createdAt: string;
};

export type AdminReferralRewardLatestDecision = {
  action: string;
  actor?: AdminReferralUserSummary | null;
  createdAt: string;
  reason?: string | null;
  status?: string | null;
  walletLedgerReference?: string | null;
};

export type AdminReferralReward = {
  id: string;
  amount: number;
  availableAt?: string | null;
  calculationSnapshot?: Record<string, unknown> | null;
  createdAt: string;
  currency: string;
  latestDecision?: AdminReferralRewardLatestDecision | null;
  qualifyingBookingId?: string | null;
  status: AdminReferralRewardStatus;
  updatedAt: string;
  walletLedgerReference?: string | null;
};

export type AdminCustomerReferralRewardQueueRow = AdminReferralReward & {
  attribution: {
    createdAt: string;
    fraudReviewStatus: string;
    id: string;
    status: string;
  };
  detailHref?: string | null;
  parent: AdminReferralCashoutPerson;
  referred: AdminReferralCashoutPerson;
};

export type AdminReferralRewardQueueSummary = {
  amount: number;
  count: number;
  reward: 'all' | 'attention' | 'available' | 'credited' | 'pending' | 'held';
};

export type AdminReferralCashoutQueueStatus = 'requested' | 'approved' | 'tax-review' | 'paid';

export type AdminReferralCashoutQueueSummary = {
  statusSummaries: Array<{
    amount: number;
    count: number;
    status: AdminReferralCashoutQueueStatus;
  }>;
  totalAmount: number;
  totalCount: number;
};

export type AdminReferralCashoutPerson = {
  href?: string | null;
  id: string;
  label: string;
  phone?: string | null;
};

export type AdminReferralCashoutPayoutProfile = {
  account?: {
    accountHolderName: string;
    accountNumberLast4?: string | null;
    accountNumberMasked?: string | null;
    bankName: string;
    id: string;
    isPrimary: boolean;
    rejectionReason?: string | null;
    reviewedAt?: string | null;
    status: string;
    updatedAt?: string | null;
  } | null;
  helper: string;
  label: string;
  status: 'CORRECTION_REQUIRED' | 'MISSING' | 'NEEDS_REVIEW' | 'READY' | 'WALLET_ONLY';
  type: 'CUSTOMER_WALLET' | 'PROVIDER_BANK_ACCOUNT';
};

export type AdminReferralCashoutQueueRow = AdminReferralReward & {
  audience: AdminReferralAudience;
  attribution: {
    audience: AdminReferralAudience;
    createdAt: string;
    fraudReviewStatus: string;
    id: string;
    installSource?: string | null;
    platform?: string | null;
    status: string;
  };
  detailHref: string;
  parent: AdminReferralCashoutPerson;
  payoutProfile: AdminReferralCashoutPayoutProfile;
  referred: AdminReferralCashoutPerson;
};

export type AdminReferralParentSummary = {
  referralCount: number;
  rewardQueueSummaries: AdminReferralRewardQueueSummary[];
  totalCount: number;
};

export type AdminReferralTotals = {
  availableRewardAmount: number;
  availableRewardCount: number;
  cancelledRewardAmount: number;
  cancelledRewardCount: number;
  heldRewardAmount: number;
  heldRewardCount: number;
  pendingRewardAmount: number;
  pendingRewardCount: number;
  referralCount: number;
  rewardedRewardAmount: number;
  rewardedRewardCount: number;
  reversedRewardAmount: number;
  reversedRewardCount: number;
  rewardCount: number;
  totalRewardAmount: number;
};

export type AdminCustomerReferralParent = {
  referrer: {
    id: string;
    user?: AdminReferralUserSummary | null;
  };
  referralCode?: AdminReferralCode | null;
  referrals: Array<{
    id: string;
    createdAt: string;
    fraudReviewStatus: string;
    installSource?: string | null;
    platform?: string | null;
    referredCustomer?: { id: string; user?: AdminReferralUserSummary | null } | null;
    rewards: AdminReferralReward[];
    status: string;
  }>;
  totals: AdminReferralTotals;
};

export type AdminPartnerReferralParent = {
  referrer: {
    id: string;
    displayName?: string | null;
    level?: string | null;
    status?: string | null;
    user?: AdminReferralUserSummary | null;
  };
  referralCode?: AdminReferralCode | null;
  referrals: Array<{
    id: string;
    createdAt: string;
    fraudReviewStatus: string;
    installSource?: string | null;
    platform?: string | null;
    referredPartner?: {
      id: string;
      displayName?: string | null;
      level?: string | null;
      status?: string | null;
      user?: AdminReferralUserSummary | null;
    } | null;
    rewards: AdminReferralReward[];
    status: string;
  }>;
  totals: AdminReferralTotals;
};

export type AdminAppSession = {
  id: string;
  userId: string;
  role: string;
  deviceId: string;
  platform?: string | null;
  appVersion?: string | null;
  deviceLanguage?: string | null;
  lastLoginAddress?: string | null;
  ipAddress?: string | null;
  active: boolean;
  lastSeenAt: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: AdminUser | null;
};

export type AdminAppSessionDirectoryRow = Omit<
  AdminAppSession,
  'createdAt' | 'deviceLanguage' | 'lastLoginAddress' | 'updatedAt' | 'user'
> & {
  user?: {
    phone?: string;
    fullName?: string | null;
    customerProfile?: { id: string } | null;
    providerProfile?: { id: string; displayName?: string | null } | null;
    pushDevices?: Array<{
      id: string;
      platform?: string;
      enabled: boolean;
      lastSeenAt?: string;
    }>;
  } | null;
};

export type AdminAppSessionSummary = {
  expired: number;
  generatedAt: string;
  liveCustomers: number;
  livePartners: number;
  recent: number;
  recentCustomers: number;
  recentPartners: number;
  stale: number;
  totalCount: number;
};

export type AdminDashboardSummary = {
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  generatedAt: string;
  lastEventAt?: string | null;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  sourceUpdatedAt?: string | null;
  actionQueue?: {
    completedPaymentHolds: number;
    completedWithoutSettlement: number;
    completedWithoutSettlementBacklog: number;
    completedWithoutSettlementRecent: number;
    customerChoice: number;
    matchingExpired: number;
    matchingWithoutParticipants: number;
  };
  bookingActivity?: {
    live: {
      active: number;
      arrived: number;
      customerChoice: number;
      inService: number;
      matched: number;
      onTheWay: number;
      openMatching: number;
    };
    period: {
      cancelled: number;
      completed: number;
      expired: number;
      noShow: number;
      refunded: number;
      total: number;
    };
  };
  appPresence: {
    activeBookingCustomers: number;
    disabledPushCustomers: number;
    liveActiveBookingCustomers: number;
    liveAppCustomers: number;
    liveAppPartners: number;
    liveOpenMatchingCustomers: number;
    reachableCustomers: number;
    recentCustomerSessions: number;
    staleCustomerSessions: number;
    totalCustomers: number;
  };
  partnerSupply: {
    approvedVerification: number;
    bankApproved: number;
    blocked: number;
    cashDebtPartners: number;
    firstRevenue: number;
    kycApproved: number;
    level2Active: number;
    approvalPending: number;
    liveSessions: number;
    noLocation: number;
    offline: number;
    online: number;
    onlineAvailable: number;
    onlineAvailableSoon: number;
    onlineBusy: number;
    pendingVerification: number;
    staleLocation: number;
    supplyPressureLabel: string;
    total: number;
    withdrawalProfileReady: number;
  };
};

export type AdminStartShiftAnalytics = {
  buckets: Array<{
    bookingRequests: number | null;
    cashFeeDebtAmount: number | null;
    cancelled: number | null;
    companyOutputVat: number | null;
    completed: number | null;
    customerPaymentAmount: number | null;
    failedPaymentAmount: number | null;
    grossAmount: number | null;
    isFuture: boolean;
    key: string;
    label: string;
    matchRate: number | null;
    matched: number | null;
    medianMatchMinutes: number | null;
    noShow: number | null;
    partnerNetAmount: number | null;
    partnerPayoutAmount: number | null;
    partnerWithholdingTotal: number | null;
    paymentProcessingFee: number | null;
    platformFee: number | null;
    platformNetRevenue: number | null;
    previousRequests: number | null;
    refundAmount: number | null;
    serviceStarted: number | null;
  }>;
  comparison: {
    completedByNow: number;
    completedPreviousDay: number;
    grossByNow: number;
    grossPreviousDay: number;
    matchedByNow: number;
    matchedPreviousDay: number;
    requestsByNow: number;
    requestsPreviousDay: number;
  } | null;
  customerPulse: {
    activeCustomerRecords: number;
    appOpenEvents: number;
    bookingCustomers: number;
    completedBookings: number;
    failedPaymentCustomers: number;
    firstBookingCustomers: number;
    highIntentNoBookingCustomers: number;
    matchingFailureCustomers: number;
    openMatchAverageWaitMinutes: number;
    preferredRequests: number;
    providerProfileViews: number;
    recentActiveCustomers: number;
    repeatCustomers: number;
    sessionStartEvents: number;
  };
  customerRankings: {
    highestValue: AdminStartShiftCustomerRanking[];
    mostActive: AdminStartShiftCustomerRanking[];
    mostCompleted: AdminStartShiftCustomerRanking[];
    needsAttention: AdminStartShiftCustomerRanking[];
  };
  demandSupply: {
    failureRegions: Array<{
      id: string;
      label: string;
      matchingFailureCount: number;
    }>;
    services: Array<{
      demandCount: number;
      id: string;
      label: string;
      matchingFailureCount: number;
      readyPartnerCount: number;
    }>;
  };
  generatedAt: string;
  granularity: 'hour' | 'day' | 'month';
  needsAction: Array<{
    ageing: {
      fourToTwentyFourHours: number;
      oneToFourHours: number;
      overTwentyFourHours: number;
      underOneHour: number;
    };
    amount: number;
    count: number;
    href: string;
    key: string;
    label: string;
    nextCases?: {
      current: string[];
      legacy: string[];
      overdue: string[];
    };
    oldestAt: string | null;
    operatorAction: string;
    overdueCount?: number;
    slaMinutes: number;
  }>;
  partnerRankings: {
    fastestResponse: AdminStartShiftPartnerRanking[];
    highestRated: AdminStartShiftPartnerRanking[];
    mostActive: AdminStartShiftPartnerRanking[];
    mostCompleted: AdminStartShiftPartnerRanking[];
    needsAttention: AdminStartShiftPartnerRanking[];
  };
  range: 'today' | '7d' | '30d' | '90d' | 'all';
  timezone: 'Asia/Ho_Chi_Minh';
};

export type AdminStartShiftCustomerRanking = {
  activeRecords: number;
  appOpenEvents: number;
  completedBookings: number;
  customerProfileId: string;
  displayName: string;
  href: string;
  issueBreakdown: {
    cancellation: number;
    matching: number;
    payment: number;
    refund: number;
  };
  issueCount: number;
  lastActiveAt: string | null;
  rank: number;
  providerProfileViews: number;
  sessionStartEvents: number;
  spendAmount: number;
};

export type AdminStartShiftPartnerRanking = {
  acceptanceRate: number;
  activeRecords: number;
  appOpenEvents: number;
  completedBookings: number;
  displayName: string;
  earningsAmount: number;
  href: string;
  issueBreakdown: {
    blocked: number;
    cancellation: number;
    inactive: number;
  };
  issueCount: number;
  lastActiveAt: string | null;
  medianResponseMinutes: number | null;
  providerProfileId: string;
  rank: number;
  rating: number;
  sessionStartEvents: number;
  status: string;
};

export type AdminStartShiftSummary = {
  analytics: AdminStartShiftAnalytics | null;
  cashSettlements: AdminCashSettlementSummary | null;
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  earnings: AdminEarningSummary | null;
  financeReviewWorkload: {
    bankReconciliation: AdminFinanceReviewOwnerWorkloadSummary | null;
    companyBankAccounts?: AdminCompanyBankAccountApprovalSummary | null;
    partnerBankDeposits: AdminFinanceReviewOwnerWorkloadSummary | null;
    paymentClearing: AdminFinanceReviewOwnerWorkloadSummary | null;
  };
  generatedAt: string;
  lastEventAt?: string | null;
  notifications: AdminNotificationBoardSummary | null;
  operations: AdminDashboardSummary | null;
  payments: AdminPaymentSummary | null;
  payoutBatches: AdminPayoutBatchSummary | null;
  range: string;
  refunds: AdminRefundSummary | null;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  sourceUpdatedAt?: string | null;
  unavailableSources: string[];
};

export type AdminUsageOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export type AdminUsageOverviewRankRow = {
  rank: number;
  id: string;
  userId?: string;
  label: string;
  secondary?: string | null;
  href?: string | null;
  value: number;
  valueLabel: string;
  lastActivityAt?: string | null;
};

export type AdminUsageOverviewRegionRow = {
  regionCode: string;
  regionName: string;
  shortName: string;
  customerSessionCount: number;
  bookingRequestCount: number;
  cancellationCount: number;
  completedBookingCount: number;
  expiredCount: number;
  noShowCount: number;
  refundedCount: number;
  unresolvedCount: number;
};

export type AdminUsageOverviewPaymentMethodRow = {
  method: string;
  bookingCount: number;
  amount: number;
};

export type AdminUsageOverviewPopularServiceRow = {
  rank: number;
  id: string;
  label: string;
  secondary?: string | null;
  bookingCount: number;
  quantity: number;
  amount: number;
};

export type AdminUsageOverviewHourlyActivityRow = {
  hour: number;
  label: string;
  customerSessionCount: number;
  bookingRequestCount: number;
  totalActivityCount: number;
};

export type AdminUsageOverviewPlatformRow = {
  platform: 'android' | 'ios' | 'web' | 'unknown';
  sessionCount: number;
  lastActivityAt?: string | null;
};

export type AdminUsageOverviewPartnerDiscoveryRow = {
  rank: number;
  id: string;
  label: string;
  secondary?: string | null;
  href?: string | null;
  viewCount: number;
  requestCount: number;
  completedCount: number;
  viewToRequestRate: number | null;
  requestToCompleteRate: number | null;
  lastActivityAt?: string | null;
};

export type AdminUsageOverviewTrendRow = {
  appOpenCount: number;
  bookingRequestCount: number;
  completedBookingCount: number;
  label: string;
  periodStart?: string | null;
  providerProfileViewCount: number;
  sessionStartCount: number;
};

export type AdminUsageOverviewRetentionRow = {
  eligibleCustomerCount: number;
  milestone: 1 | 7 | 30;
  rate: number | null;
  returnedCustomerCount: number;
};

export type AdminUsageOverviewFunnelRow = {
  conversionRate: number | null;
  count: number;
  key: 'active' | 'viewed' | 'booking' | 'completed';
  label: string;
};

export type AdminUsageOverviewCustomerRankingRow = {
  appOpenCount: number;
  completedBookingCount: number;
  href: string;
  id: string;
  issueCount: number;
  label: string;
  lastActivityAt?: string | null;
  providerProfileViewCount: number;
  rank: number;
  secondary?: string | null;
  sessionStartCount: number;
  totalEventCount: number;
  userId: string;
};

export type AdminUsageOverviewPartnerRankingRow = {
  completedCount: number;
  href: string;
  id: string;
  label: string;
  lastActivityAt?: string | null;
  rank: number;
  requestCount: number;
  secondary?: string | null;
  viewCount: number;
};

export type AdminUsageOverview = {
  dataThroughAt?: string | null;
  freshness: {
    bookingActivityThroughAt: string | null;
    reportGeneratedAt: string;
    reviewActivityThroughAt: string | null;
    refundActivityThroughAt: string | null;
    usageAggregatedThroughAt: string | null;
    usageStatus: 'fresh' | 'delayed' | 'unknown';
  };
  generatedAt: string;
  source: 'stored-usage-aggregates';
  timeZone: 'Asia/Ho_Chi_Minh';
  range: AdminUsageOverviewRange;
  rangeLabel: string;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  appliedRange: {
    dayCount: number;
    fromDate: string | null;
    granularity: 'hourly' | 'daily';
    toDate: string | null;
  };
  totals: {
    activeCustomerCount: number;
    appOpenCount: number;
    bookingCustomerCount: number;
    customerSessionCount: number;
    completedBookingCount: number;
    completedCustomerCount: number;
    partnerProfileViewCount: number;
    partnerBookingRequestCount: number;
    totalEventCount: number;
  };
  comparison: {
    fromDate?: string | null;
    rangeLabel: string;
    toDate?: string | null;
    totals: {
      activeCustomerCount: number;
      appOpenCount: number;
      cancellationCount: number;
      completedBookingCount: number;
      createdBookingCount: number;
      newCustomerCount: number;
      partnerBookingRequestCount: number;
      partnerProfileViewCount: number;
      sessionStartCount: number;
      unresolvedCount: number;
    };
    windowStartAt?: string | null;
    windowEndAt?: string | null;
  };
  funnel: AdminUsageOverviewFunnelRow[];
  retention: AdminUsageOverviewRetentionRow[];
  customerLifecycle: {
    newCustomerCount: number;
    activeCustomerCount: number;
    activeTodayCustomerCount: number;
    active7dCustomerCount: number;
    active30dCustomerCount: number;
    completedCustomerCount: number;
    repeatCustomerCount: number;
    churnRiskCustomerCount: number;
    neverBookedCustomerCount: number;
  };
  bookingQuality: {
    createdBookingCount: number;
    cancellationCount: number;
    expiredCount: number;
    noShowCount: number;
    refundCount: number;
    unresolvedCount: number;
    lowReviewCount: number;
  };
  paymentAndCoupon: {
    couponBookingCount: number;
    paymentFailureCount: number;
    refundAmount: number;
    paymentMethodMix: AdminUsageOverviewPaymentMethodRow[];
  };
  customerSegments: {
    newUnbookedCustomerCount: number;
    firstCompletedCustomerCount: number;
    repeatCustomerCount: number;
    vipCustomerCount: number;
    churnRiskCustomerCount: number;
    issueCustomerCount: number;
  };
  platformUsage: AdminUsageOverviewPlatformRow[];
  behavior: {
    popularServices: AdminUsageOverviewPopularServiceRow[];
    hourlyActivity: AdminUsageOverviewHourlyActivityRow[];
    trend: AdminUsageOverviewTrendRow[];
  };
  customerRankings: AdminUsageOverviewCustomerRankingRow[];
  partnerRankings: AdminUsageOverviewPartnerRankingRow[];
  customerUsage: {
    mostActiveCustomers: AdminUsageOverviewRankRow[];
    completedBookingCustomers: AdminUsageOverviewRankRow[];
    qualityRiskCustomers: AdminUsageOverviewRankRow[];
    lowReviewCustomers: AdminUsageOverviewRankRow[];
  };
  regionUsage: AdminUsageOverviewRegionRow[];
  partnerUsage: {
    discoveryConversion: AdminUsageOverviewPartnerDiscoveryRow[];
    mostViewedPartners: AdminUsageOverviewRankRow[];
    requestedPartners: AdminUsageOverviewRankRow[];
    completedPartners: AdminUsageOverviewRankRow[];
  };
  provenance: {
    bookingFixtures: 'explicit-markers-excluded';
    unknownAggregateCount: number;
    usageFixtures: 'guaranteed' | 'not-guaranteed';
  };
};

export type AdminPartnerOverviewRange = 'today' | '7d' | '30d' | '90d';

export type AdminPartnerOverviewKpi = {
  key: string;
  label: string;
  value: number | null;
  detail: string;
  unit: 'count' | 'money' | 'percent' | 'seconds' | 'rating';
  deltaPercent: number | null;
};

export type AdminPartnerOverviewRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AdminPartnerOverviewAreaRow = {
  areaCode: string;
  area: string;
  totalPartners: number;
  onlinePartners: number;
  locationFreshPartners: number;
  eligiblePartners: number;
  openRequests: number;
  nonCompletedOutcomes: number;
  nonCompletedShare: number | null;
  averageResponseSeconds: number | null;
  status: string;
  riskLevel: AdminPartnerOverviewRiskLevel;
};

export type AdminPartnerOverviewServiceRow = {
  serviceId: string;
  serviceName: string;
  partnersOffering: number;
  onlinePartners: number;
  eligiblePartners: number;
  openRequests: number;
  completedBookings: number;
  completionRate: number | null;
  avgRating: number | null;
  status: string;
  riskLevel: AdminPartnerOverviewRiskLevel;
};

export type AdminPartnerOverviewFunnelStep = {
  key: string;
  label: string;
  count: number | null;
  conversionRate: number | null;
  dropoffRate: number | null;
  dataStatus: 'available' | 'not_enough_data';
};

export type AdminPartnerOverviewActionRow = {
  partnerId: string;
  partnerName: string;
  phone: string | null;
  area: string;
  status: string;
  lastActivityAt: string | null;
  mainReason: string;
  recommendedAction: string;
  href: string;
  riskLevel: AdminPartnerOverviewRiskLevel;
};

export type AdminPartnerOverviewActionList = {
  key: string;
  title: string;
  totalCount: number;
  viewAllHref: string;
  rows: AdminPartnerOverviewActionRow[];
};

export type AdminPartnerOverviewRiskPartner = AdminPartnerOverviewActionRow & {
  lastOnlineAt: string | null;
  lastBookingAt: string | null;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  noShowReports: number;
  lowReviewCount: number;
  rating: number;
  reviewCount: number;
  walletBalance: number;
};

export type AdminPartnerOverviewNegativeWalletPartner = AdminPartnerOverviewRiskPartner & {
  eligibleToAccept: boolean;
};

export type AdminPartnerOverviewSelectionFrictionRow = AdminPartnerOverviewActionRow & {
  activeServiceCount: number;
  availabilityStatus: string;
  averageResponseSeconds: number | null;
  completedBookings: number;
  favoriteCount: number;
  galleryImageCount: number;
  hasProfileImage: boolean;
  lastIntentAt: string | null;
  maxServicePrice: number | null;
  minServicePrice: number | null;
  nextAvailableAt: string | null;
  profileViewCustomers: number;
  profileViews: number;
  rating: number;
  readinessFlags: string[];
  reviewCount: number;
  selectionRate: number;
};

export type AdminPartnerOverviewSelectionIssueCount = {
  key: string;
  label: string;
  count: number;
};

export type AdminPartnerOverviewOperatingStatusCard = {
  key: string;
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
};

export type AdminPartnerOverviewAvailableBlockedReason = {
  key: 'account' | 'location' | 'service' | 'wallet';
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: 'warning' | 'danger';
};

export type AdminPartnerOverviewCustomerDiscoveryBlocker = {
  key: 'documents' | 'service';
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: 'warning' | 'danger';
};

export type AdminPartnerOverviewAppActivityRow = {
  partnerId: string;
  partnerName: string;
  area: string;
  status: string;
  appOpenCount: number;
  sessionStartCount: number;
  activeRecordCount: number;
  lastActiveAt: string | null;
  inactivityDays: number | null;
  activityStatus: 'active' | 'inactive_7d' | 'never_tracked';
  href: string;
};

export type AdminPartnerOverviewSegment = {
  key: string;
  label: string;
  count: number;
  explanation: string;
  recommendedAction: string;
  href: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
};

export type AdminPartnerOverview = {
  generatedAt: string;
  refreshSeconds: number;
  source: 'live-summary-backed-partner-operational-query';
  timeZone: 'Asia/Ho_Chi_Minh';
  range: AdminPartnerOverviewRange;
  rangeLabel: string;
  windowStartAt: string | null;
  windowEndAt: string | null;
  comparison: {
    rangeLabel: string;
    windowStartAt: string | null;
    windowEndAt: string | null;
    totals: {
      appOpenCount: number;
      cancellationCount: number;
      completedBookingCount: number;
      sessionStartCount: number;
    };
  };
  queryScope: {
    actionListCountScope: 'full-population' | 'bounded-risk-filter';
    appActivityCountScope: 'full-population' | 'bounded-risk-filter';
    operatingStatusCountScope: 'full-population' | 'bounded-risk-filter';
    providerScanLimit: number;
    walletBalancePartnerCount: number;
    walletBalanceScopeTruncated: boolean;
    walletStatusFilterBounded: boolean;
  };
  filters: {
    city: string | null;
    onlineStatus: string | null;
    riskStatus: string | null;
    selectionIssue: string | null;
    selectionSort: string | null;
    serviceId: string | null;
    verificationStatus: string | null;
    walletStatus: string | null;
  };
  filterOptions: {
    services: Array<{
      durationMin: number;
      id: string;
      name: string;
    }>;
  };
  summaryKpis: AdminPartnerOverviewKpi[];
  operatingStatus: {
    locationFreshnessMinutes: number;
    customerDiscovery: {
      visibleNow: number;
      visibleHref: string;
      blockers: AdminPartnerOverviewCustomerDiscoveryBlocker[];
    };
    cards: AdminPartnerOverviewOperatingStatusCard[];
    availableBlockedReasons: AdminPartnerOverviewAvailableBlockedReason[];
  };
  supplyHealth: {
    areas: AdminPartnerOverviewAreaRow[];
    services: AdminPartnerOverviewServiceRow[];
  };
  funnel: {
    steps: AdminPartnerOverviewFunnelStep[];
  };
  activityRetention: {
    cards: AdminPartnerOverviewKpi[];
  };
  appActivity: {
    kpis: AdminPartnerOverviewKpi[];
    mostActive: AdminPartnerOverviewAppActivityRow[];
    inactivePartners: AdminPartnerOverviewAppActivityRow[];
  };
  bookingQuality: {
    kpis: AdminPartnerOverviewKpi[];
    riskPartnerCount: number;
    riskPartners: AdminPartnerOverviewRiskPartner[];
  };
  financeWalletRisk: {
    kpis: AdminPartnerOverviewKpi[];
    negativeWalletPartners: AdminPartnerOverviewNegativeWalletPartner[];
    policyNote: string;
  };
  selectionFriction: {
    issueCounts: AdminPartnerOverviewSelectionIssueCount[];
    rows: AdminPartnerOverviewSelectionFrictionRow[];
  };
  actionLists: AdminPartnerOverviewActionList[];
  segments: AdminPartnerOverviewSegment[];
  dataNotes: string[];
};

export type AdminMarketingOverviewRange = 'today' | 'yesterday' | '7d' | '30d';
export type AdminMarketingPlatform = 'android' | 'ios' | 'web' | 'unknown';
export type AdminMarketingSource =
  | 'meta'
  | 'google'
  | 'tiktok'
  | 'organic'
  | 'referral'
  | 'direct'
  | 'unknown';

export type AdminMarketingRates = {
  signupRate: number;
  addressSaveRate: number;
  bookingCreateRate: number;
  bookingCompleteRate: number;
  cancellationRate: number;
  firstBookingRate: number;
  repeatBookingRate: number;
  cpi: number | null;
  cpa: number | null;
  cpaSignup: number | null;
  cpaBookingCreated: number | null;
  cpaBookingCompleted: number | null;
  roas: number | null;
  platformFeeRoas: number | null;
};

export type AdminMarketingStats = {
  firstOpens: number;
  signups: number;
  addressSaves: number;
  bookingCreated: number;
  bookingCompleted: number;
  bookingCancelled: number;
  firstBookingCompleted: number;
  repeatBookingCompleted: number;
  grossBookingValue: number;
  platformFeeRevenue: number;
  refundAmount: number;
  adSpend: number;
  conversionRates: AdminMarketingRates;
};

export type AdminMarketingFunnelStep = {
  key: string;
  label: string;
  value: number;
  rateFromPrevious: number | null;
};

export type AdminMarketingDimensionRow = AdminMarketingStats & {
  key: string;
  source?: AdminMarketingSource;
  platform?: AdminMarketingPlatform;
  regionCode?: string;
  regionName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
};

export type AdminMarketingAttributionQuality = {
  attributedFirstOpens: number;
  unknownFirstOpens: number;
  firstOpenCoverageRate: number;
  attributedSignups: number;
  unknownSignups: number;
  signupCoverageRate: number;
};

export type AdminMarketingUnknownAttributionReason =
  | 'NO_CUSTOMER_SESSION'
  | 'NO_MARKETING_METADATA'
  | 'UNSUPPORTED_SOURCE';

export type AdminMarketingUnknownAttributionDiagnostics = {
  totalUnknownSignups: number;
  rows: Array<{
    platform: AdminMarketingPlatform;
    appVersion: string | null;
    reason: AdminMarketingUnknownAttributionReason;
    signupCount: number;
  }>;
  recentAccounts: Array<{
    customerUserId: string;
    customerProfileId: string;
    signupAt: string;
    platform: AdminMarketingPlatform;
    appVersion: string | null;
    reason: AdminMarketingUnknownAttributionReason;
  }>;
};

export type AdminMarketingComparisonMetric = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

export type AdminMarketingComparison = {
  previousRangeLabel: string;
  firstOpens: AdminMarketingComparisonMetric;
  signups: AdminMarketingComparisonMetric;
  bookingCompleted: AdminMarketingComparisonMetric;
  adSpend: AdminMarketingComparisonMetric;
  platformFeeRevenue: AdminMarketingComparisonMetric;
};

export type AdminMarketingTrendPoint = {
  date: string;
  firstOpens: number;
  signups: number;
  bookingCreated: number;
  bookingCompleted: number;
  adSpend: number;
};

export type AdminMarketingDimensionKey = 'source' | 'platform' | 'region' | 'campaign';

export type AdminMarketingOverview = {
  generatedAt: string;
  refreshSeconds: number;
  source: 'stored-marketing-aggregates';
  range: AdminMarketingOverviewRange;
  rangeLabel: string;
  windowStartAt: string;
  windowEndAt: string;
  filters: {
    source?: AdminMarketingSource | null;
    platform?: AdminMarketingPlatform | null;
    regionCode?: string | null;
    campaignId?: string | null;
  };
  breakdownFilters?: {
    regionCode?: string | null;
  };
  totals: AdminMarketingStats;
  funnel: AdminMarketingFunnelStep[];
  bySource: AdminMarketingDimensionRow[];
  byPlatform: AdminMarketingDimensionRow[];
  byRegion: AdminMarketingDimensionRow[];
  byCampaign: AdminMarketingDimensionRow[];
  attributionQuality: AdminMarketingAttributionQuality;
  campaignEfficiency: AdminMarketingDimensionRow[];
  topInsights: string[];
  dataGaps: string[];
};

export type AdminMarketingSummary = Omit<
  AdminMarketingOverview,
  'bySource' | 'byPlatform' | 'byRegion' | 'byCampaign'
> & {
  comparison: AdminMarketingComparison;
  trend: AdminMarketingTrendPoint[];
  unknownAttributionDiagnostics: AdminMarketingUnknownAttributionDiagnostics;
};

export type AdminMarketingDimensionPage = Pick<
  AdminMarketingOverview,
  | 'generatedAt'
  | 'refreshSeconds'
  | 'source'
  | 'range'
  | 'rangeLabel'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'filters'
> & {
  dimension: AdminMarketingDimensionKey;
  rows: AdminMarketingDimensionRow[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminMarketingCouponSummary = {
  generatedAt: string;
  source: 'booking-payment-coupon-metadata';
  range: AdminMarketingOverviewRange;
  rangeLabel: string;
  windowStartAt: string;
  windowEndAt: string;
  appliedBookingCount: number;
  completedBookingCount: number;
  cancelledBookingCount: number;
  refundedBookingCount: number;
  realizedDiscountAmount: number;
  completedBookingValue: number;
  completedConversionRate: number;
  cancellationRate: number;
  refundRate: number;
  averageDiscountAmount: number;
};

export type AdminMarketingCouponPerformanceRow = Omit<
  AdminMarketingCouponSummary,
  'generatedAt' | 'range' | 'rangeLabel' | 'source' | 'windowEndAt' | 'windowStartAt'
> & {
  couponCode: string;
  couponId: string | null;
  couponState: 'LIVE' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED' | 'HISTORICAL';
  latestCheckoutAt: string | null;
};

export type AdminMarketingCouponPerformancePage = Pick<
  AdminMarketingCouponSummary,
  'generatedAt' | 'range' | 'rangeLabel' | 'source' | 'windowEndAt' | 'windowStartAt'
> & {
  rows: AdminMarketingCouponPerformanceRow[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminCustomer = {
  id: string;
  userId: string;
  gender?: string | null;
  addresses?: unknown;
  activitySummary?: {
    activeBookingCount?: number;
    adminClosedBookingCount?: number;
    bookingCount: number;
    capturedSpend?: number;
    closedBookingCount?: number;
    completedBookingCount: number;
    customerWalletBalance?: number;
    customerClosedBookingCount?: number;
    currentBookingUpdatedAt?: string | null;
    lastBookingAt?: string | null;
    lastCompletedBookingAt?: string | null;
    noShowBookingCount?: number;
    openMatchingBookingCount?: number;
    partnerClosedBookingCount?: number;
    paymentIssueCount?: number;
    refundRequestCount?: number;
    reportedReviewCount?: number;
    serviceLiveBookingCount?: number;
  };
  user?: {
    id?: string;
    phone?: string;
    email?: string | null;
    fullName?: string | null;
    roles?: string[];
    createdAt?: string;
    updatedAt?: string;
    appSessions?: AdminAppSession[];
    pushDevices?: Array<{
      id: string;
      role?: string;
      platform: string;
      enabled: boolean;
      lastSeenAt?: string;
      createdAt?: string;
      updatedAt?: string;
      deliveries?: Array<{
        id: string;
        status: string;
        attemptedAt: string;
        provider: string;
        response?: unknown;
      }>;
    }>;
    notifications?: AdminNotification[];
  };
  selectedLocations?: Array<{
    id: string;
    latitude: string | number;
    longitude: string | number;
    addressText: string;
    createdAt: string;
  }>;
  bookings?: AdminBooking[];
  reviews?: AdminReview[];
  providerReviews?: AdminPartnerCustomerReview[];
  favoriteProviders?: Array<{
    id: string;
    providerProfileId: string;
    createdAt: string;
    providerProfile?: AdminProvider | null;
  }>;
  viewedProviders?: Array<{
    id: string;
    providerProfileId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
    providerProfile?: AdminProvider | null;
  }>;
  auditLogs?: AdminAuditLog[];
  auditLogCount?: number;
};

export type AdminCustomerDirectoryRow = Omit<AdminCustomer, 'selectedLocations' | 'user'> & {
  selectedLocationCount: number;
  user?: {
    id?: string;
    phone?: string;
    email?: string | null;
    fullName?: string | null;
    createdAt?: string;
    updatedAt?: string;
    appSessions?: Array<
      Pick<
        AdminAppSession,
        | 'active'
        | 'appVersion'
        | 'deviceId'
        | 'deviceLanguage'
        | 'ipAddress'
        | 'lastLoginAddress'
        | 'lastSeenAt'
        | 'platform'
      >
    >;
    pushDevices?: Array<{
      id: string;
      platform: string;
      enabled: boolean;
      lastSeenAt?: string;
      deliveries?: Array<{ status: string }>;
    }>;
  };
};

export type AdminCustomerSummary = {
  activeBookingCount?: number;
  completedBookingCount?: number;
  generatedAt?: string;
  genderBreakdown?: {
    female: number;
    male: number;
    other: number;
    unknown: number;
  };
  monthSeen?: number;
  monthSeenGenderBreakdown?: {
    female: number;
    male: number;
    other: number;
    unknown: number;
  };
  needsActionCount?: number;
  pushReachableCount?: number;
  todayJoined?: number;
  todayJoinedGenderBreakdown?: {
    female: number;
    male: number;
    other: number;
    unknown: number;
  };
  todaySeen?: number;
  todaySeenGenderBreakdown?: {
    female: number;
    male: number;
    other: number;
    unknown: number;
  };
  totalCount: number;
  viewCounts?: {
    activeToday: number;
    all: number;
    needsAction: number;
    newToday: number;
  };
};

export type AdminCustomerDetail = AdminCustomer & {
  activeBooking?: AdminBookingDetail | null;
  bookings?: AdminBookingDetail[];
  operatorNotes?: AdminAuditLog[];
  referralCodes?: AdminReferralCode[];
  referralsMade?: AdminCustomerReferralAttribution[];
  referralsReceived?: AdminCustomerReferralAttribution[];
  sessionSummary?: {
    deviceLanguage?: string | null;
    lastSeenAt?: string | null;
  } | null;
};

export type AdminCustomerReferralAttribution = {
  id: string;
  createdAt: string;
  fraudReviewStatus: string;
  installSource?: string | null;
  platform?: string | null;
  referralCode: AdminReferralCode;
  referredCustomerProfile?: {
    id: string;
    user?: AdminReferralUserSummary | null;
  } | null;
  referrerCustomerProfile?: {
    id: string;
    user?: AdminReferralUserSummary | null;
  } | null;
  rewards: Array<{
    id: string;
    amount: number;
    availableAt?: string | null;
    currency: string;
    qualifyingBookingId?: string | null;
    status: string;
    walletOwnerCustomerProfileId?: string | null;
    createdAt: string;
  }>;
  status: string;
};

export type AdminProviderBookingSummary = {
  activeBookingCount: number;
  adminClosedBookingCount: number;
  bookingCount: number;
  chatMissingCount: number;
  chatRoomCount: number;
  closedBookingCount: number;
  completedBookingCount: number;
  customerClosedBookingCount: number;
  latestBookingAt?: string | null;
  matchingBookingCount: number;
  noShowBookingCount: number;
  participatingBookingCount: number;
  partnerClosedBookingCount: number;
  preferredBookingCount: number;
  selectedBookingCount: number;
  workingBookingCount: number;
};

export type AdminProviderSummary = {
  generatedAt?: string;
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
  totalCount: number;
};

export type AdminFileReviewItem = {
  contentType: string;
  createdAt: string;
  id: string;
  key: string;
  kind: 'private-verification' | 'public-media';
  partner: {
    displayName: string;
    id: string;
    status: string;
    userFullName?: string | null;
    userId?: string;
    userPhone?: string | null;
  };
  purpose: string;
  reviewReason?: string | null;
  reviewStatus: string;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
  uploadStatus: string;
  url?: string | null;
  visibility: string;
};

export type AdminFileReviewList = {
  rows: AdminFileReviewItem[];
  totalCount: number;
};

export type AdminProvider = {
  id: string;
  userId?: string;
  displayName: string;
  level?: string;
  legalName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  facebookId?: string | null;
  activityNickname?: string | null;
  bio?: string | null;
  bioTranslations?: {
    en?: string | null;
    ja?: string | null;
    ko?: string | null;
    zh?: string | null;
  } | null;
  experienceYears?: number | null;
  specialties?: unknown;
  languages?: unknown;
  serviceStyle?: string | null;
  residentialAddress?: string | null;
  city?: string | null;
  serviceArea?: unknown;
  status: string;
  availabilityIntent?: 'OFFLINE' | 'AVAILABLE';
  availabilityReason?:
    | 'SYSTEM_DEFAULT'
    | 'MANUAL_AVAILABLE'
    | 'MANUAL_OFFLINE'
    | 'OUTSIDE_WORKING_HOURS'
    | 'ACTIVE_BOOKING'
    | 'INACTIVE_7D';
  availabilityChangedAt?: string | null;
  workingHoursTimezone?: string | null;
  workingHours?: Array<{
    weekday: number;
    enabled: boolean;
    startMinute: number;
    endMinute: number;
  }>;
  availabilitySummary?: {
    activeBookingCount: number;
    availabilityChangedAt: string | null;
    availabilityIntent: 'OFFLINE' | 'AVAILABLE';
    availabilityReason:
      | 'SYSTEM_DEFAULT'
      | 'MANUAL_AVAILABLE'
      | 'MANUAL_OFFLINE'
      | 'OUTSIDE_WORKING_HOURS'
      | 'ACTIVE_BOOKING'
      | 'INACTIVE_7D';
    currentMinute: number;
    currentWeekday: number;
    persistedReason: string;
    scheduleConfigured: boolean;
    status: AdminProviderStatus;
    timezone: string;
    todayWindowLabel: string;
    withinWorkingHours: boolean;
    workingHours: Array<{
      weekday: number;
      enabled: boolean;
      startMinute: number;
      endMinute: number;
    }>;
  };
  ratingAvg?: string | number | null;
  reviewCount?: number | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  controlRisk?: {
    kind:
      | 'ACCOUNT_BLOCK'
      | 'NEGATIVE_WALLET'
      | 'PAYOUT_HOLD'
      | 'URGENT_REPORT'
      | 'OVERDUE_REPORT'
      | 'OPEN_REPORT'
      | 'KYC_READINESS'
      | 'BANK_APPROVAL'
      | 'STALE_LOCATION';
    ownerLabel: string;
    overdue: boolean;
    priority: number;
    providerId: string;
    slaHours: number | null;
    startedAt: string | null;
  };
  currentLat?: string | number | null;
  currentLng?: string | number | null;
  currentLocationUpdatedAt?: string | null;
  nextAvailableAt?: string | null;
  trustedAt?: string | null;
  verification?: {
    id: string;
    status: string;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    files?: Array<{
      id: string;
      key: string;
      contentType: string;
      purpose?: string;
      visibility: string;
      uploadStatus?: string;
      reviewStatus?: string;
      reviewedAt?: string | null;
      reviewReason?: string | null;
      uploadedAt?: string | null;
      sizeBytes?: number | null;
      url?: string | null;
    }>;
  } | null;
  kyc?: {
    id: string;
    status: string;
    cccdNumberLast4?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
  documents?: Array<{
    id: string;
    type: string;
    status: string;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    fileAsset?: {
      id: string;
      key: string;
      contentType: string;
      uploadStatus?: string;
      uploadedAt?: string | null;
      sizeBytes?: number | null;
    };
  }>;
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    accountNumberMasked?: string | null;
    accountNumberLast4?: string | null;
    accountHolderName: string;
    status: string;
    isPrimary: boolean;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  taxProfile?: {
    id: string;
    status: string;
    taxCodeLast4?: string | null;
    legalName: string;
    registeredAddress: string;
    approvedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
  agreements?: Array<{
    id: string;
    type: string;
    version: string;
    acceptedAt: string;
  }>;
  reports?: AdminProviderReport[];
  sanctions?: AdminProviderSanction[];
  preferredBookings?: AdminBooking[];
  selectedBookings?: AdminBooking[];
  participants?: Array<{
    id: string;
    status: string;
    joinedAt?: string;
    respondedAt?: string | null;
    booking?: AdminBooking | null;
  }>;
  sessions?: Array<{
    id: string;
    deviceId?: string | null;
    ipAddress?: string | null;
    appVersion?: string | null;
    loggedInAt?: string;
    lastSeenAt?: string;
    suspicious: boolean;
    suspiciousReason?: string | null;
  }>;
  devices?: Array<{
    id: string;
    deviceId: string;
    platform?: string | null;
    appVersion?: string | null;
    enabled: boolean;
    lastSeenAt?: string | null;
    blockedAt?: string | null;
    blockReason?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  sharedDeviceMatches?: Array<{
    id: string;
    deviceId: string;
    platform?: string | null;
    enabled: boolean;
    lastSeenAt?: string | null;
    blockedAt?: string | null;
    providerProfile?: {
      id: string;
      displayName?: string | null;
      user?: { phone?: string | null };
    };
  }>;
  services?: Array<{
    id?: string;
    price?: number | string | null;
    active?: boolean;
    service?: {
      id?: string;
      name: string;
      durationMin?: number | null;
      basePrice?: number | string | null;
      priceStep?: number | string | null;
      active?: boolean;
      payoutRules?: Array<{
        id?: string;
        customerPrice: number | string;
        providerPayoutAmount: number | string;
        vatBps?: number | string | null;
        otherCostAmount?: number | string | null;
        currency?: string | null;
        active?: boolean;
      }>;
    };
  }>;
  activitySummary?: {
    availablePayout: number;
    completedWorkCount: number;
    grossRevenue: number;
    lastCompletedWorkAt?: string | null;
    pendingPayout: number;
    platformFee: number;
    walletBalance: number;
  };
  attentionSignals?: {
    bankPending: boolean;
    cashDebt: boolean;
    kycPending: boolean;
    locationStale: boolean;
  };
  appActivitySummary?: {
    activityStatus: 'active' | 'inactive_7d' | 'never_tracked';
    lastActiveAt?: string | null;
  };
  bookingSummary?: AdminProviderBookingSummary;
  earnings?: AdminEarning[];
  walletWithdrawalRequests?: AdminProviderWalletWithdrawalRequest[];
  auditLogs?: AdminAuditLog[];
  auditLogCount?: number;
  user?: {
    id?: string;
    fullName?: string | null;
    phone?: string;
    email?: string | null;
    createdAt?: string;
    updatedAt?: string;
    supabaseUserId?: string | null;
    fileAssets?: Array<{
      id: string;
      key: string;
      url?: string | null;
      contentType: string;
      purpose: string;
      visibility: string;
      uploadStatus?: string;
      reviewStatus?: string;
      reviewedAt?: string | null;
      reviewReason?: string | null;
      uploadedAt?: string | null;
      sizeBytes?: number | null;
      sortOrder?: number | null;
      createdAt?: string;
    }>;
    pushDevices?: Array<{
      id: string;
      role?: string;
      platform: string;
      enabled: boolean;
      lastSeenAt?: string;
      createdAt?: string;
      deliveries?: Array<{
        id: string;
        status: string;
        attemptedAt: string;
        provider: string;
        response?: {
          statusCode?: number;
          body?: {
            error?: {
              details?: Array<{
                errorCode?: string;
              }>;
            };
          };
        } | null;
      }>;
    }>;
  };
};

export type AdminOperationsHandoffProviderPage = {
  items: AdminProvider[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminPartnerControlProviderPage = {
  items: AdminProvider[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminProviderReportPage = {
  items: AdminProviderReport[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminProviderSanctionPage = {
  items: AdminProviderSanction[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminProviderReport = {
  id: string;
  providerProfileId: string;
  bookingId?: string | null;
  source: string;
  severity: string;
  status: string;
  category: string;
  summary: string;
  details?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt?: string;
  providerProfile?: {
    id: string;
    displayName?: string | null;
    user?: { phone?: string | null; fullName?: string | null };
  };
  booking?: { id: string; status?: string; scheduledStartAt?: string } | null;
  reporterUser?: { phone?: string | null; fullName?: string | null } | null;
  assignedAdmin?: { phone?: string | null; fullName?: string | null } | null;
  sanctions?: AdminProviderSanction[];
};

export type AdminProviderSanction = {
  id: string;
  providerProfileId: string;
  reportId?: string | null;
  type: string;
  status: string;
  reason: string;
  startsAt: string;
  expiresAt?: string | null;
  liftedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  providerProfile?: {
    id: string;
    displayName?: string | null;
    user?: { phone?: string | null; fullName?: string | null };
  };
  report?: {
    id: string;
    category: string;
    severity: string;
    status: string;
    summary: string;
  } | null;
  issuedBy?: { phone?: string | null; fullName?: string | null } | null;
  liftedBy?: { phone?: string | null; fullName?: string | null } | null;
};

const PROVIDER_DOCUMENT_LABELS: Record<string, string> = {
  CCCD_FRONT: 'CCCD front side',
  CCCD_BACK: 'CCCD back side',
  SELFIE: 'Selfie verification',
  PROFILE_PHOTO: 'Profile photo',
  WORK_PHOTO: 'Work photo',
  BANK_QR: 'Bank QR image',
};

const PROVIDER_DOCUMENT_REVIEW_HINTS: Record<string, string> = {
  CCCD_FRONT: 'Confirm the number and full name are readable.',
  CCCD_BACK: 'Check corners, expiry details, and glare.',
  SELFIE: 'Face should match the submitted ID document.',
  PROFILE_PHOTO: 'Public profile photo candidate after approval.',
  WORK_PHOTO: 'Optional evidence for experience or profile review.',
  BANK_QR: 'Optional payout QR evidence, not a replacement for bank approval.',
};

export function providerDocumentLabel(type?: string | null) {
  if (!type) return 'Unknown document';
  return PROVIDER_DOCUMENT_LABELS[type] ?? type;
}

export function providerDocumentReviewHint(type?: string | null) {
  if (!type) return 'Review the uploaded private file before approval.';
  return PROVIDER_DOCUMENT_REVIEW_HINTS[type] ?? 'Review the uploaded private file before approval.';
}

export type AdminBooking = {
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  id: string;
  customerProfileId?: string;
  preferredProviderId?: string | null;
  selectedProviderId?: string | null;
  status: string;
  openedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  expiresAt?: string | null;
  matchedAt?: string | null;
  matchSource?: AdminBookingMatchSource | null;
  matchingEvidence?: AdminBookingMatchingEvidence;
  serviceAddressText?: string | null;
  lastEventAt?: string | null;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  sourceUpdatedAt?: string | null;
  statusChangedAt?: string | null;
  statusChangedLabel?: string | null;
  closedAt?: string | null;
  closedByRole?: string | null;
  closedReason?: string | null;
  closedNote?: string | null;
  metadata?: unknown;
  address?: unknown;
  addressSnapshot?: {
    id: string;
    bookingId: string;
    customerProfileId: string;
    selectedLocationId?: string | null;
    address?: unknown;
    addressText?: string | null;
    latitude: string | number;
    longitude: string | number;
    source?: string;
    createdAt?: string;
  } | null;
  lat?: string | number;
  lng?: string | number;
  preferredProvider?: {
    id?: string;
    displayName?: string | null;
    status?: string;
    currentLat?: string | number | null;
    currentLng?: string | number | null;
    currentLocationUpdatedAt?: string | null;
    user?: { phone?: string; fullName?: string | null };
  };
  participants?: Array<{
    id: string;
    providerProfileId?: string | null;
    status: string;
    distanceMeters?: number | null;
    providerStatusAtJoin?: string | null;
    joinedAt?: string;
    respondedAt?: string | null;
    providerProfile?: {
      id: string;
      displayName?: string | null;
      status?: string;
      user?: { fullName?: string | null; phone?: string };
      currentLat?: string | number | null;
      currentLng?: string | number | null;
      currentLocationUpdatedAt?: string | null;
      city?: string | null;
      residentialAddress?: unknown;
      serviceArea?: unknown;
      locationSnapshots?: AdminLocationSnapshot[];
    };
  }>;
  services?: Array<{
    price?: number;
    quantity?: number;
    service?: {
      name?: string;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      payoutRules?: AdminServicePayoutRule[];
    };
  }>;
  payment?: {
    id?: string;
    status: string;
    amount: number;
    method: string;
    currency?: string;
    providerRef?: string | null;
    refunds?: Array<{ id: string; amount: number; status: string; createdAt?: string }>;
  } | null;
  refunds?: AdminRefund[];
  earning?: AdminEarning | null;
  customerProfile?: {
    id?: string;
    user?: {
      fullName?: string | null;
      phone?: string;
      appSessions?: Array<{ deviceLanguage?: string | null }>;
    };
  };
  selectedProvider?: {
    id?: string;
    displayName?: string | null;
    status?: string;
    user?: { phone?: string; fullName?: string | null };
    currentLat?: string | number | null;
    currentLng?: string | number | null;
    currentLocationUpdatedAt?: string | null;
    city?: string | null;
    residentialAddress?: unknown;
    serviceArea?: unknown;
    locationSnapshots?: AdminLocationSnapshot[];
  };
  chatRoom?: {
    id: string;
    _count?: { messages?: number };
    messages?: AdminChatMessage[];
  } | null;
  review?: AdminReview | null;
};

export type AdminBookingPage = {
  items: AdminBooking[];
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRows: number;
  };
};

export type AdminBookingMonitorSummary = {
  activeBookings: number;
  anomalyBookings?: number;
  blockedCreateAttemptsToday: number;
  chatMissingCount?: number;
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  generatedAt: string;
  lastEventAt?: string | null;
  matchingDelays?: number;
  matchedHandoff?: number;
  matchingNow: number;
  needsAction: number;
  openMatching?: number;
  oldestChatMissingAt?: string | null;
  oldestMatchingAt?: string | null;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  serviceInProgress: number;
  preferredPending?: number;
  customerChoice?: number;
  supplyIntervention?: number;
  sourceUpdatedAt?: string | null;
};

export type AdminCompletedBookingOperationsSummary = {
  cashDebt: number;
  closeoutChecks: number;
  expired: number;
  generatedAt: string;
  oldestCloseoutAt: string | null;
  paymentChecks: number;
  pricingChecks: number;
  refundReview: number;
  totalRecords: number;
};

export type AdminPostMatchCancellationOperationsSummary = {
  adminApprovedCount: number;
  adminHeldCount: number;
  autoResolvedCount: number;
  generatedAt: string;
  needsDecisionCount: number;
  noShowReviewCount: number;
  overdueOpenCount: number;
  resolvedCount: number;
  unknownLegacyCount: number;
};

export type AdminChatArchiveMessage = {
  id: string;
  body: string;
  attachmentCount: number;
  createdAt: string;
  sender?: { id: string; fullName?: string | null; roles?: string[] };
  chatRoom: {
    id: string;
    booking: {
      id: string;
      customerProfileId?: string;
      status: string;
      customerProfile?: {
        id?: string;
        user?: { fullName?: string | null };
      };
      preferredProvider?: {
        id?: string;
        displayName?: string | null;
        user?: { fullName?: string | null };
      };
      selectedProvider?: {
        id?: string;
        displayName?: string | null;
        user?: { fullName?: string | null };
      };
      services?: Array<{
        service?: {
          name?: string;
          durationMin?: number;
        };
      }>;
    };
  };
};

// Legacy in-memory shape retained by the Operations Handoff activity adapter.
export type AdminChatArchiveBooking = {
  id: string;
  status: string;
  chatRoom?: {
    id: string;
    messages?: AdminChatMessage[];
  } | null;
};

export type AdminBookingMatchingEvidence = {
  readonly stage: 'OPEN_MARKETPLACE_ACTIVE' | 'MATCHED' | 'SERVICE_ACTIVE' | 'CLOSED' | 'CREATED';
  readonly finalSelection:
    | 'FIRST_PICK_ACCEPTED'
    | 'CUSTOMER_SELECTED_PARTNER'
    | 'CUSTOMER_SELECTION_AVAILABLE'
    | 'FIRST_PICK_PENDING'
    | 'WAITING_FOR_PARTNERS'
    | 'NOT_READY';
  readonly firstPickStatus: string | null;
  readonly marketplaceParticipantCount: number;
  readonly selectableParticipantCount: number;
  readonly matchedAt: string | null;
  readonly matchSource: AdminBookingMatchSource | null;
  readonly chatReady: boolean;
};

export type AdminBookingDetail = AdminBooking & {
  notes?: string | null;
  openedAt?: string | null;
  refunds?: AdminRefund[];
  review?: AdminReview | null;
  providerCustomerReview?: AdminPartnerCustomerReview | null;
  earning?: AdminEarning | null;
  snapshots?: AdminLocationSnapshot[];
  opsTasks?: AdminBookingOpsTask[];
  platformFeeLogs?: AdminProviderPlatformFeeLog[];
  taxLogs?: AdminProviderTaxLog[];
  walletLedgerEntries?: AdminProviderWalletLedgerEntry[];
  providerRequestEvents?: Array<{
    id: string;
    providerProfileId: string;
    bookingId?: string | null;
    eventType: string;
    visibleBookingCount?: number | null;
    metadata?: unknown;
    createdAt: string;
    providerProfile?: {
      id?: string;
      displayName?: string | null;
      user?: { phone?: string; fullName?: string | null };
    };
  }>;
  auditLogs?: AdminAuditLog[];
};

export type AdminBookingOpsTask = {
  id: string;
  bookingId: string;
  type: string;
  status: string;
  note?: string | null;
  updatedAt: string;
  actor?: { phone?: string; fullName?: string | null };
};

export type AdminLocationSnapshot = {
  address?: unknown;
  addressText?: string | null;
  id: string;
  bookingId?: string | null;
  providerProfileId: string;
  lat: string | number;
  lng: string | number;
  recordedAt: string;
};

export type AdminChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender?: { id: string; phone?: string; fullName?: string | null; roles?: string[] };
};

export type AdminPayment = {
  id: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  bookingId: string;
  providerRef?: string | null;
  rawMeta?: unknown;
  actionDecisions?: AdminPaymentActionDecision[];
  availableActions?: AdminPaymentActionDecision['action'][];
  blockedActions?: AdminPaymentActionDecision['action'][];
  evaluatedAt?: string;
  evidence?: AdminPaymentEvidenceSummary;
  primaryAction?: AdminPaymentActionDecision | null;
  primaryQueue?: AdminPaymentPrimaryQueue;
  callbackAttempts?: AdminPaymentCallbackAttempt[];
  booking?: {
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    customerProfile?: { user?: { phone?: string; fullName?: string | null } };
    selectedProvider?: { displayName?: string | null };
    customerWalletLedgerEntries?: Array<{
      amount: number;
      createdAt?: string | null;
      sourceKey?: string | null;
      updatedAt?: string | null;
    }>;
    earning?: {
      id: string;
      status: string;
      grossAmount: number;
      platformFee: number;
      withholdingAmount: number;
      netAmount: number;
      currency: string;
      settlementRef?: string | null;
      settlementMethod?: string | null;
      walletLedgerEntries?: AdminProviderWalletLedgerEntry[];
    } | null;
  };
  refunds?: Array<{ id: string; amount: number; status: string; createdAt?: string }>;
};

export type AdminPaymentActionDecision = {
  action: 'SYNC' | 'CAPTURE' | 'RELEASE' | 'REQUEST_REFUND';
  state: 'AVAILABLE' | 'REVIEW_REQUIRED' | 'BLOCKED';
  recommended: boolean;
  reasonCode: string;
  reason: string;
  requiredEvidence: string[];
  verifiedAt: string | null;
  policyVersion: string;
};

export type AdminPaymentPrimaryQueue =
  | 'evidence-conflict'
  | 'missing-gateway-evidence'
  | 'capture-ready'
  | 'release-recommended'
  | 'terminal-cash-cleanup'
  | 'completed-authorization-blocked'
  | 'cash-debt'
  | 'active-cash'
  | 'failed-active'
  | 'needs-action'
  | 'authorized-diagnostic'
  | 'history-captured'
  | 'history-refunded'
  | 'history-released';

export type AdminPaymentEvidenceSummary = {
  state: 'VERIFIED' | 'MISSING' | 'CONFLICT' | 'NOT_APPLICABLE';
  label: string;
  reason: string;
  verifiedAt: string | null;
};

export type AdminPaymentSummary = {
  activeCashCollection: number;
  authorized: number;
  captureReady: number;
  callbackReview: number;
  callbackVerified: number;
  captured: number;
  cashDebt: number;
  evidenceConflicts: number;
  generatedAt?: string;
  evaluatedAt?: string;
  currentQueueTotal?: number;
  globalActionMetrics?: {
    activeCashCollection: number;
    captureReady: number;
    completedAuthorizationBlocked: number;
    evidenceConflicts: number;
    missingGatewayEvidence: number;
    releaseRecommended: number;
    terminalCashCleanup: number;
  };
  linkedRefunds: number;
  needsAction: number;
  pendingCash: number;
  queueAgeCounts?: AdminQueueAgeCounts;
  queueCounts?: Partial<Record<AdminPaymentPrimaryQueue, number>>;
  queueSla?: AdminQueueSlaSummary;
  refunded: number;
  releaseRecommended: number;
  staleMismatch: number;
  totalCount: number;
  scope?: { currentQueue: string; range: string };
};

export type AdminPaymentActionReceipt = {
  action: 'SYNC' | 'CAPTURE' | 'RELEASE' | 'REQUEST_REFUND';
  actorId: string;
  after: { bookingStatus: string; paymentStatus: string };
  auditId: string;
  before: { bookingStatus: string; paymentStatus: string };
  completedAt: string;
  idempotencyKey: string;
  paymentId: string;
};

export type AdminPaymentDetail = Omit<AdminPayment, 'booking' | 'refunds' | 'callbackAttempts'> & {
  booking?: AdminBookingDetail | null;
  refunds?: AdminRefund[];
  callbackAttempts?: AdminPaymentCallbackAttempt[];
  auditLogs?: AdminAuditLog[];
};

export type AdminPaymentCallbackAttempt = {
  id: string;
  paymentId?: string | null;
  method: string;
  providerRef?: string | null;
  outcome: string;
  signatureVerified?: boolean | null;
  verificationMode?: string | null;
  providerStatus?: string | null;
  gatewayTransactionId?: string | null;
  callbackAmount?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawPayload?: unknown;
  createdAt: string;
  payment?:
    | (AdminPayment & {
        booking?: AdminPayment['booking'] & {
          customerProfile?: { user?: { phone?: string; fullName?: string | null } };
          selectedProvider?: { displayName?: string | null };
        };
      })
    | null;
};

export type AdminEarning = {
  id: string;
  providerProfileId: string;
  bookingId: string;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  availableAt?: string | null;
  paidAt?: string | null;
  payoutBatchId?: string | null;
  settlementRef?: string | null;
  settlementNotes?: string | null;
  settlementMethod?: string | null;
  createdAt?: string;
  originalDebtAmount?: number;
  allocatedAmount?: number;
  remainingDebtAmount?: number;
  providerProfile?: { displayName?: string | null; user?: { phone?: string; fullName?: string | null } };
  booking?: {
    status?: string;
    scheduledStartAt?: string;
    selectedProviderId?: string | null;
    matchedAt?: string | null;
    closedAt?: string | null;
    closedReason?: string | null;
    closedNote?: string | null;
    updatedAt?: string | null;
    payment?: { method: string; status: string; amount: number; currency?: string } | null;
    services?: Array<{
      id: string;
      serviceId: string;
      quantity: number;
      price: number;
      service?: {
        id: string;
        name: string;
        serviceGroupKey?: string | null;
        durationMin: number;
        basePrice: number;
      } | null;
    }>;
  } | null;
  platformFeeLogs?: AdminProviderPlatformFeeLog[];
  taxLogs?: AdminProviderTaxLog[];
  walletLedgerEntries?: AdminProviderWalletLedgerEntry[];
  bankDepositCashDebtAllocations?: Array<{
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    partnerBankDepositRequest: {
      id: string;
      bankTransactionId: string;
      status: AdminPartnerBankDepositRequestStatus;
      ledgerEntryId?: string | null;
      journalBatchId?: string | null;
      executedAt?: string | null;
    };
  }>;
};

export type AdminProviderWalletLedgerEntry = {
  id: string;
  type: string;
  sourceKey: string;
  amount: number;
  currency: string;
  reference?: string | null;
  notes?: string | null;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPartnerBankDepositRequestStatus = 'REQUESTED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
export type AdminPartnerBankDepositReconciliationStatus =
  | 'NOT_APPLICABLE'
  | 'UNMATCHED'
  | 'PARTIALLY_MATCHED'
  | 'MATCHED';
export type AdminPartnerBankDepositReconciliationSlaStatus =
  | 'NOT_APPLICABLE'
  | 'RECONCILED'
  | 'WITHIN_24H'
  | 'OVER_24H'
  | 'ESCALATE';

export type AdminPartnerBankDepositRequest = {
  id: string;
  providerProfileId: string;
  amount: number;
  currency: string;
  bankTransactionId: string;
  depositDate: string;
  bankAccount?: string | null;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
  requestedBeforeBalance: number;
  requestedAfterBalance: number;
  requestedReceivableRecovery: number;
  requestedWalletLiabilityIncrease: number;
  accountingPreview?: unknown;
  status: AdminPartnerBankDepositRequestStatus;
  requestedByAdminId: string;
  requestedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  approvedByAdminId?: string | null;
  approvedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  rejectedByAdminId?: string | null;
  rejectedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  decisionReason?: string | null;
  ledgerEntryId?: string | null;
  journalBatchId?: string | null;
  executedAllocation?: unknown;
  executedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  providerProfile?: {
    id: string;
    displayName?: string | null;
    user?: {
      id: string;
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  allocatedCashDebtAmount?: number;
  reconciliationMatchedAmount?: number;
  reconciliationRemainingAmount?: number;
  reconciliationReviewAssignment?: {
    assignedAt: string;
    assignedByAdminId: string;
    assignee: AdminOperatorIdentity;
    assigneeAdminId: string;
    reason?: string | null;
  };
  reconciliationSlaStatus?: AdminPartnerBankDepositReconciliationSlaStatus;
  reconciliationStatus?: AdminPartnerBankDepositReconciliationStatus;
  reconciliationWaitingHours?: number | null;
};

export type AdminPartnerBankDepositRequestHistory = {
  items: AdminPartnerBankDepositRequest[];
  pagination: { skip: number; take: number; total: number };
  statusCounts: Partial<Record<AdminPartnerBankDepositRequestStatus, number>>;
  reconciliationSummary: {
    openAmount: number;
    openCount: number;
    period?: string | null;
  };
};

export type AdminPartnerBankDepositCashDebtAllocation = {
  id: string;
  partnerBankDepositRequestId: string;
  providerEarningId: string;
  amount: number;
  currency: string;
  allocatedByAdminId: string;
  allocatedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  notes?: string | null;
  createdAt: string;
  providerEarning: AdminEarning;
};

export type AdminPartnerBankDepositRequestDetail = {
  request: AdminPartnerBankDepositRequest & {
    cashDebtAllocations: AdminPartnerBankDepositCashDebtAllocation[];
  };
  ledger?: AdminProviderWalletLedgerEntry | null;
  journal?: AdminAccountingJournalBatchDetail | null;
  auditLogs: AdminAuditLog[];
  allocatedCashDebtAmount: number;
  remainingReceivableRecovery: number;
  availableCashDebts: Array<
    AdminEarning & {
      allocatedAmount: number;
      remainingDebtAmount: number;
    }
  >;
};

export type AdminManualWalletAdjustmentOwnerType = 'CUSTOMER' | 'PARTNER';

export type AdminManualWalletAdjustmentOwnerOption = {
  accountStatus: string;
  currency: string;
  currentBalance: number;
  displayName: string;
  maskedPhone: string;
  ownerId: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  reference: string;
};

export type AdminManualWalletAdjustmentDirection = 'CREDIT' | 'DEBIT';

export type AdminManualWalletAdjustmentType =
  | 'PROMOTION_CREDIT'
  | 'CUSTOMER_COMPENSATION'
  | 'PARTNER_BONUS'
  | 'REFERRAL_CORRECTION'
  | 'ERROR_CORRECTION'
  | 'PENALTY'
  | 'CASH_BOOKING_DEDUCTION'
  | 'RECEIVABLE_WRITE_OFF'
  | 'MANUAL_REVERSAL';

export type AdminManualWalletAdjustmentPolicy = {
  allowedCombinations: Array<{
    adjustmentTypes: AdminManualWalletAdjustmentType[];
    direction: AdminManualWalletAdjustmentDirection;
    ownerType: AdminManualWalletAdjustmentOwnerType;
  }>;
  constraints: {
    amountMax: number;
    attachmentRequiredAt: number;
    attachmentUrlMaxLength: number;
    reasonMaxLength: number;
  };
  openPeriodStatuses: Array<'DRAFT' | 'REVIEWED'>;
  specialFlows: {
    cashBookingDeduction: 'SETTLEMENT_ROUTE_REQUIRED';
    manualReversal: 'SOURCE_REQUEST_REQUIRED';
  };
};

export type AdminManualWalletAdjustmentOpenPeriod = {
  currency: string;
  id: string;
  period: string;
  status: 'DRAFT' | 'REVIEWED';
  updatedAt: string;
};

export type AdminManualWalletAdjustmentAccountingEntry = {
  accountCredit: string;
  accountDebit: string;
  amount: number;
};

export type AdminManualWalletAdjustmentPreview = {
  accountingEntries: AdminManualWalletAdjustmentAccountingEntry[];
  adjustmentType: AdminManualWalletAdjustmentType;
  adminId?: string;
  affects: {
    bankCash: boolean;
    expense: boolean;
    partnerReceivable: boolean;
    revenue: boolean;
    taxPayable: boolean;
    walletLiability: boolean;
  };
  afterBalance: number;
  amount: number;
  approvalAdminId?: string | null;
  approvalId?: string;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
  bankCashAmount: number;
  beforeBalance: number;
  companyOutputVat: number;
  currency: string;
  caseReference?: string | null;
  direction: AdminManualWalletAdjustmentDirection;
  expenseAmount: number;
  expenseContraAmount?: number;
  monthlyPeriod?: string | null;
  monthlyPeriodStatus?: 'DRAFT' | 'REVIEWED' | 'DECLARED' | 'PAID' | 'CLOSED' | null;
  operationalCause?: string | null;
  ownerId: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  partnerReceivableDecrease?: number;
  partnerReceivableIncrease?: number;
  platformRevenueAmount: number;
  expectedCorrection?: string | null;
  reason: string;
  requiresApproval: boolean;
  requiresAttachment: boolean;
  revenueAccount?: string | null;
  revenueAmount: number;
  walletDelta: number;
  walletLiabilityDecrease?: number;
  walletLiabilityIncrease?: number;
};

export type AdminManualWalletAdjustmentResult = {
  auditLog?: AdminAuditLog;
  ledger: {
    id: string;
    amount: number;
    currency: string;
    createdAt?: string;
  };
  preview: AdminManualWalletAdjustmentPreview;
};

export type AdminManualWalletAdjustmentRow = {
  accountingEntries?: AdminManualWalletAdjustmentAccountingEntry[];
  adjustmentType: string;
  affects?: Record<string, unknown>;
  afterBalance?: number | null;
  amount: number;
  approvalAdmin?: {
    email?: string | null;
    fullName?: string | null;
    id: string;
  } | null;
  approvalAdminId?: string | null;
  approvalId?: string | null;
  attachmentUrl?: string | null;
  attachmentFileId?: string | null;
  beforeBalance?: number | null;
  caseReference?: string | null;
  createdAt?: string;
  currency: string;
  direction: string;
  id: string;
  ledgerType: string;
  monthlyPeriod?: string | null;
  monthlyPeriodStatus?: string | null;
  operationalCause?: string | null;
  ownerId: string;
  ownerLabel: string;
  ownerPhone: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  expectedCorrection?: string | null;
  reason?: string | null;
  requestedBy?: AdminOperatorIdentity | null;
  requestedByAdminId?: string | null;
  sourceKey: string;
  updatedAt?: string;
  walletDelta: number;
};

export type AdminManualWalletAdjustmentSummary = {
  total: number;
};

export type AdminManualWalletAdjustmentWorkspaceSummary = {
  awaitingApproval: number;
  history: number;
  needsRecreation: number;
  staleOrBlocked: number;
};

export type AdminCustomerWalletLedgerType =
  | 'REFERRAL_REWARD'
  | 'CUSTOMER_REFERRAL_EARNED'
  | 'CUSTOMER_REFERRAL_TAX_WITHHELD'
  | 'CUSTOMER_REFERRAL_USED_FOR_SERVICE'
  | 'CUSTOMER_REFERRAL_CASHOUT'
  | 'CUSTOMER_REFERRAL_REVERSED'
  | 'CUSTOMER_WALLET_PAYMENT'
  | 'REFUND'
  | 'ADMIN_ADJUSTMENT';

export type AdminCustomerWalletLedgerRow = {
  afterBalance: number;
  amount: number;
  beforeBalance: number;
  bookingId?: string | null;
  createdAt: string;
  currency: string;
  direction: 'CREDIT' | 'DEBIT';
  id: string;
  notes?: string | null;
  reference?: string | null;
  referralRewardId?: string | null;
  sourceKey: string;
  type: AdminCustomerWalletLedgerType;
};

export type AdminCustomerWalletLedgerPage = {
  pagination: {
    skip: number;
    take: number;
  };
  rows: AdminCustomerWalletLedgerRow[];
  summary: {
    balance: number;
    currency: string;
    moneyIn: number;
    moneyOut: number;
    totalCount: number;
  };
};

export type AdminManualWalletAdjustmentRequestStatus = 'REQUESTED' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';

export type AdminFinanceApprovalRequestPreflight = {
  blockers: Array<{
    code:
      | 'ATTACHMENT_REQUIRED'
      | 'FINANCE_APPROVER_REQUIRED'
      | 'MAKER_CANNOT_APPROVE'
      | 'POLICY_MIGRATION_REQUIRED'
      | 'REQUEST_INVALID'
      | 'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND'
      | 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN'
      | 'WALLET_ADJUSTMENT_PERIOD_REQUIRED'
      | 'WALLET_BALANCE_CHANGED'
      | string;
    message: string;
  }>;
  canApprove: boolean;
  canCancel?: boolean;
  canReject: boolean;
  currentAfterBalance: number | null;
  currentBeforeBalance: number | null;
  ready: boolean;
  warnings: Array<{ code: string; message: string }>;
};

export type AdminManualWalletAdjustmentRequest = {
  id: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  ownerId: string;
  ownerName?: string | null;
  ownerMaskedPhone?: string | null;
  ownerReference?: string | null;
  direction: AdminManualWalletAdjustmentDirection;
  adjustmentType: AdminManualWalletAdjustmentType;
  amount: number;
  currency: string;
  reason: string;
  operationalCause?: string | null;
  expectedCorrection?: string | null;
  caseReference?: string | null;
  monthlyPeriod?: string | null;
  monthlyPeriodStatus?: 'DRAFT' | 'REVIEWED' | 'DECLARED' | 'PAID' | 'CLOSED' | null;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
  attachmentFile?: {
    contentType: string;
    id: string;
    originalName?: string | null;
    reviewStatus: string;
    sizeBytes?: number | null;
    uploadStatus: string;
    uploadedAt?: string | null;
  } | null;
  requestedBeforeBalance: number;
  requestedAfterBalance: number;
  requestedWalletDelta?: number;
  accountingPreview?: AdminManualWalletAdjustmentAccountingEntry[];
  affects?: AdminManualWalletAdjustmentPreview['affects'];
  requiresAttachment: boolean;
  status?: AdminManualWalletAdjustmentRequestStatus;
  requestedByAdminId: string;
  requestedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  approvedByAdminId?: string | null;
  approvedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  rejectedByAdminId?: string | null;
  rejectedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  decisionReason?: string | null;
  ledgerEntryId?: string | null;
  executedAt?: string | null;
  rejectedAt?: string | null;
  reviewState?: 'BLOCKED' | 'READY' | 'STALE';
  preflight?: AdminFinanceApprovalRequestPreflight;
  createdAt: string;
  updatedAt?: string;
};

export type AdminEarningSummary = {
  count: number;
  generatedAt?: string;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  netAmount: number;
  pendingNetAmount: number;
  availableNetAmount: number;
  paidNetAmount: number;
  currency: string;
};

export type AdminCashSettlementSummary = {
  generatedAt: string;
  currency: string;
  rowCount: number;
  providerCount: number;
  global?: {
    allocatedAmount: number;
    missingSettlementEvidenceCount: number;
    originalDebtAmount: number;
    providerCount: number;
    remainingDebtAmount: number;
    rowCount: number;
    staleDebtRowCount: number;
  };
  queueCounts?: {
    all: number;
    highDebt: number;
    missingEvidence: number;
    paymentCheck: number;
    stale: number;
  };
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
  totalCompanyCouponOffset: number;
  totalOriginalDebtAmount?: number;
  totalAllocatedAmount?: number;
  totalDebtAmount: number;
  totalPlatformFee: number;
  totalTaxAmount: number;
  oldestOpenAt?: string | null;
  oldestOpenAgeMinutes: number;
  staleDebtRowCount: number;
  highDebtProviderCount: number;
  missingPaymentEvidenceCount: number;
  missingSettlementEvidenceCount?: number;
  cashPaymentRowCount: number;
  topProviderGroups: Array<{
    providerProfileId: string;
    providerName: string;
    providerPhone?: string | null;
    rowCount: number;
    debtAmount: number;
    platformFee: number;
    taxAmount: number;
    currency: string;
    oldestOpenAt: string;
    latestOpenAt: string;
    settlementReference: string;
  }>;
};

export type AdminCashSettlementDetail = {
  earning: AdminEarning;
  originalDebtAmount: number;
  allocatedAmount: number;
  remainingDebtAmount: number;
  walletBalance: number;
  availableDeposits: Array<
    AdminPartnerBankDepositRequest & {
      allocatedAmount: number;
      remainingReceivableRecovery: number;
    }
  >;
  auditLogs: AdminAuditLog[];
};

export type AdminRefund = {
  id: string;
  bookingId: string;
  paymentId: string;
  amount: number;
  currency?: string;
  metadata?: unknown;
  reason?: string | null;
  status: string;
  createdAt: string;
  booking?: {
    id?: string;
    status?: string;
    customerProfile?: {
      id?: string;
      user?: { phone?: string; fullName?: string | null };
    };
    selectedProvider?: { displayName?: string | null };
  };
  payment?: {
    amount?: number;
    bookingId?: string;
    callbackAttempts?: Array<{
      createdAt: string;
      errorCode?: string | null;
      errorMessage?: string | null;
      gatewayTransactionId?: string | null;
      id: string;
      outcome: string;
      providerStatus?: string | null;
      signatureVerified?: boolean | null;
    }>;
    currency: string;
    id?: string;
    method: string;
    providerRef?: string | null;
    status: string;
  };
};

export type AdminRefundOperationalStage =
  | 'STATE_MISMATCH'
  | 'AWAITING_DECISION'
  | 'PAYMENT_PROCESSING'
  | 'CLOSED'
  | 'REJECTED'
  | 'REVIEW_REQUIRED';

export type AdminRefundOperationsRow = AdminRefund & {
  assignee: string | null;
  nextAction: string;
  operationalStage: AdminRefundOperationalStage;
  stateMismatchReason: string | null;
};

export type AdminRefundQueueAge = 'all' | 'under-1h' | '1-4h' | '4-24h' | '1-3d' | '3-7d' | 'over-7d';

export type AdminRefundQueueMeta = {
  completedCount: number;
  generatedAt: string;
  globalOpenCount: number;
  oldestOpenAt?: string | null;
  openCount: number;
  processingCount: number;
  queueAgeCounts: Record<AdminRefundQueueAge, number>;
  queueSla: AdminQueueSlaSummary;
  rejectedCount: number;
  requestedCount: number;
  reviewRequiredCount: number;
  selectedTotal: number;
  stateMismatchCount: number;
};

export type AdminRefundSummary = {
  totalCount: number;
  generatedAt?: string;
  requestedCount: number;
  processingCount?: number;
  refundedBookingCount: number;
  needsUpdateCount: number;
  stateMismatchCount?: number;
  completedCount: number;
  openCount: number;
  oldestOpenAt?: string | null;
  outcomeLinkedCount: number;
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
};

export type AdminPayoutBatch = {
  id: string;
  providerProfileId: string;
  totalNetAmount: number;
  currency: string;
  status: string;
  transferRef?: string | null;
  notes?: string | null;
  createdAt: string;
  paidAt?: string | null;
  createdByAdminId?: string | null;
  createdBy?: AdminOperatorIdentity | null;
  lastUpdatedByAdminId?: string | null;
  lastUpdatedBy?: AdminOperatorIdentity | null;
  paidByAdminId?: string | null;
  paidBy?: AdminOperatorIdentity | null;
  paidCloseoutRequestedByAdminId?: string | null;
  paidCloseoutRequestedBy?: AdminOperatorIdentity | null;
  approvalAdminId?: string | null;
  approvalAdmin?: AdminOperatorIdentity | null;
  providerProfile?: {
    bankAccounts?: Array<{
      id: string;
      bankName: string;
      accountNumberMasked?: string | null;
      accountNumberLast4?: string | null;
      accountHolderName: string;
      status: string;
      isPrimary: boolean;
      reviewedAt?: string | null;
      rejectionReason?: string | null;
      deletedAt?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    displayName?: string | null;
    user?: { phone?: string; fullName?: string | null };
    sanctions?: AdminProviderSanction[];
    walletLedgerEntries?: AdminProviderWalletLedgerEntry[];
  };
  earnings?: AdminEarning[];
  withholdingLogs?: AdminWithholdingLog[];
  preflight?: AdminPayoutBatchPreflight;
  riskModel?: AdminPayoutBatchRiskModel;
  bankReconciliation?: {
    matchedAmount: number;
    paidAt: string | null;
    period: string;
    remainingAmount: number;
    targetAmount: number;
  } | null;
};

export type AdminFinanceExecutionPreflightMessage = {
  code: string;
  message: string;
};

export type AdminPayoutBatchPreflight = {
  actionAvailability?: {
    markFailed: AdminPayoutActionAvailability;
    markPaid: AdminPayoutActionAvailability;
    reversePaid: AdminPayoutActionAvailability;
    startProcessing: AdminPayoutActionAvailability;
  };
  actorCanApprovePaidCloseout?: boolean;
  approvedBankAccountId: string | null;
  blockers: AdminFinanceExecutionPreflightMessage[];
  canMarkFailed: boolean;
  canMarkPaid: boolean;
  canReversePaid?: boolean;
  canStartProcessing: boolean;
  independentApproverAvailable: boolean;
  paidCloseoutRequestedByAdminId?: string | null;
  paidLedgerAmount: number;
  paidLedgerEntryCount: number;
  payableAmount: number;
  payoutJournalPosted: boolean;
  reversalJournalPosted?: boolean;
  reversalLedgerRecorded?: boolean;
  ready: boolean;
  requiredAmount: number;
  walletBalance: number;
  warnings: AdminFinanceExecutionPreflightMessage[];
};

export type AdminPayoutActionAvailability = {
  allowed: boolean;
  blockers: AdminFinanceExecutionPreflightMessage[];
};

export type AdminPayoutBatchRiskModel = {
  phase: 'PRE_RELEASE' | 'IN_TRANSFER' | 'POST_PAYMENT' | 'ARCHIVED';
  releasePreflight: AdminPayoutBatchPreflight | null;
  reconciliationFindings: AdminFinanceExecutionPreflightMessage[];
};

export type AdminOperatorIdentity = {
  id: string;
  email?: string | null;
  fullName?: string | null;
};

export type AdminPayoutBatchSummary = {
  generatedAt: string;
  range?: string;
  timeZone?: string;
  scopeCount?: number;
  total: number;
  needsReview: number;
  inProgress: number;
  payoutHolds: number;
  missingTransferRefs: number;
  settled: number;
  open: number;
  totalNetAmount: number;
  withholdingAmount: number;
  currency: string;
  postPaymentRepairCount?: number;
  bankReconciliationCandidateCount?: number;
  bankReconciliationRemainingAmount?: number;
  bankReconciliationPeriod?: string;
  moneyFlow?: {
    scope: string;
    scopeBatchCount: number;
    totalBatchCount: number;
    evidenceBatchCount: number;
    grossAmount: number;
    payoutNetAmount: number;
    evidenceNetAmount: number;
    platformFeeAmount: number;
    withholdingAmount: number;
    cashDebtAmount: number;
    netGap: number;
    completeness: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
    verdict: 'MATCHED' | 'MISMATCH' | 'NOT_EVALUATED';
    generatedAt: string;
  };
};

export type AdminProviderWalletWithdrawalRequestStatus =
  | 'REQUESTED'
  | 'NEEDS_BANK_CORRECTION'
  | 'APPROVED'
  | 'BANK_TRANSFER_PENDING'
  | 'REVIEW_REQUIRED'
  | 'HOLD'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REVERSED';

export type AdminProviderWalletWithdrawalReconciliationState = 'NOT_APPLICABLE' | 'UNMATCHED' | 'MATCHED';

export type AdminProviderWalletWithdrawalRequest = {
  id: string;
  providerProfileId: string;
  bankAccountId: string | null;
  amount: number;
  currency: string;
  status: AdminProviderWalletWithdrawalRequestStatus;
  requestNote?: string | null;
  adminNote?: string | null;
  correctionReason?: string | null;
  transferRef?: string | null;
  reviewedByAdminId?: string | null;
  reviewedBy?: AdminOperatorIdentity | null;
  paidBy?: AdminOperatorIdentity | null;
  approvalAdminId?: string | null;
  approvalAdmin?: AdminOperatorIdentity | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt?: string;
  reconciliationState?: AdminProviderWalletWithdrawalReconciliationState;
  bankReconciliationMatch?: {
    id: string;
    bankTransactionId: string;
    matchedAt: string;
    status: 'MATCHED' | 'PARTIALLY_MATCHED';
  } | null;
  providerProfile?: {
    id?: string;
    displayName?: string | null;
    user?: { id?: string; phone?: string | null; fullName?: string | null };
  } | null;
  bankAccount?: {
    id: string;
    bankName: string;
    accountHolderName: string;
    accountNumberMasked?: string | null;
    accountNumberLast4?: string | null;
    status: string;
    isPrimary?: boolean;
    deletedAt?: string | null;
  } | null;
  preflight?: AdminProviderWalletWithdrawalPreflight;
};

export type AdminProviderWalletWithdrawalPreflight = {
  actorCanApprovePaidCloseout?: boolean;
  availableBalance: number;
  bankAccountApproved: boolean;
  blockers: AdminFinanceExecutionPreflightMessage[];
  canApprove: boolean;
  canMarkBankTransferPending: boolean;
  canMarkPaid: boolean;
  canReversePaid?: boolean;
  canReject: boolean;
  independentApproverAvailable: boolean;
  paidCloseoutRequestedByAdminId?: string | null;
  lockJournalPosted: boolean;
  paidJournalPosted: boolean;
  paidLedgerRecorded: boolean;
  reversalJournalPosted?: boolean;
  reversalLedgerRecorded?: boolean;
  ready: boolean;
  walletBalance: number;
  warnings: AdminFinanceExecutionPreflightMessage[];
};

export type AdminProviderWalletWithdrawalRequestSummary = {
  generatedAt?: string;
  range?: string;
  timeZone?: string;
  scopeCount?: number;
  filteredTotal?: number;
  total: number;
  requested: number;
  reviewRequired: number;
  bankTransferPending: number;
  lockReleased: number;
  totalAmount: number;
  requestedAmount: number;
  pendingWithdrawalPayableAmount: number;
  bankTransferPendingAmount: number;
  paidAmount: number;
  returnedAmount: number;
  paidUnreconciled?: number;
  paidUnreconciledAmount?: number;
  paidReconciled?: number;
  paidReconciledAmount?: number;
  oldestOpenAt?: string | null;
  currency: string;
};

export type AdminProviderTaxLog = {
  id: string;
  grossAmount: number;
  taxableAmount: number;
  withholdingAmount: number;
  currency: string;
  ruleSnapshot?: unknown;
  createdAt?: string;
};

export type AdminProviderPlatformFeeLog = {
  id: string;
  grossAmount: number;
  platformFeeAmount: number;
  currency: string;
  ruleSnapshot?: unknown;
  createdAt?: string;
};

export type AdminWithholdingLog = {
  id: string;
  providerTaxLogId: string;
  payoutBatchId?: string | null;
  amount: number;
  status: string;
  createdAt?: string;
};

export type AdminReview = {
  id: string;
  bookingId?: string;
  createdByAdminId?: string | null;
  rating: number;
  comment?: string | null;
  status: string;
  reportReason?: string | null;
  createdAt?: string;
  customerProfileId?: string;
  providerProfileId?: string;
  customerProfile?: {
    id?: string;
    user?: {
      fullName?: string | null;
      phone?: string;
      appSessions?: AdminAppSession[];
      pushDevices?: AdminUser['pushDevices'];
    };
  };
  providerProfile?: {
    id?: string;
    displayName?: string | null;
    status?: string | null;
    user?: AdminProvider['user'];
    sessions?: AdminProvider['sessions'];
    devices?: AdminProvider['devices'];
  };
  booking?: {
    id?: string;
    openedAt?: string | null;
    createdAt?: string;
    services?: AdminBooking['services'];
  };
};

export type AdminReviewSummary = {
  averageRating?: number;
  generatedAt?: string;
  held?: number;
  published?: number;
  reported?: number;
  totalCount: number;
};

export type AdminPartnerCustomerReview = {
  id: string;
  bookingId?: string;
  comment?: string | null;
  status?: string | null;
  reportReason?: string | null;
  moderatedAt?: string | null;
  createdAt?: string;
  customerProfileId?: string;
  providerProfileId?: string;
  customerProfile?: {
    id?: string;
    user?: {
      fullName?: string | null;
    };
  };
  providerProfile?: {
    id?: string;
    displayName?: string | null;
  };
  booking?: {
    id?: string;
    openedAt?: string | null;
    createdAt?: string;
    services?: AdminBooking['services'];
  };
  latestModeration?: {
    actor?: {
      id?: string;
      email?: string | null;
      fullName?: string | null;
    } | null;
    createdAt?: string;
    reason?: string | null;
  } | null;
};

export type AdminPartnerCustomerReviewSummary = {
  generatedAt?: string;
  needsReview: number;
  restricted: number;
  retained: number;
  totalCount: number;
};

export type AdminCoupon = {
  id: string;
  code: string;
  description?: string | null;
  discount: unknown;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageBookingCount?: number;
  usageBookings?: AdminCouponUsageBooking[];
};

export type AdminCouponSummary = {
  expiredCount: number;
  filteredCount?: number;
  generatedAt?: string;
  liveCount: number;
  pausedCount: number;
  scheduledCount: number;
  totalCount: number;
};

export type AdminCouponUsagePage = {
  couponCode?: string;
  couponId: string;
  rows: AdminCouponUsageBooking[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminCouponUsageBooking = {
  amount?: number | null;
  bookingId: string;
  closedAt?: string | null;
  couponCode?: string | null;
  currency?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  discountAmount?: number | null;
  originalAmount?: number | null;
  partnerName?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  requestTime?: string | null;
  reversalStatus?: string | null;
  scheduledStartAt?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
  status?: string | null;
};

export type AdminServicePayoutRule = {
  id: string;
  serviceId: string;
  customerPrice: number;
  providerPayoutAmount: number;
  vatBps: number;
  otherCostAmount: number;
  currency: string;
  active: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminServiceCatalogItem = {
  id: string;
  serviceGroupKey?: string | null;
  name: string;
  nameTranslations?: Record<string, string> | null;
  description?: string | null;
  durationMin: number;
  basePrice: number;
  priceStep: number;
  displayOrder: number;
  active: boolean;
  payoutRules?: AdminServicePayoutRule[];
  providers?: Array<{
    id: string;
    providerProfileId: string;
    serviceId: string;
    price: number;
    active: boolean;
    providerProfile?: {
      id: string;
      displayName?: string | null;
      status?: string | null;
      blockedAt?: string | null;
    } | null;
  }>;
  bookings?: Array<{
    id: string;
    bookingId: string;
    serviceId: string;
    quantity: number;
    price: number;
    booking?: {
      id: string;
      status: string;
      createdAt: string;
      selectedProviderId?: string | null;
      payment?: {
        method: string;
        status: string;
        amount: number;
        currency: string;
      } | null;
      earning?: {
        id: string;
        grossAmount: number;
        platformFee: number;
        withholdingAmount: number;
        netAmount: number;
        status: string;
        currency: string;
      } | null;
      taxLogs?: Array<{
        id: string;
        withholdingAmount: number;
        taxableAmount: number;
        currency: string;
      }>;
      platformFeeLogs?: Array<{
        id: string;
        platformFeeAmount: number;
        currency: string;
      }>;
      walletLedgerEntries?: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
      }>;
    } | null;
  }>;
  _count?: { providers?: number; bookings?: number };
};

export type AdminTaxPolicyVersion = {
  id: string;
  name: string;
  status: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdAt?: string;
  rules?: AdminTaxRule[];
};

export type AdminTaxRule = {
  id: string;
  policyVersionId: string;
  scope: string;
  serviceType?: string | null;
  minGrossAmount?: number | null;
  maxGrossAmount?: number | null;
  rateBps: number;
  fixedAmount: number;
  active: boolean;
  createdAt?: string;
};

export type AdminBookingSettlementStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AdminBookingSettlementTaxStatus = 'OPEN' | 'DECLARED' | 'PAID' | 'CLOSED' | 'REVERSED';
export type AdminMonthlyTaxClosingStatus = 'DRAFT' | 'REVIEWED' | 'DECLARED' | 'PAID' | 'CLOSED' | 'REVERSED';
export type AdminAccountingJournalBatchStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AdminAccountingJournalSourceType =
  | 'BOOKING_SETTLEMENT'
  | 'BOOKING_SETTLEMENT_REVERSAL'
  | 'MANUAL_WALLET_ADJUSTMENT'
  | 'PROVIDER_WITHDRAWAL'
  | 'PROVIDER_PAYOUT_BATCH'
  | 'PROVIDER_BANK_DEPOSIT'
  | 'REFERRAL_REWARD'
  | 'REFUND'
  | 'PAYMENT_CALLBACK'
  | 'BANK_RECONCILIATION_ADJUSTMENT'
  | 'WITHHOLDING_REMITTANCE';
export type AdminBookingPaymentClearingEntryType =
  | 'CUSTOMER_PAYMENT_CAPTURED'
  | 'SETTLEMENT_POSTED'
  | 'REFUND_REVERSAL'
  | 'PAYMENT_FEE_ACCRUAL'
  | 'COUPON_OFFSET'
  | 'MANUAL_ADJUSTMENT';
export type AdminBookingPaymentClearingStatus = 'OPEN' | 'PARTIALLY_CLEARED' | 'CLEARED' | 'REVERSED';
export type AdminCompanyBankTransactionType = 'INFLOW' | 'OUTFLOW';
export type AdminBankReconciliationEvidenceSource =
  | 'PAYMENT_CLEARING'
  | 'PARTNER_DEPOSIT'
  | 'WITHDRAWAL'
  | 'PAYOUT'
  | 'REFUND'
  | 'OTHER_JOURNAL'
  | 'UNCLASSIFIED';

export type AdminCompanyBankTransactionBatchClassification =
  | 'NEW'
  | 'POTENTIAL_DUPLICATE'
  | 'EXACT_DUPLICATE'
  | 'INVALID';

export type AdminCompanyBankTransactionBatchInputRow = {
  rowNumber: number;
  bankAccountId: string;
  type: string;
  amount: string;
  currency?: string;
  occurredAt: string;
  valueDate?: string;
  sourceKey?: string;
  transferRef?: string;
  counterpartyName?: string;
  description?: string;
  confirmPotentialDuplicate?: boolean;
};

export type AdminCompanyBankTransactionBatchPreview = {
  rows: Array<{
    rowNumber: number;
    classification: AdminCompanyBankTransactionBatchClassification;
    errors: string[];
    batchCandidateRowNumbers: number[];
    candidates: Array<{
      id: string;
      amount: number;
      counterpartyName: string | null;
      occurredAt: string;
      status: string;
      transferRef: string | null;
    }>;
    normalized: {
      amount: number;
      bankAccountId: string;
      counterpartyName: string | null;
      currency: string;
      description: string | null;
      occurredAt: string;
      sourceKey: string;
      transferRef: string | null;
      type: AdminCompanyBankTransactionType;
      valueDate: string | null;
    } | null;
    raw: {
      amount: string;
      counterpartyName: string;
      occurredAt: string;
      transferRef: string;
      valueDate: string;
    };
  }>;
  summary: {
    exactDuplicate: number;
    invalid: number;
    new: number;
    potentialDuplicate: number;
    total: number;
  };
};

export type AdminCompanyBankTransactionBatchImportResult = {
  batchImportId: string;
  importedCount: number;
  skippedCount: number;
  results: Array<{
    rowNumber: number;
    status: 'IMPORTED' | 'SKIPPED';
    classification: AdminCompanyBankTransactionBatchClassification;
    transactionId?: string;
    message?: string;
  }>;
};

export type AdminCompanyBankTransactionImportBatchHistory = {
  items: Array<{
    approvalAdminId: string | null;
    approver: { id: string; email: string | null; fullName: string | null } | null;
    assignee: { id: string; email: string | null; fullName: string | null } | null;
    assigneeAdminId: string | null;
    assignedAt: string | null;
    assignedByAdminId: string | null;
    batchImportId: string;
    createdAt: string;
    importedCount: number;
    mappingPreset: string | null;
    operator: { id: string; email: string | null; fullName: string | null; phone?: string | null } | null;
    reconciliationNeedsActionCount: number;
    reconciliationProgressPercent: number | null;
    reconciliationSlaStatus: 'NO_TRANSACTIONS' | 'RECONCILED' | 'WITHIN_24H' | 'OVER_24H' | 'ESCALATE';
    reconciliationTransactionCount: number;
    reconciliationWaitingHours: number | null;
    reconciledTransactionCount: number;
    requestedCount: number;
    skippedCount: number;
    sourceFileName: string | null;
    sourceFileSha256: string | null;
  }>;
  pagination: { skip: number; take: number; total: number };
};

export type AdminCompanyBankTransactionImportBatchSummary = {
  batchCount: number;
  escalatedNeedsReconciliationCount: number;
  needsReconciliationCount: number;
  noTransactionCount: number;
  oldestOpenImportedAt: string | null;
  reconciledCount: number;
  staleNeedsReconciliationCount: number;
};

export type AdminFinanceReviewAssignmentHistoryEntry = {
  id: string;
  assignedAt: string;
  assignee: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  };
  assignedBy?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  previousAssignee?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
  } | null;
  reason?: string | null;
};

export type AdminCompanyBankTransactionImportBatchDetail =
  AdminCompanyBankTransactionImportBatchHistory['items'][number] & {
    assignmentHistory?: AdminFinanceReviewAssignmentHistoryEntry[];
    rows: Array<{
      classification: AdminCompanyBankTransactionBatchClassification;
      rowNumber: number;
      status: 'IMPORTED' | 'SKIPPED';
      transactionId: string | null;
      transaction: {
        id: string;
        amount: number;
        currency: string;
        occurredAt: string;
        status: AdminBankReconciliationStatus;
        transferRef: string | null;
        type: AdminCompanyBankTransactionType;
      } | null;
    }>;
  };
export type AdminBankReconciliationStatus =
  | 'UNMATCHED'
  | 'MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'IGNORED'
  | 'REVERSED';

export type AdminBookingSettlementGapAgeBucket = 'RECENT' | '24_TO_72_HOURS' | '3_TO_7_DAYS' | '7_DAYS_PLUS';
export type AdminBookingSettlementGapRepairTrack =
  | 'canonical'
  | 'historical-ready'
  | 'evidence-blocked'
  | 'manual-review';

export type AdminBookingSettlementGap = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  gapAt: string;
  ageBucket: AdminBookingSettlementGapAgeBucket;
  repairTrack: AdminBookingSettlementGapRepairTrack;
  customerProfile?: {
    id: string;
    user?: { fullName?: string | null; phone?: string | null } | null;
  } | null;
  selectedProvider?: {
    id: string;
    displayName?: string | null;
    user?: { fullName?: string | null; phone?: string | null } | null;
  } | null;
  payment?: {
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
  } | null;
  earning?: {
    id: string;
    status: string;
  } | null;
};

export type AdminBookingSettlementGapList = {
  generatedAt: string;
  hasNext: boolean;
  items: AdminBookingSettlementGap[];
  skip: number;
  take: number;
  total: number;
};

export type AdminBookingSettlementGapSummary = {
  age24To72Hours: number;
  age3To7Days: number;
  age7DaysPlus: number;
  backlog: number;
  canonical: number;
  evidenceBlocked: number;
  generatedAt: string;
  historicalReady: number;
  manualReview: number;
  oldestGapAt?: string | null;
  recent: number;
  scope?: {
    age: string;
    paymentMethod: string;
    period: string;
    q: string;
    track: string;
  };
  sourceStatus?: 'AVAILABLE';
  total: number;
};

export type AdminBookingSettlementExpectedDryRun = {
  companyOutputVat: number;
  customerPaymentAmount: number;
  journalBalanced: boolean;
  journalReconciliationDelta: number;
  journalTotalCredit: number;
  journalTotalDebit: number;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  paymentProcessingFee: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
};

export type AdminBookingSettlementDryRunCounts = {
  blocked: number;
  companyOutputVatPositive: number;
  companyOutputVatZero: number;
  eligible: number;
  journalBalanced: number;
  paymentFeeDefaulted: number;
  paymentFeePolicyMatched: number;
  platformVatEvidenceReady: number;
  platformVatExplicitZeroServiceRule: number;
  platformVatUnexplainedZero: number;
  platformVatZeroFromPolicy: number;
  reconciliationReview: number;
  reviewRequired: number;
};

export type AdminBookingSettlementDryRunTotals = Omit<
  AdminBookingSettlementExpectedDryRun,
  'journalBalanced'
>;

export type AdminBookingSettlementGapDryRun = {
  blockerCodes: Record<string, number>;
  counts: AdminBookingSettlementDryRunCounts;
  evaluated: number;
  generatedAt: string;
  items: Array<{
    blockers: Array<{ code: string; message: string }>;
    bookingId: string;
    canRepair: boolean;
    completedAt: string;
    expected: AdminBookingSettlementExpectedDryRun | null;
    monthlyClosingStatus?: string | null;
    monthlyPeriod: string;
    paymentFeeDefaultReason?: string | null;
    paymentFeePolicyVersionId?: string | null;
    paymentFeeRuleStatus: 'MATCHED_POLICY_RULE' | 'DEFAULTED' | 'UNAVAILABLE';
    paymentMethod?: string | null;
    policyDecision: 'APPROVED' | 'BLOCKED' | 'REVIEW_REQUIRED';
    policyExceptionCodes: string[];
    policyReasons: string[];
    platformFeePolicyVersionId?: string | null;
    platformVatEvidenceStatus:
      | 'EXPLICIT_ZERO_SERVICE_PAYOUT_RULE'
      | 'POSITIVE'
      | 'UNAVAILABLE'
      | 'ZERO_FROM_POLICY'
      | 'ZERO_UNEXPLAINED';
    platformVatRateBps?: number | null;
    technicalEligibility: boolean;
  }>;
  paymentMethods: Record<string, number>;
  policyGate: {
    issues: Array<{ code: string; count: number; message: string }>;
    status: 'REVIEW_REQUIRED' | 'READY_FOR_INDIVIDUAL_APPROVAL';
  };
  periodStatuses: Record<string, number>;
  recoveryBatches: Array<{
    batchKey: string;
    bookingIds: string[];
    counts: AdminBookingSettlementDryRunCounts;
    executionStatus: 'REVIEW_REQUIRED' | 'READY_FOR_INDIVIDUAL_APPROVAL';
    paymentMethod: string;
    recordCount: number;
    totals: AdminBookingSettlementDryRunTotals;
  }>;
  totalMatched: number;
  totals: AdminBookingSettlementDryRunTotals;
  truncated: boolean;
};

export type AdminBookingSettlementGapRepairPreview = {
  bookingId: string;
  canRepair: boolean;
  blockers: Array<{ code: string; message: string }>;
  bookingStatus: string;
  completedAt: string;
  currency: string;
  generatedAt: string;
  monthlyPeriod: string;
  monthlyClosingStatus?: string | null;
  customer?: {
    id: string;
    user?: { fullName?: string | null; phone?: string | null } | null;
  } | null;
  partner?: {
    id: string;
    displayName?: string | null;
    user?: { fullName?: string | null; phone?: string | null } | null;
  } | null;
  payment?: {
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
  } | null;
  earning?: {
    id: string;
    status: string;
    grossAmount: number;
    platformFee: number;
    withholdingAmount: number;
    netAmount: number;
    currency: string;
    paidAt?: string | null;
    payoutBatchId?: string | null;
  } | null;
  historicalEvidenceSummary?: {
    platformFeeLogCount: number;
    taxLogCount: number;
    walletLedgerEntryCount: number;
  } | null;
  historicalSettlementDryRun?: {
    amounts: {
      companyOutputVat: number;
      partnerWithholdingTotal: number;
      paymentProcessingFee: number;
      platformFeeNetRevenue: number;
    };
    customerPaymentAmount: number;
    journal: {
      reconciliationDelta: number;
      totalCredit: number;
      totalDebit: number;
    };
    partnerPayoutAmount: number;
    paymentFeePolicyVersionId?: string | null;
    paymentFeeRuleSnapshot?: unknown;
    platformFeeGross: number;
    platformFeePolicyVersionId?: string | null;
    platformFeeRuleSnapshot?: unknown;
    platformVatRateBps?: number;
  } | null;
  policyDecision: 'APPROVED' | 'BLOCKED' | 'REVIEW_REQUIRED';
  policyExceptionCodes: string[];
  policyReasons: string[];
  policyVersion: string;
  settlementSnapshotId?: string | null;
  serviceCount: number;
  repairMode: 'CANONICAL_COMPLETION_SETTLEMENT' | 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION';
  preservesExistingEarningLifecycle: boolean;
  sourceVersion: string;
  technicalEligibility: boolean;
};

export type AdminBookingSettlementGapRepairPreviewBatch = {
  generatedAt: string;
  items: AdminBookingSettlementGapRepairPreview[];
  requested: number;
};

export type AdminBookingSettlementRepairCheckpoint = {
  blockingFailures: string[];
  bookingId: string;
  checkedAt: string;
  checks: Array<{
    actual?: number | string | null;
    code: string;
    expected?: number | string | null;
    message: string;
    passed: boolean;
  }>;
  passed: boolean;
  repairMode: 'CANONICAL_COMPLETION_SETTLEMENT' | 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION' | null;
  snapshotId: string | null;
  status: 'PASSED' | 'FAILED';
};

export type AdminBookingSettlementGapRepairResult = {
  actorId: string;
  approvalAdminId: string;
  auditLogId: string;
  bookingId: string;
  checkpoint: AdminBookingSettlementRepairCheckpoint;
  completedAt: string;
  earningId: string;
  policyDecision: 'APPROVED';
  policyVersion: string;
  repairMode: 'CANONICAL_COMPLETION_SETTLEMENT' | 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION';
  repaired: true;
  settlementSnapshotId: string;
  sourceVersion: string;
};

export type AdminSettlementAuditCheckState = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type AdminSettlementAuditBlockerCode =
  | 'ALLOCATION_DELTA'
  | 'BANK_MATCH_INCOMPLETE'
  | 'CANONICAL_CLEARING_DUPLICATE'
  | 'CANONICAL_CLEARING_MISSING'
  | 'CANONICAL_JOURNAL_DUPLICATE'
  | 'CANONICAL_JOURNAL_MISSING'
  | 'CANONICAL_JOURNAL_NOT_POSTED'
  | 'CLEARING_AMOUNT_MISMATCH'
  | 'CLEARING_STILL_OPEN'
  | 'COUPON_EVIDENCE_MISSING'
  | 'JOURNAL_ENTRY_UNBALANCED'
  | 'JOURNAL_HEADER_ENTRY_MISMATCH'
  | 'JOURNAL_HEADER_UNBALANCED'
  | 'PAYMENT_FEE_POLICY_MISSING'
  | 'RECONCILIATION_DELTA_ENTRY'
  | 'REVERSAL_AMOUNT_MISMATCH'
  | 'REVERSAL_CLEARING_MISSING'
  | 'REVERSAL_EVIDENCE_INCONSISTENT'
  | 'REVERSAL_JOURNAL_MISSING'
  | 'REVERSAL_LEDGER_MISSING'
  | 'TAX_PERIOD_MISMATCH';

export type AdminSettlementAuditHealth = {
  allocation: {
    companyCouponExpense: number;
    customerPaymentAmount: number;
    delta: number;
    partnerPayoutAmount: number;
    partnerWithholdingTotal: number;
    platformFeeGross: number;
  };
  blockers: Array<{
    amount?: number;
    blockingCloseout?: boolean;
    code: AdminSettlementAuditBlockerCode;
    dueAt?: string | null;
    nextAction: string;
    owner?: string;
    ownerTeam: string;
    priority?: number;
    remediationHref?: string;
    severity: 'BLOCKER' | 'WARNING';
  }>;
  checkedAt: string;
  checks: {
    allocation: AdminSettlementAuditCheckState;
    bankMatch: AdminSettlementAuditCheckState;
    canonicalClearing: AdminSettlementAuditCheckState;
    canonicalJournal: AdminSettlementAuditCheckState;
    couponPolicy: AdminSettlementAuditCheckState;
    paymentFeePolicy: AdminSettlementAuditCheckState;
    reversal: AdminSettlementAuditCheckState;
    reversalClearing?: AdminSettlementAuditCheckState;
    reversalLedger?: AdminSettlementAuditCheckState;
    taxPeriod: AdminSettlementAuditCheckState;
  };
  evidence: {
    canonicalClearing: {
      count: number;
      ids: string[];
      matchedAmount: number;
      required: boolean;
      state: AdminSettlementAuditCheckState;
      unmatchedAmount: number;
    };
    canonicalJournal: {
      count: number;
      ids: string[];
      state: AdminSettlementAuditCheckState;
    };
    reversal: {
      clearingCount: number;
      clearingRequired?: boolean;
      count: number;
      ids: string[];
      journalCount: number;
      ledgerEvidence?: AdminSettlementAuditCheckState;
      ledgerType?: 'CASH_RECEIVABLE_JOURNAL' | 'CUSTOMER_WALLET_REFUND' | 'EXTERNAL_CLEARING' | 'NONE';
      lifecycle: 'NONE' | 'OPEN_PERIOD' | 'CLOSED_PERIOD';
      reason?: string | null;
      reversedAt?: string | null;
      reversalPeriod?: string | null;
      state: AdminSettlementAuditCheckState;
    };
  };
  formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1';
  state: 'CLEAR' | 'ACTION_REQUIRED' | 'REVERSED_CLEAR' | 'UNKNOWN';
  workflow?: {
    dueAt: string | null;
    reason: string;
    state: 'TAX_OPEN' | 'TAX_DECLARED' | 'TAX_PAID' | 'TAX_CLOSED' | 'REVERSED' | 'UNKNOWN';
    urgency: 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'BLOCKED' | 'UNKNOWN';
  };
};

export type AdminBookingSettlementSnapshot = {
  auditAmountAtRisk?: number;
  auditCursor?: string;
  id: string;
  bookingId: string;
  customerProfileId: string;
  providerProfileId: string;
  paymentId?: string | null;
  providerEarningId?: string | null;
  paymentMethod: AdminPaymentMethod;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerTaxableRevenue: number;
  partnerVatAmount: number;
  partnerPitAmount: number;
  partnerWithholdingTotal: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentProcessingFee: number;
  paymentFeePolicyVersionId?: string | null;
  paymentFeeRateBps?: number | null;
  paymentFeeFixedAmount?: number | null;
  paymentFeePayer?: 'HANDS' | 'CUSTOMER' | 'PARTNER' | 'SHARED' | null;
  paymentFeeTreatment?: 'OPERATING_EXPENSE' | 'PASS_THROUGH' | 'MANUAL_REVIEW' | null;
  paymentFeeRuleSnapshot?: unknown;
  settlementStatus: AdminBookingSettlementStatus;
  taxStatus: AdminBookingSettlementTaxStatus;
  monthlyPeriod: string;
  postedAt: string;
  closedAt?: string | null;
  reversedById?: string | null;
  reversalReason?: string | null;
  metadata?: unknown;
  settlementAuditHealth: AdminSettlementAuditHealth;
  booking?: {
    id: string;
    createdAt: string;
    scheduledStartAt?: string | null;
    status: string;
    closedAt?: string | null;
  } | null;
  customerProfile?: {
    id: string;
    user?: { id?: string; fullName?: string | null; phone?: string | null } | null;
  } | null;
  providerProfile?: {
    id: string;
    displayName?: string | null;
    user?: { id?: string; fullName?: string | null; phone?: string | null } | null;
  } | null;
  accountingJournalBatches?: Array<{
    id: string;
    sourceKey: string;
    sourceType: AdminAccountingJournalSourceType;
    status: AdminAccountingJournalBatchStatus;
    totalDebit: number;
    totalCredit: number;
    postedAt: string;
    entries?: Array<{
      accountCode: string;
      amount: number;
      side: 'CREDIT' | 'DEBIT';
    }>;
  }>;
  paymentClearingEntries?: Array<{
    id: string;
    sourceKey: string;
    status: AdminBookingPaymentClearingStatus;
    type: AdminBookingPaymentClearingEntryType;
    amount: number;
    currency: string;
    occurredAt: string;
    bankReconciliationMatches?: Array<{
      amount: number;
      matchedAt: string;
      status: string;
    }>;
  }>;
  reversalEntries?: Array<{
    id: string;
    sourceKey: string;
    settlementStatus: AdminBookingSettlementStatus;
    taxStatus: AdminBookingSettlementTaxStatus;
    monthlyPeriod?: string | null;
    originalMonthlyPeriod?: string | null;
    occurredAt: string;
    reason?: string | null;
    accountingJournalBatches?: Array<{
      id: string;
      sourceKey: string;
      status: AdminAccountingJournalBatchStatus;
      postedAt: string;
    }>;
    paymentClearingEntries?: Array<{
      id: string;
      sourceKey: string;
      status: AdminBookingPaymentClearingStatus;
      type: AdminBookingPaymentClearingEntryType;
      amount: number;
      currency: string;
      occurredAt: string;
    }>;
  }>;
};

export type AdminBookingSettlementSnapshotSummary = {
  actionRequiredCount: number;
  allocationMismatchCount: number;
  amountAtRisk: number;
  checkedAt: string;
  clearCount: number;
  clearingEvidenceIssueCount: number;
  closedTaxCount: number;
  count: number;
  couponEvidenceIssueCount: number;
  currency: string;
  customerPaymentAmount: number;
  declaredTaxCount: number;
  feeEvidenceIssueCount: number;
  journalEvidenceIssueCount: number;
  integrityReasonCount?: number;
  needsActionCount: number;
  oldestActionRequiredAt?: string | null;
  oldestNeedsActionAt?: string | null;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  paymentEvidenceCount?: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentProcessingFee: number;
  paymentFeeEvidenceIssueCount: number;
  openTaxCount: number;
  overdueTaxCount?: number;
  paidTaxCount: number;
  resolvedCount: number;
  reversalEvidenceCompleteCount?: number;
  reversalEvidenceIncompleteCount?: number;
  reversalIncompleteCount: number;
  reversedClearCount: number;
  reversedCount: number;
  reversedWithOtherBlockersCount?: number;
  taxDueDateUnknownCount?: number;
  taxEvidenceIssueCount: number;
  taxWorkflowCount?: number;
  unknownCount: number;
};

export type AdminBookingSettlementReversalEntry = {
  id: string;
  sourceKey: string;
  originalSettlementSnapshotId: string;
  bookingId: string;
  customerProfileId: string;
  providerProfileId: string;
  paymentId?: string | null;
  providerEarningId?: string | null;
  paymentMethod: AdminPaymentMethod;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerTaxableRevenue: number;
  partnerVatAmount: number;
  partnerPitAmount: number;
  partnerWithholdingTotal: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentProcessingFee: number;
  settlementStatus: AdminBookingSettlementStatus;
  taxStatus: AdminBookingSettlementTaxStatus;
  monthlyPeriod: string;
  originalMonthlyPeriod: string;
  originalMonthlyClosingId: string;
  occurredAt: string;
  reason?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  accountingJournalBatches?: Array<{
    id: string;
    metadata?: unknown;
    sourceKey: string;
    status: AdminAccountingJournalBatchStatus;
    totalCredit: number;
    totalDebit: number;
    postedAt: string;
  }>;
  paymentClearingEntries?: Array<{
    id: string;
    sourceKey: string;
    status: AdminBookingPaymentClearingStatus;
    type: AdminBookingPaymentClearingEntryType;
    amount: number;
    currency: string;
    occurredAt: string;
    bankReconciliationMatches?: AdminPaymentClearingBankReconciliationMatch[];
  }>;
  originalSettlementSnapshot?: {
    id: string;
    monthlyPeriod: string;
    postedAt: string;
    settlementStatus: AdminBookingSettlementStatus;
    taxStatus: AdminBookingSettlementTaxStatus;
    booking?: { id: string; status: string; createdAt?: string; closedAt?: string | null } | null;
    customerProfile?: {
      id: string;
      user?: { id: string; fullName?: string | null; phone?: string | null } | null;
    } | null;
    providerProfile?: {
      id: string;
      displayName?: string | null;
      user?: { id: string; fullName?: string | null; phone?: string | null } | null;
    } | null;
  } | null;
};

export type AdminBookingSettlementReversalSummary = {
  count: number;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentProcessingFee: number;
  cashCount: number;
  nonCashCount: number;
};

export type AdminAccountingJournalBatch = {
  id: string;
  sourceKey: string;
  sourceType: AdminAccountingJournalSourceType;
  sourceId: string;
  bookingId?: string | null;
  customerProfileId?: string | null;
  providerProfileId?: string | null;
  paymentId?: string | null;
  settlementSnapshotId?: string | null;
  settlementReversalEntryId?: string | null;
  monthlyPeriod?: string | null;
  currency: string;
  status: AdminAccountingJournalBatchStatus;
  totalDebit: number;
  totalCredit: number;
  postedAt: string;
  reversedAt?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  integrity?: AdminAccountingJournalIntegrity;
  _count?: { entries: number };
  booking?: { id: string; status: string; createdAt?: string; closedAt?: string | null } | null;
  customerProfile?: {
    id: string;
    user?: { id: string; fullName?: string | null; phone?: string | null } | null;
  } | null;
  providerProfile?: {
    id: string;
    displayName?: string | null;
    user?: { id: string; fullName?: string | null; phone?: string | null } | null;
  } | null;
};

export type AdminAccountingJournalIntegrity = {
  blockerCodes: Array<
    | 'ENTRY_UNBALANCED'
    | 'FORMULA_DELTA'
    | 'FORMULA_EVIDENCE_MISSING'
    | 'HEADER_ENTRY_MISMATCH'
    | 'HEADER_UNBALANCED'
    | 'PERIOD_EVIDENCE_MISSING'
    | 'PERIOD_MISMATCH'
    | 'POSTED_WITHOUT_ENTRIES'
  >;
  checkedAt: string;
  checks: {
    entriesBalanced: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
    formula: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
    headerBalanced: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
    headerMatchesEntries: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
    monthlyPeriod: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
    postedEntries: 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';
  };
  discrepancyAmount: number;
  entryCount: number;
  entryCredit: number;
  entryDebit: number;
  formulaDelta?: number | null;
  state: 'BLOCKED' | 'CLEAR' | 'UNKNOWN';
};

export type AdminAccountingJournalEntry = {
  id: string;
  side: 'DEBIT' | 'CREDIT';
  accountCode: string;
  accountName: string;
  amount: number;
  currency: string;
  memo?: string | null;
  sourceType?: AdminAccountingJournalSourceType | null;
  sourceId?: string | null;
  metadata?: unknown;
  createdAt: string;
  bankReconciliationMatches?: Array<{
    id: string;
    sourceKey: string;
    bankTransactionId: string;
    paymentClearingEntryId?: string | null;
    amount: number;
    currency: string;
    status: AdminBankReconciliationStatus;
    matchedAt: string;
    bankTransaction?: {
      id: string;
      sourceKey: string;
      type: AdminCompanyBankTransactionType;
      amount: number;
      currency: string;
      occurredAt: string;
      transferRef?: string | null;
      status: AdminBankReconciliationStatus;
    } | null;
  }>;
};

export type AdminAccountingJournalBatchDetail = AdminAccountingJournalBatch & {
  payment?: {
    id: string;
    method: AdminPaymentMethod;
    status: AdminPaymentStatus;
    amount: number;
    currency: string;
    createdAt?: string;
  } | null;
  settlementSnapshot?: Pick<
    AdminBookingSettlementSnapshot,
    | 'id'
    | 'currency'
    | 'paymentMethod'
    | 'customerPaymentAmount'
    | 'partnerPayoutAmount'
    | 'platformFeeNetRevenue'
    | 'companyOutputVat'
    | 'partnerWithholdingTotal'
    | 'paymentFeePolicyVersionId'
    | 'paymentFeeRateBps'
    | 'paymentFeeFixedAmount'
    | 'paymentFeePayer'
    | 'paymentFeeTreatment'
    | 'paymentFeeRuleSnapshot'
    | 'paymentProcessingFee'
    | 'settlementStatus'
    | 'taxStatus'
    | 'monthlyPeriod'
    | 'postedAt'
    | 'closedAt'
  > | null;
  settlementReversalEntry?: {
    id: string;
    createdById?: string | null;
    originalSettlementSnapshotId: string;
    originalMonthlyPeriod: string;
    originalMonthlyClosingId: string;
    metadata?: unknown;
    paymentMethod: AdminPaymentMethod;
    customerPaymentAmount: number;
    partnerPayoutAmount: number;
    platformFeeNetRevenue: number;
    companyOutputVat: number;
    partnerWithholdingTotal: number;
    paymentProcessingFee: number;
    settlementStatus: AdminBookingSettlementStatus;
    taxStatus: AdminBookingSettlementTaxStatus;
    monthlyPeriod: string;
    occurredAt: string;
    reason?: string | null;
  } | null;
  entries: AdminAccountingJournalEntry[];
};

export type AdminAccountingJournalBatchSummary = {
  balancedCount: number;
  blockedAmount: number;
  blockedCount: number;
  clearCount: number;
  count: number;
  currency: string;
  draftCount: number;
  entryMismatchCount: number;
  formulaDeltaCount: number;
  generatedAt: string;
  headerEntryMismatchCount: number;
  headerMismatchCount: number;
  needsActionCount: number;
  oldestBlockerAt?: string | null;
  oldestDraftAt?: string | null;
  oldestUnbalancedAt?: string | null;
  postedCount: number;
  postedWithoutEntryCount: number;
  reversedCount: number;
  totalCredit: number;
  totalDebit: number;
  unbalancedAmount: number;
  unbalancedCount: number;
  unknownCount: number;
};

export type AdminBookingPaymentClearingEntry = {
  id: string;
  sourceKey: string;
  type: AdminBookingPaymentClearingEntryType;
  status: AdminBookingPaymentClearingStatus;
  bookingId: string;
  paymentId?: string | null;
  settlementSnapshotId?: string | null;
  settlementReversalEntryId?: string | null;
  amount: number;
  currency: string;
  occurredAt: string;
  clearedAt?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  booking?: { id: string; status: string; createdAt?: string; closedAt?: string | null } | null;
  payment?: {
    id?: string;
    method: AdminPaymentMethod;
    status: AdminPaymentStatus;
    amount: number;
    currency: string;
    providerRef?: string | null;
  } | null;
  bankReconciliationMatches?: Array<{ amount: number }>;
  matchedAmount?: number;
  remainingAmount?: number;
  reviewAssignment?: {
    assignedAt: string;
    assignedByAdminId: string | null;
    assignee?: AdminOperatorIdentity | null;
    assigneeAdminId: string;
    reason: string | null;
  };
  _count?: { bankReconciliationMatches?: number };
};

export type AdminBookingPaymentClearingEntryDetail = Omit<
  AdminBookingPaymentClearingEntry,
  'bankReconciliationMatches'
> & {
  assignmentHistory?: AdminFinanceReviewAssignmentHistoryEntry[];
  bankTransactionCandidates?: AdminCompanyBankTransaction[];
  expectedBankDirection?: AdminCompanyBankTransactionType | null;
  settlementSnapshot?: AdminAccountingJournalBatchDetail['settlementSnapshot'];
  settlementReversalEntry?: AdminAccountingJournalBatchDetail['settlementReversalEntry'];
  bankReconciliationMatches?: AdminPaymentClearingBankReconciliationMatch[];
};

export type AdminPaymentClearingBankReconciliationMatch = {
  id: string;
  sourceKey: string;
  accountingJournalEntryId?: string | null;
  bankTransactionId: string;
  amount: number;
  currency: string;
  status: AdminBankReconciliationStatus;
  matchedAt: string;
  notes?: string | null;
  accountingJournalEntry?: {
    id: string;
    batchId: string;
    accountCode: string;
    accountName: string;
  } | null;
  bankTransaction?: {
    id: string;
    sourceKey: string;
    type: AdminCompanyBankTransactionType;
    amount: number;
    currency: string;
    occurredAt: string;
    valueDate?: string | null;
    transferRef?: string | null;
    counterpartyName?: string | null;
    status: AdminBankReconciliationStatus;
  } | null;
};

export type AdminBookingPaymentClearingSummary = {
  amount: number;
  assignedCount: number;
  clearedCount: number;
  count: number;
  currency: string;
  oldestOpenAt?: string | null;
  oldestPartiallyClearedAt?: string | null;
  oldestUnassignedOpenAt?: string | null;
  over48hAmount: number;
  over48hCount: number;
  openAmount: number;
  openCount: number;
  partiallyClearedAmount: number;
  partiallyClearedCount: number;
  reversedCount: number;
  unassignedCount: number;
};

export type AdminBackgroundJobQueueStatus = 'ATTENTION' | 'HEALTHY' | 'RUNNING' | 'STALE';
export type AdminBackgroundJobReviewStatus = 'ACKNOWLEDGED' | 'NEW' | 'RESOLVED' | 'UNTRACKED';
export type AdminBackgroundJobHealthEventStatus = 'ALERTED' | 'RECOVERED';
export type AdminBackgroundJobRecurringIncidentStatus = 'OPEN' | 'RECOVERED';

export type AdminBackgroundJobReference = {
  id: string;
  kind: 'BOOKING' | 'NOTIFICATION' | 'PAYMENT' | 'REFUND';
};

export type AdminBackgroundJobHealth = {
  failedJobs: Array<{
    attemptsMade: number;
    execution: {
      attemptsMade: number;
      failedAt: string | null;
      lastStartedAt: string | null;
      maxAttempts: number;
      queuedAt: string | null;
    };
    failedAt: string | null;
    failure: string;
    id: string | null;
    name: string;
    queueName: string;
    reference: AdminBackgroundJobReference | null;
    review: {
      actor: { id: string; email?: string | null; fullName?: string | null } | null;
      reason: string | null;
      status: AdminBackgroundJobReviewStatus;
      updatedAt: string | null;
    };
  }>;
  failurePage: {
    complete: boolean;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    page: number;
    pageSize: number;
    scannedCount: number;
    totalCount: number | null;
  };
  generatedAt: string;
  healthEvents: Array<{
    actor: { id: string; email?: string | null; fullName?: string | null };
    detectedAt: string | null;
    event: AdminBackgroundJobHealthEventStatus;
    id: string;
    oldestOpenJobAt: string | null;
    oldestOpenJobState: string | null;
    openJobLagMs: number | null;
    queueName: string;
    recordedAt: string;
    staleAfterMs: number | null;
  }>;
  healthEventPage: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    page: number;
    pageSize: number;
    totalCount: number;
  };
  ok: boolean;
  queues: Array<{
    counts: {
      active: number;
      delayed: number;
      failed: number;
      paused: number;
      waiting: number;
    };
    expectedSchedulerId: string | null;
    expectedSchedulerPresent: boolean;
    label: string;
    lastCompletedAt: string | null;
    lastFailedAt: string | null;
    name: string;
    nextScheduledAt: string | null;
    oldestOpenJobAt: string | null;
    oldestOpenJobState: 'ACTIVE' | 'DELAYED' | 'WAITING' | null;
    openJobLagMs: number;
    schedulerCount: number;
    staleAfterMs: number;
    status: AdminBackgroundJobQueueStatus;
    workers: number;
  }>;
  recurringIncidents: Array<{
    actor: { id: string; email?: string | null; fullName?: string | null };
    firstFailureAt: string | null;
    firstFailureJobId: string | null;
    id: string;
    jobName: string;
    openedAt: string;
    queueName: string;
    recoveredAt: string | null;
    resolvedFailureCount: number;
    status: AdminBackgroundJobRecurringIncidentStatus;
  }>;
  recurringIncidentPage: {
    complete: boolean;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    page: number;
    pageSize: number;
    scannedCount: number;
    totalCount: number | null;
  };
  recurringIncidentSummary: {
    complete: boolean;
    openCount: number;
    recoveredCount: number;
    scannedCount: number;
  };
};

export type AdminBackgroundJobIncidentDetail = {
  failures: Array<{
    actor: { id: string; email?: string | null; fullName?: string | null };
    firstSeenAt: string;
    jobId: string;
    reason: string | null;
    status: AdminBackgroundJobReviewStatus;
    updatedAt: string;
  }>;
  incident: AdminBackgroundJobHealth['recurringIncidents'][number];
  page: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    page: number;
    pageSize: number;
    totalCount: number;
  };
};

export type AdminCompanyBankAccount = {
  id: string;
  name: string;
  bankName: string;
  accountNumberMasked?: string | null;
  accountNumberLast4?: string | null;
  currency: string;
  metadata?: unknown;
  status: string;
  updatedAt?: string;
};

export type AdminCompanyBankTransaction = {
  id: string;
  sourceKey: string;
  bankAccountId: string;
  type: AdminCompanyBankTransactionType;
  amount: number;
  currency: string;
  occurredAt: string;
  valueDate?: string | null;
  transferRef?: string | null;
  counterpartyName?: string | null;
  description?: string | null;
  status: AdminBankReconciliationStatus;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  reconciliationActiveMatchCount?: number;
  reconciliationMatchedAmount?: number;
  reconciliationRemainingAmount?: number;
  reconciliationReversedMatchCount?: number;
  reconciliationSources?: AdminBankReconciliationEvidenceSource[];
  _count?: { reconciliationMatches: number };
  bankAccount?: AdminCompanyBankAccount | null;
  reviewAssignment?: {
    assignedAt: string;
    assignedByAdminId: string | null;
    assignee?: AdminOperatorIdentity | null;
    assigneeAdminId: string;
    reason: string | null;
  };
  withdrawalCandidateSummary?: {
    candidateCount: number;
    confidence: 'NONE' | 'REVIEW' | 'STRONG';
    reviewCount: number;
    reviewAssignment?: AdminCompanyBankTransaction['reviewAssignment'];
    slaStatus: 'CURRENT' | 'OVER_24H' | 'OVER_48H';
    strongCount: number;
    waitingHours: number;
  };
};

export type AdminBankReconciliationMatch = {
  id: string;
  sourceKey: string;
  accountingJournalEntryId?: string | null;
  paymentClearingEntryId?: string | null;
  withdrawalRequestId?: string | null;
  payoutBatchId?: string | null;
  amount: number;
  currency: string;
  status: AdminBankReconciliationStatus;
  matchedAt: string;
  notes?: string | null;
  metadata?: unknown;
  accountingJournalEntry?:
    | (Omit<AdminAccountingJournalEntry, 'bankReconciliationMatches' | 'createdAt'> & {
        batchId: string;
      })
    | null;
  paymentClearingEntry?: Pick<
    AdminBookingPaymentClearingEntry,
    'id' | 'sourceKey' | 'type' | 'status' | 'bookingId' | 'amount' | 'currency' | 'occurredAt' | 'clearedAt'
  > | null;
  withdrawalRequest?: {
    id: string;
    providerProfileId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    transferRef?: string | null;
  } | null;
  payoutBatch?: {
    id: string;
    status: string;
    totalNetAmount: number;
    currency: string;
    createdAt: string;
    paidAt?: string | null;
    transferRef?: string | null;
  } | null;
};

export type AdminBankReconciliationTransactionDetail = AdminCompanyBankTransaction & {
  assignmentHistory?: AdminFinanceReviewAssignmentHistoryEntry[];
  creationEvidence?: {
    approvalAdminId?: string | null;
    approvalAdmin?: AdminOperatorIdentity | null;
    batchImportId?: string | null;
    csvRowNumber?: number | null;
    importedByAdminId: string;
    importedBy?: AdminOperatorIdentity | null;
    operatorReason?: string | null;
    sourceFileName?: string | null;
  } | null;
  ignoreEvidence?: {
    approvalAdminId?: string | null;
    approvalAdmin?: AdminOperatorIdentity | null;
    ignoredAt?: string | null;
    ignoredByAdminId?: string | null;
    ignoredBy?: AdminOperatorIdentity | null;
    reason: string;
  } | null;
  reconciliationMatches?: AdminBankReconciliationMatch[];
  preflight?: {
    activeMatchCount: number;
    actions: {
      createMatch: {
        allowed: boolean;
        blockers: Array<{ code: string; message: string }>;
      };
      ignore: {
        allowed: boolean;
        blockers: Array<{ code: string; message: string }>;
      };
      reverse: {
        allowedMatchIds: string[];
        blockers: Array<{ code: string; message: string }>;
      };
    };
    checkedForAdminId: string | null;
    matchedAmount: number;
    remainingAmount: number;
    requiresSeparateFinanceApprover: boolean;
  };
  paymentClearingCandidates?: Array<{
    amount: number;
    amountDelta: number;
    bookingId: string;
    bookingStatus: string;
    confidence: 'STRONG' | 'REVIEW';
    currency: string;
    customerLabel: string;
    dateDeltaDays: number;
    eligible: boolean;
    exclusionReasons: string[];
    expectedBankDirection?: AdminCompanyBankTransactionType | null;
    exactAmount: boolean;
    id: string;
    matchedAmount: number;
    occurredAt: string;
    originalAmount: number;
    paymentId?: string | null;
    paymentMethod?: string | null;
    paymentProviderRef?: string | null;
    paymentStatus?: string | null;
    reasons: string[];
    remainingAmount: number;
    sourceKey: string;
    status: AdminBookingPaymentClearingStatus;
    transferRefMatch: boolean;
    type: AdminBookingPaymentClearingEntryType;
  }>;
  paymentClearingCandidatePage?: {
    hasNext: boolean;
    hasPrevious: boolean;
    page: number;
    take: number;
  };
  withdrawalCandidates?: Array<{
    id: string;
    providerProfileId: string;
    providerLabel: string;
    amount: number;
    amountDelta: number;
    currency: string;
    createdAt: string;
    paidAt?: string | null;
    transferRef?: string | null;
    transferRefMatch: boolean;
    exactAmount: boolean;
    dateDeltaDays: number;
    confidence: 'STRONG' | 'REVIEW';
  }>;
};

export type AdminBankReconciliationSummary = {
  amount: number;
  assignedCount: number;
  count: number;
  currency: string;
  ignoredCount: number;
  matchedAmount: number;
  matchedCount: number;
  oldestPartiallyMatchedAt?: string | null;
  oldestUnassignedAt?: string | null;
  oldestUnmatchedAt?: string | null;
  openExposureAmount: number;
  partiallyMatchedAmount: number;
  partiallyMatchedCount: number;
  reversedCount: number;
  unassignedCount: number;
  unassignedOver48hAmount: number;
  unassignedOver48hCount: number;
  unmatchedAmount: number;
  unmatchedCount: number;
};

export type AdminFinanceReviewOwnerWorkloadSummary = {
  currency: string;
  openAmount: number;
  openCount: number;
  owners: Array<{
    assignee: { id: string; email: string | null; fullName: string | null };
    assigneeAdminId: string;
    oldestOccurredAt: string | null;
    openAmount: number;
    openCount: number;
    over48hAmount: number;
    over48hCount: number;
  }>;
  unassigned: {
    oldestOccurredAt: string | null;
    openAmount: number;
    openCount: number;
    over48hAmount: number;
    over48hCount: number;
  };
};

export type AdminBankReconciliationReviewOwnerSummary = AdminFinanceReviewOwnerWorkloadSummary;

export type AdminBankReconciliationEvidenceSourceSummary = {
  amount: number;
  count: number;
  currency: string;
  sources: Array<{
    amount: number;
    count: number;
    source: AdminBankReconciliationEvidenceSource;
  }>;
};

export type AdminBankReconciliationWithdrawalCandidateSummary = {
  assignedCount: number;
  assignments: Array<{
    assignee?: { id: string; email: string | null; fullName: string | null };
    assigneeAdminId: string;
    count: number;
    over24hCount: number;
    over48hCount: number;
  }>;
  currency: string;
  eligibleCount: number;
  noneAmount: number;
  noneCount: number;
  oldestReviewOccurredAt: string | null;
  oldestStrongOccurredAt: string | null;
  reviewAmount: number;
  reviewCount: number;
  reviewOver24hCount: number;
  reviewOver48hCount: number;
  strongAmount: number;
  strongCount: number;
  strongOver24hCount: number;
  strongOver48hCount: number;
  unassignedCount: number;
};

export type AdminCouponFinanceSummary = {
  bookingServiceAmount: number;
  companyCouponExpense: number;
  couponDiscountAmount: number;
  couponReviewFlagCount: number;
  couponSettlementCount: number;
  currency: string;
  customerPaidAmount: number;
  partnerFundedCouponAmount: number;
  platformFeeDiscountAmount: number;
  reversedCompanyCouponExpense: number;
  reversedCouponDiscountAmount: number;
  settlementBaseAmount: number;
};

export type AdminPartnerWithholdingTaxRow = {
  providerProfileId: string;
  partnerName: string;
  partnerPhone?: string | null;
  period: string;
  currency: string;
  completedBookingCount: number;
  postedSettlementCount?: number;
  reversalCount?: number;
  grossServiceRevenue: number;
  partnerPayoutTotal: number;
  partnerVatWithheldTotal: number;
  partnerPitWithheldTotal: number;
  totalPartnerTaxWithheld: number;
};

export type AdminPartnerWithholdingTaxSummary = {
  period: string;
  currency: string;
  partnerCountWithRevenue: number;
  taxableBookingCount: number;
  postedSettlementCount?: number;
  reversalCount?: number;
  grossServiceRevenue: number;
  partnerPayoutTotal: number;
  partnerVatWithheldTotal: number;
  partnerPitWithheldTotal: number;
  totalPartnerTaxWithheld: number;
};

export type AdminMonthlyTaxClosing = {
  id: string;
  period: string;
  currency: string;
  status: AdminMonthlyTaxClosingStatus;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
  partnerVatWithheldTotal: number;
  partnerPitWithheldTotal: number;
  partnerWithholdingTotal: number;
  paymentProcessingFeeTotal: number;
  cashDebtTotal: number;
  nonCashPartnerPayoutTotal: number;
  settlementCount: number;
  declaredAt?: string | null;
  paidAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  remittanceMetadata?: AdminMonthlyTaxClosingRemittanceMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMonthlyTaxClosingRemittanceMetadata = {
  transferRef?: string | null;
  channel?: string | null;
  evidenceUrl?: string | null;
  paidAt?: string | null;
  remittedByAdminId?: string | null;
  approvedByAdminId?: string | null;
};

export type AdminMonthlyTaxClosingPreflightBlockerCode =
  | 'NEGATIVE_WITHHOLDING'
  | 'NET_REVENUE_DELTA'
  | 'PARTNER_DEPOSIT_RECONCILIATION'
  | 'PAYOUT_BANK_OUTFLOW_RECONCILIATION'
  | 'PAYOUT_RETURN_INFLOW_RECONCILIATION'
  | 'PAYMENT_FEE_EVIDENCE'
  | 'POSTED_JOURNAL_DELTA'
  | 'RECONCILIATION_DELTA'
  | 'REMITTANCE_AMOUNT_MISMATCH'
  | 'REMITTANCE_EVIDENCE'
  | 'REMITTANCE_JOURNAL';

export type AdminMonthlyTaxClosingPreflight = {
  blockers: Array<{
    code: AdminMonthlyTaxClosingPreflightBlockerCode;
    message: string;
  }>;
  nextStatus: AdminMonthlyTaxClosingStatus | null;
  ready: boolean;
};

export type AdminMonthlyTaxClosingPeriodState =
  | AdminMonthlyTaxClosingStatus
  | 'FUTURE_PERIOD'
  | 'NOT_STARTED';

export type AdminMonthlyTaxClosingSummary = {
  generatedAt?: string | null;
  hasActivity?: boolean;
  id?: string | null;
  journalReconciliationIssueCount: number;
  monthlyClosingHistoryCount: number;
  period: string;
  periodState?: AdminMonthlyTaxClosingPeriodState;
  currency: string;
  status: AdminMonthlyTaxClosingStatus;
  settlementCount: number;
  reversalCount?: number;
  customerPaymentAmountTotal: number;
  partnerPayoutTotal: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
  partnerVatWithheldTotal: number;
  partnerPitWithheldTotal: number;
  partnerWithholdingTotal: number;
  paymentProcessingFeeTotal: number;
  paymentFeeReviewFlagCount: number;
  partnerDepositReconciliationOpenCount: number;
  partnerDepositReconciliationOpenAmount: number;
  payoutBankOutflowReconciliationOpenCount: number;
  payoutBankOutflowReconciliationOpenAmount: number;
  payoutReturnInflowReconciliationOpenCount: number;
  payoutReturnInflowReconciliationOpenAmount: number;
  couponSettlementCount: number;
  couponReversalCount?: number;
  couponDiscountAmountTotal: number;
  companyCouponExpenseTotal: number;
  partnerFundedCouponAmountTotal: number;
  platformFeeDiscountAmountTotal: number;
  couponReviewFlagCount: number;
  cashDebtTotal: number;
  nonCashPartnerPayoutTotal: number;
  partnerCountWithRevenue: number;
  openTaxCount: number;
  paidTaxCount: number;
  reconciliationDelta: number;
  netRevenueDelta: number;
  preflight?: AdminMonthlyTaxClosingPreflight;
  declaredAt?: string | null;
  paidAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  remittanceMetadata?: AdminMonthlyTaxClosingRemittanceMetadata | null;
};

export type AdminPlatformVatRateBreakdown = {
  category: 'REDUCED_8' | 'STANDARD_10' | 'MANUAL_REVIEW';
  platformVatRateBps: number;
  settlementCount: number;
  reversalCount: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
};

export type AdminPlatformVatSummary = {
  period: string;
  currency: string;
  settlementCount: number;
  reversalCount: number;
  manualReviewCount: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
  netRevenueDelta: number;
  rateBreakdown: AdminPlatformVatRateBreakdown[];
};

export type AdminPaymentFeeMethodBreakdown = {
  paymentMethod: AdminPaymentMethod;
  settlementCount: number;
  reversalCount: number;
  evidenceReviewCount: number;
  customerPaymentAmountTotal: number;
  evidenceCustomerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
  evidenceRecordedFeeTotal: number;
  remediationExpectedFeeTotal: number | null;
  remediationDelta: number | null;
};

export type AdminPaymentFeePayerBreakdown = {
  paymentFeePayer: 'HANDS' | 'CUSTOMER' | 'PARTNER' | 'SHARED';
  settlementCount: number;
  reversalCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
};

export type AdminPaymentFeeTreatmentBreakdown = {
  paymentFeeTreatment: 'OPERATING_EXPENSE' | 'PASS_THROUGH' | 'MANUAL_REVIEW';
  settlementCount: number;
  reversalCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
};

export type AdminPaymentFeeSummary = {
  period: string;
  currency: string;
  settlementCount: number;
  reversalCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
  byPaymentMethod: AdminPaymentFeeMethodBreakdown[];
  byPayer: AdminPaymentFeePayerBreakdown[];
  byTreatment: AdminPaymentFeeTreatmentBreakdown[];
  policyReadiness: {
    activePolicy: {
      id: string;
      name: string;
      status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
      effectiveFrom: string;
      effectiveTo?: string | null;
      rules: Array<{
        id: string;
        method: AdminPaymentMethod;
        feeType: 'RATE' | 'FIXED' | 'RATE_PLUS_FIXED';
        rateBps: number;
        fixedAmount: number;
        payer: 'HANDS' | 'CUSTOMER' | 'PARTNER' | 'SHARED';
        treatment: 'OPERATING_EXPENSE' | 'PASS_THROUGH' | 'MANUAL_REVIEW';
      }>;
    } | null;
    configuredMethods: AdminPaymentMethod[];
    missingMethods: AdminPaymentMethod[];
    status: 'MISSING_ACTIVE_POLICY' | 'MISSING_METHOD_RULES' | 'READY';
  };
  remediationPreview: {
    status: 'BLOCKED' | 'READY';
    policyVersionId: string | null;
    blockers: Array<{ code: string; message: string }>;
    evidenceReviewCount: number;
    evidenceCustomerPaymentAmountTotal: number;
    recordedFeeTotal: number;
    expectedFeeTotal: number | null;
    delta: number | null;
  };
};

export type AdminPaymentFeePolicyRule = {
  id: string;
  method: AdminPaymentMethod;
  feeType: 'RATE' | 'FIXED' | 'RATE_PLUS_FIXED';
  rateBps: number;
  fixedAmount: number;
  payer: 'HANDS' | 'CUSTOMER' | 'PARTNER' | 'SHARED';
  treatment: 'OPERATING_EXPENSE' | 'PASS_THROUGH' | 'MANUAL_REVIEW';
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminPaymentFeePolicyVersion = {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<AdminUser, 'id' | 'email' | 'fullName'> | null;
  rules: AdminPaymentFeePolicyRule[];
};

export type AdminPaymentFeePolicyPreflight = {
  policyId: string;
  policyStatus: AdminPaymentFeePolicyVersion['status'];
  sampleAmount: number;
  currency: string;
  readyForActivation: boolean;
  blockers: Array<{
    code: string;
    message: string;
    method?: AdminPaymentMethod;
  }>;
  coverage: {
    requiredMethods: number;
    configuredMethods: number;
    missingMethods: AdminPaymentMethod[];
    duplicateMethods: AdminPaymentMethod[];
    invalidMethods: AdminPaymentMethod[];
  };
  rules: Array<{
    method: AdminPaymentMethod;
    ruleCount: number;
    feeType: AdminPaymentFeePolicyRule['feeType'] | null;
    rateBps: number | null;
    fixedAmount: number | null;
    payer: AdminPaymentFeePolicyRule['payer'] | null;
    treatment: AdminPaymentFeePolicyRule['treatment'] | null;
    estimatedFeeAmount: number | null;
    status: 'READY' | 'MISSING' | 'DUPLICATE' | 'INVALID';
  }>;
};

export type AdminPaymentFeePolicyApproval = {
  policyId: string;
  status: 'NOT_REQUESTED' | 'REQUESTED' | 'REJECTED' | 'CANCELLED' | 'STALE' | 'ACTIVE';
  requestId: string | null;
  requestedAt: string | null;
  requestedBy: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  decisionAt: string | null;
  decidedBy: {
    id: string;
    fullName?: string | null;
    email?: string | null;
  } | null;
  reason: string | null;
};

export type AdminFinanceApprovalRefundRequest = {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  reason?: string | null;
  status: string;
  source?: string | null;
  requestedAt: string;
  requestedByAdminId?: string | null;
  paymentMethod: AdminPaymentMethod;
  paymentStatus: AdminPaymentStatus;
  bookingStatus: string;
  mismatchReason?: string | null;
  reviewState: 'BLOCKED' | 'READY' | 'STATE_MISMATCH';
  blockers: Array<{
    code: string;
    message: string;
  }>;
  canApprove: boolean;
  canReject: boolean;
  createdAt: string;
};

export type AdminFinanceApprovalQueue = {
  generatedAt: string;
  limit: number;
  pagination?: {
    hasNext: boolean;
    hasPrevious: boolean;
    page: number;
    review: string;
    totalCount: number;
  };
  currentApprover?: AdminOperatorIdentity | null;
  summary: {
    totalOpenCount: number;
    readyCount: number;
    blockedCount: number;
    staleCount: number;
    stateMismatchCount: number;
    paymentFeePolicyPendingCount: number;
    companyBankAccountPendingCount: number;
    withdrawalOpenCount: number;
    withdrawalRequestedCount: number;
    withdrawalReviewRequiredCount: number;
    withdrawalBankTransferPendingCount: number;
    withdrawalOpenAmount: number;
    withdrawalCurrency: string;
    walletAdjustmentLast7dCount: number;
    walletAdjustmentPendingCount: number;
    walletAdjustmentReadyCount: number;
    walletAdjustmentBlockedCount: number;
    walletAdjustmentStaleCount: number;
    partnerBankDepositPendingCount: number;
    partnerBankDepositLast7dCount: number;
    refundPendingCount: number;
    refundReadyCount: number;
    refundBlockedCount: number;
    refundStateMismatchCount: number;
    payoutBatchPendingCount: number;
    payoutBatchReadyCount: number;
    payoutBatchBlockedCount: number;
    withdrawalPaidCloseoutPendingCount: number;
    withdrawalPaidCloseoutReadyCount: number;
    withdrawalPaidCloseoutBlockedCount: number;
  };
  paymentFeePolicyRequests: Array<{
    requestId: string;
    policyId: string;
    policyName: string;
    effectiveFrom: string;
    policyUpdatedAt: string;
    reason?: string | null;
    requestedAt: string;
    requestedBy: {
      id: string;
      email?: string | null;
      fullName?: string | null;
    };
  }>;
  companyBankAccountRequests: Array<{
    id: string;
    name: string;
    bankName: string;
    accountNumberMasked?: string | null;
    accountNumberLast4?: string | null;
    currency: string;
    status: string;
    operation: 'CREATE' | 'UPDATE';
    operatorReason: string;
    requestedAt: string;
    requestId: string;
    requestedBy: {
      id: string;
      email?: string | null;
      fullName?: string | null;
    };
    proposed: {
      name: string;
      bankName: string;
      accountNumberMasked?: string | null;
      accountNumberLast4?: string | null;
      currency: string;
      status: string;
    };
    reviewState: 'BLOCKED' | 'READY';
  }>;
  withdrawalRequests: Array<{
    id: string;
    providerProfileId: string;
    partnerName: string;
    amount: number;
    currency: string;
    status: AdminProviderWalletWithdrawalRequestStatus;
    transferRef?: string | null;
    hasBankAccount: boolean;
    createdAt: string;
    updatedAt: string;
    reviewState: 'BLOCKED' | 'READY' | 'REVIEW';
    preflight?: AdminProviderWalletWithdrawalPreflight;
  }>;
  walletAdjustmentRequests: AdminManualWalletAdjustmentRequest[];
  walletAdjustmentEvidence: {
    last7dCount: number;
    pendingQueueSupported: boolean;
  };
  partnerBankDepositRequests: Array<{
    id: string;
    providerProfileId: string;
    partnerName: string;
    amount: number;
    currency: string;
    bankTransactionId: string;
    depositDate: string;
    bankAccount?: string | null;
    attachmentFileId?: string | null;
    attachmentUrl?: string | null;
    notes?: string | null;
    requestedBeforeBalance: number;
    requestedAfterBalance: number;
    requestedReceivableRecovery: number;
    requestedWalletLiabilityIncrease: number;
    preflight?: AdminFinanceApprovalRequestPreflight;
    createdAt: string;
    requestedBy: {
      id: string;
      email?: string | null;
      fullName?: string | null;
    };
  }>;
  refundRequests: AdminFinanceApprovalRefundRequest[];
  refundFocus?: {
    request: AdminFinanceApprovalRefundRequest | null;
    requestId: string;
    state: 'FOUND' | 'NOT_FOUND_OR_CHANGED';
  } | null;
  payoutBatchRequests: Array<{
    id: string;
    providerProfileId: string;
    partnerName: string;
    totalNetAmount: number;
    currency: string;
    status: string;
    transferRef?: string | null;
    createdAt: string;
    paidCloseoutRequestedByAdminId?: string | null;
    paidCloseoutRequestedBy?: AdminOperatorIdentity | null;
    reviewState: 'BLOCKED' | 'READY';
    preflight?: AdminPayoutBatchPreflight;
  }>;
};

export type AdminFinanceOverviewWalletSummary = {
  currency: string;
  customerWalletAccountCount: number;
  customerWalletLiabilityAmount: number;
  partnerPositiveWalletAccountCount: number;
  partnerWalletLiabilityAmount: number;
  partnerNegativeWalletAccountCount: number;
  negativePartnerWalletAmount: number;
};

export type AdminFinanceOverviewAmountSummary = {
  currency: string;
  refundPendingCount: number;
  refundPendingAmount: number;
  refundCompletedCount: number;
  refundCompletedAmount: number;
  paymentFailedCount: number;
  paymentFailedAmount: number;
};

export type AdminFinanceOverviewReviewSlaSummary = {
  assignedCount?: number;
  assignments?: Array<{
    assignee?: AdminOperatorIdentity | null;
    assigneeAdminId: string;
    count: number;
  }>;
  oldestOpenAt?: string | null;
  open48To72Count: number;
  openOverdueCount: number;
  openOver72Count: number;
  resolvedInRangeCount: number;
  unassignedCount?: number;
};

export type AdminFinanceOverviewPartnerDepositQueueSummary = {
  assignedCount: number;
  assignments: Array<{
    assignee?: AdminOperatorIdentity | null;
    assigneeAdminId: string;
    count: number;
  }>;
  currency: string;
  oldestOpenAt: string | null;
  openAmount: number;
  openCount: number;
  unassignedCount: number;
};

export type AdminFinanceOverviewTaxProfileSummary = {
  actionRequiredCount: number;
  approvedCount: number;
  missingCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  relevantPartnerCount: number;
};

export type AdminFinanceOverviewComparisonMetric = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

export type AdminFinanceOverviewComparisonSummary = {
  previousRangeLabel: string;
  settlementCount: AdminFinanceOverviewComparisonMetric;
  customerPaymentAmount: AdminFinanceOverviewComparisonMetric;
  partnerPayoutAmount: AdminFinanceOverviewComparisonMetric;
  platformFeeNetRevenue: AdminFinanceOverviewComparisonMetric;
};

export type AdminCompanyBankAccountApprovalSummary = {
  oldestRequestedAt: string | null;
  over48hCount: number;
  pendingCount: number;
};

export type AdminFinanceOverviewSummary = {
  generatedAt: string;
  range: string;
  period: string;
  amountSummary: AdminFinanceOverviewAmountSummary;
  bankSummary: AdminBankReconciliationSummary;
  bankWithdrawalCandidateSummary: AdminBankReconciliationWithdrawalCandidateSummary;
  cashSummary: AdminCashSettlementSummary | null;
  clearingSummary: AdminBookingPaymentClearingSummary;
  comparisonSummary?: AdminFinanceOverviewComparisonSummary;
  companyBankAccountApprovalSummary?: AdminCompanyBankAccountApprovalSummary;
  couponSummary: AdminCouponFinanceSummary;
  earningsSummary: AdminEarningSummary | null;
  financeReviewSlaSummary?: AdminFinanceOverviewReviewSlaSummary;
  generalLedgerSummary: AdminAccountingJournalBatchSummary;
  monthlyClosingSummary: AdminMonthlyTaxClosingSummary;
  partnerDepositQueueSummary?: AdminFinanceOverviewPartnerDepositQueueSummary;
  partnerWithholdingSummary: AdminPartnerWithholdingTaxSummary;
  paymentFeeSummary: AdminPaymentFeeSummary | null;
  paymentSummary: AdminPaymentSummary | null;
  payoutSummary: AdminPayoutBatchSummary | null;
  refundSummary: AdminRefundSummary | null;
  settlementSummary: AdminBookingSettlementSnapshotSummary;
  taxProfileSummary?: AdminFinanceOverviewTaxProfileSummary;
  walletSummary: AdminFinanceOverviewWalletSummary;
  withdrawalSummary: AdminProviderWalletWithdrawalRequestSummary;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  target: string;
  metadata?: unknown;
  createdAt: string;
  actor?: { id?: string; email?: string | null; phone?: string; fullName?: string | null };
};

export type AdminAuditLogPage = {
  items: AdminAuditLog[];
  skip: number;
  take: number;
  totalCount: number;
};

export type AdminShiftHandoffOperator = {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
};

export type AdminHandoffPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
};

export type AdminShiftHandoff = {
  id: string;
  acknowledgedAt: string | null;
  acknowledgedBy: AdminShiftHandoffOperator | null;
  createdAt: string;
  followUpOwner?: string | null;
  followUpOwnerId?: string | null;
  incomingOperator: string;
  incomingOperatorId?: string | null;
  note: string;
  outgoingOperator: AdminShiftHandoffOperator;
  outgoingShift: string;
  owner: string;
  ownerId?: string | null;
  unresolvedCases?: Array<{ caseId: string; queueKey: string }>;
  unresolvedCaseIds: string[];
};

export type AdminShiftHandoffPage = {
  items: AdminShiftHandoff[];
  openCount: number;
  pagination?: AdminHandoffPagination;
  totalCount: number;
};

export type AdminOperationsHandoffOpenCase = {
  ageMinutes: number;
  amount: number;
  caseId: string;
  currency: string | null;
  href: string;
  occurredAt: string;
  overdue: boolean;
  owner: string | null;
  priority: number;
  queueKey: string;
  queueLabel: string;
  requiredCategory: string;
  slaMinutes: number;
  state: string;
};

export type AdminOperationsHandoffOpenCasePage = {
  items: AdminOperationsHandoffOpenCase[];
  openCount: number;
  pagination: AdminHandoffPagination;
};

export type AdminOperationsHandoffOperator = AdminShiftHandoffOperator & {
  categories: string[];
  queueKeys: string[];
  roles: string[];
};

export type AdminOperationalPolicySetting = {
  key: string;
  category: string;
  label: string;
  description?: string | null;
  value: number | string | boolean;
  recommendedValue?: number | string | boolean | null;
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  options?: Array<{ value: string; label: string; tradeoff: string }> | null;
  requiresRestart?: boolean;
  enforced: boolean;
  updatedAt?: string | null;
  updatedBy?: { phone?: string | null; fullName?: string | null } | null;
};

type AdminNotificationPushDevice = {
  id?: string;
  role?: string;
  platform?: string;
  enabled?: boolean;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminNotification = {
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  dataScope?: 'production' | 'synthetic' | 'unknown';
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  lastEventAt?: string | null;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  sourceUpdatedAt?: string | null;
  readAt?: string | null;
  data?: unknown;
  user?: {
    id?: string;
    phone?: string;
    fullName?: string | null;
    roles?: string[];
    customerProfile?: { id: string } | null;
    providerProfile?: { id: string; displayName?: string | null; status?: string | null } | null;
    pushDevices?: AdminNotificationPushDevice[];
  };
  deliveries?: Array<{
    id?: string;
    pushDeviceId?: string | null;
    provider: string;
    status: string;
    attemptedAt: string;
    response?: {
      failureCode?: string;
      message?: string;
      reason?: string;
      statusCode?: number;
      body?: unknown;
    } | null;
    pushDevice?: AdminNotificationPushDevice;
  }>;
};

export type AdminOperationsHandoffActivityReason =
  | 'BOOKING_STATE'
  | 'FINANCE_UNPAID'
  | 'MISSING_SETTLEMENT'
  | 'NOTIFICATION_FAILURE'
  | 'PAYMENT'
  | 'RECORD';

export type AdminOperationsHandoffActivityEvent = (
  | {
      id: string;
      kind: 'BOOKING';
      occurredAt: string;
      booking: AdminBooking;
    }
  | {
      id: string;
      kind: 'CHAT';
      occurredAt: string;
      message: {
        id: string;
        body: string;
        createdAt: string;
        sender?: {
          id: string;
          fullName?: string | null;
          phone?: string;
          roles?: string[];
        };
        chatRoom: {
          id: string;
          bookingId: string;
        };
      };
    }
  | {
      id: string;
      kind: 'AUDIT';
      occurredAt: string;
      auditLog: AdminAuditLog;
    }
  | {
      id: string;
      kind: 'NOTIFICATION';
      occurredAt: string;
      notification: AdminNotification;
    }
  | {
      id: string;
      kind: 'FINANCE';
      occurredAt: string;
      earning: AdminEarning;
    }
) & {
  reason: AdminOperationsHandoffActivityReason;
};

export type AdminOperationsHandoffActivityPage = {
  backlogCounts: {
    all: number;
    current: number;
    legacy: number;
  };
  items: AdminOperationsHandoffActivityEvent[];
  over24hCounts: {
    all: number;
    bookingState: number;
    financeUnpaid: number;
    missingSettlement: number;
    notificationFailure: number;
    payment: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRows: number;
  };
  reasonCounts: {
    all: number;
    bookingState: number;
    financeUnpaid: number;
    missingSettlement: number;
    notificationFailure: number;
    payment: number;
  };
};

export type AdminNotificationBoardSummary = {
  awaitingWorker?: number;
  currentDeliveryGaps?: number;
  currentFailed?: number;
  currentNoPushPathNotificationCount?: number;
  currentNoPushPathRecipientCount?: number;
  currentStaleRouteNotifications?: number;
  dataClass?: 'live' | 'backlog' | 'anomaly' | 'test';
  deliveryGaps?: number;
  deliveryIncidentHistoricalCutoffHours?: number;
  deliveryIncidentNotificationCount?: number;
  deliveryIncidentWindowMinutes?: number;
  disabledDevices?: number;
  disabledDeviceUsers?: number;
  failed?: number;
  failedAttempts?: number;
  fcmDeliveries?: number;
  financeReviewOwnerSummary?: Array<{
    count: number;
    ownerAdminId: string | null;
  }>;
  generatedAt: string;
  lastEventAt?: string | null;
  inAppDeliveries?: number;
  historicalDeliveryIncidentCount?: number;
  historicalDeliveryOldestAt?: string | null;
  historicalDeliveryGaps?: number;
  historicalFailed?: number;
  historicalNoPushPathNotificationCount?: number;
  historicalNoPushPathRecipientCount?: number;
  historicalStaleRouteNotifications?: number;
  legacySystemIncidentCount?: number;
  needsRetry?: number;
  noShow?: number;
  noPushPath?: number;
  noPushPathNotificationCount?: number;
  noPushPathRecipientCount?: number;
  oldestFailedAt?: string | null;
  openDeliveryIncidentCount?: number;
  openSystemIncidentCount?: number;
  partnerAlertCount?: number;
  payoutSetup?: number;
  pending?: number;
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
  recoveredSystemIncidentCount?: number;
  reviewedSystemIncidentCount?: number;
  sent?: number;
  scopeEnd?: string | null;
  scopeStart?: string | null;
  skipped?: number;
  staleDevices?: number;
  staleDeviceUsers?: number;
  staleRouteNotifications?: number;
  systemIncidentCount?: number;
  systemIncidentNotificationCount?: number;
  systemIncidentSourceSummaryComplete?: boolean;
  systemIncidentSourceTotalCount?: number;
  totalCount: number;
  productionDataCount?: number;
  selectedDataScope?: 'production' | 'synthetic' | 'unknown';
  syntheticDataCount?: number;
  unknownDataCount?: number;
  unattempted?: number;
  sourceUpdatedAt?: string | null;
};

export type AdminNotificationTemplateTranslation = {
  id: string;
  templateId: string;
  locale: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotificationTemplate = {
  id: string;
  key: string;
  audience: string;
  channel: string;
  description?: string | null;
  variables?: unknown;
  requiredVariables?: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  translations: AdminNotificationTemplateTranslation[];
};

export type AdminPushCampaign = {
  id: string;
  targetRole: string;
  targetUserId?: string | null;
  locale?: string | null;
  title: string;
  body: string;
  status: string;
  recipientCount: number;
  notificationCount: number;
  createdById: string;
  metadata?: unknown;
  createdAt: string;
  sentAt?: string | null;
  recipients?: Array<{
    id: string;
    campaignId: string;
    userId: string;
    notificationId?: string | null;
    status: string;
    createdAt: string;
  }>;
};

export type AdminPushCampaignSummary = {
  generatedAt: string;
  totalCount: number;
  totalNotifications: number;
  totalRecipients: number;
};

export type AdminPushCampaignPreview = {
  targetRole: 'CUSTOMER' | 'PROVIDER';
  targetUserId?: string | null;
  targetSegment?: string;
  appDestination?: string;
  recipientCount: number;
  sendLimit: number;
  willSendCount: number;
  capped: boolean;
  sampleRecipients: Array<{
    id: string;
    phone: string;
    fullName?: string | null;
    roles: string[];
    customerProfile?: { id: string } | null;
    providerProfile?: { id: string; displayName?: string | null; status?: string | null } | null;
    pushDevices?: Array<{ id: string; platform: string; role: string; updatedAt: string }>;
  }>;
};

export type AdminExternalReadiness = {
  ok: boolean;
  currentStageOk?: boolean;
  productionE2EOk?: boolean;
  blockingCategories?: string[];
  deferredCategories?: string[];
  currentStageCommands?: string[];
  deferredCommands?: string[];
  timestamp: string;
  checks: Array<{
    name: string;
    category: string;
    status: 'READY' | 'PARTIAL' | 'BLOCKED';
    configured: string[];
    missing: string[];
    invalid?: string[];
    detail: string;
    scope?: 'CURRENT_STAGE' | 'DEFERRED';
    deferred?: boolean;
    operatorAction?: string;
    commands?: string[];
    secretSafe?: boolean;
  }>;
};

export type AdminVietnamOverviewRegion = {
  regionCode: string;
  regionName: string;
  shortName: string;
  customerCount: number;
  activeCustomerCount: number;
  customersSeenIn30DaysCount: number;
  partnerCount: number;
  onlinePartnerCount: number;
  readyPartnerCount: number;
  busyPartnerCount: number;
  offlinePartnerCount: number;
  stalePartnerCount: number;
  activeBookingCount: number;
  needsSupplyNowCount: number;
  assignedOrInServiceCount: number;
  staleActiveRecordCount: number;
  supplyShortageCount: number;
  completedBookingCount: number;
  cancellationCount: number;
  revenueAmount: number;
  paidVolumeAvailable: boolean;
  currency: string;
};

export type AdminVietnamOverviewPointKind =
  | 'customers'
  | 'active'
  | 'partners'
  | 'online'
  | 'busy-partners'
  | 'offline-partners'
  | 'stale-partners'
  | 'needs-supply'
  | 'assigned-bookings'
  | 'stale-bookings'
  | 'done'
  | 'cancel';

export type AdminVietnamOverviewRealtimePointKind = Extract<
  AdminVietnamOverviewPointKind,
  | 'customers'
  | 'active'
  | 'online'
  | 'busy-partners'
  | 'offline-partners'
  | 'stale-partners'
  | 'needs-supply'
  | 'assigned-bookings'
  | 'stale-bookings'
>;

export type AdminVietnamOverviewPoint = {
  id: string;
  kind: AdminVietnamOverviewPointKind;
  label: string;
  latitude: number;
  longitude: number;
  occurredAt: string | null;
  activityAt?: string | null;
  createdAt?: string | null;
  locationOccurredAt?: string | null;
  regionCode: string;
  source: string;
  addressText?: string | null;
  bookingId?: string | null;
  customerProfileId?: string | null;
  providerProfileId?: string | null;
  status?: string | null;
};

export type AdminVietnamOverviewSampleSource = {
  key: 'customers' | 'partners' | 'period-bookings' | 'active-bookings';
  mappedPointCount: number;
  returnedCount: number;
  total: number | null;
  totalUnavailable: boolean;
  truncated: boolean;
};

export type AdminVietnamOverviewRealtimePoint = AdminVietnamOverviewPoint & {
  kind: AdminVietnamOverviewRealtimePointKind;
};

export type AdminVietnamOverview = {
  generatedAt: string;
  refreshMode: 'manual';
  refreshSeconds: number;
  source: 'stored-address-aggregates';
  timeZone: 'Asia/Ho_Chi_Minh';
  range: 'today' | 'yesterday' | '7d' | '30d' | 'all';
  rangeLabel: string;
  windowStartAt: string | null;
  windowEndAt: string | null;
  regionalSampleLimit?: number;
  partnerLocationFreshnessMinutes: number;
  sample: {
    limitPerSource: number;
    sources: AdminVietnamOverviewSampleSource[];
  };
  totals: {
    customerCount: number;
    activeCustomerCount: number;
    customersSeenIn30DaysCount: number;
    partnerCount: number;
    onlinePartnerCount: number;
    readyPartnerCount: number;
    busyPartnerCount: number;
    offlinePartnerCount: number;
    stalePartnerCount: number;
    activeBookingCount: number;
    needsSupplyNowCount: number;
    assignedOrInServiceCount: number;
    staleActiveRecordCount: number;
    supplyShortageCount: number;
    completedBookingCount: number;
    cancellationCount: number;
    revenueAmount: number;
    paidVolumeAvailable: boolean;
    currency: string;
  };
  regions: AdminVietnamOverviewRegion[];
  points: AdminVietnamOverviewPoint[];
  realtimePoints?: AdminVietnamOverviewRealtimePoint[];
};

export type AdminVietnamOverviewSummary = Omit<AdminVietnamOverview, 'points' | 'realtimePoints'>;

export type AdminVietnamOverviewRealtimePointFeed = Pick<
  AdminVietnamOverview,
  | 'generatedAt'
  | 'refreshMode'
  | 'refreshSeconds'
  | 'source'
  | 'timeZone'
  | 'range'
  | 'rangeLabel'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'partnerLocationFreshnessMinutes'
  | 'sample'
  | 'totals'
  | 'regions'
> & {
  realtimePoints: AdminVietnamOverviewRealtimePoint[];
};

export type AdminCalendarEvent = {
  allDay: boolean;
  authorId: string;
  authorName: string;
  createdAt?: string;
  description: string;
  end: string;
  id: string;
  location: string;
  start: string;
  tags: string[];
  title: string;
  updatedAt?: string;
  updatedById?: string | null;
  url: string;
};

export async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export type AdminGetResult<T> = {
  data: T;
  ok: boolean;
  status: number | null;
};

export type AdminGetFreshness = 'live' | 'aggregate' | 'stable';

export type AdminGetOptions = {
  freshness?: AdminGetFreshness;
  revalidateSeconds?: number;
  tags?: string[];
};

export async function adminGetResult<T>(
  path: string,
  fallback: T,
  options: AdminGetOptions = {},
): Promise<AdminGetResult<T>> {
  try {
    const token = await getAdminAccessToken();
    const freshness = options.freshness ?? 'live';
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { authorization: `Bearer ${token}` },
      ...(freshness === 'live'
        ? { cache: 'no-store' as const }
        : {
            next: {
              revalidate: options.revalidateSeconds ?? (freshness === 'aggregate' ? 30 : 600),
              ...(options.tags?.length ? { tags: options.tags } : {}),
            },
          }),
    });

    if (!response.ok) {
      return { data: fallback, ok: false, status: response.status };
    }

    return {
      data: (await response.json()) as T,
      ok: true,
      status: response.status,
    };
  } catch {
    return { data: fallback, ok: false, status: null };
  }
}

export async function adminGet<T>(path: string, fallback: T, options?: AdminGetOptions): Promise<T> {
  return (await adminGetResult(path, fallback, options)).data;
}

export async function adminPost<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const operatorContext = await verifyAdminOperatorWriteAccess('POST', path, 'fallback');
    if (operatorContext.denied) {
      return fallback;
    }

    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });

    if (!response.ok) {
      await recordAdminOperatorActivityForIdentity(
        operatorContext.operatorIdentity,
        'admin_web.action_failed',
        `POST ${path}`,
        {
          category: operatorContext.category,
          status: response.status,
        },
      );
      return fallback;
    }

    if (path !== '/admin/operator-activity') {
      await recordAdminOperatorActivityForIdentity(
        operatorContext.operatorIdentity,
        'admin_web.action',
        `POST ${path}`,
        {
          category: operatorContext.category,
          status: response.status,
        },
      );
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function adminPostOrThrow<T>(path: string, body: unknown): Promise<T> {
  return adminJsonRequestOrThrow<T>('POST', path, body);
}

export async function adminPatchOrThrow<T>(path: string, body: unknown): Promise<T> {
  return adminJsonRequestOrThrow<T>('PATCH', path, body);
}

export async function adminDeleteOrThrow<T>(path: string): Promise<T> {
  return adminJsonRequestOrThrow<T>('DELETE', path);
}

export async function adminDeleteWithBodyOrThrow<T>(path: string, body: unknown): Promise<T> {
  return adminJsonRequestOrThrow<T>('DELETE', path, body);
}

export async function adminPatch<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const operatorContext = await verifyAdminOperatorWriteAccess('PATCH', path, 'fallback');
    if (operatorContext.denied) {
      return fallback;
    }

    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });

    if (!response.ok) {
      await recordAdminOperatorActivityForIdentity(
        operatorContext.operatorIdentity,
        'admin_web.action_failed',
        `PATCH ${path}`,
        {
          category: operatorContext.category,
          status: response.status,
        },
      );
      return fallback;
    }

    await recordAdminOperatorActivityForIdentity(
      operatorContext.operatorIdentity,
      'admin_web.action',
      `PATCH ${path}`,
      {
        category: operatorContext.category,
        status: response.status,
      },
    );

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function adminDelete<T>(path: string, fallback: T): Promise<T> {
  try {
    const operatorContext = await verifyAdminOperatorWriteAccess('DELETE', path, 'fallback');
    if (operatorContext.denied) {
      return fallback;
    }

    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      await recordAdminOperatorActivityForIdentity(
        operatorContext.operatorIdentity,
        'admin_web.action_failed',
        `DELETE ${path}`,
        {
          category: operatorContext.category,
          status: response.status,
        },
      );
      return fallback;
    }

    await recordAdminOperatorActivityForIdentity(
      operatorContext.operatorIdentity,
      'admin_web.action',
      `DELETE ${path}`,
      {
        category: operatorContext.category,
        status: response.status,
      },
    );

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function adminRealtimeSocketBaseUrl() {
  const explicitSocketBaseUrl = process.env.ADMIN_SOCKET_BASE_URL;
  const fallbackSocketBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return (explicitSocketBaseUrl ?? fallbackSocketBaseUrl).replace(/\/$/, '');
}

export const getAdminAccessToken = cache(async function getAdminAccessToken() {
  const operatorIdentity = await currentAdminWebSessionIdentity();
  if (!operatorIdentity) {
    throw new Error('Admin Web session is required for Admin API access');
  }
  return createAdminWebApiToken(operatorIdentity);
});

export class AdminApiRequestError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(`Admin API ${method} ${path} failed with ${status}`);
    this.name = 'AdminApiRequestError';
  }
}

export function isAdminApiAuthError(error: unknown) {
  if (error instanceof AdminOperatorAccessDeniedError) {
    return true;
  }
  if (error instanceof AdminApiRequestError) {
    return error.status === 401 || error.status === 403;
  }

  return error instanceof Error && error.message.startsWith('Admin Web session');
}

export class AdminOperatorAccessDeniedError extends Error {
  constructor(readonly category: AdminOperatorPermissionCategory) {
    super(`Admin operator access denied for ${category}`);
    this.name = 'AdminOperatorAccessDeniedError';
  }
}

export class AdminOperatorUnmappedWriteAccessError extends Error {
  constructor(readonly path: string) {
    super(`Admin operator write access denied for unmapped route: ${path}`);
    this.name = 'AdminOperatorUnmappedWriteAccessError';
  }
}

async function adminJsonRequestOrThrow<T>(
  method: 'DELETE' | 'PATCH' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const operatorContext = await verifyAdminOperatorWriteAccess(method, path, 'throw');

  const token = await getAdminAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(operatorContext.operatorIdentity
        ? { 'x-hands-admin-operator-identity': operatorContext.operatorIdentity }
        : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body ?? {}) }),
    cache: 'no-store',
  });

  if (!response.ok) {
    await recordAdminOperatorActivityForIdentity(
      operatorContext.operatorIdentity,
      'admin_web.action_failed',
      `${method} ${path}`,
      {
        category: operatorContext.category,
        status: response.status,
      },
    );
    const errorPayload = await response.json().catch(() => undefined);
    throw new AdminApiRequestError(method, path, response.status, errorPayload);
  }

  await recordAdminOperatorActivityForIdentity(
    operatorContext.operatorIdentity,
    'admin_web.action',
    `${method} ${path}`,
    {
      category: operatorContext.category,
      status: response.status,
    },
  );

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function verifyAdminOperatorWriteAccess(
  method: 'DELETE' | 'PATCH' | 'POST',
  path: string,
  mode: 'fallback' | 'throw',
) {
  const operatorIdentity = await currentAdminWebSessionIdentity();
  const category = adminOperatorCategoryForAdminApiPath(method, path);
  const allowlistReason = adminOperatorUncategorizedWriteApiAllowlistReason(method, path);
  if (!operatorIdentity || allowlistReason) {
    return { category, denied: false, operatorIdentity };
  }

  if (!category) {
    await recordAdminOperatorActivityForIdentity(
      operatorIdentity,
      'admin_web.action_denied',
      `${method} ${path}`,
      {
        category: null,
        reason: 'unmapped_admin_write',
      },
    );
    if (mode === 'throw') {
      throw new AdminOperatorUnmappedWriteAccessError(path);
    }

    return { category, denied: true, operatorIdentity };
  }

  const access = await fetchAdminOperatorAccess(operatorIdentity);
  if (hasAdminOperatorCategory(access, category)) {
    return { category, denied: false, operatorIdentity };
  }

  await recordAdminOperatorActivityForIdentity(
    operatorIdentity,
    'admin_web.action_denied',
    `${method} ${path}`,
    {
      category,
    },
  );
  if (mode === 'throw') {
    throw new AdminOperatorAccessDeniedError(category);
  }

  return { category, denied: true, operatorIdentity };
}

async function currentAdminWebSessionIdentity() {
  try {
    const headerList = await headers();
    const session = getAdminWebSession({ headers: headerList });

    return session?.sub ?? null;
  } catch {
    return null;
  }
}

async function fetchAdminOperatorAccess(identity: string) {
  const token = await getAdminAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/admin/users/admin-operator-access?identity=${encodeURIComponent(identity)}`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return resolveEnvMasterAdminAccess(identity, null);
  }

  const responseText = await response.text();
  const access = responseText.trim() ? (JSON.parse(responseText) as AdminOperatorAccess | null) : null;
  return resolveEnvMasterAdminAccess(identity, access);
}

async function recordAdminOperatorActivityForIdentity(
  operatorIdentity: string | null,
  action: string,
  target: string,
  metadata: Record<string, unknown>,
) {
  if (!operatorIdentity) {
    return;
  }

  try {
    const token = await getAdminAccessToken();
    await fetch(`${API_BASE_URL}/admin/operator-activity`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action,
        metadata,
        operatorIdentity,
        target,
      }),
      cache: 'no-store',
    });
  } catch {
    // Activity logging must never make a successful admin action fail.
  }
}
