import { Prisma } from '@prisma/client';

export type AdminAuditAreaValue =
  | 'OPERATOR'
  | 'POLICY'
  | 'MONEY'
  | 'BOOKING'
  | 'SECURITY'
  | 'SYSTEM'
  | 'UNKNOWN';
export type AdminAuditSeverityValue = 'INFO' | 'NOTICE' | 'REVIEW' | 'CRITICAL';
export type AdminAuditOutcomeValue =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DENIED'
  | 'SKIPPED'
  | 'OPENED'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'RECORDED'
  | 'UNKNOWN';
export type AdminAuditActorTypeValue = 'HUMAN' | 'SYSTEM' | 'SERVICE' | 'UNKNOWN';

type ActionMatcher = {
  readonly contains?: readonly string[];
  readonly exact?: readonly string[];
  readonly prefixes?: readonly string[];
  readonly suffixes?: readonly string[];
};

type ClassificationRule<T extends string> = ActionMatcher & { readonly value: T };

const ADMIN_SECURITY_DENIED_ACTIONS = [
  'admin_operator.authorization.denied',
  'admin_operator.login.blocked',
  'admin_operator.login.lock',
  'admin_operator.realtime.authentication_denied',
  'admin_operator.realtime.authorization_denied',
  'admin_operator.reauthenticate.blocked',
  'admin_operator.reauthenticate.lock',
  'admin_operator.rest.authentication_denied',
] as const;

const ADMIN_SECURITY_FAILED_ACTIONS = [
  'admin_operator.login.failed',
  'admin_operator.login.failed_unknown_identity',
  'admin_operator.mfa.enrollment_failed',
  'admin_operator.reauthenticate.failed',
] as const;

const ADMIN_SECURITY_SUCCEEDED_ACTIONS = [
  'admin_operator.invitation.accept',
  'admin_operator.login.success',
  'admin_operator.mfa.enrollment_verified',
  'admin_operator.reauthenticate.success',
  'admin_operator.session.logout',
  'admin_operator.session.revoke',
] as const;

const ADMIN_SECURITY_NOTICE_ACTIONS = [
  'admin_operator.mfa.enrollment_started',
  'admin_operator.mfa.enrollment_verified',
  'admin_operator.mfa.reset',
  'admin_operator.reauthenticate.success',
  'admin_operator.session.logout',
  'admin_operator.session.revoke',
] as const;

const AREA_RULES: readonly ClassificationRule<AdminAuditAreaValue>[] = [
  {
    value: 'SECURITY',
    prefixes: [
      'admin_web.access_',
      'admin_web.action_denied',
      'admin.audit_event.',
      'admin.audit_export.',
      'admin_operator.',
      'admin.security.',
      'admin.session.',
      'admin_user.finance_approver.',
      'auth.',
    ],
    contains: ['credential', 'permission'],
  },
  {
    value: 'POLICY',
    prefixes: [
      'operational_policy.',
      'tax_policy.',
      'service.',
      'service_payout_rule.',
      'payment_fee_policy.',
      'platform_fee_policy.',
    ],
  },
  {
    value: 'MONEY',
    prefixes: [
      'accounting.',
      'bank_',
      'booking_settlement.',
      'company_bank_',
      'earning.',
      'finance.',
      'manual_wallet_',
      'payment.',
      'payout.',
      'payout_batch.',
      'provider_bank_',
      'provider_wallet.',
      'referral_reward.',
      'refund.',
      'settlement.',
      'tax_',
      'wallet_',
    ],
    exact: ['booking.completed.closeout'],
  },
  {
    value: 'BOOKING',
    prefixes: ['booking.', 'booking_', 'matching.', 'post_match_cancellation.'],
  },
  {
    value: 'SYSTEM',
    prefixes: [
      'admin.background_jobs.',
      'background_job.',
      'notification.',
      'push_device.',
      'system.',
    ],
  },
  {
    value: 'OPERATOR',
    prefixes: [
      'admin.',
      'coupon.',
      'customer.',
      'operations.',
      'provider.',
      'provider_',
      'provider-',
      'public_site.',
      'referral_',
      'review.',
    ],
  },
];

