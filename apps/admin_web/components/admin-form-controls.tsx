import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import Link from 'next/link';

import { Search } from 'lucide-react';

import { AdminDirectoryFilterForm } from './admin-directory-filter-form';
import { AdminFormDatePickerField } from './admin-form-date-picker-field';

type AdminFormSelectOption = {
  readonly label: string;
  readonly value: string;
};

type AdminFormLabelVisibility = 'hidden' | 'visible';

type AdminFormSelectProps = {
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
  readonly options: readonly AdminFormSelectOption[];
} & Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  'defaultValue' | 'disabled' | 'multiple' | 'onChange' | 'required' | 'size' | 'value'
>;

type AdminFormSearchProps = {
  readonly className?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoFocus' | 'defaultValue' | 'onChange' | 'placeholder' | 'value'>;

type AdminFormDateProps = {
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly mode?: 'date' | 'month' | 'time';
  readonly name: string;
  readonly native?: boolean;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoFocus' | 'defaultValue' | 'disabled' | 'onChange' | 'required' | 'value'>;

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
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: AdminFormLabelVisibility;
  readonly name: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'accept'
  | 'defaultValue'
  | 'autoComplete'
  | 'disabled'
  | 'inputMode'
  | 'max'
  | 'maxLength'
  | 'min'
  | 'minLength'
  | 'onChange'
  | 'placeholder'
  | 'pattern'
  | 'required'
  | 'step'
  | 'type'
  | 'value'
>;

type AdminFormTextareaProps = {
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
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
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly name?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'defaultChecked' | 'disabled' | 'onChange' | 'required' | 'value'
>;

type AdminFormFileProps = {
  readonly displayValue: ReactNode;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly name?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'accept' | 'disabled' | 'onChange' | 'required'>;

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

export function AdminFormShell({ action, children, className, method, ...formProps }: AdminFormShellProps) {
  if (method?.toLowerCase() === 'get' && (typeof action === 'string' || action === undefined)) {
    return (
      <AdminDirectoryFilterForm {...formProps} action={action} className={joinClassNames(className)} method="get">
        {children}
      </AdminDirectoryFilterForm>
    );
  }

  return (
    <form {...formProps} action={action} className={joinClassNames(className)} method={method}>
      {children}
    </form>
  );
}

export function AdminFormGrid({ action, children, className, method, ...formProps }: AdminFormGridProps) {
  const mergedClassName = joinClassNames('admin-form-grid form-grid', className);
  if (method?.toLowerCase() === 'get' && (typeof action === 'string' || action === undefined)) {
    return (
      <AdminDirectoryFilterForm {...formProps} action={action} className={mergedClassName} method="get">
        {children}
      </AdminDirectoryFilterForm>
    );
  }

  return (
    <form {...formProps} action={action} className={mergedClassName} method={method}>
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
  ariaDescribedBy,
  ariaInvalid,
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  multiple,
  name,
  onChange,
  options,
  required,
  size,
  value,
}: AdminFormSelectProps) {
  return (
    <label className={joinClassNames('admin-form-select', visibleLabelClass(labelVisibility), className)}>
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <select
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        defaultValue={defaultValue}
        disabled={disabled}
        multiple={multiple}
        name={name}
        onChange={onChange}
        required={required}
        size={size}
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
  inputRef,
  label,
  labelVisibility = 'hidden',
  name,
  onChange,
  placeholder = 'Search',
  value,
}: AdminFormSearchProps) {
  return (
    <label className={joinClassNames('admin-form-search', visibleLabelClass(labelVisibility), className)}>
      <Search aria-hidden="true" size={18} />
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <input
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        ref={inputRef}
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
  ariaDescribedBy,
  ariaInvalid,
  autoFocus,
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  mode = 'date',
  name,
  native = false,
  onChange,
  required,
  value,
}: AdminFormDateProps) {
  if (native) {
    return (
      <label className={joinClassNames('admin-form-input admin-form-control-labeled', className)}>
        <span className={labelClassName(labelVisibility)}>{label}</span>
        <input
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          autoFocus={autoFocus}
          className="admin-form-date-input"
          defaultValue={defaultValue}
          disabled={disabled}
          name={name}
          onChange={onChange}
          required={required}
          type={mode}
          value={value}
        />
      </label>
    );
  }

  return (
    <AdminFormDatePickerField
      ariaDescribedBy={ariaDescribedBy}
      ariaInvalid={ariaInvalid}
      autoFocus={autoFocus}
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
          onMouseDown={preventDatePickerTextInputFocus}
          readOnly
          ref={ref}
          value={value ?? ''}
        />
      </label>
    );
  },
);

const preventDatePickerTextInputFocus: MouseEventHandler<HTMLInputElement> = (event) => {
  event.preventDefault();
};

export function AdminFormInput({
  accept,
  ariaDescribedBy,
  ariaInvalid,
  autoComplete,
  className,
  defaultValue,
  disabled,
  inputMode,
  label,
  labelVisibility = 'hidden',
  max,
  maxLength,
  min,
  minLength,
  name,
  onChange,
  placeholder,
  pattern,
  required,
  step,
  type = 'text',
  value,
}: AdminFormInputProps) {
  const datePickerMode = formDatePickerMode(type);

  if (datePickerMode) {
    return (
      <AdminFormDatePickerField
        className={datePickerWrapperClassName(className)}
        defaultValue={defaultValue}
        disabled={disabled}
        label={label}
        labelVisibility={labelVisibility}
        mode={datePickerMode}
        name={name}
        required={required}
        value={value}
      />
    );
  }

  return (
    <label
      className={joinClassNames(
        'admin-form-input',
        visibleLabelClass(labelVisibility),
        className,
      )}
    >
      <span className={labelClassName(labelVisibility)}>{label}</span>
      <input
        accept={accept}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        autoComplete={autoComplete}
        className={dateTimeNativeInputClass(type)}
        defaultValue={defaultValue}
        disabled={disabled}
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        minLength={minLength}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        pattern={pattern}
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
  ariaDescribedBy,
  ariaInvalid,
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
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
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
  ariaDescribedBy,
  ariaInvalid,
  checked,
  children,
  className,
  defaultChecked,
  disabled,
  label,
  name,
  onChange,
  required,
  value,
}: AdminFormCheckboxProps) {
  return (
    <label className={joinClassNames('admin-form-checkbox admin-form-control-labeled', className)}>
      <input
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={children ? undefined : label}
        checked={checked}
        className="admin-form-checkbox-input"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        onChange={onChange}
        required={required}
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

export function AdminFormFile({
  accept,
  disabled,
  displayValue,
  icon,
  label,
  name,
  onChange,
  required,
}: AdminFormFileProps) {
  return (
    <label className="admin-form-file admin-form-control-labeled">
      <span className="admin-form-label">{label}</span>
      <span className="admin-form-file-control">
        {icon}
        <span>{displayValue}</span>
      </span>
      <input accept={accept} disabled={disabled} name={name} onChange={onChange} required={required} type="file" />
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
  const linkProps = {
    'aria-current': ariaCurrent,
    'aria-label': ariaLabel,
    className: joinClassNames('admin-form-control-link', normalizeButtonClassNames(className, 'button button-secondary')),
    href,
    title,
  };

  return isInternalRoute(href) && download === undefined
    ? <Link {...linkProps} prefetch={false}>{children}</Link>
    : <a {...linkProps} download={download}>{children}</a>;
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

function isInternalRoute(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
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

function formDatePickerMode(
  type: InputHTMLAttributes<HTMLInputElement>['type'],
): 'date' | 'datetime-local' | 'month' | 'time' | null {
  switch (type) {
    case 'date':
      return 'date';
    case 'datetime-local':
      return 'datetime-local';
    case 'month':
      return 'month';
    case 'time':
      return 'time';
    default:
      return null;
  }
}
