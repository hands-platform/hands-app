import type { ReactNode } from 'react';

import { StatusBadge, type StatusBadgeTone } from './status-badge';

type AdminFilterPanelProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly id?: string;
  readonly resultLabel?: ReactNode;
  readonly resultTone?: StatusBadgeTone;
  readonly title: string;
};

export function AdminFilterPanel({
  children,
  className,
  description,
  footer,
  id,
  resultLabel,
  resultTone = 'info',
  title,
}: AdminFilterPanelProps) {
  const headingId = id ? `${id}-title` : undefined;

  return (
    <section className={joinClassNames('card admin-filter-panel', className)} aria-labelledby={headingId}>
      <div className="ops-section-header admin-filter-panel-header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {resultLabel ? <StatusBadge tone={resultTone}>{resultLabel}</StatusBadge> : null}
      </div>
      <div className="admin-filter-panel-body">{children}</div>
      {footer ? <div className="admin-filter-panel-footer">{footer}</div> : null}
    </section>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
