import type {
  AdminPartnerReferralParent,
  AdminReferralParentSummary,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import { readSearchParam } from '../../../lib/date-range';
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

type PartnerReferralsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PartnerReferralsPage({
  searchParams,
}: {
  readonly searchParams?: PartnerReferralsPageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const policyMode = readSearchParam(resolvedSearchParams.settings) === 'policy';
  const filters = buildReferralDashboardFilters(resolvedSearchParams);
  const currentPage = buildReferralDashboardPage(resolvedSearchParams);
  const rowsHref = buildReferralParentApiHref('partner', filters, currentPage);
  const summaryHref = buildReferralParentSummaryApiHref('partner', filters);
  const [operatorAccess, policies, rows, summary] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    policyMode
      ? adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
          customer: referralPolicyFallback('customer'),
          partner: referralPolicyFallback('partner'),
        })
      : Promise.resolve({
          customer: referralPolicyFallback('customer'),
          partner: referralPolicyFallback('partner'),
        }),
    policyMode ? Promise.resolve([]) : adminGet<AdminPartnerReferralParent[]>(rowsHref, []),
    !policyMode && summaryHref
      ? adminGet<AdminReferralParentSummary | null>(summaryHref, null)
      : Promise.resolve(null),
  ]);
  const serverPagination = Boolean(summary);
  const rewardSummaryRows = serverPagination
    ? rows
    : filterReferralParentRows('partner', rows, { ...filters, reward: 'all' });
  const filteredRows = serverPagination ? rows : filterReferralParentRows('partner', rows, filters);

  return (
    <ReferralDashboard
      audience="partner"
      canEditPolicy={hasAdminOperatorCategory(operatorAccess, 'SYSTEM_POLICY')}
      canManageRewards={hasAdminOperatorCategory(operatorAccess, 'FINANCE_SETTLEMENTS')}
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      currentPage={currentPage}
      filters={filters}
      policy={policies.partner}
      policyMode={policyMode}
      rewardQueueSummaries={summary?.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(rewardSummaryRows)}
      referralCount={summary?.referralCount}
      rows={filteredRows}
      serverPagination={serverPagination}
      totalCount={summary?.totalCount ?? rows.length}
    />
  );
}
