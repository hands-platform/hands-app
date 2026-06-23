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
  readonly onlinePartnerCount: number;
  readonly partnerCount: number;
  readonly partnerSummary: string;
  readonly regionCode: string;
  readonly regionName: string;
  readonly revenueAmount: number;
  readonly shortName: string;
  readonly tone: 'high' | 'medium' | 'low';
};

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

export function vietnamOverviewHref(range: VietnamOverviewRange) {
  return `/vietnam-overview?range=${range}`;
}

export function vietnamOverviewMapMarkers(
  regions: readonly VietnamOverviewRegionMarkerInput[],
): VietnamOverviewMapMarker[] {
  const rankedRegions = [...regions].sort((left, right) => demandCount(right) - demandCount(left));
  const maxDemand = Math.max(1, ...rankedRegions.map(demandCount));

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

function demandCount(region: VietnamOverviewRegionMarkerInput) {
  return region.activeBookingCount + region.completedBookingCount;
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

function fallbackVietnamMapPosition(index: number) {
  const xOffsets = [50, 58, 44, 62, 48, 56];
  const yOffsets = [30, 40, 50, 60, 70, 82];

  return {
    x: xOffsets[index % xOffsets.length],
    y: yOffsets[index % yOffsets.length],
  };
}
