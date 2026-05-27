import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminProvider,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../../lib/admin-api';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  blockProviderAccount,
  blockProviderDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
  unblockProviderDevice,
} from '../actions';
import {
  createProviderReport,
  createProviderSanction,
  liftProviderSanction,
  updateProviderReport,
} from '../../provider-risk/actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProviderDetail = AdminProvider & {
  locationSnapshots?: Array<{ id: string; lat: string | number; lng: string | number; recordedAt: string }>;
  earnings?: Array<{
    id: string;
    bookingId?: string | null;
    grossAmount: number;
    platformFee: number;
    withholdingAmount: number;
    netAmount: number;
    currency?: string | null;
    status: string;
    availableAt?: string | null;
    paidAt?: string | null;
    settlementRef?: string | null;
    settlementNotes?: string | null;
    createdAt?: string;
    booking?: {
      status?: string;
      payment?: { method?: string; status?: string; amount?: number; currency?: string | null } | null;
    } | null;
    walletLedgerEntries?: Array<{
      id: string;
      type: string;
      amount: number;
      currency?: string | null;
      reference?: string | null;
      notes?: string | null;
      createdAt?: string;
    }>;
  }>;
  payoutBatches?: Array<{
    id: string;
    totalNetAmount: number;
    currency?: string | null;
    status: string;
    transferRef?: string | null;
    paidAt?: string | null;
    createdAt?: string;
  }>;
  verificationLogs?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: unknown;
    createdAt: string;
    actor?: { phone?: string | null; fullName?: string | null } | null;
  }>;
};

