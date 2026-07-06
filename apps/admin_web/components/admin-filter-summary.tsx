import type { ReactNode } from 'react';

import { StatusBadge, type StatusBadgeTone } from './status-badge';

type AdminFilterSummaryProps = {
  readonly ariaLabel?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly labels: readonly string[];
  readonly tone?: StatusBadgeTone;
};

export function AdminFilterSummary({
  ariaLabel,
  children,
  className,
  labels,
  tone = 'warning',
}: AdminFilterSummaryProps) {
  if (labels.length === 0 && !children) {
    return null;
  }

  return (
    <div aria-label={ariaLabel} className={joinClassNames('admin-filter-summary', className)}>
      {labels.map((label) => (
        <StatusBadge key={label} tone={tone}>
          {label}
        </StatusBadge>
      ))}
      {children}
    </div>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
