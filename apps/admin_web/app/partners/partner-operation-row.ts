import type { AdminProvider } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { partnerCashDebtMarketplaceAccessCopy } from '../../lib/booking-wallet-copy';
import { adminCountLabel } from '../../lib/admin-copy';
import { providerSecurityLabel } from './partner-filters';
import {
  latestPartnerBookingRecord,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerLastActivityAt,
  partnerLastCompletedWorkAt,
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';
import { missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import { hasApprovedBankAccount, hasHealthyPush } from './partner-list-profile';
import { isActivePartnerBooking, shouldHavePartnerChatRoom } from './partner-list-query';
import {
  formatDistanceMeters,
  providerLocationStatus,
  type ProviderLocationState,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import { nextPartnerListAction, type ProviderListAction } from './partner-list-actions';
import { buildPartnerMarketplaceEligibility } from './partner-marketplace-eligibility';
import { partnerSecurityStatus } from './partner-security-facts';

type PartnerCommandTone = 'ok' | 'warn' | 'danger' | 'info';

export type PartnerOperationChecklistItem = {
  label: string;
  status: string;
  tone: PartnerCommandTone | 'neutral';
};

export type PartnerOperationRow = {
  provider: AdminProvider;
  name: string;
  phone: string;
  avatarStatus: AdminAvatarStatus;
  checklist: PartnerOperationChecklistItem[];
  matchingFlow: PartnerOperationChecklistItem[];
  matchingFlowDetail: string;
  acceptanceLabel: string;
  acceptanceDetail: string;
  acceptanceTone: PartnerCommandTone;
  marketplaceAccessLabel: string;
  marketplaceAccessDetail: string;
  marketplaceAccessTone: PartnerCommandTone;
  marketplaceCanView: boolean;
  marketplaceCanReceiveAlerts: boolean;
  marketplaceCanParticipate: boolean;
  marketplacePartnerAppMessage: string | null;
  completedWorkCount: number;
  lastWorkAt: string | null;
  walletBalance: number;
  locationState: ProviderLocationState;
  lastActivityAt: string | null;
  nextAction: ProviderListAction;
};

export type PartnerOperationRowDeps = {
  displayName: (provider: AdminProvider) => string;
  canAcceptBookingNow: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
};

export function buildPartnerOperationRow(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerOperationRowDeps,
): PartnerOperationRow {
  const walletBalance = partnerUnsettledWalletBalance(provider);
  const locationState = providerLocationStatus(provider, opsPolicy);
  const canAccept = deps.canAcceptBookingNow(provider, opsPolicy);
  const marketplaceEligibility = buildPartnerMarketplaceEligibility(provider, opsPolicy);
  const completedWorkCount = partnerCompletedWorkCount(provider);
  const taxStatus = provider.taxProfile?.status ?? 'not required';
  const nextAction = nextPartnerListAction(provider, opsPolicy);
  const matchingFlow = buildPartnerMatchingFlow(provider, opsPolicy);
  const kycReady = provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider);
  const activeServiceCount = partnerActiveServiceCount(provider);

  return {
    provider,
    name: deps.displayName(provider),
    phone: provider.user?.phone ?? provider.id,
    avatarStatus: adminAvatarStatusFromSignals({
      devices: [...(provider.user?.pushDevices ?? []), ...(provider.devices ?? [])],
      fallbackOnline: provider.status === 'ONLINE_AVAILABLE' || provider.status === 'ONLINE_AVAILABLE_SOON',
      sessions: provider.sessions,
      working: provider.status === 'ONLINE_BUSY',
    }),
    checklist: [
      {
        label: 'KYC',
        status: kycReady ? 'ok' : (provider.kyc?.status ?? 'missing'),
        tone:
          kycReady
            ? 'ok'
            : provider.kyc?.status === 'REJECTED'
              ? 'danger'
              : 'warn',
      },
      {
        label: 'Withdrawal details',
        status: hasApprovedBankAccount(provider) ? 'ready' : 'on request',
        tone: hasApprovedBankAccount(provider) ? 'ok' : 'neutral',
      },
      {
        label: 'Tax optional',
        status: taxStatus,
        tone: provider.taxProfile ? 'info' : 'neutral',
      },
      {
        label: 'Wallet',
        status: walletBalance < 0 ? 'settlement needed' : 'clear',
        tone: walletBalance < 0 ? 'warn' : 'ok',
      },
      {
        label: 'Location',
        status: locationState,
        tone: locationState === 'recent' ? 'ok' : locationState === 'stale' ? 'warn' : 'neutral',
      },
      {
        label: 'Push',
        status: hasHealthyPush(provider) ? 'ready' : 'missing',
        tone: hasHealthyPush(provider) ? 'ok' : 'warn',
      },
      {
        label: 'Services',
        status: activeServiceCount > 0 ? `${activeServiceCount} active` : 'none',
        tone: activeServiceCount > 0 ? 'ok' : 'warn',
      },
      {
        label: 'App',
        status: partnerHasAppActivity(provider) ? 'seen' : 'not seen',
        tone: partnerHasAppActivity(provider) ? 'ok' : 'neutral',
      },
    ],
    matchingFlow: matchingFlow.items,
    matchingFlowDetail: matchingFlow.detail,
    acceptanceLabel: canAccept ? 'Direct request clear' : 'Direct request held',
    acceptanceDetail: canAccept
      ? 'Ready to receive and accept preferred direct booking requests.'
      : partnerAcceptBlockerSummary(provider, opsPolicy),
    acceptanceTone: canAccept ? 'ok' : 'warn',
    marketplaceAccessLabel: marketplaceEligibility.eligible
      ? 'Marketplace ready'
      : walletBalance < 0
        ? 'Settlement warning'
        : 'Dispatch repair needed',
    marketplaceAccessDetail: marketplaceEligibility.eligible
      ? `Can participate in marketplace bookings within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} when the booking address matches policy.`
      : walletBalance < 0
        ? partnerCashDebtMarketplaceAccessCopy
        : marketplaceEligibility.detail,
    marketplaceAccessTone: marketplaceEligibility.eligible ? 'ok' : 'warn',
    marketplaceCanView: marketplaceEligibility.canViewMarketplace,
    marketplaceCanReceiveAlerts: marketplaceEligibility.canReceiveMarketplaceAlerts,
    marketplaceCanParticipate: marketplaceEligibility.canParticipateInMarketplace,
    marketplacePartnerAppMessage: marketplaceEligibility.partnerAppMessage,
    completedWorkCount,
    lastWorkAt: partnerLastCompletedWorkAt(provider),
    walletBalance,
    locationState,
    lastActivityAt: partnerLastActivityAt(provider),
    nextAction,
  };
}

export function buildPartnerMatchingFlow(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
): { items: PartnerOperationChecklistItem[]; detail: string } {
  const bookingRows = partnerBookingRows(provider);
  const bookingSummary = provider.bookingSummary;
  const preferredCount = bookingSummary?.preferredBookingCount ?? provider.preferredBookings?.length ?? 0;
  const marketplaceCount =
    bookingSummary?.participatingBookingCount ??
    (provider.participants ?? []).filter((participant) => Boolean(participant.booking)).length;
  const selectedCount = bookingSummary?.selectedBookingCount ?? provider.selectedBookings?.length ?? 0;
  const chatCount =
    bookingSummary?.chatRoomCount ?? bookingRows.filter((booking) => Boolean(booking.chatRoom)).length;
  const activeBookingRows = bookingRows.filter((booking) => isActivePartnerBooking(booking));
  const latestBooking = latestPartnerBookingRecord(bookingRows);
  const marketplaceEligibility = buildPartnerMarketplaceEligibility(provider, opsPolicy);
  const hasChatMissing = bookingSummary
    ? bookingSummary.chatMissingCount > 0
    : activeBookingRows.some((booking) => shouldHavePartnerChatRoom(booking));

  return {
    items: [
      {
        label: 'First-pick',
        status: preferredCount ? adminCountLabel(preferredCount, 'record') : 'none',
        tone: preferredCount ? 'info' : 'neutral',
      },
      {
        label: 'Marketplace',
        status: marketplaceCount
          ? adminCountLabel(marketplaceCount, 'participation record')
          : marketplaceEligibility.eligible
            ? 'ready'
            : 'blocked',
        tone: marketplaceCount || marketplaceEligibility.eligible ? 'ok' : 'warn',
      },
      {
        label: 'Customer choice',
        status: selectedCount ? `${selectedCount} selected` : 'none',
        tone: selectedCount ? 'ok' : 'neutral',
      },
      {
        label: 'Chat',
        status: chatCount ? adminCountLabel(chatCount, 'room') : 'none',
        tone: chatCount ? 'ok' : hasChatMissing ? 'warn' : 'neutral',
      },
    ],
    detail: latestBooking
      ? `Latest booking ${partnerShortId(latestBooking.id)} / ${latestBooking.status}. ${opsPolicy.responseWindowMinutes}m first-pick and ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} marketplace are governed by Operations Policy.`
      : `No booking record loaded. ${opsPolicy.responseWindowMinutes}m first-pick and ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} marketplace checks still apply to new booking addresses.`,
  };
}

export function partnerAcceptBlockerSummary(provider: AdminProvider, opsPolicy: ProviderOpsPolicy) {
  const blockers: string[] = [];
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = partnerSecurityStatus(provider);

  if (provider.blockedAt) blockers.push('account blocked');
  if (provider.verification?.status !== 'APPROVED') {
    blockers.push(`verification ${provider.verification?.status ?? 'DRAFT'}`);
  }
  if (provider.kyc?.status !== 'APPROVED') blockers.push(`KYC ${provider.kyc?.status ?? 'MISSING'}`);
  if (!hasApprovedRequiredKycDocuments(provider)) blockers.push('identity documents');
  if (provider.status !== 'ONLINE_AVAILABLE') blockers.push(`status ${provider.status}`);
  if (locationState !== 'recent') blockers.push(`location ${locationState}`);
  if (!hasHealthyPush(provider)) blockers.push('push missing');
  if (!['clear', 'missing'].includes(securityState)) {
    blockers.push(providerSecurityLabel(securityState).toLowerCase());
  }

  return blockers.length ? `Blocked by: ${blockers.join(', ')}.` : 'Direct request gate is blocked by policy.';
}

export function partnerOperationPillClass(tone: PartnerOperationChecklistItem['tone']) {
  if (tone === 'ok') return 'pill-success';
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-neutral';
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function partnerShortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function partnerActiveServiceCount(provider: AdminProvider) {
  return (provider.services ?? []).filter((service) => service.active !== false).length;
}

function partnerHasAppActivity(provider: AdminProvider) {
  return Boolean((provider.sessions ?? []).length || (provider.devices ?? []).length);
}
