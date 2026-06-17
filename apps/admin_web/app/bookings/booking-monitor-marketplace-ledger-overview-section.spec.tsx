import type { AdminBooking } from '../../lib/admin-api';
import { headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMarketplaceLedgerOverviewSection } from './booking-monitor-marketplace-ledger-overview-section';

describe('BookingMonitorMarketplaceLedgerOverviewSection', () => {
  it('renders ledger summary and operating queue cards', () => {
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

    const section = BookingMonitorMarketplaceLedgerOverviewSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerSummary: {
        declined: 1,
        firstPick: 2,
        marketplace: 3,
        selected: 1,
        total: 5,
        waitingChoice: 2,
      },
      marketplaceOperatingQueue: [
        {
          bookings: [booking],
          detail: 'Preferred Partner gets the first response window.',
          href: '/bookings?view=first-pick',
          operatorAction: 'Monitor response window.',
          status: 'Running',
          step: '1. First-pick timer control',
          title: 'First-pick timer control',
          tone: 'warn',
          value: '1 waiting',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Marketplace participant ledger');
    expect(rendered).toContain('All participant records 5');
    expect(rendered).not.toContain('Marketplace record boundary');
    expect(rendered).not.toContain('Actual participation rows');
    expect(rendered).toContain('Marketplace operating queue');
    expect(rendered).toContain('First-pick timer control');
    expect(rendered).toContain('Customer A');
    expect(headingTextsIn(section)).toEqual([
      'Marketplace participant ledger',
      'Marketplace operating queue',
      'First-pick timer control',
    ]);
    expect(hrefsIn(section)).toContain('/bookings?view=first-pick');
  });

  it('hides non-action operating queue cards behind a clear state', () => {
    const section = BookingMonitorMarketplaceLedgerOverviewSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerSummary: {
        declined: 0,
        firstPick: 0,
        marketplace: 0,
        selected: 0,
        total: 0,
        waitingChoice: 0,
      },
      marketplaceOperatingQueue: [
        {
          bookings: [],
          detail: 'Partner pool is visible.',
          href: '/bookings?view=marketplace',
          operatorAction: 'No operator action.',
          status: 'Visible',
          step: '2. Partner participation pool',
          title: 'Partner participation pool',
          tone: 'info',
          value: '0 waiting',
        },
        {
          bookings: [],
          detail: 'Wallet lane is clear.',
          href: '/bookings?view=cash-debt',
          operatorAction: 'No operator action.',
          status: 'Clear',
          step: '5. Wallet unblock lane',
          title: 'Wallet unblock lane',
          tone: 'ok',
          value: '0 blocked',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('No marketplace lane needs action');
    expect(rendered).not.toContain('Partner participation pool');
    expect(rendered).not.toContain('Wallet unblock lane');
  });
});
