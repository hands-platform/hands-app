import {
  adminOperatorCategoryForPath,
  hasAdminOperatorCategory,
  type AdminOperatorAccessLike,
} from './admin-operator-access-model';

export const adminNavIconKeys = [
  'activity',
  'adjustments',
  'approvals',
  'audit',
  'bank',
  'bookings',
  'calendar',
  'cash',
  'chat',
  'closeout',
  'command',
  'content',
  'controls',
  'coupons',
  'customers',
  'finance',
  'growth',
  'handoff',
  'ledger',
  'map',
  'messaging',
  'partners',
  'payments',
  'policy',
  'referrals',
  'refunds',
  'services',
  'settings',
  'system',
  'tax',
  'wallet',
] as const;

export type AdminNavIconKey = (typeof adminNavIconKeys)[number];

export type AdminNavSearchEntry = {
  readonly aliases?: readonly string[];
  readonly description?: string;
  readonly href: string;
  readonly iconKey: AdminNavIconKey;
  readonly id: string;
  readonly label: string;
};

export type AdminNavLink = {
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly href: string;
  readonly iconKey: AdminNavIconKey;
  readonly id: string;
  readonly label: string;
  readonly searchEntries?: readonly AdminNavSearchEntry[];
};

export type AdminNavLocalGroup = {
  readonly description: string;
  readonly iconKey: AdminNavIconKey;
  readonly id: string;
  readonly label: string;
  readonly links: readonly AdminNavLink[];
};

export type AdminNavSection = {
  readonly attentionCount?: number;
  readonly description: string;
  readonly href?: string;
  readonly iconKey: AdminNavIconKey;
  readonly id: string;
  readonly label: string;
  readonly links: readonly AdminNavLink[];
  readonly localGroups?: readonly AdminNavLocalGroup[];
};

export type AdminWorkspaceNavigationGroup = {
  readonly id: string;
  readonly label: string;
  readonly links: readonly AdminNavLink[];
};

const bookingCloseoutLinks = [
  navLink(
    'booking-closeout-completed',
    'closeout',
    '/bookings/completed',
    'Completed Services',
    'Review completed services, closeout checks, and retained records.',
  ),
  navLink(
    'booking-closeout-cancellations',
    'closeout',
    '/bookings/post-match-cancellations',
    'Post-match Cancellations',
    'Review post-match cancellations, no-show evidence, and final outcomes.',
  ),
] as const;

const customerSignalLinks = [
  navLink(
    'customer-signals-reviews',
    'customers',
    '/reviews',
    'Customer Reviews',
    'Moderate customer reviews and app visibility.',
  ),
  navLink(
    'customer-signals-partner-notes',
    'chat',
    '/reviews/partner-customer-evaluations',
    'Partner Notes',
    'Search internal Partner notes about customers after completed work.',
  ),
] as const;

const insightLinks = [
  navLink(
    'insights-marketing',
    'growth',
    '/marketing-analytics',
    'Marketing Analytics',
    'Compare acquisition, campaign conversion, and revenue.',
  ),
  navLink(
    'insights-usage',
    'activity',
    '/usage-overview',
    'Customer Usage',
    'Compare customer app activity, lifecycle, and service usage.',
  ),
] as const;

const messagingLinks = [
  navLink(
    'messaging-delivery',
    'messaging',
    '/notifications',
    'Notification Delivery',
    'Resolve Customer, Partner, and Admin notification delivery issues.',
  ),
  navLink(
    'messaging-templates',
    'content',
    '/notifications/templates',
    'Notification Templates',
    'Manage language-specific notification titles and message bodies.',
  ),
  navLink(
    'messaging-push',
    'messaging',
    '/notifications/push-send',
    'Push Send',
    'Send a manual push message to a reviewed audience.',
  ),
] as const;