export default async function ProviderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const provider = await adminGet<ProviderDetail | null>(`/admin/providers/${id}`, null);

  if (!provider) {
    notFound();
  }

  const readUrls = new Map<string, string>();
  await Promise.all(
    [
      ...(provider.verification?.files ?? []),
      ...(provider.documents ?? []).map((document) => document.fileAsset).filter(Boolean),
    ].map(async (file) => {
      if (!file?.id) return;
      const result = await adminGet<{ read?: { url?: string } }>(`/files/${file.id}/read-url`, {});
      if (result.read?.url) {
        readUrls.set(file.id, result.read.url);
      }
    }),
  );

  const primaryBank = provider.bankAccounts?.[0];
  const reviewChecklist = buildReviewChecklist(provider);
  const opsSummary = buildProviderOpsSummary(provider);
  const payoutOps = buildProviderPayoutOps(provider);
  const securitySummary = buildProviderSecuritySummary(provider);
  const levelPlan = buildProviderLevelPlan(provider);
  const resubmissionPlan = buildProviderResubmissionPlan(provider);
  const registrationDossier = buildProviderRegistrationDossier(provider);
  const providerServicePricing = buildProviderServicePricing(provider);
  const canApproveKyc = hasApprovedRequiredKycDocuments(provider);
  const payoutHold = activePayoutHold(provider);

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/providers">
              Back to partners
            </Link>
          </p>
          <h1>{provider.displayName || provider.user?.fullName || provider.user?.phone}</h1>
          <p className="muted">
            {provider.legalName ?? 'Legal name missing'} / {provider.user?.phone ?? 'No phone'} /{' '}
            {provider.city ?? 'No city'}
          </p>
        </div>
        <div className="actions">
          <form action={approveProvider}>
            <input type="hidden" name="providerId" value={provider.id} />
            <button type="submit">Approve partner</button>
          </form>
          <form action={rejectProvider}>
            <input type="hidden" name="providerId" value={provider.id} />
            <input
              name="reason"
              placeholder="Partner rejection reason"
              required
              minLength={12}
              maxLength={500}
            />
            <button type="submit">Reject partner</button>
          </form>
          <form action={syncSupabaseProviderRole}>
            <input type="hidden" name="providerId" value={provider.id} />
            <button type="submit" disabled={provider.verification?.status !== 'APPROVED'}>
              Sync Supabase role
            </button>
          </form>
          {provider.blockedAt ? (
            <form action={unblockProviderAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <button type="submit">Unblock account</button>
            </form>
          ) : (
            <form action={blockProviderAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input
                name="reason"
                placeholder="Account block reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit">Block account</button>
            </form>
          )}
        </div>
      </section>

      <div className="grid" style={{ marginBottom: 16 }}>
        <StatusCard label="Level" value={provider.level ?? 'LEVEL_1_SIGNUP'} />
        <StatusCard label="Partner status" value={provider.status} />
        <StatusCard label="KYC" value={provider.kyc?.status ?? 'DRAFT'} />
        <StatusCard label="Verification" value={provider.verification?.status ?? 'DRAFT'} />
        <StatusCard label="Account block" value={provider.blockedAt ? 'BLOCKED' : 'CLEAR'} />
        <StatusCard label="Payout hold" value={payoutHold ? 'ACTIVE' : 'CLEAR'} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner ops command center</h2>
            <p className="muted">
              One-page operating view for dispatch, payout, risk, and the next admin action.
            </p>
          </div>
          <span className={`pill ${opsSummary.ready ? 'pill-success' : 'pill-warn'}`}>
            {opsSummary.ready ? 'Operational' : 'Needs operator attention'}
          </span>
        </div>
        <div className="ops-task-grid">
          {opsSummary.cards.map((card) => (
            <div className={`ops-task-card ${cardClass(card.tone)}`} key={card.title}>
              <div>
                <span className={`pill ${pillClass(card.tone)}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout operations</h2>
            <p className="muted">
              Settlement view for unpaid earnings, withholding, payout batches, and payout holds.
            </p>
          </div>
          <span className={`pill ${pillClass(payoutOps.tone)}`}>{payoutOps.status}</span>
        </div>
        <div className="ops-task-grid">
          {payoutOps.cards.map((card) => (
            <div className={`ops-task-card ${cardClass(card.tone)}`} key={card.title}>
              <div>
                <span className={`pill ${pillClass(card.tone)}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
        {payoutOps.hold ? (
          <div className="setup-stage-item" style={{ marginTop: 16 }}>
            <span>HELD</span>
            <div>
              <strong>Active payout hold</strong>
              <p className="muted">{payoutOps.hold.reason}</p>
              <p className="muted">
                Started {formatDate(payoutOps.hold.startsAt)} / expires {formatDate(payoutOps.hold.expiresAt)}
              </p>
            </div>
            <Link className="text-link" href={`/provider-risk?q=${encodeURIComponent(provider.id)}`}>
              Risk desk
            </Link>
          </div>
        ) : null}
        {payoutOps.blockers.length ? (
          <div className="setup-stage-list">
            {payoutOps.blockers.map((blocker) => (
              <div className="setup-stage-item" key={blocker}>
                <span>GATE</span>
                <div>
                  <strong>Payout blocker</strong>
                  <p className="muted">{blocker}</p>
                </div>
                <small>Resolve</small>
              </div>
            ))}
          </div>
        ) : null}
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <div>
            <div className="risk-watch-header">
              <h3>Recent earnings</h3>
              <Link className="text-link" href="/earnings">
                Open earnings
              </Link>
            </div>
            {(provider.earnings ?? []).length ? (
              <div className="setup-stage-list">
                {provider.earnings?.slice(0, 5).map((earning) => (
                  <div className="setup-stage-item" key={earning.id}>
                    <span>{isCashFeeDebt(earning) ? 'CASH DEBT' : earning.status}</span>
                    <div>
                      <strong>
                        {isCashFeeDebt(earning)
                          ? `Owes HANDS ${formatCurrency(Math.abs(earning.netAmount))}`
                          : `Net ${formatCurrency(earning.netAmount)}`}
                      </strong>
                      <p className="muted">
                        Gross {formatCurrency(earning.grossAmount)} / platform fee{' '}
                        {formatCurrency(earning.platformFee)} / withholding{' '}
                        {formatCurrency(earning.withholdingAmount)}
                      </p>
                      <p className="muted">
                        {earning.bookingId ? `Booking ${shortRiskId(earning.bookingId)} / ` : ''}
                        payment {earning.booking?.payment?.method ?? 'UNKNOWN'} / created{' '}
                        {formatDate(earning.createdAt)}
                      </p>
                      {earning.settlementRef ? (
                        <p className="muted">Settlement ref {earning.settlementRef}</p>
                      ) : null}
                      {earning.settlementNotes ? <p className="muted">{earning.settlementNotes}</p> : null}
                      {(earning.walletLedgerEntries ?? []).slice(0, 2).map((entry) => (
                        <p className="muted" key={entry.id}>
                          Wallet {walletLedgerLabel(entry.type)}:{' '}
                          {formatCurrency(entry.amount, entry.currency ?? earning.currency ?? 'VND')}
                          {entry.reference ? ` / ref ${entry.reference}` : ''}
                        </p>
                      ))}
                    </div>
                    <small>
                      {earning.paidAt
                        ? `Settled ${formatDate(earning.paidAt)}`
                        : isCashFeeDebt(earning)
                          ? 'Blocks booking'
                          : 'Unpaid'}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                No earnings yet. Payout unlock starts after the first completed service.
              </p>
            )}
          </div>
          <div>
            <div className="risk-watch-header">
              <h3>Recent payout batches</h3>
              <Link className="text-link" href="/payouts">
                Open payouts
              </Link>
            </div>
            {(provider.payoutBatches ?? []).length ? (
              <div className="setup-stage-list">
                {provider.payoutBatches?.slice(0, 5).map((batch) => (
                  <div className="setup-stage-item" key={batch.id}>
                    <span>{batch.status}</span>
                    <div>
                      <strong>{formatCurrency(batch.totalNetAmount)}</strong>
                      <p className="muted">
                        Created {formatDate(batch.createdAt)}
                        {batch.transferRef ? ` / transfer ${batch.transferRef}` : ''}
                      </p>
                      {batch.paidAt ? <p className="muted">Paid {formatDate(batch.paidAt)}</p> : null}
                    </div>
                    <Link className="text-link" href={`/payouts#${batch.id}`}>
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No payout batch has been created for this partner yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Approval checklist</h2>
            <p className="muted">
              Review these gates before approving the partner or relying on this partner for dispatch.
            </p>
          </div>
          <span className={`pill ${reviewChecklist.ready ? 'pill-success' : 'pill-warn'}`}>
            {reviewChecklist.ready ? 'Ready for approval' : `${reviewChecklist.blockers} blocker(s)`}
          </span>
        </div>
        <div className="setup-stage-list">
          {reviewChecklist.items.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.status}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.ok ? 'OK' : 'Check'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner registration dossier</h2>
            <p className="muted">
              Structured view of the signup profile, public working profile, identity evidence, payout gate,
              legal consent, and operational safety. Use this as the first review map before approving or
              rejecting a partner.
            </p>
          </div>
          <span className={`pill ${registrationDossier.ready ? 'pill-success' : 'pill-warn'}`}>
            {registrationDossier.ready ? 'Dossier complete' : `${registrationDossier.blockers} gap(s)`}
          </span>
        </div>
        <div className="setup-stage-list">
          {registrationDossier.items.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.status}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
                <p className="muted">{item.operatorAction}</p>
              </div>
              <small>{item.ok ? 'OK' : 'Fix'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Device and session security</h2>
            <p className="muted">
              Watch for shared devices, suspicious sessions, blocked devices, and stale partner app activity.
            </p>
          </div>
          <span className={`pill ${securitySummary.risky ? 'pill-danger' : 'pill-success'}`}>
            {securitySummary.risky ? 'Risk review' : 'No active risk'}
          </span>
        </div>
        <div className="ops-task-grid">
          {securitySummary.cards.map((card) => (
            <div className={`ops-task-card ${cardClass(card.tone)}`} key={card.title}>
              <div>
                <span className={`pill ${pillClass(card.tone)}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <div>
            <h3>Partner app devices</h3>
            {(provider.devices ?? []).length ? (
              <div className="setup-stage-list">
                {provider.devices?.map((device) => (
                  <div className="setup-stage-item" key={device.id}>
                    <span>{device.blockedAt ? 'BLOCKED' : device.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    <div>
                      <strong>{maskDeviceId(device.deviceId)}</strong>
                      <p className="muted">
                        {device.platform ?? 'unknown platform'} / {device.appVersion ?? 'unknown app'} / last
                        seen {formatDate(device.lastSeenAt)}
                      </p>
                      {device.blockReason ? (
                        <p className="muted">Block reason: {device.blockReason}</p>
                      ) : null}
                    </div>
                    <small>{device.blockedAt ? formatDate(device.blockedAt) : 'Active'}</small>
                    <div className="actions">
                      {device.blockedAt || !device.enabled ? (
                        <form action={unblockProviderDevice}>
                          <input type="hidden" name="providerId" value={provider.id} />
                          <input type="hidden" name="providerDeviceId" value={device.id} />
                          <button type="submit">Unblock</button>
                        </form>
                      ) : (
                        <form action={blockProviderDevice}>
                          <input type="hidden" name="providerId" value={provider.id} />
                          <input type="hidden" name="providerDeviceId" value={device.id} />
                          <input
                            name="reason"
                            placeholder="Device block reason"
                            required
                            minLength={12}
                            maxLength={500}
                          />
                          <button type="submit">Block</button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                No partner app device record yet. It should appear after partner app sign-in.
              </p>
            )}
          </div>
          <div>
            <h3>Recent sessions</h3>
            {(provider.sessions ?? []).length ? (
              <div className="setup-stage-list">
                {provider.sessions?.slice(0, 6).map((session) => (
                  <div className="setup-stage-item" key={session.id}>
                    <span>{session.suspicious ? 'WATCH' : 'OK'}</span>
                    <div>
                      <strong>{maskDeviceId(session.deviceId)}</strong>
                      <p className="muted">
                        IP {session.ipAddress ?? 'missing'} / {session.appVersion ?? 'unknown app'} / last
                        seen {formatDate(session.lastSeenAt)}
                      </p>
                      {session.suspiciousReason ? (
                        <p className="muted">Reason: {session.suspiciousReason}</p>
                      ) : null}
                    </div>
                    <small>{formatDate(session.loggedInAt)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No partner session log yet.</p>
            )}
          </div>
        </div>
        {(provider.sharedDeviceMatches ?? []).length ? (
          <div className="setup-stage-list" style={{ marginTop: 16 }}>
            {provider.sharedDeviceMatches?.map((match) => (
              <div className="setup-stage-item" key={match.id}>
                <span>SHARED</span>
                <div>
                  <strong>{maskDeviceId(match.deviceId)}</strong>
                  <p className="muted">
                    Also used by {match.providerProfile?.displayName ?? 'another partner'} (
                    {match.providerProfile?.user?.phone ?? 'no phone'}) / last seen{' '}
                    {formatDate(match.lastSeenAt)}
                  </p>
                </div>
                <small>{match.enabled ? 'Enabled' : 'Disabled'}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Risk reports and sanctions</h2>
            <p className="muted">
              Keep customer complaints, staff findings, payout holds, and account blocks visible on the
              partner profile.
            </p>
          </div>
          <Link className="text-link" href={`/provider-risk?q=${encodeURIComponent(provider.id)}`}>
            Open risk desk
          </Link>
        </div>
        <form className="form-grid" action={createProviderReport} style={{ marginBottom: 16 }}>
          <input type="hidden" name="providerProfileId" value={provider.id} />
          <label>
            Category
            <input name="category" placeholder="safety, payout, behavior, identity" required />
          </label>
          <label>
            Severity
            <select name="severity" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label>
            Source
            <select name="source" defaultValue="ADMIN">
              <option value="ADMIN">Admin</option>
              <option value="CUSTOMER">Customer</option>
              <option value="PROVIDER">Partner</option>
              <option value="SYSTEM">System</option>
            </select>
          </label>
          <label className="full-span">
            Summary
            <input name="summary" placeholder="Short risk report summary" required />
          </label>
          <label className="full-span">
            Details
            <textarea name="details" placeholder="Evidence, timeline, follow-up, or staff note" />
          </label>
          <div className="actions full-span">
            <button type="submit">Create report</button>
          </div>
        </form>
        <div className="ops-task-card ops-task-pending" style={{ marginBottom: 16 }}>
          <div className="risk-watch-header">
            <div>
              <h3>Manual sanction</h3>
              <p className="muted">
                Use this for immediate operating controls when a report is not yet required.
              </p>
            </div>
            <span className={`pill ${payoutHold ? 'pill-danger' : 'pill-success'}`}>
              {payoutHold ? 'Payout locked' : 'No payout hold'}
            </span>
          </div>
          {payoutHold ? (
            <div className="setup-stage-item" style={{ marginBottom: 12 }}>
              <span>ACTIVE</span>
              <div>
                <strong>{payoutHold.type}</strong>
                <p className="muted">{payoutHold.reason}</p>
                <p className="muted">
                  Started {formatDate(payoutHold.startsAt)} / expires {formatDate(payoutHold.expiresAt)}
                </p>
              </div>
              <small>{shortRiskId(payoutHold.id)}</small>
            </div>
          ) : null}
          <form className="form-grid" action={createProviderSanction}>
            <input type="hidden" name="providerProfileId" value={provider.id} />
            <label>
              Sanction type
              <select name="type" defaultValue="PAYOUT_HOLD">
                <option value="WARNING">Warning</option>
                <option value="PAYOUT_HOLD">Payout hold</option>
                <option value="ACCOUNT_BLOCK">Account block</option>
                <option value="TRUST_BADGE_REMOVAL">Trust badge removal</option>
              </select>
            </label>
            <label>
              Expires at
              <input name="expiresAt" type="datetime-local" />
            </label>
            <label className="full-span">
              Reason
              <input
                name="reason"
                placeholder="Clear operator reason, visible in audit and payout controls"
                required
                minLength={12}
                maxLength={500}
              />
            </label>
            <div className="actions full-span">
              <button type="submit">Apply manual sanction</button>
              <Link className="text-link" href="/payouts">
                Open payouts
              </Link>
            </div>
          </form>
        </div>
        <div className="detail-grid">
          <div>
            <h3>Recent reports</h3>
            {(provider.reports ?? []).length ? (
              <div className="setup-stage-list">
                {provider.reports?.map((report) => (
                  <div className="setup-stage-item" key={report.id}>
                    <span>{report.status}</span>
                    <div>
                      <strong>{report.summary}</strong>
                      <p className="muted">
                        {report.category} / {report.source} / {formatDate(report.createdAt)}
                      </p>
                      <div className="participant-list" style={{ marginTop: 6 }}>
                        <span className={`pill ${riskSeverityPill(report.severity)}`}>{report.severity}</span>
                        <span className={`pill ${riskStatusPill(report.status)}`}>{report.status}</span>
                        {report.bookingId ? (
                          <Link className="text-link" href={`/bookings/${report.bookingId}`}>
                            Booking {shortRiskId(report.bookingId)}
                          </Link>
                        ) : null}
                      </div>
                      {report.details ? <p className="muted">{report.details}</p> : null}
                      {report.resolutionNote ? (
                        <p className="muted">Resolution: {report.resolutionNote}</p>
                      ) : null}
                      <form className="actions" action={updateProviderReport} style={{ marginTop: 8 }}>
                        <input type="hidden" name="reportId" value={report.id} />
                        <input type="hidden" name="providerProfileId" value={provider.id} />
                        <select name="status" defaultValue={report.status}>
                          <option value="OPEN">Open</option>
                          <option value="INVESTIGATING">Investigating</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="DISMISSED">Dismissed</option>
                        </select>
                        <select name="severity" defaultValue={report.severity}>
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                        <input name="resolutionNote" placeholder="Resolution note" />
                        <button type="submit">Update</button>
                      </form>
                      <form className="actions" action={createProviderSanction} style={{ marginTop: 8 }}>
                        <input type="hidden" name="providerProfileId" value={provider.id} />
                        <input type="hidden" name="reportId" value={report.id} />
                        <select
                          name="type"
                          defaultValue={report.severity === 'CRITICAL' ? 'ACCOUNT_BLOCK' : 'WARNING'}
                        >
                          <option value="WARNING">Warning</option>
                          <option value="PAYOUT_HOLD">Payout hold</option>
                          <option value="ACCOUNT_BLOCK">Account block</option>
                          <option value="TRUST_BADGE_REMOVAL">Trust badge removal</option>
                        </select>
                        <input
                          name="reason"
                          placeholder="Sanction reason"
                          required
                          minLength={12}
                          maxLength={500}
                        />
                        <button type="submit">Apply sanction</button>
                      </form>
                    </div>
                    <small>{shortRiskId(report.id)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No partner reports recorded yet.</p>
            )}
          </div>
          <div>
            <h3>Recent sanctions</h3>
            {(provider.sanctions ?? []).length ? (
              <div className="setup-stage-list">
                {provider.sanctions?.map((sanction) => (
                  <div className="setup-stage-item" key={sanction.id}>
                    <span>{sanction.status}</span>
                    <div>
                      <strong>{sanction.type}</strong>
                      <p className="muted">{sanction.reason}</p>
                      <p className="muted">
                        Started {formatDate(sanction.startsAt)} / expires {formatDate(sanction.expiresAt)}
                      </p>
                      {sanction.report ? (
                        <p className="muted">
                          Report: {sanction.report.category} / {sanction.report.severity}
                        </p>
                      ) : null}
                      {sanction.status === 'ACTIVE' ? (
                        <form action={liftProviderSanction} style={{ marginTop: 8 }}>
                          <input type="hidden" name="providerProfileId" value={provider.id} />
                          <input type="hidden" name="sanctionId" value={sanction.id} />
                          <button type="submit">Lift sanction</button>
                        </form>
                      ) : null}
                    </div>
                    <small>{shortRiskId(sanction.id)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No active or historical sanction recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner level path</h2>
            <p className="muted">
              Operator view of Level 1 signup, Level 2 activity, Level 3 payout, and Level 4 trust badge
              gates.
            </p>
          </div>
          <span className="pill pill-info">{levelPlan.currentLevel}</span>
        </div>
        <div className="setup-stage-list">
          {levelPlan.items.map((item) => (
            <div className="setup-stage-item" key={item.level}>
              <span>{item.status}</span>
              <div>
                <strong>{item.level}</strong>
                <p className="muted">{item.detail}</p>
                <p className="muted">{item.operatorAction}</p>
              </div>
              <small>{item.ready ? 'Clear' : item.blocked ? 'Blocked' : 'Next'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Resubmission guidance</h2>
            <p className="muted">
              Use this when a partner asks what to fix after rejection. Keep the message specific and
              auditable.
            </p>
          </div>
          <span className={`pill ${resubmissionPlan.items.length ? 'pill-danger' : 'pill-success'}`}>
            {resubmissionPlan.items.length} item(s)
          </span>
        </div>
        <div className="setup-stage-list">
          {resubmissionPlan.items.length ? (
            resubmissionPlan.items.map((item) => (
              <div className="setup-stage-item" key={item.target}>
                <span>{item.status}</span>
                <div>
                  <strong>{item.target}</strong>
                  <p className="muted">{item.reason}</p>
                  <p className="muted">{item.providerInstruction}</p>
                </div>
                <small>{item.operatorAction}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>CLEAR</span>
              <div>
                <strong>No resubmission request needed</strong>
                <p className="muted">
                  There are no rejected partner documents, bank accounts, KYC, or tax profiles.
                </p>
              </div>
              <small>OK</small>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Review history</h2>
            <p className="muted">
              Partner, KYC, document, bank, and tax review decisions are shown here for handoff and audit.
            </p>
          </div>
          <span className="pill pill-info">{provider.verificationLogs?.length ?? 0} recent event(s)</span>
        </div>
        {(provider.verificationLogs ?? []).length ? (
          <div className="setup-stage-list">
            {provider.verificationLogs?.slice(0, 8).map((log) => {
              const preview = metadataPreview(log.metadata);
              return (
                <div className="setup-stage-item" key={log.id}>
                  <span>{humanizeProviderLogAction(log.action)}</span>
                  <div>
                    <strong>{statusTransition(log)}</strong>
                    <p className="muted">
                      {formatDate(log.createdAt)} / {log.actor?.fullName ?? log.actor?.phone ?? 'System'}
                    </p>
                    {preview ? <p className="muted">{preview}</p> : null}
                  </div>
                  <small>{log.action}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            No partner review logs yet. New approval, rejection, and resubmission actions will appear here.
          </p>
        )}
      </div>

      <section className="detail-grid">
        <div className="card">
          <h2>Basic profile</h2>
          <InfoLine label="Display name" value={provider.displayName} />
          <InfoLine label="Legal name" value={provider.legalName} />
          <InfoLine label="Activity nickname" value={provider.activityNickname} />
          <InfoLine
            label="Experience"
            value={
              provider.experienceYears === null || provider.experienceYears === undefined
                ? null
                : `${provider.experienceYears} year(s)`
            }
          />
          <InfoLine label="Specialties" value={formatJsonList(provider.specialties)} />
          <InfoLine label="Languages" value={formatJsonList(provider.languages)} />
          <InfoLine label="Service style" value={provider.serviceStyle} />
          <InfoLine label="Date of birth" value={formatDateOnly(provider.dateOfBirth)} />
          <InfoLine label="Gender" value={provider.gender} />
          <InfoLine label="Phone" value={provider.user?.phone} />
          <InfoLine label="Facebook" value={provider.facebookId} />
          <InfoLine label="Address" value={provider.residentialAddress} />
          <InfoLine label="Service city" value={provider.city} />
          <InfoLine label="Service area" value={formatJsonSummary(provider.serviceArea)} />
          <InfoLine label="Rating" value={formatRating(provider)} />
          <InfoLine label="Next available" value={formatDate(provider.nextAvailableAt)} />
          <InfoLine label="Trusted at" value={formatDate(provider.trustedAt)} />
          <InfoLine label="User name" value={provider.user?.fullName} />
          <InfoLine label="Supabase user" value={provider.user?.supabaseUserId} />
          <p className="muted">
            {provider.verification?.rejectionReason ?? provider.bio ?? 'No notes saved.'}
          </p>
        </div>

        <div className="card">
          <h2>KYC decision</h2>
          <p className="muted">
            CCCD last 4: {provider.kyc?.cccdNumberLast4 ? `****${provider.kyc.cccdNumberLast4}` : 'Missing'}
          </p>
          <p className="muted">Submitted: {formatDate(provider.kyc?.submittedAt)}</p>
          <p className="muted">Reviewed: {formatDate(provider.kyc?.reviewedAt)}</p>
          {provider.kyc?.rejectionReason ? (
            <p className="muted">Rejection reason: {provider.kyc.rejectionReason}</p>
          ) : null}
          <div className="actions" style={{ marginTop: 12 }}>
            <form action={approveProviderKyc}>
              <input type="hidden" name="providerId" value={provider.id} />
              <button type="submit" disabled={provider.kyc?.status === 'APPROVED' || !canApproveKyc}>
                Approve KYC
              </button>
            </form>
            <form action={rejectProviderKyc}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input
                name="reason"
                placeholder="KYC rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={!provider.kyc || provider.kyc.status === 'REJECTED'}>
                Reject KYC
              </button>
            </form>
          </div>
          {!canApproveKyc ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Approve the required CCCD front, CCCD back, and selfie documents before approving KYC.
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2>Service price readiness</h2>
          <p className="muted">
            Customer apps only show options with an active partner service and an exact active payout rule.
          </p>
          <InfoLine
            label="Bookable options"
            value={`${providerServicePricing.readyCount}/${providerServicePricing.rows.length}`}
          />
          {providerServicePricing.rows.length ? (
            <div className="provider-file-list">
              {providerServicePricing.rows.map((row) => (
                <div className="provider-file-row" key={row.id}>
                  <div className="participant-list" style={{ marginBottom: 6 }}>
                    <span className={`pill ${row.bookable ? 'pill-success' : 'pill-warn'}`}>
                      {row.bookable ? 'CUSTOMER VISIBLE' : 'HIDDEN'}
                    </span>
                    <span className="pill pill-info">
                      {row.durationMin ? `${row.durationMin} min` : 'No duration'}
                    </span>
                    <span className="pill pill-info">{row.payoutRuleCount} payout rule(s)</span>
                  </div>
                  <p>
                    <strong>{row.name}</strong>
                  </p>
                  <p className="muted">
                    Customer {formatCurrency(row.customerPrice)} / admin minimum{' '}
                    {formatCurrency(row.basePrice)}
                    {row.providerPayoutAmount !== null
                      ? ` / partner payout ${formatCurrency(row.providerPayoutAmount)}`
                      : ''}
                  </p>
                  <p className="muted">{row.issue}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No partner service prices are connected yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Typed documents</h2>
          {(provider.documents ?? []).length ? (
            provider.documents?.map((document) => (
              <div className="provider-file-row" key={document.id}>
                <div className="participant-list" style={{ marginBottom: 6 }}>
                  <span className="pill pill-info">{providerDocumentLabel(document.type)}</span>
                  <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                    {document.status}
                  </span>
                </div>
                <p className="muted">{providerDocumentReviewHint(document.type)}</p>
                <p className="muted">
                  {document.fileAsset?.contentType ?? 'Unknown type'}
                  {document.fileAsset?.uploadedAt ? ` / ${formatDate(document.fileAsset.uploadedAt)}` : ''}
                </p>
                {document.rejectionReason ? (
                  <p className="muted">Rejection reason: {document.rejectionReason}</p>
                ) : null}
                <p className="muted">
                  {document.fileAsset?.id && readUrls.get(document.fileAsset.id) ? (
                    <a
                      className="text-link"
                      href={readUrls.get(document.fileAsset.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open private file
                    </a>
                  ) : (
                    (document.fileAsset?.key ?? 'No file key')
                  )}
                </p>
                <div className="actions">
                  <form action={approveProviderDocument}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <button type="submit" disabled={document.status === 'APPROVED'}>
                      Approve doc
                    </button>
                  </form>
                  <form action={rejectProviderDocument}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <input type="hidden" name="documentId" value={document.id} />
                    <input
                      name="reason"
                      placeholder="Document rejection reason"
                      required
                      minLength={12}
                      maxLength={500}
                    />
                    <button type="submit" disabled={document.status === 'REJECTED'}>
                      Reject doc
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No typed onboarding documents yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Public profile media</h2>
          {(provider.user?.fileAssets ?? []).length ? (
            provider.user?.fileAssets?.map((file) => (
              <div className="provider-file-row" key={file.id}>
                <div className="participant-list" style={{ marginBottom: 6 }}>
                  <span className="pill pill-info">{providerPublicMediaLabel(file.purpose)}</span>
                  <span className="pill pill-success">{file.uploadStatus ?? 'UPLOADED'}</span>
                  <span
                    className={`pill ${file.reviewStatus === 'APPROVED' ? 'pill-success' : file.reviewStatus === 'REJECTED' ? 'pill-danger' : 'pill-warn'}`}
                  >
                    {file.reviewStatus ?? 'PENDING_REVIEW'}
                  </span>
                </div>
                <p className="muted">
                  {file.contentType}
                  {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
                  {file.uploadedAt ? ` / uploaded ${formatDate(file.uploadedAt)}` : ''}
                </p>
                {file.reviewedAt ? <p className="muted">Reviewed {formatDate(file.reviewedAt)}</p> : null}
                {file.reviewReason ? <p className="muted">Review reason: {file.reviewReason}</p> : null}
                <p className="muted">
                  {file.url ? (
                    <a className="text-link" href={file.url} target="_blank" rel="noreferrer">
                      {file.key}
                    </a>
                  ) : (
                    file.key
                  )}
                </p>
                <div className="actions">
                  <form action={approvePublicProviderMedia}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <input type="hidden" name="fileId" value={file.id} />
                    <button type="submit" disabled={file.reviewStatus === 'APPROVED'}>
                      Approve public media
                    </button>
                  </form>
                  <form action={rejectPublicProviderMedia}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <input type="hidden" name="fileId" value={file.id} />
                    <input
                      name="reason"
                      placeholder="Media rejection reason"
                      required
                      minLength={12}
                      maxLength={500}
                    />
                    <button type="submit" disabled={file.reviewStatus === 'REJECTED'}>
                      Reject media
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No public profile image or work photos uploaded yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Bank and payout gate</h2>
          {primaryBank ? (
            <>
              <InfoLine label="Bank" value={primaryBank.bankName} />
              <InfoLine
                label="Account"
                value={primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4}
              />
              <InfoLine label="Holder" value={primaryBank.accountHolderName} />
              <InfoLine label="Status" value={primaryBank.status} />
              <InfoLine label="Rejection reason" value={primaryBank.rejectionReason} />
              <div className="actions" style={{ marginTop: 12 }}>
                <form action={approveProviderBankAccount}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="bankAccountId" value={primaryBank.id} />
                  <button type="submit" disabled={primaryBank.status === 'APPROVED'}>
                    Approve bank
                  </button>
                </form>
                <form action={rejectProviderBankAccount}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="bankAccountId" value={primaryBank.id} />
                  <input
                    name="reason"
                    placeholder="Bank rejection reason"
                    required
                    minLength={12}
                    maxLength={500}
                  />
                  <button type="submit" disabled={primaryBank.status === 'REJECTED'}>
                    Reject bank
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p className="muted">No bank account submitted.</p>
          )}
        </div>

        <div className="card">
          <h2>Tax profile</h2>
          {provider.taxProfile ? (
            <>
              <InfoLine label="Status" value={provider.taxProfile.status} />
              <InfoLine label="Legal name" value={provider.taxProfile.legalName} />
              <InfoLine label="Tax code" value={`****${provider.taxProfile.taxCodeLast4 ?? '----'}`} />
              <InfoLine label="Registered address" value={provider.taxProfile.registeredAddress} />
              <InfoLine label="Rejection reason" value={provider.taxProfile.rejectionReason} />
              <div className="actions" style={{ marginTop: 12 }}>
                <form action={approveProviderTaxProfile}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <button type="submit" disabled={provider.taxProfile.status === 'APPROVED'}>
                    Approve tax
                  </button>
                </form>
                <form action={rejectProviderTaxProfile}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input
                    name="reason"
                    placeholder="Tax rejection reason"
                    required
                    minLength={12}
                    maxLength={500}
                  />
                  <button type="submit" disabled={provider.taxProfile.status === 'REJECTED'}>
                    Reject tax
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p className="muted">
              Tax profile is not required until payout unlock, and has not been submitted.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Location and activity</h2>
          <InfoLine
            label="Last location"
            value={provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : null}
          />
          <InfoLine
            label="Coordinates"
            value={
              provider.currentLat && provider.currentLng
                ? `${Number(provider.currentLat).toFixed(5)}, ${Number(provider.currentLng).toFixed(5)}`
                : null
            }
          />
          <div className="participant-list">
            {(provider.locationSnapshots ?? []).slice(0, 5).map((snapshot) => (
              <span className="pill pill-neutral" key={snapshot.id}>
                {formatDate(snapshot.recordedAt)}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Agreements</h2>
          {(provider.agreements ?? []).length ? (
            <div className="participant-list">
              {provider.agreements?.map((agreement) => (
                <span className="pill pill-success" key={agreement.id}>
                  {agreement.type} v{agreement.version}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No legal agreements accepted yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Recent payout signals</h2>
          <InfoLine label="Recent earnings" value={(provider.earnings?.length ?? 0).toString()} />
          <InfoLine label="Recent payout batches" value={(provider.payoutBatches?.length ?? 0).toString()} />
          {(provider.earnings ?? []).slice(0, 3).map((earning) => (
            <p className="muted" key={earning.id}>
              {earning.status}: gross {formatCurrency(earning.grossAmount)} / withholding{' '}
              {formatCurrency(earning.withholdingAmount)} / net {formatCurrency(earning.netAmount)}
              {earning.settlementRef ? ` / ref ${earning.settlementRef}` : ''}
            </p>
          ))}
        </div>
      </section>
    </>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? value : 'Missing'}
    </p>
  );
}

type ProviderServicePricingRow = {
  id: string;
  name: string;
  durationMin?: number | null;
  basePrice: number;
  customerPrice: number;
  providerPayoutAmount: number | null;
  payoutRuleCount: number;
  bookable: boolean;
  issue: string;
};

function buildProviderServicePricing(provider: ProviderDetail): {
  readyCount: number;
  rows: ProviderServicePricingRow[];
} {
  const rows = (provider.services ?? []).map((connection, index) => {
    const service = connection.service;
    const basePrice = amountValue(service?.basePrice);
    const customerPrice = amountValue(connection.price) || basePrice;
    const payoutRules = service?.payoutRules ?? [];
    const matchingRule = payoutRules.find((rule) => amountValue(rule.customerPrice) === customerPrice);
    const active = connection.active !== false && service?.active !== false;
    const bookable = active && Boolean(matchingRule);
    const issue = !active
      ? 'Partner or service option is inactive.'
      : matchingRule
        ? 'Ready for customer booking. Partner price has an exact payout rule.'
        : 'Hidden from customer app until admin creates a payout rule for this exact customer price.';

    return {
      id: connection.id ?? `${service?.id ?? 'service'}-${index}`,
      name: service?.name ?? 'Service',
      durationMin: service?.durationMin,
      basePrice,
      customerPrice,
      providerPayoutAmount: matchingRule ? amountValue(matchingRule.providerPayoutAmount) : null,
      payoutRuleCount: payoutRules.length,
      bookable,
      issue,
    };
  });

  return {
    readyCount: rows.filter((row) => row.bookable).length,
    rows,
  };
}

type ProviderOpsCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  tone: 'done' | 'pending' | 'blocked';
};

function buildProviderOpsSummary(provider: ProviderDetail) {
  const primaryBank = provider.bankAccounts?.[0];
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const hasRecentLocation = locationMinutes <= 30;
  const hasEnabledPush = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const requiredDocumentsReady = hasApprovedRequiredKycDocuments(provider);
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const payoutAgreementsReady = agreementsAccepted >= 5;
  const nextAction = nextProviderAction(provider);
  const payoutHold = activePayoutHold(provider);
  const payoutReady =
    hasFirstRevenue &&
    primaryBank?.status === 'APPROVED' &&
    provider.taxProfile?.status === 'APPROVED' &&
    Boolean(provider.residentialAddress?.trim()) &&
    payoutAgreementsReady &&
    !payoutHold;
  const accountClear = !provider.blockedAt;

  const cards: ProviderOpsCard[] = [
    {
      title: 'Dispatch readiness',
      status:
        accountClear &&
        provider.verification?.status === 'APPROVED' &&
        provider.status === 'ONLINE_AVAILABLE' &&
        hasRecentLocation &&
        hasEnabledPush
          ? 'READY'
          : 'CHECK',
      detail: !accountClear
        ? `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`
        : provider.verification?.status !== 'APPROVED'
          ? 'Partner verification is not approved yet.'
          : provider.status !== 'ONLINE_AVAILABLE'
            ? 'Partner is approved but not online for direct booking or backup matching.'
            : !hasRecentLocation
              ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}.`
              : !hasEnabledPush
                ? 'No enabled push device is registered for request alerts.'
                : 'Partner can receive customer direct requests and backup matching alerts.',
      action: !accountClear
        ? 'Unblock only after the account-level issue is resolved.'
        : provider.verification?.status !== 'APPROVED'
          ? 'Finish verification review first.'
          : provider.status !== 'ONLINE_AVAILABLE'
            ? 'Ask partner to open the app and go online.'
            : !hasRecentLocation
              ? 'Ask partner to refresh location.'
              : !hasEnabledPush
                ? 'Ask partner to reopen the app and register alerts.'
                : 'No dispatch blocker.',
      tone: !accountClear
        ? 'blocked'
        : provider.verification?.status === 'APPROVED' &&
            provider.status === 'ONLINE_AVAILABLE' &&
            hasRecentLocation &&
            hasEnabledPush
          ? 'done'
          : provider.verification?.status !== 'APPROVED'
            ? 'blocked'
            : 'pending',
    },
    {
      title: 'Identity and documents',
      status: provider.kyc?.status === 'APPROVED' && requiredDocumentsReady ? 'APPROVED' : 'REVIEW',
      detail:
        provider.kyc?.status === 'APPROVED' && requiredDocumentsReady
          ? 'KYC and required CCCD/selfie documents are approved.'
          : requiredDocumentsReady
            ? `Required documents are approved, KYC status is ${provider.kyc?.status ?? 'DRAFT'}.`
            : `Missing or unapproved documents: ${missingApprovedRequiredKycDocuments(provider)
                .map(providerDocumentLabel)
                .join(', ')}.`,
      action:
        provider.kyc?.status === 'APPROVED' && requiredDocumentsReady
          ? 'Identity gate is clear.'
          : requiredDocumentsReady
            ? 'Approve or reject KYC below.'
            : 'Review each typed document below.',
      tone: provider.kyc?.status === 'APPROVED' && requiredDocumentsReady ? 'done' : 'blocked',
    },
    {
      title: 'Payout readiness',
      status: payoutHold ? 'HELD' : payoutReady ? 'UNLOCKED' : hasFirstRevenue ? 'BLOCKED' : 'DEFERRED',
      detail: payoutHold
        ? `Active payout hold: ${payoutHold.reason}`
        : payoutReady
          ? 'Partner has completed service, approved bank, approved tax profile, address, and agreements.'
          : hasFirstRevenue
            ? payoutBlockers(provider).join(' ')
            : 'Tax profile, tax address, and full payout gate stay deferred until first earning.',
      action: payoutHold
        ? 'Lift the sanction only after finance/risk follow-up is resolved.'
        : payoutReady
          ? 'Partner can request payout when earnings are available.'
          : hasFirstRevenue
            ? 'Clear payout blockers before approving withdrawal.'
            : 'No action until first earning.',
      tone: payoutReady ? 'done' : hasFirstRevenue || payoutHold ? 'blocked' : 'pending',
    },
    {
      title: 'Next admin action',
      status: nextAction.status,
      detail: nextAction.detail,
      action: nextAction.action,
      tone: nextAction.tone,
    },
  ];

  return {
    cards,
    ready: cards.every((card) => card.tone === 'done' || card.status === 'DEFERRED'),
  };
}

function buildProviderPayoutOps(provider: ProviderDetail) {
  const primaryBank = provider.bankAccounts?.[0];
  const earnings = provider.earnings ?? [];
  const payoutBatches = provider.payoutBatches ?? [];
  const payoutHold = activePayoutHold(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const hasAddress = Boolean(provider.residentialAddress?.trim());
  const bankApproved = primaryBank?.status === 'APPROVED';
  const taxApproved = provider.taxProfile?.status === 'APPROVED';
  const agreementsReady = agreementsAccepted >= 5;
  const payoutReady =
    hasFirstRevenue && bankApproved && taxApproved && hasAddress && agreementsReady && !payoutHold;
  const blockers = hasFirstRevenue ? payoutBlockers(provider) : [];
  const unpaidEarnings = earnings.filter(
    (earning) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(earning.status),
  );
  const unpaidNetAmount = unpaidEarnings.reduce((sum, earning) => sum + amountValue(earning.netAmount), 0);
  const withholdingAmount = earnings.reduce(
    (sum, earning) => sum + amountValue(earning.withholdingAmount),
    0,
  );
  const latestBatch = payoutBatches[0];

  const status = payoutHold ? 'HELD' : payoutReady ? 'UNLOCKED' : hasFirstRevenue ? 'BLOCKED' : 'DEFERRED';
  const tone: ProviderOpsCard['tone'] = payoutReady
    ? 'done'
    : payoutHold || hasFirstRevenue
      ? 'blocked'
      : 'pending';

  const cards: ProviderOpsCard[] = [
    {
      title: 'Unpaid net',
      status: unpaidEarnings.length ? `${unpaidEarnings.length} ITEM(S)` : '0 ITEM',
      detail: formatCurrency(unpaidNetAmount),
      action: unpaidEarnings.length
        ? 'Eligible only after all payout gates are clear.'
        : 'No unpaid earning signal.',
      tone: unpaidEarnings.length ? (payoutReady ? 'done' : 'pending') : 'pending',
    },
    {
      title: 'Withholding',
      status: earnings.length ? 'TRACKED' : 'NONE',
      detail: formatCurrency(withholdingAmount),
      action: earnings.length ? 'Tax is calculated from active policy rules.' : 'No first earning yet.',
      tone: earnings.length ? 'done' : 'pending',
    },
    {
      title: 'Payout batches',
      status: payoutBatches.length ? `${payoutBatches.length} RECENT` : 'NONE',
      detail: latestBatch
        ? `${latestBatch.status} / ${formatCurrency(latestBatch.totalNetAmount)}`
        : 'No batch created yet.',
      action: latestBatch?.paidAt
        ? `Last paid ${formatDate(latestBatch.paidAt)}.`
        : 'Open payouts to create or process batch.',
      tone: latestBatch?.status === 'PAID' ? 'done' : payoutBatches.length ? 'pending' : 'pending',
    },
    {
      title: 'Payout gate',
      status,
      detail: payoutHold
        ? `Active hold: ${payoutHold.reason}`
        : payoutReady
          ? 'Bank, tax, address, agreements, and first service are complete.'
          : hasFirstRevenue
            ? blockers.join(' ')
            : 'Deferred until first earning.',
      action: payoutHold
        ? 'Resolve the risk/finance reason before lifting the hold.'
        : payoutReady
          ? 'Partner may be paid when an eligible batch exists.'
          : hasFirstRevenue
            ? 'Clear blockers before payment.'
            : 'No payout request should be approved yet.',
      tone,
    },
  ];

  return {
    blockers,
    cards,
    hold: payoutHold,
    status,
    tone,
  };
}

function buildProviderSecuritySummary(provider: ProviderDetail) {
  const sessions = provider.sessions ?? [];
  const devices = provider.devices ?? [];
  const sharedDeviceMatches = provider.sharedDeviceMatches ?? [];
  const suspiciousSessions = sessions.filter((session) => session.suspicious);
  const blockedDevices = devices.filter((device) => device.blockedAt || !device.enabled);
  const mostRecentSession = sessions[0];
  const mostRecentDevice = devices[0];
  const lastSeenMinutes = Math.min(
    locationAgeMinutes(mostRecentSession?.lastSeenAt),
    locationAgeMinutes(mostRecentDevice?.lastSeenAt),
  );
  const staleAppActivity = lastSeenMinutes > 24 * 60;

  const cards: ProviderOpsCard[] = [
    {
      title: 'Account block',
      status: provider.blockedAt ? 'BLOCKED' : 'CLEAR',
      detail: provider.blockedAt
        ? `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`
        : 'Partner account is not blocked.',
      action: provider.blockedAt
        ? 'Unblock only after identity, safety, payout, or policy issue is resolved.'
        : 'No account block action.',
      tone: provider.blockedAt ? 'blocked' : 'done',
    },
    {
      title: 'Partner app activity',
      status: devices.length || sessions.length ? (staleAppActivity ? 'STALE' : 'RECENT') : 'MISSING',
      detail:
        devices.length || sessions.length
          ? `Latest partner app signal is ${Number.isFinite(lastSeenMinutes) ? `${lastSeenMinutes}m old` : 'missing'}.`
          : 'No partner app device or session has been recorded yet.',
      action:
        devices.length || sessions.length
          ? staleAppActivity
            ? 'Ask partner to open the app before dispatching work.'
            : 'Partner app activity is visible.'
          : 'Partner should sign in on the real app once onboarding starts.',
      tone: devices.length || sessions.length ? (staleAppActivity ? 'pending' : 'done') : 'pending',
    },
    {
      title: 'Blocked devices',
      status: blockedDevices.length ? `${blockedDevices.length} BLOCKED` : 'CLEAR',
      detail: blockedDevices.length
        ? 'One or more partner devices are disabled or blocked from use.'
        : 'No partner app device is currently blocked.',
      action: blockedDevices.length ? 'Review whether the device can be safely unblocked.' : 'No action.',
      tone: blockedDevices.length ? 'blocked' : 'done',
    },
    {
      title: 'Suspicious sessions',
      status: suspiciousSessions.length ? `${suspiciousSessions.length} WATCH` : 'CLEAR',
      detail: suspiciousSessions.length
        ? suspiciousSessions.map((session) => session.suspiciousReason ?? 'Suspicious login').join(' ')
        : 'No suspicious session flag is currently recorded.',
      action: suspiciousSessions.length
        ? 'Confirm identity and review recent app/device activity.'
        : 'No action.',
      tone: suspiciousSessions.length ? 'blocked' : 'done',
    },
    {
      title: 'Shared device signal',
      status: sharedDeviceMatches.length ? `${sharedDeviceMatches.length} MATCH` : 'CLEAR',
      detail: sharedDeviceMatches.length
        ? 'The same device identifier appears on another partner profile.'
        : 'No cross-partner device match is visible.',
      action: sharedDeviceMatches.length
        ? 'Check for multi-account behavior before approval or payout.'
        : 'No action.',
      tone: sharedDeviceMatches.length ? 'blocked' : 'done',
    },
  ];

  return {
    cards,
    risky: cards.some((card) => card.tone === 'blocked'),
  };
}

type ProviderLevelPathItem = {
  level: string;
  status: string;
  detail: string;
  operatorAction: string;
  ready: boolean;
  blocked: boolean;
};

function buildProviderLevelPlan(provider: ProviderDetail) {
  const primaryBank = provider.bankAccounts?.[0];
  const hasBasicProfile = Boolean(
    provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim(),
  );
  const requiredDocumentsReady = hasApprovedRequiredKycDocuments(provider);
  const kycReady = provider.kyc?.status === 'APPROVED' && requiredDocumentsReady;
  const bankReady = primaryBank?.status === 'APPROVED';
  const hasCompletedService = (provider.earnings ?? []).length > 0;
  const taxReady = provider.taxProfile?.status === 'APPROVED';
  const agreementCount = provider.agreements?.length ?? 0;
  const payoutAgreementsReady = agreementCount >= 5;
  const hasAddress = Boolean(provider.residentialAddress?.trim());
  const verificationReady = provider.verification?.status === 'APPROVED';
  const trustedReady = provider.level === 'LEVEL_4_TRUSTED';

  const level2Ready = hasBasicProfile && kycReady && bankReady && verificationReady;
  const level3Ready = level2Ready && hasCompletedService && taxReady && payoutAgreementsReady && hasAddress;

  const items: ProviderLevelPathItem[] = [
    {
      level: 'LEVEL 1 - Signup possible',
      status: hasBasicProfile ? 'READY' : 'PROFILE',
      detail: hasBasicProfile
        ? 'Phone, display name, and legal name are present.'
        : 'The partner can sign up, but basic profile data is incomplete.',
      operatorAction: hasBasicProfile
        ? 'Continue identity and payout review.'
        : 'Ask partner to complete basic profile in the Partner app.',
      ready: hasBasicProfile,
      blocked: !hasBasicProfile,
    },
    {
      level: 'LEVEL 2 - Activity possible',
      status: level2Ready ? 'READY' : 'REVIEW',
      detail: level2Ready
        ? 'KYC, required documents, primary bank account, and partner verification are approved.'
        : level2Blockers({
            hasBasicProfile,
            kycReady,
            requiredDocumentsReady,
            bankReady,
            verificationReady,
          }).join(' '),
      operatorAction: level2Ready
        ? 'Partner can receive direct booking and backup matching work.'
        : 'Clear these items before relying on the partner for customer requests.',
      ready: level2Ready,
      blocked: !level2Ready,
    },
    {
      level: 'LEVEL 3 - Payout possible',
      status: level3Ready ? 'READY' : hasCompletedService ? 'BLOCKED' : 'DEFERRED',
      detail: level3Ready
        ? 'First service, tax profile, address, bank, and required agreements are complete.'
        : hasCompletedService
          ? level3Blockers({ taxReady, payoutAgreementsReady, agreementCount, hasAddress, bankReady }).join(
              ' ',
            )
          : 'Do not force tax setup before the first completed service. It should appear before withdrawal.',
      operatorAction: level3Ready
        ? 'Payout can be approved when an eligible batch exists.'
        : hasCompletedService
          ? 'Resolve payout blockers before approving withdrawal.'
          : 'Keep this deferred until the partner earns revenue.',
      ready: level3Ready,
      blocked: hasCompletedService && !level3Ready,
    },
    {
      level: 'LEVEL 4 - Trust badge',
      status: trustedReady ? 'TRUSTED' : level3Ready ? 'OPTIONAL' : 'LOCKED',
      detail: trustedReady
        ? 'Partner has the trusted badge level.'
        : level3Ready
          ? 'Partner is eligible for manual trust review after service quality checks.'
          : 'Trust badge should wait until payout-level compliance and service quality are proven.',
      operatorAction: trustedReady
        ? 'Monitor reviews and reports.'
        : level3Ready
          ? 'Review experience evidence, service photos, reports, and customer reviews.'
          : 'No trust badge action yet.',
      ready: trustedReady,
      blocked: false,
    },
  ];

  return {
    currentLevel: provider.level ?? 'LEVEL_1_SIGNUP',
    items,
  };
}

function level2Blockers(input: {
  hasBasicProfile: boolean;
  kycReady: boolean;
  requiredDocumentsReady: boolean;
  bankReady: boolean;
  verificationReady: boolean;
}) {
  const blockers: string[] = [];
  if (!input.hasBasicProfile) blockers.push('Basic profile is incomplete.');
  if (!input.requiredDocumentsReady) blockers.push('Required CCCD/selfie documents are not all approved.');
  if (!input.kycReady) blockers.push('KYC is not approved.');
  if (!input.bankReady) blockers.push('Primary bank account is not approved.');
  if (!input.verificationReady) blockers.push('Partner verification is not approved.');
  return blockers.length ? blockers : ['Activity gate needs operator refresh.'];
}

function level3Blockers(input: {
  taxReady: boolean;
  payoutAgreementsReady: boolean;
  agreementCount: number;
  hasAddress: boolean;
  bankReady: boolean;
}) {
  const blockers: string[] = [];
  if (!input.bankReady) blockers.push('Approved bank account is required.');
  if (!input.taxReady) blockers.push('Approved tax profile is required after first completed service.');
  if (!input.payoutAgreementsReady) blockers.push(`Required agreements are ${input.agreementCount}/5.`);
  if (!input.hasAddress) blockers.push('Residential address is required for tax/payout records.');
  return blockers.length ? blockers : ['Payout gate needs operator refresh.'];
}

type ProviderResubmissionItem = {
  target: string;
  status: string;
  reason: string;
  providerInstruction: string;
  operatorAction: string;
};

function buildProviderResubmissionPlan(provider: ProviderDetail) {
  const items: ProviderResubmissionItem[] = [];

  if (provider.kyc?.status === 'REJECTED') {
    items.push({
      target: 'KYC identity review',
      status: 'REJECTED',
      reason: provider.kyc.rejectionReason ?? 'No rejection reason was saved.',
      providerInstruction:
        'Ask the partner to check CCCD/CMND number, legal name, and selfie match before resubmitting.',
      operatorAction: 'KYC',
    });
  }

  for (const document of provider.documents ?? []) {
    if (document.status !== 'REJECTED') continue;
    items.push({
      target: providerDocumentLabel(document.type),
      status: 'REJECTED',
      reason: document.rejectionReason ?? 'No document rejection reason was saved.',
      providerInstruction: providerDocumentResubmissionInstruction(document.type),
      operatorAction: 'Doc',
    });
  }

  for (const bankAccount of provider.bankAccounts ?? []) {
    if (bankAccount.status !== 'REJECTED') continue;
    items.push({
      target: `${bankAccount.bankName} bank account`,
      status: 'REJECTED',
      reason: bankAccount.rejectionReason ?? 'No bank rejection reason was saved.',
      providerInstruction:
        'Ask for a new account with matching legal holder name, valid bank name, and readable QR if used.',
      operatorAction: 'Bank',
    });
  }

  if (provider.taxProfile?.status === 'REJECTED') {
    items.push({
      target: 'Freelancer tax profile',
      status: 'REJECTED',
      reason: provider.taxProfile.rejectionReason ?? 'No tax rejection reason was saved.',
      providerInstruction:
        'Ask for the correct MST/tax code, legal name, and registered address before payout unlock.',
      operatorAction: 'Tax',
    });
  }

  return { items };
}

function buildProviderRegistrationDossier(provider: ProviderDetail) {
  const specialties = jsonStringList(provider.specialties);
  const languages = jsonStringList(provider.languages);
  const hasProfileQuality =
    (provider.experienceYears ?? 0) > 0 &&
    specialties.length > 0 &&
    languages.length > 0 &&
    Boolean(provider.serviceStyle?.trim());
  const profileComplete = Boolean(
    provider.legalName?.trim() &&
    provider.dateOfBirth &&
    provider.gender?.trim() &&
    provider.user?.phone?.trim() &&
    provider.displayName?.trim(),
  );
  const publicProfileComplete = Boolean(
    provider.activityNickname?.trim() ||
    (provider.bio?.trim() &&
      (provider.documents ?? []).some((document) => document.type === 'PROFILE_PHOTO')) ||
    hasProfileQuality,
  );
  const addressComplete = Boolean(provider.residentialAddress?.trim() && provider.city?.trim());
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const serviceAreaComplete =
    Boolean(provider.serviceArea) || Boolean(provider.currentLat && provider.currentLng);
  const identityComplete = provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider);
  const bankComplete = provider.bankAccounts?.[0]?.status === 'APPROVED';
  const taxDeferredOrComplete = !hasFirstRevenue || provider.taxProfile?.status === 'APPROVED';
  const agreementsDeferredOrComplete = !hasFirstRevenue || (provider.agreements?.length ?? 0) >= 5;
  const securityClear =
    !provider.blockedAt &&
    !(provider.devices ?? []).some((device) => device.blockedAt) &&
    !(provider.sessions ?? []).some((session) => session.suspicious);

  const items = [
    {
      label: 'Basic identity',
      ok: profileComplete,
      status: profileComplete ? 'READY' : 'MISSING',
      detail: profileComplete
        ? 'Legal name, date of birth, gender, phone, and display name are present.'
        : 'Real name, date of birth, gender, phone, and public display name should be collected before approval.',
      operatorAction: profileComplete
        ? 'Continue KYC and public profile review.'
        : 'Ask partner to complete basic profile fields in the Partner app.',
    },
    {
      label: 'Public working profile',
      ok: publicProfileComplete,
      status: publicProfileComplete ? 'READY' : 'DRAFT',
      detail: publicProfileComplete
        ? `Partner has public-facing profile material for customer review. Quality fields: ${
            hasProfileQuality
              ? `${provider.experienceYears} year(s), ${specialties.length} specialty, ${languages.length} language.`
              : 'partial quality profile.'
          }`
        : 'Activity nickname, introduction, profile photo, and work photos should be reviewed before customer launch.',
      operatorAction: publicProfileComplete
        ? 'Check whether photos, service style, specialties, and bio are suitable for the HANDS customer app.'
        : 'Keep as draft until public profile content is ready.',
    },
    {
      label: 'Address and service area',
      ok: serviceAreaComplete && (!hasFirstRevenue || addressComplete),
      status: serviceAreaComplete && (!hasFirstRevenue || addressComplete) ? 'READY' : 'MISSING',
      detail:
        serviceAreaComplete && (!hasFirstRevenue || addressComplete)
          ? hasFirstRevenue
            ? 'Residential/tax address, city, and a service area/location signal are available.'
            : 'Service area/location signal is available. Residential tax address can stay deferred until first earning.'
          : hasFirstRevenue
            ? 'Residential/tax address, service city, GPS location, or service area still needs confirmation.'
            : 'GPS location or service area still needs confirmation before dispatch.',
      operatorAction:
        serviceAreaComplete && (!hasFirstRevenue || addressComplete)
          ? 'Use location freshness before dispatching.'
          : hasFirstRevenue
            ? 'Ask partner to complete tax address and open the app for location sync.'
            : 'Ask partner to open the app for location sync.',
    },
    {
      label: 'KYC evidence',
      ok: identityComplete,
      status: identityComplete ? 'APPROVED' : (provider.kyc?.status ?? 'DRAFT'),
      detail: identityComplete
        ? 'CCCD/CMND and selfie evidence are approved.'
        : `KYC requires approved CCCD front/back and selfie. Missing: ${
            missingApprovedRequiredKycDocuments(provider).map(providerDocumentLabel).join(', ') ||
            'KYC decision'
          }.`,
      operatorAction: identityComplete
        ? 'Identity gate is clear.'
        : 'Review typed documents first, then approve or reject KYC.',
    },
    {
      label: 'Bank and payout account',
      ok: bankComplete,
      status: provider.bankAccounts?.[0]?.status ?? 'MISSING',
      detail: bankComplete
        ? 'Primary bank account is approved for future payouts.'
        : 'Bank name, masked account number, account holder, and QR evidence should be approved before withdrawal.',
      operatorAction: bankComplete
        ? 'No bank action unless partner changes account.'
        : 'Approve or reject the submitted bank account with a clear reason.',
    },
    {
      label: 'Freelancer tax profile',
      ok: taxDeferredOrComplete,
      status: provider.taxProfile?.status ?? (hasFirstRevenue ? 'MISSING' : 'DEFERRED'),
      detail: taxDeferredOrComplete
        ? hasFirstRevenue
          ? 'Tax profile is approved after partner earned revenue.'
          : 'Tax collection is intentionally deferred until first earning.'
        : 'Partner has earning history, so tax profile must be approved before payout.',
      operatorAction: taxDeferredOrComplete
        ? 'Follow the staged UX: do not force tax fields before first earning.'
        : 'Request MST/tax code, legal name, and registered address before withdrawal.',
    },
    {
      label: 'Legal agreements',
      ok: agreementsDeferredOrComplete,
      status:
        (provider.agreements?.length ?? 0) >= 5
          ? 'READY'
          : hasFirstRevenue
            ? `${provider.agreements?.length ?? 0}/5`
            : 'DEFERRED',
      detail:
        (provider.agreements?.length ?? 0) >= 5
          ? 'Required terms, privacy, location, payout, and tax consents are accepted.'
          : hasFirstRevenue
            ? 'Partner has first earning and must accept service, privacy, location, payout, and tax policy versions.'
            : 'Payout and tax agreement collection is intentionally deferred until first earning.',
      operatorAction:
        (provider.agreements?.length ?? 0) >= 5
          ? 'Keep agreement versions visible for audit.'
          : hasFirstRevenue
            ? 'Show agreement completion flow before payout-level access.'
            : 'Do not force payout/tax agreements during initial signup.',
    },
    {
      label: 'Device and safety',
      ok: securityClear,
      status: securityClear ? 'CLEAR' : 'WATCH',
      detail: securityClear
        ? 'No account block, blocked partner device, or suspicious session is active.'
        : 'A block, device issue, or suspicious session needs admin review.',
      operatorAction: securityClear
        ? 'Continue normal monitoring.'
        : 'Review device/session section and risk desk before approval or payout.',
    },
  ];

  return {
    items,
    blockers: items.filter((item) => !item.ok).length,
    ready: items.every((item) => item.ok),
  };
}

function providerDocumentResubmissionInstruction(type?: string | null) {
  if (type === 'CCCD_FRONT') {
    return 'Ask for a clear front-side CCCD/CMND image with readable number, full name, and no glare.';
  }
  if (type === 'CCCD_BACK') {
    return 'Ask for a clear back-side CCCD/CMND image with all corners visible and no cropping.';
  }
  if (type === 'SELFIE') {
    return 'Ask for a live selfie that clearly matches the submitted identity document.';
  }
  if (type === 'BANK_QR') {
    return 'Ask for a readable bank QR image, but still verify the typed bank account fields.';
  }
  return 'Ask the partner to upload a clearer replacement image for review.';
}

function riskSeverityPill(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function riskStatusPill(status: string) {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'pill-success';
  if (status === 'INVESTIGATING') return 'pill-warn';
  return 'pill-info';
}

function shortRiskId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function payoutBlockers(provider: ProviderDetail) {
  const blockers: string[] = [];
  const primaryBank = provider.bankAccounts?.[0];
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const payoutHold = activePayoutHold(provider);

  if (payoutHold) {
    blockers.push(`Active payout hold: ${payoutHold.reason}.`);
  }
  if (primaryBank?.status !== 'APPROVED') {
    blockers.push(`Bank ${primaryBank?.status ?? 'MISSING'}.`);
  }
  if (provider.taxProfile?.status !== 'APPROVED') {
    blockers.push(`Tax ${provider.taxProfile?.status ?? 'MISSING'}.`);
  }
  if (!provider.residentialAddress?.trim()) {
    blockers.push('Residential address missing.');
  }
  if (agreementsAccepted < 5) {
    blockers.push(`Agreements ${agreementsAccepted}/5.`);
  }
  return blockers.length ? blockers : ['Payout gate needs admin refresh.'];
}

function nextProviderAction(provider: ProviderDetail): ProviderOpsCard {
  const payoutHold = activePayoutHold(provider);
  if (provider.blockedAt) {
    return {
      title: 'Next admin action',
      status: 'ACCOUNT',
      detail: `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`,
      action: 'Unblock only after the recorded account-level issue is resolved.',
      tone: 'blocked',
    };
  }
  if (payoutHold) {
    return {
      title: 'Next admin action',
      status: 'PAYOUT HOLD',
      detail: `Finance is locked by active payout hold: ${payoutHold.reason}`,
      action: 'Review risk notes and lift the sanction only when payout can safely resume.',
      tone: 'blocked',
    };
  }
  if (!provider.displayName?.trim() || !provider.legalName?.trim()) {
    return {
      title: 'Next admin action',
      status: 'PROFILE',
      detail: 'Basic identity or public display name is incomplete.',
      action: 'Ask partner to complete display name and legal name in the Partner app.',
      tone: 'blocked',
    };
  }
  if (!hasApprovedRequiredKycDocuments(provider)) {
    return {
      title: 'Next admin action',
      status: 'DOCUMENTS',
      detail: 'At least one required KYC document is still missing, pending, or rejected.',
      action: 'Approve/reject typed documents before KYC approval.',
      tone: 'blocked',
    };
  }
  if (provider.kyc?.status !== 'APPROVED') {
    return {
      title: 'Next admin action',
      status: 'KYC',
      detail: `KYC status is ${provider.kyc?.status ?? 'DRAFT'}.`,
      action: 'Approve or reject KYC after reviewing the ID fields.',
      tone: 'blocked',
    };
  }
  if (provider.bankAccounts?.[0]?.status !== 'APPROVED') {
    return {
      title: 'Next admin action',
      status: 'BANK',
      detail: `Primary bank account is ${provider.bankAccounts?.[0]?.status ?? 'missing'}.`,
      action: 'Approve or reject the bank account with a clear reason.',
      tone: 'blocked',
    };
  }
  if (providerHasFirstRevenueSignal(provider) && provider.taxProfile?.status !== 'APPROVED') {
    return {
      title: 'Next admin action',
      status: 'TAX',
      detail: `Partner has earnings, but tax profile is ${provider.taxProfile?.status ?? 'missing'}.`,
      action: 'Approve or reject tax profile before withdrawal.',
      tone: 'blocked',
    };
  }
  if (providerHasFirstRevenueSignal(provider) && !provider.residentialAddress?.trim()) {
    return {
      title: 'Next admin action',
      status: 'TAX ADDRESS',
      detail: 'Partner has first earning, but residential/tax address is missing.',
      action: 'Ask partner to add tax address before withdrawal.',
      tone: 'blocked',
    };
  }
  if (providerHasFirstRevenueSignal(provider) && (provider.agreements?.length ?? 0) < 5) {
    return {
      title: 'Next admin action',
      status: 'TERMS',
      detail: `Required payout/tax agreements are ${provider.agreements?.length ?? 0}/5.`,
      action: 'Ask partner to accept missing policy versions before withdrawal.',
      tone: 'blocked',
    };
  }
  if (locationAgeMinutes(provider.currentLocationUpdatedAt) > 30) {
    return {
      title: 'Next admin action',
      status: 'LOCATION',
      detail: `Location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}.`,
      action: 'Ask partner to open the app and refresh location.',
      tone: 'pending',
    };
  }
  if (!(provider.user?.pushDevices ?? []).some((device) => device.enabled)) {
    return {
      title: 'Next admin action',
      status: 'PUSH',
      detail: 'Partner has no enabled push device.',
      action: 'Ask partner to reopen app and re-register alerts.',
      tone: 'pending',
    };
  }
  return {
    title: 'Next admin action',
    status: 'CLEAR',
    detail: 'No immediate onboarding or dispatch blocker is visible.',
    action: 'Monitor direct booking performance.',
    tone: 'done',
  };
}

function pillClass(tone: ProviderOpsCard['tone']) {
  if (tone === 'done') return 'pill-success';
  if (tone === 'blocked') return 'pill-danger';
  return 'pill-warn';
}

function cardClass(tone: ProviderOpsCard['tone']) {
  if (tone === 'done') return 'ops-task-done';
  if (tone === 'blocked') return 'ops-task-blocked';
  return 'ops-task-pending';
}

function buildReviewChecklist(provider: ProviderDetail) {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const hasRecentLocation = locationAgeMinutes(provider.currentLocationUpdatedAt) <= 30;
  const hasPushDevice = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const hasBasicProfile = Boolean(
    provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim(),
  );
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);

  const items = [
    {
      label: 'Account block',
      ok: !provider.blockedAt,
      status: provider.blockedAt ? 'BLOCKED' : 'CLEAR',
      detail: provider.blockedAt
        ? `Blocked reason: ${provider.blockedReason ?? 'No reason saved'}.`
        : 'Partner account is not blocked.',
    },
    {
      label: 'Basic partner identity',
      ok: hasBasicProfile,
      status: hasBasicProfile ? 'Complete' : 'Missing',
      detail: hasBasicProfile
        ? 'Display name, legal name, and phone are saved.'
        : 'Confirm display name, legal name, and phone.',
    },
    {
      label: 'KYC status',
      ok: provider.kyc?.status === 'APPROVED',
      status: provider.kyc?.status ?? 'DRAFT',
      detail:
        provider.kyc?.status === 'APPROVED'
          ? 'KYC has been approved.'
          : 'Approve CCCD/CMND and selfie review before Level 2 activity.',
    },
    {
      label: 'Required KYC documents',
      ok: missingDocuments.length === 0,
      status: missingDocuments.length === 0 ? 'Complete' : 'Missing',
      detail:
        missingDocuments.length === 0
          ? 'CCCD front, CCCD back, and selfie are approved.'
          : `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
    },
    {
      label: 'Bank account',
      ok: primaryBank?.status === 'APPROVED',
      status: primaryBank?.status ?? 'MISSING',
      detail: primaryBank
        ? `${primaryBank.bankName} / ${primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'unmasked'}`
        : 'Partner has not submitted a payout account.',
    },
    {
      label: 'Tax and payout gate',
      ok:
        !hasFirstRevenue ||
        (provider.taxProfile?.status === 'APPROVED' &&
          Boolean(provider.residentialAddress?.trim()) &&
          (provider.agreements?.length ?? 0) >= 5),
      status: provider.taxProfile?.status ?? (hasFirstRevenue ? 'MISSING' : 'DEFERRED'),
      detail: !hasFirstRevenue
        ? 'Tax profile, tax address, and payout agreements can stay deferred until first earning.'
        : provider.taxProfile?.status === 'APPROVED' &&
            Boolean(provider.residentialAddress?.trim()) &&
            (provider.agreements?.length ?? 0) >= 5
          ? 'Tax profile, tax address, and payout agreements are ready.'
          : 'First earning exists, so tax profile, tax address, and payout agreements now block payout.',
    },
    {
      label: 'Location freshness',
      ok: hasRecentLocation,
      status: hasRecentLocation ? 'RECENT' : 'STALE',
      detail: provider.currentLocationUpdatedAt
        ? `Last shared at ${formatDate(provider.currentLocationUpdatedAt)}.`
        : 'Partner app has not shared a location.',
    },
    {
      label: 'Push device',
      ok: hasPushDevice,
      status: hasPushDevice ? 'READY' : 'MISSING',
      detail: hasPushDevice
        ? 'At least one enabled device token exists.'
        : 'Ask partner to open the app so alerts can register.',
    },
  ];

  return {
    items,
    blockers: items.filter((item) => !item.ok).length,
    ready: items.every((item) => item.ok),
  };
}

function hasApprovedRequiredKycDocuments(provider: ProviderDetail) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function missingApprovedRequiredKycDocuments(provider: ProviderDetail) {
  const requiredDocuments = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return requiredDocuments.filter((type) => !approvedDocuments.has(type));
}

function formatDate(value?: string | null) {
  if (!value) return 'Missing';
  return new Date(value).toLocaleString();
}

function formatDateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatJsonSummary(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length ? JSON.stringify(value).slice(0, 120) : null;
  }
  return String(value);
}

function jsonStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function formatJsonList(value: unknown) {
  const items = jsonStringList(value);
  return items.length ? items.join(', ') : null;
}

function formatRating(provider: ProviderDetail) {
  const rating = provider.ratingAvg ?? 0;
  const numericRating = typeof rating === 'number' ? rating : Number(rating);
  const formattedRating = Number.isFinite(numericRating) ? numericRating.toFixed(1) : String(rating);
  return `${formattedRating} (${provider.reviewCount ?? 0} reviews)`;
}

function providerPublicMediaLabel(purpose?: string | null) {
  if (purpose === 'PROFILE_IMAGE') return 'Profile image';
  if (purpose === 'PROVIDER_GALLERY') return 'Work gallery';
  return purpose ?? 'Public media';
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function locationAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
}

function locationAgeLabel(value?: string | null) {
  if (!value) return 'missing';
  const minutes = locationAgeMinutes(value);
  if (!Number.isFinite(minutes)) return 'invalid';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

function maskDeviceId(value?: string | null) {
  if (!value) return 'No device id';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatCurrency(value?: number | string | null, currency = 'VND') {
  const amount = amountValue(value);
  if (!amount) return `0 ${currency}`;
  return `${amount.toLocaleString('vi-VN')} ${currency}`;
}

function amountValue(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function providerHasFirstRevenueSignal(provider: ProviderDetail) {
  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

function isCashFeeDebt(earning: NonNullable<ProviderDetail['earnings']>[number]) {
  return earning.netAmount < 0 && earning.booking?.payment?.method === 'CASH' && earning.status !== 'PAID';
}

function walletLedgerLabel(type: string) {
  return type
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function humanizeProviderLogAction(action: string) {
  return action
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function statusTransition(log: NonNullable<ProviderDetail['verificationLogs']>[number]) {
  if (log.fromStatus || log.toStatus) {
    return `${log.fromStatus ?? 'New'} -> ${log.toStatus ?? 'Unknown'}`;
  }
  return 'Decision recorded';
}

function activePayoutHold(provider: ProviderDetail) {
  const now = Date.now();
  return (provider.sanctions ?? []).find((sanction) => {
    if (sanction.type !== 'PAYOUT_HOLD' || sanction.status !== 'ACTIVE') {
      return false;
    }
    if (!sanction.expiresAt) {
      return true;
    }
    const expiresAt = Date.parse(sanction.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

function metadataPreview(metadata?: unknown) {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  const reason = typeof record.reason === 'string' ? record.reason : null;
  const documentType = typeof record.documentType === 'string' ? record.documentType : null;
  const target = typeof record.target === 'string' ? record.target : null;
  const parts = [
    reason ? `Reason: ${reason}` : null,
    documentType ? `Document: ${documentType}` : null,
    target ? `Target: ${target}` : null,
  ].filter(Boolean);
  return parts.join(' / ');
}
