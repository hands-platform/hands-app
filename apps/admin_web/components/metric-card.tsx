import Link from 'next/link';
import { Activity, BellRing, CheckCircle2, CircleDollarSign, ListChecks, ShieldCheck, UsersRound } from 'lucide-react';

type MetricCardProps = {
  label: string;
  value: number | string;
  helper: string;
  href?: string;
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

export function MetricCard({ label, value, helper, href }: MetricCardProps) {
  const Icon = metricIcon(label);
  const content = (
    <div className="metric-card">
      <span className="metric-card-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
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
      <Link className="card" href={href}>
        {content}
      </Link>
    );
  }

  return <div className="card">{content}</div>;
}
