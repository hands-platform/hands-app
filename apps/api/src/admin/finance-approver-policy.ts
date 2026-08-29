import { ForbiddenException } from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  FinanceApproverAccessRequestStatus,
  Prisma,
  Role,
} from '@prisma/client';

import { adminOperatorHasRequiredCategory } from './admin-operator-category.guard';

export const FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION =
  'admin_user.finance_approver.legacy_attestation.approved';
export const FINANCE_APPROVER_LEGACY_ATTESTATION_REQUEST_ACTION =
  'admin_user.finance_approver.legacy_attestation.requested';
export const FINANCE_APPROVER_LEGACY_ATTESTATION_REJECT_ACTION =
  'admin_user.finance_approver.legacy_attestation.rejected';
export const FINANCE_APPROVER_LEGACY_ATTESTATION_REVOKE_ACTION =
  'admin_user.finance_approver.legacy_attestation.revoked';
export const FINANCE_APPROVER_LEGACY_ATTESTATION_SUPERSEDE_ACTION =
  'admin_user.finance_approver.legacy_attestation.superseded';
export const FINANCE_APPROVER_LEGACY_ATTESTATION_VALIDITY_DAYS = 90;

export const FINANCE_APPROVER_KNOWN_TEST_RUN_IDS = [
  'finance-governance-1786644908414',
] as const;

export const FINANCE_APPROVER_POLICY_BLOCKER_CODES = [
  'NON_PRODUCTION_PROVENANCE',
  'TEST_OR_FIXTURE_ACCOUNT',
  'UNKNOWN_PROVENANCE',
  'SETUP_INCOMPLETE',
  'CREDENTIAL_MISSING',
  'CREDENTIAL_DISABLED',
  'ACCOUNT_LOCKED',
  'MFA_NOT_VERIFIED',
  'SESSION_MFA_UNVERIFIED',
  'RECENT_REAUTH_REQUIRED',
  'LEGACY_ACCESS_UNATTESTED',
  'ROLE_MISSING',
  'CATEGORY_NOT_ALLOWED',
  'MAKER_CHECKER_CONFLICT',
  'STALE_ROLE_VERSION',
] as const;

export type FinanceApproverPolicyBlockerCode =
  (typeof FINANCE_APPROVER_POLICY_BLOCKER_CODES)[number];

