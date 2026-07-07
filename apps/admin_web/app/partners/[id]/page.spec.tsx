import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../../lib/admin-api';
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

const mockedAdminGet = vi.mocked(adminGet);
const providerDetailSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('ProviderDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
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

  it('renders the full partner detail header on the shared Vuexy page surface', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/partner-1') {
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

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('All Partner chats');
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

  it('keeps deep partner diagnostic records behind the Developer/System section gate', () => {
    expect(providerDetailSource).toContain('AdminDeveloperSystemSection');
    expect(providerDetailSource).toContain(
      'const partnerCommandSnapshotDiagnosticSection = await AdminDeveloperSystemSection({',
    );
    expect(providerDetailSource).toContain(
      'const partnerReferenceDiagnosticSection = await AdminDeveloperSystemSection({',
    );
    expect(providerDetailSource).toContain(
      'const partnerBookingOpsLedgerDiagnosticSection = await AdminDeveloperSystemSection({',
    );
    expect(providerDetailSource).toContain(
      'const partnerDeviceSessionDiagnosticSection = await AdminDeveloperSystemSection({',
    );
    expect(
      providerDetailSource.indexOf('const partnerCommandSnapshotDiagnosticSection = await AdminDeveloperSystemSection({'),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailCommandSnapshotSection'),
    );
    expect(
      providerDetailSource.indexOf('const partnerReferenceDiagnosticSection = await AdminDeveloperSystemSection({'),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailFullRecordIndexSection'),
    );
    expect(
      providerDetailSource.indexOf('const partnerReferenceDiagnosticSection = await AdminDeveloperSystemSection({'),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailOperatingLedgerSection'),
    );
    expect(
      providerDetailSource.indexOf('const partnerDeviceSessionDiagnosticSection = await AdminDeveloperSystemSection({'),
    ).toBeLessThan(
      providerDetailSource.indexOf('<PartnerDetailDeviceSessionActivitySection'),
    );
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
