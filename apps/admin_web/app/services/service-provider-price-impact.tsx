import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { providerPriceImpact as buildProviderPriceImpact } from '../../lib/provider-price-impact';
import { actualCompanyCommission, servicePayoutFinance } from '../../lib/service-payout-finance';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminCard } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
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
      <AdminSectionHeader
        actions={(
          <StatusBadge tone={impact.hiddenCount ? 'warning' : 'success'}>
            {impact.visibleCount} visible / {impact.hiddenCount} hidden
          </StatusBadge>
        )}
        description="Shows which Partner prices are visible in the customer app for this exact duration option."
        title="Partner price impact"
      />
      <AdminFilterChipGroup>
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
      </AdminFilterChipGroup>
      {impact.rows.length ? (
        <AdminStageList>
          {impact.rows.slice(0, 6).map((row) => (
            <AdminStageItem key={row.id}>
              <span>{row.state === 'bookable' ? 'SHOW' : 'HIDE'}</span>
              <div>
                <strong>{row.providerName}</strong>
                <p className="muted">
                  Customer <MoneyText amount={row.price} currency={row.currency} /> / Partner{' '}
                  {row.rule ? (
                    <MoneyText amount={row.rule.providerPayoutAmount} currency={row.currency} />
                  ) : (
                    'not configured'
                  )}
                </p>
                <p className="muted">{row.reason}</p>
                {row.rule ? (
                  <p className="muted">
                    Commission projection:{' '}
                    <MoneyText
                      amount={servicePayoutFinance(service, row.rule, activeTaxPolicy).actualCompanyCommission}
                      currency={row.currency}
                    />
                  </p>
                ) : null}
              </div>
              <small>{row.providerStatus}</small>
            </AdminStageItem>
          ))}
        </AdminStageList>
      ) : (
        <AdminEmptyState framed message="No Partner has configured a price for this duration yet." />
      )}
    </AdminCard>
  );
}
