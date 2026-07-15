import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';

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
        <div
          className={mergeClassNames(
            'booking-date-filter-bar finance-list-filter-group',
            group.className ?? (index > 0 ? 'admin-mt-10' : undefined),
          )}
          key={group.id}
        >
          <span className="finance-list-filter-group-label">{financeListFilterGroupLabel(group.id)}</span>
          <AdminSegmentedControl
            activeValue={String(group.links.find((link) => link.active)?.id ?? '')}
            ariaLabel={`${group.id} finance filters`}
            className="finance-list-filter-buttons"
            options={group.links.map((link) => ({
              href: link.href,
              label: link.label,
              value: String(link.id),
            }))}
          />
        </div>
      ))}
      <AdminFilterSummary
        ariaLabel="Active finance list filters"
        className="admin-mt-10"
        labels={financeListActiveFilterLabels(groups)}
        tone="info"
      />
    </>
  );
}

function financeListActiveFilterLabels(groups: readonly FinanceListFilterLinkGroup[]) {
  return groups.flatMap((group) => {
    const active = group.links.find((link) => link.active);
    return active ? [`${financeListFilterGroupLabel(group.id)}: ${active.label}`] : [];
  });
}

function financeListFilterGroupLabel(id: string) {
  if (id === 'payment-method') return 'Payment method';
  if (id === 'period') return 'Period';
  if (id === 'range') return 'Range';
  if (id === 'review') return 'Queue';
  if (id === 'review-owner') return 'Review owner';
  if (id === 'take') return 'Rows';
  if (id === 'withdrawal-candidate') return 'Withdrawal candidates';
  return id;
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
