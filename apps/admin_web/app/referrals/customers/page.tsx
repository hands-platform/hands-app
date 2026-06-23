import type {
  AdminCustomerReferralParent,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { ReferralDashboard, referralPolicyFallback } from '../referral-dashboard';

export default async function CustomerReferralsPage() {
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminCustomerReferralParent[]>('/admin/referrals/customers', []),
  ]);

  return <ReferralDashboard audience="customer" policy={policies.customer} rows={rows} />;
}