const referralLinks = [
  navLink(
    'referrals-customers',
    'referrals',
    '/referrals/customers',
    'Customer Referrals',
    'Review referred customer sign-ups and wallet reward exposure.',
  ),
  navLink(
    'referrals-partners',
    'partners',
    '/referrals/partners',
    'Partner Referrals',
    'Review referred Partner onboarding and reward exposure.',
  ),
  navLink(
    'referrals-cashouts',
    'cash',
    '/referrals/cashouts',
    'Referral Cashouts',
    'Review referral reward cashout requests and retained decisions.',
  ),
] as const;

const partnerMoneyLinks = [
  navLink(
    'partner-money-payouts',
    'finance',
    '/payouts',
    'Payouts',
    'Review payout batches and withdrawal processing records.',
  ),
  navLink(
    'partner-money-earnings',
    'wallet',
    '/earnings',
    'Partner Earnings',
    'Review Partner earning and settlement evidence by booking.',
  ),
  navLink(
    'partner-money-deposits',
    'bank',
    '/finance-tax/partner-bank-deposits',
    'Partner Bank Deposits',
    'Review Partner deposit evidence, wallet credits, and ledger posting.',
  ),
] as const;

const partnerOperationsLinks = [
  navLink(
    'partner-workspace-overview',
    'activity',
    '/partners/overview',
    'Overview',
    'Review current supply, action queues, period performance, and wallet risk.',
  ),
  navLink(
    'partner-workspace-controls',
    'controls',
    '/partner-controls',
    'Action Queue',
    'Review availability, account controls, and Partner operating restrictions.',
  ),
  navLink(
    'partner-workspace-directory',
    'partners',
    '/partners',
    'Directory',
    'Find Partner records and open approvals, onboarding blockers, or wallet debt.',
  ),
] as const;

const settlementRecordLinks = [
  navLink(
    'settlement-records-audit',
    'ledger',
    '/finance-tax/booking-settlement-audit',
    'Booking Settlements',
    'Review immutable booking settlement records.',
  ),
  navLink(
    'settlement-records-reversals',
    'refunds',
    '/finance-tax/settlement-reversals',
    'Settlement Reversals',
    'Review closed-period refund and settlement reversal records.',
  ),
  navLink(
    'settlement-records-coupons',
    'coupons',
    '/finance-tax/coupon-finance',
    'Coupon Finance',
    'Review coupon-funded settlement and company expense records.',
  ),
] as const;

const taxCloseLinks = [
  navLink(
    'tax-close-overview',
    'tax',
    '/finance-tax',
    'Tax & Close Overview',
    'Review the current tax period, close status, and outstanding evidence.',
  ),
  navLink(
    'tax-close-monthly',
    'closeout',
    '/finance-tax/monthly-tax-closing',
    'Monthly Tax Closing',
    'Complete monthly VAT, withholding, fee, and reconciliation controls.',
  ),
  navLink(
    'tax-close-vat',
    'tax',
    '/finance-tax/platform-vat',
    'Platform VAT',
    'Review company output VAT from platform fees.',
  ),
  navLink(
    'tax-close-withholding',
    'tax',
    '/finance-tax/partner-withholding-tax',
    'Partner Withholding',
    'Review Partner VAT and PIT withholding totals.',
  ),
  navLink(
    'tax-close-fees',
    'payments',
    '/finance-tax/payment-fees',
    'Payment Fees',
    'Review payment processing fees, evidence, and protected policy.',
  ),
] as const;

const systemHealthLinks = [
  navLink(
    'system-health-setup',
    'settings',
    '/setup',
    'External Services',
    'Review external service evidence and launch requirements.',
  ),
  navLink(
    'system-health-sessions',
    'activity',
    '/app-sessions',
    'App Session Diagnostics',
    'Inspect Customer and Partner app session diagnostics.',
  ),
  navLink(
    'system-health-jobs',
    'system',
    '/background-jobs',
    'Background Jobs',
    'Review queue workers, recurring jobs, retained failures, and retry health.',
  ),
] as const;

