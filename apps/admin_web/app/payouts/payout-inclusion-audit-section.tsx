import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';

export type PayoutInclusionAuditCard = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: string;
};

export type PayoutInclusionAuditRow = {
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly operatorRule: string;
  readonly status: 'Batched' | 'Hold' | 'Ready';
  readonly title: ReactNode;
};

export type PayoutInclusionAudit = {
  readonly blockedCount: number;
  readonly cards: readonly PayoutInclusionAuditCard[];
  readonly readyCount: number;
  readonly rows: readonly PayoutInclusionAuditRow[];
};

type PayoutInclusionAuditSectionProps = {
  readonly audit: PayoutInclusionAudit;
};

export function PayoutInclusionAuditSection({ audit }: PayoutInclusionAuditSectionProps) {
  return (
    <AdminTablePanel
      description="Unbatched earning review before finance creates the next weekly, monthly, or admin-selected partner settlement batch."
      resultLabel={`${audit.readyCount} ready / ${audit.blockedCount} held`}
      resultTone={audit.blockedCount ? 'warning' : 'success'}
      title="Payout inclusion audit"
    >
      <AdminTraceSummary
        metrics={audit.cards.map((card) => ({
          detail: card.helper,
          label: card.label,
          value: card.value,
        }))}
      />
      <div className="setup-stage-list admin-mt-14">
        {audit.rows.map((row) => (
          <div className="setup-stage-item" key={row.id}>
            <span>{row.status}</span>
            <div>
              <strong>{row.title}</strong>
              <p className="muted">{row.detail}</p>
              <p className="muted">{row.operatorRule}</p>
            </div>
            <AdminTextLink href={row.href}>
              Open
            </AdminTextLink>
          </div>
        ))}
        {audit.rows.length === 0 ? (
          <div className="setup-stage-item">
            <span>OK</span>
            <div>
              <AdminEmptyState
                message="All visible earning rows are already batched, paid, cancelled, or absent."
                title="No unbatched earning in this range"
              />
            </div>
            <small>Clear</small>
          </div>
        ) : null}
      </div>
    </AdminTablePanel>
  );
}
