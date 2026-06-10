import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  blockProviderAccount,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
} from './actions';
import {
  partnerAccountServerAction,
  partnerPushDeviceServerAction,
  partnerReviewServerAction,
} from './partner-server-actions';

describe('partner server action resolvers', () => {
  it('maps account confirmation actions to server actions', () => {
    expect(partnerAccountServerAction('approve')).toBe(approveProvider);
    expect(partnerAccountServerAction('block')).toBe(blockProviderAccount);
    expect(partnerAccountServerAction('reject')).toBe(rejectProvider);
    expect(partnerAccountServerAction('sync-role')).toBe(syncSupabaseProviderRole);
    expect(partnerAccountServerAction('unblock')).toBe(unblockProviderAccount);
  });

  it('maps review confirmation actions to server actions', () => {
    expect(partnerReviewServerAction('approve-bank')).toBe(approveProviderBankAccount);
    expect(partnerReviewServerAction('approve-document')).toBe(approveProviderDocument);
    expect(partnerReviewServerAction('approve-kyc')).toBe(approveProviderKyc);
    expect(partnerReviewServerAction('approve-media')).toBe(approvePublicProviderMedia);
    expect(partnerReviewServerAction('approve-tax')).toBe(approveProviderTaxProfile);
    expect(partnerReviewServerAction('reject-bank')).toBe(rejectProviderBankAccount);
    expect(partnerReviewServerAction('reject-document')).toBe(rejectProviderDocument);
    expect(partnerReviewServerAction('reject-kyc')).toBe(rejectProviderKyc);
    expect(partnerReviewServerAction('reject-media')).toBe(rejectPublicProviderMedia);
    expect(partnerReviewServerAction('reject-tax')).toBe(rejectProviderTaxProfile);
  });

  it('maps push device confirmation actions to server actions', () => {
    expect(partnerPushDeviceServerAction('enable-device')).toBe(enablePushDevice);
  });
});