export const adminWorkspaceNavigationGroups: readonly AdminWorkspaceNavigationGroup[] = [
  { id: 'partner-operations', label: 'Partner Operations', links: partnerOperationsLinks },
  { id: 'booking-closeout', label: 'Booking Closeout', links: bookingCloseoutLinks },
  { id: 'customer-signals', label: 'Customer Signals', links: customerSignalLinks },
  { id: 'insights', label: 'Insights', links: insightLinks },
  { id: 'messaging', label: 'Messaging', links: messagingLinks },
  { id: 'referrals', label: 'Referrals', links: referralLinks },
  { id: 'partner-money', label: 'Partner Money', links: partnerMoneyLinks },
  { id: 'settlement-records', label: 'Settlement Records', links: settlementRecordLinks },
  { id: 'tax-close', label: 'Tax & Period Close', links: taxCloseLinks },
  { id: 'system-health', label: 'System Health', links: systemHealthLinks },
] as const;

export const adminNavSections: readonly AdminNavSection[] = [
  {
    id: 'shift-command',
    iconKey: 'command',
    href: '/',
    label: 'Shift Command',
    description: 'Open today’s action queues and current operating picture.',
    links: [],
  },
  {
    id: 'booking-operations',
    iconKey: 'bookings',
    label: 'Booking Operations',
    description: 'Control current bookings, closeout, handoff, and regional operations.',
    links: [
      navLink(
        'booking-live',
        'bookings',
        '/bookings',
        'Live Bookings',
        'Handle request intake, matching, Partner coordination, and active services.',
      ),
      navLink(
        'booking-calendar',
        'calendar',
        '/calendar',
        'Calendar',
        'Plan current operations and follow-up work on the shared calendar.',
      ),
      navLink(
        'booking-closeout',
        'closeout',
        '/bookings/completed',
        'Booking Closeout',
        'Review completed services and post-match exception work.',
        undefined,
        searchEntriesExcept(bookingCloseoutLinks, '/bookings/completed'),
      ),
      navLink(
        'booking-handoff',
        'handoff',
        '/operations-handoff',
        'Shift Handoff',
        'Transfer unresolved work and confirm receipt between operators.',
      ),
      navLink(
        'booking-vietnam',
        'map',
        '/vietnam-overview',
        'Vietnam Operations Map',
        'Compare regional demand and supply without exposing exact individual locations.',
      ),
    ],
  },
  {
    id: 'customer-support',
    iconKey: 'customers',
    label: 'Customer Support',
    description: 'Resolve customer account, evidence, review, and support work.',
    links: [
      navLink(
        'customer-directory',
        'customers',
        '/customers',
        'Customers',
        'Find customer accounts and open booking, wallet, referral, and support history.',
      ),
      navLink(
        'customer-signals',
        'activity',
        '/reviews',
        'Customer Signals',
        'Review customer feedback and retained Partner notes.',
        undefined,
        searchEntriesExcept(customerSignalLinks, '/reviews'),
      ),
      navLink(
        'customer-chat',
        'chat',
        '/chat-archive',
        'Chat Evidence',
        'Search retained booking conversations for support decisions.',
      ),
    ],
  },
  {
    id: 'partner-operations',
    iconKey: 'partners',
    label: 'Partner Operations',
    description: 'Approve, support, monitor, and control Partner operations.',
    links: [
      navLink(
        'partner-operations-workspace',
        'partners',
        '/partners/overview',
        'Partner Operations',
        'Open Partner supply, action queues, and directory tools in one workspace.',
        ['partner', 'partners'],
        [
          searchEntry('partner-directory', 'partners', '/partners', 'Partner Directory', [
            'partner directory',
          ]),
          searchEntry('partner-controls', 'controls', '/partner-controls', 'Partner Action Queue', [
            'partner controls',
            'partner queue',
          ]),
          searchEntry(
            'partner-approvals',
            'approvals',
            '/partners?review=approval-pending&sort=oldest',
            'Partner Approvals',
            ['approval', 'approvals'],
          ),
          searchEntry(
            'partner-onboarding',
            'controls',
            '/partners?review=unapproved',
            'Onboarding Blockers',
            ['onboarding', 'blocked partners'],
          ),
          searchEntry('partner-wallet-debt', 'wallet', '/partners?review=unsettled', 'Wallet Debt', [
            'unsettled partners',
            'negative wallet',
          ]),
        ],
      ),
    ],
  },
  {
    id: 'finance-operations',
    iconKey: 'finance',
    label: 'Finance Operations',
    description: 'Resolve current money decisions, approval queues, refunds, and reconciliation risk.',
    links: [
      navLink(
        'finance-overview',
        'finance',
        '/finance-overview',
        'Finance Overview',
        'Review current money actions, balances, close status, and record entry points.',
      ),
      navLink(
        'finance-approvals',
        'approvals',
        '/finance-tax/approval-queue',
        'Approval Queue',
        'Review finance actions that require approval or ownership.',
      ),
      navLink(
        'finance-refunds',
        'refunds',
        '/refunds',
        'Refunds',
        'Resolve open refund requests and review completed refund history.',
      ),
      navLink(
        'finance-reconciliation',
        'bank',
        '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched',
        'Payment Matching',
        'Match company bank transactions to unresolved payment evidence and review clearing history.',
        undefined,
        [
          searchEntry(
            'finance-unmatched-bank',
            'approvals',
            '/finance-tax/bank-reconciliation?range=all&review=unmatched',
            'Unmatched Bank Transactions',
            ['unmatched bank'],
          ),
          searchEntry(
            'finance-payment-clearing',
            'payments',
            '/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest',
            'Payment Clearing',
            ['unmatched payment evidence', 'partial payment match'],
          ),
        ],
      ),
      navLink(
        'finance-cash',
        'cash',
        '/cash-settlements',
        'Cash Settlements',
        'Recover Partner cash commission debt and verify payment evidence.',
      ),
      navLink(
        'finance-closeout',
        'closeout',
        '/finance-closeout',
        'Settlement Repair',
        'Repair governed settlement gaps and complete closeout work.',
      ),
    ],
  },
  {
    id: 'finance-records-close',
    iconKey: 'ledger',
    label: 'Finance Records & Close',
    description: 'Search retained money records and complete accounting close work.',
    links: [
      navLink(
        'finance-records-payments',
        'payments',
        '/payments',
        'Payments',
        'Review customer payment and refund state records.',
      ),
      navLink(
        'finance-records-partner-money',
        'wallet',
        '/payouts',
        'Partner Money',
        'Review payouts, earnings, deposits, and withdrawal risk.',
        undefined,
        [
          ...searchEntriesExcept(partnerMoneyLinks, '/payouts'),
          searchEntry(
            'partner-money-risk',
            'approvals',
            '/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests',
            'Payout / Withdrawal Risk',
            ['payout risk', 'withdrawal review'],
          ),
        ],
      ),
      navLink(
        'finance-records-wallet',
        'adjustments',
        '/wallet-adjustments',
        'Wallet Adjustments',
        'Review Customer and Partner wallet credits, debits, and reversals.',
      ),
      navLink(
        'finance-records-ledger',
        'ledger',
        '/finance-tax/general-ledger',
        'Journal Batches',
        'Search posted accounting journal batches and entries.',
      ),
      navLink(
        'finance-records-settlements',
        'closeout',
        '/finance-tax/booking-settlement-audit',
        'Settlement Records',
        'Review settlement snapshots, reversals, and coupon finance.',
        undefined,
        searchEntriesExcept(settlementRecordLinks, '/finance-tax/booking-settlement-audit'),
      ),
      navLink(
        'finance-records-tax',
        'tax',
        '/finance-tax',
        'Tax & Period Close',
        'Review monthly VAT, withholding, fees, and close readiness.',
        undefined,
        [
          ...searchEntriesExcept(taxCloseLinks, '/finance-tax'),
          searchEntry(
            'payment-fee-policy',
            'policy',
            '/finance-tax/payment-fees?settings=policy',
            'Payment Fee Policy',
            ['fee policy'],
          ),
        ],
      ),
    ],
  },
  {
    id: 'growth-communications',
    iconKey: 'growth',
    label: 'Growth & Communications',
    description: 'Manage insights, acquisition, referrals, messaging, and public content.',
    links: [
      navLink(
        'growth-insights',
        'growth',
        '/marketing-analytics',
        'Insights',
        'Compare acquisition and customer app usage.',
        undefined,
        searchEntriesExcept(insightLinks, '/marketing-analytics'),
      ),
      navLink(
        'growth-coupons',
        'coupons',
        '/coupons',
        'Coupons',
        'Create and manage checkout coupon codes and discount exposure.',
      ),
      navLink(
        'growth-referrals',
        'referrals',
        '/referrals/customers',
        'Referrals',
        'Review Customer and Partner referrals, reward exposure, and cashouts.',
        undefined,
        [
          ...searchEntriesExcept(referralLinks, '/referrals/customers'),
          searchEntry(
            'customer-referral-policy',
            'policy',
            '/referrals/customers?settings=policy',
            'Customer Referral Policy',
            ['customer reward policy'],
          ),
          searchEntry(
            'partner-referral-policy',
            'policy',
            '/referrals/partners?settings=policy',
            'Partner Referral Policy',
            ['partner reward policy'],
          ),
        ],
      ),
      navLink(
        'growth-messaging',
        'messaging',
        '/notifications',
        'Messaging',
        'Resolve delivery issues, manage templates, and send reviewed push messages.',
        undefined,
        [
          searchEntry('messaging-delivery-search', 'messaging', '/notifications', 'Notification Delivery', [
            'notification delivery',
            'partner notification',
          ]),
          ...searchEntriesExcept(messagingLinks, '/notifications'),
        ],
      ),
      navLink(
        'growth-content',
        'content',
        '/website-content',
        'Website Content',
        'Manage public website publishing, search metadata, and section order.',
      ),
    ],
  },
  {
    id: 'administration-settings',
    iconKey: 'settings',
    label: 'Administration & Settings',
    description: 'Manage protected policy, catalog, operator access, and retained audit history.',
    links: [
      navLink(
        'admin-policy',
        'policy',
        '/operations-policy',
        'Operations Policy',
        'Manage matching, marketplace, timeout, and operational gate rules.',
      ),
      navLink(
        'admin-services',
        'services',
        '/services',
        'Service Catalog',
        'Manage service names, durations, prices, and payout rules.',
      ),
      navLink(
        'admin-bank-accounts',
        'bank',
        '/finance-tax/company-bank-accounts',
        'Company Bank Accounts',
        'Manage protected company settlement bank accounts.',
      ),
      navLink(
        'admin-finance-approvers',
        'approvals',
        '/finance-tax/finance-approvers',
        'Finance Approvers',
        'Manage approver separation for protected money actions.',
      ),
      navLink(
        'admin-tax-policy',
        'tax',
        '/tax-policy',
        'Tax Policy',
        'Manage versioned Vietnam withholding rules.',
      ),
      navLink(
        'admin-operators',
        'controls',
        '/admin-operators',
        'Admin Operators',
        'Manage operator roles and category permissions.',
      ),
      navLink(
        'admin-audit',
        'audit',
        '/audit-log',
        'Audit Log',
        'Search retained Admin and system action history.',
      ),
    ],
    localGroups: [
      {
        id: 'system-health',
        iconKey: 'system',
        label: 'System Health',
        description: 'Restricted technical readiness, integration health, and app diagnostics.',
        links: systemHealthLinks,
      },
    ],
  },
] as const;

