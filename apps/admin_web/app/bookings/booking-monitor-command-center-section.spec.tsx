import { BookingMonitorCommandCenterSection } from './booking-monitor-command-center-section';

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

function headingTextsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(headingTextsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const type = typeof record?.type === 'string' ? record.type : '';
  const ownHeading =
    /^h[1-6]$/.test(type) ? [textContent(props?.children).replace(/\s+/g, ' ').trim()] : [];
  return [...ownHeading, ...headingTextsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
