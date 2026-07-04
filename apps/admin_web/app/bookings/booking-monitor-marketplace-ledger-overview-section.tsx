import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { MarketplaceOperatingQueueItem } from '../../lib/marketplace-operating-queue';
import type { MarketplaceParticipantLedgerSummary } from '../../lib/marketplace-participant-ledger';
import { commandToneClass, stagePillClass } from './booking-command-display';
import { bookingServiceOptionLabel } from './booking-service-labels';

type BookingMonitorMarketplaceLedgerOverviewSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly marketplaceLedgerSummary: MarketplaceParticipantLedgerSummary;
  readonly marketplaceOperatingQueue: readonly MarketplaceOperatingQueueItem<AdminBooking>[];
};

export function BookingMonitorMarketplaceLedgerOverviewSection({
  getCustomerLabel,
  marketplaceLedgerSummary,
  marketplaceOperatingQueue,
}: BookingMonitorMarketplaceLedgerOverviewSectionProps) {
  const visibleOperatingQueue = marketplaceOperatingQueue.filter(
    (item) => item.tone === 'danger' || item.tone === 'warn',
  );

  return (
    <AdminSection
      actions={
        <PillClassBadge pillClass={marketplaceLedgerSummary.total > 0 ? 'pill-info' : 'pill-neutral'}>
          All participant records {marketplaceLedgerSummary.total}
        </PillClassBadge>
      }
      className="admin-mt-14"
      description="Participant evidence for first-pick, marketplace, declined, and final-choice rows."
      title="Marketplace participant ledger"
    >
      <div className="ops-section-header">
        <div>
          <h3>Marketplace operating queue</h3>
          <p className="muted">
            Only marketplace lanes with current operator work are shown here.
          </p>
        </div>
        <StatusBadge tone="info">No auto assignment</StatusBadge>
      </div>
      <div className="ops-task-grid admin-mt-12">
        {visibleOperatingQueue.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorAction}
            detail={item.detail}
            href={item.href}
            key={item.step}
            signalClassName={commandToneClass(item.tone)}
            signalLabel={item.step}
            title={item.title}
            variant="ops-task"
          >
            <div className="participant-list">
              <PillClassBadge pillClass={stagePillClass(item.tone)}>{item.status}</PillClassBadge>
              <PillClassBadge pillClass="pill-neutral">{item.value}</PillClassBadge>
            </div>
            {item.bookings.length > 0 && (
              <div className="stack admin-mt-10">
                {item.bookings.slice(0, 3).map((booking) => (
                  <span className="muted" key={`${item.step}-${booking.id}`}>
                    {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                    {getCustomerLabel(booking)}
                  </span>
                ))}
              </div>
            )}
          </AdminActionCard>
        ))}
        {visibleOperatingQueue.length === 0 && (
          <div className="ops-task-card">
            <span className="signal signal-ok">Clear</span>
            <h3>No marketplace lane needs action</h3>
            <p>First-pick, supply, customer choice, chat handoff, and wallet unblock lanes are clear.</p>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
