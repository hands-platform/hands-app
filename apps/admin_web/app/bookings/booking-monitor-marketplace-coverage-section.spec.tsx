import type { AdminBooking } from '../../lib/admin-api';
import { BookingMonitorMarketplaceCoverageSection } from './booking-monitor-marketplace-coverage-section';

describe('BookingMonitorMarketplaceCoverageSection', () => {
  it('renders coverage rows, pills, and booking links', () => {
    const booking = {
      id: 'booking_123456789',
      payment: { currency: 'VND' },
      services: [
        {
          price: 120000,
          service: {
            basePrice: 120000,
            durationMin: 60,
            name: 'Foot Massage',
            payoutRules: [],
          },
        },
      ],
    } as unknown as AdminBooking;

    const section = BookingMonitorMarketplaceCoverageSection({
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => '8m left',
      marketplaceBookingCoveragePills: [
        { label: 'Bookings with participant history 1', tone: 'pill-info' },
      ],
      marketplaceBookingCoverageRows: [
        {
          alertDetail: 'Last alert delivered.',
          alertLabel: 'Alert trace',
          alertTone: 'pill-info',
          booking,
          chatRepairNeeded: false,
          firstPickLabel: 'Waiting',
          firstPickTone: 'pill-warn',
          marketplaceParticipantCount: 1,
          nextAction: 'Watch timer',
          nextActionTone: 'pill-warn',
          participantCount: 2,
          selectableCount: 1,
          selectedPartnerLabel: 'Customer-selectable',
          selectedPartnerPresent: false,
          selectedPartnerTone: 'pill-info',
          walletLabel: 'Wallet clear',
          walletTone: 'pill-success',
        },
      ],
      marketplaceBookingCoverageSummary: {
        chatRepair: 0,
        selected: 1,
        total: 1,
        waitingChoice: 1,
        withParticipants: 1,
        withoutParticipants: 0,
      },
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Marketplace booking coverage board');
    expect(rendered).toContain('Bookings with participant history 1');
    expect(rendered).toContain('Final partner selected 1');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('8m left');
    expect(rendered).toContain('2 participant record(s)');
    expect(hrefsIn(section)).toContain('/bookings/booking_123456789');
  });

  it('renders the empty state when no coverage rows match', () => {
    const section = BookingMonitorMarketplaceCoverageSection({
      getCustomerLabel: () => 'Customer A',
      getMatchingWindowLabel: () => 'clear',
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

    expect(normalizedText(section)).toContain('No marketplace booking rows match the current filters.');
  });
});

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
