import Link from 'next/link';
import { Download } from 'lucide-react';

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
    <section className="card admin-mb-16" id="payment-actions">
      <div className="ops-section-header">
        <div>
          <h2>Booking full record index</h2>
          <p className="muted">
            One-booking record map for operators. This is factual tracking only: customer, Partner,
            matching, chat, payment, fee, tax, wallet, alerts, location, and audit history.
          </p>
        </div>
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
      </div>
      <div className="service-trace-summary admin-mt-12">
        {cards.map((card) => (
          <a href={card.href} key={`${card.href}-${card.label}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

export function BookingActivityPanel({
  records,
  summary,
}: BookingActivityPanelProps) {
  return (
    <section className="card admin-mt-16" id="booking-activity">
      <div className="ops-section-header">
        <div>
          <h2>Booking chronological activity</h2>
          <p className="muted">
            Date-sorted factual event trail for this booking: booking status, Partner participation, chat
            messages, payment, refund, earning, platform fee, tax, wallet, location, notification, review,
            and operator audit records.
          </p>
        </div>
        <span className="pill pill-info">{records.length} event(s)</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="setup-stage-list admin-mt-12">
        {records.length ? (
          records.map((record) => (
            <div className="setup-stage-item" key={`${record.type}-${record.id}-${record.at}`}>
              <span>{record.type}</span>
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
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No booking activity has been recorded yet</strong>
              <p className="muted">Matching, payment, chat, location, and audit events will appear here.</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </section>
  );
}

export type BookingActivityPanelProps = {
  records: BookingActivityRecord[];
  summary: BookingActivitySummaryItem[];
};
