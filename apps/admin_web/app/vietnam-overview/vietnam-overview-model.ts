export type VietnamOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export type VietnamOverviewRegionMarkerInput = {
  readonly activeBookingCount: number;
  readonly activeCustomerCount: number;
  readonly cancellationCount: number;
  readonly completedBookingCount: number;
  readonly currency: string;
  readonly customerCount: number;
  readonly onlinePartnerCount: number;
  readonly partnerCount: number;
  readonly regionCode: string;
  readonly regionName: string;
  readonly revenueAmount: number;
  readonly shortName: string;
};

export type VietnamOverviewMapMarker = {
  readonly activeBookingCount: number;
  readonly activeCustomerCount: number;
  readonly cancellationCount: number;
  readonly completedBookingCount: number;
  readonly currency: string;
  readonly customerCount: number;
  readonly demandCount: number;
  readonly featured: boolean;
  readonly intensity: number;
  readonly mapXPercent: number;
  readonly mapYPercent: number;
  readonly metricDots: readonly VietnamOverviewMetricDot[];
  readonly onlinePartnerCount: number;
  readonly partnerCount: number;
  readonly partnerSummary: string;
  readonly regionCode: string;
  readonly regionName: string;
  readonly revenueAmount: number;
  readonly shortName: string;
  readonly tone: 'high' | 'medium' | 'low';
};

export type VietnamOverviewPointInput = {
  readonly id: string;
  readonly kind: VietnamOverviewMetricDotKey;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly occurredAt: string;
  readonly regionCode: string;
  readonly source: string;
  readonly addressText?: string | null;
  readonly bookingId?: string | null;
  readonly customerProfileId?: string | null;
  readonly providerProfileId?: string | null;
};

export type VietnamOverviewMapPoint = VietnamOverviewPointInput & {
  readonly mapXPercent: number;
  readonly mapYPercent: number;
};

