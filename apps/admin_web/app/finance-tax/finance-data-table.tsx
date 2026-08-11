import type { ComponentProps } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';

type FinanceDataTableProps = Omit<ComponentProps<typeof AdminDataTable>, 'className'> & {
  readonly ariaLabel?: string;
  readonly scrollClassName?: string;
};

export function FinanceDataTable({ ariaLabel, scrollClassName, ...props }: FinanceDataTableProps) {
  return (
    <AdminTableScroll ariaLabel={ariaLabel} className={scrollClassName}>
      <AdminDataTable {...props} />
    </AdminTableScroll>
  );
}
