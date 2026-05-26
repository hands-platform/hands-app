'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminBooking } from '../../lib/admin-api';

type Props = {
  bookings: AdminBooking[];
  initialView: BookingView;
};

type BookingView = 'active' | 'high-risk' | 'payment' | 'pricing' | 'location' | 'chat' | 'all';

const activeStatuses = new Set(['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const locationRequiredStatuses = new Set(['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;
const displayTimeZone = 'Asia/Bangkok';
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: displayTimeZone,
});
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: displayTimeZone,
});

export function BookingMonitor({ bookings, initialView }: Props) {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshLabel, setLastRefreshLabel] = useState('pending');
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<BookingView>(initialView);
  const currentTimeMs = nowMs ?? 0;

  const orderedBookings = useMemo(
    () =>
      [...bookings].sort((left, right) => {
        const leftScore = bookingPriority(left);
        const rightScore = bookingPriority(right);
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        return bookingTimestamp(right) - bookingTimestamp(left);
      }),
    [bookings],
  );

  const summary = useMemo(() => {
    const open = orderedBookings.filter((booking) => booking.status === 'OPEN_MATCHING');
    const matched = orderedBookings.filter((booking) => booking.status === 'MATCHED');
    const active = orderedBookings.filter((booking) => activeStatuses.has(booking.status));
    const noParticipants = open.filter((booking) => (booking.participants?.length ?? 0) === 0);
    const waitingSelection = open.filter((booking) => fallbackParticipants(booking).length > 0);
    const preferredPending = open.filter(
      (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
    );
    const backupChosen = orderedBookings.filter((booking) => isBackupSelected(booking));
    const chatLive = orderedBookings.filter((booking) => Boolean(booking.chatRoom));
    const paymentRisk = orderedBookings.filter((booking) => bookingPaymentNeedsOps(booking));
    const pricingRisk = orderedBookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
    const locationRisk = orderedBookings.filter((booking) => bookingLocationNeedsOps(booking, currentTimeMs));
    const highRisk = orderedBookings.filter((booking) =>
      bookingRiskFlags(booking, currentTimeMs).some((flag) => flag.severity === 'high'),
    );
    return [
      ['Active bookings', active.length.toString()],
      ['Open matching', open.length.toString()],
      ['Matched', matched.length.toString()],
      ['High risk', highRisk.length.toString()],
      ['No providers yet', noParticipants.length.toString()],
      ['Preferred pending', preferredPending.length.toString()],
      ['Fallback options', waitingSelection.length.toString()],
      ['Backup selected', backupChosen.length.toString()],
      ['Chat live', chatLive.length.toString()],
      ['Payment risk', paymentRisk.length.toString()],
      ['Pricing risk', pricingRisk.length.toString()],
      ['Location risk', locationRisk.length.toString()],
    ];
  }, [currentTimeMs, orderedBookings]);

  const visibleBookings = useMemo(() => {
    if (view === 'high-risk') {
      return orderedBookings.filter((booking) =>
        bookingRiskFlags(booking, currentTimeMs).some((flag) => flag.severity === 'high'),
      );
    }
    if (view === 'payment') {
      return orderedBookings.filter((booking) => bookingPaymentNeedsOps(booking));
    }
    if (view === 'pricing') {
      return orderedBookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
    }
    if (view === 'location') {
      return orderedBookings.filter((booking) => bookingLocationNeedsOps(booking, currentTimeMs));
    }
    if (view === 'chat') {
      return orderedBookings.filter((booking) => Boolean(booking.chatRoom));
    }
    if (view === 'all') {
      return orderedBookings;
    }
    return orderedBookings.filter((booking) => activeStatuses.has(booking.status));
  }, [currentTimeMs, orderedBookings, view]);
  const activeView = bookingViewOptions.find((item) => item.view === view) ?? bookingViewOptions[0];

  useEffect(() => {
    const mountedAt = new Date();
    setHasMounted(true);
    setLastRefreshLabel(formatClockTime(mountedAt));
    setNowMs(mountedAt.getTime());

    if (!autoRefresh) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        const refreshedAt = new Date();
        setLastRefreshLabel(formatClockTime(refreshedAt));
        setNowMs(refreshedAt.getTime());
      });
    }, 10000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, router]);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Booking Monitor</h1>
          <p className="muted">
            Live operational view for matching, provider selection, chat, and payment readiness.
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setAutoRefresh((value) => !value)}>
            {autoRefresh ? 'Pause refresh' : 'Resume refresh'}
          </button>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                router.refresh();
                const refreshedAt = new Date();
                setLastRefreshLabel(formatClockTime(refreshedAt));
                setNowMs(refreshedAt.getTime());
              });
            }}
          >
            Refresh now
          </button>
        </div>
      </section>

      <section className="grid">
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </section>

      <div className="monitor-meta">
        <span>{isPending ? 'Refreshing...' : 'Ready'}</span>
        <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking operation filters</h2>
            <p className="muted">
              Active queue: <strong>{activeView.label}</strong> - {activeView.description}
            </p>
          </div>
          <span className={`pill ${view === 'all' ? 'pill-success' : 'pill-warn'}`}>
            Showing {visibleBookings.length} of {orderedBookings.length}
          </span>
        </div>
        <div className="participant-list">
          {bookingViewOptions.map((option) => (
            <button
              key={option.view}
              type="button"
              onClick={() => setView(option.view)}
              disabled={view === option.view}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {activeView.operatorHint}
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Flow</th>
              <th>Customer</th>
              <th>Providers</th>
              <th>Payment</th>
              <th>Risk</th>
              <th>Ops signal</th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => {
              const flags = bookingRiskFlags(booking, currentTimeMs);
              const risk = riskLevel(flags);
              const servicePriceLabel = bookingServicePriceLabel(booking);
              const servicePayoutLabel = bookingServicePayoutRuleLabel(booking);
              const pricingPolicy = bookingPricingPolicySignal(booking);
              return (
                <tr id={`booking-${booking.id}`} key={booking.id}>
                  <td>
                    <strong>
                      <Link className="text-link" href={`/bookings/${booking.id}`}>
                        {shortId(booking.id)}
                      </Link>
                    </strong>
                    <div className="muted">{bookingServiceOptionLabel(booking)}</div>
                    <div className="muted">{servicePriceLabel}</div>
                    {servicePayoutLabel && <div className="muted">{servicePayoutLabel}</div>}
                    {pricingPolicy.status !== 'ready' && (
                      <span className={`pill ${pricingPolicy.tone}`}>{pricingPolicy.label}</span>
                    )}
                    <div className="muted">{formatDate(booking.scheduledStartAt)}</div>
                    <div className="muted">{recencyLabel(booking, nowMs)}</div>
                  </td>
                  <td>
                    <StatusBadge status={booking.status} />
                    <div className="muted">Chat {booking.chatRoom ? 'ready' : 'not ready'}</div>
                    <div className="muted">
                      {booking.expiresAt ? `Expires ${formatDate(booking.expiresAt)}` : 'No expiry set'}
                    </div>
                  </td>
                  <td>
                    {booking.customerProfile?.user?.fullName ?? 'Customer'}
                    <div className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</div>
                  </td>
                  <td>
                    <strong>{booking.participants?.length ?? 0} joined</strong>
                    <div className="muted">Preferred {booking.preferredProvider?.displayName ?? 'none'}</div>
                    <div className="muted">
                      {booking.preferredProvider?.user?.phone
                        ? `Preferred phone ${booking.preferredProvider.user.phone}`
                        : 'Preferred provider not set'}
                    </div>
                    <div className="muted">{selectionPathLabel(booking)}</div>
                    <div className="muted">{bookingLocationSignalLabel(booking, currentTimeMs)}</div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      <span className={`pill ${selectionToneClass(booking)}`}>{selectionLabel(booking)}</span>
                      {booking.chatRoom && <span className="pill pill-success">Chat ready</span>}
                      <span className={`pill ${bookingLocationToneClass(booking, currentTimeMs)}`}>
                        {bookingLocationPillLabel(booking, currentTimeMs)}
                      </span>
                    </div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      {booking.preferredProvider && (
                        <span className="pill" style={{ background: '#eef6e8', borderColor: '#b9d4a8' }}>
                          Preferred: {booking.preferredProvider.displayName ?? 'Provider'}{' '}
                          {preferredProviderStateLabel(booking)}
                        </span>
                      )}
                      {booking.selectedProvider &&
                        booking.selectedProvider.id !== booking.preferredProvider?.id && (
                          <span className="pill pill-success">
                            Final: {booking.selectedProvider.displayName ?? 'Provider'}
                          </span>
                        )}
                      {fallbackParticipants(booking)
                        .slice(0, 4)
                        .map((participant) => (
                          <span className="pill" key={participant.id}>
                            Backup: {participant.providerProfile?.displayName ?? 'Provider'} (
                            {participant.status})
                          </span>
                        ))}
                    </div>
                    {fallbackParticipants(booking).length > 4 && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        +{fallbackParticipants(booking).length - 4} more backup therapist(s)
                      </div>
                    )}
                  </td>
                  <td>
                    {booking.payment?.status ?? 'NONE'}
                    <div className="muted">
                      {booking.payment
                        ? `${booking.payment.amount} ${booking.payment.currency ?? 'VND'} - ${booking.payment.method}`
                        : 'No payment'}
                    </div>
                    {booking.payment?.id && (
                      <div className="actions" style={{ marginTop: 8 }}>
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
                    {bookingCashDebtNeedsOps(booking) && (
                      <div className="muted" style={{ marginTop: 8 }}>
                        Cash fee debt{' '}
                        {money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}
                      </div>
                    )}
                    {booking.earning?.id && (
                      <div className="actions" style={{ marginTop: 8 }}>
                        <Link className="text-link" href={`/earnings#earning-${booking.earning.id}`}>
                          Open earning
                        </Link>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`signal ${risk.tone}`}>{risk.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {risk.helper}
                    </div>
                    {flags.length > 0 && <div className="muted">{flags[0].title}</div>}
                  </td>
                  <td>
                    <div>{opsSignal(booking)}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {nextAction(booking)}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibleBookings.length === 0 && (
              <tr>
                <td colSpan={7}>{emptyBookingMessage(view)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

const bookingViewOptions: Array<{
  view: BookingView;
  label: string;
  description: string;
  operatorHint: string;
}> = [
  {
    view: 'active',
    label: 'Active only',
    description: 'live dispatch work across matching, arrival, and in-service states.',
    operatorHint:
      'Use this during operations to catch stalled matching, missing location, or unresolved payment risk.',
  },
  {
    view: 'high-risk',
    label: 'High risk',
    description: 'bookings with expired matching, unresolved payment, or missing chat after matching.',
    operatorHint: 'Use this as the first dispatch triage view when the dashboard shows attention needed.',
  },
  {
    view: 'payment',
    label: 'Payment ops',
    description: 'bookings whose payment state can block closeout, refund, capture, or settlement.',
    operatorHint:
      'Use this to catch completed authorized payments, cancelled unresolved holds, cash pending, and missing refs.',
  },
  {
    view: 'pricing',
    label: 'Pricing ops',
    description: 'bookings whose service price is not backed by the active service payout matrix.',
    operatorHint:
      'Use this after changing service prices or payout rules to catch hidden finance mismatches before settlement.',
  },
  {
    view: 'location',
    label: 'Location ops',
    description: 'on-the-way or in-service bookings with missing or stale provider location signals.',
    operatorHint:
      'Use this only for live service states. The MVP tracks last-known location, not live route streaming.',
  },
  {
    view: 'chat',
    label: 'Chat live',
    description: 'bookings where customer/provider communication is already available.',
    operatorHint:
      'Use this to inspect service handoff quality, quiet chats, and route/location expectations.',
  },
  {
    view: 'all',
    label: 'All bookings',
    description: 'full booking history for investigation, finance follow-up, and audit review.',
    operatorHint: 'Use this when you need cancelled, completed, refunded, or old matching records.',
  },
];

function bookingPriority(booking: AdminBooking) {
  if (booking.status === 'IN_SERVICE') {
    return 5;
  }
  if (booking.status === 'PROVIDER_ON_THE_WAY' || booking.status === 'ARRIVED') {
    return 4;
  }
  if (booking.status === 'MATCHED') {
    return 3;
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 2;
  }
  return 1;
}

function emptyBookingMessage(view: BookingView) {
  if (view === 'active') {
    return 'No active bookings match this queue. Dispatch is clear right now.';
  }
  if (view === 'high-risk') {
    return 'No high-risk bookings match this queue. Expired matching, missing chat, and payment closeout are clear.';
  }
  if (view === 'payment') {
    return 'No payment-risk bookings match this queue. Capture, release, refund, cash, and provider refs are clear.';
  }
  if (view === 'pricing') {
    return 'No pricing-risk bookings match this queue. Booking prices match active service payout rules.';
  }
  if (view === 'location') {
    return 'No location-risk bookings match this queue. Live service location signals look acceptable.';
  }
  if (view === 'chat') {
    return 'No chat-live bookings match this queue. No active customer/provider conversation needs review.';
  }
  return 'No bookings loaded. Start the API and run the smoke flow to populate this table.';
}

function bookingTimestamp(booking: AdminBooking) {
  return new Date(booking.createdAt ?? booking.scheduledStartAt ?? booking.expiresAt ?? 0).getTime();
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

function opsSignal(booking: AdminBooking) {
  const participantCount = fallbackParticipants(booking).length;
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED' ? (
      <span className="signal signal-ok">Cancelled and released</span>
    ) : (
      <span className="signal signal-warn">Cancelled, check payment</span>
    );
  }
  if (booking.status === 'REFUNDED') {
    return <span className="signal signal-warn">Refunded</span>;
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return <span className="signal signal-warn">Cash fee debt</span>;
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return <span className="signal signal-warn">Preferred provider pending</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return <span className="signal signal-warn">No fallback providers yet</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return <span className="signal signal-info">Fallback options ready</span>;
  }
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
    return <span className="signal signal-info">Backup therapist selected</span>;
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return <span className="signal signal-warn">Chat missing</span>;
  }
  return <span className="signal signal-ok">Normal</span>;
}

type BookingRiskFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
};

function bookingRiskFlags(booking: AdminBooking, nowMs: number): BookingRiskFlag[] {
  const flags: BookingRiskFlag[] = [];
  const paymentStatus = booking.payment?.status;
  const participantCount = booking.participants?.length ?? 0;
  const expired = nowMs > 0 && booking.expiresAt ? new Date(booking.expiresAt).getTime() < nowMs : false;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ severity: 'high', title: 'Cancelled payment unresolved' });
  }
  if (booking.status === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({ severity: 'high', title: 'Completed service still on hold' });
  }
  if (bookingCashDebtNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Cash fee debt blocks provider acceptance' });
  }
  const pricingPolicy = bookingPricingPolicySignal(booking);
  if (pricingPolicy.status === 'blocked') {
    flags.push({ severity: 'high', title: pricingPolicy.label });
  } else if (pricingPolicy.status === 'warning') {
    flags.push({ severity: 'medium', title: pricingPolicy.label });
  }
  if (booking.status === 'OPEN_MATCHING' && expired) {
    flags.push({ severity: 'high', title: 'Matching window expired' });
  }
  if (booking.status === 'OPEN_MATCHING' && booking.preferredProvider && participantCount === 0) {
    flags.push({ severity: 'medium', title: 'Preferred provider pending' });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({ severity: 'medium', title: 'No provider supply' });
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    flags.push({ severity: 'high', title: 'Matched without chat' });
  }
  if (locationRequiredStatuses.has(booking.status) && !hasProviderLocation(booking)) {
    flags.push({ severity: 'medium', title: 'No provider location signal' });
  }
  if (
    locationRequiredStatuses.has(booking.status) &&
    hasProviderLocation(booking) &&
    providerLocationFreshness(booking, nowMs) !== 'recent'
  ) {
    flags.push({ severity: 'medium', title: 'Provider location is stale' });
  }
  if (
    booking.chatRoom &&
    (booking.chatRoom.messages?.length ?? 0) === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
  ) {
    flags.push({ severity: 'low', title: 'Chat quiet' });
  }
  if (paymentStatus === 'AUTHORIZED' && !booking.payment?.providerRef) {
    flags.push({ severity: 'medium', title: 'Payment reference missing' });
  }

  return flags;
}

function bookingPaymentNeedsOps(booking: AdminBooking) {
  const payment = booking.payment;
  if (!payment) {
    return ['CREATED', 'OPEN_MATCHING', 'MATCHED'].includes(booking.status);
  }
  if (booking.status === 'CANCELLED' && !['RELEASED', 'REFUNDED'].includes(payment.status)) {
    return true;
  }
  if (booking.status === 'COMPLETED' && payment.status === 'AUTHORIZED') {
    return true;
  }
  if (payment.status === 'AUTHORIZED' && !payment.providerRef) {
    return true;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return true;
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return true;
  }
  return false;
}

function bookingPricingPolicyNeedsOps(booking: AdminBooking) {
  return bookingPricingPolicySignal(booking).status !== 'ready';
}

function bookingPricingPolicySignal(booking: AdminBooking): {
  status: 'ready' | 'warning' | 'blocked';
  label: string;
  tone: string;
} {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  if (!bookedService || !service) {
    return { status: 'blocked', label: 'Service missing', tone: 'pill-danger' };
  }

  const customerPrice = readAmount(bookedService.price ?? booking.payment?.amount);
  if (customerPrice === null) {
    return { status: 'blocked', label: 'Price missing', tone: 'pill-danger' };
  }

  const minimum = readAmount(service.basePrice);
  const priceStep = readAmount(service.priceStep) ?? 100000;
  if (minimum !== null && customerPrice < minimum) {
    return { status: 'blocked', label: 'Below admin minimum', tone: 'pill-danger' };
  }
  if (priceStep <= 0 || customerPrice % priceStep !== 0) {
    return { status: 'blocked', label: 'Invalid price step', tone: 'pill-danger' };
  }

  const payoutRule = service.payoutRules?.find(
    (rule) => rule.active && Number(rule.customerPrice) === customerPrice,
  );
  if (!payoutRule) {
    return { status: 'blocked', label: 'Active payout rule missing', tone: 'pill-danger' };
  }
  if (Number(payoutRule.providerPayoutAmount) > customerPrice) {
    return { status: 'blocked', label: 'Provider payout exceeds price', tone: 'pill-danger' };
  }

  const platformFee = customerPrice - Number(payoutRule.providerPayoutAmount);
  if (platformFee <= 0) {
    return { status: 'warning', label: 'Zero company gross fee', tone: 'pill-warn' };
  }

  return { status: 'ready', label: 'Pricing ready', tone: 'pill-success' };
}

function bookingCashDebtNeedsOps(booking: AdminBooking) {
  return (
    booking.payment?.method === 'CASH' &&
    Boolean(booking.earning) &&
    (booking.earning?.netAmount ?? 0) < 0 &&
    booking.earning?.status !== 'PAID'
  );
}

function bookingLocationNeedsOps(booking: AdminBooking, nowMs: number) {
  if (!locationRequiredStatuses.has(booking.status)) {
    return false;
  }
  if (!hasProviderLocation(booking)) {
    return true;
  }
  return providerLocationFreshness(booking, nowMs) !== 'recent';
}

function riskLevel(flags: BookingRiskFlag[]) {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'High', helper: `${flags.length} flag(s)`, tone: 'signal-warn' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Medium', helper: `${flags.length} flag(s)`, tone: 'signal-info' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Low', helper: `${flags.length} flag(s)`, tone: 'signal-info' };
  }
  return { label: 'Clear', helper: 'No active flags', tone: 'signal-ok' };
}

function hasProviderLocation(booking: AdminBooking) {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return true;
  }
  return (booking.participants ?? []).some((participant) =>
    hasProviderCoordinate(participant.providerProfile),
  );
}

function nextAction(booking: AdminBooking) {
  const participantCount = fallbackParticipants(booking).length;
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Customer cancelled before completion. Payment hold is released; confirm notifications were delivered.'
      : 'Customer cancelled. Review the linked payment and release or refund before closing the case.';
  }
  if (booking.status === 'REFUNDED') {
    return 'Refund is recorded. Check the refund board and customer communication.';
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return 'Provider collected cash. Finance must settle the HANDS fee debt before this provider can accept more bookings.';
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return 'Wait for the preferred provider, but monitor fallback therapist supply.';
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return 'Watch notifications and nearby provider supply.';
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return 'Customer can keep waiting or switch to a backup therapist.';
  }
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
    return 'Customer switched away from the preferred therapist. Confirm chat, route, and provider handoff.';
  }
  if (booking.status === 'MATCHED') {
    return 'Customer selection is locked. Check chat creation, route tracking, and provider departure.';
  }
  if (booking.status === 'PROVIDER_ON_THE_WAY') {
    return 'Monitor live location and arrival progress.';
  }
  if (booking.status === 'IN_SERVICE') {
    return 'Watch completion and payment capture.';
  }
  if (booking.status === 'COMPLETED') {
    return 'Review payment, tip, and follow-up review.';
  }
  return 'Normal operating state.';
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function bookingServiceOptionLabel(booking: AdminBooking) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  if (!service?.name) {
    return 'Service pending';
  }

  const duration = service.durationMin ? `${service.durationMin} min` : 'duration pending';
  return `${service.name} / ${duration}`;
}

