import { describe, expect, it } from 'vitest';

import { buildPartnerApprovalChecklist } from './partner-detail-approval-checklist-model';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';

const policy: PartnerDispatchPolicy = {
  backupRadiusMeters: 10_000,
  locationFreshnessMinutes: 90,
  responseWindowMinutes: 10,
};

describe('partner detail approval checklist model', () => {
  it('keeps withdrawal setup deferred before first revenue while reporting real approval blockers', () => {
    const provider = {
      id: 'partner-1',
      status: 'OFFLINE',
      displayName: 'Moon',
      legalName: 'Nguyen Moon',
      user: {
        phone: '+84900000000',
        pushDevices: [],
      },
      documents: [],
      earnings: [],
      kyc: { status: 'DRAFT' },
    } as unknown as ProviderDetail;

    const checklist = buildPartnerApprovalChecklist(provider, policy);

    expect(checklist.items.find((item) => item.label === 'Withdrawal profile')).toMatchObject({
      ok: true,
      status: 'DEFERRED',
    });
    expect(checklist.items.find((item) => item.label === 'KYC status')?.ok).toBe(false);
    expect(checklist.items.find((item) => item.label === 'Location freshness')?.ok).toBe(false);
    expect(checklist.ready).toBe(false);
  });
});
