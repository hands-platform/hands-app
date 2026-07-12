import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { Search } from 'lucide-react';

import { AdminFormDatePickerField } from './admin-form-date-picker-field';

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
  readonly name?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoFocus' | 'defaultValue' | 'onChange' | 'placeholder' | 'value'>;

type AdminFormDateProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly mode?: 'date' | 'month' | 'time';
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'disabled' | 'onChange' | 'required' | 'value'>;

type AdminFormDateTimeProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'disabled' | 'onChange' | 'required' | 'value'>;

type AdminFormDatePickerInputProps = {
  readonly className?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick?: MouseEventHandler<HTMLInputElement>;
  readonly value?: string;
};

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

type AdminFormStaticValueProps = {
  readonly className?: string;
  readonly hiddenName?: string;
  readonly hiddenValue?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly value: ReactNode;
};

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
} & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-current' | 'aria-label' | 'download' | 'title'>;

type AdminFormControlButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

type AdminFormControlStackProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

type AdminFormActionRowProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly wide?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

type AdminDrawerActionFooterProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

type AdminFormGridProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

type AdminFormShellProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

type AdminFormGridFieldsProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

type AdminDrawerFormGridProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

type AdminDrawerFormGridFieldsProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>;

export function AdminFormShell({ children, className, ...formProps }: AdminFormShellProps) {
  return (
    <form {...formProps} className={joinClassNames(className)}>
      {children}
    </form>
  );
}

export function AdminFormGrid({ children, className, ...formProps }: AdminFormGridProps) {
  return (
    <form {...formProps} className={joinClassNames('admin-form-grid form-grid', className)}>
      {children}
    </form>
  );
}

export function AdminFormGridFields({ children, className, ...divProps }: AdminFormGridFieldsProps) {
  return (
    <div {...divProps} className={joinClassNames('admin-form-grid form-grid', className)}>
      {children}
    </div>
  );
}

export function AdminDrawerFormGrid({ children, className, ...formProps }: AdminDrawerFormGridProps) {
  return (
    <form {...formProps} className={joinClassNames('calendar-form-grid', className)}>
      {children}
    </form>
  );
}

export function AdminDrawerFormGridFields({ children, className, ...divProps }: AdminDrawerFormGridFieldsProps) {
  return (
    <div {...divProps} className={joinClassNames('calendar-form-grid', className)}>
      {children}
    </div>
  );
}

export function AdminFormControlStack({ children, className, ...divProps }: AdminFormControlStackProps) {
  return (
    <div {...divProps} className={joinClassNames('admin-form-control-stack', className)}>
      {children}
    </div>
  );
}

export function AdminFormActionRow({ children, className, wide = true, ...divProps }: AdminFormActionRowProps) {
  return (
    <div {...divProps} className={joinClassNames('admin-form-action-row', wide ? 'form-grid-wide' : undefined, className)}>
      {children}
    </div>
  );
}

export function AdminDrawerActionFooter({ children, className, ...divProps }: AdminDrawerActionFooterProps) {
  return (
    <div {...divProps} className={joinClassNames('calendar-drawer-footer', className)}>
      {children}
    </div>
  );
}

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
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminFormSearch({
  autoFocus,
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
        autoFocus={autoFocus}
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
  mode = 'date',
  name,
  required,
  value,
}: AdminFormDateProps) {
  return (
    <AdminFormDatePickerField
      className={datePickerWrapperClassName(className)}
      defaultValue={defaultValue}
      disabled={disabled}
      label={label}
      labelVisibility={labelVisibility}
      mode={mode}
      name={name}
      required={required}
      value={value}
    />
  );
}

export function AdminFormDateTime({
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  name,
  required,
  value,
}: AdminFormDateTimeProps) {
  return (
    <AdminFormDatePickerField
      className={datePickerWrapperClassName(className)}
      defaultValue={defaultValue}
      disabled={disabled}
      label={label}
      labelVisibility={labelVisibility}
      mode="datetime-local"
      name={name}
      required={required}
      value={value}
    />
  );
}

export const AdminFormDatePickerInput = forwardRef<HTMLInputElement, AdminFormDatePickerInputProps>(
  function AdminFormDatePickerInput({ className, disabled, label, onClick, value }, ref) {
    return (
      <label
        className={joinClassNames(
          'admin-form-input',
          'admin-form-date-picker',
          'admin-form-input-date-picker',
          'admin-form-control-labeled',
          'calendar-datepicker-input',
          className,
        )}
      >
        <span className="admin-form-label">{label}</span>
        <input
          aria-label={label}
          className="admin-form-date-input"
          disabled={disabled}
          onClick={onClick}
          readOnly
          ref={ref}
          value={value ?? ''}
        />
      </label>
    );
  },
);

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
        className={dateTimeNativeInputClass(type)}
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

