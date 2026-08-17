import { createHash } from 'node:crypto';

export type BookingCreationIntent = {
  address: unknown;
  couponCode?: string | null;
  lat: number;
  lng: number;
  notes?: string | null;
  paymentMethod: string;
  preferredProviderId?: string | null;
  serviceId: string;
};

export function bookingCreationLockKey(customerProfileId: string, idempotencyKey: string) {
  return `customer-booking:${customerProfileId}:${idempotencyKey}`;
}

export function bookingCreationFingerprint(input: BookingCreationIntent) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJsonValue(input)))
    .digest('hex');
}

export function bookingCreationRequestMetadata(idempotencyKey: string, fingerprint: string) {
  return {
    idempotencyKey,
    fingerprint,
  };
}

export function bookingCreationRequestFromMetadata(metadata: unknown) {
  const root = plainRecord(metadata);
  const request = plainRecord(root?.bookingCreationRequest);
  const idempotencyKey = typeof request?.idempotencyKey === 'string' ? request.idempotencyKey : undefined;
  const fingerprint = typeof request?.fingerprint === 'string' ? request.fingerprint : undefined;
  return idempotencyKey && fingerprint ? { idempotencyKey, fingerprint } : undefined;
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalJsonValue);
  }
  const record = plainRecord(value);
  if (!record) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalJsonValue(record[key])]),
  );
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