function bookingServicePriceLabel(booking: AdminBooking) {
  const bookedService = booking.services?.[0];
  const currency = booking.payment?.currency ?? 'VND';
  const price = bookedService?.price ?? booking.payment?.amount;
  if (price === undefined || price === null) {
    return 'Price pending';
  }

  const minimum = bookedService?.service?.basePrice;
  return minimum === undefined || minimum === null
    ? `Customer ${money(Number(price), currency)}`
    : `Customer ${money(Number(price), currency)} / min ${money(Number(minimum), currency)}`;
}

function bookingServicePayoutRuleLabel(booking: AdminBooking) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  const payoutRule = service?.payoutRules?.find(
    (rule) => rule.active && Number(rule.customerPrice) === Number(customerPrice),
  );

  if (!payoutRule) {
    return customerPrice === undefined || customerPrice === null ? null : 'Payout rule missing';
  }

  const providerPayout = Number(payoutRule.providerPayoutAmount);
  const platformFee = Number(payoutRule.customerPrice) - providerPayout;
  return `Payout ${money(providerPayout, payoutRule.currency ?? currency)} / fee ${money(platformFee, payoutRule.currency ?? currency)}`;
}

function money(amount: number, currency = 'VND') {
  return `${amount.toLocaleString()} ${currency}`;
}

function readAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'No schedule';
  }
  return dateTimeFormatter.format(new Date(value));
}

function formatClockTime(value: Date) {
  return clockFormatter.format(value);
}

function recencyLabel(booking: AdminBooking, nowMs: number | null) {
  const timestamp = booking.createdAt ?? booking.scheduledStartAt ?? booking.expiresAt;
  if (!timestamp) {
    return 'Created time unavailable';
  }
  if (!nowMs) {
    return 'Recency loading...';
  }

  const minutesAgo = Math.max(0, Math.round((nowMs - new Date(timestamp).getTime()) / 60000));
  if (minutesAgo < 1) {
    return 'Updated just now';
  }
  if (minutesAgo < 60) {
    return `Updated ${minutesAgo}m ago`;
  }
  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `Updated ${hoursAgo}h ago`;
  }
  const daysAgo = Math.round(hoursAgo / 24);
  return `Updated ${daysAgo}d ago`;
}

function isSelectedProviderParticipant(booking: AdminBooking) {
  const selectedProviderId = booking.selectedProvider?.id;
  if (!selectedProviderId) {
    return false;
  }

  return (booking.participants ?? []).some(
    (participant) =>
      participant.providerProfile?.id === selectedProviderId && participant.status !== 'REJECTED',
  );
}

