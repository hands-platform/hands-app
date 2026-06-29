import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

const PARTNER_CONTROL_LIST_TAKE = 10;
const PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
] as const;

export type PartnerControlPageLoadPlan = {
  readonly operationalPolicyHref: string;
  readonly providersHref: string;
  readonly reportsHref: string;
  readonly sanctionsHref: string;
  readonly summaryHref: string;
};

export function buildPartnerControlPageLoadPlan(): PartnerControlPageLoadPlan {
  const listTake = String(PARTNER_CONTROL_LIST_TAKE);

  return {
    operationalPolicyHref: `/admin/operational-policy?${new URLSearchParams({
      keys: PARTNER_CONTROL_OPERATIONAL_POLICY_KEYS.join(','),
    }).toString()}`,
    providersHref: `/admin/partner-controls/providers?${new URLSearchParams({
      take: listTake,
    }).toString()}`,
    reportsHref: `/admin/provider-reports?${new URLSearchParams({ take: listTake }).toString()}`,
    sanctionsHref: `/admin/provider-sanctions?${new URLSearchParams({ take: listTake }).toString()}`,
    summaryHref: '/admin/partner-controls/summary',
  };
}
