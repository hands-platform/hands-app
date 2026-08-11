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
const WALLET_WITHDRAWAL_ADMIN_ACTION_STATUSES = new Set(['REQUESTED', 'APPROVED']);
const WALLET_WITHDRAWAL_TERMINAL_STATUSES = new Set(['PAID', 'REJECTED', 'CANCELLED']);

export type PartnerMasterRow = {
  appActivityStatus: 'active' | 'inactive_7d' | 'never_tracked';
  appLastActiveAt: string | null;
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
  walletWithdrawalAdminActionCount: number;
  walletWithdrawalOpenCount: number;
  walletWithdrawalLatestAmount: number | null;
  walletWithdrawalLatestStatus: string;
  auditLogCount: number;
  latestAuditTitle: string;
  latestAuditDetail: string;
  accountBlocked: boolean;
  accountNote: string;
  approvalIssues: readonly PartnerReviewIssue[];
  approvalQueueIssues: readonly PartnerReviewIssue[];
  approvalSubmittedAt: string | null;
  approvalHoldReason: string | null;
  verificationStatus: string;
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
  const activitySummary = provider.activitySummary;
  const bookingSummary = provider.bookingSummary;
  const displayName = deps.displayName(provider);
  const lastSeenAt = partnerLastSessionAt(provider);
  const latestSessionFacts = partnerLatestSessionFacts(provider);
  const accountBlocked = Boolean(provider.blockedAt);
  const walletWithdrawalFacts = partnerWalletWithdrawalFacts(provider);
  const closureCounts = bookingSummary
    ? {
        adminClosed: bookingSummary.adminClosedBookingCount,
        closed: bookingSummary.closedBookingCount,
        customerClosed: bookingSummary.customerClosedBookingCount,
        noShow: bookingSummary.noShowBookingCount,
        partnerClosed: bookingSummary.partnerClosedBookingCount,
      }
    : partnerBookingClosureCounts(bookingRows);
  const latestAuditLog = latestProviderAuditLog(provider);
  const approvalIssues = providerReviewIssues(provider, opsPolicy);

  return {
    appActivityStatus: provider.appActivitySummary?.activityStatus ?? 'never_tracked',
    appLastActiveAt: provider.appActivitySummary?.lastActiveAt ?? null,
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
    bookingCount: bookingSummary?.bookingCount ?? bookingRows.length,
    completedCount:
      bookingSummary?.completedBookingCount ??
      (bookingRows.filter((booking) => booking.status === 'COMPLETED').length ||
        partnerCompletedWorkCount(provider)),
    closedCount: closureCounts.closed,
    customerClosedCount: closureCounts.customerClosed,
    adminClosedCount: closureCounts.adminClosed,
    partnerClosedCount: closureCounts.partnerClosed,
    noShowCount: closureCounts.noShow,
    reviewCount: Number(provider.reviewCount ?? 0),
    grossRevenue: partnerGrossRevenue(provider),
    platformFee:
      activitySummary?.platformFee ??
      earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0),
    walletBalance: partnerUnsettledWalletBalance(provider),
    pendingPayout: partnerPendingPayout(provider),
    availablePayout: partnerAvailablePayout(provider),
    ...walletWithdrawalFacts,
    auditLogCount: provider.auditLogCount ?? provider.auditLogs?.length ?? 0,
    latestAuditTitle: marketplaceDisplayText(latestAuditLog?.action ?? 'No internal note'),
    latestAuditDetail: latestAuditLog
      ? marketplaceDisplayText(compactValue(latestAuditLog.metadata, 96))
      : 'No partner memo or audit event saved yet',
    accountBlocked,
    accountNote: accountBlocked ? (provider.blockedReason ?? 'No block reason saved') : 'Normal account',
    approvalIssues,
    approvalQueueIssues: partnerApprovalQueueIssues(approvalIssues),
    approvalSubmittedAt: partnerApprovalSubmittedAt(provider),
    approvalHoldReason: partnerApprovalHoldReason(provider),
    verificationStatus: provider.verification?.status ?? 'MISSING',
    avatarStatus: partnerMasterAvatarStatus(provider, bookingRows),
  };
}

function partnerApprovalSubmittedAt(provider: AdminProvider) {
  const pendingSubmissions = [
    provider.verification?.status === 'SUBMITTED' ? provider.verification.submittedAt : null,
    provider.kyc?.status === 'PENDING' ? provider.kyc.submittedAt : null,
  ].filter((value): value is string => Boolean(value) && dateMs(value) > 0);

  return pendingSubmissions.sort((left, right) => dateMs(left) - dateMs(right))[0] ?? null;
}

function partnerApprovalQueueIssues(issues: readonly PartnerReviewIssue[]) {
  return issues.filter((issue) => {
    const label = issue.label.toLowerCase();
    return (
      label === 'account blocked' ||
      label.startsWith('identity docs ') ||
      label.startsWith('document ') ||
      label.startsWith('media ')
    );
  });
}

function partnerApprovalHoldReason(provider: AdminProvider) {
  const rejectedDocumentReason = provider.documents?.find(
    (document) => document.status === 'REJECTED' && document.rejectionReason?.trim(),
  )?.rejectionReason;
  const reasons = [
    provider.blockedAt ? provider.blockedReason : null,
    provider.verification?.rejectionReason,
    provider.kyc?.rejectionReason,
    rejectedDocumentReason,
  ];

  const reason = reasons.find((candidate): candidate is string => Boolean(candidate?.trim()));
  return reason ? compactValue(reason.trim(), 120) : null;
}

function partnerWalletWithdrawalFacts(provider: AdminProvider) {
  const requests = provider.walletWithdrawalRequests ?? [];
  const openRequests = requests.filter((request) => !WALLET_WITHDRAWAL_TERMINAL_STATUSES.has(request.status));
  const adminActionRequests = requests.filter((request) =>
    WALLET_WITHDRAWAL_ADMIN_ACTION_STATUSES.has(request.status),
  );
  const latestRequest = requests[0] ?? null;

  return {
    walletWithdrawalAdminActionCount: adminActionRequests.length,
    walletWithdrawalLatestAmount: latestRequest ? Number(latestRequest.amount) : null,
    walletWithdrawalLatestStatus: latestRequest?.status ?? 'NONE',
    walletWithdrawalOpenCount: openRequests.length,
  };
}

function partnerMasterAvatarStatus(
  provider: AdminProvider,
  bookingRows: ReturnType<typeof partnerBookingRows>,
): AdminAvatarStatus {
  return adminAvatarStatusFromSignals({
    devices: [...(provider.devices ?? []), ...(provider.user?.pushDevices ?? [])],
    fallbackOnline: provider.status !== 'OFFLINE',
    matching:
      provider.bookingSummary?.matchingBookingCount !== undefined
        ? provider.bookingSummary.matchingBookingCount > 0
        : bookingRows.some((booking) => MATCHING_BOOKING_STATUSES.has(booking.status)),
    sessions: provider.sessions,
    working:
      provider.bookingSummary?.workingBookingCount !== undefined
        ? provider.bookingSummary.workingBookingCount > 0
        : bookingRows.some((booking) => WORKING_BOOKING_STATUSES.has(booking.status)),
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
