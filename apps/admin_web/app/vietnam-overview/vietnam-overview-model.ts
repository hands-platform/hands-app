export type VietnamOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export type VietnamOverviewPointInput = {
  readonly id: string;
  readonly kind: VietnamOverviewMetricDotKey;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly occurredAt: string | null;
  readonly activityAt?: string | null;
  readonly createdAt?: string | null;
  readonly locationOccurredAt?: string | null;
  readonly regionCode: string;
  readonly source: string;
  readonly addressText?: string | null;
  readonly bookingId?: string | null;
  readonly customerProfileId?: string | null;
  readonly providerProfileId?: string | null;
  readonly status?: string | null;
};

export type VietnamOverviewMapPoint = VietnamOverviewPointInput & {
  readonly mapXPercent: number;
  readonly mapYPercent: number;
};

export type VietnamOverviewMetricDotKey =
  | 'customers'
  | 'active'
  | 'partners'
  | 'online'
  | 'busy-partners'
  | 'offline-partners'
  | 'stale-partners'
  | 'needs-supply'
  | 'assigned-bookings'
  | 'stale-bookings'
  | 'done'
  | 'cancel';

export const vietnamOverviewRealtimeMetricDotLegend: Array<{
  group: 'Live coverage' | 'Investigate' | 'Customer context';
  key: VietnamOverviewMetricDotKey;
  label: string;
}> = [
  { group: 'Live coverage', key: 'needs-supply', label: 'Needs supply' },
  { group: 'Live coverage', key: 'online', label: 'Ready Partners' },
  { group: 'Live coverage', key: 'assigned-bookings', label: 'Matched / in service' },
  { group: 'Investigate', key: 'stale-bookings', label: 'Stale active records' },
  { group: 'Investigate', key: 'busy-partners', label: 'Busy Partners' },
  { group: 'Investigate', key: 'stale-partners', label: 'Partner location unavailable / stale' },
  { group: 'Investigate', key: 'offline-partners', label: 'Offline Partners' },
  { group: 'Customer context', key: 'active', label: 'Customers active in last 30 days' },
  { group: 'Customer context', key: 'customers', label: 'Saved customer locations' },
];

export const vietnamOverviewRangeOptions: Array<{ value: VietnamOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All' },
];

const vietnamOverviewRanges = new Set<VietnamOverviewRange>(
  vietnamOverviewRangeOptions.map((option) => option.value),
);

export function normalizeVietnamOverviewRange(
  value: string | string[] | undefined,
): VietnamOverviewRange {
  const candidate = Array.isArray(value) ? value[0] : value;

  return vietnamOverviewRanges.has(candidate as VietnamOverviewRange)
    ? (candidate as VietnamOverviewRange)
    : 'today';
}

export function vietnamOverviewRealtimePointsApiHref() {
  return '/admin/vietnam-overview/realtime-points?take=50';
}

export function vietnamOverviewMapPoints(
  points: readonly VietnamOverviewPointInput[] = [],
): VietnamOverviewMapPoint[] {
  return points
    .map((point) => {
      const position = vietnamCoordinateMapPosition(point.latitude, point.longitude);
      if (!position) {
        return null;
      }

      return {
        ...point,
        mapXPercent: position.x,
        mapYPercent: position.y,
      };
    })
    .filter((point): point is VietnamOverviewMapPoint => Boolean(point))
    .sort(
      (left, right) =>
        (left.occurredAt ? new Date(left.occurredAt).getTime() : Number.MAX_SAFE_INTEGER) -
        (right.occurredAt ? new Date(right.occurredAt).getTime() : Number.MAX_SAFE_INTEGER),
    );
}

export function vietnamOverviewRealtimeMapPoints(
  points: readonly VietnamOverviewPointInput[] = [],
): VietnamOverviewMapPoint[] {
  return vietnamOverviewMapPoints(points.filter((point) => isRealtimeMapPointKind(point.kind)));
}

export function vietnamOverviewRealtimePointCounts(
  points: readonly Pick<VietnamOverviewMapPoint, 'kind'>[],
) {
  return vietnamOverviewRealtimeMetricDotLegend.reduce(
    (counts, item) => ({
      ...counts,
      [item.key]: points.filter((point) => point.kind === item.key).length,
    }),
    {} as Record<VietnamOverviewMetricDotKey, number>,
  );
}

