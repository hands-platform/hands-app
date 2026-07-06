import { Download } from 'lucide-react';

import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import type { BookingActivityRecord, BookingActivitySummaryItem } from './booking-activity-records';
import { shortId } from './booking-formatters';

export type BookingRecordIndexCard = {
  href: string;
  label: string;
  value: string;
  helper: string;
};

export type BookingFullRecordIndexProps = {
  bookingId: string;
  csvHref: string;
  eventCount: number;
  cards: BookingRecordIndexCard[];
};

export function BookingFullRecordIndex({
  bookingId,
  csvHref,
  eventCount,
  cards,
}: BookingFullRecordIndexProps) {
  return (
    <AdminSection
      actions={
        <div className="actions">
          <AdminFormControlLink
            className="button-secondary admin-inline-action"
            download={`hands-booking-${shortId(bookingId)}-activity.csv`}
            href={csvHref}
          >
            <Download aria-hidden="true" size={14} />
            Export activity CSV
          </AdminFormControlLink>
          <StatusBadge tone="info">{eventCount} event(s)</StatusBadge>
        </div>
      }
      className="admin-mb-16 booking-full-record-index-card"
      description="Jump map for the detailed booking record sections below."
      id="payment-actions"
      title="Booking full record index"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={cards.map((card) => ({
          detail: card.helper,
          href: card.href,
          key: `${card.href}-${card.label}`,
          label: card.label,
          value: card.value,
        }))}
      />
    </AdminSection>
  );
}

export function BookingActivityPanel({
  records,
  summary,
  totalRecordCount = records.length,
}: BookingActivityPanelProps) {
  const hiddenRecordCount = Math.max(totalRecordCount - records.length, 0);

  return (
    <AdminSection
      actions={<StatusBadge tone="info">{totalRecordCount} event(s)</StatusBadge>}
      className="admin-mt-16 booking-activity-card"
      description="Latest date-sorted operational event trail for this booking."
      id="booking-activity"
      title="Booking chronological activity"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
      <div className="booking-activity-record-list admin-mt-12">
        {records.length ? (
          records.map((record) => (
            <div
              className="booking-activity-record-row"
              key={`${record.type}-${record.id}-${record.at}`}
            >
              <StatusBadge tone="neutral">{record.type}</StatusBadge>
              <div>
                {record.href ? (
                  <AdminTextLink href={record.href}>
                    <strong>{record.title}</strong>
                  </AdminTextLink>
                ) : (
                  <strong>{record.title}</strong>
                )}
                <p className="muted">{record.detail}</p>
              </div>
              <small>
                <DateTimeText value={record.at} />
              </small>
            </div>
          ))
        ) : (
          <div className="booking-activity-record-row is-empty">
            <StatusBadge tone="neutral">NONE</StatusBadge>
            <div>
              <AdminEmptyState
                message="Matching, payment, chat, location, and audit events will appear here."
                title="No booking activity has been recorded yet"
              />
            </div>
            <small>0</small>
          </div>
        )}
      </div>
      {hiddenRecordCount > 0 && (
        <p className="muted admin-mt-10">
          Showing latest {records.length} of {totalRecordCount} events in-page. Use the activity CSV or linked
          audit/notification boards for the full operational trail.
        </p>
      )}
    </AdminSection>
  );
}

export type BookingActivityPanelProps = {
  records: BookingActivityRecord[];
  summary: BookingActivitySummaryItem[];
  totalRecordCount?: number;
};
