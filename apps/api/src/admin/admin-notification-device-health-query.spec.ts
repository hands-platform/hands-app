import {
  ADMIN_NOTIFICATION_STALE_DEVICE_AGE_DAYS,
  adminNotificationDeviceHealthSummaryQuery,
} from './admin-notification-device-health-query';

describe('admin notification device health query', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');

  it('counts unique disabled and stale devices with affected users for the intended role', () => {
    const query = adminNotificationDeviceHealthSummaryQuery(
      {
        booking: 'booking-1',
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-25T00:00:00.000Z',
        user: 'user-1',
      },
      now,
    );
    const sql = query.strings.join(' ');

    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'production'");
    expect(sql).toContain("COALESCE(notification.data->>'dataScope', '')) = 'synthetic'");
    expect(sql).toContain("notification.data->>'smokeFixture'");
    expect(sql).not.toContain("LOWER(notification.id) NOT LIKE 'smoke%'");
    expect(sql).toContain('notification.data->>\'targetRole\'');
    expect(sql).toContain('device.role::text = target."targetRole"');
    expect(sql).toContain('AS "disabledDevices"');
    expect(sql).toContain('AS "disabledDeviceUsers"');
    expect(sql).toContain('AS "staleDevices"');
    expect(sql).toContain('AS "staleDeviceUsers"');
    expect(sql).toContain('"lastSeenAt" <=');
    expect(query.values).toEqual(expect.arrayContaining([
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-25T00:00:00.000Z'),
      'booking-1',
      'user-1',
      new Date(
        now.getTime() - ADMIN_NOTIFICATION_STALE_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000,
      ),
    ]));
  });

  it('rejects invalid and reversed date ranges', () => {
    expect(() =>
      adminNotificationDeviceHealthSummaryQuery({ from: 'invalid' }, now),
    ).toThrow('Notification date range is invalid');
    expect(() =>
      adminNotificationDeviceHealthSummaryQuery(
        {
          from: '2026-07-25T00:00:00.000Z',
          to: '2026-07-24T00:00:00.000Z',
        },
        now,
      ),
    ).toThrow('Notification date range is invalid');
  });
});
