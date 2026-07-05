import { readFileSync } from 'node:fs';

describe('VietnamOverviewMapClusters', () => {
  it('uses the shared Vuexy segmented atom for map display mode controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('<span className={!isDensityVisible ? \'is-active\' : \'\'}>Signals</span>');
    expect(source).not.toContain('<button\n        aria-pressed={isDensityVisible}');
  });
});
