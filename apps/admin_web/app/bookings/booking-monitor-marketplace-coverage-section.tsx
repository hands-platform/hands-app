import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
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
    <AdminTableSection
      actions={
        <>
          {marketplaceBookingCoveragePills.map((pill) => (
            <StatusBadgeFromPillClass pillClass={pill.tone} key={pill.label}>
              {pill.label}
            </StatusBadgeFromPillClass>
          ))}
        </>
      }
      className="admin-mt-14"
      description="Booking-level exceptions for marketplace supply, customer choice, wallet gate, and final selection."
      scrollable
      title="Marketplace booking coverage board"
    >
      <AdminFilterChipGroup ariaLabel="Marketplace booking coverage summary" className="admin-mt-12">
        <StatusBadge tone="neutral">
          Final Partner selected {marketplaceBookingCoverageSummary.selected}
        </StatusBadge>
      </AdminFilterChipGroup>
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
                    <AdminTextLink href={`/bookings/${row.booking.id}`}>
                      {shortId(row.booking.id)}
                    </AdminTextLink>
                  </strong>
                  <div className="muted">{getCustomerLabel(row.booking)}</div>
                  <div className="muted">{bookingServiceOptionLabel(row.booking)}</div>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.firstPickTone}>
                    {row.firstPickLabel}
                  </StatusBadgeFromPillClass>
                  <div className="muted">{getMatchingWindowLabel(row.booking)}</div>
                </td>
                <td>
                  <strong>{row.participantCount} participant record(s)</strong>
                  <div className="muted">
                    {row.marketplaceParticipantCount} marketplace / {row.selectableCount} selectable
                  </div>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.selectedPartnerTone}>
                    {row.selectedPartnerLabel}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.alertTone} title={row.alertDetail}>
                    {row.alertLabel}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.walletTone}>
                    {row.walletLabel}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={row.nextActionTone} title={row.nextAction}>
                    {compactCoverageNextActionLabel(row.nextAction)}
                  </StatusBadgeFromPillClass>
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
    </AdminTableSection>
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
