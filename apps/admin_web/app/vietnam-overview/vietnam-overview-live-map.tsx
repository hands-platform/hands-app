'use client';

import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { formatWholeNumber as formatNumber } from '../../lib/admin-format';
import {
  type VietnamOverviewMapPoint,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewRealtimeMetricDotLegend,
} from './vietnam-overview-model';

type VietnamOverviewLiveMapProps = {
  readonly clearRegionHref: string | null;
  readonly focusRegionCode: string | null;
  readonly focusRegionName: string | null;
  readonly focusRegionShortName: string | null;
  readonly points: readonly VietnamOverviewMapPoint[];
  readonly signalFilters: readonly VietnamOverviewSignalFilter[];
  readonly totalPointCount: number;
};

type MarkerHandle = {
  readonly marker: Marker;
};

type VietnamOverviewSignalFilter = {
  readonly count: number;
  readonly href: string;
  readonly isActive: boolean;
  readonly key: VietnamOverviewMetricDotKey;
  readonly label: string;
};

const vietnamBounds: LngLatBoundsLike = [
  [102.0, 8.0],
  [110.0, 23.5],
];

const vietnamDefaultCenter: [number, number] = [106.25, 15.9];

const vietnamRegionCenters: Record<string, { readonly center: [number, number]; readonly zoom: number }> = {
  hanoi: { center: [105.8542, 21.0285], zoom: 11 },
  hcm: { center: [106.7009, 10.7769], zoom: 11 },
  danang: { center: [108.2022, 16.0544], zoom: 11 },
  vungtau: { center: [107.0843, 10.4114], zoom: 11 },
  nhatrang: { center: [109.1967, 12.2388], zoom: 11 },
  haiphong: { center: [106.6881, 20.8449], zoom: 11 },
  cantho: { center: [105.7469, 10.0452], zoom: 11 },
};

