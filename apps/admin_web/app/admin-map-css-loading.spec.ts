import { readFileSync } from 'node:fs';

describe('Admin map CSS loading policy', () => {
  it('does not ship MapLibre package CSS through the root layout', () => {
    const layoutSource = readFileSync('app/layout.tsx', 'utf8');

    expect(layoutSource).not.toContain("import 'maplibre-gl/dist/maplibre-gl.css';");
  });

  it('keeps required MapLibre base layout scoped to the Vietnam map shell', () => {
    const globalCss = readFileSync('app/globals.css', 'utf8');

    expect(globalCss).toContain('.vietnam-maplibre-shell .maplibregl-map {');
    expect(globalCss).toContain('.vietnam-maplibre-shell .maplibregl-canvas-container {');
    expect(globalCss).toContain('.vietnam-maplibre-shell .maplibregl-ctrl-bottom-right {');
    expect(globalCss).toContain('.vietnam-maplibre-shell .maplibregl-marker {');
    expect(globalCss).toContain(
      '.vietnam-maplibre-shell .maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon::before',
    );
    expect(globalCss).toContain(
      '.vietnam-maplibre-shell .maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon::before',
    );
  });
});
