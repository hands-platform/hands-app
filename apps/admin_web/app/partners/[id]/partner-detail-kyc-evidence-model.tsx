import { providerDocumentLabel } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import { DateTimeText } from '../../../components/date-time-text';
import { formatDate } from './partner-detail-format';
import type { PartnerKycDecisionEvidence } from './partner-detail-kyc-decision-section';
import type { ProviderDetail } from './partner-detail-types';

export type PartnerKycEvidence = PartnerKycDecisionEvidence & {
  readonly missingDocuments: readonly string[];
};

export function buildPartnerKycEvidence(provider: ProviderDetail): PartnerKycEvidence {
  const rows = ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type) => {
    const document = (provider.documents ?? []).find((item) => item.type === type);
    return {
      type,
      label: providerDocumentLabel(type),
      status: document?.status ?? 'MISSING',
      uploadedAt: document?.fileAsset?.uploadedAt,
      rejectionReason: document?.rejectionReason,
      fileHref: document?.fileAsset?.id ? `/files/${document.fileAsset.id}/open` : undefined,
      fileLabel: marketplaceDisplayText(
        document?.fileAsset?.contentType ?? document?.fileAsset?.key ?? 'No file uploaded',
      ),
      previewable: document?.fileAsset?.contentType?.startsWith('image/') ?? false,
    };
  });
  const missingDocuments = rows.filter((row) => row.status !== 'APPROVED').map((row) => row.type);
  const allRequiredApproved = missingDocuments.length === 0;
  const rejectedDocuments = rows.filter((row) => row.status === 'REJECTED');
  const legalNameReady = Boolean(provider.legalName?.trim());
  const cccdReady = Boolean(provider.kyc?.cccdNumberLast4);
  const kycRecordReady = Boolean(provider.kyc);

  let nextAction = 'No KYC action required.';
  if (!provider.kyc) {
    nextAction = 'Ask the Partner to submit CCCD/CMND number plus front, back, and selfie evidence.';
  } else if (!allRequiredApproved) {
    nextAction = `Approve or reject missing evidence first: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`;
  } else if (provider.kyc.status !== 'APPROVED') {
    nextAction = 'All required evidence is approved. Make the final KYC decision.';
  }

  return {
    allRequiredApproved,
    missingDocuments,
    nextAction,
    decisionChecklist: [
      {
        label: 'KYC record submitted',
        ok: kycRecordReady,
        detail: kycRecordReady
          ? `Submitted ${formatDate(provider.kyc?.submittedAt)}.`
          : 'Partner must submit identity data before admin can approve KYC.',
        detailNode: kycRecordReady ? (
          <>
            Submitted <DateTimeText fallback="Missing" value={provider.kyc?.submittedAt} />.
          </>
        ) : undefined,
      },
      {
        label: 'Legal name present',
        ok: legalNameReady,
        detail: legalNameReady
          ? `Legal name: ${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')}.`
          : 'Ask the Partner to complete the legal name used for CCCD and payout checks.',
      },
      {
        label: 'CCCD/CMND number captured',
        ok: cccdReady,
        detail: cccdReady
          ? `Stored as masked last four ****${provider.kyc?.cccdNumberLast4}.`
          : 'CCCD/CMND number is missing or has not been captured in the KYC record.',
      },
      {
        label: 'Required evidence approved',
        ok: allRequiredApproved,
        detail: allRequiredApproved
          ? 'CCCD front, CCCD back, and selfie are approved.'
          : `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      },
      {
        label: 'Rejected evidence resolved',
        ok: rejectedDocuments.length === 0,
        detail: rejectedDocuments.length
          ? `Rejected evidence still needs resubmission: ${rejectedDocuments
              .map((row) => row.label)
              .join(', ')}.`
          : 'No rejected identity evidence is blocking approval.',
      },
    ],
    rows,
  };
}

export function missingApprovedRequiredKycDocuments(provider: ProviderDetail) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

export function missingSubmittedRequiredKycDocuments(provider: ProviderDetail) {
  const submittedDocuments = new Set(
    (provider.documents ?? [])
      .filter(
        (document) =>
          document.fileAsset &&
          (!document.fileAsset.uploadStatus || document.fileAsset.uploadStatus === 'UPLOADED'),
      )
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !submittedDocuments.has(type));
}

export function hasApprovedRequiredKycDocuments(provider: ProviderDetail) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}
