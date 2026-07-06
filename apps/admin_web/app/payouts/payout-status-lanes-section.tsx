import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminDetailGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { shortRecordId } from '../../lib/admin-format';

export type PayoutStatusLaneBatch = {
  readonly amount: number;
  readonly currency: string;
  readonly earningCount: number;
  readonly id: string;
  readonly opsHint: string;
  readonly partnerLabel: string;
};

export type PayoutStatusLane = {
  readonly batches: readonly PayoutStatusLaneBatch[];
  readonly emptyText: string;
  readonly pillClass: string;
  readonly title: string;
};

type PayoutStatusLanesSectionProps = {
  readonly batchCount: number;
  readonly lanes: readonly PayoutStatusLane[];
};

export function PayoutStatusLanesSection({ batchCount, lanes }: PayoutStatusLanesSectionProps) {
  return (
    <AdminTablePanel
      description="Work from blocked and failed lanes first, then draft review, processing confirmation, and paid reconciliation."
      resultLabel={`${batchCount} batch(es)`}
      resultTone={batchCount > 0 ? 'info' : 'warning'}
      title="Payout status lanes"
    >
      <AdminDetailGrid className="admin-mt-16">
        {lanes.map((lane) => (
          <div key={lane.title}>
            <AdminSectionHeader
              status={
                <StatusBadgeFromPillClass pillClass={lane.pillClass}>
                  {lane.batches.length}
                </StatusBadgeFromPillClass>
              }
              title={lane.title}
            />
            {lane.batches.length ? (
              <div className="setup-stage-list">
                {lane.batches.slice(0, 4).map((batch) => (
                  <AdminStageItem key={`${lane.title}-${batch.id}`}>
                    <span>{shortRecordId(batch.id)}</span>
                    <div>
                      <strong>{batch.partnerLabel}</strong>
                      <p className="muted">
                        <MoneyText amount={batch.amount} currency={batch.currency} /> / {batch.earningCount} earning(s)
                      </p>
                      <p className="muted">{batch.opsHint}</p>
                    </div>
                    <AdminTextLink href={`#${batch.id}`}>
                      Row
                    </AdminTextLink>
                  </AdminStageItem>
                ))}
              </div>
            ) : (
              <AdminEmptyState className="admin-mt-8" message={lane.emptyText} title={null} />
            )}
          </div>
        ))}
      </AdminDetailGrid>
    </AdminTablePanel>
  );
}
