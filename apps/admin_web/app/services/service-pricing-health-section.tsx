import type { ServicePricingHealthItem } from '../../lib/service-pricing-health';

type ServicePricingHealthSectionProps = {
  readonly items: readonly ServicePricingHealthItem[];
};

export function ServicePricingHealthSection({ items }: ServicePricingHealthSectionProps) {
  const isReady = items.every((item) => item.ok);

  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Pricing health</h2>
          <p className="muted">
            Partners can charge the minimum price or higher, but every configured customer price should have a
            payout rule so finance can separate partner payout, VAT, withholding, and actual commission.
          </p>
        </div>
        <span className={`pill ${isReady ? 'pill-success' : 'pill-warn'}`}>
          {isReady ? 'Ready' : 'Review'}
        </span>
      </div>
      <div className="setup-stage-list">
        {items.map((item) => (
          <div className="setup-stage-item" key={item.label}>
            <span>{item.ok ? 'OK' : 'CHECK'}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.value}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
