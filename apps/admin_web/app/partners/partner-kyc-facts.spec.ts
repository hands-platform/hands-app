import type { AdminProvider } from '../../lib/admin-api';
import {
  kycDocumentPillClass,
  missingApprovedRequiredKycDocuments,
  missingSubmittedRequiredKycDocuments,
  partnerKycState,
  partnerNeedsKycReview,
  providerKycDocumentStatus,
} from './partner-kyc-facts';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    ...input,
  } as AdminProvider;
}

function document(type: string, status: string) {
  return { id: `${type}-${status}`, type, status };
}

describe('partner KYC facts', () => {
  it('allows one overall KYC decision when every required document is submitted', () => {
    const result = partner({
      kyc: { id: 'kyc-1', status: 'PENDING' },
      documents: [
        document('CCCD_FRONT', 'APPROVED'),
        document('CCCD_BACK', 'PENDING_REVIEW'),
        document('SELFIE', 'PENDING_REVIEW'),
      ],
    });

    expect(missingApprovedRequiredKycDocuments(result)).toEqual(['CCCD_BACK', 'SELFIE']);
    expect(missingSubmittedRequiredKycDocuments(result)).toEqual([]);
    expect(providerKycDocumentStatus(result, 'SELFIE')).toBe('PENDING_REVIEW');
    expect(partnerKycState(result)).toMatchObject({
      status: 'PENDING',
      missingDocuments: [],
      pendingDocuments: 2,
      rejectedDocuments: 0,
      readyToApprove: true,
      blockedByDocuments: false,
      needsReview: true,
      operatorAction: 'Review the full evidence set, then approve or place KYC on hold.',
    });
  });

  it('blocks overall approval while a required document is missing or rejected', () => {
    const result = partner({
      kyc: { id: 'kyc-1', status: 'PENDING' },
      documents: [
        document('CCCD_FRONT', 'PENDING_REVIEW'),
        document('CCCD_BACK', 'REJECTED'),
      ],
    });

    expect(missingSubmittedRequiredKycDocuments(result)).toEqual(['CCCD_BACK', 'SELFIE']);
    expect(partnerKycState(result)).toMatchObject({
      missingDocuments: ['CCCD_BACK', 'SELFIE'],
      rejectedDocuments: 1,
      readyToApprove: false,
      blockedByDocuments: true,
    });
  });

  it('marks KYC as ready to approve when all required identity documents are approved', () => {
    const result = partner({
      kyc: { id: 'kyc-1', status: 'PENDING' },
      documents: [
        document('CCCD_FRONT', 'APPROVED'),
        document('CCCD_BACK', 'APPROVED'),
        document('SELFIE', 'APPROVED'),
      ],
    });

    expect(partnerKycState(result)).toMatchObject({
      status: 'PENDING',
      missingDocuments: [],
      pendingDocuments: 0,
      rejectedDocuments: 0,
      readyToApprove: true,
      blockedByDocuments: false,
      needsReview: true,
      detail: 'KYC record and all required identity evidence are submitted.',
    });
    expect(partnerNeedsKycReview(result)).toBe(true);
  });

  it('tracks rejected KYC evidence and pill classes as factual review state', () => {
    const result = partner({
      kyc: { id: 'kyc-1', status: 'REJECTED' },
      documents: [
        document('CCCD_FRONT', 'APPROVED'),
        document('CCCD_BACK', 'APPROVED'),
        document('SELFIE', 'REJECTED'),
      ],
    });

    expect(partnerKycState(result)).toMatchObject({
      status: 'REJECTED',
      rejectedDocuments: 1,
      needsReview: true,
    });
    expect(kycDocumentPillClass('APPROVED')).toBe('pill-success');
    expect(kycDocumentPillClass('REJECTED')).toBe('pill-danger');
    expect(kycDocumentPillClass('PENDING_REVIEW')).toBe('pill-warn');
    expect(kycDocumentPillClass('MISSING')).toBe('pill-neutral');
  });
});
