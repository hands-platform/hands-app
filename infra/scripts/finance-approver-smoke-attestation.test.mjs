import assert from 'node:assert/strict';
import test from 'node:test';

import { financeApproverSmokeAttestationEvents } from './lib/finance-approver-smoke-attestation.mjs';

test('builds a current independent Finance approver smoke attestation pair', () => {
  const effectiveAt = new Date('2026-08-29T00:00:00.000Z');
  const [request, approval] = financeApproverSmokeAttestationEvents({
    categories: ['FINANCE_SETTLEMENTS'],
    checkerId: 'checker-1',
    effectiveAt,
    runId: 'smoke-run-1',
    sourceReference: 'disposable-lifecycle:smoke-run-1',
    targetUserId: 'approver-1',
  });

  assert.equal(request.action, 'admin_user.finance_approver.legacy_attestation.requested');
  assert.equal(approval.action, 'admin_user.finance_approver.legacy_attestation.approved');
  assert.equal(approval.actorId, 'checker-1');
  assert.equal(approval.metadata.attestorId, 'approver-1');
  assert.equal(approval.metadata.independentCheckerId, 'checker-1');
  assert.equal(approval.metadata.targetUserId, 'approver-1');
  assert.equal(approval.metadata.permissionVersion, 1);
  assert.equal(approval.metadata.attestationRequestEventId, request.id);
  assert.deepEqual(approval.metadata.targetSnapshot, request.metadata.targetSnapshot);
  assert.ok(Date.parse(approval.metadata.expiresAt) > Date.parse(approval.metadata.effectiveAt));
});
