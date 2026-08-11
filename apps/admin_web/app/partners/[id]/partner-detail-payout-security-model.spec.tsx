import { describe, expect, it } from 'vitest';

import {
  buildProviderPayoutOps,
  buildProviderSecuritySummary,
  cashFeeDebtAmount,
  primaryBankAccount,
} from './partner-detail-payout-security-model';
import type { ProviderDetail } from './partner-detail-types';

describe('partner detail payout and security model', () => {
  it('blocks payout when first revenue exists but payout evidence is incomplete', () => {
    const provider = {
      agreements: [],
      bankAccounts: [],
      earnings: [
        {
          grossAmount: 200_000,
          id: 'earning-1',
          netAmount: 150_000,
          platformFee: 40_000,
          status: 'AVAILABLE',
          withholdingAmount: 10_000,
        },
      ],
      id: 'partner-1',
    } as unknown as ProviderDetail;

    const payout = buildProviderPayoutOps(provider);

    expect(payout.status).toBe('BLOCKED');
    expect(payout.blockers).toEqual([
      'Bank MISSING.',
      'Residential address missing.',
      'Agreements 0/5.',
    ]);
    expect(payout.cards).toHaveLength(4);
  });

  it('uses the primary bank first and identifies unsettled cash fee debt', () => {
    const provider = {
      bankAccounts: [
        { id: 'bank-1', isPrimary: false, status: 'APPROVED' },
        { id: 'bank-2', isPrimary: true, status: 'PENDING_REVIEW' },
      ],
      earnings: [
        {
          booking: { payment: { method: 'CASH' } },
          grossAmount: 100_000,
          id: 'earning-debt',
          netAmount: -20_000,
          platformFee: 20_000,
          status: 'AVAILABLE',
          withholdingAmount: 0,
        },
      ],
      id: 'partner-1',
    } as unknown as ProviderDetail;

    expect(primaryBankAccount(provider)?.id).toBe('bank-2');
    expect(cashFeeDebtAmount(provider)).toBe(20_000);
  });

  it('flags account, device, session and shared-device security evidence', () => {
    const provider = {
      blockedAt: '2026-07-27T00:00:00.000Z',
      blockedReason: 'Identity review',
      devices: [{ blockedAt: '2026-07-27T00:00:00.000Z', enabled: false }],
      id: 'partner-1',
      sessions: [{ suspicious: true, suspiciousReason: 'Device mismatch' }],
      sharedDeviceMatches: [{ id: 'shared-1' }],
    } as unknown as ProviderDetail;

    const security = buildProviderSecuritySummary(provider);

    expect(security.followUpNeeded).toBe(true);
    expect(security.cards.map((card) => card.status)).toEqual([
      'BLOCKED',
      'STALE',
      '1 BLOCKED',
      '1 CHECK',
      '1 MATCH',
    ]);
  });
});
