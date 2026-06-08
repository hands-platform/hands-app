import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { compactValue } from '../../lib/admin-format';
import type { ProviderFilters } from './partner-filters';
import {
  dateMs,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import {
  hasApprovedBankAccount,
  hasHealthyPush,
  providerPublicMedia,
  providerPublicMediaNeedsReview,
} from './partner-list-profile';
import { partnerNeedsKycReview } from './partner-kyc-facts';
import {
  partnerPayoutSetupNeedsReview,
  partnerTaxNeedsReview,
} from './partner-finance-readiness-facts';
import {
  partnerAvailablePayout,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerGrossRevenue,
  partnerLastActivityAt,
  partnerLastCompletedWorkAt,
  partnerPendingPayout,
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';
import { partnerSecurityStatus } from './partner-security-facts';

const ACTIVE_PARTNER_BOOKING_STATUSES = [
  'CREATED',
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
];

export type PartnerListQueryDeps = {
  canAcceptBookingNow: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
  dispatchReady: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
  displayName: (provider: AdminProvider) => string;
  hasHardAcceptanceBlocker: (provider: AdminProvider) => boolean;
  marketplaceEligibility: (
    provider: AdminProvider,
    opsPolicy: ProviderOpsPolicy,
  ) => { eligible: boolean };
};

type PartnerSortMetrics = {
  availablePayout: number;
  bookingCount: number;
  completedWorkCount: number;
  grossRevenue: number;
  lastActivityMs: number;
  lastWorkMs: number;
  locationUpdatedMs: number;
  name: string;
  pendingPayout: number;
  priority: number;
  walletBalance: number;
};

export function sortPartners(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  sort: string,
  deps: PartnerListQueryDeps,
) {
  const sortMetrics = new Map<string, PartnerSortMetrics>();
  const metricsFor = (provider: AdminProvider) => {
    const cached = sortMetrics.get(provider.id);
    if (cached) return cached;
    const metrics = buildPartnerSortMetrics(provider, opsPolicy, deps);
    sortMetrics.set(provider.id, metrics);
    return metrics;
  };

  return [...providers].sort((left, right) => {
    const leftMetrics = metricsFor(left);
    const rightMetrics = metricsFor(right);
    if (sort === 'last-work') {
      return rightMetrics.lastWorkMs - leftMetrics.lastWorkMs;
    }
    if (sort === 'completed-count') {
      return (
        rightMetrics.completedWorkCount - leftMetrics.completedWorkCount ||
        rightMetrics.lastWorkMs - leftMetrics.lastWorkMs
      );
    }
    if (sort === 'booking-count') {
      return (
        rightMetrics.bookingCount - leftMetrics.bookingCount ||
        rightMetrics.lastWorkMs - leftMetrics.lastWorkMs
      );
    }
    if (sort === 'gross-revenue') {
      return rightMetrics.grossRevenue - leftMetrics.grossRevenue;
    }
    if (sort === 'pending-payout') {
      return rightMetrics.pendingPayout - leftMetrics.pendingPayout;
    }
    if (sort === 'available-payout') {
      return rightMetrics.availablePayout - leftMetrics.availablePayout;
    }
    if (sort === 'last-activity') {
      return rightMetrics.lastActivityMs - leftMetrics.lastActivityMs;
    }
    if (sort === 'location-freshness') {
      return rightMetrics.locationUpdatedMs - leftMetrics.locationUpdatedMs;
    }
    if (sort === 'wallet-debt') {
      return leftMetrics.walletBalance - rightMetrics.walletBalance || leftMetrics.name.localeCompare(rightMetrics.name);
    }
    if (sort === 'name') {
      return leftMetrics.name.localeCompare(rightMetrics.name);
    }
    if (leftMetrics.priority !== rightMetrics.priority) {
      return rightMetrics.priority - leftMetrics.priority;
    }

    return leftMetrics.name.localeCompare(rightMetrics.name);
  });
}

export function filterPartners(
  providers: AdminProvider[],
  filters: ProviderFilters,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
) {
  const search = filters.q.toLowerCase();

  return providers.filter((provider) => {
    if (search && !partnerSearchText(provider).includes(search)) {
      return false;
    }
    if (filters.verification === 'BLOCKED') {
      if (!provider.blockedAt) return false;
    } else if (
      filters.verification &&
      (provider.verification?.status ?? 'DRAFT') !== filters.verification
    ) {
      return false;
    }
    if (filters.providerStatus && provider.status !== filters.providerStatus) {
      return false;
    }
    if (filters.kyc && (provider.kyc?.status ?? 'MISSING') !== filters.kyc) {
      return false;
    }
    if (filters.location && providerLocationStatus(provider, opsPolicy) !== filters.location) {
      return false;
    }
    if (filters.security && partnerSecurityStatus(provider) !== filters.security) {
      return false;
    }
    if (filters.readiness && partnerReadiness(provider, opsPolicy, deps) !== filters.readiness) {
      return false;
    }
    if (filters.bookingFlow && !partnerMatchesBookingFlow(provider, filters.bookingFlow)) {
      return false;
    }
    if (filters.review && !partnerMatchesReviewQueue(provider, filters.review, opsPolicy, deps)) {
      return false;
    }
    return true;
  });
}

export function partnerMatchesBookingFlow(provider: AdminProvider, flow: string) {
  const bookingRows = partnerBookingRows(provider);
  if (flow === 'active-booking') {
    return bookingRows.some((booking) => isActivePartnerBooking(booking));
  }
  if (flow === 'first-pick') {
    return (provider.preferredBookings ?? []).length > 0;
  }
  if (flow === 'marketplace-joined') {
    return (provider.participants ?? []).some((participant) => Boolean(participant.booking));
  }
  if (flow === 'final-partner') {
    return (provider.selectedBookings ?? []).length > 0;
  }
  if (flow === 'chat-live') {
    return bookingRows.some((booking) => Boolean(booking.chatRoom));
  }
  if (flow === 'chat-missing') {
    return bookingRows.some((booking) => shouldHavePartnerChatRoom(booking) && !booking.chatRoom);
  }
  if (flow === 'completed-work') {
    return partnerCompletedWorkCount(provider) > 0;
  }
  if (flow === 'no-work') {
    return partnerCompletedWorkCount(provider) === 0;
  }
  return true;
}

export function partnerMatchesReviewQueue(
  provider: AdminProvider,
  review: string,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
) {
  if (review === 'blocked') {
    return Boolean(provider.blockedAt);
  }
  if (review === 'kyc') {
    return partnerNeedsKycReview(provider);
  }
  if (review === 'documents') {
    return (provider.documents ?? []).some((document) =>
      ['PENDING_REVIEW', 'REJECTED'].includes(document.status),
    );
  }
  if (review === 'public-media') {
    return providerPublicMediaNeedsReview(provider);
  }
  if (review === 'bank') {
    return !hasApprovedBankAccount(provider);
  }
  if (review === 'payout-setup') {
    return partnerPayoutSetupNeedsReview(provider);
  }
  if (review === 'cash-debt') {
    return partnerUnsettledWalletBalance(provider) < 0;
  }
  if (review === 'tax') {
    return partnerTaxNeedsReview(provider);
  }
  if (review === 'security') {
    return ['account-blocked', 'blocked', 'session-check', 'shared'].includes(
      partnerSecurityStatus(provider),
    );
  }
  if (review === 'reports') {
    return partnerHasOpenControl(provider);
  }
  if (review === 'location') {
    return ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy));
  }
  if (review === 'push') {
    return !hasHealthyPush(provider);
  }
  if (review === 'acceptance-blocked') {
    return !deps.canAcceptBookingNow(provider, opsPolicy);
  }
  if (review === 'direct-ready') {
    return deps.canAcceptBookingNow(provider, opsPolicy);
  }
  if (review === 'marketplace-ready') {
    return deps.marketplaceEligibility(provider, opsPolicy).eligible;
  }
  if (review === 'marketplace-blocked') {
    return !deps.marketplaceEligibility(provider, opsPolicy).eligible;
  }
  return true;
}

