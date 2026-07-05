import { readFileSync } from 'node:fs';

describe('VietnamOverviewLiveMap', () => {
  it('uses the shared Vuexy empty-state atom for empty realtime map dots', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('formatWholeNumber as formatNumber');
    expect(source).not.toContain('function formatNumber(value: number)');
    expect(source).not.toContain('<strong>No live dots for selected filters</strong>');
  });
});
