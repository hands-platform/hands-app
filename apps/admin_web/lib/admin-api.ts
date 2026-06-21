const API_BASE_URL = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN_REFRESH_SKEW_MS = 60_000;

let cachedAdminToken: { token: string; expiresAt: number } | null = null;
let pendingAdminToken: Promise<string> | null = null;

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
export type AdminProviderStatus =
  | 'OFFLINE'
  | 'ONLINE_AVAILABLE'
  | 'ONLINE_BUSY'
  | 'ONLINE_AVAILABLE_SOON';
export type AdminPaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'RELEASED';
export type AdminPaymentMethod = 'MOMO' | 'VNPAY' | 'CASH';
export type AdminReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'REPORTED';
export type AdminEarningStatus = 'PENDING' | 'AVAILABLE' | 'PAID' | 'CANCELLED';
export type AdminPayoutBatchStatus = 'DRAFT' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type AdminProviderReportStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
export type AdminProviderSanctionType = 'WARNING' | 'ACCOUNT_BLOCK' | 'PAYOUT_HOLD' | 'TRUST_BADGE_REMOVAL';
export type AdminProviderSanctionStatus = 'ACTIVE' | 'LIFTED' | 'EXPIRED';
export type AdminProviderWalletLedgerType =
  | 'BOOKING_EARNING'
  | 'CASH_FEE_DEBT_SETTLED'
  | 'PAYOUT_PAID'
  | 'REFUND_REVERSAL'
  | 'ADMIN_ADJUSTMENT';

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

export type AdminCustomer = {
  id: string;
  userId: string;
  addresses?: unknown;
  activitySummary?: {
    bookingCount: number;
    completedBookingCount: number;
    lastBookingAt?: string | null;
    lastCompletedBookingAt?: string | null;
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
  auditLogs?: AdminAuditLog[];
  auditLogCount?: number;
};

export type AdminCustomerDetail = AdminCustomer & {
  bookings?: AdminBookingDetail[];
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
  earnings?: AdminEarning[];
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
  chatRoom?: { id: string; messages?: AdminChatMessage[] } | null;
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
  payment?: (AdminPayment & {
    booking?: AdminPayment['booking'] & {
      customerProfile?: { user?: { phone?: string; fullName?: string | null } };
      selectedProvider?: { displayName?: string | null };
    };
  }) | null;
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
  createdAt?: string;
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
    displayName?: string | null;
    user?: { phone?: string; fullName?: string | null };
    sanctions?: AdminProviderSanction[];
  };
  earnings?: AdminEarning[];
  withholdingLogs?: AdminWithholdingLog[];
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

export type AdminCoupon = {
  id: string;
  code: string;
  description?: string | null;
  discount: unknown;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
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

export function adminRealtimeSocketBaseUrl() {
  const explicitSocketBaseUrl = process.env.ADMIN_SOCKET_BASE_URL;
  const fallbackSocketBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return (explicitSocketBaseUrl ?? fallbackSocketBaseUrl).replace(/\/$/, '');
}

export async function getAdminAccessToken() {
  if (process.env.ADMIN_ACCESS_TOKEN) {
    return process.env.ADMIN_ACCESS_TOKEN;
  }

  const now = Date.now();
  if (cachedAdminToken && cachedAdminToken.expiresAt > now + ADMIN_TOKEN_REFRESH_SKEW_MS) {
    return cachedAdminToken.token;
  }

  if (pendingAdminToken) {
    return pendingAdminToken;
  }

  pendingAdminToken = requestAdminAccessToken();
  try {
    return await pendingAdminToken;
  } finally {
    pendingAdminToken = null;
  }
}

async function requestAdminAccessToken() {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone: process.env.ADMIN_DEMO_PHONE ?? '+84900000099',
      otp: process.env.ADMIN_DEMO_OTP ?? '123456',
      role: 'ADMIN',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to get admin access token');
  }

  const body = (await response.json()) as { accessToken: string };
  cachedAdminToken = {
    token: body.accessToken,
    expiresAt: readJwtExpiry(body.accessToken) ?? Date.now() + 10 * 60_000,
  };
  return body.accessToken;
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