export type VietnamOverviewGeoapifyTile = {
  readonly src: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type VietnamOverviewGeoapifyTileGrid = {
  readonly cols: number;
  readonly layerHeightPercent: number;
  readonly layerLeftPercent: number;
  readonly layerTopPercent: number;
  readonly layerWidthPercent: number;
  readonly rows: number;
  readonly style: string;
  readonly tiles: readonly VietnamOverviewGeoapifyTile[];
  readonly viewAspectRatio: number;
  readonly zoom: number;
};

export type VietnamOverviewMapZoomLevel = {
  readonly label: string;
  readonly scale: number;
};

export type VietnamOverviewMetricDotKey =
  | 'customers'
  | 'active'
  | 'partners'
  | 'online'
  | 'bookings'
  | 'done'
  | 'cancel';

export type VietnamOverviewMetricDot = {
  readonly key: VietnamOverviewMetricDotKey;
  readonly label: string;
  readonly size: number;
  readonly value: number;
};

export const vietnamOverviewMetricDotLegend: Array<{
  key: VietnamOverviewMetricDotKey;
  label: string;
}> = [
  { key: 'customers', label: 'Customers' },
  { key: 'active', label: 'Active' },
  { key: 'partners', label: 'Partners' },
  { key: 'online', label: 'Online' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'done', label: 'Done' },
  { key: 'cancel', label: 'Cancel' },
];

export const vietnamOverviewRealtimeMetricDotLegend: Array<{
  key: VietnamOverviewMetricDotKey;
  label: string;
}> = [
  { key: 'active', label: 'Active customers' },
  { key: 'online', label: 'Online Partners' },
  { key: 'bookings', label: 'Active bookings' },
];

export const vietnamOverviewRangeOptions: Array<{ value: VietnamOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All' },
];

export const vietnamOverviewMapZoomLevels: readonly VietnamOverviewMapZoomLevel[] = [
  { label: '100%', scale: 1 },
  { label: '125%', scale: 1.25 },
  { label: '150%', scale: 1.5 },
  { label: '175%', scale: 1.75 },
  { label: '200%', scale: 2 },
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

export function vietnamOverviewHref(range: VietnamOverviewRange) {
  return `/vietnam-overview?range=${range}`;
}

export function vietnamOverviewMapMarkers(
  regions: readonly VietnamOverviewRegionMarkerInput[],
): VietnamOverviewMapMarker[] {
  const rankedRegions = [...regions].sort((left, right) => demandCount(right) - demandCount(left));
  const maxDemand = Math.max(1, ...rankedRegions.map(demandCount));
  const maxMetricValue = Math.max(
    1,
    ...rankedRegions.flatMap((region) => vietnamOverviewMetricValues(region).map((metric) => metric.value)),
  );

  return rankedRegions.map((region, index) => {
    const demand = demandCount(region);
    const intensity = Math.max(12, Math.round((demand / maxDemand) * 100));
    const mapPosition = vietnamMapPosition(region, index);

    return {
      activeBookingCount: region.activeBookingCount,
      activeCustomerCount: region.activeCustomerCount,
      cancellationCount: region.cancellationCount,
      completedBookingCount: region.completedBookingCount,
      currency: region.currency,
      customerCount: region.customerCount,
      demandCount: demand,
      featured: index === 0,
      intensity,
      mapXPercent: mapPosition.x,
      mapYPercent: mapPosition.y,
      metricDots: vietnamOverviewMetricValues(region).map((metric) => ({
        ...metric,
        size: metricDotSize(metric.value, maxMetricValue),
      })),
      onlinePartnerCount: region.onlinePartnerCount,
      partnerCount: region.partnerCount,
      partnerSummary: `${region.onlinePartnerCount} online / ${region.partnerCount} Partners`,
      regionCode: region.regionCode,
      regionName: region.regionName,
      revenueAmount: region.revenueAmount,
      shortName: region.shortName,
      tone: index === 0 ? 'high' : intensity >= 50 ? 'medium' : 'low',
    };
  });
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
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());
}

export function vietnamOverviewRealtimeMapPoints(
  points: readonly VietnamOverviewPointInput[] = [],
): VietnamOverviewMapPoint[] {
  return vietnamOverviewMapPoints(points.filter((point) => isRealtimeMapPointKind(point.kind)));
}

export function vietnamOverviewMetricPointCounts(
  points: readonly Pick<VietnamOverviewMapPoint, 'kind'>[],
) {
  return vietnamOverviewMetricDotLegend.reduce(
    (counts, item) => ({
      ...counts,
      [item.key]: points.filter((point) => point.kind === item.key).length,
    }),
    {} as Record<VietnamOverviewMetricDotKey, number>,
  );
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

export function vietnamOverviewGeoapifyTileGrid(): VietnamOverviewGeoapifyTileGrid {
  const tileWindow = vietnamOverviewGeoapifyTileWindow();
  const viewWidth = tileWindow.maxXFloat - tileWindow.minXFloat;
  const viewHeight = tileWindow.maxYFloat - tileWindow.minYFloat;
  const tileAreaWidth = tileWindow.maxTileX + 1 - tileWindow.minTileX;
  const tileAreaHeight = tileWindow.maxTileY + 1 - tileWindow.minTileY;
  const tiles: VietnamOverviewGeoapifyTile[] = [];

  for (let y = tileWindow.minTileY; y <= tileWindow.maxTileY; y += 1) {
    for (let x = tileWindow.minTileX; x <= tileWindow.maxTileX; x += 1) {
      tiles.push({
        src: `/api/admin/geoapify-tiles/${VIETNAM_GEOAPIFY_TILE_VIEW.zoom}/${x}/${y}.png`,
        x,
        y,
        z: VIETNAM_GEOAPIFY_TILE_VIEW.zoom,
      });
    }
  }

  return {
    cols: tileWindow.maxTileX - tileWindow.minTileX + 1,
    layerHeightPercent: (tileAreaHeight / viewHeight) * 100,
    layerLeftPercent: ((tileWindow.minTileX - tileWindow.minXFloat) / viewWidth) * 100,
    layerTopPercent: ((tileWindow.minTileY - tileWindow.minYFloat) / viewHeight) * 100,
    layerWidthPercent: (tileAreaWidth / viewWidth) * 100,
    rows: tileWindow.maxTileY - tileWindow.minTileY + 1,
    style: VIETNAM_GEOAPIFY_TILE_VIEW.style,
    tiles,
    viewAspectRatio: viewWidth / viewHeight,
    zoom: VIETNAM_GEOAPIFY_TILE_VIEW.zoom,
  };
}

export function isVietnamOverviewGeoapifyTile(z: number, x: number, y: number) {
  const tileWindow = vietnamOverviewGeoapifyTileWindow();

  return (
    z === VIETNAM_GEOAPIFY_TILE_VIEW.zoom &&
    x >= tileWindow.minTileX &&
    x <= tileWindow.maxTileX &&
    y >= tileWindow.minTileY &&
    y <= tileWindow.maxTileY
  );
}

function isRealtimeMapPointKind(kind: VietnamOverviewMetricDotKey) {
  return kind === 'active' || kind === 'online' || kind === 'bookings';
}

function demandCount(region: VietnamOverviewRegionMarkerInput) {
  return region.activeBookingCount + region.completedBookingCount;
}

function vietnamOverviewMetricValues(region: VietnamOverviewRegionMarkerInput) {
  return [
    { key: 'customers', label: 'Customers', value: region.customerCount },
    { key: 'active', label: 'Active', value: region.activeCustomerCount },
    { key: 'partners', label: 'Partners', value: region.partnerCount },
    { key: 'online', label: 'Online', value: region.onlinePartnerCount },
    { key: 'bookings', label: 'Bookings', value: region.activeBookingCount },
    { key: 'done', label: 'Done', value: region.completedBookingCount },
    { key: 'cancel', label: 'Cancel', value: region.cancellationCount },
  ] satisfies Array<Omit<VietnamOverviewMetricDot, 'size'>>;
}

function metricDotSize(value: number, maxMetricValue: number) {
  if (value <= 0) return 8;

  return Math.round(10 + (value / maxMetricValue) * 18);
}

function vietnamMapPosition(
  region: Pick<VietnamOverviewRegionMarkerInput, 'regionCode' | 'regionName' | 'shortName'>,
  index: number,
) {
  const normalizedRegion = normalizeRegionKey(
    `${region.regionCode} ${region.regionName} ${region.shortName}`,
  );
  const knownPosition = knownVietnamMapPositions.find(({ keys }) =>
    keys.some((key) => normalizedRegion.includes(key)),
  );

  if (knownPosition) {
    return { x: knownPosition.x, y: knownPosition.y };
  }

  return fallbackVietnamMapPosition(index);
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
  const minY = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.maxLat, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);
  const maxY = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.minLat, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);
  const y = latitudeToTileYFloat(latitude, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);

  return ((y - minY) / (maxY - minY)) * 100;
}

