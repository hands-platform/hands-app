import { renderToStaticMarkup } from 'react-dom/server';
import { BookingMonitorMarketplaceSection } from './booking-monitor-marketplace-section';

describe('BookingMonitorMarketplaceSection', () => {
  it('renders marketplace overview, coverage, and participant ledger sections together', () => {
    const section = BookingMonitorMarketplaceSection({
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => '8m left',
      marketplaceBookingCoveragePills: [],
      marketplaceBookingCoverageRows: [],
      marketplaceBookingCoverageSummary: {
        chatRepair: 0,
        selected: 0,
        total: 0,
        waitingChoice: 0,
        withParticipants: 0,
        withoutParticipants: 0,
      },
      marketplaceLedgerPills: [],
      marketplaceLedgerRows: [],
      marketplaceLedgerSummary: {
        declined: 0,
        firstPick: 0,
        marketplace: 0,
        selected: 0,
        total: 0,
        waitingChoice: 0,
      },
      marketplaceOperatingQueue: [],
      marketplaceOperationsCards: [],
    });
    const rendered = renderToStaticMarkup(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Marketplace participant ledger');
    expect(rendered).toContain('Marketplace booking coverage board');
    expect(rendered).toContain('No marketplace booking rows match the current filters.');
    expect(rendered).toContain('No participant records match the current booking filters.');
  });
});
