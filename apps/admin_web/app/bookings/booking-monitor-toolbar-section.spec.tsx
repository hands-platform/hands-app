import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';

describe('BookingMonitorToolbarSection', () => {
  it('renders refresh controls when auto refresh is enabled', () => {
    const section = BookingMonitorToolbarSection({
      autoRefresh: true,
      onRefreshNow: jest.fn(),
      onToggleAutoRefresh: jest.fn(),
    });
    const rendered = normalizedText(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Booking Monitor');
    expect(rendered).toContain('Live operational view for matching');
    expect(rendered).toContain('Pause refresh');
    expect(rendered).toContain('Refresh now');
  });

  it('shows resume copy when auto refresh is paused', () => {
    const section = BookingMonitorToolbarSection({
      autoRefresh: false,
      onRefreshNow: jest.fn(),
      onToggleAutoRefresh: jest.fn(),
    });

    expect(normalizedText(section)).toContain('Resume refresh');
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
