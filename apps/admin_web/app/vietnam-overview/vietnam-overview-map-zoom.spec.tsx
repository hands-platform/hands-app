import { readFileSync } from 'node:fs';

describe('VietnamOverviewMapZoom', () => {
  it('uses shared Vuexy button atoms for visible map zoom controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-zoom.tsx', 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n          type="button"\n          className="vietnam-map-zoom-button"');
  });
});
