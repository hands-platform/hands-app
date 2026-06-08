import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import type { PartnerListQueryDeps } from './partner-list-query';
import {
  buildPartnerShiftHandoff,
  partnerShiftCardClass,
  partnerShiftPillClass,
} from './partner-shift-handoff';

const now = new Date();

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-ready',
    displayName: 'Linh Wellness',
    legalName: 'Nguyen Thi Linh',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: now.toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    user: {
      id: 'user-1',
      phone: '+84900000000',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

const deps: PartnerListQueryDeps = {
  canAcceptBookingNow: (item) => item.id === 'partner-ready',
  dispatchReady: (item) => item.id === 'partner-ready',
  displayName: (item) => item.displayName ?? item.id,
  hasHardAcceptanceBlocker: (item) => Boolean(item.blockedAt),
  marketplaceEligibility: (item) => ({ eligible: item.id === 'partner-ready' }),
};

describe('partner shift handoff', () => {
  it('prioritizes cash fee debt as an immediate operations handoff item', () => {
    const handoff = buildPartnerShiftHandoff(
      [
        partner(),
        partner({
          id: 'partner-cash-debt',
          displayName: 'Cash Followup Partner',
          earnings: [
            {
              id: 'earning-debt',
              providerProfileId: 'partner-cash-debt',
              bookingId: 'booking-cash',
              grossAmount: 450000,
              platformFee: 120000,
              withholdingAmount: 0,
              netAmount: -120000,
              currency: 'VND',
              status: 'PENDING',
              createdAt: now.toISOString(),
            },
          ],
        }),
      ],
      DEFAULT_PROVIDER_OPS_POLICY,
      deps,
    );

    expect(handoff.tone).toBe('danger');
    expect(handoff.label).toBe('Immediate check');
    expect(handoff.headline).toBe('Collect cash-fee debt before more bookings');
    expect(handoff.primaryAction.href).toBe('/partners?review=cash-debt');
    expect(handoff.stats.find((item) => item.label === 'Cash debt')?.value).toBe('1');
    expect(handoff.actions[0]?.samples).toContain('Cash Followup Partner');
  });

  it('keeps dispatch-ready partners visible when no blocker facts are present', () => {
    const handoff = buildPartnerShiftHandoff([partner()], DEFAULT_PROVIDER_OPS_POLICY, deps);

    expect(handoff.tone).toBe('ok');
    expect(handoff.label).toBe('Dispatch ready');
    expect(handoff.stats.find((item) => item.label === 'Direct request ready')?.value).toBe('1');
    expect(handoff.actions[0]).toMatchObject({
      title: 'Keep ready partners warm for live requests',
      tone: 'ok',
    });
    expect(partnerShiftCardClass('danger')).toBe('ops-task-blocked');
    expect(partnerShiftCardClass('warn')).toBe('ops-task-pending');
    expect(partnerShiftCardClass('ok')).toBe('ops-task-done');
    expect(partnerShiftPillClass('danger')).toBe('pill-danger');
    expect(partnerShiftPillClass('warn')).toBe('pill-warn');
    expect(partnerShiftPillClass('info')).toBe('pill-info');
    expect(partnerShiftPillClass('ok')).toBe('pill-success');
  });
});
