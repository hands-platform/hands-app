import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

const PARTNER_CONTROL_LIST_TAKE = 10;
const PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
] as const;

type PartnerControlPageLoadPlanParams = Record<string, string | string[] | undefined>;

export type PartnerControlPageLoadPlan = {
  readonly listTake: number;
  readonly operationalPolicyHref: string;
  readonly providersHref: string;
  readonly reportsPage: number;
  readonly reportsHref: string;
  readonly sanctionsPage: number;
  readonly sanctionsHref: string;
  readonly summaryHref: string;
};

export function buildPartnerControlPageLoadPlan(
  params: PartnerControlPageLoadPlanParams = {},
): PartnerControlPageLoadPlan {
  const listTake = String(PARTNER_CONTROL_LIST_TAKE);
  const reportsPage = readPositivePage(params.reportPage);
  const sanctionsPage = readPositivePage(params.sanctionPage);

  return {
    listTake: PARTNER_CONTROL_LIST_TAKE,
    operationalPolicyHref: `/admin/operational-policy?${new URLSearchParams({
      keys: PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS.join(','),
    }).toString()}`,
    providersHref: `/admin/partner-controls/providers?${new URLSearchParams({
      take: listTake,
    }).toString()}`,
    reportsPage,
    reportsHref: buildPagedListHref('/admin/provider-reports', reportsPage),
    sanctionsPage,
    sanctionsHref: buildPagedListHref('/admin/provider-sanctions', sanctionsPage),
    summaryHref: '/admin/partner-controls/summary',
  };
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
