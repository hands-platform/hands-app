'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminBooking } from '../../lib/admin-api';

type Props = {
  bookings: AdminBooking[];
  initialView: BookingView;
};

type BookingView =
  | 'active'
  | 'attention'
  | 'matching'
  | 'first-pick'
  | 'marketplace'
  | 'customer-choice'
  | 'handoff-repair'
  | 'no-supply'
  | 'address'
  | 'payment'
  | 'cash-debt'
  | 'closeout'
  | 'pricing'
  | 'location'
  | 'chat'
  | 'chat-repair'
  | 'expired'
  | 'no-show'
  | 'all';

type BookingCommandLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};

type BookingNextAction = {
  booking: AdminBooking;
  title: string;
  detail: string;
  operatorAction: string;
  owner: 'Dispatch' | 'Finance' | 'Support' | 'Safety';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  tone: 'ok' | 'info' | 'warn' | 'danger';
  href: string;
  tags: string[];
};

type BookingProtectionLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  operatorAction: string;
  href: string;
  bookings: AdminBooking[];
};

type BookingMatchingEscalationLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  operatorAction: string;
  href: string;
  bookings: AdminBooking[];
  metrics: Array<{ label: string; value: string }>;
};

type BookingMatchingEscalationRow = {
  booking: AdminBooking;
  title: string;
  detail: string;
  operatorAction: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  tags: string[];
};

type BookingMatchingFlowStep = {
  stage: string;
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  operatorAction: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
  bookings: AdminBooking[];
};

type BookingMatchingPolicySnapshot = {
  providerResponseWindowMinutes: number | null;
  backupProviderRadiusMeters: number | null;
  backupProviderLocationMaxAgeMinutes: number | null;
  backupProviderInvitationLimit: number | null;
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
};

type BookingDispatchPartnerShortcut = {
  title: string;
  value: string;
  detail: string;
  href: string;
  tone: BookingCommandLane['tone'];
};

type BookingListStageKey =
  | 'intake'
  | 'first-pick'
  | 'marketplace'
  | 'customer-choice'
  | 'handoff'
  | 'handoff-repair'
  | 'closeout';

type BookingListStage = {
  key: BookingListStageKey;
  label: string;
  detail: string;
  action: string;
  tone: BookingCommandLane['tone'];
  href: string;
};

type BookingListActionChip = {
  label: string;
  detail: string;
  tone: string;
  href: string;
};

