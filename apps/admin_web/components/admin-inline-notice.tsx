import type { AriaRole, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

type AdminInlineNoticeTone = 'danger' | 'info' | 'success' | 'warning';

type AdminInlineNoticeProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly role?: AriaRole;
  readonly tone?: AdminInlineNoticeTone;
};

export function AdminInlineNotice({
  children,
  className,
  role,
  tone = 'info',
}: AdminInlineNoticeProps) {
  const Icon = noticeToneIcons[tone];

  return (
    <div className={joinClassNames('admin-inline-notice', `admin-inline-notice-${tone}`, className)} role={role}>
      <span className="admin-inline-notice-icon" aria-hidden={true}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="admin-inline-notice-message">{children}</div>
    </div>
  );
}

const noticeToneIcons: Record<AdminInlineNoticeTone, LucideIcon> = {
  danger: CircleAlert,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
