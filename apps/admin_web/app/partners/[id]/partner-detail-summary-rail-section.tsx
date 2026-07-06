import { AdminSummaryCardGrid, AdminTraceSummary } from '../../../components/admin-overview-card';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type {
  PartnerDetailSummaryRailItem,
  PartnerDetailUsageRegionSummary,
} from './partner-detail-summary-rail-model';

type PartnerDetailSummaryRailSectionProps = {
  readonly description: string;
  readonly id: string;
  readonly items: readonly PartnerDetailSummaryRailItem[];
  readonly statusLabel: string;
  readonly title: string;
  readonly usageSummary?: PartnerDetailUsageRegionSummary;
};

export function PartnerDetailSummaryRailSection({
  description,
  id,
  items,
  statusLabel,
  title,
  usageSummary,
}: PartnerDetailSummaryRailSectionProps) {
  return (
    <section className="partner-detail-section-band admin-mb-16" id={id}>
      <div className="partner-detail-section-band-header">
        <div>
          <span>Partner operations</span>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <StatusBadge tone="info">{statusLabel}</StatusBadge>
      </div>
      <div className="partner-detail-section-band-body">
        <AdminTraceSummary
          className="partner-detail-summary-rail-grid"
          metrics={items.map((item) => ({
            detail: item.detail,
            href: item.href,
            label: item.label,
            value: item.value,
          }))}
        />
        {usageSummary ? (
          <section className="partner-detail-usage-summary admin-mt-12">
            <div className="partner-detail-usage-summary-header">
              <div>
                <span>{usageSummary.title}</span>
                <p className="muted">{usageSummary.helper}</p>
              </div>
              <strong>{usageSummary.regionRows.length} region(s)</strong>
            </div>
            <AdminSummaryCardGrid
              className="partner-detail-usage-summary-grid"
              items={usageSummary.items.map((item) => ({
                detail: item.detail,
                detailDateTimeFallback: item.detailDateTimeFallback,
                detailDateTimePrefix: item.detailDateTimePrefix,
                detailDateTimeSuffix: item.detailDateTimeSuffix,
                detailDateTimeValue: item.detailDateTimeValue,
                label: item.label,
                value: item.value,
              }))}
            />
            <div className="partner-detail-usage-region-list">
              {usageSummary.regionRows.map((region) => (
                <div key={region.label}>
                  <span>{region.label}</span>
                  <strong>{region.value}</strong>
                  {usageSummaryDetail(region)}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function usageSummaryDetail(region: PartnerDetailUsageRegionSummary['regionRows'][number]) {
  if (region.detailDateTimeValue) {
    return (
      <small>
        {region.detailDateTimePrefix}
        <DateTimeText fallback={region.detailDateTimeFallback ?? region.detail} value={region.detailDateTimeValue} />
        {region.detailDateTimeSuffix}
      </small>
    );
  }

  return <small>{region.detail}</small>;
}
