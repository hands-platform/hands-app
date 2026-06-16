import type { AdminTaxPolicyVersion } from '../../lib/admin-api';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { ServiceGroupEditCard } from './service-group-edit-card';

type ServiceGroupEditGridSectionProps = {
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly hiddenGroupCount: number;
  readonly visibleGroups: readonly ServiceCatalogGroup[];
};

export function ServiceGroupEditGridSection({
  activeTaxPolicy,
  hiddenGroupCount,
  visibleGroups,
}: ServiceGroupEditGridSectionProps) {
  return (
    <section className="service-edit-grid">
      {hiddenGroupCount ? (
        <article className="card service-edit-notice-card">
          <h2>Large catalog mode</h2>
          <p className="muted">
            Editing is capped to the first {visibleGroups.length} service type(s) on this page so admin
            operations stay fast. The full catalog remains included in health, booking readiness, and finance
            summaries.
          </p>
        </article>
      ) : null}
      {visibleGroups.map((group) => (
        <ServiceGroupEditCard activeTaxPolicy={activeTaxPolicy} group={group} key={group.key} />
      ))}
    </section>
  );
}
