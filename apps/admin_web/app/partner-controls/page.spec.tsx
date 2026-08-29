import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import PartnerControlsPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

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

  it('isolates four operating queues without repeating sidebar destinations as workspace tabs', async () => {
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
      expect(markup).not.toContain('aria-label="Partner control workspaces"');
      expect(markup).not.toContain('partner-control-workspace-tabs');
    }
    expect(summary).toContain('id="partner-control-priority-queue"');
    expect(summary).toContain('<h1>Action Queue</h1>');
    expect(summary).toContain('id="partner-control-health-signals"');
    expect(blockers).toContain('id="partner-control-blockers"');
    expect(blockers).toContain('<h1>Partner Blockers</h1>');
    expect(reports).toContain('id="partner-control-reports"');
    expect(reports).toContain('<h1>Reports</h1>');
    expect(reports).not.toContain('id="partner-control-create-report"');
    expect(controls).toContain('id="partner-control-account-controls"');
    expect(controls).toContain('<h1>Account Controls</h1>');
    expect(pageSource).not.toContain('PartnerControlWorkspaceNavigation');
  });

  it('links KYC and bank health counts to their exact server lanes', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partner-controls/summary') {
        return {
          data: { bankGaps: 3, kycGaps: 2, onboardingGaps: 4 },
          ok: true,
          status: 200,
        } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await PartnerControlsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('href="/partner-controls?details=controls&amp;review=kyc"');
    expect(markup).toContain('KYC readiness gaps 2');
    expect(markup).toContain('href="/partner-controls?details=controls&amp;review=bank"');
    expect(markup).toContain('Bank approval gaps 3');
    expect(markup).toContain('A Partner can appear in both lane totals.');
    expect(markup).not.toContain('KYC or bank gap 4');
  });

  it('opens new report progressively and searches Partners through the server', async () => {
    const markup = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({ details: 'reports', newReport: '1', partnerQ: 'linh' }),
      }),
    );

    expect(markup).toContain('id="partner-control-create-report"');
    expect(markup).toContain('Find Partner');
    expect(markup).toContain('Up to 20 Partners are listed alphabetically');
    expect(markup).toContain('Safety');
    expect(markup).toContain('Service quality');
    expect(markup).toContain('Summary · Required · one-line incident description');
    expect(markup).toContain('Details · Evidence and context for the next operator');
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
      if (href === '/admin/provider-reports/report-direct/audit-history') {
        return {
          data: {
            items: [
              {
                id: 'audit-update',
                action: 'provider_report.update',
                actor: { id: 'admin-1', fullName: 'Operations Admin' },
                changes: {
                  resolutionNote: 'Evidence verified',
                  severity: 'HIGH',
                  status: 'RESOLVED',
                },
                createdAt: '2026-08-24T02:00:00.000Z',
              },
              {
                id: 'audit-create',
                action: 'provider_report.create',
                actor: { id: 'admin-2', fullName: 'Triage Admin' },
                changes: { category: 'SAFETY', severity: 'MEDIUM' },
                createdAt: '2026-08-24T01:00:00.000Z',
              },
            ],
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
    expect(markup).toContain('Recent report changes · 2');
    expect(markup).toContain('Most recent recorded create and update events. Read-only.');
    expect(markup).toContain('Report updated');
    expect(markup).toContain('Operations Admin · Resolution: Evidence verified');
    expect(markup).toContain('Report created');
    expect(markup).toContain('Triage Admin');
    expect(markup).toContain('24 Aug 2026, 09:00');
    expect(markup).not.toContain('id="partner-control-create-report"');
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/provider-reports/report-direct', null);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/provider-reports/report-direct/audit-history', {
      items: [],
    });
  });

  it('keeps report review available when its read-only audit history cannot be loaded', async () => {
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
      if (href.endsWith('/audit-history')) {
        return { data: fallback, ok: false, requestId: 'audit-request-1', status: 503 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(
      await PartnerControlsPage({
        searchParams: Promise.resolve({ details: 'reports', reviewReportId: 'report-direct' }),
      }),
    );

    expect(markup).toContain('id="partner-control-report-review"');
    expect(markup).toContain('Report change history could not be loaded.');
    expect(markup).toContain('Save report changes');
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

  it('labels the default report status as the active review scope', async () => {
    const markup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'reports' }) }),
    );

    expect(markup).toContain('Needs review · Open + Investigating');
    expect(markup).not.toContain('All statuses');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      expect.stringContaining('review=active'),
      expect.any(Object),
    );
    expect(markup).toContain('View resolved');
    expect(markup).toContain('No reports need triage.');
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
    expect(markup).toContain('2 Jan 2026, 07:00');
    expect(markup).not.toContain('72h SLA');
    expect(pageSource).not.toContain("toLocaleString('en-GB')");
  });

  it.each([null, 'not-a-date'])('does not invent a closed time for %s', async (resolvedAt) => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/provider-reports?')) {
        return {
          data: {
            items: [
              {
                id: `report-${String(resolvedAt)}`,
                providerProfileId: 'partner-1',
                source: 'ADMIN',
                severity: 'LOW',
                status: 'RESOLVED',
                category: 'OTHER',
                summary: 'Closed report without a valid time',
                createdAt: '2026-01-01T00:00:00.000Z',
                resolvedAt,
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
    expect(markup).toContain('close time not tracked');
    expect(markup).not.toContain('Invalid Date');
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

  it('shows legacy lift-reason guidance once and keeps the row fallback concise', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/provider-sanctions?')) {
        return {
          data: {
            items: [
              {
                id: 'sanction-legacy',
                providerProfileId: 'partner-1',
                reason: 'Historical account restriction',
                startsAt: '2026-01-01T00:00:00.000Z',
                status: 'LIFTED',
                type: 'ACCOUNT_BLOCK',
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
        searchParams: Promise.resolve({ details: 'sanctions', sanction: 'HISTORY' }),
      }),
    );

    expect(markup.match(/Legacy records may not contain a lift reason\./gu)).toHaveLength(1);
    expect(markup).toContain('Legacy · not recorded');
    expect(markup).not.toContain('Not recorded for this historical action.');
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
    expect(pageSource).toContain('risk.nextActionLabel');
    expect(pageSource).not.toContain('partnerBlockerActionLabel');
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
