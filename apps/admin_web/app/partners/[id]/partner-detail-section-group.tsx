import type { ReactNode } from 'react';
import { StatusBadge } from '../../../components/status-badge';

type PartnerDetailSectionGroupProps = {
  readonly children: ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly id: string;
  readonly status: string;
  readonly title: string;
};

type PartnerDetailReferenceDetailsProps = {
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly helper: string;
  readonly label: string;
  readonly status: string;
};

type PartnerDetailDossierClusterProps = {
  readonly children: ReactNode;
  readonly helper: string;
  readonly label: string;
  readonly status: string;
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
        <StatusBadge tone="info">{status}</StatusBadge>
      </div>
      <div className="partner-detail-section-band-body partner-detail-section-group-body">
        {children}
      </div>
    </section>
  );
}

export function PartnerDetailReferenceDetails({
  children,
  defaultOpen = false,
  helper,
  label,
  status,
}: PartnerDetailReferenceDetailsProps) {
  return (
    <details className="admin-disclosure partner-detail-reference-details" open={defaultOpen ? true : undefined}>
      <summary>
        <span>
          <strong>{label}</strong>
          <small>{helper}</small>
        </span>
        <em>{status}</em>
      </summary>
      <div className="partner-detail-reference-details-body">{children}</div>
    </details>
  );
}

export function PartnerDetailDossierCluster({
  children,
  helper,
  label,
  status,
}: PartnerDetailDossierClusterProps) {
  return (
    <section className="partner-detail-dossier-cluster">
      <div className="partner-detail-dossier-cluster-header">
        <div>
          <strong>{label}</strong>
          <small>{helper}</small>
        </div>
        <StatusBadge tone="info">{status}</StatusBadge>
      </div>
      <div className="partner-detail-dossier-cluster-body">{children}</div>
    </section>
  );
}
