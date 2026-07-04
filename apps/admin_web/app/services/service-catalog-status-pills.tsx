import type { AdminTaxPolicyVersion } from '../../lib/admin-api';
import { StatusBadge } from '../../components/status-badge';

type ServiceCatalogStatusPillsProps = {
  readonly activeServiceCount: number;
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly payoutRuleCount: number;
  readonly serviceTypeCount: number;
};

export function ServiceCatalogStatusPills({
  activeServiceCount,
  activeTaxPolicy,
  payoutRuleCount,
  serviceTypeCount,
}: ServiceCatalogStatusPillsProps) {
  return (
    <>
      <StatusBadge tone="success">{serviceTypeCount} service type(s)</StatusBadge>
      <StatusBadge tone="info">{activeServiceCount} active duration option(s)</StatusBadge>
      <StatusBadge tone="info">{payoutRuleCount} payout rule(s)</StatusBadge>
      <StatusBadge tone={activeTaxPolicy ? 'success' : 'warning'}>
        {activeTaxPolicy ? `Tax: ${activeTaxPolicy.name}` : 'No active tax policy'}
      </StatusBadge>
    </>
  );
}
