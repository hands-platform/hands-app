import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AdminPaginationButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  readonly children: ReactNode;
  readonly type?: 'button' | 'submit' | 'reset';
};

export function AdminPaginationButton({
  children,
  className,
  type = 'button',
  ...buttonProps
}: AdminPaginationButtonProps) {
  return (
    <button {...buttonProps} className={joinClassNames('admin-pagination-button', className)} type={type}>
      {children}
    </button>
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
