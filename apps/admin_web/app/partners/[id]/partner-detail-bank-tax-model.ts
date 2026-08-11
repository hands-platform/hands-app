import type { ActionMenuItem } from '../../../components/action-menu';
import {
  approvePayoutBankDescription,
  approveTaxProfileDescription,
  rejectPayoutBankDescription,
  rejectTaxProfileDescription,
} from '../partner-action-copy';
import { partnerDetailReviewActionConfirmHref } from './partner-detail-action-menu-model';
import { buildPartnerBankReviewTimeline } from './partner-detail-bank-review-timeline-model';
import type {
  PartnerBankPayoutGateView,
  PartnerTaxProfileView,
} from './partner-detail-finance-gate-section';
import type {
  ProviderBankAccount,
  ProviderDetail,
  ProviderTaxProfile,
} from './partner-detail-types';

export function buildPartnerBankPayoutGateView(
  providerId: string,
  bank: ProviderBankAccount | null,
  bankAccounts: readonly ProviderBankAccount[] = [],
  logs: NonNullable<ProviderDetail['verificationLogs']> = [],
): PartnerBankPayoutGateView | null {
  if (!bank) {
    return null;
  }
  const reviewState = partnerBankReviewState(bank, bankAccounts);

  return {
    accountLabel: bank.accountNumberMasked ?? bank.accountNumberLast4,
    bankName: bank.bankName,
    holderName: bank.accountHolderName,
    rejectionReason: bank.rejectionReason,
    reviewStateDetail: reviewState.detail,
    reviewStateLabel: reviewState.label,
    reviewActions: buildPartnerBankReviewActions(providerId, bank),
    reviewTimeline: buildPartnerBankReviewTimeline({ bank, bankAccounts, logs }),
    reviewedAt: bank.reviewedAt ?? null,
    status: bank.status,
    submittedAt: bank.createdAt ?? null,
    updatedAt: bank.updatedAt ?? null,
  };
}

export function partnerBankReviewState(
  bank: ProviderBankAccount,
  bankAccounts: readonly ProviderBankAccount[],
) {
  const hasRejectedHistory = bankAccounts.some(
    (account) => account.id !== bank.id && account.status === 'REJECTED',
  );
  if (bank.status === 'REJECTED') {
    return {
      label: 'Correction requested',
      detail: 'Partner app shows the rejection reason until corrected bank details are submitted again.',
    };
  }
  if (bank.status === 'PENDING_REVIEW') {
    return hasRejectedHistory
      ? {
          label: 'Bank correction submitted',
          detail:
            'Partner submitted bank details after a previous correction request. Review before manual payout.',
        }
      : {
          label: 'Bank review needed',
          detail: 'Partner bank details are waiting for admin review before manual payout.',
        };
  }
  if (bank.status === 'APPROVED') {
    return {
      label: 'Ready for manual payout',
      detail: 'Approved bank details can be used by finance for manual wallet withdrawal.',
    };
  }
  return {
    label: 'Review needed',
    detail: 'Check bank details before manual payout or correction request.',
  };
}

export function buildPartnerBankReviewActions(
  providerId: string,
  bank: ProviderBankAccount,
): ActionMenuItem[] {
  return [
    {
      description: approvePayoutBankDescription,
      disabled: bank.status === 'APPROVED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'approve-bank', {
        bankAccountId: bank.id,
      }),
      kind: 'link',
      label: 'Approve bank',
      tone: 'success',
    },
    {
      description: rejectPayoutBankDescription,
      disabled: bank.status === 'REJECTED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'reject-bank', {
        bankAccountId: bank.id,
      }),
      kind: 'link',
      label: 'Reject bank',
      tone: 'danger',
    },
  ];
}

export function buildPartnerTaxProfileView(provider: ProviderDetail): PartnerTaxProfileView | null {
  if (!provider.taxProfile) {
    return null;
  }

  return {
    legalName: provider.taxProfile.legalName,
    registeredAddress: provider.taxProfile.registeredAddress,
    rejectionReason: provider.taxProfile.rejectionReason,
    reviewActions: buildPartnerTaxReviewActions(provider.id, provider.taxProfile),
    status: provider.taxProfile.status,
    taxCodeLabel: `****${provider.taxProfile.taxCodeLast4 ?? '----'}`,
  };
}

export function buildPartnerTaxReviewActions(
  providerId: string,
  taxProfile: ProviderTaxProfile,
): ActionMenuItem[] {
  return [
    {
      description: approveTaxProfileDescription,
      disabled: taxProfile.status === 'APPROVED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'approve-tax'),
      kind: 'link',
      label: 'Approve tax',
      tone: 'success',
    },
    {
      description: rejectTaxProfileDescription,
      disabled: taxProfile.status === 'REJECTED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'reject-tax'),
      kind: 'link',
      label: 'Reject tax',
      tone: 'danger',
    },
  ];
}
