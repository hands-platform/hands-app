import type { ComponentProps } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';

type FinanceDataTableProps = Omit<ComponentProps<typeof AdminDataTable>, 'className'> & {
  readonly ariaLabel?: string;
  readonly scrollClassName?: string;
  readonly tableClassName?: string;
};

export function FinanceDataTable({ ariaLabel, scrollClassName, tableClassName, ...props }: FinanceDataTableProps) {
  return (
    <AdminTableScroll ariaLabel={ariaLabel} className={scrollClassName}>
      <AdminDataTable {...props} className={tableClassName} />
    </AdminTableScroll>
  );
}
