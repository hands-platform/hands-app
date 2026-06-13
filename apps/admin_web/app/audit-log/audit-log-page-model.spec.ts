import { buildAuditCommandBoard, buildAuditLogTableRows } from './page';

describe('audit log page model', () => {
  it('links notification retry audit rows to the notification board anchor', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: { notificationId: 'notification-123456' },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Notification / Retry',
      bucketLabel: 'Notification',
      relatedBoardHref: '/notifications#notification-123456',
      relatedBoardLabel: 'notification board',
      targetLabel: 'notification:notification-123456',
    });
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
