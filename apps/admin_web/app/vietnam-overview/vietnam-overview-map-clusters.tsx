'use client';

import { Clock3, MapPin, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import {
  type VietnamOverviewMapPoint,
  type VietnamOverviewMetricDotKey,
  vietnamOverviewRealtimeMetricDotLegend,
} from './vietnam-overview-model';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminCard } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import {
  formatPendingDateTime as formatDateTime,
  formatWholeNumber as formatNumber,
} from '../../lib/admin-format';
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
            onSelect={setIsDensityVisible}
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
  onSelect,
}: {
  readonly isDensityVisible: boolean;
  readonly onSelect: (isDensityVisible: boolean) => void;
}) {
  return (
    <AdminSegmentedControl
      activeValue={isDensityVisible ? 'density' : 'signals'}
      ariaLabel="Vietnam map display mode"
      className="vietnam-map-display-toggle"
      options={[
        {
          href: '#vietnam-map-signals',
          label: 'Signals',
          onClick: (event) => {
            event.preventDefault();
            onSelect(false);
          },
          value: 'signals',
        },
        {
          href: '#vietnam-map-density',
          label: 'Density',
          onClick: (event) => {
            event.preventDefault();
            onSelect(true);
          },
          value: 'density',
        },
      ]}
    />
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
      aria-label={clusterAriaLabel(cluster)}
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
  const latestTargetHref = signalTargetHref(latestPoint);
  const latestSignalSource = signalSourceCopy(latestPoint);
  const latestOperatorRead = signalOperatorRead(latestPoint);
  const signalSummary = clusterKindSummary(cluster.points);
  const latestAddress = latestPoint.addressText || 'Stored operating coordinate';
  const visibleEvents = cluster.points.slice(0, vietnamMapClusterPanelLimit);
  const hiddenCount = cluster.points.length - visibleEvents.length;

  return (
    <aside className="vietnam-map-cluster-panel" aria-label="Map cluster signal detail">
      <div className="vietnam-map-cluster-panel-header">
        <div>
          <p className="muted">Realtime operating signal</p>
          <h3>{formatNumber(cluster.points.length)} live dot(s)</h3>
        </div>
        <div className="vietnam-map-cluster-panel-badges">
          <StatusBadge className="vietnam-map-cluster-panel-badge" tone="success">
            Live now
          </StatusBadge>
          <StatusBadge
            className="vietnam-map-cluster-panel-badge is-region"
            tone="primary"
          >
            {formatRegionCode(latestPoint.regionCode)}
          </StatusBadge>
        </div>
        <AdminFormControlButton
          aria-label="Close selected map signals"
          className="button-secondary vietnam-map-cluster-panel-close"
          onClick={onClose}
          title="Close selected map signals"
          type="button"
        >
          <X size={16} aria-hidden="true" />
        </AdminFormControlButton>
      </div>

      <div className={`vietnam-map-cluster-operator-read is-${latestPoint.kind}`}>
        <span>Operator read</span>
        <strong>{latestOperatorRead.label}</strong>
        <small>{latestOperatorRead.detail}</small>
      </div>

      <div className="vietnam-map-cluster-latest">
        <i className={`vietnam-map-legend-dot is-${latestPoint.kind}`} aria-hidden="true" />
        <div>
          <small>Latest signal</small>
          <strong>{latestPoint.label}</strong>
          <span>
            {metricLabel(latestPoint.kind)} / <DateTimeText value={latestPoint.occurredAt} />
          </span>
          <span>{latestSignalSource.label}</span>
        </div>
        {latestTargetHref ? (
          <a className="vietnam-map-cluster-latest-link" href={latestTargetHref}>
            Open latest
          </a>
        ) : null}
      </div>

      <div className="vietnam-map-cluster-summary-grid">
        {signalSummary.map((item) => (
          <AdminCard key={item.key} className={`vietnam-map-cluster-summary-card is-${item.key}`}>
            <span>
              <i className={`vietnam-map-legend-dot is-${item.key}`} aria-hidden="true" />
              {item.label}
            </span>
            <strong>{formatNumber(item.count)}</strong>
            <small>
              Latest {item.latestPoint ? <DateTimeText value={item.latestPoint.occurredAt} /> : 'pending'}
            </small>
          </AdminCard>
        ))}
      </div>

      <div className="vietnam-map-cluster-context-grid" aria-label="Selected map signal context">
        <AdminCard className="vietnam-map-cluster-context-card">
          <span>Region</span>
          <strong>{formatRegionCode(latestPoint.regionCode)}</strong>
          <small>Vietnam service area</small>
        </AdminCard>
        <AdminCard className="vietnam-map-cluster-context-card">
          <span>Source</span>
          <strong>{latestSignalSource.label}</strong>
          <small>{latestSignalSource.detail}</small>
        </AdminCard>
        <AdminCard className="vietnam-map-cluster-context-card is-wide">
          <span>Latest area</span>
          <strong>
            <MapPin size={13} aria-hidden="true" />
            {latestAddress}
          </strong>
          <small>Shown from stored operational coordinates only.</small>
        </AdminCard>
      </div>

      {focusHref ? (
        <a className="vietnam-map-cluster-focus-link" href={focusHref}>
          Focus this region
        </a>
      ) : null}

      <div className="vietnam-map-cluster-events-header">
        <div>
          <strong>Latest signal events</strong>
          <span>Newest {formatNumber(visibleEvents.length)} of {formatNumber(cluster.points.length)}</span>
        </div>
        <small>Newest first</small>
      </div>
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
  const sourceCopy = signalSourceCopy(point);
  const regionCode = formatRegionCode(point.regionCode);

  return (
    <div className="vietnam-map-cluster-event">
      <i className={`vietnam-map-legend-dot is-${point.kind}`} aria-hidden="true" />
      <div>
        <strong>{metricLabel(point.kind)}</strong>
        <span>{point.label}</span>
        <small>
          <Clock3 size={12} aria-hidden="true" />
          <DateTimeText value={point.occurredAt} />
        </small>
        <div className="vietnam-map-cluster-event-meta">
          <span>{sourceCopy.label}</span>
          <span>{regionCode}</span>
        </div>
        {point.addressText ? <p>{point.addressText}</p> : null}
        <p className="vietnam-map-cluster-event-source-detail">{sourceCopy.detail}</p>
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
  const latestSource = signalSourceCopy(latestPoint);
  const summaryLine = clusterKindSummary(cluster.points)
    .map((item) => `${item.shortLabel}: ${formatNumber(item.count)}`)
    .join(' / ');

  return [
    `${formatRegionCode(latestPoint.regionCode)} / ${formatNumber(cluster.points.length)} live dot(s)`,
    summaryLine,
    `Latest: ${metricLabel(latestPoint.kind)} - ${latestPoint.label}`,
    `${formatDateTime(latestPoint.occurredAt)} / ${latestSource.label}`,
    latestPoint.addressText ? latestPoint.addressText : '',
    'Click to inspect details',
  ].filter(Boolean);
}

function clusterAriaLabel(cluster: VietnamOverviewMapPointCluster) {
  const latestPoint = cluster.primaryPoint;

  return [
    cluster.points.length > 1
      ? `${formatNumber(cluster.points.length)} realtime signals`
      : `${metricLabel(latestPoint.kind)} signal`,
    ...clusterKindSummary(cluster.points).map((item) => `${item.label} ${formatNumber(item.count)}`),
    `Latest ${metricLabel(latestPoint.kind)} at ${formatDateTime(latestPoint.occurredAt)}`,
    `Region ${formatRegionCode(latestPoint.regionCode)}`,
    'Open map signal details',
  ].join(', ');
}

function clusterKindSummary(points: readonly VietnamOverviewMapPoint[]) {
  return vietnamOverviewRealtimeMetricDotLegend
    .map((item) => {
      const matchingPoints = points
        .filter((point) => point.kind === item.key)
        .sort((left, right) => eventTimeMs(right.occurredAt) - eventTimeMs(left.occurredAt));

      return {
        count: matchingPoints.length,
        key: item.key,
        label: item.label,
        shortLabel: signalShortLabel(item.key),
        latestPoint: matchingPoints[0] ?? null,
      };
    })
    .filter((item) => item.count > 0);
}

function signalShortLabel(value: VietnamOverviewMetricDotKey) {
  if (value === 'active') return 'Customers';
  if (value === 'online') return 'Partners';
  if (value === 'bookings') return 'Bookings';
  return metricLabel(value);
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

function eventTimeMs(value: string) {
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function formatRegionCode(value: string) {
  return value.trim().toUpperCase() || 'VN';
}

function formatSourceLabel(value: string) {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Stored Signal';
}

function signalSourceCopy(point: VietnamOverviewMapPoint) {
  if (point.kind === 'active') {
    return {
      label: 'Customer session location',
      detail: 'Uses the customer saved or selected service location, not continuous GPS polling.',
    };
  }

  if (point.kind === 'online') {
    return {
      label: 'Partner heartbeat location',
      detail: 'Uses the latest cost-controlled Partner app heartbeat while the Partner is online.',
    };
  }

  if (point.kind === 'bookings') {
    return {
      label: 'Active booking address',
      detail: 'Uses the immutable booking address snapshot for active request and work states.',
    };
  }

  return {
    label: formatSourceLabel(point.source),
    detail: 'Stored operating signal used by the admin overview only.',
  };
}

function signalOperatorRead(point: VietnamOverviewMapPoint) {
  if (point.kind === 'active') {
    return {
      label: 'Customer demand is active',
      detail: 'Use this dot to read live customer demand without continuous GPS polling.',
    };
  }

  if (point.kind === 'online') {
    return {
      label: 'Partner supply is available',
      detail: 'This dot comes from the latest cost-controlled Partner heartbeat.',
    };
  }

  if (point.kind === 'bookings') {
    return {
      label: 'Booking work is in progress',
      detail: 'This dot uses the immutable booking address snapshot for active work.',
    };
  }

  return {
    label: 'Stored operating signal',
    detail: 'Review the event source and linked record before acting.',
  };
}

function metricLabel(value: VietnamOverviewMetricDotKey) {
  return vietnamOverviewRealtimeMetricDotLegend.find((item) => item.key === value)?.label ?? value;
}
