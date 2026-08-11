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

  it('loads MapLibre only after the client map shell mounts', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('GeoJSONSource');
    expect(source).toContain('Map as MapLibreMap');
    expect(source).toContain('Popup');
    expect(source).toContain("await import('maplibre-gl')");
    expect(source).not.toContain("import maplibregl, {");
  });

  it('keeps layer changes in the shareable URL without scrolling the page', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain("router.replace(href, { scroll: false })");
    expect(source).toContain('aria-pressed={item.isActive}');
    expect(source).toContain('Reset layers');
    expect(source).not.toContain('role="button"');
  });

  it('opens one semantic popup per distinguishable marker without duplicate navigation handlers', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('new maplibregl.Popup');
    expect(source).toContain('safePointName(point)');
    expect(source).toContain('operationalStatusLabel(point.status, point.kind)');
    expect(source).toContain('pointTimeSummary(point)');
    expect(source).toContain('returnTo=${encodeURIComponent(returnHref)}');
    expect(source).not.toContain('window.location.assign');
    expect(source).not.toContain("addEventListener('pointerup'");
    expect(source).not.toContain("addEventListener('touchend'");
  });

  it('keeps map failures visible even when mapped records exist', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain("mapStatus === 'error'");
    expect(source).toContain('Map tiles unavailable');
    expect(source).toContain('Mapped records remain available below.');
    expect(source).not.toMatch(/mapStatus === 'error'\s*&&\s*points\.length === 0/);
  });

  it('uses roving marker focus and provides a keyboard-readable record list', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('element.tabIndex = index === 0 ? 0 : -1');
    expect(source).toContain("key === 'ArrowRight'");
    expect(source).toContain("key === 'Home'");
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
    expect(source).toContain('Mapped records ·');
    expect(source).toContain("if (keyEvent.key === 'Escape') popup.remove()");
    expect(source).toContain("popup.on('close', () => element.focus())");
  });

  it('groups exact coordinates and enables native GeoJSON clustering', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('groupPointsByCoordinate(points)');
    expect(source).toContain('point.latitude.toFixed(2)');
    expect(source).toContain('cluster: true');
    expect(source).toContain("filter: ['has', 'point_count']");
    expect(source).toContain('getClusterExpansionZoom(clusterId)');
  });
});
