import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminProvider } from '../../lib/admin-api';
import {
  approveIdentityDocumentDescription,
  approvePartnerForOperationsDescription,
  approvePartnerKycDescription,
  approvePayoutBankDescription,
  approvePublicMediaDescription,
  approveTaxProfileDescription,
  blockPartnerAccountDescription,
  kycRequiresApprovedDocumentsDescription,
  rejectIdentityDocumentDescription,
  rejectPartnerForOperationsDescription,
  rejectPartnerKycDescription,
  rejectPayoutBankDescription,
  rejectPublicMediaDescription,
  rejectTaxProfileDescription,
  syncInfrastructureRoleDescription,
  syncRoleRequiresApprovedVerificationDescription,
  unblockPartnerAccountDescription,
} from './partner-action-copy';
import { partnerAccountActionConfirmHref } from './partner-account-action-confirmation';
import {
  partnerReviewActionConfirmHref,
  type PartnerReviewConfirmationAction,
} from './partner-review-action-confirmation';

type PartnerBankAccount = NonNullable<AdminProvider['bankAccounts']>[number];
type PartnerDocument = NonNullable<AdminProvider['documents']>[number];
type PartnerPublicMedia = NonNullable<NonNullable<AdminProvider['user']>['fileAssets']>[number];

export function partnerAccountActionMenuItems(provider: AdminProvider): readonly ActionMenuItem[] {
  const syncDisabled = provider.verification?.status !== 'APPROVED';
  const actions: ActionMenuItem[] = [
    {
      description: approvePartnerForOperationsDescription,
      href: partnerAccountActionConfirmHref(provider.id, 'approve'),
      kind: 'link',
      label: 'Approve',
      tone: 'success',
    },
    {
      description: rejectPartnerForOperationsDescription,
      href: partnerAccountActionConfirmHref(provider.id, 'reject'),
      kind: 'link',
      label: 'Reject',
      tone: 'danger',
    },
    {
      description: syncDisabled ? syncRoleRequiresApprovedVerificationDescription : syncInfrastructureRoleDescription,
      disabled: syncDisabled,
      href: partnerAccountActionConfirmHref(provider.id, 'sync-role'),
      kind: 'link',
      label: 'Sync role',
      tone: 'info',
    },
  ];

  actions.push(accountBlockMenuItem(provider));
  actions.push({
    href: `/partners/${provider.id}`,
    kind: 'link',
    label: 'Open detail',
    tone: 'neutral',
  });

  return actions;
}

export function partnerDocumentReviewActionMenuItems(
  providerId: string,
  document: PartnerDocument,
): readonly ActionMenuItem[] {
  return partnerReviewTargetMenuItems({
    approveAction: 'approve-document',
    approveDescription: approveIdentityDocumentDescription,
    approveDisabled: document.status === 'APPROVED',
    approveLabel: 'Approve doc',
    providerId,
    rejectAction: 'reject-document',
    rejectDescription: rejectIdentityDocumentDescription,
    rejectDisabled: document.status === 'REJECTED',
    rejectLabel: 'Reject doc',
    target: { documentId: document.id },
  });
}

export function partnerKycReviewActionMenuItems(
  provider: AdminProvider,
  canApproveKyc: boolean,
): readonly ActionMenuItem[] {
  return [
    {
      description: canApproveKyc ? approvePartnerKycDescription : kycRequiresApprovedDocumentsDescription,
      disabled: provider.kyc?.status === 'APPROVED' || !canApproveKyc,
      href: partnerReviewActionConfirmHref(provider.id, 'approve-kyc'),
      kind: 'link',
      label: 'Approve KYC',
      tone: 'success',
    },
    {
      description: rejectPartnerKycDescription,
      disabled: !provider.kyc || provider.kyc.status === 'REJECTED',
      href: partnerReviewActionConfirmHref(provider.id, 'reject-kyc'),
      kind: 'link',
      label: 'Reject KYC',
      tone: 'danger',
    },
  ];
}

