'use client';

import { Clock3, MapPin, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import {
  type VietnamOverviewMapPoint,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewRealtimeMetricDotLegend,
} from './vietnam-overview-model';
import { VietnamOverviewMapZoom } from './vietnam-overview-map-zoom';

export type VietnamOverviewMapPointCluster = {
  readonly id: string;
  readonly isMixed: boolean;
  readonly mapXPercent: number;
  readonly mapYPercent: number;
  readonly points: readonly VietnamOverviewMapPoint[];
  readonly primaryPoint: VietnamOverviewMapPoint;
};

type VietnamOverviewMapClustersProps = {
  readonly children: ReactNode;
  readonly clusters: readonly VietnamOverviewMapPointCluster[];
  readonly regionFocusHrefs?: Readonly<Record<string, string>>;
};

const vietnamMapClusterPreviewLimit = 3;
const vietnamMapClusterPanelLimit = 25;

export function VietnamOverviewMapClusters({
  children,
  clusters,
  regionFocusHrefs = {},
}: VietnamOverviewMapClustersProps) {
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isDensityVisible, setIsDensityVisible] = useState(false);
  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );
  const heatCells = useMemo(() => vietnamOverviewHeatCells(clusters), [clusters]);

  return (
    <VietnamOverviewMapZoom
      overlay={
        <>
          <MapDensityToggle
            isDensityVisible={isDensityVisible}
            onToggle={() => setIsDensityVisible((current) => !current)}
          />
          {selectedCluster ? (
            <ClusterDetailPanel
              cluster={selectedCluster}
              focusHref={regionFocusHrefs[selectedCluster.primaryPoint.regionCode] ?? null}
              onClose={() => setSelectedClusterId(null)}
            />
          ) : null}
        </>
      }
    >
      {children}
      {isDensityVisible ? <VietnamOverviewHeatLayer cells={heatCells} /> : null}
      {clusters.map((cluster) => (
        <EventMapCluster
          key={cluster.id}
          cluster={cluster}
          isSelected={cluster.id === selectedClusterId}
          onSelect={() => setSelectedClusterId((current) => (current === cluster.id ? null : cluster.id))}
        />
      ))}
    </VietnamOverviewMapZoom>
  );
}

function MapDensityToggle({
  isDensityVisible,
  onToggle,
}: {
  readonly isDensityVisible: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="vietnam-map-display-toggle" aria-label="Vietnam map display mode">
      <span className={!isDensityVisible ? 'is-active' : ''}>Signals</span>
      <button
        aria-pressed={isDensityVisible}
        className={isDensityVisible ? 'is-active' : ''}
        onClick={onToggle}
        type="button"
      >
        Density
      </button>
    </div>
  );
}

type VietnamOverviewHeatCell = {
  readonly id: string;
  readonly intensity: number;
  readonly mapXPercent: number;
  readonly mapYPercent: number;
  readonly size: number;
};

function VietnamOverviewHeatLayer({ cells }: { readonly cells: readonly VietnamOverviewHeatCell[] }) {
  return (
    <div className="vietnam-map-density-layer" aria-hidden="true">
      {cells.map((cell) => (
        <span
          key={cell.id}
          className="vietnam-map-density-cell"
          style={
            {
              '--density-intensity': cell.intensity.toFixed(2),
              '--density-size': `${cell.size}px`,
              '--density-x': `${cell.mapXPercent}%`,
              '--density-y': `${cell.mapYPercent}%`,
            } as CSSProperties & Record<
              '--density-intensity' | '--density-size' | '--density-x' | '--density-y',
              string
            >
          }
        />
      ))}
    </div>
  );
}

function EventMapCluster({
  cluster,
  isSelected,
  onSelect,
}: {
  readonly cluster: VietnamOverviewMapPointCluster;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}) {
  const point = cluster.primaryPoint;
  const pointStyle = {
    '--point-x': `${cluster.mapXPercent}%`,
    '--point-y': `${cluster.mapYPercent}%`,
  } as CSSProperties & Record<'--point-x' | '--point-y', string>;
  const tooltipLines = clusterTooltipLines(cluster);
  const tooltipPlacement = [
    cluster.mapYPercent < 18 ? 'is-tooltip-below' : '',
    cluster.mapXPercent < 22 ? 'is-tooltip-right' : '',
    cluster.mapXPercent > 78 ? 'is-tooltip-left' : '',
  ].filter(Boolean).join(' ');
  const isCluster = cluster.points.length > 1;

  return (
    <button
      aria-label={tooltipLines.join(', ')}
      aria-pressed={isSelected}
      className={[
        'vietnam-map-event-point vietnam-map-metric-dot',
        `is-${point.kind}`,
        cluster.isMixed ? 'is-mixed' : '',
        isCluster ? 'is-cluster' : '',
        isSelected ? 'is-selected' : '',
        tooltipPlacement,
      ].filter(Boolean).join(' ')}
      data-tooltip={tooltipLines.join('\n')}
      onClick={onSelect}
      style={pointStyle}
      tabIndex={0}
      type="button"
    >
      {isCluster ? (
        <span className="vietnam-map-cluster-count" aria-hidden="true">
          {formatClusterCount(cluster.points.length)}
        </span>
      ) : null}
    </button>
  );
}

