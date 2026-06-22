export type VietnamOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

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
