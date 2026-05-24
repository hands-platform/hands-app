import Link from 'next/link';
import {
  AdminBooking,
  AdminEarningSummary,
  AdminExternalReadiness,
  AdminNotification,
  AdminPayment,
  AdminPayoutBatch,
  AdminProvider,
  AdminRefund,
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

type OpsQueueItem = {
  label: string;
  detail: string;
  href: string;
  severity: 'high' | 'medium' | 'low';
  area: 'Booking' | 'Payment' | 'Provider' | 'Notification' | 'Payout';
};

export default async function DashboardPage() {
  const [providers, bookings, payments, earnings, refunds, notifications, payoutBatches, externalReadiness] =
    await Promise.all([
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
      adminGet<AdminRefund[]>('/admin/refunds', []),
      adminGet<AdminNotification[]>('/admin/notifications', []),
      adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
      apiGet<AdminExternalReadiness>('/health/external', {
        ok: false,
        timestamp: new Date(0).toISOString(),
        checks: [],
      }),
    ]);

  const queue = buildOpsQueue({
    providers,
    bookings,
    payments,
    refunds,
    notifications,
    earnings,
    payoutBatches,
  });
  const commandSignals = buildDashboardCommandSignals({
    providers,
    bookings,
    payments,
    refunds,
    notifications,
    earnings,
    payoutBatches,
  });
  const activeBookings = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const pendingVerification = providers.filter((provider) => provider.verification?.status === 'SUBMITTED');
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const activePayoutBatches = payoutBatches.filter((batch) => !['PAID', 'CANCELLED'].includes(batch.status));

  const metrics = [
    [
      'Open matching',
      bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length.toString(),
      'Customer is waiting for provider response.',
    ],
    ['Active bookings', activeBookings.length.toString(), 'Bookings that still need operational visibility.'],
    [
      'Online providers',
      providers.filter((provider) => provider.status.startsWith('ONLINE')).length.toString(),
      'Supply currently visible to customers.',
    ],
    ['Pending verification', pendingVerification.length.toString(), 'Providers waiting for admin approval.'],
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
      'Provider earnings ready for payout batching.',
    ],
    [
      'Open payout batches',
      activePayoutBatches.length.toString(),
      'Draft, processing, failed, or held payout batches needing finance visibility.',
    ],
    [
      'Action queue',
      queue.length.toString(),
      'Prioritized items generated from booking, payment, provider, and notification state.',
    ],
  ];

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>HANDS Operations</h1>
          <p className="muted">
            Daily command center for dispatch, provider supply, payment holds, refunds, notifications, and
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
            Provider review
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
            <h2>Today command lanes</h2>
            <p className="muted">
              High-level routing for the operating day: dispatch, provider onboarding, payments, payouts, and
              setup.
            </p>
          </div>
          <span
            className={`signal ${queue.some((item) => item.severity === 'high') ? 'signal-warn' : 'signal-ok'}`}
          >
            {queue.some((item) => item.severity === 'high') ? 'High priority open' : 'Stable'}
          </span>
        </div>
        <div className="ops-task-grid">
          {commandSignals.map((signal) => (
            <Link className={`ops-task-card ${signal.className}`} href={signal.href} key={signal.title}>
              <div>
                <span className={`pill ${signal.pillClass}`}>{signal.status}</span>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
              </div>
              <small>{signal.action}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="risk-watch-header">
            <div>
              <h2>Priority action queue</h2>
              <p className="muted">
                Generated from the latest admin API snapshot. Tackle high severity first.
              </p>
            </div>
            <span
              className={`signal ${queue.some((item) => item.severity === 'high') ? 'signal-warn' : 'signal-ok'}`}
            >
              {queue.some((item) => item.severity === 'high') ? 'Attention needed' : 'No high risk'}
            </span>
          </div>
          <div className="risk-list">
            {queue.slice(0, 8).map((item) => (
              <Link
                className={`risk-item risk-${item.severity}`}
                href={item.href}
                key={`${item.area}-${item.label}-${item.href}`}
              >
                <div>
                  <span className="muted">{item.area}</span>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
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
                detail="Direct request first, backup providers can join when needed."
              />
              <InfoRow
                label="Chat"
                value={`${bookings.filter((booking) => booking.chatRoom).length} ready`}
                detail="Chat is expected after provider selection/service start."
              />
              <InfoRow
                label="Provider locations"
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
                detail="Admin revenue before provider payout."
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

type DashboardCommandSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  pillClass: string;
};

function buildDashboardCommandSignals(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
  payoutBatches: AdminPayoutBatch[];
}): DashboardCommandSignal[] {
  const openMatching = input.bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const staleOpenMatching = openMatching.filter((booking) =>
    booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false,
  );
  const providerReviews = input.providers.filter(
    (provider) =>
      provider.verification?.status === 'SUBMITTED' ||
      provider.kyc?.status === 'SUBMITTED' ||
      (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
      (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE'),
  );
  const paymentReviews =
    input.payments.filter(
      (payment) =>
        (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') ||
        (payment.status === 'AUTHORIZED' && !payment.providerRef),
    ).length + input.refunds.filter((refund) => refund.status !== 'COMPLETED').length;
  const payoutHolds = input.payoutBatches.filter((batch) => Boolean(activePayoutHold(batch)));
  const payoutReviews = input.payoutBatches.filter((batch) =>
    ['DRAFT', 'FAILED', 'PROCESSING'].includes(batch.status),
  );
  const failedNotifications = input.notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const setupBlocked = input.earnings.availableNetAmount > 0 && payoutReviews.length === 0;

  return [
    {
      title: 'Dispatch lane',
      status: staleOpenMatching.length
        ? `${staleOpenMatching.length} EXPIRED`
        : `${openMatching.length} OPEN`,
      detail: staleOpenMatching.length
        ? 'Some open matching windows are expired and need operator review.'
        : 'Monitor open matching, quiet chat rooms, and provider assignment.',
      action: 'Open booking monitor',
      href: '/bookings',
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
    },
    {
      title: 'Provider lane',
      status: `${providerReviews.length} REVIEW`,
      detail: providerReviews.length
        ? 'Provider verification, risk reports, sanctions, or KYC needs admin attention.'
        : 'No provider review blocker in the current snapshot.',
      action: 'Open providers',
      href: '/providers',
      className: providerReviews.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: providerReviews.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payment lane',
      status: `${paymentReviews} REVIEW`,
      detail: paymentReviews
        ? 'Payment holds, missing refs, completed-service captures, or refunds need review.'
        : 'Payment and refund queues are quiet.',
      action: 'Open payments',
      href: '/payments',
      className: paymentReviews ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: paymentReviews ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Payout lane',
      status: payoutHolds.length ? `${payoutHolds.length} HELD` : `${payoutReviews.length} OPEN`,
      detail: payoutHolds.length
        ? 'One or more payout batches are blocked by active provider sanctions.'
        : payoutReviews.length
          ? 'Draft, failed, or processing payout batches are waiting for finance movement.'
          : `${money(input.earnings.availableNetAmount, input.earnings.currency)} available from earnings.`,
      action: 'Open payouts',
      href: '/payouts',
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
    },
    {
      title: 'Notification lane',
      status: `${failedNotifications.length} FAILED`,
      detail: failedNotifications.length
        ? 'Retry failed notifications or inspect disabled devices before live operation.'
        : 'No failed delivery in the current notification window.',
      action: 'Open notifications',
      href: '/notifications',
      className: failedNotifications.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: failedNotifications.length ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildOpsQueue(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
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
      });
    }
    if (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') {
      items.push({
        area: 'Payment',
        href: `/payments#payment-${payment.id}`,
        label: 'Completed service still authorized',
        detail: `${money(payment.amount, payment.currency)} should be captured or reviewed.`,
        severity: 'high',
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
      });
    }
  }

  for (const provider of input.providers) {
    if (provider.verification?.status === 'SUBMITTED') {
      items.push({
        area: 'Provider',
        href: `/providers/${provider.id}`,
        label: 'Provider verification waiting',
        detail: provider.displayName,
        severity: 'medium',
      });
    }
    const disabledDevices = provider.user?.pushDevices?.filter((device) => device.enabled === false) ?? [];
    if (disabledDevices.length > 0) {
      items.push({
        area: 'Notification',
        href: `/providers/${provider.id}`,
        label: 'Provider has disabled push device',
        detail: `${provider.displayName} has ${disabledDevices.length} disabled device(s).`,
        severity: 'low',
      });
    }
    const openReports = (provider.reports ?? []).filter((report) =>
      ['OPEN', 'INVESTIGATING'].includes(report.status),
    );
    if (openReports.length > 0) {
      items.push({
        area: 'Provider',
        href: `/providers/${provider.id}`,
        label: 'Provider risk report open',
        detail: `${provider.displayName} has ${openReports.length} open report(s).`,
        severity: openReports.some((report) => ['HIGH', 'CRITICAL'].includes(report.severity))
          ? 'high'
          : 'medium',
      });
    }
    const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
    if (activeSanctions.length > 0) {
      items.push({
        area: 'Provider',
        href: `/providers/${provider.id}`,
        label: 'Provider active sanction',
        detail: `${provider.displayName} has ${activeSanctions.length} active sanction(s).`,
        severity: activeSanctions.some(
          (sanction) => sanction.type === 'PAYOUT_HOLD' || sanction.type === 'ACCOUNT_BLOCK',
        )
          ? 'high'
          : 'medium',
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
      });
    }
  }

  if (input.earnings.availableNetAmount > 0) {
    items.push({
      area: 'Payout',
      href: '/payouts',
      label: 'Provider payout can be prepared',
      detail: `${money(input.earnings.availableNetAmount, input.earnings.currency)} available for batching.`,
      severity: 'low',
    });
  }

  for (const batch of input.payoutBatches) {
    const payoutHold = activePayoutHold(batch);
    if (payoutHold) {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout batch blocked by hold',
        detail: `${batch.providerProfile?.displayName ?? 'Provider'} - ${payoutHold.reason}`,
        severity: 'high',
      });
    } else if (batch.status === 'FAILED') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Failed payout needs recovery',
        detail: `${money(batch.totalNetAmount, batch.currency)} for ${batch.providerProfile?.displayName ?? 'provider'}`,
        severity: 'high',
      });
    } else if (batch.status === 'PROCESSING') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout transfer in progress',
        detail: `${money(batch.totalNetAmount, batch.currency)} needs bank confirmation.`,
        severity: 'medium',
      });
    }
  }

  return items.sort((left, right) => severityScore(right.severity) - severityScore(left.severity));
}

function bookingFlags(booking: AdminBooking) {
  const flags: Array<{ label: string; severity: OpsQueueItem['severity'] }> = [];
  const paymentStatus = booking.payment?.status;
  const participantCount = booking.participants?.length ?? 0;
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ label: 'Cancelled booking has unresolved payment', severity: 'high' });
  }
  if (booking.status === 'OPEN_MATCHING' && expired) {
    flags.push({ label: 'Open matching window expired', severity: 'high' });
  }
  if (booking.status === 'OPEN_MATCHING' && booking.preferredProvider && participantCount === 0) {
    flags.push({ label: 'Preferred provider has not replied yet', severity: 'medium' });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({ label: 'No provider has joined yet', severity: 'medium' });
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    flags.push({ label: 'Matched booking has no chat room', severity: 'high' });
  }
  if (
    booking.chatRoom &&
    (booking.chatRoom.messages?.length ?? 0) === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
  ) {
    flags.push({ label: 'Chat room is ready but still quiet', severity: 'low' });
  }

  return flags;
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
