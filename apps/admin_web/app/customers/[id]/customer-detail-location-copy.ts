export type CustomerSelectedLocationCopyInput = {
  addressText?: string | null;
  latitude?: unknown;
  longitude?: unknown;
};

export type CustomerBookingAddressCopyInput = {
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  addressSnapshot?: {
    address?: unknown;
    addressText?: string | null;
    latitude?: unknown;
    longitude?: unknown;
  } | null;
};

export function customerSelectedLocationDetail(location: CustomerSelectedLocationCopyInput) {
  return readableAddressText(location.addressText) ?? 'Saved service address without readable address text';
}

export function customerBookingAddressEvidenceLabel(booking: CustomerBookingAddressCopyInput) {
  const snapshotAddress =
    readableAddressText(booking.addressSnapshot?.addressText) ??
    readableAddressText(booking.addressSnapshot?.address);
  if (snapshotAddress) {
    return snapshotAddress;
  }

  const legacyAddress = readableAddressText(booking.address);
  if (legacyAddress) {
    return legacyAddress;
  }

  if (booking.addressSnapshot || booking.lat != null || booking.lng != null) {
    return 'Booking address saved without readable address text';
  }

  return 'No booking address evidence loaded';
}

function readableAddressText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return (
      readableAddressText(objectValue.addressText) ??
      readableAddressText(objectValue.address) ??
      readableAddressText(objectValue.label) ??
      readableAddressText(objectValue.name)
    );
  }

  return null;
}
