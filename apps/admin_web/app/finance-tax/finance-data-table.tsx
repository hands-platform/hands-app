import type { ComponentProps } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';

type FinanceDataTableProps = Omit<ComponentProps<typeof AdminDataTable>, 'className'> & {
  readonly scrollClassName?: string;
};

export function FinanceDataTable({ scrollClassName, ...props }: FinanceDataTableProps) {
  return (
    <AdminTableScroll className={scrollClassName}>
      <AdminDataTable className="vuexy-booking-table" {...props} />
    </AdminTableScroll>
  );
}
