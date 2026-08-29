import Link from 'next/link';
import { createElement, type ReactNode } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  ListChecks,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export type MetricCardProps = {
  className?: string;
  label: string;
  value: ReactNode;
  helper: ReactNode;
  href?: string;
  icon?: LucideIcon;
  iconSize?: number;
  kind?: MetricCardKind;
  scope?: ReactNode;
  scopeKind?: MetricCardKind;
};

export type MetricCardKind = 'action' | 'live' | 'period' | 'record' | 'risk';

function metricIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('customer') || normalized.includes('partner')) return UsersRound;
  if (normalized.includes('payment') || normalized.includes('cash') || normalized.includes('earning')) {
    return CircleDollarSign;
  }
  if (normalized.includes('failed') || normalized.includes('retry') || normalized.includes('alert')) return BellRing;
  if (normalized.includes('ready') || normalized.includes('sent') || normalized.includes('approved')) return CheckCircle2;
  if (normalized.includes('blocked') || normalized.includes('risk')) return ShieldCheck;
  if (normalized.includes('queue') || normalized.includes('task')) return ListChecks;

  return Activity;
}

export function MetricCard({
  className,
  label,
  value,
  helper,
  href,
  icon,
  iconSize = 20,
  kind,
  scope,
  scopeKind,
}: MetricCardProps) {
  const Icon = icon ?? metricIcon(label);
  const inferenceText = [label, metricNodeText(helper)].filter(Boolean).join(' ');
  const visibleScope = scope === undefined ? inferredMetricScope(inferenceText) : scope;
  const visibleKind = kind ?? inferredMetricKind(inferenceText, typeof visibleScope === 'string' ? visibleScope : undefined);
  const visibleScopeKind = scopeKind ?? visibleKind;
  const content = (
    <div className="metric-card">
      <span className="metric-card-icon" aria-hidden="true">
        {createElement(Icon, { size: iconSize, strokeWidth: 2.2 })}
      </span>
      <div className="metric-card-content">
        {visibleScope === null ? null : (
          <span className={joinClassNames('metric-card-scope', `is-${visibleScopeKind}`)}>{visibleScope}</span>
        )}
        <p>{label}</p>
        <div className={joinClassNames('metric-card-value', visibleKind === 'risk' ? 'is-risk' : undefined)}>
          <span className="sr-only">{label}: </span>
          {value}
        </div>
        <small className="muted">{helper}</small>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link className={joinClassNames('card admin-kpi-card', className)} href={href} prefetch={false}>
        {content}
      </Link>
    );
  }

  return <div className={joinClassNames('card admin-kpi-card', className)}>{content}</div>;
}

export function inferredMetricScope(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('today')) return 'Today';
  if (normalized.includes('live')) return 'Live';
  if (normalized.includes('7d') || normalized.includes('7 days')) return 'Last 7 days';
  if (normalized.includes('30d') || normalized.includes('30 days')) return 'Last 30 days';
  if (normalized.includes('month')) return 'This month';
  if (normalized.includes('selected range')) return 'Selected range';
  if (normalized.includes('current queue')) return 'Current queue';
  if (normalized.includes('active filters')) return 'Current filters';
  if (normalized.includes('current request')) return 'Current request';

  if (normalized.includes('pending') || normalized.includes('waiting') || normalized.includes('approval')) {
    return 'Pending';
  }

  if (
    normalized.includes('blocked') ||
    normalized.includes('debt') ||
    normalized.includes('failed') ||
    normalized.includes('failure') ||
    normalized.includes('missing') ||
    normalized.includes('queue') ||
    normalized.includes('refund') ||
    hasActionReviewLanguage(normalized) ||
    normalized.includes('risk')
  ) {
    return 'Needs action';
  }

  if (
    normalized.includes('active') ||
    normalized.includes('current') ||
    normalized.includes('live') ||
    normalized.includes('online') ||
    normalized.includes('open matching') ||
    normalized.includes('ready')
  ) {
    return 'Live';
  }

  if (normalized.includes('all') || normalized.includes('audit') || normalized.includes('record') || normalized.includes('total')) {
    return 'All records';
  }

  return 'Current filters';
}

export function inferredMetricKind(label: string, scope: string | undefined): MetricCardKind {
  const normalized = label.toLowerCase();

  if (
    normalized.includes('blocked') ||
    normalized.includes('debt') ||
    normalized.includes('failed') ||
    normalized.includes('failure') ||
    normalized.includes('missing') ||
    normalized.includes('risk') ||
    hasActionReviewLanguage(normalized)
  ) {
    return 'risk';
  }

  if (scope === 'Live') return 'live';
  if (scope === 'Pending' || scope === 'Needs action') return 'action';
  if (scope === 'All records') return 'record';

  return 'period';
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function metricNodeText(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function hasActionReviewLanguage(normalized: string) {
  return (
    normalized.includes('need review') ||
    normalized.includes('needs review') ||
    normalized.includes('requires review') ||
    normalized.includes('review queue') ||
    normalized.includes('review required')
  );
}
