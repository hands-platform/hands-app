import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminOverviewCommandGrid } from '../../components/admin-overview-card';
import { AdminKpiCard } from '../../components/admin-surface';

export type FinanceListCommandTone = 'danger' | 'info' | 'neutral' | 'primary' | 'success' | 'warning';

const financeListCommandBoardClassName = 'finance-list-command-board';
const financeListCommandCardClassName = 'finance-list-command-card';
export function FinanceListCommandBoard({
  ariaLabel,
  children,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
}) {
  return (
    <AdminOverviewCommandGrid
      ariaLabel={ariaLabel}
      baseClassName={financeListCommandBoardClassName}
      className="admin-mb-16"
    >
      {children}
    </AdminOverviewCommandGrid>
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
  readonly detail: ReactNode;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: FinanceListCommandTone;
  readonly value: ReactNode;
}) {
  return (
    <AdminKpiCard
      className={`finance-list-command-card is-${tone}`}
      helper={detail}
      href={href}
      icon={Icon}
      iconSize={18}
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
