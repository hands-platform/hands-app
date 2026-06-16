import type { AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import {
  formatDurationList,
  formatGroupPriceRange,
  standardDurationCoverage,
} from '../../lib/service-group-display';
import { ServiceOptionEditForm } from './service-option-edit-form';
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
    <article className="card service-edit-card">
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
                {service._count?.providers ?? 0} Partner price row(s), {service._count?.bookings ?? 0} booking
                row(s)
              </p>
              <ServiceProviderPriceImpact service={service} activeTaxPolicy={activeTaxPolicy} />

              <ServiceOptionEditForm service={service} />

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
