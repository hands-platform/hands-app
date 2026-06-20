import type { AdminProvider } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { compactValue } from '../../lib/admin-format';
import {
  partnerAvailablePayout,
  partnerBookingRows,
  partnerCompletedWorkCount,
  partnerGrossRevenue,
  partnerLastSessionAt,
  partnerPendingPayout,
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';
import { providerReviewIssues, type PartnerReviewIssue } from './partner-list-readiness';
import {
  dateMs,
  providerLocationStatus,
  type ProviderLocationState,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import { maskToken } from './partner-list-profile';

const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
const MATCHING_BOOKING_STATUSES = new Set(['CREATED', 'OPEN_MATCHING']);
const WORKING_BOOKING_STATUSES = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export type PartnerMasterRow = {
  avatarStatus: AdminAvatarStatus;
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
  walletBalance: number;
  pendingPayout: number;
  availablePayout: number;
  auditLogCount: number;
  latestAuditTitle: string;
  latestAuditDetail: string;
  accountBlocked: boolean;
  accountNote: string;
  approvalIssues: readonly PartnerReviewIssue[];
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
  const closureCounts = partnerBookingClosureCounts(bookingRows);
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
    closedCount: closureCounts.closed,
    customerClosedCount: closureCounts.customerClosed,
    adminClosedCount: closureCounts.adminClosed,
    partnerClosedCount: closureCounts.partnerClosed,
    noShowCount: closureCounts.noShow,
    reviewCount: Number(provider.reviewCount ?? 0),
    grossRevenue: partnerGrossRevenue(provider),
    platformFee: earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0),
    walletBalance: partnerUnsettledWalletBalance(provider),
    pendingPayout: partnerPendingPayout(provider),
    availablePayout: partnerAvailablePayout(provider),
    auditLogCount: provider.auditLogCount ?? provider.auditLogs?.length ?? 0,
    latestAuditTitle: marketplaceDisplayText(latestAuditLog?.action ?? 'No internal note'),
    latestAuditDetail: latestAuditLog
      ? marketplaceDisplayText(compactValue(latestAuditLog.metadata, 96))
      : 'No partner memo or audit event saved yet',
    accountBlocked,
    accountNote: accountBlocked ? (provider.blockedReason ?? 'No block reason saved') : 'Normal account',
    approvalIssues: providerReviewIssues(provider, opsPolicy),
    avatarStatus: partnerMasterAvatarStatus(provider, bookingRows),
  };
}

function partnerMasterAvatarStatus(
  provider: AdminProvider,
  bookingRows: ReturnType<typeof partnerBookingRows>,
): AdminAvatarStatus {
  return adminAvatarStatusFromSignals({
    devices: [...(provider.devices ?? []), ...(provider.user?.pushDevices ?? [])],
    fallbackOnline: provider.status !== 'OFFLINE',
    matching: bookingRows.some((booking) => MATCHING_BOOKING_STATUSES.has(booking.status)),
    sessions: provider.sessions,
    working: bookingRows.some((booking) => WORKING_BOOKING_STATUSES.has(booking.status)),
  });
}

function partnerBookingClosureCounts(bookings: ReturnType<typeof partnerBookingRows>) {
  const closedRows = bookings.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));

  return {
    adminClosed: closedRows.filter((booking) => booking.closedByRole === 'ADMIN').length,
    closed: closedRows.length,
    customerClosed: closedRows.filter((booking) => booking.closedByRole === 'CUSTOMER').length,
    noShow: bookings.filter((booking) => booking.status === 'NO_SHOW').length,
    partnerClosed: closedRows.filter((booking) => booking.closedByRole === 'PROVIDER').length,
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
