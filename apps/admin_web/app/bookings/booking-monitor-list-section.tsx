import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AdminBooking } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { stagePillClass } from './booking-command-display';

type BookingMonitorPillDetail = {
  readonly detail: string;
  readonly label: string;
  readonly tone: string;
};

type BookingMonitorAddressState = BookingMonitorPillDetail & {
  readonly pin: string;
};

type BookingMonitorMatchingRuleSnapshot = {
  readonly customerChoiceLabel: string;
  readonly operatorAction: string;
  readonly radiusLabel: string;
  readonly sourceLabel: string;
  readonly sourceTone: string;
  readonly supplyLabel: string;
  readonly windowLabel: string;
};

type BookingMonitorParticipantPill = {
  readonly id: string;
  readonly partnerLabel: string;
  readonly status: string;
};

type BookingMonitorSignal = {
  readonly helper: string;
  readonly label: string;
  readonly tone: string;
};

export type BookingMonitorListRow = {
  readonly actionChips: readonly BookingListActionChip[];
  readonly addressState: BookingMonitorAddressState;
  readonly backupAlert: {
    readonly label: string;
    readonly pill: string;
    readonly tone: string;
  };
  readonly booking: AdminBooking;
  readonly cashDebtAmountLabel: string | null;
  readonly cashDebtNeedsOps: boolean;
  readonly chatState: BookingMonitorPillDetail;
  readonly checkSignal: BookingMonitorSignal;
  readonly closureState: BookingMonitorPillDetail | null;
  readonly commandDecisionStrip: {
    readonly primaryAction: string;
    readonly primaryDetail: string;
    readonly status: string;
    readonly tone: string;
  };
  readonly customerVisibleStateLabel: string;
  readonly finalGateReason: {
    readonly detail: string;
    readonly href: string;
    readonly label: string;
    readonly tone: string;
  };
  readonly finalPartnerLabel: string | null;
  readonly firstCheckTitle: string | null;
  readonly firstPickPhoneLabel: string;
  readonly hasMatchingPolicySnapshot: boolean;
  readonly location: {
    readonly pillLabel: string;
    readonly signalLabel: string;
    readonly toneClass: string;
  };
  readonly matchingPolicySummaryLabel: string;
  readonly matchingRuleSnapshot: BookingMonitorMatchingRuleSnapshot;
  readonly marketplaceParticipantOverflowCount: number;
  readonly marketplaceParticipants: readonly BookingMonitorParticipantPill[];
  readonly nextActionLabel: string;
  readonly expiresAtLabel: string | null;
  readonly openedDateLabel: string;
  readonly opsSignal: ReactNode;
  readonly preferredPartnerLabel: string;
  readonly preferredProviderStateLabel: string | null;
  readonly pricingPolicy: {
    readonly label: string;
    readonly status: string;
    readonly tone: string;
  };
  readonly recencyLabel: string;
  readonly selectedFinalPartnerPillLabel: string | null;
  readonly selection: {
    readonly label: string;
    readonly pathLabel: string;
    readonly toneClass: string;
  };
  readonly serviceOptionLabel: string;
  readonly servicePayoutLabel: string | null;
  readonly servicePriceLabel: string;
  readonly stage: BookingListStage;
};

type BookingMonitorListSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly BookingMonitorListRow[];
};

type BookingMonitorListTableRowProps = {
  readonly row: BookingMonitorListRow;
};

type StatusBadgeProps = {
  readonly status: string;
};

