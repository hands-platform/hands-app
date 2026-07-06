import { readFileSync } from 'node:fs';
import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMarketplaceCoverageSection } from './booking-monitor-marketplace-coverage-section';

describe('BookingMonitorMarketplaceCoverageSection', () => {
  it('uses shared Vuexy badge atoms for coverage summary and row chips', () => {
    const source = readFileSync('app/bookings/booking-monitor-marketplace-coverage-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${pill.tone}`} key={pill.label}>');
    expect(source).not.toContain('<span className="pill">Final Partner selected');
    expect(source).not.toContain('<span className={`pill ${row.firstPickTone}`}>{row.firstPickLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.selectedPartnerTone}`}>');
    expect(source).not.toContain('<span className={`pill ${row.alertTone}`} title={row.alertDetail}>');
    expect(source).not.toContain('<span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.nextActionTone}`} title={row.nextAction}>');
  });

  it('uses the shared Vuexy text link atom for marketplace booking links', () => {
    const source = readFileSync('app/bookings/booking-monitor-marketplace-coverage-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

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
    expect(rendered).toContain('Final Partner selected 1');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('8m left');
    expect(rendered).toContain('2 participant record(s)');
    expect(hrefsIn(section)).toContain('/bookings/booking_123456789');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-card-scroll admin-mt-14',
        'ops-section-header admin-section-header',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
        'text-link',
      ]),
    );
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
