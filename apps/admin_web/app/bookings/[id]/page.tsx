import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminAuditLog,
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminNotification,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../../lib/admin-api';
import { buildCsvDataHref } from '../../../lib/csv-export';
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

type BookingActivityRecord = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail: string;
  href?: string;
};

type BookingRefundLedgerRow = {
  id: string;
  amount: number;
  status: string;
  createdAt?: string | null;
  reason?: string | null;
  payment?: { currency?: string | null } | null;
};

type BookingDetailMatchingRuleSnapshot = {
  status: string;
  tone: string;
  summary: string;
  rows: Array<{ label: string; value: string; helper: string }>;
  actions: Array<{ label: string; href: string }>;
};

const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;
const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [booking, operationalPolicies, rawNotifications, providers] = await Promise.all([
    adminGet<AdminBookingDetail | null>(`/admin/bookings/${id}`, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminProvider[]>('/admin/partners', []),
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
  const addressLine = bookingAddressSnapshotLabel(booking);
  const addressPin = booking.addressSnapshot
    ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
    : coordinateLabel(booking.lat, booking.lng);
  const attentionFlags = bookingAttentionFlags(booking);
  const attentionSummary = attentionLevel(attentionFlags);
  const liveSignals = liveServiceSignals(booking);
  const dispatchSteps = dispatchChecklist(booking);
  const opsTaskCards = bookingOpsTaskCards(booking);
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingFinanceSummaryCards(financeTrace);
  const financeFlags = bookingFinanceFlags(booking, financeTrace);
  const refundLedgerRows = bookingRefundRows(booking);
  const operatorNoteLines = bookingOperatorNoteLines(booking);
  const closureSummary = bookingClosureSummary(booking);
  const servicePricingSnapshotRows = [
    {
      label: 'Service option',
      value: financeTrace.serviceOption,
      helper: 'Booked service name, duration option, and quantity snapshot.',
    },
    {
      label: 'Customer price',
      value: financeTrace.customerPrice,
      helper: `Admin minimum ${financeTrace.adminMinimum}; partner price must follow the configured step.`,
    },
    {
      label: 'Payout rule',
      value: financeTrace.payoutRuleStatus,
      helper: financeTrace.payoutRuleLine,
    },
    {
      label: 'Partner payout',
      value: financeTrace.providerPayout,
      helper: financeTrace.providerNet,
    },
    {
      label: 'HANDS fee',
      value: financeTrace.platformFee,
      helper: `${financeTrace.feeCosts}; net ${financeTrace.netHandsFee}`,
    },
    {
      label: 'Tax and withholding',
      value: financeTrace.withholding,
      helper: `Company fee after tax: ${financeTrace.companyFeeAfterTax}`,
    },
    {
      label: 'Wallet impact',
      value: financeTrace.walletLedger,
      helper:
        financeTrace.paymentMethod === 'CASH'
          ? 'Cash bookings can create partner fee debt until settled.'
          : 'Non-cash bookings should create a payout credit after completion.',
    },
  ];
  const policySnapshot = bookingOperationalPolicySnapshot(booking, operationalPolicies);
  const backupSupply = bookingBackupPartnerSupply(booking, providers, operationalPolicies);
  const addressRadiusContract = bookingAddressRadiusContract(booking, backupSupply);
  const customerWaitPanel = bookingCustomerWaitPanel(booking, backupSupply, operationalPolicies);
  const mvpAuthorityContract = bookingMvpAuthorityContract({
    booking,
    operationalPolicies,
    backupSupply,
    messageCount: messages.length,
    financeTrace,
  });
  const stageSnapshot = bookingStageSnapshot(booking, customerWaitPanel, backupSupply);
  const notificationTrace = bookingNotificationTrace(booking, rawNotifications);
  const matchingRuleSnapshot = bookingDetailMatchingRuleSnapshot({
    booking,
    backupSupply,
    customerWaitPanel,
    notificationTrace,
  });
  const operationsTrace = bookingOperationsTrace(booking, booking.auditLogs ?? []);
  const bookingActivityRecords = buildBookingActivityRecords(booking, rawNotifications);
  const bookingActivitySummary = buildBookingActivitySummary(bookingActivityRecords);
  const bookingActivityCsvHref = buildBookingActivityCsvHref(booking, bookingActivityRecords);
  const chatLifecycle = bookingChatLifecycle(booking, messages.length);
  const handoffChecklist = bookingHandoffChecklist(booking, messages.length, latestLocation);
  const closeoutReadiness = bookingCloseoutReadiness({
    booking,
    financeFlags,
    latestLocation,
    messageCount: messages.length,
    notificationCount: notificationTrace.rows.length,
  });
  const operatingSnapshot = bookingOperatingSnapshot({
    booking,
    addressLine,
    addressPin,
    messageCount: messages.length,
    notificationCount: notificationTrace.rows.length,
  });
  const operatingTimeline = bookingOperatingTimeline({
    booking,
    addressLine,
    addressPin,
    latestLocation,
    messages,
    notifications: rawNotifications,
  });
  const communicationMovementHandoff = bookingCommunicationMovementHandoff({
    booking,
    latestLocation,
    messages,
    notifications: rawNotifications,
  });
  const operatingLedger = [
    {
      area: 'Customer',
      status: booking.customerProfile?.id ? 'Linked' : 'Missing profile',
      evidence: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      }`,
      href: '#customer',
    },
    {
      area: 'Partner',
      status: finalProvider?.id ? 'Linked' : 'Not selected',
      evidence: finalProvider
        ? providerName(finalProvider)
        : `${booking.participants?.length ?? 0} shortlist participant(s)`,
      href: '#handoff',
    },
    {
      area: 'Chat',
      status: booking.chatRoom ? 'Archived' : 'Missing',
      evidence: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} / ${messages.length} message(s)`
        : 'Matched bookings should create a retained chat room.',
      href: '#chat',
    },
    {
      area: 'Service/Pricing',
      status: financeTrace.payoutRuleStatus,
      evidence: `${financeTrace.serviceOption} / customer ${financeTrace.customerPrice} / partner ${financeTrace.providerPayout}`,
      href: '#service',
    },
    {
      area: 'Payment',
      status: booking.payment?.status ?? 'NONE',
      evidence: `${booking.payment?.method ?? 'No method'} / ${money(
        booking.payment?.amount,
        booking.payment?.currency,
      )}`,
      href: '#payment',
    },
    {
      area: 'Refund',
      status: refundLedgerRows.length ? `${refundLedgerRows.length} refund record(s)` : 'No refund record',
      evidence: bookingRefundLedgerEvidence(booking),
      href: '#payment',
    },
    {
      area: 'Finance',
      status: financeFlags.length ? `${financeFlags.length} check(s)` : 'Trace ready',
      evidence: `${financeTrace.providerPayout} partner payout / ${financeTrace.platformFee} platform fee`,
      href: '#finance',
    },
    {
      area: 'Tax',
      status: (booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0) ? 'Logged' : 'Not logged',
      evidence: financeTrace.withholding,
      href: '#finance',
    },
    {
      area: 'Wallet',
      status: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'No cash debt block',
      evidence: financeTrace.walletLedger,
      href: '#finance',
    },
    {
      area: 'Cash settlement',
      status: bookingCashDebtNeedsSettlement(booking)
        ? 'Partner blocked until settled'
        : booking.payment?.method === 'CASH'
          ? 'Cash ledger clear'
          : 'Not a cash booking',
      evidence:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.platformFee} HANDS fee / ${financeTrace.withholding} withholding`
          : `${booking.payment?.method ?? 'No method'} payment path`,
      href: '#payment',
    },
    {
      area: 'Location',
      status: latestLocation ? 'Partner pin saved' : 'No partner pin',
      evidence: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
        : addressPin,
      href: '#location',
    },
    {
      area: 'Alerts',
      status: `${notificationTrace.rows.length} notification(s)`,
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} partner alert(s) / ${
        notificationTrace.backupBatches.length
      } marketplace alert batch(es)`,
      href: '#alerts',
    },
    {
      area: 'Audit',
      status: `${bookingActivityRecords.length} event(s)`,
      evidence: `${booking.auditLogs?.length ?? 0} audit row(s) / ${booking.opsTasks?.length ?? 0} task row(s)`,
      href: '#booking-activity',
    },
    {
      area: 'Operator notes',
      status: operatorNoteLines.length ? `${operatorNoteLines.length} note line(s)` : 'No notes',
      evidence:
        operatorNoteLines[operatorNoteLines.length - 1] ?? 'No internal handling note has been added.',
      href: '#operator-notes',
    },
    {
      area: 'Closure',
      status: closureSummary.status,
      evidence: closureSummary.detail,
      href: '#booking-activity',
    },
  ];
  const operatorCommandQueue = bookingOperatorCommandQueue({
    booking,
    attentionFlags,
    messages,
    latestLocation,
  });
  const operatorActionMatrix = bookingOperatorActionMatrix(booking);
  const operatorPriorityBriefing = bookingOperatorPriorityBriefing({
    booking,
    operatorCommandQueue,
    closeoutReadiness,
    financeFlags,
    latestLocation,
    messageCount: messages.length,
  });
  const evidencePacket = bookingEvidencePacket({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    bookingActivityRecords,
  });
  const manualDecisionReadiness = bookingManualDecisionReadiness({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
  });
  const connectedRecordLinks = [
    {
      label: 'Customer record',
      value: booking.customerProfile?.id ? 'Linked' : 'Profile missing',
      detail: booking.customerProfile?.user?.phone ?? 'Open the in-page customer evidence block.',
      href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : '#customer',
      tone: booking.customerProfile?.id ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Preferred partner',
      value: booking.preferredProvider?.id ? providerName(booking.preferredProvider) : 'Not selected',
      detail: 'First-pick partner record and booking gate state.',
      href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : '#handoff',
      tone: booking.preferredProvider?.id ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Final partner',
      value: finalProvider?.id ? providerName(finalProvider) : 'Customer choice pending',
      detail: 'Final selected partner, location, payout, and service records.',
      href: finalProvider?.id ? `/partners/${finalProvider.id}` : '#participants',
      tone: finalProvider?.id ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat archive',
      value: booking.chatRoom ? `${messages.length} message(s)` : 'No room',
      detail: 'Admin-retained transcript for completion, cancellation, and no-show context.',
      href: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Notification trace',
      value: `${notificationTrace.rows.length} alert(s)`,
      detail: 'Partner alerts, customer updates, delivery status, and retry context.',
      href: `/notifications?booking=${encodeURIComponent(booking.id)}`,
      tone: notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Payment queue',
      value: booking.payment?.status ?? 'No payment',
      detail: `${booking.payment?.method ?? 'NONE'} / ${money(booking.payment?.amount, booking.payment?.currency)}`,
      href: booking.payment?.status === 'AUTHORIZED' ? '/payments?review=authorized' : '/payments',
      tone: booking.payment ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Refund queue',
      value: `${refundLedgerRows.length} refund row(s)`,
      detail: bookingRefundLedgerEvidence(booking),
      href: refundLedgerRows.length ? '/refunds?review=open' : '#payment',
      tone: refundLedgerRows.length ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Cash settlement',
      value: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear',
      detail: financeTrace.walletLedger,
      href: bookingCashDebtNeedsSettlement(booking) ? '/cash-settlements' : '#finance',
      tone: bookingCashDebtNeedsSettlement(booking) ? 'pill-danger' : 'pill-success',
    },
  ];
  const bookingEvidenceBundleRows = buildBookingEvidenceBundleRows({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    bookingActivityRecords,
  });
  const bookingCloseoutChecklist = buildBookingCloseoutChecklist({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
    bookingActivityRecords,
  });
  const actionEvidenceGate = buildBookingActionEvidenceGate({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
  });

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
          {booking.customerProfile?.id && (
            <Link className="text-link" href={`/customers/${booking.customerProfile.id}`}>
              Open customer
            </Link>
          )}
          {booking.customerProfile?.id && (
            <Link
              className="text-link"
              href={`/chat-archive?q=${encodeURIComponent(booking.customerProfile.id)}`}
            >
              All customer chats
            </Link>
          )}
          {finalProvider?.id && (
            <Link className="text-link" href={`/partners/${finalProvider.id}`}>
              Open partner
            </Link>
          )}
          {finalProvider?.id && (
            <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(finalProvider.id)}`}>
              All partner chats
            </Link>
          )}
          {booking.chatRoom?.id && (
            <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
              Open chat archive
            </Link>
          )}
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
        <MetricCard label="Closure" value={closureSummary.status} helper={closureSummary.detail} />
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
        <MetricCard
          label="Attention checks"
          value={attentionSummary.label}
          helper={attentionSummary.helper}
        />
      </section>

      <section className="card" id="matching-rule-snapshot" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Matching rule snapshot</h2>
            <p className="muted">
              Detail-level rule readout for first-pick wait, booking-address marketplace radius, customer
              final choice, chat handoff, and wallet gate.
            </p>
          </div>
          <span className={`pill ${matchingRuleSnapshot.tone}`}>{matchingRuleSnapshot.status}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {matchingRuleSnapshot.summary}
        </p>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {matchingRuleSnapshot.rows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.helper}</small>
            </div>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          {matchingRuleSnapshot.actions.map((action) => (
            <Link className="text-link" href={action.href} key={action.label}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="card" id="mvp-authority-contract" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>MVP authority contract</h2>
            <p className="muted">
              One-screen check against the HANDS MVP policy: NestJS business authority, address snapshot,
              first-pick, 10km marketplace, customer final partner choice, chat retention, and wallet gate.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Open policy controls
          </Link>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Current state</th>
              <th>Evidence</th>
              <th>Operator use</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {mvpAuthorityContract.map((row) => (
              <tr key={row.contract}>
                <td>
                  <strong>{row.contract}</strong>
                  <p className="muted">{row.scope}</p>
                </td>
                <td>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.operatorUse}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="booking-recent-operations-timeline" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking recent operations timeline</h2>
            <p className="muted">
              Latest factual booking steps before an operator decides: address, first-pick wait, 10km partner
              participation, customer final choice, chat, location, payment, cash debt, and closeout.
            </p>
          </div>
          <Link className="text-link" href="#operating-timeline">
            Open full operating timeline
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {operatingTimeline.slice(0, 8).map((item) => (
            <div className="setup-stage-item" key={`recent-${item.id}`}>
              <span>{item.type}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.at ? formatDate(item.at) : item.status}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="booking-priority-briefing" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking priority briefing</h2>
            <p className="muted">
              First-screen operator summary for handoff, chat, location, payment, and closeout. This shows
              factual state only, not customer or partner judgment.
            </p>
          </div>
          <span className={`pill ${operatorPriorityBriefing.tone}`}>{operatorPriorityBriefing.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {operatorPriorityBriefing.rows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {operatorPriorityBriefing.steps.map((step) => (
            <div className="setup-stage-item" key={step.id}>
              <span>{step.label}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
              </div>
              <Link className="text-link" href={step.href}>
                {step.linkLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="booking-evidence-packet" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Evidence packet for admin decision</h2>
            <p className="muted">
              Cancellation, no-show, refund, and settlement decisions should use retained booking evidence.
              This packet groups chat, location, payment, alerts, notes, and audit records as factual decision
              context for the customer and partner.
            </p>
          </div>
          <span className={`pill ${evidencePacket.tone}`}>{evidencePacket.status}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {evidencePacket.summary}
        </p>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {evidencePacket.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {evidencePacket.records.map((record) => (
            <div className="setup-stage-item" id={record.id} key={record.id}>
              <span>{record.label}</span>
              <div>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
                <small>{record.evidence}</small>
              </div>
              <a className="text-link" href={record.href}>
                Open
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="manual-decision-readiness" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Manual outcome decision readiness</h2>
            <p className="muted">
              Operations-only decision board for cancellation, no-show, refund/release, cash fee settlement,
              and completed closeout. It keeps the decision factual and evidence-based.
            </p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Open manual queue
            </Link>
            <span className="pill pill-info">{manualDecisionReadiness.length} decision lane(s)</span>
          </div>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Decision lane</th>
              <th>Status</th>
              <th>Evidence loaded</th>
              <th>Operator use</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {manualDecisionReadiness.map((row) => (
              <tr key={row.lane}>
                <td>
                  <strong>{row.lane}</strong>
                  <p className="muted">{row.scope}</p>
                </td>
                <td>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.operatorUse}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="booking-full-evidence-bundle" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking full evidence bundle</h2>
            <p className="muted">
              Single booking command view that ties the customer, partner, address snapshot, chat archive,
              payment, earning, wallet, location, alerts, and operator notes into one factual bundle.
            </p>
          </div>
          <span className="pill pill-info">{bookingEvidenceBundleRows.length} evidence lane(s)</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Lane</th>
              <th>Current state</th>
              <th>Evidence</th>
              <th>Operator use</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {bookingEvidenceBundleRows.map((row) => (
              <tr key={row.lane}>
                <td>
                  <strong>{row.lane}</strong>
                  <p className="muted">{row.recordLabel}</p>
                </td>
                <td>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.operatorUse}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="booking-closeout-checklist" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking closeout checklist</h2>
            <p className="muted">
              Final operator checklist before payment capture, refund/release, cash fee settlement, no-show,
              cancellation, or completed-work closeout. It uses factual records only.
            </p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Manual decision queue
            </Link>
            <Link className="text-link" href="/finance-closeout">
              Finance closeout
            </Link>
          </div>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {bookingCloseoutChecklist.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" id="connected-operations-records" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Connected operations records</h2>
            <p className="muted">
              Jump from this booking to the linked customer, partner, chat archive, notification trace,
              payment, refund, and settlement records.
            </p>
          </div>
          <span className="pill pill-info">{connectedRecordLinks.length} links</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {connectedRecordLinks.map((record) => (
            <div key={record.label}>
              <span>{record.label}</span>
              <strong>{record.value}</strong>
              <small>{record.detail}</small>
              <Link className={`pill ${record.tone}`} href={record.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="operator-command-queue" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operator command queue</h2>
            <p className="muted">
              Practical same-shift actions for this booking. These are factual handling steps for operators.
            </p>
          </div>
          <span className={`pill ${operatorCommandQueue.tone}`}>{operatorCommandQueue.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {operatorCommandQueue.labels.map((label) => (
            <div key={label.label}>
              <span>{label.label}</span>
              <strong>{label.value}</strong>
              <small>{label.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {operatorCommandQueue.commands.map((command) => (
            <div className="setup-stage-item" key={command.id}>
              <span>{command.label}</span>
              <div>
                <strong>{command.title}</strong>
                <p className="muted">{command.detail}</p>
                <small>{command.owner}</small>
              </div>
              <OperatorCommandAction bookingId={booking.id} command={command} />
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="operator-action-availability" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operator action availability</h2>
            <p className="muted">
              Action map for this booking: what can be handled now, what is locked by status, and where the
              operator should open the actual form.
            </p>
          </div>
          <span className="pill pill-info">
            {operatorActionMatrix.filter((row) => row.available).length}/{operatorActionMatrix.length}{' '}
            available
          </span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Availability</th>
              <th>Evidence</th>
              <th>Operator rule</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {operatorActionMatrix.map((row) => (
              <tr key={row.action}>
                <td>{row.action}</td>
                <td>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.operatorRule}</td>
                <td>
                  <ActionLink href={row.href} label={row.hrefLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="booking-handoff-checklist" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking handoff checklist</h2>
            <p className="muted">
              One-row-per-stage view of the customer app, partner app, admin archive, location, and finance
              handoff. This is factual state tracking only.
            </p>
          </div>
          <span className="pill pill-info">{handoffChecklist.length} stage(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {handoffChecklist.map((item) => (
            <div className="setup-stage-item" key={item.id}>
              <span>{item.label}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              {item.href ? (
                <Link className="text-link" href={item.href}>
                  {item.status}
                </Link>
              ) : (
                <small>{item.status}</small>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="payment-actions" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking full record index</h2>
            <p className="muted">
              One-booking record map for operators. This is factual tracking only: customer, partner,
              matching, chat, payment, fee, tax, wallet, alerts, location, and audit history.
            </p>
          </div>
          <div className="actions">
            <a
              className="text-link"
              download={`hands-booking-${shortId(booking.id)}-activity.csv`}
              href={bookingActivityCsvHref}
            >
              Export activity CSV
            </a>
            <span className="pill pill-info">{bookingActivityRecords.length} event(s)</span>
          </div>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <a href="#customer">
            <span>Customer</span>
            <strong>{booking.customerProfile?.user?.phone ?? 'No phone'}</strong>
            <small>{booking.customerProfile?.user?.fullName ?? 'Customer profile'}</small>
          </a>
          <a href="#participants">
            <span>Partners</span>
            <strong>{booking.participants?.length ?? 0}</strong>
            <small>Preferred, final, and marketplace shortlist.</small>
          </a>
          <a href="#chat">
            <span>Chat archive</span>
            <strong>{messages.length}</strong>
            <small>{booking.chatRoom ? `Room ${shortId(booking.chatRoom.id)}` : 'No chat room yet'}</small>
          </a>
          <a href="#payment">
            <span>Payment and wallet</span>
            <strong>{booking.payment?.status ?? 'NONE'}</strong>
            <small>{money(booking.payment?.amount, booking.payment?.currency)}</small>
          </a>
          <a href="#finance">
            <span>Finance trace</span>
            <strong>{financeTrace.providerPayout}</strong>
            <small>{financeTrace.platformFee} HANDS fee</small>
          </a>
          <a href={booking.earning?.id ? `/earnings#earning-${booking.earning.id}` : '/earnings'}>
            <span>Earnings ledger</span>
            <strong>{booking.earning?.status ?? 'No earning row yet'}</strong>
            <small>{booking.earning?.id ? shortId(booking.earning.id) : 'Open finance ledger'}</small>
          </a>
          <a href="/cash-settlements">
            <span>Cash settlement desk</span>
            <strong>
              {bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear or non-cash'}
            </strong>
            <small>
              {booking.payment?.method === 'CASH' ? financeTrace.walletLedger : 'No cash wallet debt'}
            </small>
          </a>
          <a href="/tax-policy">
            <span>Tax policy</span>
            <strong>{financeTrace.withholding}</strong>
            <small>Versioned rules, no hardcoded rates.</small>
          </a>
          <a href="#service-pricing-snapshot">
            <span>Service and pricing</span>
            <strong>{financeTrace.payoutRuleStatus}</strong>
            <small>{financeTrace.serviceOption}</small>
          </a>
          <a href="#location">
            <span>Location trail</span>
            <strong>{providerLocationMetricValue(booking)}</strong>
            <small>{providerLocationMetricHelper(booking)}</small>
          </a>
          <a href="#communication-movement-handoff">
            <span>Communication and movement</span>
            <strong>{communicationMovementHandoff.status}</strong>
            <small>
              {messages.length} message(s), {locationTrail(booking).length} location row(s).
            </small>
          </a>
          <a href="#alerts">
            <span>Alerts</span>
            <strong>{notificationTrace.rows.length}</strong>
            <small>{notificationTrace.backupBatches.length} marketplace alert batch(es).</small>
          </a>
          <a href="#operator-notes">
            <span>Operator notes</span>
            <strong>{operatorNoteLines.length}</strong>
            <small>Internal handling notes retained on this booking.</small>
          </a>
          <a href="#booking-activity">
            <span>Activity timeline</span>
            <strong>{bookingActivityRecords.length}</strong>
            <small>Date-ordered operational history.</small>
          </a>
        </div>
      </section>

      <section className="card" id="booking-operating-ledger" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking operating ledger</h2>
            <p className="muted">
              Compact operator ledger for the full booking record. Every row links to the deeper factual
              section below.
            </p>
          </div>
          <span className="pill pill-info">{operatingLedger.length} record areas</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Area</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {operatingLedger.map((row) => (
              <tr key={row.area}>
                <td>{row.area}</td>
                <td>{row.status}</td>
                <td>{row.evidence}</td>
                <td>
                  <a className="text-link" href={row.href}>
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="booking-closeout-readiness" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Closeout readiness</h2>
            <p className="muted">
              End-to-end readiness check for support, dispatch, finance, tax, wallet, location, and admin
              evidence. This shows factual completeness only.
            </p>
          </div>
          <span className={`pill ${closeoutReadiness.tone}`}>{closeoutReadiness.status}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {closeoutReadiness.helper}
        </p>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {closeoutReadiness.items.map((item) => (
            <div className="setup-stage-item" key={item.id}>
              <span>{item.label}</span>
              <div>
                <strong>{item.status}</strong>
                <p className="muted">{item.detail}</p>
                <small>{item.owner}</small>
              </div>
              <a className="text-link" href={item.href}>
                Open
              </a>
            </div>
          ))}
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="risk-watch-header">
            <div>
              <strong>Closeout exception register</strong>
              <p className="muted">
                Only unresolved factual items appear here, so the operator can clear the booking without
                hunting through every section.
              </p>
            </div>
            <span className={`pill ${closeoutReadiness.openItems.length > 0 ? 'pill-warn' : 'pill-success'}`}>
              {closeoutReadiness.openItems.length > 0
                ? `${closeoutReadiness.openItems.length} open`
                : 'No exceptions'}
            </span>
          </div>
          {closeoutReadiness.openItems.length > 0 ? (
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {closeoutReadiness.openItems.map((item) => (
                <div className="setup-stage-item" key={`exception-${item.id}`}>
                  <span>{item.owner}</span>
                  <div>
                    <strong>
                      {item.label}: {item.status}
                    </strong>
                    <p className="muted">{item.detail}</p>
                    <small>
                      {booking.status === 'COMPLETED'
                        ? 'Clear before completed closeout.'
                        : 'Clear before the next handoff.'}
                    </small>
                  </div>
                  <a className="text-link" href={item.href}>
                    Resolve
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              Customer, partner, chat, payment, finance, cash, location, and audit records are aligned for the
              current booking stage.
            </p>
          )}
        </div>
      </section>

      <section className="card" id="operating-snapshot" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking operating snapshot</h2>
            <p className="muted">
              Same-shift control view for the confirmed address, customer choice, partner participation, chat,
              payment, wallet, and next operator action.
            </p>
          </div>
          <span className={`pill ${operatingSnapshot.tone}`}>{operatingSnapshot.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {operatingSnapshot.facts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small>{fact.helper}</small>
            </div>
          ))}
        </div>
        <div className={`ops-task-note ${operatingSnapshot.noteClassName}`} style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <strong>{operatingSnapshot.nextAction}</strong>
              <p className="muted">{operatingSnapshot.nextDetail}</p>
            </div>
            <Link className="text-link" href={operatingSnapshot.href}>
              {operatingSnapshot.hrefLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="card" id="operating-timeline" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operating timeline</h2>
            <p className="muted">
              Time-ordered operating trail for address confirmation, partner participation, customer final
              choice, chat, location, payment, wallet, tax, fee, and audit events.
            </p>
          </div>
          <span className="pill pill-info">{operatingTimeline.length} step(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {operatingTimeline.map((item) => (
            <div className="setup-stage-item" key={item.id}>
              <span>{item.type}</span>
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.at ? formatDate(item.at) : item.status}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="communication-movement-handoff" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Communication and movement handoff</h2>
            <p className="muted">
              Focused booking trail for chat archive, customer/partner alerts, and partner location sharing.
              This helps support confirm whether the assigned partner and customer are connected.
            </p>
          </div>
          <span className={`pill ${communicationMovementHandoff.tone}`}>
            {communicationMovementHandoff.status}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {communicationMovementHandoff.metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div
          className={`ops-task-note ${communicationMovementHandoff.noteClassName}`}
          style={{ marginTop: 14 }}
        >
          <div className="ops-row">
            <div>
              <strong>{communicationMovementHandoff.nextAction}</strong>
              <p className="muted">{communicationMovementHandoff.nextDetail}</p>
            </div>
            <Link className="text-link" href={communicationMovementHandoff.href}>
              {communicationMovementHandoff.hrefLabel}
            </Link>
          </div>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {communicationMovementHandoff.events.length ? (
            communicationMovementHandoff.events.map((event) => (
              <div className="setup-stage-item" key={event.id}>
                <span>{event.type}</span>
                <div>
                  <strong>{event.title}</strong>
                  <p className="muted">{event.detail}</p>
                </div>
                <small>{formatDate(event.at)}</small>
              </div>
            ))
          ) : (
            <p className="muted">No chat, alert, or partner location event has been recorded yet.</p>
          )}
        </div>
      </section>

      <section className="card" id="structured-ops-status" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Chat lifecycle and retention</h2>
            <p className="muted">
              Chat is a required operational handoff after matching/service start. Mobile apps may hide it
              after service closeout, but admin keeps the full archive for support and dispute review.
            </p>
          </div>
          <span className={`pill ${chatLifecycle.tone}`}>{chatLifecycle.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Mobile customer app</span>
            <strong>{chatLifecycle.customerState}</strong>
            <small>{chatLifecycle.customerDetail}</small>
          </div>
          <div>
            <span>Mobile partner app</span>
            <strong>{chatLifecycle.partnerState}</strong>
            <small>{chatLifecycle.partnerDetail}</small>
          </div>
          <div>
            <span>Admin archive</span>
            <strong>{chatLifecycle.adminState}</strong>
            <small>{chatLifecycle.adminDetail}</small>
          </div>
          <div>
            <span>Room</span>
            <strong>{chatLifecycle.roomLabel}</strong>
            <small>{messages.length} message(s) retained.</small>
          </div>
        </div>
      </section>

      <section className="card ops-command-center" id="booking-ops" style={{ marginBottom: 16 }}>
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
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="risk-watch-header">
            <div>
              <strong>Action evidence gate</strong>
              <p className="muted">
                Pre-flight evidence check for the actions below. Operators can see why an action is available,
                blocked, or needs more retained evidence before proceeding.
              </p>
            </div>
            <span className={`pill ${actionEvidenceGate.tone}`}>{actionEvidenceGate.status}</span>
          </div>
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            {actionEvidenceGate.rows.map((row) => (
              <a className={`ops-task-card ${row.className}`} href={row.href} key={row.action}>
                <div>
                  <span className={`pill ${row.pillClass}`}>{row.status}</span>
                  <h3>{row.action}</h3>
                  <p>{row.evidence}</p>
                </div>
                <small>{row.operatorRule}</small>
              </a>
            ))}
          </div>
          <div className="ops-task-note" id="action-button-execution-map" style={{ marginTop: 12 }}>
            <strong>Action button execution map</strong>
            <p className="muted">
              Button-by-button operating readout. Use this before pressing payment, settlement, expiry,
              no-show, or completed closeout actions.
            </p>
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Action button</th>
                  <th>Current state</th>
                  <th>Why</th>
                  <th>Operator rule</th>
                </tr>
              </thead>
              <tbody>
                {actionEvidenceGate.rows.map((row) => (
                  <tr key={`button-map-${row.action}`}>
                    <td>
                      <strong>{row.action}</strong>
                    </td>
                    <td>
                      <span className={`pill ${row.pillClass}`}>{row.status}</span>
                    </td>
                    <td>{row.evidence}</td>
                    <td>{row.operatorRule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <section className="card" id="alerts" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking stage snapshot</h2>
            <p className="muted">
              Single operating readout for the first-pick timer, marketplace participation, customer choice,
              chat handoff, and closeout.
            </p>
          </div>
          <span className={`pill ${stageSnapshot.pillClass}`}>{stageSnapshot.stage}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {stageSnapshot.metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className={`ops-task-note ${stageSnapshot.noteClassName}`} style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <strong>{stageSnapshot.headline}</strong>
              <p className="muted">{stageSnapshot.detail}</p>
              <div className="participant-list" style={{ marginTop: 8 }}>
                {stageSnapshot.badges.map((badge) => (
                  <span className={`pill ${badge.tone}`} key={badge.label}>
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <Link className="text-link" href={stageSnapshot.actionHref}>
              {stageSnapshot.actionLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="card" id="audit" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer wait and matching decision</h2>
            <p className="muted">
              First-pick timer, marketplace partner participation, customer final choice, and chat handoff in
              one operating view.
            </p>
          </div>
          <span className={`pill ${customerWaitPanel.signalTone}`}>{customerWaitPanel.signalStatus}</span>
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <strong>{customerWaitPanel.headline}</strong>
              <p className="muted">{customerWaitPanel.detail}</p>
              <div className="participant-list" style={{ marginTop: 8 }}>
                {customerWaitPanel.badges.map((badge) => (
                  <span className={`pill ${badge.tone}`} key={badge.label} title={badge.detail}>
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <Link className="text-link" href={customerWaitPanel.nextActionHref}>
              {customerWaitPanel.nextActionLabel}
            </Link>
          </div>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {customerWaitPanel.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="backup-supply" style={{ marginBottom: 16 }}>
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

      <section className="card" id="address-radius-contract" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking address radius contract</h2>
            <p className="muted">
              The immutable booking address snapshot is the source of truth for 10km marketplace eligibility.
            </p>
          </div>
          <span className={`pill ${addressRadiusContract.tone}`}>{addressRadiusContract.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {addressRadiusContract.metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {addressRadiusContract.cards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <span className={`pill ${card.pillClass}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Dispatch candidate decision matrix</h2>
            <p className="muted">
              Reservation-specific readout for who can be used now, who is excluded, and what the operator
              should fix before extending customer wait time.
            </p>
          </div>
          <span className={`pill ${backupSupply.candidateCommand.tone}`}>
            {backupSupply.candidateCommand.status}
          </span>
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <strong>{backupSupply.candidateCommand.title}</strong>
              <p className="muted">{backupSupply.candidateCommand.detail}</p>
            </div>
            <Link className="text-link" href={backupSupply.candidateCommand.href}>
              {backupSupply.candidateCommand.action}
            </Link>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Top usable partners</h3>
            <p className="muted">
              Closest eligible partners under the booking pin, radius, online, verification, and location
              freshness gates.
            </p>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {backupSupply.topCandidates.map((row) => (
                <div className="setup-stage-item" key={`candidate-${row.id}`}>
                  <span>GO</span>
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted">
                      {row.distance} / {row.locationAge}
                    </p>
                  </div>
                  <Link className="text-link" href={`/partners/${row.id}`}>
                    Open
                  </Link>
                </div>
              ))}
              {backupSupply.topCandidates.length === 0 ? (
                <div className="setup-stage-item">
                  <span>NONE</span>
                  <div>
                    <strong>No usable partner candidate</strong>
                    <p className="muted">
                      Use the exclusion groups to decide whether to refresh location, widen policy, or contact
                      partners.
                    </p>
                  </div>
                  <Link className="text-link" href="/partners?review=marketplace-ready">
                    Open marketplace queue
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          <div className="card">
            <h3>Excluded partner groups</h3>
            <p className="muted">Grouped by the first operational reason they cannot join this booking.</p>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {backupSupply.excludedGroups.map((group) => (
                <div className="setup-stage-item" key={group.label}>
                  <span>{group.count ? 'FIX' : 'OK'}</span>
                  <div>
                    <strong>{group.label}</strong>
                    <p className="muted">{group.detail}</p>
                    {group.samples.length ? (
                      <p className="muted">Sample: {group.samples.join(', ')}</p>
                    ) : null}
                  </div>
                  <Link className="text-link" href={group.href}>
                    {group.count}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Marketplace partner supply for this booking</h2>
            <p className="muted">
              Booking-pin view of who can join as a marketplace partner, and exactly why others are excluded.
            </p>
          </div>
          <span className={`pill ${backupSupply.eligibleCount ? 'pill-success' : 'pill-warn'}`}>
            {backupSupply.eligibleCount} eligible
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {backupSupply.metrics.map((item) => (
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
              <span className={`pill ${backupSupply.decisionTone}`}>{backupSupply.decisionStatus}</span>
              <strong>{backupSupply.decisionTitle}</strong>
              <p className="muted">{backupSupply.decisionDetail}</p>
            </div>
            <Link className="text-link" href="/partners">
              Open partners
            </Link>
          </div>
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {backupSupply.rows.map((row) => (
            <div className="ops-row" key={row.id}>
              <div>
                <strong>
                  <Link className="text-link" href={`/partners/${row.id}`}>
                    {row.name}
                  </Link>
                </strong>
                <p className="muted">
                  {row.role} / {row.status} / {row.locationAge}
                </p>
                <p className="muted">{row.detail}</p>
              </div>
              <div>
                <span className={`pill ${row.eligible ? 'pill-success' : 'pill-warn'}`}>
                  {row.eligible ? 'Can join' : 'Excluded'}
                </span>
                <div className="muted">{row.distance}</div>
              </div>
            </div>
          ))}
          {backupSupply.rows.length === 0 ? (
            <p className="muted">No partner supply can be evaluated until the booking has a customer pin.</p>
          ) : null}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking alert trace</h2>
            <p className="muted">
              Reservation-specific notification history for first-pick, marketplace partner visibility,
              retries, and disabled device checks.
            </p>
          </div>
          <Link className="text-link" href={`/notifications?booking=${booking.id}`}>
            Open notification board
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {notificationTrace.metrics.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        {notificationTrace.backupBatches.length > 0 ? (
          <div className="risk-list">
            {notificationTrace.backupBatches.map((batch) => (
              <div className="risk-item" key={batch.id}>
                <span className="signal signal-info">{batch.signal}</span>
                <div>
                  <h3>{batch.title}</h3>
                  <p>{batch.detail}</p>
                  <small>{batch.meta}</small>
                  {batch.providers ? <small>{batch.providers}</small> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {notificationTrace.rows.length > 0 ? (
          <div className="risk-list">
            {notificationTrace.rows.map((row) => (
              <div className="risk-item" key={row.id}>
                <span className={`signal ${row.signalClass}`}>{row.signal}</span>
                <div>
                  <h3>{row.title}</h3>
                  <p>{row.detail}</p>
                  <small>{row.meta}</small>
                  {row.delivery ? <small>{row.delivery}</small> : null}
                </div>
              </div>
            ))}
          </div>
        ) : notificationTrace.backupBatches.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No notification rows are tied to this booking yet. If a partner says they missed the request,
            check whether the booking created first-pick or marketplace availability alerts.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Operations audit trace</h2>
            <p className="muted">
              Booking-specific operator actions plus policy updates that happened after this request opened.
            </p>
          </div>
          <Link className="text-link" href={`/audit-log?q=${encodeURIComponent(booking.id)}`}>
            Open audit log
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {operationsTrace.metrics.map((item) => (
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
              <span className={`pill ${operationsTrace.statusTone}`}>{operationsTrace.status}</span>
              <strong>{operationsTrace.title}</strong>
              <p className="muted">{operationsTrace.detail}</p>
            </div>
            <Link className="text-link" href="/operations-policy">
              Review policy
            </Link>
          </div>
        </div>
        {operationsTrace.rows.length > 0 ? (
          <div className="risk-list">
            {operationsTrace.rows.map((row) => (
              <div className="risk-item" key={row.id}>
                <span className={`signal ${row.signalClass}`}>{row.signal}</span>
                <div>
                  <h3>{row.title}</h3>
                  <p>{row.detail}</p>
                  <small>{row.meta}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No operator action has been recorded for this booking yet.
          </p>
        )}
      </section>

      <section className="card risk-watch" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Attention checks</h2>
            <p className="muted">Automatic operational checks for bookings that need operator attention.</p>
          </div>
          <span className={`pill ${attentionSummary.tone}`}>{attentionSummary.label}</span>
        </div>
        {attentionFlags.length > 0 ? (
          <div className="risk-list">
            {attentionFlags.map((flag) => (
              <AttentionItem flag={flag} key={`${flag.severity}-${flag.title}`} />
            ))}
          </div>
        ) : (
          <p className="muted">No active attention checks. Continue normal monitoring from the timeline.</p>
        )}
      </section>

      <section className="card risk-watch" id="finance" style={{ marginBottom: 16 }}>
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
              <AttentionItem flag={flag} key={`${flag.severity}-${flag.title}`} />
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            Customer charge, payout rule, earning, and wallet impact are aligned for this booking.
          </p>
        )}
      </section>

      <section className="card" id="service-pricing-snapshot" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Service pricing snapshot</h2>
            <p className="muted">
              Booking-level price evidence for the selected service duration, partner payout, platform fee,
              tax, and wallet impact.
            </p>
          </div>
          <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
            {financeFlags.length ? `${financeFlags.length} pricing check(s)` : 'Pricing aligned'}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {servicePricingSnapshotRows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.helper}</small>
            </div>
          ))}
        </div>
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
            {dispatchSteps.filter((step) => step.priority === 'Now').length} same-shift
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

      <section className="card ops-note-panel" id="operator-notes" style={{ marginBottom: 16 }}>
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

      <section className="card ops-command-center" id="completed-closeout" style={{ marginBottom: 16 }}>
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

      <section className="card ops-command-center" id="matching-expiry" style={{ marginBottom: 16 }}>
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

      <section className="card ops-command-center" id="no-show-handling" style={{ marginBottom: 16 }}>
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
        <div className="card" id="flow">
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

        <div className="card" id="customer">
          <div className="risk-watch-header">
            <h2>Customer</h2>
            {booking.customerProfile?.id && (
              <Link className="text-link" href={`/customers/${booking.customerProfile.id}`}>
                Open customer record
              </Link>
            )}
          </div>
          <InfoRow label="Name" value={booking.customerProfile?.user?.fullName ?? 'Customer'} />
          <InfoRow label="Phone" value={booking.customerProfile?.user?.phone ?? 'No phone'} />
          <InfoRow label="Address" value={addressLine} />
          <InfoRow label="Pin" value={addressPin} />
          <InfoRow label="Request opened" value={formatDate(booking.createdAt ?? booking.scheduledStartAt)} />
          <InfoRow label="Expires" value={formatDate(booking.expiresAt)} />
        </div>

        <div className="card" id="service">
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

        <div className="card" id="handoff">
          <div className="risk-watch-header">
            <h2>Partner handoff</h2>
            {finalProvider?.id && (
              <Link className="text-link" href={`/partners/${finalProvider.id}`}>
                Open partner record
              </Link>
            )}
            {!finalProvider?.id && <span className="pill pill-neutral">Partner record link pending</span>}
          </div>
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
        <div className="card" id="participants">
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
                  {participant.providerProfile?.id && (
                    <Link className="text-link" href={`/partners/${participant.providerProfile.id}`}>
                      Open partner record
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {(booking.participants ?? []).length === 0 && (
              <p className="muted">No partners have joined yet.</p>
            )}
          </div>
        </div>

        <div className="card" id="payment">
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
          <InfoRow label="Service feedback" value={booking.review ? 'Submitted' : 'Not submitted'} />
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

        <div className="card" id="chat">
          <h2>Chat transcript</h2>
          <p className="muted">
            Admin archive for this booking. Customer and partner apps can hide the room after completion, but
            operations keeps the loaded transcript here.
          </p>
          <div className="stack">
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {messages.length === 0 && <p className="muted">No chat messages yet.</p>}
          </div>
        </div>

        <div className="card" id="location">
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

      <section className="card" id="booking-activity" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking chronological activity</h2>
            <p className="muted">
              Date-sorted factual event trail for this booking: booking status, partner participation, chat
              messages, payment, refund, earning, platform fee, tax, wallet, location, notification, review,
              and operator audit records.
            </p>
          </div>
          <span className="pill pill-info">{bookingActivityRecords.length} event(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {bookingActivitySummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {bookingActivityRecords.length ? (
            bookingActivityRecords.map((record) => (
              <div className="setup-stage-item" key={`${record.type}-${record.id}-${record.at}`}>
                <span>{record.type}</span>
                <div>
                  {record.href ? (
                    <Link className="text-link" href={record.href}>
                      <strong>{record.title}</strong>
                    </Link>
                  ) : (
                    <strong>{record.title}</strong>
                  )}
                  <p className="muted">{record.detail}</p>
                </div>
                <small>{formatDate(record.at)}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No booking activity has been recorded yet</strong>
                <p className="muted">Matching, payment, chat, location, and audit events will appear here.</p>
              </div>
              <small>0</small>
            </div>
          )}
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

type OperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: 'pill-success' | 'pill-info' | 'pill-warn' | 'pill-danger' | 'pill-neutral';
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'note'; preset: string; label: string }
    | { type: 'task'; taskType: string; taskStatus: string; label: string };
};

function OperatorCommandAction({ bookingId, command }: { bookingId: string; command: OperatorCommand }) {
  if (command.action.type === 'link') {
    return <ActionLink href={command.action.href} label={command.action.label} />;
  }

  if (command.action.type === 'note') {
    return (
      <form action={addBookingOpsNote}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="preset" value={command.action.preset} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  return (
    <OpsTaskAction
      bookingId={bookingId}
      type={command.action.taskType}
      status={command.action.taskStatus}
      label={command.action.label}
    />
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

function bookingOperatorCommandQueue({
  booking,
  attentionFlags,
  messages,
  latestLocation,
}: {
  booking: AdminBookingDetail;
  attentionFlags: AttentionFlag[];
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot;
}) {
  const commands: OperatorCommand[] = [];
  const add = (command: OperatorCommand) => commands.push(command);
  const activeStatus = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const partnerLabel = finalPartner ? providerName(finalPartner) : 'No final partner';

  if (booking.status === 'OPEN_MATCHING') {
    add({
      id: 'matching-watch',
      label: 'MATCH',
      title: 'Monitor customer choice',
      detail: `${booking.participants?.length ?? 0} partner(s) are in the shortlist. Customer still chooses the final partner.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#participants', label: 'Open shortlist' },
    });
  }

  if (booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0) {
    add({
      id: 'partner-supply',
      label: 'SUPPLY',
      title: 'Check nearby partner supply',
      detail:
        'No partner has joined yet. Review marketplace candidates and notification delivery before widening operations policy.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#backup-supply', label: 'Open supply' },
    });
  }

  if (activeStatus && !booking.chatRoom) {
    add({
      id: 'chat-repair',
      label: 'CHAT',
      title: 'Repair chat handoff',
      detail:
        'A matched or active booking should have a retained chat room for customer support and admin review.',
      owner: 'Support operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '/bookings?view=chat-repair', label: 'Open queue' },
    });
  } else if (booking.chatRoom && activeStatus && messages.length === 0) {
    add({
      id: 'chat-first-contact',
      label: 'CHAT',
      title: 'Monitor first chat contact',
      detail:
        'Chat is ready but no message has been sent yet. Add a note if either side reports uncertainty.',
      owner: 'Support operator',
      tone: 'pill-info',
      action: {
        type: 'note',
        label: 'Log watch',
        preset: 'Chat is ready but quiet; support is monitoring first customer/partner contact.',
      },
    });
  }

  if (activeStatus && !latestLocation) {
    add({
      id: 'location-request',
      label: 'LOC',
      title: 'Ask partner to share location',
      detail: `${partnerLabel} has not shared a saved current service pin for this active booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'BLOCKED', label: 'Flag location' },
    });
  } else if (latestLocation && latestProviderLocationFreshness(booking) !== 'recent') {
    add({
      id: 'location-stale',
      label: 'LOC',
      title: 'Refresh stale partner location',
      detail: providerLocationMetricHelper(booking),
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'PENDING', label: 'Reset check' },
    });
  }

  if (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED') {
    add({
      id: 'capture-payment',
      label: 'PAY',
      title: 'Capture completed service payment',
      detail: 'Service is completed but payment is still authorized. Review capture before payout closeout.',
      owner: 'Payments operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#payment', label: 'Open payment' },
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    add({
      id: 'cash-debt',
      label: 'CASH',
      title: 'Settle partner cash fee debt',
      detail: 'Cash service fee debt blocks future partner acceptance until the company fee is settled.',
      owner: 'Finance operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '#finance', label: 'Open finance' },
    });
  }

  if (canCloseoutCompletedBooking(booking)) {
    add({
      id: 'completed-closeout',
      label: 'CLOSE',
      title: 'Reconcile completed booking',
      detail:
        'Ensure capture, earning, tax, platform fee, and wallet ledger records exist before leaving the booking.',
      owner: 'Finance operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#completed-closeout', label: 'Open closeout' },
    });
  }

  if (canExpireBooking(booking.status)) {
    add({
      id: 'expire-matching',
      label: 'TTL',
      title: 'Expire if matching window is over',
      detail: 'Use this only when the customer should stop waiting and payment hold needs release.',
      owner: 'Dispatch operator',
      tone: 'pill-info',
      action: { type: 'link', href: '#matching-expiry', label: 'Open expiry' },
    });
  }

  if (canMarkNoShow(booking.status)) {
    add({
      id: 'no-show-option',
      label: 'NO-SHOW',
      title: 'No-show action available',
      detail:
        'Use only after confirming the customer or partner did not proceed and communication is retained.',
      owner: 'Support operator',
      tone: 'pill-neutral',
      action: { type: 'link', href: '#no-show-handling', label: 'Open action' },
    });
  }

  const pendingTasks = bookingOpsTaskCards(booking).filter((task) => task.status !== 'DONE');
  if (pendingTasks.length > 0) {
    add({
      id: 'ops-task-next',
      label: 'TASK',
      title: `Finish ${pendingTasks[0].label.toLowerCase()}`,
      detail: pendingTasks[0].helper,
      owner: 'Operations',
      tone: pendingTasks[0].status === 'BLOCKED' ? 'pill-danger' : 'pill-info',
      action: {
        type: 'task',
        taskType: pendingTasks[0].type,
        taskStatus: pendingTasks[0].status === 'BLOCKED' ? 'PENDING' : 'DONE',
        label: pendingTasks[0].status === 'BLOCKED' ? 'Reopen' : 'Mark done',
      },
    });
  }

  if (commands.length === 0) {
    add({
      id: 'normal-monitoring',
      label: 'OK',
      title: 'Normal monitoring',
      detail:
        'No immediate operator action is active. Keep the record visible until the next booking transition.',
      owner: 'Operations',
      tone: 'pill-success',
      action: {
        type: 'note',
        label: 'Log check',
        preset: 'Booking reviewed; no immediate operator action needed at this time.',
      },
    });
  }

  const urgentCount = commands.filter(
    (command) => command.tone === 'pill-danger' || command.tone === 'pill-warn',
  ).length;
  const labels = [
    {
      label: 'Active commands',
      value: String(commands.length),
      helper: urgentCount ? `${urgentCount} need same-shift attention.` : 'No urgent handling step.',
    },
    {
      label: 'Partner',
      value: partnerLabel,
      helper: finalPartner ? 'Preferred/final partner context.' : 'No partner is selected yet.',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? 'Retained' : 'Missing',
      helper: `${messages.length} message(s) in admin archive.`,
    },
    {
      label: 'Attention flags',
      value: String(attentionFlags.length),
      helper: 'Factual handling checks only.',
    },
  ];

  return {
    status: urgentCount ? `${urgentCount} action(s)` : 'Monitor',
    tone: urgentCount ? 'pill-warn' : 'pill-success',
    labels,
    commands: commands.slice(0, 8),
  };
}

function bookingOperatorActionMatrix(booking: AdminBookingDetail) {
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentIsTerminal = isTerminalPayment(paymentStatus);
  const paymentActionAvailable = Boolean(booking.payment?.id) && !paymentIsTerminal;
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const closeoutAvailable = canCloseoutCompletedBooking(booking);
  const expireAvailable = canExpireBooking(booking.status);
  const noShowAvailable = canMarkNoShow(booking.status);
  const refundRows = bookingRefundRows(booking);

  return [
    {
      action: 'Payment sync',
      available: Boolean(booking.payment?.providerRef) && !paymentIsTerminal,
      status: Boolean(booking.payment?.providerRef) && !paymentIsTerminal ? 'Available' : 'Locked',
      tone: Boolean(booking.payment?.providerRef) && !paymentIsTerminal ? 'pill-info' : 'pill-neutral',
      evidence: booking.payment?.providerRef
        ? `${paymentStatus} / provider ref ${booking.payment.providerRef}`
        : 'No payment provider reference to sync.',
      operatorRule:
        'Use for provider-gateway reconciliation only. Do not change customer outcome from sync alone.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Capture payment',
      available: paymentActionAvailable && paymentStatus === 'AUTHORIZED',
      status: paymentActionAvailable && paymentStatus === 'AUTHORIZED' ? 'Available' : 'Locked',
      tone: paymentActionAvailable && paymentStatus === 'AUTHORIZED' ? 'pill-warn' : 'pill-neutral',
      evidence:
        paymentStatus === 'AUTHORIZED'
          ? `${booking.status} / ${money(booking.payment?.amount, booking.payment?.currency)} authorized`
          : `Payment status is ${paymentStatus}.`,
      operatorRule:
        'Capture only after service completion is confirmed by retained booking, chat, and closeout evidence.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Release or refund',
      available: paymentActionAvailable,
      status: paymentActionAvailable ? 'Available' : 'Locked',
      tone: paymentActionAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: refundRows.length
        ? `${refundRows.length} refund row(s) already recorded.`
        : `${booking.status} / payment ${paymentStatus}.`,
      operatorRule:
        'Release or refund only after cancellation, expiry, or no-show evidence has been reviewed.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Settle cash fee debt',
      available: cashDebt,
      status: cashDebt ? 'Available' : 'Locked',
      tone: cashDebt ? 'pill-danger' : 'pill-neutral',
      evidence: cashDebt
        ? `${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} gates final acceptance or customer selection.`
        : booking.payment?.method === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${booking.payment?.method ?? 'No method'} booking.`,
      operatorRule:
        'Settle only when company fee deposit or admin offset evidence is available for this cash booking.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Reconcile completed booking',
      available: closeoutAvailable,
      status: closeoutAvailable ? 'Available' : 'Locked',
      tone: closeoutAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: completedCloseoutLabel(booking),
      operatorRule:
        'Run after payment, earning, tax, platform fee, wallet, and chat archive records are aligned.',
      href: '#completed-closeout',
      hrefLabel: 'Open closeout',
    },
    {
      action: 'Expire matching',
      available: expireAvailable,
      status: expireAvailable ? 'Available' : 'Locked',
      tone: expireAvailable ? 'pill-info' : 'pill-neutral',
      evidence: expireAvailable
        ? `Open matching can be expired. Timer ${formatDate(booking.expiresAt)}.`
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Expire only when the customer should stop waiting and the payment hold can be released or reviewed.',
      href: '#matching-expiry',
      hrefLabel: 'Open expiry',
    },
    {
      action: 'Mark no-show',
      available: noShowAvailable,
      status: noShowAvailable ? 'Available' : 'Locked',
      tone: noShowAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: noShowAvailable
        ? 'Use after communication and service movement are reviewed.'
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Mark no-show only from factual chat, alert, location, and operator-note evidence. Keep the record descriptive.',
      href: '#no-show-handling',
      hrefLabel: 'Open no-show',
    },
    {
      action: 'Add operator note',
      available: true,
      status: 'Available',
      tone: 'pill-info',
      evidence: `${bookingOperatorNoteLines(booking).length} note line(s) currently retained.`,
      operatorRule:
        'Use notes to record what happened, who was contacted, and what evidence supports the next decision.',
      href: '#operator-notes',
      hrefLabel: 'Open notes',
    },
  ];
}

function bookingOperatorPriorityBriefing({
  booking,
  operatorCommandQueue,
  closeoutReadiness,
  financeFlags,
  latestLocation,
  messageCount,
}: {
  booking: AdminBookingDetail;
  operatorCommandQueue: ReturnType<typeof bookingOperatorCommandQueue>;
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
  financeFlags: AttentionFlag[];
  latestLocation?: AdminLocationSnapshot;
  messageCount: number;
}) {
  const primaryCommand = operatorCommandQueue.commands[0];
  const nextAction = bookingOperatingNextAction(booking);
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const participantCount = booking.participants?.length ?? 0;
  const customerName = booking.customerProfile?.user?.fullName ?? 'Customer';
  const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
  const partnerLabel = finalPartner ? providerName(finalPartner) : 'Not selected';
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const locationLabel = latestLocation
    ? providerLocationMetricValue(booking)
    : ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
      ? 'Missing'
      : 'Not required yet';
  const closeoutLabel =
    closeoutReadiness.openItems.length > 0
      ? `${closeoutReadiness.openItems.length} item(s)`
      : closeoutReadiness.status;

  return {
    status: primaryCommand.tone === 'pill-success' ? 'Monitoring' : 'Action first',
    tone: primaryCommand.tone,
    rows: [
      {
        label: 'First action',
        value: primaryCommand.title,
        helper: `${primaryCommand.owner}: ${primaryCommand.detail}`,
      },
      {
        label: 'Next operator step',
        value: nextAction.title,
        helper: nextAction.detail,
      },
      {
        label: 'Customer',
        value: customerName,
        helper: `${customerPhone} / ${bookingAddressSnapshotLabel(booking)}`,
      },
      {
        label: 'Partner state',
        value: partnerLabel,
        helper: `${participantCount} joined / ${providerHint(booking)}`,
      },
      {
        label: 'Chat archive',
        value: booking.chatRoom ? 'Ready' : 'Missing',
        helper: `${messageCount} retained message(s). Admin keeps chat history after service closeout.`,
      },
      {
        label: 'Location record',
        value: locationLabel,
        helper: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
          : providerLocationMetricHelper(booking),
      },
      {
        label: 'Payment',
        value: paymentLabel,
        helper: paymentHint(booking),
      },
      {
        label: 'Closeout',
        value: closeoutLabel,
        helper:
          financeFlags.length > 0
            ? `${financeFlags.length} finance check(s): ${financeFlags.map((flag) => flag.title).join(', ')}`
            : closeoutReadiness.helper,
      },
    ],
    steps: [
      {
        id: 'priority-command',
        label: '1',
        title: primaryCommand.title,
        detail: primaryCommand.detail,
        href: '#operator-command-queue',
        linkLabel: 'Open queue',
      },
      {
        id: 'priority-handoff',
        label: '2',
        title: finalPartner ? 'Confirm partner handoff' : 'Keep partner choice visible',
        detail: finalPartner
          ? `${providerName(finalPartner)} is linked. Confirm chat, service pin, and payment handoff are visible.`
          : 'Customer choice is still pending. Keep candidate list, partner alerts, and marketplace window easy to audit.',
        href: '#booking-handoff-checklist',
        linkLabel: 'Open handoff',
      },
      {
        id: 'priority-closeout',
        label: '3',
        title: closeoutReadiness.status,
        detail: closeoutReadiness.helper,
        href: '#booking-closeout-readiness',
        linkLabel: 'Open closeout',
      },
    ],
  };
}

function bookingEvidencePacket({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  bookingActivityRecords,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  bookingActivityRecords: BookingActivityRecord[];
}) {
  const chatReady = Boolean(booking.chatRoom);
  const trail = locationTrail(booking);
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const evidenceCount =
    messages.length +
    trail.length +
    notificationTrace.rows.length +
    refundLedgerRows.length +
    operatorNoteLines.length +
    (booking.auditLogs?.length ?? 0);
  const hasDecisionEvidence =
    messages.length > 0 ||
    trail.length > 0 ||
    notificationTrace.rows.length > 0 ||
    operatorNoteLines.length > 0;
  const status = hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence';
  const tone = hasDecisionEvidence ? 'pill-success' : 'pill-warn';
  const summary = hasDecisionEvidence
    ? `Admin can review ${evidenceCount} retained evidence item(s) before changing booking outcome.`
    : 'No chat, alert, location, or operator note evidence is attached yet; add a note before manual outcome changes.';

  return {
    status,
    tone,
    summary,
    metrics: [
      {
        label: 'Chat evidence',
        value: chatReady ? `${messages.length} message(s)` : 'No room',
        helper: chatReady
          ? 'Matched booking chat is retained in admin even after mobile closeout.'
          : 'Matched bookings should create a retained chat room before service handoff.',
      },
      {
        label: 'Location evidence',
        value: latestLocation ? formatDate(latestLocation.recordedAt) : `${trail.length} row(s)`,
        helper: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} latest partner pin.`
          : 'No partner pin is saved for this booking yet.',
      },
      {
        label: 'Payment evidence',
        value: booking.payment?.status ?? 'NONE',
        helper: `${booking.payment?.method ?? 'No method'} / ${money(
          booking.payment?.amount,
          booking.payment?.currency,
        )}`,
      },
      {
        label: 'Refund evidence',
        value: `${refundLedgerRows.length} refund row(s)`,
        helper: refundLedgerRows.length
          ? refundLedgerRows
              .map((row) => `${row.status} ${money(row.amount, row.payment?.currency ?? undefined)}`)
              .join(', ')
          : 'No refund row is attached to this booking.',
      },
      {
        label: 'Alert evidence',
        value: `${notificationTrace.rows.length} alert(s)`,
        helper: `${failedAlerts} failed delivery row(s), ${notificationTrace.backupBatches.length} marketplace batch(es).`,
      },
      {
        label: 'Operator note evidence',
        value: `${operatorNoteLines.length} note(s)`,
        helper:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'No internal note has been added for manual decision context.',
      },
    ],
    records: [
      {
        id: 'address-evidence',
        label: 'Address',
        title: 'Address evidence',
        detail: booking.addressSnapshot
          ? `Locked address snapshot: ${bookingAddressSnapshotLabel(booking)}.`
          : 'No immutable address snapshot is attached yet.',
        evidence: booking.addressSnapshot
          ? `Pin ${coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)}`
          : 'Legacy or missing booking address needs operator review.',
        href: '#address-radius-contract',
      },
      {
        id: 'chat-evidence',
        label: 'Chat',
        title: 'Chat evidence',
        detail: chatReady
          ? `Room ${shortId(booking.chatRoom?.id ?? 'missing')} keeps ${messages.length} retained message(s).`
          : 'No retained chat room is attached.',
        evidence:
          messages.length > 0
            ? `Latest message: ${formatDate(messages[messages.length - 1]?.createdAt)}`
            : 'No chat message evidence.',
        href: '#chat',
      },
      {
        id: 'location-evidence',
        label: 'Location',
        title: 'Location evidence',
        detail: latestLocation
          ? `Latest partner pin is ${coordinateLabel(latestLocation.lat, latestLocation.lng)}.`
          : 'No partner location pin has been retained.',
        evidence: latestLocation
          ? `Recorded ${formatDate(latestLocation.recordedAt)}`
          : 'No location timestamp.',
        href: '#location',
      },
      {
        id: 'payment-evidence',
        label: 'Payment',
        title: 'Payment evidence',
        detail: `${booking.payment?.method ?? 'No method'} payment is ${booking.payment?.status ?? 'NONE'}.`,
        evidence: `${financeTrace.customerPrice} customer price / ${financeTrace.walletLedger} wallet impact.`,
        href: '#payment',
      },
      {
        id: 'refund-evidence',
        label: 'Refund',
        title: 'Refund evidence',
        detail: refundLedgerRows.length
          ? `${refundLedgerRows.length} refund row(s) are attached to this booking.`
          : 'No refund row is attached to this booking.',
        evidence: bookingRefundLedgerEvidence(booking),
        href: '#payment',
      },
      {
        id: 'alert-evidence',
        label: 'Alerts',
        title: 'Alert evidence',
        detail: `${notificationTrace.rows.length} notification row(s) and ${notificationTrace.backupBatches.length} marketplace batch(es).`,
        evidence: failedAlerts
          ? `${failedAlerts} failed delivery row(s)`
          : 'No failed delivery row in this packet.',
        href: '#alerts',
      },
      {
        id: 'note-evidence',
        label: 'Notes',
        title: 'Operator note evidence',
        detail: operatorNoteLines.length
          ? 'Internal support notes are attached to this booking.'
          : 'No internal support note has been added yet.',
        evidence:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'Use operator notes before manual cancellation, no-show, or refund decisions.',
        href: '#operator-notes',
      },
      {
        id: 'ops-evidence',
        label: 'Ops',
        title: 'Operations evidence',
        detail: `${booking.opsTasks?.length ?? 0} task row(s), ${booking.auditLogs?.length ?? 0} audit row(s).`,
        evidence:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'Use structured ops status and audit rows before manual outcome changes.',
        href: '#structured-ops-status',
      },
      {
        id: 'audit-evidence',
        label: 'Audit',
        title: 'Audit evidence',
        detail: `${booking.auditLogs?.length ?? 0} audit row(s), ${bookingActivityRecords.length} timeline event(s).`,
        evidence: bookingActivityRecords[0]
          ? `Latest event: ${bookingActivityRecords[0].title} / ${formatDate(bookingActivityRecords[0].at)}`
          : 'No timeline event retained.',
        href: '#booking-activity',
      },
    ],
  };
}

function bookingManualDecisionReadiness({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
}) {
  const chatEvidence = messages.length > 0;
  const alertEvidence = notificationTrace.rows.length > 0;
  const noteEvidence = operatorNoteLines.length > 0;
  const movementEvidence = Boolean(latestLocation);
  const evidenceSummary = [
    chatEvidence ? `${messages.length} chat message(s)` : 'no chat messages',
    movementEvidence ? `location ${formatDate(latestLocation?.recordedAt)}` : 'no partner pin',
    alertEvidence ? `${notificationTrace.rows.length} alert row(s)` : 'no alert rows',
    noteEvidence ? `${operatorNoteLines.length} operator note(s)` : 'no operator notes',
  ].join(' / ');
  const decisionEvidenceReady = chatEvidence || movementEvidence || alertEvidence || noteEvidence;
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const canReviewRefund =
    Boolean(booking.payment) && !['REFUNDED', 'RELEASED', 'FAILED', 'CANCELLED'].includes(paymentStatus);
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const terminal = TERMINAL_BOOKING_STATUSES.has(booking.status);
  const closureTone = terminal
    ? booking.status === 'NO_SHOW'
      ? 'pill-danger'
      : 'pill-info'
    : 'pill-neutral';

  return [
    {
      lane: 'Customer cancellation or closure',
      scope: 'After direct matching, customer outcome changes are handled by operations evidence review.',
      status: terminal
        ? bookingClosureSummary(booking).status
        : decisionEvidenceReady
          ? 'Evidence ready'
          : 'Needs note',
      tone: terminal ? closureTone : decisionEvidenceReady ? 'pill-success' : 'pill-warn',
      evidence: evidenceSummary,
      operatorUse:
        'Use retained chat, alerts, location, and operator notes before changing customer-facing booking outcome.',
      href: '#booking-evidence-packet',
    },
    {
      lane: 'No-show decision',
      scope: 'No-show is an admin decision based on communication and service movement context.',
      status:
        booking.status === 'NO_SHOW'
          ? 'Marked no-show'
          : canMarkNoShow(booking.status)
            ? decisionEvidenceReady
              ? 'Ready to review'
              : 'Needs evidence'
            : 'Locked',
      tone:
        booking.status === 'NO_SHOW'
          ? 'pill-danger'
          : canMarkNoShow(booking.status)
            ? decisionEvidenceReady
              ? 'pill-info'
              : 'pill-warn'
            : 'pill-neutral',
      evidence: evidenceSummary,
      operatorUse: 'Check chat, alert delivery, partner location, and notes before using the no-show action.',
      href: '#no-show-handling',
    },
    {
      lane: 'Refund or payment release',
      scope: 'Payment outcome must match booking closure and customer communication.',
      status: refundLedgerRows.length
        ? `${refundLedgerRows.length} refund row(s)`
        : canReviewRefund
          ? 'Review payment'
          : 'No payment action',
      tone: refundLedgerRows.length ? 'pill-warn' : canReviewRefund ? 'pill-info' : 'pill-neutral',
      evidence: `${paymentStatus} / ${bookingRefundLedgerEvidence(booking)} / ${evidenceSummary}`,
      operatorUse:
        'Use payment status, refund rows, and evidence packet before release, refund, or capture decisions.',
      href: '#payment-actions',
    },
    {
      lane: 'Cash fee settlement',
      scope: 'Cash bookings can create partner fee debt; debt blocks final acceptance until settled.',
      status: cashDebt
        ? 'Settlement required'
        : booking.payment?.method === 'CASH'
          ? 'Cash ledger clear'
          : 'Not cash',
      tone: cashDebt ? 'pill-danger' : booking.payment?.method === 'CASH' ? 'pill-success' : 'pill-neutral',
      evidence: bookingCashDebtNeedsSettlement(booking)
        ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
        : `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'}`,
      operatorUse:
        'If debt exists, confirm company fee deposit or admin offset before future final acceptance is unlocked.',
      href: '#finance',
    },
    {
      lane: 'Completed work closeout',
      scope: 'Completed bookings need payment, earning, tax, platform fee, and wallet records aligned.',
      status: closeoutReadiness.status,
      tone: closeoutReadiness.tone,
      evidence: closeoutReadiness.openItems.length
        ? closeoutReadiness.openItems.map((item) => item.label).join(', ')
        : closeoutReadiness.helper,
      operatorUse: 'Use this before weekly/monthly/admin-date settlement batches and payout reporting.',
      href: '#booking-closeout-readiness',
    },
  ];
}

function buildBookingEvidenceBundleRows({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  bookingActivityRecords,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  bookingActivityRecords: BookingActivityRecord[];
}) {
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const acceptedParticipants =
    booking.participants?.filter((participant) => ['ACCEPTED', 'SELECTED'].includes(participant.status))
      .length ?? 0;
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const latestActivity = bookingActivityRecords[0];
  const addressReady = Boolean(booking.addressSnapshot);
  const chatReady = Boolean(booking.chatRoom);
  const hasMoneyTrace = Boolean(booking.payment || booking.earning || refundLedgerRows.length);
  const hasLocationTrace = Boolean(latestLocation || locationTrail(booking).length);

  return [
    {
      lane: 'Customer',
      recordLabel: booking.customerProfile?.id ? shortId(booking.customerProfile.id) : 'Profile missing',
      status: booking.customerProfile?.id ? 'Linked' : 'Missing',
      tone: booking.customerProfile?.id ? 'pill-success' : 'pill-warn',
      evidence: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      }`,
      operatorUse:
        'Open the customer record to review bookings, wallet, addresses, and retained chat history.',
      href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : '#customer',
    },
    {
      lane: 'Address',
      recordLabel: addressReady ? 'BookingAddressSnapshot' : 'Snapshot missing',
      status: addressReady ? 'Locked' : 'Repair needed',
      tone: addressReady ? 'pill-success' : 'pill-danger',
      evidence: `${bookingAddressSnapshotLabel(booking)} / ${bookingDispatchPin(booking).source}`,
      operatorUse: 'Use this immutable address snapshot for partner radius checks and service evidence.',
      href: '#address-radius-contract',
    },
    {
      lane: 'Partner',
      recordLabel: finalPartner?.id ? shortId(finalPartner.id) : 'Selection pending',
      status: finalPartner?.id ? 'Selected' : `${acceptedParticipants} ready`,
      tone: finalPartner?.id ? 'pill-success' : acceptedParticipants ? 'pill-warn' : 'pill-info',
      evidence: finalPartner
        ? `${providerName(finalPartner)} / ${providerLocationMetricValue(booking)}`
        : `${booking.participants?.length ?? 0} participant row(s), ${acceptedParticipants} accepted row(s)`,
      operatorUse: 'Confirm the customer final partner selection and final-gate settlement requirements.',
      href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
    },
    {
      lane: 'Chat',
      recordLabel: booking.chatRoom ? shortId(booking.chatRoom.id) : 'No room',
      status: chatReady ? 'Archived' : 'Missing',
      tone: chatReady ? 'pill-success' : 'pill-warn',
      evidence: chatReady
        ? `${messages.length} retained message(s), latest ${
            messages[messages.length - 1]?.createdAt
              ? formatDate(messages[messages.length - 1].createdAt)
              : 'none'
          }`
        : bookingChatRepairNeedsOps(booking)
          ? 'Matched booking should have a retained chat archive.'
          : 'Chat opens after customer final partner selection.',
      operatorUse: 'Use the transcript for service handoff, cancellation, no-show, and refund context.',
      href: chatReady ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
    },
    {
      lane: 'Money',
      recordLabel: booking.payment?.id ? shortId(booking.payment.id) : 'No payment row',
      status: hasMoneyTrace
        ? (booking.payment?.status ?? booking.earning?.status ?? 'Trace loaded')
        : 'Missing',
      tone: hasMoneyTrace ? 'pill-info' : 'pill-warn',
      evidence: `${booking.payment?.method ?? 'NONE'} / customer ${financeTrace.customerPrice} / partner ${
        financeTrace.providerPayout
      } / wallet ${financeTrace.walletLedger}`,
      operatorUse: 'Check payment, earning, tax, fee, refund, payout, and cash settlement records together.',
      href: '#finance',
    },
    {
      lane: 'Location',
      recordLabel: latestLocation ? shortId(latestLocation.id) : 'No latest pin',
      status: hasLocationTrace ? providerLocationMetricValue(booking) : 'Missing',
      tone: hasLocationTrace ? 'pill-info' : 'pill-neutral',
      evidence: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
        : `Customer pin ${bookingDispatchPin(booking).label}`,
      operatorUse:
        'Use location rows only as operational history; routing and live tracking are not required for MVP.',
      href: '#location',
    },
    {
      lane: 'Alerts',
      recordLabel: `${notificationTrace.rows.length} notification row(s)`,
      status: failedAlerts ? `${failedAlerts} failed` : 'Loaded',
      tone: failedAlerts ? 'pill-warn' : notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} partner alert(s), ${
        notificationTrace.backupBatches.length
      } marketplace batch(es)`,
      operatorUse:
        'Check whether customer and partner app notifications were created, delivered, read, or retried.',
      href: `/notifications?booking=${encodeURIComponent(booking.id)}`,
    },
    {
      lane: 'Operator trail',
      recordLabel: `${bookingActivityRecords.length} event(s)`,
      status: operatorNoteLines.length || latestActivity ? 'Retained' : 'Empty',
      tone: operatorNoteLines.length || latestActivity ? 'pill-success' : 'pill-neutral',
      evidence: latestActivity
        ? `${latestActivity.title} / ${formatDate(latestActivity.at)}`
        : (operatorNoteLines[operatorNoteLines.length - 1] ?? 'No operator trail loaded'),
      operatorUse: 'Use notes and audit rows before manual closeout, no-show, refund, or settlement actions.',
      href: '#booking-activity',
    },
  ];
}

type BookingCloseoutChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: 'ops-task-done' | 'ops-task-warning' | 'ops-task-blocked';
  pillClass: 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';
};

function buildBookingCloseoutChecklist({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
  bookingActivityRecords,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
  bookingActivityRecords: BookingActivityRecord[];
}): BookingCloseoutChecklistItem[] {
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const acceptedParticipants =
    booking.participants?.filter((participant) => ['ACCEPTED', 'SELECTED'].includes(participant.status))
      .length ?? 0;
  const addressReady = Boolean(booking.addressSnapshot);
  const chatNeeded = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const chatReady = Boolean(booking.chatRoom);
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const terminal = TERMINAL_BOOKING_STATUSES.has(booking.status);
  const taxRows = booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0;
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const operatorTrailCount =
    operatorNoteLines.length + bookingActivityRecords.length + (booking.auditLogs?.length ?? 0);
  const latestMessage = messages[messages.length - 1];
  const closeoutPillClass = toChecklistPillClass(closeoutReadiness.tone);

  return [
    {
      title: 'Address snapshot',
      status: addressReady ? 'Ready' : 'Repair needed',
      detail: addressReady
        ? `${bookingAddressSnapshotLabel(booking)} is locked for partner distance and evidence review.`
        : 'BookingAddressSnapshot is required before distance matching and closeout review are reliable.',
      operatorRule:
        'Use the booking address, not the customer current location, for 10km partner participation.',
      href: '#address-radius-contract',
      className: addressReady ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: addressReady ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Customer final partner choice',
      status: finalPartner ? 'Selected' : acceptedParticipants ? 'Choice pending' : 'Waiting',
      detail: finalPartner
        ? `${providerName(finalPartner)} is linked as the selected partner for this booking.`
        : `${acceptedParticipants} accepted partner(s) are available for the customer decision step.`,
      operatorRule: 'No automatic partner assignment; customer selection is the final matching authority.',
      href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
      className: finalPartner
        ? 'ops-task-done'
        : acceptedParticipants
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: finalPartner ? 'pill-success' : acceptedParticipants ? 'pill-warn' : 'pill-info',
    },
    {
      title: 'Chat archive',
      status: chatReady ? 'Archived' : chatNeeded ? 'Repair needed' : 'Locked',
      detail: chatReady
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} keeps ${messages.length} message(s); latest ${
            latestMessage?.createdAt ? formatDate(latestMessage.createdAt) : 'not sent yet'
          }.`
        : chatNeeded
          ? 'Matched or active booking has no retained chat room attached.'
          : 'Chat opens after the customer selects the final partner.',
      operatorRule: 'Mobile chat may hide after completion, but admin must retain the transcript.',
      href: chatReady
        ? `/chat-archive?q=${encodeURIComponent(booking.id)}`
        : chatNeeded
          ? '/chat-archive?status=missing-room'
          : '#chat',
      className: chatReady ? 'ops-task-done' : chatNeeded ? 'ops-task-blocked' : 'ops-task-warning',
      pillClass: chatReady ? 'pill-success' : chatNeeded ? 'pill-danger' : 'pill-info',
    },
    {
      title: 'Money and wallet gate',
      status: cashDebt ? 'Settlement needed' : (booking.payment?.status ?? 'No payment'),
      detail: cashDebt
        ? `${financeTrace.walletLedger}. Partner can browse and join, but final acceptance is held until settled or offset.`
        : `${booking.payment?.method ?? 'NONE'} payment / customer ${financeTrace.customerPrice} / partner ${financeTrace.providerPayout}.`,
      operatorRule:
        'Cash fee debt must be resolved before final acceptance, service start, or payout batch release.',
      href: cashDebt ? '/cash-settlements' : '#finance',
      className: cashDebt ? 'ops-task-blocked' : booking.payment ? 'ops-task-done' : 'ops-task-warning',
      pillClass: cashDebt ? 'pill-danger' : booking.payment ? 'pill-success' : 'pill-warn',
    },
    {
      title: 'Manual outcome evidence',
      status: terminal ? 'Terminal review' : refundLedgerRows.length ? 'Refund evidence' : 'Open',
      detail: refundLedgerRows.length
        ? `${refundLedgerRows.length} refund row(s). ${bookingRefundLedgerEvidence(booking)}`
        : terminal
          ? `${booking.status} booking needs retained chat, location, payment, and operator trail before closeout.`
          : `Open booking with ${messages.length} chat message(s), ${notificationTrace.rows.length} alert(s), and ${failedAlerts} failed alert(s).`,
      operatorRule: 'Cancellation, no-show, refund, and release decisions are admin evidence decisions.',
      href: refundLedgerRows.length ? '/refunds?review=open' : '#manual-decision-readiness',
      className: refundLedgerRows.length || terminal ? 'ops-task-warning' : 'ops-task-done',
      pillClass: refundLedgerRows.length || terminal ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Finance closeout',
      status: closeoutReadiness.status,
      detail: closeoutReadiness.openItems.length
        ? `Open items: ${closeoutReadiness.openItems.map((item) => item.label).join(', ')}. Tax rows ${taxRows}.`
        : `${closeoutReadiness.helper} Tax rows ${taxRows}; operator trail ${operatorTrailCount}.`,
      operatorRule: 'Use this before weekly, monthly, or admin-selected settlement batch processing.',
      href: '#booking-closeout-readiness',
      className:
        closeoutPillClass === 'pill-danger'
          ? 'ops-task-blocked'
          : closeoutPillClass === 'pill-warn'
            ? 'ops-task-warning'
            : 'ops-task-done',
      pillClass: closeoutPillClass,
    },
    {
      title: 'Location and alert trail',
      status: latestLocation ? 'Movement saved' : notificationTrace.rows.length ? 'Alerts saved' : 'Sparse',
      detail: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}.`
        : `${notificationTrace.rows.length} alert row(s), ${failedAlerts} failed delivery row(s).`,
      operatorRule: 'Use saved pins and alert delivery only as factual operations history.',
      href: latestLocation ? '#location' : `/notifications?booking=${encodeURIComponent(booking.id)}`,
      className: latestLocation || notificationTrace.rows.length ? 'ops-task-done' : 'ops-task-warning',
      pillClass: latestLocation || notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
    },
  ];
}

function toChecklistPillClass(value: string): BookingCloseoutChecklistItem['pillClass'] {
  if (
    value === 'pill-success' ||
    value === 'pill-warn' ||
    value === 'pill-danger' ||
    value === 'pill-info' ||
    value === 'pill-neutral'
  ) {
    return value;
  }

  return 'pill-neutral';
}

type BookingActionEvidenceGateRow = {
  action: string;
  status: string;
  evidence: string;
  operatorRule: string;
  href: string;
  className: BookingCloseoutChecklistItem['className'];
  pillClass: BookingCloseoutChecklistItem['pillClass'];
};

function buildBookingActionEvidenceGate({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
}) {
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentIsTerminal = isTerminalPayment(paymentStatus);
  const paymentActionAvailable = Boolean(booking.payment?.id) && !paymentIsTerminal;
  const hasAddressSnapshot = Boolean(booking.addressSnapshot);
  const hasChatArchive = Boolean(booking.chatRoom);
  const hasDecisionEvidence = Boolean(
    messages.length ||
    latestLocation ||
    notificationTrace.rows.length ||
    operatorNoteLines.length ||
    booking.auditLogs?.length,
  );
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const closeoutAvailable = canCloseoutCompletedBooking(booking);
  const expireAvailable = canExpireBooking(booking.status);
  const noShowAvailable = canMarkNoShow(booking.status);
  const completedWorkEvidenceReady =
    booking.status === 'COMPLETED' && hasChatArchive && paymentStatus === 'AUTHORIZED';
  const manualOutcomeEvidenceLabel = [
    messages.length ? `${messages.length} chat message(s)` : null,
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : null,
    notificationTrace.rows.length ? `${notificationTrace.rows.length} alert row(s)` : null,
    operatorNoteLines.length ? `${operatorNoteLines.length} operator note(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const rows: BookingActionEvidenceGateRow[] = [
    {
      action: 'Payment capture',
      status: completedWorkEvidenceReady
        ? 'Evidence ready'
        : paymentStatus === 'AUTHORIZED'
          ? 'Review first'
          : 'Locked',
      evidence:
        paymentStatus === 'AUTHORIZED'
          ? `${booking.status} / ${hasChatArchive ? 'chat archived' : 'chat missing'} / ${closeoutReadiness.status}`
          : `Payment status is ${paymentStatus}. Capture is only relevant for active authorization.`,
      operatorRule:
        'Capture after completed service evidence is retained; do not capture from payment status alone.',
      href: '#booking-ops',
      className: completedWorkEvidenceReady
        ? 'ops-task-done'
        : paymentStatus === 'AUTHORIZED'
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: completedWorkEvidenceReady
        ? 'pill-success'
        : paymentStatus === 'AUTHORIZED'
          ? 'pill-warn'
          : 'pill-neutral',
    },
    {
      action: 'Release or refund',
      status: paymentActionAvailable ? (hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence') : 'Locked',
      evidence: paymentActionAvailable
        ? `${paymentStatus} / ${refundLedgerRows.length} refund row(s) / ${
            manualOutcomeEvidenceLabel || 'no retained decision evidence yet'
          }`
        : `${paymentStatus} payment cannot be released or refunded from this state.`,
      operatorRule:
        'Use cancellation, expiry, no-show, chat, alert, location, note, and refund rows before money outcome changes.',
      href: '#booking-ops',
      className: paymentActionAvailable
        ? hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: paymentActionAvailable
        ? hasDecisionEvidence
          ? 'pill-success'
          : 'pill-warn'
        : 'pill-neutral',
    },
    {
      action: 'Cash fee settlement',
      status: cashDebt ? 'Evidence required' : booking.payment?.method === 'CASH' ? 'Clear' : 'Not cash',
      evidence: cashDebt
        ? 'Partner cash fee debt is active. Operator needs deposit or admin offset evidence before clearing.'
        : booking.payment?.method === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${booking.payment?.method ?? 'NONE'} booking path.`,
      operatorRule:
        'Negative wallet can still browse/join; final acceptance and payout actions wait for settlement evidence.',
      href: cashDebt ? '/cash-settlements' : '#finance',
      className: cashDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebt
        ? 'pill-danger'
        : booking.payment?.method === 'CASH'
          ? 'pill-success'
          : 'pill-neutral',
    },
    {
      action: 'Completed closeout',
      status: closeoutAvailable ? closeoutReadiness.status : completedCloseoutLabel(booking),
      evidence: closeoutReadiness.openItems.length
        ? closeoutReadiness.openItems.map((item) => item.label).join(', ')
        : closeoutReadiness.helper,
      operatorRule:
        'Run completed closeout only after payment, earning, tax, platform fee, wallet, and chat records align.',
      href: '#completed-closeout',
      className: closeoutAvailable
        ? closeoutReadiness.tone === 'pill-danger'
          ? 'ops-task-blocked'
          : 'ops-task-warning'
        : 'ops-task-done',
      pillClass: closeoutAvailable
        ? toChecklistPillClass(closeoutReadiness.tone)
        : completedCloseoutTone(booking),
    },
    {
      action: 'Expire matching',
      status: expireAvailable ? (hasAddressSnapshot ? 'Ready' : 'Needs address') : 'Locked',
      evidence: expireAvailable
        ? `${hasAddressSnapshot ? 'Address snapshot ready' : 'Address snapshot missing'} / expires ${formatDate(
            booking.expiresAt,
          )}`
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Expire only when the customer should stop waiting and payment release/review path is understood.',
      href: '#matching-expiry',
      className: expireAvailable
        ? hasAddressSnapshot
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: expireAvailable ? (hasAddressSnapshot ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
    {
      action: 'No-show handling',
      status: noShowAvailable ? (hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence') : 'Locked',
      evidence: noShowAvailable
        ? manualOutcomeEvidenceLabel || 'No chat, alert, location, note, or audit evidence is loaded yet.'
        : `Current status is ${booking.status}.`,
      operatorRule:
        'No-show is an admin evidence decision. Record what happened with factual service context only.',
      href: '#no-show-handling',
      className: noShowAvailable
        ? hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: noShowAvailable ? (hasDecisionEvidence ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
  ];

  const needsEvidence = rows.filter((row) => row.className === 'ops-task-warning').length;
  const blocked = rows.filter((row) => row.className === 'ops-task-blocked').length;

  return {
    status: needsEvidence
      ? `${needsEvidence} need evidence`
      : blocked
        ? `${blocked} locked`
        : 'Evidence ready',
    tone: needsEvidence ? 'pill-warn' : blocked ? 'pill-neutral' : 'pill-success',
    rows,
  };
}

function bookingChatRepairNeedsOps(booking: AdminBookingDetail) {
  return (
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status) &&
    !booking.chatRoom
  );
}

function bookingHandoffChecklist(
  booking: AdminBookingDetail,
  messageCount: number,
  latestLocation?: AdminLocationSnapshot,
) {
  const participantCount = booking.participants?.length ?? 0;
  const acceptedCount =
    booking.participants?.filter((participant) => ['ACCEPTED', 'SELECTED'].includes(participant.status))
      .length ?? 0;
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status} / ${money(booking.payment.amount, booking.payment.currency)}`
    : 'No payment record';
  const cashDebtLabel = bookingCashDebtNeedsSettlement(booking)
    ? 'Cash fee debt must be settled before the partner accepts more work.'
    : 'No cash fee debt block on this booking.';
  const chatDetail = booking.chatRoom
    ? `${messageCount} retained message(s). Admin keeps the archive even if mobile hides chat after completion.`
    : 'No chat room is linked yet. Matched or active bookings should create one.';
  const locationDetail = latestLocation
    ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
    : 'No partner service location has been shared yet.';

  return [
    {
      id: 'booking-request',
      label: 'Request',
      title: bookingServiceOptionLabel(booking),
      detail: `${booking.status} / opened ${formatDate(booking.createdAt ?? booking.scheduledStartAt)} / ${bookingAddressSnapshotLabel(booking)}`,
      status: 'Booking facts',
      href: '#customer',
    },
    {
      id: 'partner-response',
      label: 'Partner',
      title: finalPartner ? providerName(finalPartner) : 'Waiting for partner response',
      detail: `${participantCount} partner(s) joined / ${acceptedCount} accepted. The customer remains the final decision maker.`,
      status: 'Partner shortlist',
      href: '#participants',
    },
    {
      id: 'customer-choice',
      label: 'Choice',
      title: booking.selectedProvider ? 'Final partner selected' : 'Customer choice pending',
      detail: booking.selectedProvider
        ? `${providerName(booking.selectedProvider)} is recorded as the final partner.`
        : 'Keep the customer waiting screen synced with accepted partner options.',
      status: 'Customer screen',
      href: '#audit',
    },
    {
      id: 'chat-location',
      label: 'Chat',
      title: booking.chatRoom ? `Chat room ${shortId(booking.chatRoom.id)}` : 'Chat handoff pending',
      detail: `${chatDetail} ${locationDetail}`,
      status: 'Chat/location',
      href: '#structured-ops-status',
    },
    {
      id: 'finance-closeout',
      label: 'Finance',
      title: paymentLabel,
      detail: `${cashDebtLabel} ${booking.earning ? `Earning ledger: ${money(booking.earning.netAmount, booking.earning.currency)}.` : 'No earning ledger yet.'}`,
      status: 'Payment/wallet',
      href: '#finance',
    },
  ];
}

function bookingCloseoutReadiness({
  booking,
  financeFlags,
  latestLocation,
  messageCount,
  notificationCount,
}: {
  booking: AdminBookingDetail;
  financeFlags: AttentionFlag[];
  latestLocation?: AdminLocationSnapshot;
  messageCount: number;
  notificationCount: number;
}) {
  const terminalStatus = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(
    booking.status,
  );
  const activeStatus = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const hasAddress =
    Boolean(booking.addressSnapshot) || (booking.lat !== undefined && booking.lng !== undefined);
  const hasFinanceCloseout =
    booking.status !== 'COMPLETED' ||
    Boolean(
      booking.earning &&
      (booking.earning.taxLogs?.length ?? booking.taxLogs?.length ?? 0) > 0 &&
      (booking.earning.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0 &&
      (booking.earning.walletLedgerEntries?.length ?? booking.walletLedgerEntries?.length ?? 0) > 0,
    );
  const paymentNeedsRelease = ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status);
  const paymentReady =
    !booking.payment ||
    (booking.status === 'COMPLETED'
      ? ['CAPTURED', 'PAID', 'SETTLED'].includes(booking.payment.status) || booking.payment.method === 'CASH'
      : paymentNeedsRelease
        ? ['RELEASED', 'REFUNDED', 'VOIDED', 'CANCELLED'].includes(booking.payment.status)
        : true);
  const cashDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const partnerChoiceReady =
    booking.status === 'CREATED' ||
    booking.status === 'OPEN_MATCHING' ||
    Boolean(booking.selectedProvider) ||
    ['CANCELLED', 'EXPIRED'].includes(booking.status);
  const chatReady = !activeStatus && !terminalStatus ? true : Boolean(booking.chatRoom);
  const locationReady = !activeStatus || Boolean(latestLocation);
  const auditReady = (booking.auditLogs?.length ?? 0) > 0 || (booking.opsTasks?.length ?? 0) > 0;

  const items = [
    {
      id: 'customer-record',
      label: 'Customer',
      status:
        booking.customerProfile?.id && hasAddress
          ? 'Customer and address linked'
          : 'Customer/address needs review',
      detail: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      } / ${hasAddress ? bookingAddressSnapshotLabel(booking) : 'No service address snapshot'}`,
      owner: 'Support',
      href: '#customer',
      ready: Boolean(booking.customerProfile?.id && hasAddress),
    },
    {
      id: 'partner-choice',
      label: 'Partner',
      status: partnerChoiceReady ? 'Partner choice state explainable' : 'Final partner missing',
      detail: finalPartner
        ? `${providerName(finalPartner)} / ${booking.participants?.length ?? 0} participant(s)`
        : 'Customer has not selected a final partner yet.',
      owner: 'Dispatch',
      href: '#participants',
      ready: partnerChoiceReady,
    },
    {
      id: 'chat-archive',
      label: 'Chat',
      status: chatReady ? 'Chat archive state valid' : 'Chat room missing',
      detail: booking.chatRoom
        ? `${messageCount} retained message(s). Admin archive remains after mobile chat is hidden.`
        : 'Matched, active, or closed service records should keep the admin transcript.',
      owner: 'Support',
      href: '#chat',
      ready: chatReady,
    },
    {
      id: 'payment-state',
      label: 'Payment',
      status: paymentReady ? 'Payment path aligned' : 'Payment closeout pending',
      detail: booking.payment
        ? `${booking.payment.method} / ${booking.payment.status} / ${money(
            booking.payment.amount,
            booking.payment.currency,
          )}`
        : 'No payment record is linked.',
      owner: 'Finance',
      href: '#payment',
      ready: paymentReady,
    },
    {
      id: 'finance-ledger',
      label: 'Finance',
      status: hasFinanceCloseout && financeFlags.length === 0 ? 'Ledger complete' : 'Ledger needs review',
      detail:
        booking.status === 'COMPLETED'
          ? `Earning ${booking.earning?.status ?? 'missing'} / ${financeFlags.length} finance check(s).`
          : 'Finance ledger becomes mandatory after completion.',
      owner: 'Finance',
      href: '#finance',
      ready: hasFinanceCloseout && financeFlags.length === 0,
    },
    {
      id: 'cash-settlement',
      label: 'Cash',
      status: cashDebtNeedsSettlement ? 'Cash fee settlement required' : 'No cash fee block',
      detail: cashDebtNeedsSettlement
        ? 'Partner cash collection created company-fee debt; settle before final acceptance, customer selection, service start, or payout release.'
        : 'No negative cash-fee wallet block is active for this booking.',
      owner: 'Finance',
      href: '#finance',
      ready: !cashDebtNeedsSettlement,
    },
    {
      id: 'location-signal',
      label: 'Location',
      status: locationReady ? 'Location state valid' : 'Partner location missing',
      detail: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
        : 'No partner service pin is saved for this active booking.',
      owner: 'Dispatch',
      href: '#location',
      ready: locationReady,
    },
    {
      id: 'alerts-audit',
      label: 'Audit',
      status: auditReady ? 'Operator trail available' : 'No operator trail yet',
      detail: `${notificationCount} notification(s), ${booking.auditLogs?.length ?? 0} audit row(s), ${
        booking.opsTasks?.length ?? 0
      } structured task(s).`,
      owner: 'Operations',
      href: '#booking-activity',
      ready: auditReady,
    },
  ];

  const openItems = items.filter((item) => !item.ready);
  const status =
    openItems.length === 0
      ? 'Ready'
      : terminalStatus || booking.status === 'COMPLETED'
        ? `${openItems.length} closeout item(s)`
        : `${openItems.length} monitor item(s)`;
  const tone =
    openItems.length === 0
      ? 'pill-success'
      : openItems.some((item) => ['Payment', 'Finance', 'Cash'].includes(item.label))
        ? 'pill-warn'
        : 'pill-info';

  return {
    status,
    tone,
    helper:
      openItems.length === 0
        ? 'All factual records needed for this booking stage are aligned.'
        : `${openItems.map((item) => item.label).join(', ')} should be checked before the next handoff or closeout.`,
    items,
    openItems,
  };
}

function bookingChatLifecycle(booking: AdminBookingDetail, messageCount: number) {
  const roomLabel = booking.chatRoom ? shortId(booking.chatRoom.id) : 'No room yet';
  const terminalStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

  if (!booking.chatRoom) {
    return {
      status: 'Not created',
      tone: 'pill-neutral',
      customerState: 'Locked',
      customerDetail: 'Customer chat appears after final partner handoff.',
      partnerState: 'Locked',
      partnerDetail: 'Partner chat appears after match/service start.',
      adminState: 'Waiting',
      adminDetail: 'No transcript exists yet.',
      roomLabel,
    };
  }

  if (terminalStatuses.has(booking.status)) {
    return {
      status: 'Admin retained',
      tone: 'pill-success',
      customerState: 'Hidden after closeout',
      customerDetail: 'Customer app can hide the active room when the service record is closed.',
      partnerState: 'Hidden after closeout',
      partnerDetail: 'Partner app can hide the active room after completion or closeout.',
      adminState: 'Archived',
      adminDetail: `${messageCount} message(s) kept for support, refund, and dispute review.`,
      roomLabel,
    };
  }

  return {
    status: 'Live',
    tone: 'pill-info',
    customerState: 'Visible',
    customerDetail: 'Customer can coordinate with the assigned partner.',
    partnerState: 'Visible',
    partnerDetail: 'Partner can message the customer during handoff and service.',
    adminState: 'Live archive',
    adminDetail: `${messageCount} message(s) visible now and retained after closeout.`,
    roomLabel,
  };
}

type BookingOperatingTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at?: string | null;
  status: string;
};

function bookingOperatingTimeline({
  booking,
  addressLine,
  addressPin,
  latestLocation,
  messages,
  notifications,
}: {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
  latestLocation?: AdminLocationSnapshot;
  messages: AdminChatMessage[];
  notifications: AdminNotification[];
}) {
  const items: BookingOperatingTimelineItem[] = [];
  const pendingItems: BookingOperatingTimelineItem[] = [];
  const paymentCurrency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';

  const addItem = (item: BookingOperatingTimelineItem) => {
    if (item.at) {
      items.push(item);
      return;
    }
    pendingItems.push(item);
  };

  addItem({
    id: `created-${booking.id}`,
    type: 'BOOK',
    title: 'Booking created',
    detail: `${booking.customerProfile?.user?.phone ?? 'Customer'} requested ${bookingServiceOptionLabel(booking)}.`,
    at: booking.createdAt,
    status: 'Recorded',
  });

  addItem({
    id: `address-${booking.addressSnapshot?.id ?? booking.id}`,
    type: 'ADDR',
    title: booking.addressSnapshot ? 'Address snapshot locked' : 'Address snapshot missing',
    detail: booking.addressSnapshot
      ? `${compactActivityText(addressLine, 84)} / pin ${addressPin}`
      : 'This booking is still using legacy address data. Confirm before dispatch.',
    at: booking.addressSnapshot?.createdAt,
    status: booking.addressSnapshot ? 'Locked' : 'Pending',
  });

  if (booking.openedAt || booking.status !== 'CREATED') {
    addItem({
      id: `matching-opened-${booking.id}`,
      type: 'MATCH',
      title: 'Matching window opened',
      detail: booking.preferredProvider
        ? `First-pick partner: ${providerName(booking.preferredProvider)}.`
        : 'No first-pick partner is attached to this booking.',
      at: booking.openedAt ?? booking.createdAt,
      status: 'Open',
    });
  }

  if (booking.expiresAt) {
    addItem({
      id: `expires-${booking.id}`,
      type: 'TTL',
      title: 'Auto-close timer set',
      detail: 'If no final partner is selected before this time, operations should close or follow up.',
      at: booking.expiresAt,
      status: 'Timer',
    });
  }

  if (booking.closedAt) {
    addItem({
      id: `closed-${booking.id}`,
      type: 'CLOSE',
      title: 'Booking closure recorded',
      detail: bookingClosureSummary(booking).detail,
      at: booking.closedAt,
      status: booking.closedReason ?? booking.closedByRole ?? 'Closed',
    });
  }

  for (const participant of booking.participants ?? []) {
    const partnerName = providerName(participant.providerProfile);
    addItem({
      id: `participant-joined-${participant.id}`,
      type: 'JOIN',
      title: `${partnerName} joined shortlist`,
      detail: `${participant.status} / ${distanceLabel(participant.distanceMeters)} / ${
        participant.providerStatusAtJoin ?? 'status unknown'
      }`,
      at: participant.joinedAt,
      status: 'Joined',
    });
    if (participant.respondedAt) {
      addItem({
        id: `participant-responded-${participant.id}`,
        type: 'REPLY',
        title: `${partnerName} responded`,
        detail: `Partner response recorded as ${participant.status}.`,
        at: participant.respondedAt,
        status: participant.status,
      });
    }
  }

  if (booking.selectedProvider) {
    addItem({
      id: `selected-${booking.selectedProvider.id ?? booking.id}`,
      type: 'SELECT',
      title: 'Customer final partner selected',
      detail: `${providerName(booking.selectedProvider)} is the final customer-selected partner.`,
      at: booking.updatedAt,
      status: 'Selected',
    });
  } else if (booking.status === 'OPEN_MATCHING') {
    addItem({
      id: `selection-pending-${booking.id}`,
      type: 'SELECT',
      title: 'Customer final choice pending',
      detail: 'Customer still needs to select one final partner before chat handoff.',
      status: 'Pending',
    });
  }

  if (booking.chatRoom) {
    addItem({
      id: `chat-ready-${booking.chatRoom.id}`,
      type: 'CHAT',
      title: 'Chat room ready',
      detail: `${messages.length} message(s) are retained for admin support.`,
      at: messages[0]?.createdAt ?? booking.updatedAt,
      status: 'Ready',
    });
  } else if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    addItem({
      id: `chat-missing-${booking.id}`,
      type: 'CHAT',
      title: 'Chat handoff missing',
      detail: 'Matched or active booking has no chat room linked yet.',
      status: 'Repair',
    });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    addItem({
      id: `chat-last-${lastMessage.id}`,
      type: 'MSG',
      title: 'Latest chat message',
      detail: `${lastMessage.sender?.fullName ?? lastMessage.sender?.phone ?? 'Sender'}: ${compactActivityText(
        lastMessage.body,
        90,
      )}`,
      at: lastMessage.createdAt,
      status: 'Message',
    });
  }

  if (latestLocation) {
    addItem({
      id: `location-${latestLocation.id}`,
      type: 'LOC',
      title: 'Latest partner location shared',
      detail: `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(
        booking,
      )}`,
      at: latestLocation.recordedAt,
      status: 'Location',
    });
  } else if (['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    addItem({
      id: `location-missing-${booking.id}`,
      type: 'LOC',
      title: 'Partner location not shared',
      detail: 'Active service state has no linked partner location snapshot.',
      status: 'Pending',
    });
  }

  if (booking.payment) {
    addItem({
      id: `payment-${booking.payment.id ?? booking.id}`,
      type: 'PAY',
      title: `Payment ${booking.payment.status}`,
      detail: `${booking.payment.method} / ${money(booking.payment.amount, paymentCurrency)} / ${
        booking.payment.providerRef ?? 'no provider ref'
      }`,
      at: booking.createdAt,
      status: booking.payment.status,
    });
  }

  if (booking.earning) {
    addItem({
      id: `earning-${booking.earning.id}`,
      type: 'EARN',
      title: `Partner earning ${booking.earning.status}`,
      detail: `${money(booking.earning.netAmount, booking.earning.currency)} net / ${money(
        booking.earning.platformFee,
        booking.earning.currency,
      )} platform fee.`,
      at: booking.earning.createdAt,
      status: booking.earning.status,
    });
  }

  for (const refund of booking.refunds ?? booking.payment?.refunds ?? []) {
    const refundReason = 'reason' in refund ? refund.reason : null;

    addItem({
      id: `refund-${refund.id}`,
      type: 'REFUND',
      title: `Refund ${refund.status}`,
      detail: `${money(refund.amount, paymentCurrency)} / ${refundReason ?? 'No reason note'}`,
      at: refund.createdAt,
      status: refund.status,
    });
  }

  for (const taxLog of booking.taxLogs ?? []) {
    addItem({
      id: `tax-${taxLog.id}`,
      type: 'TAX',
      title: 'Tax withholding logged',
      detail: `${money(taxLog.withholdingAmount, taxLog.currency)} withheld from ${money(
        taxLog.taxableAmount,
        taxLog.currency,
      )} taxable amount.`,
      at: taxLog.createdAt,
      status: 'Logged',
    });
  }

  for (const feeLog of booking.platformFeeLogs ?? []) {
    addItem({
      id: `fee-${feeLog.id}`,
      type: 'FEE',
      title: 'Platform fee logged',
      detail: `${money(feeLog.platformFeeAmount, feeLog.currency)} company fee from ${money(
        feeLog.grossAmount,
        feeLog.currency,
      )} gross.`,
      at: feeLog.createdAt,
      status: 'Logged',
    });
  }

  for (const walletEntry of booking.walletLedgerEntries ?? []) {
    addItem({
      id: `wallet-${walletEntry.id}`,
      type: 'WALLET',
      title: `Wallet ${walletEntry.type}`,
      detail: `${money(walletEntry.amount, walletEntry.currency)} / ${walletEntry.notes ?? walletEntry.sourceKey}`,
      at: walletEntry.createdAt,
      status: walletEntry.type,
    });
  }

  if (booking.review) {
    addItem({
      id: `review-${booking.review.id}`,
      type: 'REVIEW',
      title: 'Customer service feedback submitted',
      detail: `Saved numeric input ${booking.review.rating}/5.`,
      at: booking.review.createdAt,
      status: 'Feedback',
    });
  }

  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))
    .slice(0, 4);
  for (const notification of relatedNotifications) {
    addItem({
      id: `notification-${notification.id}`,
      type: 'ALERT',
      title: marketplaceDisplayText(notification.title),
      detail: `${humanizeNotificationType(notification.type)} / ${marketplaceDisplayText(
        compactActivityText(notification.body, 90),
      )}`,
      at: notification.createdAt,
      status: 'Alert',
    });
  }

  for (const task of booking.opsTasks ?? []) {
    addItem({
      id: `ops-task-${task.id}`,
      type: 'OPS',
      title: `${humanizeAuditAction(task.type)} / ${task.status}`,
      detail: task.note ?? 'Operator checklist task updated.',
      at: task.updatedAt,
      status: task.status,
    });
  }

  for (const log of (booking.auditLogs ?? []).slice(0, 6)) {
    addItem({
      id: `audit-${log.id}`,
      type: 'AUDIT',
      title: humanizeAuditAction(log.action),
      detail: auditMetadataSummary(log.metadata) || log.target,
      at: log.createdAt,
      status: 'Audit',
    });
  }

  const sorted = items.sort((left, right) => safeTime(left.at) - safeTime(right.at));
  return [...sorted.slice(-18), ...pendingItems].slice(0, 22);
}

type CommunicationMovementEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at: string;
};

function bookingCommunicationMovementHandoff({
  booking,
  latestLocation,
  messages,
  notifications,
}: {
  booking: AdminBookingDetail;
  latestLocation?: AdminLocationSnapshot;
  messages: AdminChatMessage[];
  notifications: AdminNotification[];
}) {
  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const deliveries = relatedNotifications.flatMap((notification) => notification.deliveries ?? []);
  const failedDeliveries = deliveries.filter((delivery) => delivery.status === 'FAILED').length;
  const pendingDeliveries =
    deliveries.filter((delivery) => delivery.status === 'SKIPPED').length +
    relatedNotifications.filter((notification) => (notification.deliveries ?? []).length === 0).length;
  const disabledDevices = deliveries.filter((delivery) => delivery.pushDevice?.enabled === false).length;
  const lastMessage = messages[messages.length - 1];
  const latestAlert = relatedNotifications[0];
  const movementFreshness = latestProviderLocationFreshness(booking);
  const locationRows = locationTrail(booking);
  const activeNeedsLocation = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const chatShouldExist = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const note =
    !booking.chatRoom && chatShouldExist
      ? {
          status: 'Chat repair needed',
          tone: 'pill-warn',
          noteClassName: 'ops-task-warning',
          nextAction: 'Repair booking chat handoff',
          nextDetail: 'Matched or active booking has no retained chat room attached.',
          href: '#chat',
          hrefLabel: 'Open chat section',
        }
      : failedDeliveries || disabledDevices
        ? {
            status: 'Alert delivery check',
            tone: 'pill-warn',
            noteClassName: 'ops-task-warning',
            nextAction: 'Review notification delivery',
            nextDetail: 'One or more booking alerts failed or targeted a disabled device.',
            href: '#alerts',
            hrefLabel: 'Open alert trace',
          }
        : activeNeedsLocation && !latestLocation
          ? {
              status: 'Location check',
              tone: 'pill-info',
              noteClassName: 'ops-task-info',
              nextAction: 'Ask partner to share current location',
              nextDetail: 'The booking is active but no partner location snapshot is linked yet.',
              href: '#location',
              hrefLabel: 'Open location trail',
            }
          : {
              status: 'Handoff visible',
              tone: 'pill-success',
              noteClassName: 'ops-task-success',
              nextAction: 'Continue normal monitoring',
              nextDetail: 'Chat, alert, and movement evidence can be reviewed from this record.',
              href: '#booking-activity',
              hrefLabel: 'Open full activity',
            };

  const events: CommunicationMovementEvent[] = [
    ...messages.slice(-5).map((message) => ({
      id: `message-${message.id}`,
      type: 'CHAT',
      title: messageSenderLabel(message),
      detail: compactActivityText(message.body, 120),
      at: message.createdAt,
    })),
    ...relatedNotifications.slice(0, 5).map((notification) => {
      const row = bookingNotificationTraceRow(notification);
      return {
        id: `notification-${notification.id}`,
        type: 'ALERT',
        title: row.signal,
        detail: `${row.title} / ${compactActivityText(row.detail, 110)}`,
        at: notification.createdAt,
      };
    }),
    ...locationRows.slice(-4).map((snapshot) => ({
      id: `location-${snapshot.id}`,
      type: 'LOC',
      title: 'Partner location snapshot',
      detail: `${coordinateLabel(snapshot.lat, snapshot.lng)} / ${providerLocationMetricHelper(booking)}`,
      at: snapshot.recordedAt,
    })),
  ]
    .filter((event) => Boolean(event.at))
    .sort((left, right) => safeTime(right.at) - safeTime(left.at))
    .slice(0, 10);

  return {
    ...note,
    metrics: [
      {
        label: 'Chat room',
        value: booking.chatRoom ? 'Retained' : 'Missing',
        helper: booking.chatRoom
          ? `${messages.length} message(s) kept in admin archive.`
          : 'Chat should be created once the booking is matched.',
      },
      {
        label: 'Latest message',
        value: lastMessage ? formatDate(lastMessage.createdAt) : 'No message',
        helper: lastMessage
          ? `${messageSenderLabel(lastMessage)} / ${compactActivityText(lastMessage.body, 72)}`
          : 'No customer or partner message yet.',
      },
      {
        label: 'Booking alerts',
        value: `${relatedNotifications.length}`,
        helper: latestAlert
          ? `Latest ${humanizeNotificationType(latestAlert.type)} at ${formatDate(latestAlert.createdAt)}.`
          : 'No booking notification row linked yet.',
      },
      {
        label: 'Delivery checks',
        value: `${failedDeliveries} failed / ${pendingDeliveries} pending`,
        helper: disabledDevices
          ? `${disabledDevices} disabled device(s) also found.`
          : 'No disabled device in linked alerts.',
      },
      {
        label: 'Partner location',
        value: providerLocationMetricValue(booking),
        helper:
          movementFreshness === 'missing'
            ? 'No partner movement snapshot yet.'
            : `${providerLocationMetricHelper(booking)} / ${coordinateLabel(latestLocation?.lat, latestLocation?.lng)}`,
      },
      {
        label: 'Movement rows',
        value: `${locationRows.length}`,
        helper: locationRows.length
          ? 'Saved partner location snapshots linked to this booking.'
          : 'No movement row linked yet.',
      },
    ],
    events,
  };
}

function messageSenderLabel(message: AdminChatMessage) {
  if (message.sender?.roles?.includes('PROVIDER')) {
    return `Partner: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('CUSTOMER')) {
    return `Customer: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('ADMIN')) {
    return `Admin: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  return message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender';
}

function bookingOperatingSnapshot({
  booking,
  addressLine,
  addressPin,
  messageCount,
  notificationCount,
}: {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
  messageCount: number;
  notificationCount: number;
}) {
  const participants = booking.participants ?? [];
  const acceptedParticipants = participants.filter((participant) =>
    ['ACCEPTED', 'SELECTED'].includes(participant.status),
  );
  const preferredState = preferredParticipantState(booking);
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const walletLabel = bookingCashDebtNeedsSettlement(booking)
    ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
    : booking.earning
      ? `Ledger ${money(booking.earning.netAmount, booking.earning.currency)}`
      : 'No earning yet';
  const finalPartnerLabel = booking.selectedProvider
    ? providerName(booking.selectedProvider)
    : booking.status === 'MATCHED'
      ? providerName(booking.preferredProvider)
      : 'Customer selection pending';
  const addressSource = booking.addressSnapshot
    ? `${booking.addressSnapshot.source ?? 'booking_confirmation'} / ${formatDate(booking.addressSnapshot.createdAt)}`
    : 'Legacy booking address';
  const next = bookingOperatingNextAction(booking);
  const checks = bookingAttentionFlags(booking);
  const tone = checks.some((check) => check.severity === 'high')
    ? 'pill-danger'
    : checks.length
      ? 'pill-warn'
      : booking.status === 'COMPLETED'
        ? 'pill-success'
        : 'pill-info';

  return {
    status: booking.status,
    tone,
    noteClassName: checks.some((check) => check.severity === 'high')
      ? 'ops-task-danger'
      : checks.length
        ? 'ops-task-warning'
        : 'ops-task-info',
    nextAction: next.title,
    nextDetail: next.detail,
    href: next.href,
    hrefLabel: next.hrefLabel,
    facts: [
      {
        label: 'Confirmed address',
        value: compactActivityText(addressLine, 42),
        helper: `${addressPin} / ${addressSource}`,
      },
      {
        label: 'Customer final choice',
        value: compactActivityText(finalPartnerLabel, 34),
        helper: booking.selectedProvider
          ? 'Customer-selected final partner is recorded.'
          : 'Customer choice remains the source of truth.',
      },
      {
        label: 'Preferred partner',
        value: compactActivityText(providerName(booking.preferredProvider), 34),
        helper: preferredState
          ? `${preferredState.status} / ${distanceLabel(preferredState.distanceMeters)}`
          : booking.preferredProvider
            ? 'Waiting for first partner response.'
            : 'No first-pick partner on this booking.',
      },
      {
        label: 'Marketplace supply',
        value: `${participants.length} joined / ${acceptedParticipants.length} accepted`,
        helper: 'Partners can participate while the customer waits.',
      },
      {
        label: 'Chat and alerts',
        value: booking.chatRoom ? `${messageCount} message(s)` : 'Chat not ready',
        helper: `${notificationCount} notification record(s) linked to this booking.`,
      },
      {
        label: 'Payment and wallet',
        value: paymentLabel,
        helper: walletLabel,
      },
    ],
  };
}

function bookingOperatingNextAction(booking: AdminBookingDetail) {
  if (bookingCashDebtNeedsSettlement(booking)) {
    return {
      title: 'Settle cash fee debt',
      detail:
        'Partner collected cash. Confirm company fee deposit or admin offset before unlocking future accepted work.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (booking.status === 'OPEN_MATCHING') {
    return {
      title: booking.participants?.length
        ? 'Monitor customer final selection'
        : 'Monitor partner participation',
      detail: booking.participants?.length
        ? 'Accepted partners should be visible to the customer so the customer can choose the final partner.'
        : 'Keep the first-pick window and marketplace participation visible until a partner joins or the booking expires.',
      href: '#alerts',
      hrefLabel: 'Open matching',
    };
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return {
      title: 'Create or recover chat room',
      detail: 'A matched booking must have chat before partner handoff and service coordination.',
      href: '#chat',
      hrefLabel: 'Open chat',
    };
  }
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    return {
      title: 'Track handoff and service progress',
      detail: 'Confirm chat, partner location record, arrival state, and service lifecycle events.',
      href: '#location',
      hrefLabel: 'Open location',
    };
  }
  if (booking.status === 'COMPLETED') {
    return {
      title: 'Reconcile completed booking',
      detail: 'Confirm payment capture, wallet ledger, tax/fee logs, review state, and closeout notes.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
    return {
      title: 'Close customer and finance loop',
      detail: 'Confirm refund/release, customer communication, partner communication, and audit note.',
      href: '#payment',
      hrefLabel: 'Open payment',
    };
  }
  return {
    title: 'Continue normal monitoring',
    detail: 'No immediate operator action is required beyond timeline and communication review.',
    href: '#booking-activity',
    hrefLabel: 'Open timeline',
  };
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

function buildBookingActivityRecords(booking: AdminBookingDetail, notifications: AdminNotification[]) {
  const records: BookingActivityRecord[] = [];

  records.push({
    id: `${booking.id}-created`,
    type: 'BOOKING',
    at: booking.createdAt ?? booking.scheduledStartAt ?? '',
    title: `Booking created as ${booking.status}`,
    detail: `${bookingServiceOptionLabel(booking)} / customer ${
      booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer'
    } / ${addressLabel(booking.address)}`,
    href: '#customer',
  });

  if (booking.openedAt) {
    records.push({
      id: `${booking.id}-opened`,
      type: 'MATCHING',
      at: booking.openedAt,
      title: 'Matching opened',
      detail: `Preferred partner ${providerName(booking.preferredProvider)} / expires ${formatDate(booking.expiresAt)}`,
      href: '#alerts',
    });
  }

  const requestOpenedAt = booking.createdAt ?? booking.scheduledStartAt;
  if (requestOpenedAt) {
    records.push({
      id: `${booking.id}-opened`,
      type: 'BOOKING',
      at: requestOpenedAt,
      title: 'Request timestamp',
      detail: `Request opened ${formatDate(requestOpenedAt)}`,
      href: '#service',
    });
  }

  if (booking.closedAt) {
    const closure = bookingClosureSummary(booking);
    records.push({
      id: `${booking.id}-closed`,
      type: 'CLOSURE',
      at: booking.closedAt,
      title: `Booking closure: ${closure.status}`,
      detail: closure.detail,
      href: '#booking-activity',
    });
  }

  for (const participant of booking.participants ?? []) {
    records.push({
      id: `${participant.id}-joined`,
      type: 'PARTNER',
      at: participant.joinedAt ?? booking.createdAt ?? '',
      title: `${providerName(participant.providerProfile)} joined shortlist`,
      detail: `${participant.status} / ${distanceLabel(participant.distanceMeters)} / ${
        participant.providerStatusAtJoin ?? 'status unknown'
      }`,
      href: participant.providerProfile?.id ? `/partners/${participant.providerProfile.id}` : '#participants',
    });
    if (participant.respondedAt) {
      records.push({
        id: `${participant.id}-responded`,
        type: 'PARTNER',
        at: participant.respondedAt,
        title: `${providerName(participant.providerProfile)} responded`,
        detail: `${participant.status} / customer can select from accepted partners.`,
        href: participant.providerProfile?.id
          ? `/partners/${participant.providerProfile.id}`
          : '#participants',
      });
    }
  }

  if (booking.selectedProvider) {
    records.push({
      id: `${booking.id}-selected-partner`,
      type: 'MATCHED',
      at: booking.updatedAt ?? booking.openedAt ?? booking.createdAt ?? '',
      title: 'Final partner selected',
      detail: `${providerName(booking.selectedProvider)} / chat ${booking.chatRoom ? 'created' : 'not created yet'}`,
      href: booking.selectedProvider.id ? `/partners/${booking.selectedProvider.id}` : '#participants',
    });
  }

  if (booking.chatRoom) {
    records.push({
      id: `${booking.chatRoom.id}-room`,
      type: 'CHAT',
      at: booking.chatRoom.messages?.[0]?.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `Chat room ${shortId(booking.chatRoom.id)} available`,
      detail: `${booking.chatRoom.messages?.length ?? 0} message(s) archived for admin.`,
      href: '#chat',
    });
  }

  for (const message of booking.chatRoom?.messages ?? []) {
    records.push({
      id: message.id,
      type: 'CHAT',
      at: message.createdAt,
      title: `Message from ${message.sender?.fullName ?? message.sender?.phone ?? message.sender?.roles?.join(', ') ?? 'Unknown sender'}`,
      detail: compactActivityText(message.body, 110),
      href: '#chat',
    });
  }

  if (booking.payment) {
    records.push({
      id: booking.payment.id ?? `${booking.id}-payment`,
      type: 'PAYMENT',
      at: booking.updatedAt ?? booking.createdAt ?? '',
      title: `${booking.payment.status} ${booking.payment.method} payment`,
      detail: `${money(booking.payment.amount, booking.payment.currency)} / ref ${
        booking.payment.providerRef ?? 'no gateway ref'
      }`,
      href: booking.payment.id ? `/payments#payment-${booking.payment.id}` : '#payment',
    });
  }

  const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
  for (const refund of refunds) {
    const reason = 'reason' in refund ? refund.reason : undefined;
    records.push({
      id: refund.id,
      type: 'REFUND',
      at: refund.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${refund.status} refund`,
      detail: `${money(Number(refund.amount ?? 0), booking.payment?.currency ?? 'VND')}${reason ? ` / ${reason}` : ''}`,
      href: `/refunds#refund-${refund.id}`,
    });
  }

  if (booking.earning) {
    records.push({
      id: booking.earning.id,
      type: 'EARNING',
      at: booking.earning.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${booking.earning.status} partner earning`,
      detail: `Gross ${money(booking.earning.grossAmount, booking.earning.currency)} / fee ${money(
        booking.earning.platformFee,
        booking.earning.currency,
      )} / net ${money(booking.earning.netAmount, booking.earning.currency)}`,
      href: '/earnings',
    });
  }

  for (const log of [...(booking.platformFeeLogs ?? []), ...(booking.earning?.platformFeeLogs ?? [])]) {
    records.push({
      id: log.id,
      type: 'FEE',
      at: log.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Platform fee calculated',
      detail: `${money(log.platformFeeAmount, log.currency)} from ${money(log.grossAmount, log.currency)}`,
      href: '/earnings',
    });
  }

  for (const log of [...(booking.taxLogs ?? []), ...(booking.earning?.taxLogs ?? [])]) {
    records.push({
      id: log.id,
      type: 'TAX',
      at: log.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Withholding tax calculated',
      detail: `${money(log.withholdingAmount, log.currency)} from taxable ${money(log.taxableAmount, log.currency)}`,
      href: '/tax-policy',
    });
  }

  for (const entry of [
    ...(booking.walletLedgerEntries ?? []),
    ...(booking.earning?.walletLedgerEntries ?? []),
  ]) {
    records.push({
      id: entry.id,
      type: 'WALLET',
      at: entry.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${entry.type} wallet ledger`,
      detail: `${money(entry.amount, entry.currency)} / ${entry.notes ?? entry.reference ?? entry.sourceKey}`,
      href: '/earnings',
    });
  }

  for (const snapshot of locationTrail(booking)) {
    records.push({
      id: snapshot.id,
      type: 'LOCATION',
      at: snapshot.recordedAt,
      title: 'Partner location snapshot',
      detail: coordinateLabel(snapshot.lat, snapshot.lng),
      href: '#location',
    });
  }

  for (const notification of notifications.filter((item) => notificationDataBookingId(item) === booking.id)) {
    records.push({
      id: notification.id,
      type: 'ALERT',
      at: notification.createdAt,
      title: humanizeNotificationType(notification.type),
      detail: `${marketplaceDisplayText(notification.title)} / ${
        notification.deliveries?.[0]?.status ?? 'No delivery'
      } / ${notification.readAt ? `read ${formatDate(notification.readAt)}` : 'unread'}`,
      href: `/notifications?booking=${booking.id}`,
    });
  }

  for (const task of booking.opsTasks ?? []) {
    records.push({
      id: task.id,
      type: 'OPS',
      at: task.updatedAt,
      title: `${task.status} ${task.type}`,
      detail: `${task.note ?? 'No note'} / actor ${task.actor?.fullName ?? task.actor?.phone ?? 'System'}`,
      href: '#structured-ops-status',
    });
  }

  if (booking.review) {
    records.push({
      id: booking.review.id,
      type: 'REVIEW',
      at: booking.review.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Customer service feedback submitted',
      detail: booking.review.comment
        ? `${compactActivityText(booking.review.comment, 90)} / numeric input ${booking.review.rating}/5`
        : `No comment / numeric input ${booking.review.rating}/5`,
      href: '/reviews',
    });
  }

  for (const log of booking.auditLogs ?? []) {
    records.push({
      id: log.id,
      type: 'AUDIT',
      at: log.createdAt,
      title: humanizeAuditAction(log.action),
      detail: `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${auditMetadataSummary(log.metadata) || log.target}`,
      href: `/audit-log?q=${encodeURIComponent(booking.id)}`,
    });
  }

  const unique = new Map<string, BookingActivityRecord>();
  for (const record of records.filter((item) => Boolean(item.at))) {
    unique.set(`${record.type}:${record.id}:${record.at}`, record);
  }

  return [...unique.values()].sort((left, right) => safeTime(right.at) - safeTime(left.at));
}

function buildBookingActivityCsvHref(booking: AdminBookingDetail, records: BookingActivityRecord[]) {
  return buildCsvDataHref(
    records.map((record) => ({
      booking_id: booking.id,
      booking_status: booking.status,
      customer_phone: booking.customerProfile?.user?.phone ?? '',
      preferred_partner: providerName(booking.preferredProvider),
      final_partner: providerName(booking.selectedProvider ?? booking.preferredProvider),
      type: record.type,
      date: record.at,
      title: record.title,
      detail: record.detail,
      href: record.href ?? '',
      record_id: record.id,
    })),
    [
      'booking_id',
      'booking_status',
      'customer_phone',
      'preferred_partner',
      'final_partner',
      'type',
      'date',
      'title',
      'detail',
      'href',
      'record_id',
    ],
  );
}

function buildBookingActivitySummary(records: ReturnType<typeof buildBookingActivityRecords>) {
  const financeTypes = new Set(['PAYMENT', 'REFUND', 'EARNING', 'FEE', 'TAX', 'WALLET']);
  const count = (predicate: (record: (typeof records)[number]) => boolean) =>
    records.filter(predicate).length;
  const latestAt = records[0]?.at;
  const oldestAt = records[records.length - 1]?.at;

  return [
    {
      label: 'Range',
      value: latestAt ? formatDate(latestAt) : 'None',
      helper: oldestAt ? `Oldest loaded: ${formatDate(oldestAt)}` : 'No activity loaded.',
    },
    {
      label: 'Matching',
      value: count((record) =>
        ['BOOKING', 'MATCHING', 'MATCHED', 'SCHEDULE', 'PARTNER'].includes(record.type),
      ).toString(),
      helper: 'Booking creation, wait window, partner participation, and final selection.',
    },
    {
      label: 'Chat',
      value: count((record) => record.type === 'CHAT').toString(),
      helper: 'Loaded customer and partner messages kept for admin archive.',
    },
    {
      label: 'Finance',
      value: count((record) => financeTypes.has(record.type)).toString(),
      helper: 'Payment, refund, earning, tax, fee, and wallet ledger rows.',
    },
    {
      label: 'Ops and alerts',
      value: count((record) => ['OPS', 'AUDIT', 'ALERT'].includes(record.type)).toString(),
      helper: 'Operator notes, audit events, and notification delivery events.',
    },
    {
      label: 'Location',
      value: count((record) => record.type === 'LOCATION').toString(),
      helper: 'Partner location snapshots linked to this booking.',
    },
  ];
}

function compactActivityText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function bookingClosureSummary(booking: AdminBookingDetail) {
  if (!booking.closedAt) {
    return {
      status: TERMINAL_BOOKING_STATUSES.has(booking.status) ? 'Terminal without closure stamp' : 'Open',
      detail: TERMINAL_BOOKING_STATUSES.has(booking.status)
        ? 'This booking is terminal but has no explicit closure actor/reason saved.'
        : 'No closure has been recorded yet.',
    };
  }

  const actor = booking.closedByRole
    ? `${booking.closedByRole.toLowerCase()} closure`
    : 'closure actor missing';
  const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'reason not saved';
  const note = booking.closedNote ? ` / ${booking.closedNote}` : '';

  return {
    status: formatDate(booking.closedAt),
    detail: `${actor} / ${reason}${note}`,
  };
}

function humanizeClosureReason(reason: string) {
  return reason
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type AttentionFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
};

type DispatchStep = {
  priority: 'Now' | 'Monitor' | 'Done';
  title: string;
  detail: string;
  owner: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

function AttentionItem({ flag }: { flag: AttentionFlag }) {
  return (
    <div className={`risk-item risk-${flag.severity}`}>
      <div>
        <span className={`pill ${attentionToneClass(flag.severity)}`}>
          {checkSeverityLabel(flag.severity)}
        </span>
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
    return 'Cash was collected by the partner. Finance must settle the HANDS fee debt before this partner completes final acceptance or customer final selection.';
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    return 'Payment hold is live. Keep it authorized until service completion or cancellation.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Monitor partner response speed and marketplace supply. Customer is still waiting.';
  }
  if (booking.status === 'MATCHED') {
    return 'Partner is selected. Monitor chat readiness, location sharing, and arrival progression.';
  }
  if (booking.chatRoom && booking.status === 'IN_SERVICE') {
    return 'Service is live. Keep chat and location visible until completion.';
  }
  return 'No same-shift action is required. Continue monitoring this booking from the timeline.';
}

function opsBadges(booking: AdminBookingDetail) {
  const badges = [];
  const flags = bookingAttentionFlags(booking);
  if (booking.status === 'NO_SHOW') {
    badges.push({ label: 'No-show', tone: 'pill-danger' });
  }
  if (booking.status === 'EXPIRED') {
    badges.push({ label: 'Expired', tone: 'pill-warn' });
  }
  if (flags.some((flag) => flag.severity === 'high')) {
    badges.push({ label: 'Action needed', tone: 'pill-danger' });
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

function bookingAttentionFlags(booking: AdminBookingDetail): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
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
      action: 'Encourage marketplace supply or contact the partner.',
    });
  }

  if (status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      severity: 'medium',
      title: 'No partner supply',
      detail: 'No partner has joined the request yet.',
      action: 'Check nearby online partners and consider operational outreach.',
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
      title: 'No partner location record',
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

function attentionLevel(flags: AttentionFlag[]) {
  if (flags.some((flag) => flag.severity === 'high')) {
    return { label: 'Action', helper: `${flags.length} check(s) need attention`, tone: 'pill-danger' };
  }
  if (flags.some((flag) => flag.severity === 'medium')) {
    return { label: 'Monitor', helper: `${flags.length} check(s) to monitor`, tone: 'pill-warn' };
  }
  if (flags.some((flag) => flag.severity === 'low')) {
    return { label: 'Note', helper: `${flags.length} note check(s)`, tone: 'pill-info' };
  }
  return { label: 'Clear', helper: 'No active attention checks', tone: 'pill-success' };
}

function checkSeverityLabel(severity: AttentionFlag['severity']) {
  if (severity === 'high') {
    return 'Action';
  }
  if (severity === 'medium') {
    return 'Monitor';
  }
  return 'Note';
}

function attentionToneClass(severity: AttentionFlag['severity']) {
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
  const flags = bookingAttentionFlags(booking);
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
      priority: 'Monitor',
      title: 'Supply monitor',
      detail: 'No partner has joined yet. Keep partner availability and notification delivery visible.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: '/partners',
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
      priority: 'Monitor',
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
      priority: 'Monitor',
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
      priority: isTerminalPayment(booking.payment.status) ? 'Done' : 'Monitor',
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
        'No same-shift operator action is active. Keep this booking visible until the next status transition.',
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
    return 'Partner is selected; monitor chat and movement.';
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

function bookingRefundRows(booking: AdminBookingDetail): BookingRefundLedgerRow[] {
  if (booking.refunds?.length) {
    return booking.refunds;
  }

  return (booking.payment?.refunds ?? []).map((refund) => ({
    ...refund,
    payment: { currency: booking.payment?.currency ?? 'VND' },
  }));
}

function bookingRefundLedgerEvidence(booking: AdminBookingDetail) {
  const rows = bookingRefundRows(booking);
  if (!rows.length) {
    return booking.payment?.status === 'REFUNDED'
      ? 'Payment is marked refunded but no refund row is loaded.'
      : 'No refund action has been recorded for this booking.';
  }

  const latest = [...rows].sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))[0];
  const currency = latest.payment?.currency ?? booking.payment?.currency ?? 'VND';
  const reason = latest.reason ? ` / ${latest.reason}` : '';
  return `${latest.status} / ${money(latest.amount, currency)} / ${formatDate(latest.createdAt)}${reason}`;
}

function bookingOperatorNoteLines(booking: AdminBookingDetail) {
  return (booking.notes ?? '')
    .split('\n')
    .map((note) => note.trim())
    .filter(Boolean);
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
        ? 'Cash fee debt gates final acceptance or customer selection.'
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
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
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
      )} before final acceptance or customer selection.`,
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
    return `${booking.participants?.length ?? 0} marketplace ready`;
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

function bookingBackupPartnerSupply(
  booking: AdminBookingDetail,
  providers: AdminProvider[],
  settings: AdminOperationalPolicySetting[],
) {
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const radiusMeters =
    savedPolicy.backupProviderRadiusMeters ??
    readOptionalNumber(byKey.get('matching.backup_provider_radius_meters')?.value) ??
    10000;
  const freshnessMinutes =
    savedPolicy.backupProviderLocationMaxAgeMinutes ??
    readOptionalNumber(byKey.get('matching.backup_provider_location_max_age_minutes')?.value) ??
    STALE_LOCATION_MINUTES;
  const invitationLimit =
    savedPolicy.backupProviderInvitationLimit ??
    readOptionalNumber(byKey.get('matching.backup_provider_invitation_limit')?.value) ??
    50;
  const policyPin = bookingDispatchPin(booking);
  const customerLat = policyPin.lat;
  const customerLng = policyPin.lng;
  const hasCustomerPin = Number.isFinite(customerLat) && Number.isFinite(customerLng);
  const participantProviderIds = new Set(
    (booking.participants ?? []).map((participant) => participant.providerProfile?.id).filter(Boolean),
  );
  const preferredProviderId = booking.preferredProvider?.id;
  const selectedProviderId = booking.selectedProvider?.id;

  const evaluatedRows = hasCustomerPin
    ? providers
        .map((provider) => {
          const lat = Number(provider.currentLat);
          const lng = Number(provider.currentLng);
          const distanceMeters =
            Number.isFinite(lat) && Number.isFinite(lng)
              ? approximateDistanceMeters(customerLat, customerLng, lat, lng)
              : null;
          const locationAgeMinutes = providerLocationAgeMinutes(provider.currentLocationUpdatedAt);
          const blockers: string[] = [];

          if (provider.blockedAt) {
            blockers.push('account blocked');
          }
          if (provider.verification?.status !== 'APPROVED') {
            blockers.push(`verification ${provider.verification?.status ?? 'DRAFT'}`);
          }
          if (provider.status !== 'ONLINE_AVAILABLE') {
            blockers.push(`status ${provider.status}`);
          }
          if (distanceMeters === null) {
            blockers.push('no current coordinates');
          } else if (distanceMeters > radiusMeters) {
            blockers.push(`outside ${formatDistanceMeters(radiusMeters)} radius`);
          }
          if (locationAgeMinutes === null) {
            blockers.push('location missing');
          } else if (locationAgeMinutes > freshnessMinutes) {
            blockers.push(`location older than ${freshnessMinutes}m`);
          }

          const role =
            provider.id === selectedProviderId
              ? 'Selected partner'
              : provider.id === preferredProviderId
                ? 'Preferred partner'
                : participantProviderIds.has(provider.id)
                  ? 'Shortlist partner'
                  : 'Marketplace candidate';

          return {
            id: provider.id,
            name: marketplaceDisplayText(
              provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
            ),
            role,
            status: provider.status,
            eligible: blockers.length === 0,
            blockers,
            distanceMeters,
            distance:
              distanceMeters === null ? 'Unknown distance' : distanceLabel(Math.round(distanceMeters)),
            locationAge:
              locationAgeMinutes === null
                ? 'No location timestamp'
                : locationAgeMinutes < 1
                  ? 'Location just now'
                  : `Location ${locationAgeMinutes}m old`,
            detail: blockers.length
              ? `Excluded: ${blockers.join(', ')}.`
              : `Inside ${formatDistanceMeters(radiusMeters)} radius from ${policyPin.source} and location is within ${freshnessMinutes}m.`,
          };
        })
        .sort((left, right) => {
          if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
          const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
          if (leftDistance !== rightDistance) return leftDistance - rightDistance;
          return left.name.localeCompare(right.name);
        })
    : [];

  const rows = evaluatedRows.slice(0, 8);
  const eligibleRows = evaluatedRows.filter((row) => row.eligible);
  const eligibleCount = eligibleRows.length;
  const nearbyExcluded = evaluatedRows.filter(
    (row) => !row.eligible && row.distanceMeters !== null && row.distanceMeters <= radiusMeters,
  ).length;
  const outOfRadius = evaluatedRows.filter(
    (row) => (row.distanceMeters ?? Number.POSITIVE_INFINITY) > radiusMeters,
  ).length;
  const staleOrMissing = evaluatedRows.filter((row) =>
    row.blockers.some((blocker) => blocker.startsWith('location')),
  ).length;
  const excludedGroups = bookingBackupPartnerExcludedGroups(evaluatedRows, radiusMeters);
  const candidateCommand = bookingBackupCandidateCommand({
    hasCustomerPin,
    eligibleCount,
    nearbyExcluded,
    staleOrMissing,
    outOfRadius,
  });

  return {
    rows,
    topCandidates: eligibleRows.slice(0, 5),
    excludedGroups,
    candidateCommand,
    policyPin,
    radiusMeters,
    freshnessMinutes,
    invitationLimit,
    eligibleCount,
    decisionStatus: hasCustomerPin ? (eligibleCount ? 'Supply available' : 'Supply low') : 'Missing pin',
    decisionTone: hasCustomerPin ? (eligibleCount ? 'pill-success' : 'pill-warn') : 'pill-danger',
    decisionTitle: hasCustomerPin
      ? eligibleCount
        ? 'Marketplace matching has usable nearby supply'
        : 'No evaluated partner can join under current policy'
      : 'Customer pin is required before partner radius can be checked',
    decisionDetail: hasCustomerPin
      ? eligibleCount
        ? 'Operators can use the eligible partners as marketplace candidates while the customer waits.'
        : 'Review radius, partner online status, location freshness, and verification before extending the waiting window.'
      : 'Ask the customer to confirm location or edit booking coordinates before dispatching partners.',
    metrics: [
      {
        label: 'Radius pin',
        value: policyPin.label,
        helper: `${policyPin.source} is used for marketplace distance checks.`,
      },
      {
        label: 'Eligible partners',
        value: eligibleCount.toString(),
        helper: `Online, verified, fresh location, and within ${formatDistanceMeters(radiusMeters)}.`,
      },
      {
        label: 'Nearby excluded',
        value: nearbyExcluded.toString(),
        helper: 'Inside radius but blocked by status, verification, or location freshness.',
      },
      {
        label: 'Out of radius',
        value: outOfRadius.toString(),
        helper: 'Too far from this booking pin for marketplace matching.',
      },
      {
        label: 'Location stale/missing',
        value: staleOrMissing.toString(),
        helper: `Current policy requires location within ${freshnessMinutes} minutes.`,
      },
      {
        label: 'Invite cap',
        value: invitationLimit.toString(),
        helper:
          'Nearest eligible marketplace partners opened for this request before notifications are created.',
      },
    ],
  };
}

function bookingAddressRadiusContract(
  booking: AdminBookingDetail,
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>,
) {
  const pin = backupSupply.policyPin;
  const bookingGate = readBookingGateSnapshot(booking);
  const snapshotLocked = Boolean(booking.addressSnapshot && pin.source === 'BookingAddressSnapshot');
  const driftMeters = pin.legacyDriftMeters;
  const driftLabel = driftMeters === null ? 'No legacy comparison' : distanceLabel(Math.round(driftMeters));
  const driftOk = driftMeters === null || driftMeters <= 100;
  const pinReady = Number.isFinite(pin.lat) && Number.isFinite(pin.lng);

  return {
    status: snapshotLocked && driftOk ? 'Snapshot locked' : pinReady ? 'Review pin' : 'Missing pin',
    tone: snapshotLocked && driftOk ? 'pill-success' : pinReady ? 'pill-warn' : 'pill-danger',
    metrics: [
      {
        label: 'Policy pin source',
        value: pin.source,
        helper: snapshotLocked
          ? 'Marketplace distance is measured from the immutable booking address snapshot.'
          : 'Legacy booking coordinates are being used because the snapshot is missing.',
      },
      {
        label: 'Policy pin',
        value: pin.label,
        helper: bookingAddressSnapshotLabel(booking),
      },
      {
        label: 'Marketplace radius',
        value: formatDistanceMeters(backupSupply.radiusMeters),
        helper: 'Partners outside this booking-address radius cannot join marketplace matching.',
      },
      {
        label: 'Legacy coordinate drift',
        value: driftLabel,
        helper: driftOk
          ? 'Snapshot and legacy coordinates are aligned.'
          : 'Snapshot and legacy coordinates differ.',
      },
      {
        label: 'Customer GPS gate',
        value: bookingGate.customerDistanceLabel,
        helper: bookingGate.customerDistanceHelper,
      },
      {
        label: 'First-pick distance gate',
        value: bookingGate.preferredPartnerDistanceLabel,
        helper: bookingGate.preferredPartnerDistanceHelper,
      },
    ],
    cards: [
      {
        title: 'Address snapshot',
        status: snapshotLocked ? 'Required data ready' : 'Needs review',
        detail: snapshotLocked
          ? 'This booking has an immutable BookingAddressSnapshot for audit and dispatch.'
          : 'Create or repair the address snapshot before relying on partner radius decisions.',
        action: booking.addressSnapshot?.createdAt
          ? `Created ${formatDate(booking.addressSnapshot.createdAt)}`
          : 'No snapshot creation time available.',
        className: snapshotLocked ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: snapshotLocked ? 'pill-success' : 'pill-danger',
      },
      {
        title: '10km participation rule',
        status: pinReady ? 'Enforced by pin' : 'Blocked',
        detail: `Marketplace partners are evaluated from ${pin.source} and must be within ${formatDistanceMeters(
          backupSupply.radiusMeters,
        )}.`,
        action: `${backupSupply.eligibleCount} eligible / ${backupSupply.rows.length} displayed.`,
        className: pinReady ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: pinReady ? 'pill-success' : 'pill-danger',
      },
      {
        title: 'Coordinate consistency',
        status: driftOk ? 'Aligned' : 'Drift found',
        detail: driftOk
          ? 'Legacy booking coordinates do not conflict with the address snapshot.'
          : 'Operators should verify customer address before extending the wait window.',
        action: `Drift ${driftLabel}`,
        className: driftOk ? 'ops-task-done' : 'ops-task-warning',
        pillClass: driftOk ? 'pill-success' : 'pill-warn',
      },
      {
        title: 'Booking creation gate',
        status: bookingGate.gatePassed ? 'Gate passed' : 'Needs evidence',
        detail:
          'Booking creation records customer current GPS, service address, and preferred partner distance before payment and matching open.',
        action: bookingGate.summary,
        className: bookingGate.gatePassed ? 'ops-task-done' : 'ops-task-warning',
        pillClass: bookingGate.gatePassed ? 'pill-success' : 'pill-warn',
      },
    ],
  };
}

type BookingMvpAuthorityContractRow = {
  contract: string;
  scope: string;
  status: string;
  tone: 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';
  evidence: string;
  operatorUse: string;
  href: string;
};

function bookingMvpAuthorityContract({
  booking,
  operationalPolicies,
  backupSupply,
  messageCount,
  financeTrace,
}: {
  booking: AdminBookingDetail;
  operationalPolicies: AdminOperationalPolicySetting[];
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>;
  messageCount: number;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
}): BookingMvpAuthorityContractRow[] {
  const byKey = new Map(operationalPolicies.map((setting) => [setting.key, setting]));
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindowMinutes =
    savedPolicy.providerResponseWindowMinutes ??
    readOptionalNumber(byKey.get('matching.provider_response_window_minutes')?.value) ??
    10;
  const radiusMeters =
    savedPolicy.backupProviderRadiusMeters ??
    readOptionalNumber(byKey.get('matching.backup_provider_radius_meters')?.value) ??
    10000;
  const acceptedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'ACCEPTED',
  );
  const selectedPartner =
    booking.selectedProvider ?? (booking.status === 'MATCHED' ? booking.preferredProvider : null);
  const pinReady = Number.isFinite(backupSupply.policyPin.lat) && Number.isFinite(backupSupply.policyPin.lng);
  const addressSnapshotReady = Boolean(booking.addressSnapshot);
  const walletDebt = bookingCashDebtNeedsSettlement(booking);
  const terminal = TERMINAL_BOOKING_STATUSES.has(booking.status);
  const chatReady = Boolean(booking.chatRoom);

  return [
    {
      contract: 'Business authority',
      scope: 'Supabase infra, NestJS decisions',
      status: 'NestJS authoritative',
      tone: 'pill-success',
      evidence:
        'Supabase stores auth/storage/realtime infrastructure; API/admin policy owns booking permissions.',
      operatorUse: 'Use API state and audit rows for booking decisions, not client-only state.',
      href: '#operator-action-availability',
    },
    {
      contract: 'Booking address snapshot',
      scope: 'Required dispatch pin',
      status: addressSnapshotReady ? 'Snapshot ready' : pinReady ? 'Legacy pin only' : 'Missing pin',
      tone: addressSnapshotReady ? 'pill-success' : pinReady ? 'pill-warn' : 'pill-danger',
      evidence: `${bookingAddressSnapshotLabel(booking)} / ${backupSupply.policyPin.label}`,
      operatorUse: 'Marketplace distance and evidence review should use the immutable booking address.',
      href: '#address-radius-contract',
    },
    {
      contract: 'First-pick window',
      scope: 'Preferred partner response',
      status: booking.preferredProvider ? `${responseWindowMinutes}m window` : 'No preferred partner',
      tone: booking.preferredProvider ? 'pill-info' : 'pill-warn',
      evidence: booking.preferredProvider
        ? `${providerName(booking.preferredProvider)} / expires ${
            booking.expiresAt ? formatDate(booking.expiresAt) : 'not saved'
          }`
        : 'The booking has no first-pick partner record.',
      operatorUse: 'Preferred partner gets the first response window; customer still chooses final partner.',
      href: '#customer-wait-panel',
    },
    {
      contract: '10km marketplace',
      scope: 'Booking-address radius',
      status: pinReady ? `${formatDistanceMeters(radiusMeters)} radius` : 'Blocked by missing pin',
      tone: pinReady ? (backupSupply.eligibleCount ? 'pill-success' : 'pill-warn') : 'pill-danger',
      evidence: `${backupSupply.eligibleCount} eligible / ${backupSupply.rows.length} partner row(s) sampled.`,
      operatorUse:
        'Only partners within booking-address radius and fresh-location policy should join the shortlist.',
      href: '#marketplace-supply',
    },
    {
      contract: 'Customer final choice',
      scope: 'No automatic assignment',
      status: selectedPartner
        ? 'Final partner selected'
        : acceptedParticipants.length
          ? 'Customer choice pending'
          : 'Waiting for accepted partner',
      tone: selectedPartner ? 'pill-success' : acceptedParticipants.length ? 'pill-warn' : 'pill-info',
      evidence: selectedPartner
        ? providerName(selectedPartner)
        : `${acceptedParticipants.length} accepted partner(s), ${booking.participants?.length ?? 0} participant(s).`,
      operatorUse: 'Do not auto-assign; keep the customer selection step visible before chat unlocks.',
      href: '#participants',
    },
    {
      contract: 'Chat lifecycle',
      scope: 'Created after match, retained for admin',
      status: chatReady ? 'Chat archived' : selectedPartner ? 'Repair needed' : 'Locked until match',
      tone: chatReady ? 'pill-success' : selectedPartner ? 'pill-danger' : 'pill-info',
      evidence: chatReady
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} / ${messageCount} message(s).`
        : 'No chat room is attached to this booking yet.',
      operatorUse: 'Matched work needs chat for coordination; completed work keeps transcript in admin.',
      href: '#chat',
    },
    {
      contract: 'Wallet final gate',
      scope: 'Negative wallet can browse/join, final acceptance is held',
      status: walletDebt ? 'Settlement needed' : 'Gate clear',
      tone: walletDebt ? 'pill-danger' : 'pill-success',
      evidence: financeTrace.walletLedger,
      operatorUse:
        'Cash fee debt should block final acceptance/customer selection/service start until settlement rules clear it.',
      href: '#finance',
    },
    {
      contract: 'On-demand service rules',
      scope: 'No schedule picker, no customer extra-payment flow',
      status: terminal ? 'Closeout record' : 'On-demand active',
      tone: 'pill-success',
      evidence: `${financeTrace.serviceOption} / payment ${booking.payment?.method ?? 'NONE'} / no customer extra-payment lane.`,
      operatorUse:
        'Keep scheduling and customer extra-payment decisions out of MVP booking flow; use policy/admin closeout records.',
      href: '#service',
    },
  ];
}

function bookingDispatchPin(booking: AdminBookingDetail) {
  const snapshotLat = readOptionalNumber(booking.addressSnapshot?.latitude);
  const snapshotLng = readOptionalNumber(booking.addressSnapshot?.longitude);
  const legacyLat = readOptionalNumber(booking.lat);
  const legacyLng = readOptionalNumber(booking.lng);
  const hasSnapshotPin = snapshotLat !== null && snapshotLng !== null;
  const lat = hasSnapshotPin ? snapshotLat : legacyLat;
  const lng = hasSnapshotPin ? snapshotLng : legacyLng;
  const legacyDriftMeters =
    hasSnapshotPin && legacyLat !== null && legacyLng !== null
      ? approximateDistanceMeters(snapshotLat, snapshotLng, legacyLat, legacyLng)
      : null;

  return {
    lat,
    lng,
    source: hasSnapshotPin ? 'BookingAddressSnapshot' : 'Legacy booking pin',
    label: coordinateLabel(lat, lng),
    legacyDriftMeters,
  };
}

function bookingBackupPartnerExcludedGroups(
  rows: Array<{
    name: string;
    blockers: string[];
  }>,
  radiusMeters: number,
) {
  const group = (label: string, href: string, detail: string, match: (blocker: string) => boolean) => {
    const matched = rows.filter((row) => row.blockers.some(match));
    return {
      label,
      count: matched.length,
      detail,
      href,
      samples: matched.slice(0, 3).map((row) => row.name),
    };
  };

  return [
    group(
      'Account blocked',
      '/partners?review=blocked',
      'Partner account is blocked and should not receive direct or marketplace work.',
      (blocker) => blocker === 'account blocked',
    ),
    group(
      'Verification not approved',
      '/partners?review=kyc',
      'Partner needs KYC/verification approval before paid dispatch.',
      (blocker) => blocker.startsWith('verification'),
    ),
    group(
      'Not online available',
      '/partners?readiness=approved-offline',
      'Partner must open the app or become online available before they can be relied on.',
      (blocker) => blocker.startsWith('status'),
    ),
    group(
      'Location stale or missing',
      '/partners?review=location',
      'Partner location should be refreshed before marketplace decisions are confirmed.',
      (blocker) => blocker.startsWith('location') || blocker === 'no current coordinates',
    ),
    group(
      `Outside ${formatDistanceMeters(radiusMeters)}`,
      '/operations-policy#policy-matching-backup-provider-radius-meters',
      'Partner is outside the configured marketplace policy distance for this booking pin.',
      (blocker) => blocker.startsWith('outside'),
    ),
  ];
}

function bookingBackupCandidateCommand(input: {
  hasCustomerPin: boolean;
  eligibleCount: number;
  nearbyExcluded: number;
  staleOrMissing: number;
  outOfRadius: number;
}) {
  if (!input.hasCustomerPin) {
    return {
      status: 'NO PIN',
      tone: 'pill-danger',
      title: 'Customer location must be confirmed first',
      detail:
        'Distance, marketplace eligibility, and partner exclusion reasons cannot be confirmed without a booking pin.',
      href: '/bookings',
      action: 'Open bookings',
    };
  }
  if (input.eligibleCount > 0) {
    return {
      status: 'SUPPLY READY',
      tone: 'pill-success',
      title: 'This booking has usable marketplace partner supply',
      detail: `${input.eligibleCount} partner(s) can be nudged or exposed to the customer shortlist under current policy.`,
      href: '/partners?review=marketplace-ready',
      action: 'Open marketplace-ready',
    };
  }
  if (input.nearbyExcluded > 0 || input.staleOrMissing > 0) {
    return {
      status: 'REPAIR SUPPLY',
      tone: 'pill-warn',
      title: 'Nearby partners exist but are blocked',
      detail:
        'Prioritize app-open/location refresh, online status, and KYC before extending customer wait time.',
      href: '/partners?review=marketplace-blocked',
      action: 'Open blocked partners',
    };
  }
  if (input.outOfRadius > 0) {
    return {
      status: 'NO 10KM SUPPLY',
      tone: 'pill-warn',
      title: 'Partners are outside the configured marketplace radius',
      detail:
        'Do not widen radius blindly. Check city supply, customer location accuracy, and operations policy first.',
      href: '/operations-policy#policy-matching-backup-provider-radius-meters',
      action: 'Review radius policy',
    };
  }
  return {
    status: 'NO SUPPLY',
    tone: 'pill-danger',
    title: 'No partner supply is available for this booking',
    detail:
      'Escalate to support, confirm service location, or prepare customer cancellation/refund handling.',
    href: '/partners',
    action: 'Open partners',
  };
}

type CustomerWaitCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type BookingStageSnapshot = {
  stage: string;
  pillClass: string;
  noteClassName: string;
  headline: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
  metrics: Array<{ label: string; value: string; helper: string }>;
  badges: Array<{ label: string; tone: string }>;
};

function bookingDetailMatchingRuleSnapshot({
  booking,
  backupSupply,
  customerWaitPanel,
  notificationTrace,
}: {
  booking: AdminBookingDetail;
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>;
  customerWaitPanel: ReturnType<typeof bookingCustomerWaitPanel>;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
}): BookingDetailMatchingRuleSnapshot {
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const hasSavedPolicy = Object.values(savedPolicy).some((value) => value !== null);
  const participants = booking.participants ?? [];
  const acceptedParticipants = participants.filter((participant) => participant.status === 'ACCEPTED');
  const rejectedParticipants = participants.filter((participant) => participant.status === 'REJECTED');
  const finalPartner =
    booking.selectedProvider ?? (booking.status === 'MATCHED' ? booking.preferredProvider : null);
  const responseWindowMinutes = savedPolicy.providerResponseWindowMinutes ?? 10;
  const radiusMeters = savedPolicy.backupProviderRadiusMeters ?? backupSupply.radiusMeters;
  const partnerAlerts = notificationTrace.rows.filter((row) => row.isPartnerAlert).length;
  const walletBlocked = bookingCashDebtNeedsSettlement(booking);

  const status = finalPartner
    ? booking.chatRoom
      ? 'Final partner and chat ready'
      : 'Final partner, chat missing'
    : acceptedParticipants.length
      ? 'Customer final choice pending'
      : booking.status === 'OPEN_MATCHING'
        ? customerWaitPanel.signalStatus
        : booking.status;
  const tone = finalPartner
    ? booking.chatRoom
      ? 'pill-success'
      : 'pill-danger'
    : acceptedParticipants.length
      ? 'pill-warn'
      : customerWaitPanel.signalTone;

  const nextAction =
    finalPartner && !booking.chatRoom
      ? 'Repair chat before service handoff.'
      : finalPartner
        ? 'Use chat, location, payment, and closeout evidence for the next operation.'
        : acceptedParticipants.length
          ? 'Customer must select the final partner; operators should not assign one for them.'
          : booking.status === 'OPEN_MATCHING'
            ? 'Monitor first-pick, marketplace joins, and partner alert evidence.'
            : 'Continue from the current booking status and retained evidence.';

  return {
    status,
    tone,
    summary: `${hasSavedPolicy ? 'Saved booking policy snapshot' : 'Live MVP default'} is being used for this evidence readout. ${nextAction}`,
    rows: [
      {
        label: 'Policy source',
        value: hasSavedPolicy ? 'Saved snapshot' : 'Live default',
        helper: hasSavedPolicy
          ? 'This booking carries matching policy metadata captured at creation/open time.'
          : 'Older or seeded bookings may fall back to the current operations policy.',
      },
      {
        label: 'First-pick',
        value: booking.preferredProvider ? `${responseWindowMinutes}m window` : 'No preferred partner',
        helper: booking.preferredProvider
          ? `${providerName(booking.preferredProvider)} gets the first response window.`
          : 'Marketplace-only or older booking without a preferred partner record.',
      },
      {
        label: 'Marketplace radius',
        value: formatDistanceMeters(radiusMeters),
        helper: `${backupSupply.eligibleCount} eligible partner(s), ${participants.length} joined, ${acceptedParticipants.length} accepted.`,
      },
      {
        label: 'Customer choice',
        value: finalPartner ? providerName(finalPartner) : `${acceptedParticipants.length} accepted`,
        helper: finalPartner
          ? 'Customer final partner choice is recorded.'
          : 'Final partner remains customer-selected; no automatic assignment is used.',
      },
      {
        label: 'Partner alerts',
        value: `${partnerAlerts} alert(s)`,
        helper: `${notificationTrace.backupBatches.length} marketplace batch(es), ${rejectedParticipants.length} rejected participant(s).`,
      },
      {
        label: 'Chat handoff',
        value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
        helper: booking.chatRoom
          ? 'Admin keeps the chat archive even after mobile hides completed-service chats.'
          : 'Matched bookings should create a chat room before service coordination.',
      },
      {
        label: 'Wallet gate',
        value: walletBlocked ? 'Settlement needed' : 'Clear',
        helper: walletBlocked
          ? 'Negative cash-fee debt can block final acceptance/service movement until settled or offset.'
          : 'No cash-fee debt block is visible for this booking.',
      },
    ],
    actions: [
      { label: 'Open policy controls', href: '/operations-policy' },
      { label: 'Open marketplace supply', href: '#marketplace-supply' },
      { label: 'Open alerts', href: '#alerts' },
      { label: 'Open chat evidence', href: '#chat' },
    ],
  };
}

function bookingCustomerWaitPanel(
  booking: AdminBookingDetail,
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>,
  settings: AdminOperationalPolicySetting[],
) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindowMinutes =
    savedPolicy.providerResponseWindowMinutes ??
    readOptionalNumber(byKey.get('matching.provider_response_window_minutes')?.value) ??
    10;
  const backupOpenMode =
    savedPolicy.backupOpenMode ??
    readOptionalString(byKey.get('matching.backup_open_mode')?.value) ??
    'IMMEDIATE_WITHIN_WINDOW';
  const customerConfirmMode =
    (savedPolicy.preferredAcceptMode ??
      readOptionalString(byKey.get('matching.preferred_accept_mode')?.value)) ===
    'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const acceptedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'ACCEPTED',
  );
  const rejectedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'REJECTED',
  );
  const firstPick = booking.preferredProvider;
  const firstPickParticipant = (booking.participants ?? []).find(
    (participant) => participant.providerProfile?.id && participant.providerProfile.id === firstPick?.id,
  );
  const firstPickRejected = firstPickParticipant?.status === 'REJECTED';
  const selected = Boolean(booking.selectedProvider) || booking.status === 'MATCHED';
  const expired = booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false;
  const customerPinReady = Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng));
  const backupWindowOpen = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW' || firstPickRejected || expired;
  const waitingForCustomerChoice = customerConfirmMode && acceptedParticipants.length > 0 && !selected;
  const waitingForPartnerJoin = booking.status === 'OPEN_MATCHING' && acceptedParticipants.length === 0;
  const timer = matchingTimerStatus(booking.expiresAt, responseWindowMinutes);

  let signalStatus = 'Monitor';
  let signalTone = 'pill-info';
  let headline = 'Booking is being monitored.';
  let detail = 'No same-shift matching handoff is visible.';
  let nextActionHref = `/bookings/${booking.id}`;
  let nextActionLabel = 'Stay on booking';

  if (expired && booking.status === 'OPEN_MATCHING') {
    signalStatus = 'Timer expired';
    signalTone = 'pill-danger';
    headline = 'The customer should stop waiting unless support manually recovers the request.';
    detail = 'Expire the booking or contact the customer before the open matching window stays visible.';
    nextActionLabel = 'Handle expiry below';
  } else if (!customerPinReady && booking.status === 'OPEN_MATCHING') {
    signalStatus = 'Missing pin';
    signalTone = 'pill-danger';
    headline = 'Distance-based partner matching cannot be confirmed yet.';
    detail = 'Confirm the customer address or selected pin before using marketplace participation decisions.';
  } else if (waitingForCustomerChoice) {
    signalStatus = 'Customer choice';
    signalTone = 'pill-warn';
    headline = 'A partner accepted; the customer still needs to select the final partner.';
    detail =
      'Make sure the customer app shows the accepted partner shortlist and can unlock chat after selection.';
    nextActionLabel = 'Check participants';
  } else if (waitingForPartnerJoin && backupSupply.eligibleCount === 0) {
    signalStatus = 'Supply gap';
    signalTone = 'pill-danger';
    headline = 'No fresh nearby partner can currently join under policy.';
    detail =
      'Ask partners to go online/refresh location, or review marketplace radius and location freshness policy.';
    nextActionHref = '/partners?review=marketplace-blocked';
    nextActionLabel = 'Open blocked partners';
  } else if (waitingForPartnerJoin && backupWindowOpen) {
    signalStatus = 'Nudge partners';
    signalTone = 'pill-warn';
    headline = 'Customer is waiting and marketplace partners can join.';
    detail = `${backupSupply.eligibleCount} nearby partner(s) can be nudged into the shortlist.`;
    nextActionHref = '/partners?review=marketplace-ready';
    nextActionLabel = 'Open marketplace-ready partners';
  } else if (waitingForPartnerJoin) {
    signalStatus = 'First-pick wait';
    signalTone = 'pill-info';
    headline = 'Preferred partner still has the first response window.';
    detail = `Monitor ${providerName(firstPick)} for up to ${responseWindowMinutes} minutes while marketplace supply stays visible to operators.`;
  } else if (selected && booking.chatRoom) {
    signalStatus = 'Chat ready';
    signalTone = 'pill-success';
    headline = 'Final partner is selected and chat is ready.';
    detail = 'Monitor location sharing, arrival, service start, completion, and payment closeout.';
  } else if (selected && !booking.chatRoom) {
    signalStatus = 'Chat missing';
    signalTone = 'pill-danger';
    headline = 'Final partner is selected, but chat handoff is missing.';
    detail = 'Repair or create the chat room so the customer and partner can coordinate.';
  }

  const cards: CustomerWaitCard[] = [
    {
      title: 'First-pick response timer',
      status: timer.status,
      detail: timer.detail,
      action: firstPickParticipant
        ? `${providerName(firstPick)} responded as ${firstPickParticipant.status}.`
        : `${providerName(firstPick)} has not joined/responded yet.`,
      className: timer.className,
      pillClass: timer.pillClass,
    },
    {
      title: 'Customer final choice',
      status: selected ? 'Selected' : waitingForCustomerChoice ? 'Choose now' : 'Waiting',
      detail: selected
        ? `Final partner: ${providerName(booking.selectedProvider ?? booking.preferredProvider)}.`
        : waitingForCustomerChoice
          ? `${acceptedParticipants.length} accepted partner(s) are ready for customer selection.`
          : 'No accepted partner is ready for final customer selection yet.',
      action: customerConfirmMode
        ? 'Customer selects the final partner before chat unlocks.'
        : 'Policy conflicts with HANDS final-choice flow; return to customer-confirm mode.',
      className: selected
        ? 'ops-task-done'
        : waitingForCustomerChoice
          ? 'ops-task-pending'
          : 'ops-task-pending',
      pillClass: selected ? 'pill-success' : waitingForCustomerChoice ? 'pill-warn' : 'pill-info',
    },
    {
      title: 'Marketplace participation',
      status: backupWindowOpen ? 'Open' : 'Held',
      detail: backupWindowOpen
        ? `${backupSupply.eligibleCount} eligible marketplace partner(s) can join under current/saved policy.`
        : 'Marketplace partners are held until first-pick delay, decline, or timeout.',
      action: firstPickRejected
        ? 'First-pick declined, so marketplace recovery should be active.'
        : backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'Policy allows marketplace partners during the first-pick window.'
          : 'Policy delays marketplace visibility while first-pick is deciding.',
      className: backupWindowOpen ? 'ops-task-done' : 'ops-task-pending',
      pillClass: backupWindowOpen ? 'pill-success' : 'pill-info',
    },
    {
      title: 'Nearby partner supply',
      status: backupSupply.eligibleCount ? 'Supply ready' : customerPinReady ? 'Supply low' : 'No pin',
      detail: backupSupply.decisionDetail,
      action: customerPinReady
        ? `${backupSupply.eligibleCount} eligible, ${rejectedParticipants.length} rejected, ${acceptedParticipants.length} accepted.`
        : 'Confirm customer pin before relying on radius search.',
      className: backupSupply.eligibleCount ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: backupSupply.eligibleCount ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Chat handoff',
      status: booking.chatRoom ? 'Ready' : selected ? 'Missing' : 'Locked',
      detail: booking.chatRoom
        ? `${booking.chatRoom.messages?.length ?? 0} message(s) are visible in the room.`
        : selected
          ? 'Final partner is selected, but no chat room is attached.'
          : 'Chat stays locked until the final partner is selected.',
      action: booking.chatRoom
        ? 'Monitor coordination and location sharing.'
        : 'Unlock/repair after final match.',
      className: booking.chatRoom ? 'ops-task-done' : selected ? 'ops-task-blocked' : 'ops-task-pending',
      pillClass: booking.chatRoom ? 'pill-success' : selected ? 'pill-danger' : 'pill-info',
    },
  ];

  const badges = [
    {
      label: `${acceptedParticipants.length} accepted`,
      tone: acceptedParticipants.length ? 'pill-success' : 'pill-neutral',
      detail: 'Partners who accepted or are ready for final customer choice.',
    },
    {
      label: `${rejectedParticipants.length} rejected`,
      tone: rejectedParticipants.length ? 'pill-warn' : 'pill-neutral',
      detail: 'Partners who rejected this booking request.',
    },
    {
      label: `${backupSupply.eligibleCount} marketplace ready`,
      tone: backupSupply.eligibleCount ? 'pill-success' : 'pill-warn',
      detail: backupSupply.decisionDetail,
    },
    {
      label: customerPinReady ? 'Customer pin ready' : 'Customer pin missing',
      tone: customerPinReady ? 'pill-success' : 'pill-danger',
      detail: customerPinReady
        ? 'Distance and radius checks can use the saved customer coordinates.'
        : 'Booking does not have usable customer coordinates.',
    },
  ];

  return {
    signalStatus,
    signalTone,
    headline,
    detail,
    nextActionHref,
    nextActionLabel,
    cards,
    badges,
  };
}

function bookingStageSnapshot(
  booking: AdminBookingDetail,
  customerWaitPanel: ReturnType<typeof bookingCustomerWaitPanel>,
  backupSupply: ReturnType<typeof bookingBackupPartnerSupply>,
): BookingStageSnapshot {
  const status = String(booking.status);
  const acceptedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'ACCEPTED',
  );
  const rejectedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'REJECTED',
  );
  const selectedPartner =
    booking.selectedProvider ?? (status === 'MATCHED' ? booking.preferredProvider : null);
  const preferredParticipant = preferredParticipantState(booking);
  const locationFreshness = latestProviderLocationFreshness(booking);
  const customerPinReady = Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng));
  const terminal = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(status);
  const chatReady = Boolean(booking.chatRoom);

  let stage = 'Stage 0 - Intake';
  let pillClass = 'pill-info';
  let noteClassName = 'ops-task-pending';
  let headline = 'Booking is created and waiting for operational movement.';
  let detail = 'Confirm service, customer pin, payment state, and the first partner before matching starts.';
  let actionHref = `/bookings/${booking.id}`;
  let actionLabel = 'Review booking';

  if (terminal) {
    stage = 'Closeout';
    pillClass = status === 'COMPLETED' ? 'pill-success' : 'pill-warn';
    noteClassName = status === 'COMPLETED' ? 'ops-task-done' : 'ops-task-pending';
    headline = 'This booking is in closeout.';
    detail =
      'Use finance, refund, no-show, audit, and feedback sections to confirm the operational record is clean.';
    actionHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : `/bookings/${booking.id}`;
    actionLabel = booking.payment?.id ? 'Open payment trail' : 'Review closeout';
  } else if (selectedPartner && chatReady) {
    stage = 'Stage 4 - Chat handoff';
    pillClass = 'pill-success';
    noteClassName = 'ops-task-done';
    headline = 'Final partner is selected and chat is available.';
    detail =
      locationFreshness === 'recent'
        ? 'Chat and location handoff are live; monitor arrival, service start, completion, and payment closeout.'
        : 'Chat is ready; ask the partner to refresh location if the customer needs approach visibility.';
    actionHref = `/bookings/${booking.id}#chat`;
    actionLabel = 'Review chat';
  } else if (selectedPartner && !chatReady) {
    stage = 'Stage 4 - Handoff repair';
    pillClass = 'pill-danger';
    noteClassName = 'ops-task-blocked';
    headline = 'A final partner exists, but the chat handoff is missing.';
    detail = 'Repair the chat room before the customer and partner lose coordination after match.';
    actionHref = `/bookings/${booking.id}#chat`;
    actionLabel = 'Repair chat';
  } else if (status === 'OPEN_MATCHING' && acceptedParticipants.length > 0) {
    stage = 'Stage 3 - Customer choice';
    pillClass = 'pill-warn';
    noteClassName = 'ops-task-pending';
    headline = 'Accepted partner(s) are waiting for customer final selection.';
    detail = customerWaitPanel.detail;
    actionHref = `/bookings/${booking.id}#participants`;
    actionLabel = 'Review shortlist';
  } else if (status === 'OPEN_MATCHING' && backupSupply.eligibleCount > 0) {
    stage = 'Stage 2 - Marketplace participation';
    pillClass = 'pill-warn';
    noteClassName = 'ops-task-pending';
    headline = 'The marketplace partner window has usable supply.';
    detail = `${backupSupply.eligibleCount} partner(s) can join or be nudged while the customer waits.`;
    actionHref = '/partners?review=marketplace-ready';
    actionLabel = 'Open marketplace partners';
  } else if (status === 'OPEN_MATCHING') {
    stage = 'Stage 1 - First-pick response';
    pillClass = customerPinReady ? 'pill-info' : 'pill-danger';
    noteClassName = customerPinReady ? 'ops-task-pending' : 'ops-task-blocked';
    headline = customerPinReady
      ? 'Preferred partner is still in the first response window.'
      : 'Customer pin is missing, so radius matching is not reliable.';
    detail = customerPinReady
      ? customerWaitPanel.detail
      : 'Confirm the customer service location before using distance, marketplace, or dispatch decisions.';
    actionHref = customerPinReady
      ? `/bookings/${booking.id}#participants`
      : `/bookings/${booking.id}#customer`;
    actionLabel = customerPinReady ? 'Monitor first-pick' : 'Fix customer pin';
  }

  return {
    stage,
    pillClass,
    noteClassName,
    headline,
    detail,
    actionHref,
    actionLabel,
    metrics: [
      {
        label: 'Status',
        value: status,
        helper: bookingStatusHint(status),
      },
      {
        label: 'Preferred partner',
        value: providerName(booking.preferredProvider),
        helper: preferredParticipant
          ? `Partner response: ${preferredParticipant.status}.`
          : 'No partner response recorded yet.',
      },
      {
        label: 'Shortlist',
        value: `${acceptedParticipants.length} accepted`,
        helper: `${rejectedParticipants.length} rejected, ${backupSupply.eligibleCount} marketplace eligible.`,
      },
      {
        label: 'Handoff',
        value: chatReady ? 'Chat ready' : 'Chat locked',
        helper:
          locationFreshness === 'recent'
            ? 'Partner location is recent.'
            : `Partner location is ${locationFreshness}.`,
      },
    ],
    badges: [
      {
        label: customerPinReady ? 'Pin ready' : 'Pin missing',
        tone: customerPinReady ? 'pill-success' : 'pill-danger',
      },
      {
        label: `${backupSupply.eligibleCount} in marketplace policy`,
        tone: backupSupply.eligibleCount ? 'pill-success' : 'pill-warn',
      },
      { label: chatReady ? 'Chat ready' : 'Chat pending', tone: chatReady ? 'pill-success' : 'pill-info' },
      {
        label: providerName(selectedPartner ?? booking.preferredProvider),
        tone: selectedPartner ? 'pill-success' : 'pill-neutral',
      },
    ],
  };
}

function matchingTimerStatus(value: string | null | undefined, responseWindowMinutes: number) {
  if (!value) {
    return {
      status: `${responseWindowMinutes}m policy`,
      detail: 'No booking expiry timestamp is saved; use the response-window policy and audit notes.',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    };
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return {
      status: 'Invalid',
      detail: 'Booking expiry timestamp cannot be parsed.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  const minutes = Math.ceil((timestamp - Date.now()) / 60_000);
  if (minutes <= 0) {
    return {
      status: 'Expired',
      detail: `Timer expired ${Math.abs(minutes)}m ago.`,
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  return {
    status: `${minutes}m left`,
    detail: `Timer closes at ${formatDate(value)} using the ${responseWindowMinutes}m response-window policy.`,
    className: minutes <= 3 ? 'ops-task-pending' : 'ops-task-done',
    pillClass: minutes <= 3 ? 'pill-warn' : 'pill-success',
  };
}

function providerLocationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
}

function bookingOperationalPolicySnapshot(
  booking: AdminBookingDetail,
  settings: AdminOperationalPolicySetting[],
) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const savedMatchingPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindow = byKey.get('matching.provider_response_window_minutes');
  const backupRadius = byKey.get('matching.backup_provider_radius_meters');
  const backupLocationFreshness = byKey.get('matching.backup_provider_location_max_age_minutes');
  const travelBuffer = byKey.get('matching.travel_buffer_minutes');
  const acceptMode = byKey.get('matching.preferred_accept_mode');
  const backupOpenMode = byKey.get('matching.backup_open_mode');
  const walletGate = byKey.get('wallet.negative_balance_gate');
  const actionEvidenceGateMode = byKey.get('decision.action_evidence_gate_mode');
  const cashSettlementClearancePolicy = byKey.get('cash.settlement_clearance_policy');
  const firstPickExpiryActionPolicy = byKey.get('matching.first_pick_expiry_action_policy');
  const cancellationPolicy = byKey.get('cancellation.after_match_policy');
  const noShowEvidenceRequirementPolicy = byKey.get('no_show.evidence_requirement_policy');
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
    : 'Legacy accept mode ignored';
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
        label: 'Marketplace participation',
        helper:
          String(backupOpenMode?.value) === 'AFTER_FIRST_PICK_DELAY'
            ? 'Marketplace partners are hidden until the preferred partner window passes, but open immediately if that partner declines.'
            : 'Eligible nearby partners can join while the preferred partner is still deciding.',
        enforced: true,
      }),
      bookingPolicyDecisionCard({
        setting: walletGate,
        key: 'wallet.negative_balance_gate',
        label: 'Wallet debt gate',
        helper:
          String(walletGate?.value) === 'ALLOW_ONE_RECOVERY_BOOKING'
            ? 'Negative wallet partners can hold one active recovery booking while the next final acceptance still requires settlement review.'
            : 'Negative wallet partners can show intent, but final acceptance or customer selection is blocked.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: actionEvidenceGateMode,
        key: 'decision.action_evidence_gate_mode',
        label: 'Action evidence gate',
        helper:
          String(actionEvidenceGateMode?.value) === 'STRICT_EVIDENCE_REQUIRED'
            ? 'Money and closeout actions should wait for strict retained evidence before operators proceed.'
            : 'Operators should review retained payment, chat, address, wallet, alert, and audit evidence before manual actions.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: cashSettlementClearancePolicy,
        key: 'cash.settlement_clearance_policy',
        label: 'Cash fee clearance',
        helper:
          String(cashSettlementClearancePolicy?.value) === 'DEPOSIT_REFERENCE_REQUIRED'
            ? 'Cash fee debt clearance should include a company deposit reference before final gates reopen.'
            : 'Cash fee debt can clear through verified company deposit or approved admin offset with evidence.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: firstPickExpiryActionPolicy,
        key: 'matching.first_pick_expiry_action_policy',
        label: 'First-pick expiry',
        helper:
          String(firstPickExpiryActionPolicy?.value) === 'EXPIRE_ONLY_AFTER_OPERATOR_REVIEW'
            ? 'Do not expire automatically; operators review first-pick timeout and available partners.'
            : 'After first-pick timeout, marketplace alternatives can remain visible while operators review the request.',
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
        setting: noShowEvidenceRequirementPolicy,
        key: 'no_show.evidence_requirement_policy',
        label: 'No-show evidence requirement',
        helper:
          String(noShowEvidenceRequirementPolicy?.value) === 'CHAT_AND_OPERATOR_NOTE_REQUIRED'
            ? 'No-show closeout should include chat evidence and an operator note before money handling.'
            : 'No-show closeout should use retained factual records such as chat, alert, location, or operator notes.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: noShowPolicy,
        key: 'no_show.partner_report_policy',
        label: 'No-show handling',
        helper:
          booking.status === 'NO_SHOW'
            ? 'Use this policy to review evidence before payment or support closeout.'
            : 'Applies if a no-show closeout needs operator review later.',
        enforced: false,
      }),
      bookingPolicyDecisionCard({
        setting: partnerAlertPolicy,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert route',
        helper:
          String(partnerAlertPolicy?.value) === 'ONESIGNAL_FOR_ALL_BOOKINGS'
            ? 'Booking and marketplace alerts should create OneSignal delivery logs.'
            : 'Partner alerts are kept in the app inbox until production push is ready.',
        enforced: false,
      }),
    ],
    metrics: [
      {
        label: 'Response window',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.providerResponseWindowMinutes, 'minutes') ??
          bookingPolicyValueLabel(responseWindow),
        helper:
          minutesLeft === null
            ? bookingPolicySnapshotHelper(
                savedMatchingPolicy.providerResponseWindowMinutes,
                responseWindow,
                'No active countdown saved.',
              )
            : `${minutesLeft} min left. ${bookingPolicySnapshotHelper(
                savedMatchingPolicy.providerResponseWindowMinutes,
                responseWindow,
                'Live policy default.',
              )}`,
      },
      {
        label: 'Marketplace radius',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.backupProviderRadiusMeters, 'meters') ??
          bookingPolicyValueLabel(backupRadius),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.backupProviderRadiusMeters,
          backupRadius,
          'Nearby partners outside this distance cannot join.',
        ),
      },
      {
        label: 'Location freshness',
        value:
          bookingPolicySnapshotNumberLabel(
            savedMatchingPolicy.backupProviderLocationMaxAgeMinutes,
            'minutes',
          ) ?? bookingPolicyValueLabel(backupLocationFreshness),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.backupProviderLocationMaxAgeMinutes,
          backupLocationFreshness,
          'Marketplace partners with older locations cannot join.',
        ),
      },
      {
        label: 'Travel buffer',
        value:
          bookingPolicySnapshotNumberLabel(savedMatchingPolicy.travelBufferMinutes, 'minutes') ??
          bookingPolicyValueLabel(travelBuffer),
        helper: bookingPolicySnapshotHelper(
          savedMatchingPolicy.travelBufferMinutes,
          travelBuffer,
          'Applied before nearby availability is calculated.',
        ),
      },
      {
        label: 'Accept mode',
        value: bookingPolicySnapshotOptionLabel(savedMatchingPolicy.preferredAcceptMode, acceptMode),
        helper: selected
          ? `Booking has a final partner. ${bookingPolicySnapshotHelper(
              savedMatchingPolicy.preferredAcceptMode,
              acceptMode,
              'Live policy default.',
            )}`
          : `Booking is still waiting for final selection. ${bookingPolicySnapshotHelper(
              savedMatchingPolicy.preferredAcceptMode,
              acceptMode,
              'Live policy default.',
            )}`,
      },
    ],
  };
}

