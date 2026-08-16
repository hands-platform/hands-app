import {
  adminNotificationDispositionCountQuery,
  adminNotificationDispositionPageQuery,
  adminNotificationIncidentPageQuery,
  adminNotificationIncidentSummaryQuery,
  adminNotificationRetryCountQuery,
  adminNotificationRetryPageQuery,
  normalizeAdminNotificationFailureCode,
  normalizeAdminNotificationFailureProvider,
} from './admin-notification-retry-query';

describe('admin notification retry queries', () => {
  it('selects notifications whose latest delivery per device is failed', () => {
    const query = adminNotificationRetryPageQuery(
      {
        booking: 'booking-1',
        from: '2026-07-01T00:00:00.000Z',
        sort: 'oldest',
        to: '2026-07-02T00:00:00.000Z',
        user: 'user-1',
      },
      10,
      20,
    );
    const sql = query.strings.join(' ');

    expect(sql).toContain(
      'DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")',
    );
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'production'");
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'synthetic'");
    expect(sql).toContain("notification.data->>'smokeFixture'");
    expect(sql).not.toContain("LOWER(notification.id) NOT LIKE 'smoke%'");
    expect(sql).toContain('delivery_state."hasFailed"');
    expect(sql).toContain('disposition_notifications."createdAt"');
    expect(query.values).toEqual(expect.arrayContaining([
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-02T00:00:00.000Z'),
      'booking-1',
      'user-1',
      10,
      20,
    ]));
  });

  it('uses the same device-level retry predicate for summary counts', () => {
    const query = adminNotificationRetryCountQuery({});
    const sql = query.strings.join(' ');

    expect(sql).toContain(
      'DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")',
    );
    expect(sql).toContain('COUNT(*)::integer AS count');
  });

  it('selects only fully delivered or currently skipped notifications', () => {
    const deliveredSql = adminNotificationDispositionPageQuery(
      {},
      'delivered',
      10,
      0,
    ).strings.join(' ');
    const skippedSql = adminNotificationDispositionCountQuery({}, 'skipped').strings.join(' ');

    expect(deliveredSql).toContain(
      'delivery_state."hasSent" AND NOT delivery_state."hasFailed"',
    );
    expect(skippedSql).toContain('AND delivery_state."hasSkipped"');
    expect(skippedSql).toContain('NOT delivery_state."hasSent"');
    expect(skippedSql).toContain('NOT delivery_state."hasFailed"');
  });

  it('rejects invalid and reversed date ranges', () => {
    expect(() => adminNotificationRetryCountQuery({ from: 'invalid' })).toThrow(
      'Notification date range is invalid',
    );
    expect(() =>
      adminNotificationRetryCountQuery({
        from: '2026-07-02T00:00:00.000Z',
        to: '2026-07-01T00:00:00.000Z',
      }),
    ).toThrow('Notification date range is invalid');
  });

  it('groups current failures by provider and failure code without splitting continuous failures into time buckets', () => {
    const cutoff = new Date('2026-08-04T08:00:00.000Z');
    const query = adminNotificationIncidentPageQuery({}, 'current', 60, cutoff, 10, 0);
    const sql = query.strings.join(' ');

    expect(sql).toContain('GROUP BY failed_paths.provider, failed_paths."failureCode"');
    expect(sql).not.toContain('windowBucket');
    expect(sql).toContain('COUNT(DISTINCT failed_paths.id)::integer AS "notificationCount"');
    expect(sql).toContain('COUNT(DISTINCT failed_paths."userId")::integer AS "affectedUserCount"');
    expect(sql).toContain('latest_delivery."attemptedAt" >');
    expect(sql).toContain("latest_delivery.status = 'FAILED'");
    expect(query.values).toEqual(expect.arrayContaining([cutoff, 10, 0]));
    expect(query.values).not.toContain(3600);
  });

  it('keeps failures older than 24 hours in historical incident counts', () => {
    const cutoff = new Date('2026-08-04T08:00:00.000Z');
    const query = adminNotificationIncidentSummaryQuery({}, 'historical', 60, cutoff);
    const sql = query.strings.join(' ');

    expect(sql).toContain('latest_delivery."attemptedAt" <');
    expect(sql).toContain('COUNT(*)::integer AS "incidentCount"');
    expect(sql).toContain('COALESCE(SUM(grouped."notificationCount"), 0)::integer');
    expect(query.values).toContain(cutoff);
  });

  it('uses the same exact provider and normalized failure code for group and failed-record queries', () => {
    const options = {
      failureCode: 'messaging/mismatched-credential',
      failureProvider: 'FCM',
      scope: 'current',
    };
    const groupQuery = adminNotificationIncidentPageQuery(
      options,
      'current',
      60,
      new Date('2026-08-04T08:00:00.000Z'),
      10,
      0,
    );
    const failedQuery = adminNotificationRetryPageQuery(options, 10, 0);

    expect(groupQuery.values).toEqual(expect.arrayContaining(['FCM', 'messaging/mismatched-credential']));
    expect(failedQuery.strings.join(' ')).toContain('exact_delivery.status = \'FAILED\'');
    expect(failedQuery.values).toEqual(expect.arrayContaining(['FCM', 'messaging/mismatched-credential']));
    expect(normalizeAdminNotificationFailureProvider('fcm')).toBe('FCM');
    expect(normalizeAdminNotificationFailureCode('messaging/mismatched-credential')).toBe(
      'messaging/mismatched-credential',
    );
    expect(normalizeAdminNotificationFailureProvider('fcm_http_v1')).toBe('FCM_HTTP_V1');
    expect(normalizeAdminNotificationFailureProvider('onesignal')).toBe('ONESIGNAL');
    expect(normalizeAdminNotificationFailureCode('OneSignal: invalid player id')).toBe(
      'OneSignal: invalid player id',
    );
  });

  it('rejects unsupported provider and failure-code filters', () => {
    expect(() => adminNotificationRetryCountQuery({ failureProvider: `FCM\nHTTP` })).toThrow(
      'Notification failure provider is invalid',
    );
    expect(() => adminNotificationRetryCountQuery({ failureCode: `bad\u0000code` })).toThrow(
      'Notification failure code is invalid',
    );
  });
});
