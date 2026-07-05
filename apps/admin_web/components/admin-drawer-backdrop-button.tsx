import type { ButtonHTMLAttributes } from 'react';

type AdminDrawerBackdropButtonProps = {
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'type'>;

export function AdminDrawerBackdropButton({ className, ...buttonProps }: AdminDrawerBackdropButtonProps) {
  return (
    <button
      {...buttonProps}
      className={joinClassNames('calendar-drawer-backdrop', className)}
      type="button"
    />
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, classNames) => classNames.indexOf(className) === index)
    .join(' ');
}
