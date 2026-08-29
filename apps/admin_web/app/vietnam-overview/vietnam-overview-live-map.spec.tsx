import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type { VietnamOverviewMapPoint } from './vietnam-overview-model';
import {
  groupPointsByCoordinate,
  removeVietnamOverviewMapDataLayers,
  shouldUseVietnamOverviewGeoJsonClusters,
} from './vietnam-overview-live-map';

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
    const styles = readFileSync('app/globals.css', 'utf8');

    expect(source).toContain('new maplibregl.Popup');
    expect(source).toContain('safePointName(point)');
    expect(source).toContain('operationalStatusLabel(point.status, point.kind)');
    expect(source).toContain('pointTimeSummary(point)');
    expect(source).toContain('returnTo=${encodeURIComponent(returnHref)}');
    expect(source).not.toContain('window.location.assign');
    expect(source).not.toContain("addEventListener('pointerup'");
    expect(source).not.toContain("addEventListener('touchend'");
    expect(source).toContain("popup.on('open'");
    expect(source).toContain("removeEventListener('keydown', onPopupKeyDown)");
    expect(styles).toMatch(/\.maplibregl-popup-close-button\s*\{[^}]*position:\s*absolute/s);
    expect(styles).toMatch(/\.vietnam-maplibre-popup\s*\{[^}]*max-height:[^}]*overflow:\s*hidden/s);
    expect(styles).toMatch(/\.vietnam-maplibre-popup > ul\s*\{[^}]*overscroll-behavior:\s*contain/s);
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
    expect(source).toContain("if (event.key === 'Escape') popup.remove()");
    expect(source).toContain("if (!element.hidden) element.focus()");
    expect(source).toContain("else map.getCanvas().focus()");
  });

  it('uses native GeoJSON clustering only above the DOM-marker density threshold', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-live-map.tsx', 'utf8');

    expect(source).toContain('groupPointsByCoordinate(points)');
    expect(source).toContain('point.latitude.toFixed(5)');
    expect(source).toContain('cluster: true');
    expect(source).toContain("filter: ['has', 'point_count']");
    expect(source).toContain('getClusterExpansionZoom(clusterId)');
    expect(source).toContain("element.style.zIndex = String(group.points.length)");
    expect(shouldUseVietnamOverviewGeoJsonClusters(20)).toBe(false);
    expect(shouldUseVietnamOverviewGeoJsonClusters(21)).toBe(true);
  });

  it('keeps nearby but distinct locations separate while absorbing tiny GPS noise', () => {
    const base = mapPoint('base', 10.7769, 106.7009);
    const tinyNoise = mapPoint('noise', 10.7769004, 106.7009004);
    const aroundTwentyMetersAway = mapPoint('nearby', 10.77708, 106.7009);

    const groups = groupPointsByCoordinate([base, tinyNoise, aroundTwentyMetersAway]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.points.map((point) => point.id))).toEqual([
      ['base', 'noise'],
      ['nearby'],
    ]);
  });

  it('does not touch captured layers after the owning map has been removed', () => {
    let removed = false;
    const map = {
      getLayer: vi.fn(() => {
        if (removed) throw new Error('Style is not done loading');
        return undefined;
      }),
      getSource: vi.fn(() => {
        if (removed) throw new Error('Style is not done loading');
        return undefined;
      }),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
    };

    removed = true;

    expect(() => removeVietnamOverviewMapDataLayers(map as never, null)).not.toThrow();
    expect(map.getLayer).not.toHaveBeenCalled();
    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
  });
});

function mapPoint(id: string, latitude: number, longitude: number): VietnamOverviewMapPoint {
  return {
    id,
    kind: 'needs-supply',
    label: id,
    latitude,
    longitude,
    mapXPercent: 0,
    mapYPercent: 0,
    occurredAt: null,
    regionCode: 'hcm',
    source: 'test',
  };
}
