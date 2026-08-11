import { describe, expect, it } from 'vitest';

import { PartnerDetailFastOverview } from './partner-detail-fast-overview';
import type { ProviderDetail } from './partner-detail-types';

describe('PartnerDetailFastOverview', () => {
  it('builds the bounded operator overview from summary data', () => {
    const view = PartnerDetailFastOverview({
      bookingArchive: [],
      cashDebt: 0,
      dispatchPolicy: {
        backupRadiusMeters: 10_000,
        locationFreshnessMinutes: 90,
        responseWindowMinutes: 10,
      },
      kycEvidence: {
        allRequiredApproved: true,
        missingDocuments: [],
        nextAction: 'No KYC action required.',
      },
      latestAccessAt: '2026-07-27T09:00:00.000Z',
      payoutOps: {
        blockers: [],
        hold: null,
        status: 'DEFERRED',
        tone: 'pending',
      },
      provider: {
        appActivitySummary: { activityStatus: 'active' },
        city: 'Ho Chi Minh City',
        devices: [],
        displayName: 'Partner One',
        id: 'partner-1',
        legalName: 'Partner Legal Name',
        kyc: { status: 'APPROVED' },
        participants: [],
        status: 'OFFLINE',
        user: {
          createdAt: '2026-07-01T00:00:00.000Z',
          phone: '+84900000000',
        },
        verification: { status: 'APPROVED' },
      } as unknown as ProviderDetail,
      servicePricing: {
        readyCount: 2,
        rows: [{ id: 'service-1' }, { id: 'service-2' }],
      },
    });

    const props = readRecord(readRecord(view)?.props);
    const actions = props?.actionItems as readonly Record<string, unknown>[];
    const workItems = props?.workItems as readonly Record<string, unknown>[];
    const workspaceLinks = props?.workspaceLinks as readonly Record<string, unknown>[];

    expect(props).toMatchObject({
      accountControlsHref: '/partner-controls?details=sanctions&q=partner-1',
      fullHref: '/partners/partner-1?section=full',
      partnerName: 'Partner One',
    });
    expect(actions.map((action) => action.id)).toEqual(['location-freshness', 'push-reachability']);
    expect(workItems.map((item) => item.label)).toEqual(['Approval', 'Service', 'Availability', 'Wallet']);
    expect(workspaceLinks.map((item) => item.label)).toEqual([
      'Approval & profile',
      'Work readiness',
      'Booking evidence',
      'Money',
      'History & controls',
    ]);
    expect(props).not.toHaveProperty('overviewCards');
  });
});

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
