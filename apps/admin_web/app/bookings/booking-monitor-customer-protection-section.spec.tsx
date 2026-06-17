import type { AdminBooking } from '../../lib/admin-api';
import { hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorCustomerProtectionSection } from './booking-monitor-customer-protection-section';

describe('BookingMonitorCustomerProtectionSection', () => {
  it('renders closeout lane counts and booking samples', () => {
    const booking = {
      id: 'booking_123456789',
      payment: { status: 'AUTHORIZED' },
    } as unknown as AdminBooking;

    const section = BookingMonitorCustomerProtectionSection({
      getCustomerLabel: () => 'Customer A',
      lanes: [
        {
          bookings: [booking],
          detail: 'No-show needs a payment outcome.',
          href: '/bookings?view=no-show',
          operatorAction: 'Review payment and customer communication.',
          status: 'Release/refund',
          title: 'No-show payment release',
          tone: 'warn',
        },
        {
          bookings: [],
          detail: 'Cash fee debt is clear.',
          href: '/bookings?view=cash-debt',
          operatorAction: 'Monitor settlement queue.',
          status: 'Clear',
          title: 'Cash debt',
          tone: 'ok',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Customer protection closeout board');
    expect(rendered).toContain('1 open closeout');
    expect(rendered).toContain('No-show payment release');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('AUTHORIZED');
    expect(rendered).not.toContain('Cash debt');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=no-show']),
    );
    expect(hrefsIn(section)).not.toContain('/bookings?view=cash-debt');
  });

  it('renders a clear badge when all closeout lanes are empty', () => {
    const section = BookingMonitorCustomerProtectionSection({
      getCustomerLabel: () => 'Customer A',
      lanes: [
        {
          bookings: [],
          detail: 'No closeout needed.',
          href: '/bookings?view=attention',
          operatorAction: 'Monitor queue.',
          status: 'Clear',
          title: 'Expired payment release',
          tone: 'ok',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 open closeout');
    expect(rendered).toContain('No closeout lane needs action');
    expect(rendered).not.toContain('Expired payment release');
  });
});
