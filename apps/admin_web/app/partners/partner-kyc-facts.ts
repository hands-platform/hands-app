import type { AdminProvider } from '../../lib/admin-api';
import { providerDocumentLabel } from '../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../lib/operations-policy';

export type PartnerKycState = {
  status: string;
  missingDocuments: string[];
  pendingDocuments: number;
  rejectedDocuments: number;
  readyToApprove: boolean;
  blockedByDocuments: boolean;
  needsReview: boolean;
  detail: string;
  operatorAction: string;
};

export function missingApprovedRequiredKycDocuments(provider: AdminProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

export function providerKycDocumentStatus(provider: AdminProvider, documentType: string) {
  const document = (provider.documents ?? []).find((item) => item.type === documentType);
  return document?.status ?? 'MISSING';
}

export function kycDocumentPillClass(status: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  if (status === 'PENDING_REVIEW') return 'pill-warn';
  return 'pill-neutral';
}

export function partnerKycState(provider: AdminProvider): PartnerKycState {
  const status = provider.kyc?.status ?? 'MISSING';
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const requiredDocumentStatuses = ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type) =>
    providerKycDocumentStatus(provider, type),
  );
  const pendingDocuments = requiredDocumentStatuses.filter((documentStatus) =>
    ['PENDING_REVIEW', 'UPLOADED'].includes(documentStatus),
  ).length;
  const rejectedDocuments = requiredDocumentStatuses.filter(
    (documentStatus) => documentStatus === 'REJECTED',
  ).length;
  const blockedByDocuments = status !== 'APPROVED' && missingDocuments.length > 0;
  const readyToApprove = Boolean(provider.kyc) && status !== 'APPROVED' && missingDocuments.length === 0;
  const needsReview =
    status !== 'APPROVED' || blockedByDocuments || pendingDocuments > 0 || rejectedDocuments > 0;

  if (!provider.kyc) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'No KYC record is stored yet.',
      operatorAction: 'Ask the Partner to submit CCCD number, CCCD front/back, and selfie evidence.',
    };
  }

  if (readyToApprove) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'KYC record and required identity documents are ready.',
      operatorAction: 'Review the detail page, then approve or reject KYC.',
    };
  }

  if (blockedByDocuments) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: `Missing approved evidence: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      operatorAction: 'Approve uploaded evidence first, or reject with a clear resubmission reason.',
    };
  }

  if (status === 'REJECTED' || rejectedDocuments > 0) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'KYC or required evidence was rejected.',
      operatorAction: 'Wait for Partner resubmission, then re-check the full evidence set.',
    };
  }

  return {
    status,
    missingDocuments,
    pendingDocuments,
    rejectedDocuments,
    readyToApprove,
    blockedByDocuments,
    needsReview,
    detail: status === 'APPROVED' ? 'KYC is approved.' : 'KYC is waiting for operator attention.',
    operatorAction: status === 'APPROVED' ? 'No KYC action required.' : 'Review KYC status and evidence.',
  };
}

export function partnerNeedsKycReview(provider: AdminProvider) {
  return partnerKycState(provider).needsReview;
}
