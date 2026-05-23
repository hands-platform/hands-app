import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminBookingDetail, AdminChatMessage, AdminLocationSnapshot, adminGet } from '../../../lib/admin-api';
import { captureBookingPayment, refundBookingPayment, releaseBookingPayment, syncBookingPayment } from './actions';

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
            {service?.service?.name ?? 'Service pending'} - {booking.status}
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
        <MetricCard label="Providers" value={`${booking.participants?.length ?? 0} joined`} helper={providerHint(booking)} />
        <MetricCard label="Chat" value={booking.chatRoom ? 'Ready' : 'Not ready'} helper={`${messages.length} message(s)`} />
        <MetricCard label="Location" value={providerLocationMetricValue(booking)} helper={providerLocationMetricHelper(booking)} />
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
                disabled={booking.payment.status === 'CAPTURED' || booking.payment.status === 'REFUNDED' || booking.payment.status === 'RELEASED'}
              />
              <PaymentAction
                action={releaseBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Release"
                disabled={booking.payment.status === 'CAPTURED' || booking.payment.status === 'REFUNDED' || booking.payment.status === 'RELEASED'}
              />
              <PaymentAction
                action={refundBookingPayment}
                bookingId={booking.id}
                paymentId={booking.payment.id}
                label="Refund"
                disabled={booking.payment.status === 'REFUNDED' || booking.payment.status === 'RELEASED'}
              />
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
          <InfoRow label="Scheduled" value={`${formatDate(booking.scheduledStartAt)} - ${formatDate(booking.scheduledEndAt)}`} />
          <InfoRow label="Expires" value={formatDate(booking.expiresAt)} />
        </div>

        <div className="card">
          <h2>Service</h2>
          <InfoRow label="Name" value={service?.service?.name ?? 'Service pending'} />
          <InfoRow label="Duration" value={`${service?.service?.durationMin ?? '-'} min`} />
          <InfoRow label="Booking price" value={money(service?.price ?? booking.payment?.amount, booking.payment?.currency)} />
          <InfoRow label="Notes" value={booking.notes ?? 'No notes'} />
          <InfoRow label="Created" value={formatDate(booking.createdAt)} />
          <InfoRow label="Updated" value={formatDate(booking.updatedAt)} />
        </div>

        <div className="card">
          <h2>Provider handoff</h2>
          <InfoRow label="Preferred" value={providerName(booking.preferredProvider)} />
          <InfoRow label="Final" value={providerName(finalProvider)} />
          <InfoRow label="Final phone" value={finalProvider?.user?.phone ?? 'No phone'} />
          <InfoRow label="Latest provider pin" value={latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : 'No live pin yet'} />
          <InfoRow label="Latest pin time" value={latestLocation ? formatDate(latestLocation.recordedAt) : 'No location shared'} />
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
                    {participant.providerProfile?.user?.phone ?? 'No phone'} - {participant.providerStatusAtJoin ?? 'status unknown'}
                  </div>
                  <div className="muted">
                    Joined {formatDate(participant.joinedAt)} / responded {formatDate(participant.respondedAt)}
                  </div>
                </div>
                <div>
                  <span className={`pill ${participant.status === 'REJECTED' ? 'pill-warn' : 'pill-success'}`}>{participant.status}</span>
                  <div className="muted">{distanceLabel(participant.distanceMeters)}</div>
                </div>
              </div>
            ))}
            {(booking.participants ?? []).length === 0 && <p className="muted">No providers have joined yet.</p>}
          </div>
        </div>

        <div className="card">
          <h2>Payment and refund</h2>
          <InfoRow label="Payment id" value={booking.payment?.id ?? 'No payment'} />
          <InfoRow label="Method" value={booking.payment?.method ?? 'NONE'} />
          <InfoRow label="Amount" value={money(booking.payment?.amount, booking.payment?.currency)} />
          <InfoRow label="Refund count" value={`${booking.refunds?.length ?? booking.payment?.refunds?.length ?? 0}`} />
          <InfoRow label="Earning" value={booking.earning ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}` : 'Not created'} />
          <InfoRow label="Review" value={booking.review ? `${booking.review.rating}/5` : 'Not submitted'} />
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
            {locationTrail(booking).length === 0 && <p className="muted">No provider location snapshots linked to this booking yet.</p>}
          </div>
        </div>
      </section>
    </>
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

type RiskFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
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

  if (status === 'OPEN_MATCHING' && expired) {
    flags.push({
      severity: 'high',
      title: 'Matching window expired',
      detail: `The request expired at ${formatDate(booking.expiresAt)} but is still open.`,
      action: 'Expire the booking and release or refund the payment hold.',
    });
  }

  if (status === 'OPEN_MATCHING' && booking.preferredProvider && participantCount === 0 && openedAge !== null && openedAge >= 10) {
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

  if (activeWithLocationNeed && latestProviderLocation(booking) && latestProviderLocationFreshness(booking) !== 'recent') {
    flags.push({
      severity: 'medium',
      title: 'Provider location is stale',
      detail: `The latest provider pin is ${providerLocationMetricHelper(booking).toLowerCase()}.`,
      action: 'Ask the provider to share location again from the Provider app.',
    });
  }

  if (booking.chatRoom && messages.length === 0 && ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status)) {
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
      hint: booking.preferredProvider ? 'Direct request sent to preferred provider.' : 'Open matching started.',
      done: Boolean(booking.openedAt),
    },
    {
      label: 'Provider reply',
      value: providerDecisionLabel(booking),
      hint: providerHint(booking),
      done: (booking.participants?.length ?? 0) > 0 || ['MATCHED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status),
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
  const preferredParticipant = (booking.participants ?? []).find((participant) => participant.providerProfile?.id === preferredId);
  if (preferredParticipant) {
    return preferredParticipant.status;
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return `${booking.participants?.length ?? 0} backup ready`;
  }
  return 'Waiting';
}

function latestProviderLocation(booking: AdminBookingDetail) {
  const selected = booking.selectedProvider?.locationSnapshots?.[0];
  if (selected) {
    return selected;
  }

  const participantLocations = (booking.participants ?? [])
    .map((participant) => participant.providerProfile?.locationSnapshots?.[0])
    .filter(Boolean) as AdminLocationSnapshot[];

  return participantLocations.sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0] ?? null;
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

function providerName(provider?: { displayName?: string | null } | null) {
  return provider?.displayName ?? 'Not selected';
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

function money(amount?: number, currency = 'VND') {
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
