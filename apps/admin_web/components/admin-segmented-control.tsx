import type { MouseEventHandler, ReactNode } from 'react';

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
};

export function AdminSegmentedControl<Value extends string = string>({
  activeValue,
  ariaLabel,
  className,
  options,
}: AdminSegmentedControlProps<Value>) {
  return (
    <div aria-label={ariaLabel} className={mergeClassNames('booking-date-filter-buttons', className)}>
      {options.map((option, index) => {
        const active = option.value === activeValue;

        return (
          <a
            aria-current={active ? 'page' : undefined}
            aria-label={option.ariaLabel}
            className={mergeClassNames('booking-date-filter-button', active ? 'is-active' : undefined)}
            href={option.href}
            key={`${option.value}-${index}`}
            onClick={option.onClick}
            title={option.title}
          >
            {option.label}
          </a>
        );
      })}
    </div>
  );
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
