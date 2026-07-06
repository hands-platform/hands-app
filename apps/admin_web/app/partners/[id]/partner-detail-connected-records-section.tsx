import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge, StatusBadgeLinkFromPillClass } from '../../../components/status-badge';

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
      <AdminSectionHeader
        actions={<StatusBadge tone="info">{links.length} links</StatusBadge>}
        description={description}
        title={title}
      />
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={links.map((record) => ({
          action: (
            <StatusBadgeLinkFromPillClass href={record.href} pillClass={record.tone}>
              Open
            </StatusBadgeLinkFromPillClass>
          ),
          detail: record.detail,
          detailDateTimePrefix: record.detailDateTimePrefix,
          detailDateTimeValue: record.detailDateTimeValue,
          label: record.label,
          value: record.value,
          valueDateTimeValue: record.valueDateTimeValue,
        }))}
      />
    </AdminCard>
  );
}
