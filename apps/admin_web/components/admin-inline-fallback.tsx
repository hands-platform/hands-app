import type { ReactNode } from 'react';

type AdminInlineFallbackProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function AdminInlineFallback({ children, className }: AdminInlineFallbackProps) {
  return <span className={joinClassNames('admin-inline-fallback', className)}>{children}</span>;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
