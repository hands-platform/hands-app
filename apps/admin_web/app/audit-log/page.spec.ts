import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminAuditLog } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import AuditLogPage, { buildAuditLogTableRows } from './page-content';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('audit log page model', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders the bounded server page rows without applying a second local date filter', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/audit-logs/summary')) {
        return {
          dispatch: 77,
          financeCloseout: 44,
          generatedAt: '2026-06-28T00:00:00.000Z',
          needsReview: 33,
          notifications: 22,
          payments: 55,
          recentHour: 11,
          servicePricing: 66,
          totalCount: 125,
        };
      }

      if (href.startsWith('/admin/audit-logs')) {
        return [
          {
            action: 'booking.completed',
            actor: { fullName: 'Operator One' },
            createdAt: '2026-06-01T09:00:00.000Z',
            id: 'audit-server-page-row',
            metadata: { bookingId: 'booking-1' },
            target: 'booking:booking-1',
          },
        ];
      }

      return fallback;
    });

    const page = await AuditLogPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('booking:booking-1');
    expect(markup).toContain('Showing 1 of 125 events');
    expect(markup).toContain('>77<');
    expect(markup).toContain('>55<');
    expect(markup).toContain('>66<');
    expect(markup).toContain('>22<');
    expect(markup).toContain('>33<');
    expect(markup).toContain('>11<');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-search admin-form-control-labeled admin-directory-filter-search');
    expect(markup).toContain('admin-form-select admin-form-control-labeled admin-directory-filter-select');
    expect(markup).not.toContain('calendar-field');
    expect(markup).toContain('admin-form-control-button button button-primary');
    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('Operational trail');
    expect(markup).not.toContain('<div class="calendar-field"><span>Search</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Date range</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Bucket</span>');
    expect(markup).toContain('card admin-section vuexy-booking-table-card vuexy-booking-table-group');
  });

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
        { label: 'FCM sent evidence', tone: 'success' },
        { label: 'Latest FCM SENT', tone: 'success' },
        { label: 'Device enabled', tone: 'success' },
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
        { label: 'FCM failure evidence', tone: 'warning' },
        { label: 'Latest FCM FAILED', tone: 'warning' },
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
