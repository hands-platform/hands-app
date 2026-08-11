export type VietnamRegionCode =
  | 'hanoi'
  | 'hcm'
  | 'da-nang'
  | 'vung-tau'
  | 'nha-trang'
  | 'da-lat'
  | 'can-tho'
  | 'other-vietnam';

export type VietnamRegionBucket = {
  code: VietnamRegionCode;
  name: string;
  shortName: string;
};

export type VietnamCoordinateInput = {
  latitude?: unknown;
  longitude?: unknown;
};

export type AdminVietnamOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export type AdminVietnamOverviewWindow = {
  range: AdminVietnamOverviewRange;
  label: string;
  startAt: Date | null;
  endAt: Date | null;
};

export const VIETNAM_OVERVIEW_TIME_ZONE = 'Asia/Ho_Chi_Minh' as const;

export const VIETNAM_REGION_BUCKETS: readonly VietnamRegionBucket[] = [
  { code: 'hanoi', name: 'Ha Noi', shortName: 'HN' },
  { code: 'hcm', name: 'Ho Chi Minh City', shortName: 'HCMC' },
  { code: 'da-nang', name: 'Da Nang', shortName: 'DN' },
  { code: 'vung-tau', name: 'Vung Tau', shortName: 'VT' },
  { code: 'nha-trang', name: 'Nha Trang', shortName: 'NT' },
  { code: 'da-lat', name: 'Da Lat', shortName: 'DL' },
  { code: 'can-tho', name: 'Can Tho', shortName: 'CT' },
  { code: 'other-vietnam', name: 'Other Vietnam', shortName: 'VN' },
];

const DEFAULT_VIETNAM_OVERVIEW_RANGE: AdminVietnamOverviewRange = 'today';
const VIETNAM_OVERVIEW_RANGE_LABELS: Record<AdminVietnamOverviewRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};
const SUPPORTED_VIETNAM_OVERVIEW_RANGES = new Set<AdminVietnamOverviewRange>([
  'today',
  'yesterday',
  '7d',
  '30d',
  'all',
]);

const REGION_MATCHERS: Array<{ code: VietnamRegionCode; pattern: RegExp }> = [
  {
    code: 'vung-tau',
    pattern: /\b(vung tau|tam thang)\b/,
  },
  {
    code: 'hcm',
    pattern:
      /\b(ho chi minh|hcm|sai gon|saigon|district 1|quan 1|ben nghe|binh thanh|thanh my tay|an khanh|phu nhuan|tan binh|thu duc)\b/,
  },
  {
    code: 'hanoi',
    pattern:
      /\b(ha noi|hanoi|cau giay|dong da|hoan kiem|tay ho|ba dinh|nam tu liem|bac tu liem|thanh xuan|long bien|hai ba trung)\b/,
  },
  {
    code: 'da-nang',
    pattern: /\b(da nang|danang|hai chau|son tra|ngu hanh son)\b/,
  },
  {
    code: 'nha-trang',
    pattern: /\b(nha trang|khanh hoa)\b/,
  },
  {
    code: 'da-lat',
    pattern: /\b(da lat|dalat|lam dong)\b/,
  },
  {
    code: 'can-tho',
    pattern: /\b(can tho|ninh kieu)\b/,
  },
];

const REGION_BOUNDING_BOXES: Array<{
  code: Exclude<VietnamRegionCode, 'other-vietnam'>;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}> = [
  { code: 'hcm', minLat: 10.3, maxLat: 11.2, minLng: 106.2, maxLng: 107.3 },
  { code: 'vung-tau', minLat: 10.2, maxLat: 10.65, minLng: 106.95, maxLng: 107.45 },
  { code: 'hanoi', minLat: 20.75, maxLat: 21.35, minLng: 105.5, maxLng: 106.15 },
  { code: 'da-nang', minLat: 15.85, maxLat: 16.25, minLng: 107.85, maxLng: 108.45 },
  { code: 'nha-trang', minLat: 12.1, maxLat: 12.4, minLng: 109.0, maxLng: 109.4 },
  { code: 'da-lat', minLat: 11.75, maxLat: 12.1, minLng: 108.25, maxLng: 108.65 },
  { code: 'can-tho', minLat: 9.8, maxLat: 10.2, minLng: 105.55, maxLng: 106.1 },
];

