import type { AdminProvider } from '../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../lib/operations-policy';
import type { PartnerCommandLane } from './partner-command-center';
import {
  partnerKycState,
  partnerNeedsKycReview,
  providerKycDocumentStatus,
} from './partner-kyc-facts';

export type PartnerKycReviewBoard = {
  openCount: number;
  readyToApprove: number;
  blockedByDocuments: number;
  playbook: Array<{
    status: string;
    title: string;
    count: number;
    detail: string;
    operatorAction: string;
    href: string;
  }>;
  cards: Array<{
    title: string;
    count: number;
    status: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: PartnerCommandLane['tone'];
    samples: string[];
  }>;
};

export function buildPartnerKycReviewBoard(
  providers: AdminProvider[],
  displayName: (provider: AdminProvider) => string,
): PartnerKycReviewBoard {
  const missingKyc = providers.filter((provider) => !provider.kyc);
  const pendingKyc = providers.filter((provider) => provider.kyc?.status === 'PENDING');
  const rejectedKyc = providers.filter((provider) => provider.kyc?.status === 'REJECTED');
  const blockedByDocuments = providers.filter((provider) => partnerKycState(provider).blockedByDocuments);
  const readyToApprove = providers.filter((provider) => partnerKycState(provider).readyToApprove);
  const pendingRequiredDocuments = providers.filter((provider) =>
    ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.some((type) =>
      ['PENDING_REVIEW', 'UPLOADED'].includes(providerKycDocumentStatus(provider, type)),
    ),
  );
  const openCount = providers.filter(partnerNeedsKycReview).length;

  return {
    openCount,
    readyToApprove: readyToApprove.length,
    blockedByDocuments: blockedByDocuments.length,
    playbook: [
      {
        status: pendingRequiredDocuments.length ? '1ST' : 'OK',
        title: 'Review uploaded identity files first',
        count: pendingRequiredDocuments.length,
        detail:
          'CCCD front/back and selfie evidence should be approved or rejected before the final KYC decision.',
        operatorAction:
          'Check file type, face/ID consistency, image clarity, and reject with a specific resubmission reason when unclear.',
        href: '/partners?review=documents',
      },
      {
        status: readyToApprove.length ? '2ND' : 'OK',
        title: 'Approve complete KYC records',
        count: readyToApprove.length,
        detail:
          'These partners already have approved required evidence and only need the final KYC status decision.',
        operatorAction:
          'Approve when legal name, CCCD last four, selfie, and profile identity are consistent.',
        href: '/partners?review=kyc',
      },
      {
        status: rejectedKyc.length ? 'FOLLOW' : 'OK',
        title: 'Follow up rejected KYC',
        count: rejectedKyc.length,
        detail:
          'Rejected KYC should not disappear from operations until the partner has clear instructions and uploads corrected evidence.',
        operatorAction: 'Use the partner detail resubmission guidance so support can send a precise message.',
        href: '/partners?review=kyc',
      },
      {
        status: missingKyc.length ? 'BLOCK' : 'OK',
        title: 'Keep missing KYC out of paid dispatch',
        count: missingKyc.length,
        detail:
          'Minimal signup is allowed, but partners without KYC cannot accept paid requests or marketplace matching.',
        operatorAction:
          'Let onboarding stay light, then prompt KYC before the partner becomes activity-ready.',
        href: '/partners?review=acceptance-blocked',
      },
    ],
    cards: [
      {
        title: 'Ready to approve',
        count: readyToApprove.length,
        status: readyToApprove.length ? 'Decision needed' : 'Clear',
        detail: 'KYC record exists and all required CCCD/selfie evidence is already approved.',
        operatorAction: 'Open partner detail and make the final approve/reject decision.',
        href: '/partners?review=kyc',
        tone: readyToApprove.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(readyToApprove, displayName),
      },
      {
        title: 'Blocked by identity documents',
        count: blockedByDocuments.length,
        status: blockedByDocuments.length ? 'Evidence gap' : 'Clear',
        detail: 'At least one required CCCD front, CCCD back, or selfie document is not approved yet.',
        operatorAction: 'Approve uploaded evidence first, or reject with a resubmission reason.',
        href: '/partners?review=kyc',
        tone: blockedByDocuments.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(blockedByDocuments, displayName),
      },
      {
        title: 'Pending document review',
        count: pendingRequiredDocuments.length,
        status: pendingRequiredDocuments.length ? 'Check files' : 'Clear',
        detail: 'Required identity evidence is uploaded and waiting for document-level review.',
        operatorAction: 'Review file type, face/ID match, and file quality before approving KYC.',
        href: '/partners?review=documents',
        tone: pendingRequiredDocuments.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(pendingRequiredDocuments, displayName),
      },
      {
        title: 'Missing KYC record',
        count: missingKyc.length,
        status: missingKyc.length ? 'Not submitted' : 'Clear',
        detail: 'Partner signed up but has not submitted CCCD number and identity review data.',
        operatorAction: 'Keep signup friction low, but block paid dispatch until KYC is submitted.',
        href: '/partners?review=kyc',
        tone: missingKyc.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(missingKyc, displayName),
      },
      {
        title: 'Rejected KYC',
        count: rejectedKyc.length,
        status: rejectedKyc.length ? 'Needs resubmit' : 'Clear',
        detail: 'Rejected KYC should stay visible until the partner uploads corrected evidence.',
        operatorAction: 'Confirm rejection reason is specific enough for partner support follow-up.',
        href: '/partners?review=kyc',
        tone: rejectedKyc.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(rejectedKyc, displayName),
      },
      {
        title: 'Pending KYC',
        count: pendingKyc.length,
        status: pendingKyc.length ? 'Review queue' : 'Clear',
        detail: 'Submitted KYC records still need an operator decision.',
        operatorAction: 'Prioritize partners with complete evidence and recent activity first.',
        href: '/partners?review=kyc',
        tone: pendingKyc.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(pendingKyc, displayName),
      },
    ],
  };
}

function partnerBlockerSamples(
  providers: AdminProvider[],
  displayName: (provider: AdminProvider) => string,
) {
  return providers.slice(0, 3).map(displayName);
}
