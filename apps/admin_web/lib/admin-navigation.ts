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

export const adminNavSections: AdminNavSection[] = [
  {
    label: 'Command Center',
    description: 'Today-first workspace for live shift operation and handoff.',
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
        href: '/app-sessions',
        label: 'App Presence',
        description: 'Customers and Partners currently or recently active in the apps.',
      },
      {
        href: '/operations-handoff',
        label: 'Handoff',
        description: 'Leave a factual shift note for the next operator.',
      },
    ],
  },
  {
    label: 'Analytics',
    description: 'Regional, usage, Partner supply, and acquisition analytics.',
    links: [
      {
        href: '/vietnam-overview',
        label: 'Vietnam Overview',
        description: 'Region aggregate operating picture without individual GPS points.',
      },
      {
        href: '/usage-overview',
        label: 'Usage Overview',
        description: 'Stored app usage, Partner searches, requests, and completed-work rankings.',
      },
      {
        href: '/partners/overview',
        label: 'Partner Overview',
        description: 'Supply health, readiness funnel, quality risk, wallet exposure, and action queues.',
      },
      {
        href: '/marketing-analytics',
        label: 'Marketing Analytics',
        description: 'Acquisition source, campaign, region, signup, booking, and revenue funnel aggregates.',
      },
    ],
  },
  {
    label: 'Bookings',
    description: 'One booking workspace for demand, matching, marketplace, chat, and closeout evidence.',
    links: [
      {
        href: '/bookings',
        label: 'All Bookings',
        description:
          'Live booking workspace for request intake, matching, Partner handoff, chat repair, and active service checks.',
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
    label: 'Users',
    description: 'Customer account, referral, review, and customer-evaluation records.',
    links: [
      {
        href: '/customers',
        label: 'Customers',
        description: 'Customer account list with booking and payment facts.',
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
    description: 'Approved Partners, approval queues, and wallet settlement risk.',
    links: [
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
        description: 'Tax, fee, VAT, PIT, payment fee, and settlement snapshot command view.',
      },
      {
        href: '/finance-tax/general-ledger',
        label: 'General Ledger',
        description: 'Accounting journal batches for settlement, reversals, adjustments, refunds, and payouts.',
      },
      {
        href: '/finance-tax/bank-reconciliation',
        label: 'Bank Reconciliation',
        description: 'Company bank transactions and reconciliation status for manual finance closeout.',
      },
      {
        href: '/finance-tax/booking-settlement-audit',
        label: 'Booking Settlement Audit',
        description: 'Immutable booking settlement snapshots for tax and finance audit review.',
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
        description: 'Payment processing fees by method, payer, and treatment from settlement snapshots.',
      },
      {
        href: '/finance-tax/finance-approvers',
        label: 'Finance Approvers',
        description: 'Finance action approver setup for role separation and dual-control closeout.',
      },
      {
        href: '/tax-policy',
        label: 'Tax Policy',
        description: 'Versioned Vietnam freelance withholding rules.',
      },
    ],
  },
  {
    label: 'Communications',
    description: 'Notification records, templates, and push-send operations.',
    links: [
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
    label: 'Policies & Setup',
    description: 'Operational rules, service catalog, coupons, and production readiness.',
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
      {
        href: '/coupons',
        label: 'Coupons',
        description: 'Coupon codes and discount exposure.',
      },
      {
        href: '/setup',
        label: 'Setup',
        description: 'External integration and production readiness checklist.',
      },
    ],
  },
  {
    label: 'Admin Control',
    description: 'Operator permissions and retained admin audit trail.',
    links: [
      {
        href: '/admin-operators',
        label: 'Admin Operators',
        description: 'Master Admin workspace for operator access, category permissions, and admin role review.',
      },
      {
        href: '/audit-log',
        label: 'Audit Log',
        description: 'Admin and system audit trail.',
      },
    ],
  },
];
