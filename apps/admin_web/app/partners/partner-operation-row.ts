import type { AdminProvider } from '../../lib/admin-api';
import { providerSecurityLabel } from './partner-filters';
import {
  latestPartnerBookingRecord,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerLastActivityAt,
  partnerLastCompletedWorkAt,
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';
import { partnerHasFirstRevenueSignal } from './partner-finance-readiness-facts';
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
  const firstRevenue = partnerHasFirstRevenueSignal(provider);
  const taxStatus = provider.taxProfile?.status ?? (firstRevenue ? 'MISSING' : 'deferred');
  const nextAction = nextPartnerListAction(provider, opsPolicy);
  const matchingFlow = buildPartnerMatchingFlow(provider, opsPolicy);
  const kycReady = provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider);
  const activeServiceCount = partnerActiveServiceCount(provider);

  return {
    provider,
    name: deps.displayName(provider),
    phone: provider.user?.phone ?? provider.id,
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
        label: 'Bank',
        status: hasApprovedBankAccount(provider) ? 'ok' : (provider.bankAccounts?.[0]?.status ?? 'missing'),
        tone: hasApprovedBankAccount(provider) ? 'ok' : 'warn',
      },
      {
        label: 'Tax',
        status: taxStatus,
        tone: provider.taxProfile?.status === 'APPROVED' ? 'ok' : firstRevenue ? 'warn' : 'neutral',
      },
      {
        label: 'Wallet',
        status: walletBalance < 0 ? 'settlement needed' : 'clear',
        tone: walletBalance < 0 ? 'danger' : 'ok',
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
        ? 'Fee settlement required'
        : 'Marketplace repair needed',
    marketplaceAccessDetail: marketplaceEligibility.eligible
      ? `Can participate in marketplace bookings within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} when the booking address matches policy.`
      : walletBalance < 0
        ? 'Partner may see marketplace requests, but the Partner app must block marketplace alerts and booking participation until HANDS fee settlement is posted.'
        : marketplaceEligibility.detail,
    marketplaceAccessTone: marketplaceEligibility.eligible ? 'ok' : walletBalance < 0 ? 'danger' : 'warn',
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
  const preferredCount = provider.preferredBookings?.length ?? 0;
  const marketplaceCount = (provider.participants ?? []).filter((participant) =>
    Boolean(participant.booking),
  ).length;
  const selectedCount = provider.selectedBookings?.length ?? 0;
  const chatCount = bookingRows.filter((booking) => Boolean(booking.chatRoom)).length;
  const activeBookingRows = bookingRows.filter((booking) => isActivePartnerBooking(booking));
  const latestBooking = latestPartnerBookingRecord(bookingRows);
  const marketplaceEligibility = buildPartnerMarketplaceEligibility(provider, opsPolicy);

  return {
    items: [
      {
        label: 'First-pick',
        status: preferredCount ? `${preferredCount} record(s)` : 'none',
        tone: preferredCount ? 'info' : 'neutral',
      },
      {
        label: 'Marketplace',
        status: marketplaceCount
          ? `${marketplaceCount} participation record(s)`
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
        status: chatCount ? `${chatCount} room(s)` : 'none',
        tone: chatCount
          ? 'ok'
          : activeBookingRows.some((booking) => shouldHavePartnerChatRoom(booking))
            ? 'warn'
            : 'neutral',
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
  if (!hasApprovedBankAccount(provider)) blockers.push('bank account');
  if (provider.status !== 'ONLINE_AVAILABLE') blockers.push(`status ${provider.status}`);
  if (locationState !== 'recent') blockers.push(`location ${locationState}`);
  if (!hasHealthyPush(provider)) blockers.push('push missing');
  if (!['clear', 'missing'].includes(securityState)) {
    blockers.push(providerSecurityLabel(securityState).toLowerCase());
  }

  return blockers.length ? `Held by: ${blockers.join(', ')}.` : 'Direct request gate is held by policy.';
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
