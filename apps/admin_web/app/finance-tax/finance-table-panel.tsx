import type { ComponentProps } from 'react';

import { AdminFilterPanel } from '../../components/admin-filter-panel';

type FinanceTablePanelProps = Omit<ComponentProps<typeof AdminFilterPanel>, 'className'> & {
  readonly className?: string;
  readonly grouped?: boolean;
};

export function FinanceTablePanel({ className, grouped = true, ...props }: FinanceTablePanelProps) {
  return (
    <AdminFilterPanel
      className={joinClassNames(
        'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card',
        grouped ? 'vuexy-booking-table-group' : undefined,
        className,
      )}
      {...props}
    />
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
