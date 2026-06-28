import { dateRangeLabel, isInDateRange, normalizeDateRange, readSearchParam } from './date-range';

describe('admin date range helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('uses Vietnam business day for the Today filter', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-01T17:30:00.000Z'));

    expect(isInDateRange('2026-05-01T17:05:00.000Z', 'today')).toBe(true);
    expect(isInDateRange('2026-05-02T16:59:00.000Z', 'today')).toBe(true);
    expect(isInDateRange('2026-05-01T16:59:00.000Z', 'today')).toBe(false);
  });

  test('keeps invalid or empty dates out of filtered operations views', () => {
    expect(isInDateRange(undefined, 'today')).toBe(false);
    expect(isInDateRange(null, 'today')).toBe(false);
    expect(isInDateRange('not-a-date', 'today')).toBe(false);
  });

  test('normalizes date range and search parameters defensively', () => {
    expect(normalizeDateRange('all')).toBe('all');
    expect(normalizeDateRange('today')).toBe('today');
    expect(normalizeDateRange('7d')).toBe('7d');
    expect(normalizeDateRange('30d')).toBe('30d');
    expect(normalizeDateRange('yesterday')).toBe('today');
    expect(normalizeDateRange('')).toBe('today');

    expect(readSearchParam([' marketplace ', 'ignored'])).toBe('marketplace');
    expect(readSearchParam(undefined)).toBe('');
  });

  test('labels today explicitly as Vietnam operations time', () => {
    expect(dateRangeLabel('today')).toBe('Today (Vietnam)');
  });
});
