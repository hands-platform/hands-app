import { readSearchParam } from '../../lib/date-range';

export type OperationsPolicyDetailsMode = 'summary' | 'matching' | 'decisions' | 'audit';
export type OperationsPolicyDecisionMode = 'editor' | 'evidence';
export type OperationsPolicyMatchingMode = 'policy' | 'supply' | 'simulation';
export type OperationsPolicyAuditSource = 'operator' | 'automated_smoke' | 'legacy_unknown';

const MATCHING_BOOKING_SAMPLE_TAKE = 20;
const MATCHING_PROVIDER_SAMPLE_TAKE = 30;
const AUDIT_POLICY_TAKE = 8;
const AUDIT_CURSOR_HISTORY_LIMIT = 12;

type OperationsPolicyParams = Record<string, string | string[] | undefined>;
type OperationsPolicyLoadPlanOptions = {
  readonly allowAdvancedAudit?: boolean;
  readonly allowFullDiagnostics?: boolean;
  readonly allowPolicyAudit?: boolean;
};

export type OperationsPolicyLoadPlan = {
  readonly auditCursor: string | null;
  readonly auditCursorHistory: readonly string[];
  readonly auditSource: OperationsPolicyAuditSource;
  readonly bookingGateAuditHref: null;
  readonly bookingsHref: string | null;
  readonly detailsMode: OperationsPolicyDetailsMode;
  readonly decisionMode: OperationsPolicyDecisionMode;
  readonly matchingMode: OperationsPolicyMatchingMode;
  readonly matchingPreviewHref: string | null;
  readonly policyAuditHref: string | null;
  readonly policyWriteAuditHealthHref: string | null;
  readonly providersHref: string | null;
  readonly settingsHref: string | null;
  readonly shouldRenderAdvancedIndex: false;
  readonly shouldRenderAuditReview: boolean;
  readonly shouldRenderDecisionEvidence: boolean;
  readonly shouldRenderDecisionReview: boolean;
  readonly shouldRenderDecisionSummary: boolean;
  readonly shouldRenderFullDiagnostics: boolean;
  readonly shouldRenderMatchingPolicy: boolean;
  readonly shouldRenderMatchingHistory: boolean;
  readonly shouldRenderMatchingReview: boolean;
  readonly shouldRenderMatchingSimulation: boolean;
  readonly shouldRenderMatchingSupply: boolean;
  readonly shouldRenderPolicyOverview: boolean;
  readonly shouldRenderPermissionDenied: boolean;
  readonly shouldRenderSupplyDiagnostics: boolean;
};

export function buildOperationsPolicyLoadPlan(
  params: OperationsPolicyParams,
  options: OperationsPolicyLoadPlanOptions = {},
): OperationsPolicyLoadPlan {
  const requestedDetailsMode = normalizeOperationsPolicyDetailsMode(readSearchParam(params.details));
  const requestedMatchingMode = normalizeOperationsPolicyMatchingMode(readSearchParam(params.matching));
  const requestedDecisionMode = normalizeOperationsPolicyDecisionMode(readSearchParam(params.decision));
  const auditSource = normalizeOperationsPolicyAuditSource(readSearchParam(params.audit));
  const auditCursor = normalizeOperationsPolicyAuditCursor(readSearchParam(params.cursor));
  const auditCursorHistory = auditCursor ? normalizeOperationsPolicyAuditHistory(params.auditHistory) : [];
  const diagnosticsAllowed = options.allowFullDiagnostics !== false;
  const policyAuditAllowed = options.allowPolicyAudit ?? diagnosticsAllowed;
  const advancedAuditAllowed = options.allowAdvancedAudit ?? diagnosticsAllowed;
  const matchingDiagnosticsRequested =
    requestedDetailsMode === 'matching' && requestedMatchingMode !== 'policy';
  const policyAuditRequested =
    requestedDetailsMode === 'audit' ||
    (requestedDetailsMode === 'decisions' && requestedDecisionMode === 'evidence');
  const diagnosticsDenied =
    (matchingDiagnosticsRequested && !diagnosticsAllowed) ||
    (policyAuditRequested && !policyAuditAllowed) ||
    (policyAuditRequested && auditSource !== 'operator' && !advancedAuditAllowed);
  const detailsMode = requestedDetailsMode;
  const matchingMode = detailsMode === 'matching' ? requestedMatchingMode : 'policy';
  const decisionMode = detailsMode === 'decisions' ? requestedDecisionMode : 'editor';
  const matchingSupply = !diagnosticsDenied && detailsMode === 'matching' && matchingMode === 'supply';
  const matchingSimulation = !diagnosticsDenied && detailsMode === 'matching' && matchingMode === 'simulation';
  const supplyDiagnostics = matchingSupply && readSearchParam(params.diagnostics) === 'complete';
  const matchingHistory = matchingSimulation && readSearchParam(params.history) === 'review';
  const decisionEvidence = !diagnosticsDenied && detailsMode === 'decisions' && decisionMode === 'evidence';
  const auditReview = !diagnosticsDenied && (detailsMode === 'audit' || decisionEvidence);
  const policyOverview =
    detailsMode === 'summary' ||
    (detailsMode === 'matching' && matchingMode === 'policy') ||
    (detailsMode === 'decisions' && decisionMode === 'editor');
  const needsBookingSample = supplyDiagnostics || matchingHistory;
  const editKey = readSearchParam(params.edit).trim();

  return {
    auditCursor,
    auditCursorHistory,
    auditSource,
    bookingGateAuditHref: null,
    bookingsHref: needsBookingSample
      ? `/admin/bookings?take=${MATCHING_BOOKING_SAMPLE_TAKE}`
      : null,
    decisionMode,
    detailsMode,
    matchingMode,
    matchingPreviewHref: matchingSupply || matchingSimulation
      ? '/admin/operations-policy/matching-preview'
      : null,
    policyAuditHref: auditReview
      ? `/admin/operational-policy/audit?source=${auditSource}&take=${AUDIT_POLICY_TAKE}${auditCursor ? `&cursor=${encodeURIComponent(auditCursor)}` : ''}`
      : null,
    policyWriteAuditHealthHref: policyOverview && editKey
      ? '/admin/operational-policy/audit?source=operator&take=1'
      : null,
    providersHref: supplyDiagnostics
      ? `/admin/operations-policy/providers?take=${MATCHING_PROVIDER_SAMPLE_TAKE}`
      : null,
    settingsHref: diagnosticsDenied || detailsMode === 'audit' ||
      (matchingSupply && !supplyDiagnostics) ||
      (matchingSimulation && !matchingHistory)
      ? null
      : '/admin/operational-policy',
    shouldRenderAdvancedIndex: false,
    shouldRenderAuditReview: auditReview,
    shouldRenderDecisionEvidence: decisionEvidence,
    shouldRenderDecisionReview: detailsMode === 'decisions',
    shouldRenderDecisionSummary: detailsMode === 'decisions' && decisionMode === 'editor',
    shouldRenderFullDiagnostics: needsBookingSample || auditReview,
    shouldRenderMatchingPolicy: detailsMode === 'matching' && matchingMode === 'policy',
    shouldRenderMatchingHistory: matchingHistory,
    shouldRenderMatchingReview: detailsMode === 'matching',
    shouldRenderMatchingSimulation: matchingSimulation,
    shouldRenderMatchingSupply: matchingSupply,
    shouldRenderPolicyOverview: policyOverview,
    shouldRenderPermissionDenied: diagnosticsDenied,
    shouldRenderSupplyDiagnostics: supplyDiagnostics,
  };
}

