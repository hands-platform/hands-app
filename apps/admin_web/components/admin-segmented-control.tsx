import type { MouseEventHandler, ReactNode } from 'react';
import Link from 'next/link';

export type AdminSegmentedControlOption<Value extends string = string> = {
  readonly ariaLabel?: string;
  readonly href: string;
  readonly label: ReactNode;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
  readonly title?: string;
  readonly value: Value;
};

type AdminSegmentedControlProps<Value extends string = string> = {
  readonly activeValue: Value | string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly options: readonly AdminSegmentedControlOption<Value>[];
  readonly semantics?: 'default' | 'navigation' | 'tabs';
};

export function AdminSegmentedControl<Value extends string = string>({
  activeValue,
  ariaLabel,
  className,
  options,
  semantics = 'default',
}: AdminSegmentedControlProps<Value>) {
  const links = options.map((option, index) => {
    const active = option.value === activeValue;
    const linkProps = {
      'aria-current': semantics !== 'tabs' && active ? 'page' as const : undefined,
      'aria-label': option.ariaLabel,
      'aria-selected': semantics === 'tabs' ? active : undefined,
      className: mergeClassNames('booking-date-filter-button', active ? 'is-active' : undefined),
      href: option.href,
      key: `${option.value}-${index}`,
      onClick: option.onClick,
      role: semantics === 'tabs' ? 'tab' : undefined,
      title: option.title,
    };

    return isInternalRoute(option.href)
      ? <Link {...linkProps} prefetch={false} scroll={false}>{option.label}</Link>
      : <a {...linkProps}>{option.label}</a>;
  });

  const classNames = mergeClassNames('booking-date-filter-buttons', className);
  if (semantics === 'navigation') {
    return (
      <nav aria-label={ariaLabel} className={classNames}>
        {links}
      </nav>
    );
  }

  return (
    <div aria-label={ariaLabel} className={classNames} role={semantics === 'tabs' ? 'tablist' : undefined}>
      {links}
    </div>
  );
}

function isInternalRoute(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
