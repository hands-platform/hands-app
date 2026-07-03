import type { AdminBooking } from '../../lib/admin-api';
import type {
  MarketplaceBookingCoveragePill,
  MarketplaceBookingCoverageRow,
  MarketplaceBookingCoverageSummary,
} from '../../lib/marketplace-booking-coverage';
import { BookingMonitorMarketplaceCoverageSection } from './booking-monitor-marketplace-coverage-section';

type BookingMonitorMarketplaceSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly getMatchingWindowLabel: (booking: AdminBooking) => string;
  readonly marketplaceBookingCoveragePills: readonly MarketplaceBookingCoveragePill[];
  readonly marketplaceBookingCoverageRows: readonly MarketplaceBookingCoverageRow<AdminBooking>[];
  readonly marketplaceBookingCoverageSummary: MarketplaceBookingCoverageSummary;
};

export function BookingMonitorMarketplaceSection({
  getCustomerLabel,
  getMatchingWindowLabel,
  marketplaceBookingCoveragePills,
  marketplaceBookingCoverageRows,
  marketplaceBookingCoverageSummary,
}: BookingMonitorMarketplaceSectionProps) {
  return (
    <BookingMonitorMarketplaceCoverageSection
      getCustomerLabel={getCustomerLabel}
      getMatchingWindowLabel={getMatchingWindowLabel}
      marketplaceBookingCoveragePills={marketplaceBookingCoveragePills}
      marketplaceBookingCoverageRows={marketplaceBookingCoverageRows}
      marketplaceBookingCoverageSummary={marketplaceBookingCoverageSummary}
    />
  );
}
