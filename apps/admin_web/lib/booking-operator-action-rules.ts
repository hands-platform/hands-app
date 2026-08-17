const noShowEligibleStatuses = new Set(['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED']);

export function bookingOperatorNoteLines(notes?: string | null): string[] {
  return (notes ?? '')
    .split('\n')
    .map((note) => note.trim())
    .filter(Boolean);
}

export function canMarkNoShow(status: string): boolean {
  return noShowEligibleStatuses.has(status);
}

export type BookingOperatorAuditNote = {
  readonly actorLabel: string;
  readonly content: string;
  readonly createdAt: string;
  readonly id: string;
};

export function bookingOperatorAuditNotes(auditLogs?: readonly AdminAuditLog[]): BookingOperatorAuditNote[] {
  return (auditLogs ?? []).flatMap((log) => {
    if (log.action !== 'booking.ops_note.add' || !log.metadata || typeof log.metadata !== 'object') {
      return [];
    }
    const note =
      'note' in log.metadata && typeof log.metadata.note === 'string' ? log.metadata.note.trim() : '';
    if (!note) return [];

    return [
      {
        actorLabel:
          log.actor?.fullName?.trim() ||
          log.actor?.email?.trim() ||
          log.actor?.phone?.trim() ||
          log.actor?.id ||
          'Unknown operator',
        content: note,
        createdAt: log.createdAt,
        id: log.id,
      },
    ];
  });
}

export type BookingExpiryEligibilityInput = {
  readonly status: string;
  readonly closedReason?: string | null;
  readonly closeoutRecoveryPending?: boolean;
  readonly expiresAt?: string | Date | null;
  readonly selectedProviderId?: string | null;
  readonly customerChoiceCandidateCount: number;
  readonly nowMs?: number;
};

export type BookingExpiryEligibility = {
  readonly allowed: boolean;
  readonly reason:
    | 'ALLOWED'
    | 'DEADLINE_NOT_REACHED'
    | 'DEADLINE_UNAVAILABLE'
    | 'FINAL_PARTNER_SELECTED'
    | 'SELECTABLE_CANDIDATE_EXISTS'
    | 'STATUS_NOT_OPEN_MATCHING'
    | 'CLOSEOUT_RECOVERY';
};

export function bookingExpiryEligibility({
  status,
  closedReason,
  closeoutRecoveryPending = false,
  expiresAt,
  selectedProviderId,
  customerChoiceCandidateCount,
  nowMs = Date.now(),
}: BookingExpiryEligibilityInput): BookingExpiryEligibility {
  if (
    status === 'EXPIRED' &&
    closedReason === 'admin_expired' &&
    closeoutRecoveryPending &&
    !selectedProviderId
  ) {
    return { allowed: true, reason: 'CLOSEOUT_RECOVERY' };
  }
  if (status !== 'OPEN_MATCHING') {
    return { allowed: false, reason: 'STATUS_NOT_OPEN_MATCHING' };
  }
  if (selectedProviderId) {
    return { allowed: false, reason: 'FINAL_PARTNER_SELECTED' };
  }

  const deadlineMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  if (!Number.isFinite(deadlineMs)) {
    return { allowed: false, reason: 'DEADLINE_UNAVAILABLE' };
  }
  if (deadlineMs > nowMs) {
    if (customerChoiceCandidateCount > 0) {
      return { allowed: false, reason: 'SELECTABLE_CANDIDATE_EXISTS' };
    }
    return { allowed: false, reason: 'DEADLINE_NOT_REACHED' };
  }

  return { allowed: true, reason: 'ALLOWED' };
}

export function canExpireBooking(input: BookingExpiryEligibilityInput): boolean {
  return bookingExpiryEligibility(input).allowed;
}
import type { AdminAuditLog } from './admin-api';