export function AdminFormStaticValue({
  className,
  hiddenName,
  hiddenValue,
  label,
  labelVisibility = 'hidden',
  value,
}: AdminFormStaticValueProps) {
  return (
    <div className={joinClassNames('admin-form-static-value', visibleLabelClass(labelVisibility), className)}>
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <strong>{value}</strong>
      {hiddenName ? <input name={hiddenName} type="hidden" value={hiddenValue ?? ''} /> : null}
    </div>
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
    <label className={joinClassNames('admin-form-checkbox admin-form-control-labeled', className)}>
      <input
        aria-label={children ? undefined : label}
        checked={checked}
        className="admin-form-checkbox-input"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        onChange={onChange}
        type="checkbox"
        value={value}
      />
      <span aria-hidden="true" className="admin-form-checkbox-mark" />
      {children ? (
        <span className="admin-form-checkbox-label">{children}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </label>
  );
}

export function AdminFormControlLink({
  'aria-label': ariaLabel,
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
      aria-label={ariaLabel}
      className={joinClassNames('admin-form-control-link', normalizeButtonClassNames(className, 'button button-secondary'))}
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
  ...buttonProps
}: AdminFormControlButtonProps) {
  return (
    <button
      {...buttonProps}
      className={joinClassNames('admin-form-control-button', normalizeButtonClassNames(className, 'button button-primary'))}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return mergeClassNameTokens(classNames.flatMap(splitClassNames));
}

function normalizeButtonClassNames(className: string | undefined, defaultClassName: string) {
  const defaultTokens = splitClassNames(defaultClassName);
  const mappedTokens = splitClassNames(className).reduce<string[]>((tokens, token) => {
    const mappedToken = legacyButtonClassMap[token] ?? token;
    if (mappedToken && !tokens.includes(mappedToken)) {
      tokens.push(mappedToken);
    }
    return tokens;
  }, []);

  if (mappedTokens.includes('text-link')) {
    return mappedTokens.join(' ');
  }

  if (!mappedTokens.length) {
    return defaultTokens.join(' ');
  }

  if (mappedTokens.some(isButtonToneClass)) {
    return ensureButtonBaseToken(mappedTokens).join(' ');
  }

  return mergeClassNames(defaultTokens, mappedTokens);
}

function splitClassNames(className: string | undefined) {
  return className?.split(/\s+/).filter(Boolean) ?? [];
}

function mergeClassNameTokens(tokens: string[]) {
  return tokens.filter((token, index) => tokens.indexOf(token) === index).join(' ');
}

function ensureButtonBaseToken(tokens: string[]) {
  return tokens.includes('button') ? tokens : ['button', ...tokens];
}

function mergeClassNames(baseTokens: string[], customTokens: string[]) {
  return [...baseTokens, ...customTokens.filter((token) => !baseTokens.includes(token))].join(' ');
}

function isButtonToneClass(className: string) {
  return buttonToneClassNames.has(className);
}

const buttonToneClassNames = new Set([
  'button-danger',
  'button-info',
  'button-outline',
  'button-primary',
  'button-secondary',
  'button-success',
]);

const legacyButtonClassMap: Record<string, string> = {
  btn: 'button',
  'btn-danger': 'button-danger',
  'btn-info': 'button-info',
  'btn-outline': 'button-outline',
  'btn-primary': 'button-primary',
  'btn-sm': 'button-sm',
  'btn-success': 'button-success',
};

function labelClassName(visibility: AdminFormLabelVisibility) {
  return visibility === 'visible' ? 'admin-form-label' : 'sr-only';
}

function visibleLabelClass(visibility: AdminFormLabelVisibility) {
  return visibility === 'visible' ? 'admin-form-control-labeled' : undefined;
}

function datePickerWrapperClassName(className: string | undefined) {
  const pageHookTokens = splitClassNames(className).filter((token) => !datePickerShellClassNames.has(token));

  return joinClassNames('admin-form-control-fluid', 'calendar-datepicker-field', ...pageHookTokens);
}

function dateTimeInputClass(type: InputHTMLAttributes<HTMLInputElement>['type']) {
  return type === 'date' || type === 'datetime-local' || type === 'month' || type === 'time'
    ? 'admin-form-date-picker admin-form-input-date-picker'
    : undefined;
}

function dateTimeNativeInputClass(type: InputHTMLAttributes<HTMLInputElement>['type']) {
  return dateTimeInputClass(type) ? 'admin-form-date-input' : undefined;
}

const datePickerShellClassNames = new Set([
  'admin-form-date',
  'admin-form-date-picker',
  'admin-form-input',
  'admin-form-input-date-picker',
  'admin-form-control-labeled',
  'admin-form-control-fluid',
  'calendar-datepicker-field',
  'calendar-datepicker-input',
  'react-datepicker-wrapper',
  'react-datepicker__input-container',
]);
