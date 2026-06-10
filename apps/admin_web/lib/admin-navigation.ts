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

export const adminShiftFlow: AdminNavLink[] = [
  {
    href: '/',
    label: 'Start Shift',
    description: 'Open the command dashboard and review today first.',
  },
  {
    href: '/bookings?view=attention',
    label: 'Urgent Bookings',
    description: 'Check bookings that need operator action.',
  },
  {
    href: '/bookings?view=marketplace',
    label: 'Marketplace',
    description: 'Watch 10km partner participation and customer choice.',
  },
  {
    href: '/cash-settlements',
    label: 'Cash Debt',
    description: 'Clear partner wallet debt from cash bookings.',
  },
  {
    href: '/operations-handoff',
    label: 'Handoff',
    description: 'Leave a factual shift note for the next operator.',
  },
];

export const adminNavSections: AdminNavSection[] = [
  {
    label: 'Command',
    description: 'Live operating picture for the current shift.',
    links: [
      {
        href: '/',
        label: 'Command Dashboard',
        description: 'Top-level booking, finance, partner, customer, and setup signals.',
      },
      {
        href: '/operations-handoff',
        label: 'Shift Handoff',
        description: 'Operator notes and unresolved work for the next shift.',
      },
      {
        href: '/app-sessions',
        label: 'App Presence',
        description: 'Customers and partners currently or recently active in the apps.',
      },
      {
        href: '/notifications?review=failed',
        label: 'Failed Alerts',
        description: 'Notifications that failed and may need retry or follow-up.',
      },
    ],
  },
  {
    label: 'Bookings',
    description: 'Demand, marketplace participation, customer choice, and closeout evidence.',
    links: [
      {
        href: '/bookings',
        label: 'All Bookings',
        description: 'Complete booking list with filters and detail links.',
      },
      {
        href: '/bookings?view=attention',
        label: 'Attention Queue',
        description: 'Bookings that need immediate operator review.',
      },
      {
        href: '/bookings?view=matching',
        label: 'Live Matching',
        description: 'First-pick and marketplace matching windows.',
      },
      {
        href: '/bookings?view=customer-choice',
        label: 'Customer Choice',
        description: 'Bookings waiting for the customer to select the final partner.',
      },
      {
        href: '/bookings?view=marketplace',
        label: '10km Marketplace',
        description: 'Eligible partner participation around the booking address.',
      },
      {
        href: '/bookings?view=chat-repair',
        label: 'Chat Repair',
        description: 'Matched bookings that need chat-room repair.',
      },
      {
        href: '/bookings?view=no-show',
        label: 'No-show Evidence',
        description: 'Evidence queue for admin-reviewed cancellation and no-show decisions.',
      },
    ],
  },
  {
    label: 'Partners',
    description: 'Partner onboarding, readiness, wallet gates, and operating controls.',
    links: [
      {
        href: '/partners',
        label: 'Partner List',
        description: 'List and detail records for every partner.',
      },
      {
        href: '/partners?review=kyc',
        label: 'KYC Review',
        description: 'Partner identity and document review queue.',
      },
      {
        href: '/partners?review=acceptance-blocked',
        label: 'Direct Request Held',
        description: 'Partners held from preferred direct requests by account, identity, bank, device, location, or alert gates.',
      },
      {
        href: '/partners?review=marketplace-ready',
        label: 'Marketplace Ready',
        description: 'Partners ready for marketplace participation.',
      },
      {
        href: '/partner-controls',
        label: 'Partner Controls',
        description: 'Manual partner state, hold, and account controls.',
      },
    ],
  },
  {
    label: 'Customers',
    description: 'Customer records, booking history, wallet, addresses, and support evidence.',
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
        href: '/chat-archive',
        label: 'Customer Chat Evidence',
        description: 'Admin-retained chat history for matched bookings.',
      },
    ],
  },
  {
    label: 'Finance',
    description: 'Payments, partner earnings, wallet debt, payout batches, and refunds.',
    links: [
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
        href: '/earnings',
        label: 'Earnings',
        description: 'Partner earning rows, fee/tax logs, and settlement impact.',
      },
      {
        href: '/cash-settlements',
        label: 'Cash Settlements',
        description: 'Partner company receivables from cash bookings.',
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
    label: 'Policy',
    description: 'Runtime rules that operators can change without code edits.',
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
    ],
  },
  {
    label: 'Evidence and System',
    description: 'Audit trails, retained records, moderation, setup, and production readiness.',
    links: [
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
        label: 'Feedback',
        description: 'Customer feedback records for service evidence and follow-up.',
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
