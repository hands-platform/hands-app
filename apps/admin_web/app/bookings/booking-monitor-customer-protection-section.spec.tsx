import { readFileSync } from 'node:fs';
import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorCustomerProtectionSection } from './booking-monitor-customer-protection-section';

describe('BookingMonitorCustomerProtectionSection', () => {
  it('uses shared Vuexy badge atoms for closeout and lane status chips', () => {
    const source = readFileSync('app/bookings/booking-monitor-customer-protection-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-14">');
    expect(source).not.toContain('<span className={`pill ${hasOpenCloseout ?');
    expect(source).not.toContain('<span className="pill">{lane.status}</span>');
    expect(source).not.toContain('<span className="pill">{lane.bookings.length} booking(s)</span>');
  });

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

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected customer protection section to render.');
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
    expect(classNamesIn(section)).toContain(
      'card admin-section admin-mt-16 booking-monitor-customer-protection-card',
    );
  });

  it('returns no section when all closeout lanes are empty', () => {
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

    expect(section).toBeNull();
  });
});
