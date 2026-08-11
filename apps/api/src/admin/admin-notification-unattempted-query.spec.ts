import {
  ADMIN_NOTIFICATION_DELIVERY_GAP_MINUTES,
  adminNotificationUnattemptedCountQuery,
  adminNotificationUnattemptedPageQuery,
  adminNotificationUnattemptedSummaryQuery,
  adminNotificationRouteGroupCountQuery,
  adminNotificationRouteGroupPageQuery,
} from './admin-notification-unattempted-query';

describe('admin notification unattempted queries', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');

  it('finds aged notifications with an enabled target-role device as delivery gaps', () => {
    const query = adminNotificationUnattemptedPageQuery(
      {
        booking: 'booking-1',
        from: '2026-07-01T00:00:00.000Z',
        sort: 'oldest',
        to: '2026-07-25T00:00:00.000Z',
        user: 'user-1',
      },
      'delivery-gap',
      10,
      20,
      now,
    );
    const sql = query.strings.join(' ');

    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'production'");
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'synthetic'");
    expect(sql).toContain("notification.data->>'smokeFixture'");
    expect(sql).not.toContain("LOWER(notification.id) NOT LIKE 'smoke%'");
    expect(sql).toContain('"hasEnabledTargetDevice"');
    expect(sql).toContain('device.role::text');
    expect(sql).toContain('notification.data->>\'targetRole\'');
    expect(query.values).toEqual(expect.arrayContaining([
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-25T00:00:00.000Z'),
      'booking-1',
      'user-1',
      new Date(now.getTime() - ADMIN_NOTIFICATION_DELIVERY_GAP_MINUTES * 60 * 1000),
      10,
      20,
    ]));
  });

  it('separates recent worker waits and users without an enabled target device', () => {
    const awaitingSql = adminNotificationUnattemptedCountQuery(
      {},
      'awaiting-worker',
      now,
    ).strings.join(' ');
    const noPushSql = adminNotificationUnattemptedCountQuery(
      {},
      'no-push-path',
      now,
    ).strings.join(' ');

    expect(awaitingSql).toContain('"hasEnabledTargetDevice"');
    expect(awaitingSql).toContain('"createdAt" >');
    expect(noPushSql).toContain('NOT unattempted."hasEnabledTargetDevice"');
  });

  it('keeps an unattempted history query without treating it as a worker failure', () => {
    const sql = adminNotificationUnattemptedCountQuery(
      {},
      'unattempted',
      now,
    ).strings.join(' ');

    expect(sql).toContain('WHERE TRUE');
    expect(sql).toContain('"NotificationDelivery"');
  });

  it('aggregates the mutually exclusive operational buckets in one query', () => {
    const sql = adminNotificationUnattemptedSummaryQuery({}, now).strings.join(' ');

    expect(sql).toContain('AS "deliveryGaps"');
    expect(sql).toContain('AS "awaitingWorker"');
    expect(sql).toContain('AS "noPushPath"');
    expect(sql).toContain('AS "noPushPathRecipientCount"');
    expect(sql).toContain('AS "noPushPathNotificationCount"');
    expect(sql).toContain('AS unattempted');
  });

  it('pages missing push routes by unique recipient and target role', () => {
    const query = adminNotificationRouteGroupPageQuery({ scope: 'current' }, 10, 0, now);
    const sql = query.strings.join(' ');

    expect(sql).toContain('GROUP BY no_push_path_notifications."userId", no_push_path_notifications."targetRole"');
    expect(sql).toContain('COUNT(*)::integer AS "notificationCount"');
    expect(sql).toContain('MIN(no_push_path_notifications."createdAt") AS "firstOccurredAt"');
    expect(sql).toContain('MAX(no_push_path_notifications."createdAt") AS "latestOccurredAt"');
    expect(adminNotificationRouteGroupCountQuery({ scope: 'history' }, now).strings.join(' '))
      .toContain('GROUP BY no_push_path_notifications."userId", no_push_path_notifications."targetRole"');
  });

  it('rejects invalid and reversed date ranges', () => {
    expect(() =>
      adminNotificationUnattemptedCountQuery({ from: 'invalid' }, 'delivery-gap', now),
    ).toThrow('Notification date range is invalid');
    expect(() =>
      adminNotificationUnattemptedCountQuery(
        {
          from: '2026-07-25T00:00:00.000Z',
          to: '2026-07-24T00:00:00.000Z',
        },
        'delivery-gap',
        now,
      ),
    ).toThrow('Notification date range is invalid');
  });
});
