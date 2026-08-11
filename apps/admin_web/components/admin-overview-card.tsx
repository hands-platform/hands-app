import type { ReactNode } from 'react';

import {
  AdminCard,
  AdminLinkCard,
  inferredMetricKind,
  inferredMetricScope,
  type MetricCardKind,
} from './admin-surface';
import { DateTimeText } from './date-time-text';

type AdminOverviewCommandGridProps = {
  readonly ariaLabel: string;
  readonly baseClassName?: string;
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminOverviewGridProps = {
  readonly ariaLabel: string;
  readonly baseClassName?: string;
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
  readonly actionLabel?: ReactNode;
  readonly ariaLabel?: string;
  readonly baseClassName?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly href?: string;
  readonly htmlTitle?: string;
  readonly icon: ReactNode;
  readonly iconClassName?: string;
  readonly kind?: MetricCardKind;
  readonly label: ReactNode;
  readonly scope?: ReactNode;
  readonly trailing?: ReactNode;
  readonly value: ReactNode;
};

type AdminQueueMetaProps = {
  readonly assignee?: ReactNode;
  readonly className?: string;
  readonly impact?: ReactNode;
  readonly oldest?: ReactNode;
  readonly owner: ReactNode;
  readonly ownerLabel?: ReactNode;
};

type AdminMiniMetric = {
  readonly ariaCurrent?: 'page';
  readonly href?: string;
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
  readonly ariaCurrent?: 'page';
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly detailDateTimeFallback?: string;
  readonly detailDateTimePrefix?: ReactNode;
  readonly detailDateTimeSuffix?: ReactNode;
  readonly detailDateTimeValue?: string | null;
  readonly href?: string;
  readonly htmlTitle?: string;
  readonly key?: string;
  readonly label: ReactNode;
  readonly overline?: ReactNode;
  readonly tone?: string;
  readonly value: ReactNode;
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

type AdminSummaryCardGridProps = {
  readonly ariaLabel?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly itemClassName?: string;
  readonly items: readonly AdminSummaryCardItem[];
};

type AdminTraceSummaryMetric = {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly detailDateTimeFallback?: string;
  readonly detailDateTimePrefix?: ReactNode;
  readonly detailDateTimeSuffix?: ReactNode;
  readonly detailDateTimeValue?: string | null;
  readonly href?: string;
  readonly key?: string;
  readonly kind?: MetricCardKind;
  readonly label: ReactNode;
  readonly scope?: ReactNode;
  readonly value: ReactNode;
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

type AdminTraceSummaryProps = {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly defaultKind?: MetricCardKind;
  readonly defaultScope?: ReactNode;
  readonly inferScope?: boolean;
  readonly itemClassName?: string;
  readonly metrics: readonly AdminTraceSummaryMetric[];
};

export function AdminOverviewCommandGrid({
  ariaLabel,
  baseClassName,
  children,
  className,
}: AdminOverviewCommandGridProps) {
  return (
    <AdminOverviewGrid ariaLabel={ariaLabel} baseClassName={baseClassName} className={className} variant="command">
      {children}
    </AdminOverviewGrid>
  );
}

export function AdminOverviewGrid({ ariaLabel, baseClassName, children, className, variant }: AdminOverviewGridProps) {
  return (
    <section className={joinClassNames(baseClassName ?? adminOverviewGridClassNames[variant], className)} aria-label={ariaLabel}>
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

export function AdminQueueMeta({ assignee, className, impact, oldest, owner, ownerLabel = 'Owner' }: AdminQueueMetaProps) {
  return (
    <dl className={joinClassNames('admin-queue-meta', className)}>
      <div>
        <dt>{ownerLabel}</dt>
        <dd>{owner}</dd>
      </div>
      {assignee ? (
        <div className="admin-queue-meta-assignee">
          <dt>Assignee</dt>
          <dd>{assignee}</dd>
        </div>
      ) : null}
      {oldest ? (
        <div>
          <dt>Oldest</dt>
          <dd>{oldest}</dd>
        </div>
      ) : null}
      {impact ? (
        <div className="admin-queue-meta-impact">
          <dt>Impact</dt>
          <dd>{impact}</dd>
        </div>
      ) : null}
    </dl>
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
      {visibleMetrics.map((metric, index) => {
        const className = joinClassNames(
          'admin-mini-metric',
          itemClassName,
          metric.tone ? `is-${metric.tone}` : undefined,
        );
        const content = <><span>{metric.label}</span><strong>{metric.value}</strong></>;

        return metric.href ? (
          <AdminLinkCard
            ariaCurrent={metric.ariaCurrent}
            className={className}
            href={metric.href}
            key={miniMetricKey(metric, index)}
          >
            {content}
          </AdminLinkCard>
        ) : (
          <div className={className} key={miniMetricKey(metric, index)}>{content}</div>
        );
      })}
    </div>
  );
}

export function AdminSummaryCardGrid({
  ariaLabel,
  children,
  className,
  itemClassName,
  items,
}: AdminSummaryCardGridProps) {
  return (
    <div aria-label={ariaLabel} className={joinClassNames('admin-summary-card-grid', className)}>
      {children}
      {items.map((item, index) => {
        const itemClass = joinClassNames(
          'admin-summary-card',
          itemClassName,
          item.tone ? `is-${item.tone}` : undefined,
          item.className,
        );
        const content = (
          <>
            {item.overline ? <small>{item.overline}</small> : <span>{item.label}</span>}
            <strong>{summaryCardValue(item)}</strong>
            {item.overline ? <span>{item.label}</span> : null}
            {summaryCardDetail(item)}
          </>
        );

        if (item.href) {
          return (
            <AdminLinkCard
              ariaCurrent={item.ariaCurrent}
              className={itemClass}
              href={item.href}
              htmlTitle={item.htmlTitle}
              key={summaryCardKey(item, index)}
            >
              {content}
            </AdminLinkCard>
          );
        }

        return (
          <AdminCard className={itemClass} key={summaryCardKey(item, index)}>
            {content}
          </AdminCard>
        );
      })}
    </div>
  );
}

function summaryCardValue(item: AdminSummaryCardItem) {
  return item.valueDateTimeValue ? (
    <DateTimeText
      fallback={item.valueDateTimeFallback ?? (typeof item.value === 'string' ? item.value : 'Not set')}
      value={item.valueDateTimeValue}
    />
  ) : (
    item.value
  );
}

function summaryCardDetail(item: AdminSummaryCardItem) {
  if (item.detailDateTimeValue) {
    return (
      <small>
        {item.detailDateTimePrefix}
        <DateTimeText
          fallback={item.detailDateTimeFallback ?? (typeof item.detail === 'string' ? item.detail : 'Not set')}
          value={item.detailDateTimeValue}
        />
        {item.detailDateTimeSuffix}
      </small>
    );
  }

  return item.detail ? <small>{item.detail}</small> : null;
}

export function AdminTraceSummary({
  ariaLabel,
  className,
  defaultKind,
  defaultScope,
  inferScope = true,
  itemClassName,
  metrics,
}: AdminTraceSummaryProps) {
  return (
    <div aria-label={ariaLabel} className={joinClassNames('service-trace-summary', className)}>
      {metrics.map((metric, index) => {
        const metricClassName = joinClassNames(itemClassName, metric.className) || undefined;
        const metricLabelText = traceNodeText(metric.label);
        const metricDetailText = traceNodeText(metric.detail);
        const inferenceText = [metricLabelText, metricDetailText].filter(Boolean).join(' ');
        const visibleScope =
          metric.scope ??
          defaultScope ??
          (inferScope && inferenceText ? inferredMetricScope(inferenceText) : undefined);
        const visibleKind =
          metric.kind ??
          defaultKind ??
          (inferenceText
            ? inferredMetricKind(inferenceText, typeof visibleScope === 'string' ? visibleScope : undefined)
            : undefined);
        const content = (
          <>
            {visibleScope ? (
              <span className={joinClassNames('metric-card-scope', visibleKind ? `is-${visibleKind}` : undefined)}>
                {visibleScope}
              </span>
            ) : null}
            <span>{metric.label}</span>
            <strong>{traceSummaryValue(metric)}</strong>
            {traceSummaryDetail(metric)}
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

function traceSummaryValue(metric: AdminTraceSummaryMetric) {
  return metric.valueDateTimeValue ? (
    <DateTimeText
      fallback={metric.valueDateTimeFallback ?? (typeof metric.value === 'string' ? metric.value : 'Not set')}
      value={metric.valueDateTimeValue}
    />
  ) : (
    metric.value
  );
}

function traceSummaryDetail(metric: AdminTraceSummaryMetric) {
  if (metric.detailDateTimeValue) {
    return (
      <small>
        {metric.detailDateTimePrefix}
        <DateTimeText
          fallback={
            metric.detailDateTimeFallback ?? (typeof metric.detail === 'string' ? metric.detail : 'Not set')
          }
          value={metric.detailDateTimeValue}
        />
        {metric.detailDateTimeSuffix}
      </small>
    );
  }

  return metric.detail ? <small>{metric.detail}</small> : null;
}

export function AdminOverviewCommandCard({
  actionLabel,
  ariaLabel,
  baseClassName,
  children,
  className,
  detail,
  href,
  htmlTitle,
  icon,
  iconClassName,
  kind,
  label,
  scope,
  trailing,
  value,
}: AdminOverviewCommandCardProps) {
  const content = (
    <>
      <span className={iconClassName ?? 'usage-overview-command-icon'}>{icon}</span>
      <div>
        {scope ? (
          <span className={joinClassNames('metric-card-scope', kind ? `is-${kind}` : undefined)}>
            {scope}
          </span>
        ) : null}
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
        {children}
        {actionLabel ? <small className="admin-overview-command-action">{actionLabel}</small> : null}
      </div>
      {trailing}
    </>
  );
  const cardClassName = joinClassNames(baseClassName ?? 'usage-overview-command-card', className);

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

function traceNodeText(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

const adminOverviewGridClassNames: Record<AdminOverviewGridVariant, string> = {
  behavior: 'usage-overview-behavior-grid',
  command: 'usage-overview-command-grid',
  content: 'usage-overview-grid',
  insight: 'usage-overview-insight-grid',
  segment: 'usage-overview-segment-grid',
};
