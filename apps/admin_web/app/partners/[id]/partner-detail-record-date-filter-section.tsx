import Link from 'next/link';

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
    <div className="card admin-mb-16" id="record-date-filter">
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
        <label>
          Preset
          <select name="range" defaultValue={dateFilters.range}>
            {detailDateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record type
          <select name="type" defaultValue={activityType}>
            {PARTNER_ACTIVITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort order
          <select name="order" defaultValue={activityOrder}>
            {DETAIL_ACTIVITY_ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={dateFilters.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={dateFilters.to} />
        </label>
        <div className="actions">
          <button type="submit">Apply filter</button>
          <a className="text-link" download={activityCsvDownloadName} href={filteredActivityCsvHref}>
            Export activity CSV
          </a>
          <Link className="text-link" href={`/partners/${partnerId}`}>
            Clear
          </Link>
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
    </div>
  );
}
