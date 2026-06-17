import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

import { ChevronDown, Search } from 'lucide-react';

type AdminFormSelectOption = {
  readonly label: string;
  readonly value: string;
};

type AdminFormSelectProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
  readonly options: readonly AdminFormSelectOption[];
} & Pick<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue'>;

type AdminFormSearchProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'placeholder'>;

type AdminFormControlLinkProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly download?: string;
  readonly href: string;
};

type AdminFormControlButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly type?: 'button' | 'submit';
};

export function AdminFormSelect({
  className,
  defaultValue,
  label,
  name,
  options,
}: AdminFormSelectProps) {
  return (
    <label className={joinClassNames('admin-form-select', className)}>
      <span className="sr-only">{label}</span>
      <select defaultValue={defaultValue} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" size={16} />
    </label>
  );
}

export function AdminFormSearch({
  className,
  defaultValue,
  label,
  name,
  placeholder = 'Search',
}: AdminFormSearchProps) {
  return (
    <label className={joinClassNames('admin-form-search', className)}>
      <Search aria-hidden="true" size={18} />
      <span className="sr-only">{label}</span>
      <input defaultValue={defaultValue} name={name} placeholder={placeholder} type="search" />
    </label>
  );
}

export function AdminFormControlLink({
  children,
  className,
  download,
  href,
}: AdminFormControlLinkProps) {
  return (
    <a className={joinClassNames('admin-form-control-link', className)} download={download} href={href}>
      {children}
    </a>
  );
}

export function AdminFormControlButton({
  children,
  className,
  type = 'submit',
}: AdminFormControlButtonProps) {
  return (
    <button className={joinClassNames('admin-form-control-button', className)} type={type}>
      {children}
    </button>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
