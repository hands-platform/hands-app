import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { AdminSignal, StatusBadge } from '../../components/status-badge';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { BookingLiveMatchingPolicyCard } from '../../lib/booking-live-matching-policy-cards';
import type { BookingMatchingEscalationLane } from '../../lib/booking-matching-escalation-board';
import type { BookingMatchingEscalationRow } from '../../lib/booking-matching-escalation-rows';
import type { BookingMatchingFlowStep } from '../../lib/booking-matching-flow-timeline';
import { commandSignalTone, commandToneLabel } from './booking-command-display';
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

const MATCHING_FLOW_TABLE_HEADERS = [
  'Stage',
  'Flow Step',
  'Status',
  'Metrics',
  'Sample Bookings',
  'Operator Action',
] as const;

const MATCHING_ESCALATION_LANE_TABLE_HEADERS = [
  'Lane',
  'Status',
  'Metrics',
  'Sample Bookings',
  'Operator Action',
] as const;

const LIVE_POLICY_TABLE_HEADERS = ['Policy', 'Value', 'Helper'] as const;

const DISPATCH_PARTNER_SHORTCUT_TABLE_HEADERS = ['Partner Queue', 'Count', 'Detail', 'Action'] as const;

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
    <AdminSection
      actions={
        <Link className="text-link" href="/operations-policy">
          Change matching rules
        </Link>
      }
      className="admin-mt-16"
      description="Only lanes with current dispatch work are shown here."
      title="Matching escalation board"
    >
      <AdminSectionHeader
        className="admin-mt-14"
        description="Live Admin policy values used as the default when a booking does not carry its own saved matching snapshot."
        status={<StatusBadge tone="info">Live policy default</StatusBadge>}
        title="Applied operations policy"
      />
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table admin-mt-12"
          emptyMessage="No live matching policy values are loaded."
          headers={LIVE_POLICY_TABLE_HEADERS}
          rowCount={livePolicyCards.length}
        >
          {livePolicyCards.map((card) => (
            <tr key={card.label}>
              <td>
                <strong>{card.label}</strong>
              </td>
              <td>{card.value}</td>
              <td>
                <span className="muted">{card.helper}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {visibleEscalationLanes.length > 0 && (
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-mt-14"
            emptyMessage="No matching escalation lanes need action."
            headers={MATCHING_ESCALATION_LANE_TABLE_HEADERS}
            rowCount={visibleEscalationLanes.length}
          >
            {visibleEscalationLanes.map((lane) => (
              <tr key={lane.title}>
                <td>
                  <Link className="text-link" href={lane.href}>
                    {lane.title}
                  </Link>
                  <div className="muted">{lane.detail}</div>
                </td>
                <td>
                  <AdminSignal tone={commandSignalTone(lane.tone)}>
                    {commandToneLabel(lane.tone)}
                  </AdminSignal>
                  <div className="muted">{lane.status}</div>
                </td>
                <td>
                  <div className="participant-list">
                    {lane.metrics.map((metricItem) => (
                      <StatusBadge tone="neutral" key={`${lane.title}-${metricItem.label}`}>
                        {metricItem.label}: {metricItem.value}
                      </StatusBadge>
                    ))}
                  </div>
                </td>
                <td>
                  {lane.bookings.length > 0 ? (
                    <div className="stack">
                      {lane.bookings.slice(0, 3).map((booking) => (
                        <span className="muted" key={`${lane.title}-${booking.id}`}>
                          {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                          {getMatchingWindowLabel(booking)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <AdminInlineFallback>No sample bookings</AdminInlineFallback>
                  )}
                </td>
                <td>{lane.operatorAction}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      )}
      <div className="admin-mt-16">
        <h3>Matching flow timeline</h3>
        <p className="muted">Active stage exceptions only; full history remains in booking detail.</p>
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-mt-12"
            emptyMessage="No active matching flow exceptions."
            headers={MATCHING_FLOW_TABLE_HEADERS}
            rowCount={visibleFlowTimeline.length}
          >
            {visibleFlowTimeline.map((step) => (
              <tr key={step.stage}>
                <td>
                  <Link className="text-link" href={step.href}>
                    {step.stage}
                  </Link>
                </td>
                <td>
                  <strong>{step.title}</strong>
                  <div className="muted">{step.detail}</div>
                </td>
                <td>
                  <AdminSignal tone={commandSignalTone(step.tone)}>
                    {commandToneLabel(step.tone)}
                  </AdminSignal>
                  <div className="muted">{step.status}</div>
                </td>
                <td>
                  <div className="participant-list">
                    {step.metrics.map((metricItem) => (
                      <StatusBadge tone="neutral" key={`${step.stage}-${metricItem.label}`}>
                        {metricItem.label}: {metricItem.value}
                      </StatusBadge>
                    ))}
                  </div>
                </td>
                <td>
                  {step.bookings.length > 0 ? (
                    <div className="stack">
                      {step.bookings.slice(0, 3).map((booking) => (
                        <span className="muted" key={`${step.stage}-${booking.id}`}>
                          {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                          {getMatchingWindowLabel(booking)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <AdminInlineFallback>No sample bookings</AdminInlineFallback>
                  )}
                </td>
                <td>{step.operatorAction}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      {visibleDispatchPartnerShortcuts.length > 0 && (
        <div className="admin-mt-16">
          <h3>Dispatch Partner repair shortcuts</h3>
          <p className="muted">Shortcuts appear when a Partner-side queue has work.</p>
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table admin-mt-12"
              emptyMessage="No Partner repair shortcuts need action."
              headers={DISPATCH_PARTNER_SHORTCUT_TABLE_HEADERS}
              rowCount={visibleDispatchPartnerShortcuts.length}
            >
              {visibleDispatchPartnerShortcuts.map((item) => (
                <tr key={item.title}>
                  <td>
                    <Link className="text-link" href={item.href}>
                      {item.title}
                    </Link>
                  </td>
                  <td>
                    <strong>{item.value}</strong>
                  </td>
                  <td>
                    <span className="muted">{item.detail}</span>
                  </td>
                  <td>
                    <Link className="text-link" href={item.href}>
                      Open queue
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
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
                    <AdminSignal tone={commandSignalTone(item.tone)}>
                      {commandToneLabel(item.tone)}
                    </AdminSignal>
                  </td>
                  <td>{item.operatorAction}</td>
                  <td>
                    <div className="participant-list">
                      {item.tags.map((tag) => (
                        <StatusBadge tone="neutral" key={`${item.booking.id}-${tag}`}>
                          {tag}
                        </StatusBadge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
        </div>
      )}
    </AdminSection>
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
