import type { ComponentProps } from 'react';

import { AdminFilterPanel } from './admin-filter-panel';

type AdminTablePanelProps = Omit<ComponentProps<typeof AdminFilterPanel>, 'className'> & {
  readonly className?: string;
  readonly grouped?: boolean;
};

export function AdminTablePanel({ className, grouped = true, ...props }: AdminTablePanelProps) {
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