function readBookingMatchingPolicySnapshot(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy?.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy?.backupProviderRadiusMeters),
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(policy?.backupProviderLocationMaxAgeMinutes),
    backupProviderInvitationLimit: readOptionalNumber(policy?.backupProviderInvitationLimit),
    bookingMaxCustomerCurrentToAddressKm: readOptionalNumber(policy?.bookingMaxCustomerCurrentToAddressKm),
    bookingMaxPreferredProviderDistanceKm: readOptionalNumber(policy?.bookingMaxPreferredProviderDistanceKm),
    bookingCurrentLocationFreshnessMinutes: readOptionalNumber(
      policy?.bookingCurrentLocationFreshnessMinutes,
    ),
    preferredAcceptMode: readOptionalString(policy?.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy?.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy?.travelBufferMinutes),
  };
}

function readBookingGateSnapshot(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const gate = readPlainRecord(metadata?.bookingGate);
  const customerDistance = readOptionalNumber(gate?.customerToBookingAddressDistanceMeters);
  const customerLimit = readOptionalNumber(gate?.customerDistanceLimitMeters);
  const preferredDistance = readOptionalNumber(gate?.preferredProviderDistanceMeters);
  const preferredLimit = readOptionalNumber(gate?.preferredProviderDistanceLimitMeters);
  const customerCurrentLocation = readPlainRecord(gate?.customerCurrentLocation);
  const customerRecordedAt = readOptionalString(customerCurrentLocation?.recordedAt);
  const gatePassed = gate?.gatePassed === true;

  const customerDistanceLabel =
    customerDistance === null
      ? 'No current GPS snapshot'
      : `${distanceLabel(Math.round(customerDistance))} / limit ${distanceLabel(Math.round(customerLimit ?? 0))}`;
  const preferredPartnerDistanceLabel =
    preferredDistance === null
      ? 'No preferred partner distance'
      : `${distanceLabel(Math.round(preferredDistance))} / limit ${distanceLabel(Math.round(preferredLimit ?? 0))}`;

  return {
    gatePassed,
    customerDistanceLabel,
    customerDistanceHelper: customerRecordedAt
      ? `Customer GPS was captured at ${formatDate(customerRecordedAt)} before booking opened.`
      : 'Older bookings may not have customer current GPS metadata.',
    preferredPartnerDistanceLabel,
    preferredPartnerDistanceHelper:
      preferredDistance === null
        ? 'Marketplace-only bookings or older bookings may not have a first-pick partner distance.'
        : 'Preferred partner distance is measured from the immutable booking address.',
    summary: gatePassed
      ? `${customerDistanceLabel}; ${preferredPartnerDistanceLabel}`
      : 'Booking gate metadata is missing or older than this policy.',
  };
}

