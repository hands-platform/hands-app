import type { ChangeEventHandler } from 'react';

import { Search } from 'lucide-react';

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
    <label className="topbar-dropdown-header">
      <Search aria-hidden="true" size={16} />
      <input
        aria-label={label}
        autoFocus={autoFocus}
        className="topbar-search-input"
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
