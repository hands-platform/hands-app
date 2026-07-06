import type { ReactNode } from 'react';

import { AdminCard, AdminLinkCard } from './admin-surface';

type AdminOverviewCommandGridProps = {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminOverviewGridProps = {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant: AdminOverviewGridVariant;
};

type AdminOverviewGridVariant = 'behavior' | 'command' | 'content' | 'insight' | 'segment';

type AdminOverviewGroupProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly eyebrow: ReactNode;
  readonly title: ReactNode;
};

type AdminProfileOverviewCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminOverviewCommandCardProps = {
  readonly ariaLabel?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly href?: string;
  readonly htmlTitle?: string;
  readonly icon: ReactNode;
  readonly label: ReactNode;
  readonly trailing?: ReactNode;
  readonly value: ReactNode;
};

type AdminMiniMetric = {
  readonly key?: string;
  readonly label: ReactNode;
  readonly tone?: string;
  readonly value: ReactNode;
};

type AdminMiniMetricStripProps = {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly itemClassName?: string;
  readonly limit?: number;
  readonly metrics: readonly AdminMiniMetric[];
};

type AdminSummaryCardItem = {
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly key?: string;
  readonly label: ReactNode;
  readonly overline?: ReactNode;
  readonly tone?: string;
  readonly value: ReactNode;
};

type AdminSummaryCardGridProps = {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly itemClassName?: string;
  readonly items: readonly AdminSummaryCardItem[];
};

type AdminTraceSummaryMetric = {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly href?: string;
  readonly key?: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
};

type AdminTraceSummaryProps = {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly itemClassName?: string;
  readonly metrics: readonly AdminTraceSummaryMetric[];
};

export function AdminOverviewCommandGrid({ ariaLabel, children, className }: AdminOverviewCommandGridProps) {
  return (
    <AdminOverviewGrid ariaLabel={ariaLabel} className={className} variant="command">
      {children}
    </AdminOverviewGrid>
  );
}

export function AdminOverviewGrid({ ariaLabel, children, className, variant }: AdminOverviewGridProps) {
  return (
    <section className={joinClassNames(adminOverviewGridClassNames[variant], className)} aria-label={ariaLabel}>
      {children}
    </section>
  );
}

export function AdminOverviewGroup({ children, className, eyebrow, title }: AdminOverviewGroupProps) {
  return (
    <section className={joinClassNames('usage-overview-group', className)}>
      <div className="usage-overview-group-heading">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

export function AdminProfileOverviewCard({ children, className }: AdminProfileOverviewCardProps) {
  return <AdminCard className={joinClassNames('admin-profile-overview-card', className)}>{children}</AdminCard>;
}

export function AdminMiniMetricStrip({
  ariaLabel,
  className,
  itemClassName,
  limit,
  metrics,
}: AdminMiniMetricStripProps) {
  const visibleMetrics = typeof limit === 'number' ? metrics.slice(0, limit) : metrics;

  return (
    <div aria-label={ariaLabel} className={joinClassNames('admin-mini-metric-strip', className)}>
      {visibleMetrics.map((metric, index) => (
        <div
          className={joinClassNames('admin-mini-metric', itemClassName, metric.tone ? `is-${metric.tone}` : undefined)}
          key={miniMetricKey(metric, index)}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function AdminSummaryCardGrid({
  ariaLabel,
  className,
  itemClassName,
  items,
}: AdminSummaryCardGridProps) {
  return (
    <div aria-label={ariaLabel} className={joinClassNames('admin-summary-card-grid', className)}>
      {items.map((item, index) => (
        <AdminCard
          className={joinClassNames(
            'admin-summary-card',
            itemClassName,
            item.className,
            item.tone ? `is-${item.tone}` : undefined,
          )}
          key={summaryCardKey(item, index)}
        >
          {item.overline ? <small>{item.overline}</small> : <span>{item.label}</span>}
          <strong>{item.value}</strong>
          {item.overline ? <span>{item.label}</span> : null}
          {item.detail ? <small>{item.detail}</small> : null}
        </AdminCard>
      ))}
    </div>
  );
}

export function AdminTraceSummary({ ariaLabel, className, itemClassName, metrics }: AdminTraceSummaryProps) {
  return (
    <div aria-label={ariaLabel} className={joinClassNames('service-trace-summary', className)}>
      {metrics.map((metric, index) => {
        const metricClassName = joinClassNames(itemClassName, metric.className) || undefined;
        const content = (
          <>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.detail ? <small>{metric.detail}</small> : null}
            {metric.action}
          </>
        );

        if (metric.href) {
          return (
            <a
              className={metricClassName}
              href={metric.href}
              key={traceSummaryKey(metric, index)}
            >
              {content}
            </a>
          );
        }

        return (
          <div className={metricClassName} key={traceSummaryKey(metric, index)}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function AdminOverviewCommandCard({
  ariaLabel,
  children,
  className,
  detail,
  href,
  htmlTitle,
  icon,
  label,
  trailing,
  value,
}: AdminOverviewCommandCardProps) {
  const content = (
    <>
      <span className="usage-overview-command-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
        {children}
      </div>
      {trailing}
    </>
  );
  const cardClassName = joinClassNames('usage-overview-command-card', className);

  if (href) {
    return (
      <AdminLinkCard ariaLabel={ariaLabel} className={cardClassName} href={href} htmlTitle={htmlTitle}>
        {content}
      </AdminLinkCard>
    );
  }

  return (
    <AdminCard ariaLabel={ariaLabel} className={cardClassName}>
      {content}
    </AdminCard>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function miniMetricKey(metric: AdminMiniMetric, index: number) {
  if (metric.key) return metric.key;
  if (typeof metric.label === 'string' || typeof metric.label === 'number') return String(metric.label);
  return `metric-${index}`;
}

function summaryCardKey(item: AdminSummaryCardItem, index: number) {
  if (item.key) return item.key;
  if (typeof item.label === 'string' || typeof item.label === 'number') return String(item.label);
  return `summary-card-${index}`;
}

function traceSummaryKey(metric: AdminTraceSummaryMetric, index: number) {
  if (metric.key) return metric.key;
  if (typeof metric.label === 'string' || typeof metric.label === 'number') return String(metric.label);
  return `trace-metric-${index}`;
}

const adminOverviewGridClassNames: Record<AdminOverviewGridVariant, string> = {
  behavior: 'usage-overview-behavior-grid',
  command: 'usage-overview-command-grid',
  content: 'usage-overview-grid',
  insight: 'usage-overview-insight-grid',
  segment: 'usage-overview-segment-grid',
};
