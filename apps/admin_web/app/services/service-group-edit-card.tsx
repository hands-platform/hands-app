import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import {
  formatDurationList,
  formatGroupPriceRange,
  standardDurationCoverage,
} from '../../lib/service-group-display';
import { updateService } from './actions';
import { ServicePayoutRulesSection } from './service-payout-rules-section';
import { ServicePriceLadderCoverageSection } from './service-price-ladder-coverage-section';
import { ServiceProviderPriceImpact } from './service-provider-price-impact';

type ServiceGroupEditCardProps = {
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly group: ServiceCatalogGroup;
};

export function ServiceGroupEditCard({ activeTaxPolicy, group }: ServiceGroupEditCardProps) {
  const durationCoverage = standardDurationCoverage(group.items);

  return (
    <article className="card">
      <div className="toolbar admin-mb-12">
        <div>
          <h2>{group.label}</h2>
          <p className="muted">
            {formatDurationList(group.items)} option(s) / {formatGroupPriceRange(group.items)}
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-info">{group.key}</span>
          <span className={`pill ${durationCoverage.tone}`}>{durationCoverage.label}</span>
        </div>
      </div>

      <div className="setup-stage-list">
        {group.items.map((service) => (
          <div className="setup-stage-item" key={service.id}>
            <span>{service.active ? 'ON' : 'OFF'}</span>
            <div>
              <strong>{service.durationMin} min option</strong>
              <p className="muted">
                Minimum {formatMoney(service.basePrice, 'VND')} / step {formatMoney(service.priceStep, 'VND')}
              </p>
              <p className="muted">
                {service._count?.providers ?? 0} partner price row(s), {service._count?.bookings ?? 0} booking
                row(s)
              </p>
              <ServiceProviderPriceImpact service={service} activeTaxPolicy={activeTaxPolicy} />

              <form action={updateService} className="form-grid compact-form">
                <input type="hidden" name="serviceId" value={service.id} />
                <label>
                  Group key
                  <input name="serviceGroupKey" defaultValue={service.serviceGroupKey ?? ''} />
                </label>
                <label>
                  Name
                  <input name="name" defaultValue={service.name} />
                </label>
                <label>
                  Duration
                  <input name="durationMin" type="number" min="1" defaultValue={service.durationMin} />
                </label>
                <label>
                  Minimum price
                  <input
                    name="basePrice"
                    type="number"
                    min="100000"
                    step={service.priceStep}
                    defaultValue={service.basePrice}
                  />
                </label>
                <label>
                  Price step
                  <input
                    name="priceStep"
                    type="number"
                    min="100000"
                    step="100000"
                    defaultValue={service.priceStep}
                  />
                </label>
                <label>
                  Display order
                  <input name="displayOrder" type="number" defaultValue={service.displayOrder} />
                </label>
                <label className="full-span">
                  Description
                  <input name="description" defaultValue={service.description ?? ''} />
                </label>
                <label>
                  Active
                  <input name="active" type="checkbox" defaultChecked={service.active} />
                </label>
                <button type="submit">Update service</button>
              </form>

              <ServicePriceLadderCoverageSection service={service} />

              <ServicePayoutRulesSection service={service} activeTaxPolicy={activeTaxPolicy} />
            </div>
            <small>{service.id.slice(0, 8)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}
