import Link from 'next/link';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import {
  actionOrderLabel,
  commandToneClass,
  commandToneLabel,
} from './booking-command-display';
import { bookingAgeLabel } from './booking-list-time';
import type { BookingMonitorNextActionItem } from './booking-monitor-next-actions-model';
import { bookingServiceOptionLabel } from './booking-service-labels';

type BookingMonitorNextActionsSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly getProviderLabel: (booking: AdminBooking) => string;
  readonly nextActions: readonly BookingMonitorNextActionItem[];
  readonly nowMs: number;
};

export function BookingMonitorNextActionsSection({
  getCustomerLabel,
  getProviderLabel,
  nextActions,
  nowMs,
}: BookingMonitorNextActionsSectionProps) {
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Next operator actions</h2>
          <p className="muted">
            Booking checklist ordered by customer wait, finance follow-up, and operational aging.
          </p>
        </div>
        <span className={`pill ${nextActions.length > 0 ? 'pill-warn' : 'pill-success'}`}>
          {nextActions.length > 0 ? `${nextActions.length} action(s)` : 'Clear'}
        </span>
      </div>
      <div className="participant-list admin-mt-12">
        {nextActions.map((item) => (
          <Link className="card" href={item.href} key={`${item.booking.id}-${item.title}`}>
            <div className="ops-section-header">
              <div>
                <p>
                  {shortId(item.booking.id)} / {bookingServiceOptionLabel(item.booking)}
                </p>
                <h2>{item.title}</h2>
              </div>
              <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
            </div>
            <p className="muted">{item.detail}</p>
            <p>
              <strong>{item.owner}</strong> / {actionOrderLabel(item.priority)}: {item.operatorAction}
            </p>
            <p className="muted">
              {getCustomerLabel(item.booking)} / {getProviderLabel(item.booking)}
            </p>
            <div className="participant-list admin-mt-10">
              <span className="pill">{item.booking.status}</span>
              <span className="pill">{item.owner}</span>
              <span className="pill">{actionOrderLabel(item.priority)}</span>
              <span className="pill">{bookingAgeLabel(item.booking, nowMs)}</span>
              {item.tags.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
        {nextActions.length === 0 && (
          <div className="card">
            <h2>Booking operations are clear</h2>
            <p className="muted">
              No expired matching, unresolved payment, stale live location, missing chat, or pricing policy
              blocker needs immediate review.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
