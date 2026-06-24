import type {
  AdminCustomerReferralParent,
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

type CustomerReferralsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomerReferralsPage({
  searchParams,
}: {
  readonly searchParams?: CustomerReferralsPageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = buildReferralDashboardFilters(resolvedSearchParams);
  const currentPage = buildReferralDashboardPage(resolvedSearchParams);
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminCustomerReferralParent[]>('/admin/referrals/customers', []),
  ]);
  const rewardSummaryRows = filterReferralParentRows('customer', rows, { ...filters, reward: 'all' });
  const filteredRows = filterReferralParentRows('customer', rows, filters);

  return (
    <ReferralDashboard
      audience="customer"
      currentPage={currentPage}
      filters={filters}
      policy={policies.customer}
      rewardQueueSummaries={buildReferralRewardQueueSummaries(rewardSummaryRows)}
      rows={filteredRows}
      totalCount={rows.length}
    />
  );
}
