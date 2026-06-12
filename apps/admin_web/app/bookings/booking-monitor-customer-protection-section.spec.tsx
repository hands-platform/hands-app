import type { AdminBooking } from '../../lib/admin-api';
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
    expect(rendered).toContain('Cash debt');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=no-show', '/bookings?view=cash-debt']),
    );
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

    expect(normalizedText(section)).toContain('0 open closeout');
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
