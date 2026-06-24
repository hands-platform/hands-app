import type {
  AdminPartnerReferralParent,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import {
  ReferralDashboard,
  buildReferralDashboardFilters,
  buildReferralDashboardPage,
  buildReferralRewardQueueSummaries,
  filterReferralParentRows,
  referralPolicyFallback,
} from '../referral-dashboard';

type PartnerReferralsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PartnerReferralsPage({
  searchParams,
}: {
  readonly searchParams?: PartnerReferralsPageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = buildReferralDashboardFilters(resolvedSearchParams);
  const currentPage = buildReferralDashboardPage(resolvedSearchParams);
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminPartnerReferralParent[]>('/admin/referrals/partners', []),
  ]);
  const rewardSummaryRows = filterReferralParentRows('partner', rows, { ...filters, reward: 'all' });
  const filteredRows = filterReferralParentRows('partner', rows, filters);

  return (
    <ReferralDashboard
      audience="partner"
      currentPage={currentPage}
      filters={filters}
      policy={policies.partner}
      rewardQueueSummaries={buildReferralRewardQueueSummaries(rewardSummaryRows)}
      rows={filteredRows}
      totalCount={rows.length}
    />
  );
}
