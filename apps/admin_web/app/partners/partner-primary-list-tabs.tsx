import Link from 'next/link';

import type { PartnerPrimaryListMode } from './partner-review-mode';

type PartnerPrimaryListTabsProps = {
  readonly activeMode: PartnerPrimaryListMode;
};

const PARTNER_PRIMARY_LIST_TABS: Array<{
  href: string;
  label: string;
  mode: PartnerPrimaryListMode;
}> = [
  { href: '/partners', label: 'Partners', mode: 'partners' },
  { href: '/partners?review=unapproved', label: 'Unapproved Partners', mode: 'unapproved' },
  { href: '/partners?review=unsettled', label: 'Unsettled Partners', mode: 'unsettled' },
];

export function PartnerPrimaryListTabs({ activeMode }: PartnerPrimaryListTabsProps) {
  return (
    <nav aria-label="Partner list pages" className="partner-primary-list-tabs">
      {PARTNER_PRIMARY_LIST_TABS.map((tab) => (
        <Link
          aria-current={tab.mode === activeMode ? 'page' : undefined}
          className={`partner-primary-list-tab${tab.mode === activeMode ? ' is-active' : ''}`}
          href={tab.href}
          key={tab.mode}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
