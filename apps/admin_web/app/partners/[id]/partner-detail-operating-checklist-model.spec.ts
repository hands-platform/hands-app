import type { ProviderDetail } from './partner-detail-types';
import { buildProviderBookingAcceptance } from './partner-detail-acceptance-model';
import { buildPartnerOperatingChecklist } from './partner-detail-operating-checklist-model';

describe('Partner operating checklist model', () => {
  it('keeps account, booking, service, and app blockers visible', () => {
    const provider = {
      id: 'partner',
      blockedAt: '2026-07-30T00:00:00.000Z',
      blockedReason: 'Manual review',
      currentLocationUpdatedAt: null,
      devices: [],
      sessions: [],
      user: { pushDevices: [] },
    } as unknown as ProviderDetail;
    const pricing = { readyCount: 0, rows: [] };
    const policy = {
      backupRadiusMeters: 10_000,
      locationFreshnessMinutes: 30,
      responseWindowMinutes: 10,
    };
    const bookingAcceptance = buildProviderBookingAcceptance(provider, pricing, policy);
    const rows = buildPartnerOperatingChecklist(provider, bookingAcceptance, pricing, policy);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'Account', tone: 'blocked' }),
        expect.objectContaining({ area: 'Booking participation', tone: 'blocked' }),
        expect.objectContaining({ area: 'Services', tone: 'blocked' }),
        expect.objectContaining({ area: 'App connection', tone: 'pending' }),
      ]),
    );
  });
});