export function partnerSearchText(provider: AdminProvider) {
  return [
    provider.id,
    provider.displayName,
    provider.legalName,
    provider.city,
    provider.residentialAddress,
    provider.blockedReason,
    provider.user?.fullName,
    provider.user?.phone,
    provider.devices?.map((device) => device.deviceId).join(' '),
    providerPublicMedia(provider)
      .map((file) => `${file.purpose} ${file.reviewStatus ?? ''} ${file.reviewReason ?? ''} ${file.key}`)
      .join(' '),
    provider.sessions?.map((session) => `${session.deviceId ?? ''} ${session.ipAddress ?? ''}`).join(' '),
    provider.reports
      ?.map((report) => `${report.category} ${report.summary} ${report.details ?? ''}`)
      .join(' '),
    provider.sanctions?.map((sanction) => `${sanction.type} ${sanction.reason}`).join(' '),
    provider.auditLogs?.map((log) => `${log.action} ${compactValue(log.metadata, 160)}`).join(' '),
    provider.services?.map((item) => item.service?.name).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function partnerReadiness(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
) {
  if (provider.blockedAt) {
    return 'needs-review';
  }
  if (deps.dispatchReady(provider, opsPolicy)) {
    return 'ready';
  }
  if (!deps.hasHardAcceptanceBlocker(provider) && provider.status !== 'ONLINE_AVAILABLE') {
    return 'approved-offline';
  }
  if (!deps.hasHardAcceptanceBlocker(provider) && !hasHealthyPush(provider)) {
    return 'push-missing';
  }
  return 'needs-review';
}

export function partnerPriority(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
) {
  if (provider.blockedAt) {
    return 0;
  }
  if (['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider))) {
    return 0;
  }
  if (deps.dispatchReady(provider, opsPolicy)) {
    return 4;
  }
  if (!deps.hasHardAcceptanceBlocker(provider) && provider.status === 'ONLINE_AVAILABLE') {
    return 3;
  }
  if (!deps.hasHardAcceptanceBlocker(provider)) {
    return 2;
  }
  return 1;
}

export function isActivePartnerBooking(booking: AdminBooking) {
  return ACTIVE_PARTNER_BOOKING_STATUSES.includes(booking.status);
}

export function shouldHavePartnerChatRoom(booking: AdminBooking) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
}

export function partnerHasOpenControl(provider: AdminProvider) {
  return (
    (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE')
  );
}

function buildPartnerSortMetrics(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerSortMetrics {
  return {
    availablePayout: partnerAvailablePayout(provider),
    bookingCount: partnerBookingRows(provider).length,
    completedWorkCount: partnerCompletedWorkCount(provider),
    grossRevenue: partnerGrossRevenue(provider),
    lastActivityMs: dateMs(partnerLastActivityAt(provider)),
    lastWorkMs: dateMs(partnerLastCompletedWorkAt(provider)),
    locationUpdatedMs: dateMs(provider.currentLocationUpdatedAt),
    name: deps.displayName(provider),
    pendingPayout: partnerPendingPayout(provider),
    priority: partnerPriority(provider, opsPolicy, deps),
    walletBalance: partnerUnsettledWalletBalance(provider),
  };
}
