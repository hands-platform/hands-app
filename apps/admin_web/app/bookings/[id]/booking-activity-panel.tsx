import Link from 'next/link';
import { Download } from 'lucide-react';

import { AdminSection } from '../../../components/admin-surface';
import type { BookingActivityRecord, BookingActivitySummaryItem } from './booking-activity-records';
import { formatDate, shortId } from './booking-formatters';

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
          <a
            className="button button-secondary admin-inline-action"
            download={`hands-booking-${shortId(bookingId)}-activity.csv`}
            href={csvHref}
          >
            <Download aria-hidden="true" size={14} />
            Export activity CSV
          </a>
          <span className="pill pill-info">{eventCount} event(s)</span>
        </div>
      }
      className="admin-mb-16 booking-full-record-index-card"
      description="Jump map for the detailed booking record sections below."
      id="payment-actions"
      title="Booking full record index"
    >
      <div className="service-trace-summary admin-mt-12">
        {cards.map((card) => (
          <a href={card.href} key={`${card.href}-${card.label}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </a>
        ))}
      </div>
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
      actions={<span className="pill pill-info">{totalRecordCount} event(s)</span>}
      className="admin-mt-16 booking-activity-card"
      description="Latest date-sorted operational event trail for this booking."
      id="booking-activity"
      title="Booking chronological activity"
    >
      <div className="service-trace-summary admin-mt-12">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="booking-activity-record-list admin-mt-12">
        {records.length ? (
          records.map((record) => (
            <div
              className="booking-activity-record-row"
              key={`${record.type}-${record.id}-${record.at}`}
            >
              <span className="pill pill-neutral">{record.type}</span>
              <div>
                {record.href ? (
                  <Link className="text-link" href={record.href}>
                    <strong>{record.title}</strong>
                  </Link>
                ) : (
                  <strong>{record.title}</strong>
                )}
                <p className="muted">{record.detail}</p>
              </div>
              <small>{formatDate(record.at)}</small>
            </div>
          ))
        ) : (
          <div className="booking-activity-record-row is-empty">
            <span className="pill pill-neutral">NONE</span>
            <div>
              <strong>No booking activity has been recorded yet</strong>
              <p className="muted">Matching, payment, chat, location, and audit events will appear here.</p>
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
