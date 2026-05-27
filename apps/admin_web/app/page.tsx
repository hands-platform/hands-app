import Link from 'next/link';
import {
  AdminBooking,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminExternalReadiness,
  AdminAppSession,
  AdminNotification,
  AdminOperationalPolicySetting,
  AdminPayment,
  AdminPayoutBatch,
  AdminProvider,
  AdminRefund,
  AdminUser,
  apiGet,
  adminGet,
} from '../lib/admin-api';

const activeBookingStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

function emptyCashSettlementSummary(): AdminCashSettlementSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    currency: 'VND',
    rowCount: 0,
    providerCount: 0,
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    oldestOpenAt: null,
    oldestOpenAgeMinutes: 0,
    staleDebtRowCount: 0,
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    cashPaymentRowCount: 0,
    topProviderGroups: [],
  };
}

type OpsQueueItem = {
  label: string;
  detail: string;
  href: string;
  severity: 'high' | 'medium' | 'low';
  area: 'Booking' | 'Payment' | 'Partner' | 'Notification' | 'Payout' | 'Finance';
  owner: 'Dispatch' | 'Finance' | 'Partner Ops' | 'Support' | 'System';
  priority: number;
  recommendedAction: string;
};

type PartnerOpsQueueItem = {
  id: string;
  name: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  priority: number;
  metrics: Array<{ label: string; value: string; tone: 'ok' | 'warn' | 'danger' | 'info' }>;
};

