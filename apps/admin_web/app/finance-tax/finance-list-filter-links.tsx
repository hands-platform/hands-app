import Link from 'next/link';

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

export function FinanceListFilterLinks({ groups }: { readonly groups: readonly FinanceListFilterLinkGroup[] }) {
  return (
    <>
      {groups.map((group, index) => (
        <div className={group.className ?? `participant-list${index > 0 ? ' admin-mt-10' : ''}`} key={group.id}>
          {group.links.map((link) => (
            <Link
              className={`pill ${link.active ? link.activePillClassName : 'pill-neutral'}`}
              href={link.href}
              key={link.id}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