export const allAdminNavSections = adminNavSections;

export function adminNavSectionsForAccess(access: AdminOperatorAccessLike): AdminNavSection[] {
  return adminNavSections.flatMap((section) => {
    const href = section.href && canAccessHref(access, section.href) ? section.href : undefined;
    const links = section.links.flatMap((link) => {
      const searchEntries = link.searchEntries?.filter((entry) => canAccessHref(access, entry.href));
      if (canAccessHref(access, link.href)) return [{ ...link, searchEntries }];

      const firstAllowedEntry = searchEntries?.[0];
      if (!firstAllowedEntry) return [];
      return [
        {
          ...link,
          aliases: firstAllowedEntry.aliases,
          description: firstAllowedEntry.description ?? link.description,
          href: firstAllowedEntry.href,
          iconKey: firstAllowedEntry.iconKey,
          label: firstAllowedEntry.label,
          searchEntries: searchEntries?.slice(1),
        },
      ];
    });
    const localGroups = section.localGroups?.flatMap((group) => {
      const groupLinks = group.links.filter((link) => canAccessHref(access, link.href));
      return groupLinks.length > 0 ? [{ ...group, links: groupLinks }] : [];
    });

    return href || links.length > 0 || (localGroups?.length ?? 0) > 0
      ? [{ ...section, href, links, localGroups }]
      : [];
  });
}

