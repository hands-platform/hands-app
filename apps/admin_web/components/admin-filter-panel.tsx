import type { ReactNode } from 'react';

import { StatusBadge, type StatusBadgeTone } from './status-badge';

type AdminFilterPanelProps = {
  readonly actions?: ReactNode;
  readonly bodyClassName?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly id?: string;
  readonly resultLabel?: ReactNode;
  readonly resultTone?: StatusBadgeTone;
  readonly title: string;
};

export function AdminFilterPanel({
  actions,
  bodyClassName,
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
  const hasBody = children !== undefined && children !== null;

  return (
    <section
      className={joinClassNames('card admin-filter-panel', className, 'admin-section')}
      id={id}
      aria-labelledby={headingId}
    >
      <div className="ops-section-header admin-filter-panel-header admin-section-header">
        <div className="admin-filter-panel-copy">
          <h2 id={headingId}>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {resultLabel || actions ? (
          <div className="admin-filter-panel-actions">
            {resultLabel ? <StatusBadge tone={resultTone}>{resultLabel}</StatusBadge> : null}
            {actions}
          </div>
        ) : null}
      </div>
      {hasBody ? (
        <div className={joinClassNames('admin-filter-panel-body admin-section-body', bodyClassName)}>
          {children}
        </div>
      ) : null}
      {footer ? <div className="admin-filter-panel-footer admin-section-footer">{footer}</div> : null}
    </section>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
