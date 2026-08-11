import {
  buildAuditCommandBoard,
  buildAuditFilters,
  buildAuditLogApiHref,
  buildAuditLogSummaryApiHref,
  buildAuditLogTableRows,
} from './page-content';

describe('audit log page model', () => {
  it('accepts legacy query links as audit search input', () => {
    expect(buildAuditFilters({ query: 'booking.create.rejected' })).toMatchObject({
      q: 'booking.create.rejected',
      range: 'today',
    });
    expect(buildAuditFilters({ q: 'notification.retry', query: 'booking.create.rejected' })).toMatchObject({
      q: 'notification.retry',
    });
  });

  it('builds bounded audit log API requests from the active filters', () => {
    const href = buildAuditLogApiHref({
      bucket: 'Notification',
      page: '3',
      priority: '4',
      q: 'booking-1',
      range: '7d',
    });
    const url = new URL(href, 'http://admin.local');
    expect(url.pathname).toBe('/admin/audit-logs');
    expect(url.searchParams.get('take')).toBe('20');
    expect(url.searchParams.get('skip')).toBe('40');
    expect(url.searchParams.get('q')).toBe('booking-1');
    expect(url.searchParams.get('bucket')).toBe('Notification');
    expect(url.searchParams.get('priority')).toBe('4');
    expect(Number.isFinite(Date.parse(url.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(url.searchParams.get('to') ?? ''))).toBe(true);

    const summaryHref = buildAuditLogSummaryApiHref({ bucket: 'Notification', q: 'booking-1', range: '7d' });
    const summaryUrl = new URL(summaryHref, 'http://admin.local');
    expect(summaryUrl.pathname).toBe('/admin/audit-logs/summary');
    expect(summaryUrl.searchParams.get('q')).toBe('booking-1');
    expect(summaryUrl.searchParams.get('bucket')).toBe('Notification');
  });

  it('links notification retry audit rows to the notification board anchor', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          latestDelivery: {
            attemptedAt: '2026-06-13T10:23:00.000Z',
            provider: 'FCM',
            pushDeviceEnabled: true,
            pushDeviceId: 'push-device-123456',
            pushDeviceLastSeenAt: '2026-06-13T10:00:00.000Z',
            pushDevicePlatform: 'android',
            status: 'SENT',
          },
          notificationId: 'notification-123456',
          retryJob: { attempts: 3, backoffMs: 5000, jobName: 'notification-send' },
          retryAlreadyDelivered: true,
          retryRisk: 'DUPLICATE_SEND_RISK',
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Notification / Retry',
      bucketLabel: 'Notification',
      opsDetail: 'Retry events should line up with FCM delivery status, token freshness, and audit evidence.',
      relatedBoardHref: '/notifications?review=fcm#notification-123456',
      relatedBoardLabel: 'Notification board',
      targetLabel: 'notification:notification-123456',
    });
    expect(rows[0]?.metadataPreview).toBe(
      'Notification notifica / Duplicate send risk / Latest FCM SENT / Device android push-dev / Device enabled / Queued notification-send',
    );
    expect(rows[0]?.metadataHighlights).toEqual([
      { label: 'Duplicate send risk', tone: 'warning' },
      { label: 'FCM sent evidence', tone: 'success' },
      { label: 'Token freshness evidence', tone: 'success' },
      { label: 'Already delivered before retry', tone: 'info' },
      { label: 'Queued notification-send', tone: 'info' },
      { label: 'Latest FCM SENT', tone: 'success' },
      { label: 'Device android push-dev', tone: 'info' },
      { label: 'Device enabled', tone: 'success' },
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
          retryRisk: 'FAILED_DELIVERY_RETRY',
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      metadataPreview:
        'Notification notifica / Failed delivery retry / Latest FCM FAILED / Failure Firebase project mismatch / Next install matching Firebase Admin JSON / Device android / Device enabled / Queued notification-send',
      relatedBoardHref: '/notifications?review=failed#notification-123456',
    });
    expect(rows[0]?.metadataHighlights).toEqual([
      { label: 'Failed delivery retry', tone: 'warning' },
      { label: 'FCM failure evidence', tone: 'warning' },
      { label: 'Queued notification-send', tone: 'info' },
      { label: 'Latest FCM FAILED', tone: 'warning' },
      { label: 'Device android', tone: 'info' },
      { label: 'Firebase project mismatch', tone: 'warning' },
      { label: 'Next install matching Firebase Admin JSON', tone: 'warning' },
      { label: 'Device enabled', tone: 'success' },
    ]);
  });

  it('highlights retry rows with no delivery evidence for worker review', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          latestDelivery: null,
          notificationId: 'notification-123456',
          retryJob: { attempts: 3, backoffMs: 5000, jobName: 'notification-send' },
          retryRisk: 'NO_DELIVERY_EVIDENCE',
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]?.metadataHighlights).toEqual([
      { label: 'No delivery evidence', tone: 'info' },
      { label: 'Queued notification-send', tone: 'info' },
    ]);
  });

  it('routes stale token retry audit rows to the stale device review queue', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'notification.retry',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          latestDelivery: {
            attemptedAt: '2026-06-13T10:23:00.000Z',
            provider: 'FCM',
            pushDeviceEnabled: true,
            pushDeviceLastSeenAt: '2026-05-01T10:23:00.000Z',
            pushDevicePlatform: 'android',
            status: 'SENT',
          },
          notificationId: 'notification-123456',
          retryAlreadyDelivered: true,
          retryJob: { attempts: 3, backoffMs: 5000, jobName: 'notification-send' },
          retryRisk: 'STALE_PUSH_TOKEN',
        },
        target: 'notification:notification-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      relatedBoardHref: '/notifications?review=stale-device#notification-123456',
    });
    expect(rows[0]?.metadataHighlights).toEqual([
      { label: 'Stale token retry', tone: 'warning' },
      { label: 'FCM sent evidence', tone: 'success' },
      { label: 'Stale token evidence', tone: 'warning' },
      { label: 'Already delivered before retry', tone: 'info' },
      { label: 'Queued notification-send', tone: 'info' },
      { label: 'Latest FCM SENT', tone: 'success' },
      { label: 'Device android', tone: 'info' },
      { label: 'Device enabled', tone: 'success' },
    ]);
  });

  it('classifies push device recovery audit rows with notification delivery trail links', () => {
    const rows = buildAuditLogTableRows([
      {
        action: 'push_device.enable',
        actor: { fullName: 'Operator One', phone: '+8490' },
        createdAt: '2026-06-11T09:00:00.000Z',
        id: 'audit-1',
        metadata: {
          platform: 'android',
          pushDeviceId: 'push-device-123456',
          userId: 'user-1',
        },
        target: 'push_device:push-device-123456',
      },
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Push device / Enable',
      bucketLabel: 'Notification',
      opsDetail:
        'Device recovery events should line up with a fresh token or operator-confirmed delivery recovery.',
      opsHint: 'Check push token freshness and alert delivery status before re-enabling alerts.',
      relatedBoardHref: '/notifications?review=disabled-device',
      relatedBoardLabel: 'Notification board',
    });
  });

  it('links public website structure changes back to Website Content', () => {
    const [row] = buildAuditLogTableRows([
      {
        action: 'PUBLIC_SITE_SECTION_UPDATED',
        actor: { fullName: 'Master Admin' },
        createdAt: '2026-07-30T00:00:00.000Z',
        id: 'audit-site-section',
        metadata: {
          enabled: true,
          key: 'partner-directory',
          kind: 'PARTNER_DIRECTORY',
          sortOrder: 20,
        },
        target: 'public_site_page:page-1',
      },
    ]);

    expect(row).toMatchObject({
      actionLabel: 'Website content / Section updated',
      relatedBoardHref: '/website-content',
      relatedBoardLabel: 'Website Content',
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

  it('adds push device recovery records to the notification command board', () => {
    const board = buildAuditCommandBoard(
      [
        {
          action: 'push_device.enable',
          actor: { fullName: 'Operator One', phone: '+8490' },
          createdAt: new Date().toISOString(),
          id: 'audit-1',
          metadata: { pushDeviceId: 'push-device-123456' },
          target: 'push_device:push-device-123456',
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
              actionLabel: 'Push device / Enable',
              shortTargetLabel: 'push_device:push-dev',
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
