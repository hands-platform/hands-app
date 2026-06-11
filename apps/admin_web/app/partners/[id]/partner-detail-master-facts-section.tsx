import type { ReactNode } from 'react';

export type PartnerMasterFact = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
};

type PartnerDetailMasterFactsSectionProps = {
  readonly facts: readonly PartnerMasterFact[];
};

export function PartnerDetailMasterFactsSection({ facts }: PartnerDetailMasterFactsSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-master-facts">
      <div className="ops-section-header">
        <div>
          <h2>Partner master facts</h2>
          <p className="muted">
            Single-page operating sheet for identity, verification, service, booking, revenue, tax,
            location, review, and account facts.
          </p>
        </div>
        <span className="pill pill-info">{facts.length} field(s)</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {facts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
            <small className="muted">{fact.helper}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
