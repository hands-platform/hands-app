import Link from 'next/link';

import { AdminCard } from '../../../components/admin-surface';

import type { PartnerDetailConnectedRecordLink } from './partner-detail-connected-records-model';

export const PARTNER_CONNECTED_RECORDS_DESCRIPTION =
  'Jump from this partner to linked booking, chat, KYC, required documents, location, wallet, payout, and operator records.';

type PartnerDetailConnectedRecordsSectionProps = {
  readonly description: string;
  readonly id: string;
  readonly links: readonly PartnerDetailConnectedRecordLink[];
  readonly title: string;
};

export function PartnerDetailConnectedRecordsSection({
  description,
  id,
  links,
  title,
}: PartnerDetailConnectedRecordsSectionProps) {
  return (
    <AdminCard className="admin-mb-16" id={id}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{links.length} links</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {links.map((record) => (
          <div key={record.label}>
            <span>{record.label}</span>
            <strong>{record.value}</strong>
            <small>{record.detail}</small>
            <Link className={`pill ${record.tone}`} href={record.href}>
              Open
            </Link>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
