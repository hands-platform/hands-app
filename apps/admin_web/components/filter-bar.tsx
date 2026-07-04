import type { ReactNode } from 'react';

import { AdminFilterPanel } from './admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormSearch,
} from './admin-form-controls';
import type { StatusBadgeTone } from './status-badge';
import { StatusBadgeLink, statusBadgeClassName } from './status-badge';

export type FilterBarOption = {
  readonly active?: boolean;
  readonly href: string;
  readonly label: string;
  readonly tone?: StatusBadgeTone;
};

type FilterBarProps = {
  readonly action: string;
  readonly defaultQuery?: string;
  readonly options?: readonly FilterBarOption[];
  readonly placeholder?: string;
  readonly queryLabel: string;
  readonly queryName?: string;
  readonly resetHref?: string;
  readonly resultLabel?: ReactNode;
  readonly submitLabel?: string;
};

export function filterBarOptionClassName(option: Pick<FilterBarOption, 'active' | 'tone'>) {
  return statusBadgeClassName(filterBarOptionTone(option));
}

function filterBarOptionTone(option: Pick<FilterBarOption, 'active' | 'tone'>): StatusBadgeTone {
  if (option.active) {
    return 'warning';
  }
  return option.tone ?? 'neutral';
}

export function FilterBar({
  action,
  defaultQuery = '',
  options = [],
  placeholder = 'Search',
  queryLabel,
  queryName = 'q',
  resetHref,
  resultLabel,
  submitLabel = 'Search',
}: FilterBarProps) {
  return (
    <AdminFilterPanel className="filter-bar" resultLabel={resultLabel} resultTone="info" title={queryLabel}>
      <AdminFormGrid action={action} className="compact-form">
        <AdminFormSearch defaultValue={defaultQuery} label={queryLabel} name={queryName} placeholder={placeholder} />
        <AdminFormControlButton type="submit">{submitLabel}</AdminFormControlButton>
        {resetHref ? (
          <StatusBadgeLink href={resetHref} tone="neutral">
            Clear
          </StatusBadgeLink>
        ) : null}
      </AdminFormGrid>
      <div className="participant-list filter-bar-options">
        {options.map((option) => (
          <StatusBadgeLink href={option.href} key={option.href} tone={filterBarOptionTone(option)}>
            {option.label}
          </StatusBadgeLink>
        ))}
      </div>
    </AdminFilterPanel>
  );
}
