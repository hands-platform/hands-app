import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminAuditLog,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../../lib/admin-api';
import {
  detailDateRangeOptions,
  isWithinDetailDateFilter,
  readDetailDateFilters,
} from '../../../lib/detail-date-filter';
import {
  DetailActivityTypeOption,
  detailActivityTypeLabel,
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../lib/detail-activity-filter';
import { buildCsvDataHref } from '../../../lib/csv-export';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  addProviderOpsNote,
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
} from '../../partner-controls/actions';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type PartnerDispatchPolicy = {
  responseWindowMinutes: number;
  backupRadiusMeters: number;
  locationFreshnessMinutes: number;
};
type PartnerKycEvidence = {
  allRequiredApproved: boolean;
  missingDocuments: string[];
  nextAction: string;
  decisionChecklist: Array<{
    label: string;
    ok: boolean;
    detail: string;
  }>;
  rows: Array<{
    type: string;
    label: string;
    status: string;
    uploadedAt?: string | null;
    rejectionReason?: string | null;
    fileLabel: string;
  }>;
};
type PartnerDetailBooking = {
  id: string;
  customerProfileId?: string;
  status?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  createdAt?: string;
  address?: unknown;
  closedAt?: string | null;
  closedByRole?: string | null;
  closedReason?: string | null;
  closedNote?: string | null;
  customerProfile?: {
    user?: { phone?: string | null; fullName?: string | null } | null;
  } | null;
  services?: Array<{
    id: string;
    price?: number;
    quantity?: number;
    service?: { name?: string; durationMin?: number | null } | null;
  }>;
  participants?: Array<{
    id: string;
    providerProfileId: string;
    status: string;
    joinedAt?: string;
    respondedAt?: string | null;
  }>;
  chatRoom?: {
    id: string;
    createdAt?: string;
    messages?: Array<{
      id: string;
      body: string;
      createdAt?: string;
      sender?: { phone?: string | null; fullName?: string | null; roles?: string[] | null } | null;
    }>;
  } | null;
  payment?: { method?: string; status?: string; amount?: number; currency?: string | null } | null;
  review?: { rating?: number; comment?: string | null; createdAt?: string } | null;
};
type PartnerDetailChatMessage = NonNullable<
  NonNullable<PartnerDetailBooking['chatRoom']>['messages']
>[number];

const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
const MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.backup_provider_location_max_age_minutes';
const REQUIRED_KYC_DOCUMENTS = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
const DEFAULT_PARTNER_DISPATCH_POLICY: PartnerDispatchPolicy = {
  responseWindowMinutes: 10,
  backupRadiusMeters: 10_000,
  locationFreshnessMinutes: 30,
};
const PARTNER_ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All event types', types: [] },
  { value: 'booking_chat', label: 'Bookings and chat archive', types: ['BOOKING', 'CHAT'] },
  { value: 'app_device', label: 'Account, app sessions, and devices', types: ['ACCOUNT', 'SESSION', 'DEVICE'] },
  { value: 'location', label: 'Location snapshots', types: ['LOCATION'] },
  { value: 'finance', label: 'Earnings and payouts', types: ['EARNING', 'PAYOUT'] },
  {
    value: 'verification',
    label: 'Verification, documents, and operation logs',
    types: ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'],
  },
] satisfies DetailActivityTypeOption[];

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
  auditLogs?: AdminAuditLog[];
  preferredBookings?: PartnerDetailBooking[];
  selectedBookings?: PartnerDetailBooking[];
  participants?: Array<{
    id: string;
    status: string;
    joinedAt?: string;
    respondedAt?: string | null;
    booking?: PartnerDetailBooking | null;
  }>;
};

