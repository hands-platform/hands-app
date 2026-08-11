import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import type { AdminBookingSettlementSnapshot } from '../../../lib/admin-api';
import { buildBookingSettlementSnapshotRowsCsvContent } from '../tax-settlement-page-model';

const benchmark = process.env.HANDS_RUN_SETTLEMENT_AUDIT_BENCHMARK === '1' ? it : it.skip;

describe('booking settlement audit production-like benchmark', () => {
  benchmark('serializes bounded export rows at 10k and 100k scale', () => {
    for (const rowCount of [10_000, 100_000]) {
      const rows = Array.from({ length: rowCount }, (_, index) => benchmarkRow(index));
      const heapBefore = process.memoryUsage().heapUsed;
      const startedAt = performance.now();
      const csv = buildBookingSettlementSnapshotRowsCsvContent(rows, {
        activeFilters: 'range=all;review=integrity-exceptions',
        generatedAt: '2026-08-10T00:00:00.000Z',
        generatedBy: 'benchmark',
        sort: 'oldest',
        timezone: 'Asia/Ho_Chi_Minh',
        totalRows: rowCount,
      });
      const elapsedMs = performance.now() - startedAt;
      const heapAfter = process.memoryUsage().heapUsed;
      const csvBytes = Buffer.byteLength(csv, 'utf8');

      console.info(JSON.stringify({
        csvMiB: Number((csvBytes / 1024 / 1024).toFixed(2)),
        elapsedMs: Number(elapsedMs.toFixed(2)),
        heapDeltaMiB: Number(((heapAfter - heapBefore) / 1024 / 1024).toFixed(2)),
        rowCount,
        rowsPerSecond: Math.round(rowCount / (elapsedMs / 1000)),
        run: 'cold-single-process',
      }));

      expect(csv).toContain(`"snapshot-${rowCount - 1}"`);
      expect(csvBytes).toBeGreaterThan(rowCount * 100);
    }
  }, 60_000);
});

const sharedHealth = {
  allocation: {
    companyCouponExpense: 0,
    customerPaymentAmount: 500_000,
    delta: 0,
    partnerPayoutAmount: 320_000,
    partnerWithholdingTotal: 80_000,
    platformFeeGross: 100_000,
  },
  blockers: [
    {
      amount: 500_000,
      blockingCloseout: true,
      code: 'CANONICAL_CLEARING_MISSING',
      dueAt: null,
      nextAction: 'Review payment clearing evidence.',
      owner: 'finance-operations',
      ownerTeam: 'Finance operations',
      priority: 30,
      remediationHref: '/finance-tax/payment-clearing?review=open',
      severity: 'BLOCKER',
    },
  ],
  checkedAt: '2026-08-10T00:00:00.000Z',
  checks: {
    allocation: 'PASS',
    bankMatch: 'FAIL',
    canonicalClearing: 'FAIL',
    canonicalJournal: 'PASS',
    couponPolicy: 'NOT_APPLICABLE',
    paymentFeePolicy: 'PASS',
    reversal: 'NOT_APPLICABLE',
    taxPeriod: 'PASS',
  },
  evidence: {
    canonicalClearing: {
      count: 0,
      ids: [],
      matchedAmount: 0,
      required: true,
      state: 'FAIL',
      unmatchedAmount: 500_000,
    },
    canonicalJournal: { count: 1, ids: ['journal-benchmark'], state: 'PASS' },
    reversal: {
      clearingCount: 0,
      count: 0,
      ids: [],
      journalCount: 0,
      lifecycle: 'NONE',
      state: 'NOT_APPLICABLE',
    },
  },
  formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
  state: 'ACTION_REQUIRED',
} as const;

function benchmarkRow(index: number) {
  return {
    booking: { closedAt: null, id: `booking-${index}`, status: 'COMPLETED' },
    bookingId: `booking-${index}`,
    closedAt: null,
    companyOutputVat: 10_000,
    currency: 'VND',
    customerPaymentAmount: 500_000,
    customerProfileId: `customer-${index % 5000}`,
    id: `snapshot-${index}`,
    monthlyPeriod: '2026-08',
    partnerPitAmount: 30_000,
    partnerPayoutAmount: 320_000,
    partnerTaxableRevenue: 400_000,
    partnerVatAmount: 50_000,
    partnerWithholdingTotal: 80_000,
    paymentMethod: 'CARD',
    paymentProcessingFee: 12_000,
    platformFeeGross: 100_000,
    platformFeeNetRevenue: 90_000,
    postedAt: new Date(1_754_000_000_000 + index * 1000).toISOString(),
    providerProfileId: `partner-${index % 3000}`,
    settlementAuditHealth: sharedHealth,
    settlementStatus: 'POSTED',
    taxStatus: 'OPEN',
  } as unknown as AdminBookingSettlementSnapshot;
}
