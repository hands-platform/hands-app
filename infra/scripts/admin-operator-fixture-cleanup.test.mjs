import assert from 'node:assert/strict';
import test from 'node:test';

import { AdminUserProvenance, Role } from '@prisma/client';

import {
  adminOperatorFixtureDecision,
  LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST,
  LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST,
  KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST,
  KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN,
  legacyAdminOnlyFixtureRetirementDecision,
  legacyHighPrivilegeFixtureRetirementDecision,
  knownFinanceGovernancePendingRequestCloseDecision,
  knownFinanceGovernanceFixtureRepairDecision,
  knownFinanceGovernanceFixtureRetirementDecision,
} from './lib/admin-operator-fixture-cleanup.mjs';

const noDependencies = {
  adminOperatorInvitationsCreated: 0,
  adminOperatorInvitationsTargeted: 0,
  auditLogs: 0,
  financeApproverRequestsCreated: 0,
  financeApproverRequestsDecided: 0,
  financeApproverRequestsTargeted: 0,
};

function fixtureRow(overrides = {}) {
  return {
    id: 'fixture-admin-1',
    roles: [Role.ADMIN],
    adminUserProvenance: AdminUserProvenance.FIXTURE,
    fixtureKind: 'TEST',
    fixtureRunId: 'run-1',
    fixtureExpiresAt: null,
    dependencies: noDependencies,
    ...overrides,
  };
}

test('recommends deletion only for explicit fixtures without retained dependencies', () => {
  assert.equal(adminOperatorFixtureDecision(fixtureRow()).recommendation, 'DELETE_FIXTURE');
});

test('retires dependency-bearing fixtures without deleting the User record', () => {
  const decision = adminOperatorFixtureDecision(
    fixtureRow({ dependencies: { ...noDependencies, auditLogs: 31_871 } }),
  );
  assert.equal(decision.recommendation, 'RETIRE_OPERATOR');
  assert.equal(decision.retainedDependencyCount, 31_871);
});

test('uses complete User FK reference evidence instead of a partial dependency list', () => {
  const decision = adminOperatorFixtureDecision(fixtureRow({
    userReferences: { Notification_userId_fkey: 1 },
  }));
  assert.equal(decision.recommendation, 'RETIRE_OPERATOR');
  assert.equal(decision.retainedDependencyCount, 1);
});

test('never treats a legacy ID pattern as deletion authority', () => {
  const decision = adminOperatorFixtureDecision(
    fixtureRow({
      id: 'finance-governance-legacy:checker',
      adminUserProvenance: AdminUserProvenance.PRODUCTION,
      fixtureKind: null,
      fixtureRunId: null,
    }),
  );
  assert.equal(decision.recommendation, 'MANUAL_REVIEW');
});

test('keeps verified production operators outside fixture candidate patterns', () => {
  const decision = adminOperatorFixtureDecision(
    fixtureRow({
      id: 'production-master-1',
      adminUserProvenance: AdminUserProvenance.PRODUCTION,
      fixtureKind: null,
      fixtureRunId: null,
    }),
  );
  assert.equal(decision.recommendation, 'KEEP_PRODUCTION');
});

function knownRunRow(overrides = {}) {
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
  const id = `${run.runId}:maker`;
  return {
    id,
    phone: `admin:${id}`,
    email: `maker.${run.runId}@hands.test`,
    fullName: 'Finance governance integration maker',
    roles: [Role.ADMIN, Role.MASTER_ADMIN],
    createdAt: new Date(Number(run.runId.slice('finance-governance-'.length)) + 56),
    adminUserProvenance: AdminUserProvenance.PRODUCTION,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: { setupCompletedAt: null, lastLoginAt: null },
    adminWebSessionCount: 0,
    ...overrides,
  };
}

