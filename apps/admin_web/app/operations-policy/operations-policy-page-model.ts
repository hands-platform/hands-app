import { readSearchParam } from '../../lib/date-range';

export type OperationsPolicyDetailsMode = 'summary' | 'all' | 'matching' | 'decisions' | 'audit';
export type OperationsPolicyDecisionMode = 'editor' | 'evidence';

const SUMMARY_BOOKING_SAMPLE_TAKE = 3;
const SUMMARY_POLICY_AUDIT_TAKE = 3;
const SUMMARY_BOOKING_GATE_AUDIT_TAKE = 3;

const MATCHING_BOOKING_SAMPLE_TAKE = 20;
const MATCHING_PROVIDER_SAMPLE_TAKE = 30;
const DECISION_BOOKING_SAMPLE_TAKE = 15;
const DECISION_PROVIDER_SAMPLE_TAKE = 20;
const AUDIT_BOOKING_SAMPLE_TAKE = 10;
const AUDIT_POLICY_TAKE = 20;
const AUDIT_BOOKING_GATE_TAKE = 20;

type OperationsPolicyParams = Record<string, string | string[] | undefined>;
type OperationsPolicyLoadPlanOptions = {
  readonly allowFullDiagnostics?: boolean;
};

export type OperationsPolicyLoadPlan = {
  readonly bookingGateAuditHref: string;
  readonly bookingsHref: string;
  readonly detailsMode: OperationsPolicyDetailsMode;
  readonly decisionMode: OperationsPolicyDecisionMode;
  readonly policyAuditHref: string;
  readonly providersHref: string | null;
  readonly settingsHref: string;
  readonly shouldRenderAdvancedIndex: boolean;
  readonly shouldRenderAuditReview: boolean;
  readonly shouldRenderDecisionReview: boolean;
  readonly shouldRenderDecisionEvidence: boolean;
  readonly shouldRenderFullDiagnostics: boolean;
  readonly shouldRenderMatchingReview: boolean;
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
  const decisionReview = detailsMode === 'decisions';
  const decisionMode = normalizeOperationsPolicyDecisionMode(readSearchParam(params.decision));
  const decisionEvidence = decisionReview && decisionMode === 'evidence';
  const auditReview = detailsMode === 'audit';
  const bookingsTake = matchingReview
    ? MATCHING_BOOKING_SAMPLE_TAKE
    : decisionEvidence
      ? DECISION_BOOKING_SAMPLE_TAKE
      : auditReview
        ? AUDIT_BOOKING_SAMPLE_TAKE
        : SUMMARY_BOOKING_SAMPLE_TAKE;
  const policyAuditTake = auditReview ? AUDIT_POLICY_TAKE : SUMMARY_POLICY_AUDIT_TAKE;
  const bookingGateAuditTake = auditReview
    ? AUDIT_BOOKING_GATE_TAKE
    : SUMMARY_BOOKING_GATE_AUDIT_TAKE;
  const providerTake = matchingReview
    ? MATCHING_PROVIDER_SAMPLE_TAKE
    : decisionEvidence
      ? DECISION_PROVIDER_SAMPLE_TAKE
      : null;

  return {
    bookingGateAuditHref: `/admin/audit-logs?action=booking.create.rejected&take=${bookingGateAuditTake}`,
    bookingsHref: `/admin/bookings?take=${bookingsTake}`,
    decisionMode,
    detailsMode,
    policyAuditHref: `/admin/audit-logs?action=operational_policy.update&take=${policyAuditTake}`,
    providersHref: providerTake
      ? `/admin/operations-policy/providers?take=${providerTake}`
      : null,
    settingsHref: '/admin/operational-policy',
    shouldRenderAdvancedIndex: detailsMode === 'all',
    shouldRenderAuditReview: auditReview,
    shouldRenderDecisionReview: decisionReview,
    shouldRenderDecisionEvidence: decisionEvidence,
    shouldRenderFullDiagnostics: matchingReview || decisionEvidence || auditReview,
    shouldRenderMatchingReview: matchingReview,
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

function normalizeOperationsPolicyDetailsMode(value: string): OperationsPolicyDetailsMode {
  return value === 'all' || value === 'matching' || value === 'decisions' || value === 'audit'
    ? value
    : 'summary';
}

function normalizeOperationsPolicyDecisionMode(value: string): OperationsPolicyDecisionMode {
  return value === 'evidence' ? 'evidence' : 'editor';
}
