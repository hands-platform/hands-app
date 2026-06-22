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

export function vietnamRegionLabel(code: string | null | undefined) {
  return VIETNAM_REGION_BUCKETS.find((bucket) => bucket.code === code)?.name ?? 'Other Vietnam';
}

export function vietnamRegionCodeFromValues(values: readonly unknown[]): VietnamRegionCode {
  const normalized = normalizeRegionText(values.map(flattenText).filter(Boolean).join(' '));

  for (const matcher of REGION_MATCHERS) {
    if (matcher.pattern.test(normalized)) {
      return matcher.code;
    }
  }

  return 'other-vietnam';
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
