'use client';

import type { FormHTMLAttributes, ReactNode, SubmitEvent } from 'react';
import { startTransition } from 'react';

type AdminDirectoryFilterFormProps = {
  readonly canonicalDefaults?: Readonly<Record<string, string>>;
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

export function AdminDirectoryFilterForm({
  canonicalDefaults,
  children,
  className,
  onSubmit,
  ...formProps
}: AdminDirectoryFilterFormProps) {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    onSubmit?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    const action = event.currentTarget.getAttribute('action') || window.location.pathname;
    const href = canonicalGetFormHref(
      action,
      new FormData(event.currentTarget).entries(),
      canonicalDefaults ?? {},
    );
    startTransition(() => window.history.pushState(null, '', href));
  };

  return (
    <form
      {...formProps}
      className={mergeClassNames('admin-directory-filter-form', className)}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}

export function canonicalGetFormHref(
  action: string,
  entries: Iterable<[string, FormDataEntryValue]>,
  defaults: Readonly<Record<string, string>>,
) {
  const search = new URLSearchParams();
  for (const [name, value] of entries) {
    if (typeof value === 'string' && value && value !== defaults[name]) {
      search.append(name, value);
    }
  }
  const query = search.toString();
  return query ? `${action}${action.includes('?') ? '&' : '?'}${query}` : action;
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
