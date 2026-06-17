import Link from 'next/link';
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
  return (
    <>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace participant ledger</h2>
          <p className="muted">
            All participant records by booking, including first-pick, marketplace participants, declined
            responses, and the customer final choice. This is the operations record of who entered the
            request; visibility-only marketplace exposure is intentionally not counted as participation.
          </p>
        </div>
        <span className={`pill ${marketplaceLedgerSummary.total > 0 ? 'pill-info' : 'pill-neutral'}`}>
          All participant records {marketplaceLedgerSummary.total}
        </span>
      </div>
      <section className="card admin-mt-14">
        <div className="ops-section-header">
          <div>
            <h3>Marketplace operating queue</h3>
            <p className="muted">
              Practical dispatch sequence for first-pick timer control, Partner participation pool, customer
              final selection lane, chat handoff, and wallet unblock lane.
            </p>
          </div>
          <span className="pill pill-info">No auto assignment</span>
        </div>
        <div className="ops-task-grid admin-mt-12">
          {marketplaceOperatingQueue.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.step}>
              <span className={`signal ${commandToneClass(item.tone)}`}>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className={`pill ${stagePillClass(item.tone)}`}>{item.status}</span>
                <span className="pill">{item.value}</span>
              </div>
              <small>{item.operatorAction}</small>
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
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
