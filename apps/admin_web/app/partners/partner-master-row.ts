import type { AdminProvider } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { compactValue } from '../../lib/admin-format';
import {
  partnerAvailablePayout,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerGrossRevenue,
  partnerLastSessionAt,
  partnerPendingPayout,
} from './partner-activity-facts';
import {
  dateMs,
  providerLocationStatus,
  type ProviderLocationState,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import { maskToken } from './partner-list-profile';

const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];

export type PartnerMasterRow = {
  provider: AdminProvider;
  initials: string;
  displayName: string;
  legalName: string;
  phone: string;
  gender: string;
  status: string;
  online: boolean;
  level: string;
  kycStatus: string;
  joinedAt: string | null;
  lastSeenAt: string | null;
  latestSessionDevice: string;
  latestSessionPlatform: string;
  latestSessionIp: string;
  latestSessionAppVersion: string;
  locationState: ProviderLocationState;
  bookingCount: number;
  completedCount: number;
  closedCount: number;
  customerClosedCount: number;
  adminClosedCount: number;
  partnerClosedCount: number;
  noShowCount: number;
  reviewCount: number;
  grossRevenue: number;
  platformFee: number;
  pendingPayout: number;
  availablePayout: number;
  auditLogCount: number;
  latestAuditTitle: string;
  latestAuditDetail: string;
  accountBlocked: boolean;
  accountNote: string;
};

export type PartnerMasterRowDeps = {
  displayName: (provider: AdminProvider) => string;
};

export function buildPartnerMasterRow(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerMasterRowDeps,
): PartnerMasterRow {
  const bookingRows = partnerBookingRows(provider);
  const earnings = provider.earnings ?? [];
  const displayName = deps.displayName(provider);
  const lastSeenAt = partnerLastSessionAt(provider);
  const latestSessionFacts = partnerLatestSessionFacts(provider);
  const accountBlocked = Boolean(provider.blockedAt);
  const closedRows = bookingRows.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));
  const latestAuditLog = latestProviderAuditLog(provider);

  return {
    provider,
    initials: partnerInitials(displayName),
    displayName,
    legalName: marketplaceDisplayText(
      provider.legalName ?? provider.user?.fullName ?? 'Legal name not saved',
    ),
    phone: provider.user?.phone ?? 'No phone',
    gender: provider.gender ?? 'Not saved',
    status: provider.status,
    online: provider.status !== 'OFFLINE',
    level: provider.level ?? 'LEVEL_1_SIGNUP',
    kycStatus: provider.kyc?.status ?? 'DRAFT',
    joinedAt: provider.user?.createdAt ?? null,
    lastSeenAt,
    latestSessionDevice: latestSessionFacts.device,
    latestSessionPlatform: latestSessionFacts.platform,
    latestSessionIp: latestSessionFacts.ip,
    latestSessionAppVersion: latestSessionFacts.appVersion,
    locationState: providerLocationStatus(provider, opsPolicy),
    bookingCount: bookingRows.length,
    completedCount:
      bookingRows.filter((booking) => booking.status === 'COMPLETED').length ||
      partnerCompletedWorkCount(provider),
    closedCount: closedRows.length,
    customerClosedCount: closedRows.filter((booking) => booking.closedByRole === 'CUSTOMER').length,
    adminClosedCount: closedRows.filter((booking) => booking.closedByRole === 'ADMIN').length,
    partnerClosedCount: closedRows.filter((booking) => booking.closedByRole === 'PROVIDER').length,
    noShowCount: bookingRows.filter((booking) => booking.status === 'NO_SHOW').length,
    reviewCount: Number(provider.reviewCount ?? 0),
    grossRevenue: partnerGrossRevenue(provider),
    platformFee: earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0),
    pendingPayout: partnerPendingPayout(provider),
    availablePayout: partnerAvailablePayout(provider),
    auditLogCount: provider.auditLogCount ?? provider.auditLogs?.length ?? 0,
    latestAuditTitle: latestAuditLog?.action ?? 'No internal note',
    latestAuditDetail: latestAuditLog
      ? compactValue(latestAuditLog.metadata, 96)
      : 'No partner memo or audit event saved yet',
    accountBlocked,
    accountNote: accountBlocked ? (provider.blockedReason ?? 'No block reason saved') : 'Normal account',
  };
}

function latestProviderAuditLog(provider: AdminProvider) {
  const logs = [...(provider.auditLogs ?? [])].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  );
  return logs.find((log) => log.action === 'provider.ops_note.add') ?? logs[0] ?? null;
}

function partnerLatestSessionFacts(provider: AdminProvider) {
  const latestSession = provider.sessions?.[0];
  const latestDevice = provider.devices?.[0];
  const platform = latestDevice?.platform ?? 'Unknown platform';
  const appVersion = latestSession?.appVersion ?? latestDevice?.appVersion;
  const appVersionLabel = appVersion ? `v${appVersion}` : 'No app version';
  const deviceId = latestSession?.deviceId ?? latestDevice?.deviceId;

  return {
    device: deviceId ? `${platform} / ${appVersionLabel} / ${maskToken(deviceId)}` : 'No session',
    platform,
    ip: latestSession?.ipAddress ?? 'No IP recorded',
    appVersion: appVersion ?? 'No app version',
  };
}

function partnerInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return 'P';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
