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

const adminOverviewGridClassNames: Record<AdminOverviewGridVariant, string> = {
  behavior: 'usage-overview-behavior-grid',
  command: 'usage-overview-command-grid',
  content: 'usage-overview-grid',
  insight: 'usage-overview-insight-grid',
  segment: 'usage-overview-segment-grid',
};
