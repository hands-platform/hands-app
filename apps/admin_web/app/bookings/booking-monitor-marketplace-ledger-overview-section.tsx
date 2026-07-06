import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminActionCard, AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
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
        <StatusBadge tone={marketplaceLedgerSummary.total > 0 ? 'info' : 'neutral'}>
          All participant records {marketplaceLedgerSummary.total}
        </StatusBadge>
      }
      className="admin-mt-14"
      description="Participant evidence for first-pick, marketplace, declined, and final-choice rows."
      title="Marketplace participant ledger"
    >
      <AdminSectionHeader
        description="Only marketplace lanes with current operator work are shown here."
        status={<StatusBadge tone="info">No auto assignment</StatusBadge>}
        title="Marketplace operating queue"
      />
      <AdminTaskGrid className="admin-mt-12">
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
              <StatusBadgeFromPillClass pillClass={stagePillClass(item.tone)}>
                {item.status}
              </StatusBadgeFromPillClass>
              <StatusBadge tone="neutral">{item.value}</StatusBadge>
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
          <AdminTaskCard
            detail="First-pick, supply, customer choice, chat handoff, and wallet unblock lanes are clear."
            signalClassName="signal-ok"
            signalLabel="Clear"
            title="No marketplace lane needs action"
          />
        )}
      </AdminTaskGrid>
    </AdminSection>
  );
}
