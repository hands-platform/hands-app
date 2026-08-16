import assert from 'node:assert/strict';
import test from 'node:test';

import { companyBankAccountCleanupDecision } from './lib/company-bank-account-cleanup.mjs';

test('retains referenced company bank account fixtures', () => {
  assert.deepEqual(
    companyBankAccountCleanupDecision({
      dataScope: 'SYNTHETIC',
      status: 'ACTIVE',
      metadata: { fixture: true, fixtureType: 'api-smoke' },
      references: { transactions: 57 },
    }),
    { action: 'retain', reason: '57 finance references must be preserved.' },
  );
});

test('never deletes legacy smoke rows based on their name', () => {
  assert.equal(
    companyBankAccountCleanupDecision({
      name: 'Smoke staged account 123',
      bankName: 'Smoke bank',
      dataScope: 'UNKNOWN',
      status: 'INACTIVE',
      metadata: {},
      references: {},
    }).action,
    'manual-review',
  );
});

test('incomplete direct-reference coverage blocks fixture cleanup', () => {
  assert.equal(
    companyBankAccountCleanupDecision({
      dataScope: 'SYNTHETIC',
      status: 'INACTIVE',
      metadata: { fixture: true, fixtureType: 'api-smoke' },
      references: {},
      unsupportedDirectReferences: ['payouts'],
    }).action,
    'manual-review',
  );
});

test('only explicit synthetic inactive fixtures with complete zero references become delete candidates', () => {
  assert.equal(
    companyBankAccountCleanupDecision({
      dataScope: 'SYNTHETIC',
      status: 'INACTIVE',
      metadata: { fixture: true, fixtureType: 'api-smoke' },
      references: {},
      unsupportedDirectReferences: [],
    }).action,
    'delete-candidate',
  );
});