const OUTCOME_RULES: readonly ClassificationRule<AdminAuditOutcomeValue>[] = [
  { value: 'DENIED', exact: ADMIN_SECURITY_DENIED_ACTIONS, contains: ['denied'], suffixes: ['.blocked', '.reject', '.rejected'] },
  { value: 'FAILED', exact: ADMIN_SECURITY_FAILED_ACTIONS, contains: ['failure', 'failed', 'error'] },
  { value: 'ACKNOWLEDGED', suffixes: ['.acknowledge', '.acknowledged'] },
  { value: 'RESOLVED', contains: ['recovered'], suffixes: ['.resolve', '.resolved'] },
  { value: 'SKIPPED', suffixes: ['.skip', '.skipped'] },
  { value: 'OPENED', contains: ['alerted', 'registered'], suffixes: ['.open', '.opened', '.requested'] },
  {
    value: 'SUCCEEDED',
    exact: ADMIN_SECURITY_SUCCEEDED_ACTIONS,
    suffixes: [
      '.approve',
      '.approved',
      '.complete',
      '.completed',
      '.credit',
      '.create',
      '.created',
      '.delete',
      '.deleted',
      '.execute',
      '.executed',
      '.grant',
      '.lift',
      '.match',
      '.matched',
      '.paid',
      '.publish',
      '.published',
      '.release',
      '.released',
      '.retry_queued',
      '.revoke',
      '.send',
      '.sent',
      '.unblock',
      '.update',
      '.updated',
    ],
  },
];

const SEVERITY_RULES: readonly ClassificationRule<AdminAuditSeverityValue>[] = [
  {
    value: 'CRITICAL',
    contains: ['integrity_failed', 'closeout_failed', 'payout_failed', 'security_breach'],
  },
  {
    value: 'REVIEW',
    exact: [...ADMIN_SECURITY_DENIED_ACTIONS, ...ADMIN_SECURITY_FAILED_ACTIONS],
    contains: ['access_denied', 'action_denied', 'alerted', 'failure', 'failed', 'no_show', 'stale'],
    suffixes: ['.blocked', '.hold', '.reject', '.rejected', '.reverse', '.reversed'],
  },
  {
    value: 'NOTICE',
    exact: ADMIN_SECURITY_NOTICE_ACTIONS,
    prefixes: [
      'accounting.',
      'admin_user.finance_approver.',
      'company_bank_',
      'operational_policy.',
      'payment.',
      'payout.',
      'provider_bank_',
      'referral_reward.',
      'refund.',
      'service.',
      'tax_policy.',
      'wallet_',
    ],
  },
];

export const ADMIN_AUDIT_SAVED_VIEWS = [
  { key: 'REVIEW_REQUIRED', label: 'Review-level events' },
  { key: 'OPERATOR_CHANGES', label: 'Operator changes' },
  { key: 'MONEY_POLICY', label: 'Money & policy' },
  { key: 'SECURITY_ACCESS', label: 'Security & access' },
  { key: 'SYSTEM_INCIDENTS', label: 'System incidents' },
  { key: 'ALL', label: 'All records' },
] as const;

export type AdminAuditSavedView = (typeof ADMIN_AUDIT_SAVED_VIEWS)[number]['key'] | 'LEGACY_TELEMETRY';

const SYSTEM_SOURCES = [
  'background_job_recurring_incident',
  'background_job_recurring_incident_recovery',
  'bank_statement_batch_escalation_sweep',
  'system_monitor',
  'system_sweep',
] as const;

const SERVICE_SOURCES = ['callback', 'queue_worker', 'service', 'webhook', 'worker'] as const;

export type AdminAuditRegistryRow = {
  readonly action: string;
  readonly actor?: { readonly email?: string | null; readonly fullName?: string | null; readonly id?: string; readonly phone?: string | null } | null;
  readonly actorId?: string | null;
  readonly actorKey?: string | null;
  readonly actorLabelSnapshot?: string | null;
  readonly actorType?: string | null;
  readonly area?: string | null;
  readonly correlationId?: string | null;
  readonly createdAt: Date | string;
  readonly eventId?: string | null;
  readonly id: string;
  readonly metadata?: unknown;
  readonly objectId?: string | null;
  readonly objectLabelSnapshot?: string | null;
  readonly objectType?: string | null;
  readonly occurredAt?: Date | string | null;
  readonly outcome?: string | null;
  readonly payloadHash?: string | null;
  readonly recordedAt?: Date | string | null;
  readonly requestId?: string | null;
  readonly schemaVersion?: number | null;
  readonly severity?: string | null;
  readonly source?: string | null;
  readonly tags?: readonly string[] | null;
  readonly target: string;
};

