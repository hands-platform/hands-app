import type { AriaRole, ReactNode } from 'react';

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
  return (
    <div className={joinClassNames('admin-inline-notice', `admin-inline-notice-${tone}`, className)} role={role}>
      {children}
    </div>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