export function vietnamRegionLabel(code: string | null | undefined) {
  return VIETNAM_REGION_BUCKETS.find((bucket) => bucket.code === code)?.name ?? 'Other Vietnam';
}

export function normalizeAdminVietnamOverviewRange(value: unknown): AdminVietnamOverviewRange {
  if (typeof value !== 'string') {
    return DEFAULT_VIETNAM_OVERVIEW_RANGE;
  }

  return SUPPORTED_VIETNAM_OVERVIEW_RANGES.has(value as AdminVietnamOverviewRange)
    ? (value as AdminVietnamOverviewRange)
    : DEFAULT_VIETNAM_OVERVIEW_RANGE;
}

export function adminVietnamOverviewRangeWindow(
  rangeInput: AdminVietnamOverviewRange,
  now = new Date(),
): AdminVietnamOverviewWindow {
  const range = normalizeAdminVietnamOverviewRange(rangeInput);
  const todayStart = startOfVietnamDay(now);

  if (range === 'all') {
    return {
      range,
      label: VIETNAM_OVERVIEW_RANGE_LABELS[range],
      startAt: null,
      endAt: null,
    };
  }

  if (range === 'today') {
    return {
      range,
      label: VIETNAM_OVERVIEW_RANGE_LABELS[range],
      startAt: todayStart,
      endAt: addUtcDays(todayStart, 1),
    };
  }

  if (range === 'yesterday') {
    return {
      range,
      label: VIETNAM_OVERVIEW_RANGE_LABELS[range],
      startAt: addUtcDays(todayStart, -1),
      endAt: todayStart,
    };
  }

  return {
    range,
    label: VIETNAM_OVERVIEW_RANGE_LABELS[range],
    startAt: addUtcDays(todayStart, range === '7d' ? -6 : -29),
    endAt: addUtcDays(todayStart, 1),
  };
}

export function adminVietnamOverviewDateWhere(window: AdminVietnamOverviewWindow) {
  if (!window.startAt || !window.endAt) {
    return undefined;
  }

  return {
    gte: window.startAt,
    lt: window.endAt,
  };
}

export function vietnamRegionCodeFromValues(
  values: readonly unknown[],
  coordinates?: VietnamCoordinateInput | null,
): VietnamRegionCode {
  const normalized = normalizeRegionText(values.map(flattenText).filter(Boolean).join(' '));

  for (const matcher of REGION_MATCHERS) {
    if (matcher.pattern.test(normalized)) {
      return matcher.code;
    }
  }

  const coordinateRegion = vietnamRegionCodeFromCoordinate(coordinates);
  if (coordinateRegion) {
    return coordinateRegion;
  }

  return 'other-vietnam';
}

export function vietnamRegionCodeFromCoordinate(
  coordinates?: VietnamCoordinateInput | null,
): Exclude<VietnamRegionCode, 'other-vietnam'> | null {
  const latitude = numberValue(coordinates?.latitude);
  const longitude = numberValue(coordinates?.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const match = REGION_BOUNDING_BOXES.find(
    (box) =>
      latitude >= box.minLat &&
      latitude <= box.maxLat &&
      longitude >= box.minLng &&
      longitude <= box.maxLng,
  );

  return match?.code ?? null;
}

function flattenText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(flattenText).filter(Boolean).join(' ');
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(flattenText).filter(Boolean).join(' ');
  }

  return '';
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && 'toString' in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRegionText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function startOfVietnamDay(value: Date) {
  const vietnamOffsetMs = 7 * 60 * 60 * 1000;
  const localValue = new Date(value.getTime() + vietnamOffsetMs);

  return new Date(
    Date.UTC(localValue.getUTCFullYear(), localValue.getUTCMonth(), localValue.getUTCDate()) -
      vietnamOffsetMs,
  );
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
