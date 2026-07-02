import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export type FinanceListCommandTone = 'danger' | 'info' | 'neutral' | 'primary' | 'success' | 'warning';

export function FinanceListCommandCard({
  detail,
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  readonly detail: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: FinanceListCommandTone;
  readonly value: string;
}) {
  return (
    <Link className={`finance-list-command-card is-${tone}`} href={href}>
      <span className="usage-overview-command-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </Link>
  );
}

export function formatFinancePercent(value: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((value / total) * 1000) / 10}%`;
}
