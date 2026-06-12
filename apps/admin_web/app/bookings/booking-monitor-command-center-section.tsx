import Link from 'next/link';
import { commandToneClass, commandToneLabel, type BookingCommandTone } from './booking-command-display';

export type BookingMonitorCommandCenterLane = {
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
  readonly status: string;
  readonly title: string;
  readonly tone: BookingCommandTone;
};

type BookingMonitorCommandCenterSectionProps = {
  readonly lanes: readonly BookingMonitorCommandCenterLane[];
};

export function BookingMonitorCommandCenterSection({ lanes }: BookingMonitorCommandCenterSectionProps) {
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking command center</h2>
          <p className="muted">
            One-glance control for dispatch pressure, customer protection, payment closeout, and handoff
            quality.
          </p>
        </div>
        <span className="pill pill-info">Operator first view</span>
      </div>
      <div className="grid admin-mt-12">
        {lanes.map((lane) => (
          <Link className="card" href={lane.href} key={lane.title}>
            <p>{lane.title}</p>
            <h2>{lane.status}</h2>
            <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
            <p className="muted admin-mt-8">{lane.detail}</p>
            <div className="participant-list admin-mt-10">
              {lane.metrics.map((item) => (
                <span className="pill" key={item.label}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
