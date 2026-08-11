import {
  partnerAccountActionConfirmHref,
  type PartnerAccountConfirmationAction,
} from '../partner-account-action-confirmation';
import {
  partnerReviewActionConfirmHref,
  type PartnerReviewConfirmationAction,
} from '../partner-review-action-confirmation';

export type PartnerOperatorCommandAction =
  | { readonly type: 'link'; readonly href: string; readonly label: string }
  | { readonly type: 'approve-profile'; readonly label: string }
  | { readonly type: 'reject-profile'; readonly label: string }
  | { readonly type: 'hold-account'; readonly label: string }
  | { readonly type: 'sync-role'; readonly label: string }
  | { readonly type: 'unblock-account'; readonly label: string }
  | { readonly type: 'approve-kyc'; readonly label: string }
  | { readonly type: 'reject-kyc'; readonly label: string }
  | { readonly type: 'approve-bank'; readonly bankAccountId: string; readonly label: string }
  | { readonly type: 'reject-bank'; readonly bankAccountId: string; readonly label: string }
  | { readonly type: 'reject-tax'; readonly label: string }
  | { readonly type: 'approve-tax'; readonly label: string };

export function partnerOperatorCommandActionHref(providerId: string, action: PartnerOperatorCommandAction) {
  switch (action.type) {
    case 'approve-profile':
      return partnerDetailAccountConfirmHref(providerId, 'approve');
    case 'reject-profile':
      return partnerDetailAccountConfirmHref(providerId, 'reject');
    case 'hold-account':
      return partnerDetailAccountConfirmHref(providerId, 'block');
    case 'approve-kyc':
      return partnerDetailReviewConfirmHref(providerId, 'approve-kyc');
    case 'reject-kyc':
      return partnerDetailReviewConfirmHref(providerId, 'reject-kyc');
    case 'approve-bank':
      return partnerDetailReviewConfirmHref(providerId, 'approve-bank', {
        bankAccountId: action.bankAccountId,
      });
    case 'reject-bank':
      return partnerDetailReviewConfirmHref(providerId, 'reject-bank', {
        bankAccountId: action.bankAccountId,
      });
    case 'approve-tax':
      return partnerDetailReviewConfirmHref(providerId, 'approve-tax');
    case 'reject-tax':
      return partnerDetailReviewConfirmHref(providerId, 'reject-tax');
    case 'link':
      return action.href;
    case 'sync-role':
      return partnerDetailAccountConfirmHref(providerId, 'sync-role');
    case 'unblock-account':
      return partnerDetailAccountConfirmHref(providerId, 'unblock');
  }
}

function partnerDetailAccountConfirmHref(providerId: string, action: PartnerAccountConfirmationAction) {
  return partnerAccountActionConfirmHref(providerId, action, {
    baseHref: partnerDetailBaseHref(providerId),
  });
}

function partnerDetailReviewConfirmHref(
  providerId: string,
  action: PartnerReviewConfirmationAction,
  target: { readonly bankAccountId?: string } = {},
) {
  return partnerReviewActionConfirmHref(providerId, action, target, {
    baseHref: partnerDetailBaseHref(providerId),
  });
}

function partnerDetailBaseHref(providerId: string) {
  return `/partners/${encodeURIComponent(providerId)}?section=control&control=work`;
}
