import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { adminGet } from '../../../lib/admin-api';
import {
  readBookingDetailCheckpoint,
  readBookingDetailDiagnosticsView,
  readBookingDetailOverviewView,
  readBookingDetailReturnHref,
  readBookingDetailWorkspace,
} from './booking-detail-page-params';
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

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('BookingDetailPage data loading', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['BOOKINGS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
  });

  it('loads the booking and scoped operating policies for ordinary operators', async () => {
    await expect(
      BookingDetailPage({
        params: Promise.resolve({ id: 'booking-operator-load' }),
        searchParams: Promise.resolve({ section: 'records' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-operator-load?includeDiagnostics=false',
      null,
    );
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.startsWith('/admin/operational-policy?keys=')),
    ).toBe(true);
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-operator-load/notifications?take=8',
      [],
    );
    expect(mockedAdminGet.mock.calls.some(([href]) => href.includes('/marketplace-providers?take='))).toBe(false);
  });

  it('loads diagnostics for Master Admins while retaining operational notification evidence', async () => {
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
        params: Promise.resolve({ id: 'booking-master-load' }),
        searchParams: Promise.resolve({ section: 'diagnostics' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-master-load?includeDiagnostics=true',
      null,
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-master-load/notifications?take=8',
      [],
    );
  });

  it('keeps Master Admin diagnostics out of the default payload while loading operational notifications', async () => {
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
        params: Promise.resolve({ id: 'booking-master-default' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-master-default?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bookings/booking-master-default/notifications?take=8',
      [],
    );
  });

  it.each([
    [{ section: 'diagnostics' }, 'booking-legacy-diagnostics'],
    [{ section: 'full' }, 'booking-legacy-full'],
    [{ diagnostics: 'settlement', section: 'diagnostics' }, 'booking-legacy-settlement'],
  ])('keeps legacy query URLs compatible with the restored detail page', async (searchParams, bookingId) => {
    await expect(
      BookingDetailPage({
        params: Promise.resolve({ id: bookingId }),
        searchParams: Promise.resolve(searchParams),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockedAdminGet).toHaveBeenCalledWith(
      `/admin/bookings/${bookingId}?includeDiagnostics=false`,
      null,
    );
  });

  it('maps preserved booking detail query values without changing old links', () => {
    expect(readBookingDetailWorkspace({})).toBe('overview');
    expect(readBookingDetailWorkspace({ section: 'records' })).toBe('records');
    expect(readBookingDetailWorkspace({ section: 'diagnostics' })).toBe('diagnostics');
    expect(readBookingDetailWorkspace({ section: 'full' })).toBe('diagnostics');
    expect(readBookingDetailWorkspace({ section: ['records', 'diagnostics'] })).toBe('records');
    expect(readBookingDetailWorkspace({ section: 'unknown' })).toBe('overview');
  });

  it('keeps the legacy diagnostics parser stable for external links', () => {
    expect(readBookingDetailDiagnosticsView({})).toBe('history');
    expect(readBookingDetailDiagnosticsView({ diagnostics: 'history' })).toBe('history');
    expect(readBookingDetailDiagnosticsView({ diagnostics: 'settlement' })).toBe('settlement');
    expect(readBookingDetailDiagnosticsView({ diagnostics: ['settlement', 'history'] })).toBe('settlement');
    expect(readBookingDetailDiagnosticsView({ diagnostics: 'unknown' })).toBe('history');
  });

  it('keeps the legacy overview parser stable for external links', () => {
    expect(readBookingDetailOverviewView({})).toBe('command');
    expect(readBookingDetailOverviewView({ overview: 'command' })).toBe('command');
    expect(readBookingDetailOverviewView({ overview: 'activity' })).toBe('activity');
    expect(readBookingDetailOverviewView({ overview: ['activity', 'command'] })).toBe('activity');
    expect(readBookingDetailOverviewView({ overview: 'unknown' })).toBe('command');
  });

  it('accepts only the four booking checkpoint query values', () => {
    expect(readBookingDetailCheckpoint({ checkpoint: 'CUSTOMER_CONTACTED' })).toBe('CUSTOMER_CONTACTED');
    expect(readBookingDetailCheckpoint({ checkpoint: 'PROVIDER_CONTACTED' })).toBe('PROVIDER_CONTACTED');
    expect(readBookingDetailCheckpoint({ checkpoint: 'LOCATION_CHECKED' })).toBe('LOCATION_CHECKED');
    expect(readBookingDetailCheckpoint({ checkpoint: ['PAYMENT_REVIEWED', 'LOCATION_CHECKED'] })).toBe(
      'PAYMENT_REVIEWED',
    );
    expect(readBookingDetailCheckpoint({ checkpoint: 'DELETE_BOOKING' })).toBeNull();
    expect(readBookingDetailCheckpoint({})).toBeNull();
  });

  it('preserves only approved internal booking, chat evidence, and Vietnam overview return paths', () => {
    expect(readBookingDetailReturnHref({ returnTo: '/bookings?view=matching&sort=oldest&page=2' })).toBe(
      '/bookings?view=matching&sort=oldest&page=2',
    );
    expect(readBookingDetailReturnHref({ returnTo: '/bookings/completed?view=closeout' })).toBe(
      '/bookings/completed?view=closeout',
    );
    expect(
      readBookingDetailReturnHref({
        returnTo: '/bookings/post-match-cancellations?view=manual-decision&range=7d#booking-booking-1',
      }),
    ).toBe('/bookings/post-match-cancellations?view=manual-decision&range=7d#booking-booking-1');
    expect(
      readBookingDetailReturnHref({ returnTo: '/bookings/post-match-cancellations?view=no-show' }),
    ).toBe('/bookings/post-match-cancellations?view=no-show');
    expect(
      readBookingDetailReturnHref({
        returnTo: '/bookings/post-match-cancellations?view=post-match-cancellations',
      }),
    ).toBe('/bookings/post-match-cancellations?view=post-match-cancellations');
    expect(
      readBookingDetailReturnHref({
        returnTo: '/vietnam-overview?view=live&region=hcm&signals=online%2Cbookings#vietnam-operating-map',
      }),
    ).toBe('/vietnam-overview?view=live&region=hcm&signals=online%2Cbookings#vietnam-operating-map');
    expect(
      readBookingDetailReturnHref({
        returnTo: '/chat-archive?q=late&range=7d&sender=partner&page=2',
      }),
    ).toBe('/chat-archive?q=late&range=7d&sender=partner&page=2');
    expect(readBookingDetailReturnHref({ returnTo: 'https://example.com' })).toBe('/bookings');
    expect(readBookingDetailReturnHref({ returnTo: '/bookings\\..\\admin' })).toBe('/bookings');
    expect(readBookingDetailReturnHref({}, '/bookings/post-match-cancellations')).toBe(
      '/bookings/post-match-cancellations',
    );
  });

  it('keeps every common decision fragment connected to a rendered detail target', () => {
    const decisionSource = readFileSync('lib/booking-command-decision-strip.ts', 'utf8');
    const renderedSources = [
      readFileSync('app/bookings/[id]/page.tsx', 'utf8'),
      readFileSync('app/bookings/[id]/booking-action-status-sections.tsx', 'utf8'),
    ].join('\n');
    const fragments = [...decisionSource.matchAll(/href: '#([A-Za-z0-9_-]+)'/gu)].map(
      (match) => match[1],
    );

    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      expect(renderedSources).toContain(`id="${fragment}"`);
    }
  });

  it('retains the marketplace loader policy', () => {
    expect(shouldLoadBookingDetailMarketplaceProviders(null)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'COMPLETED' } as never)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'CANCELLED' } as never)).toBe(false);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'OPEN_MATCHING' } as never)).toBe(true);
    expect(shouldLoadBookingDetailMarketplaceProviders({ status: 'IN_SERVICE' } as never)).toBe(true);
  });

  it('does not present stale handling checkpoints as open work after a booking ends', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain('!BOOKING_DETAIL_TERMINAL_STATUSES.has(booking.status) &&');
    expect(source).toContain("opsTaskCards.some((task) => task.status !== 'DONE')");
  });
});

