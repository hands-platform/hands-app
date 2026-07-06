import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

type AdminIconLinkProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ComponentProps<typeof Link>, 'children' | 'className'>;

export function AdminIconLink({ children, className, ...linkProps }: AdminIconLinkProps) {
  return (
    <Link {...linkProps} className={joinClassNames('admin-icon-button', className)}>
      {children}
    </Link>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, classNames) => classNames.indexOf(className) === index)
    .join(' ');
}
