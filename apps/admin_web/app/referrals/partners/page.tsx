import type {
  AdminPartnerReferralParent,
  AdminReferralParentSummary,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { adminGetResult } from '../../../lib/admin-api';
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
  const [operatorAccess, policiesResult, rowsResult, summaryResult] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    policyMode
      ? adminGetResult<AdminReferralPolicies>('/admin/referrals/policies', {
          customer: referralPolicyFallback('customer'),
          partner: referralPolicyFallback('partner'),
        })
      : Promise.resolve({ data: {
          customer: referralPolicyFallback('customer'),
          partner: referralPolicyFallback('partner'),
        }, ok: true, status: 200 }),
    policyMode
      ? Promise.resolve({ data: [] as AdminPartnerReferralParent[], ok: true, status: 200 })
      : adminGetResult<AdminPartnerReferralParent[]>(rowsHref, []),
    !policyMode && summaryHref
      ? adminGetResult<AdminReferralParentSummary | null>(summaryHref, null)
      : Promise.resolve({ data: null, ok: true, status: 200 }),
  ]);
  const policies = policiesResult.data;
  const rows = rowsResult.data;
  const summary = summaryResult.data;
  const serverPagination = summaryResult.ok && Boolean(summary);
  const rewardSummaryRows = serverPagination
    ? rows
    : filterReferralParentRows('partner', rows, { ...filters, reward: 'all' });
  const filteredRows = serverPagination ? rows : filterReferralParentRows('partner', rows, filters);

  return (
    <ReferralDashboard
      audience="partner"
      canEditPolicy={hasAdminOperatorCategory(operatorAccess, 'SYSTEM_POLICY')}
      canManageRewards={
        hasAdminOperatorCategory(operatorAccess, 'FINANCE_SETTLEMENTS') &&
        policiesResult.ok &&
        rowsResult.ok &&
        summaryResult.ok
      }
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      currentPage={currentPage}
      filters={filters}
      policy={policies.partner}
      policyMode={policyMode}
      readError={
        !policiesResult.ok || (!policyMode && !rowsResult.ok)
          ? policyMode
            ? 'Partner referral policy could not be loaded. Retry before changing policy settings.'
            : 'Partner referral records could not be loaded. Retry before making a reward decision.'
          : undefined
      }
      partialReadError={
        !policyMode && rowsResult.ok && !summaryResult.ok
          ? 'Partner referral summary could not be loaded. Loaded parent rows remain read-only and totals are limited to those rows.'
          : undefined
      }
      rewardQueueSummaries={summary?.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(rewardSummaryRows)}
      referralCount={summary?.referralCount}
      rows={filteredRows}
      serverPagination={serverPagination}
      totalCount={summary?.totalCount ?? rows.length}
    />
  );
}
