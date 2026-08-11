export type ProviderBookingAlertPreferences = {
  enabled: boolean;
  maxDistanceKm: number | null;
  customerGender: string | null;
  customerNationality: string | null;
  serviceIds: string[];
};

const DEFAULT_PREFERENCES: ProviderBookingAlertPreferences = {
  enabled: true,
  maxDistanceKm: null,
  customerGender: null,
  customerNationality: null,
  serviceIds: [],
};

export function normalizeProviderBookingAlertPreferences(
  value: unknown,
): ProviderBookingAlertPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const maxDistanceKm = Number(value.maxDistanceKm);
  return {
    enabled: value.enabled !== false,
    maxDistanceKm:
      Number.isFinite(maxDistanceKm) && maxDistanceKm > 0 && maxDistanceKm <= 100
        ? maxDistanceKm
        : null,
    customerGender: normalizedText(value.customerGender),
    customerNationality: normalizedText(value.customerNationality),
    serviceIds: Array.isArray(value.serviceIds)
      ? [...new Set(value.serviceIds.map(normalizedText).filter((item): item is string => Boolean(item)))].slice(
          0,
          50,
        )
      : [],
  };
}

export function providerBookingAlertMatches(
  value: unknown,
  booking: {
    distanceMeters: number | null;
    serviceId: string;
    customerGender?: string | null;
    customerNationality?: string | null;
  },
) {
  const preferences = normalizeProviderBookingAlertPreferences(value);
  if (!preferences.enabled) return false;
  if (
    preferences.maxDistanceKm !== null &&
    (booking.distanceMeters === null || booking.distanceMeters > preferences.maxDistanceKm * 1000)
  ) {
    return false;
  }
  if (preferences.serviceIds.length > 0 && !preferences.serviceIds.includes(booking.serviceId)) {
    return false;
  }
  if (!sameOptionalFilter(preferences.customerGender, booking.customerGender)) return false;
  if (!sameOptionalFilter(preferences.customerNationality, booking.customerNationality)) return false;
  return true;
}

function sameOptionalFilter(filter: string | null, value: string | null | undefined) {
  return filter === null || filter.toLocaleLowerCase() === normalizedText(value)?.toLocaleLowerCase();
}

function normalizedText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
