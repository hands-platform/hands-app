export type UsageOverviewRange = 'today' | 'yesterday' | '7d' | 'month' | 'all';

export const usageOverviewRangeOptions: Array<{ value: UsageOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

const usageOverviewRanges = new Set<UsageOverviewRange>(
  usageOverviewRangeOptions.map((option) => option.value),
);

export function normalizeUsageOverviewRange(value: string | string[] | undefined): UsageOverviewRange {
  const candidate = Array.isArray(value) ? value[0] : value;

  return usageOverviewRanges.has(candidate as UsageOverviewRange)
    ? (candidate as UsageOverviewRange)
    : 'today';
}

export function usageOverviewHref(range: UsageOverviewRange) {
  return `/usage-overview?range=${range}`;
}