export function partnerBankReviewActionMenuItems(
  providerId: string,
  bankAccount: PartnerBankAccount,
): readonly ActionMenuItem[] {
  return partnerReviewTargetMenuItems({
    approveAction: 'approve-bank',
    approveDescription: approvePayoutBankDescription,
    approveDisabled: bankAccount.status === 'APPROVED',
    approveLabel: 'Approve bank',
    providerId,
    rejectAction: 'reject-bank',
    rejectDescription: rejectPayoutBankDescription,
    rejectDisabled: bankAccount.status === 'REJECTED',
    rejectLabel: 'Reject bank',
    target: { bankAccountId: bankAccount.id },
  });
}

export function partnerTaxReviewActionMenuItems(provider: AdminProvider): readonly ActionMenuItem[] {
  return [
    {
      description: approveTaxProfileDescription,
      disabled: provider.taxProfile?.status === 'APPROVED',
      href: partnerReviewActionConfirmHref(provider.id, 'approve-tax'),
      kind: 'link',
      label: 'Approve tax',
      tone: 'success',
    },
    {
      description: rejectTaxProfileDescription,
      disabled: provider.taxProfile?.status === 'REJECTED',
      href: partnerReviewActionConfirmHref(provider.id, 'reject-tax'),
      kind: 'link',
      label: 'Reject tax',
      tone: 'danger',
    },
  ];
}

export function partnerPublicMediaReviewActionMenuItems(
  providerId: string,
  file: PartnerPublicMedia,
): readonly ActionMenuItem[] {
  return partnerReviewTargetMenuItems({
    approveAction: 'approve-media',
    approveDescription: approvePublicMediaDescription,
    approveDisabled: file.reviewStatus === 'APPROVED',
    approveLabel: 'Approve media',
    providerId,
    rejectAction: 'reject-media',
    rejectDescription: rejectPublicMediaDescription,
    rejectDisabled: file.reviewStatus === 'REJECTED',
    rejectLabel: 'Reject media',
    target: { fileId: file.id },
  });
}

function accountBlockMenuItem(provider: AdminProvider): ActionMenuItem {
  if (provider.blockedAt) {
    return {
      description: unblockPartnerAccountDescription,
      href: partnerAccountActionConfirmHref(provider.id, 'unblock'),
      kind: 'link',
      label: 'Unblock',
      tone: 'warning',
    };
  }

  return {
    description: blockPartnerAccountDescription,
    href: partnerAccountActionConfirmHref(provider.id, 'block'),
    kind: 'link',
    label: 'Block',
    tone: 'danger',
  };
}

type PartnerReviewTargetMenuItemInput = {
  readonly approveAction: PartnerReviewConfirmationAction;
  readonly approveDescription: string;
  readonly approveDisabled: boolean;
  readonly approveLabel: string;
  readonly providerId: string;
  readonly rejectAction: PartnerReviewConfirmationAction;
  readonly rejectDescription: string;
  readonly rejectDisabled: boolean;
  readonly rejectLabel: string;
  readonly target: {
    readonly bankAccountId?: string;
    readonly documentId?: string;
    readonly fileId?: string;
  };
};

function partnerReviewTargetMenuItems(input: PartnerReviewTargetMenuItemInput): readonly ActionMenuItem[] {
  return [
    {
      description: input.approveDescription,
      disabled: input.approveDisabled,
      href: partnerReviewActionConfirmHref(input.providerId, input.approveAction, input.target),
      kind: 'link',
      label: input.approveLabel,
      tone: 'success',
    },
    {
      description: input.rejectDescription,
      disabled: input.rejectDisabled,
      href: partnerReviewActionConfirmHref(input.providerId, input.rejectAction, input.target),
      kind: 'link',
      label: input.rejectLabel,
      tone: 'danger',
    },
  ];
}
