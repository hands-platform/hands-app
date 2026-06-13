import type { AdminBooking } from '../../lib/admin-api';
import {
  buildMarketplaceBookingCoverageRows as buildMarketplaceBookingCoverageRowsFromFacts,
  type MarketplaceBookingCoverageRow,
} from '../../lib/marketplace-booking-coverage';
import {
  buildMarketplaceOperationsCardCounts,
  buildMarketplaceOperationsCards as buildMarketplaceOperationsCardItems,
  type MarketplaceOperationsCard,
} from '../../lib/marketplace-operations-cards';
import {
  buildMarketplaceOperatingQueueBuckets,
  buildMarketplaceOperatingQueueItems,
  type MarketplaceOperatingQueueItem,
} from '../../lib/marketplace-operating-queue';
import {
  buildMarketplaceParticipantLedgerRows as buildMarketplaceParticipantLedgerRowsFromFacts,
  type MarketplaceParticipantLedgerRow,
} from '../../lib/marketplace-participant-ledger';
import { bookingMarketplaceCoverageInputFromBooking } from './booking-marketplace-coverage-inputs';
import { bookingMarketplaceCountFacts } from './booking-marketplace-count-facts';
import { bookingMarketplaceOperatingQueueFactFromBooking } from './booking-marketplace-operating-queue-inputs';
import { bookingMarketplaceOperationsBookingFactFromBooking } from './booking-marketplace-operations-card-inputs';
import { bookingMarketplaceParticipantLedgerInputs } from './booking-marketplace-participant-ledger-inputs';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

export type AdminMarketplaceParticipantLedgerRow = MarketplaceParticipantLedgerRow<
  AdminBooking,
  BookingParticipant
>;

export type AdminMarketplaceBookingCoverageRow = MarketplaceBookingCoverageRow<AdminBooking>;

export function buildBookingMonitorMarketplaceCoverageRows(
  bookings: readonly AdminBooking[],
  nowMs: number,
): readonly AdminMarketplaceBookingCoverageRow[] {
  return buildMarketplaceBookingCoverageRowsFromFacts(
    bookings.map((booking) => {
      const counts = bookingMarketplaceCountFacts(booking);
      return bookingMarketplaceCoverageInputFromBooking(booking, nowMs, {
        marketplaceParticipantCount: counts.marketplaceParticipantCount,
        selectableCount: counts.customerSelectableCount,
      });
    }),
  );
}

export function buildBookingMonitorMarketplaceParticipantLedgerRows(
  bookings: readonly AdminBooking[],
  nowMs: number,
  marketplaceRadiusMeters: number,
): readonly AdminMarketplaceParticipantLedgerRow[] {
  return bookings.flatMap((booking) =>
    buildMarketplaceParticipantLedgerRowsFromFacts(
      bookingMarketplaceParticipantLedgerInputs(booking, nowMs, marketplaceRadiusMeters),
    ),
  );
}

export function buildBookingMonitorMarketplaceOperationsCards(
  bookings: readonly AdminBooking[],
  ledgerRows: readonly AdminMarketplaceParticipantLedgerRow[],
  nowMs: number,
): MarketplaceOperationsCard[] {
  return buildMarketplaceOperationsCardItems(
    buildMarketplaceOperationsCardCounts({
      bookings: bookings.map((booking) =>
        bookingMarketplaceOperationsBookingFactFromBooking(
          booking,
          nowMs,
          bookingMarketplaceCountFacts(booking),
        ),
      ),
      ledgerRows,
    }),
  );
}

export function buildBookingMonitorMarketplaceOperatingQueue(
  bookings: readonly AdminBooking[],
  nowMs: number,
): MarketplaceOperatingQueueItem<AdminBooking>[] {
  return buildMarketplaceOperatingQueueItems(
    buildMarketplaceOperatingQueueBuckets(
      bookings.map((booking) => {
        const counts = bookingMarketplaceCountFacts(booking);
        return bookingMarketplaceOperatingQueueFactFromBooking(booking, nowMs, {
          customerSelectableCount: counts.customerSelectableCount,
          marketplaceParticipantCount: counts.marketplaceParticipantCount,
          preferredAwaitingDecision: bookingFirstPickPending(booking),
        });
      }),
    ),
  );
}
