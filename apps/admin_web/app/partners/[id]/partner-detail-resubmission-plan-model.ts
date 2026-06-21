import { providerDocumentLabel } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import type {
  PartnerResubmissionItem,
  PartnerResubmissionPlanView,
} from './partner-detail-review-progress-section';

type PartnerResubmissionProvider = {
  readonly bankAccounts?: readonly {
    readonly bankName: string;
    readonly rejectionReason?: string | null;
    readonly status: string;
  }[] | null;
  readonly documents?: readonly {
    readonly rejectionReason?: string | null;
    readonly status: string;
    readonly type?: string | null;
  }[] | null;
  readonly kyc?: {
    readonly rejectionReason?: string | null;
    readonly status?: string | null;
  } | null;
  readonly taxProfile?: {
    readonly rejectionReason?: string | null;
    readonly status?: string | null;
  } | null;
};

export function buildProviderResubmissionPlan(
  provider: PartnerResubmissionProvider,
): PartnerResubmissionPlanView {
  const items: PartnerResubmissionItem[] = [];

  if (provider.kyc?.status === 'REJECTED') {
    items.push({
      target: 'KYC identity review',
      status: 'REJECTED',
      reason: provider.kyc.rejectionReason ?? 'No rejection reason was saved.',
      providerInstruction:
        'Ask the Partner to check CCCD/CMND number, legal name, and selfie match before resubmitting.',
      operatorAction: 'KYC',
    });
  }

  for (const document of provider.documents ?? []) {
    if (document.status !== 'REJECTED') continue;
    items.push({
      target: providerDocumentLabel(document.type),
      status: 'REJECTED',
      reason: document.rejectionReason ?? 'No document rejection reason was saved.',
      providerInstruction: providerDocumentResubmissionInstruction(document.type),
      operatorAction: 'Doc',
    });
  }

  for (const bankAccount of provider.bankAccounts ?? []) {
    if (bankAccount.status !== 'REJECTED') continue;
    items.push({
      target: `${marketplaceDisplayText(bankAccount.bankName)} bank account`,
      status: 'REJECTED',
      reason: bankAccount.rejectionReason ?? 'No bank rejection reason was saved.',
      providerInstruction:
        'Ask for a new account with matching legal holder name, valid bank name, and readable QR if used.',
      operatorAction: 'Bank',
    });
  }

  if (provider.taxProfile?.status === 'REJECTED') {
    items.push({
      target: 'Legacy tax profile',
      status: 'REJECTED',
      reason: provider.taxProfile.rejectionReason ?? 'No tax rejection reason was saved.',
      providerInstruction:
        'Ask for corrected legacy tax details only if finance keeps this record.',
      operatorAction: 'Tax',
    });
  }

  return { items };
}

export function providerDocumentResubmissionInstruction(type?: string | null) {
  if (type === 'CCCD_FRONT') {
    return 'Ask for a clear front-side CCCD/CMND image with readable number, full name, and no glare.';
  }
  if (type === 'CCCD_BACK') {
    return 'Ask for a clear back-side CCCD/CMND image with all corners visible and no cropping.';
  }
  if (type === 'SELFIE') {
    return 'Ask for a live selfie that clearly matches the submitted identity document.';
  }
  if (type === 'BANK_QR') {
    return 'Ask for a readable bank QR image, but still verify the typed bank account fields.';
  }
  return 'Ask the Partner to upload a clearer replacement image for review.';
}
