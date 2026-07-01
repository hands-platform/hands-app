import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const seedSource = readFileSync(resolve(__dirname, '..', 'prisma', 'seed.js'), 'utf8');

describe('Prisma seed contract', () => {
  it('keeps Finance admin smoke detail fixtures available without a DB reset', () => {
    expect(seedSource).toContain('seed-finance-smoke-booking');
    expect(seedSource).toContain('seed-finance-smoke-clearing');
    expect(seedSource).toContain('seed-finance-smoke-journal-batch');
    expect(seedSource).toContain('seed-finance-smoke-bank-transaction');
    expect(seedSource).toContain('BookingPaymentClearingEntryType.CUSTOMER_PAYMENT_CAPTURED');
    expect(seedSource).toContain('AccountingJournalEntrySide.DEBIT');
    expect(seedSource).toContain('AccountingJournalEntrySide.CREDIT');
  });
});
