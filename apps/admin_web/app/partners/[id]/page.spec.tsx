import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { adminGet } from '../../../lib/admin-api';
import ProviderDetailPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const providerDetailSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('ProviderDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockReset();
  });

  it('requests only the operations policy keys needed by partner dispatch readiness', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    await expect(
      ProviderDetailPage({ params: Promise.resolve({ id: 'partner-policy-load' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    const policyHref = mockedAdminGet.mock.calls
      .map(([href]) => href)
      .find((href) => href.startsWith('/admin/operational-policy'));
    expect(policyHref).toBe(
      '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_location_max_age_minutes',
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/operational-policy', []);
  });

  it('renders the lightweight partner workspace index on the shared Vuexy page surface', async () => {
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
      if (href === '/admin/partners/partner-1/overview') {
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
    expect(markup).toContain('Partner detail workspaces');
    expect(markup).toContain('Choose workspace');
    expect(markup).toContain('All Partner chats');
    expect(markup).not.toContain('Partner control workspace');
    expect(mockedGetCurrentAdminOperatorAccess).toHaveBeenCalledTimes(1);
  });

  it('requests partner detail without diagnostics for ordinary operators', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    await expect(
      ProviderDetailPage({
        params: Promise.resolve({ id: 'partner-no-diagnostics' }),
        searchParams: Promise.resolve({ access: 'diagnostics', section: 'access' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-no-diagnostics?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/partners/partner-no-diagnostics?includeDiagnostics=true',
      null,
    );
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

    await expect(
      ProviderDetailPage({
        params: Promise.resolve({ id: 'partner-master-diagnostics' }),
        searchParams: Promise.resolve({ section: 'access' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/partners/partner-master-diagnostics?includeDiagnostics=false',
      null,
    );

    mockedAdminGet.mockClear();

    await expect(
      ProviderDetailPage({
        params: Promise.resolve({ id: 'partner-master-diagnostics' }),
        searchParams: Promise.resolve({ access: 'diagnostics', section: 'access' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

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
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/reviews?')),
    ).toBe(false);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(false);

    mockedAdminGet.mockClear();

    const recordsPage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-control' }),
      searchParams: Promise.resolve({ control: 'records', section: 'control' }),
    });
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/reviews?')),
    ).toBe(true);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(true);

    mockedAdminGet.mockClear();

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
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/reviews?')),
    ).toBe(false);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/partner-customer-reviews?')),
    ).toBe(false);
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

    expect(readinessMarkup).toContain('Partner readiness and access controls');
    expect(readinessMarkup).toContain('Access workspace view');
    expect(readinessMarkup).toContain('Marketplace booking gate decision');
    expect(readinessMarkup).not.toContain('Device and session activity');

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
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-dossier?includeDiagnostics=false') {
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
    expect(approvalMarkup).toContain('KYC decision');
    expect(approvalMarkup).not.toContain('Required approval evidence');
    expect(approvalMarkup).not.toContain('Review history');
    expect(approvalMarkup).not.toContain('Partner wallet detail');
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/provider-wallet/withdrawal-requests')),
    ).toBe(false);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments')),
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
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/provider-wallet/withdrawal-requests')),
    ).toBe(false);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments')),
    ).toBe(false);

    mockedAdminGet.mockClear();
    const financePage = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-dossier' }),
      searchParams: Promise.resolve({ dossier: 'finance', section: 'dossier' }),
    });
    const financeMarkup = renderToStaticMarkup(financePage);

    expect(financeMarkup).toContain('Partner finance records');
    expect(financeMarkup).toContain('Partner wallet detail');
    expect(financeMarkup).not.toContain('Partner registration dossier');
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/provider-wallet/withdrawal-requests')),
    ).toBe(true);
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/wallet-adjustments')),
    ).toBe(true);
  });

  it('keeps booking record filters visible and scoped to the bookings workspace', async () => {
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

    const page = await ProviderDetailPage({
      params: Promise.resolve({ id: 'partner-bookings' }),
      searchParams: Promise.resolve({ range: '30d', section: 'bookings' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Booking and chat evidence');
    expect(markup).toContain('Record date filter');
    expect(markup).toContain('Filtered booking archive');
    expect(markup).toContain('Filtered activity');
    expect(markup).toContain('type="hidden" name="section" value="bookings"');
    expect(markup).toContain('/partners/partner-1?section=bookings');
  });

  it('keeps partner overview on the lightweight endpoint without diagnostics flags', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['PARTNERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    await expect(
      ProviderDetailPage({
        params: Promise.resolve({ id: 'partner-overview' }),
        searchParams: Promise.resolve({ section: 'overview' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

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
    expect(providerDetailSource).toContain(
      'status={hasCashFeeDebt ? <><MoneyText amount={cashFeeDebtTotal} /> open debt</> : \'Reference\'}',
    );
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
    expect(providerDetailSource).toContain(
      "canLoadPartnerDiagnostics && detailSection === 'control' && controlView === 'reference' ? (",
    );
    expect(providerDetailSource).toContain(
      "const partnerBookingOpsLedgerDiagnosticSection = canLoadPartnerDiagnostics && detailSection === 'bookings' ? (",
    );
    expect(providerDetailSource).toContain(
      'const partnerDeviceSessionDiagnosticSection = shouldLoadAccessDiagnostics ? (',
    );
    expect(
      providerDetailSource.indexOf('const partnerCommandSnapshotDiagnosticSection = shouldLoadAccessDiagnostics ? ('),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailCommandSnapshotSection'),
    );
    expect(
      providerDetailSource.indexOf("canLoadPartnerDiagnostics && detailSection === 'control' && controlView === 'reference' ? ("),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailFullRecordIndexSection'),
    );
    expect(
      providerDetailSource.indexOf("canLoadPartnerDiagnostics && detailSection === 'control' && controlView === 'reference' ? ("),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailOperatingLedgerSection'),
    );
    expect(
      providerDetailSource.indexOf('const partnerDeviceSessionDiagnosticSection = shouldLoadAccessDiagnostics ? ('),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailDeviceSessionActivitySection'),
    );
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

  it('uses operator-facing record wording instead of diagnostic snapshot copy', () => {
    expect(providerDetailSource).toContain("title: 'Location record'");
    expect(providerDetailSource).toContain('Address record metadata missing');
    expect(providerDetailSource).not.toContain("title: 'Location snapshot'");
    expect(providerDetailSource).not.toContain('Address snapshot metadata missing');
  });
});

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
    verificationLogs: [],
    walletWithdrawalRequests: [],
  } as unknown as AdminProvider;
}
