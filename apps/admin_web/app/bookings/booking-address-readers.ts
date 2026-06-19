const ADDRESS_TEXT_FIELDS = [
  'addressText',
  'address_text',
  'fullAddress',
  'full_address',
  'formattedAddress',
  'formatted_address',
  'displayAddress',
  'display_address',
  'addressLine',
  'address_line',
] as const;
const ADDRESS_PART_FIELDS = ['line1', 'street', 'ward', 'district', 'city', 'province', 'country'] as const;
const ADDRESS_LABEL_FIELDS = ['label', 'name'] as const;
const COORDINATE_PAIR_TEXT_RE = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
const COUNTRY_SUFFIX_RE = /(?:,?\s*(?:Vietnam|Viet Nam|Việt Nam|베트남))\.?$/iu;
const TRAILING_POSTAL_CODE_RE = /\s+\d{4,6}$/;

export function coordinatePairLabel(lat: unknown, lng: unknown) {
  const parsedLat = coordinatePart(lat);
  const parsedLng = coordinatePart(lng);
  if (!parsedLat || !parsedLng) {
    return null;
  }
  return `${parsedLat}, ${parsedLng}`;
}

export function readAddressText(value: unknown): string | null {
  if (typeof value === 'string') {
    return trimmedAddressText(value);
  }

  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const field of ADDRESS_TEXT_FIELDS) {
    const candidate = trimmedAddressText(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  const parts = ADDRESS_PART_FIELDS.map((field) => trimmedAddressText(record[field])).filter(Boolean);
  const uniqueParts = Array.from(new Set(parts));
  if (uniqueParts.length > 0) {
    return uniqueParts.join(', ');
  }

  const nestedAddress: string | null = record.address === value ? null : readAddressText(record.address);
  if (nestedAddress) {
    return nestedAddress;
  }

  for (const field of ADDRESS_LABEL_FIELDS) {
    const candidate = trimmedAddressText(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function serviceAddressAreaLabel(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || isPinLikeAddressText(normalized)) {
    return normalized;
  }

  const withoutCountry = normalized.replace(COUNTRY_SUFFIX_RE, '').replace(/,\s*$/, '').trim();
  const parts = withoutCountry.split(',').map(compactAddressAreaPart).filter(Boolean);
  if (parts.length < 2) {
    return compactAddressAreaPart(withoutCountry) ?? normalized;
  }

  return parts.slice(-2).join(', ');
}

function coordinatePart(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(4) : null;
}

function readRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function trimmedAddressText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || isPinLikeAddressText(text)) {
    return null;
  }
  return text;
}

function compactAddressAreaPart(value: string) {
  const text = value.trim().replace(/\s+/g, ' ').replace(TRAILING_POSTAL_CODE_RE, '').trim();
  return text || null;
}

function isPinLikeAddressText(value: string) {
  return COORDINATE_PAIR_TEXT_RE.test(value) || /\bpin\b/i.test(value);
}
