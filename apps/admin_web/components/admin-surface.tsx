import type { ReactNode } from 'react';
import Link from 'next/link';

import { AlertCircle, LoaderCircle } from 'lucide-react';

import { MetricCard, type MetricCardProps } from './metric-card';
import { StatusBadge, type StatusBadgeTone } from './status-badge';

type AdminCardProps = {
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
};

type AdminSectionProps = {
  readonly actions?: ReactNode;
  readonly bodyClassName?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly footerClassName?: string;
  readonly headerClassName?: string;
  readonly id?: string;
  readonly status?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly statusTone?: StatusBadgeTone;
  readonly title: string;
};

type AdminKpiCardProps = MetricCardProps;

type AdminActionCardProps = {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly href: string;
  readonly htmlTitle?: string;
  readonly signalClassName?: string;
  readonly signalLabel?: ReactNode;
  readonly title: ReactNode;
  readonly value: ReactNode;
  readonly valueClassName?: string;
};

type AdminStateProps = {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly message: ReactNode;
  readonly title?: string;
};

export function AdminCard({ ariaLabel, ariaLabelledBy, children, className, id }: AdminCardProps) {
  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card', className)}
      id={id}
    >
      {children}
    </section>
  );
}

export function AdminSection({
  actions,
  bodyClassName,
  children,
  className,
  description,
  footer,
  footerClassName,
  headerClassName,
  id,
  status,
  statusLabel,
  statusTone = 'info',
  title,
}: AdminSectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  const sectionStatus = status ?? (statusLabel ? <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge> : null);
  const hasBody = children !== undefined && children !== null;

  return (
    <section className={joinClassNames('card admin-section', className)} id={id} aria-labelledby={headingId}>
      <div className={joinClassNames('ops-section-header admin-section-header', headerClassName)}>
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions || sectionStatus ? (
          <div className="participant-list">
            {sectionStatus}
            {actions}
          </div>
        ) : null}
      </div>
      {hasBody ? <div className={joinClassNames('admin-section-body', bodyClassName)}>{children}</div> : null}
      {footer ? <div className={joinClassNames('admin-section-footer', footerClassName)}>{footer}</div> : null}
    </section>
  );
}

export function AdminKpiCard(props: AdminKpiCardProps) {
  return <MetricCard {...props} />;
}

export function AdminActionCard({
  children,
  className,
  detail,
  href,
  htmlTitle,
  signalClassName,
  signalLabel,
  title,
  value,
  valueClassName,
}: AdminActionCardProps) {
  return (
    <Link className={joinClassNames('card admin-action-card', className)} href={href} title={htmlTitle}>
      <p>{title}</p>
      <strong className={joinClassNames('admin-action-card-value', valueClassName)}>{value}</strong>
      {signalLabel ? <span className={joinClassNames('signal', signalClassName)}>{signalLabel}</span> : null}
      {detail ? <p className="muted admin-mt-8">{detail}</p> : null}
      {children}
    </Link>
  );
}

export function AdminLoadingState({
  action,
  className,
  message,
  title = 'Loading records',
}: AdminStateProps) {
  return (
    <div
      className={joinClassNames('admin-state admin-loading-state', className)}
      role="status"
      aria-live="polite"
    >
      <span className="admin-state-icon" aria-hidden="true">
        <LoaderCircle size={20} />
      </span>
      <div className="admin-state-copy">
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        {action ? <div className="admin-state-action">{action}</div> : null}
      </div>
    </div>
  );
}

export function AdminErrorState({
  action,
  className,
  message,
  title = 'Unable to load records',
}: AdminStateProps) {
  return (
    <div className={joinClassNames('admin-state admin-error-state', className)} role="alert">
      <span className="admin-state-icon" aria-hidden="true">
        <AlertCircle size={20} />
      </span>
      <div className="admin-state-copy">
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        {action ? <div className="admin-state-action">{action}</div> : null}
      </div>
    </div>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
