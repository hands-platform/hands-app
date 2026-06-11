import Link from 'next/link';
import type { ReactNode } from 'react';

import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

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
  if (option.active) {
    return statusBadgeClassName('warning');
  }
  return statusBadgeClassName(option.tone ?? 'neutral');
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
    <section className="card filter-bar">
      <form action={action} className="form-grid compact-form">
        <label>
          {queryLabel}
          <input defaultValue={defaultQuery} name={queryName} placeholder={placeholder} />
        </label>
        <button type="submit">{submitLabel}</button>
        {resetHref ? (
          <Link className="pill pill-neutral" href={resetHref}>
            Clear
          </Link>
        ) : null}
      </form>
      <div className="participant-list filter-bar-options">
        {resultLabel ? <span className="pill pill-info">{resultLabel}</span> : null}
        {options.map((option) => (
          <Link className={filterBarOptionClassName(option)} href={option.href} key={option.href}>
            {option.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
