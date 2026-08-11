import type { AdminNotification } from '../../lib/admin-api';

export type NotificationRetryDecision = {
  readonly evidence?: string;
  readonly failureClass: 'transient' | 'route-recovery' | 'payload-config' | 'unknown';
  readonly reason: string;
  readonly retryAfterAt?: string;
  readonly state: 'allowed' | 'conditional' | 'blocked';
};

export function readNotificationRetryDecision(
  notification: Pick<AdminNotification, 'data'>,
): NotificationRetryDecision {
  const data = readRecord(notification.data);
  const decision = readRecord(data?.retryDecision);
  const state = readString(decision?.state);
  const failureClass = readString(decision?.failureClass);
  if (
    !['allowed', 'conditional', 'blocked'].includes(state ?? '') ||
    !['transient', 'route-recovery', 'payload-config', 'unknown'].includes(failureClass ?? '')
  ) {
    return {
      failureClass: 'unknown',
      reason: 'Server retry eligibility is unavailable. Reload before considering a retry.',
      state: 'blocked',
    };
  }
  return {
    ...(readString(decision?.evidence) ? { evidence: readString(decision?.evidence) as string } : {}),
    failureClass: failureClass as NotificationRetryDecision['failureClass'],
    reason: readString(decision?.reason) ?? 'Retry eligibility requires review.',
    ...(readString(decision?.retryAfterAt)
      ? { retryAfterAt: readString(decision?.retryAfterAt) as string }
      : {}),
    state: state as NotificationRetryDecision['state'],
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
