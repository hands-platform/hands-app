import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminSection } from '../../components/admin-surface';
import type { ServicePricingHealthItem } from '../../lib/service-pricing-health';

type ServicePricingHealthSectionProps = {
  readonly items: readonly ServicePricingHealthItem[];
};

export function ServicePricingHealthSection({ items }: ServicePricingHealthSectionProps) {
  const isReady = items.every((item) => item.ok);

  return (
    <AdminSection
      bodyClassName="setup-stage-list"
      className="admin-mb-16"
      description="Partners can charge the minimum price or higher, but every configured customer price should have a payout rule so finance can separate Partner payout, VAT, withholding, and actual commission."
      statusLabel={isReady ? 'Ready' : 'Review'}
      statusTone={isReady ? 'success' : 'warning'}
      title="Pricing health"
    >
      {items.map((item) => (
        <AdminStageItem key={item.label}>
          <span>{item.ok ? 'OK' : 'CHECK'}</span>
          <div>
            <strong>{item.label}</strong>
            <p className="muted">{item.detail}</p>
          </div>
          <small>{item.value}</small>
        </AdminStageItem>
      ))}
    </AdminSection>
  );
}