export function VietnamOverviewLiveMap({
  clearRegionHref,
  focusRegionCode,
  focusRegionName,
  points,
  focusRegionShortName,
  signalFilters,
  totalPointCount,
}: VietnamOverviewLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<MarkerHandle[]>([]);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const focusCenter = focusRegionCode ? vietnamRegionCenters[focusRegionCode]?.center : null;
    const focusZoom = focusRegionCode ? vietnamRegionCenters[focusRegionCode]?.zoom : null;
    const map = new maplibregl.Map({
      attributionControl: false,
      center: focusCenter ?? vietnamDefaultCenter,
      container: containerRef.current,
      maxBounds: vietnamBounds,
      maxZoom: 16,
      minZoom: 5,
      style: {
        version: 8,
        sources: {
          maptiler: {
            attribution:
              '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
            tileSize: 256,
            tiles: ['/api/admin/maptiler-tiles/{z}/{x}/{y}.png'],
            type: 'raster',
          },
        },
        layers: [
          {
            id: 'maptiler-base',
            source: 'maptiler',
            type: 'raster',
          },
        ],
      },
      zoom: focusZoom ?? 5.4,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setMapStatus('ready'));
    map.on('error', () => setMapStatus('error'));
    mapRef.current = map;

    return () => {
      markerRefs.current.forEach(({ marker }) => {
        marker.remove();
      });
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [focusRegionCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach(({ marker }) => {
      marker.remove();
    });
    markerRefs.current = points.map((point) => {
      const targetHref = signalTargetHref(point);
      const element = targetHref ? document.createElement('a') : document.createElement('span');
      element.className = `vietnam-maplibre-marker is-${point.kind}`;
      element.setAttribute('aria-label', markerAriaLabel(point));
      element.title = markerAriaLabel(point);

      if (targetHref) {
        const openRecord = (event: MouseEvent | PointerEvent | TouchEvent) => {
          event.preventDefault();
          event.stopPropagation();
          window.location.assign(targetHref);
        };
        const stopMapGesture = (event: MouseEvent | PointerEvent | TouchEvent) => {
          event.stopPropagation();
        };

        (element as HTMLAnchorElement).href = targetHref;
        element.addEventListener('click', openRecord);
        element.addEventListener('pointerup', openRecord);
        element.addEventListener('touchend', openRecord);
        element.addEventListener('mousedown', stopMapGesture);
        element.addEventListener('pointerdown', stopMapGesture);
        element.addEventListener('touchstart', stopMapGesture);
      } else {
        element.classList.add('is-static');
        element.setAttribute('role', 'img');
      }

      const marker = new maplibregl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);

      return { marker };
    });

    if (points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      map.fitBounds(bounds, {
        maxZoom: 13,
        padding: { bottom: 110, left: 80, right: 360, top: 100 },
      });
    } else {
      const focus = focusRegionCode ? vietnamRegionCenters[focusRegionCode] : null;
      map.easeTo({
        center: focus?.center ?? vietnamDefaultCenter,
        duration: 450,
        zoom: focus?.zoom ?? 5.4,
      });
    }
  }, [focusRegionCode, points]);

  return (
    <div className="vietnam-maplibre-shell">
      <div ref={containerRef} className="vietnam-maplibre-canvas" aria-label="Interactive Vietnam operations map" />

      <div className="vietnam-map-context-chip">
        Live dots {formatNumber(points.length)}/{formatNumber(totalPointCount)}
      </div>

      {focusRegionCode ? (
        <div className="vietnam-map-region-focus-chip">
          <span>{focusRegionShortName ?? formatRegionCode(focusRegionCode)}</span>
          {focusRegionName ?? 'Focused region'}
          {clearRegionHref ? <a href={clearRegionHref}>Clear</a> : null}
        </div>
      ) : null}

      <div className="vietnam-map-dot-legend" aria-label="Vietnam map dot legend">
        <div className="vietnam-map-dot-legend-header">
          <div>
            <strong>Realtime signal legend</strong>
          </div>
          <small>{formatNumber(points.length)} shown</small>
        </div>
        <div className="vietnam-map-signal-filter-grid">
          {signalFilters.map((item) => (
            <a
              key={item.key}
              aria-pressed={item.isActive}
              className={`vietnam-map-signal-filter is-${item.key}${item.isActive ? ' is-active' : ''}`}
              href={item.href}
              role="button"
            >
              <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
              <span className="vietnam-map-signal-filter-copy">
                <span>{item.label}</span>
              </span>
              <strong>{formatNumber(item.count)}</strong>
            </a>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="vietnam-map-tile-empty">
          <AdminEmptyState
            message="Change filters or clear region focus."
            title="No live dots for selected filters"
          />
          <div className="vietnam-map-empty-stats" aria-label="Current realtime filter state">
            <span>
              <strong>{formatNumber(points.length)}</strong>
              Matching dots
            </span>
            <span>
              <strong>{formatNumber(totalPointCount)}</strong>
              Live feed dots
            </span>
            <span>
              <strong>{focusRegionName ?? 'Vietnam'}</strong>
              Map focus
            </span>
            <span>
              <strong>{mapStatus === 'ready' ? 'Ready' : mapStatus === 'error' ? 'Check key' : 'Loading'}</strong>
              Map status
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function markerAriaLabel(point: VietnamOverviewMapPoint) {
  return `${metricLabel(point.kind)} ${point.label} in ${formatRegionCode(point.regionCode)}`;
}

function signalTargetHref(point: VietnamOverviewMapPoint) {
  if (point.bookingId) return `/bookings/${point.bookingId}`;
  if (point.customerProfileId) return `/customers/${point.customerProfileId}`;
  if (point.providerProfileId) return `/partners/${point.providerProfileId}`;

  return null;
}

function metricLabel(kind: VietnamOverviewMetricDotKey) {
  return vietnamOverviewRealtimeMetricDotLegend.find((item) => item.key === kind)?.label ?? kind;
}

function formatRegionCode(value: string) {
  return value.trim().toUpperCase() || 'VN';
}
