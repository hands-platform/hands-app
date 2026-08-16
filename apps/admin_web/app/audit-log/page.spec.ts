import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminAuditEventView, AdminAuditWorkspaceResponse } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import AuditLogPage from './page-content';

vi.mock('../../lib/admin-api', async () => ({
  ...(await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api')),
  adminGetResult: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('AuditLogPage', () => {
  beforeEach(() => mockedAdminGetResult.mockReset());

  it('renders a single server snapshot with trust, saved views, filters and evidence rows', async () => {
    mockedAdminGetResult.mockResolvedValue(ok(workspace([eventFixture()])) as never);

    const markup = renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve({}) }));

    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(String(mockedAdminGetResult.mock.calls[0]?.[0])).toContain('/admin/audit-logs/page?');
    expect(String(mockedAdminGetResult.mock.calls[0]?.[0])).toContain('take=50');
    expect(markup).toContain('Audit source available');
    expect(markup).toContain('Review required');
    expect(markup).toContain('Operator changes');
    expect(markup).toContain('Booking completed');
    expect(markup).toContain('Showing 1 of 1 events in this snapshot');
    expect(markup).toContain('Evidence');
    expect(markup).toContain('Asia/Ho_Chi_Minh');
  });

  it('does not present an unavailable source as an empty audit log', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: workspace([]),
      error: 'upstream unavailable',
      ok: false,
      requestId: 'request-audit-1',
      status: 503,
    } as never);

    const markup = renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Audit data unavailable');
    expect(markup).toContain('This is not an empty result.');
    expect(markup).toContain('request-audit-1');
    expect(markup).not.toContain('Showing 0 of 0 events');
  });

  it('distinguishes permission denial from source failure', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: workspace([]), error: 'forbidden', ok: false, status: 403 } as never);

    const markup = renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Audit access denied');
    expect(markup).toContain('cannot read audit evidence');
  });

  it('renders a notification-specific empty state with a return path', async () => {
    mockedAdminGetResult.mockResolvedValue(ok(workspace([])) as never);

    const markup = renderToStaticMarkup(await AuditLogPage({
      searchParams: Promise.resolve({ bucket: 'Notification', q: 'notification-empty', range: 'all' }),
    }));

    expect(markup).toContain('No audit events have been recorded for this notification.');
    expect(markup).toContain('Back to Notification Delivery');
    expect(markup).toContain('/notifications?mode=records&amp;range=all&amp;q=notification-empty');
    expect(markup).not.toContain('No events match these filters.');
  });

  it('renders and enforces the Operations / Policy investigation scope', async () => {
    mockedAdminGetResult
      .mockResolvedValueOnce(ok(workspace([eventFixture()])) as never)
      .mockResolvedValueOnce({ data: null, ok: false, status: 404 } as never);

    const markup = renderToStaticMarkup(await AuditLogPage({
      searchParams: Promise.resolve({ bucket: 'Operations/Policy', event: 'event-1', range: 'all', sort: 'newest' }),
    }));

    expect(String(mockedAdminGetResult.mock.calls[0]?.[0])).toContain('bucket=Operations%2FPolicy');
    expect(mockedAdminGetResult.mock.calls[1]?.[0]).toBe('/admin/audit-logs/events/event-1?bucket=Operations%2FPolicy');
    expect(markup).toContain('Scope: Operations / Policy');
    expect(markup).toContain('Clear refinements');
    expect(markup).toContain('Exit policy scope');
    expect(markup).toContain('bucket=Operations%2FPolicy');
  });
});

function ok<T>(data: T) {
  return { data, ok: true, status: 200 } as const;
}

function workspace(items: AdminAuditEventView[]): AdminAuditWorkspaceResponse {
  return {
    actionableIncidents: [],
    cursor: { next: null },
    facets: {
      actorTypes: [{ count: 1, value: 'HUMAN' }],
      areas: [{ count: 1, value: 'BOOKING' }],
      outcomes: [{ count: 1, value: 'SUCCEEDED' }],
      severities: [{ count: 1, value: 'NOTICE' }],
    },
    generatedAt: '2026-08-12T03:00:00.000Z',
    items,
    savedViews: [
      { count: 0, key: 'REVIEW_REQUIRED', label: 'Review required' },
      { count: 1, key: 'OPERATOR_CHANGES', label: 'Operator changes' },
      { count: 0, key: 'MONEY_POLICY', label: 'Money & policy' },
      { count: 0, key: 'SECURITY_ACCESS', label: 'Security & access' },
      { count: 0, key: 'SYSTEM_INCIDENTS', label: 'System incidents' },
      { count: 1, key: 'ALL', label: 'All events' },
    ],
    source: { dataLagSeconds: 12, lastRecordedAt: '2026-08-12T02:59:48.000Z', state: 'AVAILABLE' },
    sourceStatus: 'LIVE',
    summary: { failed: 0, reviewRequired: 0, unacknowledged: 0, unknownClassification: 0 },
    take: 50,
    timezone: 'Asia/Ho_Chi_Minh',
    totalCount: items.length,
    window: { from: '2026-08-11T17:00:00.000Z', label: 'Today (Vietnam)', range: 'today', to: '2026-08-12T17:00:00.000Z' },
  };
}

function eventFixture(): AdminAuditEventView {
  return {
    actor: { attribution: 'RECORDED', id: 'operator-1', key: 'admin:operator-1', labelSnapshot: 'Operator One', type: 'HUMAN' },
    area: 'BOOKING',
    changeSummary: 'Status changed to COMPLETED',
    context: { correlationId: 'correlation-1', requestId: 'request-1', routeTemplate: '/admin/bookings/:id', source: 'admin_api' },
    eventLabel: 'Booking completed',
    eventType: 'booking.completed',
    id: 'event-1',
    integrity: 'HASHED',
    object: { id: 'booking-1', labelSnapshot: 'Booking booking-1', type: 'booking' },
    occurredAt: '2026-08-12T02:58:00.000Z',
    outcome: 'SUCCEEDED',
    payload: { status: 'COMPLETED' },
    payloadHash: 'payload-hash',
    recordedAt: '2026-08-12T02:58:01.000Z',
    related: { href: '/bookings/booking-1', label: 'Booking detail' },
    schemaVersion: 2,
    severity: 'NOTICE',
    tags: ['booking'],
  };
}