export function classifyAdminAuditAction(action: string) {
  return {
    area: classify(action, AREA_RULES, 'UNKNOWN'),
    outcome: classify(action, OUTCOME_RULES, 'RECORDED'),
    severity: classify(action, SEVERITY_RULES, 'INFO'),
  } as const;
}

export function adminAuditCanonicalCreateData(input: {
  readonly action: string;
  readonly actorId?: string | null;
  readonly actorType?: AdminAuditActorTypeValue;
  readonly correctionOfEventId?: string;
  readonly metadata?: Prisma.InputJsonValue;
  readonly objectLabelSnapshot?: string;
  readonly source: string;
  readonly target: string;
}) {
  const classification = classifyAdminAuditAction(input.action);
  const actorType = input.actorType ?? (input.actorId ? 'HUMAN' : 'SERVICE');
  const actorId = actorType === 'HUMAN' ? (input.actorId ?? null) : null;
  const separator = input.target.indexOf(':');
  return {
    action: input.action,
    actorId,
    actorKey: actorType === 'HUMAN' ? actorId : input.source,
    actorType,
    ...classification,
    ...(input.correctionOfEventId ? { correctionOfEventId: input.correctionOfEventId } : {}),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    objectId: separator > 0 ? input.target.slice(separator + 1) : input.target,
    ...(input.objectLabelSnapshot ? { objectLabelSnapshot: input.objectLabelSnapshot } : {}),
    objectType: separator > 0 ? input.target.slice(0, separator) : 'unknown',
    source: input.source,
    target: input.target,
  } satisfies Prisma.AdminAuditLogUncheckedCreateInput;
}

export function classifyAdminAuditActorType(
  action: string,
  storedActorType: string | null | undefined,
  source: string | null | undefined,
  actorId: string | null | undefined,
  schemaVersion?: number | null,
) {
  const stored = adminAuditActorType(storedActorType);
  return isCanonicalAuditEvent(schemaVersion)
    ? stored
    : inferredActorType(action, source ?? '', actorId ?? null);
}

export function adminAuditEventReadModel(
  row: AdminAuditRegistryRow,
  options: { readonly includePayload?: boolean } = {},
) {
  const metadata = jsonObject(row.metadata);
  const source = row.source ?? jsonString(metadata.source) ?? 'legacy_admin_audit';
  const storedArea = adminAuditArea(row.area);
  const storedSeverity = adminAuditSeverity(row.severity);
  const storedOutcome = adminAuditOutcome(row.outcome);
  const hasStoredClassification = isCanonicalAuditEvent(row.schemaVersion);
  const classification = classifyAdminAuditAction(row.action);
  const actor = adminAuditActor(row, source);
  const object = adminAuditObject(row);
  const reasonText = firstJsonString(metadata, ['reason', 'decisionReason', 'reviewReason', 'note']);
  const reasonCode = firstJsonString(metadata, ['reasonCode', 'failureCode', 'errorCode']);
  const before = metadata.before;
  const after = metadata.after;
  const changedFields = jsonStringArray(metadata.changedFields);
  const occurredAt = isoDate(row.occurredAt ?? row.createdAt);
  const recordedAt = isoDate(row.recordedAt ?? row.createdAt);

  return {
    id: row.id,
    schemaVersion: row.schemaVersion ?? 1,
    occurredAt,
    recordedAt,
    eventType: row.action,
    eventLabel: humanizeAuditAction(row.action),
    area: hasStoredClassification ? storedArea : classification.area,
    severity:
      hasStoredClassification
        ? (storedSeverity ?? 'INFO')
        : classification.severity,
    outcome:
      hasStoredClassification
        ? storedOutcome
        : classification.outcome,
    tags: row.tags ?? [],
    actor,
    object,
    ...(reasonText || reasonCode ? { reason: { ...(reasonCode ? { code: reasonCode } : {}), ...(reasonText ? { text: reasonText } : {}) } } : {}),
    ...(before !== undefined || after !== undefined || changedFields.length > 0
      ? { change: { ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}), ...(changedFields.length > 0 ? { changedFields } : {}) } }
      : {}),
    changeSummary: auditChangeSummary(metadata, changedFields, reasonText),
    context: {
      correlationId: row.correlationId ?? jsonString(metadata.correlationId),
      requestId: row.requestId ?? jsonString(metadata.requestId),
      routeTemplate: jsonString(metadata.routeTemplate),
      source,
    },
    payload: options.includePayload === false ? null : row.metadata ?? null,
    payloadHash: row.payloadHash ?? null,
    integrity: row.payloadHash ? 'HASHED' : 'LEGACY_UNVERIFIED',
    related: adminAuditRelatedObject(object.type, object.id),
  } as const;
}

