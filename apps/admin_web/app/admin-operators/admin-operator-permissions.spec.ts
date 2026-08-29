import {
  adminOperatorPermissionCategoryDefinitions,
  adminOperatorRoleValues,
  expandLegacyAdminOperatorCategories,
  isAdminOperatorPermissionCategory,
  isAdminOperatorRole,
} from '../../lib/admin-operator-permissions';

describe('admin operator permission catalog', () => {
  it('keeps fine-grained page category options in one shared catalog', () => {
    expect(adminOperatorPermissionCategoryDefinitions.map((category) => category.key)).toEqual([
      'BOOKINGS_REALTIME',
      'BOOKINGS_IN_PROGRESS',
      'BOOKINGS_COMPLETED',
      'BOOKINGS_CANCELLATIONS',
      'BOOKINGS_DETAIL',
      'CUSTOMERS_DIRECTORY',
      'CUSTOMERS_DETAIL',
      'CUSTOMERS_REVIEWS',
      'PARTNERS_DIRECTORY',
      'PARTNERS_UNAPPROVED',
      'PARTNERS_DETAIL',
      'PARTNERS_KYC',
      'FINANCE_PAYMENT_CLEARING',
      'FINANCE_GENERAL_LEDGER',
      'FINANCE_BANK_RECONCILIATION',
      'FINANCE_WALLET_ADJUSTMENTS',
      'FINANCE_SETTLEMENTS',
      'FINANCE_TAX',
      'GROWTH_MARKETING',
      'GROWTH_MARKETING_SPEND',
      'NOTIFICATIONS_TEMPLATES',
      'NOTIFICATIONS_PUSH',
      'NOTIFICATIONS_DELIVERY',
      'NOTIFICATIONS_RETRY',
      'NOTIFICATIONS_INCIDENTS',
      'SYSTEM_SERVICES',
      'SYSTEM_COUPONS',
      'SYSTEM_ADMIN_OPERATORS',
      'SYSTEM_POLICY',
      'SYSTEM_AUDIT',
      'CONTENT_VIEW',
      'CONTENT_EDIT',
      'CONTENT_PUBLISH',
      'CONTENT_DELETE',
      'DEVELOPER_SETUP',
      'DEVELOPER_HEALTH',
      'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
      'DEVELOPER_ROUTE_COMPAT',
    ]);
  });

  it('accepts legacy parent categories while expanding them for display', () => {
    expect(isAdminOperatorPermissionCategory('FINANCE')).toBe(true);
    expect(isAdminOperatorPermissionCategory('FINANCE_TAX')).toBe(true);
    expect(isAdminOperatorPermissionCategory('UNKNOWN')).toBe(false);
    expect(expandLegacyAdminOperatorCategories(['FINANCE', 'SYSTEM_SETUP', 'SYSTEM_AUDIT', 'UNKNOWN'])).toEqual([
      'FINANCE_PAYMENT_CLEARING',
      'FINANCE_GENERAL_LEDGER',
      'FINANCE_BANK_RECONCILIATION',
      'FINANCE_WALLET_ADJUSTMENTS',
      'FINANCE_SETTLEMENTS',
      'FINANCE_TAX',
      'DEVELOPER_SETUP',
      'DEVELOPER_HEALTH',
      'DEVELOPER_ROUTE_COMPAT',
      'SYSTEM_AUDIT',
      'UNKNOWN',
    ]);
  });

  it('keeps canonical leaf permissions intact when a legacy key has the same name', () => {
    expect(expandLegacyAdminOperatorCategories(['SYSTEM_POLICY'])).toEqual(['SYSTEM_POLICY']);
  });

  it('keeps Admin-only role values constrained for operator actions', () => {
    expect(adminOperatorRoleValues).toEqual(['ADMIN', 'FINANCE_APPROVER', 'MASTER_ADMIN']);
    expect(isAdminOperatorRole('MASTER_ADMIN')).toBe(true);
    expect(isAdminOperatorRole('CUSTOMER')).toBe(false);
    expect(isAdminOperatorRole('PROVIDER')).toBe(false);
  });
});
