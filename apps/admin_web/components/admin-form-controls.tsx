import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

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
} & Pick<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue' | 'onChange' | 'value'>;

type AdminFormSearchProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'placeholder' | 'value'>;

type AdminFormDateProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'disabled' | 'onChange' | 'value'>;

type AdminFormInputProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'defaultValue'
  | 'disabled'
  | 'max'
  | 'maxLength'
  | 'min'
  | 'minLength'
  | 'onChange'
  | 'placeholder'
  | 'required'
  | 'type'
  | 'value'
>;

type AdminFormTextareaProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
  readonly textareaClassName?: string;
} & Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue' | 'onChange' | 'placeholder' | 'rows' | 'value'>;

type AdminFormControlLinkProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly href: string;
} & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-current' | 'download' | 'title'>;

type AdminFormControlButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly type?: 'button' | 'submit';
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'onClick'>;

export function AdminFormSelect({
  className,
  defaultValue,
  label,
  name,
  onChange,
  options,
  value,
}: AdminFormSelectProps) {
  return (
    <label className={joinClassNames('admin-form-select', className)}>
      <span className="sr-only">{label}</span>
      <select defaultValue={defaultValue} name={name} onChange={onChange} value={value}>
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
  onChange,
  placeholder = 'Search',
  value,
}: AdminFormSearchProps) {
  return (
    <label className={joinClassNames('admin-form-search', className)}>
      <Search aria-hidden="true" size={18} />
      <span className="sr-only">{label}</span>
      <input
        defaultValue={defaultValue}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}

export function AdminFormDate({
  className,
  defaultValue,
  disabled,
  label,
  name,
  onChange,
  value,
}: AdminFormDateProps) {
  return (
    <label className={joinClassNames('admin-form-date', className)}>
      <span className="sr-only">{label}</span>
      <input
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        onChange={onChange}
        type="date"
        value={value}
      />
    </label>
  );
}

export function AdminFormInput({
  className,
  defaultValue,
  disabled,
  label,
  max,
  maxLength,
  min,
  minLength,
  name,
  onChange,
  placeholder,
  required,
  type = 'text',
  value,
}: AdminFormInputProps) {
  return (
    <label className={joinClassNames('admin-form-input', className)}>
      <span className="sr-only">{label}</span>
      <input
        defaultValue={defaultValue}
        disabled={disabled}
        max={max}
        maxLength={maxLength}
        min={min}
        minLength={minLength}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function AdminFormTextarea({
  className,
  defaultValue,
  label,
  name,
  onChange,
  placeholder,
  rows = 4,
  textareaClassName,
  value,
}: AdminFormTextareaProps) {
  return (
    <label className={joinClassNames('admin-form-textarea', className)}>
      <span className="sr-only">{label}</span>
      <textarea
        className={textareaClassName}
        defaultValue={defaultValue}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </label>
  );
}

export function AdminFormControlLink({
  'aria-current': ariaCurrent,
  children,
  className,
  download,
  href,
  title,
}: AdminFormControlLinkProps) {
  return (
    <a
      aria-current={ariaCurrent}
      className={joinClassNames('admin-form-control-link', className)}
      download={download}
      href={href}
      title={title}
    >
      {children}
    </a>
  );
}

export function AdminFormControlButton({
  children,
  className,
  disabled,
  onClick,
  type = 'submit',
}: AdminFormControlButtonProps) {
  return (
    <button
      className={joinClassNames('admin-form-control-button', className)}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
