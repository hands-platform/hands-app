import type { FormHTMLAttributes, ReactNode } from 'react';

type AdminOpsNoteFormProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

export function AdminOpsNoteForm({ children, className, ...formProps }: AdminOpsNoteFormProps) {
  return (
    <form {...formProps} className={mergeClassNames('ops-note-form', className)}>
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
