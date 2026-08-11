import { describe, expect, it } from 'vitest';

import {
  buildPartnerCashDebtOriginRows,
  buildPartnerPayoutBatchRows,
  buildPartnerPayoutEarningRows,
  buildPartnerPayoutOperationsView,
  isCashFeeDebt,
} from './partner-detail-payout-rows-model';
import type { ProviderDetail } from './partner-detail-types';

type PartnerEarning = NonNullable<ProviderDetail['earnings']>[number];
type PartnerPayoutBatch = NonNullable<ProviderDetail['payoutBatches']>[number];

describe('partner detail payout rows model', () => {
  it('identifies unsettled cash fee debt without treating paid or non-cash rows as debt', () => {
    expect(isCashFeeDebt(earning({ netAmount: -20_000 }))).toBe(true);
    expect(isCashFeeDebt(earning({ netAmount: -20_000, status: 'PAID' }))).toBe(false);
    expect(
      isCashFeeDebt(earning({ booking: { payment: { method: 'CARD' } }, netAmount: -20_000 })),
    ).toBe(false);
  });

  it('builds bounded cash debt origins with settlement evidence precedence', () => {
    const rows = buildPartnerCashDebtOriginRows([
      earning({ bookingId: 'booking-1', settlementRef: 'BANK-REF-1' }),
      earning({
        id: 'earning-2',
        settlementRef: null,
        walletLedgerEntries: [
          { amount: -20_000, id: 'ledger-1', reference: 'LEDGER-REF-1', type: 'CASH_FEE_DEBT' },
        ],
      }),
      earning({ id: 'earning-3', settlementRef: null, walletLedgerEntries: [] }),
      earning({ id: 'earning-4' }),
      earning({ id: 'earning-5' }),
      earning({ id: 'earning-6' }),
    ]);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      bookingHref: '/bookings/booking-1',
      evidenceLabel: 'Ref BANK-REF-1',
      paymentMethod: 'CASH',
    });
    expect(rows[1]?.evidenceLabel).toBe('Ledger LEDGER-REF-1');
    expect(rows[2]?.evidenceLabel).toBe('Evidence needed');
    expect(rows[0]?.originLabel).toContain('HANDS fee/tax remains unpaid');
  });

  it('maps payout warnings, paid timestamps and wallet evidence without changing status semantics', () => {
    const rows = buildPartnerPayoutEarningRows([
      earning({
        bookingId: 'booking-debt',
        netAmount: -25_000,
        walletLedgerEntries: [
          {
            amount: -25_000,
            currency: 'VND',
            id: 'ledger-debt',
            reference: 'WALLET-REF',
            type: 'CASH_FEE_DEBT',
          },
        ],
      }),
      earning({
        booking: { payment: { method: 'CARD' } },
        id: 'earning-paid',
        netAmount: 80_000,
        paidAt: '2026-07-27T11:00:00.000Z',
        status: 'PAID',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      settlementRef: null,
      smallLabel: 'Settlement warning',
      statusLabel: 'CASH DEBT',
    });
    expect(textContent(rows[0]?.title)).toContain('Owes HANDS');
    expect(textContent(rows[0]?.walletLines)).toContain('WALLET-REF');
    expect(rows[1]?.statusLabel).toBe('PAID');
    expect(rows[1]?.smallLabel).toContain('Settled');
  });

  it('normalizes payout hold dates and preserves payout blockers', () => {
    const view = buildPartnerPayoutOperationsView({
      blockers: ['Bank MISSING.'],
      cards: [],
      hold: {
        expiresAt: undefined,
        reason: 'Manual finance review',
        startsAt: undefined,
      },
      status: 'BLOCKED',
      tone: 'blocked',
    } as never);

    expect(view).toEqual({
      blockers: ['Bank MISSING.'],
      cards: [],
      hold: {
        expiresAt: null,
        reason: 'Manual finance review',
        startsAt: null,
      },
      status: 'BLOCKED',
      tone: 'blocked',
    });
  });

  it('builds bounded payout batch links and operator evidence', () => {
    const rows = buildPartnerPayoutBatchRows([
      payoutBatch({ id: 'batch-1', transferRef: 'TRANSFER-1' }),
      payoutBatch({ id: 'batch-2' }),
      payoutBatch({ id: 'batch-3' }),
      payoutBatch({ id: 'batch-4' }),
      payoutBatch({ id: 'batch-5' }),
      payoutBatch({ id: 'batch-6' }),
    ]);

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      href: '/payouts#batch-1',
      id: 'batch-1',
      status: 'PENDING',
    });
    expect(rows[0]?.createdLine).toContain('TRANSFER-1');
    expect(rows[0]?.operatorEvidence?.[0]?.label).toBe('Created by');
  });
});

function earning(overrides: Record<string, unknown> = {}): PartnerEarning {
  return {
    booking: { payment: { method: 'CASH' } },
    bookingId: null,
    createdAt: '2026-07-27T10:00:00.000Z',
    currency: 'VND',
    grossAmount: 100_000,
    id: 'earning-1',
    netAmount: -20_000,
    platformFee: 15_000,
    settlementNotes: null,
    settlementRef: null,
    status: 'AVAILABLE',
    walletLedgerEntries: [],
    withholdingAmount: 5_000,
    ...overrides,
  } as unknown as PartnerEarning;
}

function payoutBatch(overrides: Record<string, unknown> = {}): PartnerPayoutBatch {
  return {
    createdAt: '2026-07-27T10:00:00.000Z',
    id: 'batch-1',
    status: 'PENDING',
    totalNetAmount: 80_000,
    transferRef: null,
    ...overrides,
  } as unknown as PartnerPayoutBatch;
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');

  const record = readRecord(value);
  return textContent(readRecord(record?.props)?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
