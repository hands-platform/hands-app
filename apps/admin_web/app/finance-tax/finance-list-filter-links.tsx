import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminDisclosure } from '../../components/admin-surface';

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
  readonly defaultId?: string | number;
  readonly id: string;
  readonly links: readonly FinanceListFilterLink[];
};

type FinanceListFilterLinksProps = {
  readonly compact?: boolean;
  readonly groups: readonly FinanceListFilterLinkGroup[];
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

export function FinanceListFilterLinks({ compact = false, groups }: FinanceListFilterLinksProps) {
  const primaryGroups = compact
    ? groups.filter((group) => ['direction', 'review', 'review-owner', 'age'].includes(group.id))
    : groups;
  const secondaryGroups = compact
    ? groups.filter((group) => !['direction', 'review', 'review-owner', 'age'].includes(group.id))
    : [];
  const activeLabels = financeListActiveFilterLabels(groups, compact);
  const secondaryActiveCount = financeListActiveFilterLabels(secondaryGroups, true).length;
  const secondaryDescription = secondaryGroups
    .map((group) => financeListFilterGroupLabel(group.id))
    .join(', ');

  return (
    <>
      <FinanceListFilterGroups groups={primaryGroups} />
      {secondaryGroups.length > 0 ? (
        <AdminDisclosure className="finance-reconciliation-import-disclosure finance-list-more-filters admin-mt-10">
          <summary>
            <span>More filters{secondaryActiveCount > 0 ? ` · ${secondaryActiveCount} active` : ''}</span>
            <small>{secondaryDescription}</small>
          </summary>
          <div className="admin-mt-12">
            <FinanceListFilterGroups groups={secondaryGroups} />
          </div>
        </AdminDisclosure>
      ) : null}
      {activeLabels.length > 0 ? (
        <AdminFilterSummary
          ariaLabel="Active finance list filters"
          className="admin-mt-10"
          labels={activeLabels}
          tone="info"
        />
      ) : null}
    </>
  );
}

function FinanceListFilterGroups({ groups }: { readonly groups: readonly FinanceListFilterLinkGroup[] }) {
  return groups.map((group, index) => (
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
  ));
}

function financeListActiveFilterLabels(
  groups: readonly FinanceListFilterLinkGroup[],
  nonDefaultOnly = false,
) {
  return groups.flatMap((group) => {
    const active = group.links.find((link) => link.active);
    if (nonDefaultOnly && active?.id === group.defaultId) return [];
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
  if (id === 'tax-status') return 'Tax status';
  if (id === 'evidence-source') return 'Evidence source';
  if (id === 'withdrawal-candidate') return 'Withdrawal candidates';
  return id;
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
