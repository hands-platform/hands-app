import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminOperationalPolicySetting,
  adminGet,
} from '../../../lib/admin-api';
import {
  addBookingOpsNote,
  captureBookingPayment,
  closeoutCompletedBooking,
  expireBooking,
  markBookingNoShow,
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
  const [booking, operationalPolicies] = await Promise.all([
    adminGet<AdminBookingDetail | null>(`/admin/bookings/${id}`, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);

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
  const policySnapshot = bookingOperationalPolicySnapshot(booking, operationalPolicies);

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
          label="Partners"
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Applied operations policy</h2>
            <p className="muted">
              The live admin policy that operators should use when handling this booking. Existing bookings
              keep their saved timeout, while partner visibility and join checks use the latest policy.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Open policy
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {policySnapshot.metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <span className={`pill ${policySnapshot.decisionTone}`}>{policySnapshot.decisionStatus}</span>
              <strong>{policySnapshot.decisionTitle}</strong>
              <p className="muted">{policySnapshot.decisionDetail}</p>
            </div>
            <Link className="text-link" href="/operations-policy">
              Review decision
            </Link>
          </div>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {policySnapshot.decisionCards.map((decision) => (
            <div className={`ops-task-card ${decision.className}`} key={decision.key}>
              <span className={`pill ${decision.pillClass}`}>{decision.status}</span>
              <h3>{decision.label}</h3>
              <p>{decision.value}</p>
              <small>{decision.helper}</small>
            </div>
          ))}
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
              One-booking money flow from customer price to partner payout, HANDS fee, tax, and wallet impact.
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
            placeholder="Example: Called partner, confirmed arrival in 15 minutes."
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
              value="Partner contacted and asked to confirm location/status."
            >
              Partner contacted
            </button>
            <button name="preset" type="submit" value="Payment reviewed by operations.">
              Payment reviewed
            </button>
          </div>
        </form>
      </section>

      <section className="card ops-command-center" style={{ marginBottom: 16 }}>
        <div>
          <h2>Completed closeout</h2>
          <p className="muted">
            Reconcile a completed service after operational edits or a partial failure. This confirms payment
            capture, partner earning, tax log, platform fee log, and wallet ledger are present.
          </p>
        </div>
        {canCloseoutCompletedBooking(booking) ? (
          <form action={closeoutCompletedBooking} className="ops-note-form">
            <input type="hidden" name="bookingId" value={booking.id} />
            <textarea
              aria-label="Closeout note"
              name="note"
              placeholder="Example: Reconciled after support confirmed service completion."
            />
            <button type="submit">Reconcile completed booking</button>
          </form>
        ) : (
          <span className={`pill ${completedCloseoutTone(booking)}`}>{completedCloseoutLabel(booking)}</span>
        )}
      </section>

      <section className="card ops-command-center" style={{ marginBottom: 16 }}>
        <div>
          <h2>Matching expiry handling</h2>
          <p className="muted">
            Close an open matching request when the customer should stop waiting. This releases any active
            payment hold and leaves a customer-contact task for follow-up.
          </p>
        </div>
        {canExpireBooking(booking.status) ? (
          <form action={expireBooking} className="ops-note-form">
            <input type="hidden" name="bookingId" value={booking.id} />
            <textarea
              aria-label="Expiry reason"
              name="reason"
              placeholder="Example: Matching window passed and no suitable partner was available."
            />
            <button type="submit">Expire matching</button>
          </form>
        ) : (
          <span className={`pill ${booking.status === 'EXPIRED' ? 'pill-warn' : 'pill-neutral'}`}>
            {booking.status === 'EXPIRED' ? 'Already expired' : 'Expiry not available for this status'}
          </span>
        )}
      </section>

      <section className="card ops-command-center" style={{ marginBottom: 16 }}>
        <div>
          <h2>No-show handling</h2>
          <p className="muted">
            Use only when the customer or partner did not proceed and operations must close the live booking
            path. Payment, refund, and customer communication still need review after marking no-show.
          </p>
        </div>
        {canMarkNoShow(booking.status) ? (
          <form action={markBookingNoShow} className="ops-note-form">
            <input type="hidden" name="bookingId" value={booking.id} />
            <textarea
              aria-label="No-show reason"
              name="reason"
              placeholder="Example: Customer did not answer calls after partner arrival."
            />
            <button type="submit">Mark no-show</button>
          </form>
        ) : (
          <span className={`pill ${booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-neutral'}`}>
            {booking.status === 'NO_SHOW' ? 'Already no-show' : 'No-show not available for this status'}
          </span>
        )}
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
          <InfoRow label="Partner payout rule" value={bookingServicePayoutRuleLabel(booking)} />
          <InfoRow label="Notes" value={booking.notes ?? 'No notes'} />
          <InfoRow label="Created" value={formatDate(booking.createdAt)} />
          <InfoRow label="Updated" value={formatDate(booking.updatedAt)} />
        </div>

        <div className="card">
          <h2>Partner handoff</h2>
          <InfoRow label="Preferred" value={providerName(booking.preferredProvider)} />
          <InfoRow label="Final" value={providerName(finalProvider)} />
          <InfoRow label="Final phone" value={finalProvider?.user?.phone ?? 'No phone'} />
          <InfoRow
            label="Latest partner pin"
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
              <p className="muted">No partners have joined yet.</p>
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
              value={`${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} / partner blocked`}
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
          <InfoRow label="Partner payout" value={financeTrace.providerPayout} />
          <InfoRow label="Platform fee" value={financeTrace.platformFee} />
          <InfoRow label="VAT / other costs" value={financeTrace.feeCosts} />
          <InfoRow label="Net HANDS fee" value={financeTrace.netHandsFee} />
          <InfoRow label="Withholding" value={financeTrace.withholding} />
          <InfoRow label="Company fee after tax" value={financeTrace.companyFeeAfterTax} />
          <InfoRow label="Wallet ledger" value={financeTrace.walletLedger} />
          <InfoRow label="Partner net" value={financeTrace.providerNet} />
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
            {latestLocation && <span className="route-dot route-provider">Partner</span>}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {locationTrail(booking).map((snapshot) => (
              <div className="ops-row" key={snapshot.id}>
                <div>
                  <strong>{coordinateLabel(snapshot.lat, snapshot.lng)}</strong>
                  <div className="muted">{formatDate(snapshot.recordedAt)}</div>
                </div>
                <span className="pill">Partner</span>
              </div>
            ))}
            {locationTrail(booking).length === 0 && (
              <p className="muted">No partner location snapshots linked to this booking yet.</p>
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

  const settlementRef = `HANDS-CASH-${shortId(booking.id).toUpperCase()}`;
  return (
    <form action={settleBookingCashDebt} className="inline-form">
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="earningId" value={earning.id} />
      <input
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
        aria-label="Cash debt settlement reference"
      />
      <input
        name="settlementNotes"
        defaultValue={`Partner deposited ${money(Math.abs(earning.netAmount), earning.currency)} with ${settlementRef}`}
        placeholder={`Partner deposited ${money(Math.abs(earning.netAmount), earning.currency)}`}
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
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Matching expired and the payment hold is released. Confirm customer communication before closing.'
      : 'Matching expired but payment still needs review. Release or refund before closing.';
  }
  if (booking.status === 'NO_SHOW') {
    return 'Booking is marked no-show. Review customer communication, payment release/refund, and any partner fee impact before closing.';
  }
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Booking is cancelled and the payment hold is already released. Confirm customer messaging only.'
      : 'Booking is cancelled, but payment still needs operator review. Release or refund before closing.';
  }
  if (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED') {
    return 'Service is complete. Capture the authorized payment or refund if there was a dispute.';
  }
  if (bookingCashDebtNeedsSettlement(booking)) {
    return 'Cash was collected by the partner. Finance must settle the HANDS fee debt before this partner can accept more bookings.';
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    return 'Payment hold is live. Keep it authorized until service completion or cancellation.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Monitor partner response speed and fallback supply. Customer is still waiting.';
  }
  if (booking.status === 'MATCHED') {
    return 'Partner is selected. Watch chat readiness, location sharing, and arrival progression.';
  }
  if (booking.chatRoom && booking.status === 'IN_SERVICE') {
    return 'Service is live. Keep chat and location visible until completion.';
  }
  return 'No urgent action is required. Continue monitoring this booking from the timeline.';
}

function opsBadges(booking: AdminBookingDetail) {
  const badges = [];
  const flags = bookingRiskFlags(booking);
  if (booking.status === 'NO_SHOW') {
    badges.push({ label: 'No-show', tone: 'pill-danger' });
  }
  if (booking.status === 'EXPIRED') {
    badges.push({ label: 'Expired', tone: 'pill-warn' });
  }
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
    badges.push({ label: 'Partner selected', tone: 'pill-success' });
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

  if (status === 'EXPIRED' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'Expired payment unresolved',
      detail: `Booking is expired but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (status === 'NO_SHOW' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'No-show payment unresolved',
      detail: `Booking is no-show but payment is still ${paymentStatus}.`,
      action: 'Decide whether to release, refund, or keep the fee according to the active operating policy.',
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
      title: 'Cash fee debt blocks partner',
      detail: `${providerName(booking.selectedProvider ?? booking.preferredProvider)} collected cash and still owes ${money(
        Math.abs(booking.earning?.netAmount ?? 0),
        booking.earning?.currency,
      )}.`,
      action: 'Confirm the partner deposit or admin offset, then settle the earning.',
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
      title: 'Preferred partner slow',
      detail: `${providerName(booking.preferredProvider)} has not responded after ${openedAge} minute(s).`,
      action: 'Encourage backup supply or contact the partner.',
    });
  }

  if (status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      severity: 'medium',
      title: 'No partner supply',
      detail: 'No partner has joined the request yet.',
      action: 'Watch nearby online partners and consider operational outreach.',
    });
  }

  if (status === 'MATCHED' && !booking.chatRoom) {
    flags.push({
      severity: 'high',
      title: 'Matched without chat',
      detail: 'A partner is selected but no chat room exists.',
      action: 'Retry chat room creation before the service starts.',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    flags.push({
      severity: 'medium',
      title: 'No partner location signal',
      detail: `Booking is ${status}, but the partner has not shared a live pin.`,
      action: 'Ask the partner to share current location from the Partner app.',
    });
  }

  if (
    activeWithLocationNeed &&
    latestProviderLocation(booking) &&
    latestProviderLocationFreshness(booking) !== 'recent'
  ) {
    flags.push({
      severity: 'medium',
      title: 'Partner location is stale',
      detail: `The latest partner pin is ${providerLocationMetricHelper(booking).toLowerCase()}.`,
      action: 'Ask the partner to share location again from the Partner app.',
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
      detail: 'The payment is authorized but has no gateway reference for reconciliation.',
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
      title: 'Preferred partner response',
      detail: `${providerName(booking.preferredProvider)} has the first response window. Contact them if the customer is waiting too long.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
    });
  }

  if (booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0) {
    steps.push({
      priority: 'Watch',
      title: 'Supply watch',
      detail: 'No partner has joined yet. Keep partner availability and notification delivery visible.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: '/providers',
      actionLabel: 'Open partners',
    });
  }

  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    steps.push({
      priority: 'Now',
      title: 'Recover chat room',
      detail: 'Partner is selected but no chat room exists. This can block service coordination.',
      owner: 'Support operator',
      tone: 'pill-danger',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    steps.push({
      priority: 'Now',
      title: 'Request partner location',
      detail: 'The partner has not shared a saved service pin for this active booking.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
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
      detail: `${providerLocationMetricHelper(booking)}. Ask the partner to share current location again if the customer asks.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
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
      title: 'Partner handoff locked',
      detail: `${providerName(booking.selectedProvider)} is the current final partner for this booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-success',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
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
        'Confirm the guest has been updated when waiting, switching partner, cancelling, or resolving payment.',
    },
    {
      type: 'PROVIDER_CONTACTED',
      label: 'Partner contacted',
      helper: 'Confirm the partner has been reached for response, location, arrival, or service progress.',
    },
    {
      type: 'LOCATION_CHECKED',
      label: 'Location checked',
      helper: 'Confirm saved customer/partner pins are reasonable. No route or continuous tracking is used.',
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
  const providerPin = latest ? coordinateLabel(latest.lat, latest.lng) : 'No partner pin';
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
      label: 'Partner pin',
      value: providerPin,
      helper: latest
        ? providerLocationMetricHelper(booking)
        : 'Ask partner to share current location from chat.',
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
      value: provider?.user?.phone ?? 'No partner phone',
      helper: provider
        ? `${providerName(provider)} is the current handoff partner.`
        : 'No partner assigned yet.',
      tone: provider ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
      helper: booking.chatRoom
        ? `Room ${booking.chatRoom.id}`
        : 'Chat opens after partner selection/service start.',
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
        ? 'Direct request sent to preferred partner.'
        : 'Open matching started.',
      done: Boolean(booking.openedAt),
    },
    {
      label: 'Partner reply',
      value: providerDecisionLabel(booking),
      hint: providerHint(booking),
      done:
        (booking.participants?.length ?? 0) > 0 ||
        ['MATCHED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status),
    },
    {
      label: 'Matched',
      value: providerName(booking.selectedProvider),
      hint: booking.chatRoom ? 'Chat room is ready.' : 'Waiting for final partner selection.',
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
    return 'Partner response or customer selection is still pending.';
  }
  if (status === 'MATCHED') {
    return 'Partner is selected; watch chat and movement.';
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
  if (status === 'EXPIRED') {
    return 'Matching closed; confirm payment release and customer communication.';
  }
  if (status === 'NO_SHOW') {
    return 'Review customer/partner communication and payment outcome.';
  }
  return 'Monitor the next operational action.';
}

function paymentHint(booking: AdminBookingDetail) {
  if (!booking.payment) {
    return 'No payment record created.';
  }
  if (booking.status === 'EXPIRED' && !['RELEASED', 'REFUNDED'].includes(booking.payment.status)) {
    return 'Expired booking requires payment release/refund before closing.';
  }
  if (booking.status === 'NO_SHOW' && !['RELEASED', 'REFUNDED'].includes(booking.payment.status)) {
    return 'No-show requires payment decision before closing.';
  }
  if (bookingCashDebtNeedsSettlement(booking)) {
    return 'Cash fee debt is still unsettled; partner acceptance is blocked.';
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

function canMarkNoShow(status: string) {
  return ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED'].includes(status);
}

function canExpireBooking(status: string) {
  return status === 'OPEN_MATCHING';
}

function canCloseoutCompletedBooking(booking: AdminBookingDetail) {
  if (booking.status !== 'COMPLETED') {
    return false;
  }
  if (!booking.payment || booking.payment.status !== 'CAPTURED') {
    return true;
  }
  if (!booking.earning) {
    return true;
  }
  const hasTaxLog = (booking.earning.taxLogs?.length ?? 0) > 0;
  const hasPlatformFeeLog = (booking.earning.platformFeeLogs?.length ?? 0) > 0;
  const hasWalletLedger = (booking.earning.walletLedgerEntries?.length ?? 0) > 0;
  return !hasTaxLog || !hasPlatformFeeLog || !hasWalletLedger;
}

function completedCloseoutLabel(booking: AdminBookingDetail) {
  if (booking.status !== 'COMPLETED') {
    return 'Closeout available after completion';
  }
  if (!canCloseoutCompletedBooking(booking)) {
    return 'Completed closeout healthy';
  }
  return 'Completed closeout needs reconciliation';
}

function completedCloseoutTone(booking: AdminBookingDetail) {
  if (booking.status !== 'COMPLETED') {
    return 'pill-neutral';
  }
  return canCloseoutCompletedBooking(booking) ? 'pill-warn' : 'pill-success';
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
      label: 'Partner payout',
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
      title: 'Partner payout exceeds customer price',
      detail: 'The payout rule would pay more than the customer charge.',
      action: 'Disable or correct the service payout rule immediately.',
    });
  }

  if (booking.status === 'COMPLETED' && !booking.earning) {
    flags.push({
      severity: 'high',
      title: 'Completed booking has no earning',
      detail: 'Service is completed but no partner earning/wallet entry exists.',
      action: 'Run earning creation or inspect completion processing.',
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    flags.push({
      severity: 'high',
      title: 'Cash wallet debt blocks partner',
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
    return `Final partner: ${providerName(booking.selectedProvider)}.`;
  }
  if (booking.preferredProvider && (booking.participants?.length ?? 0) === 0) {
    return 'Preferred partner has first response window.';
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return 'Shortlist has partners ready for customer decision.';
  }
  return 'No partner response yet.';
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
    return 'No partner location shared yet';
  }

  const recordedAt = new Date(latest.recordedAt).getTime();
  if (!Number.isFinite(recordedAt)) {
    return 'Partner location timestamp is invalid';
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
        )} partner`
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

function bookingOperationalPolicySnapshot(
  booking: AdminBookingDetail,
  settings: AdminOperationalPolicySetting[],
) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const responseWindow = byKey.get('matching.provider_response_window_minutes');
  const backupRadius = byKey.get('matching.backup_provider_radius_meters');
  const travelBuffer = byKey.get('matching.travel_buffer_minutes');
  const acceptMode = byKey.get('matching.preferred_accept_mode');
  const backupOpenMode = byKey.get('matching.backup_open_mode');
  const walletGate = byKey.get('wallet.negative_balance_gate');
  const cancellationPolicy = byKey.get('cancellation.after_match_policy');
  const noShowPolicy = byKey.get('no_show.partner_report_policy');
  const partnerAlertPolicy = byKey.get('notification.partner_alert_channel');
  const expiresAt = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null;
  const minutesLeft =
    expiresAt === null || Number.isNaN(expiresAt)
      ? null
      : Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  const acceptedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'ACCEPTED',
  );
  const selected = booking.status === 'MATCHED' || Boolean(booking.selectedProvider);
  const customerConfirmMode = String(acceptMode?.value) === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

  const decisionTitle = customerConfirmMode
    ? 'Customer final confirmation mode'
    : 'Auto-match preferred partner mode';
  const decisionStatus =
    customerConfirmMode && acceptedParticipants.length > 0 && !selected
      ? 'Customer action needed'
      : acceptMode?.enforced
        ? 'Policy enforced'
        : 'Policy default';
  const decisionTone =
    customerConfirmMode && acceptedParticipants.length > 0 && !selected ? 'pill-warn' : 'pill-success';
  const decisionDetail = customerConfirmMode
    ? acceptedParticipants.length > 0 && !selected
      ? 'A partner accepted, but the customer still needs to confirm the final partner before chat is unlocked.'
      : 'Preferred partner acceptance keeps the request open until the customer confirms the final partner.'
    : 'Preferred partner acceptance immediately locks the booking to that partner.';

  return {
    decisionTitle,
    decisionStatus,
    decisionTone,
    decisionDetail,
    decisionCards: [
      bookingPolicyDecisionCard({
        setting: backupOpenMode,
        key: 'matching.backup_open_mode',
        label: 'Backup participation',
        helper:
          String(backupOpenMode?.value) === 'AFTER_FIRST_PICK_DELAY'
            ? 'Backup partners are hidden until the preferred partner window passes.'
            : 'Eligible nearby partners can join while the preferred partner is still deciding.',
        enforced: true,
      }),
      bookingPolicyDecisionCard({
        setting: walletGate,
        key: 'wallet.negative_balance_gate',
        label: 'Wallet debt gate',
        helper:
          String(walletGate?.value) === 'ALLOW_ONE_RECOVERY_BOOKING'
            ? 'Negative wallet partners can hold one active recovery booking before being blocked again.'
            : 'Negative wallet partners are blocked from joining, accepting, or being selected.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: cancellationPolicy,
        key: 'cancellation.after_match_policy',
        label: 'After-match cancellation',
        helper:
          booking.status === 'CANCELLED'
            ? 'Use this policy to decide release, refund, or fee review for this cancelled booking.'
            : 'Applies if the customer cancels after a partner has accepted or been selected.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: noShowPolicy,
        key: 'no_show.partner_report_policy',
        label: 'No-show handling',
        helper:
          booking.status === 'NO_SHOW'
            ? 'Use this policy before applying customer or partner penalties.'
            : 'Applies if the partner reports a customer no-show later.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: partnerAlertPolicy,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert route',
        helper:
          String(partnerAlertPolicy?.value) === 'ONESIGNAL_FOR_ALL_BOOKINGS'
            ? 'Booking and backup alerts should create OneSignal delivery logs.'
            : 'Partner alerts are kept in the app inbox until production push is ready.',
        enforced: false,
      }),
    ],
    metrics: [
      {
        label: 'Response window',
        value: bookingPolicyValueLabel(responseWindow),
        helper:
          minutesLeft === null
            ? 'No active countdown saved.'
            : `${minutesLeft} min left on this booking countdown.`,
      },
      {
        label: 'Backup radius',
        value: bookingPolicyValueLabel(backupRadius),
        helper: 'Nearby partners outside this distance cannot join.',
      },
      {
        label: 'Travel buffer',
        value: bookingPolicyValueLabel(travelBuffer),
        helper: 'Applied before nearby availability is calculated.',
      },
      {
        label: 'Accept mode',
        value: bookingPolicyOptionLabel(acceptMode),
        helper: selected ? 'Booking has a final partner.' : 'Booking is still waiting for final selection.',
      },
    ],
  };
}

function bookingPolicyValueLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return '-';
  }

  const value = setting.value;
  if (setting.unit === 'meters') {
    return `${(Number(value) / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  if (setting.unit === 'minutes') {
    return `${value} min`;
  }
  return String(value);
}

function bookingPolicyOptionLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return '-';
  }

  const value = String(setting.value);
  return setting.options?.find((option) => option.value === value)?.label ?? bookingPolicyValueLabel(setting);
}

function bookingPolicyDecisionCard(input: {
  setting?: AdminOperationalPolicySetting;
  key: string;
  label: string;
  helper: string;
  enforced: boolean;
}) {
  const settingEnforced = input.setting?.enforced ?? input.enforced;
  const aligned =
    input.setting?.recommendedValue === null || input.setting?.recommendedValue === undefined
      ? true
      : String(input.setting?.value) === String(input.setting?.recommendedValue);

  return {
    key: input.key,
    label: input.label,
    value: bookingPolicyOptionLabel(input.setting),
    helper: input.helper,
    status: settingEnforced ? 'Live' : aligned ? 'Recommended' : 'Owner choice',
    className: aligned ? 'ops-task-done' : 'ops-task-pending',
    pillClass: settingEnforced ? 'pill-success' : aligned ? 'pill-info' : 'pill-warn',
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
