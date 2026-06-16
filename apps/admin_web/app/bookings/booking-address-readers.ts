const ADDRESS_TEXT_FIELDS = ['addressText', 'fullAddress', 'formattedAddress', 'line1', 'street'] as const;

export function coordinatePairLabel(lat: unknown, lng: unknown) {
  const parsedLat = coordinatePart(lat);
  const parsedLng = coordinatePart(lng);
  if (!parsedLat || !parsedLng) {
    return null;
  }
  return `${parsedLat}, ${parsedLng}`;
}

export function readAddressText(value: unknown) {
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

  return null;
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
