import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../lib/admin-api';
import { adminGet, adminGetResult } from '../../lib/admin-api';
import { buildPartnerOperationRow } from './partner-operation-row';
import ProvidersPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  const adminGet = vi.fn();

  return {
    ...actual,
    adminGet,
    adminGetResult: vi.fn(async (href, fallback) => ({
      data: await adminGet(href, fallback),
      ok: true,
      status: 200,
    })),
  };
});

vi.mock('./partner-operation-row', async () => {
  const actual = await vi.importActual<typeof import('./partner-operation-row')>('./partner-operation-row');

  return {
    ...actual,
    buildPartnerOperationRow: vi.fn(actual.buildPartnerOperationRow),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedBuildPartnerOperationRow = vi.mocked(buildPartnerOperationRow);

describe('ProvidersPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
    mockedBuildPartnerOperationRow.mockClear();
  });

  it('renders an explicit recovery state instead of zero rows when directory reads fail', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const page = await ProvidersPage({ searchParams: Promise.resolve({ review: 'unsettled' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Unable to load Partners');
    expect(markup).toContain(
      'Partner data could not be loaded. Refresh before using this directory for an operational decision.',
    );
    expect(markup).toContain('href="/partners?review=unsettled"');
    expect(markup).not.toContain('0 matching Partners');
  });

  it('uses the shared Vuexy badge atom for the active sort summary', () => {
    const source = readFileSync('app/partners/page.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain(
      'actions={<span className="pill pill-info">{partnerSortLabel(filters.sort)}</span>}',
    );
  });

  it('uses the shared Vuexy trace summary atom for the active filter summary', () => {
    const source = readFileSync('app/partners/page.tsx', 'utf8');

    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('partnerFilterSummaryMetricMeta');
    expect(source).not.toContain('A factual snapshot of the partner rows');
    expect(source).not.toContain('Current filtered partner set');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-14">');
    expect(source).not.toContain('<div className="grid admin-mb-16 partner-deep-summary-grid">');
    expect(source).not.toContain('<AdminKpiCard helper="Current filtered partner set"');
  });

  it('renders bounded server partner rows without applying a second local search filter', async () => {
    const serverRow = {
      displayName: 'Server Trusted Partner',
      gender: 'female',
      id: 'server-partner-row',
      status: 'OFFLINE',
      user: {
        createdAt: '2026-06-01T09:00:00.000Z',
        fullName: 'Server Trusted Partner',
        id: 'server-user-row',
        phone: '+84900002222',
      },
      userId: 'server-user-row',
    } as AdminProvider;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 120 };
      }

      if (href.startsWith('/admin/partners/list-providers')) {
        return [serverRow];
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return [];
      }

      return fallback;
    });

    const page = await ProvidersPage({ searchParams: Promise.resolve({ pageSize: '10', q: 'linh' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('class="admin-page-header admin-page-header-toolbar"');
    expect(markup).not.toContain('vuexy-partner-page-header');
    expect(markup).toContain('Server Trusted Partner');
    expect(markup).toContain('Showing 1 to 1 of 120 entries');
    expect(mockedBuildPartnerOperationRow).not.toHaveBeenCalled();
    const policyHref = mockedAdminGet.mock.calls
      .map(([href]) => href)
      .find((href) => {
        return href.startsWith('/admin/operational-policy?keys=');
      });
    expect(policyHref).toBeDefined();
    const policyUrl = new URL(policyHref ?? '', 'http://admin.local');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.marketplace_partner_location_max_age_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.provider_response_window_minutes',
    ]);
  });

  it('renders deep operations filter summary on a shared Vuexy surface', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 0 };
      }

      if (href.startsWith('/admin/partners/list-providers')) {
        return [];
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return [];
      }

      return fallback;
    });

    const page = await ProvidersPage({ searchParams: Promise.resolve({ details: 'all', review: 'kyc' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner action snapshot');
    expect(markup).toContain('card admin-section admin-mb-16 partner-current-filter-summary-card');
    expect(markup).toContain('admin-metric-grid admin-mb-16 partner-deep-summary-grid');
    expect(markup).toContain('metric-card');
    expect(markup).toContain('metric-card-scope');
    expect(markup).toContain('Active filters');
    expect(markup).toContain('Needs action');
    expect(markup).toContain('Live');
    expect(markup).not.toContain('Current filter summary');
    expect(markup).not.toContain('Current filtered partner set');
    expect(markup).not.toContain('<div class="card"><p>Total partners</p>');
    expect(markup).not.toContain('partner-legacy-table');
    expect(markup).toContain('KYC review board');
    expect(markup).not.toContain('Partner operations list');
    expect(markup).not.toContain('Dispatch forecast');
    expect(markup).toContain('Compact list');
  });

  it('keeps review queues compact until operations analysis is explicitly loaded', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 0 };
      }
      if (href.startsWith('/admin/partners/list-providers')) return [];
      if (href.startsWith('/admin/operational-policy?keys=')) return [];
      return fallback;
    });

    const page = await ProvidersPage({ searchParams: Promise.resolve({ review: 'kyc' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('KYC updates');
    expect(markup).toContain('Load operations analysis');
    expect(markup).toContain('/partners?review=kyc&amp;details=all');
    expect(markup).not.toContain('Partner action snapshot');
    expect(markup).not.toContain('Partner operations list');
  });

  it('renders approval-pending Partners as a dedicated oldest-first decision queue', async () => {
    const approvalRow = {
      displayName: 'Pending Linh',
      id: 'partner-approval-pending',
      kyc: {
        id: 'kyc-pending',
        status: 'PENDING',
        submittedAt: '2026-07-18T04:00:00.000Z',
      },
      status: 'OFFLINE',
      user: {
        createdAt: '2026-07-17T00:00:00.000Z',
        fullName: 'Pending Linh Legal',
        id: 'user-approval-pending',
        phone: '+84900003333',
      },
      userId: 'user-approval-pending',
      verification: {
        id: 'verification-submitted',
        status: 'SUBMITTED',
        submittedAt: '2026-07-18T03:00:00.000Z',
      },
    } as AdminProvider;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-07-19T00:00:00.000Z', totalCount: 1 };
      }
      if (href.startsWith('/admin/partners/list-providers')) return [approvalRow];
      if (href.startsWith('/admin/operational-policy?keys=')) return [];
      return fallback;
    });

    const page = await ProvidersPage({
      searchParams: Promise.resolve({ review: 'approval-pending', sort: 'oldest' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner approvals');
    expect(markup).toContain('Submitted / Age');
    expect(markup).toContain('Verification Submitted for review');
    expect(markup).toContain('KYC Review pending');
    expect(markup).toContain('identity docs 3/3 missing');
    expect(markup).toContain('href="/partners/partner-approval-pending"');
    expect(markup).not.toContain('Load operations analysis');
    expect(markup).not.toContain('<th>Wallet</th>');
  });

  it('shows approval recovery destinations instead of filters and export when the queue is empty', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-07-19T00:00:00.000Z', totalCount: 0 };
      }
      if (href.startsWith('/admin/partners/list-providers')) return [];
      if (href.startsWith('/admin/operational-policy?keys=')) return [];
      return fallback;
    });

    const page = await ProvidersPage({
      searchParams: Promise.resolve({ review: 'approval-pending', sort: 'oldest' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Approval queue is clear');
    expect(markup).toContain('View onboarding blockers');
    expect(markup).toContain('Open partner directory');
    expect(markup).not.toContain('Approval queue filters');
    expect(markup).not.toContain('Export');
    expect(markup).not.toContain('Bookings');
    expect(markup).not.toContain('Revenue');
    expect(markup).toContain('href="/partners?review=unsettled"');
  });

  it('normalizes marketplace-ready drilldowns to the server-backed ready-now list', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 0 };
      }

      if (href.startsWith('/admin/partners/list-providers')) {
        return [];
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return [];
      }

      return fallback;
    });

    const page = await ProvidersPage({ searchParams: Promise.resolve({ review: 'marketplace-ready' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('Partner action snapshot');
    expect(markup).not.toContain('partner-deep-summary-grid');
    expect(markup).not.toContain('Partner operations list');
    expect(markup).toContain('Review: Ready now');
  });

  it('does not offer a CSV export when the current page has no rows', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers/summary')) {
        return { generatedAt: '2026-06-28T00:00:00.000Z', totalCount: 0 };
      }

      if (href.startsWith('/admin/partners/list-providers')) {
        return [];
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return [];
      }

      return fallback;
    });

    const page = await ProvidersPage({
      searchParams: Promise.resolve({ page: '2', pageSize: '25', q: 'linh' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No records to export');
    expect(markup).not.toContain('href="/api/admin/partners/export?page=2&amp;pageSize=25&amp;q=linh"');
    expect(markup).not.toContain('data:text/csv');
  });
});
