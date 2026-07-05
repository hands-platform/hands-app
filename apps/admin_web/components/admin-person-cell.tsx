import type { ReactNode } from 'react';
import Link from 'next/link';
import { adminAvatarStatusLabels, type AdminAvatarStatus } from '../lib/admin-avatar-status';

export type { AdminAvatarStatus } from '../lib/admin-avatar-status';

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
    <div className={joinClassNames(className)}>
      <AdminAvatar
        className={avatarClassName}
        initials={initials ?? adminPersonInitials(label)}
        status={avatarStatus}
        statusLabel={avatarStatusLabel}
      />
      <div className={joinClassNames(copyClassName)}>
        {href ? (
          <Link className={joinClassNames(linkClassName)} href={href}>
            {label}
          </Link>
        ) : (
          <strong>{label}</strong>
        )}
        {helper === undefined || helper === null ? null : <div className={joinClassNames(helperClassName)}>{helper}</div>}
      </div>
    </div>
  );
}

export function adminPersonInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}` : parts[0]?.slice(0, 2);

  return (initials || 'NA').toUpperCase();
}

type AdminAvatarProps = {
  readonly className: string;
  readonly initials: string;
  readonly label?: string;
  readonly status?: AdminAvatarStatus;
  readonly statusLabel?: string;
};

export function AdminAvatar({ className, initials, label, status, statusLabel }: AdminAvatarProps) {
  return (
    <span aria-label={label} className="admin-person-avatar-shell">
      <span aria-hidden="true" className={joinClassNames(className)}>
        {initials}
      </span>
      {status ? <AdminAvatarStatusDot label={statusLabel} status={status} /> : null}
    </span>
  );
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

function joinClassNames(...classNames: Array<string | undefined>) {
  const tokens = new Set<string>();

  for (const className of classNames) {
    for (const token of className?.split(/\s+/) ?? []) {
      if (token) {
        tokens.add(token);
      }
    }
  }

  return Array.from(tokens).join(' ');
}
