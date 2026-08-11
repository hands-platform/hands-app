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

export function missingSubmittedRequiredKycDocuments(provider: AdminProvider) {
  const submittedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status !== 'REJECTED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !submittedDocuments.has(type));
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
  const missingDocuments = missingSubmittedRequiredKycDocuments(provider);
  const requiredDocumentStatuses = ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type) =>
    providerKycDocumentStatus(provider, type),
  );
  const pendingDocuments = requiredDocumentStatuses.filter((documentStatus) =>
    ['PENDING_REVIEW', 'UPLOADED'].includes(documentStatus),
  ).length;
  const rejectedDocuments = requiredDocumentStatuses.filter(
    (documentStatus) => documentStatus === 'REJECTED',
  ).length;
  const blockedByDocuments =
    status !== 'APPROVED' && (missingDocuments.length > 0 || rejectedDocuments > 0);
  const readyToApprove =
    Boolean(provider.kyc) &&
    !['APPROVED', 'REJECTED'].includes(status) &&
    missingDocuments.length === 0 &&
    rejectedDocuments === 0;
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
      detail: 'KYC record and all required identity evidence are submitted.',
      operatorAction: 'Review the full evidence set, then approve or place KYC on hold.',
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
      detail: missingDocuments.length
        ? `Missing submitted evidence: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`
        : 'Rejected identity evidence requires Partner resubmission.',
      operatorAction: 'Ask the Partner to submit or replace the required evidence before approval.',
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
