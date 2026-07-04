import type { ChangeEventHandler } from 'react';

import { AdminFormSearch } from './admin-form-controls';

type AdminTopbarSearchInputProps = {
  readonly autoFocus?: boolean;
  readonly label: string;
  readonly onChange: ChangeEventHandler<HTMLInputElement>;
  readonly placeholder?: string;
  readonly value: string;
};

export function AdminTopbarSearchInput({
  autoFocus,
  label,
  onChange,
  placeholder = 'Search pages',
  value,
}: AdminTopbarSearchInputProps) {
  return (
    <AdminFormSearch
      autoFocus={autoFocus}
      className="topbar-dropdown-header"
      label={label}
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
}
