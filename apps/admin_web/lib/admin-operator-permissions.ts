import type { AdminOperatorPermissionCategory } from './admin-operator-access-model';

export const ADMIN_OPERATOR_BASE_ROLE = 'ADMIN';
export const FINANCE_APPROVER_ROLE = 'FINANCE_APPROVER';
export const MASTER_ADMIN_ROLE = 'MASTER_ADMIN';

export const adminOperatorRoleValues = [
  ADMIN_OPERATOR_BASE_ROLE,
  FINANCE_APPROVER_ROLE,
  MASTER_ADMIN_ROLE,
] as const;

export type AdminOperatorRoleValue = (typeof adminOperatorRoleValues)[number];

export const adminOperatorAssignableRoleFields = [
  { label: 'Master Admin', value: MASTER_ADMIN_ROLE },
  { label: 'Finance Approver', value: FINANCE_APPROVER_ROLE },
] as const;

export type AdminOperatorPermissionCategoryDefinition = {
  readonly group: string;
  readonly key: AdminOperatorPermissionCategory;
  readonly label: string;
  readonly scope: string;
  readonly defaultOwner: string;
};

export const adminOperatorPermissionCategoryDefinitions = [
  {
    group: 'Bookings',
    key: 'BOOKINGS_REALTIME',
    label: 'Realtime bookings',
    scope: 'Open matching queue and live booking monitor',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_IN_PROGRESS',
    label: 'Post-match / In progress',
    scope: 'Matched bookings, live work state, partner progress evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_COMPLETED',
    label: 'Completed bookings',
    scope: 'Completed booking lists, closeout detail, settlement evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_CANCELLATIONS',
    label: 'Booking cancellations',
    scope: 'Pre-match and post-match cancellation review',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Bookings',
    key: 'BOOKINGS_DETAIL',
    label: 'Booking detail',
    scope: 'Booking detail, chat evidence, customer/partner operational evidence',
    defaultOwner: 'Operations Admin',
  },
  {
    group: 'Users',
    key: 'CUSTOMERS_DIRECTORY',
    label: 'Customer directory',
    scope: 'Customer list, filters, customer summary',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Users',
    key: 'CUSTOMERS_DETAIL',
    label: 'Customer detail',
    scope: 'Customer profile, addresses, booking history, wallet evidence',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Users',
    key: 'CUSTOMERS_REVIEWS',
    label: 'Customer reviews',
    scope: 'Customer reviews and partner customer evaluations',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_DIRECTORY',
    label: 'Partner directory',
    scope: 'Partner list, marketplace-ready and unsettled partner views',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_UNAPPROVED',
    label: 'Unapproved partners',
    scope: 'KYC review, registration hold, approval and reject workflows',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_DETAIL',
    label: 'Partner detail',
    scope: 'Partner profile, service pricing, wallet, reviews and controls',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Partners',
    key: 'PARTNERS_KYC',
    label: 'Partner KYC',
    scope: 'Document evidence, verification files, sanctions and hold reasons',
    defaultOwner: 'Partner Admin',
  },
  {
    group: 'Finance',
    key: 'FINANCE_PAYMENT_CLEARING',
    label: 'Payment clearing',
    scope: 'Booking payment clearing and payment fee evidence',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Tax & Accounting',
    key: 'FINANCE_GENERAL_LEDGER',
    label: 'General ledger',
    scope: 'Journal batches, entries, accounting evidence',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Tax & Accounting',
    key: 'FINANCE_BANK_RECONCILIATION',
    label: 'Bank reconciliation',
    scope: 'Bank transactions, matching, reconciliation delta review',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_WALLET_ADJUSTMENTS',
    label: 'Wallet adjustments',
    scope: 'Customer and partner manual wallet adjustment approval',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Finance',
    key: 'FINANCE_SETTLEMENTS',
    label: 'Settlements',
    scope: 'Cash settlements, earnings, withdrawals, payout closeout',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Tax & Accounting',
    key: 'FINANCE_TAX',
    label: 'Tax and VAT',
    scope: 'Finance tax, platform VAT, withholding and monthly close',
    defaultOwner: 'Finance Approver',
  },
  {
    group: 'Growth & Communications',
    key: 'GROWTH_MARKETING',
    label: 'Marketing analytics',
    scope: 'Acquisition source, campaign spend, referral, coupon and booking conversion analytics',
    defaultOwner: 'Growth Admin',
  },
  {
    group: 'Growth & Communications',
    key: 'NOTIFICATIONS_TEMPLATES',
    label: 'Notification templates',
    scope: 'Notification wording, language variants, template controls',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Growth & Communications',
    key: 'NOTIFICATIONS_PUSH',
    label: 'Push send',
    scope: 'Push audience filters, campaign send and deep link targets',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Growth & Communications',
    key: 'NOTIFICATIONS_DELIVERY',
    label: 'Delivery evidence',
    scope: 'Push delivery log, failed deliveries and notification history',
    defaultOwner: 'Support Admin',
  },
  {
    group: 'Policies',
    key: 'SYSTEM_SERVICES',
    label: 'Services',
    scope: 'Service catalog, duration options, pricing and payout defaults',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Growth & Communications',
    key: 'SYSTEM_COUPONS',
    label: 'Coupons',
    scope: 'Coupon creation, usage, edit and delete workflows',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Admin Control',
    key: 'SYSTEM_ADMIN_OPERATORS',
    label: 'Admin operators',
    scope: 'Operator creation, role assignment, category access and revocation',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Policies',
    key: 'SYSTEM_POLICY',
    label: 'Operations policy',
    scope: 'Operations policy, partner levels, wallet and bank policy settings',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Admin Control',
    key: 'SYSTEM_AUDIT',
    label: 'Audit log',
    scope: 'Admin action history, operator activity and retained evidence search',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Developer / System',
    key: 'DEVELOPER_SETUP',
    label: 'Setup readiness',
    scope: 'External integration credentials, production readiness, and setup checks',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Developer / System',
    key: 'DEVELOPER_HEALTH',
    label: 'System health',
    scope: 'Internal health and realtime diagnostics that are not daily operator actions',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Developer / System',
    key: 'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
    label: 'App session diagnostics',
    scope: 'Detailed customer and Partner app session diagnostics',
    defaultOwner: 'Master Admin',
  },
  {
    group: 'Developer / System',
    key: 'DEVELOPER_ROUTE_COMPAT',
    label: 'Route compatibility',
    scope: 'Legacy route compatibility and technical route inventory checks',
    defaultOwner: 'Master Admin',
  },
] as const satisfies readonly AdminOperatorPermissionCategoryDefinition[];