export function adminAuditDefaultWhere(view: AdminAuditSavedView | null): Prisma.AdminAuditLogWhereInput {
  if (view === 'LEGACY_TELEMETRY') {
    return { action: 'admin_web.page_view' };
  }
  return { NOT: { action: 'admin_web.page_view' } };
}

export function adminAuditSavedViewWhere(view: AdminAuditSavedView): Prisma.AdminAuditLogWhereInput {
  const base = adminAuditDefaultWhere(view);
  switch (view) {
    case 'REVIEW_REQUIRED':
      return { AND: [base, adminAuditReviewLevelWhere()] };
    case 'OPERATOR_CHANGES':
      return { AND: [base, adminAuditAreaWhere('OPERATOR')] };
    case 'MONEY_POLICY':
      return { AND: [base, { OR: [adminAuditAreaWhere('MONEY'), adminAuditAreaWhere('POLICY')] }] };
    case 'SECURITY_ACCESS':
      return { AND: [base, adminAuditAreaWhere('SECURITY')] };
    case 'SYSTEM_INCIDENTS':
      return {
        AND: [
          base,
          adminAuditAreaWhere('SYSTEM'),
          { OR: [adminAuditSeverityWhere('REVIEW'), adminAuditSeverityWhere('CRITICAL')] },
        ],
      };
    default:
      return base;
  }
}

export function adminAuditAreaWhere(area: AdminAuditAreaValue): Prisma.AdminAuditLogWhereInput {
  const legacyWhere = area === 'UNKNOWN'
    ? fallbackClassificationWhere(AREA_RULES)
    : classificationWhere(area, AREA_RULES);
  return effectiveClassificationWhere({ area }, legacyWhere);
}

export function adminAuditSeverityWhere(severity: AdminAuditSeverityValue): Prisma.AdminAuditLogWhereInput {
  const legacyWhere = severity === 'INFO'
    ? fallbackClassificationWhere(SEVERITY_RULES)
    : classificationWhere(severity, SEVERITY_RULES);
  return effectiveClassificationWhere({ severity }, legacyWhere);
}

export function adminAuditOutcomeWhere(outcome: AdminAuditOutcomeValue): Prisma.AdminAuditLogWhereInput {
  const legacyWhere = outcome === 'RECORDED'
    ? fallbackClassificationWhere(OUTCOME_RULES)
    : outcome === 'UNKNOWN'
      ? noMatchingAuditEventWhere()
      : classificationWhere(outcome, OUTCOME_RULES);
  return effectiveClassificationWhere({ outcome }, legacyWhere);
}

export function adminAuditActorTypeWhere(actorType: AdminAuditActorTypeValue): Prisma.AdminAuditLogWhereInput {
  const automaticSourceFilters: Prisma.AdminAuditLogWhereInput[] = SYSTEM_SOURCES.map((source) => ({
    metadata: { path: ['source'], equals: source },
  }));
  const serviceSourceFilters: Prisma.AdminAuditLogWhereInput[] = SERVICE_SOURCES.map((source) => ({
    metadata: { path: ['source'], equals: source },
  }));
  const automaticActionFilter: Prisma.AdminAuditLogWhereInput = {
    OR: [{ action: { startsWith: 'admin.background_jobs.' } }, { action: { startsWith: 'background_job.' } }],
  };

  let legacyWhere: Prisma.AdminAuditLogWhereInput;
  if (actorType === 'SYSTEM') {
    legacyWhere = { OR: [automaticActionFilter, ...automaticSourceFilters] };
  } else if (actorType === 'SERVICE') {
    legacyWhere = { OR: serviceSourceFilters };
  } else if (actorType === 'HUMAN') {
    legacyWhere = {
      AND: [
        { actorId: { not: null } },
        { NOT: { OR: [automaticActionFilter, ...automaticSourceFilters, ...serviceSourceFilters] } },
      ],
    };
  } else {
    legacyWhere = {
      AND: [
        { actorId: null },
        { NOT: { OR: [automaticActionFilter, ...automaticSourceFilters, ...serviceSourceFilters] } },
      ],
    };
  }
  return effectiveClassificationWhere({ actorType }, legacyWhere);
}