function isBackupSelected(booking: AdminBooking) {
  return Boolean(
    booking.selectedProvider?.id &&
    booking.preferredProvider?.id &&
    booking.selectedProvider.id !== booking.preferredProvider.id,
  );
}

function fallbackParticipants(booking: AdminBooking) {
  const preferredId = booking.preferredProvider?.id;
  return (booking.participants ?? []).filter(
    (participant) =>
      participant.status !== 'REJECTED' &&
      participant.providerProfile?.id &&
      participant.providerProfile.id !== preferredId,
  );
}

function selectionLabel(booking: AdminBooking) {
  if (!booking.preferredProvider) {
    return 'No preferred therapist';
  }

  if (isBackupSelected(booking)) {
    return 'Backup therapist selected';
  }

  if (booking.status === 'OPEN_MATCHING' && isPreferredAwaitingDecision(booking)) {
    return 'Preferred therapist pending';
  }

  if (preferredProviderStateLabel(booking) == 'declined') {
    return 'Preferred therapist declined';
  }

  if (booking.status === 'MATCHED') {
    return 'Final therapist selected';
  }

  if (isSelectedProviderParticipant(booking)) {
    return 'Preferred therapist is active';
  }

  return 'Preferred therapist requested';
}

function selectionPathLabel(booking: AdminBooking) {
  const fallbackCount = fallbackParticipants(booking).length;

  if (!booking.preferredProvider) {
    return fallbackCount > 0 ? 'Open pool request with backup supply' : 'Open pool request';
  }

  if (booking.status === 'OPEN_MATCHING' && isPreferredAwaitingDecision(booking)) {
    return fallbackCount > 0
      ? 'Direct request first, with backup therapists already waiting'
      : 'Direct request first, waiting on the preferred therapist';
  }

  if (isBackupSelected(booking)) {
    return 'Direct request escalated to backup, then the guest chose a backup therapist';
  }

  if (booking.status === 'MATCHED') {
    return 'Direct request confirmed by the preferred therapist';
  }

  if (fallbackCount > 0) {
    return 'Backup therapists are available while the preferred therapist stays in the flow';
  }

  return 'Direct request remains the active path';
}

