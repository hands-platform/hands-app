import { classNamesIn, headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorCommandCenterSection } from './booking-monitor-command-center-section';
import { readFileSync } from 'fs';

describe('BookingMonitorCommandCenterSection', () => {
  it('renders command center lanes with tone and metric copy', () => {
    const section = BookingMonitorCommandCenterSection({
      lanes: [
        {
          detail: 'Open matching has customer demand without Partner supply.',
          href: '/bookings?view=no-supply',
          metrics: [
            { label: 'active', value: '3' },
            { label: 'no supply', value: '1' },
          ],
          status: 'Action needed',
          title: 'Dispatch pressure',
          tone: 'warn',
        },
        {
          detail: 'Payment and service pricing policy records are aligned.',
          href: '/bookings?view=payment',
          metrics: [{ label: 'payment', value: '0' }],
          status: 'Ready',
          title: 'Payment closeout',
          tone: 'ok',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Booking command center');
    expect(rendered).toContain('Operator first view');
    expect(rendered).toContain('Dispatch pressure');
    expect(rendered).toContain('Monitor');
    expect(rendered).toContain('no supply : 1');
    expect(rendered).toContain('Payment closeout');
    expect(rendered).toContain('Clear');
    expect(headingTextsIn(section)).toEqual(['Booking command center']);
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=no-supply', '/bookings?view=payment']),
    );
    expect(classNamesIn(section)).toContain('card admin-section admin-mt-16 booking-monitor-command-center-card');
    expect(classNamesIn(section)).toContain('card admin-action-card');
  });

  it('uses shared badge atoms for command center action and metric chips', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('actions={<span className="pill pill-info">Operator first view</span>}');
    expect(source).not.toContain('<span className="pill" key={item.label}>');
  });
});
