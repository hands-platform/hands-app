import { readFileSync } from 'node:fs';
import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { adminGet, adminGetResult } from '../../../lib/admin-api';
import { OPERATIONAL_POLICY_CACHE_OPTIONS } from '../../../lib/operations-policy';
import ProviderDetailPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

vi.mock('./partner-detail-account-control-form', () => ({
  PartnerDetailAccountControlForm: ({ children }: { readonly children: ReactNode }) => (
    <form>{children}</form>
  ),
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const providerDetailSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('ProviderDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href, fallback, options) => ({
      data: options ? await mockedAdminGet(href, fallback, options) : await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
    mockedGetCurrentAdminOperatorAccess.mockReset();
  });

  it('requests only the operations policy keys needed by partner dispatch readiness', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const page = await ProviderDetailPage({ params: Promise.resolve({ id: 'partner-policy-load' }) });

    expect(page).toMatchObject({ props: { title: 'Partner data unavailable' } });

    const policyCall = mockedAdminGet.mock.calls.find(([href]) =>
      href.startsWith('/admin/operational-policy'),
    );
    const policyHref = policyCall?.[0];
    expect(policyHref).toBe(
      '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_location_max_age_minutes',
    );
    expect(policyCall?.[2]).toEqual(OPERATIONAL_POLICY_CACHE_OPTIONS);
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/operational-policy', []);
  });

  it('uses not-found only for a confirmed Provider 404', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href === '/admin/partners/missing-partner/overview'
        ? { data: null, ok: false, status: 404 }
        : { data: fallback, ok: true, status: 200 },
    );

    await expect(ProviderDetailPage({ params: Promise.resolve({ id: 'missing-partner' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it.each([
    [401, 'Partner access restricted', 'You do not have permission to view this Partner record.'],
    [403, 'Partner access restricted', 'You do not have permission to view this Partner record.'],
    [500, 'Partner data unavailable', 'Partner data could not be loaded.'],
    [null, 'Partner data unavailable', 'Partner data could not be loaded.'],
  ] as const)('renders an explicit Provider failure state for status %s', async (status, title, message) => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href === '/admin/partners/provider-failure/overview'
        ? { data: null, ok: false, status }
        : { data: fallback, ok: true, status: 200 },
    );

    const markup = renderToStaticMarkup(
      await ProviderDetailPage({ params: Promise.resolve({ id: 'provider-failure' }) }),
    );

    expect(markup).toContain(title);
    expect(markup).toContain(message);
    expect(markup).not.toContain('Partner One');
    expect(markup).not.toContain('Can work now?');
  });

  it.each([
    [403, 'Operational policy restricted'],
    [500, 'Operational policy unavailable'],
    [null, 'Operational policy unavailable'],
  ] as const)(
    'keeps Provider identity but pauses readiness when policy status is %s',
    async (status, errorTitle) => {
      mockProviderWithPolicyResult({ data: [], ok: false, status });

      const markup = renderToStaticMarkup(
        await ProviderDetailPage({ params: Promise.resolve({ id: 'partner-policy-failure' }) }),
      );

      expect(markup).toContain('Partner One');
      expect(markup).toContain(errorTitle);
      expect(markup).toContain('Pause matching and readiness decisions');
      expect(markup).toContain('Work readiness');
      expect(markup).toContain('Unavailable');
      expect(markup).not.toContain('partner-fast-work-grid');
    },
  );

  it('treats a malformed operational policy payload as unavailable', async () => {
    mockProviderWithPolicyResult({
      data: [{ value: 90 }] as never,
      ok: true,
      status: 200,
    });

    const markup = renderToStaticMarkup(
      await ProviderDetailPage({ params: Promise.resolve({ id: 'partner-policy-malformed' }) }),
    );

    expect(markup).toContain('Partner One');
    expect(markup).toContain('Operational policy unavailable');
    expect(markup).not.toContain('partner-fast-work-grid');
  });

  it('renders normal readiness when Provider and operational policy requests succeed', async () => {
    mockProviderWithPolicyResult({ data: [], ok: true, status: 200 });

    const markup = renderToStaticMarkup(
      await ProviderDetailPage({ params: Promise.resolve({ id: 'partner-success' }) }),
    );

    expect(markup).toContain('Partner One');
    expect(markup).toContain('partner-fast-work-grid');
    expect(markup).not.toContain('Operational policy unavailable');
  });

  it('renders the full compatibility URL as a bounded workspace index', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-1?includeDiagnostics=false') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const page = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-1' }),
      searchParams: Promise.resolve({ section: 'full' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('Partner One work areas');
    expect(markup).toContain('Partner work areas');
    expect(markup).toContain('Approval &amp; profile');
    expect(markup).toContain('Work readiness');
    expect(markup).toContain('Booking evidence');
    expect(markup).toContain('Money');
    expect(markup).toContain('History &amp; controls');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('/partners/partner-1?section=access&amp;access=diagnostics');
    expect(markup).toContain('/partners/partner-1?section=dossier&amp;dossier=finance');
    expect(markup).toContain('/partners/partner-1?section=control&amp;control=records');
    expect(markup).toContain('All Partner chats');
    expect(markup).not.toContain('Current partner status');
    expect(markup).not.toContain('Partner registration dossier');
    expect(markup).not.toContain('Partner booking journey');
    expect(markup).not.toContain('Partner finance records');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/partners/partner-1?includeDiagnostics=false', null);
    expect(mockedGetCurrentAdminOperatorAccess).toHaveBeenCalledTimes(1);
  });

  it('preserves the approval queue context in detail decisions and the back link', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-1?includeDiagnostics=false') return partnerDetail();
      if (href.startsWith('/admin/operational-policy')) return [];
      return fallback;
    });

    const page = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-1' }),
      searchParams: Promise.resolve({ decisionQueue: 'approval-pending', section: 'full' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Back to Partner approvals');
    expect(markup).toContain('/partners?review=approval-pending&amp;sort=oldest');
    expect(markup).toContain('decisionQueue=approval-pending');
  });

  it('keeps operator record and control workspaces available while denying diagnostics', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-operator-views?includeDiagnostics=false') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const deniedDiagnosticsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-operator-views' }),
      searchParams: Promise.resolve({ access: 'diagnostics', section: 'access' }),
    });
    const deniedDiagnosticsMarkup = renderToStaticMarkup(deniedDiagnosticsPage);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-operator-views?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/partners/partner-operator-views?includeDiagnostics=true',
      null,
    );
    expect(deniedDiagnosticsMarkup).toContain('Partner marketplace readiness');
    expect(deniedDiagnosticsMarkup).not.toContain('Device and session activity');

    mockedAdminGet.mockClear();

    const controlsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-operator-views' }),
      searchParams: Promise.resolve({ access: 'controls', section: 'access' }),
    });
    expect(renderToStaticMarkup(controlsPage)).toContain('Partner reports and account controls');

    mockedAdminGet.mockClear();

    const recordsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-operator-views' }),
      searchParams: Promise.resolve({ control: 'records', section: 'control' }),
    });
    expect(renderToStaticMarkup(recordsPage)).toContain('Partner control records');
  });

  it('loads deep access diagnostics only when a Master Admin selects the diagnostics workspace', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const standardPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-master-diagnostics' }),
      searchParams: Promise.resolve({ section: 'access' }),
    });

    expect(standardPage).toMatchObject({ props: { title: 'Partner data unavailable' } });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-master-diagnostics?includeDiagnostics=false',
      null,
    );

    mockedAdminGet.mockClear();

    const diagnosticsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-master-diagnostics' }),
      searchParams: Promise.resolve({ access: 'diagnostics', section: 'access' }),
    });

    expect(diagnosticsPage).toMatchObject({ props: { title: 'Partner data unavailable' } });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-master-diagnostics?includeDiagnostics=true',
      null,
    );
  });

  it('loads retained control records and Developer references only in their selected workspaces', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-control?includeDiagnostics=false') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const controlPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-control' }),
      searchParams: Promise.resolve({ section: 'control' }),
    });
    expect(mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/reviews?'))).toBe(false);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(false);

    mockedAdminGetResult.mockClear();

    const recordsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-control' }),
      searchParams: Promise.resolve({ control: 'records', section: 'control' }),
    });
    expect(mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/reviews?'))).toBe(true);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(true);

    mockedAdminGetResult.mockClear();

    const referencePage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-control' }),
      searchParams: Promise.resolve({ control: 'reference', section: 'control' }),
    });
    const controlMarkup = renderToStaticMarkup(controlPage);
    const recordsMarkup = renderToStaticMarkup(recordsPage);
    const referenceMarkup = renderToStaticMarkup(referencePage);

    expect(controlMarkup).toContain('Control workspace view');
    expect(controlMarkup).toContain('Partner operator command queue');
    expect(controlMarkup).not.toContain('Partner review records');
    expect(controlMarkup).not.toContain('Partner operations digest');
    expect(recordsMarkup).toContain('Partner control records');
    expect(recordsMarkup).toContain('Partner review records');
    expect(recordsMarkup).not.toContain('Partner operator command queue');
    expect(recordsMarkup).not.toContain('Partner operations digest');
    expect(referenceMarkup).toContain('Partner operations digest');
    expect(referenceMarkup).toContain('Partner operating ledger');
    expect(referenceMarkup).not.toContain('Partner operator command queue');
    expect(referenceMarkup).not.toContain('Partner review records');
    expect(mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/reviews?'))).toBe(false);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(false);
  });

  it('distinguishes empty, restricted, and unavailable review records', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['CUSTOMERS_REVIEWS', 'PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-review-states?includeDiagnostics=false') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) return [];
      return fallback;
    });

    const renderRecords = async () =>
      renderToStaticMarkup(
        await ProviderDetailPage({
          params: Promise.resolve({ id: 'partner-review-states' }),
          searchParams: Promise.resolve({ control: 'records', section: 'control' }),
        }),
      );

    const emptyMarkup = await renderRecords();
    expect(emptyMarkup).toContain('No customer review connected to this record.');
    expect(emptyMarkup).toContain('No Partner note connected to this record.');
    expect(emptyMarkup).not.toContain('Review records unavailable');

    mockAdminGetResultFailure('/admin/reviews?', 403);
    const restrictedMarkup = await renderRecords();
    expect(restrictedMarkup).toContain('Review records restricted');
    expect(restrictedMarkup).toContain('You do not have permission to view Partner review records.');
    expect(restrictedMarkup).not.toContain('No customer review connected to this record.');

    mockAdminGetResultFailure('/admin/reviews?', 500);
    const unavailableMarkup = await renderRecords();
    expect(unavailableMarkup).toContain('Review records unavailable');
    expect(unavailableMarkup).toContain('Partner review records could not be loaded.');
  });

  it('distinguishes restricted and unavailable financial records from a true empty result', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_SETTLEMENTS', 'FINANCE_WALLET_ADJUSTMENTS', 'PARTNERS_DETAIL'],
      email: 'finance@example.com',
      fullName: 'Finance Ops',
      id: 'finance-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-finance-states?includeDiagnostics=false&view=finance') {
        return partnerDetail();
      }
      return fallback;
    });

    const renderFinance = async () =>
      renderToStaticMarkup(
        await ProviderDetailPage({
          params: Promise.resolve({ id: 'partner-finance-states' }),
          searchParams: Promise.resolve({ dossier: 'finance', section: 'dossier' }),
        }),
      );

    const emptyMarkup = await renderFinance();
    expect(emptyMarkup).toContain('Partner finance records');
    expect(emptyMarkup).not.toContain('Financial data restricted');
    expect(emptyMarkup).not.toContain('Financial data unavailable');

    mockAdminGetResultFailure('/admin/provider-wallet/withdrawal-requests?', 403);
    const restrictedMarkup = await renderFinance();
    expect(restrictedMarkup).toContain('Financial data restricted');
    expect(restrictedMarkup).toContain('You do not have permission to view this financial data.');

    mockAdminGetResultFailure('/admin/provider-wallet/withdrawal-requests?', 500);
    const unavailableMarkup = await renderFinance();
    expect(unavailableMarkup).toContain('Financial data unavailable');
    expect(unavailableMarkup).toContain('Financial data could not be loaded.');
  });

  it('separates operator readiness from Developer device and session diagnostics', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href === '/admin/partners/partner-access?includeDiagnostics=false' ||
        href === '/admin/partners/partner-access?includeDiagnostics=true'
      ) {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const readinessPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-access' }),
      searchParams: Promise.resolve({ section: 'access' }),
    });
    const readinessMarkup = renderToStaticMarkup(readinessPage);

    expect(readinessMarkup).toContain('Partner marketplace readiness');
    expect(readinessMarkup).toContain('Access workspace view');
    expect(readinessMarkup).toContain('Marketplace booking gate decision');
    expect(readinessMarkup).not.toContain('Reports and account controls');
    expect(readinessMarkup).not.toContain('Device and session activity');

    mockedAdminGet.mockClear();

    const controlsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-access' }),
      searchParams: Promise.resolve({ access: 'controls', section: 'access' }),
    });
    const controlsMarkup = renderToStaticMarkup(controlsPage);

    expect(controlsMarkup).toContain('Partner reports and account controls');
    expect(controlsMarkup).toContain('Reports and account controls');
    expect(controlsMarkup).not.toContain('Marketplace booking gate decision');
    expect(controlsMarkup).not.toContain('Device and session activity');

    mockedAdminGet.mockClear();

    const diagnosticsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-access' }),
      searchParams: Promise.resolve({ access: 'diagnostics', section: 'access' }),
    });
    const diagnosticsMarkup = renderToStaticMarkup(diagnosticsPage);

    expect(diagnosticsMarkup).toContain('Partner device and session diagnostics');
    expect(diagnosticsMarkup).toContain('Access workspace view');
    expect(diagnosticsMarkup).toContain('Recent app and operations activity');
    expect(diagnosticsMarkup).toContain('Device and session activity');
    expect(diagnosticsMarkup).not.toContain('Marketplace booking gate decision');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-access?includeDiagnostics=true',
      null,
    );
  });

  it('loads partner finance records only in the finance dossier workspace', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_SETTLEMENTS', 'FINANCE_WALLET_ADJUSTMENTS', 'PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href === '/admin/partners/partner-dossier?includeDiagnostics=false' ||
        href === '/admin/partners/partner-dossier?includeDiagnostics=false&view=finance' ||
        href === '/admin/partners/partner-dossier?includeDiagnostics=false&view=evidence'
      ) {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const approvalPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-dossier' }),
      searchParams: Promise.resolve({ section: 'dossier' }),
    });
    const approvalMarkup = renderToStaticMarkup(approvalPage);

    expect(approvalMarkup).toContain('Partner approval decision');
    expect(approvalMarkup).toContain('Partner registration dossier');
    expect(approvalMarkup).not.toContain('KYC decision');
    expect(approvalMarkup).not.toContain('Partner level path');
    expect(approvalMarkup).not.toContain('Required approval evidence');
    expect(approvalMarkup).not.toContain('Review history');
    expect(approvalMarkup).not.toContain('Partner wallet detail');
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) =>
        href.startsWith('/admin/provider-wallet/withdrawal-requests'),
      ),
    ).toBe(false);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments')),
    ).toBe(false);

    mockedAdminGet.mockClear();
    const evidencePage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-dossier' }),
      searchParams: Promise.resolve({ dossier: 'evidence', section: 'dossier' }),
    });
    const evidenceMarkup = renderToStaticMarkup(evidencePage);

    expect(evidenceMarkup).toContain('Partner evidence records');
    expect(evidenceMarkup).toContain('Evidence records');
    expect(evidenceMarkup).toContain('Required approval evidence');
    expect(evidenceMarkup).toContain('Review history');
    expect(evidenceMarkup).not.toContain('Partner registration dossier');
    expect(evidenceMarkup).not.toContain('Partner wallet detail');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-dossier?includeDiagnostics=false&view=evidence',
      null,
    );
    expect(mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/operational-policy'))).toBe(
      false,
    );
    expect(
      mockedAdminGet.mock.calls.some(([href]) =>
        href.startsWith('/admin/provider-wallet/withdrawal-requests'),
      ),
    ).toBe(false);
    expect(mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments'))).toBe(
      false,
    );

    mockedAdminGet.mockClear();
    const financePage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-dossier' }),
      searchParams: Promise.resolve({ dossier: 'finance', section: 'dossier' }),
    });
    const financeMarkup = renderToStaticMarkup(financePage);

    expect(financeMarkup).toContain('Partner finance records');
    expect(financeMarkup).toContain('Partner wallet detail');
    expect(financeMarkup).not.toContain('Partner registration dossier');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-dossier?includeDiagnostics=false&view=finance',
      null,
    );
    expect(mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/operational-policy'))).toBe(
      false,
    );
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) =>
        href.startsWith('/admin/provider-wallet/withdrawal-requests'),
      ),
    ).toBe(true);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments')),
    ).toBe(true);
  });

  it('separates booking journey, retained evidence, and the Developer ledger', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-bookings?includeDiagnostics=false') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const journeyPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-bookings' }),
      searchParams: Promise.resolve({ range: '30d', section: 'bookings' }),
    });
    const journeyMarkup = renderToStaticMarkup(journeyPage);

    expect(journeyMarkup).toContain('Partner booking journey');
    expect(journeyMarkup).toContain('Booking workspace view');
    expect(journeyMarkup).toContain('Record date filter');
    expect(journeyMarkup).toContain('Filtered booking archive');
    expect(journeyMarkup).toContain('Filtered activity');
    expect(journeyMarkup).toContain('type="hidden" name="section" value="bookings"');
    expect(journeyMarkup).not.toContain('name="bookings"');
    expect(journeyMarkup).not.toContain('Partner chat retention ledger');
    expect(journeyMarkup).not.toContain('Booking operations note ledger');

    const evidencePage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-bookings' }),
      searchParams: Promise.resolve({ bookings: 'evidence', range: '30d', section: 'bookings' }),
    });
    const evidenceMarkup = renderToStaticMarkup(evidencePage);

    expect(evidenceMarkup).toContain('Partner booking evidence');
    expect(evidenceMarkup).toContain('Partner booking evidence bundles');
    expect(evidenceMarkup).toContain('Partner chat retention ledger');
    expect(evidenceMarkup).toContain('type="hidden" name="bookings" value="evidence"');
    expect(evidenceMarkup).toContain('/partners/partner-1?section=bookings&amp;bookings=evidence');
    expect(evidenceMarkup).not.toContain('Partner booking create gate evidence');
    expect(evidenceMarkup).not.toContain('Booking operations note ledger');

    const deniedLedgerPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-bookings' }),
      searchParams: Promise.resolve({ bookings: 'ledger', section: 'bookings' }),
    });
    expect(renderToStaticMarkup(deniedLedgerPage)).toContain('Partner booking journey');

    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    const ledgerPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-bookings' }),
      searchParams: Promise.resolve({ bookings: 'ledger', section: 'bookings' }),
    });
    const ledgerMarkup = renderToStaticMarkup(ledgerPage);

    expect(ledgerMarkup).toContain('Partner booking operations ledger');
    expect(ledgerMarkup).toContain('Booking operations note ledger');
    expect(ledgerMarkup).not.toContain('Partner booking create gate evidence');
    expect(ledgerMarkup).not.toContain('Partner chat retention ledger');
  });

  it('uses the lightweight partner overview as the default detail entry point', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-overview/overview') {
        return partnerDetail();
      }
      if (href.startsWith('/admin/operational-policy')) {
        return [];
      }
      return fallback;
    });

    const page = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-overview' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('View partner work areas');
    expect(markup).toContain('/partners/partner-1?section=full');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/partners/partner-overview/overview', null);
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/partners/partner-overview?includeDiagnostics=false',
      null,
    );
  });

  it('uses the shared Vuexy form control link for button-style partner actions', () => {
    expect(providerDetailSource).toContain('AdminFormControlLink');
    expect(providerDetailSource).toContain('AdminTextLink');
    expect(providerDetailSource).not.toContain('<Link className="button button-secondary"');
    expect(providerDetailSource).not.toContain('className="text-link"');
  });

  it('uses the shared Vuexy detail grid for partner dossier groups', () => {
    expect(providerDetailSource).toContain('AdminDetailGrid');
    expect(providerDetailSource).not.toContain(
      '<section className="detail-grid partner-detail-dossier-grid">',
    );
  });

  it('keeps finance-only evidence open debt status on the shared MoneyText atom', () => {
    expect(providerDetailSource).toContain('openDebtLabel={<MoneyText amount={cashFeeDebtTotal} />}');
    expect(providerDetailSource).not.toContain(
      "status={hasCashFeeDebt ? `${formatCurrency(cashFeeDebtTotal)} open debt` : 'Reference'}",
    );
  });

  it('keeps deep partner diagnostic records behind the already-resolved Developer/System gate', () => {
    expect(providerDetailSource).toContain('canLoadPartnerDiagnostics');
    expect(providerDetailSource).not.toContain('AdminDeveloperSystemSection');
    expect(providerDetailSource).toContain(
      'const partnerCommandSnapshotDiagnosticSection = shouldLoadAccessDiagnostics ? (',
    );
    expect(providerDetailSource).toContain("detailSection === 'control' &&");
    expect(providerDetailSource).toContain("controlView === 'reference' ? (");
    expect(providerDetailSource).toContain("detailSection === 'bookings' &&");
    expect(providerDetailSource).toContain("bookingsView === 'ledger' ? (");
    expect(providerDetailSource).toContain(
      'const partnerDeviceSessionDiagnosticSection = shouldLoadAccessDiagnostics ? (',
    );
    expect(providerDetailSource).toContain("detailSection === 'access' &&");
    expect(providerDetailSource).toContain("accessView === 'diagnostics';");
    expect(
      providerDetailSource.indexOf(
        'const partnerCommandSnapshotDiagnosticSection = shouldLoadAccessDiagnostics ? (',
      ),
    ).toBeLessThan(providerDetailSource.indexOf('<PartnerDetailCommandSnapshotSection'));
    expect(providerDetailSource.indexOf("detailSection === 'control' &&")).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailFullRecordIndexSection'),
    );
    expect(providerDetailSource.indexOf("detailSection === 'control' &&")).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailOperatingLedgerSection'),
    );
    expect(
      providerDetailSource.indexOf(
        'const partnerDeviceSessionDiagnosticSection = shouldLoadAccessDiagnostics ? (',
      ),
    ).toBeLessThan(providerDetailSource.indexOf('<PartnerDetailDeviceSessionActivitySection'));
  });

  it('keeps the full compatibility URL as a bounded workspace index', () => {
    expect(providerDetailSource).toContain('if (isFullPartnerDetail)');
    expect(providerDetailSource).toContain('<PartnerDetailFullRecordIndexSection');
    expect(providerDetailSource).not.toContain('PARTNER_DETAIL_DEFAULT_HISTORY_PREVIEW_LIMIT');
    expect(providerDetailSource).not.toContain('partnerBookingEvidencePreviewRows');
    expect(providerDetailSource).not.toContain('isFullPartnerDetail ||');
  });

  it('does not send ordinary partner detail repair actions to app session diagnostics', () => {
    expect(providerDetailSource).not.toContain('/app-sessions?role=PROVIDER');
  });

  it('uses operator-facing profile wording instead of setup labels on partner detail', () => {
    expect(providerDetailSource).not.toContain('service setup');
    expect(providerDetailSource).not.toContain('Bookable service setup exists.');
    expect(providerDetailSource).not.toContain('Payout-only withdrawal setup');
    expect(providerDetailSource).not.toContain('Review withdrawal setup');
    expect(providerDetailSource).not.toContain('tax setup');
    expect(providerDetailSource).not.toContain('withdrawal setup blocker');
    expect(providerDetailSource).not.toContain("label: 'Withdrawal setup'");
  });

  it('uses Partner note terminology in the booking summary link', () => {
    expect(providerDetailSource).toContain(
      'customer review or internal Partner note record(s).',
    );
    expect(providerDetailSource).not.toContain(
      'customer review or Partner evaluation record(s).',
    );
  });

  it('uses operator-facing record wording instead of diagnostic snapshot copy', () => {
    const activityRecordSource = readFileSync(
      'app/partners/[id]/partner-detail-activity-records-model.tsx',
      'utf8',
    );
    const bookingGateSource = readFileSync(
      'app/partners/[id]/partner-detail-booking-gate-rows-model.tsx',
      'utf8',
    );

    expect(activityRecordSource).toContain("title: 'Location record'");
    expect(bookingGateSource).toContain('Address record metadata missing');
    expect(activityRecordSource).not.toContain("title: 'Location snapshot'");
    expect(bookingGateSource).not.toContain('Address snapshot metadata missing');
  });
});

