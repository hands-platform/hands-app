import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import {
  buildPartnerKycEvidence,
  hasApprovedRequiredKycDocuments,
  missingApprovedRequiredKycDocuments,
  missingSubmittedRequiredKycDocuments,
} from './partner-detail-kyc-evidence-model';
import type { ProviderDetail } from './partner-detail-types';

function providerFixture(overrides: Partial<ProviderDetail> = {}): ProviderDetail {
  return overrides as ProviderDetail;
}

function approvedDocuments() {
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type, index) => ({
    fileAsset: {
      contentType: 'image/jpeg',
      id: `file-${index}`,
      key: `kyc/${type}.jpg`,
      uploadedAt: '2026-07-20T08:30:00.000Z',
      uploadStatus: 'UPLOADED',
    },
    id: `document-${index}`,
    status: 'APPROVED',
    type,
  }));
}

describe('partner detail KYC evidence model', () => {
  it('requests the complete KYC submission when no record or files exist', () => {
    const provider = providerFixture();
    const evidence = buildPartnerKycEvidence(provider);

    expect(evidence.allRequiredApproved).toBe(false);
    expect(evidence.missingDocuments).toEqual(ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS);
    expect(evidence.rows).toHaveLength(ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.length);
    expect(evidence.nextAction).toContain('submit CCCD/CMND number');
    expect(missingSubmittedRequiredKycDocuments(provider)).toEqual(
      ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS,
    );
  });

  it('keeps rejected evidence visible and blocks the final decision', () => {
    const [front, back, selfie] = ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS;
    const provider = providerFixture({
      documents: [
        approvedDocuments()[0],
        {
          fileAsset: {
            contentType: 'image/jpeg',
            id: 'file-back',
            key: `kyc/${back}.jpg`,
            uploadStatus: 'UPLOADED',
          },
          id: 'document-back',
          rejectionReason: 'Image is blurred',
          status: 'REJECTED',
          type: back,
        },
        {
          fileAsset: {
            contentType: 'image/jpeg',
            id: 'file-selfie',
            key: `kyc/${selfie}.jpg`,
            uploadStatus: 'UPLOADED',
          },
          id: 'document-selfie',
          status: 'PENDING',
          type: selfie,
        },
      ],
      kyc: {
        cccdNumberLast4: '1234',
        id: 'kyc-pending',
        status: 'PENDING',
        submittedAt: '2026-07-20T08:00:00.000Z',
      },
      legalName: 'Tran Linh',
    });
    const evidence = buildPartnerKycEvidence(provider);

    expect(front).toBeDefined();
    expect(evidence.allRequiredApproved).toBe(false);
    expect(evidence.missingDocuments).toEqual([back, selfie]);
    expect(evidence.nextAction).toContain('Approve or reject missing evidence first');
    expect(evidence.decisionChecklist.find((item) => item.label === 'Rejected evidence resolved')).toMatchObject({
      ok: false,
    });
    expect(missingSubmittedRequiredKycDocuments(provider)).toEqual([]);
  });

  it('allows the final KYC decision only after every required document is approved', () => {
    const provider = providerFixture({
      documents: approvedDocuments(),
      kyc: {
        cccdNumberLast4: '5678',
        id: 'kyc-ready',
        status: 'PENDING',
        submittedAt: '2026-07-21T08:00:00.000Z',
      },
      legalName: 'Nguyen Mai',
    });
    const evidence = buildPartnerKycEvidence(provider);

    expect(evidence.allRequiredApproved).toBe(true);
    expect(evidence.missingDocuments).toEqual([]);
    expect(evidence.nextAction).toBe('All required evidence is approved. Make the final KYC decision.');
    expect(missingApprovedRequiredKycDocuments(provider)).toEqual([]);
    expect(hasApprovedRequiredKycDocuments(provider)).toBe(true);
  });
});
