import type { ReactNode } from 'react';

import { AdminKpiCard } from './admin-surface';

export type AdminPageMetric = {
  readonly helper: string;
  readonly href?: string;
  readonly label: string;
  readonly value: number | string;
};

type AdminPageTemplateProps = {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly contentClassName?: string;
  readonly description?: ReactNode;
  readonly metrics?: readonly AdminPageMetric[];
  readonly title: string;
};

type AdminMetricGridProps = {
  readonly metrics: readonly AdminPageMetric[];
};

type AdminSectionHeaderProps = {
  readonly actions?: ReactNode;
  readonly description?: ReactNode;
  readonly status?: ReactNode;
  readonly title: string;
};

export function AdminPageTemplate({
  actions,
  children,
  contentClassName,
  description,
  metrics = [],
  title,
}: AdminPageTemplateProps) {
  return (
    <>
      <div className="toolbar admin-page-header">
        <div>
          <h1>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="participant-list">{actions}</div> : null}
      </div>
      {metrics.length ? <AdminMetricGrid metrics={metrics} /> : null}
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </>
  );
}

export function AdminMetricGrid({ metrics }: AdminMetricGridProps) {
  return (
    <section className="admin-metric-grid">
      {metrics.map((metric) => (
        <AdminKpiCard
          helper={metric.helper}
          href={metric.href}
          key={metric.label}
          label={metric.label}
          value={metric.value}
        />
      ))}
    </section>
  );
}

export function AdminSectionHeader({ actions, description, status, title }: AdminSectionHeaderProps) {
  return (
    <div className="ops-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions || status ? (
        <div className="participant-list">
          {status}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