function clampPercent(value: number) {
  return Math.max(4, Math.min(96, value));
}

function normalizeRegionKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const knownVietnamMapPositions = [
  { keys: ['hanoi', 'ha noi', 'han'], x: 54, y: 20 },
  { keys: ['hai phong', 'haiphong'], x: 60, y: 24 },
  { keys: ['da nang', 'danang', 'dng'], x: 57, y: 52 },
  { keys: ['nha trang', 'khanh hoa'], x: 64, y: 64 },
  { keys: ['ho chi minh', 'hcm', 'sai gon', 'saigon'], x: 61, y: 76 },
  { keys: ['vung tau', 'ba ria'], x: 68, y: 84 },
  { keys: ['can tho', 'mekong'], x: 47, y: 86 },
] as const;

export const VIETNAM_MAP_BOUNDS = {
  minLat: 8.0,
  maxLat: 23.5,
  minLng: 102.0,
  maxLng: 110.0,
} as const;

export const VIETNAM_GEOAPIFY_TILE_VIEW = {
  style: 'osm-bright-smooth',
  zoom: 7,
} as const;

function vietnamOverviewGeoapifyTileWindow() {
  const minXFloat = longitudeToTileXFloat(VIETNAM_MAP_BOUNDS.minLng, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);
  const maxXFloat = longitudeToTileXFloat(VIETNAM_MAP_BOUNDS.maxLng, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);
  const minYFloat = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.maxLat, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);
  const maxYFloat = latitudeToTileYFloat(VIETNAM_MAP_BOUNDS.minLat, VIETNAM_GEOAPIFY_TILE_VIEW.zoom);

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

function fallbackVietnamMapPosition(index: number) {
  const xOffsets = [50, 58, 44, 62, 48, 56];
  const yOffsets = [30, 40, 50, 60, 70, 82];

  return {
    x: xOffsets[index % xOffsets.length],
    y: yOffsets[index % yOffsets.length],
  };
}
