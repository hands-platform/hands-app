import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import { servicePriceLadderCoverage } from '../../lib/service-price-ladder-coverage';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { MoneyText } from '../../components/money-text';
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
      <AdminFilterChipGroup className="admin-mb-12">
        {servicePriceLadderCoverage(service).map((item) => (
          <StatusBadge key={`${service.id}-${item.price}`} tone={item.rule ? 'success' : 'warning'}>
            <MoneyText amount={item.price} currency="VND" />
            {item.rule ? (
              <>
                {' -> '}
                <MoneyText amount={item.rule.providerPayoutAmount} currency={item.rule.currency} />
              </>
            ) : (
              ' missing'
            )}
          </StatusBadge>
        ))}
      </AdminFilterChipGroup>
    </>
  );
}
