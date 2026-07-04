import type { ReactNode } from 'react';

import { AdminCard, AdminLinkCard } from './admin-surface';

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