function bookingOperationsTrace(booking: AdminBookingDetail, logs: AdminAuditLog[]) {
  const bookingTarget = `booking:${booking.id}`;
  const bookingCreatedAt = safeTime(booking.createdAt);
  const matchingPolicy = readBookingMatchingPolicySnapshot(booking);
  const hasSavedMatchingPolicy = Object.values(matchingPolicy).some((value) => value !== null);
  const bookingLogs = logs
    .filter((log) => log.target === bookingTarget || auditMetadataBookingId(log) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const policyLogsAfterOpen = logs
    .filter((log) => log.action === 'operational_policy.update')
    .filter((log) => isBookingRelevantPolicyKey(auditPolicyKey(log)))
    .filter((log) => bookingCreatedAt === 0 || safeTime(log.createdAt) >= bookingCreatedAt)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const manualLogs = bookingLogs.filter((log) => isManualBookingAuditAction(log.action));
  const paymentLogs = bookingLogs.filter(
    (log) => log.action.startsWith('payment.') || log.action.startsWith('earning.'),
  );
  const rows = [...bookingLogs, ...policyLogsAfterOpen]
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))
    .slice(0, 8)
    .map((log) => bookingOperationsTraceRow(log, booking.id));
  const status =
    manualLogs.length > 0
      ? 'Operator touched'
      : policyLogsAfterOpen.length > 0
        ? 'Policy changed'
        : hasSavedMatchingPolicy
          ? 'Snapshot saved'
          : 'Live policy default';
  const statusTone =
    manualLogs.length > 0 || policyLogsAfterOpen.length > 0
      ? 'pill-warn'
      : hasSavedMatchingPolicy
        ? 'pill-success'
        : 'pill-info';
  const title =
    manualLogs.length > 0
      ? 'Review manual handling before closing this booking'
      : policyLogsAfterOpen.length > 0
        ? 'Current policy changed after this booking opened'
        : hasSavedMatchingPolicy
          ? 'Booking has its own matching policy snapshot'
          : 'Booking is using live policy default';
  const detail =
    manualLogs.length > 0
      ? 'This booking has operator actions in the audit log. Check notes, payment actions, no-show, expiry, or closeout before making another change.'
      : policyLogsAfterOpen.length > 0
        ? 'Matching uses the saved booking snapshot where available. Compare policy changes below before explaining behavior to customers or partners.'
        : hasSavedMatchingPolicy
          ? 'The saved response window, radius, accept mode, marketplace mode, and travel buffer are preserved for this booking.'
          : 'Older or seeded bookings may not have a stored policy snapshot; operators should use the live policy panel above.';

  return {
    status,
    statusTone,
    title,
    detail,
    rows,
    metrics: [
      {
        label: 'Booking events',
        value: `${bookingLogs.length}`,
        helper: 'Audit rows linked by booking target or bookingId metadata.',
      },
      {
        label: 'Manual actions',
        value: `${manualLogs.length}`,
        helper: manualLogs.length
          ? 'Review before further intervention.'
          : 'No manual booking action captured.',
      },
      {
        label: 'Money actions',
        value: `${paymentLogs.length}`,
        helper: 'Payment, earning, cash debt, or payout audit rows linked to this booking.',
      },
      {
        label: 'Policy changes after open',
        value: `${policyLogsAfterOpen.length}`,
        helper: 'Relevant operations policy updates after this booking was created.',
      },
      {
        label: 'Policy source',
        value: hasSavedMatchingPolicy ? 'Saved snapshot' : 'Live policy default',
        helper: hasSavedMatchingPolicy
          ? 'Booking behavior is explainable from saved metadata.'
          : 'Use live policy with extra caution.',
      },
    ],
  };
}

