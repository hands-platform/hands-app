'use client';

import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Marker,
  Popup,
} from 'maplibre-gl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { StatusBadge } from '../../components/status-badge';
import { formatWholeNumber as formatNumber } from '../../lib/admin-format';
import {
  type VietnamOverviewMapPoint,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewRealtimeMetricDotLegend,
} from './vietnam-overview-model';

export type VietnamOverviewLiveMapProps = {
  readonly clearRegionHref: string | null;
  readonly focusRegionCode: string | null;
  readonly focusRegionName: string | null;
  readonly focusRegionShortName: string | null;
  readonly points: readonly VietnamOverviewMapPoint[];
  readonly resetLayersHref: string;
  readonly returnHref: string;
  readonly sampleCopy: string;
  readonly signalFilters: readonly VietnamOverviewSignalFilter[];
  readonly totalPointCount: number;
  readonly visibleCopy: string;
};

type MarkerHandle = {
  readonly element: HTMLButtonElement;
  readonly groupId: string;
  readonly marker: Marker;
  readonly popup: Popup;
};

type CoordinateGroup = {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly points: readonly VietnamOverviewMapPoint[];
};

type MapLibreApi = typeof import('maplibre-gl');

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
const vietnamClusterMaxDisplayZoom = 10;
const vietnamLiveMapSourceId = 'vietnam-live-signals';
const vietnamLiveMapLayerIds = ['vietnam-live-clusters', 'vietnam-live-unclustered'] as const;

const vietnamRegionCenters: Record<string, { readonly center: [number, number]; readonly zoom: number }> = {
  hanoi: { center: [105.8542, 21.0285], zoom: 11 },
  hcm: { center: [106.7009, 10.7769], zoom: 11 },
  'da-nang': { center: [108.2022, 16.0544], zoom: 11 },
  'vung-tau': { center: [107.0843, 10.4114], zoom: 11 },
  'nha-trang': { center: [109.1967, 12.2388], zoom: 11 },
  'can-tho': { center: [105.7469, 10.0452], zoom: 11 },
};

