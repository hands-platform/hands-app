import type { FormHTMLAttributes, ReactNode } from 'react';

type AdminInlineActionFormProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

export function AdminInlineActionForm({ children, className, ...formProps }: AdminInlineActionFormProps) {
  return (
    <form {...formProps} className={mergeClassNames('admin-inline-form', className)}>
      {children}
    </form>
  );
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
