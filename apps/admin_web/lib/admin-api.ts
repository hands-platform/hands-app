const API_BASE_URL = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3100/api';

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
  residentialAddress?: string | null;
  city?: string | null;
  status: string;
  currentLat?: string | number | null;
  currentLng?: string | number | null;
  currentLocationUpdatedAt?: string | null;
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
  services?: Array<{ service?: { name: string } }>;
  user?: {
    id?: string;
    fullName?: string | null;
    phone?: string;
    supabaseUserId?: string | null;
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
  tipAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  availableAt?: string | null;
  paidAt?: string | null;
  payoutBatchId?: string | null;
  createdAt?: string;
  providerProfile?: { displayName?: string | null; user?: { phone?: string; fullName?: string | null } };
};

export type AdminEarningSummary = {
  count: number;
  grossAmount: number;
  platformFee: number;
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
  providerProfile?: { displayName?: string | null; user?: { phone?: string; fullName?: string | null } };
  earnings?: AdminEarning[];
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
      body?: {
        error?: {
          details?: Array<{
            errorCode?: string;
          }>;
        };
      };
    } | null;
    pushDevice?: { platform?: string; token?: string; enabled?: boolean };
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
  return body.accessToken;
}
