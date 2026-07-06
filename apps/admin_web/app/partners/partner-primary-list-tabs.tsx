import { AdminSegmentedControl } from '../../components/admin-segmented-control';
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
    <AdminSegmentedControl
      activeValue={activeMode}
      ariaLabel="Partner list pages"
      className="partner-primary-list-tabs"
      options={PARTNER_PRIMARY_LIST_TABS.map((tab) => ({
        href: tab.href,
        label: tab.label,
        value: tab.mode,
      }))}
    />
  );
}