describe('BookingDetailPage section visibility', () => {
  const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

  it('hides the captured extended sections while retaining the operator booking record', () => {
    const hiddenSectionFlags = [
      'addressRadiusContract',
      'addressSupplyCheck',
      'alertRecords',
      'appliedOperationsPolicy',
      'bookingCloseoutChecklist',
      'bookingHandoffChecklist',
      'bookingStageStatus',
      'chatLifecycle',
      'chronologicalActivity',
      'communicationMovementHandoff',
      'customerWaitDecision',
      'dispatchChecklist',
      'liveServiceBoard',
      'marketplaceWalletEvidence',
      'matchingRuleStatus',
      'operatingLedger',
      'operatingSnapshot',
      'operatingTimeline',
      'operationsAuditRecords',
      'payoutBatchEligibility',
      'recordDetails',
      'recordOverview',
      'servicePricingEvidence',
    ] as const;

    hiddenSectionFlags.forEach((flag) => expect(source).toContain(`${flag}: false`));
    expect(source).toContain('<BookingCommandDecisionStripSection');
    expect(source).toContain('<BookingUnifiedDetailSection');
    expect(source).toContain('<BookingDetailChatTranscriptSection');
    expect(source).toContain('<BookingDetailLifecycleListSection');
    expect(source).toContain('<AdminReviewRecordsSection');
    expect(source).toContain('<BookingFullRecordIndex');
    expect(source).toContain('<BookingEvidenceSections');
    expect(source).toContain('<BookingOperatorQueueSections');
    expect(source).toContain('<BookingRecordDetailSections');
    expect(source).toContain('showOverviewSections={BOOKING_DETAIL_VISIBLE_SECTIONS.recordOverview}');
    expect(source).toContain('Developer/System diagnostics');
    expect(source).toContain('id="booking-developer-system"');
    expect(source).toContain('includeDiagnostics=');
  });

  it('keeps the operator decision queue before the complete booking summary', () => {
    const needsActionPosition = source.indexOf('<div id="booking-needs-action">');
    const summaryPosition = source.indexOf(
      '<BookingUnifiedDetailSection {...unifiedDetailProps} view="summary" />',
    );

    expect(needsActionPosition).toBeGreaterThan(-1);
    expect(summaryPosition).toBeGreaterThan(-1);
    expect(needsActionPosition).toBeLessThan(summaryPosition);
    expect(source.indexOf('href="#booking-needs-action"')).toBeLessThan(
      source.indexOf('href="#booking-unified-detail"'),
    );
  });

  it('renders the full record index only inside the explicit Developer/System boundary', () => {
    expect(source.indexOf('{includeDeveloperDiagnostics ? (')).toBeLessThan(
      source.indexOf('<BookingFullRecordIndex'),
    );
    expect(source.indexOf('<BookingFullRecordIndex')).toBeLessThan(
      source.indexOf('id="booking-developer-system"') === -1
        ? Number.POSITIVE_INFINITY
        : source.indexOf('</section>', source.indexOf('id="booking-developer-system"')),
    );
  });

  it('keeps Developer/System records behind the existing access check', () => {
    expect(source).toContain('canViewAdminDeveloperSystem');
    expect(source).toContain('const canViewDeveloperDiagnostics');
    expect(source).toContain("canViewDeveloperDiagnostics && detailWorkspace === 'diagnostics'");
    expect(source).toContain('?section=diagnostics#booking-developer-system');
    expect(source).toContain('{includeDeveloperDiagnostics ? (');
    expect(source.indexOf('{includeDeveloperDiagnostics ? (')).toBeLessThan(
      source.indexOf('id="booking-developer-system"'),
    );
  });
});
