import { readPlainRecord } from './admin-format';

export type BookingPartnerChoiceEvidenceNeedsOpsInput = {
  status?: string | null;
  hasSelectedProvider: boolean;
  hasPreferredProvider: boolean;
  acceptedOrSelectedParticipantCount: number;
};

export type BookingAlertEvidenceNeedsOpsInput = {
  status?: string | null;
  participantCount: number;
  totalNotified: number;
};

export type BookingAlertTraceSummary = {
  batchCount: number;
  totalNotified: number;
  lastStage?: string;
  lastCreatedAt?: string;
};

function readOptionalNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function bookingPartnerChoiceEvidenceNeedsOpsFromFacts(
  input: BookingPartnerChoiceEvidenceNeedsOpsInput,
): boolean {
  if (input.status !== 'OPEN_MATCHING' || input.hasSelectedProvider) {
    return false;
  }
  return !input.hasPreferredProvider || input.acceptedOrSelectedParticipantCount > 0;
}

export function bookingAlertTraceSummaryFromMetadata(metadata: unknown): BookingAlertTraceSummary {
  const record = readPlainRecord(metadata);
  const traces = Array.isArray(record?.backupNotificationTraces)
    ? record.backupNotificationTraces
        .map(readPlainRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];

  const latest = traces.at(-1);

  return {
    batchCount: traces.length,
    totalNotified: traces.reduce(
      (total, trace) => total + (readOptionalNumber(trace.notifiedCount) ?? 0),
      0,
    ),
    lastStage: readOptionalString(latest?.stage),
    lastCreatedAt: readOptionalString(latest?.createdAt),
  };
}

export function bookingAlertEvidenceNeedsOpsFromFacts(
  input: BookingAlertEvidenceNeedsOpsInput,
): boolean {
  return input.status === 'OPEN_MATCHING' && input.participantCount === 0 && input.totalNotified === 0;
}
