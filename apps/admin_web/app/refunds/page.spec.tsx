import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import type {
  AdminGetResult,
  AdminRefundOperationsRow,
  AdminRefundQueueMeta,
} from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import RefundsPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REFUND_REDIRECT');
  }),
}));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRedirect = vi.mocked(redirect);

function ok<T>(data: T): AdminGetResult<T> {
  return { data, ok: true, status: 200 };
}

function failed<T>(data: T, status = 500): AdminGetResult<T> {
  return { data, ok: false, status };
}

describe('RefundsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRedirect.mockClear();
  });

  it('defaults to the all-date open backlog ordered oldest first', async () => {
    mockPageData(queueMeta(), []);

    await RefundsPage({ searchParams: Promise.resolve({}) });

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/refunds/queue-meta?range=all&review=open',
      expect.objectContaining({ selectedTotal: 0 }),
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/refunds?range=all&review=open&take=10&sort=oldest',
      [],
    );
  });

  it('passes search, range, queue, age, SLA, sort, and pagination to both server reads', async () => {
    mockPageData(queueMeta({ selectedTotal: 40 }), [refundRow()]);

    await RefundsPage({
      searchParams: Promise.resolve({
        age: '3-7d', page: '2', q: 'Customer One', range: '30d', review: 'open',
        sla: 'overdue', sort: 'newest',
      }),
    });

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/refunds/queue-meta?range=30d&review=open&age=3-7d&sla=overdue&q=Customer+One',
      expect.any(Object),
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/refunds?range=30d&review=open&age=3-7d&sla=overdue&q=Customer+One&take=10&skip=10',
      [],
    );
  });

  it('renders server-owned workstream fields and direct payment detail links', async () => {
    mockPageData(queueMeta({ selectedTotal: 1, requestedCount: 1 }), [refundRow()]);

    const markup = renderToStaticMarkup(
      await RefundsPage({ searchParams: Promise.resolve({ range: 'all', review: 'requested' }) }),
    );

    expect(markup).toContain('Customer One');
    expect(markup).toContain('Approval required');
    expect(markup).toContain('Finance approval');
    expect(markup).toContain('/payments/payment-1');
    expect(markup).not.toContain('/payments#payment-payment-1');
    expect(markup).toContain('/finance-tax/approval-queue?view=refunds&amp;requestId=refund-1');
    expect(markup).toContain('returnTo=%2Frefunds%3Frange%3Dall%26review%3Drequested%26sort%3Doldest');
    expect(markup).not.toContain('/finance-closeout');
    expect(markup).toContain('Source: Created manually by an administrator');
    expect(markup).not.toContain('Source: ADMIN_MANUAL');
  });

  it('maps recorded, legacy, and unknown source values to operator copy', async () => {
    mockPageData(queueMeta({ selectedTotal: 3 }), [
      { ...refundRow(), id: 'refund-known', metadata: { source: 'UNMATCHED_BOOKING_CLOSE' } },
      { ...refundRow(), id: 'refund-legacy', metadata: {} },
      { ...refundRow(), id: 'refund-unknown', metadata: { source: 'PARTNER_SUPPORT_IMPORT' } },
    ]);

    const markup = renderToStaticMarkup(
      await RefundsPage({ searchParams: Promise.resolve({ range: 'all', review: 'open' }) }),
    );

    expect(markup).toContain('Source: Created while closing an unmatched booking');
    expect(markup).toContain('Source: Legacy request · source not recorded');
    expect(markup).toContain('Source: Other source · Partner support import (PARTNER_SUPPORT_IMPORT)');
  });

  it('distinguishes an empty today view from the all-date open backlog', async () => {
    mockPageData(queueMeta({ globalOpenCount: 112 }), []);

    const markup = renderToStaticMarkup(
      await RefundsPage({ searchParams: Promise.resolve({ range: 'today', review: 'open' }) }),
    );

    expect(markup).toContain('No open refunds were created today.');
    expect(markup).toContain('112 refunds are still open across all dates.');
    expect(markup).toContain('View all open refunds');
    expect(markup).toContain('/refunds?range=all&amp;review=open&amp;sort=oldest');
  });

  it('canonicalizes a page beyond the filtered result range', async () => {
    mockPageData(queueMeta({ selectedTotal: 12 }), []);

    await expect(
      RefundsPage({ searchParams: Promise.resolve({ page: '999' }) }),
    ).rejects.toThrow('REFUND_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/refunds?range=all&review=open&sort=oldest&page=2',
    );
  });

  it('keeps records and filters available when queue totals fail', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/refunds/queue-meta') ? failed(fallback) : ok([refundRow()] as never),
    );

    const markup = renderToStaticMarkup(await RefundsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Refund queue totals unavailable');
    expect(markup).toContain('Customer One');
    expect(markup).toContain('Refund queue');
    expect(markup).not.toContain('Refund records unavailable');
  });

  it('keeps queue totals visible when the record list fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/refunds/queue-meta')
        ? ok(queueMeta({ requestedCount: 3 }))
        : failed(fallback, 503),
    );

    const markup = renderToStaticMarkup(await RefundsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Approval required');
    expect(markup).toContain('Refund records unavailable');
    expect(markup).not.toContain('Refund queue totals unavailable');
  });

  it('uses a route-specific Refunds loading screen', () => {
    const source = readFileSync('app/refunds/loading.tsx', 'utf8');
    expect(source).toContain('AdminWorkspaceLoading title="Refunds"');
    expect(source).not.toContain('Shift Command');
  });

  it('declares the refunds document title and routes state mismatches to exact approval focus', async () => {
    const mismatch = {
      ...refundRow(),
      operationalStage: 'STATE_MISMATCH' as const,
      stateMismatchReason: 'Payment already refunded.',
    };
    mockPageData(queueMeta({ selectedTotal: 1, stateMismatchCount: 1 }), [mismatch]);

    const markup = renderToStaticMarkup(await RefundsPage({
      searchParams: Promise.resolve({ review: 'state-mismatch' }),
    }));
    const source = readFileSync('app/refunds/page.tsx', 'utf8');

    expect(source).toContain("title: 'Refunds | HANDS Admin'");
    expect(markup).toContain('Review state mismatch');
    expect(markup).toContain('requestId=refund-1');
    expect(markup).not.toContain('/finance-closeout');
  });
});

