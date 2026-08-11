import type { AdminNotification } from './admin-api';
import {
  formatFcmSentDeliveryDetail,
  humanizeNotificationType,
  latestFcmSentNotificationDelivery,
  notificationDeliveryDisposition,
} from './admin-notification-delivery';

describe('admin notification delivery helpers', () => {
  it('selects the newest FCM SENT delivery across notifications', () => {
    const newest = latestFcmSentNotificationDelivery([
      notificationFixture({
        id: 'customer-notification',
        attemptedAt: '2026-06-13T09:02:00.000Z',
        phone: '+84900000001',
        role: 'CUSTOMER',
      }),
      notificationFixture({
        id: 'partner-notification',
        attemptedAt: '2026-06-13T09:05:00.000Z',
        phone: '+84900000002',
        role: 'PROVIDER',
      }),
      notificationFixture({
        id: 'failed-notification',
        attemptedAt: '2026-06-13T09:08:00.000Z',
        phone: '+84900000003',
        role: 'CUSTOMER',
        status: 'FAILED',
      }),
    ]);

    expect(newest?.notification.id).toBe('partner-notification');
    expect(newest?.delivery.attemptedAt).toBe('2026-06-13T09:05:00.000Z');
  });

  it('formats FCM SENT delivery detail with visible Partner copy', () => {
    const notification = notificationFixture({
      id: 'notification-partner',
      attemptedAt: '2026-06-13T09:05:00.000Z',
      phone: '+84900000002',
      role: 'PROVIDER',
    });
    const delivery = notification.deliveries?.[0];

    expect(delivery ? formatFcmSentDeliveryDetail(notification, delivery) : '').toBe(
      'Partner +84900000002 / android / Booking Matched notifica / device push-dev',
    );
  });

  it('humanizes notification types consistently for FCM summaries', () => {
    expect(humanizeNotificationType('booking.backup_available')).toBe('Booking Marketplace Available');
  });

  it('treats a later success on the same device as fully delivered', () => {
    const notification = notificationFixture({
      id: 'recovered-notification',
      attemptedAt: '2026-06-13T09:05:00.000Z',
      phone: '+84900000002',
      role: 'PROVIDER',
    });
    notification.deliveries = [
      {
        ...notification.deliveries?.[0],
        attemptedAt: '2026-06-13T09:04:00.000Z',
        id: 'failed-attempt',
        provider: 'FCM',
        status: 'FAILED',
      },
      {
        ...notification.deliveries?.[0],
        attemptedAt: '2026-06-13T09:05:00.000Z',
        id: 'sent-attempt',
        provider: 'FCM',
        status: 'SENT',
      },
    ];

    expect(notificationDeliveryDisposition(notification)).toBe('delivered');
  });

  it('keeps unresolved failures on a second device visible as partial delivery', () => {
    const notification = notificationFixture({
      id: 'partial-notification',
      attemptedAt: '2026-06-13T09:05:00.000Z',
      phone: '+84900000002',
      role: 'PROVIDER',
    });
    notification.deliveries = [
      {
        ...notification.deliveries?.[0],
        attemptedAt: '2026-06-13T09:04:00.000Z',
        id: 'failed-device-attempt',
        provider: 'FCM',
        pushDevice: { enabled: true, id: 'failed-device', platform: 'ios', role: 'PROVIDER' },
        status: 'FAILED',
      },
      {
        ...notification.deliveries?.[0],
        attemptedAt: '2026-06-13T09:05:00.000Z',
        id: 'sent-device-attempt',
        provider: 'FCM',
        pushDevice: { enabled: true, id: 'sent-device', platform: 'android', role: 'PROVIDER' },
        status: 'SENT',
      },
    ];

    expect(notificationDeliveryDisposition(notification)).toBe('partial');
  });
});

function notificationFixture(input: {
  readonly attemptedAt: string;
  readonly id: string;
  readonly phone: string;
  readonly role: 'CUSTOMER' | 'PROVIDER';
  readonly status?: string;
}): AdminNotification {
  return {
    body: 'Body',
    createdAt: input.attemptedAt,
    deliveries: [
      {
        attemptedAt: input.attemptedAt,
        id: `${input.id}-delivery`,
        provider: 'FCM',
        pushDevice: {
          enabled: true,
          id: 'push-device-1',
          platform: 'android',
          role: input.role,
        },
        status: input.status ?? 'SENT',
      },
    ],
    id: input.id,
    title: 'Title',
    type: 'booking.matched',
    user: {
      phone: input.phone,
      providerProfile: input.role === 'PROVIDER' ? { id: 'provider-profile-1' } : null,
      roles: [input.role],
    },
  };
}