export default async function DashboardPage() {
  const [
    users,
    providers,
    bookings,
    payments,
    earnings,
    earningRows,
    refunds,
    notifications,
    payoutBatches,
    appSessions,
    externalReadiness,
    cashSettlementSummary,
    operationalPolicies,
  ] = await Promise.all([
    adminGet<AdminUser[]>('/admin/users', []),
    adminGet<AdminProvider[]>('/admin/providers', []),
    adminGet<AdminBooking[]>('/admin/bookings', []),
    adminGet<AdminPayment[]>('/admin/payments', []),
    adminGet<AdminEarningSummary>('/admin/earnings/summary', {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      tipAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency: 'VND',
    }),
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminRefund[]>('/admin/refunds', []),
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
    adminGet<AdminAppSession[]>('/admin/app-sessions', []),
    apiGet<AdminExternalReadiness>('/health/external', {
      ok: false,
      timestamp: new Date(0).toISOString(),
      checks: [],
    }),
    adminGet<AdminCashSettlementSummary>('/admin/cash-settlement-summary', emptyCashSettlementSummary()),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);

  const queue = buildOpsQueue({
    providers,
    bookings,
    payments,
    refunds,
    notifications,
    earnings,
    earningRows,
    cashSettlementSummary,
    payoutBatches,
  });
  const cashDebtRows = openCashDebtEarnings(earningRows);
  const cashDebtAmount = cashSettlementSummary.totalDebtAmount;
  const queueSummary = buildOpsQueueSummary(queue);
  const bookingOps = buildBookingOpsInsights(bookings);
  const bookingDeepDive = buildBookingOperationsDeepDive(bookings, payments);
  const appPresence = buildAppPresence(users, bookings, appSessions);
  const hourlyDemand = buildHourlyBookingDemand(bookings);
  const regionalDemand = buildRegionalBookingDemand(bookings);
  const partnerSupply = buildPartnerSupplyInsights(
    providers,
    bookings,
    appSessions,
    cashDebtRows,
    cashSettlementSummary,
  );
  const partnerOpsQueue = buildPartnerOpsQueue(providers, cashDebtRows, appSessions);
  const commandSignals = buildDashboardCommandSignals({
    providers,
    bookings,
    payments,
    refunds,
    notifications,
    earnings,
    earningRows,
    cashSettlementSummary,
    payoutBatches,
    externalReadiness,
  });
  const topCommandSignal = commandSignals[0];
  const activeBookings = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const pendingVerification = providers.filter((provider) => provider.verification?.status === 'SUBMITTED');
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const activePayoutBatches = payoutBatches.filter((batch) => !['PAID', 'CANCELLED'].includes(batch.status));
  const policySummary = buildOperationalPolicySummary(operationalPolicies);
  const matchingControl = buildMatchingControlRoom(bookings, providers, operationalPolicies);

  const metrics = [
    [
      'Total bookings',
      bookings.length.toString(),
      'All reservations currently loaded into the admin snapshot.',
    ],
    [
      'Open matching',
      bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length.toString(),
      'Customer is waiting for partner response.',
    ],
    ['Active bookings', activeBookings.length.toString(), 'Bookings that still need operational visibility.'],
    [
      'Completed bookings',
      bookingOps.completed.toString(),
      'Finished services ready for payment/review closeout.',
    ],
    [
      'Cancelled bookings',
      bookingOps.cancelled.toString(),
      'Cancelled requests needing refund/release review.',
    ],
    [
      'Expired bookings',
      bookingOps.expired.toString(),
      'Expired requests that should have payment release and customer follow-up checked.',
    ],
    [
      'No-show signal',
      bookingOps.noShowSignal.toString(),
      'Formal NO_SHOW reservations plus overdue matched bookings without chat.',
    ],
    [
      'Closeout risk',
      bookingOps.completedCloseoutRisk.toString(),
      'Completed bookings missing capture, earning, tax, fee, or wallet ledger records.',
    ],
    [
      'Online partners',
      providers.filter((provider) => provider.status.startsWith('ONLINE')).length.toString(),
      'Supply currently visible to customers.',
    ],
    ['Pending verification', pendingVerification.length.toString(), 'Partners waiting for admin approval.'],
    [
      'Customers in app',
      appPresence.liveAppCustomers.toString(),
      'Customer app sessions seen within the active session window.',
    ],
    [
      'Partners in app',
      appPresence.liveAppPartners.toString(),
      'Partner app sessions seen within the active session window.',
    ],
    [
      'Active customers',
      appPresence.activeBookingCustomers.toString(),
      'Unique customers currently attached to active bookings.',
    ],
    [
      'Payment holds',
      payments.filter((payment) => payment.status === 'AUTHORIZED').length.toString(),
      'Authorized payments not yet captured or released.',
    ],
    [
      'Failed notifications',
      failedNotifications.length.toString(),
      'Delivery failures that may need retry or disabled-device review.',
    ],
    [
      'Available payout',
      money(earnings.availableNetAmount, earnings.currency),
      'Partner earnings ready for payout batching.',
    ],
    [
      'Cash debt',
      money(cashDebtAmount, earnings.currency),
      `${cashSettlementSummary.providerCount} partner(s), ${cashSettlementSummary.rowCount} debt row(s) blocking booking acceptance.`,
    ],
    [
      'Open payout batches',
      activePayoutBatches.length.toString(),
      'Draft, processing, failed, or held payout batches needing finance visibility.',
    ],
    [
      'Action queue',
      queue.length.toString(),
      'Prioritized items generated from booking, payment, partner, and notification state.',
    ],
  ];

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>HANDS Operations</h1>
          <p className="muted">
            Daily command center for dispatch, partner supply, payment holds, refunds, notifications, and
            payout readiness.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/bookings">
            Booking monitor
          </Link>
          <Link className="text-link" href="/payments">
            Payments
          </Link>
          <Link className="text-link" href="/providers">
            Partner review
          </Link>
          <Link className="text-link" href="/tax-policy">
            Tax policy
          </Link>
          <Link className="text-link" href="/setup">
            Setup
          </Link>
          <Link className="text-link" href="/audit-log">
            Audit log
          </Link>
        </div>
      </section>

      <section className="grid">
        {metrics.map(([label, value, helper]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
            <p className="muted">{helper}</p>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Matching control room</h2>
            <p className="muted">
              Live view of open matching demand against the current 1st-pick timer, backup radius, and partner
              location freshness.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Simulate policy
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {matchingControl.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="ops-task-note">
            <div className="risk-watch-header">
              <div>
                <h3>Open matching queue</h3>
                <p className="muted">
                  Bookings that may require dispatch intervention before the customer cancels or the timer
                  expires.
                </p>
              </div>
              <span className={`pill ${matchingControl.openRows.length ? 'pill-warn' : 'pill-success'}`}>
                {matchingControl.openRows.length} shown
              </span>
            </div>
            <div className="stack" style={{ marginTop: 10 }}>
              {matchingControl.openRows.map((row) => (
                <div className="ops-row" key={row.id}>
                  <div>
                    <Link className="text-link" href={`/bookings/${row.id}`}>
                      {row.title}
                    </Link>
                    <p className="muted">{row.detail}</p>
                  </div>
                  <span className={`pill ${row.pillClass}`}>{row.status}</span>
                </div>
              ))}
              {matchingControl.openRows.length === 0 ? (
                <p className="muted">No open matching booking is waiting right now.</p>
              ) : null}
            </div>
          </div>
          <div className="ops-task-note">
            <div className="risk-watch-header">
              <div>
                <h3>Supply and policy checks</h3>
                <p className="muted">
                  The most likely reason matching will feel slow before operators touch a booking.
                </p>
              </div>
              <span className={`pill ${matchingControl.healthPillClass}`}>{matchingControl.healthLabel}</span>
            </div>
            <div className="ops-task-grid" style={{ marginTop: 12, gridTemplateColumns: '1fr' }}>
              {matchingControl.checks.map((check) => (
                <div className={`ops-task-card ${check.className}`} key={check.title}>
                  <span className={`pill ${check.pillClass}`}>{check.status}</span>
                  <h3>{check.title}</h3>
                  <p>{check.detail}</p>
                  <small>{check.operatorAction}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operations policy snapshot</h2>
            <p className="muted">
              Live dispatch rules and owner decisions currently guiding matching, backup participation,
              cancellation, no-show, and partner alerts.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Change policy
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Active overrides</span>
            <strong>{policySummary.activeOverrideCount}</strong>
            <small>Values different from recommended baseline.</small>
          </div>
          <div>
            <span>Recent changes</span>
            <strong>{policySummary.recentChangeCount}</strong>
            <small>Policy records changed in the last 7 days.</small>
          </div>
          <div>
            <span>Policy health</span>
            <strong>{policySummary.healthLabel}</strong>
            <small>{policySummary.healthHelper}</small>
          </div>
          {policySummary.enforced.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        {policySummary.activeOverrides.length || policySummary.recentChanges.length ? (
          <div className="detail-grid" style={{ marginTop: 14 }}>
            <div className="ops-task-note">
              <div className="ops-row">
                <div>
                  <strong>Active policy overrides</strong>
                  <p className="muted">
                    These owner choices are currently different from the recommended operating baseline.
                  </p>
                </div>
                <span className={`pill ${policySummary.activeOverrideCount ? 'pill-warn' : 'pill-success'}`}>
                  {policySummary.activeOverrideCount} override(s)
                </span>
              </div>
              <div className="stack" style={{ marginTop: 10 }}>
                {policySummary.activeOverrides.slice(0, 4).map((override) => (
                  <div className="ops-row" key={override.key}>
                    <div>
                      <strong>{override.label}</strong>
                      <p className="muted">
                        Current {override.current} / recommended {override.recommended}
                      </p>
                    </div>
                    <span className="pill pill-info">{override.category}</span>
                  </div>
                ))}
                {policySummary.activeOverrides.length === 0 ? (
                  <p className="muted">
                    No active policy override is different from the recommended baseline.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="ops-task-note">
              <div className="ops-row">
                <div>
                  <strong>Recent policy changes</strong>
                  <p className="muted">
                    Use this as a quick audit signal before investigating dispatch, payment, or alert
                    behavior.
                  </p>
                </div>
                <Link className="text-link" href="/audit-log?bucket=Operations%2FPolicy">
                  Policy audit
                </Link>
              </div>
              <div className="stack" style={{ marginTop: 10 }}>
                {policySummary.recentChanges.slice(0, 4).map((change) => (
                  <div className="ops-row" key={change.key}>
                    <div>
                      <strong>{change.label}</strong>
                      <p className="muted">
                        {change.current} changed {change.changedAtLabel}
                      </p>
                    </div>
                    <span className={`pill ${change.enforced ? 'pill-success' : 'pill-warn'}`}>
                      {change.enforced ? 'Live' : 'Planning'}
                    </span>
                  </div>
                ))}
                {policySummary.recentChanges.length === 0 ? (
                  <p className="muted">No policy setting was changed in the last 7 days.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {policySummary.decisions.map((decision) => (
            <div className={`ops-task-card ${decision.className}`} key={decision.key}>
              <span className={`pill ${decision.pillClass}`}>{decision.status}</span>
              <h3>{decision.label}</h3>
              <p>{decision.current}</p>
              <small>{decision.recommendation}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Booking risk cockpit</h2>
              <p className="muted">
                Dispatch exceptions that should be cleared before they become customer complaints.
              </p>
            </div>
            <Link className="text-link" href="/bookings?view=high-risk">
              High-risk bookings
            </Link>
          </div>
          <div className="service-trace-summary">
            <div>
              <span>Expired matching</span>
              <strong>{bookingDeepDive.expiredOpenMatching}</strong>
              <small>Open windows past timeout</small>
            </div>
            <div>
              <span>No participants</span>
              <strong>{bookingDeepDive.openWithoutParticipants}</strong>
              <small>Customer waiting, no partner joined</small>
            </div>
            <div>
              <span>Matched no chat</span>
              <strong>{bookingDeepDive.matchedWithoutChat}</strong>
              <small>Partner selected, room missing</small>
            </div>
            <div>
              <span>Quiet active chats</span>
              <strong>{bookingDeepDive.quietActiveChats}</strong>
              <small>Room exists but no messages</small>
            </div>
            <div>
              <span>Payment release risk</span>
              <strong>{bookingDeepDive.releaseRisk}</strong>
              <small>Cancelled/expired/no-show not released</small>
            </div>
            <div>
              <span>Completion capture risk</span>
              <strong>{bookingDeepDive.captureRisk}</strong>
              <small>Completed service still authorized</small>
            </div>
            <div>
              <span>Avg participants</span>
              <strong>{bookingDeepDive.averageParticipants}</strong>
              <small>Open/matched response depth</small>
            </div>
            <div>
              <span>Manual closeout</span>
              <strong>{bookingDeepDive.manualCloseout}</strong>
              <small>Needs operator audit trail</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Service and payment mix</h2>
              <p className="muted">
                Which services and payment methods are creating operational load right now.
              </p>
            </div>
            <Link className="text-link" href="/services">
              Pricing setup
            </Link>
          </div>
          <div className="detail-grid">
            <div>
              <h3>Top service demand</h3>
              <div className="stack">
                {bookingDeepDive.serviceDemand.map((item) => (
                  <div className="ops-row" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <p className="muted">
                        {item.active} active / {item.completed} completed / avg {money(item.averagePrice)}
                      </p>
                    </div>
                    <span className="pill pill-info">{item.total}</span>
                  </div>
                ))}
                {bookingDeepDive.serviceDemand.length === 0 ? (
                  <p className="muted">No service demand loaded yet.</p>
                ) : null}
              </div>
            </div>
            <div>
              <h3>Payment method load</h3>
              <div className="stack">
                {bookingDeepDive.paymentMix.map((item) => (
                  <div className="ops-row" key={item.method}>
                    <div>
                      <strong>{item.method}</strong>
                      <p className="muted">
                        {money(item.amount, item.currency)} / {item.authorized} authorized / {item.pending}{' '}
                        pending
                      </p>
                    </div>
                    <span className={`pill ${item.riskCount ? 'pill-warn' : 'pill-info'}`}>
                      {item.count} payment(s)
                    </span>
                  </div>
                ))}
                {bookingDeepDive.paymentMix.length === 0 ? (
                  <p className="muted">No payment method data loaded yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Booking status control</h2>
              <p className="muted">
                Total, matching, completion, cancellation, and no-show proxy for daily operations.
              </p>
            </div>
            <Link className="text-link" href="/bookings">
              Open bookings
            </Link>
          </div>
          <div className="service-trace-summary">
            <div>
              <span>Total</span>
              <strong>{bookingOps.total}</strong>
              <small>All reservations</small>
            </div>
            <div>
              <span>Matching wait</span>
              <strong>{bookingOps.openMatching}</strong>
              <small>Customer waiting</small>
            </div>
            <div>
              <span>Completed</span>
              <strong>{bookingOps.completed}</strong>
              <small>Service finished</small>
            </div>
            <div>
              <span>Cancelled</span>
              <strong>{bookingOps.cancelled}</strong>
              <small>Refund/release check</small>
            </div>
            <div>
              <span>Expired</span>
              <strong>{bookingOps.expired}</strong>
              <small>Manual closeout</small>
            </div>
            <div>
              <span>Formal no-show</span>
              <strong>{bookingOps.noShowFormal}</strong>
              <small>Operator decision</small>
            </div>
            <div>
              <span>No-show signal</span>
              <strong>{bookingOps.noShowSignal}</strong>
              <small>Expired proxy</small>
            </div>
            <div>
              <span>Closeout risk</span>
              <strong>{bookingOps.completedCloseoutRisk}</strong>
              <small>Finance records</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Customer app presence</h2>
              <p className="muted">
                Current customer activity proxy until dedicated customer session tracking is added.
              </p>
            </div>
            <span className="pill pill-info">Presence proxy</span>
          </div>
          <table className="table">
            <tbody>
              <InfoRow
                label="Live app customers"
                value={appPresence.liveAppCustomers.toString()}
                detail="Customer app sessions with an unexpired heartbeat."
              />
              <InfoRow
                label="Live app partners"
                value={appPresence.liveAppPartners.toString()}
                detail="Partner app sessions with an unexpired heartbeat."
              />
              <InfoRow
                label="Recent customer sessions"
                value={appPresence.recentCustomerSessions.toString()}
                detail="Customer sessions seen in the last 30 minutes but not live now."
              />
              <InfoRow
                label="Stale customer sessions"
                value={appPresence.staleCustomerSessions.toString()}
                detail="Customer sessions seen within 24 hours but outside the recent window."
              />
              <InfoRow
                label="Active booking customers"
                value={appPresence.activeBookingCustomers.toString()}
                detail="Unique customers attached to open or in-service reservations."
              />
              <InfoRow
                label="Reachable customers"
                value={appPresence.reachableCustomers.toString()}
                detail="Fallback proxy from enabled push devices when session heartbeats are missing."
              />
              <InfoRow
                label="Push-disabled customers"
                value={appPresence.disabledPushCustomers.toString()}
                detail="Customers who may not receive booking or chat updates."
              />
              <InfoRow
                label="Customer records"
                value={appPresence.totalCustomers.toString()}
                detail="Total users with a customer profile in the latest admin snapshot."
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Hourly booking demand</h2>
              <p className="muted">Reservations grouped by scheduled hour in Vietnam time.</p>
            </div>
            <span className="pill pill-info">Asia/Bangkok</span>
          </div>
          <div className="stack">
            {hourlyDemand.map((item) => (
              <div className="ops-row" key={item.hour}>
                <div>
                  <strong>{item.hour}</strong>
                  <p className="muted">
                    {item.active} active / {item.completed} completed / {item.cancelled} cancelled
                  </p>
                </div>
                <span className={`pill ${item.total ? 'pill-info' : 'pill-neutral'}`}>{item.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Regional booking demand</h2>
              <p className="muted">Top service areas inferred from booking address text.</p>
            </div>
            <Link className="text-link" href="/bookings?view=all">
              Full booking list
            </Link>
          </div>
          <div className="stack">
            {regionalDemand.map((item) => (
              <div className="ops-row" key={item.region}>
                <div>
                  <strong>{item.region}</strong>
                  <p className="muted">
                    {item.active} active / {item.completed} completed / {item.cancelled} cancelled
                  </p>
                </div>
                <span className={`pill ${item.noShowSignal ? 'pill-warn' : 'pill-info'}`}>
                  {item.total} booking(s)
                </span>
              </div>
            ))}
            {regionalDemand.length === 0 && <p className="muted">No booking address data loaded yet.</p>}
          </div>
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Partner supply health</h2>
              <p className="muted">
                Current operational capacity, app presence, location freshness, and finance blockers.
              </p>
            </div>
            <Link className="text-link" href="/providers">
              Open partners
            </Link>
          </div>
          <div className="service-trace-summary">
            <div>
              <span>Total partners</span>
              <strong>{partnerSupply.total}</strong>
              <small>All registered partner profiles</small>
            </div>
            <div>
              <span>Online supply</span>
              <strong>{partnerSupply.online}</strong>
              <small>{partnerSupply.onlineAvailable} available now</small>
            </div>
            <div>
              <span>Live app partners</span>
              <strong>{partnerSupply.liveSessions}</strong>
              <small>Active session heartbeat</small>
            </div>
            <div>
              <span>Supply pressure</span>
              <strong>{partnerSupply.supplyPressureLabel}</strong>
              <small>Active demand / available supply</small>
            </div>
            <div>
              <span>Stale location</span>
              <strong>{partnerSupply.staleLocation}</strong>
              <small>Last pin older than 30m</small>
            </div>
            <div>
              <span>Cash debt blocked</span>
              <strong>{partnerSupply.cashDebtPartners}</strong>
              <small>Must settle before accepting</small>
            </div>
            <div>
              <span>Verification queue</span>
              <strong>{partnerSupply.pendingVerification}</strong>
              <small>Submitted for review</small>
            </div>
            <div>
              <span>Risk blocked</span>
              <strong>{partnerSupply.blocked}</strong>
              <small>Account or sanction blockers</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Partner readiness funnel</h2>
              <p className="muted">
                Funnel view for signup, KYC, banking, first revenue tax readiness, and trust badge.
              </p>
            </div>
            <Link className="text-link" href="/partner-risk">
              Risk queue
            </Link>
          </div>
          <table className="table">
            <tbody>
              <InfoRow
                label="Approved verification"
                value={partnerSupply.approvedVerification.toString()}
                detail="Partners whose admin verification can support work activation."
              />
              <InfoRow
                label="KYC approved"
                value={partnerSupply.kycApproved.toString()}
                detail="Identity review approved for Level 2 activity."
              />
              <InfoRow
                label="Bank approved"
                value={partnerSupply.bankApproved.toString()}
                detail="Primary bank account ready for payout routing."
              />
              <InfoRow
                label="First revenue partners"
                value={partnerSupply.firstRevenue.toString()}
                detail="Partners who should now complete tax/address/agreement requirements."
              />
              <InfoRow
                label="Tax ready after revenue"
                value={partnerSupply.taxReadyAfterRevenue.toString()}
                detail="First-revenue partners with approved tax profile."
              />
              <InfoRow
                label="Trusted badge"
                value={partnerSupply.trusted.toString()}
                detail="Partners promoted into the trusted operating level."
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner dispatch control</h2>
            <p className="muted">
              Priority partner queue for booking acceptance blockers, location readiness, first-revenue payout
              requirements, and app contactability.
            </p>
          </div>
          <Link className="text-link" href="/providers">
            Partner queue
          </Link>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {partnerOpsQueue.items.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.id}>
              <small>{item.status}</small>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
              <div className="ops-task-breakdown">
                {item.metrics.map((metric) => (
                  <span
                    className={`ops-task-breakdown-item ops-task-breakdown-${metric.tone}`}
                    key={`${item.id}-${metric.label}`}
                  >
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
              <span className="ops-task-card-action">{item.action}</span>
            </Link>
          ))}
          {partnerOpsQueue.items.length === 0 && (
            <div className="ops-task-note">
              <strong>No partner blocker is currently visible.</strong>
              <p className="muted">
                Verified partners, wallet debt, location freshness, payout readiness, and app contactability
                are clear in the current snapshot.
              </p>
            </div>
          )}
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          <div>
            <span>Blocked now</span>
            <strong>{partnerOpsQueue.blockedNow}</strong>
            <small>Cannot safely accept work</small>
          </div>
          <div>
            <span>Needs payout setup</span>
            <strong>{partnerOpsQueue.payoutSetup}</strong>
            <small>First revenue follow-up</small>
          </div>
          <div>
            <span>Location stale/missing</span>
            <strong>{partnerOpsQueue.locationIssue}</strong>
            <small>Dispatch visibility gap</small>
          </div>
          <div>
            <span>Not contactable</span>
            <strong>{partnerOpsQueue.contactIssue}</strong>
            <small>No app session or push</small>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Today command lanes</h2>
            <p className="muted">
              High-level routing for the operating day: dispatch, partner onboarding, payments, payouts, and
              setup.
            </p>
          </div>
          <span
            className={`signal ${queue.some((item) => item.severity === 'high') ? 'signal-warn' : 'signal-ok'}`}
          >
            {queue.some((item) => item.severity === 'high') ? 'High priority open' : 'Stable'}
          </span>
        </div>
        {topCommandSignal && (
          <div className="ops-task-note" style={{ marginTop: 14 }}>
            <div className="ops-row">
              <div>
                <span className={`pill ${topCommandSignal.pillClass}`}>First move</span>
                <strong>{topCommandSignal.title}</strong>
                <p className="muted">{topCommandSignal.detail}</p>
              </div>
              <Link className="text-link" href={topCommandSignal.href}>
                {topCommandSignal.action}
              </Link>
            </div>
          </div>
        )}
        <div className="ops-task-grid">
          {commandSignals.map((signal) => (
            <div className={`ops-task-card ${signal.className}`} key={signal.title}>
              <div>
                <span className={`pill ${signal.pillClass}`}>{signal.status}</span>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
                <div className="ops-task-breakdown">
                  {signal.breakdown.map((item) => {
                    const content = (
                      <>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </>
                    );

                    return item.href ? (
                      <Link
                        className={`ops-task-breakdown-item ops-task-breakdown-${item.tone}`}
                        href={item.href}
                        key={`${signal.title}-${item.label}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        className={`ops-task-breakdown-item ops-task-breakdown-${item.tone}`}
                        key={`${signal.title}-${item.label}`}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
              <Link className="ops-task-card-action" href={signal.href}>
                {signal.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Operations priority queue</h2>
              <p className="muted">
                Generated from the latest admin API snapshot. It ranks customer protection, partner safety,
                payment release, cash debt, and payout recovery together.
              </p>
            </div>
            <span className={`signal ${queueSummary.high > 0 ? 'signal-warn' : 'signal-ok'}`}>
              {queueSummary.high > 0 ? `${queueSummary.high} critical` : 'No high risk'}
            </span>
          </div>
          <div className="service-trace-summary">
            <div>
              <span>Critical</span>
              <strong>{queueSummary.high}</strong>
              <small>High severity actions</small>
            </div>
            <div>
              <span>Customer protection</span>
              <strong>{queueSummary.customerProtection}</strong>
              <small>Booking risks</small>
            </div>
            <div>
              <span>Finance risk</span>
              <strong>{queueSummary.financeCritical}</strong>
              <small>Payment, payout, debt</small>
            </div>
            <div>
              <span>Partner ops</span>
              <strong>{queueSummary.partnerCritical}</strong>
              <small>Risk or verification</small>
            </div>
          </div>
          {queueSummary.first && (
            <div className="ops-task-note" style={{ marginTop: 14 }}>
              <div>
                <span
                  className={`pill ${queueSummary.first.severity === 'high' ? 'pill-danger' : 'pill-warn'}`}
                >
                  First action
                </span>
                <h3>{queueSummary.first.label}</h3>
                <p>{queueSummary.first.recommendedAction}</p>
                <p className="muted">
                  Owner: {queueSummary.first.owner} - Priority {queueSummary.first.priority} -{' '}
                  {queueSummary.first.detail}
                </p>
              </div>
              <Link className="text-link" href={queueSummary.first.href}>
                Open task
              </Link>
            </div>
          )}
          <div className="risk-list">
            {queue.slice(0, 10).map((item) => (
              <Link
                className={`risk-item risk-${item.severity}`}
                href={item.href}
                key={`${item.area}-${item.label}-${item.href}`}
              >
                <div>
                  <span className="muted">
                    {item.area} - {item.owner} - Priority {item.priority}
                  </span>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                  <p className="muted">{item.recommendedAction}</p>
                </div>
                <p>{item.severity.toUpperCase()}</p>
              </Link>
            ))}
            {queue.length === 0 && (
              <p className="muted">No active operational issues detected from the current local data.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>External setup readiness</h2>
              <p className="muted">
                Live API environment check. Secrets are never shown, only configured/missing status.
              </p>
            </div>
            <span className={`signal ${externalReadiness.ok ? 'signal-ok' : 'signal-warn'}`}>
              {externalReadiness.ok ? 'Ready' : 'Needs setup'}
            </span>
          </div>
          <p className="muted">
            These are not code errors. They require console/account values before real E2E testing.
          </p>
          <div className="stack">
            {externalReadiness.checks.map((check) => (
              <ExternalReadinessRow check={check} key={`${check.category}-${check.name}`} />
            ))}
            {externalReadiness.checks.length === 0 && (
              <div className="ops-row">
                <div>
                  <strong>API external readiness unavailable</strong>
                  <p className="muted">Start the HANDS API and refresh this dashboard.</p>
                </div>
                <span className="pill pill-warn">BLOCKED</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <h2>Realtime flow health</h2>
          <table className="table">
            <tbody>
              <InfoRow
                label="Matching"
                value={`${bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length} open`}
                detail="Direct request first, backup partners can join when needed."
              />
              <InfoRow
                label="Chat"
                value={`${bookings.filter((booking) => booking.chatRoom).length} ready`}
                detail="Chat is expected after partner selection/service start."
              />
              <InfoRow
                label="Partner locations"
                value={`${providers.filter((provider) => provider.status.startsWith('ONLINE')).length} online`}
                detail="MVP uses last-known location, not routing or live streaming."
              />
              <InfoRow
                label="Payment ops"
                value={`${payments.filter((payment) => payment.status === 'AUTHORIZED').length} holds`}
                detail="Capture after service completion, release/refund on cancellation."
              />
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Finance snapshot</h2>
          <table className="table">
            <tbody>
              <InfoRow
                label="Gross"
                value={money(earnings.grossAmount, earnings.currency)}
                detail={`${earnings.count} earning record(s)`}
              />
              <InfoRow
                label="Platform fee"
                value={money(earnings.platformFee, earnings.currency)}
                detail="Admin revenue before partner payout."
              />
              <InfoRow
                label="Pending net"
                value={money(earnings.pendingNetAmount, earnings.currency)}
                detail="Not ready for payout yet."
              />
              <InfoRow
                label="Paid net"
                value={money(earnings.paidNetAmount, earnings.currency)}
                detail="Already marked paid."
              />
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted">API source: {process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3100/api'}</p>
    </>
  );
}

function ExternalReadinessRow({ check }: { check: AdminExternalReadiness['checks'][number] }) {
  const href = externalSetupHref(check.category);
  const missing = [...check.missing, ...(check.invalid ?? [])];

  return (
    <div className="ops-row">
      <div>
        <strong>{check.name}</strong>
        <p className="muted">{missing.length > 0 ? missing.join(', ') : check.detail}</p>
        {check.configured.length > 0 && <p className="muted">Configured: {check.configured.join(', ')}</p>}
      </div>
      <div className="actions">
        <span className={`pill ${check.status === 'READY' ? 'pill-success' : 'pill-warn'}`}>
          {check.status}
        </span>
        <Link className="text-link" href={href}>
          Related page
        </Link>
      </div>
    </div>
  );
}

function externalSetupHref(category: string) {
  if (category === 'supabase') {
    return '/setup#supabase';
  }
  if (category === 'payments') {
    return '/setup#payments';
  }
  if (category === 'push' || category === 'sms') {
    return '/setup#notifications';
  }
  if (category === 'storage') {
    return '/setup#storage';
  }
  if (category === 'maps') {
    return '/setup#maps';
  }
  if (category === 'mobile-release') {
    return '/setup#mobile-release';
  }

  return '/setup';
}

function InfoRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        <div className="muted">{detail}</div>
      </td>
      <td>{value}</td>
    </tr>
  );
}

function buildMatchingControlRoom(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  settings: AdminOperationalPolicySetting[],
) {
  const openMatching = bookings
    .filter((booking) => booking.status === 'OPEN_MATCHING')
    .sort(
      (left, right) =>
        Date.parse(left.expiresAt ?? left.createdAt ?? '') -
        Date.parse(right.expiresAt ?? right.createdAt ?? ''),
    );
  const responseWindowMinutes =
    dashboardPolicyNumberValue(settings, 'matching.provider_response_window_minutes') ?? 10;
  const backupRadiusMeters =
    dashboardPolicyNumberValue(settings, 'matching.backup_provider_radius_meters') ?? 10000;
  const backupOpenMode =
    dashboardPolicyStringValue(settings, 'matching.backup_open_mode') ?? 'IMMEDIATE_WITHIN_WINDOW';
  const freshOnlinePartners = providers.filter(
    (provider) =>
      provider.status.startsWith('ONLINE') &&
      !provider.blockedAt &&
      parseCoordinatePair(provider.currentLat, provider.currentLng) &&
      locationAgeMinutes(provider.currentLocationUpdatedAt) !== null &&
      (locationAgeMinutes(provider.currentLocationUpdatedAt) ?? Infinity) <= 30,
  );
  const openRows = openMatching.slice(0, 8).map((booking) => {
    const coordinate = parseCoordinatePair(booking.lat, booking.lng);
    const eligiblePartners = coordinate
      ? providersWithinRadius(providers, coordinate.lat, coordinate.lng, backupRadiusMeters)
      : [];
    const freshEligible = eligiblePartners.filter((item) => (item.ageMinutes ?? Infinity) <= 30);
    const participantCount = booking.participants?.length ?? 0;
    const expired = booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false;
    const urgent = expired || freshEligible.length === 0;
    const detail = [
      bookingRegionLabel(booking),
      `first-pick ${booking.preferredProvider?.displayName ?? 'none'}`,
      `${participantCount} joined`,
      coordinate ? `${freshEligible.length}/${eligiblePartners.length} fresh eligible` : 'no customer pin',
      booking.expiresAt ? `timer ${timeUntilLabel(booking.expiresAt)}` : 'no timer',
    ].join(' / ');

    return {
      id: booking.id,
      title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
      detail,
      status: urgent ? 'Dispatch now' : 'Watch',
      pillClass: urgent ? 'pill-danger' : 'pill-warn',
      eligibleCount: eligiblePartners.length,
      freshEligibleCount: freshEligible.length,
      expired,
    };
  });
  const atRiskRows = openRows.filter((row) => row.expired || row.freshEligibleCount === 0);
  const averageEligible =
    openRows.length > 0
      ? (openRows.reduce((sum, row) => sum + row.eligibleCount, 0) / openRows.length).toFixed(1)
      : '0';
  const immediateBackup = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';

  return {
    openRows,
    healthLabel: atRiskRows.length ? `${atRiskRows.length} risk` : 'Stable',
    healthPillClass: atRiskRows.length ? 'pill-danger' : 'pill-success',
    metrics: [
      {
        label: 'Open matching',
        value: String(openMatching.length),
        helper: `${atRiskRows.length} booking(s) need dispatch review now.`,
      },
      {
        label: 'Policy timer',
        value: `${responseWindowMinutes} min`,
        helper: 'First-pick partner response window for new bookings.',
      },
      {
        label: 'Backup radius',
        value: formatDistance(backupRadiusMeters),
        helper: `${averageEligible} average eligible partner(s) in shown open requests.`,
      },
      {
        label: 'Fresh online supply',
        value: String(freshOnlinePartners.length),
        helper: 'Online partners with a location update in the last 30 minutes.',
      },
    ],
    checks: [
      {
        status: atRiskRows.length ? 'Action needed' : 'Clear',
        title: 'Timer and supply risk',
        detail: atRiskRows.length
          ? `${atRiskRows.length} open matching booking(s) are expired or have no fresh eligible nearby partner.`
          : 'Open matching bookings have usable partner supply in the current sample.',
        operatorAction: atRiskRows.length
          ? 'Open the affected bookings, contact partners, or widen/refresh supply before customer wait grows.'
          : 'Keep monitoring response speed and participant depth.',
        className: atRiskRows.length ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: atRiskRows.length ? 'pill-danger' : 'pill-success',
      },
      {
        status: immediateBackup ? 'Visible early' : 'Delayed',
        title: 'Backup participation mode',
        detail: immediateBackup
          ? 'Nearby partners can appear during the first-pick response window.'
          : 'Backup partners wait until the first-pick window closes.',
        operatorAction: immediateBackup
          ? 'This supports the current customer anxiety-reduction direction.'
          : 'Use this only when first-pick partner response rate is strong enough.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        status: freshOnlinePartners.length ? 'Location ready' : 'Location gap',
        title: 'Partner app location freshness',
        detail: freshOnlinePartners.length
          ? `${freshOnlinePartners.length} online partner(s) have fresh location data.`
          : 'No online partner has a fresh location update in the current admin sample.',
        operatorAction: freshOnlinePartners.length
          ? 'This is enough to validate the low-cost last-location model.'
          : 'Ask partners to open the app so the 10-minute location update flow can seed matching.',
        className: freshOnlinePartners.length ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: freshOnlinePartners.length ? 'pill-success' : 'pill-danger',
      },
    ],
  };
}

function dashboardPolicyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = settings.find((setting) => setting.key === key)?.value;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function dashboardPolicyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = settings.find((setting) => setting.key === key)?.value;
  return typeof raw === 'string' ? raw : null;
}

function providersWithinRadius(providers: AdminProvider[], lat: number, lng: number, radiusMeters: number) {
  return providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(lat, lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
      };
    })
    .filter(
      (item) =>
        item.provider.status.startsWith('ONLINE') &&
        !item.provider.blockedAt &&
        item.distanceMeters !== null &&
        item.distanceMeters <= radiusMeters &&
        item.ageMinutes !== null &&
        item.ageMinutes <= 24 * 60,
    )
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity));
}

function bookingServiceLabel(booking: AdminBooking) {
  const service = booking.services?.[0];
  const name = service?.service?.name ?? 'Booking';
  const duration = service?.service?.durationMin ? `${service.service.durationMin} min` : null;
  return duration ? `${name} (${duration})` : name;
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = typeof lat === 'number' ? lat : typeof lat === 'string' ? Number(lat) : NaN;
  const parsedLng = typeof lng === 'number' ? lng : typeof lng === 'string' ? Number(lng) : NaN;
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }
  if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const startLat = degreesToRadians(fromLat);
  const endLat = degreesToRadians(toLat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function timeUntilLabel(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes < 60) {
    return `${minutes}m left`;
  }
  return `${Math.round(minutes / 60)}h left`;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}

function buildBookingOpsInsights(bookings: AdminBooking[]) {
  const expired = bookings.filter((booking) => booking.status === 'EXPIRED');
  const noShowFormal = bookings.filter((booking) => booking.status === 'NO_SHOW');
  const completedCloseoutRisk = bookings.filter(completedCloseoutNeedsOps);

  return {
    total: bookings.length,
    openMatching: bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length,
    active: bookings.filter((booking) => activeBookingStatuses.has(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    cancelled: bookings.filter((booking) => booking.status === 'CANCELLED').length,
    expired: expired.length,
    refunded: bookings.filter((booking) => booking.status === 'REFUNDED').length,
    noShowFormal: noShowFormal.length,
    noShowSignal: bookings.filter(isNoShowSignal).length,
    completedCloseoutRisk: completedCloseoutRisk.length,
  };
}

function buildBookingOperationsDeepDive(bookings: AdminBooking[], payments: AdminPayment[]) {
  const activeOrMatching = bookings.filter(
    (booking) => activeBookingStatuses.has(booking.status) || booking.status === 'OPEN_MATCHING',
  );
  const participantCount = activeOrMatching.reduce(
    (sum, booking) => sum + (booking.participants?.length ?? 0),
    0,
  );
  const expiredOpenMatching = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      Boolean(booking.expiresAt) &&
      Date.parse(booking.expiresAt ?? '') < Date.now(),
  ).length;
  const openWithoutParticipants = bookings.filter(
    (booking) => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
  ).length;
  const matchedWithoutChat = bookings.filter(
    (booking) => booking.status === 'MATCHED' && !booking.chatRoom,
  ).length;
  const quietActiveChats = bookings.filter(
    (booking) =>
      Boolean(booking.chatRoom) &&
      (booking.chatRoom?.messages?.length ?? 0) === 0 &&
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  ).length;
  const releaseRisk = bookings.filter(
    (booking) =>
      ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status) && unresolvedReleasePayment(booking),
  ).length;
  const captureRisk = payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED',
  ).length;
  const manualCloseout = bookings.filter(
    (booking) => completedCloseoutNeedsOps(booking) || isNoShowSignal(booking),
  ).length;

  return {
    expiredOpenMatching,
    openWithoutParticipants,
    matchedWithoutChat,
    quietActiveChats,
    releaseRisk,
    captureRisk,
    averageParticipants: activeOrMatching.length
      ? (participantCount / activeOrMatching.length).toFixed(1)
      : '0.0',
    manualCloseout,
    serviceDemand: buildServiceDemandMix(bookings),
    paymentMix: buildPaymentMethodMix(payments),
  };
}

function buildServiceDemandMix(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      label: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      amount: number;
      averagePrice: number;
    }
  >();

  for (const booking of bookings) {
    for (const bookingService of booking.services ?? []) {
      const service = bookingService.service;
      const label = `${service?.name ?? 'Unknown service'} / ${service?.durationMin ?? '?'} min`;
      const quantity = bookingService.quantity ?? 1;
      const price = bookingService.price ?? service?.basePrice ?? 0;
      const bucket = buckets.get(label) ?? {
        label,
        total: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        amount: 0,
        averagePrice: 0,
      };

      bucket.total += quantity;
      bucket.amount += price * quantity;
      if (activeBookingStatuses.has(booking.status)) bucket.active += quantity;
      if (booking.status === 'COMPLETED') bucket.completed += quantity;
      if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) bucket.cancelled += quantity;
      bucket.averagePrice = bucket.total ? Math.round(bucket.amount / bucket.total) : 0;
      buckets.set(label, bucket);
    }
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || right.amount - left.amount)
    .slice(0, 6);
}

function buildPaymentMethodMix(payments: AdminPayment[]) {
  const buckets = new Map<
    string,
    {
      method: string;
      count: number;
      amount: number;
      currency: string;
      authorized: number;
      pending: number;
      captured: number;
      released: number;
      refunded: number;
      riskCount: number;
    }
  >();

  for (const payment of payments) {
    const method = payment.method ?? 'UNKNOWN';
    const bucket = buckets.get(method) ?? {
      method,
      count: 0,
      amount: 0,
      currency: payment.currency ?? 'VND',
      authorized: 0,
      pending: 0,
      captured: 0,
      released: 0,
      refunded: 0,
      riskCount: 0,
    };
    bucket.count += 1;
    bucket.amount += payment.amount ?? 0;
    if (payment.status === 'AUTHORIZED') bucket.authorized += 1;
    if (payment.status === 'PENDING') bucket.pending += 1;
    if (payment.status === 'CAPTURED') bucket.captured += 1;
    if (payment.status === 'RELEASED') bucket.released += 1;
    if (payment.status === 'REFUNDED') bucket.refunded += 1;
    if (
      (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') ||
      (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(payment.booking?.status ?? '') &&
        !['RELEASED', 'REFUNDED'].includes(payment.status))
    ) {
      bucket.riskCount += 1;
    }
    buckets.set(method, bucket);
  }

  return [...buckets.values()].sort((left, right) => right.count - left.count || right.amount - left.amount);
}

function buildAppPresence(users: AdminUser[], bookings: AdminBooking[], sessions: AdminAppSession[]) {
  const customers = users.filter((user) => Boolean(user.customerProfile));
  const customerSessions = sessions.filter((session) => session.role === 'CUSTOMER');
  const partnerSessions = sessions.filter((session) => session.role === 'PROVIDER');
  const liveCustomerUserIds = new Set(
    customerSessions
      .filter((session) => appSessionState(session) === 'live')
      .map((session) => session.userId),
  );
  const livePartnerUserIds = new Set(
    partnerSessions.filter((session) => appSessionState(session) === 'live').map((session) => session.userId),
  );
  const recentCustomerSessions = customerSessions.filter(
    (session) => appSessionState(session) === 'recent',
  ).length;
  const staleCustomerSessions = customerSessions.filter(
    (session) => appSessionState(session) === 'stale',
  ).length;
  const reachableCustomers = customers.filter((user) =>
    (user.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const disabledPushCustomers = customers.filter(
    (user) =>
      (user.pushDevices ?? []).length > 0 && !(user.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const activeBookingCustomers = new Set(
    bookings
      .filter((booking) => activeBookingStatuses.has(booking.status))
      .map((booking) => booking.customerProfile?.user?.phone)
      .filter(Boolean),
  ).size;

  return {
    totalCustomers: customers.length,
    liveAppCustomers: liveCustomerUserIds.size,
    liveAppPartners: livePartnerUserIds.size,
    recentCustomerSessions,
    staleCustomerSessions,
    reachableCustomers,
    disabledPushCustomers,
    activeBookingCustomers,
  };
}

function buildPartnerSupplyInsights(
  providers: AdminProvider[],
  bookings: AdminBooking[],
  sessions: AdminAppSession[],
  cashDebtRows: AdminEarning[],
  cashSettlementSummary: AdminCashSettlementSummary,
) {
  const now = Date.now();
  const partnerSessions = sessions.filter((session) => session.role === 'PROVIDER');
  const livePartnerUserIds = new Set(
    partnerSessions.filter((session) => appSessionState(session) === 'live').map((session) => session.userId),
  );
  const cashDebtPartnerIds = new Set(cashDebtRows.map((earning) => earning.providerProfileId));
  const activeDemand = bookings.filter((booking) => activeBookingStatuses.has(booking.status)).length;
  const onlineAvailable = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const firstRevenuePartners = providers.filter(providerHasFirstRevenue);

  const staleLocation = providers.filter((provider) => {
    if (!provider.currentLocationUpdatedAt) {
      return false;
    }
    const updatedAt = Date.parse(provider.currentLocationUpdatedAt);
    return Number.isFinite(updatedAt) && now - updatedAt > 30 * 60_000;
  }).length;

  const noLocation = providers.filter(
    (provider) =>
      provider.currentLat === null ||
      provider.currentLat === undefined ||
      provider.currentLng === null ||
      provider.currentLng === undefined,
  ).length;

  return {
    total: providers.length,
    online: providers.filter((provider) => provider.status.startsWith('ONLINE')).length,
    onlineAvailable,
    onlineBusy: providers.filter((provider) => provider.status === 'ONLINE_BUSY').length,
    onlineAvailableSoon: providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE_SOON').length,
    offline: providers.filter((provider) => provider.status === 'OFFLINE').length,
    liveSessions: livePartnerUserIds.size,
    staleLocation,
    noLocation,
    cashDebtPartners: cashSettlementSummary.providerCount,
    pendingVerification: providers.filter((provider) => provider.verification?.status === 'SUBMITTED').length,
    approvedVerification: providers.filter((provider) => provider.verification?.status === 'APPROVED').length,
    kycApproved: providers.filter((provider) => provider.kyc?.status === 'APPROVED').length,
    bankApproved: providers.filter((provider) =>
      (provider.bankAccounts ?? []).some((account) => account.isPrimary && account.status === 'APPROVED'),
    ).length,
    firstRevenue: firstRevenuePartners.length,
    taxReadyAfterRevenue: firstRevenuePartners.filter(
      (provider) => provider.taxProfile?.status === 'APPROVED',
    ).length,
    trusted: providers.filter((provider) => provider.level === 'LEVEL_4_TRUSTED' || provider.trustedAt)
      .length,
    blocked: providers.filter((provider) => {
      const activeSanction = (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE');
      return Boolean(provider.blockedAt) || activeSanction || cashDebtPartnerIds.has(provider.id);
    }).length,
    supplyPressureLabel:
      onlineAvailable > 0 ? `${(activeDemand / onlineAvailable).toFixed(1)}x` : 'No supply',
  };
}

function buildPartnerOpsQueue(
  providers: AdminProvider[],
  cashDebtRows: AdminEarning[],
  sessions: AdminAppSession[],
) {
  const cashDebtByPartner = new Map<string, number>();
  for (const earning of cashDebtRows) {
    cashDebtByPartner.set(
      earning.providerProfileId,
      (cashDebtByPartner.get(earning.providerProfileId) ?? 0) + Math.abs(earning.netAmount),
    );
  }

  const livePartnerUserIds = new Set(
    sessions
      .filter((session) => session.role === 'PROVIDER' && appSessionState(session) === 'live')
      .map((session) => session.userId),
  );

  const items = providers
    .map((partner) => buildPartnerOpsQueueItem(partner, cashDebtByPartner, livePartnerUserIds))
    .filter((item): item is PartnerOpsQueueItem => Boolean(item))
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    .slice(0, 8);

  return {
    items,
    blockedNow: providers.filter((partner) => {
      const hasCashDebt = (cashDebtByPartner.get(partner.id) ?? 0) > 0;
      const hasActiveSanction = (partner.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE');
      return hasCashDebt || Boolean(partner.blockedAt) || hasActiveSanction;
    }).length,
    payoutSetup: providers.filter((partner) => partnerNeedsFirstRevenueSetup(partner)).length,
    locationIssue: providers.filter((partner) => partnerLocationState(partner) !== 'recent').length,
    contactIssue: providers.filter((partner) => partnerContactState(partner, livePartnerUserIds) !== 'ready')
      .length,
  };
}

function buildPartnerOpsQueueItem(
  partner: AdminProvider,
  cashDebtByPartner: Map<string, number>,
  livePartnerUserIds: Set<string | undefined>,
): PartnerOpsQueueItem | null {
  const cashDebt = cashDebtByPartner.get(partner.id) ?? 0;
  const activeSanctions = (partner.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const locationState = partnerLocationState(partner);
  const contactState = partnerContactState(partner, livePartnerUserIds);
  const name = partnerDisplayName(partner);
  const href = `/providers/${partner.id}`;
  const metrics = [
    partnerOpsMetric('status', partner.status.replace('ONLINE_', '').toLowerCase(), 'info'),
    partnerOpsMetric('location', locationState, locationState === 'recent' ? 'ok' : 'warn'),
    partnerOpsMetric('contact', contactState, contactState === 'ready' ? 'ok' : 'warn'),
  ];

  if (cashDebt > 0) {
    return {
      id: `${partner.id}-cash-debt`,
      name,
      status: 'Cash debt block',
      detail:
        'Partner wallet is negative from cash fee/tax debt. Booking acceptance should stay blocked until finance records a deposit or offset.',
      action: 'Open partner finance',
      href,
      className: 'ops-task-blocked',
      priority: 110,
      metrics: [partnerOpsMetric('debt', money(cashDebt), 'danger'), ...metrics],
    };
  }

  if (partner.blockedAt || activeSanctions.length > 0) {
    return {
      id: `${partner.id}-risk-block`,
      name,
      status: partner.blockedAt ? 'Account blocked' : 'Active sanction',
      detail: partner.blockedReason
        ? `Account control is active: ${partner.blockedReason}`
        : 'Risk control is active. Review reports, sanctions, and payout holds before dispatch.',
      action: 'Open risk review',
      href: `/partner-risk?q=${encodeURIComponent(partner.id)}`,
      className: 'ops-task-blocked',
      priority: 105,
      metrics: [partnerOpsMetric('sanctions', activeSanctions.length.toString(), 'danger'), ...metrics],
    };
  }

  if (partnerNeedsFirstRevenueSetup(partner)) {
    return {
      id: `${partner.id}-first-revenue-setup`,
      name,
      status: 'First revenue setup',
      detail:
        'Partner has earned money. Collect tax profile, residential address, and payout/tax agreement before payout release.',
      action: 'Open payout setup',
      href,
      className: 'ops-task-pending',
      priority: 85,
      metrics: [
        partnerOpsMetric(
          'tax',
          partner.taxProfile?.status ?? 'missing',
          partner.taxProfile?.status === 'APPROVED' ? 'ok' : 'warn',
        ),
        partnerOpsMetric(
          'agreements',
          `${partner.agreements?.length ?? 0}/5`,
          (partner.agreements?.length ?? 0) >= 5 ? 'ok' : 'warn',
        ),
        ...metrics,
      ],
    };
  }

  if (partner.verification?.status === 'SUBMITTED' || partner.kyc?.status === 'PENDING') {
    return {
      id: `${partner.id}-verification`,
      name,
      status: 'Verification review',
      detail:
        'Partner is waiting for admin review. Clear KYC, documents, and bank readiness to expand supply.',
      action: 'Open review',
      href: '/providers?verification=SUBMITTED',
      className: 'ops-task-pending',
      priority: 70,
      metrics: [
        partnerOpsMetric('verification', partner.verification?.status ?? 'missing', 'warn'),
        partnerOpsMetric(
          'kyc',
          partner.kyc?.status ?? 'missing',
          partner.kyc?.status === 'APPROVED' ? 'ok' : 'warn',
        ),
        ...metrics,
      ],
    };
  }

  if (locationState !== 'recent' && partner.status.startsWith('ONLINE')) {
    return {
      id: `${partner.id}-location`,
      name,
      status: 'Location weak',
      detail: 'Partner is online but location is stale, expired, or missing. Dispatch distance may be wrong.',
      action: 'Open location review',
      href: '/providers?review=location',
      className: 'ops-task-pending',
      priority: 55,
      metrics,
    };
  }

  if (contactState !== 'ready' && partner.status.startsWith('ONLINE')) {
    return {
      id: `${partner.id}-contact`,
      name,
      status: 'Contact weak',
      detail:
        'Partner appears online but app session or push readiness is weak. Booking alerts may not arrive.',
      action: 'Open push/session review',
      href: '/providers?review=push',
      className: 'ops-task-pending',
      priority: 45,
      metrics,
    };
  }

  return null;
}

function partnerNeedsFirstRevenueSetup(partner: AdminProvider) {
  if (!providerHasFirstRevenue(partner)) {
    return false;
  }
  const hasTax = partner.taxProfile?.status === 'APPROVED';
  const hasAddress = Boolean(partner.residentialAddress?.trim());
  const hasAgreements = (partner.agreements?.length ?? 0) >= 5;
  return !hasTax || !hasAddress || !hasAgreements;
}

function partnerLocationState(partner: AdminProvider) {
  const hasCoordinate =
    Number.isFinite(Number(partner.currentLat)) && Number.isFinite(Number(partner.currentLng));
  if (!hasCoordinate || !partner.currentLocationUpdatedAt) {
    return 'missing';
  }
  const updatedAt = Date.parse(partner.currentLocationUpdatedAt);
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }
  const ageMs = Date.now() - updatedAt;
  if (ageMs <= 30 * 60_000) {
    return 'recent';
  }
  if (ageMs <= 24 * 60 * 60_000) {
    return 'stale';
  }
  return 'expired';
}

function partnerContactState(partner: AdminProvider, livePartnerUserIds: Set<string | undefined>) {
  const hasLiveSession = partner.user?.id ? livePartnerUserIds.has(partner.user.id) : false;
  const hasEnabledPush = (partner.user?.pushDevices ?? []).some((device) => device.enabled);
  if (hasLiveSession && hasEnabledPush) {
    return 'ready';
  }
  if (hasLiveSession) {
    return 'push missing';
  }
  if (hasEnabledPush) {
    return 'not live';
  }
  return 'not contactable';
}

function partnerOpsMetric(
  label: string,
  value: string,
  tone: PartnerOpsQueueItem['metrics'][number]['tone'],
) {
  return { label, value, tone };
}

function partnerDisplayName(partner: AdminProvider) {
  return (
    partner.displayName ||
    partner.activityNickname ||
    partner.user?.fullName ||
    partner.user?.phone ||
    partner.id
  );
}

function providerHasFirstRevenue(provider: AdminProvider) {
  return (provider.earnings ?? []).some((earning) =>
    ['AVAILABLE', 'PENDING', 'PAID', 'HELD'].includes(earning.status),
  );
}

function appSessionState(session: AdminAppSession) {
  if (session.active && session.expiresAt && Date.parse(session.expiresAt) >= Date.now()) {
    return 'live';
  }

  const lastSeen = Date.parse(session.lastSeenAt);
  if (!Number.isFinite(lastSeen)) {
    return 'expired';
  }

  const ageMs = Date.now() - lastSeen;
  if (ageMs <= 30 * 60_000) {
    return 'recent';
  }
  if (ageMs <= 24 * 60 * 60_000) {
    return 'stale';
  }
  return 'expired';
}

function buildHourlyBookingDemand(bookings: AdminBooking[]) {
  const hourFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
  const buckets = new Map<
    string,
    { hour: string; total: number; active: number; completed: number; cancelled: number }
  >();

  for (const booking of bookings) {
    const timestamp = booking.scheduledStartAt ?? booking.createdAt;
    if (!timestamp) continue;
    const hour = `${hourFormatter.format(new Date(timestamp))}:00`;
    const bucket = buckets.get(hour) ?? { hour, total: 0, active: 0, completed: 0, cancelled: 0 };
    bucket.total += 1;
    if (activeBookingStatuses.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    buckets.set(hour, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.hour.localeCompare(right.hour))
    .slice(0, 8);
}

function buildRegionalBookingDemand(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      region: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      noShowSignal: number;
    }
  >();

  for (const booking of bookings) {
    const region = bookingRegionLabel(booking);
    const bucket = buckets.get(region) ?? {
      region,
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      noShowSignal: 0,
    };
    bucket.total += 1;
    if (activeBookingStatuses.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    if (isNoShowSignal(booking)) bucket.noShowSignal += 1;
    buckets.set(region, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.region.localeCompare(right.region))
    .slice(0, 8);
}

function isNoShowSignal(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW') {
    return true;
  }
  if (booking.status === 'EXPIRED') {
    return true;
  }
  if (booking.status !== 'MATCHED' || !booking.scheduledStartAt) {
    return false;
  }
  const scheduledAt = Date.parse(booking.scheduledStartAt);
  return Number.isFinite(scheduledAt) && scheduledAt + 30 * 60_000 < Date.now() && !booking.chatRoom;
}

function bookingRegionLabel(booking: AdminBooking) {
  const address = readAddressText(booking.address);
  if (!address) {
    if (Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng))) {
      return 'Pinned location';
    }
    return 'Unknown region';
  }

  const normalized = address.replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const knownCity = parts.find((part) =>
    /ho chi minh|hcmc|saigon|sai gon|da nang|ha noi|hanoi|nha trang|da lat|dalat|can tho/i.test(part),
  );
  return knownCity ?? parts.at(-2) ?? parts.at(-1) ?? 'Unknown region';
}

function readAddressText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const direct =
      objectValue.addressText ??
      objectValue.address_text ??
      objectValue.formatted ??
      objectValue.formattedAddress ??
      objectValue.label;
    return typeof direct === 'string' ? direct : null;
  }
  return null;
}

type DashboardCommandSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  pillClass: string;
  priority: number;
  severity: 'high' | 'medium' | 'low';
  breakdown: Array<{
    label: string;
    value: string;
    tone: 'ok' | 'info' | 'warn' | 'danger';
    href?: string;
  }>;
};

function buildDashboardCommandSignals(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
  earningRows: AdminEarning[];
  cashSettlementSummary: AdminCashSettlementSummary;
  payoutBatches: AdminPayoutBatch[];
  externalReadiness: AdminExternalReadiness;
}): DashboardCommandSignal[] {
  const openMatching = input.bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const staleOpenMatching = openMatching.filter((booking) =>
    booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false,
  );
  const quietChatRooms = input.bookings.filter(
    (booking) =>
      booking.chatRoom &&
      (booking.chatRoom.messages?.length ?? 0) === 0 &&
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const matchedWithoutChat = input.bookings.filter(
    (booking) => booking.status === 'MATCHED' && !booking.chatRoom,
  );
  const formalExpired = input.bookings.filter((booking) => booking.status === 'EXPIRED');
  const formalNoShow = input.bookings.filter((booking) => booking.status === 'NO_SHOW');
  const expiredPaymentRisk = formalExpired.filter((booking) => unresolvedReleasePayment(booking));
  const noShowPaymentRisk = formalNoShow.filter((booking) => unresolvedReleasePayment(booking));
  const completedCloseoutRisk = input.bookings.filter(completedCloseoutNeedsOps);
  const submittedVerification = input.providers.filter(
    (provider) => provider.verification?.status === 'SUBMITTED',
  );
  const submittedKyc = input.providers.filter((provider) => provider.kyc?.status === 'SUBMITTED');
  const openProviderReports = input.providers.filter((provider) =>
    (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)),
  );
  const activeProviderSanctions = input.providers.filter((provider) =>
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE'),
  );
  const providerReviews = input.providers.filter(
    (provider) =>
      provider.verification?.status === 'SUBMITTED' ||
      provider.kyc?.status === 'SUBMITTED' ||
      (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
      (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE'),
  );
  const completedAuthorized = input.payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED',
  );
  const missingGatewayRef = input.payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && !payment.providerRef,
  );
  const cashPending = input.payments.filter(
    (payment) => payment.method === 'CASH' && payment.status === 'PENDING',
  );
  const cashDebtRows = openCashDebtEarnings(input.earningRows);
  const cashDebtRowCount = input.cashSettlementSummary.rowCount;
  const cashDebtProviderCount = input.cashSettlementSummary.providerCount;
  const cashDebtAmount = input.cashSettlementSummary.totalDebtAmount;
  const openRefunds = input.refunds.filter((refund) => refund.status !== 'COMPLETED');
  const paymentReviews =
    completedCloseoutRisk.length +
    expiredPaymentRisk.length +
    noShowPaymentRisk.length +
    missingGatewayRef.length +
    cashPending.length +
    openRefunds.length;
  const payoutHolds = input.payoutBatches.filter((batch) => Boolean(activePayoutHold(batch)));
  const payoutReviews = input.payoutBatches.filter((batch) =>
    ['DRAFT', 'FAILED', 'PROCESSING'].includes(batch.status),
  );
  const failedPayouts = input.payoutBatches.filter((batch) => batch.status === 'FAILED');
  const processingPayouts = input.payoutBatches.filter((batch) => batch.status === 'PROCESSING');
  const disabledPushProviders = input.providers.filter(
    (provider) => (provider.user?.pushDevices ?? []).filter((device) => device.enabled === false).length > 0,
  );
  const failedNotifications = input.notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const setupBlocked = input.earnings.availableNetAmount > 0 && payoutReviews.length === 0;
  const readinessUnavailable = !input.externalReadiness.ok && input.externalReadiness.checks.length === 0;
  const blockedExternal = input.externalReadiness.checks.filter((check) => check.status === 'BLOCKED');
  const partialExternal = input.externalReadiness.checks.filter((check) => check.status === 'PARTIAL');
  const missingExternal = input.externalReadiness.checks.reduce(
    (count, check) => count + check.missing.length + (check.invalid?.length ?? 0),
    0,
  );
  const externalNeedsSetup = readinessUnavailable || blockedExternal.length > 0 || partialExternal.length > 0;

  const signals: DashboardCommandSignal[] = [
    {
      title: 'Dispatch lane',
      status: staleOpenMatching.length
        ? `${staleOpenMatching.length} EXPIRED`
        : `${openMatching.length} OPEN`,
      detail: staleOpenMatching.length
        ? 'Some open matching windows are expired and need operator review.'
        : 'Monitor open matching, quiet chat rooms, and partner assignment.',
      action: 'Open booking monitor',
      href: staleOpenMatching.length || matchedWithoutChat.length ? '/bookings?view=high-risk' : '/bookings',
      priority: staleOpenMatching.length || matchedWithoutChat.length ? 95 : openMatching.length ? 70 : 25,
      severity:
        staleOpenMatching.length || matchedWithoutChat.length
          ? 'high'
          : openMatching.length
            ? 'medium'
            : 'low',
      className: staleOpenMatching.length
        ? 'ops-task-blocked'
        : openMatching.length
          ? 'ops-task-pending'
          : 'ops-task-done',
      pillClass: staleOpenMatching.length
        ? 'pill-danger'
        : openMatching.length
          ? 'pill-warn'
          : 'pill-success',
      breakdown: [
        {
          label: 'Open matching',
          value: openMatching.length.toString(),
          tone: openMatching.length ? 'warn' : 'ok',
          href: '/bookings?view=active',
        },
        {
          label: 'Expired windows',
          value: staleOpenMatching.length.toString(),
          tone: staleOpenMatching.length ? 'danger' : 'ok',
          href: '/bookings?view=high-risk',
        },
        {
          label: 'Formal expired',
          value: formalExpired.length.toString(),
          tone: formalExpired.length ? 'warn' : 'ok',
          href: '/bookings?status=EXPIRED',
        },
        {
          label: 'No-show',
          value: formalNoShow.length.toString(),
          tone: formalNoShow.length ? 'warn' : 'ok',
          href: '/bookings?status=NO_SHOW',
        },
        {
          label: 'Quiet chats',
          value: quietChatRooms.length.toString(),
          tone: quietChatRooms.length ? 'info' : 'ok',
          href: '/bookings?view=chat',
        },
        {
          label: 'Matched no chat',
          value: matchedWithoutChat.length.toString(),
          tone: matchedWithoutChat.length ? 'danger' : 'ok',
          href: '/bookings?view=high-risk',
        },
      ],
    },
    {
      title: 'Partner lane',
      status: `${providerReviews.length} REVIEW`,
      detail: providerReviews.length
        ? 'Partner verification, risk reports, sanctions, or KYC needs admin attention.'
        : 'No partner review blocker in the current snapshot.',
      action: 'Open partners',
      href: '/providers',
      priority:
        activeProviderSanctions.length || openProviderReports.length ? 90 : providerReviews.length ? 65 : 20,
      severity:
        activeProviderSanctions.length || openProviderReports.length
          ? 'high'
          : providerReviews.length
            ? 'medium'
            : 'low',
      className: providerReviews.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: providerReviews.length ? 'pill-warn' : 'pill-success',
      breakdown: [
        {
          label: 'Verification',
          value: submittedVerification.length.toString(),
          tone: submittedVerification.length ? 'warn' : 'ok',
          href: '/providers?verification=SUBMITTED',
        },
        {
          label: 'KYC',
          value: submittedKyc.length.toString(),
          tone: submittedKyc.length ? 'warn' : 'ok',
          href: '/providers?review=kyc',
        },
        {
          label: 'Risk reports',
          value: openProviderReports.length.toString(),
          tone: openProviderReports.length ? 'danger' : 'ok',
          href: '/partner-risk?status=OPEN',
        },
        {
          label: 'Active sanctions',
          value: activeProviderSanctions.length.toString(),
          tone: activeProviderSanctions.length ? 'danger' : 'ok',
          href: '/partner-risk?sanction=ACTIVE',
        },
      ],
    },
    {
      title: 'Payment lane',
      status: `${paymentReviews} REVIEW`,
      detail: paymentReviews
        ? 'Payment holds, missing refs, cash collection, completed closeout, expired/no-show release, or refunds need review.'
        : 'Payment and refund queues are quiet.',
      action: 'Open payments',
      href: completedCloseoutRisk.length
        ? '/bookings?view=closeout'
        : cashPending.length
          ? '/payments?review=cash'
          : '/payments',
      priority:
        completedCloseoutRisk.length || expiredPaymentRisk.length || noShowPaymentRisk.length
          ? 100
          : completedAuthorized.length
            ? 95
            : cashPending.length
              ? 85
              : paymentReviews
                ? 80
                : 20,
      severity:
        completedCloseoutRisk.length || expiredPaymentRisk.length || noShowPaymentRisk.length
          ? 'high'
          : paymentReviews
            ? 'medium'
            : 'low',
      className: paymentReviews ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: paymentReviews ? 'pill-danger' : 'pill-success',
      breakdown: [
        {
          label: 'Closeout risk',
          value: completedCloseoutRisk.length.toString(),
          tone: completedCloseoutRisk.length ? 'danger' : 'ok',
          href: '/bookings?view=closeout',
        },
        {
          label: 'Missing refs',
          value: missingGatewayRef.length.toString(),
          tone: missingGatewayRef.length ? 'warn' : 'ok',
          href: '/payments?review=missing-ref',
        },
        {
          label: 'Cash pending',
          value: cashPending.length.toString(),
          tone: cashPending.length ? 'warn' : 'ok',
          href: '/payments?review=cash',
        },
        {
          label: 'Release risk',
          value: (expiredPaymentRisk.length + noShowPaymentRisk.length).toString(),
          tone: expiredPaymentRisk.length + noShowPaymentRisk.length ? 'danger' : 'ok',
          href: '/bookings?view=payment',
        },
        {
          label: 'Open refunds',
          value: openRefunds.length.toString(),
          tone: openRefunds.length ? 'warn' : 'ok',
          href: '/refunds?review=open',
        },
      ],
    },
    {
      title: 'Cash settlement lane',
      status: cashDebtRowCount ? `${cashDebtRowCount} DEBT` : 'CLEAR',
      detail: cashDebtRowCount
        ? `${money(cashDebtAmount, input.cashSettlementSummary.currency)} partner cash fee/tax debt across ${cashDebtProviderCount} partner(s) must be collected or offset before new booking acceptance.`
        : 'No open cash fee debt is blocking partner wallets.',
      action: 'Open cash settlements',
      href: '/cash-settlements',
      priority: cashDebtRowCount ? 94 : 12,
      severity: cashDebtRowCount ? 'high' : 'low',
      className: cashDebtRowCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtRowCount ? 'pill-danger' : 'pill-success',
      breakdown: [
        {
          label: 'Debt rows',
          value: cashDebtRowCount.toString(),
          tone: cashDebtRowCount ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Blocked partners',
          value: cashDebtProviderCount.toString(),
          tone: cashDebtProviderCount ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Wallet debt',
          value: money(cashDebtAmount, input.cashSettlementSummary.currency),
          tone: cashDebtAmount > 0 ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Over 24h',
          value: input.cashSettlementSummary.staleDebtRowCount.toString(),
          tone: input.cashSettlementSummary.staleDebtRowCount ? 'warn' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Cash pending',
          value: cashPending.length.toString(),
          tone: cashPending.length ? 'warn' : 'ok',
          href: '/payments?review=cash',
        },
      ],
    },
    {
      title: 'Payout lane',
      status: payoutHolds.length ? `${payoutHolds.length} HELD` : `${payoutReviews.length} OPEN`,
      detail: payoutHolds.length
        ? 'One or more payout batches are blocked by active partner sanctions.'
        : payoutReviews.length
          ? 'Draft, failed, or processing payout batches are waiting for finance movement.'
          : `${money(input.earnings.availableNetAmount, input.earnings.currency)} available from earnings.`,
      action: 'Open payouts',
      href: '/payouts',
      priority:
        payoutHolds.length || failedPayouts.length ? 92 : payoutReviews.length || setupBlocked ? 62 : 15,
      severity:
        payoutHolds.length || failedPayouts.length
          ? 'high'
          : payoutReviews.length || setupBlocked
            ? 'medium'
            : 'low',
      className: payoutHolds.length
        ? 'ops-task-blocked'
        : payoutReviews.length || setupBlocked
          ? 'ops-task-pending'
          : 'ops-task-done',
      pillClass: payoutHolds.length
        ? 'pill-danger'
        : payoutReviews.length || setupBlocked
          ? 'pill-warn'
          : 'pill-success',
      breakdown: [
        {
          label: 'Payout holds',
          value: payoutHolds.length.toString(),
          tone: payoutHolds.length ? 'danger' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Failed',
          value: failedPayouts.length.toString(),
          tone: failedPayouts.length ? 'danger' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Processing',
          value: processingPayouts.length.toString(),
          tone: processingPayouts.length ? 'info' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Available',
          value: money(input.earnings.availableNetAmount, input.earnings.currency),
          tone: input.earnings.availableNetAmount > 0 ? 'warn' : 'ok',
          href: '/earnings',
        },
      ],
    },
    {
      title: 'Notification lane',
      status: `${failedNotifications.length} FAILED`,
      detail: failedNotifications.length
        ? 'Retry failed notifications or inspect disabled devices before live operation.'
        : 'No failed delivery in the current notification window.',
      action: 'Open notifications',
      href: '/notifications',
      priority: failedNotifications.length ? 58 : disabledPushProviders.length ? 35 : 10,
      severity: failedNotifications.length ? 'medium' : 'low',
      className: failedNotifications.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: failedNotifications.length ? 'pill-warn' : 'pill-success',
      breakdown: [
        {
          label: 'Failed sends',
          value: failedNotifications.length.toString(),
          tone: failedNotifications.length ? 'warn' : 'ok',
          href: '/notifications?review=failed',
        },
        {
          label: 'Disabled devices',
          value: disabledPushProviders.length.toString(),
          tone: disabledPushProviders.length ? 'info' : 'ok',
          href: '/providers?review=push',
        },
      ],
    },
    {
      title: 'Setup lane',
      status: readinessUnavailable
        ? 'API CHECK'
        : blockedExternal.length
          ? `${blockedExternal.length} BLOCKED`
          : partialExternal.length
            ? `${partialExternal.length} PARTIAL`
            : 'READY',
      detail: readinessUnavailable
        ? 'The external readiness endpoint is unavailable, so setup state cannot be trusted yet.'
        : externalNeedsSetup
          ? 'External credentials or service registrations are still pending before real production-like E2E.'
          : 'External readiness checks are green for the current environment.',
      action: 'Open setup',
      href: '/setup',
      priority: readinessUnavailable || blockedExternal.length ? 88 : partialExternal.length ? 52 : 8,
      severity:
        readinessUnavailable || blockedExternal.length ? 'high' : partialExternal.length ? 'medium' : 'low',
      className:
        readinessUnavailable || blockedExternal.length
          ? 'ops-task-blocked'
          : partialExternal.length
            ? 'ops-task-pending'
            : 'ops-task-done',
      pillClass:
        readinessUnavailable || blockedExternal.length
          ? 'pill-danger'
          : partialExternal.length
            ? 'pill-warn'
            : 'pill-success',
      breakdown: [
        {
          label: 'Blocked',
          value: blockedExternal.length.toString(),
          tone: blockedExternal.length ? 'danger' : 'ok',
          href: '/setup',
        },
        {
          label: 'Partial',
          value: partialExternal.length.toString(),
          tone: partialExternal.length ? 'warn' : 'ok',
          href: '/setup',
        },
        {
          label: 'Missing values',
          value: missingExternal.toString(),
          tone: missingExternal ? 'warn' : 'ok',
          href: '/setup',
        },
      ],
    },
  ];

  return signals.sort(
    (left, right) => right.priority - left.priority || left.title.localeCompare(right.title),
  );
}

function buildOpsQueue(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
  earningRows: AdminEarning[];
  cashSettlementSummary: AdminCashSettlementSummary;
  payoutBatches: AdminPayoutBatch[];
}) {
  const items: OpsQueueItem[] = [];

  for (const booking of input.bookings) {
    const flags = bookingFlags(booking);
    for (const flag of flags) {
      items.push({
        area: 'Booking',
        href: `/bookings/${booking.id}`,
        label: flag.label,
        detail: `${booking.services?.[0]?.service?.name ?? 'Booking'} - ${shortId(booking.id)}`,
        severity: flag.severity,
        owner: 'Dispatch',
        priority: flag.priority,
        recommendedAction: flag.recommendedAction,
      });
    }
  }

  for (const payment of input.payments) {
    if (payment.status === 'AUTHORIZED' && !payment.providerRef) {
      items.push({
        area: 'Payment',
        href: `/payments#payment-${payment.id}`,
        label: 'Payment hold missing gateway reference',
        detail: `${money(payment.amount, payment.currency)} for booking ${shortId(payment.bookingId)}`,
        severity: 'medium',
        owner: 'Finance',
        priority: 66,
        recommendedAction: 'Check the gateway/admin reference before capture, release, or refund.',
      });
    }
    if (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') {
      items.push({
        area: 'Payment',
        href: `/payments#payment-${payment.id}`,
        label: 'Completed service still authorized',
        detail: `${money(payment.amount, payment.currency)} should be captured or reviewed.`,
        severity: 'high',
        owner: 'Finance',
        priority: 96,
        recommendedAction: 'Capture the completed service payment or open a manual payment review.',
      });
    }
  }

  for (const refund of input.refunds) {
    if (refund.status !== 'COMPLETED') {
      items.push({
        area: 'Payment',
        href: `/refunds#refund-${refund.id}`,
        label: 'Refund not completed',
        detail: `${money(refund.amount, refund.payment?.currency ?? 'VND')} for booking ${shortId(refund.bookingId)}`,
        severity: 'medium',
        owner: 'Finance',
        priority: 62,
        recommendedAction: 'Confirm refund status with the payment channel and update the refund record.',
      });
    }
  }

  if (input.cashSettlementSummary.rowCount > 0) {
    items.push({
      area: 'Finance',
      href: '/cash-settlements',
      label: 'Cash settlement queue blocking partners',
      detail: `${input.cashSettlementSummary.providerCount} partner(s) owe ${money(
        input.cashSettlementSummary.totalDebtAmount,
        input.cashSettlementSummary.currency,
      )} across ${input.cashSettlementSummary.rowCount} open debt row(s).`,
      severity: 'high',
      owner: 'Finance',
      priority: 100,
      recommendedAction:
        'Collect partner deposit or approve an auditable offset before allowing more cash work.',
    });
  }

  for (const earning of openCashDebtEarnings(input.earningRows).slice(0, 5)) {
    items.push({
      area: 'Finance',
      href: '/cash-settlements',
      label: 'Partner cash fee debt open',
      detail: `${earning.providerProfile?.displayName ?? 'Partner'} owes ${money(Math.abs(earning.netAmount), earning.currency)} before accepting more bookings.`,
      severity: 'high',
      owner: 'Finance',
      priority: 98,
      recommendedAction: 'Collect the company fee deposit or offset it before this partner accepts bookings.',
    });
  }

  for (const provider of input.providers) {
    if (provider.verification?.status === 'SUBMITTED') {
      items.push({
        area: 'Partner',
        href: `/providers/${provider.id}`,
        label: 'Partner verification waiting',
        detail: provider.displayName,
        severity: 'medium',
        owner: 'Partner Ops',
        priority: 56,
        recommendedAction: 'Open the partner profile and approve, reject, or request resubmission evidence.',
      });
    }
    const disabledDevices = provider.user?.pushDevices?.filter((device) => device.enabled === false) ?? [];
    if (disabledDevices.length > 0) {
      items.push({
        area: 'Notification',
        href: `/providers/${provider.id}`,
        label: 'Partner has disabled push device',
        detail: `${provider.displayName} has ${disabledDevices.length} disabled device(s).`,
        severity: 'low',
        owner: 'Support',
        priority: 28,
        recommendedAction: 'Review device delivery history and ask the partner to re-enable notifications.',
      });
    }
    const openReports = (provider.reports ?? []).filter((report) =>
      ['OPEN', 'INVESTIGATING'].includes(report.status),
    );
    if (openReports.length > 0) {
      items.push({
        area: 'Partner',
        href: `/providers/${provider.id}`,
        label: 'Partner risk report open',
        detail: `${provider.displayName} has ${openReports.length} open report(s).`,
        severity: openReports.some((report) => ['HIGH', 'CRITICAL'].includes(report.severity))
          ? 'high'
          : 'medium',
        owner: 'Partner Ops',
        priority: openReports.some((report) => ['HIGH', 'CRITICAL'].includes(report.severity)) ? 89 : 64,
        recommendedAction: 'Open the risk case, contact support evidence, and decide sanction or closure.',
      });
    }
    const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
    if (activeSanctions.length > 0) {
      items.push({
        area: 'Partner',
        href: `/providers/${provider.id}`,
        label: 'Partner active sanction',
        detail: `${provider.displayName} has ${activeSanctions.length} active sanction(s).`,
        severity: activeSanctions.some(
          (sanction) => sanction.type === 'PAYOUT_HOLD' || sanction.type === 'ACCOUNT_BLOCK',
        )
          ? 'high'
          : 'medium',
        owner: 'Partner Ops',
        priority: activeSanctions.some(
          (sanction) => sanction.type === 'PAYOUT_HOLD' || sanction.type === 'ACCOUNT_BLOCK',
        )
          ? 94
          : 67,
        recommendedAction:
          'Confirm whether the sanction should continue before dispatch or payout decisions.',
      });
    }
  }

  for (const notification of input.notifications) {
    const failed = (notification.deliveries ?? []).filter((delivery) => delivery.status === 'FAILED');
    if (failed.length > 0) {
      items.push({
        area: 'Notification',
        href: `/notifications#notification-${notification.id}`,
        label: 'Notification delivery failed',
        detail: `${notification.title} - ${failed.length} failed attempt(s)`,
        severity: 'medium',
        owner: 'Support',
        priority: 46,
        recommendedAction: 'Retry delivery or disable stale devices so operations do not assume delivery.',
      });
    }
  }

  if (input.earnings.availableNetAmount > 0) {
    items.push({
      area: 'Payout',
      href: '/payouts',
      label: 'Partner payout can be prepared',
      detail: `${money(input.earnings.availableNetAmount, input.earnings.currency)} available for batching.`,
      severity: 'low',
      owner: 'Finance',
      priority: 24,
      recommendedAction: 'Create the next payout batch after checking holds, cash debt, and tax logs.',
    });
  }

  for (const batch of input.payoutBatches) {
    const payoutHold = activePayoutHold(batch);
    if (payoutHold) {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout batch blocked by hold',
        detail: `${batch.providerProfile?.displayName ?? 'Partner'} - ${payoutHold.reason}`,
        severity: 'high',
        owner: 'Finance',
        priority: 97,
        recommendedAction: 'Resolve the active payout hold or keep the batch paused with an audit note.',
      });
    } else if (batch.status === 'FAILED') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Failed payout needs recovery',
        detail: `${money(batch.totalNetAmount, batch.currency)} for ${batch.providerProfile?.displayName ?? 'partner'}`,
        severity: 'high',
        owner: 'Finance',
        priority: 92,
        recommendedAction: 'Check bank reference, retry transfer, or mark manual recovery with evidence.',
      });
    } else if (batch.status === 'PROCESSING') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout transfer in progress',
        detail: `${money(batch.totalNetAmount, batch.currency)} needs bank confirmation.`,
        severity: 'medium',
        owner: 'Finance',
        priority: 52,
        recommendedAction: 'Confirm bank settlement status before marking the payout as paid.',
      });
    }
  }

  return items.sort(
    (left, right) =>
      right.priority - left.priority ||
      severityScore(right.severity) - severityScore(left.severity) ||
      left.area.localeCompare(right.area),
  );
}

function buildOpsQueueSummary(queue: OpsQueueItem[]) {
  const high = queue.filter((item) => item.severity === 'high').length;
  const medium = queue.filter((item) => item.severity === 'medium').length;
  const low = queue.filter((item) => item.severity === 'low').length;
  const financeCritical = queue.filter(
    (item) => item.severity === 'high' && ['Payment', 'Finance', 'Payout'].includes(item.area),
  ).length;
  const partnerCritical = queue.filter((item) => item.severity === 'high' && item.area === 'Partner').length;
  const customerProtection = queue.filter((item) => item.area === 'Booking').length;
  const byArea = queue.reduce(
    (counts, item) => {
      counts[item.area] = (counts[item.area] ?? 0) + 1;
      return counts;
    },
    {} as Record<OpsQueueItem['area'], number>,
  );

  return {
    high,
    medium,
    low,
    financeCritical,
    partnerCritical,
    customerProtection,
    byArea,
    first: queue[0],
  };
}

function openCashDebtEarnings(earnings: AdminEarning[]) {
  return earnings.filter(isOpenCashDebtEarning);
}

function isOpenCashDebtEarning(earning: AdminEarning) {
  return (
    earning.netAmount < 0 &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    earning.payoutBatchId == null
  );
}

function sumCashDebt(earnings: AdminEarning[]) {
  return earnings.reduce((sum, earning) => sum + Math.abs(earning.netAmount), 0);
}

function bookingFlags(booking: AdminBooking) {
  const flags: Array<{
    label: string;
    severity: OpsQueueItem['severity'];
    priority: number;
    recommendedAction: string;
  }> = [];
  const paymentStatus = booking.payment?.status;
  const participantCount = booking.participants?.length ?? 0;
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({
      label: 'Cancelled booking has unresolved payment',
      severity: 'high',
      priority: 99,
      recommendedAction: 'Open the booking and release or refund the customer payment before closing.',
    });
  }
  if (booking.status === 'EXPIRED' && unresolvedReleasePayment(booking)) {
    flags.push({
      label: 'Expired booking has unresolved payment release',
      severity: 'high',
      priority: 99,
      recommendedAction:
        'Release the authorization or create the refund path before customer support follows up.',
    });
  }
  if (booking.status === 'NO_SHOW' && unresolvedReleasePayment(booking)) {
    flags.push({
      label: 'No-show booking has unresolved payment release',
      severity: 'high',
      priority: 98,
      recommendedAction: 'Review no-show evidence, then settle payment release, refund, or fee collection.',
    });
  }
  if (completedCloseoutNeedsOps(booking)) {
    flags.push({
      label: 'Completed booking missing closeout records',
      severity: 'high',
      priority: 97,
      recommendedAction:
        'Run completed booking closeout: captured payment, earning, tax, fee, and wallet ledgers.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && expired) {
    flags.push({
      label: 'Open matching window expired',
      severity: 'high',
      priority: 90,
      recommendedAction: 'Expire the request or contact the customer before it stays visible to partners.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && booking.preferredProvider && participantCount === 0) {
    flags.push({
      label: 'First-pick partner has not replied yet',
      severity: 'medium',
      priority: 61,
      recommendedAction: 'Ask the first-pick partner to reply or prepare backup matching for the customer.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      label: 'No partner has joined yet',
      severity: 'medium',
      priority: 58,
      recommendedAction: 'Check nearby partner supply and widen backup matching if the customer is waiting.',
    });
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    flags.push({
      label: 'Matched booking has no chat room',
      severity: 'high',
      priority: 88,
      recommendedAction: 'Create or repair the chat room so customer and partner can coordinate.',
    });
  }
  if (
    booking.chatRoom &&
    (booking.chatRoom.messages?.length ?? 0) === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
  ) {
    flags.push({
      label: 'Chat room is ready but still quiet',
      severity: 'low',
      priority: 30,
      recommendedAction: 'Monitor the room and nudge the partner if service start is approaching.',
    });
  }

  return flags;
}

function unresolvedReleasePayment(booking: AdminBooking) {
  return Boolean(booking.payment && !['RELEASED', 'REFUNDED'].includes(booking.payment.status));
}

function completedCloseoutNeedsOps(booking: AdminBooking) {
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

function buildOperationalPolicySummary(settings: AdminOperationalPolicySetting[]) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const activeOverrides = settings
    .filter((setting) => isOperationalPolicyOverride(setting))
    .map((setting) => ({
      key: setting.key,
      category: setting.category,
      label: setting.label,
      current: policyOptionLabel(setting),
      recommended: policyOptionLabel(setting, true),
      enforced: setting.enforced,
    }));
  const recentChanges = settings
    .filter((setting) => isRecentOperationalPolicyChange(setting.updatedAt))
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime())
    .map((setting) => ({
      key: setting.key,
      label: setting.label,
      current: policyOptionLabel(setting),
      changedAtLabel: relativeTimeLabel(setting.updatedAt),
      enforced: setting.enforced,
    }));
  const healthLabel = activeOverrides.length ? `${activeOverrides.length} override(s)` : 'Baseline';
  const healthHelper = activeOverrides.length
    ? 'Owner-selected overrides are active. Confirm each still matches current operating intent.'
    : 'All loaded policies match the recommended baseline.';
  const enforced = [
    policyMetric(
      byKey.get('matching.provider_response_window_minutes'),
      'Response window',
      'First-pick partner first reply timer.',
    ),
    policyMetric(
      byKey.get('matching.backup_provider_radius_meters'),
      'Backup radius',
      'Partners inside this radius can join.',
    ),
    policyMetric(
      byKey.get('matching.travel_buffer_minutes'),
      'Travel buffer',
      'Availability buffer after work.',
    ),
    policyMetric(byKey.get('matching.preferred_accept_mode'), 'Accept mode', 'First-pick accept behavior.'),
  ];

  const decisionKeys = [
    'matching.backup_open_mode',
    'wallet.negative_balance_gate',
    'cancellation.after_match_policy',
    'no_show.partner_report_policy',
    'notification.partner_alert_channel',
  ];

  const decisions = decisionKeys
    .map((key) => byKey.get(key))
    .filter((setting): setting is AdminOperationalPolicySetting => Boolean(setting))
    .map((setting) => {
      const aligned = String(setting.value) === String(setting.recommendedValue);
      return {
        key: setting.key,
        label: setting.label,
        status: setting.enforced ? 'Enforced' : aligned ? 'Recommended' : 'Owner choice',
        current: policyOptionLabel(setting),
        recommendation: `Recommended: ${policyOptionLabel(setting, true)}`,
        className: aligned ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: aligned ? 'pill-success' : 'pill-warn',
      };
    });

  return {
    enforced,
    decisions,
    activeOverrides,
    recentChanges,
    activeOverrideCount: activeOverrides.length,
    recentChangeCount: recentChanges.length,
    healthLabel,
    healthHelper,
  };
}

function isOperationalPolicyOverride(setting: AdminOperationalPolicySetting) {
  return (
    setting.recommendedValue !== null &&
    setting.recommendedValue !== undefined &&
    String(setting.value) !== String(setting.recommendedValue)
  );
}

function isRecentOperationalPolicyChange(updatedAt?: string | null) {
  if (!updatedAt) {
    return false;
  }
  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) {
    return false;
  }
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - updatedTime <= sevenDaysMs;
}

function policyMetric(setting: AdminOperationalPolicySetting | undefined, label: string, helper: string) {
  return {
    label,
    value: setting ? formatPolicyValue(setting.value, setting.unit) : '-',
    helper,
  };
}

function policyOptionLabel(setting: AdminOperationalPolicySetting, useRecommended = false) {
  const value = String(useRecommended ? setting.recommendedValue : setting.value);
  return (
    setting.options?.find((option) => option.value === value)?.label ?? formatPolicyValue(value, setting.unit)
  );
}

function formatPolicyValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (unit === 'meters') {
    return `${(Number(value) / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  if (unit === 'minutes') {
    return `${value} min`;
  }
  return String(value);
}

function relativeTimeLabel(value?: string | null) {
  if (!value) {
    return 'unknown time';
  }
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'unknown time';
  }
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function activePayoutHold(batch: AdminPayoutBatch) {
  return batch.providerProfile?.sanctions?.find(
    (sanction) => sanction.type === 'PAYOUT_HOLD' && sanction.status === 'ACTIVE',
  );
}

function severityScore(severity: OpsQueueItem['severity']) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function shortId(id?: string) {
  return id ? id.slice(0, 8) : 'unknown';
}

function money(amount?: number, currency = 'VND') {
  return `${Number(amount ?? 0).toLocaleString('vi-VN')} ${currency}`;
}
