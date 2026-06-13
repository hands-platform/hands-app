import { buildAuditCommandBoard, buildAuditLogTableRows } from './page';

describe('audit log page model', () => {
  it('links notification retry audit rows to the notification board anchor', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          latestDelivery: {
            provider: 'FCM',
            pushDeviceEnabled: true,
            pushDevicePlatform: 'android',
            status: 'SENT',
          },
          notificationId: 'notification-123456',
          retryJob: { attempts: 3, backoffMs: 5000, jobName: 'notification-send' },
          retryAlreadyDelivered: true,
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Notification / Retry',
      bucketLabel: 'Notification',
      opsDetail: 'Retry events should line up with FCM delivery status, token freshness, and audit evidence.',
      relatedBoardHref: '/notifications?review=fcm#notification-123456',
      relatedBoardLabel: 'notification board',
      targetLabel: 'notification:notification-123456',
    });
    expect(rows[0]?.metadataHighlights).toEqual([
      { className: 'pill pill-info', label: 'Already delivered before retry' },
      { className: 'pill pill-info', label: 'Queued notification-send' },
      { className: 'pill pill-success', label: 'Latest FCM SENT' },
      { className: 'pill pill-info', label: 'Device android' },
      { className: 'pill pill-success', label: 'Device enabled' },
    ]);
  });

  it('highlights notification retry failure codes for audit review', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          latestDelivery: {
            failureCode: 'messaging/mismatched-credential',
            provider: 'FCM',
            pushDeviceEnabled: true,
            pushDevicePlatform: 'android',
            status: 'FAILED',
          },
          notificationId: 'notification-123456',
          retryJob: { attempts: 3, backoffMs: 5000, jobName: 'notification-send' },
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      relatedBoardHref: '/notifications?review=failed#notification-123456',
    });
    expect(rows[0]?.metadataHighlights).toEqual([
      { className: 'pill pill-info', label: 'Queued notification-send' },
      { className: 'pill pill-warn', label: 'Latest FCM FAILED' },
      { className: 'pill pill-info', label: 'Device android' },
      { className: 'pill pill-warn', label: 'Firebase project mismatch' },
      { className: 'pill pill-warn', label: 'Next install matching Firebase Admin JSON' },
      { className: 'pill pill-success', label: 'Device enabled' },
    ]);
  });

  it('adds notification audit records to the command board', () => {
    const board = buildAuditCommandBoard(
      [
        {
          action: 'notification.retry',
          actor: { fullName: 'Operator One', phone: '+8490' },
          createdAt: new Date().toISOString(),
          id: 'audit-1',
          metadata: { notificationId: 'notification-123456' },
          target: 'notification:notification-123456',
        },
      ],
      '7d',
    );

    expect(board).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/audit-log?bucket=Notification&range=7d',
          logs: [
            expect.objectContaining({
              actionLabel: 'Notification / Retry',
              shortTargetLabel: 'notification:notifica',
            }),
          ],
          status: 'Alerts',
          title: 'Notification delivery trail',
          tone: 'info',
        }),
      ]),
    );
  });
});
