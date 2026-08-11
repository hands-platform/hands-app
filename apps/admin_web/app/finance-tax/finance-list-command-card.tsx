import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminOverviewCommandGrid } from '../../components/admin-overview-card';
import { AdminKpiCard } from '../../components/admin-surface';

export type FinanceListCommandTone = 'danger' | 'info' | 'neutral' | 'primary' | 'success' | 'warning';

const financeListCommandBoardClassName = 'finance-list-command-board';
export function FinanceListCommandBoard({
  ariaLabel,
  children,
  className,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <AdminOverviewCommandGrid
      ariaLabel={ariaLabel}
      baseClassName={financeListCommandBoardClassName}
      className={['admin-mb-16', className].filter(Boolean).join(' ')}
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
  scope,
  tone,
  value,
}: {
  readonly detail: ReactNode;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly scope?: ReactNode;
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
      kind={financeListCommandKind(tone)}
      label={label}
      scope={scope ?? financeListCommandScope(tone)}
      value={value}
    />
  );
}

function financeListCommandKind(tone: FinanceListCommandTone) {
  if (tone === 'danger') return 'risk' as const;
  if (tone === 'warning') return 'action' as const;
  if (tone === 'neutral') return 'record' as const;

  return 'period' as const;
}

function financeListCommandScope(tone: FinanceListCommandTone) {
  if (tone === 'danger' || tone === 'warning') return 'Needs action';
  if (tone === 'neutral') return 'Records';

  return 'Selected range';
}

export function formatFinancePercent(value: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((value / total) * 1000) / 10}%`;
}
