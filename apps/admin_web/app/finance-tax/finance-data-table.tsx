import type { ComponentProps } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';

type FinanceDataTableProps = Omit<ComponentProps<typeof AdminDataTable>, 'className'>;

export function FinanceDataTable(props: FinanceDataTableProps) {
  return (
    <AdminTableScroll>
      <AdminDataTable className="vuexy-booking-table" {...props} />
    </AdminTableScroll>
  );
}
