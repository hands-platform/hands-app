import { Download, Filter, X } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
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
  view: 'journey' | 'evidence' | 'ledger';
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
  view,
}: PartnerDetailRecordDateFilterSectionProps) {
  const activityTypeLabel = detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS);

  return (
    <AdminFilterPanel
      actions={(
        <AdminFilterSummary
          ariaLabel="Active record date filters"
          labels={[dateFilters.label, activityTypeLabel, activityOrderLabel(activityOrder)]}
          tone="info"
        />
      )}
      className="partner-record-date-filter-panel admin-mb-16"
      description="Narrow booking, chat, app, location, payout, and verification records without changing partner data."
      id="record-date-filter"
      title="Record date filter"
    >
      <AdminFormGrid className="admin-mt-14" action={`/partners/${partnerId}`}>
        <input name="section" type="hidden" value="bookings" />
        {view === 'journey' ? null : <input name="bookings" type="hidden" value={view} />}
        <AdminFormSelect
          className="admin-directory-filter-select"
          defaultValue={dateFilters.range}
          label="Preset"
          name="range"
          options={detailDateRangeOptions}
        />
        <AdminFormSelect
          className="admin-directory-filter-select"
          defaultValue={activityType}
          label="Record type"
          name="type"
          options={PARTNER_ACTIVITY_TYPE_OPTIONS}
        />
        <AdminFormSelect
          className="admin-directory-filter-select"
          defaultValue={activityOrder}
          label="Sort order"
          name="order"
          options={DETAIL_ACTIVITY_ORDER_OPTIONS}
        />
        <AdminFormDate
          className="admin-form-control-fluid"
          defaultValue={dateFilters.from}
          label="From"
          name="from"
        />
        <AdminFormDate
          className="admin-form-control-fluid"
          defaultValue={dateFilters.to}
          label="To"
          name="to"
        />
        <div className="actions">
          <AdminFormControlButton className="admin-directory-filter-button">
            <Filter aria-hidden="true" size={16} />
            Apply filter
          </AdminFormControlButton>
          <AdminFormControlLink
            className="admin-directory-filter-export"
            download={activityCsvDownloadName}
            href={filteredActivityCsvHref}
          >
            <Download aria-hidden="true" size={16} />
            Export activity CSV
          </AdminFormControlLink>
          <AdminFormControlLink
            className="admin-directory-filter-button is-ghost"
            href={`/partners/${partnerId}?${new URLSearchParams({
              section: 'bookings',
              ...(view === 'journey' ? {} : { bookings: view }),
            }).toString()}`}
          >
            <X aria-hidden="true" size={16} />
            Clear
          </AdminFormControlLink>
        </div>
      </AdminFormGrid>
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'Preferred, selected, and marketplace participation records.',
            label: 'Filtered booking archive',
            value: filteredBookingArchiveCount,
          },
          {
            detail: `${activityTypeLabel} in this period.`,
            label: 'Filtered activity',
            value: filteredActivityCount,
          },
          {
            detail: 'Total visible archive before this filter.',
            label: 'Loaded bookings',
            value: totalBookingArchiveCount,
          },
          {
            detail: 'Total factual activity before this filter.',
            label: 'Loaded events',
            value: totalActivityCount,
          },
        ]}
      />
    </AdminFilterPanel>
  );
}
