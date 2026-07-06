import type { ReactNode } from 'react';

import { AdminStageItem, AdminStageItemLink } from '../../components/admin-stage-item';
import { AdminSignal } from '../../components/status-badge';

export type FinanceStageListItem = {
  readonly helper: ReactNode;
  readonly href?: string;
  readonly key: string;
  readonly label: ReactNode;
  readonly signal: ReactNode;
  readonly value?: ReactNode;
};

export function FinanceStageList({ items }: { readonly items: readonly FinanceStageListItem[] }) {
  return (
    <div className="setup-stage-list admin-mt-12">
      {items.map((item) => {
        const content = (
          <>
            <AdminSignal tone="info">{item.signal}</AdminSignal>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.helper}</p>
            </div>
            {item.value === undefined || item.value === null ? null : <small>{item.value}</small>}
          </>
        );

        return item.href ? (
          <AdminStageItemLink href={item.href} key={item.key}>
            {content}
          </AdminStageItemLink>
        ) : (
          <AdminStageItem key={item.key}>
            {content}
          </AdminStageItem>
        );
      })}
    </div>
  );
}
