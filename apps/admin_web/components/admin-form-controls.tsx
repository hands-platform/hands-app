import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { Search } from 'lucide-react';

type AdminFormSelectOption = {
  readonly label: string;
  readonly value: string;
};

type AdminFormLabelVisibility = 'hidden' | 'visible';

type AdminFormSelectProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
  readonly options: readonly AdminFormSelectOption[];
} & Pick<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue' | 'disabled' | 'onChange' | 'required' | 'value'>;

type AdminFormSearchProps = {
  readonly className?: string;
  readonly label: string;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'onChange' | 'placeholder' | 'value'>;

type AdminFormDateProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'disabled' | 'onChange' | 'value'>;

type AdminFormDateTimeProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'disabled' | 'onChange' | 'required' | 'value'>;

type AdminFormInputProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'defaultValue'
  | 'autoComplete'
  | 'disabled'
  | 'max'
  | 'maxLength'
  | 'min'
  | 'minLength'
  | 'onChange'
  | 'placeholder'
  | 'required'
  | 'step'
  | 'type'
  | 'value'
>;

type AdminFormTextareaProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
  readonly textareaClassName?: string;
} & Pick<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  | 'defaultValue'
  | 'disabled'
  | 'maxLength'
  | 'minLength'
  | 'onChange'
  | 'placeholder'
  | 'required'
  | 'rows'
  | 'value'
>;

type AdminFormCheckboxProps = {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly name?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'defaultChecked' | 'disabled' | 'onChange' | 'value'
>;

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
  disabled,
  label,
  labelVisibility = 'hidden',
  name,
  onChange,
  options,
  required,
  value,
}: AdminFormSelectProps) {
  return (
    <label className={joinClassNames('admin-form-select', visibleLabelClass(labelVisibility), className)}>
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <select
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        onChange={onChange}
        required={required}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
  labelVisibility = 'hidden',
  name,
  onChange,
  value,
}: AdminFormDateProps) {
  return (
    <label className={joinClassNames('admin-form-date', 'admin-form-date-picker', visibleLabelClass(labelVisibility), className)}>
      <span className={labelClassName(labelVisibility)}>{label}</span>
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

export function AdminFormDateTime({
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility,
  name,
  onChange,
  required,
  value,
}: AdminFormDateTimeProps) {
  return AdminFormInput({
    className,
    defaultValue,
    disabled,
    label,
    labelVisibility,
    name,
    onChange,
    required,
    type: 'datetime-local',
    value,
  });
}

export function AdminFormInput({
  autoComplete,
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  max,
  maxLength,
  min,
  minLength,
  name,
  onChange,
  placeholder,
  required,
  step,
  type = 'text',
  value,
}: AdminFormInputProps) {
  return (
    <label
      className={joinClassNames(
        'admin-form-input',
        dateTimeInputClass(type),
        visibleLabelClass(labelVisibility),
        className,
      )}
    >
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <input
        autoComplete={autoComplete}
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
        step={step}
        type={type}
        value={value}
      />
    </label>
  );
}

export function AdminFormTextarea({
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  maxLength,
  minLength,
  name,
  onChange,
  placeholder,
  required,
  rows = 4,
  textareaClassName,
  value,
}: AdminFormTextareaProps) {
  return (
    <label className={joinClassNames('admin-form-textarea', visibleLabelClass(labelVisibility), className)}>
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <textarea
        className={textareaClassName}
        defaultValue={defaultValue}
        disabled={disabled}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        value={value}
      />
    </label>
  );
}

export function AdminFormCheckbox({
  checked,
  children,
  className,
  defaultChecked,
  disabled,
  label,
  name,
  onChange,
  value,
}: AdminFormCheckboxProps) {
  return (
    <label className={joinClassNames('admin-form-checkbox', className)}>
      <input
        aria-label={children ? undefined : label}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        onChange={onChange}
        type="checkbox"
        value={value}
      />
      {children ?? <span className="sr-only">{label}</span>}
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

function labelClassName(visibility: AdminFormLabelVisibility) {
  return visibility === 'visible' ? 'admin-form-label' : 'sr-only';
}

function visibleLabelClass(visibility: AdminFormLabelVisibility) {
  return visibility === 'visible' ? 'admin-form-control-labeled' : undefined;
}

function dateTimeInputClass(type: InputHTMLAttributes<HTMLInputElement>['type']) {
  return type === 'date' || type === 'datetime-local' || type === 'month' || type === 'time'
    ? 'admin-form-input-date-picker'
    : undefined;
}