export function adminNavSearchEntries(sections: readonly AdminNavSection[]) {
  let sourceIndex = 0;
  return sections.flatMap((section) => {
    const entries: AdminNavSearchResult[] = [];
    if (section.href) {
      entries.push(
        toSearchResult(
          {
            aliases: [],
            description: section.description,
            href: section.href,
            iconKey: section.iconKey,
            id: section.id,
            label: section.label,
          },
          section,
          sourceIndex++,
        ),
      );
    }

    for (const link of section.links) {
      entries.push(toSearchResult(link, section, sourceIndex++));
      for (const searchEntryItem of link.searchEntries ?? []) {
        entries.push(
          toSearchResult(
            {
              ...searchEntryItem,
              description: searchEntryItem.description ?? link.description,
            },
            section,
            sourceIndex++,
            undefined,
            'workspace',
          ),
        );
      }
    }

    for (const group of section.localGroups ?? []) {
      for (const link of group.links) {
        entries.push(toSearchResult(link, section, sourceIndex++, group.label, 'workspace'));
      }
    }
    return entries;
  });
}

export function adminNavSearchResults(sections: readonly AdminNavSection[], rawQuery: string, limit = 7) {
  const entries = adminNavSearchEntries(sections);
  const query = normalizeSearchText(rawQuery);
  const ranked = query
    ? entries
        .map((entry) => ({ entry, rank: searchRank(entry, query) }))
        .filter((item): item is { entry: AdminNavSearchResult; rank: number } => item.rank !== null)
        .sort((left, right) => left.rank - right.rank || left.entry.sourceIndex - right.entry.sourceIndex)
        .map((item) => item.entry)
    : representativeSearchEntries(sections, entries);

  return {
    results: ranked.slice(0, limit),
    total: ranked.length,
  };
}

