import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { servicePriceLadderCoverage } from '../../lib/service-price-ladder-coverage';
import { StatusBadge } from '../../components/status-badge';

type ServicePriceLadderCoverageSectionProps = {
  readonly service: AdminServiceCatalogItem;
};

export function ServicePriceLadderCoverageSection({ service }: ServicePriceLadderCoverageSectionProps) {
  return (
    <>
      <h3>Price ladder coverage</h3>
      <p className="muted">
        Partners may set prices at these increments. Booking stays blocked for any exact customer price
        without an active payout rule.
      </p>
      <div className="participant-list admin-mb-12">
        {servicePriceLadderCoverage(service).map((item) => (
          <StatusBadge key={`${service.id}-${item.price}`} tone={item.rule ? 'success' : 'warning'}>
            {formatMoney(item.price, 'VND')}
            {item.rule
              ? ` -> ${formatMoney(item.rule.providerPayoutAmount, item.rule.currency)}`
              : ' missing'}
          </StatusBadge>
        ))}
      </div>
    </>
  );
}
