import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  blockProviderAccount,
  deletePartnerPublicMedia,
  enablePushDevice,
  putProviderKycOnHold,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
} from './actions';
import type { PartnerAccountConfirmationAction } from './partner-account-action-confirmation';
import type { PartnerPushDeviceConfirmationAction } from './partner-push-device-action-confirmation';
import type { PartnerReviewConfirmationAction } from './partner-review-action-confirmation';

export function partnerAccountServerAction(action: PartnerAccountConfirmationAction) {
  switch (action) {
    case 'approve':
      return approveProvider;
    case 'block':
      return blockProviderAccount;
    case 'reject':
      return rejectProvider;
    case 'sync-role':
      return syncSupabaseProviderRole;
    case 'unblock':
      return unblockProviderAccount;
  }
}

export function partnerReviewServerAction(action: PartnerReviewConfirmationAction) {
  switch (action) {
    case 'approve-bank':
      return approveProviderBankAccount;
    case 'approve-document':
      return approveProviderDocument;
    case 'approve-kyc':
      return approveProviderKyc;
    case 'approve-media':
      return approvePublicProviderMedia;
    case 'approve-tax':
      return approveProviderTaxProfile;
    case 'reject-bank':
      return rejectProviderBankAccount;
    case 'reject-document':
      return rejectProviderDocument;
    case 'reject-kyc':
      return rejectProviderKyc;
    case 'reject-media':
      return rejectPublicProviderMedia;
    case 'reject-tax':
      return rejectProviderTaxProfile;
    case 'delete-media':
      return deletePartnerPublicMedia;
    case 'hold-kyc':
      return putProviderKycOnHold;
  }
}

export function partnerPushDeviceServerAction(action: PartnerPushDeviceConfirmationAction) {
  switch (action) {
    case 'enable-device':
      return enablePushDevice;
  }
}
