import type { ComponentProps, ReactNode } from 'react';

import { AdminKpiCard } from './admin-surface';
import { DateTimeText } from './date-time-text';

export type AdminPageMetric = Pick<
  ComponentProps<typeof AdminKpiCard>,
  'className' | 'href' | 'icon' | 'iconSize' | 'kind' | 'label' | 'scope' | 'value'
> & {
  readonly helper?: ComponentProps<typeof AdminKpiCard>['helper'];
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

type AdminPageTemplateProps = {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly contentClassName?: string;
  readonly description?: ReactNode;
  readonly metrics?: readonly AdminPageMetric[];
  readonly metricsClassName?: string;
  readonly title: string;
};

type AdminMetricGridProps = {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly metrics: readonly AdminPageMetric[];
};

type AdminSectionHeaderProps = {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly descriptionId?: string;
  readonly status?: ReactNode;
  readonly title: string;
  readonly titleId?: string;
};

const ADMIN_PAGE_TITLE_TERMS: Readonly<Record<string, string>> = {
  'Customer Management': 'Customers',
  'Customer detail': 'Customer Detail',
  'Usage Overview': 'Customer Usage Overview',
  'Tax policy': 'Tax Policy',
  'Referral accounting guardrails': 'Referral Accounting',
  'Parent account': 'Referral Parent Account',
  'Service catalog': 'Service Catalog',
  Setup: 'External Services',
  'Page not found': 'Page Not Found',
};

export function AdminPageTemplate({
  actions,
  children,
  contentClassName,
  description,
  metrics = [],
  metricsClassName,
  title,
}: AdminPageTemplateProps) {
  const normalizedTitle = adminPageTitleLabel(title);
  const hasActions = Boolean(actions);

  return (
    <>
      <div className="admin-page-header admin-page-header-toolbar">
        <div className="admin-page-header-copy">
          <h1>{normalizedTitle}</h1>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <div aria-label="Page actions" className="admin-page-header-actions" data-empty={hasActions ? undefined : 'true'}>
          {actions}
        </div>
      </div>
      {metrics.length ? <AdminMetricGrid className={metricsClassName} metrics={metrics} /> : null}
      {contentClassName ? <div className={joinClassNames(contentClassName)}>{children}</div> : children}
    </>
  );
}

function adminPageTitleLabel(title: string) {
  return ADMIN_PAGE_TITLE_TERMS[title] ?? title;
}

export function AdminMetricGrid({ ariaLabel, className, metrics }: AdminMetricGridProps) {
  return (
    <section aria-label={ariaLabel} className={joinClassNames('admin-metric-grid', className)}>
      {metrics.map((metric, index) => (
        <AdminKpiCard
          className={metric.className}
          helper={metric.helper}
          href={metric.href}
          icon={metric.icon}
          iconSize={metric.iconSize}
          kind={metric.kind}
          key={`${metric.label}-${index}`}
          label={metric.label}
          scope={metric.scope}
          value={adminMetricValue(metric)}
        />
      ))}
    </section>
  );
}

function adminMetricValue(metric: AdminPageMetric) {
  return metric.valueDateTimeValue ? (
    <DateTimeText
      fallback={metric.valueDateTimeFallback ?? (typeof metric.value === 'string' ? metric.value : 'Not set')}
      value={metric.valueDateTimeValue}
    />
  ) : (
    metric.value
  );
}

export function AdminSectionHeader({
  actions,
  className,
  description,
  descriptionId,
  status,
  title,
  titleId,
}: AdminSectionHeaderProps) {
  return (
    <div className={joinClassNames('ops-section-header admin-section-header', className)}>
      <div>
        <h2 id={titleId}>{title}</h2>
        {description ? (
          <p className="muted" id={descriptionId}>
            {description}
          </p>
        ) : null}
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

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
