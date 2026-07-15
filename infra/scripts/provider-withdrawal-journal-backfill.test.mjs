import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProviderWithdrawalBackfillCandidate,
  providerWithdrawalJournalCreateData,
} from './lib/provider-withdrawal-journal-backfill.mjs';

const request = {
  id: 'withdrawal-1',
  amount: 120000,
  currency: 'VND',
  status: 'PAID',
  createdAt: new Date('2026-07-01T01:00:00.000Z'),
  reviewedAt: new Date('2026-07-01T01:05:00.000Z'),
  paidAt: new Date('2026-07-01T01:05:00.000Z'),
  reviewedByAdminId: 'admin-1',
  transferRef: 'BANK-1',
  metadata: {
    bankPayout: {
      attachmentUrl: 'https://evidence.example/withdrawal.pdf',
      bankTransferDate: '2026-07-01T01:05:00.000Z',
      completedByAdminId: 'admin-1',
    },
  },
  providerProfile: { userId: 'partner-user-1' },
};

test('accepts complete paid withdrawal evidence in an open period', () => {
  const candidate = buildProviderWithdrawalBackfillCandidate({
    request,
    existingPhases: new Set(),
    closedPeriods: new Set(),
    paidAdminExists: true,
    providerUserExists: true,
    walletLedgerValid: true,
  });

  assert.equal(candidate.eligible, true);
  assert.deepEqual(candidate.missingPhases, ['LOCK', 'PAID']);
  assert.deepEqual(candidate.blockers, []);
  assert.equal(candidate.lockPeriod, '2026-07');
  assert.equal(candidate.paidPeriod, '2026-07');
});

test('blocks closed periods and incomplete bank evidence', () => {
  const candidate = buildProviderWithdrawalBackfillCandidate({
    request: { ...request, transferRef: null, metadata: {} },
    existingPhases: new Set(),
    closedPeriods: new Set(['2026-07']),
    paidAdminExists: true,
    providerUserExists: true,
    walletLedgerValid: false,
  });

  assert.equal(candidate.eligible, false);
  assert.ok(candidate.blockers.includes('TRANSFER_REFERENCE_MISSING'));
  assert.ok(candidate.blockers.includes('TRANSFER_ATTACHMENT_MISSING'));
  assert.ok(candidate.blockers.includes('PAID_WALLET_LEDGER_INVALID'));
  assert.ok(candidate.blockers.includes('LOCK_PERIOD_CLOSED'));
  assert.ok(candidate.blockers.includes('PAID_PERIOD_CLOSED'));
});

test('creates balanced immutable LOCK and PAID journal payloads', () => {
  const common = {
    amount: 120000,
    backfilledAt: new Date('2026-07-15T00:00:00.000Z'),
    backfilledByAdminId: 'master-admin',
    createdById: 'admin-1',
    currency: 'VND',
    monthlyPeriod: '2026-07',
    postedAt: new Date('2026-07-01T01:05:00.000Z'),
    providerProfileId: 'partner-1',
    requestId: 'withdrawal-1',
    transferRef: 'BANK-1',
  };
  const lock = providerWithdrawalJournalCreateData({ ...common, phase: 'LOCK' });
  const paid = providerWithdrawalJournalCreateData({ ...common, phase: 'PAID' });

  assert.equal(lock.totalDebit, lock.totalCredit);
  assert.equal(paid.totalDebit, paid.totalCredit);
  assert.equal(lock.entries.create[0].accountCode, 'partner_wallet_liability');
  assert.equal(lock.entries.create[1].accountCode, 'partner_withdrawal_payable');
  assert.equal(paid.entries.create[0].accountCode, 'partner_withdrawal_payable');
  assert.equal(paid.entries.create[1].accountCode, 'company_bank_cash');
  assert.equal(paid.metadata.historicalBackfill, true);
});
