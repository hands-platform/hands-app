import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminProvider } from '../../lib/admin-api';
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
      description: 'Review before approving this Partner for operations.',
      href: partnerAccountActionConfirmHref(provider.id, 'approve'),
      kind: 'link',
      label: 'Approve',
      tone: 'success',
    },
    {
      description: 'Review and enter a rejection reason before sending this Partner back.',
      href: partnerAccountActionConfirmHref(provider.id, 'reject'),
      kind: 'link',
      label: 'Reject',
      tone: 'danger',
    },
    {
      description: syncDisabled
        ? 'Partner verification must be approved before syncing Supabase role.'
        : 'Review before syncing the infrastructure role.',
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
    approveDescription: 'Review before approving this identity document.',
    approveDisabled: document.status === 'APPROVED',
    approveLabel: 'Approve doc',
    providerId,
    rejectAction: 'reject-document',
    rejectDescription: 'Review and enter a document rejection reason.',
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
      description: canApproveKyc
        ? 'Review before approving Partner KYC.'
        : 'Required identity documents must be approved before KYC approval.',
      disabled: provider.kyc?.status === 'APPROVED' || !canApproveKyc,
      href: partnerReviewActionConfirmHref(provider.id, 'approve-kyc'),
      kind: 'link',
      label: 'Approve KYC',
      tone: 'success',
    },
    {
      description: 'Review and enter a KYC rejection reason.',
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
    approveDescription: 'Review before approving this payout bank account.',
    approveDisabled: bankAccount.status === 'APPROVED',
    approveLabel: 'Approve bank',
    providerId,
    rejectAction: 'reject-bank',
    rejectDescription: 'Review and enter a bank rejection reason.',
    rejectDisabled: bankAccount.status === 'REJECTED',
    rejectLabel: 'Reject bank',
    target: { bankAccountId: bankAccount.id },
  });
}

export function partnerTaxReviewActionMenuItems(provider: AdminProvider): readonly ActionMenuItem[] {
  return [
    {
      description: 'Review before approving this tax profile.',
      disabled: provider.taxProfile?.status === 'APPROVED',
      href: partnerReviewActionConfirmHref(provider.id, 'approve-tax'),
      kind: 'link',
      label: 'Approve tax',
      tone: 'success',
    },
    {
      description: 'Review and enter a tax rejection reason.',
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
    approveDescription: 'Review before approving this public profile media.',
    approveDisabled: file.reviewStatus === 'APPROVED',
    approveLabel: 'Approve media',
    providerId,
    rejectAction: 'reject-media',
    rejectDescription: 'Review and enter a media rejection reason.',
    rejectDisabled: file.reviewStatus === 'REJECTED',
    rejectLabel: 'Reject media',
    target: { fileId: file.id },
  });
}

function accountBlockMenuItem(provider: AdminProvider): ActionMenuItem {
  if (provider.blockedAt) {
    return {
      description: 'Review the recorded issue before unblocking this account.',
      href: partnerAccountActionConfirmHref(provider.id, 'unblock'),
      kind: 'link',
      label: 'Unblock',
      tone: 'warning',
    };
  }

  return {
    description: 'Review and enter an account block reason before blocking this Partner.',
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
