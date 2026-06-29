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
    label: 'Command',
    description: 'Live operating picture for the current shift.',
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
        href: '/marketing-analytics',
        label: 'Marketing Analytics',
        description: 'Acquisition source, campaign, region, signup, booking, and revenue funnel aggregates.',
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
    label: 'Customers',
    description: 'Customer account, booking, payment, review, and support records.',
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
    ],
  },
  {
    label: 'Finance',
    description: 'Payments, Partner earnings, wallet debt, payout batches, and refunds.',
    links: [
      {
        href: '/finance-closeout',
        label: 'Finance Closeout',
        description: 'Daily, weekly, monthly, and manual closeout view.',
      },
      {
        href: '/cash-settlements',
        label: 'Cash Debt',
        description: 'Clear Partner wallet debt from cash bookings.',
      },
      {
        href: '/finance-tax',
        label: 'Tax Overview',
        description: 'Tax, fee, VAT, PIT, payment fee, and settlement snapshot command view.',
      },
      {
        href: '/finance-tax/partner-withholding-tax',
        label: 'Partner Withholding Tax',
        description: 'Monthly Partner VAT/PIT withholding totals grouped by Partner.',
      },
      {
        href: '/finance-tax/booking-settlement-audit',
        label: 'Booking Settlement Audit',
        description: 'Immutable booking settlement snapshots for tax and finance audit review.',
      },
      {
        href: '/finance-tax/monthly-tax-closing',
        label: 'Monthly Tax Closing',
        description: 'Monthly platform VAT, Partner withholding, payment fee, and reconciliation closeout.',
      },
      {
        href: '/payments',
        label: 'Payments',
        description: 'Gateway, cash, refund, and payment-state operations.',
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
        href: '/refunds',
        label: 'Refunds',
        description: 'Admin refund queue and refund history.',
      },
    ],
  },
  {
    label: 'System',
    description: 'Runtime policy, retained evidence, audit trails, setup, and production readiness.',
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
        href: '/tax-policy',
        label: 'Tax Policy',
        description: 'Versioned Vietnam freelance withholding rules.',
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
      {
        href: '/files',
        label: 'Files',
        description: 'Partner verification files and public media moderation.',
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
      {
        href: '/audit-log',
        label: 'Audit Log',
        description: 'Admin and system audit trail.',
      },
      {
        href: '/setup',
        label: 'Setup',
        description: 'External integration and production readiness checklist.',
      },
    ],
  },
];
