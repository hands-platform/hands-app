import { readSearchParam } from '../../lib/date-range';

export type OperationsPolicyDetailsMode = 'summary' | 'all' | 'matching' | 'decisions' | 'audit';
export type OperationsPolicyDecisionMode = 'editor' | 'evidence';
export type OperationsPolicyMatchingMode = 'policy' | 'supply' | 'simulation';

const SUMMARY_BOOKING_SAMPLE_TAKE = 3;
const SUMMARY_POLICY_AUDIT_TAKE = 3;
const SUMMARY_BOOKING_GATE_AUDIT_TAKE = 3;

const MATCHING_BOOKING_SAMPLE_TAKE = 20;
const MATCHING_PROVIDER_SAMPLE_TAKE = 30;
const DECISION_BOOKING_SAMPLE_TAKE = 15;
const DECISION_PROVIDER_SAMPLE_TAKE = 20;
const AUDIT_POLICY_TAKE = 20;
const AUDIT_BOOKING_GATE_TAKE = 20;

type OperationsPolicyParams = Record<string, string | string[] | undefined>;
type OperationsPolicyLoadPlanOptions = {
  readonly allowFullDiagnostics?: boolean;
};

export type OperationsPolicyLoadPlan = {
  readonly bookingGateAuditHref: string | null;
  readonly bookingsHref: string | null;
  readonly detailsMode: OperationsPolicyDetailsMode;
  readonly decisionMode: OperationsPolicyDecisionMode;
  readonly matchingMode: OperationsPolicyMatchingMode;
  readonly policyAuditHref: string | null;
  readonly providersHref: string | null;
  readonly settingsHref: string;
  readonly shouldRenderAdvancedIndex: boolean;
  readonly shouldRenderAuditReview: boolean;
  readonly shouldRenderDecisionReview: boolean;
  readonly shouldRenderDecisionEvidence: boolean;
  readonly shouldRenderFullDiagnostics: boolean;
  readonly shouldRenderMatchingReview: boolean;
  readonly shouldRenderMatchingSimulation: boolean;
  readonly shouldRenderMatchingSupply: boolean;
  readonly shouldRenderMatchingPolicy: boolean;
  readonly shouldRenderPolicyOverview: boolean;
  readonly shouldRenderDecisionSummary: boolean;
};

export function buildOperationsPolicyLoadPlan(
  params: OperationsPolicyParams,
  options: OperationsPolicyLoadPlanOptions = {},
): OperationsPolicyLoadPlan {
  const requestedDetailsMode = normalizeOperationsPolicyDetailsMode(readSearchParam(params.details));
  const detailsMode =
    requestedDetailsMode !== 'summary' && options.allowFullDiagnostics === false
      ? 'summary'
      : requestedDetailsMode;
  const matchingReview = detailsMode === 'matching';
  const matchingMode = normalizeOperationsPolicyMatchingMode(readSearchParam(params.matching));
  const matchingSupply = matchingReview && matchingMode === 'supply';
  const matchingSimulation = matchingReview && matchingMode === 'simulation';
  const matchingEvidence = matchingSupply || matchingSimulation;
  const decisionReview = detailsMode === 'decisions';
  const decisionMode = normalizeOperationsPolicyDecisionMode(readSearchParam(params.decision));
  const decisionEvidence = decisionReview && decisionMode === 'evidence';
  const auditReview = detailsMode === 'audit';
  const policyOverview = detailsMode === 'summary';
  const matchingPolicy = policyOverview || matchingReview;
  const decisionSummary = policyOverview || decisionReview;
  const needsBookings = policyOverview || matchingReview || decisionReview;
  const needsPolicyAudit = policyOverview || auditReview;
  const needsBookingGateAudit = policyOverview || auditReview;
  const bookingsTake = matchingEvidence
    ? MATCHING_BOOKING_SAMPLE_TAKE
    : decisionEvidence
      ? DECISION_BOOKING_SAMPLE_TAKE
      : SUMMARY_BOOKING_SAMPLE_TAKE;
  const policyAuditTake = auditReview ? AUDIT_POLICY_TAKE : SUMMARY_POLICY_AUDIT_TAKE;
  const bookingGateAuditTake = auditReview
    ? AUDIT_BOOKING_GATE_TAKE
    : SUMMARY_BOOKING_GATE_AUDIT_TAKE;
  const providerTake = matchingEvidence
    ? MATCHING_PROVIDER_SAMPLE_TAKE
    : decisionEvidence
      ? DECISION_PROVIDER_SAMPLE_TAKE
      : null;

  return {
    bookingGateAuditHref: needsBookingGateAudit
      ? `/admin/audit-logs?action=booking.create.rejected&take=${bookingGateAuditTake}`
      : null,
    bookingsHref: needsBookings ? `/admin/bookings?take=${bookingsTake}` : null,
    decisionMode,
    detailsMode,
    matchingMode,
    policyAuditHref: needsPolicyAudit
      ? `/admin/audit-logs?action=operational_policy.update&take=${policyAuditTake}`
      : null,
    providersHref: providerTake
      ? `/admin/operations-policy/providers?take=${providerTake}`
      : null,
    settingsHref: '/admin/operational-policy',
    shouldRenderAdvancedIndex: detailsMode === 'all',
    shouldRenderAuditReview: auditReview,
    shouldRenderDecisionReview: decisionReview,
    shouldRenderDecisionEvidence: decisionEvidence,
    shouldRenderFullDiagnostics: matchingEvidence || decisionEvidence || auditReview,
    shouldRenderMatchingReview: matchingReview,
    shouldRenderMatchingSimulation: matchingSimulation,
    shouldRenderMatchingSupply: matchingSupply,
    shouldRenderMatchingPolicy: matchingPolicy,
    shouldRenderPolicyOverview: policyOverview,
    shouldRenderDecisionSummary: decisionSummary,
  };
}

export function buildOperationsPolicyDetailsHref(detailsMode: OperationsPolicyDetailsMode) {
  return detailsMode === 'summary' ? '/operations-policy' : `/operations-policy?details=${detailsMode}`;
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
  return value === 'all' || value === 'matching' || value === 'decisions' || value === 'audit'
    ? value
    : 'summary';
}

function normalizeOperationsPolicyDecisionMode(value: string): OperationsPolicyDecisionMode {
  return value === 'evidence' ? 'evidence' : 'editor';
}

function normalizeOperationsPolicyMatchingMode(value: string): OperationsPolicyMatchingMode {
  return value === 'supply' || value === 'simulation' ? value : 'policy';
}
