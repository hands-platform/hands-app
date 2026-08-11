import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type AdminTopbarButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export const AdminTopbarButton = forwardRef<HTMLButtonElement, AdminTopbarButtonProps>(
  function AdminTopbarButton({ children, className, type = 'button', ...buttonProps }, ref) {
    return (
      <button
        {...buttonProps}
        className={joinClassNames('admin-topbar-button', className)}
        ref={ref}
        type={type}
      >
        {children}
      </button>
    );
  },
);

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, classNames) => classNames.indexOf(className) === index)
    .join(' ');
}
