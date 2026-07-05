import type { ComponentProps } from 'react';

import { AdminFilterPanel } from './admin-filter-panel';
import { AdminCard, AdminSection } from './admin-surface';

type AdminTablePanelProps = Omit<ComponentProps<typeof AdminFilterPanel>, 'className'> & {
  readonly className?: string;
  readonly grouped?: boolean;
};

type AdminTableCardProps = Omit<ComponentProps<typeof AdminCard>, 'className'> & {
  readonly className?: string;
  readonly grouped?: boolean;
};

type AdminTableSectionProps = Omit<ComponentProps<typeof AdminSection>, 'className'> & {
  readonly className?: string;
  readonly grouped?: boolean;
};

export function AdminTableCard({ className, grouped = true, ...props }: AdminTableCardProps) {
  return (
    <AdminCard
      className={joinClassNames(
        'vuexy-booking-table-card',
        grouped ? 'vuexy-booking-table-group' : undefined,
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableSection({ className, grouped = true, ...props }: AdminTableSectionProps) {
  return (
    <AdminSection
      className={joinClassNames(
        'vuexy-booking-table-card',
        grouped ? 'vuexy-booking-table-group' : undefined,
        className,
      )}
      {...props}
    />
  );
}

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
