import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationActionConfirmation,
  filterNotificationActionConfirmationSupportingLinks,
  legacyReviewNotificationConfirmHref,
  notificationBackgroundJobEvidenceHref,
  readNotificationConfirmationAction,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';

const notification = buildPartialNotification();

describe('notification action confirmation', () => {
  it('fails closed when the operator lacks Notification retry access', () => {
    expect(buildNotificationActionConfirmation([notification], 'retry', {
      notificationId: notification.id,
      pushDeviceId: '',
    })).toBeNull();
  });

  it('shows only unresolved paths, masked identifiers, source context, and a required reason', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      canRetry: true,
      issue: 'failed',
      mode: 'action',
      notificationId: notification.id,
      page: '2',
      pushDeviceId: '',
    });

    expect(confirmation).toMatchObject({
      action: 'retry',
      cancelHref: '/notifications?mode=action&issue=failed&page=2',
      confirmLabel: 'Retry unresolved paths',
      textInputs: [{
        label: 'Retry reason',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: 'Why are the unresolved delivery paths safe to retry?',
        required: true,
      }],
      tone: 'warning',
    });
    expect(confirmation?.description).toContain('Partner request for Linh Partner (Partner).');
    expect(confirmation?.description).toContain('1 failed · 1 accepted · 1 eligible for retry');
    expect(confirmation?.description).toContain('FCM ••••iled FAILED (messaging/internal-error)');
    expect(confirmation?.description).toContain('1 successful path excluded');
    expect(confirmation?.description).not.toContain('push-device-failed');
    expect(confirmation?.description).not.toContain('push-device-accepted');
    expect(confirmation?.supportingLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: '/bookings/booking-1', label: 'Booking' }),
      expect.objectContaining({ href: '/partners/partner-1', label: 'Recipient' }),
      expect.objectContaining({ href: expect.stringContaining('/audit-log?bucket=Notification'), label: 'Audit trail' }),
    ]));
  });

  it('does not offer retry when no eligible target-role path remains', () => {
    const noEligible = {
      ...notification,
      user: {
        ...notification.user,
        pushDevices: notification.user?.pushDevices?.map((device) => ({ ...device, enabled: false })),
      },
    } as AdminNotification;
    expect(buildNotificationActionConfirmation([noEligible], 'retry', {
      canRetry: true,
      notificationId: noEligible.id,
      pushDeviceId: '',
    })).toBeNull();
  });

  it('does not offer retry after every observed delivery path succeeded', () => {
    const accepted = {
      ...notification,
      deliveries: notification.deliveries?.map((delivery) => ({ ...delivery, status: 'SENT' })),
    } as AdminNotification;
    expect(buildNotificationActionConfirmation([accepted], 'retry', {
      canRetry: true,
      notificationId: accepted.id,
      pushDeviceId: '',
    })).toBeNull();
  });

  it('preserves canonical delivery filters in confirmation and cancel URLs', () => {
    const href = retryNotificationConfirmHref('notification 1', {
      channel: 'fcm',
      mode: 'records',
      page: '3',
      q: 'booking 1',
      recipientRole: 'provider',
      status: 'failed',
    });
    expect(href).toBe('/notifications?mode=records&status=failed&recipientRole=provider&channel=fcm&q=booking%201&page=3&confirm=retry&notificationId=notification%201');
  });

  it('keeps Developer/System setup guidance out of ordinary operator confirmation copy', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      canRetry: true,
      notificationId: notification.id,
      pushDeviceId: '',
      review: 'failed',
    });
    expect(confirmation?.supportingLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: '/setup?commands=all#notifications' }),
    ]));
    expect(filterNotificationActionConfirmationSupportingLinks(confirmation, false)?.supportingLinks)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ href: '/setup?commands=all#notifications' })]));
  });

  it('keeps the restricted legacy review route compatible without exposing it as a primary mode', () => {
    const legacy = {
      ...notification,
      data: { jobId: 'job-1', queueName: 'notification-retry' },
      deliveries: [],
      id: 'notification-legacy',
      type: 'admin.system.background_job.failed',
    } as AdminNotification;
    const confirmation = buildNotificationActionConfirmation([legacy], 'review-legacy', {
      notificationId: legacy.id,
      pushDeviceId: '',
    });
    expect(confirmation).toMatchObject({
      action: 'review-legacy',
      textInputs: [expect.objectContaining({ minLength: 12, name: 'reason', required: true })],
    });
    expect(notificationBackgroundJobEvidenceHref(legacy)).toBe(
      '/background-jobs?jobId=job-1&queue=notification-retry&range=ALL&review=ALL',
    );
  });

  it('accepts only supported actions and safely encodes compatibility links', () => {
    expect(readNotificationConfirmationAction('retry')).toBe('retry');
    expect(readNotificationConfirmationAction('review-legacy')).toBe('review-legacy');
    expect(readNotificationConfirmationAction('delete')).toBeNull();
    expect(legacyReviewNotificationConfirmHref('notification 1')).toBe(
      '/notifications?confirm=review-legacy&notificationId=notification%201',
    );
  });
});

function buildPartialNotification() {
  return {
    body: 'A booking request is available.',
    createdAt: '2026-06-01T00:00:00.000Z',
    data: {
      bookingId: 'booking-1',
      retryDecision: {
        evidence: 'Transient failure cooldown passed; successful paths remain excluded.',
        failureClass: 'transient',
        reason: 'The unresolved transient failure is eligible for one controlled retry.',
        state: 'allowed',
      },
      targetRole: 'PROVIDER',
    },
    deliveries: [
      {
        attemptedAt: '2026-06-01T00:03:00.000Z',
        id: 'delivery-failed',
        provider: 'FCM',
        pushDevice: { enabled: true, id: 'push-device-failed', platform: 'ios', role: 'PROVIDER' },
        response: { failureCode: 'messaging/internal-error' },
        status: 'FAILED',
      },
      {
        attemptedAt: '2026-06-01T00:04:00.000Z',
        id: 'delivery-accepted',
        provider: 'FCM',
        pushDevice: { enabled: true, id: 'push-device-accepted', platform: 'android', role: 'PROVIDER' },
        status: 'SENT',
      },
    ],
    id: 'notification-row-123456',
    title: 'Partner request',
    type: 'booking.requested',
    user: {
      fullName: 'Linh Nguyen',
      id: 'user-1',
      providerProfile: { displayName: 'Linh Partner', id: 'partner-1' },
      pushDevices: [
        { enabled: true, id: 'push-device-failed', platform: 'ios', role: 'PROVIDER' },
        { enabled: true, id: 'push-device-accepted', platform: 'android', role: 'PROVIDER' },
      ],
      roles: ['PROVIDER'],
    },
  } as AdminNotification;
}
