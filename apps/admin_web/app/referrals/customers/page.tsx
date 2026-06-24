import type {
  AdminCustomerReferralParent,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import {
  ReferralDashboard,
  buildReferralDashboardFilters,
  filterReferralParentRows,
  referralPolicyFallback,
} from '../referral-dashboard';

type CustomerReferralsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomerReferralsPage({
  searchParams,
}: {
  readonly searchParams?: CustomerReferralsPageSearchParams;
}) {
  const filters = buildReferralDashboardFilters(searchParams ? await searchParams : {});
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminCustomerReferralParent[]>('/admin/referrals/customers', []),
  ]);
  const filteredRows = filterReferralParentRows('customer', rows, filters);

  return (
    <ReferralDashboard
      audience="customer"
      filters={filters}
      policy={policies.customer}
      rows={filteredRows}
      totalCount={rows.length}
    />
  );
}
