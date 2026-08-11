import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import PartnerControlsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync('app/partner-controls/page.tsx', 'utf8');

describe('PartnerControlsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
  });

  it('keeps four fixed workspaces and isolates their operating queues', async () => {
    const summary = renderToStaticMarkup(await PartnerControlsPage({ searchParams: Promise.resolve({}) }));
    const blockers = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'controls' }) }),
    );
    const reports = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'reports' }) }),
    );
    const controls = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'sanctions' }) }),
    );

    for (const markup of [summary, blockers, reports, controls]) {
      expect(markup).toContain('aria-label="Partner control workspaces"');
      expect(markup).toContain('Summary');
      expect(markup).toContain('Partner blockers');
      expect(markup).toContain('Reports');
      expect(markup).toContain('Account controls');
    }
    expect(summary).toContain('id="partner-control-priority-queue"');
    expect(summary).toContain('id="partner-control-health-signals"');
    expect(blockers).toContain('id="partner-control-blockers"');
    expect(reports).toContain('id="partner-control-reports"');
    expect(reports).not.toContain('id="partner-control-create-report"');
    expect(controls).toContain('id="partner-control-account-controls"');
  });

  it('opens new report progressively and searches Partners through the server', async () => {
    const markup = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({ details: 'reports', newReport: '1', partnerQ: 'linh' }),
      }),
    );

    expect(markup).toContain('id="partner-control-create-report"');
    expect(markup).toContain('Find Partner');
    expect(markup).toContain('Safety');
    expect(markup).toContain('Service quality');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      expect.stringContaining('/admin/partner-controls/providers?q=linh&'),
      expect.any(Object),
    );
  });

  it('loads a requested report directly even when it is outside the current list page', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/provider-reports/report-direct') {
        return {
          data: {
            id: 'report-direct',
            providerProfileId: 'partner-1',
            source: 'ADMIN',
            severity: 'HIGH',
            status: 'OPEN',
            category: 'SAFETY',
            summary: 'Direct report evidence',
            createdAt: '2026-08-08T00:00:00.000Z',
          },
          ok: true,
          status: 200,
        } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({
          details: 'reports',
          newReport: '1',
          partnerQ: 'ignored',
          reviewReportId: 'report-direct',
        }),
      }),
    );

    expect(markup).toContain('id="partner-control-report-review"');
    expect(markup).toContain('Direct report evidence');
    expect(markup).not.toContain('id="partner-control-create-report"');
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/provider-reports/report-direct', null);
  });

  it('does not let an unused summary request fail the Reports workspace', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: href !== '/admin/partner-controls/summary',
      status: href === '/admin/partner-controls/summary' ? 503 : 200,
    }));

    const markup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'reports' }) }),
    );

    expect(markup).toContain('Reports needing review');
    expect(markup).not.toContain('This Partner control queue could not be loaded');
    expect(mockedAdminGetResult).not.toHaveBeenCalledWith('/admin/partner-controls/summary', null);
  });

  it('does not apply a current review SLA to closed report history', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/provider-reports?')) {
        return {
          data: {
            items: [
              {
                id: 'report-closed',
                providerProfileId: 'partner-1',
                source: 'ADMIN',
                severity: 'LOW',
                status: 'RESOLVED',
                category: 'OTHER',
                summary: 'Closed report',
                createdAt: '2026-01-01T00:00:00.000Z',
                resolvedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
            skip: 0,
            take: 10,
            totalCount: 1,
          },
          ok: true,
          status: 200,
        } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({ details: 'reports', status: 'RESOLVED' }),
      }),
    );

    expect(markup).toContain('Closed ·');
    expect(markup).not.toContain('72h SLA');
  });

  it('separates active and historical restrictions', async () => {
    const active = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'sanctions' }) }),
    );
    const history = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({ details: 'sanctions', sanction: 'HISTORY' }),
      }),
    );

    expect(active).toContain('Active restrictions');
    expect(active).toContain('aria-current="page"');
    expect(history).toContain('Restriction history');
    expect(history).toContain('lifted or expired restrictions');
  });

  it('renders unavailable state instead of turning API errors into zero totals', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const markup = renderToStaticMarkup(await PartnerControlsPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('could not be loaded');
    expect(markup).toContain('Unavailable');
    expect(markup).not.toContain('Reports needing review: </span>0');
  });

  it('keeps list rows read-only with one report review action', () => {
    expect(pageSource).toContain('Review report');
    expect(pageSource).toContain('ReportReviewPanel');
    expect(pageSource).not.toContain('name="reportStatus"');
    expect(pageSource).not.toContain('name="reportSeverity"');
  });

  it('uses shared form, date, money, badge, table, and confirmation atoms', () => {
    for (const atom of [
      'AdminDataTable',
      'AdminFilterPanel',
      'AdminFormSelect',
      'AdminFormTextarea',
      'AdminTablePaginationFooter',
      'ConfirmDialog',
      'DateTimeText',
      'MoneyText',
      'StatusBadge',
    ]) {
      expect(pageSource).toContain(atom);
    }
    expect(pageSource).not.toContain('className="text-link"');
    expect(pageSource).not.toContain('<span className="pill');
  });

  it('masks phone values in the server-rendered workspace', () => {
    expect(pageSource).toContain('function maskedPhone');
    expect(pageSource).toContain("'•'.repeat");
    expect(pageSource).not.toContain('{provider.user?.phone}');
  });
});
