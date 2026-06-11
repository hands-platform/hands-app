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
    return value.trim() || null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.addressText,
    record.fullAddress,
    record.formattedAddress,
    record.line1,
    record.street,
  ];
  return (
    candidates
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      ?.trim() ?? null
  );
}

function coordinatePart(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(4) : null;
}
