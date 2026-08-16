import { isDeepStrictEqual } from 'node:util';

export const PROVIDER_WALLET_LEDGER_REPLAY_FIELDS = [
  'providerProfileId',
  'bookingId',
  'earningId',
  'payoutBatchId',
  'type',
  'amount',
  'currency',
  'reference',
  'notes',
  'metadata',
] as const;

export const CUSTOMER_WALLET_LEDGER_REPLAY_FIELDS = [
  'customerProfileId',
  'bookingId',
  'paymentId',
  'referralRewardId',
  'type',
  'amount',
  'currency',
  'reference',
  'notes',
  'metadata',
] as const;

export function immutableFinancialReplayMatches(
  existing: object,
  expected: object,
  fields: readonly string[],
) {
  const existingRecord = existing as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  return fields.every(
    (field) =>
      !(field in existingRecord) ||
      isDeepStrictEqual(existingRecord[field] ?? null, expectedRecord[field] ?? null),
  );
}
