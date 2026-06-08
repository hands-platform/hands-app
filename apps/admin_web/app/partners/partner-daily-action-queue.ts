import type { AdminProvider } from '../../lib/admin-api';
import { formatRelativeAge } from '../../lib/admin-format';
import type { PartnerCommandLane } from './partner-command-center';
import {
  nextPartnerListAction,
  type ProviderListAction,
} from './partner-list-actions';
import {
  providerLocationAgeLabel,
  type ProviderOpsPolicy,
} from './partner-list-ops';

export type PartnerDailyActionQueue = {
  urgentCount: number;
  blockedCount: number;
  dispatchReadyCount: number;
  rows: Array<{
    provider: AdminProvider;
    action: ProviderListAction;
    href: string;
    lane: string;
    sla: string;
    age: string;
    tone: PartnerCommandLane['tone'];
  }>;
};

type PartnerDailyActionQueueDeps = {
  displayName: (provider: AdminProvider) => string;
  dispatchReady: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
  nextAction?: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => ProviderListAction;
};

export function buildPartnerDailyActionQueue(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerDailyActionQueueDeps,
): PartnerDailyActionQueue {
  const nextAction = deps.nextAction ?? nextPartnerListAction;
  const actionRows = providers
    .map((provider) => {
      const action = nextAction(provider, opsPolicy);
      return {
        provider,
        action,
        href: partnerDetailActionHref(provider, action),
        lane: partnerDailyActionLane(action.status),
        sla: partnerDailyActionSla(action),
        age: partnerDailyActionAgeSignal(provider, action),
        tone: partnerDailyActionTone(action),
      };
    })
    .filter((row) => row.action.tone !== 'done')
    .sort((left, right) => {
      if (left.action.priority !== right.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return deps.displayName(left.provider).localeCompare(deps.displayName(right.provider));
    });

  return {
    urgentCount: actionRows.filter((row) => row.action.priority >= 85).length,
    blockedCount: actionRows.filter((row) => row.action.tone === 'blocked').length,
    dispatchReadyCount: providers.filter((provider) => deps.dispatchReady(provider, opsPolicy)).length,
    rows: actionRows.slice(0, 10),
  };
}

export function partnerDetailActionHref(provider: AdminProvider, action: ProviderListAction) {
  const anchorByStatus: Record<string, string> = {
    ACCOUNT: 'payout',
    PROFILE: 'kyc',
    DOCUMENTS: 'documents',
    KYC: 'kyc',
    VERIFY: 'kyc',
    'CASH DEBT': 'payout',
    MEDIA: 'media',
    BANK: 'bank',
    TAX: 'tax',
    'TAX ADDRESS': 'tax',
    TERMS: 'tax',
    DEVICE: 'location',
    SECURITY: 'location',
    LOCATION: 'location',
    PUSH: 'location',
    SUPABASE: 'kyc',
  };
  const anchor = anchorByStatus[action.status];
  return anchor ? `/partners/${provider.id}#${anchor}` : `/partners/${provider.id}`;
}

function partnerDailyActionTone(action: ProviderListAction): PartnerCommandLane['tone'] {
  if (action.tone === 'blocked' && action.priority >= 85) return 'danger';
  if (action.tone === 'blocked') return 'warn';
  if (action.tone === 'pending') return 'info';
  return 'ok';
}

function partnerDailyActionLane(status: string) {
  const laneByStatus: Record<string, string> = {
    ACCOUNT: 'Safety',
    PROFILE: 'Onboarding',
    DOCUMENTS: 'KYC evidence',
    KYC: 'KYC decision',
    VERIFY: 'Partner approval',
    'CASH DEBT': 'Cash settlement',
    MEDIA: 'Public profile',
    BANK: 'Bank payout',
    TAX: 'Tax payout',
    'TAX ADDRESS': 'Tax payout',
    TERMS: 'Legal consent',
    DEVICE: 'Device control',
    SECURITY: 'Account review',
    LOCATION: 'Dispatch readiness',
    PUSH: 'Alert readiness',
    SUPABASE: 'Auth migration',
  };
  return laneByStatus[status] ?? 'Operations';
}

function partnerDailyActionSla(action: ProviderListAction) {
  if (action.priority >= 90) return 'Same shift';
  if (action.priority >= 80) return 'Today';
  if (action.priority >= 65) return 'Before next booking';
  if (action.priority >= 50) return 'Before dispatch';
  return 'Backlog';
}

function partnerDailyActionAgeSignal(provider: AdminProvider, action: ProviderListAction) {
  if (action.status === 'LOCATION') {
    return providerLocationAgeLabel(provider.currentLocationUpdatedAt);
  }
  if (action.status === 'KYC' || action.status === 'DOCUMENTS') {
    return providerSubmittedAgeLabel(provider.kyc?.submittedAt ?? provider.verification?.submittedAt);
  }
  if (action.status === 'VERIFY') {
    return providerSubmittedAgeLabel(provider.verification?.submittedAt);
  }
  if (action.status === 'BANK') {
    return providerReviewedAgeLabel(provider.bankAccounts?.[0]?.reviewedAt);
  }
  if (action.status === 'CASH DEBT') {
    return 'Marketplace participation is held now.';
  }
  if (action.status === 'PUSH') {
    return latestPushAgeLabel(provider);
  }
  if (action.status === 'DEVICE' || action.status === 'SECURITY' || action.status === 'ACCOUNT') {
    return latestSecurityAgeLabel(provider);
  }
  if (action.status === 'TAX' || action.status === 'TAX ADDRESS' || action.status === 'TERMS') {
    return 'Required after first earning.';
  }
  return 'Review when queue reaches this row.';
}

function providerSubmittedAgeLabel(value?: string | null) {
  if (!value) return 'No submitted timestamp.';
  return `Submitted ${formatRelativeAge(value)}.`;
}

function providerReviewedAgeLabel(value?: string | null) {
  if (!value) return 'No review timestamp.';
  return `Reviewed ${formatRelativeAge(value)}.`;
}

function latestPushAgeLabel(provider: AdminProvider) {
  const latestPushTime = (provider.user?.pushDevices ?? [])
    .map((device) => Date.parse(device.createdAt ?? ''))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return latestPushTime
    ? `Latest push device ${formatRelativeAge(new Date(latestPushTime).toISOString())}.`
    : 'No push device registered.';
}

function latestSecurityAgeLabel(provider: AdminProvider) {
  const latestSession = provider.sessions?.[0];
  if (latestSession?.lastSeenAt) {
    return `Last session ${formatRelativeAge(latestSession.lastSeenAt)}.`;
  }
  const blockedDevice = (provider.devices ?? []).find((device) => device.blockedAt);
  if (blockedDevice?.blockedAt) {
    return `Device blocked ${formatRelativeAge(blockedDevice.blockedAt)}.`;
  }
  return 'No recent session record.';
}
