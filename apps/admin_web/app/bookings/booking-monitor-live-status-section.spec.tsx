import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';

describe('BookingMonitorLiveStatusSection', () => {
  it('renders summary rows and ready refresh metadata', () => {
    const section = BookingMonitorLiveStatusSection({
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:45',
      summary: [
        ['Active bookings', '3'],
        ['Payment checks', '1'],
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Payment checks');
    expect(rendered).toContain('Ready');
    expect(rendered).toContain('Last refresh 09:45');
    expect(headingTextsIn(section)).toEqual([]);
  });

  it('renders pending refresh metadata before mount', () => {
    const section = BookingMonitorLiveStatusSection({
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: '09:45',
      summary: [],
    });

    expect(normalizedText(section)).toContain('Refreshing... Last refresh pending');
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
