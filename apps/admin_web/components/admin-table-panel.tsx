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

export const adminTableCardChromeClassName = 'vuexy-booking-table-card';
export const adminTableGroupClassName = 'vuexy-booking-table-group';
export const adminTablePanelChromeClassName = 'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card';

export function AdminTableCard({ className, grouped = true, ...props }: AdminTableCardProps) {
  return (
    <AdminCard
      className={joinClassNames(
        adminTableCardChromeClassName,
        grouped ? adminTableGroupClassName : undefined,
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
        adminTableCardChromeClassName,
        grouped ? adminTableGroupClassName : undefined,
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
        adminTablePanelChromeClassName,
        grouped ? adminTableGroupClassName : undefined,
        className,
      )}
      {...props}
    />
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