export const financeApproverPolicyUserSelect = {
  id: true,
  email: true,
  fullName: true,
  roles: true,
  updatedAt: true,
  adminUserProvenance: true,
  fixtureKind: true,
  fixtureRunId: true,
  fixtureExpiresAt: true,
  adminOperatorCredential: {
    select: {
      disabledAt: true,
      lastLoginAt: true,
      lockedUntil: true,
      mfaState: true,
      setupCompletedAt: true,
    },
  },
  adminOperatorPermission: {
    select: {
      categories: true,
      updatedAt: true,
      version: true,
    },
  },
  financeApproverRequestsTargeted: {
    where: {
      executedAt: { not: null },
      status: FinanceApproverAccessRequestStatus.APPROVED,
    },
    orderBy: { executedAt: 'desc' },
    take: 1,
    select: {
      id: true,
      requestedEnabled: true,
      executedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

export type FinanceApproverPolicyUser = Prisma.UserGetPayload<{
  select: typeof financeApproverPolicyUserSelect;
}>;

export type FinanceApproverPolicySnapshot = {
  attestationStatus: 'ATTESTED' | 'GOVERNED_WORKFLOW' | 'NOT_REQUIRED' | 'UNATTESTED';
  blockers: Array<{ code: FinanceApproverPolicyBlockerCode; message: string }>;
  credentialState: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'MISSING' | 'SETUP_INCOMPLETE';
  mfaVerified: boolean;
  legacyAttestationLifecycle: FinanceApproverLegacyAttestationLifecycle;
  permissionVersion: number | null;
  ready: boolean;
  source: 'FIXTURE' | 'LEGACY' | 'PRODUCTION' | 'TEST_RUN' | 'UNKNOWN';
  user: FinanceApproverPolicyUser;
};

export type FinanceApproverLegacyAttestationLifecycle =
  | 'CURRENT'
  | 'EXPIRED'
  | 'MISSING'
  | 'NOT_REQUIRED'
  | 'REVOKED'
  | 'SUPERSEDED';

type FinanceApproverPolicyDb = Pick<Prisma.TransactionClient, 'adminAuditLog' | 'user'> &
  Partial<Pick<Prisma.TransactionClient, 'adminWebSession'>>;

type FinanceApproverPolicyOptions = {
  expectedPermissionVersion?: number | null;
  makerId?: string | null;
  now?: Date;
  requireAttestation?: boolean;
  requiredCategory?: AdminOperatorPermissionCategory | null;
  requireFinanceRole?: boolean;
  requireRecentReauthentication?: boolean;
  requireSessionMfa?: boolean;
  sessionId?: string | null;
  sessionMfaVerifiedAt?: Date | null;
  legacyAttestationLifecycle?: FinanceApproverLegacyAttestationLifecycle;
};

export async function financeApproverPolicySnapshot(
  db: FinanceApproverPolicyDb,
  userId: string,
  options: FinanceApproverPolicyOptions = {},
) {
  const user = await db.user.findFirst({
    where: { id: userId },
    select: financeApproverPolicyUserSelect,
  });
  if (!user) {
    throw new ForbiddenException({
      code: 'UNKNOWN_PROVENANCE',
      message: 'The finance approval actor could not be verified',
    });
  }
  const roles = user.roles ?? [];
  const governedGrant = user.financeApproverRequestsTargeted?.[0]?.requestedEnabled === true;
  const legacyAttestation =
    roles.includes(Role.FINANCE_APPROVER) && !governedGrant
      ? await financeApproverLegacyAttestationStateForUser(db, user.id, options.now)
      : { approvalEventId: null, lifecycle: 'NOT_REQUIRED' as const };
  const snapshot = evaluateFinanceApproverPolicy(user, {
    ...options,
    legacyAttestationLifecycle: legacyAttestation.lifecycle,
    legacyAttested: legacyAttestation.lifecycle === 'CURRENT',
  });
  if (options.requireRecentReauthentication || options.requireSessionMfa) {
    const session = options.sessionId && db.adminWebSession
      ? await db.adminWebSession.findUnique({
          where: { id: options.sessionId },
          select: {
            expiresAt: true,
            mfaVerifiedAt: true,
            reauthenticatedAt: true,
            revokedAt: true,
            userId: true,
          },
        })
      : null;
    const now = options.now ?? new Date();
    const activeSession = Boolean(
      session &&
      session.userId === user.id &&
      !session.revokedAt &&
      session.expiresAt.getTime() > now.getTime(),
    );
    if (
      options.requireRecentReauthentication &&
      (!activeSession ||
        !session?.reauthenticatedAt ||
        now.getTime() - session.reauthenticatedAt.getTime() > 10 * 60_000)
    ) {
      addBlocker(snapshot.blockers, 'RECENT_REAUTH_REQUIRED');
    }
    const mfaVerifiedAt = options.sessionId ? session?.mfaVerifiedAt : options.sessionMfaVerifiedAt;
    if (
      options.requireSessionMfa &&
      ((!activeSession && Boolean(options.sessionId)) ||
        !mfaVerifiedAt ||
        now.getTime() - mfaVerifiedAt.getTime() > 10 * 60_000)
    ) {
      addBlocker(snapshot.blockers, 'SESSION_MFA_UNVERIFIED');
    }
  }
  return { ...snapshot, ready: snapshot.blockers.length === 0 };
}

export async function assertVerifiedFinanceApprover(
  db: FinanceApproverPolicyDb,
  userId: string,
  actionLabel: string,
  options: Omit<FinanceApproverPolicyOptions, 'requireAttestation' | 'requireFinanceRole'> = {},
) {
  let snapshot: FinanceApproverPolicySnapshot;
  try {
    snapshot = await financeApproverPolicySnapshot(db, userId, {
      ...options,
      requireAttestation: true,
      requireFinanceRole: true,
    });
  } catch (error) {
    if (error instanceof ForbiddenException) {
      throw new ForbiddenException({
        code: 'UNKNOWN_PROVENANCE',
        message: `${actionLabel} requires approval from a finance approver. The actor could not be verified.`,
      });
    }
    throw error;
  }
  if (!snapshot.ready) {
    const blocker = snapshot.blockers[0];
    throw new ForbiddenException({
      blockers: snapshot.blockers,
      code: blocker?.code ?? 'UNKNOWN_PROVENANCE',
      message: `${actionLabel} requires approval from a finance approver. ${blocker?.message ?? 'Actor verification failed.'}`,
    });
  }
  return snapshot;
}

export async function listFinanceApproverPolicySnapshots(
  db: FinanceApproverPolicyDb,
  options: FinanceApproverPolicyOptions & { excludeIds?: string[]; requireFinanceRole?: boolean } = {},
) {
  const users = await db.user.findMany({
    where: {
      ...(options.excludeIds?.length ? { id: { notIn: options.excludeIds } } : {}),
      roles: options.requireFinanceRole === false
        ? { has: Role.ADMIN }
        : { hasEvery: [Role.ADMIN, Role.FINANCE_APPROVER] },
    },
    orderBy: { id: 'asc' },
    select: financeApproverPolicyUserSelect,
  });
  if (users.length === 0) return [];
  const legacyUsers = users.filter(
    (user) =>
      user.roles.includes(Role.FINANCE_APPROVER) &&
      user.financeApproverRequestsTargeted?.[0]?.requestedEnabled !== true,
  );
  const attestations = legacyUsers.length
    ? await db.adminAuditLog.findMany({
        where: {
          action: {
            in: [
              FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION,
              FINANCE_APPROVER_LEGACY_ATTESTATION_REVOKE_ACTION,
              FINANCE_APPROVER_LEGACY_ATTESTATION_SUPERSEDE_ACTION,
            ],
          },
          OR: legacyUsers.map((user) => ({
            target: { startsWith: `finance_approver_attestation:${user.id}:` },
          })),
        },
        orderBy: { createdAt: 'desc' },
        select: { action: true, actorId: true, createdAt: true, id: true, metadata: true, target: true },
      })
    : [];
  return users.map((user) =>
    {
      const lifecycle = financeApproverLegacyAttestationState(attestations, user.id, options.now).lifecycle;
      return evaluateFinanceApproverPolicy(user, {
        ...options,
        legacyAttestationLifecycle: lifecycle,
        legacyAttested: lifecycle === 'CURRENT',
      });
    },
  );
}

export function evaluateFinanceApproverPolicy(
  user: FinanceApproverPolicyUser,
  options: FinanceApproverPolicyOptions & { legacyAttested?: boolean } = {},
): FinanceApproverPolicySnapshot {
  const now = options.now ?? new Date();
  const blockers: FinanceApproverPolicySnapshot['blockers'] = [];
  const roles = user.roles ?? [];
  const isTest = Boolean(
    user.fixtureKind || user.fixtureRunId || user.fixtureExpiresAt || financeApproverKnownTestRunId(user),
  );
  const governedGrant = user.financeApproverRequestsTargeted?.[0]?.requestedEnabled === true;
  const source = isTest
    ? ('TEST_RUN' as const)
    : user.adminUserProvenance === AdminUserProvenance.FIXTURE
      ? ('FIXTURE' as const)
      : user.adminUserProvenance !== AdminUserProvenance.PRODUCTION
        ? ('UNKNOWN' as const)
        : roles.includes(Role.FINANCE_APPROVER) && !governedGrant
          ? ('LEGACY' as const)
          : ('PRODUCTION' as const);

  if (isTest || user.adminUserProvenance === AdminUserProvenance.FIXTURE) {
    addBlocker(blockers, 'TEST_OR_FIXTURE_ACCOUNT');
  } else if (!user.adminUserProvenance) {
    addBlocker(blockers, 'UNKNOWN_PROVENANCE');
  } else if (user.adminUserProvenance !== AdminUserProvenance.PRODUCTION) {
    addBlocker(blockers, 'NON_PRODUCTION_PROVENANCE');
  }

  const credential = user.adminOperatorCredential;
  const credentialState = !credential
    ? ('MISSING' as const)
    : !credential.setupCompletedAt
      ? ('SETUP_INCOMPLETE' as const)
      : credential.disabledAt
        ? ('DISABLED' as const)
        : credential.lockedUntil && credential.lockedUntil.getTime() > now.getTime()
          ? ('LOCKED' as const)
          : ('ACTIVE' as const);
  if (!credential) addBlocker(blockers, 'CREDENTIAL_MISSING');
  else {
    if (!credential.setupCompletedAt) addBlocker(blockers, 'SETUP_INCOMPLETE');
    if (credential.disabledAt) addBlocker(blockers, 'CREDENTIAL_DISABLED');
    if (credential.lockedUntil && credential.lockedUntil.getTime() > now.getTime()) {
      addBlocker(blockers, 'ACCOUNT_LOCKED');
    }
    if (credential.mfaState !== 'VERIFIED') addBlocker(blockers, 'MFA_NOT_VERIFIED');
  }

  if (!roles.includes(Role.ADMIN)) {
    addBlocker(blockers, 'ROLE_MISSING');
  } else if (options.requireFinanceRole !== false && !roles.includes(Role.FINANCE_APPROVER)) {
    addBlocker(blockers, 'ROLE_MISSING');
  }
  const permission = user.adminOperatorPermission;
  if (!permission || permission.version < 1) {
    addBlocker(blockers, 'STALE_ROLE_VERSION');
  } else {
    const allowed = options.requiredCategory
      ? adminOperatorHasRequiredCategory(permission.categories, options.requiredCategory)
      : permission.categories.some((category) => category.startsWith('FINANCE'));
    if (!allowed) addBlocker(blockers, 'CATEGORY_NOT_ALLOWED');
    if (
      options.expectedPermissionVersion != null &&
      permission.version !== options.expectedPermissionVersion
    ) {
      addBlocker(blockers, 'STALE_ROLE_VERSION');
    }
  }
  if (options.makerId && options.makerId === user.id) {
    addBlocker(blockers, 'MAKER_CHECKER_CONFLICT');
  }
  const requiresAttestation = options.requireAttestation !== false && roles.includes(Role.FINANCE_APPROVER);
  if (requiresAttestation && !governedGrant && !options.legacyAttested) {
    addBlocker(blockers, 'LEGACY_ACCESS_UNATTESTED');
  }

  return {
    attestationStatus: !requiresAttestation
      ? 'NOT_REQUIRED'
      : governedGrant
        ? 'GOVERNED_WORKFLOW'
        : options.legacyAttested
          ? 'ATTESTED'
          : 'UNATTESTED',
    blockers,
    credentialState,
    legacyAttestationLifecycle: governedGrant
      ? 'NOT_REQUIRED'
      : options.legacyAttestationLifecycle ?? (options.legacyAttested ? 'CURRENT' : 'MISSING'),
    mfaVerified: credential?.mfaState === 'VERIFIED',
    permissionVersion: permission?.version ?? null,
    ready: blockers.length === 0,
    source,
    user,
  };
}

export function financeApproverKnownTestRunId(
  user: Pick<FinanceApproverPolicyUser, 'fixtureRunId' | 'id'>,
) {
  if (user.fixtureRunId) return user.fixtureRunId;
  return FINANCE_APPROVER_KNOWN_TEST_RUN_IDS.find((runId) => user.id.startsWith(`${runId}:`)) ?? null;
}

async function financeApproverLegacyAttestationStateForUser(
  db: FinanceApproverPolicyDb,
  userId: string,
  now = new Date(),
) {
  const events = await db.adminAuditLog.findMany({
    where: {
      action: {
        in: [
          FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION,
          FINANCE_APPROVER_LEGACY_ATTESTATION_REVOKE_ACTION,
          FINANCE_APPROVER_LEGACY_ATTESTATION_SUPERSEDE_ACTION,
        ],
      },
      target: { startsWith: `finance_approver_attestation:${userId}:` },
    },
    orderBy: { createdAt: 'desc' },
    select: { action: true, actorId: true, createdAt: true, id: true, metadata: true, target: true },
  });
  return financeApproverLegacyAttestationState(events, userId, now);
}

type FinanceApproverLegacyAttestationEvent = {
  action: string;
  actorId: string | null;
  createdAt: Date;
  id: string;
  metadata: Prisma.JsonValue | null;
  target: string;
};

export function financeApproverLegacyAttestationState(
  events: FinanceApproverLegacyAttestationEvent[],
  userId: string,
  now = new Date(),
): { approvalEventId: string | null; lifecycle: FinanceApproverLegacyAttestationLifecycle } {
  const revoked = legacyAttestationClosedEventIds(
    events,
    FINANCE_APPROVER_LEGACY_ATTESTATION_REVOKE_ACTION,
  );
  const superseded = legacyAttestationClosedEventIds(
    events,
    FINANCE_APPROVER_LEGACY_ATTESTATION_SUPERSEDE_ACTION,
  );
  const approvals = events
    .filter((event) => event.action === FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  for (const event of approvals) {
    if (!independentLegacyAttestation(event, userId)) continue;
    if (superseded.has(event.id) || revoked.has(event.id)) continue;
    const expiresAt = legacyAttestationDate(event.metadata, 'expiresAt');
    if (expiresAt && expiresAt.getTime() > now.getTime()) {
      return { approvalEventId: event.id, lifecycle: 'CURRENT' };
    }
  }

  const latest = approvals[0];
  if (!latest) return { approvalEventId: null, lifecycle: 'MISSING' };
  if (superseded.has(latest.id)) return { approvalEventId: latest.id, lifecycle: 'SUPERSEDED' };
  if (revoked.has(latest.id)) return { approvalEventId: latest.id, lifecycle: 'REVOKED' };
  return { approvalEventId: latest.id, lifecycle: 'EXPIRED' };
}

export function financeApproverLegacyAttestationEventLifecycle(
  events: FinanceApproverLegacyAttestationEvent[],
  attestationEventId: string,
  now = new Date(),
): FinanceApproverLegacyAttestationLifecycle {
  const approval = events.find(
    (event) =>
      event.id === attestationEventId &&
      event.action === FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION,
  );
  if (!approval) return 'MISSING';
  const userId = approval.target.split(':')[1] ?? '';
  if (
    legacyAttestationClosedEventIds(
      events,
      FINANCE_APPROVER_LEGACY_ATTESTATION_SUPERSEDE_ACTION,
    ).has(approval.id)
  ) {
    return 'SUPERSEDED';
  }
  if (
    legacyAttestationClosedEventIds(events, FINANCE_APPROVER_LEGACY_ATTESTATION_REVOKE_ACTION).has(
      approval.id,
    )
  ) {
    return 'REVOKED';
  }
  const expiresAt = legacyAttestationDate(approval.metadata, 'expiresAt');
  return userId && independentLegacyAttestation(approval, userId) && expiresAt && expiresAt > now
    ? 'CURRENT'
    : 'EXPIRED';
}

function independentLegacyAttestation(event: FinanceApproverLegacyAttestationEvent, userId: string) {
  if (!event.actorId || !event.metadata || Array.isArray(event.metadata) || typeof event.metadata !== 'object') {
    return false;
  }
  const attestorId = event.metadata.attestorId;
  const independentCheckerId = event.metadata.independentCheckerId;
  const sourceReference = event.metadata.sourceReference;
  const targetUserId = event.metadata.targetUserId;
  const permissionVersion = event.metadata.permissionVersion;
  const requestEventId = event.metadata.attestationRequestEventId;
  const targetSnapshot = event.metadata.targetSnapshot;
  const effectiveAt = legacyAttestationDate(event.metadata, 'effectiveAt');
  const expiresAt = legacyAttestationDate(event.metadata, 'expiresAt');
  return (
    typeof attestorId === 'string' &&
    attestorId.length > 0 &&
    attestorId !== event.actorId &&
    independentCheckerId === event.actorId &&
    event.actorId !== userId &&
    targetUserId === userId &&
    typeof permissionVersion === 'number' &&
    Number.isInteger(permissionVersion) &&
    permissionVersion > 0 &&
    typeof requestEventId === 'string' &&
    requestEventId.length > 0 &&
    Boolean(targetSnapshot) &&
    !Array.isArray(targetSnapshot) &&
    typeof targetSnapshot === 'object' &&
    Boolean(effectiveAt) &&
    Boolean(expiresAt) &&
    expiresAt!.getTime() > effectiveAt!.getTime() &&
    typeof sourceReference === 'string' &&
    sourceReference.trim().length > 0
  );
}

function legacyAttestationClosedEventIds(
  events: FinanceApproverLegacyAttestationEvent[],
  action: string,
) {
  return new Set(
    events
      .filter((event) => event.action === action && event.actorId)
      .map((event) => {
        const metadata = event.metadata;
        return metadata && !Array.isArray(metadata) && typeof metadata === 'object'
          ? metadata.attestationEventId
          : null;
      })
      .filter((eventId): eventId is string => typeof eventId === 'string' && eventId.length > 0),
  );
}

function legacyAttestationDate(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null;
  const value = metadata[key];
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addBlocker(
  blockers: FinanceApproverPolicySnapshot['blockers'],
  code: FinanceApproverPolicyBlockerCode,
) {
  if (blockers.some((blocker) => blocker.code === code)) return;
  blockers.push({ code, message: FINANCE_APPROVER_BLOCKER_MESSAGES[code] });
}

const FINANCE_APPROVER_BLOCKER_MESSAGES: Record<FinanceApproverPolicyBlockerCode, string> = {
  ACCOUNT_LOCKED: 'The operator account is currently locked.',
  CATEGORY_NOT_ALLOWED: 'The operator does not have the required finance permission category.',
  CREDENTIAL_DISABLED: 'The operator credential is disabled.',
  CREDENTIAL_MISSING: 'The operator credential is missing.',
  LEGACY_ACCESS_UNATTESTED: 'Legacy Finance approver access has no independent owner attestation.',
  MAKER_CHECKER_CONFLICT: 'The request maker cannot act as its Finance approver checker.',
  MFA_NOT_VERIFIED: 'MFA verification evidence is not available for this operator.',
  RECENT_REAUTH_REQUIRED: 'Recent password confirmation is required for this high-risk action.',
  NON_PRODUCTION_PROVENANCE: 'The operator is not classified as a production account.',
  ROLE_MISSING: 'The required Admin or Finance approver role is not assigned.',
  SETUP_INCOMPLETE: 'Operator setup is incomplete.',
  SESSION_MFA_UNVERIFIED: 'The current session has no verified MFA challenge receipt.',
  STALE_ROLE_VERSION: 'The operator permission version is missing or no longer matches the reviewed state.',
  TEST_OR_FIXTURE_ACCOUNT: 'Test and fixture accounts cannot approve production finance actions.',
  UNKNOWN_PROVENANCE: 'The operator provenance is unknown.',
};
