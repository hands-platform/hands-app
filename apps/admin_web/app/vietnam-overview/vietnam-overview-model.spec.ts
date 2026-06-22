import {
  normalizeVietnamOverviewRange,
  vietnamOverviewHref,
  vietnamOverviewRangeOptions,
} from './vietnam-overview-model';

describe('Vietnam overview page model', () => {
  it('offers bounded low-cost map ranges in operations-filter order', () => {
    expect(vietnamOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'all',
    ]);
  });

  it('defaults unknown ranges to today without adding GPS parameters', () => {
    expect(normalizeVietnamOverviewRange(undefined)).toBe('today');
    expect(normalizeVietnamOverviewRange('30d')).toBe('30d');
    expect(normalizeVietnamOverviewRange('month')).toBe('today');
    expect(vietnamOverviewHref('today')).toBe('/vietnam-overview?range=today');
    expect(vietnamOverviewHref('all')).toBe('/vietnam-overview?range=all');
  });
});