function selectionToneClass(booking: AdminBooking) {
  if (!booking.preferredProvider) {
    return 'pill-neutral';
  }

  if (booking.status === 'OPEN_MATCHING' && isPreferredAwaitingDecision(booking)) {
    return 'pill-warn';
  }

  if (preferredProviderStateLabel(booking) == 'declined') {
    return 'pill-info';
  }

  if (booking.status === 'MATCHED') {
    return 'pill-success';
  }

  if (isSelectedProviderParticipant(booking)) {
    return 'pill-success';
  }

  return 'pill-neutral';
}

function preferredParticipantState(booking: AdminBooking) {
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

function isPreferredAwaitingDecision(booking: AdminBooking) {
  const participant = preferredParticipantState(booking);
  if (!booking.preferredProvider) {
    return false;
  }
  if (!participant) {
    return true;
  }
  return (
    participant.status !== 'ACCEPTED' &&
    participant.status !== 'SELECTED' &&
    participant.status !== 'REJECTED'
  );
}

function preferredProviderStateLabel(booking: AdminBooking) {
  if (isBackupSelected(booking)) {
    return 'not final';
  }

  const participant = preferredParticipantState(booking);
  if (!participant) {
    return 'requested';
  }
  if (participant.status === 'REJECTED') {
    return 'declined';
  }
  if (participant.status === 'ACCEPTED' || participant.status === 'SELECTED') {
    return 'confirmed';
  }
  return 'pending';
}

function bookingLocationSignalLabel(booking: AdminBooking, nowMs: number) {
  const provider = providerWithLocation(booking);
  if (!provider) {
    return 'Provider location: not shared yet';
  }

  const updatedAt = provider.currentLocationUpdatedAt;
  if (!updatedAt) {
    return 'Provider location: saved pin without timestamp';
  }

  const age = locationAgeLabel(updatedAt, nowMs);
  return `Provider location: ${age}`;
}

function bookingLocationPillLabel(booking: AdminBooking, nowMs: number) {
  const freshness = providerLocationFreshness(booking, nowMs);
  if (freshness === 'recent') {
    return 'Location recent';
  }
  if (freshness === 'stale') {
    return 'Location stale';
  }
  if (freshness === 'expired') {
    return 'Location too old';
  }
  return 'No location';
}

function bookingLocationToneClass(booking: AdminBooking, nowMs: number) {
  const freshness = providerLocationFreshness(booking, nowMs);
  if (freshness === 'recent') {
    return 'pill-success';
  }
  if (freshness === 'stale') {
    return 'pill-warn';
  }
  if (freshness === 'expired') {
    return 'pill-info';
  }
  return 'pill-neutral';
}

function providerLocationFreshness(
  booking: AdminBooking,
  nowMs: number,
): 'recent' | 'stale' | 'expired' | 'missing' {
  const provider = providerWithLocation(booking);
  if (!provider?.currentLocationUpdatedAt) {
    return 'missing';
  }

  const updatedAt = new Date(provider.currentLocationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const ageMs = reference - updatedAt;
  if (ageMs > EXPIRED_LOCATION_HOURS * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > STALE_LOCATION_MINUTES * 60_000) {
    return 'stale';
  }
  return 'recent';
}

function providerWithLocation(booking: AdminBooking) {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return booking.selectedProvider;
  }

  return (booking.participants ?? [])
    .map((participant) => participant.providerProfile)
    .find((provider) => hasProviderCoordinate(provider));
}

function hasProviderCoordinate(
  provider?: { currentLat?: string | number | null; currentLng?: string | number | null } | null,
) {
  if (!provider || provider.currentLat === null || provider.currentLat === undefined) {
    return false;
  }
  if (provider.currentLng === null || provider.currentLng === undefined) {
    return false;
  }
  return Number.isFinite(Number(provider.currentLat)) && Number.isFinite(Number(provider.currentLng));
}

function locationAgeLabel(value: string, nowMs: number) {
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'invalid timestamp';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const ageMinutes = Math.max(0, Math.round((reference - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'updated just now';
  }
  if (ageMinutes < 60) {
    return `updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `updated ${ageHours}h ago`;
}
