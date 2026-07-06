import type { ReactNode } from 'react';
import Link from 'next/link';

import { AlertCircle, LoaderCircle } from 'lucide-react';

import { MetricCard, type MetricCardProps } from './metric-card';
import { AdminSignal, StatusBadge, adminSignalToneFromClassName, type StatusBadgeTone } from './status-badge';

type AdminCardProps = {
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
};

type AdminDetailGridProps = {
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminCardHeaderProps = {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly title: ReactNode;
};

type AdminNotePanelProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
};

type AdminNoticeCardProps = AdminCardProps & {
  readonly role?: 'alert' | 'status';
  readonly tone?: AdminNoticeTone;
};

type AdminNoticeTone = 'danger' | 'info' | 'success' | 'warning';

type AdminDisclosureCardProps = AdminCardProps & {
  readonly open?: boolean;
};

type AdminDisclosureProps = AdminCardProps & {
  readonly open?: boolean;
};

type AdminFormCardProps = AdminCardProps & {
  readonly action?: string | ((formData: FormData) => void | Promise<void>);
  readonly method?: 'get' | 'post';
};

type AdminActionFormCardProps = {
  readonly action: string | ((formData: FormData) => void | Promise<void>);
  readonly children: ReactNode;
  readonly className?: string;
  readonly method?: 'get' | 'post';
};

type AdminDialogCardProps = AdminCardProps & {
  readonly ariaDescribedBy: string;
  readonly loading?: boolean;
};

type AdminLinkCardProps = AdminCardProps & {
  readonly href: string;
  readonly htmlTitle?: string;
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
  readonly actionLabel?: ReactNode;
  readonly actionLabelClassName?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly detail?: ReactNode;
  readonly href: string;
  readonly htmlTitle?: string;
  readonly leading?: ReactNode;
  readonly signalClassName?: string;
  readonly signalLabel?: ReactNode;
  readonly title?: ReactNode;
  readonly value?: ReactNode;
  readonly valueClassName?: string;
  readonly variant?: 'default' | 'ops-task';
};

type AdminTaskCardProps = Omit<AdminActionCardProps, 'href' | 'htmlTitle' | 'variant'> & {
  readonly leading?: ReactNode;
};

type AdminBasicTimelineTone = 'danger' | 'info' | 'primary' | 'success' | 'warning';

export type AdminBasicTimelineMeta = {
  readonly label: string;
  readonly value: ReactNode;
};

export type AdminBasicTimelineItem = {
  readonly detail?: ReactNode;
  readonly detailClassName?: string | null;
  readonly id: string;
  readonly meta?: readonly AdminBasicTimelineMeta[];
  readonly statusLabel?: ReactNode;
  readonly statusTone?: StatusBadgeTone;
  readonly time?: ReactNode;
  readonly title: ReactNode;
  readonly tone: AdminBasicTimelineTone;
  readonly value?: ReactNode;
};

type AdminBasicTimelineProps = {
  readonly className?: string;
  readonly compactMeta?: boolean;
  readonly items: readonly AdminBasicTimelineItem[];
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

export function AdminNoteCard({ ariaLabel, ariaLabelledBy, children, className, id }: AdminCardProps) {
  return (
    <AdminCard
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
      className={joinClassNames('ops-task-note', className)}
      id={id}
    >
      {children}
    </AdminCard>
  );
}

export function AdminAsideCard({ ariaLabel, ariaLabelledBy, children, className, id }: AdminCardProps) {
  return (
    <aside
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card', className)}
      id={id}
    >
      {children}
    </aside>
  );
}

export function AdminDetailGrid({ ariaLabel, ariaLabelledBy, children, className }: AdminDetailGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('detail-grid', className)}
    >
      {children}
    </section>
  );
}

export function AdminCardHeader({ actions, className, description, title }: AdminCardHeaderProps) {
  return (
    <div className={joinClassNames('ops-section-header admin-section-header admin-card-header', className)}>
      <div>
        <h3>{title}</h3>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="participant-list">{actions}</div> : null}
    </div>
  );
}

export function AdminNotePanel({ children, className, id }: AdminNotePanelProps) {
  return (
    <div className={joinClassNames('ops-task-note', className)} id={id}>
      {children}
    </div>
  );
}

export function AdminNoticeCard({
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  id,
  role,
  tone,
}: AdminNoticeCardProps) {
  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames(
        'card admin-card admin-notice-card',
        tone ? `admin-notice-${tone}` : undefined,
        className,
      )}
      id={id}
      role={role}
    >
      {children}
    </section>
  );
}

export function AdminDisclosureCard({
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  id,
  open,
}: AdminDisclosureCardProps) {
  return (
    <details
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card admin-disclosure', className)}
      id={id}
      open={open}
    >
      {children}
    </details>
  );
}

export function AdminDisclosure({
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  id,
  open,
}: AdminDisclosureProps) {
  return (
    <details
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('admin-disclosure', className)}
      id={id}
      open={open}
    >
      {children}
    </details>
  );
}

export function AdminFormCard({
  action,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  id,
  method,
}: AdminFormCardProps) {
  return (
    <form
      action={action}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card', className)}
      id={id}
      method={method}
    >
      {children}
    </form>
  );
}

export function AdminActionFormCard({
  action,
  children,
  className,
  method,
}: AdminActionFormCardProps) {
  return (
    <form action={action} className={joinClassNames('action-button-card', className)} method={method}>
      {children}
    </form>
  );
}

