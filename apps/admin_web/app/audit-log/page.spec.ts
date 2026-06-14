import type { AdminAuditLog } from '../../lib/admin-api';
import { buildAuditLogTableRows } from './page';

describe('audit log page model', () => {
  it('surfaces FCM sent evidence for notification retry audit rows', () => {
    const [row] = buildAuditLogTableRows([
      notificationRetryLog({
        id: 'audit-sent',
        notificationId: 'notification-sent',
        status: 'SENT',
      }),
    ]);

    expect(row.relatedBoardHref).toBe('/notifications?review=fcm#notification-sent');
    expect(row.relatedBoardLabel).toBe('Notification board');
    expect(row.metadataHighlights).toEqual(
      expect.arrayContaining([
        { className: 'pill pill-success', label: 'FCM sent evidence' },
        { className: 'pill pill-success', label: 'Latest FCM SENT' },
        { className: 'pill pill-success', label: 'Device enabled' },
      ]),
    );
  });

  it('surfaces FCM failure evidence for notification retry audit rows', () => {
    const [row] = buildAuditLogTableRows([
      notificationRetryLog({
        id: 'audit-failed',
        notificationId: 'notification-failed',
        status: 'FAILED',
      }),
    ]);

    expect(row.relatedBoardHref).toBe('/notifications?review=failed#notification-failed');
    expect(row.metadataHighlights).toEqual(
      expect.arrayContaining([
        { className: 'pill pill-warn', label: 'FCM failure evidence' },
        { className: 'pill pill-warn', label: 'Latest FCM FAILED' },
      ]),
    );
  });
});

function notificationRetryLog(input: {
  readonly id: string;
  readonly notificationId: string;
  readonly status: 'SENT' | 'FAILED';
}): AdminAuditLog {
  return {
    action: 'notification.retry',
    actor: { fullName: 'Operator One' },
    createdAt: '2026-06-13T09:05:00.000Z',
    id: input.id,
    metadata: {
      latestDelivery: {
        provider: 'FCM',
        pushDeviceEnabled: true,
        pushDevicePlatform: 'android',
        status: input.status,
      },
      notificationId: input.notificationId,
      retryJob: {
        jobName: 'notification-retry',
      },
    },
    target: `notification:${input.notificationId}`,
  };
}
