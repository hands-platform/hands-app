const API_BASE_URL = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3100/api';
const ADMIN_TOKEN_REFRESH_SKEW_MS = 60_000;

let cachedAdminToken: { token: string; expiresAt: number } | null = null;
let pendingAdminToken: Promise<string> | null = null;

export type AdminUser = {
  id: string;
  phone: string;
  fullName?: string | null;
  roles: string[];
  providerProfile?: AdminProvider | null;
};

export type AdminProvider = {
  id: string;
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
  services?: Array<{ service?: { name: string } }>;
  earnings?: AdminEarning[];
  user?: {
    id?: string;
    fullName?: string | null;
    phone?: string;
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
      platform: string;
      enabled: boolean;
      token: string;
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
  WORK_PHOTO: 'Optional evidence for experience or trust review.',
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
  status: string;
  createdAt?: string;
  updatedAt?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  expiresAt?: string | null;
  address?: unknown;
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
      locationSnapshots?: AdminLocationSnapshot[];
    };
  }>;
  services?: Array<{
    price?: number;
    quantity?: number;
    service?: { name?: string; durationMin?: number; basePrice?: number };
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
  customerProfile?: { user?: { fullName?: string | null; phone?: string } };
  selectedProvider?: {
    id?: string;
    displayName?: string | null;
    status?: string;
    user?: { phone?: string; fullName?: string | null };
    currentLat?: string | number | null;
    currentLng?: string | number | null;
    currentLocationUpdatedAt?: string | null;
    locationSnapshots?: AdminLocationSnapshot[];
  };
  chatRoom?: { id: string; messages?: AdminChatMessage[] } | null;
};

export type AdminBookingDetail = AdminBooking & {
  notes?: string | null;
  openedAt?: string | null;
  refunds?: AdminRefund[];
  review?: AdminReview | null;
  earning?: AdminEarning | null;
  snapshots?: AdminLocationSnapshot[];
  opsTasks?: AdminBookingOpsTask[];
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
  booking?: {
    status?: string;
    customerProfile?: { user?: { phone?: string; fullName?: string | null } };
    selectedProvider?: { displayName?: string | null };
  };
  refunds?: Array<{ id: string; amount: number; status: string; createdAt?: string }>;
};

export type AdminEarning = {
  id: string;
  providerProfileId: string;
  bookingId: string;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  tipAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  availableAt?: string | null;
  paidAt?: string | null;
  payoutBatchId?: string | null;
  settlementRef?: string | null;
  settlementNotes?: string | null;
  createdAt?: string;
  providerProfile?: { displayName?: string | null; user?: { phone?: string; fullName?: string | null } };
  booking?: {
    status?: string;
    scheduledStartAt?: string;
    payment?: { method: string; status: string; amount: number; currency?: string } | null;
  } | null;
  platformFeeLogs?: AdminProviderPlatformFeeLog[];
  taxLogs?: AdminProviderTaxLog[];
};

export type AdminEarningSummary = {
  count: number;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  tipAmount: number;
  netAmount: number;
  pendingNetAmount: number;
  availableNetAmount: number;
  paidNetAmount: number;
  currency: string;
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
  tipAmount: number;
  status: string;
  reportReason?: string | null;
  customerProfile?: { user?: { fullName?: string | null; phone?: string } };
  providerProfile?: { displayName?: string | null };
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

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  user?: { phone?: string; fullName?: string | null };
  deliveries?: Array<{
    id?: string;
    provider: string;
    status: string;
    attemptedAt: string;
    response?: {
      statusCode?: number;
      body?: unknown;
    } | null;
    pushDevice?: { id?: string; platform?: string; token?: string; enabled?: boolean };
  }>;
};

export type AdminExternalReadiness = {
  ok: boolean;
  timestamp: string;
  checks: Array<{
    name: string;
    category: string;
    status: 'READY' | 'PARTIAL' | 'BLOCKED';
    configured: string[];
    missing: string[];
    invalid?: string[];
    detail: string;
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

async function getAdminAccessToken() {
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
