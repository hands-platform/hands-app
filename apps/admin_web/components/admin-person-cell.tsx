import type { ReactNode } from 'react';
import Link from 'next/link';

export type AdminAvatarStatus = 'online' | 'matching' | 'working' | 'offline' | 'app-deleted';

const adminAvatarStatusLabels: Record<AdminAvatarStatus, string> = {
  'app-deleted': 'App delete suspected',
  matching: 'Matching waiting',
  offline: 'App offline',
  online: 'App online',
  working: 'Work in progress',
};

type AdminPersonCellProps = {
  readonly avatarClassName: string;
  readonly avatarStatus?: AdminAvatarStatus;
  readonly avatarStatusLabel?: string;
  readonly className: string;
  readonly copyClassName?: string;
  readonly helper?: ReactNode;
  readonly helperClassName?: string;
  readonly href?: string | null;
  readonly initials?: string;
  readonly label: string;
  readonly linkClassName?: string;
};

export function AdminPersonCell({
  avatarClassName,
  avatarStatus,
  avatarStatusLabel,
  className,
  copyClassName,
  helper,
  helperClassName = 'muted',
  href,
  initials,
  label,
  linkClassName,
}: AdminPersonCellProps) {
  return (
    <div className={className}>
      <span className="admin-person-avatar-shell">
        <span aria-hidden="true" className={avatarClassName}>
          {initials ?? adminPersonInitials(label)}
        </span>
        {avatarStatus ? <AdminAvatarStatusDot label={avatarStatusLabel} status={avatarStatus} /> : null}
      </span>
      <div className={copyClassName}>
        {href ? (
          <Link className={linkClassName} href={href}>
            {label}
          </Link>
        ) : (
          <strong>{label}</strong>
        )}
        {helper === undefined || helper === null ? null : <div className={helperClassName}>{helper}</div>}
      </div>
    </div>
  );
}

export function adminPersonInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}` : parts[0]?.slice(0, 2);

  return (initials || 'NA').toUpperCase();
}

type AdminAvatarStatusDotProps = {
  readonly label?: string;
  readonly status: AdminAvatarStatus;
};

export function AdminAvatarStatusDot({ label, status }: AdminAvatarStatusDotProps) {
  const statusLabel = label ?? adminAvatarStatusLabels[status];

  return (
    <span
      aria-label={statusLabel}
      className={`admin-avatar-status-dot is-${status}`}
      role="img"
      title={statusLabel}
    />
  );
}
