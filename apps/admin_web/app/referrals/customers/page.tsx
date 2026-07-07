import type {
  AdminCustomerReferralParent,
  AdminReferralParentSummary,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import {
  ReferralDashboard,
  buildReferralDashboardFilters,
  buildReferralDashboardPage,
  buildReferralParentApiHref,
  buildReferralParentSummaryApiHref,
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
  const rowsHref = buildReferralParentApiHref('customer', filters, currentPage);
  const summaryHref = buildReferralParentSummaryApiHref('customer', filters);
  const [operatorAccess, policies, rows, summary] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminCustomerReferralParent[]>(rowsHref, []),
    summaryHref ? adminGet<AdminReferralParentSummary | null>(summaryHref, null) : Promise.resolve(null),
  ]);
  const serverPagination = Boolean(summary);
  const rewardSummaryRows = serverPagination
    ? rows
    : filterReferralParentRows('customer', rows, { ...filters, reward: 'all' });
  const filteredRows = serverPagination ? rows : filterReferralParentRows('customer', rows, filters);

  return (
    <ReferralDashboard
      audience="customer"
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      currentPage={currentPage}
      filters={filters}
      policy={policies.customer}
      rewardQueueSummaries={summary?.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(rewardSummaryRows)}
      rows={filteredRows}
      serverPagination={serverPagination}
      totalCount={summary?.totalCount ?? rows.length}
    />
  );
}
