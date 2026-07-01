import {
  adminOperatorCategoryForAdminApiPath,
  adminOperatorCategoryForPath,
  hasAdminOperatorCategory,
} from './admin-operator-access-model';

describe('admin operator access model', () => {
  it('maps Admin pages to operator permission categories', () => {
    expect(adminOperatorCategoryForPath('/bookings/post-match-cancellations')).toBe('BOOKINGS');
    expect(adminOperatorCategoryForPath('/customers/customer-1')).toBe('CUSTOMERS');
    expect(adminOperatorCategoryForPath('/partners/provider-1')).toBe('PARTNERS');
    expect(adminOperatorCategoryForPath('/finance-tax/payment-clearing')).toBe('FINANCE');
    expect(adminOperatorCategoryForPath('/notifications/push-send')).toBe('NOTIFICATIONS');
    expect(adminOperatorCategoryForPath('/admin-operators')).toBe('SYSTEM');
    expect(adminOperatorCategoryForPath('/vietnam-overview')).toBeNull();
  });

  it('maps write API calls to operator permission categories', () => {
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/bookings/booking-1/ops-note')).toBe('BOOKINGS');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/users/user-1/admin-operator-access')).toBe('SYSTEM');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/manual-wallet-adjustments')).toBe('FINANCE');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/notifications/push-campaigns')).toBe('NOTIFICATIONS');
  });

  it('checks exact category membership without treating missing access as allowed', () => {
    expect(hasAdminOperatorCategory(null, 'BOOKINGS')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'FINANCE')).toBe(false);
  });
});
