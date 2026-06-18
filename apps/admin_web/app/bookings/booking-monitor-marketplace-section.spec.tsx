import { renderToStaticMarkup } from 'react-dom/server';
import { BookingMonitorMarketplaceSection } from './booking-monitor-marketplace-section';

describe('BookingMonitorMarketplaceSection', () => {
  it('renders marketplace overview and coverage sections without the participant ledger', () => {
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
    });
    const rendered = renderToStaticMarkup(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Marketplace booking coverage board');
    expect(rendered).toContain('No marketplace booking rows match the current filters.');
    expect(rendered).not.toContain('Marketplace participant ledger');
    expect(rendered).not.toContain('No participant records match the current booking filters.');
  });
});
