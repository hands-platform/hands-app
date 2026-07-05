import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AdminIconButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function AdminIconButton({
  children,
  className,
  type = 'button',
  ...buttonProps
}: AdminIconButtonProps) {
  return (
    <button {...buttonProps} className={joinClassNames('admin-icon-button', className)} type={type}>
      {children}
    </button>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, classNames) => classNames.indexOf(className) === index)
    .join(' ');
}
