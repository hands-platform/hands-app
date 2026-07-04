import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminOverviewCommandCard } from '../../components/admin-overview-card';

export type FinanceListCommandTone = 'danger' | 'info' | 'neutral' | 'primary' | 'success' | 'warning';

export function FinanceListCommandBoard({
  ariaLabel,
  children,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="finance-list-command-board admin-mb-16" aria-label={ariaLabel}>
      {children}
    </section>
  );
}

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
    <AdminOverviewCommandCard
      className={`finance-list-command-card is-${tone}`}
      detail={detail}
      href={href}
      icon={<Icon size={18} aria-hidden="true" />}
      label={label}
      value={value}
    />
  );
}

export function formatFinancePercent(value: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((value / total) * 1000) / 10}%`;
}
