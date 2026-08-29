'use client';

import type { FormHTMLAttributes, ReactNode, SubmitEvent } from 'react';

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
    if (event.currentTarget.dataset.adminDirectorySubmitting === 'true') {
      event.preventDefault();
      return;
    }
    prepareCanonicalGetFormSubmission(event.currentTarget.elements, canonicalDefaults ?? {});
    event.currentTarget.dataset.adminDirectorySubmitting = 'true';
    event.currentTarget.setAttribute('aria-busy', 'true');
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

export function prepareCanonicalGetFormSubmission(
  elements: ArrayLike<Element | CanonicalGetFormControl>,
  defaults: Readonly<Record<string, string>>,
) {
  for (const element of Array.from(elements)) {
    const control = element as CanonicalGetFormControl;
    if (!control.name || control.disabled || typeof control.value !== 'string') continue;
    const type = control.type?.toLowerCase();
    if (type && ['button', 'file', 'image', 'reset', 'submit'].includes(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !control.checked) continue;
    const normalizedValue = control.value.trim();
    if (!normalizedValue || normalizedValue === defaults[control.name]) {
      if (control.dataset) control.dataset.adminDirectoryCanonicalDisabled = 'true';
      control.disabled = true;
    } else {
      control.value = normalizedValue;
    }
  }
}

export function restoreCanonicalGetForm(form: HTMLFormElement) {
  for (const control of form.querySelectorAll<HTMLElement>(
    '[data-admin-directory-canonical-disabled="true"]',
  )) {
    if ('disabled' in control) control.disabled = false;
    delete control.dataset.adminDirectoryCanonicalDisabled;
  }
  delete form.dataset.adminDirectorySubmitting;
  form.removeAttribute('aria-busy');
  form.reset();
}

type CanonicalGetFormControl = {
  checked?: boolean;
  dataset?: Record<string, string>;
  disabled?: boolean;
  name?: string;
  type?: string;
  value?: string;
};

if (typeof window !== 'undefined') {
  const restoreVisibleDirectoryForms = () => {
    const restoreForms = () => {
      for (const form of document.querySelectorAll<HTMLFormElement>(
        'form.admin-directory-filter-form',
      )) {
        restoreCanonicalGetForm(form);
      }
    };
    window.setTimeout(restoreForms);
    window.requestAnimationFrame(() => window.requestAnimationFrame(restoreForms));
  };
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restoreVisibleDirectoryForms();
  });
  window.addEventListener('popstate', restoreVisibleDirectoryForms);
}

export function canonicalGetFormHref(
  action: string,
  entries: Iterable<[string, FormDataEntryValue]>,
  defaults: Readonly<Record<string, string>>,
) {
  const search = new URLSearchParams();
  for (const [name, value] of entries) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (normalizedValue && normalizedValue !== defaults[name]) {
      search.append(name, normalizedValue);
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
