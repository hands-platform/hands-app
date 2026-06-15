export function roundTo100Meters(value: number) {
  return Math.round(value / 100) * 100;
}

export function safeDistanceMeters(lat1: unknown, lng1: unknown, lat2: unknown, lng2: unknown) {
  const parsedLat1 = parseFiniteCoordinate(lat1);
  const parsedLng1 = parseFiniteCoordinate(lng1);
  const parsedLat2 = parseFiniteCoordinate(lat2);
  const parsedLng2 = parseFiniteCoordinate(lng2);

  if (parsedLat1 == null || parsedLng1 == null || parsedLat2 == null || parsedLng2 == null) {
    return null;
  }

  return roundTo100Meters(haversineMeters(parsedLat1, parsedLng1, parsedLat2, parsedLng2));
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function parseFiniteCoordinate(value: unknown) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
