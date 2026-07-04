import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { providerPriceImpact as buildProviderPriceImpact } from '../../lib/provider-price-impact';
import { actualCompanyCommission, servicePayoutFinance } from '../../lib/service-payout-finance';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

type ServiceProviderPriceImpactProps = {
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly service: AdminServiceCatalogItem;
};

export function ServiceProviderPriceImpact({ activeTaxPolicy, service }: ServiceProviderPriceImpactProps) {
  const impact = buildProviderPriceImpact({
    activeTaxPolicy,
    actualCompanyCommission,
    service,
  });

  return (
    <AdminCard className="service-impact-card">
      <div className="ops-section-header">
        <div>
          <h3>Partner price impact</h3>
          <p className="muted">
            Shows which Partner prices are visible in the customer app for this exact duration option.
          </p>
        </div>
        <StatusBadge tone={impact.hiddenCount ? 'warning' : 'success'}>
          {impact.visibleCount} visible / {impact.hiddenCount} hidden
        </StatusBadge>
      </div>
      <div className="participant-list">
        <StatusBadge tone="info">{impact.rows.length} loaded row(s)</StatusBadge>
        <StatusBadge tone={impact.unsupportedCount ? 'warning' : 'success'}>
          {impact.unsupportedCount} missing payout
        </StatusBadge>
        <StatusBadge tone={impact.belowMinimumCount ? 'danger' : 'success'}>
          {impact.belowMinimumCount} below minimum
        </StatusBadge>
        <StatusBadge tone={impact.inactiveOrBlockedCount ? 'neutral' : 'success'}>
          {impact.inactiveOrBlockedCount} inactive/blocked
        </StatusBadge>
      </div>
      {impact.rows.length ? (
        <div className="setup-stage-list">
          {impact.rows.slice(0, 6).map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span>{row.state === 'bookable' ? 'SHOW' : 'HIDE'}</span>
              <div>
                <strong>{row.providerName}</strong>
                <p className="muted">
                  Customer {formatMoney(row.price, row.currency)} / Partner{' '}
                  {row.rule ? formatMoney(row.rule.providerPayoutAmount, row.currency) : 'not configured'}
                </p>
                <p className="muted">{row.reason}</p>
                {row.rule ? (
                  <p className="muted">
                    Commission projection:{' '}
                    {formatMoney(
                      servicePayoutFinance(service, row.rule, activeTaxPolicy).actualCompanyCommission,
                      row.currency,
                    )}
                  </p>
                ) : null}
              </div>
              <small>{row.providerStatus}</small>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No Partner has configured a price for this duration yet." />
      )}
    </AdminCard>
  );
}