export function BookingMonitorListSection({ emptyMessage, rows }: BookingMonitorListSectionProps) {
  return (
    <section className="card admin-mt-16">
      <table className="table">
        <thead>
          <tr>
            <th>Booking / stage</th>
            <th>Address / customer</th>
            <th>Customer choice</th>
            <th title="Matching rule snapshot">Partner supply</th>
            <th>Chat / location</th>
            <th>Payment / wallet</th>
            <th title="Primary booking command Booking gate reason Action status strip">Ops check</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <BookingMonitorListTableRow key={row.booking.id} row={row} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function BookingMonitorListTableRow({ row }: BookingMonitorListTableRowProps) {
  const { booking } = row;

  return (
    <tr id={`booking-${booking.id}`}>
      <td>
        <strong>
          <Link className="text-link" href={`/bookings/${booking.id}`}>
            {shortId(booking.id)}
          </Link>
        </strong>
        <div className="muted">{row.serviceOptionLabel}</div>
        <div className="muted">{row.servicePriceLabel}</div>
        {row.servicePayoutLabel && <div className="muted">{row.servicePayoutLabel}</div>}
        {row.pricingPolicy.status !== 'ready' && (
          <span className={`pill ${row.pricingPolicy.tone}`}>{row.pricingPolicy.label}</span>
        )}
        <div className="muted">Opened {row.openedDateLabel}</div>
        <div className="muted">{row.recencyLabel}</div>
        <div className="admin-mt-8">
          <Link className={`pill ${stagePillClass(row.stage.tone)}`} href={row.stage.href}>
            {row.stage.label}
          </Link>
        </div>
        <div className="muted admin-mt-8">{row.stage.detail}</div>
        <div className="muted">{row.stage.action}</div>
        <div className="admin-mt-8">
          <StatusBadge status={booking.status} />
        </div>
        {row.closureState && (
          <div className="participant-list admin-mt-8">
            <span className={`pill ${row.closureState.tone}`}>{row.closureState.label}</span>
            <span className="muted">{row.closureState.detail}</span>
          </div>
        )}
        <div className="muted">{row.expiresAtLabel ? `Expires ${row.expiresAtLabel}` : 'No expiry set'}</div>
        <div className="muted">{row.matchingPolicySummaryLabel}</div>
      </td>
      <td>
        <span className={`pill ${row.addressState.tone}`}>{row.addressState.label}</span>
        <div className="muted admin-mt-8">{row.addressState.detail}</div>
        <div className="muted">{row.addressState.pin}</div>
        <div className="admin-mt-10">
          <strong>{booking.customerProfile?.user?.fullName ?? 'Customer'}</strong>
        </div>
        <div className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</div>
      </td>
      <td>
        <span className={`pill ${row.selection.toneClass}`}>{row.selection.label}</span>
        <div className="muted admin-mt-8">{row.customerVisibleStateLabel}</div>
        <div className="muted">{row.selection.pathLabel}</div>
        {row.finalPartnerLabel ? (
          <div className="muted">Final Partner: {row.finalPartnerLabel}</div>
        ) : (
          <div className="muted">Final Partner: waiting for customer choice</div>
        )}
        <div className="muted">{row.backupAlert.label}</div>
      </td>
      <td>
        <strong>{booking.participants?.length ?? 0} participant row(s)</strong>
        <div className="muted">First-pick {row.preferredPartnerLabel}</div>
        <div className="muted">{row.firstPickPhoneLabel}</div>
        <div className="participant-list admin-mt-8">
          <span className={`pill ${row.hasMatchingPolicySnapshot ? 'pill-info' : 'pill-warn'}`}>
            {row.hasMatchingPolicySnapshot ? 'Saved policy' : 'Live policy default'}
          </span>
          <span className={`pill ${row.backupAlert.tone}`}>{row.backupAlert.pill}</span>
        </div>
        <div className="stack admin-mt-10">
          <span className="muted">Matching rule snapshot</span>
          <span className={`pill ${row.matchingRuleSnapshot.sourceTone}`}>
            {row.matchingRuleSnapshot.sourceLabel}
          </span>
          <span className="muted">{row.matchingRuleSnapshot.windowLabel}</span>
          <span className="muted">{row.matchingRuleSnapshot.radiusLabel}</span>
          <span className="muted">{row.matchingRuleSnapshot.supplyLabel}</span>
          <span className="muted">{row.matchingRuleSnapshot.customerChoiceLabel}</span>
          <small>{row.matchingRuleSnapshot.operatorAction}</small>
        </div>
        <div className="participant-list admin-mt-8">
          {booking.preferredProvider && row.preferredProviderStateLabel && (
            <span className="pill" style={{ background: '#eef6e8', borderColor: '#b9d4a8' }}>
              First-pick: {row.preferredPartnerLabel} {row.preferredProviderStateLabel}
            </span>
          )}
          {row.selectedFinalPartnerPillLabel && (
            <span className="pill pill-success">Final: {row.selectedFinalPartnerPillLabel}</span>
          )}
          {row.marketplaceParticipants.map((participant) => (
            <span className="pill" key={participant.id}>
              Marketplace: {participant.partnerLabel} ({participant.status})
            </span>
          ))}
        </div>
        {row.marketplaceParticipantOverflowCount > 0 && (
          <div className="muted admin-mt-6">
            +{row.marketplaceParticipantOverflowCount} more marketplace Partner(s)
          </div>
        )}
      </td>
      <td>
        <span className={`pill ${row.chatState.tone}`}>{row.chatState.label}</span>
        <div className="muted admin-mt-8">{row.chatState.detail}</div>
        <div className="muted">{row.location.signalLabel}</div>
        <div className="participant-list admin-mt-8">
          <span className={`pill ${row.location.toneClass}`}>{row.location.pillLabel}</span>
        </div>
      </td>
      <BookingMonitorPaymentWalletCell booking={booking} row={row} />
      <BookingMonitorOpsCheckCell booking={booking} row={row} />
    </tr>
  );
}

function BookingMonitorPaymentWalletCell({
  booking,
  row,
}: {
  readonly booking: AdminBooking;
  readonly row: BookingMonitorListRow;
}) {
  return (
    <td>
      {booking.payment?.status ?? 'NONE'}
      <div className="muted">
        {booking.payment
          ? `${booking.payment.amount} ${booking.payment.currency ?? 'VND'} - ${booking.payment.method}`
          : 'No payment'}
      </div>
      {booking.payment?.id && (
        <div className="actions admin-mt-8">
          <Link className="text-link" href={`/bookings/${booking.id}`}>
            Detail
          </Link>
          <Link className="text-link" href={`/payments#payment-${booking.payment.id}`}>
            Open payment
          </Link>
          {(booking.status === 'REFUNDED' || booking.payment.status === 'REFUNDED') && (
            <Link className="text-link" href="/refunds">
              Refund board
            </Link>
          )}
        </div>
      )}
      {row.cashDebtNeedsOps && (
        <div className="admin-mt-8">
          <span className="pill pill-warn">Partner wallet debt</span>
        </div>
      )}
      {row.cashDebtAmountLabel && (
        <div className="muted admin-mt-6">Cash fee debt {row.cashDebtAmountLabel}</div>
      )}
      {booking.earning?.id && (
        <div className="actions admin-mt-8">
          <Link className="text-link" href={`/earnings#earning-${booking.earning.id}`}>
            Open earning
          </Link>
        </div>
      )}
    </td>
  );
}

function BookingMonitorOpsCheckCell({
  booking,
  row,
}: {
  readonly booking: AdminBooking;
  readonly row: BookingMonitorListRow;
}) {
  return (
    <td>
      <span className={`signal ${row.checkSignal.tone}`}>{row.checkSignal.label}</span>
      <div className="muted admin-mt-8">{row.checkSignal.helper}</div>
      {row.firstCheckTitle && <div className="muted">{row.firstCheckTitle}</div>}
      <div className="admin-mt-8">{row.opsSignal}</div>
      <div className="muted admin-mt-8">{row.nextActionLabel}</div>
      <div className="participant-list admin-mt-10">
        <span className="muted">Primary booking command</span>
        <Link
          className={`pill ${row.commandDecisionStrip.tone}`}
          href={`/bookings/${booking.id}#booking-command-decision-strip`}
          title={row.commandDecisionStrip.primaryDetail}
        >
          {row.commandDecisionStrip.primaryAction}
        </Link>
      </div>
      <div className="muted admin-mt-6">
        {row.commandDecisionStrip.status}: {row.commandDecisionStrip.primaryDetail}
      </div>
      <div className="participant-list admin-mt-10">
        <span className="muted">Booking gate reason</span>
        <Link
          className={`pill ${row.finalGateReason.tone}`}
          href={row.finalGateReason.href}
          title={row.finalGateReason.detail}
        >
          {row.finalGateReason.label}
        </Link>
      </div>
      <div className="muted admin-mt-6">{row.finalGateReason.detail}</div>
      <div className="participant-list admin-mt-10">
        <span className="muted">Action status strip</span>
        {row.actionChips.map((chip) => (
          <Link className={`pill ${chip.tone}`} href={chip.href} key={chip.label} title={chip.detail}>
            {chip.label}
          </Link>
        ))}
      </div>
      {row.closureState && (
        <div className="muted admin-mt-8">Closure evidence: {row.closureState.detail}</div>
      )}
    </td>
  );
}

function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}
