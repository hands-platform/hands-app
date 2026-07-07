import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { shouldLoadBookingDetailMarketplaceProviders } from './booking-detail-marketplace-provider-loader';
import BookingDetailPage from './page';

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

describe('BookingDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
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

  it('keeps deep diagnostic booking records behind the Developer/System section gate', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain('AdminDeveloperSystemSection');
    expect(source).toContain('<AdminDeveloperSystemSection>');
    expect(source.indexOf('<AdminDeveloperSystemSection>')).toBeLessThan(
      source.indexOf('<BookingOperatingLedgerSection'),
    );
    expect(source.indexOf('<AdminDeveloperSystemSection>')).toBeLessThan(
      source.indexOf('<BookingRecordDetailSections'),
    );
  });
});
