import Link from 'next/link';
import type { ComponentProps } from 'react';

type AdminTextLinkProps = ComponentProps<typeof Link>;

export function AdminTextLink({ className, ...linkProps }: AdminTextLinkProps) {
  return <Link {...linkProps} className={joinClassNames('text-link', className)} />;
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