export const legacyAdminOperatorPermissionGroups: Record<string, readonly AdminOperatorPermissionCategory[]> = {
  BOOKINGS: [
    'BOOKINGS_REALTIME',
    'BOOKINGS_IN_PROGRESS',
    'BOOKINGS_COMPLETED',
    'BOOKINGS_CANCELLATIONS',
    'BOOKINGS_DETAIL',
  ],
  CUSTOMERS: ['CUSTOMERS_DIRECTORY', 'CUSTOMERS_DETAIL', 'CUSTOMERS_REVIEWS'],
  FINANCE: [
    'FINANCE_PAYMENT_CLEARING',
    'FINANCE_GENERAL_LEDGER',
    'FINANCE_BANK_RECONCILIATION',
    'FINANCE_WALLET_ADJUSTMENTS',
    'FINANCE_SETTLEMENTS',
    'FINANCE_TAX',
  ],
  GROWTH: ['GROWTH_MARKETING'],
  NOTIFICATIONS: ['NOTIFICATIONS_TEMPLATES', 'NOTIFICATIONS_PUSH', 'NOTIFICATIONS_DELIVERY'],
  PARTNERS: ['PARTNERS_DIRECTORY', 'PARTNERS_UNAPPROVED', 'PARTNERS_DETAIL', 'PARTNERS_KYC'],
  SYSTEM: [
    'SYSTEM_SERVICES',
    'SYSTEM_COUPONS',
    'SYSTEM_ADMIN_OPERATORS',
    'SYSTEM_POLICY',
    'SYSTEM_AUDIT',
  ],
  DEVELOPER_SYSTEM: [
    'DEVELOPER_SETUP',
    'DEVELOPER_HEALTH',
    'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
    'DEVELOPER_ROUTE_COMPAT',
  ],
  SYSTEM_SETUP: ['DEVELOPER_SETUP', 'DEVELOPER_HEALTH', 'DEVELOPER_ROUTE_COMPAT'],
};

const adminOperatorPermissionCategorySet = new Set<string>([
  ...Object.keys(legacyAdminOperatorPermissionGroups),
  ...adminOperatorPermissionCategoryDefinitions.map((category) => category.key),
]);

const adminOperatorRoleSet = new Set<string>(adminOperatorRoleValues);

export function isAdminOperatorPermissionCategory(value: unknown): value is AdminOperatorPermissionCategory {
  return typeof value === 'string' && adminOperatorPermissionCategorySet.has(value);
}

export function isAdminOperatorRole(value: unknown): value is AdminOperatorRoleValue {
  return typeof value === 'string' && adminOperatorRoleSet.has(value);
}

export function expandLegacyAdminOperatorCategories(categories: readonly string[]) {
  return [
    ...new Set(
      categories.flatMap((category) => legacyAdminOperatorPermissionGroups[category] ?? [category]),
    ),
  ];
}
