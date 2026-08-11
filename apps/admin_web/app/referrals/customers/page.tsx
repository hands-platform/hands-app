import type {
  AdminCustomerReferralParent,
  AdminCustomerReferralRewardQueueRow,
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
  buildReferralRewardQueueApiHref,
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
  const policyMode = readSearchParam(resolvedSearchParams.settings) === 'policy';
  const policyNotice = buildPolicyNotice(
    readSearchParam(resolvedSearchParams.status),
    readSearchParam(resolvedSearchParams.reason),
  );
  const filters = buildReferralDashboardFilters(resolvedSearchParams);
  const currentPage = buildReferralDashboardPage(resolvedSearchParams);
  const summaryHref = buildReferralParentSummaryApiHref('customer', filters);
  const parentFilters = { ...filters, reward: 'all' as const };
  const parentRowsHref = buildReferralParentApiHref('customer', parentFilters, currentPage);
  const parentSummaryHref = buildReferralParentSummaryApiHref('customer', parentFilters);
  const rewardRowsHref = buildReferralRewardQueueApiHref(filters, currentPage);
  const [operatorAccess, policiesResult, rowsResult, summaryResult, rewardRowsResult, parentSummaryResult] = await Promise.all([
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
      ? Promise.resolve({ data: [] as AdminCustomerReferralParent[], ok: true, status: 200 })
      : adminGetResult<AdminCustomerReferralParent[]>(parentRowsHref, []),
    !policyMode && summaryHref
      ? adminGetResult<AdminReferralParentSummary | null>(summaryHref, null)
      : Promise.resolve({ data: null, ok: true, status: 200 }),
    policyMode
      ? Promise.resolve({ data: [] as AdminCustomerReferralRewardQueueRow[], ok: true, status: 200 })
      : adminGetResult<AdminCustomerReferralRewardQueueRow[]>(rewardRowsHref, []),
    !policyMode && parentSummaryHref
      ? adminGetResult<AdminReferralParentSummary | null>(parentSummaryHref, null)
      : Promise.resolve({ data: null, ok: true, status: 200 }),
  ]);
  const policies = policiesResult.data;
  const rows = rowsResult.data;
  const summary = summaryResult.data;
  const parentSummary = parentSummaryResult.data;
  const serverPagination = Boolean(parentSummary);
  const rewardSummaryRows = serverPagination
    ? rows
    : filterReferralParentRows('customer', rows, { ...filters, reward: 'all' });
  const filteredRows = rows;

  return (
    <ReferralDashboard
      audience="customer"
      canEditPolicy={hasAdminOperatorCategory(operatorAccess, 'SYSTEM_POLICY')}
      canManageRewards={hasAdminOperatorCategory(operatorAccess, 'FINANCE_SETTLEMENTS')}
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      currentPage={currentPage}
      filters={filters}
      policy={policies.customer}
      policyNotice={policyNotice}
      policyMode={policyMode}
      readError={
        !policiesResult.ok || !summaryResult.ok || !rewardRowsResult.ok
          ? 'Customer referral operations could not be loaded. Retry before making a reward decision.'
          : undefined
      }
      partialReadError={
        !rowsResult.ok || !parentSummaryResult.ok
          ? 'Parent account records are temporarily unavailable. The reward queue may still be used for review.'
          : undefined
      }
      rewardRows={rewardRowsResult.data}
      rewardQueueSummaries={summary?.rewardQueueSummaries ?? buildReferralRewardQueueSummaries(rewardSummaryRows)}
      referralCount={summary?.referralCount}
      rows={filteredRows}
      serverPagination={serverPagination}
      totalCount={parentSummary?.totalCount ?? rows.length}
    />
  );
}

function buildPolicyNotice(status: string, reason: string) {
  if (status === 'saved') {
    return { message: 'Referral policy saved and audit evidence recorded.', tone: 'success' as const };
  }
  if (status === 'conflict') {
    return {
      message: 'This policy changed after the page loaded. Review the latest values before saving again.',
      tone: 'warning' as const,
    };
  }
  if (status === 'blocked') {
    return {
      message:
        reason === 'confirmation-required'
          ? 'Policy update blocked. Provide a 12 to 500 character reason and confirm the liability change.'
          : 'Policy update could not be completed. Review the values and try again.',
      tone: 'danger' as const,
    };
  }
  return undefined;
}
