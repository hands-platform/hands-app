import type { AdminBooking } from '../../lib/admin-api';
import type {
  MarketplaceBookingCoveragePill,
  MarketplaceBookingCoverageRow,
  MarketplaceBookingCoverageSummary,
} from '../../lib/marketplace-booking-coverage';
import type { MarketplaceOperationsCard } from '../../lib/marketplace-operations-cards';
import type { MarketplaceOperatingQueueItem } from '../../lib/marketplace-operating-queue';
import type {
  MarketplaceParticipantLedgerPill,
  MarketplaceParticipantLedgerRow,
  MarketplaceParticipantLedgerSummary,
} from '../../lib/marketplace-participant-ledger';
import { BookingMonitorMarketplaceCoverageSection } from './booking-monitor-marketplace-coverage-section';
import { BookingMonitorMarketplaceLedgerOverviewSection } from './booking-monitor-marketplace-ledger-overview-section';
import { BookingMonitorMarketplaceParticipantLedgerSection } from './booking-monitor-marketplace-participant-ledger-section';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

type BookingMonitorMarketplaceSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly getMatchingWindowLabel: (booking: AdminBooking) => string;
  readonly marketplaceBookingCoveragePills: readonly MarketplaceBookingCoveragePill[];
  readonly marketplaceBookingCoverageRows: readonly MarketplaceBookingCoverageRow<AdminBooking>[];
  readonly marketplaceBookingCoverageSummary: MarketplaceBookingCoverageSummary;
  readonly marketplaceLedgerPills: readonly MarketplaceParticipantLedgerPill[];
  readonly marketplaceLedgerRows: readonly MarketplaceParticipantLedgerRow<AdminBooking, BookingParticipant>[];
  readonly marketplaceLedgerSummary: MarketplaceParticipantLedgerSummary;
  readonly marketplaceOperatingQueue: readonly MarketplaceOperatingQueueItem<AdminBooking>[];
  readonly marketplaceOperationsCards: readonly MarketplaceOperationsCard[];
};

export function BookingMonitorMarketplaceSection({
  getCustomerLabel,
  getMatchingWindowLabel,
  marketplaceBookingCoveragePills,
  marketplaceBookingCoverageRows,
  marketplaceBookingCoverageSummary,
  marketplaceLedgerPills,
  marketplaceLedgerRows,
  marketplaceLedgerSummary,
  marketplaceOperatingQueue,
  marketplaceOperationsCards,
}: BookingMonitorMarketplaceSectionProps) {
  return (
    <section className="card admin-mt-16">
      <BookingMonitorMarketplaceLedgerOverviewSection
        getCustomerLabel={getCustomerLabel}
        marketplaceLedgerSummary={marketplaceLedgerSummary}
        marketplaceOperatingQueue={marketplaceOperatingQueue}
      />
      <BookingMonitorMarketplaceCoverageSection
        getCustomerLabel={getCustomerLabel}
        getMatchingWindowLabel={getMatchingWindowLabel}
        marketplaceBookingCoveragePills={marketplaceBookingCoveragePills}
        marketplaceBookingCoverageRows={marketplaceBookingCoverageRows}
        marketplaceBookingCoverageSummary={marketplaceBookingCoverageSummary}
      />
      <BookingMonitorMarketplaceParticipantLedgerSection
        getCustomerLabel={getCustomerLabel}
        marketplaceLedgerPills={marketplaceLedgerPills}
        marketplaceLedgerRows={marketplaceLedgerRows}
        marketplaceOperationsCards={marketplaceOperationsCards}
      />
    </section>
  );
}
