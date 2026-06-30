import type { ReactNode } from 'react';

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