test('repairs only the exact inventoried finance governance integration evidence', () => {
  const decision = knownFinanceGovernanceFixtureRepairDecision(knownRunRow());
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test('refuses known-run provenance repair when an account has been used interactively', () => {
  const decision = knownFinanceGovernanceFixtureRepairDecision(knownRunRow({
    adminOperatorCredential: { setupCompletedAt: null, lastLoginAt: new Date() },
  }));
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ['Credential has a recorded login.']);
});

test('retires a repaired known-run fixture only when its Admin access was never used', () => {
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
  const decision = knownFinanceGovernanceFixtureRetirementDecision({
    ...knownRunRow(),
    adminUserProvenance: AdminUserProvenance.FIXTURE,
    fixtureKind: run.fixtureKind,
    fixtureRunId: run.runId,
    fixtureExpiresAt: new Date(),
    activeAdminWebSessionCount: 0,
  });
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test('refuses known-run retirement when an active session exists', () => {
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
  const decision = knownFinanceGovernanceFixtureRetirementDecision({
    ...knownRunRow(),
    adminUserProvenance: AdminUserProvenance.FIXTURE,
    fixtureKind: run.fixtureKind,
    fixtureRunId: run.runId,
    fixtureExpiresAt: new Date(),
    activeAdminWebSessionCount: 1,
  });
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ['An active Admin Web session exists.']);
});

test('retires only an exact unused legacy high-privilege fixture identity', () => {
  const expected = LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST[0];
  const decision = legacyHighPrivilegeFixtureRetirementDecision({
    ...expected,
    createdAt: new Date(expected.createdAt),
    adminUserProvenance: null,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: null,
    activeAdminWebSessionCount: 0,
    customerProfile: null,
    providerProfile: null,
  }, expected);
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test('refuses legacy fixture retirement when identity evidence changes', () => {
  const expected = LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST[0];
  const decision = legacyHighPrivilegeFixtureRetirementDecision({
    ...expected,
    phone: '+84999999999',
    createdAt: new Date(expected.createdAt),
    adminUserProvenance: null,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: null,
    activeAdminWebSessionCount: 0,
    customerProfile: null,
    providerProfile: null,
  }, expected);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ['Identity fields do not match the exact fixture manifest.']);
});

test('retires only an exact unused legacy Admin-only fixture identity', () => {
  const expected = LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST[0];
  const decision = legacyAdminOnlyFixtureRetirementDecision({
    ...expected,
    createdAt: new Date(expected.createdAt),
    adminUserProvenance: null,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: null,
    activeAdminWebSessionCount: 0,
    customerProfile: null,
    providerProfile: null,
  }, expected);
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test('refuses legacy Admin-only fixture retirement when an interactive credential exists', () => {
  const expected = LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST[0];
  const decision = legacyAdminOnlyFixtureRetirementDecision({
    ...expected,
    createdAt: new Date(expected.createdAt),
    adminUserProvenance: null,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: { id: 'credential-1' },
    activeAdminWebSessionCount: 0,
    customerProfile: null,
    providerProfile: null,
  }, expected);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ['An Admin operator credential exists.']);
});

function pendingKnownRunRequest(overrides = {}) {
  const expected = KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST[0];
  const retiredFixture = {
    roles: [],
    adminUserProvenance: AdminUserProvenance.FIXTURE,
    fixtureKind: KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN.fixtureKind,
    fixtureRunId: KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN.runId,
  };
  return {
    ...expected,
    requestedAt: new Date(expected.requestedAt),
    expectedTargetUpdatedAt: new Date(expected.expectedTargetUpdatedAt),
    status: 'PENDING',
    decidedByAdminId: null,
    decidedAt: null,
    executedAt: null,
    requestedByAdmin: retiredFixture,
    targetUser: retiredFixture,
    ...overrides,
  };
}

test('closes only an exact pending request between retired known-run fixtures', () => {
  const expected = KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST[0];
  const decision = knownFinanceGovernancePendingRequestCloseDecision(pendingKnownRunRequest(), expected);
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test('refuses known-run request closure when the target recovered an Admin role', () => {
  const expected = KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST[0];
  const row = pendingKnownRunRequest();
  const decision = knownFinanceGovernancePendingRequestCloseDecision({
    ...row,
    targetUser: { ...row.targetUser, roles: [Role.ADMIN] },
  }, expected);
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ['target is not the exact retired known-run fixture.']);
});
