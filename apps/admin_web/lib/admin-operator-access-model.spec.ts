import {
  adminOperatorCategoryForAdminApiPath,
  adminOperatorCategoryForPath,
  hasAdminOperatorCategory,
} from './admin-operator-access-model';

describe('admin operator access model', () => {
  it('maps Admin pages to operator permission categories', () => {
    expect(adminOperatorCategoryForPath('/')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForPath('/bookings/post-match-cancellations')).toBe('BOOKINGS_DETAIL');
    expect(adminOperatorCategoryForPath('/customers/customer-1')).toBe('CUSTOMERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partners/overview')).toBe('PARTNERS_DIRECTORY');
    expect(adminOperatorCategoryForPath('/partners/provider-1')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/finance-tax/payment-clearing')).toBe('FINANCE_PAYMENT_CLEARING');
    expect(adminOperatorCategoryForPath('/finance-overview')).toBe('FINANCE');
    expect(adminOperatorCategoryForPath('/finance-closeout')).toBe('FINANCE');
    expect(adminOperatorCategoryForPath('/finance-tax/coupon-finance')).toBe('FINANCE_TAX');
    expect(adminOperatorCategoryForPath('/finance-tax/finance-approvers')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForPath('/referrals/customers')).toBe('CUSTOMERS');
    expect(adminOperatorCategoryForPath('/referrals')).toBe('CUSTOMERS');
    expect(adminOperatorCategoryForPath('/referrals/partners')).toBe('PARTNERS');
    expect(adminOperatorCategoryForPath('/referrals/cashouts')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForPath('/notifications/push-send')).toBe('NOTIFICATIONS_PUSH');
    expect(adminOperatorCategoryForPath('/app-sessions')).toBe('SYSTEM_AUDIT');
    expect(adminOperatorCategoryForPath('/chat-archive')).toBe('SYSTEM_AUDIT');
    expect(adminOperatorCategoryForPath('/calendar')).toBe('SYSTEM_SETUP');
    expect(adminOperatorCategoryForPath('/operations-handoff')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForPath('/admin-operators')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForPath('/vietnam-overview')).toBe('BOOKINGS_REALTIME');
  });

  it('maps write API calls to operator permission categories', () => {
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/bookings/booking-1/ops-note')).toBe('BOOKINGS_DETAIL');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/users/user-1/admin-operator-access')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/manual-wallet-adjustments')).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/wallet-adjustments')).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/provider-wallet/deposits')).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/provider-wallet/withdrawal-requests/request-1')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/payout-batches')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/referrals/rewards/reward-1/credit')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/referrals/policies/customer')).toBe('SYSTEM_POLICY');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partners/provider-1/approve')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partner-documents/document-1/approve')).toBe('PARTNERS_KYC');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partner-bank-accounts/bank-1/reject')).toBe('PARTNERS_KYC');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/tax-policy-versions')).toBe('FINANCE_TAX');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/service-payout-rules/rule-1')).toBe('SYSTEM_SERVICES');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/marketing/spend-daily')).toBe('SYSTEM_SETUP');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/notifications/push-campaigns')).toBe('NOTIFICATIONS_DELIVERY');
  });

  it('checks detailed category membership with legacy parent fallback', () => {
    expect(hasAdminOperatorCategory(null, 'BOOKINGS')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS_DETAIL'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'FINANCE')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: [], roles: ['MASTER_ADMIN'] }, 'SYSTEM_SETUP')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: [], roles: ['MASTER_ADMIN'] }, 'BOOKINGS_REALTIME')).toBe(true);
  });
});
