import Link from 'next/link';
import type { ComponentProps } from 'react';

type AdminStageItemProps = ComponentProps<'div'>;
type AdminStageListProps = ComponentProps<'div'>;
type AdminStageItemLinkProps = ComponentProps<typeof Link>;

export function AdminStageList({ className, ...props }: AdminStageListProps) {
  return <div {...props} className={joinClassNames('setup-stage-list', className)} />;
}

export function AdminStageItem({ className, ...props }: AdminStageItemProps) {
  return <div {...props} className={joinClassNames('setup-stage-item', className)} />;
}

export function AdminStageItemLink({ className, ...linkProps }: AdminStageItemLinkProps) {
  return <Link {...linkProps} className={joinClassNames('setup-stage-item', className)} />;
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