function normalizeOperationsPolicyAuditSource(value: string): OperationsPolicyAuditSource {
  return value === 'automated_smoke' || value === 'legacy_unknown' ? value : 'operator';
}

function normalizeOperationsPolicyAuditCursor(value: string) {
  return value.length <= 500 && /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

function normalizeOperationsPolicyAuditHistory(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values
    .map((cursor) => normalizeOperationsPolicyAuditCursor(cursor.trim()))
    .filter((cursor): cursor is string => Boolean(cursor))
    .slice(-AUDIT_CURSOR_HISTORY_LIMIT);
}

export function buildOperationsPolicyAuditHref(
  source: OperationsPolicyAuditSource,
  cursor: string | null = null,
  history: readonly string[] = [],
) {
  const params = new URLSearchParams({ details: 'audit' });
  if (source !== 'operator') params.set('audit', source);
  const normalizedCursor = normalizeOperationsPolicyAuditCursor(cursor ?? '');
  if (normalizedCursor) params.set('cursor', normalizedCursor);
  for (const item of history.slice(-AUDIT_CURSOR_HISTORY_LIMIT)) {
    const normalizedItem = normalizeOperationsPolicyAuditCursor(item);
    if (normalizedItem) params.append('auditHistory', normalizedItem);
  }
  return `/operations-policy?${params.toString()}`;
}

export function buildOperationsPolicyDetailsHref(detailsMode: OperationsPolicyDetailsMode | 'all') {
  return detailsMode === 'summary' || detailsMode === 'all'
    ? '/operations-policy'
    : `/operations-policy?details=${detailsMode}`;
}

export function buildOperationsPolicyDecisionHref(decisionMode: OperationsPolicyDecisionMode) {
  return decisionMode === 'editor'
    ? '/operations-policy?details=decisions'
    : '/operations-policy?details=decisions&decision=evidence';
}

export function buildOperationsPolicyMatchingHref(matchingMode: OperationsPolicyMatchingMode) {
  return matchingMode === 'policy'
    ? '/operations-policy?details=matching'
    : `/operations-policy?details=matching&matching=${matchingMode}`;
}

function normalizeOperationsPolicyDetailsMode(value: string): OperationsPolicyDetailsMode {
  return value === 'matching' || value === 'decisions' || value === 'audit' ? value : 'summary';
}

function normalizeOperationsPolicyDecisionMode(value: string): OperationsPolicyDecisionMode {
  return value === 'evidence' ? 'evidence' : 'editor';
}

function normalizeOperationsPolicyMatchingMode(value: string): OperationsPolicyMatchingMode {
  return value === 'supply' || value === 'simulation' ? value : 'policy';
}
