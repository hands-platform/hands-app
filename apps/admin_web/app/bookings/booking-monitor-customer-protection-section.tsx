import Link from 'next/link';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { commandToneClass, commandToneLabel, type BookingCommandTone } from './booking-command-display';

export type BookingMonitorCustomerProtectionLane = {
  readonly bookings: readonly AdminBooking[];
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

type BookingMonitorCustomerProtectionSectionProps = {
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly lanes: readonly BookingMonitorCustomerProtectionLane[];
};

export function BookingMonitorCustomerProtectionSection({
  getCustomerLabel,
  lanes,
}: BookingMonitorCustomerProtectionSectionProps) {
  const openCloseoutCount = lanes.reduce((sum, lane) => sum + lane.bookings.length, 0);
  const hasOpenCloseout = lanes.some((lane) => lane.bookings.length > 0);

  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Customer protection closeout board</h2>
          <p className="muted">
            Focused closeout lanes for cancelled, expired, no-show, completed, and cash-fee debt bookings.
            Use this before ending a shift so customer payment and partner wallet outcomes are not left
            open.
          </p>
        </div>
        <span className={`pill ${hasOpenCloseout ? 'pill-warn' : 'pill-success'}`}>
          {openCloseoutCount} open closeout
        </span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {lanes.map((lane) => (
          <Link className="ops-task-card" href={lane.href} key={lane.title}>
            <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
            <h3>{lane.title}</h3>
            <p>{lane.detail}</p>
            <div className="participant-list">
              <span className="pill">{lane.status}</span>
              <span className="pill">{lane.bookings.length} booking(s)</span>
            </div>
            {lane.bookings.length > 0 ? (
              <div className="stack">
                {lane.bookings.slice(0, 3).map((booking) => (
                  <span className="muted" key={`${lane.title}-${booking.id}`}>
                    {shortId(booking.id)} / {getCustomerLabel(booking)} /{' '}
                    {booking.payment?.status ?? 'no payment'}
                  </span>
                ))}
              </div>
            ) : null}
            <small>{lane.operatorAction}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
