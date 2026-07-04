import type { ReactNode } from 'react';

import { AdminCard } from './admin-surface';

type AdminOverviewCommandCardProps = {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly icon: ReactNode;
  readonly label: ReactNode;
  readonly value: ReactNode;
};

export function AdminOverviewCommandCard({
  children,
  className,
  detail,
  icon,
  label,
  value,
}: AdminOverviewCommandCardProps) {
  return (
    <AdminCard className={joinClassNames('usage-overview-command-card', className)}>
      <span className="usage-overview-command-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
        {children}
      </div>
    </AdminCard>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
