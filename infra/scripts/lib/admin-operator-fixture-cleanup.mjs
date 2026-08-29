import { AdminUserProvenance, Role } from '@prisma/client';

const ADMIN_ROLES = new Set([Role.ADMIN, Role.MASTER_ADMIN, Role.FINANCE_APPROVER]);

export const KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN = Object.freeze({
  fixtureKind: 'FINANCE_APPROVER_GOVERNANCE_INTEGRATION_LEGACY',
  runId: 'finance-governance-1786644908414',
  suffixes: Object.freeze([
    'maker',
    'checker',
    'target-a',
    'target-b',
    'grant-maker',
    'grant-checker',
    'grant-backup',
    'grant-target',
    'request-maker',
    'request-checker',
    'request-target',
    'rollback-target',
  ]),
});

export const LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST = Object.freeze([
  ['admin-local-smoke', '+84900000998', 'admin@hands.local', 'Local Admin Web Actor', '2026-07-01T07:48:45.092Z', [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN], 'PRISMA_SEED', 'prisma-seed'],
  ['audit_post_match_finance_approver_user', '+84900007103', null, 'Audit Finance Approver', '2026-08-07T12:09:49.607Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'POST_MATCH_FINANCE_APPROVER_LEGACY', 'audit_post_match'],
  ['cmpb9dvr80005vyqsskqoeo0v', '+84900000099', null, 'Demo Admin', '2026-05-18T13:47:40.676Z', [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN], 'PRISMA_SEED', 'prisma-seed'],
  ['cmr39eqt60000vy8w8dgyx6wi', '+84900000098', null, 'HANDS Smoke Admin', '2026-07-02T08:45:36.186Z', [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN], 'API_SMOKE_LEGACY', 'legacy-api-smoke'],
  ['company-bank-concurrency-1786676439947:checker', 'admin:company-bank-concurrency-1786676439947:checker', null, 'Company bank concurrency actor 3', '2026-08-14T03:00:39.994Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-1786676439947'],
  ['company-bank-concurrency:checker', 'admin:company-bank-concurrency:checker', null, 'Company bank concurrency actor 3', '2026-08-14T03:05:36.889Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-legacy'],
  ['provider_payout_reversal_1785336269676_approver', '+849786985102', null, 'Payout Smoke Finance Approver', '2026-07-29T14:44:29.852Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PAYOUT_REVERSAL_SMOKE_LEGACY', 'provider_payout_reversal_1785336269676'],
  ['provider_payout_reversal_1785340259415_approver', '+849785960502', null, 'Payout Smoke Finance Approver', '2026-07-29T15:50:59.607Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PAYOUT_REVERSAL_SMOKE_LEGACY', 'provider_payout_reversal_1785340259415'],
  ['provider_withdrawal_1785335298966_approver', '+849779918402', null, 'Withdrawal Smoke Finance Approver', '2026-07-29T14:28:19.185Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785335298966'],
  ['provider_withdrawal_1785340172425_approver', '+849777259802', null, 'Withdrawal Smoke Finance Approver', '2026-07-29T15:49:32.599Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785340172425'],
  ['provider_withdrawal_1785340200336_approver', '+849770050302', null, 'Withdrawal Smoke Finance Approver', '2026-07-29T15:50:00.506Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785340200336'],
  ['provider_withdrawal_1785384642017_approver', '+849774214902', null, 'Withdrawal Smoke Finance Approver', '2026-07-30T04:10:42.150Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785384642017'],
  ['smoke_post_match_finance_approver_user', '+84900007003', null, 'Smoke Finance Approver', '2026-08-07T12:09:24.480Z', [Role.ADMIN, Role.FINANCE_APPROVER], 'POST_MATCH_FINANCE_APPROVER_LEGACY', 'smoke_post_match'],
].map(([id, phone, email, fullName, createdAt, roles, fixtureKind, fixtureRunId]) => Object.freeze({
  id,
  phone,
  email,
  fullName,
  createdAt,
  roles: Object.freeze(roles),
  fixtureKind,
  fixtureRunId,
})));

export const LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST = Object.freeze([
  ['cmr3zt5kp0000vys0m0mxddxf', '+84900000097', null, 'HANDS Smoke Admin Without Finance Approver', '2026-07-02T21:04:38.521Z', [Role.ADMIN], 'API_SMOKE_LEGACY', 'legacy-api-smoke'],
  ['provider_withdrawal_1785335298966_actor', '+849779918401', null, 'Withdrawal Smoke Actor', '2026-07-29T14:28:19.185Z', [Role.ADMIN], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785335298966'],
  ['provider_payout_reversal_1785336269676_actor', '+849786985101', null, 'Payout Smoke Actor', '2026-07-29T14:44:29.852Z', [Role.ADMIN], 'PAYOUT_REVERSAL_SMOKE_LEGACY', 'provider_payout_reversal_1785336269676'],
  ['provider_withdrawal_1785340172425_actor', '+849777259801', null, 'Withdrawal Smoke Actor', '2026-07-29T15:49:32.599Z', [Role.ADMIN], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785340172425'],
  ['provider_withdrawal_1785340200336_actor', '+849770050301', null, 'Withdrawal Smoke Actor', '2026-07-29T15:50:00.506Z', [Role.ADMIN], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785340200336'],
  ['provider_payout_reversal_1785340259415_actor', '+849785960501', null, 'Payout Smoke Actor', '2026-07-29T15:50:59.607Z', [Role.ADMIN], 'PAYOUT_REVERSAL_SMOKE_LEGACY', 'provider_payout_reversal_1785340259415'],
  ['provider_withdrawal_1785384642017_actor', '+849774214901', null, 'Withdrawal Smoke Actor', '2026-07-30T04:10:42.150Z', [Role.ADMIN], 'PROVIDER_WITHDRAWAL_SMOKE_LEGACY', 'provider_withdrawal_1785384642017'],
  ['provider_payout_reversal_1785384651603_actor', '+849785174701', null, 'Payout Smoke Actor', '2026-07-30T04:10:51.748Z', [Role.ADMIN], 'PAYOUT_REVERSAL_SMOKE_LEGACY', 'provider_payout_reversal_1785384651603'],
  ['smoke_post_match_admin_actor_user', '+84900007000', null, 'Smoke Admin Maker', '2026-08-07T12:09:24.455Z', [Role.ADMIN], 'POST_MATCH_ADMIN_LEGACY', 'smoke_post_match'],
  ['audit_post_match_admin_actor_user', '+84900007100', null, 'Audit Admin Maker', '2026-08-07T12:09:49.586Z', [Role.ADMIN], 'POST_MATCH_ADMIN_LEGACY', 'audit_post_match'],
  ['company-bank-concurrency-1786676439947:maker-a', 'admin:company-bank-concurrency-1786676439947:maker-a', null, 'Company bank concurrency actor 1', '2026-08-14T03:00:39.994Z', [Role.ADMIN], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-1786676439947'],
  ['company-bank-concurrency-1786676439947:maker-b', 'admin:company-bank-concurrency-1786676439947:maker-b', null, 'Company bank concurrency actor 2', '2026-08-14T03:00:39.994Z', [Role.ADMIN], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-1786676439947'],
  ['company-bank-concurrency:maker-a', 'admin:company-bank-concurrency:maker-a', null, 'Company bank concurrency actor 1', '2026-08-14T03:05:36.889Z', [Role.ADMIN], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-legacy'],
  ['company-bank-concurrency:maker-b', 'admin:company-bank-concurrency:maker-b', null, 'Company bank concurrency actor 2', '2026-08-14T03:05:36.889Z', [Role.ADMIN], 'COMPANY_BANK_ACCOUNT_CONCURRENCY_INTEGRATION_LEGACY', 'company-bank-concurrency-legacy'],
].map(([id, phone, email, fullName, createdAt, roles, fixtureKind, fixtureRunId]) => Object.freeze({
  id,
  phone,
  email,
  fullName,
  createdAt,
  roles: Object.freeze(roles),
  fixtureKind,
  fixtureRunId,
})));

export const KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST = Object.freeze([
  {
    id: 'cmsru8yf80009vyx8rz008bj7',
    targetUserId: 'finance-governance-1786644908414:target-b',
    requestedByAdminId: 'finance-governance-1786644908414:maker',
    requestedEnabled: false,
    previousEnabled: true,
    previousRoles: Object.freeze([Role.ADMIN, Role.FINANCE_APPROVER]),
    requestedAt: '2026-08-13T18:15:08.612Z',
    expectedTargetUpdatedAt: '2026-08-13T18:15:08.514Z',
    idempotencyKey: 'finance-governance-1786644908414:revoke-b',
    pendingKey: 'finance-approver:finance-governance-1786644908414:target-b',
  },
  {
    id: 'cmsru8yv2000yvyx8cbiyh3fq',
    targetUserId: 'finance-governance-1786644908414:request-target',
    requestedByAdminId: 'finance-governance-1786644908414:request-maker',
    requestedEnabled: true,
    previousEnabled: false,
    previousRoles: Object.freeze([Role.ADMIN]),
    requestedAt: '2026-08-13T18:15:09.182Z',
    expectedTargetUpdatedAt: '2026-08-13T18:15:09.159Z',
    idempotencyKey: 'finance-governance-1786644908414:same-request',
    pendingKey: 'finance-approver:finance-governance-1786644908414:request-target',
  },
]);

export const ADMIN_OPERATOR_FIXTURE_DECISIONS = [
  'KEEP_PRODUCTION',
  'RETIRE_OPERATOR',
  'DELETE_FIXTURE',
  'MANUAL_REVIEW',
];

export function adminOperatorFixtureDecision(row) {
  const productRoles = row.roles.filter((role) => !ADMIN_ROLES.has(role));
  const explicitFixtureEvidence =
    row.adminUserProvenance === AdminUserProvenance.FIXTURE ||
    Boolean(row.fixtureKind || row.fixtureRunId || row.fixtureExpiresAt);
  const patternEvidence = row.id.startsWith('finance-governance-');
  const retainedDependencyCount = row.userReferences
    ? Object.values(row.userReferences).reduce((total, count) => total + count, 0)
    : row.dependencies.auditLogs +
      row.dependencies.adminOperatorInvitationsCreated +
      row.dependencies.adminOperatorInvitationsTargeted +
      row.dependencies.financeApproverRequestsCreated +
      row.dependencies.financeApproverRequestsDecided +
      row.dependencies.financeApproverRequestsTargeted;

  if (explicitFixtureEvidence && productRoles.length === 0 && retainedDependencyCount === 0) {
    return {
      recommendation: 'DELETE_FIXTURE',
      reason: 'Explicit fixture provenance or markers are present and no retained business dependency or product role exists.',
      productRoles,
      retainedDependencyCount,
    };
  }

  if (explicitFixtureEvidence) {
    return {
      recommendation: 'RETIRE_OPERATOR',
      reason:
        'Explicit fixture evidence exists, but retained dependencies or product roles require Admin access retirement without deleting the User record.',
      productRoles,
      retainedDependencyCount,
    };
  }

  if (
    row.adminUserProvenance === AdminUserProvenance.PRODUCTION &&
    !patternEvidence
  ) {
    return {
      recommendation: 'KEEP_PRODUCTION',
      reason: 'Verified production provenance is present and no fixture marker or candidate-pattern evidence exists.',
      productRoles,
      retainedDependencyCount,
    };
  }

  return {
    recommendation: 'MANUAL_REVIEW',
    reason:
      'The candidate is supported only by a name or ID pattern, missing provenance, or conflicting production provenance; pattern evidence is never deletion authority.',
    productRoles,
    retainedDependencyCount,
  };
}

export function knownFinanceGovernanceFixtureRepairDecision(row) {
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
  const suffix = row.id.startsWith(`${run.runId}:`) ? row.id.slice(run.runId.length + 1) : '';
  const runStartedAt = new Date(Number(run.runId.slice('finance-governance-'.length)));
  const latestExpectedCreation = new Date(runStartedAt.getTime() + 5_000);
  const reasons = [];

  if (!run.suffixes.includes(suffix)) reasons.push('ID is not in the exact known-run suffix manifest.');
  if (row.phone !== `admin:${row.id}`) reasons.push('Phone does not match the integration fixture format.');
  if (row.email !== `${suffix}.${run.runId}@hands.test`) reasons.push('Email does not match the integration fixture format.');
  if (row.fullName !== `Finance governance integration ${suffix}`) reasons.push('Full name does not match the legacy integration fixture format.');
  if (row.createdAt < runStartedAt || row.createdAt > latestExpectedCreation) reasons.push('Creation timestamp is outside the exact integration run window.');
  if (row.adminUserProvenance !== AdminUserProvenance.PRODUCTION) reasons.push('Current provenance is not the known legacy PRODUCTION misclassification.');
  if (row.fixtureKind || row.fixtureRunId || row.fixtureExpiresAt) reasons.push('Fixture markers are already present or conflict with the repair precondition.');
  if (!row.roles.includes(Role.ADMIN) || row.roles.some((role) => !ADMIN_ROLES.has(role))) reasons.push('Roles do not match an Admin-only integration fixture.');
  if (!row.adminOperatorCredential) reasons.push('Expected legacy integration credential is missing.');
  if (row.adminOperatorCredential?.setupCompletedAt) reasons.push('Credential setup was completed.');
  if (row.adminOperatorCredential?.lastLoginAt) reasons.push('Credential has a recorded login.');
  if (row.adminWebSessionCount !== 0) reasons.push('Admin Web sessions exist for the candidate.');

  return { eligible: reasons.length === 0, reasons, suffix };
}

export function knownFinanceGovernanceFixtureRetirementDecision(row) {
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
  const suffix = row.id.startsWith(`${run.runId}:`) ? row.id.slice(run.runId.length + 1) : '';
  const reasons = [];

  if (!run.suffixes.includes(suffix)) reasons.push('ID is not in the exact known-run suffix manifest.');
  if (row.adminUserProvenance !== AdminUserProvenance.FIXTURE) reasons.push('Provenance is not FIXTURE.');
  if (row.fixtureKind !== run.fixtureKind || row.fixtureRunId !== run.runId || !row.fixtureExpiresAt) reasons.push('Exact repaired fixture markers are missing.');
  if (!row.roles.includes(Role.ADMIN) || row.roles.some((role) => !ADMIN_ROLES.has(role))) reasons.push('Roles do not match an Admin-only integration fixture.');
  if (!row.adminOperatorCredential) reasons.push('Expected fixture credential is missing.');
  if (row.adminOperatorCredential?.setupCompletedAt) reasons.push('Credential setup was completed.');
  if (row.adminOperatorCredential?.lastLoginAt) reasons.push('Credential has a recorded login.');
  if (row.activeAdminWebSessionCount !== 0) reasons.push('An active Admin Web session exists.');

  return { eligible: reasons.length === 0, reasons, suffix };
}

export function legacyHighPrivilegeFixtureRetirementDecision(row, expected) {
  return legacyFixtureRetirementDecision(row, expected);
}

export function legacyAdminOnlyFixtureRetirementDecision(row, expected) {
  return legacyFixtureRetirementDecision(row, expected);
}

export function knownFinanceGovernancePendingRequestCloseDecision(row, expected) {
  const reasons = [];
  const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;

  if (row.id !== expected.id) reasons.push('Request ID does not match the exact fixture manifest.');
  if (
    row.targetUserId !== expected.targetUserId ||
    row.requestedByAdminId !== expected.requestedByAdminId ||
    row.requestedEnabled !== expected.requestedEnabled ||
    row.previousEnabled !== expected.previousEnabled ||
    row.idempotencyKey !== expected.idempotencyKey ||
    row.pendingKey !== expected.pendingKey
  ) reasons.push('Request identity or intent does not match the exact fixture manifest.');
  if (JSON.stringify(row.previousRoles) !== JSON.stringify(expected.previousRoles)) reasons.push('Previous roles do not match the exact fixture manifest.');
  if (
    row.requestedAt.toISOString() !== expected.requestedAt ||
    row.expectedTargetUpdatedAt.toISOString() !== expected.expectedTargetUpdatedAt
  ) reasons.push('Request timestamps do not match the exact fixture manifest.');
  if (row.status !== 'PENDING' || row.decidedByAdminId || row.decidedAt || row.executedAt) reasons.push('Request is not an undecided pending fixture request.');

  for (const [label, user] of [['maker', row.requestedByAdmin], ['target', row.targetUser]]) {
    if (
      !user ||
      user.adminUserProvenance !== AdminUserProvenance.FIXTURE ||
      user.fixtureKind !== run.fixtureKind ||
      user.fixtureRunId !== run.runId ||
      user.roles.length !== 0
    ) reasons.push(`${label} is not the exact retired known-run fixture.`);
  }

  return { eligible: reasons.length === 0, reasons };
}

function legacyFixtureRetirementDecision(row, expected) {
  const reasons = [];
  const roles = [...row.roles].sort();
  const expectedRoles = [...expected.roles].sort();

  if (row.id !== expected.id) reasons.push('ID does not match the exact fixture manifest.');
  if (row.phone !== expected.phone || row.email !== expected.email || row.fullName !== expected.fullName) reasons.push('Identity fields do not match the exact fixture manifest.');
  if (row.createdAt.toISOString() !== expected.createdAt) reasons.push('Creation timestamp does not match the exact fixture manifest.');
  if (JSON.stringify(roles) !== JSON.stringify(expectedRoles)) reasons.push('Roles do not match the exact fixture manifest.');
  if (row.adminUserProvenance || row.fixtureKind || row.fixtureRunId || row.fixtureExpiresAt) reasons.push('Current provenance or fixture markers conflict with the legacy repair precondition.');
  if (row.adminOperatorCredential) reasons.push('An Admin operator credential exists.');
  if (row.activeAdminWebSessionCount !== 0) reasons.push('An active Admin Web session exists.');
  if (row.customerProfile || row.providerProfile) reasons.push('A customer or Partner profile is attached.');

  return { eligible: reasons.length === 0, reasons };
}
