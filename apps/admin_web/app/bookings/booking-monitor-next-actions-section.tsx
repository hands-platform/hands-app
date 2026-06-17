import Link from 'next/link';
import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';
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
  if (nextActions.length === 0) {
    return null;
  }

  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Next operator actions</h2>
          <p className="muted">
            Flagged bookings that need operator review now; normal active bookings stay in the table.
          </p>
        </div>
        <span className="pill pill-warn">{nextActions.length} action(s)</span>
      </div>
      <div className="participant-list admin-mt-12">
        {nextActions.map((item) => (
          <Link className="card" href={item.href} key={`${item.booking.id}-${item.title}`} title={item.detail}>
            <div className="ops-section-header">
              <div>
                <p>
                  {shortId(item.booking.id)} / {bookingServiceOptionLabel(item.booking)}
                </p>
                <h2>{item.title}</h2>
              </div>
              <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
            </div>
            <p className="muted">{compactNextActionDetail(item.detail)}</p>
            <p title={item.operatorAction}>
              <strong>{item.owner}</strong> / {actionOrderLabel(item.priority)}:{' '}
              {compactOperatorAction(item.operatorAction)}
            </p>
            <p className="muted">
              {getCustomerLabel(item.booking)} / {marketplaceDisplayText(getProviderLabel(item.booking))}
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
      </div>
    </section>
  );
}

function compactNextActionDetail(detail: string): string {
  if (detail.startsWith('No-show is marked')) {
    return 'No-show review required.';
  }
  if (detail.length > 64) {
    return 'Open booking detail for the full action context.';
  }

  return detail;
}

function compactOperatorAction(operatorAction: string): string {
  if (operatorAction.startsWith('No-show is marked')) {
    return 'No-show review';
  }
  if (operatorAction.length > 64) {
    return 'Open detail';
  }

  return operatorAction;
}
