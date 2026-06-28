import {
  normalizeUsageOverviewRange,
  usageOverviewHref,
  usageOverviewRangeOptions,
} from './usage-overview-model';

describe('usage overview page model', () => {
  it('offers the low-cost usage ranges in the same order as operations filters', () => {
    expect(usageOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      'month',
      'all',
    ]);
  });

  it('builds stable range links without adding search or GPS parameters', () => {
    expect(usageOverviewHref('today')).toBe('/usage-overview?range=today');
    expect(usageOverviewHref('all')).toBe('/usage-overview?range=all');
  });

  it('defaults usage overview to today for the initial operations view', () => {
    expect(normalizeUsageOverviewRange(undefined)).toBe('today');
    expect(normalizeUsageOverviewRange('bad-input')).toBe('today');
  });
});
