import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { BookingLiveMatchingPolicyCard } from '../../lib/booking-live-matching-policy-cards';
import type { BookingMatchingEscalationLane } from '../../lib/booking-matching-escalation-board';
import type { BookingMatchingEscalationRow } from '../../lib/booking-matching-escalation-rows';
import type { BookingMatchingFlowStep } from '../../lib/booking-matching-flow-timeline';
import { bookingDashboardTone, commandToneClass, commandToneLabel } from './booking-command-display';
import { bookingServiceOptionLabel } from './booking-service-labels';

export type BookingMonitorDispatchPartnerShortcut = {
  readonly detail: string;
  readonly href: string;
  readonly title: string;
  readonly tone: BookingMatchingEscalationLane<AdminBooking>['tone'];
  readonly value: string;
};

type BookingMonitorMatchingEscalationSectionProps = {
  readonly dispatchPartnerShortcuts: readonly BookingMonitorDispatchPartnerShortcut[];
  readonly getCustomerLabel: (booking: AdminBooking) => string;
  readonly getMatchingWindowLabel: (booking: AdminBooking) => string;
  readonly livePolicyCards: readonly BookingLiveMatchingPolicyCard[];
  readonly matchingEscalationBoard: readonly BookingMatchingEscalationLane<AdminBooking>[];
  readonly matchingEscalationRows: readonly BookingMatchingEscalationRow<AdminBooking>[];
  readonly matchingFlowTimeline: readonly BookingMatchingFlowStep<AdminBooking>[];
};

const MATCHING_EXCEPTION_TABLE_HEADERS = [
  'Booking',
  'Exception',
  'Signal',
  'Operator Action',
  'Evidence Tags',
] as const;

export function BookingMonitorMatchingEscalationSection({
  dispatchPartnerShortcuts,
  getCustomerLabel,
  getMatchingWindowLabel,
  livePolicyCards,
  matchingEscalationBoard,
  matchingEscalationRows,
  matchingFlowTimeline,
}: BookingMonitorMatchingEscalationSectionProps) {
  const visibleEscalationLanes = matchingEscalationBoard.filter((lane) => shouldShowMatchingCard(lane));
  const visibleFlowTimeline = matchingFlowTimeline.filter((step) => shouldShowMatchingCard(step));
  const visibleDispatchPartnerShortcuts = dispatchPartnerShortcuts.filter(isActionTone);
  const visibleMatchingEscalationRows = matchingEscalationRows.slice(0, 6);

  if (
    visibleEscalationLanes.length === 0 &&
    visibleFlowTimeline.length === 0 &&
    visibleDispatchPartnerShortcuts.length === 0 &&
    visibleMatchingEscalationRows.length === 0
  ) {
    return null;
  }

  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Matching escalation board</h2>
          <p className="muted">Only lanes with current dispatch work are shown here.</p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Change matching rules
        </Link>
      </div>
      <div className="ops-section-header admin-mt-14">
        <div>
          <h3>Applied operations policy</h3>
          <p className="muted">
            Live Admin policy values used as the default when a booking does not carry its own saved matching
            snapshot.
          </p>
        </div>
        <span className="pill pill-info">Live policy default</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {livePolicyCards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {visibleEscalationLanes.map((lane) => (
          <Link className="ops-task-card" href={lane.href} key={lane.title}>
            <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
            <h3>{lane.title}</h3>
            <p>{lane.detail}</p>
            <div className="participant-list">
              <span className="pill">{lane.status}</span>
              {lane.metrics.map((metricItem) => (
                <span className="pill" key={`${lane.title}-${metricItem.label}`}>
                  {metricItem.label}: {metricItem.value}
                </span>
              ))}
            </div>
            {lane.bookings.length > 0 ? (
              <div className="stack">
                {lane.bookings.slice(0, 3).map((booking) => (
                  <span className="muted" key={`${lane.title}-${booking.id}`}>
                    {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                    {getMatchingWindowLabel(booking)}
                  </span>
                ))}
              </div>
            ) : null}
            <small>{lane.operatorAction}</small>
          </Link>
        ))}
      </div>
      <div className="admin-mt-16">
        <h3>Matching flow timeline</h3>
        <p className="muted">Active stage exceptions only; full history remains in booking detail.</p>
        <div className="ops-task-grid admin-mt-12">
          {visibleFlowTimeline.map((step) => (
            <Link className="ops-task-card" href={step.href} key={step.stage}>
              <span className={`signal ${commandToneClass(step.tone)}`}>{step.stage}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <div className="participant-list">
                <span className="pill">{step.status}</span>
                {step.metrics.map((metricItem) => (
                  <span className="pill" key={`${step.stage}-${metricItem.label}`}>
                    {metricItem.label}: {metricItem.value}
                  </span>
                ))}
              </div>
              {step.bookings.length > 0 ? (
                <div className="stack">
                  {step.bookings.slice(0, 3).map((booking) => (
                    <span className="muted" key={`${step.stage}-${booking.id}`}>
                      {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                      {getMatchingWindowLabel(booking)}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{step.operatorAction}</small>
            </Link>
          ))}
        </div>
      </div>
      {visibleDispatchPartnerShortcuts.length > 0 && (
        <div className="admin-mt-16">
          <h3>Dispatch Partner repair shortcuts</h3>
          <p className="muted">Shortcuts appear when a Partner-side queue has work.</p>
          <div className="service-trace-summary admin-mt-12">
            {visibleDispatchPartnerShortcuts.map((item) => (
              <Link
                className={`ops-task-breakdown-item ops-task-breakdown-${bookingDashboardTone(item.tone)}`}
                href={item.href}
                key={item.title}
              >
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
        </div>
      )}
      {visibleMatchingEscalationRows.length > 0 && (
        <div className="admin-mt-16">
          <h3>Matching exception queue</h3>
          <p className="muted">Actionable booking rows only; full evidence remains in booking detail.</p>
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table admin-mt-12"
              emptyMessage="No matching exceptions need row-level review."
              headers={MATCHING_EXCEPTION_TABLE_HEADERS}
              rowCount={visibleMatchingEscalationRows.length}
            >
              {visibleMatchingEscalationRows.map((item) => (
                <tr key={`matching-${item.booking.id}`}>
                  <td>
                    <Link className="text-link" href={`/bookings/${item.booking.id}`}>
                      {shortId(item.booking.id)}
                    </Link>
                    <div className="muted">{getCustomerLabel(item.booking)}</div>
                    <div className="muted">{bookingServiceOptionLabel(item.booking)}</div>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <div className="muted">{item.detail}</div>
                  </td>
                  <td>
                    <span className={`signal ${commandToneClass(item.tone)}`}>
                      {commandToneLabel(item.tone)}
                    </span>
                  </td>
                  <td>{item.operatorAction}</td>
                  <td>
                    <div className="participant-list">
                      {item.tags.map((tag) => (
                        <span className="pill" key={`${item.booking.id}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        </div>
      )}
    </section>
  );
}

function shouldShowMatchingCard(item: {
  readonly bookings: readonly unknown[];
  readonly tone: 'danger' | 'info' | 'ok' | 'warn';
}) {
  return isActionTone(item);
}

function isActionTone(item: { readonly tone: 'danger' | 'info' | 'ok' | 'warn' }) {
  return item.tone === 'danger' || item.tone === 'warn';
}
