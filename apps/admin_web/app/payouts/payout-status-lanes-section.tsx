import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminDetailGrid } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
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
                <StatusBadge tone={statusBadgeToneFromPillClass(lane.pillClass)}>
                  {lane.batches.length}
                </StatusBadge>
              }
              title={lane.title}
            />
            {lane.batches.length ? (
              <div className="setup-stage-list">
                {lane.batches.slice(0, 4).map((batch) => (
                  <div className="setup-stage-item" key={`${lane.title}-${batch.id}`}>
                    <span>{shortRecordId(batch.id)}</span>
                    <div>
                      <strong>{batch.partnerLabel}</strong>
                      <p className="muted">
                        <MoneyText amount={batch.amount} currency={batch.currency} /> / {batch.earningCount} earning(s)
                      </p>
                      <p className="muted">{batch.opsHint}</p>
                    </div>
                    <a className="text-link" href={`#${batch.id}`}>
                      Row
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{lane.emptyText}</p>
            )}
          </div>
        ))}
      </AdminDetailGrid>
    </AdminFilterPanel>
  );
}