export function adminAuditReviewLevelWhere(): Prisma.AdminAuditLogWhereInput {
  return {
    AND: [
      { OR: [adminAuditSeverityWhere('REVIEW'), adminAuditSeverityWhere('CRITICAL')] },
      { NOT: { action: 'admin.background_jobs.failure_registered' } },
    ],
  };
}

function adminAuditActor(row: AdminAuditRegistryRow, source: string) {
  const storedType = adminAuditActorType(row.actorType);
  const inferredType = inferredActorType(row.action, source, row.actorId ?? row.actor?.id ?? null);
  const type = isCanonicalAuditEvent(row.schemaVersion) ? storedType : inferredType;
  const labelSnapshot =
    row.actorLabelSnapshot ??
    (type === 'SYSTEM'
      ? 'HANDS system'
      : type === 'SERVICE'
        ? 'HANDS service'
        : row.actor?.fullName ?? row.actor?.email ?? row.actor?.phone ?? row.actorId ?? 'Unknown actor');
  const legacyAttributionInferred = (row.schemaVersion ?? 1) < 2 && type !== 'HUMAN';

  return {
    type,
    id: type === 'HUMAN' ? (row.actorId ?? row.actor?.id ?? null) : null,
    key: row.actorKey ?? (type === 'HUMAN' ? row.actorId ?? row.actor?.id ?? null : source),
    labelSnapshot,
    attribution: legacyAttributionInferred ? 'LEGACY_INFERRED' : 'RECORDED',
  } as const;
}

function inferredActorType(action: string, source: string, actorId: string | null): AdminAuditActorTypeValue {
  if (
    action.startsWith('admin.background_jobs.') ||
    action.startsWith('background_job.') ||
    SYSTEM_SOURCES.some((candidate) => source === candidate || source.includes(candidate))
  ) {
    return 'SYSTEM';
  }
  if (SERVICE_SOURCES.some((candidate) => source === candidate || source.includes(candidate))) {
    return 'SERVICE';
  }
  return actorId ? 'HUMAN' : 'UNKNOWN';
}

function adminAuditObject(row: AdminAuditRegistryRow) {
  const separator = row.target.indexOf(':');
  const type = row.objectType ?? (separator > 0 ? row.target.slice(0, separator) : 'unknown');
  const id = row.objectId ?? (separator > 0 ? row.target.slice(separator + 1) : row.target);
  return {
    type: type || 'unknown',
    id: id || row.id,
    labelSnapshot: row.objectLabelSnapshot ?? row.target,
  };
}

function adminAuditRelatedObject(type: string, id: string) {
  const encoded = encodeURIComponent(id);
  switch (type) {
    case 'booking':
      return { href: `/bookings/${encoded}`, label: 'Open booking' };
    case 'customer':
      return { href: `/customers/${encoded}`, label: 'Open customer' };
    case 'notification':
      return { href: `/notifications?notificationId=${encoded}`, label: 'Open notification' };
    case 'payment':
      return { href: `/payments/${encoded}`, label: 'Open payment' };
    case 'provider':
      return { href: `/partners/${encoded}`, label: 'Open Partner' };
    case 'refund':
      return { href: `/refunds?refundId=${encoded}`, label: 'Open refund' };
    default:
      return null;
  }
}

function auditChangeSummary(
  metadata: Record<string, unknown>,
  changedFields: readonly string[],
  reason: string | null,
) {
  if (changedFields.length > 0) return `Changed ${changedFields.slice(0, 4).join(', ')}`;
  const details: string[] = [];
  if (reason) {
    details.push(`Reason ${reason}`);
  } else {
    const reasonCode = firstJsonString(metadata, ['reasonCode', 'failureCode', 'errorCode']);
    if (reasonCode) details.push(`Reason ${reasonCode}`);
  }
  const routeTemplate = firstJsonString(metadata, ['routeTemplate']);
  if (routeTemplate) details.push(`Route ${routeTemplate}`);
  const status = firstJsonString(metadata, ['status', 'outcome', 'decision', 'result']);
  if (status) details.push(`Result ${status}`);
  return details.length > 0 ? details.join(' · ') : 'No change details recorded';
}

