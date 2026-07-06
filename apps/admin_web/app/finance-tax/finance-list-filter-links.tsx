import {
  StatusBadgeLinkFromPillClass,
} from '../../components/status-badge';

export const FINANCE_LIST_DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

export type FinanceListFilterLink = {
  readonly active: boolean;
  readonly activePillClassName: 'pill-info' | 'pill-success' | 'pill-warn';
  readonly href: string;
  readonly id: string | number;
  readonly label: string;
};

export type FinanceListFilterLinkGroup = {
  readonly className?: string;
  readonly id: string;
  readonly links: readonly FinanceListFilterLink[];
};

export function financeListFilterLinkClassName({
  active,
  activePillClassName,
}: Pick<FinanceListFilterLink, 'active' | 'activePillClassName'>) {
  return financeListFilterLinkPillClassName({ active, activePillClassName });
}

function financeListFilterLinkPillClassName({
  active,
  activePillClassName,
}: Pick<FinanceListFilterLink, 'active' | 'activePillClassName'>) {
  return active ? `pill ${activePillClassName}` : 'pill pill-neutral';
}

export function FinanceListFilterLinks({ groups }: { readonly groups: readonly FinanceListFilterLinkGroup[] }) {
  return (
    <>
      {groups.map((group, index) => (
        <div className={group.className ?? `participant-list${index > 0 ? ' admin-mt-10' : ''}`} key={group.id}>
          {group.links.map((link) => (
            <StatusBadgeLinkFromPillClass
              href={link.href}
              key={link.id}
              pillClass={financeListFilterLinkPillClassName(link)}
            >
              {link.label}
            </StatusBadgeLinkFromPillClass>
          ))}
        </div>
      ))}
    </>
  );
}
