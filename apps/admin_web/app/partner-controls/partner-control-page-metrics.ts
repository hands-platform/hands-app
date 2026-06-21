import type { AdminPageMetric } from '../../components/admin-page-template';

export function buildPartnerControlPageMetrics(
  summary: readonly (readonly [string, string])[],
): readonly AdminPageMetric[] {
  return summary.map(([label, value]) => ({
    helper: partnerControlMetricHelper(label),
    label,
    value,
  }));
}

function partnerControlMetricHelper(label: string) {
  switch (label) {
    case 'Active controls':
      return 'Current account-control records that still need review.';
    case 'Blocked accounts':
      return 'Partners with account access currently held.';
    case 'Location gaps':
      return 'Online Partners with missing or stale dispatch location.';
    case 'Onboarding gaps':
      return 'Partners missing KYC, required documents, service setup, or approval readiness.';
    case 'Open reports':
      return 'Reports still open or under investigation.';
    case 'Shared devices':
      return 'Partners with device overlap signals.';
    case 'Urgent / major':
      return 'High-priority reports for safety or operations review.';
    case 'Wallet debt':
      return 'Partners with cash fee debt requiring finance follow-up.';
    default:
      return 'Partner control desk metric.';
  }
}
