import { readFileSync } from 'node:fs';

describe('VietnamOverviewLiveMap', () => {
  it('uses the shared Vuexy empty-state atom for empty realtime map dots', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('formatWholeNumber as formatNumber');
    expect(source).not.toContain('function formatNumber(value: number)');
    expect(source).not.toContain('<strong>No live dots for selected filters</strong>');
  });

  it('does not use a CSS-drawn decorative empty icon over the map', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');
    const styles = readFileSync('app/globals.css', 'utf8');

    expect(source).not.toContain('vietnam-map-empty-icon');
    expect(styles).not.toContain('.vietnam-map-empty-icon');
  });
});
