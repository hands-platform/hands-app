import type { ReactNode } from 'react';

type AdminFilterChipGroupProps = {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
};

export function AdminFilterChipGroup({ ariaLabel, children, className }: AdminFilterChipGroupProps) {
  return (
    <div aria-label={ariaLabel} className={mergeClassNames('participant-list admin-filter-chip-group', className)}>
      {children}
    </div>
  );
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
