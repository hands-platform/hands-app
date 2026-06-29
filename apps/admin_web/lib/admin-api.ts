const API_BASE_URL = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN_REFRESH_SKEW_MS = 60_000;

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
export type AdminPaymentMethod = 'MOMO' | 'VNPAY' | 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOMER_WALLET' | 'MANUAL';
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
  fullName?: string | null;
  roles: string[];
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
  walletLedgerReference?: string | null;
};

export type AdminReferralRewardQueueSummary = {
  amount: number;
  count: number;
  reward: 'all' | 'available' | 'credited' | 'pending' | 'held';
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
  generatedAt: string;
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

export type AdminUsageOverviewRange = 'today' | 'yesterday' | '7d' | 'month' | 'all';

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
  completedBookingCount: number;
};

export type AdminUsageOverview = {
  generatedAt: string;
  refreshSeconds: number;
  source: 'stored-usage-aggregates';
  range: AdminUsageOverviewRange;
  rangeLabel: string;
  windowStartAt?: string | null;
  windowEndAt?: string | null;
  totals: {
    customerSessionCount: number;
    completedBookingCount: number;
    partnerProfileViewCount: number;
    partnerBookingRequestCount: number;
  };
  customerUsage: {
    mostActiveCustomers: AdminUsageOverviewRankRow[];
    completedBookingCustomers: AdminUsageOverviewRankRow[];
  };
  regionUsage: AdminUsageOverviewRegionRow[];
  partnerUsage: {
    mostViewedPartners: AdminUsageOverviewRankRow[];
    requestedPartners: AdminUsageOverviewRankRow[];
    completedPartners: AdminUsageOverviewRankRow[];
  };
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
  totals: AdminMarketingStats;
  funnel: AdminMarketingFunnelStep[];
  bySource: AdminMarketingDimensionRow[];
  byPlatform: AdminMarketingDimensionRow[];
  byRegion: AdminMarketingDimensionRow[];
  byCampaign: AdminMarketingDimensionRow[];
  topInsights: string[];
  dataGaps: string[];
};

export type AdminMarketingSummary = Omit<
  AdminMarketingOverview,
  'bySource' | 'byPlatform' | 'byRegion' | 'byCampaign'
>;

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