export function groupAdminNavSearchResults(results: readonly AdminNavSearchResult[]) {
  const grouped = new Map<string, AdminNavSearchResult[]>();
  for (const result of results) {
    const sectionResults = grouped.get(result.sectionLabel) ?? [];
    sectionResults.push(result);
    grouped.set(result.sectionLabel, sectionResults);
  }
  return Array.from(grouped, ([sectionLabel, entries]) => ({ entries, sectionLabel }));
}

export function adminNavSectionDestinations(section: AdminNavSection) {
  return [
    ...(section.href ? [section.href] : []),
    ...section.links.flatMap(adminNavLinkDestinations),
    ...(section.localGroups?.flatMap((group) => group.links.map((link) => link.href)) ?? []),
  ];
}

export function adminNavLinkDestinations(link: AdminNavLink) {
  return [link.href, ...(link.searchEntries?.map((entry) => entry.href) ?? [])];
}

export function adminNavWorkspaceDestinations() {
  return adminWorkspaceNavigationGroups.flatMap((group) => group.links.map((link) => link.href));
}

export type AdminNavSearchResult = {
  readonly aliases: readonly string[];
  readonly description: string;
  readonly entryKind: 'primary' | 'workspace';
  readonly href: string;
  readonly iconKey: AdminNavIconKey;
  readonly id: string;
  readonly label: string;
  readonly sectionLabel: string;
  readonly sourceIndex: number;
  readonly workspaceLabel?: string;
};

