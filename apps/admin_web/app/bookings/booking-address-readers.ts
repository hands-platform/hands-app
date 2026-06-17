const ADDRESS_TEXT_FIELDS = [
  'addressText',
  'address_text',
  'fullAddress',
  'formattedAddress',
  'label',
  'name',
  'line1',
  'street',
] as const;
const ADDRESS_PART_FIELDS = ['line1', 'street', 'ward', 'district', 'city', 'province', 'country'] as const;

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
    return trimmedString(value);
  }

  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const field of ADDRESS_TEXT_FIELDS) {
    const candidate = trimmedString(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  const nestedAddress: string | null = record.address === value ? null : readAddressText(record.address);
  if (nestedAddress) {
    return nestedAddress;
  }

  const parts = ADDRESS_PART_FIELDS.map((field) => trimmedString(record[field])).filter(Boolean);
  const uniqueParts = Array.from(new Set(parts));
  return uniqueParts.length > 0 ? uniqueParts.join(', ') : null;
}

function coordinatePart(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(4) : null;
}

function readRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function trimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}
