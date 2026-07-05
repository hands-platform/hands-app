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
};

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

export function MetricCard({ className, label, value, helper, href, icon, iconSize = 20 }: MetricCardProps) {
  const Icon = icon ?? metricIcon(label);
  const content = (
    <div className="metric-card">
      <span className="metric-card-icon" aria-hidden="true">
        {createElement(Icon, { size: iconSize, strokeWidth: 2.2 })}
      </span>
      <div className="metric-card-content">
        <p>{label}</p>
        <h2>{value}</h2>
        <small className="muted">{helper}</small>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link className={joinClassNames('card admin-kpi-card', className)} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={joinClassNames('card admin-kpi-card', className)}>{content}</div>;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