function mockAdminGetResultFailure(hrefPrefix: string, status: number | null) {
  mockedAdminGetResult.mockImplementation(async (href, fallback, options) =>
    href.startsWith(hrefPrefix)
      ? { data: fallback, ok: false, status }
      : {
          data: options
            ? await mockedAdminGet(href, fallback, options)
            : await mockedAdminGet(href, fallback),
          ok: true,
          status: 200,
        },
  );
}

function mockProviderWithPolicyResult(policyResult: {
  readonly data: unknown;
  readonly ok: boolean;
  readonly status: number | null;
}) {
  mockedAdminGetResult.mockImplementation(async (href, fallback) => {
    if (href.startsWith('/admin/partners/')) {
      return { data: partnerDetail(), ok: true, status: 200 };
    }
    if (href.startsWith('/admin/operational-policy')) {
      return policyResult as never;
    }
    return { data: fallback, ok: true, status: 200 };
  });
}

function partnerDetail(): AdminProvider {
  return {
    activitySummary: {
      availablePayout: 0,
      completedWorkCount: 0,
      grossRevenue: 0,
      pendingPayout: 0,
      platformFee: 0,
      walletBalance: 0,
    },
    agreements: [],
    auditLogs: [],
    bankAccounts: [],
    bookingSummary: {
      activeBookingCount: 0,
      cancelledBookingCount: 0,
      completedBookingCount: 0,
      noShowBookingCount: 0,
      participatingBookingCount: 0,
      partnerClosedBookingCount: 0,
      preferredBookingCount: 0,
      selectedBookingCount: 0,
      workingBookingCount: 0,
    },
    devices: [],
    displayName: 'Partner One',
    documents: [],
    earnings: [],
    id: 'partner-1',
    kyc: {
      status: 'APPROVED',
    },
    legalName: 'Partner One Legal',
    participants: [],
    payoutBatches: [],
    preferredBookings: [],
    reports: [],
    sanctions: [],
    selectedBookings: [],
    services: [],
    sessions: [],
    sharedDeviceMatches: [],
    status: 'ONLINE_AVAILABLE',
    user: {
      fileAssets: [],
      fullName: 'Partner One',
      id: 'user-1',
      phone: '+84900000002',
      pushDevices: [],
    },
    userId: 'user-1',
    verification: {
      status: 'APPROVED',
    },
    verificationLogs: [],
    walletWithdrawalRequests: [],
  } as unknown as AdminProvider;
}
