import type {
  AdminPartnerReferralParent,
  AdminReferralPolicies,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { ReferralDashboard, referralPolicyFallback } from '../referral-dashboard';

export default async function PartnerReferralsPage() {
  const [policies, rows] = await Promise.all([
    adminGet<AdminReferralPolicies>('/admin/referrals/policies', {
      customer: referralPolicyFallback('customer'),
      partner: referralPolicyFallback('partner'),
    }),
    adminGet<AdminPartnerReferralParent[]>('/admin/referrals/partners', []),
  ]);

  return <ReferralDashboard audience="partner" policy={policies.partner} rows={rows} />;
}
