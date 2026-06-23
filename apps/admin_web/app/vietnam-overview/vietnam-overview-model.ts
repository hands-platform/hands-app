export type VietnamOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export type VietnamOverviewRegionTileInput = {
  readonly activeBookingCount: number;
  readonly completedBookingCount: number;
  readonly onlinePartnerCount: number;
  readonly partnerCount: number;
  readonly regionCode: string;
  readonly regionName: string;
  readonly shortName: string;
};

export type VietnamOverviewMapTile = {
  readonly demandCount: number;
  readonly featured: boolean;
  readonly intensity: number;
  readonly partnerSummary: string;
  readonly regionCode: string;
  readonly regionName: string;
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

export function vietnamOverviewMapTiles(
  regions: readonly VietnamOverviewRegionTileInput[],
): VietnamOverviewMapTile[] {
  const rankedRegions = [...regions].sort((left, right) => demandCount(right) - demandCount(left));
  const maxDemand = Math.max(1, ...rankedRegions.map(demandCount));

  return rankedRegions.map((region, index) => {
    const demand = demandCount(region);
    const intensity = Math.max(12, Math.round((demand / maxDemand) * 100));

    return {
      demandCount: demand,
      featured: index === 0,
      intensity,
      partnerSummary: `${region.onlinePartnerCount} online / ${region.partnerCount} Partners`,
      regionCode: region.regionCode,
      regionName: region.regionName,
      shortName: region.shortName,
      tone: index === 0 ? 'high' : intensity >= 50 ? 'medium' : 'low',
    };
  });
}

function demandCount(region: VietnamOverviewRegionTileInput) {
  return region.activeBookingCount + region.completedBookingCount;
}
