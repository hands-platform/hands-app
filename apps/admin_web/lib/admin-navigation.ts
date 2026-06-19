export type AdminNavLink = {
  href: string;
  label: string;
  description: string;
};

export type AdminNavSection = {
  label: string;
  description: string;
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
    label: 'Users',
    description: 'Customer records, Partner onboarding, readiness, controls, and support evidence.',
    links: [
      {
        href: '/customers',
        label: 'Customer List',
        description: 'Customer account list with booking and payment facts.',
      },
      {
        href: '/app-sessions?role=CUSTOMER&state=live',
        label: 'Live Customers',
        description: 'Customers currently active in the app.',
      },
      {
        href: '/partners',
        label: 'Partner List',
        description: 'List and detail records for every Partner.',
      },
      {
        href: '/partners?review=kyc',
        label: 'KYC Review',
        description: 'Partner identity and document review queue.',
      },
      {
        href: '/partners?review=acceptance-blocked',
        label: 'Direct Request Held',
        description:
          'Partners held from preferred direct requests by account, identity, bank, device, location, or alert gates.',
      },
      {
        href: '/partners?review=marketplace-ready',
        label: 'Marketplace Ready',
        description: 'Partners ready for marketplace participation.',
      },
      {
        href: '/partner-controls',
        label: 'Partner Controls',
        description: 'Manual Partner state, hold, and account controls.',
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
        href: '/chat-archive',
        label: 'Chat Archive',
        description: 'All retained booking chat records for admin review.',
      },
      {
        href: '/notifications',
        label: 'Notifications',
        description: 'In-app notification records and delivery status.',
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
