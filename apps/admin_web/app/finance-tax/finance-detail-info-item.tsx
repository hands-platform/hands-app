import type { ReactNode } from 'react';

import { AdminDetailGrid } from '../../components/admin-surface';

type FinanceDetailInfoItemProps = {
  readonly label: string;
  readonly value: ReactNode;
};

export function FinanceDetailInfoItem({ label, value }: FinanceDetailInfoItemProps) {
  return (
    <div className="finance-detail-info-item">
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export function FinanceDetailGrid({ children }: { readonly children: ReactNode }) {
  return <AdminDetailGrid className="admin-mt-16">{children}</AdminDetailGrid>;
}
