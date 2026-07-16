import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { adminGet } from '../../../lib/admin-api';
import { shouldLoadBookingDetailMarketplaceProviders } from './booking-detail-marketplace-provider-loader';
import BookingDetailPage, { readBookingDetailWorkspace } from './page';

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

describe('BookingDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockReset();
  });

  it('requests only the operations policy keys needed by the booking detail readout', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: 'booking-policy-load' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    const policyHref = mockedAdminGet.mock.calls
      .map(([href]) => href)
      .find((href) => href.startsWith('/admin/operational-policy'));
    expect(policyHref).toBe(
      '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_location_max_age_minutes%2Cmatching.travel_buffer_minutes%2Cmatching.preferred_accept_mode%2Cmatching.marketplace_open_mode%2Cwallet.negative_balance_gate%2Cdecision.action_evidence_gate_mode%2Ccash.settlement_clearance_policy%2Cmatching.first_pick_expiry_action_policy%2Ccancellation.after_match_policy%2Cno_show.evidence_requirement_policy%2Cno_show.partner_report_policy%2Cnotification.partner_alert_channel%2Cpayout.batch_cycle_policy',
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/bookings/booking-policy-load/notifications?take=12', []);
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/bookings/booking-policy-load/marketplace-providers?take=40',
      [],
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/operational-policy', []);
  });

  it('loads notification diagnostics only when the full booking detail view is requested', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    await expect(
      BookingDetailPage({
        params: Promise.resolve({ id: 'booking-diagnostics-load' }),
        searchParams: Promise.resolve({ section: 'full' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-diagnostics-load/notifications?take=12',
      [],
    );
  });

  it('does not load notification diagnostics for ordinary operators even when full detail is requested', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['BOOKINGS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });

    await expect(
      BookingDetailPage({
        params: Promise.resolve({ id: 'booking-ordinary-full-load' }),
        searchParams: Promise.resolve({ section: 'full' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/bookings/booking-ordinary-full-load/notifications?take=12',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-ordinary-full-load?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/bookings/booking-ordinary-full-load?includeDiagnostics=true',
      null,
    );
  });

  it('loads booking diagnostics through the detail API only for Master Admins', async () => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    await expect(
      BookingDetailPage({
        params: Promise.resolve({ id: 'booking-master-full-load' }),
        searchParams: Promise.resolve({ section: 'full' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-master-full-load?includeDiagnostics=true',
      null,
    );
  });

  it('maps booking detail workspace query values without breaking the legacy full link', () => {
    expect(readBookingDetailWorkspace({})).toBe('overview');
    expect(readBookingDetailWorkspace({ section: 'records' })).toBe('records');
    expect(readBookingDetailWorkspace({ section: 'diagnostics' })).toBe('diagnostics');
    expect(readBookingDetailWorkspace({ section: 'full' })).toBe('diagnostics');
    expect(readBookingDetailWorkspace({ section: ['records', 'diagnostics'] })).toBe('records');
    expect(readBookingDetailWorkspace({ section: 'unknown' })).toBe('overview');
  });

  it('loads marketplace provider candidates only for non-terminal booking details', () => {
    expect(shouldLoadBookingDetailMarketplaceProviders(null)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'COMPLETED' } as never)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'CANCELLED' } as never)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'OPEN_MATCHING' } as never)).toBe(true);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'IN_SERVICE' } as never)).toBe(true);
  });

  it('uses shared Vuexy badge atoms for advanced booking record headings', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">Evidence</span>');
    expect(source).not.toContain('<span className="pill pill-success">Dispatch</span>');
    expect(source).not.toContain('<span className="pill pill-warn">History</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">Settlement</span>');
  });

  it('keeps deep diagnostic booking records behind the already-resolved Developer/System gate', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain('showDeveloperDiagnosticsDisclosure');
    expect(source).not.toContain('AdminDeveloperSystemSection');
    expect(source).toContain("detailWorkspace === 'diagnostics' && showDeveloperDiagnosticsDisclosure");
    expect(source.indexOf("{detailWorkspace === 'diagnostics' && showDeveloperDiagnosticsDisclosure && (")).toBeLessThan(
      source.indexOf('<BookingOperatingLedgerSection'),
    );
    expect(source.indexOf("{detailWorkspace === 'diagnostics' && showDeveloperDiagnosticsDisclosure && (")).toBeLessThan(
      source.indexOf('<BookingRecordDetailSections'),
    );
  });

  it('renders overview, operational records, and diagnostics as separate booking workspaces', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain('id="booking-workspace-selector"');
    expect(source).toContain('ariaLabel="Booking detail workspaces"');
    expect(source).toContain("detailWorkspace === 'overview'");
    expect(source).toContain("detailWorkspace === 'records' && showOperatorAdvancedRecordsDisclosure");
    expect(source).toContain("detailWorkspace === 'diagnostics' && showDeveloperDiagnosticsDisclosure");
    expect(source.indexOf("detailWorkspace === 'records' && showOperatorAdvancedRecordsDisclosure")).toBeLessThan(
      source.indexOf('<BookingEvidenceSections'),
    );
  });
});
