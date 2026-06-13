import type { AdminTaxPolicyVersion } from '../../lib/admin-api';

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
      <span className="pill pill-success">{serviceTypeCount} service type(s)</span>
      <span className="pill pill-info">{activeServiceCount} active duration option(s)</span>
      <span className="pill pill-info">{payoutRuleCount} payout rule(s)</span>
      <span className={`pill ${activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>
        {activeTaxPolicy ? `Tax: ${activeTaxPolicy.name}` : 'No active tax policy'}
      </span>
    </>
  );
}
