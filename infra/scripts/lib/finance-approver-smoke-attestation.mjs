const REQUEST_ACTION = 'admin_user.finance_approver.legacy_attestation.requested';
const APPROVAL_ACTION = 'admin_user.finance_approver.legacy_attestation.approved';

export function financeApproverSmokeAttestationEvents({
  categories,
  checkerId,
  effectiveAt,
  permissionVersion = 1,
  runId,
  sourceReference,
  targetUserId,
}) {
  const effectiveAtIso = effectiveAt.toISOString();
  const expiresAt = new Date(effectiveAt.getTime() + 90 * 24 * 60 * 60_000).toISOString();
  const requestEventId = `${runId}_finance_attestation_request_${targetUserId}`;
  const target = `finance_approver_attestation:${targetUserId}:${runId}`;
  const targetSnapshot = {
    credential: { disabledAt: null, lockedUntil: null, mfaState: 'VERIFIED', setupCompleted: true },
    permission: { categories, updatedAt: effectiveAtIso, version: permissionVersion },
    provenance: 'PRODUCTION',
    requestedAt: effectiveAtIso,
    requestedBy: targetUserId,
    roles: ['ADMIN', 'FINANCE_APPROVER'],
    sourceReference,
    userId: targetUserId,
    userUpdatedAt: effectiveAtIso,
  };

  return [
    {
      id: requestEventId,
      actorId: targetUserId,
      action: REQUEST_ACTION,
      target,
      metadata: {
        permissionVersion,
        reason: 'Authorize the disposable smoke Finance approver for this isolated run.',
        sourceReference,
        targetSnapshot,
        targetUserId,
      },
    },
    {
      actorId: checkerId,
      action: APPROVAL_ACTION,
      target,
      metadata: {
        attestationRequestEventId: requestEventId,
        attestorId: targetUserId,
        effectiveAt: effectiveAtIso,
        expiresAt,
        independentCheckerId: checkerId,
        permissionVersion,
        sourceReference,
        targetSnapshot,
        targetUserId,
      },
    },
  ];
}
