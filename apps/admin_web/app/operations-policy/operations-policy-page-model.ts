import { readSearchParam } from '../../lib/date-range';

export type OperationsPolicyDetailsMode = 'summary' | 'all';

const SUMMARY_BOOKING_SAMPLE_TAKE = 3;
const SUMMARY_POLICY_AUDIT_TAKE = 3;
const SUMMARY_BOOKING_GATE_AUDIT_TAKE = 3;

const FULL_BOOKING_SAMPLE_TAKE = 50;
const FULL_PROVIDER_SAMPLE_TAKE = 100;
const FULL_POLICY_AUDIT_TAKE = 20;
const FULL_BOOKING_GATE_AUDIT_TAKE = 50;

type OperationsPolicyParams = Record<string, string | string[] | undefined>;
type OperationsPolicyLoadPlanOptions = {
  readonly allowFullDiagnostics?: boolean;
};

export type OperationsPolicyLoadPlan = {
  readonly bookingGateAuditHref: string;
  readonly bookingsHref: string;
  readonly detailsMode: OperationsPolicyDetailsMode;
  readonly policyAuditHref: string;
  readonly providersHref: string | null;
  readonly settingsHref: string;
  readonly shouldRenderFullDiagnostics: boolean;
};

export function buildOperationsPolicyLoadPlan(
  params: OperationsPolicyParams,
  options: OperationsPolicyLoadPlanOptions = {},
): OperationsPolicyLoadPlan {
  const requestedDetailsMode = normalizeOperationsPolicyDetailsMode(readSearchParam(params.details));
  const detailsMode =
    requestedDetailsMode === 'all' && options.allowFullDiagnostics === false ? 'summary' : requestedDetailsMode;
  const full = detailsMode === 'all';
  const bookingsTake = full ? FULL_BOOKING_SAMPLE_TAKE : SUMMARY_BOOKING_SAMPLE_TAKE;
  const policyAuditTake = full ? FULL_POLICY_AUDIT_TAKE : SUMMARY_POLICY_AUDIT_TAKE;
  const bookingGateAuditTake = full
    ? FULL_BOOKING_GATE_AUDIT_TAKE
    : SUMMARY_BOOKING_GATE_AUDIT_TAKE;

  return {
    bookingGateAuditHref: `/admin/audit-logs?action=booking.create.rejected&take=${bookingGateAuditTake}`,
    bookingsHref: `/admin/bookings?take=${bookingsTake}`,
    detailsMode,
    policyAuditHref: `/admin/audit-logs?action=operational_policy.update&take=${policyAuditTake}`,
    providersHref: full ? `/admin/operations-policy/providers?take=${FULL_PROVIDER_SAMPLE_TAKE}` : null,
    settingsHref: '/admin/operational-policy',
    shouldRenderFullDiagnostics: full,
  };
}

export function buildOperationsPolicyDetailsHref(detailsMode: OperationsPolicyDetailsMode) {
  return detailsMode === 'all' ? '/operations-policy?details=all' : '/operations-policy';
}

function normalizeOperationsPolicyDetailsMode(value: string): OperationsPolicyDetailsMode {
  return value === 'all' ? 'all' : 'summary';
}
