const PARTNER_CONTROL_LIST_TAKE = 25;

export type PartnerControlPageLoadPlan = {
  readonly operationalPolicyHref: string;
  readonly providersHref: string;
  readonly reportsHref: string;
  readonly sanctionsHref: string;
};

export function buildPartnerControlPageLoadPlan(): PartnerControlPageLoadPlan {
  const listTake = String(PARTNER_CONTROL_LIST_TAKE);

  return {
    operationalPolicyHref: '/admin/operational-policy',
    providersHref: `/admin/partner-controls/providers?${new URLSearchParams({
      take: listTake,
    }).toString()}`,
    reportsHref: `/admin/provider-reports?${new URLSearchParams({ take: listTake }).toString()}`,
    sanctionsHref: `/admin/provider-sanctions?${new URLSearchParams({ take: listTake }).toString()}`,
  };
}
