import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
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

const MARKETPLACE_COVERAGE_HEADERS = [
  'Booking',
  'First-pick window',
  'Participant history',
  'Customer choice',
  '10 km alert trace',
  'Wallet gate',
  'Next action',
] as const;

export function BookingMonitorMarketplaceCoverageSection({
  getCustomerLabel,
  getMatchingWindowLabel,
  marketplaceBookingCoveragePills,
  marketplaceBookingCoverageRows,
  marketplaceBookingCoverageSummary,
}: BookingMonitorMarketplaceCoverageSectionProps) {
  return (
    <AdminSection
      actions={
        <>
          {marketplaceBookingCoveragePills.map((pill) => (
            <PillClassBadge pillClass={pill.tone} key={pill.label}>
              {pill.label}
            </PillClassBadge>
          ))}
        </>
      }
      className="admin-card-scroll admin-mt-14"
      description="Booking-level exceptions for marketplace supply, customer choice, wallet gate, and final selection."
      title="Marketplace booking coverage board"
    >
      <div className="participant-list admin-mt-12">
        <PillClassBadge pillClass="pill-neutral">
          Final Partner selected {marketplaceBookingCoverageSummary.selected}
        </PillClassBadge>
      </div>
      {marketplaceBookingCoverageRows.length === 0 ? (
        <AdminEmptyState
          className="admin-mt-14"
          framed
          message="No marketplace booking rows match the current filters."
          title={null}
        />
      ) : (
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={MARKETPLACE_COVERAGE_HEADERS}
            rowCount={marketplaceBookingCoverageRows.length}
          >
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
                  <PillClassBadge pillClass={row.firstPickTone}>{row.firstPickLabel}</PillClassBadge>
                  <div className="muted">{getMatchingWindowLabel(row.booking)}</div>
                </td>
                <td>
                  <strong>{row.participantCount} participant record(s)</strong>
                  <div className="muted">
                    {row.marketplaceParticipantCount} marketplace / {row.selectableCount} selectable
                  </div>
                </td>
                <td>
                  <PillClassBadge pillClass={row.selectedPartnerTone}>
                    {row.selectedPartnerLabel}
                  </PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.alertTone} title={row.alertDetail}>
                    {row.alertLabel}
                  </PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.walletTone}>{row.walletLabel}</PillClassBadge>
                </td>
                <td>
                  <PillClassBadge pillClass={row.nextActionTone} title={row.nextAction}>
                    {compactCoverageNextActionLabel(row.nextAction)}
                  </PillClassBadge>
                </td>
              </tr>
            ))}
            {marketplaceBookingCoverageRows.length > 30 && (
              <tr>
                <td colSpan={MARKETPLACE_COVERAGE_HEADERS.length}>
                  Showing first 30 booking coverage rows. Narrow filters to inspect the rest.
                </td>
              </tr>
            )}
          </AdminDataTable>
        </AdminTableScroll>
      )}
    </AdminSection>
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
