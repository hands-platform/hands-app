import type { AdminProvider } from '../../lib/admin-api';
import {
  kycDocumentPillClass,
  missingApprovedRequiredKycDocuments,
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
  it('reports missing approved required documents and blocks approval until evidence is complete', () => {
    const result = partner({
      kyc: { id: 'kyc-1', status: 'PENDING' },
      documents: [document('CCCD_FRONT', 'APPROVED'), document('CCCD_BACK', 'PENDING_REVIEW')],
    });

    expect(missingApprovedRequiredKycDocuments(result)).toEqual(['CCCD_BACK', 'SELFIE']);
    expect(providerKycDocumentStatus(result, 'SELFIE')).toBe('MISSING');
    expect(partnerKycState(result)).toMatchObject({
      status: 'PENDING',
      missingDocuments: ['CCCD_BACK', 'SELFIE'],
      pendingDocuments: 1,
      rejectedDocuments: 0,
      readyToApprove: false,
      blockedByDocuments: true,
      needsReview: true,
      operatorAction: 'Approve uploaded evidence first, or reject with a clear resubmission reason.',
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
      detail: 'KYC record and required identity documents are ready.',
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
