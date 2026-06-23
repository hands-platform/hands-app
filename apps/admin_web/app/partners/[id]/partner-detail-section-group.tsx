import type { ReactNode } from 'react';

type PartnerDetailSectionGroupProps = {
  readonly children: ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly id: string;
  readonly status: string;
  readonly title: string;
};

export function PartnerDetailSectionGroup({
  children,
  description,
  eyebrow,
  id,
  status,
  title,
}: PartnerDetailSectionGroupProps) {
  return (
    <section className="partner-detail-section-band partner-detail-section-group" id={id}>
      <div className="partner-detail-section-band-header">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{status}</span>
      </div>
      <div className="partner-detail-section-band-body partner-detail-section-group-body">
        {children}
      </div>
    </section>
  );
}