const activeStatuses = new Set(['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const currentTimeMs = nowMs ?? 0;

  const orderedBookings = useMemo(
    () =>
      [...bookings].sort((left, right) => {
        const leftPriority = bookingPriority(left);
        const rightPriority = bookingPriority(right);
        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
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
    const waitingSelection = open.filter((booking) => marketplaceParticipants(booking).length > 0);
    const preferredPending = open.filter(
      (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
    );
    const backupChosen = orderedBookings.filter((booking) => isBackupSelected(booking));
    const chatLive = orderedBookings.filter((booking) => Boolean(booking.chatRoom));
    const noShow = orderedBookings.filter((booking) => booking.status === 'NO_SHOW');
    const expired = orderedBookings.filter((booking) => booking.status === 'EXPIRED');
    const policySnapshots = orderedBookings.filter((booking) => bookingMatchingPolicySnapshot(booking));
    const paymentChecks = orderedBookings.filter((booking) => bookingPaymentNeedsOps(booking));
    const closeoutChecks = orderedBookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
    const pricingChecks = orderedBookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
    const addressChecks = orderedBookings.filter((booking) => bookingAddressNeedsOps(booking));
    const locationChecks = orderedBookings.filter((booking) =>
      bookingLocationNeedsOps(booking, currentTimeMs),
    );
    const chatRepair = orderedBookings.filter((booking) => bookingChatRepairNeedsOps(booking));
    const actionChecks = orderedBookings.filter((booking) =>
      bookingCheckFlags(booking, currentTimeMs).some((flag) => flag.severity === 'high'),
    );
    const stageCounts = bookingStageCounts(orderedBookings, currentTimeMs);
    return [
      ['Active bookings', active.length.toString()],
      ['Open matching', open.length.toString()],
      ['Matched', matched.length.toString()],
      ['Follow-up queue', actionChecks.length.toString()],
      ['Stage 1 first-pick', (stageCounts.get('first-pick') ?? 0).toString()],
      ['Stage 2 marketplace', (stageCounts.get('marketplace') ?? 0).toString()],
      ['Stage 3 customer choice', (stageCounts.get('customer-choice') ?? 0).toString()],
      ['Stage 4 handoff repair', (stageCounts.get('handoff-repair') ?? 0).toString()],
      ['No partners yet', noParticipants.length.toString()],
      ['First-pick pending', preferredPending.length.toString()],
      ['Marketplace options', waitingSelection.length.toString()],
      ['Marketplace selected', backupChosen.length.toString()],
      ['Chat live', chatLive.length.toString()],
      ['No-show', noShow.length.toString()],
      ['Expired', expired.length.toString()],
      ['Policy snapshots', policySnapshots.length.toString()],
      ['Address checks', addressChecks.length.toString()],
      ['Payment checks', paymentChecks.length.toString()],
      ['Closeout checks', closeoutChecks.length.toString()],
      ['Pricing checks', pricingChecks.length.toString()],
      ['Location checks', locationChecks.length.toString()],
      ['Chat repair', chatRepair.length.toString()],
    ];
  }, [currentTimeMs, orderedBookings]);

  const commandCenter = useMemo(
    () => buildBookingCommandCenter(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const nextActions = useMemo(
    () => buildBookingNextActions(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const customerProtectionBoard = useMemo(
    () => buildCustomerProtectionBoard(orderedBookings),
    [orderedBookings],
  );
  const matchingEscalationBoard = useMemo(
    () => buildMatchingEscalationBoard(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const matchingEscalationRows = useMemo(
    () => buildMatchingEscalationRows(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const matchingFlowTimeline = useMemo(
    () => buildMatchingFlowTimeline(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const dispatchPartnerShortcuts = useMemo(
    () => buildBookingDispatchPartnerShortcuts(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );

  const baseVisibleBookings = useMemo(() => {
    return orderedBookings.filter((booking) => bookingMatchesView(booking, view, currentTimeMs));
  }, [currentTimeMs, orderedBookings, view]);

  const visibleBookings = useMemo(() => {
    return baseVisibleBookings.filter(
      (booking) =>
        bookingMatchesSearch(booking, searchQuery) &&
        bookingMatchesStatusFilter(booking, statusFilter) &&
        bookingMatchesPaymentFilter(booking, paymentFilter),
    );
  }, [baseVisibleBookings, paymentFilter, searchQuery, statusFilter]);

  const statusFilterOptions = useMemo(
    () => uniqueSortedOptions(orderedBookings.map((booking) => booking.status)),
    [orderedBookings],
  );
  const paymentFilterOptions = useMemo(
    () => uniqueSortedOptions(orderedBookings.map((booking) => booking.payment?.method ?? 'NO_PAYMENT')),
    [orderedBookings],
  );

  const bookingViewCounts = useMemo(
    () =>
      new Map(
        bookingViewOptions.map((option) => [
          option.view,
          orderedBookings.filter((booking) => bookingMatchesView(booking, option.view, currentTimeMs)).length,
        ]),
      ),
    [currentTimeMs, orderedBookings],
  );
  const activeView = bookingViewOptions.find((item) => item.view === view) ?? bookingViewOptions[0];

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      const mountedAt = new Date();
      setHasMounted(true);
      setLastRefreshLabel(formatClockTime(mountedAt));
      setNowMs(mountedAt.getTime());
    }, 0);

    if (!autoRefresh) {
      return () => window.clearTimeout(mountTimer);
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        const refreshedAt = new Date();
        setLastRefreshLabel(formatClockTime(refreshedAt));
        setNowMs(refreshedAt.getTime());
      });
    }, 10000);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearInterval(timer);
    };
  }, [autoRefresh, router]);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Booking Monitor</h1>
          <p className="muted">
            Live operational view for matching, partner selection, chat, and payment readiness.
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
            <h2>Booking command center</h2>
            <p className="muted">
              One-glance control for dispatch pressure, customer protection, payment closeout, and handoff
              quality.
            </p>
          </div>
          <span className="pill pill-info">Operator first view</span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {commandCenter.map((lane) => (
            <Link className="card" href={lane.href} key={lane.title}>
              <p>{lane.title}</p>
              <h2>{lane.status}</h2>
              <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
              <p className="muted" style={{ marginTop: 8 }}>
                {lane.detail}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
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

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Matching escalation board</h2>
            <p className="muted">
              Direct first-pick partner flow, 10-minute response window, marketplace partner participation,
              and customer final selection in one operating board.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Change matching rules
          </Link>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {matchingEscalationBoard.map((lane) => (
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
                      {bookingMatchingWindowLabel(booking, currentTimeMs)}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{lane.operatorAction}</small>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <h3>Matching flow timeline</h3>
          <p className="muted">
            Stage view for direct partner requests, marketplace participation, customer final choice, and
            chat/location handoff.
          </p>
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            {matchingFlowTimeline.map((step) => (
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
                        {bookingMatchingWindowLabel(booking, currentTimeMs)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <small>{step.operatorAction}</small>
              </Link>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <h3>Dispatch partner repair shortcuts</h3>
          <p className="muted">
            Use these when a matching booking needs partner supply, partner acceptance repair, cash-fee
            cleanup, or policy adjustment.
          </p>
          <div className="service-trace-summary" style={{ marginTop: 12 }}>
            {dispatchPartnerShortcuts.map((item) => (
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
        <div className="participant-list" style={{ marginTop: 14 }}>
          {matchingEscalationRows.slice(0, 6).map((item) => (
            <Link className="card" href={`/bookings/${item.booking.id}`} key={`matching-${item.booking.id}`}>
              <div className="risk-watch-header">
                <div>
                  <p>
                    {shortId(item.booking.id)} / {bookingCustomerLabel(item.booking)}
                  </p>
                  <h3>{item.title}</h3>
                </div>
                <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
              </div>
              <p className="muted">{item.detail}</p>
              <p>{item.operatorAction}</p>
              <div className="participant-list">
                {item.tags.map((tag) => (
                  <span className="pill" key={`${item.booking.id}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {matchingEscalationRows.length === 0 && (
            <div className="card">
              <h3>No matching escalation right now</h3>
              <p className="muted">
                Open matching, marketplace participation, customer final selection, and chat handoff are
                clear.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Next operator actions</h2>
            <p className="muted">
              Booking checklist ordered by customer wait, finance follow-up, and operational aging.
            </p>
          </div>
          <span className={`pill ${nextActions.length > 0 ? 'pill-warn' : 'pill-success'}`}>
            {nextActions.length > 0 ? `${nextActions.length} action(s)` : 'Clear'}
          </span>
        </div>
        <div className="participant-list" style={{ marginTop: 12 }}>
          {nextActions.map((item) => (
            <Link className="card" href={item.href} key={`${item.booking.id}-${item.title}`}>
              <div className="risk-watch-header">
                <div>
                  <p>
                    {shortId(item.booking.id)} / {bookingServiceOptionLabel(item.booking)}
                  </p>
                  <h2>{item.title}</h2>
                </div>
                <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
              </div>
              <p className="muted">{item.detail}</p>
              <p>
                <strong>{item.owner}</strong> / {actionOrderLabel(item.priority)}: {item.operatorAction}
              </p>
              <p className="muted">
                {bookingCustomerLabel(item.booking)} / {bookingProviderLabel(item.booking)}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                <span className="pill">{item.booking.status}</span>
                <span className="pill">{item.owner}</span>
                <span className="pill">{actionOrderLabel(item.priority)}</span>
                <span className="pill">{bookingAgeLabel(item.booking, currentTimeMs)}</span>
                {item.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {nextActions.length === 0 && (
            <div className="card">
              <h2>Booking operations are clear</h2>
              <p className="muted">
                No expired matching, unresolved payment, stale live location, missing chat, or pricing policy
                blocker needs immediate review.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer protection closeout board</h2>
            <p className="muted">
              Focused closeout lanes for cancelled, expired, no-show, completed, and cash-fee debt bookings.
              Use this before ending a shift so customer payment and partner wallet outcomes are not left
              open.
            </p>
          </div>
          <span
            className={`pill ${
              customerProtectionBoard.some((lane) => lane.bookings.length > 0) ? 'pill-warn' : 'pill-success'
            }`}
          >
            {customerProtectionBoard.reduce((sum, lane) => sum + lane.bookings.length, 0)} open closeout
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {customerProtectionBoard.map((lane) => (
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
                      {shortId(booking.id)} / {bookingCustomerLabel(booking)} /{' '}
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

      <section className="card" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking operation filters</h2>
            <p className="muted">
              Active queue: <strong>{activeView.label}</strong> - {activeView.description}
            </p>
          </div>
          <span className={`pill ${view === 'all' ? 'pill-success' : 'pill-warn'}`}>
            Showing {visibleBookings.length} of {baseVisibleBookings.length}
          </span>
        </div>
        <div className="ops-filter-grid" style={{ marginBottom: 14 }}>
          <label>
            Search booking/customer/partner
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Booking ID, phone, partner, customer, service"
            />
          </label>
          <label>
            Booking status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All methods</option>
              {paymentFilterOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPaymentFilter('all');
              }}
            >
              Clear list filters
            </button>
          </div>
        </div>
        <div className="participant-list">
          {bookingViewOptions.map((option) => (
            <button
              key={option.view}
              type="button"
              onClick={() => setView(option.view)}
              disabled={view === option.view}
              title={option.description}
            >
              {option.label} ({bookingViewCounts.get(option.view) ?? 0})
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
              <th>Booking / stage</th>
              <th>Address / customer</th>
              <th>Customer choice</th>
              <th>Partner supply</th>
              <th>Chat / location</th>
              <th>Payment / wallet</th>
              <th>Ops check</th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => {
              const flags = bookingCheckFlags(booking, currentTimeMs);
              const checkSignal = checkLevel(flags);
              const servicePriceLabel = bookingServicePriceLabel(booking);
              const servicePayoutLabel = bookingServicePayoutRuleLabel(booking);
              const pricingPolicy = bookingPricingPolicySignal(booking);
              const matchingPolicy = bookingMatchingPolicySnapshot(booking);
              const stage = bookingListStage(booking, currentTimeMs);
              const addressState = bookingAddressSnapshotState(booking);
              const chatState = bookingChatListState(booking);
              const closureState = bookingClosureListSignal(booking);
              const actionChips = bookingListActionChips(booking, currentTimeMs);
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
                    <div className="muted">
                      Opened {formatDate(booking.createdAt ?? booking.scheduledStartAt)}
                    </div>
                    <div className="muted">{recencyLabel(booking, nowMs)}</div>
                    <div style={{ marginTop: 8 }}>
                      <Link className={`pill ${stagePillClass(stage.tone)}`} href={stage.href}>
                        {stage.label}
                      </Link>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {stage.detail}
                    </div>
                    <div className="muted">{stage.action}</div>
                    <div style={{ marginTop: 8 }}>
                      <StatusBadge status={booking.status} />
                    </div>
                    {closureState && (
                      <div className="participant-list" style={{ marginTop: 8 }}>
                        <span className={`pill ${closureState.tone}`}>{closureState.label}</span>
                        <span className="muted">{closureState.detail}</span>
                      </div>
                    )}
                    <div className="muted">
                      {booking.expiresAt ? `Expires ${formatDate(booking.expiresAt)}` : 'No expiry set'}
                    </div>
                    <div className="muted">{matchingPolicySummaryLabel(matchingPolicy)}</div>
                  </td>
                  <td>
                    <span className={`pill ${addressState.tone}`}>{addressState.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {addressState.detail}
                    </div>
                    <div className="muted">{addressState.pin}</div>
                    <div style={{ marginTop: 10 }}>
                      <strong>{booking.customerProfile?.user?.fullName ?? 'Customer'}</strong>
                    </div>
                    <div className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</div>
                  </td>
                  <td>
                    <span className={`pill ${selectionToneClass(booking)}`}>{selectionLabel(booking)}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {customerVisibleStateLabel(booking)}
                    </div>
                    <div className="muted">{selectionPathLabel(booking)}</div>
                    {booking.selectedProvider ? (
                      <div className="muted">
                        Final partner: {partnerDisplayName(booking.selectedProvider)}
                      </div>
                    ) : (
                      <div className="muted">Final partner: waiting for customer choice</div>
                    )}
                    <div className="muted">{bookingBackupAlertTraceLabel(booking, currentTimeMs)}</div>
                  </td>
                  <td>
                    <strong>{booking.participants?.length ?? 0} joined</strong>
                    <div className="muted">
                      First-pick {partnerDisplayName(booking.preferredProvider, 'none')}
                    </div>
                    <div className="muted">
                      {booking.preferredProvider?.user?.phone
                        ? `First-pick phone ${booking.preferredProvider.user.phone}`
                        : 'First-pick partner not set'}
                    </div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      <span className={`pill ${matchingPolicy ? 'pill-info' : 'pill-warn'}`}>
                        {matchingPolicy ? 'Saved policy' : 'Live policy default'}
                      </span>
                      <span className={`pill ${bookingBackupAlertTraceTone(booking)}`}>
                        {bookingBackupAlertTracePill(booking)}
                      </span>
                    </div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      {booking.preferredProvider && (
                        <span className="pill" style={{ background: '#eef6e8', borderColor: '#b9d4a8' }}>
                          First-pick: {partnerDisplayName(booking.preferredProvider)}{' '}
                          {preferredProviderStateLabel(booking)}
                        </span>
                      )}
                      {booking.selectedProvider &&
                        booking.selectedProvider.id !== booking.preferredProvider?.id && (
                          <span className="pill pill-success">
                            Final: {partnerDisplayName(booking.selectedProvider)}
                          </span>
                        )}
                      {marketplaceParticipants(booking)
                        .slice(0, 4)
                        .map((participant) => (
                          <span className="pill" key={participant.id}>
                            Marketplace: {partnerDisplayName(participant.providerProfile)} (
                            {participant.status})
                          </span>
                        ))}
                    </div>
                    {marketplaceParticipants(booking).length > 4 && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        +{marketplaceParticipants(booking).length - 4} more marketplace partner(s)
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${chatState.tone}`}>{chatState.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {chatState.detail}
                    </div>
                    <div className="muted">{bookingLocationSignalLabel(booking, currentTimeMs)}</div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      <span className={`pill ${bookingLocationToneClass(booking, currentTimeMs)}`}>
                        {bookingLocationPillLabel(booking, currentTimeMs)}
                      </span>
                    </div>
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
                      <div style={{ marginTop: 8 }}>
                        <span className="pill pill-warn">Partner wallet debt</span>
                      </div>
                    )}
                    {bookingCashDebtNeedsOps(booking) && (
                      <div className="muted" style={{ marginTop: 6 }}>
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
                    <span className={`signal ${checkSignal.tone}`}>{checkSignal.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {checkSignal.helper}
                    </div>
                    {flags.length > 0 && <div className="muted">{flags[0].title}</div>}
                    <div style={{ marginTop: 8 }}>{opsSignal(booking)}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {nextAction(booking)}
                    </div>
                    <div className="participant-list" style={{ marginTop: 10 }}>
                      <span className="muted">Action status strip</span>
                      {actionChips.map((chip) => (
                        <Link
                          className={`pill ${chip.tone}`}
                          href={chip.href}
                          key={chip.label}
                          title={chip.detail}
                        >
                          {chip.label}
                        </Link>
                      ))}
                    </div>
                    {closureState && (
                      <div className="muted" style={{ marginTop: 8 }}>
                        Closure evidence: {closureState.detail}
                      </div>
                    )}
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
      'Use this during operations to catch stalled matching, missing location, or unresolved payment follow-up.',
  },
  {
    view: 'attention',
    label: 'Follow-up queue',
    description: 'bookings with expired matching, unresolved payment, or missing chat after matching.',
    operatorHint: 'Use this as the first dispatch checklist view when the dashboard shows attention needed.',
  },
  {
    view: 'matching',
    label: 'Matching ops',
    description:
      'direct first-pick, marketplace participant, final customer selection, and chat handoff work.',
    operatorHint:
      'Use this during live dispatch to manage the 10-minute partner response window and marketplace participant escalation.',
  },
  {
    view: 'first-pick',
    label: 'Stage 1 first-pick',
    description: 'open bookings where the selected partner still has the first response window.',
    operatorHint:
      'Use this to monitor the 10-minute response window, push delivery, KYC, wallet gate, and partner decision timing.',
  },
  {
    view: 'marketplace',
    label: 'Stage 2 marketplace',
    description: 'open bookings where marketplace partners can join or need a dispatch nudge.',
    operatorHint:
      'Use this to manage the marketplace participant pool, stale location checks, and availability alert delivery.',
  },
  {
    view: 'customer-choice',
    label: 'Stage 3 choice',
    description: 'open bookings with accepted partners waiting for customer final selection.',
    operatorHint:
      'Use this when customer support should guide the customer to choose one final partner before chat unlocks.',
  },
  {
    view: 'handoff-repair',
    label: 'Stage 4 repair',
    description: 'matched bookings whose final partner is selected but chat handoff is missing.',
    operatorHint:
      'Use this as a dispatch repair queue. Chat must be fixed before arrival, start, and completion flow.',
  },
  {
    view: 'no-supply',
    label: 'No supply',
    description: 'open matching bookings with no partner participation yet.',
    operatorHint:
      'Use this when customers are waiting but no partner has joined. Call/notify nearby partners or review location/service pricing.',
  },
  {
    view: 'address',
    label: 'Address check',
    description: 'bookings missing the immutable customer service address snapshot.',
    operatorHint:
      'Use this before dispatch. A confirmed address snapshot protects customer, partner, and admin records.',
  },
  {
    view: 'payment',
    label: 'Payment ops',
    description: 'bookings whose payment state can block closeout, refund, capture, or settlement.',
    operatorHint:
      'Use this to catch completed authorized payments, cancelled unresolved holds, cash pending, and missing refs.',
  },
  {
    view: 'cash-debt',
    label: 'Cash debt',
    description: 'cash bookings that created partner fee/tax debt and can gate final acceptance.',
    operatorHint:
      'Use this with Cash Settlements to confirm deposit or admin offset before the partner accepts more bookings.',
  },
  {
    view: 'closeout',
    label: 'Closeout ops',
    description: 'completed bookings missing capture, earning, tax, platform fee, or wallet ledger records.',
    operatorHint:
      'Use this after service completion to reconcile payment capture, partner earning, tax logs, and wallet ledger entries.',
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
    description: 'on-the-way or in-service bookings with missing or stale partner location signals.',
    operatorHint:
      'Use this only for live service states. The MVP tracks last-known location, not live route streaming.',
  },
  {
    view: 'chat',
    label: 'Chat live',
    description: 'bookings where customer/partner communication is already available.',
    operatorHint:
      'Use this to inspect service handoff quality, quiet chats, and route/location expectations.',
  },
  {
    view: 'chat-repair',
    label: 'Chat repair',
    description: 'matched or active bookings whose chat room is missing.',
    operatorHint:
      'Use this when a matched customer and partner cannot coordinate. Repair chat before arrival, service start, or completion.',
  },
  {
    view: 'expired',
    label: 'Expired',
    description: 'bookings closed by timeout and waiting for payment release or customer follow-up review.',
    operatorHint:
      'Use this after manual or automatic expiry to confirm payment release, refund decision, and customer communication.',
  },
  {
    view: 'no-show',
    label: 'No-show',
    description: 'bookings closed as no-show but still needing payment, customer, or partner review.',
    operatorHint:
      'Use this after marking no-show to confirm payment outcome, partner debt, and customer communication.',
  },
  {
    view: 'all',
    label: 'All bookings',
    description: 'full booking history for investigation, finance follow-up, and audit review.',
    operatorHint: 'Use this when you need cancelled, completed, refunded, or old matching records.',
  },
];

function buildBookingCommandCenter(bookings: AdminBooking[], nowMs: number): BookingCommandLane[] {
  const active = bookings.filter((booking) => activeStatuses.has(booking.status));
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const noSupply = open.filter((booking) => (booking.participants?.length ?? 0) === 0);
  const preferredPending = open.filter(
    (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
  );
  const expiredMatching = open.filter(
    (booking) => booking.expiresAt && new Date(booking.expiresAt).getTime() < nowMs,
  );
  const matchedWithoutChat = bookings.filter((booking) => bookingChatRepairNeedsOps(booking));
  const paymentChecks = bookings.filter((booking) => bookingPaymentNeedsOps(booking));
  const noShow = bookings.filter((booking) => booking.status === 'NO_SHOW');
  const closeoutChecks = bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
  const pricingChecks = bookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));
  const locationChecks = bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs));
  const backupSelected = bookings.filter((booking) => isBackupSelected(booking));
  const quietChat = bookings.filter(
    (booking) =>
      booking.chatRoom &&
      (booking.chatRoom.messages?.length ?? 0) === 0 &&
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );

  return [
    {
      title: 'Dispatch pressure',
      status: noSupply.length > 0 || expiredMatching.length > 0 ? 'Action needed' : 'Stable',
      tone: expiredMatching.length > 0 ? 'danger' : noSupply.length > 0 ? 'warn' : 'ok',
      detail:
        noSupply.length > 0
          ? 'Open matching has customer demand without partner supply.'
          : 'Active booking demand has enough current operating signal.',
      href:
        noSupply.length > 0 || expiredMatching.length > 0
          ? noSupply.length > 0
            ? '/bookings?view=no-supply'
            : '/bookings?view=attention'
          : '/bookings?view=active',
      metrics: [
        metric('active', active.length),
        metric('open', open.length),
        metric('no supply', noSupply.length),
        metric('preferred pending', preferredPending.length),
      ],
    },
    {
      title: 'Customer protection',
      status: expiredMatching.length > 0 || matchedWithoutChat.length > 0 ? 'Protect now' : 'Clear',
      tone:
        expiredMatching.length > 0 || matchedWithoutChat.length > 0
          ? 'danger'
          : locationChecks.length > 0
            ? 'warn'
            : 'ok',
      detail:
        expiredMatching.length > 0
          ? 'Matching window expired before a final partner was selected.'
          : 'Customer-facing booking handoff has no critical blocker.',
      href:
        expiredMatching.length > 0 || matchedWithoutChat.length > 0
          ? '/bookings?view=attention'
          : '/bookings?view=location',
      metrics: [
        metric('expired', expiredMatching.length),
        metric('no chat', matchedWithoutChat.length),
        metric('location checks', locationChecks.length),
        metric('quiet chat', quietChat.length),
      ],
    },
    {
      title: 'Payment closeout',
      status:
        paymentChecks.length > 0 || closeoutChecks.length > 0 || noShow.length > 0 || pricingChecks.length > 0
          ? 'Review'
          : 'Ready',
      tone:
        closeoutChecks.length > 0
          ? 'danger'
          : paymentChecks.length > 0
            ? 'danger'
            : noShow.length > 0
              ? 'warn'
              : pricingChecks.length > 0
                ? 'warn'
                : 'ok',
      detail:
        closeoutChecks.length > 0
          ? 'Completed bookings are missing earning, tax, platform fee, or wallet closeout records.'
          : paymentChecks.length > 0
            ? 'Some bookings need capture, release, refund, cash debt, or missing reference review.'
            : noShow.length > 0
              ? 'No-show bookings need a clear payment and customer communication outcome.'
              : 'Payment and service pricing policy signals are aligned.',
      href:
        closeoutChecks.length > 0
          ? '/bookings?view=closeout'
          : paymentChecks.length > 0
            ? cashDebt.length > 0
              ? '/bookings?view=cash-debt'
              : '/bookings?view=payment'
            : noShow.length > 0
              ? '/bookings?view=no-show'
              : '/bookings?view=pricing',
      metrics: [
        metric('payment', paymentChecks.length),
        metric('closeout', closeoutChecks.length),
        metric('no-show', noShow.length),
        metric('pricing', pricingChecks.length),
        metric('cash debt', cashDebt.length),
        metric(
          'missing refs',
          bookings.filter(
            (booking) => booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef,
          ).length,
        ),
      ],
    },
    {
      title: 'Handoff quality',
      status: locationChecks.length > 0 || quietChat.length > 0 ? 'Monitor' : 'Clear',
      tone: locationChecks.length > 0 ? 'warn' : quietChat.length > 0 ? 'info' : 'ok',
      detail:
        locationChecks.length > 0
          ? 'Live service state has missing or stale last-known partner location.'
          : 'Chat, marketplace selection, and location handoff look normal.',
      href: locationChecks.length > 0 ? '/bookings?view=location' : '/bookings?view=chat',
      metrics: [
        metric('location', locationChecks.length),
        metric('marketplace chosen', backupSelected.length),
        metric('chat live', bookings.filter((booking) => Boolean(booking.chatRoom)).length),
        metric('quiet chat', quietChat.length),
      ],
    },
  ];
}

function buildBookingNextActions(bookings: AdminBooking[], nowMs: number): BookingNextAction[] {
  return bookings
    .map<BookingNextAction | null>((booking) => {
      const flags = bookingCheckFlags(booking, nowMs);
      const highestFlag = flags.sort((left, right) => checkFlagWeight(right) - checkFlagWeight(left))[0];

      if (highestFlag) {
        return {
          booking,
          title: highestFlag.title,
          detail: nextAction(booking),
          operatorAction: bookingOperatorAction(booking, nowMs, highestFlag),
          owner: bookingActionOwner(booking, highestFlag),
          priority: bookingActionPriority(booking, nowMs, highestFlag),
          tone:
            highestFlag.severity === 'high' ? 'danger' : highestFlag.severity === 'medium' ? 'warn' : 'info',
          href: `/bookings/${booking.id}`,
          tags: [
            booking.payment?.method ? `payment ${booking.payment.method}` : 'payment missing',
            booking.chatRoom ? 'chat ready' : 'chat pending',
            selectionLabel(booking),
          ],
        } satisfies BookingNextAction;
      }

      if (activeStatuses.has(booking.status)) {
        return {
          booking,
          title: 'Monitor active booking',
          detail: nextAction(booking),
          operatorAction: bookingOperatorAction(booking, nowMs),
          owner: bookingActionOwner(booking),
          priority: bookingActionPriority(booking, nowMs),
          tone: 'info',
          href: `/bookings/${booking.id}`,
          tags: [
            booking.payment?.status ? `payment ${booking.payment.status}` : 'payment pending',
            bookingLocationPillLabel(booking, nowMs),
          ],
        } satisfies BookingNextAction;
      }

      return null;
    })
    .filter((item): item is BookingNextAction => Boolean(item))
    .sort((left, right) => {
      const toneDelta = commandToneWeight(right.tone) - commandToneWeight(left.tone);
      if (toneDelta !== 0) {
        return toneDelta;
      }
      return bookingTimestamp(right.booking) - bookingTimestamp(left.booking);
    })
    .slice(0, 5);
}

function buildCustomerProtectionBoard(bookings: AdminBooking[]): BookingProtectionLane[] {
  const cancelledUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'CANCELLED' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const expiredUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'EXPIRED' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const noShowUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'NO_SHOW' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const completedCloseout = bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));

  return [
    {
      title: 'Cancelled payment release',
      status: cancelledUnresolved.length ? 'Release/refund' : 'Clear',
      tone: cancelledUnresolved.length ? 'danger' : 'ok',
      detail:
        cancelledUnresolved.length > 0
          ? 'Customer cancelled, but the linked payment is not released or refunded yet.'
          : 'Cancelled bookings have no unresolved payment hold in the current snapshot.',
      operatorAction: 'Open payment queue and close customer money movement before support follow-up.',
      href: '/bookings?view=payment',
      bookings: cancelledUnresolved,
    },
    {
      title: 'Expired matching closeout',
      status: expiredUnresolved.length ? 'Timeout review' : 'Clear',
      tone: expiredUnresolved.length ? 'danger' : 'ok',
      detail:
        expiredUnresolved.length > 0
          ? 'Matching expired before final partner selection, but payment still needs an outcome.'
          : 'Expired bookings have payment release/refund state aligned.',
      operatorAction: 'Release the hold, confirm customer notification, and check retry/alert history.',
      href: '/bookings?view=expired',
      bookings: expiredUnresolved,
    },
    {
      title: 'No-show outcome',
      status: noShowUnresolved.length ? 'Evidence needed' : 'Clear',
      tone: noShowUnresolved.length ? 'warn' : 'ok',
      detail:
        noShowUnresolved.length > 0
          ? 'No-show bookings still need a payment, fee, or customer support decision.'
          : 'No-show bookings have no unresolved payment in the current snapshot.',
      operatorAction: 'Review chat, arrival/location proof, customer response, then decide payment handling.',
      href: '/bookings?view=no-show',
      bookings: noShowUnresolved,
    },
    {
      title: 'Completed service reconciliation',
      status: completedCloseout.length ? 'Closeout missing' : 'Clear',
      tone: completedCloseout.length ? 'danger' : 'ok',
      detail:
        completedCloseout.length > 0
          ? 'Completed bookings are missing capture, earning, tax, platform fee, or wallet ledger records.'
          : 'Completed bookings are reconciled against payment and ledger requirements.',
      operatorAction: 'Run or inspect closeout before payout, tax, and review workflows continue.',
      href: '/bookings?view=closeout',
      bookings: completedCloseout,
    },
    {
      title: 'Cash fee debt',
      status: cashDebt.length ? 'Partner blocked' : 'Clear',
      tone: cashDebt.length ? 'danger' : 'ok',
      detail:
        cashDebt.length > 0
          ? 'Cash bookings created negative wallet balances that require settlement before final acceptance or customer final selection.'
          : 'No cash booking currently creates an unpaid HANDS fee debt blocker.',
      operatorAction: 'Collect partner fee deposit or settle from available earnings before new acceptance.',
      href: '/bookings?view=cash-debt',
      bookings: cashDebt,
    },
  ];
}

function buildMatchingEscalationBoard(
  bookings: AdminBooking[],
  nowMs: number,
): BookingMatchingEscalationLane[] {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const expiredWindow = open.filter((booking) => bookingMatchingWindowExpired(booking, nowMs));
  const firstPickWaiting = open.filter(
    (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
  );
  const noMarketplaceSupply = open.filter((booking) => marketplaceParticipants(booking).length === 0);
  const marketplaceReady = open.filter((booking) => marketplaceParticipants(booking).length > 0);
  const customerFinalSelection = open.filter((booking) => bookingHasAcceptedPartner(booking));
  const matchedWithoutChat = bookings.filter((booking) => booking.status === 'MATCHED' && !booking.chatRoom);
  const chatReady = bookings.filter((booking) => Boolean(booking.chatRoom));

  return [
    {
      title: 'First-pick response window',
      status: expiredWindow.length > 0 ? 'Expired window' : firstPickWaiting.length ? 'Waiting' : 'Clear',
      tone: expiredWindow.length > 0 ? 'danger' : firstPickWaiting.length ? 'warn' : 'ok',
      detail:
        firstPickWaiting.length > 0
          ? 'Preferred partners have the first chance before the customer reviews marketplace supply.'
          : 'No preferred partner is currently blocking a direct request.',
      operatorAction:
        'If the timer is near expiry, prepare marketplace participant reminders and keep the customer waiting screen honest.',
      href: expiredWindow.length > 0 ? '/bookings?view=attention' : '/bookings?view=matching',
      bookings: firstPickWaiting,
      metrics: [metric('waiting', firstPickWaiting.length), metric('expired', expiredWindow.length)],
    },
    {
      title: 'Marketplace participant supply',
      status: noMarketplaceSupply.length > 0 ? 'Needs supply' : marketplaceReady.length ? 'Ready' : 'Clear',
      tone: noMarketplaceSupply.length > 0 ? 'warn' : marketplaceReady.length ? 'info' : 'ok',
      detail:
        noMarketplaceSupply.length > 0
          ? 'Some open requests have no marketplace participant visible to the customer yet.'
          : 'Marketplace participants are already visible for open requests that need options.',
      operatorAction:
        'Check partner availability, location freshness, push delivery, wallet debt, and online state before extending wait time.',
      href: noMarketplaceSupply.length > 0 ? '/bookings?view=no-supply' : '/bookings?view=matching',
      bookings: noMarketplaceSupply.length > 0 ? noMarketplaceSupply : marketplaceReady,
      metrics: [
        metric('no marketplace', noMarketplaceSupply.length),
        metric('marketplace ready', marketplaceReady.length),
      ],
    },
    {
      title: 'Customer final selection',
      status: customerFinalSelection.length > 0 ? 'Customer decision' : 'Clear',
      tone: customerFinalSelection.length > 0 ? 'warn' : 'ok',
      detail:
        customerFinalSelection.length > 0
          ? 'At least one partner accepted or joined; the customer still needs to lock the final partner.'
          : 'No open request is waiting on customer final selection.',
      operatorAction:
        'Guide support to nudge the customer when accepted partners are waiting and the booking is still open.',
      href: '/bookings?view=matching',
      bookings: customerFinalSelection,
      metrics: [
        metric('accepted options', customerFinalSelection.length),
        metric('marketplace options', marketplaceReady.length),
      ],
    },
    {
      title: 'Chat handoff after match',
      status: matchedWithoutChat.length > 0 ? 'Repair chat' : chatReady.length ? 'Chat live' : 'Clear',
      tone: matchedWithoutChat.length > 0 ? 'danger' : chatReady.length ? 'info' : 'ok',
      detail:
        matchedWithoutChat.length > 0
          ? 'A final partner is selected, but chat is missing and service coordination can stall.'
          : 'Matched bookings have chat or no active handoff blocker is visible.',
      operatorAction:
        'Repair chat room creation before the partner moves to service start, arrival, or payment closeout.',
      href: matchedWithoutChat.length > 0 ? '/bookings?view=attention' : '/bookings?view=chat',
      bookings: matchedWithoutChat,
      metrics: [metric('missing chat', matchedWithoutChat.length), metric('chat ready', chatReady.length)],
    },
  ];
}

function buildBookingDispatchPartnerShortcuts(
  bookings: AdminBooking[],
  nowMs: number,
): BookingDispatchPartnerShortcut[] {
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const noPartnerSupply = openMatching.filter((booking) => (booking.participants?.length ?? 0) === 0);
  const firstPickWaiting = openMatching.filter(
    (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
  );
  const customerSelection = openMatching.filter((booking) => bookingHasAcceptedPartner(booking));
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));
  const locationChecks = bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs));

  return [
    {
      title: 'Partner handoff',
      value: 'Open',
      detail: 'Full partner command view with direct, marketplace, KYC, wallet, location, and alert lanes.',
      href: '/partners',
      tone: openMatching.length ? 'info' : 'ok',
    },
    {
      title: 'Direct-ready partners',
      value: firstPickWaiting.length.toString(),
      detail: 'Use when preferred partners must answer inside the response window.',
      href: '/partners?review=direct-ready',
      tone: firstPickWaiting.length ? 'warn' : 'ok',
    },
    {
      title: 'Marketplace-ready',
      value: noPartnerSupply.length.toString(),
      detail: 'Use when open matching has no marketplace supply or customer options.',
      href: '/partners?review=marketplace-ready',
      tone: noPartnerSupply.length ? 'warn' : 'ok',
    },
    {
      title: 'Acceptance blockers',
      value: customerSelection.length.toString(),
      detail: 'Repair KYC, bank, wallet, location, push, or control gates before dispatch pressure rises.',
      href: '/partners?review=acceptance-blocked',
      tone: customerSelection.length ? 'info' : 'ok',
    },
    {
      title: 'Cash fee debt',
      value: cashDebt.length.toString(),
      detail: 'Cash bookings can create negative partner wallets that gate final acceptance.',
      href: '/cash-settlements',
      tone: cashDebt.length ? 'danger' : 'ok',
    },
    {
      title: 'Location refresh',
      value: locationChecks.length.toString(),
      detail: 'Live booking location checks should send operators to partner location freshness review.',
      href: '/partners?review=location',
      tone: locationChecks.length ? 'warn' : 'ok',
    },
    {
      title: 'Policy controls',
      value: 'Edit',
      detail: 'Tune response window, marketplace radius, invitation limits, and stale location rules.',
      href: '/operations-policy',
      tone: 'info',
    },
  ];
}

function buildMatchingFlowTimeline(bookings: AdminBooking[], nowMs: number): BookingMatchingFlowStep[] {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const firstPickWaiting = open.filter(
    (booking) => booking.preferredProvider && isPreferredAwaitingDecision(booking),
  );
  const firstPickExpired = firstPickWaiting.filter((booking) => bookingMatchingWindowExpired(booking, nowMs));
  const noSupply = open.filter((booking) => marketplaceParticipants(booking).length === 0);
  const marketplaceVisible = open.filter((booking) => marketplaceParticipants(booking).length > 0);
  const backupAlerted = open.filter((booking) => bookingBackupAlertTraceSummary(booking).totalNotified > 0);
  const customerChoice = open.filter((booking) => bookingHasAcceptedPartner(booking));
  const matched = bookings.filter((booking) => booking.status === 'MATCHED');
  const matchedWithoutChat = matched.filter((booking) => !booking.chatRoom);
  const liveHandoff = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const locationChecks = liveHandoff.filter((booking) => bookingLocationNeedsOps(booking, nowMs));

  return [
    {
      stage: 'Stage 1',
      title: 'Direct first-pick request',
      status: firstPickExpired.length ? 'Timer expired' : firstPickWaiting.length ? 'Waiting' : 'Clear',
      tone: firstPickExpired.length ? 'danger' : firstPickWaiting.length ? 'warn' : 'ok',
      detail:
        firstPickWaiting.length > 0
          ? 'Customer selected a preferred partner and the first response window is running.'
          : 'No direct first-pick request is currently waiting.',
      operatorAction:
        'Monitor the 10-minute response window, partner push delivery, and wallet/KYC gates before manually intervening.',
      href: firstPickExpired.length ? '/bookings?view=attention' : '/bookings?view=matching',
      metrics: [metric('waiting', firstPickWaiting.length), metric('expired', firstPickExpired.length)],
      bookings: firstPickExpired.length ? firstPickExpired : firstPickWaiting,
    },
    {
      stage: 'Stage 2',
      title: 'Marketplace participation',
      status: noSupply.length ? 'Supply gap' : marketplaceVisible.length ? 'Marketplace visible' : 'Clear',
      tone: noSupply.length ? 'warn' : marketplaceVisible.length ? 'info' : 'ok',
      detail:
        noSupply.length > 0
          ? 'Some open bookings have no marketplace partner for the customer to choose.'
          : 'Marketplace partners are visible or no participation lane is currently needed.',
      operatorAction:
        'Use marketplace-ready partners, location freshness, alert delivery, and operating policy before widening rules.',
      href: noSupply.length ? '/partners?review=marketplace-ready' : '/bookings?view=matching',
      metrics: [
        metric('no marketplace', noSupply.length),
        metric('visible', marketplaceVisible.length),
        metric('alerted', backupAlerted.length),
      ],
      bookings: noSupply.length ? noSupply : marketplaceVisible,
    },
    {
      stage: 'Stage 3',
      title: 'Customer final partner choice',
      status: customerChoice.length ? 'Needs customer' : 'Clear',
      tone: customerChoice.length ? 'warn' : 'ok',
      detail:
        customerChoice.length > 0
          ? 'One or more partners are ready, but the customer has not locked the final partner.'
          : 'No open booking is waiting on customer final selection.',
      operatorAction:
        'Prompt support to guide the customer while partner availability and wait anxiety are still fresh.',
      href: '/bookings?view=matching',
      metrics: [metric('choice needed', customerChoice.length), metric('matched', matched.length)],
      bookings: customerChoice,
    },
    {
      stage: 'Stage 4',
      title: 'Chat and location handoff',
      status: matchedWithoutChat.length ? 'Repair chat' : locationChecks.length ? 'Location check' : 'Ready',
      tone: matchedWithoutChat.length
        ? 'danger'
        : locationChecks.length
          ? 'warn'
          : liveHandoff.length
            ? 'info'
            : 'ok',
      detail:
        matchedWithoutChat.length > 0
          ? 'A final partner is selected, but the chat room is missing.'
          : locationChecks.length > 0
            ? 'A live booking has stale or missing partner location.'
            : 'Matched and live bookings have no visible chat/location handoff blocker.',
      operatorAction:
        'Repair chat first, then confirm partner location before arrival, service start, and payment closeout.',
      href: matchedWithoutChat.length ? '/bookings?view=attention' : '/bookings?view=location',
      metrics: [
        metric('chat repair', matchedWithoutChat.length),
        metric('location checks', locationChecks.length),
        metric('live handoff', liveHandoff.length),
      ],
      bookings: matchedWithoutChat.length ? matchedWithoutChat : locationChecks,
    },
  ];
}

function bookingStageCounts(bookings: AdminBooking[], nowMs: number) {
  return bookings.reduce((counts, booking) => {
    const stage = bookingListStage(booking, nowMs).key;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
    return counts;
  }, new Map<BookingListStageKey, number>());
}

function bookingClosureListSignal(booking: AdminBooking) {
  if (booking.closedAt) {
    const actor = booking.closedByRole ? booking.closedByRole.toLowerCase() : 'actor missing';
    const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'reason not saved';
    const note = booking.closedNote ? ` / ${booking.closedNote}` : '';

    return {
      label: `Closed ${formatDate(booking.closedAt)}`,
      detail: `${actor} closure / ${reason}${note}`,
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-info',
    };
  }

  if (terminalBookingStatuses.has(booking.status)) {
    return {
      label: 'Terminal',
      detail: 'Terminal booking has no explicit closure actor/reason saved yet.',
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-warn',
    };
  }

  return null;
}

function humanizeClosureReason(reason: string) {
  return reason
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function bookingListStage(booking: AdminBooking, nowMs: number): BookingListStage {
  const marketplaceCount = marketplaceParticipants(booking).length;
  const acceptedCount = acceptedParticipants(booking).length;

  if (terminalBookingStatuses.has(booking.status)) {
    return {
      key: 'closeout',
      label: 'Closeout',
      detail: `Closed as ${booking.status}.`,
      action: 'Confirm payment, refund, review, no-show, and audit trail before archiving.',
      tone: booking.status === 'COMPLETED' ? 'ok' : 'warn',
      href: `/bookings/${booking.id}`,
    };
  }

  if (
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
    !booking.chatRoom
  ) {
    return {
      key: 'handoff-repair',
      label: 'Stage 4 repair',
      detail: 'Final partner exists, but chat is not ready.',
      action: 'Repair chat before the partner moves further through the service flow.',
      tone: 'danger',
      href: `/bookings/${booking.id}#chat`,
    };
  }

  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    return {
      key: 'handoff',
      label: 'Stage 4 handoff',
      detail: bookingLocationNeedsOps(booking, nowMs)
        ? 'Chat is ready, but partner location needs review.'
        : 'Chat and service handoff are available.',
      action: 'Track location, arrival, service start, completion, and closeout.',
      tone: bookingLocationNeedsOps(booking, nowMs) ? 'warn' : 'ok',
      href: `/bookings/${booking.id}#chat`,
    };
  }

  if (booking.status === 'OPEN_MATCHING' && acceptedCount > 0 && !booking.selectedProvider) {
    return {
      key: 'customer-choice',
      label: 'Stage 3 choice',
      detail: `${acceptedCount} accepted partner(s) are waiting for customer selection.`,
      action: 'Prompt customer support to help the customer choose the final partner.',
      tone: 'warn',
      href: `/bookings/${booking.id}#participants`,
    };
  }

  if (booking.status === 'OPEN_MATCHING' && marketplaceCount > 0) {
    return {
      key: 'marketplace',
      label: 'Stage 2 marketplace',
      detail: `${marketplaceCount} marketplace partner(s) are visible while matching stays open.`,
      action:
        bookingBackupAlertTraceSummary(booking).totalNotified > 0
          ? 'Monitor marketplace alert delivery and customer shortlist quality.'
          : 'Nudge eligible partners or check marketplace alert creation.',
      tone: 'info',
      href: `/bookings/${booking.id}#participants`,
    };
  }

  if (booking.status === 'OPEN_MATCHING') {
    const expired = bookingMatchingWindowExpired(booking, nowMs);
    return {
      key: 'first-pick',
      label: 'Stage 1 first-pick',
      detail: expired
        ? 'The first response window is overdue and no usable marketplace partner is visible.'
        : 'Preferred partner is inside the first response window.',
      action: expired
        ? 'Escalate marketplace supply or close/extend the request intentionally.'
        : 'Monitor partner response, wallet gate, push delivery, and KYC status.',
      tone: expired ? 'danger' : 'warn',
      href: `/bookings/${booking.id}#participants`,
    };
  }

  return {
    key: 'intake',
    label: 'Stage 0 intake',
    detail: `Booking is ${booking.status.toLowerCase().replaceAll('_', ' ')}.`,
    action: 'Confirm service, customer location, payment state, and first partner before opening matching.',
    tone: 'info',
    href: `/bookings/${booking.id}`,
  };
}

function stagePillClass(tone: BookingCommandLane['tone']) {
  if (tone === 'danger') {
    return 'pill-danger';
  }
  if (tone === 'warn') {
    return 'pill-warn';
  }
  if (tone === 'ok') {
    return 'pill-success';
  }
  return 'pill-info';
}

function buildMatchingEscalationRows(
  bookings: AdminBooking[],
  nowMs: number,
): BookingMatchingEscalationRow[] {
  return bookings
    .map<BookingMatchingEscalationRow | null>((booking) => {
      if (!bookingMatchingEscalationNeedsOps(booking, nowMs)) {
        return null;
      }

      const marketplaceCount = marketplaceParticipants(booking).length;
      const acceptedCount = acceptedParticipants(booking).length;
      const windowLabel = bookingMatchingWindowLabel(booking, nowMs);
      const baseTags = [
        booking.status,
        windowLabel,
        `${marketplaceCount} marketplace`,
        `${acceptedCount} accepted`,
      ];

      if (booking.status === 'OPEN_MATCHING' && bookingMatchingWindowExpired(booking, nowMs)) {
        return {
          booking,
          title: 'Response window expired',
          detail: 'The booking is still open after its saved response window.',
          operatorAction:
            'Close or extend matching intentionally, then release payment if no final partner can be selected.',
          tone: 'danger',
          tags: baseTags,
        };
      }

      if (booking.status === 'OPEN_MATCHING' && acceptedCount > 0) {
        return {
          booking,
          title: 'Customer final partner selection needed',
          detail: 'One or more partners are ready, but the booking has not moved to final match.',
          operatorAction:
            'Ask support to prompt the customer to choose a final partner from the waiting list.',
          tone: 'warn',
          tags: [...baseTags, selectionPathLabel(booking)],
        };
      }

      if (
        booking.status === 'OPEN_MATCHING' &&
        booking.preferredProvider &&
        isPreferredAwaitingDecision(booking) &&
        marketplaceCount === 0
      ) {
        return {
          booking,
          title: 'First-pick pending with no marketplace option',
          detail: 'The preferred partner is still deciding and no marketplace partner has joined.',
          operatorAction:
            'Check push delivery and eligible partners within the configured radius before the customer loses patience.',
          tone: 'warn',
          tags: [...baseTags, 'customer waiting'],
        };
      }

      if (
        booking.status === 'OPEN_MATCHING' &&
        booking.preferredProvider &&
        isPreferredAwaitingDecision(booking) &&
        marketplaceCount > 0
      ) {
        return {
          booking,
          title: 'First-pick pending with marketplace ready',
          detail: 'Marketplace partners are visible while the preferred partner still has first chance.',
          operatorAction:
            'Let the timer run or guide the customer to select a marketplace partner when wait time is becoming visible.',
          tone: 'info',
          tags: [...baseTags, selectionPathLabel(booking)],
        };
      }

      if (booking.status === 'OPEN_MATCHING' && marketplaceCount === 0) {
        return {
          booking,
          title: 'Open request has no partner supply',
          detail: 'No partner has joined the request yet.',
          operatorAction: 'Review location, service price, radius policy, and partner alert delivery.',
          tone: 'warn',
          tags: baseTags,
        };
      }

      if (booking.status === 'MATCHED' && !booking.chatRoom) {
        return {
          booking,
          title: 'Matched booking missing chat',
          detail: 'The final partner is selected, but customer and partner cannot coordinate in chat.',
          operatorAction: 'Repair chat room creation before allowing service progress.',
          tone: 'danger',
          tags: [booking.status, selectionLabel(booking), 'chat missing'],
        };
      }

      return null;
    })
    .filter((item): item is BookingMatchingEscalationRow => Boolean(item))
    .sort((left, right) => {
      const toneDelta = commandToneWeight(right.tone) - commandToneWeight(left.tone);
      if (toneDelta !== 0) {
        return toneDelta;
      }
      return bookingTimestamp(right.booking) - bookingTimestamp(left.booking);
    });
}

function metric(label: string, value: number) {
  return { label, value: value.toString() };
}

function bookingMatchesView(booking: AdminBooking, view: BookingView, nowMs: number) {
  if (view === 'attention') {
    return bookingCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high');
  }
  if (view === 'matching') {
    return bookingMatchingEscalationNeedsOps(booking, nowMs);
  }
  if (view === 'first-pick') {
    return bookingListStage(booking, nowMs).key === 'first-pick';
  }
  if (view === 'marketplace') {
    return bookingListStage(booking, nowMs).key === 'marketplace';
  }
  if (view === 'customer-choice') {
    return bookingListStage(booking, nowMs).key === 'customer-choice';
  }
  if (view === 'handoff-repair') {
    return bookingListStage(booking, nowMs).key === 'handoff-repair';
  }
  if (view === 'no-supply') {
    return booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0;
  }
  if (view === 'address') {
    return bookingAddressNeedsOps(booking);
  }
  if (view === 'payment') {
    return bookingPaymentNeedsOps(booking);
  }
  if (view === 'cash-debt') {
    return bookingCashDebtNeedsOps(booking);
  }
  if (view === 'closeout') {
    return bookingCompletedCloseoutNeedsOps(booking);
  }
  if (view === 'pricing') {
    return bookingPricingPolicyNeedsOps(booking);
  }
  if (view === 'location') {
    return bookingLocationNeedsOps(booking, nowMs);
  }
  if (view === 'chat') {
    return Boolean(booking.chatRoom);
  }
  if (view === 'chat-repair') {
    return bookingChatRepairNeedsOps(booking);
  }
  if (view === 'expired') {
    return booking.status === 'EXPIRED';
  }
  if (view === 'no-show') {
    return booking.status === 'NO_SHOW';
  }
  if (view === 'all') {
    return true;
  }
  return activeStatuses.has(booking.status);
}

function bookingMatchesSearch(booking: AdminBooking, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return bookingSearchHaystack(booking).includes(normalized);
}

function bookingMatchesStatusFilter(booking: AdminBooking, statusFilter: string) {
  return statusFilter === 'all' || booking.status === statusFilter;
}

function bookingMatchesPaymentFilter(booking: AdminBooking, paymentFilter: string) {
  return paymentFilter === 'all' || (booking.payment?.method ?? 'NO_PAYMENT') === paymentFilter;
}

function bookingSearchHaystack(booking: AdminBooking) {
  return [
    booking.id,
    booking.status,
    bookingServiceOptionLabel(booking),
    booking.customerProfile?.user?.fullName,
    booking.customerProfile?.user?.phone,
    booking.preferredProvider?.displayName,
    booking.preferredProvider?.user?.fullName,
    booking.preferredProvider?.user?.phone,
    booking.selectedProvider?.displayName,
    booking.selectedProvider?.user?.fullName,
    booking.selectedProvider?.user?.phone,
    booking.payment?.method,
    booking.payment?.status,
    booking.payment?.providerRef,
    ...(booking.participants ?? []).flatMap((participant) => [
      participant.providerProfile?.displayName,
      participant.providerProfile?.user?.fullName,
      participant.providerProfile?.user?.phone,
      participant.status,
    ]),
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

function uniqueSortedOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function commandToneClass(tone: BookingCommandLane['tone']) {
  if (tone === 'danger') {
    return 'signal-warn';
  }
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function bookingDashboardTone(tone: BookingCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}

function actionOrderLabel(priority: BookingNextAction['priority']) {
  if (priority === 'P0') return 'Same-shift';
  if (priority === 'P1') return 'Active watch';
  if (priority === 'P2') return 'Follow-up';
  return 'Routine';
}

function commandToneLabel(tone: BookingCommandLane['tone']) {
  if (tone === 'danger') {
    return 'Immediate check';
  }
  if (tone === 'warn') {
    return 'Monitor';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}

function commandToneWeight(tone: BookingCommandLane['tone']) {
  if (tone === 'danger') {
    return 4;
  }
  if (tone === 'warn') {
    return 3;
  }
  if (tone === 'info') {
    return 2;
  }
  return 1;
}

function checkFlagWeight(flag: BookingCheckFlag) {
  if (flag.severity === 'high') {
    return 3;
  }
  if (flag.severity === 'medium') {
    return 2;
  }
  return 1;
}

function bookingActionPriority(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingCheckFlag,
): BookingNextAction['priority'] {
  if (flag?.severity === 'high') {
    return 'P0';
  }
  if (
    booking.status === 'NO_SHOW' ||
    booking.status === 'EXPIRED' ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  ) {
    return 'P0';
  }
  if (
    flag?.severity === 'medium' ||
    booking.status === 'MATCHED' ||
    booking.status === 'PROVIDER_ON_THE_WAY' ||
    bookingLocationNeedsOps(booking, nowMs)
  ) {
    return 'P1';
  }
  if (booking.status === 'OPEN_MATCHING' || booking.status === 'ARRIVED' || booking.status === 'IN_SERVICE') {
    return 'P2';
  }
  return 'P3';
}

function bookingActionOwner(booking: AdminBooking, flag?: BookingCheckFlag): BookingNextAction['owner'] {
  if (
    flag?.title.toLowerCase().includes('payment') ||
    flag?.title.toLowerCase().includes('closeout') ||
    flag?.title.toLowerCase().includes('cash') ||
    flag?.title.toLowerCase().includes('payout') ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  ) {
    return 'Finance';
  }
  if (booking.status === 'NO_SHOW' || flag?.title.toLowerCase().includes('no-show')) {
    return 'Safety';
  }
  if (
    booking.status === 'CANCELLED' ||
    booking.status === 'EXPIRED' ||
    flag?.title.toLowerCase().includes('chat')
  ) {
    return 'Support';
  }
  return 'Dispatch';
}

function bookingOperatorAction(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  if (bookingCashDebtNeedsOps(booking)) {
    return 'Confirm partner wallet debt and request company fee settlement before final acceptance or customer selection.';
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    return 'Run closeout reconciliation so payment, earning, tax, fee, and wallet records match.';
  }
  if (bookingPaymentNeedsOps(booking)) {
    return 'Open the booking payment panel and decide capture, release, refund, cash debt, or missing reference handling.';
  }
  if (booking.status === 'NO_SHOW') {
    return 'Record customer and partner notes, then close payment and safety follow-up.';
  }
  if (booking.status === 'EXPIRED') {
    return 'Release the hold, notify the customer, and confirm no partner remains assigned.';
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return 'Monitor the first-pick partner response window and prepare marketplace partner options.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Check nearby partner supply and notification delivery until the customer has options.';
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return 'Create or repair chat handoff before the service moves forward.';
  }
  if (bookingLocationNeedsOps(booking, nowMs)) {
    return 'Ask the partner to refresh location once; use last-known location only, no live routing.';
  }
  if (booking.status === 'IN_SERVICE') {
    return 'Monitor completion timing and prepare payment capture or cash fee ledger closeout.';
  }
  return flag
    ? `Review ${flag.title.toLowerCase()} and add an ops note before closing.`
    : 'Keep watching status, chat, and partner handoff.';
}

function bookingPriority(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW') {
    return 6;
  }
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
  if (view === 'attention') {
    return 'No attention-queue bookings match this queue. Expired matching, missing chat, and payment closeout are clear.';
  }
  if (view === 'matching') {
    return 'No matching escalation bookings match this queue. First-pick, marketplace supply, customer selection, and chat handoff are clear.';
  }
  if (view === 'first-pick') {
    return 'No Stage 1 first-pick bookings are waiting. The direct partner response window is clear.';
  }
  if (view === 'marketplace') {
    return 'No Stage 2 marketplace bookings need partner participation review right now.';
  }
  if (view === 'customer-choice') {
    return 'No Stage 3 customer choice bookings are waiting. Accepted partners are not blocked on customer selection.';
  }
  if (view === 'handoff-repair') {
    return 'No Stage 4 handoff repair bookings are missing chat.';
  }
  if (view === 'no-supply') {
    return 'No open matching booking is waiting without partner supply.';
  }
  if (view === 'address') {
    return 'No booking is missing an immutable address snapshot.';
  }
  if (view === 'payment') {
    return 'No payment-check bookings match this queue. Capture, release, refund, cash, and partner refs are clear.';
  }
  if (view === 'cash-debt') {
    return 'No cash booking currently has open partner fee/tax debt.';
  }
  if (view === 'closeout') {
    return 'No completed closeout-check bookings match this queue. Capture, earning, tax, fee, and wallet records are aligned.';
  }
  if (view === 'pricing') {
    return 'No pricing-check bookings match this queue. Booking prices match active service payout rules.';
  }
  if (view === 'location') {
    return 'No location-check bookings match this queue. Live service location signals look acceptable.';
  }
  if (view === 'chat') {
    return 'No chat-live bookings match this queue. No active customer/partner conversation needs review.';
  }
  if (view === 'chat-repair') {
    return 'No matched or active booking is missing chat right now.';
  }
  if (view === 'expired') {
    return 'No expired bookings need review. Timeout closeout and customer communication are clear.';
  }
  if (view === 'no-show') {
    return 'No no-show bookings need review. Customer protection and payment closeout are clear.';
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
  const participantCount = marketplaceParticipants(booking).length;
  if (booking.status === 'NO_SHOW') {
    return booking.payment && !['RELEASED', 'REFUNDED'].includes(booking.payment.status) ? (
      <span className="signal signal-warn">No-show, check payment</span>
    ) : (
      <span className="signal signal-ok">No-show closed</span>
    );
  }
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED' ? (
      <span className="signal signal-ok">Expired and released</span>
    ) : (
      <span className="signal signal-warn">Expired, check payment</span>
    );
  }
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
    return <span className="signal signal-warn">First-pick partner pending</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return <span className="signal signal-warn">No marketplace partners yet</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return <span className="signal signal-info">Marketplace options ready</span>;
  }
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
    return <span className="signal signal-info">Marketplace partner selected</span>;
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return <span className="signal signal-warn">Chat missing</span>;
  }
  return <span className="signal signal-ok">Normal</span>;
}

type BookingCheckFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
};

function bookingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  const flags: BookingCheckFlag[] = [];
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
  if (
    booking.status === 'EXPIRED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ severity: 'high', title: 'Expired payment unresolved' });
  }
  if (booking.status === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({ severity: 'high', title: 'Completed service still on hold' });
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Completed closeout incomplete' });
  }
  if (
    booking.status === 'NO_SHOW' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ severity: 'high', title: 'No-show payment unresolved' });
  }
  if (bookingCashDebtNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Cash fee debt gates final acceptance' });
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
    flags.push({ severity: 'medium', title: 'First-pick partner pending' });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({ severity: 'medium', title: 'No partner supply' });
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    flags.push({ severity: 'high', title: 'Matched without chat' });
  }
  if (locationRequiredStatuses.has(booking.status) && !hasProviderLocation(booking)) {
    flags.push({ severity: 'medium', title: 'No partner location signal' });
  }
  if (
    locationRequiredStatuses.has(booking.status) &&
    hasProviderLocation(booking) &&
    providerLocationFreshness(booking, nowMs) !== 'recent'
  ) {
    flags.push({ severity: 'medium', title: 'Partner location is stale' });
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
  if (booking.status === 'EXPIRED' && !['RELEASED', 'REFUNDED'].includes(payment.status)) {
    return true;
  }
  if (booking.status === 'NO_SHOW' && !['RELEASED', 'REFUNDED'].includes(payment.status)) {
    return true;
  }
  if (booking.status === 'COMPLETED' && payment.status === 'AUTHORIZED') {
    return true;
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
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

function bookingCompletedCloseoutNeedsOps(booking: AdminBooking) {
  if (booking.status !== 'COMPLETED') {
    return false;
  }
  if (!booking.payment || booking.payment.status !== 'CAPTURED') {
    return true;
  }
  if (!booking.earning) {
    return true;
  }
  return (
    (booking.earning.taxLogs?.length ?? 0) === 0 ||
    (booking.earning.platformFeeLogs?.length ?? 0) === 0 ||
    (booking.earning.walletLedgerEntries?.length ?? 0) === 0
  );
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
    return { status: 'blocked', label: 'Partner payout exceeds price', tone: 'pill-danger' };
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

function bookingAddressNeedsOps(booking: AdminBooking) {
  return !booking.addressSnapshot;
}

function bookingChatRepairNeedsOps(booking: AdminBooking) {
  return (
    !booking.chatRoom && ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
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

function bookingAddressSnapshotState(booking: AdminBooking) {
  const snapshot = booking.addressSnapshot;
  if (snapshot) {
    const pin = coordinatePairLabel(snapshot.latitude, snapshot.longitude);
    return {
      label: snapshot.addressText ? 'Address locked' : 'Pin locked',
      detail: snapshot.addressText
        ? displayMarketplaceText(snapshot.addressText)
        : 'Customer confirmed this map pin without a text address.',
      pin: pin ? `Pin ${pin}` : 'Pin saved without readable coordinates',
      tone: 'pill-success',
    };
  }

  const legacyAddress = readAddressText(booking.address);
  if (legacyAddress) {
    const pin = coordinatePairLabel(booking.lat, booking.lng);
    return {
      label: 'Legacy address',
      detail: displayMarketplaceText(legacyAddress),
      pin: pin ? `Pin ${pin}` : 'No locked pin snapshot',
      tone: 'pill-warn',
    };
  }

  return {
    label: 'Address missing',
    detail: 'No immutable booking address snapshot is attached.',
    pin: 'Ask customer support to confirm the service address before dispatch.',
    tone: 'pill-danger',
  };
}

function bookingChatListState(booking: AdminBooking) {
  const messageCount = booking.chatRoom?.messages?.length ?? 0;
  if (booking.chatRoom) {
    return {
      label: 'Chat ready',
      detail: `${messageCount} message(s) retained for admin review.`,
      tone: 'pill-success',
    };
  }

  if (
    booking.status === 'MATCHED' ||
    booking.status === 'PROVIDER_ON_THE_WAY' ||
    booking.status === 'IN_SERVICE'
  ) {
    return {
      label: 'Chat missing',
      detail: 'Customer and partner are matched, but no chat room is linked yet.',
      tone: 'pill-danger',
    };
  }

  if (booking.status === 'COMPLETED') {
    return {
      label: 'Chat archived',
      detail: 'Service is completed. Admin should retain any linked chat history.',
      tone: 'pill-info',
    };
  }

  return {
    label: 'Chat pending',
    detail: 'Chat opens after the customer locks a final partner.',
    tone: 'pill-neutral',
  };
}

function bookingListActionChips(booking: AdminBooking, nowMs: number): BookingListActionChip[] {
  const paymentNeedsOps = bookingPaymentNeedsOps(booking);
  const locationNeedsOps = bookingLocationNeedsOps(booking, nowMs);
  const chatNeedsRepair = bookingChatRepairNeedsOps(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);
  const closeoutNeedsOps = bookingCompletedCloseoutNeedsOps(booking);
  const pricingNeedsOps = bookingPricingPolicyNeedsOps(booking);
  const chatState = bookingChatListState(booking);
  const pricingPolicy = bookingPricingPolicySignal(booking);
  const paymentAmount = booking.payment
    ? money(Number(booking.payment.amount ?? 0), booking.payment.currency)
    : 'No payment record';

  return [
    {
      label: chatNeedsRepair ? 'Chat repair' : chatState.label,
      detail: chatState.detail,
      tone: chatNeedsRepair ? 'pill-danger' : chatState.tone,
      href: chatNeedsRepair ? '/bookings?view=chat-repair' : '/bookings?view=chat',
    },
    {
      label: locationNeedsOps ? 'Location check' : 'Location clear',
      detail: bookingLocationSignalLabel(booking, nowMs),
      tone: locationNeedsOps ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=location',
    },
    {
      label: paymentNeedsOps ? 'Payment check' : 'Payment clear',
      detail: booking.payment
        ? `${booking.payment.method} / ${booking.payment.status} / ${paymentAmount}`
        : 'No payment record is attached to this booking.',
      tone: paymentNeedsOps ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=payment',
    },
    {
      label: cashDebtNeedsOps ? 'Cash debt' : 'Cash clear',
      detail: cashDebtNeedsOps
        ? 'Partner cash fee debt must be settled before final acceptance or customer selection.'
        : 'No partner cash fee debt is visible for this booking.',
      tone: cashDebtNeedsOps ? 'pill-danger' : 'pill-success',
      href: '/bookings?view=cash-debt',
    },
    {
      label: closeoutNeedsOps ? 'Closeout check' : 'Closeout clear',
      detail: closeoutNeedsOps
        ? 'Completed booking needs payment, earning, tax, fee, or wallet ledger closeout.'
        : 'No completed closeout blocker is visible.',
      tone: closeoutNeedsOps ? 'pill-warn' : 'pill-success',
      href: '/bookings?view=closeout',
    },
    {
      label: pricingNeedsOps ? 'Pricing check' : 'Pricing clear',
      detail: pricingPolicy.label,
      tone: pricingNeedsOps ? pricingPolicy.tone : 'pill-success',
      href: '/bookings?view=pricing',
    },
  ];
}

function checkLevel(flags: BookingCheckFlag[]) {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'Action', helper: `${flags.length} check(s)`, tone: 'signal-warn' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Monitor', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Note', helper: `${flags.length} check(s)`, tone: 'signal-info' };
  }
  return { label: 'Clear', helper: 'No active checks', tone: 'signal-ok' };
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
  const participantCount = marketplaceParticipants(booking).length;
  if (booking.status === 'NO_SHOW') {
    return booking.payment && !['RELEASED', 'REFUNDED'].includes(booking.payment.status)
      ? 'No-show is marked. Decide payment release, refund, or fee handling before closing.'
      : 'No-show is marked and payment outcome is already closed. Confirm customer and partner notes.';
  }
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Matching expired and the payment hold is released. Confirm customer communication.'
      : 'Matching expired. Release or refund the linked payment before closing.';
  }
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Customer cancelled before completion. Payment hold is released; confirm notifications were delivered.'
      : 'Customer cancelled. Review the linked payment and release or refund before closing the case.';
  }
  if (booking.status === 'REFUNDED') {
    return 'Refund is recorded. Check the refund board and customer communication.';
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return 'Partner collected cash. Finance must settle the HANDS fee debt before this partner completes final acceptance or customer final selection.';
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return 'Wait for the first-pick partner, but monitor marketplace partner supply.';
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return 'Check notifications and nearby partner supply.';
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return 'Customer can keep waiting or switch to a marketplace partner.';
  }
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
    return 'Customer switched away from the first-pick partner. Confirm chat, route, and partner handoff.';
  }
  if (booking.status === 'MATCHED') {
    return 'Customer selection is locked. Check chat creation, route tracking, and partner departure.';
  }
  if (booking.status === 'PROVIDER_ON_THE_WAY') {
    return 'Monitor live location and arrival progress.';
  }
  if (booking.status === 'IN_SERVICE') {
    return 'Track completion and payment capture.';
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    return 'Completed service needs closeout reconciliation for payment, earning, tax, and wallet records.';
  }
  if (booking.status === 'COMPLETED') {
    return 'Review payment, customer feedback, and closeout records.';
  }
  return 'Normal operating state.';
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function displayMarketplaceText(value: string) {
  return value.replace(/\bbackup\b/g, 'marketplace').replace(/\bBackup\b/g, 'Marketplace');
}

function bookingServiceOptionLabel(booking: AdminBooking) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  if (!service?.name) {
    return 'Service pending';
  }

  const duration = service.durationMin ? `${service.durationMin} min` : 'duration pending';
  return `${displayMarketplaceText(service.name)} / ${duration}`;
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

function matchingPolicySummaryLabel(snapshot: BookingMatchingPolicySnapshot | null) {
  if (!snapshot) {
    return 'Matching policy: live policy default';
  }
  const timer = snapshot.providerResponseWindowMinutes
    ? `${snapshot.providerResponseWindowMinutes}m`
    : 'timer ?';
  const radius = snapshot.backupProviderRadiusMeters
    ? `${(snapshot.backupProviderRadiusMeters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })}km`
    : 'radius ?';
  const freshness = snapshot.backupProviderLocationMaxAgeMinutes
    ? `${snapshot.backupProviderLocationMaxAgeMinutes}m fresh`
    : 'freshness ?';
  const inviteLimit = snapshot.backupProviderInvitationLimit
    ? `${snapshot.backupProviderInvitationLimit} invite cap`
    : 'invite cap ?';
  const backupMode =
    snapshot.backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
      ? 'marketplace immediate'
      : snapshot.backupOpenMode === 'DELAYED_UNTIL_FIRST_WINDOW_END'
        ? 'marketplace delayed'
        : 'marketplace ?';
  const acceptMode =
    snapshot.preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'
      ? 'customer final'
      : snapshot.preferredAcceptMode === 'AUTO_MATCH_ON_ACCEPT'
        ? 'legacy auto ignored'
        : 'accept ?';
  return `Saved policy: ${timer} / ${radius} / ${freshness} / ${inviteLimit} / ${backupMode} / ${acceptMode}`;
}

function bookingMatchingPolicySnapshot(booking: AdminBooking): BookingMatchingPolicySnapshot | null {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy.backupProviderRadiusMeters),
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(policy.backupProviderLocationMaxAgeMinutes),
    backupProviderInvitationLimit: readOptionalNumber(policy.backupProviderInvitationLimit),
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
}

function customerVisibleStateLabel(booking: AdminBooking) {
  const acceptedCount = acceptedParticipants(booking).length;
  const marketplaceCount = marketplaceParticipants(booking).length;

  if (['CANCELLED', 'EXPIRED', 'REFUNDED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    return `Customer screen: closed as ${booking.status}`;
  }
  if (booking.selectedProvider) {
    return `Customer screen: final partner ${partnerDisplayName(booking.selectedProvider, 'selected')}${
      booking.chatRoom ? ' with chat ready' : ' but chat not ready'
    }`;
  }
  if (acceptedCount > 0) {
    return `Customer screen: ${acceptedCount} accepted partner(s) ready for final choice`;
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return marketplaceCount > 0
      ? `Customer screen: first-pick wait plus ${marketplaceCount} marketplace option(s)`
      : 'Customer screen: first-pick waiting only';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return marketplaceCount > 0
      ? `Customer screen: ${marketplaceCount} partner option(s) waiting`
      : 'Customer screen: waiting for partners';
  }
  return `Customer screen: ${booking.status.toLowerCase().replaceAll('_', ' ')}`;
}

function bookingBackupAlertTraceLabel(booking: AdminBooking, nowMs: number) {
  const summary = bookingBackupAlertTraceSummary(booking, nowMs);
  if (!summary.batchCount) {
    return 'Marketplace alerts: no batch recorded';
  }
  if (summary.totalNotified > 0) {
    return `Marketplace alerts: ${summary.totalNotified} notified / ${summary.batchCount} batch(es)${
      summary.lastAge ? ` / last ${summary.lastAge}` : ''
    }`;
  }
  return `Marketplace alerts: ${summary.batchCount} batch(es), no eligible partner notified`;
}

function bookingBackupAlertTracePill(booking: AdminBooking) {
  const summary = bookingBackupAlertTraceSummary(booking);
  if (!summary.batchCount) {
    return 'No marketplace trace';
  }
  if (summary.totalNotified > 0) {
    return `${summary.totalNotified} marketplace alert(s)`;
  }
  return 'Marketplace trace empty';
}

function bookingBackupAlertTraceTone(booking: AdminBooking) {
  const summary = bookingBackupAlertTraceSummary(booking);
  if (summary.totalNotified > 0) {
    return 'pill-success';
  }
  if (summary.batchCount > 0) {
    return 'pill-warn';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'pill-danger';
  }
  return 'pill-neutral';
}

function bookingBackupAlertTraceSummary(booking: AdminBooking, nowMs = 0) {
  const metadata = readPlainRecord(booking.metadata);
  const traces = Array.isArray(metadata?.backupNotificationTraces)
    ? metadata.backupNotificationTraces
        .map(readPlainRecord)
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const totalNotified = traces.reduce(
    (sum, trace) => sum + (readOptionalNumber(trace.notifiedCount) ?? 0),
    0,
  );
  const latest = traces.at(-1) ?? null;
  const lastCreatedAt = readOptionalString(latest?.createdAt);
  return {
    batchCount: traces.length,
    totalNotified,
    lastStage: readOptionalString(latest?.stage),
    lastCreatedAt,
    lastAge: lastCreatedAt ? relativeTimeLabel(lastCreatedAt, nowMs) : null,
  };
}

function relativeTimeLabel(value: string, nowMs: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'unknown time';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const minutesAgo = Math.max(0, Math.round((reference - timestamp) / 60_000));
  if (minutesAgo < 1) {
    return 'just now';
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }
  return `${Math.round(hoursAgo / 24)}d ago`;
}

function money(amount: number, currency = 'VND') {
  return `${amount.toLocaleString()} ${currency}`;
}

function coordinatePairLabel(lat: unknown, lng: unknown) {
  const parsedLat = coordinatePart(lat);
  const parsedLng = coordinatePart(lng);
  if (!parsedLat || !parsedLng) {
    return null;
  }
  return `${parsedLat}, ${parsedLng}`;
}

function coordinatePart(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(4) : null;
}

function readAddressText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.addressText,
    record.fullAddress,
    record.formattedAddress,
    record.line1,
    record.street,
  ];
  return (
    candidates
      .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
      ?.trim() ?? null
  );
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

function readPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'No request time';
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

function bookingAgeLabel(booking: AdminBooking, nowMs: number) {
  const timestamp = booking.createdAt ?? booking.scheduledStartAt ?? booking.expiresAt;
  if (!timestamp || nowMs <= 0) {
    return 'age pending';
  }

  const minutes = Math.max(0, Math.round((nowMs - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 60) {
    return `${minutes}m old`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h old`;
  }
  return `${Math.round(hours / 24)}d old`;
}

function bookingCustomerLabel(booking: AdminBooking) {
  return booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
}

function bookingProviderLabel(booking: AdminBooking) {
  const provider =
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    marketplaceParticipants(booking)[0]?.providerProfile?.displayName;
  return provider ? `Partner ${partnerDisplayName({ displayName: provider })}` : 'Partner pending';
}

function partnerDisplayName(provider?: { displayName?: string | null } | null, fallback = 'Partner') {
  return provider?.displayName
    ? provider.displayName
        .replace(/\bbackup\b/g, 'marketplace')
        .replace(/\bBackup\b/g, 'Marketplace')
        .replace(/\bProvider\b/g, 'Partner')
        .replace(/\bprovider\b/g, 'partner')
    : fallback;
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

function marketplaceParticipants(booking: AdminBooking) {
  const preferredId = booking.preferredProvider?.id;
  return (booking.participants ?? []).filter(
    (participant) =>
      participant.status !== 'REJECTED' &&
      participant.providerProfile?.id &&
      participant.providerProfile.id !== preferredId,
  );
}

function acceptedParticipants(booking: AdminBooking) {
  return (booking.participants ?? []).filter(
    (participant) => participant.status === 'ACCEPTED' || participant.status === 'SELECTED',
  );
}

function bookingHasAcceptedPartner(booking: AdminBooking) {
  return acceptedParticipants(booking).length > 0 && !booking.selectedProvider;
}

function bookingMatchingEscalationNeedsOps(booking: AdminBooking, nowMs: number) {
  if (booking.status === 'OPEN_MATCHING') {
    return true;
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return true;
  }
  return bookingMatchingWindowExpired(booking, nowMs);
}

function bookingMatchingWindowExpired(booking: AdminBooking, nowMs: number) {
  if (booking.status !== 'OPEN_MATCHING' || !booking.expiresAt || nowMs <= 0) {
    return false;
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt < nowMs;
}

function bookingMatchingWindowLabel(booking: AdminBooking, nowMs: number) {
  if (!booking.expiresAt || nowMs <= 0) {
    return 'window pending';
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) {
    return 'window invalid';
  }

  const minutes = Math.round((expiresAt - nowMs) / 60_000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes === 0) {
    return 'expires now';
  }
  return `${minutes}m left`;
}

function selectionLabel(booking: AdminBooking) {
  if (!booking.preferredProvider) {
    return 'No first-pick partner';
  }

  if (isBackupSelected(booking)) {
    return 'Marketplace partner selected';
  }

  if (booking.status === 'OPEN_MATCHING' && isPreferredAwaitingDecision(booking)) {
    return 'First-pick partner pending';
  }

  if (preferredProviderStateLabel(booking) == 'declined') {
    return 'First-pick partner declined';
  }

  if (booking.status === 'MATCHED') {
    return 'Final partner selected';
  }

  if (isSelectedProviderParticipant(booking)) {
    return 'First-pick partner is active';
  }

  return 'First-pick partner requested';
}

function selectionPathLabel(booking: AdminBooking) {
  const marketplaceCount = marketplaceParticipants(booking).length;

  if (!booking.preferredProvider) {
    return marketplaceCount > 0 ? 'Open pool request with marketplace supply' : 'Open pool request';
  }

  if (booking.status === 'OPEN_MATCHING' && isPreferredAwaitingDecision(booking)) {
    return marketplaceCount > 0
      ? 'Direct request first, with marketplace partners already waiting'
      : 'Direct request first, waiting on the first-pick partner';
  }

  if (isBackupSelected(booking)) {
    return 'Direct request escalated to marketplace participation, then the guest chose a marketplace partner';
  }

  if (booking.status === 'MATCHED') {
    return 'Direct request confirmed by the first-pick partner';
  }

  if (marketplaceCount > 0) {
    return 'Marketplace partners are available while the first-pick partner stays in the flow';
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
    return 'Partner location: not shared yet';
  }

  const updatedAt = provider.currentLocationUpdatedAt;
  if (!updatedAt) {
    return 'Partner location: saved pin without timestamp';
  }

  const age = locationAgeLabel(updatedAt, nowMs);
  return `Partner location: ${age}`;
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
