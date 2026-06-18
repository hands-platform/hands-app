import type { ReactNode } from 'react';
import Link from 'next/link';

type AdminPersonCellProps = {
  readonly avatarClassName: string;
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
      <span aria-hidden="true" className={avatarClassName}>
        {initials ?? adminPersonInitials(label)}
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
