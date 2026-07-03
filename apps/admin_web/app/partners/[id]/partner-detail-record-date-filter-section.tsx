import { Download, Filter, X } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminCard } from '../../../components/admin-surface';
import type { DetailDateFilters } from '../../../lib/detail-date-filter';
import { detailDateRangeOptions } from '../../../lib/detail-date-filter';
import { detailActivityTypeLabel } from '../../../lib/detail-activity-filter';
import {
  DETAIL_ACTIVITY_ORDER_OPTIONS,
  PARTNER_ACTIVITY_TYPE_OPTIONS,
  activityOrderLabel,
  type DetailActivityOrder,
} from './partner-detail-filters';

type PartnerDetailRecordDateFilterSectionProps = {
  activityCsvDownloadName: string;
  activityOrder: DetailActivityOrder;
  activityType: string;
  dateFilters: Pick<DetailDateFilters, 'from' | 'label' | 'range' | 'to'>;
  filteredActivityCount: number;
  filteredActivityCsvHref: string;
  filteredBookingArchiveCount: number;
  partnerId: string;
  totalActivityCount: number;
  totalBookingArchiveCount: number;
};

export function PartnerDetailRecordDateFilterSection({
  activityCsvDownloadName,
  activityOrder,
  activityType,
  dateFilters,
  filteredActivityCount,
  filteredActivityCsvHref,
  filteredBookingArchiveCount,
  partnerId,
  totalActivityCount,
  totalBookingArchiveCount,
}: PartnerDetailRecordDateFilterSectionProps) {
  const activityTypeLabel = detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS);

  return (
    <AdminCard className="admin-mb-16" id="record-date-filter">
      <div className="ops-section-header">
        <div>
          <h2>Record date filter</h2>
          <p className="muted">
            Narrow booking, chat, app, location, payout, and verification records without changing partner
            data.
          </p>
        </div>
        <div className="participant-list">
          <span className="pill pill-info">{dateFilters.label}</span>
          <span className="pill pill-neutral">{activityTypeLabel}</span>
          <span className="pill pill-neutral">{activityOrderLabel(activityOrder)}</span>
        </div>
      </div>
      <form className="form-grid admin-mt-14" action={`/partners/${partnerId}`}>
        <AdminFormSelect
          className="partner-detail-filter-select"
          defaultValue={dateFilters.range}
          label="Preset"
          name="range"
          options={detailDateRangeOptions}
        />
        <AdminFormSelect
          className="partner-detail-filter-select"
          defaultValue={activityType}
          label="Record type"
          name="type"
          options={PARTNER_ACTIVITY_TYPE_OPTIONS}
        />
        <AdminFormSelect
          className="partner-detail-filter-select"
          defaultValue={activityOrder}
          label="Sort order"
          name="order"
          options={DETAIL_ACTIVITY_ORDER_OPTIONS}
        />
        <AdminFormDate
          className="partner-detail-filter-date"
          defaultValue={dateFilters.from}
          label="From"
          name="from"
        />
        <AdminFormDate
          className="partner-detail-filter-date"
          defaultValue={dateFilters.to}
          label="To"
          name="to"
        />
        <div className="actions">
          <AdminFormControlButton className="partner-detail-filter-button">
            <Filter aria-hidden="true" size={16} />
            Apply filter
          </AdminFormControlButton>
          <AdminFormControlLink
            className="partner-detail-filter-link"
            download={activityCsvDownloadName}
            href={filteredActivityCsvHref}
          >
            <Download aria-hidden="true" size={16} />
            Export activity CSV
          </AdminFormControlLink>
          <AdminFormControlLink className="partner-detail-filter-link" href={`/partners/${partnerId}`}>
            <X aria-hidden="true" size={16} />
            Clear
          </AdminFormControlLink>
        </div>
      </form>
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Filtered booking archive</span>
          <strong>{filteredBookingArchiveCount}</strong>
          <small>Preferred, selected, and marketplace participation records.</small>
        </div>
        <div>
          <span>Filtered activity</span>
          <strong>{filteredActivityCount}</strong>
          <small>{activityTypeLabel} in this period.</small>
        </div>
        <div>
          <span>Loaded bookings</span>
          <strong>{totalBookingArchiveCount}</strong>
          <small>Total visible archive before this filter.</small>
        </div>
        <div>
          <span>Loaded events</span>
          <strong>{totalActivityCount}</strong>
          <small>Total factual activity before this filter.</small>
        </div>
      </div>
    </AdminCard>
  );
}
