import type { ChangeEventHandler, Ref } from 'react';

import { AdminFormSearch } from './admin-form-light-controls';

type AdminTopbarSearchInputProps = {
  readonly autoFocus?: boolean;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label: string;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly placeholder?: string;
  readonly value: string;
};

export function AdminTopbarSearchInput({
  autoFocus,
  inputRef,
  label,
  onChange,
  placeholder = 'Search pages',
  value,
}: AdminTopbarSearchInputProps) {
  return (
    <AdminFormSearch
      autoFocus={autoFocus}
      className="topbar-dropdown-header"
      inputRef={inputRef}
      label={label}
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
}