function navLink(
  id: string,
  iconKey: AdminNavIconKey,
  href: string,
  label: string,
  description: string,
  aliases?: readonly string[],
  searchEntries?: readonly AdminNavSearchEntry[],
): AdminNavLink {
  return { aliases, description, href, iconKey, id, label, searchEntries };
}

function searchEntry(
  id: string,
  iconKey: AdminNavIconKey,
  href: string,
  label: string,
  aliases?: readonly string[],
): AdminNavSearchEntry {
  return { aliases, href, iconKey, id, label };
}

function searchEntriesExcept(links: readonly AdminNavLink[], representativeHref: string) {
  return links
    .filter((link) => link.href !== representativeHref)
    .map((link) => searchEntry(link.id, link.iconKey, link.href, link.label, link.aliases));
}

function canAccessHref(access: AdminOperatorAccessLike, href: string) {
  const category = adminOperatorCategoryForPath(href);
  return category ? hasAdminOperatorCategory(access, category) : false;
}

function toSearchResult(
  entry: AdminNavSearchEntry | AdminNavLink,
  section: AdminNavSection,
  sourceIndex: number,
  workspaceLabel?: string,
  entryKind: 'primary' | 'workspace' = 'primary',
): AdminNavSearchResult {
  return {
    aliases: entry.aliases ?? [],
    description: entry.description ?? section.description,
    entryKind,
    href: entry.href,
    iconKey: entry.iconKey,
    id: entry.id,
    label: entry.label,
    sectionLabel: section.label,
    sourceIndex,
    workspaceLabel,
  };
}

function representativeSearchEntries(
  sections: readonly AdminNavSection[],
  entries: readonly AdminNavSearchResult[],
) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return sections.flatMap((section) => {
    const representativeId = section.href
      ? section.id
      : (section.links[0]?.id ?? section.localGroups?.[0]?.links[0]?.id);
    const entry = representativeId ? byId.get(representativeId) : undefined;
    return entry ? [entry] : [];
  });
}

function searchRank(entry: AdminNavSearchResult, query: string) {
  const title = normalizeSearchText(entry.label);
  const titleWords = title.split(' ');
  const queryWords = query.split(' ');
  if (title === query) return 0;
  const titlePrefix = title.startsWith(query);
  const titleWordPrefix = queryWords.every((word) =>
    titleWords.some((titleWord) => titleWord.startsWith(word)),
  );
  if (entry.entryKind === 'primary' && titlePrefix) return 1;
  if (entry.entryKind === 'primary' && titleWordPrefix) return 2;
  if (
    (entry.entryKind === 'workspace' && (titlePrefix || titleWordPrefix)) ||
    entry.aliases.some((alias) => normalizeSearchText(alias).includes(query))
  )
    return 3;
  if (
    normalizeSearchText(entry.sectionLabel).includes(query) ||
    normalizeSearchText(entry.workspaceLabel ?? '').includes(query)
  )
    return 4;
  if (normalizeSearchText(entry.description).includes(query)) return 5;
  return null;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
