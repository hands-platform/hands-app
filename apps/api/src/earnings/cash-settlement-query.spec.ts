import { describe, expect, it } from 'vitest';

import {
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  cashSettlementDebtCteSql,
  cashSettlementDebtFilterSql,
} from './cash-settlement-query';

describe('cash settlement debt query', () => {
  it('derives remaining debt from the immutable earning amount and allocation ledger', () => {
    const sql = cashSettlementDebtCteSql().strings.join('?');

    expect(sql).toContain('SUM(allocation.amount)');
    expect(sql).toContain('ABS(earning."netAmount")::bigint AS "originalDebtAmount"');
    expect(sql).toContain('AS "allocatedAmount"');
    expect(sql).toContain('GREATEST(');
    expect(sql).toContain('AS "remainingDebtAmount"');
    expect(sql).toContain('earning."payoutBatchId" IS NULL');
    expect(sql).toContain('booking."matchedAt" IS NOT NULL OR booking."selectedProviderId" IS NOT NULL');
  });

  it('excludes fully allocated rows and applies high exposure to remaining debt', () => {
    const query = cashSettlementDebtFilterSql({ queue: 'high-debt' });
    const sql = query.strings.join('?');

    expect(sql).toContain('debt."remainingDebtAmount" > 0');
    expect(sql).toContain('debt."remainingDebtAmount" >=');
    expect(query.values).toContain(CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD);
  });

  it('keeps payment anomalies and literal search terms in the same server-side predicate', () => {
    const query = cashSettlementDebtFilterSql({ q: '100%_proof', queue: 'payment-check' });
    const sql = query.strings.join('?');

    expect(sql).toContain('debt."paymentMethod" IS NULL');
    expect(sql).toContain('debt."providerDisplayName"');
    expect(sql).toContain('search_ledger.reference');
    expect(query.values).toContain('%100\\%\\_proof%');
  });
});
