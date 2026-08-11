import type { AdminProvider } from '../../lib/admin-api';
import type { PartnerCommandLane } from './partner-command-center';
import { partnerKycState, partnerNeedsKycReview } from './partner-kyc-facts';

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
  const rejectedKyc = providers.filter((provider) => provider.kyc?.status === 'REJECTED');
  const blockedByDocuments = providers.filter(
    (provider) => Boolean(provider.kyc) && partnerKycState(provider).blockedByDocuments,
  );
  const readyToApprove = providers.filter((provider) => partnerKycState(provider).readyToApprove);
  const openCount = providers.filter(partnerNeedsKycReview).length;

  return {
    openCount,
    readyToApprove: readyToApprove.length,
    blockedByDocuments: blockedByDocuments.length,
    playbook: [
      {
        status: readyToApprove.length ? '1ST' : 'OK',
        title: 'Review submitted KYC evidence',
        count: readyToApprove.length,
        detail:
          'CCCD front/back and selfie evidence are submitted and ready for one overall KYC decision.',
        operatorAction:
          'Check file type, face/ID consistency, and image clarity, then approve or place the whole KYC review on hold.',
        href: '/partners?review=kyc',
      },
      {
        status: blockedByDocuments.length ? 'BLOCK' : 'OK',
        title: 'Request missing KYC evidence',
        count: blockedByDocuments.length,
        detail:
          'At least one required identity file is missing or rejected, so an overall approval is not available yet.',
        operatorAction:
          'Place the review on hold with a clear correction reason and wait for Partner resubmission.',
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
        href: '/partners?review=available-blocked',
      },
    ],
    cards: [
      {
        title: 'Ready to approve',
        count: readyToApprove.length,
        status: readyToApprove.length ? 'Decision needed' : 'Clear',
        detail: 'KYC record and all required CCCD/selfie evidence are submitted.',
        operatorAction: 'Open Partner detail and make one overall approve or hold decision.',
        href: '/partners?review=kyc',
        tone: readyToApprove.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(readyToApprove, displayName),
      },
      {
        title: 'Missing or rejected evidence',
        count: blockedByDocuments.length,
        status: blockedByDocuments.length ? 'Evidence gap' : 'Clear',
        detail: 'At least one required CCCD front, CCCD back, or selfie file is missing or rejected.',
        operatorAction: 'Send one clear hold reason so the Partner can replace the required evidence.',
        href: '/partners?review=kyc',
        tone: blockedByDocuments.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(blockedByDocuments, displayName),
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
    ],
  };
}

function partnerBlockerSamples(
  providers: AdminProvider[],
  displayName: (provider: AdminProvider) => string,
) {
  return providers.slice(0, 3).map(displayName);
}
