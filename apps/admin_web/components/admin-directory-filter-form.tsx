import type { FormHTMLAttributes, ReactNode } from 'react';

type AdminDirectoryFilterFormProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

export function AdminDirectoryFilterForm({
  children,
  className,
  ...formProps
}: AdminDirectoryFilterFormProps) {
  return (
    <form {...formProps} className={mergeClassNames('admin-directory-filter-form', className)}>
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