export function AdminDialogCard({
  ariaDescribedBy,
  ariaLabelledBy,
  children,
  className,
  id,
  loading,
}: AdminDialogCardProps) {
  return (
    <section
      aria-busy={loading || undefined}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card', className)}
      id={id}
      role="alertdialog"
    >
      {children}
    </section>
  );
}

export function AdminLinkCard({
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  href,
  htmlTitle,
  id,
}: AdminLinkCardProps) {
  return (
    <Link
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={joinClassNames('card admin-card', className)}
      href={href}
      id={id}
      title={htmlTitle}
    >
      {children}
    </Link>
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
  actionLabel,
  actionLabelClassName,
  children,
  className,
  detail,
  href,
  htmlTitle,
  leading,
  signalClassName,
  signalLabel,
  title,
  value,
  valueClassName,
  variant = 'default',
}: AdminActionCardProps) {
  if (variant === 'ops-task') {
    const hasTitle = title !== undefined && title !== null;
    const hasValue = value !== undefined && value !== null;

    return (
      <Link className={joinClassNames('ops-task-card', className)} href={href} title={htmlTitle}>
        {leading}
        {signalLabel ? renderAdminSurfaceSignal(signalClassName, signalLabel) : null}
        {hasTitle ? <h3>{title}</h3> : null}
        {hasTitle && detail ? <p>{detail}</p> : null}
        {hasValue ? <strong className={joinClassNames('ops-task-card-value', valueClassName)}>{value}</strong> : null}
        {!hasTitle && detail ? <p>{detail}</p> : null}
        {children}
        {actionLabel ? <small className={actionLabelClassName}>{actionLabel}</small> : null}
      </Link>
    );
  }

  return (
    <Link className={joinClassNames('card admin-action-card', className)} href={href} title={htmlTitle}>
      {title !== undefined && title !== null ? <p>{title}</p> : null}
      {value !== undefined && value !== null ? (
        <strong className={joinClassNames('admin-action-card-value', valueClassName)}>{value}</strong>
      ) : null}
      {signalLabel ? renderAdminSurfaceSignal(signalClassName, signalLabel) : null}
      {detail ? <p className="muted admin-mt-8">{detail}</p> : null}
      {children}
    </Link>
  );
}

export function AdminTaskCard({
  actionLabel,
  children,
  className,
  detail,
  leading,
  signalClassName,
  signalLabel,
  title,
  value,
  valueClassName,
}: AdminTaskCardProps) {
  const hasTitle = title !== undefined && title !== null;
  const hasValue = value !== undefined && value !== null;

  return (
    <div className={joinClassNames('ops-task-card', className)}>
      {leading}
      {signalLabel ? renderAdminSurfaceSignal(signalClassName, signalLabel) : null}
      {hasTitle ? <h3>{title}</h3> : null}
      {hasTitle && detail ? <p>{detail}</p> : null}
      {hasValue ? <strong className={joinClassNames('ops-task-card-value', valueClassName)}>{value}</strong> : null}
      {!hasTitle && detail ? <p>{detail}</p> : null}
      {children}
      {actionLabel ? <small>{actionLabel}</small> : null}
    </div>
  );
}

export function AdminBasicTimeline({ className, compactMeta, items }: AdminBasicTimelineProps) {
  return (
    <div className={joinClassNames('vuexy-basic-timeline', className)}>
      {items.map((item, index) => (
        <div className="vuexy-basic-timeline-item" key={`${item.id}-${index}`}>
          <div className="vuexy-basic-timeline-separator" aria-hidden="true">
            <span className={`vuexy-basic-timeline-dot is-${item.tone}`} />
            {index < items.length - 1 ? <span className="vuexy-basic-timeline-connector" /> : null}
          </div>
          <div className="vuexy-basic-timeline-content">
            <div className="vuexy-basic-timeline-title-row">
              <div>
                {item.statusLabel ? (
                  <StatusBadge tone={item.statusTone ?? 'info'}>{item.statusLabel}</StatusBadge>
                ) : null}
                <h3>{item.title}</h3>
                {item.value ? <strong>{item.value}</strong> : null}
              </div>
              {item.time ? <time>{item.time}</time> : null}
            </div>
            {item.detail ? (
              <p className={item.detailClassName === null ? undefined : item.detailClassName ?? 'muted'}>
                {item.detail}
              </p>
            ) : null}
            {item.meta?.length ? (
              <div className={joinClassNames('vuexy-basic-timeline-meta', compactMeta ? 'is-compact' : undefined)}>
                {item.meta.map((metaItem, metaIndex) => {
                  const ariaValue = timelineMetaAriaValue(metaItem.value);

                  return (
                    <div
                      aria-label={ariaValue ? `${metaItem.label}: ${ariaValue}` : undefined}
                      className="vuexy-basic-timeline-meta-item"
                      key={`${metaItem.label}-${metaIndex}`}
                    >
                      <span>{metaItem.label}</span> <strong>{metaItem.value}</strong>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
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
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}

function renderAdminSurfaceSignal(className: string | undefined, children: ReactNode) {
  return AdminSignal({
    children,
    className,
    tone: adminSignalToneFromClassName(className),
  });
}

function timelineMetaAriaValue(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return undefined;
}