function mockPageData(meta: AdminRefundQueueMeta, rows: AdminRefundOperationsRow[]) {
  mockedAdminGetResult.mockImplementation(async (href, fallback) =>
    href.startsWith('/admin/refunds/queue-meta') ? ok(meta) : href.startsWith('/admin/refunds?') ? ok(rows) : ok(fallback),
  );
}

function queueMeta(overrides: Partial<AdminRefundQueueMeta> = {}): AdminRefundQueueMeta {
  return {
    completedCount: 0,
    generatedAt: '2026-08-09T08:00:00.000Z',
    globalOpenCount: 0,
    oldestOpenAt: null,
    openCount: 0,
    processingCount: 0,
    queueAgeCounts: {
      all: 0, 'under-1h': 0, '1-4h': 0, '4-24h': 0,
      '1-3d': 0, '3-7d': 0, 'over-7d': 0,
    },
    queueSla: { overdueCount: 0, thresholdMinutes: 240 },
    rejectedCount: 0,
    requestedCount: 0,
    reviewRequiredCount: 0,
    selectedTotal: 0,
    stateMismatchCount: 0,
    ...overrides,
  };
}

function refundRow(): AdminRefundOperationsRow {
  return {
    amount: 150000,
    assignee: 'Finance approval',
    booking: {
      id: 'booking-1',
      customerProfile: { id: 'customer-1', user: { fullName: 'Customer One', phone: '+84900000001' } },
      status: 'CANCELLED',
    },
    bookingId: 'booking-1',
    createdAt: '2026-08-08T05:00:00.000Z',
    currency: 'VND',
    id: 'refund-1',
    metadata: {
      requestedAt: '2026-08-08T05:00:00.000Z',
      requestedByAdminId: 'admin-maker-1',
      source: 'ADMIN_MANUAL',
    },
    nextAction: 'Review evidence and approve or reject',
    operationalStage: 'AWAITING_DECISION',
    payment: {
      callbackAttempts: [], currency: 'VND', id: 'payment-1', method: 'CARD',
      providerRef: 'provider-ref-1', status: 'CAPTURED',
    },
    paymentId: 'payment-1',
    reason: 'Customer requested cancellation',
    stateMismatchReason: null,
    status: 'REQUESTED',
  };
}
