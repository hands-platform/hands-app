import type { AdminOperatorAccessLike } from './admin-operator-access-model';

export type AdminNavLink = {
  href: string;
  label: string;
  description: string;
};

export type AdminNavSection = {
  label: string;
  description: string;
  attentionCount?: number;
  links: AdminNavLink[];
};

const developerSystemCategories = new Set([
  'DEVELOPER_SYSTEM',
  'DEVELOPER_SETUP',
  'DEVELOPER_HEALTH',
  'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
  'DEVELOPER_ROUTE_COMPAT',
  'SYSTEM_SETUP',
]);

export const adminNavSections: AdminNavSection[] = [
  {
    label: 'Shift Operations',
    description: 'Today-first workspace for live shift control and historical review.',
    links: [
      {
        href: '/',
        label: 'Start Shift',
        description: 'Open the command dashboard and review today first.',
      },
      {
        href: '/calendar',
        label: 'Calendar',
        description: 'Shared operations calendar for live planning and follow-up blocks.',
      },
      {
        href: '/operations-handoff',
        label: 'Operations History',
        description: 'Review dated booking, finance, alert, and operator-note history.',
      },
    ],
  },
  {
    label: 'Bookings',
    description: 'One booking workspace for demand, matching, marketplace, chat, and closeout evidence.',
    links: [
      {
        href: '/bookings',
        label: 'Live Bookings',
        description:
          'Live booking workspace for request intake, matching, Partner coordination, chat repair, and active service checks.',
      },
      {
        href: '/bookings/completed',
        label: 'Completed',
        description:
          'Completed booking workspace for closeout, payment, wallet debt, pricing, refund, and expired records.',
      },
      {
        href: '/bookings/post-match-cancellations',
        label: 'Post-match Cancellations',
        description:
          'Post-match cancellation workspace for fee restoration, evidence review, no-show checks, and final admin decisions.',
      },
    ],
  },
  {
    label: 'Customers',
    description: 'Customer accounts, usage, referrals, reviews, and customer-evaluation records.',
    links: [
      {
        href: '/customers',
        label: 'Customers',
        description: 'Customer account list with booking and payment facts.',
      },
      {
        href: '/usage-overview',
        label: 'Usage Overview',
        description: 'Customer app usage, Partner searches, requests, and completed-work rankings.',
      },
      {
        href: '/referrals/customers',
        label: 'Customer Referrals',
        description: 'Parent customer accounts with referred customer sign-ups and wallet reward exposure.',
      },
      {
        href: '/reviews',
        label: 'Customer Reviews',
        description: 'Customer review records, app visibility, and moderation follow-up.',
      },
      {
        href: '/reviews/partner-customer-evaluations',
        label: 'Partner Evaluations',
        description: 'Partner-written text evaluations about customers after completed booking work.',
      },
    ],
  },
  {
    label: 'Partners',
    description: 'Partner overview, approval queues, approved Partners, and wallet settlement risk.',
    links: [
      {
        href: '/partners/overview',
        label: 'Partner Overview',
        description: 'Supply status, approval funnel, quality risk, wallet exposure, and action queues.',
      },
      {
        href: '/partners',
        label: 'Partners',
        description: 'Approved and active Partner records with detail review access.',
      },
      {
        href: '/partners?review=unapproved',
        label: 'Unapproved Partners',
        description:
          'Partner registration, KYC, required documents, public media, or hold items waiting for admin approval.',
      },
      {
        href: '/partners?review=unsettled',
        label: 'Unsettled Partners',
        description: 'Partners whose wallet balance is negative from unpaid HANDS commission.',
      },
      {
        href: '/referrals/partners',
        label: 'Partner Referrals',
        description: 'Parent Partner accounts with referred Partner onboarding and fixed reward exposure.',
      },
      {
        href: '/files',
        label: 'Files',
        description: 'Partner verification files and public media moderation.',
      },
    ],
  },
  {
    label: 'Analytics',
    description: 'Regional operating picture for operator review.',
    links: [
      {
        href: '/vietnam-overview',
        label: 'Vietnam Overview',
        description: 'Region aggregate operating picture without individual GPS points.',
      },
    ],
  },
  {
    label: 'Growth & Communications',
    description: 'Acquisition, coupons, notification records, templates, and push-send operations.',
    links: [
      {
        href: '/marketing-analytics',
        label: 'Marketing Analytics',
        description: 'Acquisition source, campaign, region, signup, booking, and revenue funnel aggregates.',
      },
      {
        href: '/coupons',
        label: 'Coupons',
        description: 'Coupon codes and discount exposure.',
      },
      {
        href: '/notifications',
        label: 'Notifications',
        description: 'In-app notification records and delivery status.',
      },
      {
        href: '/notifications/templates',
        label: 'Notification Templates',
        description: 'Language-specific notification titles and message bodies.',
      },
      {
        href: '/notifications/push-send',
        label: 'Push Send',
        description: 'Manual push send workspace with recipient preview.',
      },
    ],
  },
  {
    label: 'Finance',
    description: 'Payments, wallet movement, payouts, refunds, and cash debt.',
    links: [
      {
        href: '/finance-overview',
        label: 'Finance Overview',
        description:
          'Gross customer payments, platform fee revenue, Partner payable, wallet exposure, refunds, tax, and reconciliation risk.',
      },
      {
        href: '/finance-tax/approval-queue',
        label: 'Approval Queue',
        description: 'Payment fee policy reviews, Partner withdrawal work, and recent wallet approval evidence.',
      },
      {
        href: '/finance-closeout',
        label: 'Finance Closeout',
        description: 'Daily, weekly, monthly, and manual closeout view.',
      },
      {
        href: '/payments',
        label: 'Payments',
        description: 'Gateway, cash, refund, and payment-state operations.',
      },
      {
        href: '/finance-tax/payment-clearing',
        label: 'Payment Clearing',
        description: 'Customer payment capture, settlement posting, refund, payment fee, and coupon offset queue.',
      },
      {
        href: '/cash-settlements',
        label: 'Cash Debt',
        description: 'Clear Partner wallet debt from cash bookings.',
      },
      {
        href: '/finance-tax/partner-bank-deposits',
        label: 'Partner Bank Deposits',
        description: 'Bank evidence, approved wallet credits, GL posting, and explicit cash-debt allocation history.',
      },
      {
        href: '/wallet-adjustments',
        label: 'Wallet Adjustments',
        description:
          'Preview and create approved customer or Partner wallet credits, debits, and reversals without moving bank/cash.',
      },
      {
        href: '/earnings',
        label: 'Earnings',
        description: 'Partner earning rows, fee/tax logs, and settlement impact.',
      },
      {
        href: '/payouts',
        label: 'Payouts',
        description: 'Weekly, monthly, and manual payout batches.',
      },
      {
        href: '/referrals/cashouts',
        label: 'Referral Cashouts',
        description: 'Customer and Partner referral cashout requests, tax review, and manual paid closeout.',
      },
      {
        href: '/refunds',
        label: 'Refunds',
        description: 'Admin refund queue and refund history.',
      },
    ],
  },
  {
    label: 'Tax & Accounting',
    description: 'Tax, ledger, settlement audit, bank reconciliation, and monthly close.',
    links: [
      {
        href: '/finance-tax',
        label: 'Tax Overview',
        description: 'Tax, fee, VAT, PIT, payment fee, and settlement record command view.',
      },
      {
        href: '/finance-tax/general-ledger',
        label: 'General Ledger',
        description: 'Accounting journal batches for settlement, reversals, adjustments, refunds, and payouts.',
      },
      {
        href: '/finance-tax/bank-reconciliation',
        label: 'Bank Reconciliation',
        description:
          'Company bank transactions, active company bank accounts, and reconciliation status for manual finance closeout.',
      },
      {
        href: '/finance-tax/company-bank-accounts',
        label: 'Company Bank Accounts',
        description: 'Company settlement bank accounts used by manual import and reconciliation evidence.',
      },
      {
        href: '/finance-tax/booking-settlement-audit',
        label: 'Booking Settlement Audit',
        description: 'Immutable booking settlement records for tax and finance audit review.',
      },
      {
        href: '/finance-tax/coupon-finance',
        label: 'Coupon Finance',
        description: 'Coupon-funded settlement rows, company expense exposure, and tax review flags.',
      },
      {
        href: '/finance-tax/settlement-reversals',
        label: 'Settlement Reversals',
        description: 'Closed-period refund and settlement reversal rows with accounting impact.',
      },
      {
        href: '/finance-tax/monthly-tax-closing',
        label: 'Monthly Tax Closing',
        description: 'Monthly platform VAT, Partner withholding, payment fee, and reconciliation closeout.',
      },
      {
        href: '/finance-tax/platform-vat',
        label: 'Platform VAT',
        description: 'Company output VAT from HANDS platform fee by monthly VAT rate bucket.',
      },
      {
        href: '/finance-tax/partner-withholding-tax',
        label: 'Partner Withholding Tax',
        description: 'Monthly Partner VAT/PIT withholding totals grouped by Partner.',
      },
      {
        href: '/finance-tax/payment-fees',
        label: 'Payment Fees',
        description: 'Payment processing fees by method, payer, and treatment from settlement records.',
      },
      {
        href: '/tax-policy',
        label: 'Tax Policy',
        description: 'Versioned Vietnam freelance withholding rules.',
      },
    ],
  },
  {
    label: 'Policies',
    description: 'Operational rules and service catalog controls.',
    links: [
      {
        href: '/operations-policy',
        label: 'Operations Policy',
        description: 'First-pick, marketplace radius, timeout, and gate settings.',
      },
      {
        href: '/services',
        label: 'Service Catalog',
        description: 'Service names, duration options, prices, and payout rules.',
      },
    ],
  },
  {
    label: 'Admin Control',
    description: 'Operator permissions, finance approvers, and retained admin audit trail.',
    links: [
      {
        href: '/admin-operators',
        label: 'Admin Operators',
        description: 'Master Admin workspace for operator access, category permissions, and admin role review.',
      },
      {
        href: '/finance-tax/finance-approvers',
        label: 'Finance Approvers',
        description: 'Finance action approver policy for role separation and dual-control closeout.',
      },
      {
        href: '/audit-log',
        label: 'Audit Log',
        description: 'Admin and system audit trail.',
      },
    ],
  },
];

export const developerSystemNavSection: AdminNavSection = {
  label: 'Developer / System',
  description: 'Master-only technical readiness, integration health, and app session diagnostics.',
  links: [
    {
      href: '/setup',
      label: 'Setup Readiness',
      description: 'External integration readiness, credentials, and production launch checks.',
    },
    {
      href: '/app-sessions',
      label: 'App Session Diagnostics',
      description: 'Customer and Partner app session diagnostics for system investigation.',
    },
    {
      href: '/background-jobs',
      label: 'Background Jobs',
      description: 'Queue workers, recurring jobs, retained failures, and retry health.',
    },
  ],
};

export const allAdminNavSections: AdminNavSection[] = [
  ...adminNavSections,
  developerSystemNavSection,
];

export function adminNavSectionsForAccess(access: AdminOperatorAccessLike): AdminNavSection[] {
  if (canSeeDeveloperSystem(access)) {
    return allAdminNavSections;
  }

  return adminNavSections;
}

function canSeeDeveloperSystem(access: AdminOperatorAccessLike) {
  if (access?.roles?.includes('MASTER_ADMIN')) {
    return true;
  }

  return Boolean(access?.categories.some((category) => developerSystemCategories.has(category)));
}