function ClusterDetailPanel({
  cluster,
  focusHref,
  onClose,
}: {
  readonly cluster: VietnamOverviewMapPointCluster;
  readonly focusHref: string | null;
  readonly onClose: () => void;
}) {
  const latestPoint = cluster.primaryPoint;
  const visibleEvents = cluster.points.slice(0, vietnamMapClusterPanelLimit);
  const hiddenCount = cluster.points.length - visibleEvents.length;

  return (
    <aside className="vietnam-map-cluster-panel" aria-label="Map cluster signal detail">
      <div className="vietnam-map-cluster-panel-header">
        <div>
          <p className="muted">Selected map signals</p>
          <h3>{formatNumber(cluster.points.length)} realtime signals</h3>
        </div>
        <button
          aria-label="Close selected map signals"
          className="vietnam-map-cluster-panel-close"
          onClick={onClose}
          type="button"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="vietnam-map-cluster-summary">
        {clusterKindSummary(cluster.points).map((item) => (
          <span key={item.key}>
            <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
            {item.label} <strong>{formatNumber(item.count)}</strong>
          </span>
        ))}
      </div>

      <div className="vietnam-map-cluster-location">
        <MapPin size={15} aria-hidden="true" />
        <span>{latestPoint.addressText || 'Stored operating coordinate'}</span>
      </div>

      {focusHref ? (
        <a className="vietnam-map-cluster-focus-link" href={focusHref}>
          Focus this region
        </a>
      ) : null}

      <div className="vietnam-map-cluster-events">
        {visibleEvents.map((point) => (
          <ClusterEventRow key={point.id} point={point} />
        ))}
        {hiddenCount > 0 ? (
          <div className="vietnam-map-cluster-more">+ {formatNumber(hiddenCount)} more signals in this point</div>
        ) : null}
      </div>
    </aside>
  );
}

function ClusterEventRow({ point }: { readonly point: VietnamOverviewMapPoint }) {
  const targetHref = signalTargetHref(point);

  return (
    <div className="vietnam-map-cluster-event">
      <i className={`vietnam-map-legend-dot is-${point.kind}`} aria-hidden="true" />
      <div>
        <strong>{metricLabel(point.kind)}</strong>
        <span>{point.label}</span>
        <small>
          <Clock3 size={12} aria-hidden="true" />
          {formatDateTime(point.occurredAt)}
        </small>
      </div>
      {targetHref ? (
        <a className="vietnam-map-cluster-event-link" href={targetHref}>
          Open
        </a>
      ) : null}
    </div>
  );
}

function signalTargetHref(point: VietnamOverviewMapPoint) {
  if (point.bookingId) return `/bookings/${point.bookingId}`;
  if (point.customerProfileId) return `/customers/${point.customerProfileId}`;
  if (point.providerProfileId) return `/partners/${point.providerProfileId}`;

  return null;
}

function clusterTooltipLines(cluster: VietnamOverviewMapPointCluster) {
  const latestPoint = cluster.primaryPoint;
  const previewLines = cluster.points.slice(0, vietnamMapClusterPreviewLimit).map((point) => (
    `${metricLabel(point.kind)} - ${point.label} - ${formatDateTime(point.occurredAt)}`
  ));
  const hiddenCount = cluster.points.length - previewLines.length;

  return [
    cluster.points.length > 1
      ? `${formatNumber(cluster.points.length)} realtime signals`
      : `${metricLabel(latestPoint.kind)} signal`,
    ...clusterKindSummary(cluster.points).map((item) => `${item.label} ${formatNumber(item.count)}`),
    latestPoint.addressText ? `Latest area: ${latestPoint.addressText}` : '',
    ...previewLines,
    hiddenCount > 0 ? `+ ${formatNumber(hiddenCount)} more` : '',
  ].filter(Boolean);
}

function clusterKindSummary(points: readonly VietnamOverviewMapPoint[]) {
  return vietnamOverviewRealtimeMetricDotLegend
    .map((item) => ({
      count: points.filter((point) => point.kind === item.key).length,
      key: item.key,
      label: item.label,
    }))
    .filter((item) => item.count > 0);
}

function vietnamOverviewHeatCells(
  clusters: readonly VietnamOverviewMapPointCluster[],
): VietnamOverviewHeatCell[] {
  const maxClusterCount = Math.max(1, ...clusters.map((cluster) => cluster.points.length));

  return clusters.map((cluster) => {
    const intensity = cluster.points.length / maxClusterCount;

    return {
      id: cluster.id,
      intensity,
      mapXPercent: cluster.mapXPercent,
      mapYPercent: cluster.mapYPercent,
      size: Math.round(72 + intensity * 128),
    };
  });
}

function formatClusterCount(value: number) {
  return value > 99 ? '99+' : formatNumber(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() === 0) {
    return 'pending';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function metricLabel(value: VietnamOverviewMetricDotKey) {
  return vietnamOverviewRealtimeMetricDotLegend.find((item) => item.key === value)?.label ?? value;
}
