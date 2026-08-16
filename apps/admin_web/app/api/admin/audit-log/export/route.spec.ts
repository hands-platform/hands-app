import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminAuditExportResponse } from '../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../lib/admin-api', async () => ({
  ...(await vi.importActual<typeof import('../../../../../lib/admin-api')>('../../../../../lib/admin-api')),
  adminGetResult: vi.fn(),
}));

vi.mock('../../../../../lib/admin-session', async () => ({
  ...(await vi.importActual<typeof import('../../../../../lib/admin-session')>('../../../../../lib/admin-session')),
  requireAdminWebAccess: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('audit log export route', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before requesting sensitive export evidence', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/audit-log/export'));
    expect(response.status).toBe(401);
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('returns redacted CSV from the current filters without cursor or drawer state', async () => {
    mockedAdminGetResult.mockResolvedValue(ok(exportResponse('csv')) as never);

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/audit-log/export?format=csv&view=MONEY_POLICY&q=payment&bucket=Operations%2FPolicy&cursor=secret-cursor&event=event-1',
    ));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-export-row-count')).toBe('1');
    expect(body).toContain('"eventId"');
    expect(body).toContain('[REDACTED]');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/audit-logs/export?format=csv&view=MONEY_POLICY&q=payment&bucket=Operations%2FPolicy',
      expect.any(Object),
    );
  });

  it('returns byte-faithful redacted JSON evidence', async () => {
    const fixture = exportResponse('json');
    mockedAdminGetResult.mockResolvedValue(ok(fixture) as never);

    const response = await GET(new NextRequest('http://localhost/api/admin/audit-log/export?format=json'));
    await expect(response.json()).resolves.toEqual(fixture.events);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('preserves a request-specific finance approval target in the upstream export', async () => {
    mockedAdminGetResult.mockResolvedValue(ok(exportResponse('csv')) as never);

    await GET(new NextRequest(
      'http://localhost/api/admin/audit-log/export?format=csv&range=all&sort=oldest&targetPrefix=finance_approver_request%3Arequest-1',
    ));

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/audit-logs/export?format=csv&range=all&sort=oldest&targetPrefix=finance_approver_request%3Arequest-1',
      expect.any(Object),
    );
  });

  it('returns an explicit upstream error instead of a successful empty export', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: exportResponse('csv'), ok: false, status: 503 } as never);

    const response = await GET(new NextRequest('http://localhost/api/admin/audit-log/export'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Audit export could not be created. No success record was reported to the operator.',
    });
  });
});

function ok<T>(data: T) {
  return { data, ok: true, status: 200 } as const;
}

function exportResponse(format: 'csv' | 'json'): AdminAuditExportResponse {
  return {
    events: [{
      actor: { attribution: 'RECORDED', id: null, key: 'payment-worker', labelSnapshot: 'Payment worker', type: 'SERVICE' },
      area: 'MONEY',
      changeSummary: 'Payment failed',
      context: { correlationId: 'correlation-1', requestId: 'request-1', routeTemplate: null, source: 'worker' },
      eventLabel: 'Payment Failed',
      eventType: 'payment.failed',
      id: 'event-1',
      integrity: 'HASHED',
      object: { id: 'payment-1', labelSnapshot: 'Payment payment-1', type: 'payment' },
      occurredAt: '2026-08-12T01:00:00.000Z',
      outcome: 'FAILED',
      payload: { authorization: '[REDACTED]', result: 'FAILED' },
      payloadHash: 'hash-1',
      recordedAt: '2026-08-12T01:00:01.000Z',
      related: { href: '/payments/payment-1', label: 'Open payment' },
      schemaVersion: 2,
      severity: 'REVIEW',
      tags: [],
    }],
    format,
    generatedAt: '2026-08-12T01:01:00.000Z',
    limit: 5_000,
    rowCount: 1,
    timezone: 'Asia/Ho_Chi_Minh',
    truncated: false,
  };
}