export default async function ProviderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const detailSearchParams = searchParams ? await searchParams : {};
  const dateFilters = readDetailDateFilters(detailSearchParams);
  const activityType = readDetailActivityType(detailSearchParams, PARTNER_ACTIVITY_TYPE_OPTIONS);
  const [provider, operationalPolicies] = await Promise.all([
    adminGet<ProviderDetail | null>(`/admin/partners/${id}`, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);

  if (!provider) {
    notFound();
  }
  const dispatchPolicy = buildPartnerDispatchPolicy(operationalPolicies);

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

  const primaryBank = primaryBankAccount(provider);
  const reviewChecklist = buildReviewChecklist(provider, dispatchPolicy);
  const opsSummary = buildProviderOpsSummary(provider, dispatchPolicy);
  const payoutOps = buildProviderPayoutOps(provider);
  const securitySummary = buildProviderSecuritySummary(provider);
  const levelPlan = buildProviderLevelPlan(provider);
  const resubmissionPlan = buildProviderResubmissionPlan(provider);
  const registrationDossier = buildProviderRegistrationDossier(provider);
  const providerServicePricing = buildProviderServicePricing(provider);
  const bookingAcceptance = buildProviderBookingAcceptance(provider, providerServicePricing, dispatchPolicy);
  const acceptanceUnblockPlaybook = buildPartnerAcceptanceUnblockPlaybook(
    provider,
    bookingAcceptance,
    payoutOps,
  );
  const kycEvidence = buildPartnerKycEvidence(provider);
  const canApproveKyc = kycEvidence.allRequiredApproved;
  const payoutHold = activePayoutHold(provider);
  const hasCashFeeDebt = (provider.earnings ?? []).some(isCashFeeDebt);
  const partnerBookingArchive = buildPartnerBookingArchive(provider);
  const partnerActivityRecords = buildPartnerActivityRecords(provider, partnerBookingArchive);
  const filteredPartnerBookingArchive = partnerBookingArchive.filter((record) =>
    isWithinDetailDateFilter(record.booking.scheduledStartAt ?? record.booking.createdAt, dateFilters),
  );
  const filteredPartnerActivityRecords = partnerActivityRecords.filter(
    (record) =>
      isWithinDetailDateFilter(record.at, dateFilters) &&
      isWithinDetailActivityType(record.type, activityType, PARTNER_ACTIVITY_TYPE_OPTIONS),
  );
  const partnerActivitySummary = buildPartnerActivitySummary(filteredPartnerActivityRecords);
  const partnerDailyActivityDigest = buildPartnerDailyActivityDigest(filteredPartnerActivityRecords);
  const partnerMasterFacts = buildPartnerMasterFacts(
    provider,
    partnerBookingArchive,
    primaryBank,
    payoutOps,
    bookingAcceptance,
  );
  const partnerOperatingChecklist = buildPartnerOperatingChecklist(
    provider,
    primaryBank,
    payoutOps,
    bookingAcceptance,
    providerServicePricing,
    dispatchPolicy,
  );
  const partnerOperatingLedger = buildPartnerOperatingLedger(
    provider,
    partnerBookingArchive,
    primaryBank,
    payoutOps,
    bookingAcceptance,
    providerServicePricing,
  );
  const partnerOperatorCommandQueue = buildPartnerOperatorCommandQueue({
    provider,
    primaryBank,
    payoutOps,
    bookingAcceptance,
    providerServicePricing,
    dispatchPolicy,
    canApproveKyc,
  });
  const partnerOpsNotes = (provider.auditLogs ?? []).filter((log) => log.action === 'provider.ops_note.add');
  const latestPartnerBooking = partnerBookingArchive[0]?.booking;
  const connectedPartnerRecordLinks = [
    {
      label: 'Latest booking',
      value: latestPartnerBooking ? shortRecordId(latestPartnerBooking.id) : 'None',
      detail: latestPartnerBooking
        ? `${latestPartnerBooking.status ?? 'UNKNOWN'} / ${bookingServiceLabel(latestPartnerBooking)}`
        : 'No preferred, selected, or joined booking loaded.',
      href: latestPartnerBooking ? `/bookings/${latestPartnerBooking.id}` : '#booking-chat-records',
      tone: latestPartnerBooking ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Chat archive',
      value: `${partnerBookingArchive.reduce(
        (sum, record) => sum + readPartnerChatMessages(record.booking).length,
        0,
      )} message(s)`,
      detail: `${partnerBookingArchive.filter((record) => record.booking.chatRoom).length} retained room(s).`,
      href: `/chat-archive?q=${encodeURIComponent(provider.id)}`,
      tone: partnerBookingArchive.some((record) => record.booking.chatRoom) ? 'pill-success' : 'pill-neutral',
    },
    {
      label: 'KYC and documents',
      value: provider.kyc?.status ?? provider.verification?.status ?? 'DRAFT',
      detail: `${kycEvidence.missingDocuments.length} required document(s) missing approval.`,
      href: '#kyc',
      tone: canApproveKyc ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Bank account',
      value: primaryBank?.status ?? 'Missing',
      detail: primaryBank
        ? `${primaryBank.bankName} / ${primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'masked'}`
        : 'No payout bank account loaded.',
      href: '#bank',
      tone: primaryBank?.status === 'APPROVED' ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Tax profile',
      value: provider.taxProfile?.status ?? (providerHasFirstRevenueSignal(provider) ? 'Missing' : 'Deferred'),
      detail: providerHasFirstRevenueSignal(provider)
        ? 'First earning exists; tax profile gates payout.'
        : 'Tax collection stays deferred until first earning.',
      href: '#tax',
      tone:
        provider.taxProfile?.status === 'APPROVED' || !providerHasFirstRevenueSignal(provider)
          ? 'pill-success'
          : 'pill-warn',
    },
    {
      label: 'Location',
      value: provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : 'No pin',
      detail: provider.currentLat && provider.currentLng ? `${provider.currentLat}, ${provider.currentLng}` : 'No latest location loaded.',
      href: '#location',
      tone: provider.currentLocationUpdatedAt ? 'pill-info' : 'pill-warn',
    },
    {
      label: 'Wallet and payout',
      value: payoutOps.status,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate clear or deferred.',
      href: '#payout',
      tone: pillClass(payoutOps.tone),
    },
    {
      label: 'Operator notes',
      value: `${partnerOpsNotes.length} note(s)`,
      detail: partnerOpsNotes[0] ? auditLogNoteText(partnerOpsNotes[0]) : 'No manual partner note saved.',
      href: '#partner-operator-notes',
      tone: partnerOpsNotes.length ? 'pill-info' : 'pill-neutral',
    },
  ];
  const filteredActivityCsvHref = buildCsvDataHref(
    filteredPartnerActivityRecords.map((record) => ({
      type: record.type,
      date: formatDate(record.at),
      title: record.title,
      detail: record.detail,
      record_id: record.id,
      partner_id: provider.id,
      partner_phone: provider.user?.phone ?? '',
    })),
    ['type', 'date', 'title', 'detail', 'record_id', 'partner_id', 'partner_phone'],
  );

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/partners">
              Back to partners
            </Link>
          </p>
          <h1>{marketplaceDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id)}</h1>
          <p className="muted">
            {marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} / {provider.user?.phone ?? 'No phone'} /{' '}
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
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(provider.id)}`}>
            All partner chats
          </Link>
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

      <div className="card" id="partner-recent-operations-timeline" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner recent operations timeline</h2>
            <p className="muted">
              Latest factual partner events in the order operators need them: onboarding, app, location,
              booking, chat, finance, payout, document, tax, and staff records.
            </p>
          </div>
          <Link className="text-link" href="#app-activity">
            Open full timeline
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {filteredPartnerActivityRecords.length ? (
            filteredPartnerActivityRecords.slice(0, 8).map((record) => (
              <div className="setup-stage-item" key={`recent-${record.type}-${record.id}-${record.at}`}>
                <span>{record.type}</span>
                <div>
                  <Link className="text-link" href={partnerActivityRecordHref(record)}>
                    <strong>{record.title}</strong>
                  </Link>
                  <p className="muted">{record.detail}</p>
                </div>
                <small>{formatDate(record.at)}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No partner event matched this filter</strong>
                <p className="muted">Clear the date filter or choose a wider period.</p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </div>

      <div className="card" id="partner-connected-operations-records" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner connected operations records</h2>
            <p className="muted">
              Jump from this partner to linked booking, chat, KYC, bank, tax, location, wallet, payout, and
              operator records.
            </p>
          </div>
          <span className="pill pill-info">{connectedPartnerRecordLinks.length} links</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {connectedPartnerRecordLinks.map((record) => (
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
      </div>

      <div className="card" id="partner-operator-command-queue" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner operator command queue</h2>
            <p className="muted">
              Same-shift partner operations queue for onboarding, final booking gates, payout, location, app
              reachability, and service setup. This is factual handling for operators.
            </p>
          </div>
          <span className={`pill ${pillClass(partnerOperatorCommandQueue.tone)}`}>
            {partnerOperatorCommandQueue.status}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {partnerOperatorCommandQueue.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {partnerOperatorCommandQueue.commands.map((command) => (
            <div className="setup-stage-item" key={command.id}>
              <span>{command.label}</span>
              <div>
                <strong>{command.title}</strong>
                <p className="muted">{command.detail}</p>
                <span className={`pill ${pillClass(command.tone)}`}>{command.owner}</span>
              </div>
              <PartnerOperatorCommandAction providerId={provider.id} command={command} />
            </div>
          ))}
        </div>
      </div>

      <div className="card ops-note-panel" id="partner-operator-notes" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner operator notes</h2>
            <p className="muted">
              Manual handoff notes for partner operations. Use this for factual contact, onboarding,
              settlement, service setup, and dispatch context that should appear in the audit log.
            </p>
          </div>
          <span className="pill pill-info">{partnerOpsNotes.length} note(s)</span>
        </div>
        <div className="ops-note-history">
          {partnerOpsNotes.length ? (
            partnerOpsNotes.slice(0, 6).map((log) => (
              <div className="ops-note-entry" key={log.id}>
                <strong>{formatDate(log.createdAt)}</strong>
                <p>{auditLogNoteText(log)}</p>
                <small className="muted">
                  {log.actor?.fullName ?? log.actor?.phone ?? 'System'} / {log.target}
                </small>
              </div>
            ))
          ) : (
            <p className="muted">No manual partner operation notes have been saved yet.</p>
          )}
        </div>
        <form action={addProviderOpsNote} className="ops-note-form">
          <input type="hidden" name="providerId" value={provider.id} />
          <label>
            Quick note preset
            <select name="preset" defaultValue="">
              <option value="">Manual note only</option>
              <option value="Partner contacted; waiting for reply.">Partner contacted; waiting for reply.</option>
              <option value="Partner app session and push reachability checked.">
                Partner app session and push reachability checked.
              </option>
              <option value="Partner location refresh requested.">Partner location refresh requested.</option>
              <option value="Partner service pricing reviewed.">Partner service pricing reviewed.</option>
              <option value="Partner cash settlement or payout context reviewed.">
                Partner cash settlement or payout context reviewed.
              </option>
              <option value="Partner onboarding document follow-up requested.">
                Partner onboarding document follow-up requested.
              </option>
            </select>
          </label>
          <textarea
            name="note"
            placeholder="Example: Partner confirmed they will refresh location before receiving new requests."
          />
          <button type="submit">Save partner operation note</button>
        </form>
      </div>

      <div className="card" id="partner-master-facts" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner master facts</h2>
            <p className="muted">
              Single-page operating sheet for identity, verification, service, booking, revenue, tax,
              location, review, and account facts.
            </p>
          </div>
          <span className="pill pill-info">{partnerMasterFacts.length} field(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {partnerMasterFacts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small className="muted">{fact.helper}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner full record index</h2>
            <p className="muted">
              Factual partner record map for operators. Use these links to jump to identity, booking/chat,
              payout, documents, app activity, agreements, and review history without making a separate
              activity page.
            </p>
          </div>
          <span className="pill pill-info">{partnerBookingArchive.length} booking record(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <a href="#booking-chat-records">
            <span>Booking and chat</span>
            <strong>{partnerBookingArchive.length}</strong>
            <small>Preferred, selected, and joined requests.</small>
          </a>
          <a href="#payout">
            <span>Wallet and payout</span>
            <strong>{formatCurrency(cashFeeDebtAmount(provider))}</strong>
            <small>Cash fee debt and payout status.</small>
          </a>
          <a href="#documents">
            <span>KYC documents</span>
            <strong>{missingApprovedRequiredKycDocuments(provider).length} missing</strong>
            <small>CCCD front/back and selfie evidence.</small>
          </a>
          <a href="#app-activity">
            <span>App activity</span>
            <strong>{(provider.sessions ?? []).length + (provider.devices ?? []).length}</strong>
            <small>Sessions, devices, push, and location records.</small>
          </a>
          <a href="#partner-daily-digest">
            <span>Daily digest</span>
            <strong>{partnerDailyActivityDigest.length}</strong>
            <small>Date-grouped partner operations records.</small>
          </a>
        </div>
      </div>

      <div className="card" id="partner-operating-ledger" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner operating ledger</h2>
            <p className="muted">
              Compact factual ledger for identity, booking work, chat archive, service pricing, wallet,
              payout, tax, location, device, and audit evidence.
            </p>
          </div>
          <span className="pill pill-info">{partnerOperatingLedger.length} record areas</span>
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
            {partnerOperatingLedger.map((row) => (
              <tr key={row.area}>
                <td>{row.area}</td>
                <td>{row.status}</td>
                <td>{row.evidence}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" id="partner-operating-checklist" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner operating checklist</h2>
            <p className="muted">
              Factual work-control checklist for support and operations. It shows whether bookings, payout,
              tax, location, and service setup need action.
            </p>
          </div>
          <span className="pill pill-info">{partnerOperatingChecklist.length} check(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {partnerOperatingChecklist.map((item) => (
            <div className="setup-stage-item" key={item.area}>
              <span>{item.area}</span>
              <div>
                <strong>{item.status}</strong>
                <p className="muted">{item.detail}</p>
                <span className={`pill ${pillClass(item.tone)}`}>{item.nextAction}</span>
              </div>
              <Link className="text-link" href={item.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="card" id="record-date-filter" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Record date filter</h2>
            <p className="muted">
              Narrow booking, chat, app, location, payout, and verification records without changing partner
              data.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-info">{dateFilters.label}</span>
            <span className="pill pill-neutral">
              {detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS)}
            </span>
          </div>
        </div>
        <form className="form-grid" action={`/partners/${provider.id}`} style={{ marginTop: 14 }}>
          <label>
            Preset
            <select name="range" defaultValue={dateFilters.range}>
              {detailDateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Record type
            <select name="type" defaultValue={activityType}>
              {PARTNER_ACTIVITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={dateFilters.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={dateFilters.to} />
          </label>
          <div className="actions">
            <button type="submit">Apply filter</button>
            <a
              className="text-link"
              download={`hands-partner-${shortRecordId(provider.id)}-activity.csv`}
              href={filteredActivityCsvHref}
            >
              Export activity CSV
            </a>
            <Link className="text-link" href={`/partners/${provider.id}`}>
              Clear
            </Link>
          </div>
        </form>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Filtered booking archive</span>
            <strong>{filteredPartnerBookingArchive.length}</strong>
            <small>Preferred, selected, and joined records.</small>
          </div>
          <div>
            <span>Filtered activity</span>
            <strong>{filteredPartnerActivityRecords.length}</strong>
            <small>
              {detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS)} in this period.
            </small>
          </div>
          <div>
            <span>Loaded bookings</span>
            <strong>{partnerBookingArchive.length}</strong>
            <small>Total visible archive before this filter.</small>
          </div>
          <div>
            <span>Loaded events</span>
            <strong>{partnerActivityRecords.length}</strong>
            <small>Total factual activity before this filter.</small>
          </div>
        </div>
      </div>

      <div className="card" id="booking-chat-records" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking and chat records</h2>
            <p className="muted">
              Every matched booking should have a chat room. Completed service chats disappear from mobile
              apps, but the admin archive remains visible here.
            </p>
          </div>
          <Link className="text-link" href={`/bookings?q=${encodeURIComponent(provider.id)}`}>
            Open bookings
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {filteredPartnerBookingArchive.length ? (
            filteredPartnerBookingArchive.slice(0, 10).map((record) => (
              <div className="setup-stage-item" key={`${record.booking.id}-${record.relation}`}>
                <span>{record.relation}</span>
                <div>
                  <strong>
                    {bookingServiceLabel(record.booking)} / {record.booking.status ?? 'UNKNOWN'}
                  </strong>
                  <p className="muted">
                    Customer {partnerBookingCustomer(record.booking)} / requested{' '}
                    {formatDate(record.booking.scheduledStartAt)}
                  </p>
                  <p className="muted">
                    Payment {record.booking.payment?.method ?? 'UNKNOWN'} /{' '}
                    {formatCurrency(
                      record.booking.payment?.amount ?? 0,
                      record.booking.payment?.currency ?? 'VND',
                    )}
                    {' / '}
                    participants {record.booking.participants?.length ?? 0}
                  </p>
                  {isClosedPartnerBooking(record.booking) ? (
                    <p className="muted">
                      Closed {formatDate(record.booking.closedAt)} / {bookingClosureLabel(record.booking)}
                    </p>
                  ) : null}
                  <p className="muted">
                    Chat {record.booking.chatRoom?.id ?? 'not created'} / messages{' '}
                    {record.booking.chatRoom?.messages?.length ?? 0}
                    {record.lastMessage ? ` / last: ${record.lastMessage}` : ''}
                  </p>
                  {record.booking.chatRoom ? (
                    <div className="ops-task-note" style={{ marginTop: 10 }}>
                      <strong>Admin chat archive</strong>
                      <p className="muted">
                        Mobile chat hides after service completion. Admin keeps this booking transcript.
                      </p>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {readPartnerChatMessages(record.booking).map((message) => (
                          <div className="service-matrix-cell" key={message.id}>
                            <strong>{chatSenderLabel(message)}</strong>
                            <small>{formatDate(message.createdAt)}</small>
                            <p style={{ margin: 0 }}>{message.body}</p>
                          </div>
                        ))}
                        {!readPartnerChatMessages(record.booking).length ? (
                          <p className="muted">Chat room exists, but no message is stored yet.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="ops-task-note" style={{ marginTop: 10 }}>
                      <strong>Chat room missing</strong>
                      <p className="muted">
                        A matched booking should create a chat room. Open the booking detail if this booking
                        is already matched or in service.
                      </p>
                    </div>
                  )}
                </div>
                <div className="participant-list">
                  <Link className="text-link" href={`/bookings/${record.booking.id}`}>
                    Open booking
                  </Link>
                  {record.booking.customerProfileId ? (
                    <Link className="text-link" href={`/customers/${record.booking.customerProfileId}`}>
                      Open customer
                    </Link>
                  ) : null}
                  {record.booking.chatRoom?.id ? (
                    <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(record.booking.id)}`}>
                      Open chat archive
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No booking records matched this date filter</strong>
                <p className="muted">Clear the date filter or choose a wider range to review the archive.</p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </div>

      <div className="card" id="app-activity" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Recent app and operations activity</h2>
            <p className="muted">
              Date-ordered factual activity only: location updates, app sessions, devices, earnings, payouts,
              booking participation, and verification changes.
            </p>
          </div>
          <span className="pill pill-info">{filteredPartnerActivityRecords.length} event(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {partnerActivitySummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {filteredPartnerActivityRecords.length ? (
            filteredPartnerActivityRecords.map((record) => (
              <div className="setup-stage-item" key={`${record.type}-${record.id}-${record.at}`}>
                <span>{record.type}</span>
                <div>
                  <strong>{record.title}</strong>
                  <p className="muted">{record.detail}</p>
                </div>
                <small>{formatDate(record.at)}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No activity matched this date filter</strong>
                <p className="muted">
                  Clear the date filter or choose a wider range to review app, location, payout, and
                  verification records.
                </p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </div>

      <div className="card" id="partner-daily-digest" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner daily activity digest</h2>
            <p className="muted">
              Date-grouped factual partner operations records for same-shift review before reading the full
              event timeline.
            </p>
          </div>
          <span className="pill pill-info">{partnerDailyActivityDigest.length} day(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {partnerDailyActivityDigest.length ? (
            partnerDailyActivityDigest.map((day) => (
              <div className="setup-stage-item" key={day.key}>
                <span>{day.label}</span>
                <div>
                  <strong>{day.total} event(s)</strong>
                  <p className="muted">
                    {day.typeCounts.map((item) => `${item.type} ${item.count}`).join(' / ')}
                  </p>
                  <div className="setup-stage-list" style={{ marginTop: 10 }}>
                    {day.highlights.map((record) => (
                      <div className="service-matrix-cell" key={`${record.type}-${record.id}-${record.at}`}>
                        <strong>{record.title}</strong>
                        <small>
                          {record.type} / {formatDate(record.at)}
                        </small>
                        <p className="muted" style={{ margin: 0 }}>
                          {record.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <small>{day.latestAt ? formatDate(day.latestAt) : 'No date'}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No partner daily activity matched this filter</strong>
                <p className="muted">Clear the date filter or choose a wider range.</p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </div>

      <PartnerDetailReadinessSnapshot
        provider={provider}
        bookingAcceptance={bookingAcceptance}
        payoutOps={payoutOps}
        dispatchPolicy={dispatchPolicy}
      />

      <div className={`card ${cardClass(bookingAcceptance.tone)}`} style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Final booking gate decision</h2>
            <p className="muted">
              Operator-facing decision for whether this partner can pass final customer selection and service-start gates right now.
            </p>
          </div>
          <span className={`pill ${pillClass(bookingAcceptance.tone)}`}>{bookingAcceptance.status}</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Decision</span>
            <strong>{bookingAcceptance.canAccept ? 'Gate clear' : 'Held'}</strong>
            <small>{bookingAcceptance.primaryReason}</small>
          </div>
          <div>
            <span>Cash debt</span>
            <strong>{formatCurrency(bookingAcceptance.cashDebt)}</strong>
            <small>Negative wallet gates final acceptance</small>
          </div>
          <div>
            <span>Location</span>
            <strong>{bookingAcceptance.locationAge}</strong>
            <small>Must be fresh within {dispatchPolicy.locationFreshnessMinutes}m</small>
          </div>
          <div>
            <span>Services</span>
            <strong>{bookingAcceptance.bookableServices}</strong>
            <small>Bookable price options</small>
          </div>
        </div>
        <div className="participant-list" style={{ marginTop: 12 }}>
          <span className="pill pill-info">
            First response window: {dispatchPolicy.responseWindowMinutes}m
          </span>
          <span className="pill pill-info">
            Marketplace radius: {formatDistance(dispatchPolicy.backupRadiusMeters)}
          </span>
          <span className="pill pill-info">
            Marketplace location: {dispatchPolicy.locationFreshnessMinutes}m fresh
          </span>
          <Link className="text-link" href="/operations-policy">
            Edit matching policy
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {bookingAcceptance.gates.map((gate) => (
            <div className="setup-stage-item" key={gate.label}>
              <span>{gate.ok ? 'OK' : 'BLOCK'}</span>
              <div>
                <strong>{gate.label}</strong>
                <p className="muted">{gate.detail}</p>
              </div>
              <small>{gate.action}</small>
            </div>
          ))}
        </div>
      </div>

      <PartnerAcceptanceRepairCommandPanel
        provider={provider}
        bookingAcceptance={bookingAcceptance}
        payoutOps={payoutOps}
        dispatchPolicy={dispatchPolicy}
      />

      <div className="card" id="payout" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner final-gate unblock playbook</h2>
            <p className="muted">
              Operator order for restoring this partner&apos;s final booking gates. Finance and account-control
              blockers stay first; tax stays deferred until first earning and then blocks payout, not initial
              dispatch.
            </p>
          </div>
          <span
            className={`pill ${
              acceptanceUnblockPlaybook.some((step) => step.bookingBlocked) ? 'pill-danger' : 'pill-success'
            }`}
          >
            {acceptanceUnblockPlaybook.filter((step) => step.bookingBlocked).length} booking blocker(s)
          </span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 16 }}>
          {acceptanceUnblockPlaybook.map((step) => (
            <div className="setup-stage-item" key={step.id}>
              <span>{step.step}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <p className="muted">
                  <strong>Booking:</strong> {step.bookingImpact}
                </p>
                <p className="muted">
                  <strong>Payout:</strong> {step.payoutImpact}
                </p>
                <div className="participant-list">
                  <span className={`pill ${pillClass(step.tone)}`}>{step.status}</span>
                  <span className="pill pill-info">{step.owner}</span>
                </div>
              </div>
              <Link className="text-link" href={step.href}>
                {step.action}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner ops command center</h2>
            <p className="muted">
              One-page operating view for dispatch, payout, reports, and the next admin action.
            </p>
          </div>
          <span className={`pill ${opsSummary.ready ? 'pill-success' : 'pill-warn'}`}>
            {opsSummary.ready ? 'Operational' : 'Needs operator attention'}
          </span>
          <Link className="text-link" href="/operations-policy">
            Location freshness: {dispatchPolicy.locationFreshnessMinutes}m
          </Link>
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
            <Link className="text-link" href={`/partner-controls?q=${encodeURIComponent(provider.id)}`}>
              Reports desk
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
              <div className="actions">
                {hasCashFeeDebt ? (
                  <Link className="text-link" href="/cash-settlements">
                    Cash debt queue
                  </Link>
                ) : null}
                <Link className="text-link" href="/earnings">
                  Open earnings
                </Link>
              </div>
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
                        {earning.bookingId ? `Booking ${shortRecordId(earning.bookingId)} / ` : ''}
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
              legal consent, and account activity. Use this as the first review map before approving or
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
            <h2>Device and session activity</h2>
            <p className="muted">
              Review shared devices, session checks, blocked devices, and stale partner app activity.
            </p>
          </div>
          <span className={`pill ${securitySummary.followUpNeeded ? 'pill-danger' : 'pill-success'}`}>
            {securitySummary.followUpNeeded ? 'Follow-up needed' : 'No active follow-up'}
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
                    <span>{session.suspicious ? 'CHECK' : 'OK'}</span>
                    <div>
                      <strong>{maskDeviceId(session.deviceId)}</strong>
                      <p className="muted">
                        IP {session.ipAddress ?? 'missing'} / {session.appVersion ?? 'unknown app'} / last
                        seen {formatDate(session.lastSeenAt)}
                      </p>
                      {session.suspiciousReason ? (
                        <p className="muted">Session note: {displaySessionCheckText(session.suspiciousReason)}</p>
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
            <h2>Reports and account controls</h2>
            <p className="muted">
              Keep customer complaints, staff findings, payout holds, and account blocks visible on the
              partner profile.
            </p>
          </div>
          <Link className="text-link" href={`/partner-controls?q=${encodeURIComponent(provider.id)}`}>
            Open reports desk
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
              <option value="HIGH">Major</option>
              <option value="CRITICAL">Urgent</option>
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
            <input name="summary" placeholder="Short report summary" required />
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
              <h3>Manual account control</h3>
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
              <small>{shortRecordId(payoutHold.id)}</small>
            </div>
          ) : null}
          <form className="form-grid" action={createProviderSanction}>
            <input type="hidden" name="providerProfileId" value={provider.id} />
            <label>
              Control type
              <select name="type" defaultValue="PAYOUT_HOLD">
                <option value="WARNING">Warning</option>
                <option value="PAYOUT_HOLD">Payout hold</option>
                <option value="ACCOUNT_BLOCK">Account block</option>
                <option value="TRUST_BADGE_REMOVAL">Profile review hold</option>
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
              <button type="submit">Apply account control</button>
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
                        <span className={`pill ${reportSeverityPill(report.severity)}`}>{report.severity}</span>
                        <span className={`pill ${reportStatusPill(report.status)}`}>{report.status}</span>
                        {report.bookingId ? (
                          <Link className="text-link" href={`/bookings/${report.bookingId}`}>
                            Booking {shortRecordId(report.bookingId)}
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
                          <option value="HIGH">Major</option>
                          <option value="CRITICAL">Urgent</option>
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
                          <option value="TRUST_BADGE_REMOVAL">Profile review hold</option>
                        </select>
                        <input
                          name="reason"
                          placeholder="Control reason"
                          required
                          minLength={12}
                          maxLength={500}
                        />
                        <button type="submit">Apply control</button>
                      </form>
                    </div>
                    <small>{shortRecordId(report.id)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No partner reports recorded yet.</p>
            )}
          </div>
          <div>
            <h3>Recent account controls</h3>
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
                          <button type="submit">Lift control</button>
                        </form>
                      ) : null}
                    </div>
                    <small>{shortRecordId(sanction.id)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No active or historical account control recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner level path</h2>
            <p className="muted">
              Operator view of Level 1 signup, Level 2 activity, Level 3 payout, and optional profile review
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
          <InfoLine label="Feedback records" value={`${provider.reviewCount ?? 0} review(s) saved`} />
          <InfoLine label="Next available" value={formatDate(provider.nextAvailableAt)} />
          <InfoLine label="Profile review completed at" value={formatDate(provider.trustedAt)} />
          <InfoLine label="User name" value={provider.user?.fullName} />
          <InfoLine label="Supabase user" value={provider.user?.supabaseUserId} />
          <p className="muted">
            {provider.verification?.rejectionReason ?? provider.bio ?? 'No notes saved.'}
          </p>
        </div>

        <div className="card" id="kyc">
          <h2>KYC decision</h2>
          <div className="participant-list" style={{ marginBottom: 10 }}>
            <span className={`pill ${provider.kyc?.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
              KYC {provider.kyc?.status ?? 'MISSING'}
            </span>
            <span className={`pill ${kycEvidence.allRequiredApproved ? 'pill-success' : 'pill-danger'}`}>
              {kycEvidence.allRequiredApproved ? 'Evidence complete' : 'Evidence incomplete'}
            </span>
          </div>
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
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {kycEvidence.decisionChecklist.map((item) => (
              <div className="setup-stage-item" key={item.label}>
                <span>{item.ok ? 'OK' : 'FIX'}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
                <small>{item.ok ? 'Clear' : 'Needs review'}</small>
              </div>
            ))}
          </div>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {kycEvidence.rows.map((row) => (
              <div className="setup-stage-item" key={row.type}>
                <span>{row.status === 'APPROVED' ? 'OK' : 'CHECK'}</span>
                <div>
                  <strong>{row.label}</strong>
                  <p className="muted">
                    {row.status} / {row.fileLabel}
                    {row.uploadedAt ? ` / uploaded ${formatDate(row.uploadedAt)}` : ''}
                  </p>
                  {row.rejectionReason ? <p className="muted">Rejection: {row.rejectionReason}</p> : null}
                </div>
                <small>{row.status}</small>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            {kycEvidence.nextAction}
          </p>
        </div>

        <div className="card" id="service-pricing">
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

        <div className="card" id="documents">
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
                    marketplaceDisplayText(document.fileAsset?.key ?? 'No file key')
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

        <div className="card" id="media">
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
                      {marketplaceDisplayText(file.key)}
                    </a>
                  ) : (
                    marketplaceDisplayText(file.key)
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

        <div className="card" id="bank">
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

        <div className="card" id="tax">
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

        <div className="card" id="location">
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
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}

function marketplaceDisplayText(value: string) {
  return value
    .replace(/\bbackup\b/g, 'marketplace')
    .replace(/\bBackup\b/g, 'Marketplace')
    .replace(/\bProvider\b/g, 'Partner')
    .replace(/\bprovider\b/g, 'partner');
}

function displaySessionCheckText(value?: string | null) {
  const text = value?.trim() || 'Session check';

  return marketplaceDisplayText(text)
    .replace(/\bsuspicious session\b/gi, 'session check')
    .replace(/\bsuspicious\b/gi, 'session check')
    .replace(/\bfraud\b/gi, 'account review')
    .replace(/\bmisuse\b/gi, 'account review')
    .replace(/\babuse controls\b/gi, 'account controls')
    .replace(/\btrusted partner\b/gi, 'active partner');
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

type BookingAcceptanceGate = {
  label: string;
  ok: boolean;
  detail: string;
  action: string;
};

type PartnerAcceptanceUnblockStep = {
  id: string;
  step: string;
  owner: 'Finance' | 'Account' | 'KYC' | 'Dispatch' | 'Ops';
  title: string;
  status: string;
  detail: string;
  bookingImpact: string;
  payoutImpact: string;
  action: string;
  href: string;
  tone: ProviderOpsCard['tone'];
  bookingBlocked: boolean;
};

type PartnerDetailOpsBadge = {
  label: string;
  detail: string;
  tone: ProviderOpsCard['tone'];
};
type PartnerOperatingChecklistItem = {
  area: string;
  status: string;
  detail: string;
  nextAction: string;
  href: string;
  tone: ProviderOpsCard['tone'];
};

type PartnerOperatingLedgerRow = {
  area: string;
  status: string;
  evidence: string;
  href: string;
};

type PartnerAcceptanceRepairCommand = {
  status: string;
  tone: ProviderOpsCard['tone'];
  partnerAppMessage: string;
  customerImpact: string;
  operatorDecision: string;
  marketplaceRouting: string;
  steps: Array<{
    owner: string;
    blocker: string;
    reason: string;
    operatorAction: string;
    href: string;
    actionLabel: string;
    tone: ProviderOpsCard['tone'];
  }>;
};
type PartnerBookingArchiveRecord = {
  relation: 'Preferred' | 'Selected' | 'Joined';
  booking: PartnerDetailBooking;
  lastMessage: string | null;
};
type PartnerActivityRecord = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail: string;
};
type PartnerDailyActivityDigest = {
  key: string;
  label: string;
  total: number;
  latestAt?: string;
  typeCounts: Array<{ type: string; count: number }>;
  highlights: PartnerActivityRecord[];
};
type PartnerOperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: ProviderOpsCard['tone'];
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'approve-profile'; label: string }
    | { type: 'sync-role'; label: string }
    | { type: 'unblock-account'; label: string }
    | { type: 'approve-kyc'; label: string }
    | { type: 'approve-bank'; bankAccountId: string; label: string }
    | { type: 'approve-tax'; label: string };
};

function partnerActivityRecordHref(record: PartnerActivityRecord) {
  if (['BOOKING', 'CHAT'].includes(record.type)) return '#booking-chat-records';
  if (['EARNING', 'PAYOUT'].includes(record.type)) return '#payout';
  if (['LOCATION', 'SESSION', 'DEVICE', 'ACCOUNT'].includes(record.type)) return '#app-activity';
  if (
    ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'].includes(
      record.type,
    )
  ) {
    return '#documents';
  }
  return '#app-activity';
}

function PartnerOperatorCommandAction({
  providerId,
  command,
}: {
  providerId: string;
  command: PartnerOperatorCommand;
}) {
  if (command.action.type === 'link') {
    return (
      <Link className="text-link" href={command.action.href}>
        {command.action.label}
      </Link>
    );
  }

  if (command.action.type === 'approve-profile') {
    return (
      <form action={approveProvider}>
        <input type="hidden" name="providerId" value={providerId} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  if (command.action.type === 'sync-role') {
    return (
      <form action={syncSupabaseProviderRole}>
        <input type="hidden" name="providerId" value={providerId} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  if (command.action.type === 'unblock-account') {
    return (
      <form action={unblockProviderAccount}>
        <input type="hidden" name="providerId" value={providerId} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  if (command.action.type === 'approve-kyc') {
    return (
      <form action={approveProviderKyc}>
        <input type="hidden" name="providerId" value={providerId} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  if (command.action.type === 'approve-bank') {
    return (
      <form action={approveProviderBankAccount}>
        <input type="hidden" name="providerId" value={providerId} />
        <input type="hidden" name="bankAccountId" value={command.action.bankAccountId} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  return (
    <form action={approveProviderTaxProfile}>
      <input type="hidden" name="providerId" value={providerId} />
      <button type="submit">{command.action.label}</button>
    </form>
  );
}

function PartnerDetailReadinessSnapshot({
  provider,
  bookingAcceptance,
  payoutOps,
  dispatchPolicy,
}: {
  provider: ProviderDetail;
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>;
  payoutOps: ReturnType<typeof buildProviderPayoutOps>;
  dispatchPolicy: PartnerDispatchPolicy;
}) {
  const badges = buildPartnerDetailOpsBadges(provider, bookingAcceptance, payoutOps, dispatchPolicy);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="risk-watch-header">
        <div>
          <h2>Partner readiness snapshot</h2>
          <p className="muted">
            Fast operating signals for dispatch, marketplace matching, cash settlement, KYC, payout, and service
            readiness.
          </p>
        </div>
        <span className={`pill ${pillClass(bookingAcceptance.tone)}`}>{bookingAcceptance.status}</span>
      </div>
      <div className="participant-list" style={{ marginTop: 12 }}>
        {badges.map((badge) => (
          <span className={`pill ${pillClass(badge.tone)}`} key={badge.label} title={badge.detail}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="setup-stage-item" style={{ marginTop: 16 }}>
        <span>{bookingAcceptance.canAccept ? 'GO' : 'HOLD'}</span>
        <div>
          <strong>{bookingAcceptance.canAccept ? 'Ready for dispatch' : 'Top blocker'}</strong>
          <p className="muted">{bookingAcceptance.primaryReason}</p>
        </div>
        <small>
          {bookingAcceptance.canAccept
            ? `Marketplace radius ${formatDistance(dispatchPolicy.backupRadiusMeters)}`
            : 'Resolve gate'}
        </small>
      </div>
    </div>
  );
}

function PartnerAcceptanceRepairCommandPanel({
  provider,
  bookingAcceptance,
  payoutOps,
  dispatchPolicy,
}: {
  provider: ProviderDetail;
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>;
  payoutOps: ReturnType<typeof buildProviderPayoutOps>;
  dispatchPolicy: PartnerDispatchPolicy;
}) {
  const command = buildPartnerAcceptanceRepairCommand(provider, bookingAcceptance, payoutOps, dispatchPolicy);

  return (
    <div className={`card ${cardClass(command.tone)}`} style={{ marginBottom: 16 }}>
      <div className="risk-watch-header">
        <div>
          <h2>Final-gate repair command</h2>
          <p className="muted">
            Exact operator diagnosis for final acceptance, customer selection, marketplace visibility, and
            participation.
          </p>
        </div>
        <span className={`pill ${pillClass(command.tone)}`}>{command.status}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        <div>
          <span>Partner app block message</span>
          <strong>{command.partnerAppMessage}</strong>
          <small>What support should expect the partner to see.</small>
        </div>
        <div>
          <span>Customer impact</span>
          <strong>{command.customerImpact}</strong>
          <small>How this affects customer choice and matching.</small>
        </div>
        <div>
          <span>Operator decision</span>
          <strong>{command.operatorDecision}</strong>
          <small>Use this before manual override or dispatch.</small>
        </div>
        <div>
          <span>Marketplace routing</span>
          <strong>{command.marketplaceRouting}</strong>
          <small>Where live demand should go while blocked.</small>
        </div>
      </div>
      <div className="setup-stage-list" style={{ marginTop: 16 }}>
        {command.steps.map((step, index) => (
          <div className="setup-stage-item" key={`${step.owner}-${step.blocker}`}>
            <span>{index + 1}</span>
            <div>
              <strong>
                {step.owner}: {step.blocker}
              </strong>
              <p className="muted">{step.reason}</p>
              <p className="muted">{step.operatorAction}</p>
              <span className={`pill ${pillClass(step.tone)}`}>
                {step.tone === 'done'
                  ? 'Clear'
                  : step.tone === 'blocked'
                    ? 'Blocks booking'
                    : 'Operator check'}
              </span>
            </div>
            <Link className="text-link" href={step.href}>
              {step.actionLabel}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPartnerOperatorCommandQueue({
  provider,
  primaryBank,
  payoutOps,
  bookingAcceptance,
  providerServicePricing,
  dispatchPolicy,
  canApproveKyc,
}: {
  provider: ProviderDetail;
  primaryBank: ReturnType<typeof primaryBankAccount>;
  payoutOps: ReturnType<typeof buildProviderPayoutOps>;
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>;
  providerServicePricing: ReturnType<typeof buildProviderServicePricing>;
  dispatchPolicy: PartnerDispatchPolicy;
  canApproveKyc: boolean;
}) {
  const commands: PartnerOperatorCommand[] = [];
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const cashDebt = cashFeeDebtAmount(provider);
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const pushDeviceCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const locationAge = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const locationFresh = locationAge <= dispatchPolicy.locationFreshnessMinutes;
  const profileApproved = provider.verification?.status === 'APPROVED';
  const kycApproved = provider.kyc?.status === 'APPROVED';

  const add = (command: PartnerOperatorCommand) => commands.push(command);

  if (provider.blockedAt) {
    add({
      id: 'account-block',
      label: 'ACCOUNT',
      title: 'Account is blocked',
      detail: provider.blockedReason ?? 'Partner account is on hold. Review before restoring app access.',
      owner: 'Account control',
      tone: 'blocked',
      action: { type: 'unblock-account', label: 'Unblock' },
    });
  }

  if (cashDebt > 0) {
    add({
      id: 'cash-fee-debt',
      label: 'CASH',
      title: 'Cash fee debt gates final acceptance',
      detail: `${formatCurrency(cashDebt)} must be settled before this partner completes final acceptance or customer selection.`,
      owner: 'Finance',
      tone: 'blocked',
      action: { type: 'link', href: '/cash-settlements', label: 'Open cash queue' },
    });
  }

  if (canApproveKyc && !kycApproved) {
    add({
      id: 'kyc-approve',
      label: 'KYC',
      title: 'KYC evidence is ready for approval',
      detail: 'Required CCCD front/back and selfie evidence are approved. Operator can approve KYC.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'approve-kyc', label: 'Approve KYC' },
    });
  } else if (missingDocuments.length > 0) {
    add({
      id: 'kyc-documents',
      label: 'KYC',
      title: 'KYC documents need review',
      detail: `Missing or not approved: ${missingDocuments.join(', ')}.`,
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'link', href: '#documents', label: 'Open docs' },
    });
  }

  if (kycApproved && !profileApproved) {
    add({
      id: 'profile-approve',
      label: 'PROFILE',
      title: 'Public partner profile can be approved',
      detail: 'KYC is approved. Review profile, photos, service area, and public-facing text before approval.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'approve-profile', label: 'Approve profile' },
    });
  }

  if (primaryBank && primaryBank.status !== 'APPROVED') {
    add({
      id: 'bank-review',
      label: 'BANK',
      title: 'Bank account needs approval',
      detail: `${marketplaceDisplayText(primaryBank.bankName ?? 'Bank')} / ${marketplaceDisplayText(
        primaryBank.accountHolderName ?? 'holder missing',
      )} / ${primaryBank.status}.`,
      owner: 'Finance',
      tone: 'pending',
      action: { type: 'approve-bank', bankAccountId: primaryBank.id, label: 'Approve bank' },
    });
  } else if (!primaryBank) {
    add({
      id: 'bank-missing',
      label: 'BANK',
      title: 'Bank account is missing',
      detail: 'Partner can start onboarding lightly, but payout needs an approved account later.',
      owner: 'Finance',
      tone: hasFirstRevenue ? 'blocked' : 'pending',
      action: { type: 'link', href: '#bank', label: 'Open bank' },
    });
  }

  if (hasFirstRevenue && provider.taxProfile?.status === 'PENDING') {
    add({
      id: 'tax-approve',
      label: 'TAX',
      title: 'Tax profile ready after first earning',
      detail: 'Partner has revenue and tax profile is pending. Approve only after checking MST/address/identity match.',
      owner: 'Finance',
      tone: 'pending',
      action: { type: 'approve-tax', label: 'Approve tax' },
    });
  } else if (hasFirstRevenue && provider.taxProfile?.status !== 'APPROVED') {
    add({
      id: 'tax-needed',
      label: 'TAX',
      title: 'Tax profile required before payout',
      detail: `Tax status is ${provider.taxProfile?.status ?? 'MISSING'}. Keep dispatch logic separate from payout gating.`,
      owner: 'Finance',
      tone: 'blocked',
      action: { type: 'link', href: '#tax', label: 'Open tax' },
    });
  }

  if (providerServicePricing.readyCount === 0) {
    add({
      id: 'service-pricing',
      label: 'SERVICE',
      title: 'No bookable service option',
      detail: 'Partner needs at least one service duration priced at or above the admin minimum before customers can book.',
      owner: 'Catalog',
      tone: 'blocked',
      action: { type: 'link', href: '#service-pricing', label: 'Open services' },
    });
  }

  if (!locationFresh) {
    add({
      id: 'location-refresh',
      label: 'LOC',
      title: 'Location refresh needed',
      detail: `Last location is ${provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : 'missing'}. Booking discovery uses last saved location only.`,
      owner: 'Dispatch',
      tone: bookingAcceptance.canAccept ? 'pending' : 'blocked',
      action: { type: 'link', href: '#location', label: 'Open location' },
    });
  }

  if (pushDeviceCount === 0) {
    add({
      id: 'push-device',
      label: 'APP',
      title: 'No reachable app device',
      detail: 'Partner should sign in on the real app so request alerts can be delivered.',
      owner: 'Support',
      tone: 'pending',
      action: { type: 'link', href: '#app-activity', label: 'Open app activity' },
    });
  }

  if (!bookingAcceptance.canAccept && commands.every((command) => command.id !== 'cash-fee-debt')) {
    add({
      id: 'acceptance-gate',
      label: 'ACCEPT',
      title: 'Final booking gate is on hold',
      detail: bookingAcceptance.primaryReason,
      owner: 'Dispatch',
      tone: 'blocked',
      action: { type: 'link', href: '#partner-operating-checklist', label: 'Open gates' },
    });
  }

  if (payoutOps.tone !== 'done' && commands.every((command) => !command.id.startsWith('tax-'))) {
    add({
      id: 'payout-gate',
      label: 'PAYOUT',
      title: `Payout ${payoutOps.status.toLowerCase()}`,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout setup is not fully clear.',
      owner: 'Finance',
      tone: payoutOps.tone,
      action: { type: 'link', href: '#payout', label: 'Open payout' },
    });
  }

  if (commands.length === 0) {
    add({
      id: 'normal-monitoring',
      label: 'OK',
      title: 'Normal partner monitoring',
      detail: 'No immediate operator action is visible. Continue monitoring bookings, app activity, and payout records.',
      owner: 'Operations',
      tone: 'done',
      action: { type: 'link', href: '#booking-chat-records', label: 'Open records' },
    });
  }

  const urgentCount = commands.filter((command) => command.tone === 'blocked').length;
  const pendingCount = commands.filter((command) => command.tone === 'pending').length;
  const queueTone: ProviderOpsCard['tone'] = urgentCount ? 'blocked' : pendingCount ? 'pending' : 'done';

  return {
    status: urgentCount ? `${urgentCount} blocker(s)` : pendingCount ? `${pendingCount} check(s)` : 'Clear',
    tone: queueTone,
    metrics: [
      {
        label: 'Final gates',
        value: bookingAcceptance.canAccept ? 'Ready' : 'Hold',
        helper: bookingAcceptance.primaryReason,
      },
      {
        label: 'Cash fee debt',
        value: formatCurrency(cashDebt),
        helper: cashDebt > 0 ? 'Holds final gates until settled.' : 'No cash fee debt.',
      },
      {
        label: 'First revenue',
        value: hasFirstRevenue ? 'Yes' : 'No',
        helper: hasFirstRevenue ? 'Tax/payout gates apply.' : 'Keep onboarding light.',
      },
      {
        label: 'App reachability',
        value: `${pushDeviceCount} device(s)`,
        helper: locationFresh ? 'Location fresh enough.' : 'Location refresh needed.',
      },
    ],
    commands: commands.slice(0, 10),
  };
}

function buildPartnerBookingArchive(provider: ProviderDetail): PartnerBookingArchiveRecord[] {
  const records = new Map<string, PartnerBookingArchiveRecord>();

  for (const booking of provider.preferredBookings ?? []) {
    records.set(`${booking.id}:Preferred`, {
      relation: 'Preferred',
      booking,
      lastMessage: lastBookingMessage(booking),
    });
  }
  for (const booking of provider.selectedBookings ?? []) {
    records.set(`${booking.id}:Selected`, {
      relation: 'Selected',
      booking,
      lastMessage: lastBookingMessage(booking),
    });
  }
  for (const participant of provider.participants ?? []) {
    if (!participant.booking) continue;
    records.set(`${participant.booking.id}:Joined`, {
      relation: 'Joined',
      booking: participant.booking,
      lastMessage: lastBookingMessage(participant.booking),
    });
  }

  return [...records.values()].sort(
    (left, right) =>
      dateValue(right.booking.scheduledStartAt ?? right.booking.createdAt) -
      dateValue(left.booking.scheduledStartAt ?? left.booking.createdAt),
  );
}

function buildPartnerActivityRecords(
  provider: ProviderDetail,
  bookings: PartnerBookingArchiveRecord[],
): PartnerActivityRecord[] {
  const records: PartnerActivityRecord[] = [];

  if (provider.user?.createdAt) {
    records.push({
      id: provider.user.id ?? provider.id,
      type: 'ACCOUNT',
      at: provider.user.createdAt,
      title: 'Partner user account created',
      detail: `${marketplaceDisplayText(provider.legalName ?? provider.displayName ?? 'Unnamed partner')} / ${
        provider.user.phone ?? 'No phone'
      }`,
    });
  }

  for (const bookingRecord of bookings) {
    records.push({
      id: bookingRecord.booking.id,
      type: 'BOOKING',
      at: bookingRecord.booking.scheduledStartAt ?? bookingRecord.booking.createdAt ?? '',
      title: `${bookingRecord.relation} booking ${shortRecordId(bookingRecord.booking.id)}`,
      detail: `${bookingServiceLabel(bookingRecord.booking)} / ${bookingRecord.booking.status ?? 'UNKNOWN'} / customer ${partnerBookingCustomer(
        bookingRecord.booking,
      )}${isClosedPartnerBooking(bookingRecord.booking) ? ` / ${bookingClosureLabel(bookingRecord.booking)}` : ''}`,
    });
    if (isClosedPartnerBooking(bookingRecord.booking) && bookingRecord.booking.closedAt) {
      records.push({
        id: `${bookingRecord.booking.id}-closure`,
        type: 'BOOKING',
        at: bookingRecord.booking.closedAt,
        title: `Booking closed ${shortRecordId(bookingRecord.booking.id)}`,
        detail: bookingClosureLabel(bookingRecord.booking),
      });
    }
    if (bookingRecord.booking.chatRoom?.messages?.[0]) {
      const message = bookingRecord.booking.chatRoom.messages[0];
      records.push({
        id: message.id,
        type: 'CHAT',
        at: message.createdAt ?? bookingRecord.booking.createdAt ?? '',
        title: `Chat message in ${shortRecordId(bookingRecord.booking.id)}`,
        detail: `${message.sender?.fullName ?? message.sender?.phone ?? message.sender?.roles?.join(', ') ?? 'Unknown'}: ${trimText(
          message.body,
          90,
        )}`,
      });
    }
  }

  if (provider.verification?.submittedAt) {
    records.push({
      id: `${provider.verification.id}-submitted`,
      type: 'VERIFY',
      at: provider.verification.submittedAt,
      title: 'Partner verification submitted',
      detail: `${provider.verification.status} / ${provider.verification.files?.length ?? 0} attached file(s)`,
    });
  }

  if (provider.verification?.reviewedAt) {
    records.push({
      id: `${provider.verification.id}-reviewed`,
      type: 'VERIFY',
      at: provider.verification.reviewedAt,
      title: `Partner verification ${provider.verification.status.toLowerCase()}`,
      detail: provider.verification.rejectionReason ?? 'Admin review recorded.',
    });
  }

  if (provider.kyc?.submittedAt) {
    records.push({
      id: `${provider.kyc.id}-submitted`,
      type: 'VERIFY',
      at: provider.kyc.submittedAt,
      title: 'KYC evidence submitted',
      detail: `${provider.kyc.status} / CCCD last four ${
        provider.kyc.cccdNumberLast4 ? `****${provider.kyc.cccdNumberLast4}` : 'not stored'
      }`,
    });
  }

  if (provider.kyc?.reviewedAt) {
    records.push({
      id: `${provider.kyc.id}-reviewed`,
      type: 'VERIFY',
      at: provider.kyc.reviewedAt,
      title: `KYC ${provider.kyc.status.toLowerCase()}`,
      detail: provider.kyc.rejectionReason ?? 'KYC review recorded.',
    });
  }

  for (const document of provider.documents ?? []) {
    records.push({
      id: document.id,
      type: 'DOCUMENT',
      at: document.reviewedAt ?? document.fileAsset?.uploadedAt ?? '',
      title: `${providerDocumentLabel(document.type)} ${document.status.toLowerCase()}`,
      detail: `${document.fileAsset?.uploadStatus ?? 'No upload status'}${
        document.rejectionReason ? ` / ${document.rejectionReason}` : ''
      }`,
    });
  }

  for (const file of provider.user?.fileAssets ?? []) {
    records.push({
      id: file.id,
      type: 'PROFILE',
      at: file.reviewedAt ?? file.uploadedAt ?? file.createdAt ?? '',
      title: `${providerPublicMediaLabel(file.purpose)} ${file.reviewStatus ?? file.uploadStatus ?? 'recorded'}`,
      detail: `${file.visibility} / ${file.contentType}${file.reviewReason ? ` / ${file.reviewReason}` : ''}`,
    });
  }

  for (const bankAccount of provider.bankAccounts ?? []) {
    records.push({
      id: bankAccount.id,
      type: 'BANK',
      at: bankAccount.reviewedAt ?? '',
      title: `Bank account ${bankAccount.status.toLowerCase()}`,
      detail: `${marketplaceDisplayText(bankAccount.bankName)} / ${marketplaceDisplayText(bankAccount.accountHolderName)} / ${
        bankAccount.isPrimary ? 'primary' : 'secondary'
      }${bankAccount.rejectionReason ? ` / ${bankAccount.rejectionReason}` : ''}`,
    });
  }

  if (provider.taxProfile?.approvedAt) {
    records.push({
      id: provider.taxProfile.id,
      type: 'TAX',
      at: provider.taxProfile.approvedAt,
      title: `Tax profile ${provider.taxProfile.status.toLowerCase()}`,
      detail: `${marketplaceDisplayText(provider.taxProfile.legalName)} / tax code ${
        provider.taxProfile.taxCodeLast4 ? `****${provider.taxProfile.taxCodeLast4}` : 'not stored'
      }`,
    });
  }

  for (const agreement of provider.agreements ?? []) {
    records.push({
      id: agreement.id,
      type: 'AGREEMENT',
      at: agreement.acceptedAt,
      title: `${agreement.type} accepted`,
      detail: `Version ${agreement.version}`,
    });
  }

  for (const session of provider.sessions ?? []) {
    records.push({
      id: session.id,
      type: 'SESSION',
      at: session.lastSeenAt ?? session.loggedInAt ?? '',
      title: `Partner app session ${session.suspicious ? 'check saved' : 'recorded'}`,
      detail: `IP ${session.ipAddress ?? 'missing'} / app ${session.appVersion ?? 'unknown'} / device ${maskDeviceId(
        session.deviceId,
      )}`,
    });
  }

  for (const device of provider.devices ?? []) {
    records.push({
      id: device.id,
      type: 'DEVICE',
      at: device.lastSeenAt ?? device.updatedAt ?? device.createdAt ?? '',
      title: `Device ${device.blockedAt ? 'blocked' : device.enabled ? 'enabled' : 'disabled'}`,
      detail: `${device.platform ?? 'unknown platform'} / ${maskDeviceId(device.deviceId)}${
        device.blockReason ? ` / ${device.blockReason}` : ''
      }`,
    });
  }

  for (const snapshot of provider.locationSnapshots ?? []) {
    records.push({
      id: snapshot.id,
      type: 'LOCATION',
      at: snapshot.recordedAt,
      title: 'Location snapshot',
      detail: `${snapshot.lat}, ${snapshot.lng}`,
    });
  }

  for (const earning of provider.earnings ?? []) {
    records.push({
      id: earning.id,
      type: 'EARNING',
      at: earning.createdAt ?? earning.availableAt ?? earning.paidAt ?? '',
      title: `${earning.status} earning ${shortRecordId(earning.id)}`,
      detail: `Gross ${formatCurrency(earning.grossAmount)} / platform fee ${formatCurrency(
        earning.platformFee,
      )} / net ${formatCurrency(earning.netAmount)}`,
    });
  }

  for (const batch of provider.payoutBatches ?? []) {
    records.push({
      id: batch.id,
      type: 'PAYOUT',
      at: batch.createdAt ?? batch.paidAt ?? '',
      title: `${batch.status} payout batch ${shortRecordId(batch.id)}`,
      detail: `${formatCurrency(batch.totalNetAmount)}${batch.transferRef ? ` / ${batch.transferRef}` : ''}`,
    });
  }

  for (const report of provider.reports ?? []) {
    records.push({
      id: report.id,
      type: 'REPORT',
      at: report.createdAt,
      title: `${report.status} report ${report.category}`,
      detail: `${report.source} / ${report.summary}`,
    });
  }

  for (const sanction of provider.sanctions ?? []) {
    records.push({
      id: sanction.id,
      type: 'SANCTION',
      at: sanction.createdAt ?? sanction.startsAt ?? '',
      title: `${sanction.status} ${sanction.type}`,
      detail: `${sanction.reason}${
        sanction.liftedAt ? ` / lifted ${formatDate(sanction.liftedAt)}` : ''
      }${sanction.expiresAt ? ` / expires ${formatDate(sanction.expiresAt)}` : ''}`,
    });
  }

  for (const log of provider.verificationLogs ?? []) {
    records.push({
      id: log.id,
      type: 'VERIFY',
      at: log.createdAt,
      title: log.action,
      detail: `${log.fromStatus ?? 'none'} -> ${log.toStatus ?? 'none'} / ${
        log.actor?.fullName ?? log.actor?.phone ?? 'system'
      }`,
    });
  }

  for (const log of provider.auditLogs ?? []) {
    records.push({
      id: log.id,
      type: 'OPS',
      at: log.createdAt,
      title: log.action,
      detail: `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${auditLogNoteText(log)}`,
    });
  }

  return records
    .filter((record) => Number.isFinite(dateValue(record.at)))
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
}

function buildPartnerActivitySummary(records: PartnerActivityRecord[]) {
  const financeTypes = new Set(['EARNING', 'PAYOUT']);
  const verificationTypes = new Set([
    'VERIFY',
    'DOCUMENT',
    'BANK',
    'TAX',
    'AGREEMENT',
    'REPORT',
    'SANCTION',
    'PROFILE',
    'OPS',
  ]);
  const count = (predicate: (record: PartnerActivityRecord) => boolean) => records.filter(predicate).length;
  const latestAt = records[0]?.at;
  const oldestAt = records[records.length - 1]?.at;

  return [
    {
      label: 'Range',
      value: latestAt ? formatDate(latestAt) : 'None',
      helper: oldestAt ? `Oldest loaded: ${formatDate(oldestAt)}` : 'No partner records loaded.',
    },
    {
      label: 'Bookings',
      value: count((record) => record.type === 'BOOKING').toString(),
      helper: 'Preferred, selected, and joined booking records.',
    },
    {
      label: 'Chat',
      value: count((record) => record.type === 'CHAT').toString(),
      helper: 'Booking messages visible in admin archive.',
    },
    {
      label: 'App and device',
      value: count((record) => ['ACCOUNT', 'SESSION', 'DEVICE'].includes(record.type)).toString(),
      helper: 'Account creation, login sessions, and device records.',
    },
    {
      label: 'Location',
      value: count((record) => record.type === 'LOCATION').toString(),
      helper: 'Last known location snapshots.',
    },
    {
      label: 'Finance',
      value: count((record) => financeTypes.has(record.type)).toString(),
      helper: 'Earnings and payout batches.',
    },
    {
      label: 'Verification and operations',
      value: count((record) => verificationTypes.has(record.type)).toString(),
      helper: 'KYC, documents, bank, tax, agreements, reports, account controls, media, and notes.',
    },
  ];
}

function buildPartnerDailyActivityDigest(records: PartnerActivityRecord[]): PartnerDailyActivityDigest[] {
  const grouped = new Map<string, PartnerActivityRecord[]>();

  for (const record of records) {
    const key = partnerActivityDateKey(record.at);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 14)
    .map(([key, dayRecords]) => {
      const typeCounts = [...countPartnerActivityTypes(dayRecords).entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([type, count]) => ({ type, count }));
      const sortedRecords = [...dayRecords].sort((left, right) => dateValue(right.at) - dateValue(left.at));

      return {
        key,
        label: formatPartnerActivityDateLabel(key),
        total: dayRecords.length,
        latestAt: sortedRecords[0]?.at,
        typeCounts,
        highlights: sortedRecords.slice(0, 4),
      };
    });
}

function countPartnerActivityTypes(records: Array<{ type: string }>) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
  }
  return counts;
}

function partnerActivityDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatPartnerActivityDateLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function buildPartnerMasterFacts(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
  primaryBank: NonNullable<ProviderDetail['bankAccounts']>[number] | null,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
) {
  const earnings = provider.earnings ?? [];
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED').length;
  const cancelledBookings = bookingArchive.filter((record) =>
    ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(record.booking.status ?? ''),
  ).length;
  const totalRevenue = earnings.reduce((sum, earning) => sum + Number(earning.grossAmount ?? 0), 0);
  const platformFee = earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0);
  const payoutReadyAmount = earnings
    .filter((earning) => earning.status === 'AVAILABLE')
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
  const latestAccessAt = latestPartnerAccessAt(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const activeReports = (provider.reports ?? []).filter((report) => report.status !== 'RESOLVED');

  return [
    {
      label: 'Partner ID',
      value: provider.id,
      helper: 'Internal admin identifier',
    },
    {
      label: 'Real / activity name',
      value: `${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} / ${
        provider.activityNickname ?? provider.displayName ?? 'No activity name'
      }`,
      helper: `Display name: ${marketplaceDisplayText(provider.displayName ?? 'Not saved')}`,
    },
    {
      label: 'Phone / email',
      value: provider.user?.phone ?? 'No phone',
      helper: provider.user?.email ?? 'No email',
    },
    {
      label: 'Gender / birth',
      value: `${provider.gender ?? 'Not saved'} / ${formatDate(provider.dateOfBirth)}`,
      helper: 'Basic partner profile field',
    },
    {
      label: 'Address / city',
      value: provider.residentialAddress ?? 'Residential address not saved',
      helper: provider.city ?? 'City not saved',
    },
    {
      label: 'Joined / recent access',
      value: formatDate(provider.user?.createdAt),
      helper: latestAccessAt ? `Recent app access ${formatDate(latestAccessAt)}` : 'No app session recorded',
    },
    {
      label: 'Current state',
      value: provider.status,
      helper: `${enabledPushCount} enabled push device(s)`,
    },
    {
      label: 'Verification level',
      value: provider.level ?? 'LEVEL_1_SIGNUP',
      helper: `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}`,
    },
    {
      label: 'Services',
      value: bookingAcceptance.bookableServices,
      helper: 'Bookable service price rows against admin pricing policy',
    },
    {
      label: 'Location',
      value: locationAgeLabel(provider.currentLocationUpdatedAt),
      helper:
        provider.currentLat && provider.currentLng
          ? `${provider.currentLat}, ${provider.currentLng}`
          : 'No GPS pin',
    },
    {
      label: 'Bookings',
      value: `${bookingArchive.length} total`,
      helper: `${completedBookings} completed / ${cancelledBookings} cancelled`,
    },
    {
      label: 'Feedback records',
      value: `${provider.reviewCount ?? 0} review(s)`,
      helper: 'Open the review section to read original customer feedback records',
    },
    {
      label: 'Revenue',
      value: formatCurrency(totalRevenue),
      helper: `Platform fee ${formatCurrency(platformFee)}`,
    },
    {
      label: 'Payout',
      value: payoutOps.status,
      helper: `Available ${formatCurrency(payoutReadyAmount)} / cash debt ${formatCurrency(
        cashFeeDebtAmount(provider),
      )}`,
    },
    {
      label: 'Tax profile',
      value: provider.taxProfile?.status ?? 'DEFERRED',
      helper: providerHasFirstRevenueSignal(provider)
        ? 'Tax profile required after first earning'
        : 'Tax profile can stay deferred until first earning',
    },
    {
      label: 'Bank account',
      value: primaryBank?.status ?? 'MISSING',
      helper: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${marketplaceDisplayText(primaryBank.accountHolderName)}`
        : 'No bank row',
    },
    {
      label: 'Account state',
      value: provider.blockedAt ? 'BLOCKED' : 'OPEN',
      helper: provider.blockedReason ?? 'No account block reason',
    },
    {
      label: 'Admin records',
      value: `${activeReports.length} open report(s) / ${activeSanctions.length} active control(s)`,
      helper: 'Factual admin records only',
    },
  ];
}

function buildPartnerOperatingChecklist(
  provider: ProviderDetail,
  primaryBank: NonNullable<ProviderDetail['bankAccounts']>[number] | null,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  providerServicePricing: ReturnType<typeof buildProviderServicePricing>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerOperatingChecklistItem[] {
  const cashDebt = cashFeeDebtAmount(provider);
  const missingKycDocs = missingApprovedRequiredKycDocuments(provider);
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const taxReady = provider.taxProfile?.status === 'APPROVED';
  const addressReady = Boolean(provider.residentialAddress?.trim());
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const locationFresh = locationMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const deviceCount = provider.devices?.length ?? 0;
  const sessionCount = provider.sessions?.length ?? 0;

  return [
    {
      area: 'Account',
      status: provider.blockedAt ? 'Account hold' : 'Account open',
      detail: provider.blockedAt
        ? (provider.blockedReason ?? 'Account is held by admin.')
        : 'No account hold is currently recorded.',
      nextAction: provider.blockedAt ? 'Review account hold' : 'No account action',
      href: `/partners/${provider.id}#admin`,
      tone: provider.blockedAt ? 'blocked' : 'done',
    },
    {
      area: 'Booking',
      status: bookingAcceptance.canAccept ? 'Final gate clear' : 'Final gate on hold',
      detail: bookingAcceptance.primaryReason,
      nextAction: bookingAcceptance.canAccept ? 'Ready for requests' : 'Resolve booking gate',
      href: `/partners/${provider.id}#booking-chat-records`,
      tone: bookingAcceptance.canAccept ? 'done' : 'blocked',
    },
    {
      area: 'Cash',
      status: cashDebt > 0 ? 'Cash fee debt exists' : 'Cash fee clear',
      detail:
        cashDebt > 0
          ? `Partner wallet has ${formatCurrency(cashDebt)} unpaid HANDS commission from cash bookings.`
          : 'No unpaid cash commission is gating final acceptance.',
      nextAction: cashDebt > 0 ? 'Collect or offset debt' : 'No cash action',
      href: '/cash-settlements',
      tone: cashDebt > 0 ? 'blocked' : 'done',
    },
    {
      area: 'KYC',
      status:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'KYC complete'
          : 'KYC needs review',
      detail:
        missingKycDocs.length > 0
          ? `Missing approved document(s): ${missingKycDocs.join(', ')}.`
          : `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}.`,
      nextAction: missingKycDocs.length > 0 ? 'Review documents' : 'Check verification',
      href: `/partners/${provider.id}#kyc`,
      tone:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'done'
          : provider.kyc?.status === 'REJECTED'
            ? 'blocked'
            : 'pending',
    },
    {
      area: 'Bank',
      status: primaryBank?.status === 'APPROVED' ? 'Bank approved' : 'Bank setup needed',
      detail: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${marketplaceDisplayText(primaryBank.accountHolderName)} / ${primaryBank.status}`
        : 'No primary bank account is saved.',
      nextAction: primaryBank?.status === 'APPROVED' ? 'Ready for payout' : 'Review bank account',
      href: `/partners/${provider.id}#bank`,
      tone: primaryBank?.status === 'APPROVED' ? 'done' : 'pending',
    },
    {
      area: 'Tax',
      status: hasFirstRevenue
        ? taxReady
          ? 'Tax profile ready'
          : 'Tax required after first earning'
        : 'Tax deferred',
      detail: hasFirstRevenue
        ? `Tax ${provider.taxProfile?.status ?? 'MISSING'} / address ${
            addressReady ? 'saved' : 'missing'
          } / agreements ${agreementsAccepted}.`
        : 'Do not force tax information before the first earning. Policy remains configured in admin.',
      nextAction: hasFirstRevenue && !taxReady ? 'Collect tax profile' : 'Review tax policy',
      href: hasFirstRevenue ? `/partners/${provider.id}#tax` : '/tax-policy',
      tone: hasFirstRevenue && !taxReady ? 'pending' : 'done',
    },
    {
      area: 'Payout',
      status: payoutOps.status,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate is clear or deferred.',
      nextAction: payoutOps.tone === 'done' ? 'No payout action' : 'Review payout gate',
      href: `/partners/${provider.id}#payout`,
      tone: payoutOps.tone,
    },
    {
      area: 'Services',
      status:
        providerServicePricing.readyCount > 0
          ? `${providerServicePricing.readyCount} bookable option(s)`
          : 'No bookable service price',
      detail: `${providerServicePricing.rows.length} service row(s) loaded. Prices must respect admin minimum and step policy.`,
      nextAction:
        providerServicePricing.readyCount > 0 ? 'Ready for service selection' : 'Fix service pricing',
      href: `/partners/${provider.id}#service-pricing`,
      tone: providerServicePricing.readyCount > 0 ? 'done' : 'blocked',
    },
    {
      area: 'Location',
      status: locationFresh ? 'Location fresh' : 'Location refresh needed',
      detail: `Last location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}; marketplace matching policy allows ${dispatchPolicy.locationFreshnessMinutes}m.`,
      nextAction: locationFresh ? 'Ready for distance checks' : 'Ask app reopen/location update',
      href: `/partners/${provider.id}#location`,
      tone: locationFresh ? 'done' : 'pending',
    },
    {
      area: 'App',
      status: enabledPushCount > 0 ? 'App reachable' : 'Push device missing',
      detail: `${enabledPushCount} enabled push device(s), ${deviceCount} device row(s), ${sessionCount} session row(s).`,
      nextAction: enabledPushCount > 0 ? 'Can receive alerts' : 'Register device token',
      href: `/partners/${provider.id}#app-activity`,
      tone: enabledPushCount > 0 ? 'done' : 'pending',
    },
  ];
}

function buildPartnerOperatingLedger(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
  primaryBank: NonNullable<ProviderDetail['bankAccounts']>[number] | null,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  providerServicePricing: ReturnType<typeof buildProviderServicePricing>,
): PartnerOperatingLedgerRow[] {
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED').length;
  const activeBookings = bookingArchive.filter((record) =>
    ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(
      record.booking.status ?? '',
    ),
  ).length;
  const chatRooms = bookingArchive.filter((record) => record.booking.chatRoom).length;
  const chatMessages = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const missingKycDocs = missingApprovedRequiredKycDocuments(provider);
  const verificationFileCount = provider.verification?.files?.length ?? 0;
  const documentCount = provider.documents?.length ?? 0;
  const cashDebt = cashFeeDebtAmount(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const sessionCount = provider.sessions?.length ?? 0;
  const deviceCount = provider.devices?.length ?? 0;
  const auditCount =
    (provider.auditLogs?.length ?? 0) +
    (provider.verificationLogs?.length ?? 0) +
    (provider.reports?.length ?? 0) +
    (provider.sanctions?.length ?? 0);

  return [
    {
      area: 'Identity',
      status: provider.legalName ? 'Profile linked' : 'Profile incomplete',
      evidence: `${marketplaceDisplayText(provider.legalName ?? 'No legal name')} / ${provider.user?.phone ?? 'No phone'} / ${
        provider.city ?? 'No city'
      }`,
      href: `/partners/${provider.id}#partner-master-facts`,
    },
    {
      area: 'KYC',
      status:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'KYC approved'
          : 'KYC review needed',
      evidence:
        missingKycDocs.length > 0
          ? `Missing: ${missingKycDocs.map(providerDocumentLabel).join(', ')}`
          : `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}`,
      href: `/partners/${provider.id}#kyc`,
    },
    {
      area: 'Documents',
      status: verificationFileCount + documentCount ? `${verificationFileCount + documentCount} file(s)` : 'No files',
      evidence: `${documentCount} typed document(s) / ${verificationFileCount} verification file(s)`,
      href: `/partners/${provider.id}#documents`,
    },
    {
      area: 'Bank',
      status: primaryBank?.status ?? 'MISSING',
      evidence: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${marketplaceDisplayText(primaryBank.accountHolderName)} / ${
            primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'unmasked'
          }`
        : 'No bank account row',
      href: `/partners/${provider.id}#bank`,
    },
    {
      area: 'Tax',
      status: provider.taxProfile?.status ?? (providerHasFirstRevenueSignal(provider) ? 'REQUIRED' : 'DEFERRED'),
      evidence: provider.taxProfile
        ? `${marketplaceDisplayText(provider.taxProfile.legalName)} / tax ****${provider.taxProfile.taxCodeLast4 ?? '----'}`
        : providerHasFirstRevenueSignal(provider)
          ? 'First earning exists; tax profile is required before payout.'
          : 'Tax profile intentionally deferred until first earning.',
      href: `/partners/${provider.id}#tax`,
    },
    {
      area: 'Services',
      status: `${providerServicePricing.readyCount}/${providerServicePricing.rows.length} bookable`,
      evidence: 'Prices must match admin minimum, step policy, and payout rule lines.',
      href: `/partners/${provider.id}#service-pricing`,
    },
    {
      area: 'Bookings',
      status: `${bookingArchive.length} total`,
      evidence: `${activeBookings} active / ${completedBookings} completed / ${bookingAcceptance.primaryReason}`,
      href: `/partners/${provider.id}#booking-chat-records`,
    },
    {
      area: 'Chat',
      status: `${chatRooms} room(s)`,
      evidence: `${chatMessages} retained message(s). Admin keeps archive after mobile chat hides.`,
      href: `/partners/${provider.id}#booking-chat-records`,
    },
    {
      area: 'Wallet',
      status: cashDebt > 0 ? 'Cash fee debt' : 'No cash fee block',
      evidence:
        cashDebt > 0
          ? `${formatCurrency(cashDebt)} unpaid company fee from cash booking flow.`
          : 'No negative cash-fee wallet state loaded.',
      href: `/partners/${provider.id}#payout`,
    },
    {
      area: 'Payout',
      status: payoutOps.status,
      evidence: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate clear or deferred.',
      href: `/partners/${provider.id}#payout`,
    },
    {
      area: 'Location',
      status: locationAgeLabel(provider.currentLocationUpdatedAt),
      evidence:
        provider.currentLat && provider.currentLng
          ? `${provider.currentLat}, ${provider.currentLng}`
          : 'No current location pin saved.',
      href: `/partners/${provider.id}#location`,
    },
    {
      area: 'App devices',
      status: `${enabledPushCount} push-ready`,
      evidence: `${sessionCount} session(s) / ${deviceCount} device(s)`,
      href: `/partners/${provider.id}#app-activity`,
    },
    {
      area: 'Admin trail',
      status: `${auditCount} record(s)`,
      evidence: `${provider.reports?.length ?? 0} report(s) / ${provider.sanctions?.length ?? 0} control row(s) / ${
        provider.auditLogs?.length ?? 0
      } audit row(s)`,
      href: `/partners/${provider.id}#partner-operator-notes`,
    },
  ];
}

function latestPartnerAccessAt(provider: ProviderDetail) {
  return [
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
  ]
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0];
}

function lastBookingMessage(booking: PartnerDetailBooking) {
  const message = booking.chatRoom?.messages?.[0];
  if (!message) return null;
  return trimText(message.body, 80);
}

function readPartnerChatMessages(booking: PartnerDetailBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

function chatSenderLabel(message: PartnerDetailChatMessage) {
  const role = message.sender?.roles?.includes('CUSTOMER')
    ? 'Customer'
    : message.sender?.roles?.includes('PROVIDER')
      ? 'Partner'
      : message.sender?.roles?.includes('ADMIN')
        ? 'Admin'
        : 'Sender';
  return `${role}: ${message.sender?.fullName ?? message.sender?.phone ?? 'Unknown'}`;
}

function bookingServiceLabel(booking: PartnerDetailBooking) {
  const labels = (booking.services ?? [])
    .map((item) => {
      const name = item.service?.name ?? 'Service';
      const duration = item.service?.durationMin ? ` ${item.service.durationMin}m` : '';
      return `${name}${duration}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service';
}

function partnerBookingCustomer(booking: PartnerDetailBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Unknown customer'
  );
}

function isClosedPartnerBooking(booking: PartnerDetailBooking) {
  return CLOSED_BOOKING_STATUSES.includes(booking.status ?? '');
}

function bookingClosureLabel(booking: PartnerDetailBooking) {
  const actor =
    booking.closedByRole === 'CUSTOMER'
      ? 'customer'
      : booking.closedByRole === 'PROVIDER'
        ? 'partner'
        : booking.closedByRole === 'ADMIN'
          ? 'admin'
          : 'system';
  const reason = booking.closedReason ? booking.closedReason.replace(/_/g, ' ') : 'no reason saved';
  const note = booking.closedNote ? ` / ${trimText(booking.closedNote, 90)}` : '';
  return `${actor} closure / ${reason}${note}`;
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function auditLogNoteText(log: AdminAuditLog) {
  const metadata = log.metadata && typeof log.metadata === 'object' ? (log.metadata as Record<string, unknown>) : {};
  const note = metadata.note ?? metadata.preset ?? metadata.reason ?? metadata.summary ?? metadata.status;
  if (typeof note === 'string' && note.trim()) {
    return trimText(note.trim(), 140);
  }
  return trimText(JSON.stringify(log.metadata ?? { action: log.action }), 140);
}

function dateValue(value?: string | null) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function buildProviderBookingAcceptance(
  provider: ProviderDetail,
  pricing: ReturnType<typeof buildProviderServicePricing>,
  dispatchPolicy = DEFAULT_PARTNER_DISPATCH_POLICY,
) {
  const cashDebt = cashFeeDebtAmount(provider);
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const hasPushDevice = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const hasRecentLocation =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const primaryBank = primaryBankAccount(provider);
  const pricingReady = pricing.readyCount > 0;
  const hasRequiredDocuments = hasApprovedRequiredKycDocuments(provider);
  const hasAccountBlock = Boolean(provider.blockedAt);

  const gates: BookingAcceptanceGate[] = [
    {
      label: 'Wallet and cash debt',
      ok: cashDebt <= 0,
      detail:
        cashDebt > 0
          ? `Partner owes HANDS ${formatCurrency(cashDebt)} from cash fee/tax settlement.`
          : 'No open negative wallet debt is visible.',
      action: cashDebt > 0 ? 'Record partner deposit or admin offset before final acceptance or customer selection.' : 'Clear',
    },
    {
      label: 'Account controls',
      ok: !hasAccountBlock && activeSanctions.length === 0,
      detail: hasAccountBlock
        ? `Account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`
        : activeSanctions.length > 0
          ? `${activeSanctions.length} active account control(s) require review.`
          : 'No account block or active account control is visible.',
      action: hasAccountBlock || activeSanctions.length > 0 ? 'Review reports desk' : 'Clear',
    },
    {
      label: 'Identity and approval',
      ok:
        provider.verification?.status === 'APPROVED' &&
        provider.kyc?.status === 'APPROVED' &&
        hasRequiredDocuments,
      detail:
        provider.verification?.status !== 'APPROVED'
          ? `Verification is ${provider.verification?.status ?? 'DRAFT'}.`
          : provider.kyc?.status !== 'APPROVED'
            ? `KYC is ${provider.kyc?.status ?? 'DRAFT'}.`
            : !hasRequiredDocuments
              ? `Missing approved documents: ${missingApprovedRequiredKycDocuments(provider)
                  .map(providerDocumentLabel)
                  .join(', ')}.`
              : 'Verification, KYC, and required documents are approved.',
      action:
        provider.verification?.status === 'APPROVED' &&
        provider.kyc?.status === 'APPROVED' &&
        hasRequiredDocuments
          ? 'Clear'
          : 'Finish review',
    },
    {
      label: 'Bank account',
      ok: hasApprovedBankAccount(provider),
      detail:
        primaryBank?.status === 'APPROVED'
          ? `Approved bank is available: ${marketplaceDisplayText(primaryBank.bankName)}.`
          : `Bank account is ${primaryBank?.status ?? 'missing'}.`,
      action: hasApprovedBankAccount(provider) ? 'Clear' : 'Approve bank',
    },
    {
      label: 'Online and reachable',
      ok: provider.status === 'ONLINE_AVAILABLE' && hasPushDevice,
      detail:
        provider.status !== 'ONLINE_AVAILABLE'
          ? `Partner status is ${provider.status}.`
          : !hasPushDevice
            ? 'No enabled push device is registered for booking alerts.'
            : 'Partner is online and has an enabled alert device.',
      action: provider.status === 'ONLINE_AVAILABLE' && hasPushDevice ? 'Clear' : 'Ask partner to open app',
    },
    {
      label: 'Location freshness',
      ok: hasRecentLocation,
      detail: hasRecentLocation
        ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}.`
        : `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`,
      action: hasRecentLocation ? 'Clear' : 'Refresh location',
    },
    {
      label: 'Bookable services',
      ok: pricingReady,
      detail: pricingReady
        ? `${pricing.readyCount} service price option(s) can be booked.`
        : 'No active partner service has a valid payout rule and customer price.',
      action: pricingReady ? 'Clear' : 'Fix service pricing',
    },
  ];

  const blockers = gates.filter((gate) => !gate.ok);
  const primaryReason = blockers[0]?.detail ?? 'All final booking gates are clear.';

  return {
    canAccept: blockers.length === 0,
    status: blockers.length === 0 ? 'CAN ACCEPT' : `${blockers.length} BLOCKER(S)`,
    tone: blockers.length === 0 ? ('done' as const) : ('blocked' as const),
    primaryReason,
    cashDebt,
    locationAge: locationAgeLabel(provider.currentLocationUpdatedAt),
    bookableServices: `${pricing.readyCount}/${pricing.rows.length}`,
    gates,
  };
}

function buildPartnerAcceptanceRepairCommand(
  provider: ProviderDetail,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerAcceptanceRepairCommand {
  const blockedGates = bookingAcceptance.gates.filter((gate) => !gate.ok);
  const status = bookingAcceptance.canAccept ? 'ACCEPT READY' : `${blockedGates.length} REPAIR STEP(S)`;
  const partnerAppMessage = partnerAppBlockMessage(provider, bookingAcceptance, payoutOps, dispatchPolicy);
  const customerImpact = bookingAcceptance.canAccept
    ? 'Can appear in customer booking flow and final partner choice.'
    : blockedGates.some((gate) =>
          ['Wallet and cash debt', 'Account controls', 'Identity and approval'].includes(gate.label),
        )
      ? 'Hide or avoid this partner for direct acceptance and marketplace shortlist until hard blockers are cleared.'
      : 'Partner may remain visible only after operator confirms freshness, reachability, and pricing.';
  const operatorDecision = bookingAcceptance.canAccept
    ? 'No manual repair required. Monitor service quality and response speed.'
    : `Start with ${blockedGates[0]?.label ?? 'the first visible blocker'} before considering dispatch.`;
  const marketplaceRouting = bookingAcceptance.canAccept
    ? `Eligible for first-pick and marketplace participation within ${formatDistance(dispatchPolicy.backupRadiusMeters)}.`
    : 'Route urgent demand to direct-ready or marketplace-ready partners while this repair queue is open.';

  const steps = blockedGates.map((gate) => partnerAcceptanceRepairStep(provider, gate));
  if (!steps.length) {
    steps.push({
      owner: 'Ops',
      blocker: 'No active blocker',
      reason: 'All final booking gates are currently clear for this partner.',
      operatorAction: 'Keep monitoring customer reviews, response speed, and location freshness.',
      href: `/partners/${provider.id}`,
      actionLabel: 'Open profile',
      tone: 'done',
    });
  }

  if (providerHasFirstRevenueSignal(provider) && payoutOps.status !== 'UNLOCKED') {
    steps.push({
      owner: 'Finance',
      blocker: 'Payout-only tax gate',
      reason:
        payoutOps.blockers[0] ??
        'First earning exists, so tax profile, address, agreements, and payout holds must be reviewed before withdrawal.',
      operatorAction:
        'Do not block the first job retroactively, but keep payout locked until tax and agreement requirements are complete.',
      href: `/partners/${provider.id}#payout`,
      actionLabel: 'Open payout gate',
      tone: 'pending',
    });
  }

  return {
    status,
    tone: bookingAcceptance.canAccept ? 'done' : 'blocked',
    partnerAppMessage,
    customerImpact,
    operatorDecision,
    marketplaceRouting,
    steps,
  };
}

function partnerAcceptanceRepairStep(
  provider: ProviderDetail,
  gate: BookingAcceptanceGate,
): PartnerAcceptanceRepairCommand['steps'][number] {
  const map: Record<
    string,
    {
      owner: string;
      href: string;
      actionLabel: string;
      tone: ProviderOpsCard['tone'];
    }
  > = {
    'Wallet and cash debt': {
      owner: 'Finance',
      href: '/cash-settlements',
      actionLabel: 'Open settlement',
      tone: 'blocked',
    },
    'Account controls': {
      owner: 'Account',
      href: `/partner-controls?q=${encodeURIComponent(provider.id)}`,
      actionLabel: 'Open reports',
      tone: 'blocked',
    },
    'Identity and approval': {
      owner: 'KYC',
      href: `/partners/${provider.id}#kyc`,
      actionLabel: 'Open KYC',
      tone: 'blocked',
    },
    'Bank account': {
      owner: 'Finance',
      href: `/partners/${provider.id}#bank`,
      actionLabel: 'Open bank',
      tone: 'blocked',
    },
    'Online and reachable': {
      owner: 'Ops',
      href: `/app-sessions?role=PROVIDER&q=${encodeURIComponent(provider.user?.phone ?? provider.id)}`,
      actionLabel: 'Open sessions',
      tone: 'pending',
    },
    'Location freshness': {
      owner: 'Dispatch',
      href: `/partners/${provider.id}#location`,
      actionLabel: 'Open location',
      tone: 'pending',
    },
    'Bookable services': {
      owner: 'Ops',
      href: '/services',
      actionLabel: 'Open services',
      tone: 'blocked',
    },
  };
  const config = map[gate.label] ?? {
    owner: 'Ops',
    href: `/partners/${provider.id}`,
    actionLabel: 'Open partner',
    tone: 'pending' as const,
  };

  return {
    owner: config.owner,
    blocker: gate.label,
    reason: gate.detail,
    operatorAction: gate.action,
    href: config.href,
    actionLabel: config.actionLabel,
    tone: config.tone,
  };
}

function partnerAppBlockMessage(
  provider: ProviderDetail,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dispatchPolicy: PartnerDispatchPolicy,
) {
  if (bookingAcceptance.canAccept) {
    return 'Partner can receive and finalize booking requests.';
  }
  if (bookingAcceptance.cashDebt > 0) {
    return 'Final acceptance or customer selection waits until unpaid HANDS commission is settled.';
  }
  if (provider.blockedAt || (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE')) {
    return 'Account requires admin review before receiving work.';
  }
  if (provider.verification?.status !== 'APPROVED' || provider.kyc?.status !== 'APPROVED') {
    return 'Identity verification must be approved before receiving paid work.';
  }
  if (!hasApprovedBankAccount(provider)) {
    return 'Bank account must be approved before receiving paid bookings.';
  }
  if (locationAgeMinutes(provider.currentLocationUpdatedAt) > dispatchPolicy.locationFreshnessMinutes) {
    return 'Open the app to refresh location before receiving requests.';
  }
  if (!(provider.user?.pushDevices ?? []).some((device) => device.enabled)) {
    return 'Open the app and enable alerts to receive booking requests.';
  }
  if (payoutOps.hold) {
    return 'Payout is held by admin review; booking may require operator confirmation.';
  }
  return 'Partner is temporarily unavailable for final booking flow.';
}

function buildPartnerAcceptanceUnblockPlaybook(
  provider: ProviderDetail,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
): PartnerAcceptanceUnblockStep[] {
  const gate = (label: string) => bookingAcceptance.gates.find((item) => item.label === label);
  const walletGate = gate('Wallet and cash debt');
  const accountGate = gate('Account controls');
  const identityGate = gate('Identity and approval');
  const bankGate = gate('Bank account');
  const locationGate = gate('Location freshness');
  const reachableGate = gate('Online and reachable');
  const serviceGate = gate('Bookable services');
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const payoutReady = payoutOps.status === 'UNLOCKED';
  const payoutGateOpen = !hasFirstRevenue || payoutReady;

  return [
    {
      id: 'cash-debt',
      step: '1',
      owner: 'Finance',
      title: 'Clear wallet and cash fee debt',
      status: walletGate?.ok ? 'CLEAR' : 'BLOCKING',
      detail: walletGate?.detail ?? 'Wallet gate was not evaluated.',
      bookingImpact: walletGate?.ok
        ? 'Partner can pass the cash-debt booking gate.'
        : 'Configured final gates wait until debt is settled or offset.',
      payoutImpact: 'Finance should not release payout while HANDS fee/tax debt is still open.',
      action: walletGate?.ok ? 'Open cash settlement history' : 'Settle cash debt',
      href: '/cash-settlements',
      tone: walletGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !walletGate?.ok,
    },
    {
      id: 'account-controls',
      step: '2',
      owner: 'Account',
      title: 'Resolve account controls',
      status: accountGate?.ok ? 'CLEAR' : 'CONTROL HOLD',
      detail: accountGate?.detail ?? 'Account gate was not evaluated.',
      bookingImpact: accountGate?.ok
        ? 'No account-level restriction is blocking work.'
        : 'Partner must stay hidden from assignment until account-control review is resolved.',
      payoutImpact: 'Active account controls can hold payout until support closes the case.',
      action: accountGate?.ok ? 'Open partner report history' : 'Open reports',
      href: `/partner-controls?q=${encodeURIComponent(provider.id)}`,
      tone: accountGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !accountGate?.ok,
    },
    {
      id: 'identity-bank',
      step: '3',
      owner: 'KYC',
      title: 'Finish KYC, required documents, and bank',
      status: identityGate?.ok && bankGate?.ok ? 'READY' : 'REVIEW',
      detail: `${identityGate?.detail ?? 'Identity gate missing.'} ${bankGate?.detail ?? 'Bank gate missing.'}`,
      bookingImpact:
        identityGate?.ok && bankGate?.ok
          ? 'Partner meets the Level 2 active-work gate.'
          : 'Blocks paid work access until identity evidence and bank readiness are approved.',
      payoutImpact: 'Approved bank is also required before partner payout can be prepared.',
      action: identityGate?.ok && bankGate?.ok ? 'Review KYC evidence' : 'Finish KYC and bank review',
      href: `/partners/${provider.id}#kyc`,
      tone: identityGate?.ok && bankGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !(identityGate?.ok && bankGate?.ok),
    },
    {
      id: 'location',
      step: '4',
      owner: 'Dispatch',
      title: 'Refresh location for 10km matching',
      status: locationGate?.ok ? 'FRESH' : 'STALE',
      detail: locationGate?.detail ?? 'Location gate was not evaluated.',
      bookingImpact: locationGate?.ok
        ? 'Partner location is usable for distance sorting and marketplace radius checks.'
        : 'Partner may be excluded from nearby marketplace matching or show unreliable distance.',
      payoutImpact: 'No direct payout impact, but location history can support dispute review.',
      action: locationGate?.ok ? 'Open location history' : 'Ask partner to open app',
      href: `/partners/${provider.id}#location`,
      tone: locationGate?.ok ? 'done' : 'pending',
      bookingBlocked: !locationGate?.ok,
    },
    {
      id: 'contactability',
      step: '5',
      owner: 'Ops',
      title: 'Confirm app reachability',
      status: reachableGate?.ok ? 'REACHABLE' : 'CONTACT GAP',
      detail: reachableGate?.detail ?? 'Reachability gate was not evaluated.',
      bookingImpact: reachableGate?.ok
        ? 'Partner should receive direct booking alerts during the response window.'
        : 'Partner may miss the 10 minute first-pick window or marketplace invite.',
      payoutImpact: 'No direct payout impact.',
      action: reachableGate?.ok ? 'Open app sessions' : 'Check devices and sessions',
      href: `/app-sessions?role=PROVIDER&q=${encodeURIComponent(provider.user?.phone ?? provider.id)}`,
      tone: reachableGate?.ok ? 'done' : 'pending',
      bookingBlocked: !reachableGate?.ok,
    },
    {
      id: 'service-pricing',
      step: '6',
      owner: 'Ops',
      title: 'Confirm bookable service pricing',
      status: serviceGate?.ok ? 'BOOKABLE' : 'PRICE GAP',
      detail: serviceGate?.detail ?? 'Service pricing gate was not evaluated.',
      bookingImpact: serviceGate?.ok
        ? 'At least one service option can be shown to customers.'
        : 'Customer app should hide partner services until the exact payout rule exists.',
      payoutImpact: 'Correct payout rules protect partner net, HANDS fee, tax, and cash debt calculations.',
      action: serviceGate?.ok ? 'Open service pricing' : 'Fix service pricing',
      href: '/services',
      tone: serviceGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !serviceGate?.ok,
    },
    {
      id: 'tax-after-first-earning',
      step: '7',
      owner: 'Finance',
      title: 'Collect tax only after first earning',
      status: payoutGateOpen ? (hasFirstRevenue ? 'PAYOUT READY' : 'DEFERRED') : 'PAYOUT GATE',
      detail: hasFirstRevenue
        ? (payoutOps.blockers[0] ??
          'First earning exists; verify tax, address, agreements, and payout holds.')
        : 'Do not force tax profile during initial signup. Keep tax policy configured, then collect partner tax data after first earning.',
      bookingImpact: 'This should not block the partner from receiving the first booking.',
      payoutImpact: payoutGateOpen
        ? 'No tax-related payout blocker is currently visible.'
        : 'Blocks withdrawal or payout until tax profile, address, and required agreements are complete.',
      action: hasFirstRevenue ? 'Open payout and tax gate' : 'Review tax policy',
      href: hasFirstRevenue ? `/partners/${provider.id}#payout` : '/tax-policy',
      tone: payoutGateOpen ? 'done' : 'pending',
      bookingBlocked: false,
    },
  ];
}

function buildPartnerDetailOpsBadges(
  provider: ProviderDetail,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerDetailOpsBadge[] {
  const cashDebt = cashFeeDebtAmount(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const locationFresh =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const gate = (label: string) => bookingAcceptance.gates.find((item) => item.label === label);
  const identityGate = gate('Identity and approval');
  const bankGate = gate('Bank account');
  const onlineGate = gate('Online and reachable');
  const serviceGate = gate('Bookable services');

  return [
    {
      label: bookingAcceptance.canAccept ? 'Direct accept ready' : 'Direct accept blocked',
      tone: bookingAcceptance.canAccept ? 'done' : 'blocked',
      detail: bookingAcceptance.primaryReason,
    },
    {
      label: bookingAcceptance.canAccept ? 'Marketplace candidate' : 'Marketplace not ready',
      tone: bookingAcceptance.canAccept ? 'done' : 'pending',
      detail: bookingAcceptance.canAccept
        ? `Can be considered inside ${formatDistance(dispatchPolicy.backupRadiusMeters)} during the ${dispatchPolicy.responseWindowMinutes}m response window.`
        : 'Marketplace matching uses the same control gates, plus booking-distance filtering.',
    },
    {
      label: cashDebt > 0 ? 'Cash debt' : 'Wallet clear',
      tone: cashDebt > 0 ? 'blocked' : 'done',
      detail:
        cashDebt > 0
          ? `Partner owes HANDS ${formatCurrency(cashDebt)} from cash settlement.`
          : 'No cash-settlement debt is gating final acceptance.',
    },
    {
      label: identityGate?.ok ? 'KYC and docs ok' : 'KYC/doc review',
      tone: identityGate?.ok ? 'done' : 'blocked',
      detail: identityGate?.detail ?? 'Identity gate has not been evaluated.',
    },
    {
      label: bankGate?.ok ? 'Bank approved' : 'Bank pending',
      tone: bankGate?.ok ? 'done' : 'pending',
      detail: bankGate?.detail ?? 'Bank gate has not been evaluated.',
    },
    {
      label: locationFresh ? 'Location fresh' : 'Refresh location',
      tone: locationFresh ? 'done' : 'pending',
      detail: `Last location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}; policy is ${dispatchPolicy.locationFreshnessMinutes}m.`,
    },
    {
      label: enabledPushCount > 0 ? 'Push ready' : 'Push missing',
      tone: enabledPushCount > 0 ? 'done' : 'pending',
      detail:
        enabledPushCount > 0
          ? `${enabledPushCount} enabled push device(s) can receive booking alerts.`
          : (onlineGate?.detail ?? 'No enabled push device is registered.'),
    },
    {
      label: serviceGate?.ok ? 'Services bookable' : 'Pricing needed',
      tone: serviceGate?.ok ? 'done' : 'blocked',
      detail: serviceGate?.detail ?? 'Service pricing gate has not been evaluated.',
    },
    {
      label: payoutOps.status === 'UNLOCKED' ? 'Payout unlocked' : `Payout ${payoutOps.status.toLowerCase()}`,
      tone: payoutOps.tone,
      detail:
        payoutOps.blockers[0] ??
        payoutOps.hold?.reason ??
        'Payout gate is deferred until first earning or already clear.',
    },
  ];
}

function buildProviderOpsSummary(provider: ProviderDetail, dispatchPolicy = DEFAULT_PARTNER_DISPATCH_POLICY) {
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const hasRecentLocation = locationMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const hasEnabledPush = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const requiredDocumentsReady = hasApprovedRequiredKycDocuments(provider);
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const payoutAgreementsReady = agreementsAccepted >= 5;
  const nextAction = nextProviderAction(provider, dispatchPolicy);
  const payoutHold = activePayoutHold(provider);
  const payoutReady =
    hasFirstRevenue &&
    hasApprovedBankAccount(provider) &&
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
            ? 'Partner is approved but not online for direct booking or marketplace matching.'
            : !hasRecentLocation
              ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}.`
              : !hasEnabledPush
                ? 'No enabled push device is registered for request alerts.'
                : 'Partner can receive customer direct requests and marketplace matching alerts.',
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
        ? 'Lift the control only after finance or account-control follow-up is resolved.'
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
  const earnings = provider.earnings ?? [];
  const payoutBatches = provider.payoutBatches ?? [];
  const payoutHold = activePayoutHold(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const hasAddress = Boolean(provider.residentialAddress?.trim());
  const bankApproved = hasApprovedBankAccount(provider);
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
        ? 'Resolve the finance or account-control reason before lifting the hold.'
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
  const sessionCheckSessions = sessions.filter((session) => session.suspicious);
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
      title: 'Session checks',
      status: sessionCheckSessions.length ? `${sessionCheckSessions.length} CHECK` : 'CLEAR',
      detail: sessionCheckSessions.length
        ? sessionCheckSessions
            .map((session) => displaySessionCheckText(session.suspiciousReason ?? 'Session check'))
            .join(' ')
        : 'No session check record is currently saved.',
      action: sessionCheckSessions.length
        ? 'Confirm identity and review recent app/device activity.'
        : 'No action.',
      tone: sessionCheckSessions.length ? 'blocked' : 'done',
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
    followUpNeeded: cards.some((card) => card.tone === 'blocked'),
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
  const hasBasicProfile = Boolean(
    provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim(),
  );
  const requiredDocumentsReady = hasApprovedRequiredKycDocuments(provider);
  const kycReady = provider.kyc?.status === 'APPROVED' && requiredDocumentsReady;
  const bankReady = hasApprovedBankAccount(provider);
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
        ? 'KYC, required documents, approved bank account, and partner verification are approved.'
        : level2Blockers({
            hasBasicProfile,
            kycReady,
            requiredDocumentsReady,
            bankReady,
            verificationReady,
          }).join(' '),
      operatorAction: level2Ready
        ? 'Partner can receive direct booking and marketplace matching work.'
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
      level: 'LEVEL 4 - Optional profile review',
      status: trustedReady ? 'REVIEWED' : level3Ready ? 'OPTIONAL' : 'LOCKED',
      detail: trustedReady
        ? 'Partner has an optional profile review record.'
        : level3Ready
          ? 'Partner is eligible for manual profile review after records are complete.'
          : 'Profile review should wait until payout-level compliance and service records are complete.',
      operatorAction: trustedReady
        ? 'Keep records current.'
        : level3Ready
          ? 'Review service evidence, service photos, reports, and customer feedback records.'
          : 'No profile review action yet.',
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
  if (!input.bankReady) blockers.push('No approved bank account is available.');
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
      target: `${marketplaceDisplayText(bankAccount.bankName)} bank account`,
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
  const bankComplete = hasApprovedBankAccount(provider);
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
      status: bankAccountStatusLabel(provider),
      detail: bankComplete
        ? 'An approved bank account is available for future payouts.'
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
      label: 'Device and session',
      ok: securityClear,
      status: securityClear ? 'CLEAR' : 'CHECK',
      detail: securityClear
        ? 'No account block, blocked partner device, or session check is active.'
        : 'A block, device issue, or session check needs admin review.',
      operatorAction: securityClear
        ? 'Continue normal monitoring.'
        : 'Review device/session section and reports desk before approval or payout.',
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

function reportSeverityPill(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function reportStatusPill(status: string) {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'pill-success';
  if (status === 'INVESTIGATING') return 'pill-warn';
  return 'pill-info';
}

function shortRecordId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function payoutBlockers(provider: ProviderDetail) {
  const blockers: string[] = [];
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const payoutHold = activePayoutHold(provider);

  if (payoutHold) {
    blockers.push(`Active payout hold: ${payoutHold.reason}.`);
  }
  if (!hasApprovedBankAccount(provider)) {
    blockers.push(`Bank ${bankAccountStatusLabel(provider)}.`);
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

function nextProviderAction(
  provider: ProviderDetail,
  dispatchPolicy = DEFAULT_PARTNER_DISPATCH_POLICY,
): ProviderOpsCard {
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
      action: 'Review report notes and lift the control only when payout can safely resume.',
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
  if (!hasApprovedBankAccount(provider)) {
    return {
      title: 'Next admin action',
      status: 'BANK',
      detail: `Bank account is ${bankAccountStatusLabel(provider).toLowerCase()}.`,
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
  if (locationAgeMinutes(provider.currentLocationUpdatedAt) > dispatchPolicy.locationFreshnessMinutes) {
    return {
      title: 'Next admin action',
      status: 'LOCATION',
      detail: `Location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`,
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

function buildReviewChecklist(provider: ProviderDetail, dispatchPolicy = DEFAULT_PARTNER_DISPATCH_POLICY) {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = primaryBankAccount(provider);
  const hasRecentLocation =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
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
      ok: hasApprovedBankAccount(provider),
      status: bankAccountStatusLabel(provider),
      detail: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${
            primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'unmasked'
          }`
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
        ? `Last shared at ${formatDate(provider.currentLocationUpdatedAt)}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`
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

function approvedBankAccount(provider: ProviderDetail) {
  return (provider.bankAccounts ?? []).find((bankAccount) => bankAccount.status === 'APPROVED') ?? null;
}

function primaryBankAccount(provider: ProviderDetail) {
  return approvedBankAccount(provider) ?? provider.bankAccounts?.[0] ?? null;
}

function hasApprovedBankAccount(provider: ProviderDetail) {
  return Boolean(approvedBankAccount(provider));
}

function bankAccountStatusLabel(provider: ProviderDetail) {
  return approvedBankAccount(provider)?.status ?? provider.bankAccounts?.[0]?.status ?? 'MISSING';
}

function hasApprovedRequiredKycDocuments(provider: ProviderDetail) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function buildPartnerKycEvidence(provider: ProviderDetail): PartnerKycEvidence {
  const rows = REQUIRED_KYC_DOCUMENTS.map((type) => {
    const document = (provider.documents ?? []).find((item) => item.type === type);
    return {
      type,
      label: providerDocumentLabel(type),
      status: document?.status ?? 'MISSING',
      uploadedAt: document?.fileAsset?.uploadedAt,
      rejectionReason: document?.rejectionReason,
      fileLabel: marketplaceDisplayText(document?.fileAsset?.contentType ?? document?.fileAsset?.key ?? 'No file uploaded'),
    };
  });
  const missingDocuments = rows.filter((row) => row.status !== 'APPROVED').map((row) => row.type);
  const allRequiredApproved = missingDocuments.length === 0;
  const rejectedDocuments = rows.filter((row) => row.status === 'REJECTED');
  const legalNameReady = Boolean(provider.legalName?.trim());
  const cccdReady = Boolean(provider.kyc?.cccdNumberLast4);
  const kycRecordReady = Boolean(provider.kyc);

  let nextAction = 'No KYC action required.';
  if (!provider.kyc) {
    nextAction = 'Ask the partner to submit CCCD/CMND number plus front, back, and selfie evidence.';
  } else if (!allRequiredApproved) {
    nextAction = `Approve or reject missing evidence first: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`;
  } else if (provider.kyc.status !== 'APPROVED') {
    nextAction = 'All required evidence is approved. Make the final KYC decision.';
  }

  return {
    allRequiredApproved,
    missingDocuments,
    nextAction,
    decisionChecklist: [
      {
        label: 'KYC record submitted',
        ok: kycRecordReady,
        detail: kycRecordReady
          ? `Submitted ${formatDate(provider.kyc?.submittedAt)}.`
          : 'Partner must submit identity data before admin can approve KYC.',
      },
      {
        label: 'Legal name present',
        ok: legalNameReady,
        detail: legalNameReady
          ? `Legal name: ${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')}.`
          : 'Ask the partner to complete the legal name used for CCCD and payout checks.',
      },
      {
        label: 'CCCD/CMND number captured',
        ok: cccdReady,
        detail: cccdReady
          ? `Stored as masked last four ****${provider.kyc?.cccdNumberLast4}.`
          : 'CCCD/CMND number is missing or has not been captured in the KYC record.',
      },
      {
        label: 'Required evidence approved',
        ok: allRequiredApproved,
        detail: allRequiredApproved
          ? 'CCCD front, CCCD back, and selfie are approved.'
          : `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      },
      {
        label: 'Rejected evidence resolved',
        ok: rejectedDocuments.length === 0,
        detail: rejectedDocuments.length
          ? `Rejected evidence still needs resubmission: ${rejectedDocuments
              .map((row) => row.label)
              .join(', ')}.`
          : 'No rejected identity evidence is blocking approval.',
      },
    ],
    rows,
  };
}

function missingApprovedRequiredKycDocuments(provider: ProviderDetail) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
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

function buildPartnerDispatchPolicy(settings: AdminOperationalPolicySetting[]): PartnerDispatchPolicy {
  return {
    responseWindowMinutes:
      readPolicyNumber(settings, MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.responseWindowMinutes,
    backupRadiusMeters:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.backupRadiusMeters,
    locationFreshnessMinutes:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.locationFreshnessMinutes,
  };
}

function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = settings.find((item) => item.key === key);
  if (!setting) return null;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function formatDistance(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${value.toLocaleString('en')} m`;
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

function cashFeeDebtAmount(provider: ProviderDetail) {
  return (provider.earnings ?? [])
    .filter(isCashFeeDebt)
    .reduce((total, earning) => total + Math.abs(amountValue(earning.netAmount)), 0);
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
