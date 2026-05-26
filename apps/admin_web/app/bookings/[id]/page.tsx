import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  adminGet,
} from '../../../lib/admin-api';
import {
  addBookingOpsNote,
  captureBookingPayment,
  refundBookingPayment,
  releaseBookingPayment,
  settleBookingCashDebt,
  syncBookingPayment,
  updateBookingOpsTask,
} from './actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const booking = await adminGet<AdminBookingDetail | null>(`/admin/bookings/${id}`, null);

  if (!booking) {
    notFound();
  }

  const service = booking.services?.[0];
  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const finalProvider = booking.selectedProvider ?? booking.preferredProvider;
  const latestLocation = latestProviderLocation(booking);
  const addressLine = addressLabel(booking.address);
  const riskFlags = bookingRiskFlags(booking);
  const riskSummary = riskLevel(riskFlags);
  const liveSignals = liveServiceSignals(booking);
  const dispatchSteps = dispatchChecklist(booking);
  const opsTaskCards = bookingOpsTaskCards(booking);
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingFinanceSummaryCards(financeTrace);
  const financeFlags = bookingFinanceFlags(booking, financeTrace);

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/bookings">
              Back to booking monitor
            </Link>
          </p>
          <h1>Booking {shortId(booking.id)}</h1>
          <p className="muted">
            {bookingServiceOptionLabel(booking)} - {booking.status}
          </p>
        </div>
        <div className="actions">
          {booking.payment?.id && (
            <Link className="text-link" href={`/payments#payment-${booking.payment.id}`}>
              Open payment
            </Link>
          )}
          {booking.refunds?.[0]?.id && (
            <Link className="text-link" href={`/refunds#refund-${booking.refunds[0].id}`}>
              Open refund
            </Link>
          )}
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Status" value={booking.status} helper={bookingStatusHint(booking.status)} />
        <MetricCard label="Payment" value={booking.payment?.status ?? 'NONE'} helper={paymentHint(booking)} />
        <MetricCard
          label="Providers"
          value={`${booking.participants?.length ?? 0} joined`}
          helper={providerHint(booking)}
        />
        <MetricCard
          label="Chat"
          value={booking.chatRoom ? 'Ready' : 'Not ready'}
          helper={`${messages.length} message(s)`}
        />
        <MetricCard
          label="Location"
          value={providerLocationMetricValue(booking)}
          helper={providerLocationMetricHelper(booking)}
        />
        <MetricCard label="Risk" value={riskSummary.label} helper={riskSummary.helper} />
      </section>

      <section className="card ops-command-center" style={{ marginBottom: 16 }}>
        <div>
          <h2>Operations command center</h2>
          <p className="muted">{primaryOpsInstruction(booking)}</p>
          <div className="participant-list" style={{ marginTop: 10 }}>
            {opsBadges(booking).map((badge) => (
              <span className={`pill ${badge.tone}`} key={badge.label}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
        <div className="actions">
          {booking.payment?.id ? (
            <>
              <PaymentAction
                action={syncBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Sync payment"
                disabled={!booking.payment.providerRef || isTerminalPayment(booking.payment.status)}
              />
              <PaymentAction
                action={captureBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Capture"
                disabled={
                  booking.payment.status === 'CAPTURED' ||
                  booking.payment.status === 'REFUNDED' ||
                  booking.payment.status === 'RELEASED'
                }
              />
              <PaymentAction
                action={releaseBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Release"
                disabled={
                  booking.payment.status === 'CAPTURED' ||
                  booking.payment.status === 'REFUNDED' ||
                  booking.payment.status === 'RELEASED'
                }
              />
              <PaymentAction
                action={refundBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Refund"
                disabled={booking.payment.status === 'REFUNDED' || booking.payment.status === 'RELEASED'}
              />
              {bookingCashDebtNeedsSettlement(booking) && booking.earning?.id && (
                <CashDebtSettlementForm booking={booking} />
              )}
            </>
          ) : (
            <span className="muted">No payment action available.</span>
          )}
        </div>
      </section>

      <section className="card risk-watch" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Risk watch</h2>
            <p className="muted">Automatic checks for bookings that need operator attention.</p>
          </div>
          <span className={`pill ${riskSummary.tone}`}>{riskSummary.label}</span>
        </div>
        {riskFlags.length > 0 ? (
          <div className="risk-list">
            {riskFlags.map((flag) => (
              <RiskItem flag={flag} key={`${flag.severity}-${flag.title}`} />
            ))}
          </div>
        ) : (
          <p className="muted">No active risk flags. Continue normal monitoring from the timeline.</p>
        )}
      </section>

      <section className="card risk-watch" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Finance command center</h2>
            <p className="muted">
              One-booking money flow from customer price to provider payout, HANDS fee, tax, and wallet
              impact.
            </p>
          </div>
          <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
            {financeFlags.length ? `${financeFlags.length} finance check(s)` : 'Finance clear'}
          </span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {financeSummaryCards.map((card) => (
            <MetricCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
          ))}
        </div>
        {financeFlags.length > 0 ? (
          <div className="risk-list">
            {financeFlags.map((flag) => (
              <RiskItem flag={flag} key={`${flag.severity}-${flag.title}`} />
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            Customer charge, payout rule, earning, and wallet impact are aligned for this booking.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Dispatch checklist</h2>
            <p className="muted">
              Operator-facing next steps for this booking. These are guidance cards, not hidden automation.
            </p>
          </div>
          <span
            className={`pill ${dispatchSteps.some((step) => step.priority === 'Now') ? 'pill-warn' : 'pill-success'}`}
          >
            {dispatchSteps.filter((step) => step.priority === 'Now').length} urgent
          </span>
        </div>
        <div className="dispatch-checklist">
          {dispatchSteps.map((step) => (
            <div className={`dispatch-step-card dispatch-${step.priority.toLowerCase()}`} key={step.title}>
              <div>
                <span className={`pill ${step.tone}`}>{step.priority}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <small>{step.owner}</small>
              </div>
              {step.actionHref && <ActionLink href={step.actionHref} label={step.actionLabel ?? 'Open'} />}
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Structured ops status</h2>
            <p className="muted">
              Track concrete handling steps separately from free-text notes. These statuses are saved per
              booking.
            </p>
          </div>
          <span
            className={`pill ${opsTaskCards.every((task) => task.status === 'DONE') ? 'pill-success' : 'pill-info'}`}
          >
            {opsTaskCards.filter((task) => task.status === 'DONE').length}/{opsTaskCards.length} done
          </span>
        </div>
        <div className="ops-task-grid">
          {opsTaskCards.map((task) => (
            <div className={`ops-task-card ops-task-${task.status.toLowerCase()}`} key={task.type}>
              <div>
                <span className={`pill ${opsTaskTone(task.status)}`}>{task.status}</span>
                <h3>{task.label}</h3>
                <p>{task.helper}</p>
                <small>{task.updatedBy}</small>
                {task.note && <small className="ops-task-note">Note: {task.note}</small>}
              </div>
              <div className="ops-task-actions">
                <OpsTaskAction bookingId={booking.id} type={task.type} status="DONE" label="Mark done" />
                <OpsTaskAction bookingId={booking.id} type={task.type} status="BLOCKED" label="Blocked" />
                <OpsTaskAction bookingId={booking.id} type={task.type} status="PENDING" label="Reset" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card ops-note-panel" style={{ marginBottom: 16 }}>
        <div>
          <h2>Operator notes</h2>
          <p className="muted">
            Add internal handling notes for support handoff. Notes are appended to the booking and mirrored to
            the audit log.
          </p>
          <div className="ops-note-history">
            {booking.notes?.trim() ? (
              booking.notes
                .trim()
                .split('\n')
                .slice(-6)
                .map((note) => <p key={note}>{note}</p>)
            ) : (
              <p className="muted">No internal notes yet.</p>
            )}
          </div>
        </div>
        <form action={addBookingOpsNote} className="ops-note-form">
          <input type="hidden" name="bookingId" value={booking.id} />
          <textarea
            aria-label="Operator note"
            name="note"
            placeholder="Example: Called provider, confirmed arrival in 15 minutes."
          />
          <div className="actions">
            <button type="submit">Add note</button>
            <button
              name="preset"
              type="submit"
              value="Customer contacted and updated about the booking status."
            >
              Customer contacted
            </button>
            <button
              name="preset"
              type="submit"
              value="Provider contacted and asked to confirm location/status."
            >
              Provider contacted
            </button>
            <button name="preset" type="submit" value="Payment reviewed by operations.">
              Payment reviewed
            </button>
          </div>
        </form>
      </section>

      <section className="card ops-command-center" style={{ marginBottom: 16 }}>
        <div>
          <h2>Live service board</h2>
          <p className="muted">
            Last-known location monitoring only. HANDS does not use routing, directions, or continuous GPS
            streaming in the MVP.
          </p>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {liveSignals.map((signal) => (
            <div className="ops-signal-card" key={signal.label}>
              <span className={`pill ${signal.tone}`}>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p className="muted">{signal.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-grid">
        <div className="card">
          <h2>Operations timeline</h2>
          <div className="timeline">
            {flowStages(booking).map((stage) => (
              <div className={`timeline-step ${stage.done ? 'timeline-done' : ''}`} key={stage.label}>
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <p className="muted">{stage.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Customer</h2>
          <InfoRow label="Name" value={booking.customerProfile?.user?.fullName ?? 'Customer'} />
          <InfoRow label="Phone" value={booking.customerProfile?.user?.phone ?? 'No phone'} />
          <InfoRow label="Address" value={addressLine} />
          <InfoRow label="Pin" value={coordinateLabel(booking.lat, booking.lng)} />
          <InfoRow
            label="Scheduled"
            value={`${formatDate(booking.scheduledStartAt)} - ${formatDate(booking.scheduledEndAt)}`}
          />
          <InfoRow label="Expires" value={formatDate(booking.expiresAt)} />
        </div>

        <div className="card">
          <h2>Service</h2>
          <InfoRow label="Option" value={bookingServiceOptionLabel(booking)} />
          <InfoRow label="Name" value={service?.service?.name ?? 'Service pending'} />
          <InfoRow label="Duration" value={`${service?.service?.durationMin ?? '-'} min`} />
          <InfoRow
            label="Booking price"
            value={money(service?.price ?? booking.payment?.amount, booking.payment?.currency)}
          />
          <InfoRow
            label="Admin minimum"
            value={money(service?.service?.basePrice, booking.payment?.currency)}
          />
          <InfoRow label="Provider payout rule" value={bookingServicePayoutRuleLabel(booking)} />
          <InfoRow label="Notes" value={booking.notes ?? 'No notes'} />
          <InfoRow label="Created" value={formatDate(booking.createdAt)} />
          <InfoRow label="Updated" value={formatDate(booking.updatedAt)} />
        </div>

        <div className="card">
          <h2>Provider handoff</h2>
          <InfoRow label="Preferred" value={providerName(booking.preferredProvider)} />
          <InfoRow label="Final" value={providerName(finalProvider)} />
          <InfoRow label="Final phone" value={finalProvider?.user?.phone ?? 'No phone'} />
          <InfoRow
            label="Latest provider pin"
            value={
              latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : 'No live pin yet'
            }
          />
          <InfoRow
            label="Latest pin time"
            value={latestLocation ? formatDate(latestLocation.recordedAt) : 'No location shared'}
          />
          <InfoRow label="Location freshness" value={providerLocationMetricHelper(booking)} />
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Participant shortlist</h2>
          <div className="stack">
            {(booking.participants ?? []).map((participant) => (
              <div className="ops-row" key={participant.id}>
                <div>
                  <strong>{providerName(participant.providerProfile)}</strong>
                  <div className="muted">
                    {participant.providerProfile?.user?.phone ?? 'No phone'} -{' '}
                    {participant.providerStatusAtJoin ?? 'status unknown'}
                  </div>
                  <div className="muted">
                    Joined {formatDate(participant.joinedAt)} / responded{' '}
                    {formatDate(participant.respondedAt)}
                  </div>
                </div>
                <div>
                  <span
                    className={`pill ${participant.status === 'REJECTED' ? 'pill-warn' : 'pill-success'}`}
                  >
                    {participant.status}
                  </span>
                  <div className="muted">{distanceLabel(participant.distanceMeters)}</div>
                </div>
              </div>
            ))}
            {(booking.participants ?? []).length === 0 && (
              <p className="muted">No providers have joined yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Payment and refund</h2>
          <InfoRow label="Payment id" value={booking.payment?.id ?? 'No payment'} />
          <InfoRow label="Method" value={booking.payment?.method ?? 'NONE'} />
          <InfoRow label="Amount" value={money(booking.payment?.amount, booking.payment?.currency)} />
          <InfoRow
            label="Refund count"
            value={`${booking.refunds?.length ?? booking.payment?.refunds?.length ?? 0}`}
          />
          <InfoRow
            label="Earning"
            value={
              booking.earning
                ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`
                : 'Not created'
            }
          />
          {bookingCashDebtNeedsSettlement(booking) && (
            <InfoRow
              label="Cash fee debt"
              value={`${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} / provider blocked`}
            />
          )}
          <InfoRow label="Review" value={booking.review ? `${booking.review.rating}/5` : 'Not submitted'} />
        </div>

        <div className="card">
          <h2>Finance trace</h2>
          <InfoRow label="Pricing source" value={financeTrace.pricingSource} />
          <InfoRow label="Service option" value={financeTrace.serviceOption} />
          <InfoRow label="Customer price" value={financeTrace.customerPrice} />
          <InfoRow label="Admin minimum" value={financeTrace.adminMinimum} />
          <InfoRow label="Payout rule" value={financeTrace.payoutRuleStatus} />
          <InfoRow label="Rule line" value={financeTrace.payoutRuleLine} />
          <InfoRow label="Provider payout" value={financeTrace.providerPayout} />
          <InfoRow label="Platform fee" value={financeTrace.platformFee} />
          <InfoRow label="VAT / other costs" value={financeTrace.feeCosts} />
          <InfoRow label="Net HANDS fee" value={financeTrace.netHandsFee} />
          <InfoRow label="Withholding" value={financeTrace.withholding} />
          <InfoRow label="Company fee after tax" value={financeTrace.companyFeeAfterTax} />
          <InfoRow label="Wallet ledger" value={financeTrace.walletLedger} />
          <InfoRow label="Provider net" value={financeTrace.providerNet} />
        </div>

        <div className="card">
          <h2>Chat transcript</h2>
          <div className="stack">
            {messages.slice(-8).map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {messages.length === 0 && <p className="muted">No chat messages yet.</p>}
          </div>
        </div>

        <div className="card">
          <h2>Location trail</h2>
          <div className="route-mini">
            <span className="route-dot route-customer">Customer</span>
            {latestLocation && <span className="route-dot route-provider">Provider</span>}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {locationTrail(booking).map((snapshot) => (
              <div className="ops-row" key={snapshot.id}>
                <div>
                  <strong>{coordinateLabel(snapshot.lat, snapshot.lng)}</strong>
                  <div className="muted">{formatDate(snapshot.recordedAt)}</div>
                </div>
                <span className="pill">Provider</span>
              </div>
            ))}
            {locationTrail(booking).length === 0 && (
              <p className="muted">No provider location snapshots linked to this booking yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function OpsTaskAction({
  bookingId,
  type,
  status,
  label,
}: {
  bookingId: string;
  type: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updateBookingOpsTask}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="status" value={status} />
      <button type="submit">{label}</button>
    </form>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('/')) {
    return (
      <Link className="text-link" href={href}>
        {label}
      </Link>
    );
  }

  return (
    <a className="text-link" href={href}>
      {label}
    </a>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <h2>{value}</h2>
      <p className="muted">{helper}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChatBubble({ message }: { message: AdminChatMessage }) {
  return (
    <div className="chat-bubble">
      <strong>{message.body}</strong>
      <div className="muted">
        {message.sender?.fullName ?? message.sender?.phone ?? 'Sender'} - {formatDate(message.createdAt)}
      </div>
    </div>
  );
}

function PaymentAction({
  action,
  bookingId,
  paymentId,
  label,
  disabled,
}: {
  action: (...args: [FormData]) => Promise<void>;
  bookingId: string;
  paymentId: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <button type="submit" disabled={disabled}>
        {label}
      </button>
    </form>
  );
}

function CashDebtSettlementForm({ booking }: { booking: AdminBookingDetail }) {
  const earning = booking.earning;
  if (!earning) {
    return null;
  }

  return (
    <form action={settleBookingCashDebt} className="inline-form">
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="earningId" value={earning.id} />
      <input
        name="settlementRef"
        placeholder={`HANDS-CASH-${shortId(booking.id)}`}
        aria-label="Cash debt settlement reference"
      />
      <input
        name="settlementNotes"
        placeholder={`Provider deposited ${money(Math.abs(earning.netAmount), earning.currency)}`}
        aria-label="Cash debt settlement notes"
      />
      <button type="submit">Settle cash debt</button>
    </form>
  );
}

type RiskFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
};

type DispatchStep = {
  priority: 'Now' | 'Watch' | 'Done';
  title: string;
  detail: string;
  owner: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

function RiskItem({ flag }: { flag: RiskFlag }) {
  return (
    <div className={`risk-item risk-${flag.severity}`}>
      <div>
        <span className={`pill ${riskToneClass(flag.severity)}`}>{flag.severity}</span>
        <strong>{flag.title}</strong>
        <p className="muted">{flag.detail}</p>
      </div>
      <p>{flag.action}</p>
    </div>
  );
}

function primaryOpsInstruction(booking: AdminBookingDetail) {
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Booking is cancelled and the payment hold is already released. Confirm customer messaging only.'
      : 'Booking is cancelled, but payment still needs operator review. Release or refund before closing.';
  }
  if (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED') {
    return 'Service is complete. Capture the authorized payment or refund if there was a dispute.';
  }
  if (bookingCashDebtNeedsSettlement(booking)) {
    return 'Cash was collected by the provider. Finance must settle the HANDS fee debt before this provider can accept more bookings.';
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    return 'Payment hold is live. Keep it authorized until service completion or cancellation.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Monitor provider response speed and fallback supply. Customer is still waiting.';
  }
  if (booking.status === 'MATCHED') {
    return 'Provider is selected. Watch chat readiness, location sharing, and arrival progression.';
  }
  if (booking.chatRoom && booking.status === 'IN_SERVICE') {
    return 'Service is live. Keep chat and location visible until completion.';
  }
  return 'No urgent action is required. Continue monitoring this booking from the timeline.';
}

function opsBadges(booking: AdminBookingDetail) {
  const badges = [];
  const flags = bookingRiskFlags(booking);
  if (flags.some((flag) => flag.severity === 'high')) {
    badges.push({ label: 'High risk', tone: 'pill-danger' });
  } else if (flags.some((flag) => flag.severity === 'medium')) {
    badges.push({ label: 'Needs watch', tone: 'pill-warn' });
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    badges.push({ label: 'Hold active', tone: 'pill-warn' });
  }
  if (booking.payment?.status === 'RELEASED') {
    badges.push({ label: 'Hold released', tone: 'pill-success' });
  }
  if (booking.payment?.status === 'CAPTURED') {
    badges.push({ label: 'Captured', tone: 'pill-success' });
  }
  if (booking.payment?.status === 'REFUNDED') {
    badges.push({ label: 'Refunded', tone: 'pill-warn' });
  }
  if (bookingCashDebtNeedsSettlement(booking)) {
    badges.push({ label: 'Cash fee debt', tone: 'pill-danger' });
  }
  if (booking.selectedProvider) {
    badges.push({ label: 'Provider selected', tone: 'pill-success' });
  }
  if (booking.chatRoom) {
    badges.push({ label: 'Chat ready', tone: 'pill-info' });
  }
  const locationFreshness = latestProviderLocationFreshness(booking);
  if (locationFreshness === 'recent') {
    badges.push({ label: 'Location recent', tone: 'pill-success' });
  }
  if (locationFreshness === 'stale') {
    badges.push({ label: 'Location stale', tone: 'pill-warn' });
  }
  if (locationFreshness === 'expired') {
    badges.push({ label: 'Location too old', tone: 'pill-info' });
  }
  if (badges.length === 0) {
    badges.push({ label: 'Monitor', tone: 'pill-neutral' });
  }
  return badges;
}

function bookingRiskFlags(booking: AdminBookingDetail): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const paymentStatus = booking.payment?.status;
  const status = booking.status;
  const participantCount = booking.participants?.length ?? 0;
  const messages = booking.chatRoom?.messages ?? [];
  const openedAge = minutesSince(booking.openedAt ?? booking.createdAt);
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status);

  if (status === 'CANCELLED' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'Cancelled payment unresolved',
      detail: `Booking is cancelled but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (status === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({
      severity: 'high',
      title: 'Completed service still on hold',
      detail: 'The customer payment is authorized but not captured after completion.',
      action: 'Capture payment, or refund if there is an active dispute.',
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    flags.push({
      severity: 'high',
      title: 'Cash fee debt blocks provider',
      detail: `${providerName(booking.selectedProvider ?? booking.preferredProvider)} collected cash and still owes ${money(
        Math.abs(booking.earning?.netAmount ?? 0),
        booking.earning?.currency,
      )}.`,
      action: 'Confirm the provider deposit or admin offset, then settle the earning.',
    });
  }

  if (status === 'OPEN_MATCHING' && expired) {
    flags.push({
      severity: 'high',
      title: 'Matching window expired',
      detail: `The request expired at ${formatDate(booking.expiresAt)} but is still open.`,
      action: 'Expire the booking and release or refund the payment hold.',
    });
  }

  if (
    status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    participantCount === 0 &&
    openedAge !== null &&
    openedAge >= 10
  ) {
    flags.push({
      severity: 'medium',
      title: 'Preferred provider slow',
      detail: `${providerName(booking.preferredProvider)} has not responded after ${openedAge} minute(s).`,
      action: 'Encourage backup supply or contact the provider.',
    });
  }

  if (status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      severity: 'medium',
      title: 'No provider supply',
      detail: 'No provider has joined the request yet.',
      action: 'Watch nearby online providers and consider operational outreach.',
    });
  }

  if (status === 'MATCHED' && !booking.chatRoom) {
    flags.push({
      severity: 'high',
      title: 'Matched without chat',
      detail: 'A provider is selected but no chat room exists.',
      action: 'Retry chat room creation before the service starts.',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    flags.push({
      severity: 'medium',
      title: 'No provider location signal',
      detail: `Booking is ${status}, but the provider has not shared a live pin.`,
      action: 'Ask the provider to share current location from the Provider app.',
    });
  }

  if (
    activeWithLocationNeed &&
    latestProviderLocation(booking) &&
    latestProviderLocationFreshness(booking) !== 'recent'
  ) {
    flags.push({
      severity: 'medium',
      title: 'Provider location is stale',
      detail: `The latest provider pin is ${providerLocationMetricHelper(booking).toLowerCase()}.`,
      action: 'Ask the provider to share location again from the Provider app.',
    });
  }

  if (
    booking.chatRoom &&
    messages.length === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status)
  ) {
    flags.push({
      severity: 'low',
      title: 'Chat quiet',
      detail: 'Chat is ready but no messages have been exchanged.',
      action: 'Monitor for first contact if the customer reports uncertainty.',
    });
  }

  if (paymentStatus === 'AUTHORIZED' && !booking.payment?.providerRef) {
    flags.push({
      severity: 'medium',
      title: 'Payment reference missing',
      detail: 'The payment is authorized but has no provider reference for gateway reconciliation.',
      action: 'Sync payment before capture, release, or refund.',
    });
  }

  if ((booking.refunds?.length ?? 0) > 0 && paymentStatus && paymentStatus !== 'REFUNDED') {
    flags.push({
      severity: 'medium',
      title: 'Refund/payment mismatch',
      detail: `Refund records exist while payment status is ${paymentStatus}.`,
      action: 'Review gateway status and keep refund timeline aligned.',
    });
  }

  return flags;
}

function riskLevel(flags: RiskFlag[]) {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'High', helper: `${flags.length} flag(s) need attention`, tone: 'pill-danger' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Medium', helper: `${flags.length} flag(s) to watch`, tone: 'pill-warn' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Low', helper: `${flags.length} low-priority flag(s)`, tone: 'pill-info' };
  }
  return { label: 'Clear', helper: 'No active risk flags', tone: 'pill-success' };
}

function riskToneClass(severity: RiskFlag['severity']) {
  if (severity === 'high') {
    return 'pill-danger';
  }
  if (severity === 'medium') {
    return 'pill-warn';
  }
  return 'pill-info';
}

function dispatchChecklist(booking: AdminBookingDetail): DispatchStep[] {
  const steps: DispatchStep[] = [];
  const flags = bookingRiskFlags(booking);
  const provider = booking.selectedProvider ?? booking.preferredProvider;
  const providerPhone = provider?.user?.phone;
  const paymentHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : undefined;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(booking.payment.status)
  ) {
    steps.push({
      priority: 'Now',
      title: 'Resolve cancelled payment',
      detail: `Booking is cancelled but payment is still ${booking.payment.status}. Release the hold or refund before closing.`,
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: paymentHref,
      actionLabel: 'Open payment',
    });
  }

  if (booking.status === 'COMPLETED' && booking.payment?.status === 'AUTHORIZED') {
    steps.push({
      priority: 'Now',
      title: 'Capture completed service',
      detail: 'Service is complete while payment is still authorized. Capture it unless a dispute is active.',
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: paymentHref,
      actionLabel: 'Capture payment',
    });
  }

  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    steps.push({
      priority: 'Now',
      title: 'Preferred provider response',
      detail: `${providerName(booking.preferredProvider)} has the first response window. Contact them if the customer is waiting too long.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call provider',
    });
  }

  if (booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0) {
    steps.push({
      priority: 'Watch',
      title: 'Supply watch',
      detail: 'No provider has joined yet. Keep provider availability and notification delivery visible.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: '/providers',
      actionLabel: 'Open providers',
    });
  }

  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    steps.push({
      priority: 'Now',
      title: 'Recover chat room',
      detail: 'Provider is selected but no chat room exists. This can block service coordination.',
      owner: 'Support operator',
      tone: 'pill-danger',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    steps.push({
      priority: 'Now',
      title: 'Request provider location',
      detail: 'The provider has not shared a saved service pin for this active booking.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call provider',
    });
  }

  if (
    activeWithLocationNeed &&
    latestProviderLocation(booking) &&
    latestProviderLocationFreshness(booking) !== 'recent'
  ) {
    steps.push({
      priority: 'Watch',
      title: 'Refresh stale location',
      detail: `${providerLocationMetricHelper(booking)}. Ask the provider to share current location again if the customer asks.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call provider',
    });
  }

  if (
    booking.chatRoom &&
    (booking.chatRoom.messages?.length ?? 0) === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
  ) {
    steps.push({
      priority: 'Watch',
      title: 'First chat contact',
      detail: 'Chat is ready but quiet. Monitor for first contact if the customer reports uncertainty.',
      owner: 'Customer support',
      tone: 'pill-info',
    });
  }

  if (booking.selectedProvider) {
    steps.push({
      priority: 'Done',
      title: 'Provider handoff locked',
      detail: `${providerName(booking.selectedProvider)} is the current final provider for this booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-success',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call provider',
    });
  }

  if (booking.chatRoom) {
    steps.push({
      priority: 'Done',
      title: 'Chat room ready',
      detail: `Room ${booking.chatRoom.id} has ${booking.chatRoom.messages?.length ?? 0} message(s).`,
      owner: 'Customer support',
      tone: 'pill-success',
    });
  }

  if (booking.payment) {
    steps.push({
      priority: isTerminalPayment(booking.payment.status) ? 'Done' : 'Watch',
      title: 'Payment state',
      detail: paymentHint(booking),
      owner: 'Payments operator',
      tone: isTerminalPayment(booking.payment.status) ? 'pill-success' : 'pill-info',
      actionHref: paymentHref,
      actionLabel: 'Open payment',
    });
  }

  if (steps.length === 0 || (flags.length === 0 && steps.every((step) => step.priority === 'Done'))) {
    steps.push({
      priority: 'Done',
      title: 'Normal monitoring',
      detail:
        'No urgent operator action is active. Keep this booking visible until the next status transition.',
      owner: 'Operations',
      tone: 'pill-success',
    });
  }

  return steps;
}

function bookingOpsTaskCards(booking: AdminBookingDetail) {
  const taskByType = new Map((booking.opsTasks ?? []).map((task) => [task.type, task]));
  const definitions = [
    {
      type: 'CUSTOMER_CONTACTED',
      label: 'Customer contacted',
      helper:
        'Confirm the guest has been updated when waiting, switching provider, cancelling, or resolving payment.',
    },
    {
      type: 'PROVIDER_CONTACTED',
      label: 'Provider contacted',
      helper: 'Confirm the therapist has been reached for response, location, arrival, or service progress.',
    },
    {
      type: 'LOCATION_CHECKED',
      label: 'Location checked',
      helper: 'Confirm saved customer/provider pins are reasonable. No route or continuous tracking is used.',
    },
    {
      type: 'PAYMENT_REVIEWED',
      label: 'Payment reviewed',
      helper: 'Confirm authorization, capture, release, cash fallback, or refund path before closing.',
    },
  ];

  return definitions.map((definition) => {
    const task = taskByType.get(definition.type);
    return {
      ...definition,
      status: task?.status ?? 'PENDING',
      note: task?.note?.trim() ? task.note.trim() : null,
      updatedBy: task
        ? `Updated ${formatDate(task.updatedAt)} by ${task.actor?.fullName ?? task.actor?.phone ?? 'Admin'}`
        : 'Not checked yet',
    };
  });
}

function opsTaskTone(status: string) {
  if (status === 'DONE') {
    return 'pill-success';
  }
  if (status === 'BLOCKED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function liveServiceSignals(booking: AdminBookingDetail) {
  const latest = latestProviderLocation(booking);
  const freshness = latestProviderLocationFreshness(booking);
  const customerPin = coordinateLabel(booking.lat, booking.lng);
  const providerPin = latest ? coordinateLabel(latest.lat, latest.lng) : 'No provider pin';
  const distanceMeters = latest
    ? approximateDistanceMeters(booking.lat, booking.lng, latest.lat, latest.lng)
    : null;
  const provider = booking.selectedProvider ?? booking.preferredProvider;

  return [
    {
      label: 'Customer pin',
      value: customerPin,
      helper: addressLabel(booking.address),
      tone: booking.lat && booking.lng ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Provider pin',
      value: providerPin,
      helper: latest
        ? providerLocationMetricHelper(booking)
        : 'Ask provider to share current location from chat.',
      tone:
        freshness === 'recent'
          ? 'pill-success'
          : freshness === 'stale'
            ? 'pill-warn'
            : freshness === 'expired'
              ? 'pill-info'
              : 'pill-danger',
    },
    {
      label: 'Approx. gap',
      value: distanceMeters === null ? 'Unknown' : distanceLabel(Math.round(distanceMeters / 100) * 100),
      helper: 'Calculated from saved pins. It is not a route or ETA.',
      tone: distanceMeters === null ? 'pill-info' : distanceMeters > 5000 ? 'pill-warn' : 'pill-success',
    },
    {
      label: 'Service contact',
      value: provider?.user?.phone ?? 'No provider phone',
      helper: provider
        ? `${providerName(provider)} is the current handoff provider.`
        : 'No provider assigned yet.',
      tone: provider ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
      helper: booking.chatRoom
        ? `Room ${booking.chatRoom.id}`
        : 'Chat opens after provider selection/service start.',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      helper: paymentHint(booking),
      tone:
        booking.payment?.status === 'AUTHORIZED'
          ? 'pill-warn'
          : isTerminalPayment(booking.payment?.status)
            ? 'pill-success'
            : 'pill-info',
    },
  ];
}

function isTerminalPayment(status?: string) {
  return status === 'CAPTURED' || status === 'REFUNDED' || status === 'RELEASED';
}

function flowStages(booking: AdminBookingDetail) {
  return [
    {
      label: 'Created',
      value: formatDate(booking.createdAt),
      hint: 'Customer selected service and address.',
      done: true,
    },
    {
      label: 'Opened',
      value: booking.openedAt ? formatDate(booking.openedAt) : 'Not opened',
      hint: booking.preferredProvider
        ? 'Direct request sent to preferred provider.'
        : 'Open matching started.',
      done: Boolean(booking.openedAt),
    },
    {
      label: 'Provider reply',
      value: providerDecisionLabel(booking),
      hint: providerHint(booking),
      done:
        (booking.participants?.length ?? 0) > 0 ||
        ['MATCHED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status),
    },
    {
      label: 'Matched',
      value: providerName(booking.selectedProvider),
      hint: booking.chatRoom ? 'Chat room is ready.' : 'Waiting for final provider selection.',
      done: Boolean(booking.selectedProvider),
    },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      hint: paymentHint(booking),
      done: ['CAPTURED', 'RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
    },
  ];
}

function bookingStatusHint(status: string) {
  if (status === 'OPEN_MATCHING') {
    return 'Provider response or customer selection is still pending.';
  }
  if (status === 'MATCHED') {
    return 'Provider is selected; watch chat and movement.';
  }
  if (status === 'IN_SERVICE') {
    return 'Service is in progress.';
  }
  if (status === 'COMPLETED') {
    return 'Payment, earning, and review should be settled.';
  }
  if (status === 'CANCELLED') {
    return 'Confirm payment release or refund.';
  }
  return 'Monitor the next operational action.';
}

function paymentHint(booking: AdminBookingDetail) {
  if (!booking.payment) {
    return 'No payment record created.';
  }
  if (bookingCashDebtNeedsSettlement(booking)) {
    return 'Cash fee debt is still unsettled; provider acceptance is blocked.';
  }
  if (booking.payment.status === 'AUTHORIZED') {
    return 'Hold is active; capture after service completion.';
  }
  if (booking.payment.status === 'RELEASED') {
    return 'Hold released without capture.';
  }
  if (booking.payment.status === 'CAPTURED') {
    return 'Payment captured.';
  }
  if (booking.payment.status === 'REFUNDED') {
    return 'Refund path is active.';
  }
  return `${booking.payment.method} payment is being monitored.`;
}

function bookingCashDebtNeedsSettlement(booking: AdminBookingDetail) {
  return (
    booking.payment?.method === 'CASH' &&
    Boolean(booking.earning) &&
    (booking.earning?.netAmount ?? 0) < 0 &&
    booking.earning?.status !== 'PAID'
  );
}

function bookingFinanceSummaryCards(financeTrace: ReturnType<typeof bookingFinanceTrace>) {
  const walletHelper =
    financeTrace.paymentMethod === 'CASH'
      ? financeTrace.walletTotalAmount < 0
        ? 'Cash fee debt blocks new booking acceptance.'
        : 'Cash settlement ledger is not negative.'
      : 'Non-cash booking should create payout credit after completion.';

  return [
    {
      label: 'Customer charge',
      value: money(financeTrace.customerPriceAmount, financeTrace.currency),
      helper: financeTrace.serviceOption,
    },
    {
      label: 'Provider payout',
      value: money(financeTrace.providerPayoutAmount, financeTrace.currency),
      helper: financeTrace.earningStatus
        ? `Earning ${financeTrace.earningStatus}`
        : 'Projected from payout rule.',
    },
    {
      label: 'HANDS fee',
      value: money(financeTrace.platformFeeAmount, financeTrace.currency),
      helper: `${financeTrace.netHandsFee} before withholding impact.`,
    },
    {
      label: 'Tax withheld',
      value: money(financeTrace.withholdingAmount, financeTrace.currency),
      helper: financeTrace.withholding,
    },
    {
      label: 'Company net',
      value: money(financeTrace.companyFeeAfterTaxAmount, financeTrace.currency),
      helper: 'HANDS fee after VAT, other costs, and withholding.',
    },
    {
      label: 'Wallet impact',
      value: money(financeTrace.walletTotalAmount, financeTrace.currency),
      helper: walletHelper,
    },
  ];
}

function bookingFinanceFlags(
  booking: AdminBookingDetail,
  financeTrace: ReturnType<typeof bookingFinanceTrace>,
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const bookedService = booking.services?.[0];
  const customerPrice = financeTrace.customerPriceAmount;
  const paymentAmount = readNullableAmount(booking.payment?.amount);
  const servicePrice = readNullableAmount(bookedService?.price);

  if (financeTrace.payoutRuleMissing) {
    flags.push({
      severity: 'high',
      title: 'Payout rule missing',
      detail: 'This booking price has no matching active service payout rule.',
      action: 'Open Services and add a payout rule before allowing this option in production.',
    });
  }

  if (paymentAmount !== null && servicePrice !== null && paymentAmount !== servicePrice) {
    flags.push({
      severity: 'medium',
      title: 'Payment amount differs from booked service',
      detail: `Payment is ${money(paymentAmount, financeTrace.currency)} but booked service is ${money(
        servicePrice,
        financeTrace.currency,
      )}.`,
      action: 'Review coupon, discount, or payment capture rules before closing finance.',
    });
  }

  if (
    financeTrace.providerPayoutAmount !== null &&
    customerPrice !== null &&
    financeTrace.providerPayoutAmount > customerPrice
  ) {
    flags.push({
      severity: 'high',
      title: 'Provider payout exceeds customer price',
      detail: 'The payout rule would pay more than the customer charge.',
      action: 'Disable or correct the service payout rule immediately.',
    });
  }

  if (booking.status === 'COMPLETED' && !booking.earning) {
    flags.push({
      severity: 'high',
      title: 'Completed booking has no earning',
      detail: 'Service is completed but no provider earning/wallet entry exists.',
      action: 'Run earning creation or inspect completion processing.',
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    flags.push({
      severity: 'high',
      title: 'Cash wallet debt blocks provider',
      detail: `${providerName(booking.selectedProvider ?? booking.preferredProvider)} owes ${money(
        Math.abs(booking.earning?.netAmount ?? financeTrace.walletTotalAmount),
        financeTrace.currency,
      )} before accepting more bookings.`,
      action: 'Collect the HANDS fee deposit or offset it in an admin settlement.',
    });
  }

  if (
    financeTrace.paymentMethod === 'CASH' &&
    booking.earning &&
    financeTrace.walletTotalAmount >= 0 &&
    booking.earning.netAmount < 0
  ) {
    flags.push({
      severity: 'medium',
      title: 'Cash debt ledger may be stale',
      detail: 'The earning is negative but visible wallet entries are not negative.',
      action: 'Check wallet ledger entries and settlement status.',
    });
  }

  return flags;
}

function providerHint(booking: AdminBookingDetail) {
  if (booking.selectedProvider) {
    return `Final provider: ${providerName(booking.selectedProvider)}.`;
  }
  if (booking.preferredProvider && (booking.participants?.length ?? 0) === 0) {
    return 'Preferred provider has first response window.';
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return 'Shortlist has providers ready for customer decision.';
  }
  return 'No provider response yet.';
}

function providerDecisionLabel(booking: AdminBookingDetail) {
  const preferredId = booking.preferredProvider?.id;
  const preferredParticipant = (booking.participants ?? []).find(
    (participant) => participant.providerProfile?.id === preferredId,
  );
  if (preferredParticipant) {
    return preferredParticipant.status;
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return `${booking.participants?.length ?? 0} backup ready`;
  }
  return 'Waiting';
}

function preferredParticipantState(booking: AdminBookingDetail) {
  const preferredProviderId = booking.preferredProvider?.id;
  if (!preferredProviderId) {
    return null;
  }

  return (
    (booking.participants ?? []).find(
      (participant) => participant.providerProfile?.id === preferredProviderId,
    ) ?? null
  );
}

function isPreferredAwaitingDecision(booking: AdminBookingDetail) {
  if (!booking.preferredProvider) {
    return false;
  }

  const participant = preferredParticipantState(booking);
  if (!participant) {
    return true;
  }

  return !['ACCEPTED', 'SELECTED', 'REJECTED'].includes(participant.status);
}

function latestProviderLocation(booking: AdminBookingDetail) {
  const selected = booking.selectedProvider?.locationSnapshots?.[0];
  if (selected) {
    return selected;
  }

  const participantLocations = (booking.participants ?? [])
    .map((participant) => participant.providerProfile?.locationSnapshots?.[0])
    .filter(Boolean) as AdminLocationSnapshot[];

  return (
    participantLocations.sort(
      (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    )[0] ?? null
  );
}

function latestProviderLocationFreshness(booking: AdminBookingDetail) {
  const latest = latestProviderLocation(booking);
  if (!latest?.recordedAt) {
    return 'missing';
  }

  const recordedAt = new Date(latest.recordedAt).getTime();
  if (!Number.isFinite(recordedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - recordedAt;
  if (ageMs > EXPIRED_LOCATION_HOURS * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > STALE_LOCATION_MINUTES * 60_000) {
    return 'stale';
  }
  return 'recent';
}

function providerLocationMetricValue(booking: AdminBookingDetail) {
  const freshness = latestProviderLocationFreshness(booking);
  if (freshness === 'recent') {
    return 'Recent';
  }
  if (freshness === 'stale') {
    return 'Stale';
  }
  if (freshness === 'expired') {
    return 'Too old';
  }
  return 'Missing';
}

function providerLocationMetricHelper(booking: AdminBookingDetail) {
  const latest = latestProviderLocation(booking);
  if (!latest?.recordedAt) {
    return 'No provider location shared yet';
  }

  const recordedAt = new Date(latest.recordedAt).getTime();
  if (!Number.isFinite(recordedAt)) {
    return 'Provider location timestamp is invalid';
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - recordedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'Updated just now';
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago`;
}

function locationTrail(booking: AdminBookingDetail) {
  const explicit = booking.snapshots ?? [];
  if (explicit.length > 0) {
    return explicit;
  }

  const latest = latestProviderLocation(booking);
  return latest ? [latest] : [];
}

function bookingFinanceTrace(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  const payoutRule = service?.payoutRules?.find(
    (rule) => Number(rule.customerPrice) === Number(customerPrice),
  );
  const platformFeeFromRule =
    payoutRule && customerPrice !== undefined
      ? Number(customerPrice) - Number(payoutRule.providerPayoutAmount)
      : null;
  const vatAmount =
    payoutRule && platformFeeFromRule !== null ? bpsAmount(platformFeeFromRule, payoutRule.vatBps) : null;
  const otherCostAmount = payoutRule ? Number(payoutRule.otherCostAmount ?? 0) : null;
  const netHandsFee =
    platformFeeFromRule !== null ? platformFeeFromRule - (vatAmount ?? 0) - (otherCostAmount ?? 0) : null;
  const latestTaxLog = booking.taxLogs?.[0] ?? booking.earning?.taxLogs?.[0];
  const latestFeeLog = booking.platformFeeLogs?.[0] ?? booking.earning?.platformFeeLogs?.[0];
  const servicePayoutSnapshot = readServicePayoutSnapshot(latestFeeLog?.ruleSnapshot);
  const servicePayoutLine = servicePayoutLineForBooking(servicePayoutSnapshot, customerPrice);
  const snapshotProviderPayout =
    readNullableAmount(servicePayoutLine?.providerPayoutAmount) ??
    readNullableAmount(servicePayoutSnapshot?.providerPayoutAmount);
  const snapshotPlatformFee =
    readNullableAmount(servicePayoutLine?.platformFeeAmount) ??
    readNullableAmount(latestFeeLog?.platformFeeAmount);
  const snapshotVatAmount =
    readNullableAmount(servicePayoutLine?.vatAmount) ?? readNullableAmount(servicePayoutSnapshot?.vatAmount);
  const snapshotOtherCostAmount =
    readNullableAmount(servicePayoutLine?.otherCostAmount) ??
    readNullableAmount(servicePayoutSnapshot?.otherCostAmount);
  const platformFeeAmount = snapshotPlatformFee ?? platformFeeFromRule;
  const providerPayoutAmount =
    snapshotProviderPayout ??
    (payoutRule ? Number(payoutRule.providerPayoutAmount) : null) ??
    (booking.earning ? booking.earning.grossAmount - booking.earning.platformFee : null);
  const feeVatAmount = snapshotVatAmount ?? vatAmount;
  const feeOtherCostAmount = snapshotOtherCostAmount ?? otherCostAmount;
  const netHandsFeeAmount =
    readNullableAmount(servicePayoutSnapshot?.netCompanyFeeBeforeWithholding) ??
    (platformFeeAmount !== null
      ? platformFeeAmount - (feeVatAmount ?? 0) - (feeOtherCostAmount ?? 0)
      : null) ??
    netHandsFee;
  const withholdingAmount =
    readNullableAmount(latestTaxLog?.withholdingAmount) ??
    readNullableAmount(booking.earning?.withholdingAmount);
  const walletEntries = booking.walletLedgerEntries ?? booking.earning?.walletLedgerEntries ?? [];
  const walletTotal = walletEntries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const quantity = bookedService?.quantity ?? 1;
  const companyFeeAfterTaxAmount =
    netHandsFeeAmount !== null ? netHandsFeeAmount - (withholdingAmount ?? 0) : null;

  return {
    currency,
    paymentMethod: booking.payment?.method ?? 'NONE',
    earningStatus: booking.earning?.status ?? null,
    customerPriceAmount: readNullableAmount(customerPrice),
    adminMinimumAmount: readNullableAmount(service?.basePrice),
    payoutRuleMissing: !payoutRule,
    providerPayoutAmount,
    platformFeeAmount,
    feeVatAmount,
    feeOtherCostAmount,
    netHandsFeeAmount,
    withholdingAmount,
    companyFeeAfterTaxAmount,
    walletTotalAmount: walletTotal,
    pricingSource:
      servicePayoutSnapshot?.source === 'SERVICE_PAYOUT_RULE'
        ? 'Service payout matrix'
        : latestFeeLog
          ? `Fee policy ${servicePayoutSnapshot?.scope ?? 'RULE'}`
          : payoutRule
            ? 'Projected from active payout rule'
            : 'Not calculated',
    serviceOption: service?.name
      ? `${service.name} / ${service.durationMin ?? '-'} min / qty ${quantity}`
      : 'Service pending',
    customerPrice: money(customerPrice, currency),
    adminMinimum: money(service?.basePrice, currency),
    payoutRuleStatus: payoutRule
      ? `${money(Number(payoutRule.customerPrice), payoutRule.currency ?? currency)} active`
      : 'Missing active rule',
    payoutRuleLine: servicePayoutLine
      ? `${money(readAmount(servicePayoutLine.customerPrice), currency)} customer -> ${money(
          readAmount(servicePayoutLine.providerPayoutAmount),
          currency,
        )} provider`
      : payoutRule
        ? `Active rule ${shortId(payoutRule.id)}`
        : 'No matching rule line',
    providerPayout:
      providerPayoutAmount !== null
        ? money(providerPayoutAmount, servicePayoutSnapshot?.currency ?? payoutRule?.currency ?? currency)
        : 'Not calculated',
    platformFee:
      platformFeeAmount !== null
        ? `${money(platformFeeAmount, latestFeeLog?.currency ?? currency)}${latestFeeLog ? ' logged' : ''}`
        : 'Not calculated',
    feeCosts:
      feeVatAmount !== null || feeOtherCostAmount !== null
        ? `${money(feeVatAmount ?? 0, currency)} VAT / ${money(feeOtherCostAmount ?? 0, currency)} other`
        : 'No active rule snapshot',
    netHandsFee: netHandsFeeAmount !== null ? money(netHandsFeeAmount, currency) : 'Not calculated',
    withholding: latestTaxLog
      ? `${money(latestTaxLog.withholdingAmount, latestTaxLog.currency)} on ${money(latestTaxLog.taxableAmount, latestTaxLog.currency)}`
      : booking.earning
        ? money(booking.earning.withholdingAmount, booking.earning.currency)
        : 'Not created',
    companyFeeAfterTax:
      companyFeeAfterTaxAmount !== null ? money(companyFeeAfterTaxAmount, currency) : 'Not calculated',
    walletLedger:
      walletEntries.length > 0
        ? `${money(walletTotal, walletEntries[0]?.currency ?? currency)} / ${walletEntries.length} entry`
        : 'No entry',
    providerNet: booking.earning
      ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`
      : 'Not created',
  };
}

type ServicePayoutSnapshotLine = {
  customerPrice?: number | string | null;
  providerPayoutAmount?: number | string | null;
  platformFeeAmount?: number | string | null;
  vatAmount?: number | string | null;
  otherCostAmount?: number | string | null;
};

type ServicePayoutSnapshot = {
  source?: string;
  scope?: string;
  currency?: string;
  providerPayoutAmount?: number | string | null;
  vatAmount?: number | string | null;
  otherCostAmount?: number | string | null;
  netCompanyFeeBeforeWithholding?: number | string | null;
  lines?: ServicePayoutSnapshotLine[];
};

function readServicePayoutSnapshot(snapshot: unknown): ServicePayoutSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  return snapshot as ServicePayoutSnapshot;
}

function servicePayoutLineForBooking(snapshot: ServicePayoutSnapshot | null, customerPrice: unknown) {
  if (!snapshot?.lines || !Array.isArray(snapshot.lines)) {
    return null;
  }

  const targetCustomerPrice = readNullableAmount(customerPrice);
  if (targetCustomerPrice === null) {
    return null;
  }

  return (
    snapshot.lines.find((line) => readNullableAmount(line.customerPrice) === targetCustomerPrice) ?? null
  );
}

function readAmount(value: unknown) {
  return readNullableAmount(value) ?? 0;
}

function readNullableAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bpsAmount(amount: number, bps?: number | null) {
  return Math.round((amount * Number(bps ?? 0)) / 10000);
}

function providerName(provider?: { displayName?: string | null } | null) {
  return provider?.displayName ?? 'Not selected';
}

function bookingServiceOptionLabel(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  if (!service?.name) {
    return 'Service pending';
  }

  const duration = service.durationMin ? `${service.durationMin} min` : 'duration pending';
  return `${service.name} / ${duration}`;
}

function bookingServicePayoutRuleLabel(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  const payoutRule = service?.payoutRules?.find(
    (rule) => Number(rule.customerPrice) === Number(customerPrice),
  );

  if (!payoutRule) {
    return 'Missing active rule';
  }

  const platformFee = Number(payoutRule.customerPrice) - Number(payoutRule.providerPayoutAmount);
  return `${money(Number(payoutRule.providerPayoutAmount), payoutRule.currency ?? currency)} payout / ${money(platformFee, payoutRule.currency ?? currency)} fee`;
}

function addressLabel(address: unknown) {
  if (typeof address === 'string') {
    return address;
  }
  if (address && typeof address === 'object' && 'line1' in address) {
    return String((address as { line1?: unknown }).line1 ?? 'Address pending');
  }
  return 'Address pending';
}

function coordinateLabel(lat?: string | number | null, lng?: string | number | null) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return 'No pin';
  }
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

function distanceLabel(distance?: number | null) {
  if (distance === undefined || distance === null) {
    return 'No distance';
  }
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${distance} m`;
}

function approximateDistanceMeters(
  startLat?: string | number | null,
  startLng?: string | number | null,
  endLat?: string | number | null,
  endLng?: string | number | null,
) {
  const lat1 = Number(startLat);
  const lng1 = Number(startLng);
  const lat2 = Number(endLat);
  const lng2 = Number(endLng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return null;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function money(amount?: number | null, currency = 'VND') {
  if (amount === undefined || amount === null) {
    return 'Not set';
  }
  return `${amount.toLocaleString()} ${currency}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not set';
  }
  return new Date(value).toLocaleString();
}

function minutesSince(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

function shortId(id: string) {
  return id.slice(0, 8);
}
