import { readFileSync } from 'node:fs';

describe('VietnamOverviewMapClusters', () => {
  it('uses the shared Vuexy segmented atom for map display mode controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('<span className={!isDensityVisible ? \'is-active\' : \'\'}>Signals</span>');
    expect(source).not.toContain('<button\n        aria-pressed={isDensityVisible}');
  });

  it('uses the shared Vuexy button atom for cluster panel close controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n          aria-label="Close selected map signals"');
  });

  it('uses the shared number formatter for cluster counters', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('formatWholeNumber as formatNumber');
    expect(source).toContain('formatPendingDateTime as formatDateTime');
    expect(source).not.toContain('function formatNumber(value: number)');
    expect(source).not.toContain('function formatDateTime(value: string)');
  });
});
