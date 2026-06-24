import type {
  AdminPartnerReferralParent,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import {
  ReferralDashboard,
  buildReferralDashboardFilters,
  filterReferralParentRows,
  referralPolicyFallback,
} from '../referral-dashboard';

type PartnerReferralsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PartnerReferralsPage({
  searchParams,
}: {
  readonly searchParams?: PartnerReferralsPageSearchParams;
}) {
  const filters = buildReferralDashboardFilters(searchParams ? await searchParams : {});
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminPartnerReferralParent[]>('/admin/referrals/partners', []),
  ]);
  const filteredRows = filterReferralParentRows('partner', rows, filters);

  return (
    <ReferralDashboard
      audience="partner"
      filters={filters}
      policy={policies.partner}
      rows={filteredRows}
      totalCount={rows.length}
    />
  );
}