function bookingOperationsTraceRow(log: AdminAuditLog, bookingId: string) {
  const policyKey = auditPolicyKey(log);
  const isPolicy = log.action === 'operational_policy.update';
  const isMoney = log.action.startsWith('payment.') || log.action.startsWith('earning.');
  const isManual = isManualBookingAuditAction(log.action);
  const targetBookingId = auditMetadataBookingId(log);
  const signal = isPolicy ? 'Policy' : isMoney ? 'Money' : isManual ? 'Manual' : 'Trace';
  const signalClass = isPolicy || isManual ? 'signal-warn' : isMoney ? 'signal-info' : 'signal-ok';
  const actor = log.actor?.fullName ?? log.actor?.phone ?? 'System';

  return {
    id: log.id,
    signal,
    signalClass,
    title: `${humanizeAuditAction(log.action)} / ${actor}`,
    detail: isPolicy
      ? `${policyKey ?? 'Operational policy'} changed after booking open; existing matching behavior should still follow the saved booking snapshot when present.`
      : `${log.target}${targetBookingId && targetBookingId !== bookingId ? ` / booking ${shortId(targetBookingId)}` : ''}`,
    meta: [formatDate(log.createdAt), auditMetadataSummary(log.metadata)].filter(Boolean).join(' / '),
  };
}