export function VietnamOverviewLiveMap({
  clearRegionHref,
  focusRegionCode,
  focusRegionName,
  focusRegionShortName,
  points,
  resetLayersHref,
  returnHref,
  sampleCopy,
  signalFilters,
  totalPointCount,
  visibleCopy,
}: VietnamOverviewLiveMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreRef = useRef<MapLibreApi | null>(null);
  const markerRefs = useRef<MarkerHandle[]>([]);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const coordinateGroups = useMemo(() => groupPointsByCoordinate(points), [points]);

  useEffect(() => {
    let disposed = false;

    async function mountMap() {
      if (!containerRef.current || mapRef.current) return;
      setMapStatus('loading');

      try {
        const maplibregl = await import('maplibre-gl');
        if (disposed || !containerRef.current || mapRef.current) return;

        const focus = focusRegionCode ? vietnamRegionCenters[focusRegionCode] : null;
        const map = new maplibregl.Map({
          attributionControl: false,
          center: focus?.center ?? vietnamDefaultCenter,
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
            layers: [{ id: 'maptiler-base', source: 'maptiler', type: 'raster' }],
          },
          zoom: focus?.zoom ?? 5.4,
        });

        mapLibreRef.current = maplibregl;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        map.on('load', () => {
          if (!disposed) setMapStatus('ready');
        });
        map.on('error', () => {
          if (!disposed) setMapStatus('error');
        });
        mapRef.current = map;
      } catch {
        if (!disposed) setMapStatus('error');
      }
    }

    void mountMap();

    return () => {
      disposed = true;
      markerRefs.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      mapLibreRef.current = null;
    };
  }, [focusRegionCode]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = mapLibreRef.current;
    if (!map || !maplibregl || mapStatus === 'loading') return;

    markerRefs.current.forEach(({ marker, popup }) => {
      popup.remove();
      marker.remove();
    });
    const sourceId = vietnamLiveMapSourceId;
    const [clusterLayerId, unclusteredLayerId] = vietnamLiveMapLayerIds;
    removeVietnamOverviewMapDataLayers(map, mapRef.current);
    const usesGeoJsonClusters = shouldUseVietnamOverviewGeoJsonClusters(coordinateGroups.length);

    if (usesGeoJsonClusters) {
      map.addSource(sourceId, {
        cluster: true,
        clusterMaxZoom: vietnamClusterMaxDisplayZoom - 1,
        clusterRadius: 48,
        data: {
          features: coordinateGroups.map((group) => ({
            geometry: { coordinates: [group.longitude, group.latitude], type: 'Point' as const },
            properties: { groupId: group.id, recordCount: group.points.length },
            type: 'Feature' as const,
          })),
          type: 'FeatureCollection' as const,
        },
        type: 'geojson',
      });
      map.addLayer({
        filter: ['has', 'point_count'],
        id: clusterLayerId,
        maxzoom: vietnamClusterMaxDisplayZoom,
        paint: {
          'circle-color': '#16243a',
          'circle-radius': ['step', ['get', 'point_count'], 20, 20, 24, 50, 28],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
        source: sourceId,
        type: 'circle',
      });
      map.addLayer({
        filter: ['!', ['has', 'point_count']],
        id: unclusteredLayerId,
        maxzoom: vietnamClusterMaxDisplayZoom,
        paint: {
          'circle-color': '#2563eb',
          'circle-opacity': 0.82,
          'circle-radius': 8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
        source: sourceId,
        type: 'circle',
      });
    }

    const onClusterClick = async (event: MapLayerMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: [clusterLayerId] })[0];
      const clusterId = Number(feature?.properties?.cluster_id);
      const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates : null;
      if (!Number.isFinite(clusterId) || !coordinates) return;
      const zoom = await (map.getSource(sourceId) as GeoJSONSource).getClusterExpansionZoom(clusterId);
      map.easeTo({ center: [Number(coordinates[0]), Number(coordinates[1])], zoom });
    };
    if (usesGeoJsonClusters) map.on('click', clusterLayerId, onClusterClick);

    markerRefs.current = coordinateGroups.map((group, index) => {
      const element = document.createElement('button');
      const popupContent = buildPopupContent(group.points, returnHref);
      const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 18 })
        .setDOMContent(popupContent)
        .setLngLat([group.longitude, group.latitude]);
      const onPopupKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') popup.remove();
      };

      element.type = 'button';
      element.className = `vietnam-maplibre-marker is-${group.points[0].kind}${group.points.length > 1 ? ' is-aggregate' : ''}`;
      element.style.zIndex = String(group.points.length);
      element.setAttribute('aria-label', groupAriaLabel(group));
      element.title = groupAriaLabel(group);
      if (group.points.length > 1) element.textContent = String(group.points.length);
      element.tabIndex = index === 0 ? 0 : -1;
      element.addEventListener('pointerdown', (event) => event.stopPropagation());
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        popup.addTo(map);
      });
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          element.click();
          return;
        }
        const nextIndex = markerFocusIndex(event.key, index, coordinateGroups.length);
        if (nextIndex === null) return;
        event.preventDefault();
        markerRefs.current.forEach(({ element: markerElement }, markerIndex) => {
          markerElement.tabIndex = markerIndex === nextIndex ? 0 : -1;
        });
        markerRefs.current[nextIndex]?.element.focus();
      });
      popup.on('open', () => {
        const popupElement = popup.getElement();
        popupElement.addEventListener('keydown', onPopupKeyDown);
        popupElement.querySelector<HTMLElement>('button, a')?.focus();
      });
      popup.on('close', () => {
        popup.getElement()?.removeEventListener('keydown', onPopupKeyDown);
        if (!element.hidden) element.focus();
        else map.getCanvas().focus();
      });

      const marker = new maplibregl.Marker({ element })
        .setLngLat([group.longitude, group.latitude])
        .addTo(map);

      return { element, groupId: group.id, marker, popup };
    });

    const onUnclusteredClick = (event: MapLayerMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: [unclusteredLayerId] })[0];
      const groupId = String(feature?.properties?.groupId ?? '');
      markerRefs.current.find((handle) => handle.groupId === groupId)?.popup.addTo(map);
    };
    if (usesGeoJsonClusters) map.on('click', unclusteredLayerId, onUnclusteredClick);

    const updateMarkerVisibility = () => {
      const clustersVisible = usesGeoJsonClusters && map.getZoom() < vietnamClusterMaxDisplayZoom;
      markerRefs.current.forEach(({ element }) => {
        element.hidden = clustersVisible;
      });
    };
    map.on('zoomend', updateMarkerVisibility);
    updateMarkerVisibility();

    if (coordinateGroups.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      coordinateGroups.forEach((group) => bounds.extend([group.longitude, group.latitude]));
      map.fitBounds(bounds, {
        maxZoom: 13,
        padding: { bottom: 90, left: 70, right: 70, top: 80 },
      });
    } else {
      const focus = focusRegionCode ? vietnamRegionCenters[focusRegionCode] : null;
      map.easeTo({ center: focus?.center ?? vietnamDefaultCenter, duration: 450, zoom: focus?.zoom ?? 5.4 });
    }

    return () => {
      if (mapRef.current !== map) return;
      if (usesGeoJsonClusters) {
        map.off('click', clusterLayerId, onClusterClick);
        map.off('click', unclusteredLayerId, onUnclusteredClick);
      }
      map.off('zoomend', updateMarkerVisibility);
      markerRefs.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      markerRefs.current = [];
      removeVietnamOverviewMapDataLayers(map, mapRef.current);
    };
  }, [coordinateGroups, focusRegionCode, mapStatus, returnHref]);

  const replaceWithoutScroll = (href: string) => router.replace(href, { scroll: false });
  const activeLayerCount = signalFilters.filter((filter) => filter.isActive).length;

  return (
    <div className="vietnam-maplibre-layout">
      <div className="vietnam-map-toolbar">
        <span>{sampleCopy} <strong>{visibleCopy}</strong></span>
        <details className="vietnam-map-layer-menu">
          <summary>Layers ({formatNumber(activeLayerCount)} on)</summary>
          <div className="vietnam-map-dot-legend" aria-label="Vietnam map layers">
            <div className="vietnam-map-dot-legend-header">
              <div>
                <strong>Map layers</strong>
                <span>Default: Needs supply + Ready Partners</span>
              </div>
              <AdminFormControlButton className="button-secondary vietnam-map-reset-layers" onClick={() => replaceWithoutScroll(resetLayersHref)} type="button">
                Reset layers
              </AdminFormControlButton>
            </div>
            {(['Live coverage', 'Investigate', 'Customer context'] as const).map((group) => (
              <div className="vietnam-map-layer-group" key={group}>
                <strong>{group}</strong>
                <div className="vietnam-map-signal-filter-grid">
                  {signalFilters
                    .filter((item) =>
                      vietnamOverviewRealtimeMetricDotLegend.find((legend) => legend.key === item.key)?.group === group,
                    )
                    .map((item) => (
                      <AdminFormControlButton
                        aria-pressed={item.isActive}
                        className={`button-secondary vietnam-map-signal-filter is-${item.key}${item.isActive ? ' is-active' : ''}`}
                        key={item.key}
                        onClick={() => replaceWithoutScroll(item.href)}
                        type="button"
                      >
                        <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
                        <span className="vietnam-map-signal-filter-copy"><span>{item.label}</span></span>
                        <strong>{formatNumber(item.count)}</strong>
                      </AdminFormControlButton>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
      <div className="vietnam-maplibre-shell">
        <div ref={containerRef} className="vietnam-maplibre-canvas" aria-label="Interactive Vietnam operations map" />

        {focusRegionCode ? (
          <div className="vietnam-map-region-focus-chip">
            <span>{focusRegionShortName ?? formatRegionCode(focusRegionCode)}</span>
            {focusRegionName ?? 'Focused region'}
            {clearRegionHref ? (
              <AdminFormControlButton onClick={() => replaceWithoutScroll(clearRegionHref)} type="button">
                All regions
              </AdminFormControlButton>
            ) : null}
          </div>
        ) : null}

        {mapStatus === 'error' ? (
          <div className="vietnam-map-tile-error" role="alert">
            <strong>Map tiles unavailable</strong>
            <span>Mapped records remain available below.</span>
            <AdminFormControlButton onClick={() => window.location.reload()} type="button">
              Retry map
            </AdminFormControlButton>
          </div>
        ) : null}

        {points.length === 0 ? (
          <div className="vietnam-map-tile-empty">
            <AdminEmptyState
              message={totalPointCount > 0 ? 'Change layers or select All regions.' : 'No current mapped signals are available.'}
              title={totalPointCount > 0 ? 'No records match these layers' : 'No mapped signals'}
            />
          </div>
        ) : null}
      </div>

      {points.length > 0 ? (
        <details className="vietnam-map-record-list">
          <summary>Mapped records · {formatNumber(points.length)}</summary>
          <AdminTableScroll ariaLabel="Mapped Vietnam operations records">
            <AdminDataTable
              emptyMessage={null}
              headers={['Record', 'Operational state', 'Region', 'State / location age', 'Action']}
              rowCount={points.length}
            >
              {points.map((point) => {
                const href = signalTargetHref(point, returnHref);
                return (
                  <tr key={point.id}>
                    <td><strong>{safePointName(point)}</strong></td>
                    <td>
                      <div className="vietnam-map-record-state">
                        <span>{operationalStatusLabel(point.status, point.kind)}</span>
                        {point.kind === 'stale-bookings' ? <StatusBadge tone="warning">Stale</StatusBadge> : null}
                      </div>
                    </td>
                    <td>{formatRegionCode(point.regionCode)}</td>
                    <td>{pointTimeSummary(point)}</td>
                    <td>{href ? <a href={href}>{pointActionLabel(point)}</a> : 'No action'}</td>
                  </tr>
                );
              })}
            </AdminDataTable>
          </AdminTableScroll>
        </details>
      ) : null}
    </div>
  );
}

export function removeVietnamOverviewMapDataLayers(
  map: Pick<MapLibreMap, 'getLayer' | 'getSource' | 'removeLayer' | 'removeSource'>,
  currentMap: MapLibreMap | null,
) {
  if (currentMap !== map) return;
  vietnamLiveMapLayerIds.forEach((layerId) => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  });
  if (map.getSource(vietnamLiveMapSourceId)) map.removeSource(vietnamLiveMapSourceId);
}

function buildPopupContent(points: readonly VietnamOverviewMapPoint[], returnHref: string) {
  const content = document.createElement('div');
  content.className = 'vietnam-maplibre-popup';

  const type = document.createElement('span');
  type.textContent = points.length > 1 ? `${points.length} records at this location` : metricLabel(points[0].kind);
  content.append(type);

  const list = document.createElement('ul');
  points.forEach((point) => {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = safePointName(point);
    const status = document.createElement('span');
    status.textContent = operationalStatusLabel(point.status, point.kind);
    const meta = document.createElement('small');
    meta.textContent = `${formatRegionCode(point.regionCode)} · ${pointTimeSummary(point)}`;
    item.append(label, status, meta);
    const targetHref = signalTargetHref(point, returnHref);
    if (targetHref) {
      const link = document.createElement('a');
      link.href = targetHref;
      link.textContent = pointActionLabel(point);
      item.append(link);
    }
    list.append(item);
  });
  content.append(list);

  return content;
}

function markerAriaLabel(point: VietnamOverviewMapPoint) {
  return `${metricLabel(point.kind)} ${safePointName(point)}, ${operationalStatusLabel(point.status, point.kind)}, ${formatRegionCode(point.regionCode)}`;
}

function groupAriaLabel(group: CoordinateGroup) {
  return group.points.length > 1
    ? `${group.points.length} records at ${formatRegionCode(group.points[0].regionCode)}. Press Enter to choose a record.`
    : markerAriaLabel(group.points[0]);
}

export function groupPointsByCoordinate(points: readonly VietnamOverviewMapPoint[]) {
  const groups = new Map<string, VietnamOverviewMapPoint[]>();
  points.forEach((point) => {
    const key = `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  });
  return Array.from(groups, ([id, groupedPoints]): CoordinateGroup => ({
    id,
    latitude: groupedPoints[0].latitude,
    longitude: groupedPoints[0].longitude,
    points: groupedPoints,
  }));
}

export function shouldUseVietnamOverviewGeoJsonClusters(groupCount: number) {
  return groupCount > 20;
}

function safePointName(point: VietnamOverviewMapPoint) {
  const id = point.bookingId ?? point.customerProfileId ?? point.providerProfileId ?? point.id;
  const shortId = id.length > 12 ? id.slice(-8) : id;
  return point.label && point.label !== id ? `${point.label} · ${shortId}` : shortId;
}

function signalTargetHref(point: VietnamOverviewMapPoint, returnHref: string) {
  const returnQuery = `returnTo=${encodeURIComponent(returnHref)}`;
  if (point.bookingId) return `/bookings/${point.bookingId}?${returnQuery}`;
  if (point.customerProfileId) return `/customers/${point.customerProfileId}?${returnQuery}`;
  if (point.providerProfileId) return `/partners/${point.providerProfileId}?${returnQuery}`;
  return null;
}

function markerFocusIndex(key: string, current: number, count: number) {
  if (count < 1) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

function pointAge(value: string | null) {
  if (!value) return 'Age unknown';
  const occurredAt = new Date(value);
  if (Number.isNaN(occurredAt.getTime())) return 'Age unknown';
  const minutes = Math.max(0, Math.round((Date.now() - occurredAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function pointTimeSummary(point: VietnamOverviewMapPoint) {
  if (point.bookingId) {
    return `State ${pointAge(point.occurredAt)}${point.createdAt ? ` · Booking ${pointAge(point.createdAt)}` : ''}`;
  }
  if (point.customerProfileId && point.kind === 'active') {
    return `Activity ${pointAge(point.activityAt ?? point.occurredAt)} · Location ${pointAge(point.locationOccurredAt ?? null)}`;
  }
  return `Location ${pointAge(point.locationOccurredAt ?? point.occurredAt)}`;
}

function pointActionLabel(point: VietnamOverviewMapPoint) {
  if (point.bookingId) return 'Open booking';
  if (point.customerProfileId) return 'Open customer';
  if (point.providerProfileId) return 'Open Partner';
  return 'Open record';
}

function operationalStatusLabel(status: string | null | undefined, kind: VietnamOverviewMetricDotKey) {
  switch (status) {
    case 'OPEN_MATCHING':
    case 'CREATED':
      return 'Needs matching';
    case 'MATCHED':
      return 'Matched';
    case 'PROVIDER_ON_THE_WAY':
      return 'Partner on the way';
    case 'ARRIVED':
      return 'Partner arrived';
    case 'IN_SERVICE':
      return 'Service in progress';
    case 'ONLINE_AVAILABLE':
      return 'Ready now';
    case 'ONLINE_BUSY':
      return 'Busy';
    case 'OFFLINE':
      return 'Offline';
    case 'SEEN_IN_30_DAYS':
      return 'Active in last 30 days';
    case 'SAVED_LOCATION':
      return 'Saved location';
    default:
      return kind === 'stale-bookings' ? 'Stale active record' : metricLabel(kind);
  }
}

function metricLabel(kind: VietnamOverviewMetricDotKey) {
  return vietnamOverviewRealtimeMetricDotLegend.find((item) => item.key === kind)?.label ?? kind;
}

function formatRegionCode(value: string) {
  return value.trim().toUpperCase() || 'VN';
}
