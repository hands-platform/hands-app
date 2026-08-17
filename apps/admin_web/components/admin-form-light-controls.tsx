import { Search } from 'lucide-react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ChangeEventHandler,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
} from 'react';

type AdminFormShellProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

type AdminFormInputProps = {
  readonly className?: string;
  readonly label: string;
  readonly labelVisibility?: 'hidden' | 'visible';
  readonly name: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'name'>;

type AdminFormSearchProps = {
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly defaultValue?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label: string;
  readonly name?: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly placeholder?: string;
  readonly value?: string;
};

type AdminFormControlLinkProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly href: string;
} & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-current' | 'aria-label' | 'download' | 'title'>;

type AdminFormControlButtonProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function AdminFormSearch({
  autoFocus,
  className,
  defaultValue,
  inputRef,
  label,
  name,
  onChange,
  placeholder = 'Search',
  value,
}: AdminFormSearchProps) {
  return (
    <label className={mergeClassNames('admin-form-search', className)}>
      <Search aria-hidden="true" size={18} />
      <span className="sr-only">{label}</span>
      <input
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        ref={inputRef}
        type="search"
        value={value}
      />
    </label>
  );
}

export function AdminFormShell({ children, className, ...formProps }: AdminFormShellProps) {
  return (
    <form {...formProps} className={mergeClassNames(className)}>
      {children}
    </form>
  );
}

export function AdminFormInput({
  className,
  label,
  labelVisibility = 'hidden',
  name,
  ...inputProps
}: AdminFormInputProps) {
  return (
    <label
      className={mergeClassNames(
        'admin-form-input',
        labelVisibility === 'visible' ? 'admin-form-control-labeled' : undefined,
        className,
      )}
    >
      <span className={labelVisibility === 'visible' ? 'admin-form-label' : 'sr-only'}>{label}</span>
      <input {...inputProps} name={name} />
    </label>
  );
}

export function AdminFormControlLink({
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
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
      className={controlClassName('admin-form-control-link', className, 'button-secondary')}
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
  type = 'submit',
  ...buttonProps
}: AdminFormControlButtonProps) {
  return (
    <button
      {...buttonProps}
      className={controlClassName('admin-form-control-button', className, 'button-primary')}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
}

function controlClassName(atom: string, className: string | undefined, defaultTone: string) {
  const tokens = className?.split(/\s+/).filter(Boolean) ?? [];
  if (!tokens.length) return `${atom} button ${defaultTone}`;
  if (tokens.includes('text-link')) return mergeClassNames(atom, ...tokens);
  if (!tokens.includes('button')) tokens.unshift('button');
  if (!tokens.some((token) => BUTTON_TONES.has(token))) tokens.push(defaultTone);
  return mergeClassNames(atom, ...tokens);
}

const BUTTON_TONES = new Set([
  'button-danger',
  'button-info',
  'button-outline',
  'button-primary',
  'button-secondary',
  'button-success',
]);

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