function humanizeAuditAction(action: string) {
  return action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function classify<T extends string>(action: string, rules: readonly ClassificationRule<T>[], fallback: T): T {
  return rules.find((rule) => actionMatches(action, rule))?.value ?? fallback;
}

function actionMatches(action: string, matcher: ActionMatcher) {
  return Boolean(
    matcher.exact?.includes(action) ||
      matcher.prefixes?.some((value) => action.startsWith(value)) ||
      matcher.suffixes?.some((value) => action.endsWith(value)) ||
      matcher.contains?.some((value) => action.includes(value)),
  );
}

function classificationWhere<T extends string>(
  value: T,
  rules: readonly ClassificationRule<T>[],
): Prisma.AdminAuditLogWhereInput {
  const matchingIndexes = rules.flatMap((rule, index) => (rule.value === value ? [index] : []));
  if (matchingIndexes.length === 0) return noMatchingAuditEventWhere();
  return {
    OR: matchingIndexes.map((index) => ({
      AND: [
        actionMatcherWhere(rules[index]),
        ...rules.slice(0, index).map((rule) => ({ NOT: actionMatcherWhere(rule) })),
      ],
    })),
  };
}

function effectiveClassificationWhere(
  canonicalWhere: Prisma.AdminAuditLogWhereInput,
  legacyWhere: Prisma.AdminAuditLogWhereInput,
): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      { AND: [{ schemaVersion: { gte: 2 } }, canonicalWhere] },
      { AND: [{ schemaVersion: { lt: 2 } }, legacyWhere] },
    ],
  };
}

function noMatchingAuditEventWhere(): Prisma.AdminAuditLogWhereInput {
  return { id: '__no_matching_audit_event__' };
}

function isCanonicalAuditEvent(schemaVersion: number | null | undefined) {
  return (schemaVersion ?? 1) >= 2;
}

function fallbackClassificationWhere<T extends string>(
  rules: readonly ClassificationRule<T>[],
): Prisma.AdminAuditLogWhereInput {
  return { NOT: { OR: rules.map(actionMatcherWhere) } };
}

function actionMatcherWhere(matcher: ActionMatcher): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      ...(matcher.exact ?? []).map((action) => ({ action })),
      ...(matcher.prefixes ?? []).map((value) => ({ action: { startsWith: value } })),
      ...(matcher.suffixes ?? []).map((value) => ({ action: { endsWith: value } })),
      ...(matcher.contains ?? []).map((value) => ({ action: { contains: value } })),
    ],
  };
}

function adminAuditArea(value: string | null | undefined): AdminAuditAreaValue {
  return ['OPERATOR', 'POLICY', 'MONEY', 'BOOKING', 'SECURITY', 'SYSTEM'].includes(value ?? '')
    ? (value as AdminAuditAreaValue)
    : 'UNKNOWN';
}

function adminAuditSeverity(value: string | null | undefined): AdminAuditSeverityValue | null {
  return ['INFO', 'NOTICE', 'REVIEW', 'CRITICAL'].includes(value ?? '')
    ? (value as AdminAuditSeverityValue)
    : null;
}

function adminAuditOutcome(value: string | null | undefined): AdminAuditOutcomeValue {
  return [
    'SUCCEEDED',
    'FAILED',
    'DENIED',
    'SKIPPED',
    'OPENED',
    'ACKNOWLEDGED',
    'RESOLVED',
    'RECORDED',
  ].includes(value ?? '')
    ? (value as AdminAuditOutcomeValue)
    : 'UNKNOWN';
}

function adminAuditActorType(value: string | null | undefined): AdminAuditActorTypeValue {
  return ['HUMAN', 'SYSTEM', 'SERVICE'].includes(value ?? '')
    ? (value as AdminAuditActorTypeValue)
    : 'UNKNOWN';
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function firstJsonString(value: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const candidate = jsonString(value[key]);
    if (candidate) return candidate;
  }
  return null;
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
