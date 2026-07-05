import type { ComponentProps } from 'react';

import { AdminTablePanel } from '../../components/admin-table-panel';

type FinanceTablePanelProps = ComponentProps<typeof AdminTablePanel>;

export function FinanceTablePanel(props: FinanceTablePanelProps) {
  return AdminTablePanel(props);
}
