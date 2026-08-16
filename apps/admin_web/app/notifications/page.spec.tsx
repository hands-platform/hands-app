import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Notification Delivery page contract', () => {
  const source = readFileSync(join(process.cwd(), 'app/notifications/page.tsx'), 'utf8');

  it('uses one delivery workspace with exactly two primary modes', () => {
    expect(source).toContain('title="Notification Delivery"');
    expect(source).toContain('Review unresolved mobile send issues and inspect delivery records.');
    expect(source).toContain("buildNotificationDeliveryHref(view, { mode: 'action', page: 1 })");
    expect(source).toContain("buildNotificationDeliveryHref(view, { mode: 'records', page: 1 })");
    expect(source).not.toContain('Current incidents');
    expect(source).not.toContain('Historical cleanup');
    expect(source).not.toContain('NotificationFilterBoardSection');
  });

  it('keeps failure groups selected and exposes the four recovery queues', () => {
    expect(source).toContain("issue: 'groups'");
    expect(source).toContain("label: 'Failure groups'");
    expect(source).toContain("{ issue: 'failed', label: 'Failed'");
    expect(source).toContain("{ issue: 'no-attempt', label: 'No send attempt after 15m'");
    expect(source).toContain("issue: 'no-route'");
    expect(source).toContain("label: 'No active push route'");
    expect(source).toContain("{ issue: 'stale-route', label: 'App route needs refresh'");
    expect(source).toContain("return 'Open failure groups'");
    expect(source).not.toContain('System incidents');
    expect(source).not.toContain('Finance overdue');
    expect(source).toContain("view.scope === 'history'");
    expect(source).toContain('summary?.historicalDeliveryIncidentCount');
    expect(source).toContain('notificationFailureCodeLabel(view.failureCode)');
    expect(source).toContain('option.count.toLocaleString()');
    expect(source).toContain('summary.noPushPathRecipientCount.toLocaleString()');
    expect(source).toContain("view.issue === 'groups' || view.issue === option.issue");
  });

  it('keeps record filters compact and truthful about provider acceptance', () => {
    for (const label of ['Search', 'Recipient role', 'Channel', 'Send status', 'Date', 'Sort']) {
      expect(source).toContain(`label="${label}"`);
    }
    expect(source).toContain("{ label: 'Accepted by FCM', value: 'accepted' }");
    expect(source).toContain('FCM acceptance is push service acknowledgement, not proof that the device received or opened');
    expect(source).not.toContain('Push delivered');
  });

  it('separates read access from explicit retry access', () => {
    expect(source).toContain("hasAdminOperatorCategory(operatorAccess, 'NOTIFICATIONS_RETRY')");
    expect(source).toContain('canRetry,');
    expect(source).toContain('filterNotificationActionConfirmationSupportingLinks');
    expect(source).toContain('canViewAdminDeveloperSystem(operatorAccess)');
  });

  it('distinguishes unavailable records and summary from true empty results', () => {
    expect(source).toContain('adminGetResult<AdminNotification[]>');
    expect(source).toContain('adminGetResult<AdminNotificationBoardSummary | null>');
    expect(source).toContain('Notification records unavailable');
    expect(source).toContain('No empty queue is shown while the record source is unavailable.');
    expect(source).toContain('Notification summary unavailable');
    expect(source).toContain('No delivery records match these filters.');
    expect(source).toContain('No delivery records exist for this period.');
  });

  it('canonicalizes invalid and out-of-range pages without losing independent filters', () => {
    expect(source).toContain("if (rawPage && (!/^\\d+$/.test(rawPage) || Number(rawPage) < 1))");
    expect(source).toContain('view.page > model.notificationPagination.totalPages');
    expect(source).toContain('buildNotificationDeliveryHref(view, { page: model.notificationPagination.totalPages })');
    expect(source).toContain('hrefForPage={(page) => buildNotificationDeliveryHref(view, { page })}');
  });

  it('shows honest scope, Vietnam time, refresh, and boundary state', () => {
    expect(source).toContain('Current · under 24h');
    expect(source).toContain('24h+ history');
    expect(source).toContain('All ages');
    expect(source).toContain('Asia/Ho_Chi_Minh');
    expect(source).toContain('NotificationRefreshButton');
    expect(source).toContain('Explicit production records');
    expect(source).toContain('Unknown source backlog');
    expect(source).toContain('Synthetic test records');
    expect(source).toContain('Applied notification record filters');
    expect(source).toContain('Clear record filters');
    expect(source).toContain('notificationRecordFilterLabels');
    expect(source).not.toContain('Scope unverified');
    expect(source).not.toContain('All delivery paths healthy');
  });
});