function auditMetadataBookingId(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.bookingId);
}

function auditPolicyKey(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.key);
}

function isBookingRelevantPolicyKey(key: string | null) {
  return Boolean(
    key &&
    (key.startsWith('matching.') ||
      key.startsWith('wallet.') ||
      key.startsWith('cancellation.') ||
      key.startsWith('no_show.') ||
      key.startsWith('notification.partner_')),
  );
}

function isManualBookingAuditAction(action: string) {
  return (
    action.startsWith('booking.') ||
    action.startsWith('payment.') ||
    action.startsWith('earning.') ||
    action.startsWith('refund.')
  );
}

function humanizeAuditAction(action: string) {
  return action
    .split(/[._-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function auditMetadataSummary(metadata: unknown) {
  const data = readPlainRecord(metadata);
  if (!data) {
    return '';
  }

  const highlights = [
    readOptionalString(data.reason) ? `reason: ${readOptionalString(data.reason)}` : null,
    readOptionalString(data.key) ? `key: ${readOptionalString(data.key)}` : null,
    data.previousValue !== undefined ? `previous: ${compactAuditValue(data.previousValue)}` : null,
    data.value !== undefined ? `value: ${compactAuditValue(data.value)}` : null,
    readOptionalString(data.status) ? `status: ${readOptionalString(data.status)}` : null,
    readOptionalString(data.method) ? `method: ${readOptionalString(data.method)}` : null,
    readOptionalNumber(data.amount) !== null
      ? `amount: ${readOptionalNumber(data.amount)?.toLocaleString()}`
      : null,
    readOptionalString(data.note) ? `note: ${readOptionalString(data.note)}` : null,
    data.paymentReleased !== undefined ? `payment released: ${String(data.paymentReleased)}` : null,
  ].filter(Boolean);

  return highlights.slice(0, 4).join(' / ');
}

function compactAuditValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function bookingNotificationTrace(booking: AdminBookingDetail, notifications: AdminNotification[]) {
  const backupBatches = bookingBackupNotificationTraceBatches(booking);
  const rows = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((notification) => bookingNotificationTraceRow(notification));
  const deliveries = rows.flatMap((row) => row.deliveryStatuses);
  const partnerAlerts = rows.filter((row) => row.isPartnerAlert).length;
  const noShowAlerts = rows.filter((row) => row.type === 'booking.no_show').length;
  const failed = deliveries.filter((status) => status === 'FAILED').length;
  const skippedOrPending =
    deliveries.filter((status) => status === 'SKIPPED').length +
    rows.filter((row) => row.deliveryStatuses.length === 0).length;
  const disabledDevices = rows.reduce((total, row) => total + row.disabledDeviceCount, 0);

  return {
    rows,
    backupBatches,
    metrics: [
      {
        label: 'Related alerts',
        value: `${rows.length}`,
        helper: 'Notification rows carrying this booking id.',
      },
      {
        label: 'No-show alerts',
        value: `${noShowAlerts}`,
        helper: noShowAlerts
          ? 'Customer or partner was notified about the no-show review.'
          : 'No no-show communication row for this booking.',
      },
      {
        label: 'Partner alerts',
        value: `${partnerAlerts}`,
        helper: 'First-pick, marketplace, and matched partner notices.',
      },
      {
        label: 'Failed sends',
        value: `${failed}`,
        helper: failed ? 'Open the notification board before retry.' : 'No captured send failures.',
      },
      {
        label: 'Skipped / pending',
        value: `${skippedOrPending}`,
        helper: 'In-app-only routing, no device path, or no attempt yet.',
      },
      {
        label: 'Disabled devices',
        value: `${disabledDevices}`,
        helper: disabledDevices ? 'Fresh device token is needed before re-enable.' : 'No disabled devices.',
      },
      {
        label: 'Marketplace alert batches',
        value: `${backupBatches.length}`,
        helper: backupBatches.length
          ? 'Stored invite batches on the booking record.'
          : 'No marketplace invite batch recorded.',
      },
      {
        label: 'Last marketplace invite',
        value: backupBatches[0]?.notifiedCountLabel ?? '0',
        helper: backupBatches[0]?.detail ?? 'No partner was invited from a marketplace batch yet.',
      },
    ],
  };
}

function bookingBackupNotificationTraceBatches(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const rawBatches = Array.isArray(metadata?.backupNotificationTraces)
    ? metadata.backupNotificationTraces
    : [];

  return rawBatches
    .map((value, index) => {
      const batch = readPlainRecord(value);
      if (!batch) {
        return null;
      }
      const providers = Array.isArray(batch.providers) ? batch.providers : [];
      const createdAt = readOptionalString(batch.createdAt);
      const stage = readOptionalString(batch.stage) ?? 'backup_invite';
      const notifiedCount = readOptionalNumber(batch.notifiedCount) ?? providers.length;
      const websocketTargetCount = readOptionalNumber(batch.websocketTargetCount);
      const radius = readOptionalNumber(batch.backupProviderRadiusMeters);
      const limit = readOptionalNumber(batch.backupProviderInvitationLimit);
      const mode = readOptionalString(batch.backupOpenMode);
      const providerSummary = providers
        .map((providerValue) => {
          const provider = readPlainRecord(providerValue);
          if (!provider) {
            return null;
          }
          const providerProfileId = readOptionalString(provider.providerProfileId);
          const notificationId = readOptionalString(provider.notificationId);
          const distance = readOptionalNumber(provider.distanceMeters);
          return [
            providerProfileId ? `partner ${shortId(providerProfileId)}` : null,
            distance !== null ? formatDistanceMeters(distance) : null,
            notificationId ? `alert ${shortId(notificationId)}` : null,
          ]
            .filter(Boolean)
            .join(' / ');
        })
        .filter(Boolean)
        .slice(0, 8)
        .join(' | ');

      return {
        id: `${createdAt ?? 'batch'}-${stage}-${index}`,
        signal: notifiedCount > 0 ? 'Marketplace invited' : 'No marketplace sent',
        title: `${humanizeNotificationType(stage)} / ${notifiedCount} partner(s)`,
        notifiedCountLabel: `${notifiedCount}`,
        detail:
          notifiedCount > 0
            ? `${notifiedCount} partner(s) were sent marketplace availability alerts.`
            : 'The marketplace batch ran, but no eligible partner was available under the saved policy.',
        meta: [
          createdAt ? `created ${formatDate(createdAt)}` : null,
          websocketTargetCount !== null ? `websocket targets ${websocketTargetCount}` : null,
          radius !== null ? `radius ${formatDistanceMeters(radius)}` : null,
          limit !== null ? `invite cap ${limit}` : null,
          mode ? `mode ${mode}` : null,
        ]
          .filter(Boolean)
          .join(' / '),
        providers: providerSummary ? `Invited: ${providerSummary}` : '',
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => {
      const leftCreatedAt = left.id.split('-').slice(0, 3).join('-');
      const rightCreatedAt = right.id.split('-').slice(0, 3).join('-');
      return Date.parse(rightCreatedAt) - Date.parse(leftCreatedAt);
    });
}

function bookingNotificationTraceRow(notification: AdminNotification) {
  const data = readPlainRecord(notification.data);
  const deliveries = notification.deliveries ?? [];
  const failed = deliveries.some((delivery) => delivery.status === 'FAILED');
  const disabled = deliveries.some((delivery) => delivery.pushDevice?.enabled === false);
  const skipped = deliveries.some((delivery) => delivery.status === 'SKIPPED');
  const sent = deliveries.some((delivery) => delivery.status === 'SENT');
  const partner = notification.user?.providerProfile;
  const target =
    partner?.displayName ??
    notification.user?.fullName ??
    notification.user?.phone ??
    (partner?.id ? `Partner ${shortId(partner.id)}` : 'Unknown target');
  const providerProfileId = readOptionalString(data?.providerProfileId);
  const radius = readOptionalNumber(data?.backupProviderRadiusMeters);
  const distance = readOptionalNumber(data?.distanceMeters);
  const invitationLimit = readOptionalNumber(data?.backupProviderInvitationLimit);
  const deliveryStatuses = deliveries.map((delivery) => delivery.status);

  return {
    id: notification.id,
    type: notification.type,
    isPartnerAlert: isPartnerNotificationType(notification.type),
    deliveryStatuses,
    disabledDeviceCount: deliveries.filter((delivery) => delivery.pushDevice?.enabled === false).length,
    signal: failed
      ? 'Retry needed'
      : disabled
        ? 'Device disabled'
        : skipped
          ? 'Skipped'
          : sent
            ? 'Delivered'
            : 'Pending',
    signalClass: failed || disabled ? 'signal-warn' : sent ? 'signal-ok' : 'signal-info',
    title: `${marketplaceDisplayText(notification.title)} / ${marketplaceDisplayText(target)}`,
    detail: marketplaceDisplayText(notification.body),
    meta: [
      humanizeNotificationType(notification.type),
      `created ${formatDate(notification.createdAt)}`,
      providerProfileId ? `partner ${shortId(providerProfileId)}` : null,
      distance !== null ? `distance ${formatDistanceMeters(distance)}` : null,
      radius !== null ? `marketplace radius ${formatDistanceMeters(radius)}` : null,
      invitationLimit !== null ? `invite cap ${invitationLimit}` : null,
      data?.backupOpenMode ? `marketplace mode ${String(data.backupOpenMode)}` : null,
      data?.noShowPolicy ? `no-show policy ${String(data.noShowPolicy)}` : null,
      data?.reason ? `reason ${String(data.reason)}` : null,
    ]
      .filter(Boolean)
      .join(' / '),
    delivery:
      deliveries.length > 0
        ? deliveries
            .map(
              (delivery) =>
                `${delivery.provider} ${delivery.status} (${delivery.pushDevice?.platform ?? 'device'}, ${formatDate(
                  delivery.attemptedAt,
                )})`,
            )
            .join(' / ')
        : 'No delivery attempt captured.',
  };
}

function notificationDataBookingId(notification: AdminNotification) {
  const data = readPlainRecord(notification.data);
  return readOptionalString(data?.bookingId);
}

function isPartnerNotificationType(type: string) {
  return [
    'booking.requested',
    'booking.backup_available',
    'booking.matched',
    'provider.payout_setup_required',
  ].includes(type);
}

function humanizeNotificationType(type: string) {
  return marketplaceDisplayText(
    type
      .toLowerCase()
      .split(/[_\-.]/g)
      .map((part) => (part === 'backup' ? 'Marketplace' : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' '),
  );
}

function marketplaceDisplayText(value: string) {
  return value
    .replace(/\bbackup\b/g, 'marketplace')
    .replace(/\bBackup\b/g, 'Marketplace')
    .replace(/\bProvider\b/g, 'Partner')
    .replace(/\bprovider\b/g, 'partner');
}

function formatDistanceMeters(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(value).toLocaleString()} m`;
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

function bookingPolicySnapshotNumberLabel(value: number | null, unit: 'meters' | 'minutes') {
  if (value === null) {
    return null;
  }
  if (unit === 'meters') {
    return `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${value} min`;
}

function bookingPolicySnapshotOptionLabel(value: string | null, setting?: AdminOperationalPolicySetting) {
  if (!value) {
    return bookingPolicyOptionLabel(setting);
  }
  return setting?.options?.find((option) => option.value === value)?.label ?? value;
}

function bookingPolicySnapshotHelper(
  savedValue: number | string | null,
  liveSetting: AdminOperationalPolicySetting | undefined,
  fallback: string,
) {
  if (savedValue === null) {
    return fallback;
  }
  const liveValue = liveSetting?.value;
  if (liveValue !== undefined && liveValue !== null && String(liveValue) !== String(savedValue)) {
    return `Saved on booking open. Current policy is ${bookingPolicyOptionLabel(liveSetting)}.`;
  }
  return 'Saved on booking open and aligned with current policy.';
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
  return provider?.displayName ? marketplaceDisplayText(provider.displayName) : 'Not selected';
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
  if (address && typeof address === 'object') {
    const record = address as Record<string, unknown>;
    const knownText =
      record.addressText ?? record.address_text ?? record.address ?? record.label ?? record.name;
    if (typeof knownText === 'string' && knownText.trim()) {
      return knownText.trim();
    }
  }
  if (address && typeof address === 'object' && 'line1' in address) {
    return String((address as { line1?: unknown }).line1 ?? 'Address pending');
  }
  return 'Address pending';
}

function bookingAddressSnapshotLabel(booking: AdminBookingDetail) {
  const snapshotText = booking.addressSnapshot?.addressText?.trim();
  if (snapshotText) {
    return snapshotText;
  }
  if (booking.addressSnapshot?.address) {
    return addressLabel(booking.addressSnapshot.address);
  }
  return addressLabel(booking.address);
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

function safeTime(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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
