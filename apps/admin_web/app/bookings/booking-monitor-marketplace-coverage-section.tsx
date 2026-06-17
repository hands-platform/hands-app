import Link from 'next/link';
import { AdminTableScroll } from '../../components/admin-data-table';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type {
  MarketplaceBookingCoveragePill,
  MarketplaceBookingCoverageRow,
  MarketplaceBookingCoverageSummary,
} from '../../lib/marketplace-booking-coverage';
import { bookingServiceOptionLabel } from './booking-service-labels';

type BookingMonitorMarketplaceCoverageSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly getMatchingWindowLabel: (booking: AdminBooking) => string;
  readonly marketplaceBookingCoveragePills: readonly MarketplaceBookingCoveragePill[];
  readonly marketplaceBookingCoverageRows: readonly MarketplaceBookingCoverageRow<AdminBooking>[];
  readonly marketplaceBookingCoverageSummary: MarketplaceBookingCoverageSummary;
};

export function BookingMonitorMarketplaceCoverageSection({
  getCustomerLabel,
  getMatchingWindowLabel,
  marketplaceBookingCoveragePills,
  marketplaceBookingCoverageRows,
  marketplaceBookingCoverageSummary,
}: BookingMonitorMarketplaceCoverageSectionProps) {
  return (
    <section className="card admin-card-scroll admin-mt-14">
      <div className="ops-section-header">
        <div>
          <h3>Marketplace booking coverage board</h3>
          <p className="muted">
            Booking-level exceptions for marketplace supply, customer choice, wallet gate, and final selection.
          </p>
        </div>
        <div className="actions">
          {marketplaceBookingCoveragePills.map((pill) => (
            <span className={`pill ${pill.tone}`} key={pill.label}>
              {pill.label}
            </span>
          ))}
        </div>
      </div>
      <div className="participant-list admin-mt-12">
        <span className="pill">Final Partner selected {marketplaceBookingCoverageSummary.selected}</span>
      </div>
      {marketplaceBookingCoverageRows.length === 0 ? (
        <div className="empty-state admin-mt-14">
          No marketplace booking rows match the current filters.
        </div>
      ) : (
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>First-pick window</th>
                <th>Participant history</th>
                <th>Customer choice</th>
                <th>10 km alert trace</th>
                <th>Wallet gate</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {marketplaceBookingCoverageRows.slice(0, 30).map((row) => (
                <tr key={row.booking.id}>
                  <td>
                    <strong>
                      <Link className="text-link" href={`/bookings/${row.booking.id}`}>
                        {shortId(row.booking.id)}
                      </Link>
                    </strong>
                    <div className="muted">{getCustomerLabel(row.booking)}</div>
                    <div className="muted">{bookingServiceOptionLabel(row.booking)}</div>
                  </td>
                  <td>
                    <span className={`pill ${row.firstPickTone}`}>{row.firstPickLabel}</span>
                    <div className="muted">{getMatchingWindowLabel(row.booking)}</div>
                  </td>
                  <td>
                    <strong>{row.participantCount} participant record(s)</strong>
                    <div className="muted">
                      {row.marketplaceParticipantCount} marketplace / {row.selectableCount} selectable
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${row.selectedPartnerTone}`}>
                      {row.selectedPartnerLabel}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${row.alertTone}`} title={row.alertDetail}>
                      {row.alertLabel}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>
                  </td>
                  <td>
                    <span className={`pill ${row.nextActionTone}`} title={row.nextAction}>
                      {compactCoverageNextActionLabel(row.nextAction)}
                    </span>
                  </td>
                </tr>
              ))}
              {marketplaceBookingCoverageRows.length > 30 && (
                <tr>
                  <td colSpan={7}>
                    Showing first 30 booking coverage rows. Narrow filters to inspect the rest.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableScroll>
      )}
    </section>
  );
}

function compactCoverageNextActionLabel(nextAction: string): string {
  if (nextAction.startsWith('Finance /')) {
    return 'Finance review';
  }
  if (nextAction.startsWith('No-show is marked')) {
    return 'No-show review';
  }
  if (nextAction.length > 48) {
    return 'Review detail';
  }

  return nextAction;
}