export type AdminCustomer = {
  id: string;
  userId: string;
  gender?: string | null;
  addresses?: unknown;
  activitySummary?: {
    activeBookingCount?: number;
    adminClosedBookingCount?: number;
    bookingCount: number;
    closedBookingCount?: number;
    completedBookingCount: number;
    customerClosedBookingCount?: number;
    lastBookingAt?: string | null;
    lastCompletedBookingAt?: string | null;
    noShowBookingCount?: number;
    partnerClosedBookingCount?: number;
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

export type AdminCustomerSummary = {
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
};

export type AdminCustomerDetail = AdminCustomer & {
  bookings?: AdminBookingDetail[];
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
  experienceYears?: number | null;
  specialties?: unknown;
  languages?: unknown;
  serviceStyle?: string | null;
  residentialAddress?: string | null;
  city?: string | null;
  serviceArea?: unknown;
  status: string;
  ratingAvg?: string | number | null;
  reviewCount?: number | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
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
  callbackAttempts?: AdminPaymentCallbackAttempt[];
  booking?: {
    createdAt?: string;
    status?: string;
    customerProfile?: { user?: { phone?: string; fullName?: string | null } };
    selectedProvider?: { displayName?: string | null };
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

export type AdminPaymentSummary = {
  authorized: number;
  callbackReview: number;
  callbackVerified: number;
  captured: number;
  cashDebt: number;
  linkedRefunds: number;
  needsAction: number;
  pendingCash: number;
  refunded: number;
  totalCount: number;
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

export type AdminManualWalletAdjustmentOwnerType = 'CUSTOMER' | 'PARTNER';

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
  approvalId?: string;
  attachmentUrl?: string | null;
  bankCashAmount: number;
  beforeBalance: number;
  companyOutputVat: number;
  currency: string;
  direction: AdminManualWalletAdjustmentDirection;
  expenseAmount: number;
  expenseContraAmount?: number;
  monthlyPeriod?: string | null;
  ownerId: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  partnerReceivableDecrease?: number;
  partnerReceivableIncrease?: number;
  platformRevenueAmount: number;
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
  adjustmentType: string;
  affects?: Record<string, unknown>;
  afterBalance?: number | null;
  amount: number;
  approvalId?: string | null;
  attachmentUrl?: string | null;
  beforeBalance?: number | null;
  createdAt?: string;
  currency: string;
  direction: string;
  id: string;
  ledgerType: string;
  monthlyPeriod?: string | null;
  ownerId: string;
  ownerLabel: string;
  ownerPhone: string;
  ownerType: AdminManualWalletAdjustmentOwnerType;
  reason?: string | null;
  sourceKey: string;
  updatedAt?: string;
  walletDelta: number;
};

export type AdminEarningSummary = {
  count: number;
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
  totalDebtAmount: number;
  totalPlatformFee: number;
  totalTaxAmount: number;
  oldestOpenAt?: string | null;
  oldestOpenAgeMinutes: number;
  staleDebtRowCount: number;
  highDebtProviderCount: number;
  missingPaymentEvidenceCount: number;
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

export type AdminRefund = {
  id: string;
  bookingId: string;
  paymentId: string;
  amount: number;
  reason?: string | null;
  status: string;
  createdAt: string;
  booking?: {
    status?: string;
    customerProfile?: { user?: { phone?: string; fullName?: string | null } };
    selectedProvider?: { displayName?: string | null };
  };
  payment?: { method: string; status: string; currency: string };
};

export type AdminRefundSummary = {
  totalCount: number;
  requestedCount: number;
  refundedBookingCount: number;
  needsUpdateCount: number;
  completedCount: number;
  openCount: number;
  outcomeLinkedCount: number;
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
};

export type AdminPayoutBatchSummary = {
  generatedAt: string;
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

export type AdminProviderWalletWithdrawalRequest = {
  id: string;
  providerProfileId: string;
  bankAccountId: string;
  amount: number;
  currency: string;
  status: AdminProviderWalletWithdrawalRequestStatus;
  requestNote?: string | null;
  adminNote?: string | null;
  correctionReason?: string | null;
  transferRef?: string | null;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt?: string;
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
  } | null;
};

export type AdminProviderWalletWithdrawalRequestSummary = {
  total: number;
  requested: number;
  reviewRequired: number;
  bankTransferPending: number;
  lockReleased: number;
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

export type AdminPartnerCustomerReviewSummary = {
  generatedAt?: string;
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
export type AdminMonthlyTaxClosingStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'DECLARED'
  | 'PAID'
  | 'CLOSED'
  | 'REVERSED';

export type AdminBookingSettlementSnapshot = {
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
  settlementStatus: AdminBookingSettlementStatus;
  taxStatus: AdminBookingSettlementTaxStatus;
  monthlyPeriod: string;
  postedAt: string;
  closedAt?: string | null;
  booking?: {
    id: string;
    createdAt: string;
    scheduledStartAt?: string | null;
    status: string;
    closedAt?: string | null;
  } | null;
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

export type AdminBookingSettlementSnapshotSummary = {
  count: number;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  platformFeeGross: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentProcessingFee: number;
  openTaxCount: number;
  paidTaxCount: number;
};

export type AdminPartnerWithholdingTaxRow = {
  providerProfileId: string;
  partnerName: string;
  partnerPhone?: string | null;
  period: string;
  currency: string;
  completedBookingCount: number;
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
  createdAt: string;
  updatedAt: string;
};

export type AdminMonthlyTaxClosingSummary = {
  id?: string | null;
  period: string;
  currency: string;
  status: AdminMonthlyTaxClosingStatus;
  settlementCount: number;
  customerPaymentAmountTotal: number;
  partnerPayoutTotal: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
  partnerVatWithheldTotal: number;
  partnerPitWithheldTotal: number;
  partnerWithholdingTotal: number;
  paymentProcessingFeeTotal: number;
  cashDebtTotal: number;
  nonCashPartnerPayoutTotal: number;
  partnerCountWithRevenue: number;
  openTaxCount: number;
  paidTaxCount: number;
  reconciliationDelta: number;
  netRevenueDelta: number;
  declaredAt?: string | null;
  paidAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
};

export type AdminPlatformVatRateBreakdown = {
  category: 'REDUCED_8' | 'STANDARD_10' | 'MANUAL_REVIEW';
  platformVatRateBps: number;
  settlementCount: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
};

export type AdminPlatformVatSummary = {
  period: string;
  currency: string;
  settlementCount: number;
  platformFeeGrossTotal: number;
  platformFeeNetRevenueTotal: number;
  companyOutputVatTotal: number;
  netRevenueDelta: number;
  rateBreakdown: AdminPlatformVatRateBreakdown[];
};

export type AdminPaymentFeeMethodBreakdown = {
  paymentMethod: AdminPaymentMethod;
  settlementCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
};

export type AdminPaymentFeePayerBreakdown = {
  paymentFeePayer: 'HANDS' | 'CUSTOMER' | 'PARTNER' | 'SHARED';
  settlementCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
};

export type AdminPaymentFeeTreatmentBreakdown = {
  paymentFeeTreatment: 'OPERATING_EXPENSE' | 'PASS_THROUGH' | 'MANUAL_REVIEW';
  settlementCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
};

export type AdminPaymentFeeSummary = {
  period: string;
  currency: string;
  settlementCount: number;
  customerPaymentAmountTotal: number;
  paymentProcessingFeeTotal: number;
  byPaymentMethod: AdminPaymentFeeMethodBreakdown[];
  byPayer: AdminPaymentFeePayerBreakdown[];
  byTreatment: AdminPaymentFeeTreatmentBreakdown[];
};

export type AdminAuditLog = {
  id: string;
  action: string;
  target: string;
  metadata?: unknown;
  createdAt: string;
  actor?: { phone?: string; fullName?: string | null };
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
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
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

export type AdminNotificationBoardSummary = {
  disabledDevices?: number;
  failed?: number;
  fcmDeliveries?: number;
  generatedAt: string;
  inAppDeliveries?: number;
  needsRetry?: number;
  noShow?: number;
  partnerAlertCount?: number;
  payoutSetup?: number;
  pending?: number;
  sent?: number;
  skipped?: number;
  staleDevices?: number;
  totalCount: number;
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
  partnerCount: number;
  onlinePartnerCount: number;
  activeBookingCount: number;
  completedBookingCount: number;
  cancellationCount: number;
  revenueAmount: number;
  currency: string;
};

export type AdminVietnamOverviewPointKind =
  | 'customers'
  | 'active'
  | 'partners'
  | 'online'
  | 'bookings'
  | 'done'
  | 'cancel';

export type AdminVietnamOverviewRealtimePointKind = Extract<
  AdminVietnamOverviewPointKind,
  'active' | 'online' | 'bookings'
>;

export type AdminVietnamOverviewPoint = {
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

export type AdminVietnamOverviewRealtimePoint = AdminVietnamOverviewPoint & {
  kind: AdminVietnamOverviewRealtimePointKind;
};

export type AdminVietnamOverview = {
  generatedAt: string;
  refreshSeconds: number;
  source: 'stored-address-aggregates';
  range: 'today' | 'yesterday' | '7d' | '30d' | 'all';
  rangeLabel: string;
  windowStartAt: string | null;
  windowEndAt: string | null;
  totals: {
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
  regions: AdminVietnamOverviewRegion[];
  points: AdminVietnamOverviewPoint[];
  realtimePoints?: AdminVietnamOverviewRealtimePoint[];
};

export type AdminVietnamOverviewSummary = Omit<AdminVietnamOverview, 'realtimePoints'>;

export type AdminVietnamOverviewRealtimePointFeed = Pick<
  AdminVietnamOverview,
  'generatedAt' | 'refreshSeconds' | 'source' | 'range' | 'rangeLabel' | 'windowStartAt' | 'windowEndAt'
> & {
  realtimePoints: AdminVietnamOverviewRealtimePoint[];
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

export async function adminGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { authorization: `Bearer ${token}` },
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

export async function adminPost<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
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
      return fallback;
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

export async function adminPatch<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
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
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function adminDelete<T>(path: string, fallback: T): Promise<T> {
  try {
    const token = await getAdminAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${token}`,
      },
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

export function adminRealtimeSocketBaseUrl() {
  const explicitSocketBaseUrl = process.env.ADMIN_SOCKET_BASE_URL;
  const fallbackSocketBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return (explicitSocketBaseUrl ?? fallbackSocketBaseUrl).replace(/\/$/, '');
}

export async function getAdminAccessToken() {
  const configuredToken = process.env.ADMIN_ACCESS_TOKEN;
  if (configuredToken) {
    const expiresAt = readJwtExpiry(configuredToken);
    if (!expiresAt || expiresAt > Date.now() + ADMIN_TOKEN_REFRESH_SKEW_MS) {
      return configuredToken;
    }
    throw new Error('ADMIN_ACCESS_TOKEN is expired');
  }

  throw new Error('ADMIN_ACCESS_TOKEN is required for Admin Web API access');
}

export class AdminApiRequestError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
  ) {
    super(`Admin API ${method} ${path} failed with ${status}`);
    this.name = 'AdminApiRequestError';
  }
}

export function isAdminApiAuthError(error: unknown) {
  if (error instanceof AdminApiRequestError) {
    return error.status === 401 || error.status === 403;
  }

  return error instanceof Error && error.message.startsWith('ADMIN_ACCESS_TOKEN');
}

async function adminJsonRequestOrThrow<T>(
  method: 'DELETE' | 'PATCH' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAdminAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body ?? {}) }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new AdminApiRequestError(method, path, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function readJwtExpiry(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalizedPayload, 'base64').toString('utf8')) as {
      exp?: number;
    };
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}
