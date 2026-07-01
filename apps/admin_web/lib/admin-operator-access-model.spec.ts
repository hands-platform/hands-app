import {
  adminOperatorCategoryForAdminApiPath,
  adminOperatorCategoryForPath,
  hasAdminOperatorCategory,
} from './admin-operator-access-model';

describe('admin operator access model', () => {
  it('maps Admin pages to operator permission categories', () => {
    expect(adminOperatorCategoryForPath('/bookings/post-match-cancellations')).toBe('BOOKINGS_DETAIL');
    expect(adminOperatorCategoryForPath('/customers/customer-1')).toBe('CUSTOMERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partners/provider-1')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/finance-tax/payment-clearing')).toBe('FINANCE_PAYMENT_CLEARING');
    expect(adminOperatorCategoryForPath('/notifications/push-send')).toBe('NOTIFICATIONS_PUSH');
    expect(adminOperatorCategoryForPath('/admin-operators')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForPath('/vietnam-overview')).toBe('SYSTEM_SETUP');
  });

  it('maps write API calls to operator permission categories', () => {
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/bookings/booking-1/ops-note')).toBe('BOOKINGS_DETAIL');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/users/user-1/admin-operator-access')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/manual-wallet-adjustments')).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/notifications/push-campaigns')).toBe('NOTIFICATIONS_DELIVERY');
  });

  it('checks detailed category membership with legacy parent fallback', () => {
    expect(hasAdminOperatorCategory(null, 'BOOKINGS')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS_DETAIL'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'FINANCE')).toBe(false);
  });
});