export function isVietnamOverviewMapTilerTile(z: number, x: number, y: number) {
  if (
    z < VIETNAM_MAPTILER_TILE_VIEW.minZoom ||
    z > VIETNAM_MAPTILER_TILE_VIEW.maxZoom
  ) {
    return false;
  }

  const tileWindow = vietnamOverviewMapTilerTileWindow(z);

  return (
    x >= tileWindow.minTileX &&
    x <= tileWindow.maxTileX &&
    y >= tileWindow.minTileY &&
    y <= tileWindow.maxTileY
  );
}

function isRealtimeMapPointKind(kind: VietnamOverviewMetricDotKey) {
  return (
    kind === 'customers' ||
    kind === 'active' ||
    kind === 'online' ||
    kind === 'busy-partners' ||
    kind === 'stale-partners' ||
    kind === 'offline-partners' ||
    kind === 'needs-supply' ||
    kind === 'assigned-bookings' ||
    kind === 'stale-bookings'
  );
}

export function vietnamOverviewMappedSignalScope(input?: {
  readonly sources?: readonly {
    readonly mappedPointCount: number;
    readonly total: number | null;
    readonly totalUnavailable: boolean;
    readonly truncated: boolean;
  }[];
}) {
  const sources = input?.sources ?? [];
  const returned = sources.reduce((sum, source) => sum + source.mappedPointCount, 0);
  const hasUnknownTotal = sources.length === 0 || sources.some((source) => source.totalUnavailable || source.total === null);
  const truncated = sources.some((source) => source.truncated);
  const total = hasUnknownTotal
    ? null
    : sources.reduce((sum, source) => sum + (source.total ?? 0), 0);

  if (total !== null) {
    return {
      returned,
      total,
      truncated,
      copy: `Showing ${returned} of ${total} mapped signals.`,
    };
  }

  return {
    returned,
    total: null,
    truncated,
    copy: `Showing up to ${returned} recent mapped signals. This is not a complete regional total.`,
  };
}

function vietnamCoordinateMapPosition(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < VIETNAM_MAP_BOUNDS.minLat ||
    latitude > VIETNAM_MAP_BOUNDS.maxLat ||
    longitude < VIETNAM_MAP_BOUNDS.minLng ||
    longitude > VIETNAM_MAP_BOUNDS.maxLng
  ) {
    return null;
  }

  return {
    x: clampPercent(
      ((longitude - VIETNAM_MAP_BOUNDS.minLng) /
        (VIETNAM_MAP_BOUNDS.maxLng - VIETNAM_MAP_BOUNDS.minLng)) *
        100,
    ),
    y: clampPercent(vietnamMercatorYPercent(latitude)),
  };
}

function vietnamMercatorYPercent(latitude: number) {
  const minY = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.maxLat, VIETNAM_MAPTILER_TILE_VIEW.zoom);
  const maxY = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.minLat, VIETNAM_MAPTILER_TILE_VIEW.zoom);
  const y = latitudeToTileYFloat(latitude, VIETNAM_MAPTILER_TILE_VIEW.zoom);

  return ((y - minY) / (maxY - minY)) * 100;
}

function clampPercent(value: number) {
  return Math.max(4, Math.min(96, value));
}

export const VIETNAM_MAP_BOUNDS = {
  minLat: 8.0,
  maxLat: 23.5,
  minLng: 102.0,
  maxLng: 110.0,
} as const;

export const VIETNAM_MAPTILER_TILE_VIEW = {
  maxZoom: 16,
  minZoom: 5,
  style: 'streets-v2',
  zoom: 7,
} as const;

function vietnamOverviewMapTilerTileWindow(zoom: number) {
  const minXFloat = longitudeToTileXFloat(VIETNAM_MAP_BOUNDS.minLng, zoom);
  const maxXFloat = longitudeToTileXFloat(VIETNAM_MAP_BOUNDS.maxLng, zoom);
  const minYFloat = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.maxLat, zoom);
  const maxYFloat = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.minLat, zoom);

  return {
    maxTileX: Math.floor(maxXFloat),
    maxTileY: Math.floor(maxYFloat),
    maxXFloat,
    maxYFloat,
    minTileX: Math.floor(minXFloat),
    minTileY: Math.floor(minYFloat),
    minXFloat,
    minYFloat,
  };
}

function longitudeToTileXFloat(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileYFloat(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;

  return (
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
    2 ** zoom
  );
}
