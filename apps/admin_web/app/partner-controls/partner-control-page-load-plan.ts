import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { readSearchParam } from '../../lib/date-range';

const PARTNER_CONTROL_LIST_TAKE = 10;
const PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
] as const;

type PartnerControlPageLoadPlanParams = Record<string, string | string[] | undefined>;

export type PartnerControlPageLoadPlan = {
  readonly detailsMode: PartnerControlDetailsMode;
  readonly listTake: number;
  readonly operationalPolicyHref: string | null;
  readonly providersHref: string | null;
  readonly reportsPage: number;
  readonly reportsHref: string | null;
  readonly sanctionsPage: number;
  readonly sanctionsHref: string | null;
  readonly summaryHref: string;
  readonly shouldRenderAccountControls: boolean;
  readonly shouldRenderControlDiagnostics: boolean;
  readonly shouldRenderReports: boolean;
  readonly shouldRenderSummary: boolean;
  readonly shouldRenderWorkspaceIndex: boolean;
};

export type PartnerControlDetailsMode = 'summary' | 'all' | 'controls' | 'reports' | 'sanctions';

export function buildPartnerControlPageLoadPlan(
  params: PartnerControlPageLoadPlanParams = {},
): PartnerControlPageLoadPlan {
  const listTake = String(PARTNER_CONTROL_LIST_TAKE);
  const reportsPage = readPositivePage(params.reportPage);
  const sanctionsPage = readPositivePage(params.sanctionPage);
  const detailsMode = normalizePartnerControlDetailsMode(params);
  const summaryMode = detailsMode === 'summary';
  const controlsMode = detailsMode === 'controls';
  const reportsMode = detailsMode === 'reports';
  const sanctionsMode = detailsMode === 'sanctions';
  const needsOperationalPolicy = summaryMode || controlsMode;
  const needsProviders = summaryMode || controlsMode || reportsMode;
  const needsReports = summaryMode || controlsMode || reportsMode;
  const needsSanctions = summaryMode || controlsMode || sanctionsMode;

  return {
    detailsMode,
    listTake: PARTNER_CONTROL_LIST_TAKE,
    operationalPolicyHref: needsOperationalPolicy
      ? `/admin/operational-policy?${new URLSearchParams({
          keys: PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS.join(','),
        }).toString()}`
      : null,
    providersHref: needsProviders
      ? `/admin/partner-controls/providers?${new URLSearchParams({
          take: listTake,
        }).toString()}`
      : null,
    reportsPage,
    reportsHref: needsReports ? buildPagedListHref('/admin/provider-reports', reportsPage) : null,
    sanctionsPage,
    sanctionsHref: needsSanctions ? buildPagedListHref('/admin/provider-sanctions', sanctionsPage) : null,
    summaryHref: '/admin/partner-controls/summary',
    shouldRenderAccountControls: sanctionsMode,
    shouldRenderControlDiagnostics: controlsMode,
    shouldRenderReports: reportsMode,
    shouldRenderSummary: summaryMode,
    shouldRenderWorkspaceIndex: summaryMode || detailsMode === 'all',
  };
}

export function buildPartnerControlDetailsHref(
  detailsMode: PartnerControlDetailsMode,
  params: Record<string, string | undefined> = {},
) {
  const searchParams = new URLSearchParams();
  if (detailsMode !== 'summary') {
    searchParams.set('details', detailsMode);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `/partner-controls?${query}` : '/partner-controls';
}

function buildPagedListHref(path: string, page: number) {
  const searchParams = new URLSearchParams({ take: String(PARTNER_CONTROL_LIST_TAKE) });

  if (page > 1) {
    searchParams.set('skip', String((page - 1) * PARTNER_CONTROL_LIST_TAKE));
  }

  return `${path}?${searchParams.toString()}`;
}

function readPositivePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePartnerControlDetailsMode(
  params: PartnerControlPageLoadPlanParams,
): PartnerControlDetailsMode {
  const requestedMode = readSearchParam(params.details);
  if (
    requestedMode === 'all' ||
    requestedMode === 'controls' ||
    requestedMode === 'reports' ||
    requestedMode === 'sanctions'
  ) {
    return requestedMode;
  }
  if (readSearchParam(params.controlAction) || readSearchParam(params.sanctionId) || readSearchParam(params.sanctionPage)) {
    return 'sanctions';
  }
  if (readSearchParam(params.sanction)) {
    return 'sanctions';
  }
  if (readSearchParam(params.review) === 'cash-debt') {
    return 'controls';
  }
  if (
    readSearchParam(params.q) ||
    readSearchParam(params.status) ||
    readSearchParam(params.severity) ||
    readSearchParam(params.reportPage)
  ) {
    return 'reports';
  }
  return 'summary';
}
