import type { AdminProvider } from '../../lib/admin-api';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { partnerDisplayText } from '../../lib/admin-copy';

type PartnerPublicMedia = NonNullable<NonNullable<AdminProvider['user']>['fileAssets']>[number];
type PartnerVerificationFile = NonNullable<NonNullable<AdminProvider['verification']>['files']>[number];

export type FileReviewKind = 'private-verification' | 'public-media';
export type FileReviewStatusTone = 'danger' | 'neutral' | 'success' | 'warning';

export type FileReviewFilters = {
  readonly kind: string;
  readonly q: string;
  readonly review: string;
};

export type FileReviewRow = {
  readonly contentType: string;
  readonly fileHref: string | null;
  readonly id: string;
  readonly key: string;
  readonly kind: FileReviewKind;
  readonly kindLabel: string;
  readonly needsReview: boolean;
  readonly partnerHref: string;
  readonly partnerId: string;
  readonly partnerName: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
  readonly purposeLabel: string;
  readonly reviewReason: string | null;
  readonly reviewStatus: string;
  readonly sizeBytes: number | null;
  readonly statusLabel: string;
  readonly statusTone: FileReviewStatusTone;
  readonly uploadedAt: string | null;
  readonly uploadStatus: string;
  readonly visibility: string;
};

export type FileReviewSummary = {
  readonly approved: number;
  readonly pendingReview: number;
  readonly privateFiles: number;
  readonly publicMedia: number;
  readonly rejected: number;
  readonly total: number;
  readonly uploadIncomplete: number;
};

export function buildFileReviewRows(providers: readonly AdminProvider[]): FileReviewRow[] {
  return providers.flatMap((provider) => [
    ...buildPrivateFileRows(provider),
    ...buildPublicMediaRows(provider),
  ]).sort(compareFileReviewRows);
}

export function filterFileReviewRows(
  rows: readonly FileReviewRow[],
  filters: FileReviewFilters,
): FileReviewRow[] {
  const query = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.kind && row.kind !== filters.kind) {
      return false;
    }
    if (filters.review && !matchesReview(row, filters.review)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return searchableFileText(row).includes(query);
  });
}

export function buildFileReviewSummary(rows: readonly FileReviewRow[]): FileReviewSummary {
  return {
    approved: rows.filter((row) => row.reviewStatus === 'APPROVED').length,
    pendingReview: rows.filter((row) => row.needsReview).length,
    privateFiles: rows.filter((row) => row.kind === 'private-verification').length,
    publicMedia: rows.filter((row) => row.kind === 'public-media').length,
    rejected: rows.filter((row) => row.reviewStatus === 'REJECTED').length,
    total: rows.length,
    uploadIncomplete: rows.filter((row) => row.uploadStatus !== 'UPLOADED').length,
  };
}

export function fileReviewPurposeLabel(value?: string | null) {
  if (!value) {
    return 'Unlabeled file';
  }
  return value
    .replace(/provider/gi, 'partner')
    .toLowerCase()
    .split(/[_\-.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildPrivateFileRows(provider: AdminProvider): FileReviewRow[] {
  return (provider.verification?.files ?? []).map((file) => privateFileRow(provider, file));
}

function buildPublicMediaRows(provider: AdminProvider): FileReviewRow[] {
  return (provider.user?.fileAssets ?? []).map((file) => publicMediaRow(provider, file));
}

function privateFileRow(provider: AdminProvider, file: PartnerVerificationFile): FileReviewRow {
  const uploadStatus = file.uploadStatus ?? 'PENDING';
  const reviewStatus = file.reviewStatus ?? provider.verification?.status ?? 'PENDING_REVIEW';
  return {
    contentType: file.contentType,
    fileHref: `/files/${encodeURIComponent(file.id)}/open`,
    id: file.id,
    key: file.key,
    kind: 'private-verification',
    kindLabel: 'Private verification',
    needsReview: reviewStatus !== 'APPROVED',
    partnerHref: `/partners/${provider.id}#documents`,
    partnerId: provider.id,
    partnerName: filePartnerName(provider),
    partnerAvatarStatus: filePartnerAvatarStatus(provider),
    purposeLabel: fileReviewPurposeLabel(file.purpose),
    reviewReason: file.reviewReason ?? null,
    reviewStatus,
    sizeBytes: file.sizeBytes ?? null,
    statusLabel: reviewStatus,
    statusTone: reviewTone(reviewStatus, uploadStatus),
    uploadedAt: file.uploadedAt ?? null,
    uploadStatus,
    visibility: file.visibility,
  };
}

function publicMediaRow(provider: AdminProvider, file: PartnerPublicMedia): FileReviewRow {
  const uploadStatus = file.uploadStatus ?? 'PENDING';
  const reviewStatus = file.reviewStatus ?? 'PENDING_REVIEW';
  return {
    contentType: file.contentType,
    fileHref: file.url ?? null,
    id: file.id,
    key: file.key,
    kind: 'public-media',
    kindLabel: 'Public media',
    needsReview: reviewStatus !== 'APPROVED',
    partnerHref: `/partners/${provider.id}#media`,
    partnerId: provider.id,
    partnerName: filePartnerName(provider),
    partnerAvatarStatus: filePartnerAvatarStatus(provider),
    purposeLabel: fileReviewPurposeLabel(file.purpose),
    reviewReason: file.reviewReason ?? null,
    reviewStatus,
    sizeBytes: file.sizeBytes ?? null,
    statusLabel: reviewStatus,
    statusTone: reviewTone(reviewStatus, uploadStatus),
    uploadedAt: file.uploadedAt ?? file.createdAt ?? null,
    uploadStatus,
    visibility: file.visibility,
  };
}

function reviewTone(reviewStatus: string, uploadStatus: string): FileReviewStatusTone {
  if (uploadStatus !== 'UPLOADED') {
    return 'warning';
  }
  if (reviewStatus === 'APPROVED') {
    return 'success';
  }
  if (reviewStatus === 'REJECTED') {
    return 'danger';
  }
  return 'warning';
}

function filePartnerName(provider: AdminProvider) {
  return partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id);
}

function filePartnerAvatarStatus(provider: AdminProvider): AdminAvatarStatus {
  return adminAvatarStatusFromSignals({
    devices: [...(provider.user?.pushDevices ?? []), ...(provider.devices ?? [])],
    fallbackOnline: provider.status === 'ONLINE_AVAILABLE' || provider.status === 'ONLINE_AVAILABLE_SOON',
    sessions: provider.sessions,
    working: provider.status === 'ONLINE_BUSY',
  });
}

function matchesReview(row: FileReviewRow, review: string) {
  if (review === 'needs-review') {
    return row.needsReview;
  }
  if (review === 'approved') {
    return row.reviewStatus === 'APPROVED';
  }
  if (review === 'rejected') {
    return row.reviewStatus === 'REJECTED';
  }
  if (review === 'upload-incomplete') {
    return row.uploadStatus !== 'UPLOADED';
  }
  return true;
}

function searchableFileText(row: FileReviewRow) {
  return [
    row.contentType,
    row.id,
    row.key,
    row.kindLabel,
    row.partnerName,
    row.purposeLabel,
    row.reviewReason ?? '',
    row.reviewStatus,
    row.uploadStatus,
    row.visibility,
  ].join(' ').toLowerCase();
}

function compareFileReviewRows(left: FileReviewRow, right: FileReviewRow) {
  if (left.needsReview !== right.needsReview) {
    return left.needsReview ? -1 : 1;
  }
  return dateValue(right.uploadedAt) - dateValue(left.uploadedAt);
}

function dateValue(value: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
