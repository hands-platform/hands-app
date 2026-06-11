import Link from 'next/link';
import { notFound } from 'next/navigation';
import type {
  AdminAuditLog,
  AdminOperationalPolicySetting,
  AdminProvider,
} from '../../../lib/admin-api';
import {
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import type { ActionMenuItem } from '../../../components/action-menu';
import { AdminTableScroll } from '../../../components/admin-data-table';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import {
  bookingLatestActivityAt,
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from '../../../lib/admin-booking-time';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { isWithinDetailDateFilter, readDetailDateFilters } from '../../../lib/detail-date-filter';
import {
  detailActivityTypeLabel,
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../lib/detail-activity-filter';
import { buildCsvDataHref } from '../../../lib/csv-export';
import { readSearchParam } from '../../../lib/date-range';
import {
  ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS,
  OPERATIONAL_POLICY_KEYS,
  readPositivePolicyNumber,
} from '../../../lib/operations-policy';
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
import {
  PARTNER_ACTIVITY_TYPE_OPTIONS,
  orderPartnerActivityRecords,
  orderPartnerBookingArchive,
  readDetailActivityOrder,
} from './partner-detail-filters';
import {
  type PartnerActivityRecord,
  buildPartnerActivitySummary,
  buildPartnerDailyActivityDigest,
  partnerActivityRecordHref,
} from './partner-detail-activity-model';
import {
  type PartnerBookingArchiveRecord as PartnerBookingArchiveModelRecord,
  buildPartnerBookingArchive,
  buildPartnerChatRetentionRows,
  buildPartnerChatRetentionSummary,
  chatSenderLabel,
} from './partner-detail-booking-model';
import {
  buildPartnerAccountActionConfirmation,
  partnerAccountActionConfirmHref,
  readPartnerAccountConfirmationAction,
  type PartnerAccountConfirmationAction,
} from '../partner-account-action-confirmation';
import {
  buildPartnerReviewActionConfirmation,
  partnerReviewActionConfirmHref,
  readPartnerReviewConfirmationAction,
  type PartnerReviewConfirmationAction,
} from '../partner-review-action-confirmation';
import {
  buildPartnerDeviceActionConfirmation,
  partnerDeviceActionConfirmHref,
  readPartnerDeviceConfirmationAction,
  type PartnerDeviceConfirmationAction,
} from './partner-detail-device-action-confirmation';
import {
  buildPartnerControlActionConfirmation,
  partnerControlActionConfirmHref,
  readPartnerControlConfirmationAction,
  type PartnerControlConfirmationAction,
} from './partner-detail-control-action-confirmation';
import {
  partnerOperatorCommandActionHref,
  type PartnerOperatorCommandAction as PartnerOperatorCommandActionConfig,
} from './partner-detail-operator-command-action';
import {
  PartnerDetailBookingJourneySection,
  type PartnerBookingJourneyRow,
} from './partner-detail-booking-journey-section';
import {
  PartnerDetailBookingGateEvidenceSection,
  type PartnerBookingGateAttemptRow,
} from './partner-detail-booking-gate-evidence-section';
import {
  PartnerDetailBookingEvidenceBundlesSection,
  type PartnerBookingEvidenceRow,
} from './partner-detail-booking-evidence-bundles-section';
import {
  PartnerDetailBookingOpsLedgerSection,
  type PartnerBookingOpsLedgerRow,
} from './partner-detail-booking-ops-ledger-section';
import { PartnerDetailRecordDateFilterSection } from './partner-detail-record-date-filter-section';
import {
  PartnerDetailAcceptanceUnblockPlaybookSection,
  type PartnerAcceptanceUnblockStep,
} from './partner-detail-acceptance-unblock-playbook-section';
import { PartnerDetailOpsCommandCenterSection } from './partner-detail-ops-command-center-section';
import {
  PartnerDetailApprovalChecklistSection,
  PartnerDetailRegistrationDossierSection,
} from './partner-detail-review-readiness-section';
import {
  PartnerDetailCashDebtOriginSection,
  type PartnerCashDebtOriginRow,
} from './partner-detail-cash-debt-origin-section';
import {
  PartnerDetailPayoutOperationsSection,
  type PartnerPayoutBatchRow,
  type PartnerPayoutEarningRow,
  type PartnerPayoutOperationsView,
} from './partner-detail-payout-operations-section';
import {
  PartnerDetailBookingGateDecisionSection,
  type PartnerBookingGateDecisionView,
} from './partner-detail-booking-gate-decision-section';
import {
  PartnerDetailAppActivitySection,
  type PartnerAppActivityRow,
} from './partner-detail-app-activity-section';
import { PartnerDetailFullRecordIndexSection } from './partner-detail-full-record-index-section';
import { PartnerDetailMasterFactsSection } from './partner-detail-master-facts-section';
import {
  PartnerDetailChatRetentionLedgerSection,
} from './partner-detail-chat-retention-ledger-section';
import { PartnerDetailConnectedRecordsSection } from './partner-detail-connected-records-section';
import { buildPartnerConnectedRecordLinks } from './partner-detail-connected-records-model';
import {
  PartnerDetailOperationsDigestSection,
} from './partner-detail-operations-digest-section';
import { buildPartnerOperationsDigest } from './partner-detail-operations-digest-model';
import { buildPartnerOperatingLedger } from './partner-detail-operating-ledger-model';
import { PartnerDetailOperatingLedgerSection } from './partner-detail-operating-ledger-section';
import { PartnerDetailOperatingChecklistSection } from './partner-detail-operating-checklist-section';
import { PartnerDetailDailyActivityDigestSection } from './partner-detail-daily-activity-digest-section';
import { PartnerDetailRecentTimelineSection } from './partner-detail-recent-timeline-section';
import { PartnerDetailSummaryRailSection } from './partner-detail-summary-rail-section';
import {
  buildPartnerOperationsQuickRail,
  buildPartnerOperatorFirstRead,
} from './partner-detail-summary-rail-model';
import { PartnerDetailCommandSnapshotSection } from './partner-detail-command-snapshot-section';
import {
  amountValue,
  dateValue,
  formatBytes,
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatDistance,
  formatJsonList,
  formatJsonSummary,
  jsonStringList,
  locationAgeLabel,
  locationAgeMinutes,
  maskDeviceId,
  metadataPreview,
  newestDateValue,
  providerPublicMediaLabel,
  shortRecordId,
  walletLedgerLabel,
} from './partner-detail-format';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type PartnerDispatchPolicy = {
  responseWindowMinutes: number;
  backupRadiusMeters: number;
  locationFreshnessMinutes: number;
};
type PartnerDetailSection = 'overview' | 'full';
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
  notes?: string | null;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: unknown;
  addressSnapshot?: {
    id?: string;
    address?: unknown;
    addressText?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    createdAt?: string | null;
  } | null;
  lat?: string | number | null;
  lng?: string | number | null;
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
  opsTasks?: Array<{
    id: string;
    type: string;
    status: string;
    note?: string | null;
    createdAt?: string;
    updatedAt?: string;
    actor?: { id?: string; phone?: string | null; fullName?: string | null } | null;
  }>;
  payment?: { method?: string; status?: string; amount?: number; currency?: string | null } | null;
  review?: { rating?: number; comment?: string | null; createdAt?: string } | null;
};
type PartnerBookingArchiveRecord = PartnerBookingArchiveModelRecord<PartnerDetailBooking>;
type PartnerDetailDevice = NonNullable<AdminProvider['devices']>[number];

const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
const DEFAULT_PARTNER_DISPATCH_POLICY: PartnerDispatchPolicy = {
  responseWindowMinutes: 10,
  backupRadiusMeters: 10_000,
  locationFreshnessMinutes: 30,
};

function readPartnerDetailSection(
  params: Record<string, string | string[] | undefined>,
): PartnerDetailSection {
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  return rawSection === 'full' ? 'full' : 'overview';
}

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
  const detailSection = readPartnerDetailSection(detailSearchParams);
  const dateFilters = readDetailDateFilters(detailSearchParams);
  const activityType = readDetailActivityType(detailSearchParams, PARTNER_ACTIVITY_TYPE_OPTIONS);
  const activityOrder = readDetailActivityOrder(detailSearchParams);
  const providerEndpoint =
    detailSection === 'overview' ? `/admin/partners/${id}/overview` : `/admin/partners/${id}`;
  const [provider, operationalPolicies] = await Promise.all([
    adminGet<ProviderDetail | null>(providerEndpoint, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);

  if (!provider) {
    notFound();
  }
  const dispatchPolicy = buildPartnerDispatchPolicy(operationalPolicies);

  if (detailSection === 'overview') {
    return <PartnerDetailFastOverview dispatchPolicy={dispatchPolicy} provider={provider} />;
  }

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
  const bookingGateDecision = buildPartnerBookingGateDecisionView(bookingAcceptance, dispatchPolicy);
  const acceptanceUnblockPlaybook = buildPartnerAcceptanceUnblockPlaybook(
    provider,
    bookingAcceptance,
    payoutOps,
  );
  const kycEvidence = buildPartnerKycEvidence(provider);
  const canApproveKyc = kycEvidence.allRequiredApproved;
  const payoutHold = activePayoutHold(provider);
  const hasCashFeeDebt = (provider.earnings ?? []).some(isCashFeeDebt);
  const openCashDebtEarnings = (provider.earnings ?? []).filter(isCashFeeDebt);
  const cashDebtOriginRows = buildPartnerCashDebtOriginRows(openCashDebtEarnings);
  const payoutOperationsView = buildPartnerPayoutOperationsView(payoutOps);
  const payoutEarningRows = buildPartnerPayoutEarningRows(provider.earnings ?? []);
  const payoutBatchRows = buildPartnerPayoutBatchRows(provider.payoutBatches ?? []);
  const partnerBookingArchive = buildPartnerBookingArchive(provider);
  const partnerActivityRecords = buildPartnerActivityRecords(provider, partnerBookingArchive);
  const filteredPartnerBookingArchive = orderPartnerBookingArchive(
    partnerBookingArchive.filter((record) =>
      isWithinDetailDateFilter(bookingRecordCreatedAt(record.booking), dateFilters),
    ),
    activityOrder,
  );
  const partnerBookingEvidenceRows = buildPartnerBookingEvidenceRows(provider, filteredPartnerBookingArchive);
  const filteredPartnerActivityRecords = orderPartnerActivityRecords(
    partnerActivityRecords.filter(
      (record) =>
        isWithinDetailDateFilter(record.at, dateFilters) &&
        isWithinDetailActivityType(record.type, activityType, PARTNER_ACTIVITY_TYPE_OPTIONS),
    ),
    activityOrder,
  );
  const partnerActivitySummary = buildPartnerActivitySummary(filteredPartnerActivityRecords);
  const partnerAppActivityRows = buildPartnerAppActivityRows(filteredPartnerActivityRecords);
  const partnerActivityCommandSnapshot = buildPartnerActivityCommandSnapshot(
    provider,
    filteredPartnerActivityRecords,
    filteredPartnerBookingArchive,
    payoutOps,
    dateFilters.label,
    detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS),
  );
  const partnerRecentTimelineRecords = filteredPartnerActivityRecords.map((record) => ({
    at: record.at,
    detail: record.detail,
    href: partnerActivityRecordHref(record),
    id: record.id,
    title: record.title,
    type: record.type,
  }));
  const partnerDailyActivityDigest = buildPartnerDailyActivityDigest(
    filteredPartnerActivityRecords,
    activityOrder,
  );
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
  const partnerOperationsDigest = buildPartnerOperationsDigest({
    provider,
    bookingArchive: filteredPartnerBookingArchive,
    primaryBank,
    payoutOps,
    bookingAcceptance,
    providerServicePricing,
    dispatchPolicy,
    activityRecords: filteredPartnerActivityRecords,
  });
  const partnerBookingJourneyRows = buildPartnerBookingJourneyRows(
    provider,
    filteredPartnerBookingArchive,
    dispatchPolicy,
  );
  const partnerChatRetentionRows = buildPartnerChatRetentionRows(filteredPartnerBookingArchive);
  const partnerChatRetentionSummary = buildPartnerChatRetentionSummary(partnerChatRetentionRows);
  const partnerBookingOpsLedgerRows = buildPartnerBookingOpsLedgerRows(filteredPartnerBookingArchive);
  const partnerBookingGateAttempts = buildPartnerBookingGateAttemptRows(
    provider.auditLogs ?? [],
    provider.id,
  );
  const filteredPartnerBookingGateAttempts = buildPartnerBookingGateAttemptRows(
    (provider.auditLogs ?? []).filter((log) => isWithinDetailDateFilter(log.createdAt, dateFilters)),
    provider.id,
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
  const partnerFirstReadNextAction = nextProviderAction(provider, dispatchPolicy);
  const connectedPartnerRecordLinks = buildPartnerConnectedRecordLinks({
    provider,
    bookingArchive: partnerBookingArchive,
    bookingGateAttempts: partnerBookingGateAttempts,
    kycEvidence,
    canApproveKyc,
    primaryBank,
    payoutOps,
  });
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
  const partnerOperationsQuickRail = buildPartnerOperationsQuickRail({
    activityRecordCount: filteredPartnerActivityRecords.length,
    activityTypeLabel: detailActivityTypeLabel(activityType, PARTNER_ACTIVITY_TYPE_OPTIONS),
    backupRadiusMeters: dispatchPolicy.backupRadiusMeters,
    bookingJourneyRowCount: partnerBookingJourneyRows.length,
    cashDebtLabel: formatCurrency(cashFeeDebtAmount(provider)),
    chatRetentionRowCount: partnerChatRetentionRows.length,
    connectedRecordLinkCount: connectedPartnerRecordLinks.length,
    dateFilterLabel: dateFilters.label,
    missingKycDocumentCount: missingApprovedRequiredKycDocuments(provider).length,
    openCashDebtEarningCount: openCashDebtEarnings.length,
    operationsDigestCount: partnerOperationsDigest.length,
    payoutStatus: payoutOps.status,
    responseWindowMinutes: dispatchPolicy.responseWindowMinutes,
    unpaidNetDetail: payoutOps.cards.find((card) => card.title === 'Unpaid net')?.detail,
  });
  const partnerChatMessageCount = partnerBookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const partnerOperatorFirstRead = buildPartnerOperatorFirstRead({
    backupRadiusMeters: dispatchPolicy.backupRadiusMeters,
    bookingRecordCount: partnerBookingArchive.length,
    cashDebtLabel: formatCurrency(cashFeeDebtAmount(provider)),
    chatMessageCount: partnerChatMessageCount,
    chatRetentionRowCount: partnerChatRetentionRows.length,
    displayLabel: marketplaceDisplayText(
      provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
    ),
    hasCashFeeDebt,
    joinedAtLabel: formatDate(provider.user?.createdAt),
    latestStaffNoteDetail: partnerOpsNotes[0]
      ? `${formatDate(partnerOpsNotes[0].createdAt)} / ${auditLogNoteText(partnerOpsNotes[0])}`
      : undefined,
    locationRecordedAtLabel: provider.currentLocationUpdatedAt
      ? formatDate(provider.currentLocationUpdatedAt)
      : undefined,
    nextActionDetail: partnerFirstReadNextAction.action,
    nextActionStatus: partnerFirstReadNextAction.status,
    noteCount: partnerOpsNotes.length,
    payoutBlockerDetail: payoutOps.blockers[0] ?? payoutOps.hold?.reason,
    payoutStatus: payoutOps.status,
    responseWindowMinutes: dispatchPolicy.responseWindowMinutes,
    userPhone: provider.user?.phone,
  });
  const detailBaseHref = `/partners/${provider.id}?section=full`;
  const accountConfirmation = buildPartnerAccountActionConfirmation(
    [provider],
    readPartnerAccountConfirmationAction(readSearchParam(detailSearchParams.confirm)),
    provider.id,
    { cancelHref: detailBaseHref },
  );
  const deviceConfirmation = buildPartnerDeviceActionConfirmation(
    provider,
    readPartnerDeviceConfirmationAction(readSearchParam(detailSearchParams.deviceAction)),
    readSearchParam(detailSearchParams.providerDeviceId),
  );
  const controlConfirmation = buildPartnerControlActionConfirmation(
    provider,
    readPartnerControlConfirmationAction(readSearchParam(detailSearchParams.controlAction)),
    readSearchParam(detailSearchParams.sanctionId),
  );
  const reviewConfirmation = buildPartnerReviewActionConfirmation(
    [provider],
    readPartnerReviewConfirmationAction(readSearchParam(detailSearchParams.reviewAction)),
    {
      bankAccountId: readSearchParam(detailSearchParams.bankAccountId),
      documentId: readSearchParam(detailSearchParams.documentId),
      fileId: readSearchParam(detailSearchParams.fileId),
      providerId: provider.id,
    },
    { cancelHref: detailBaseHref },
  );

  return (
    <>
      {accountConfirmation ? (
        <ConfirmDialog
          action={partnerDetailAccountServerAction(accountConfirmation.action)}
          cancelHref={accountConfirmation.cancelHref}
          confirmLabel={accountConfirmation.confirmLabel}
          description={accountConfirmation.description}
          disabled={accountConfirmation.disabled}
          hiddenInputs={accountConfirmation.hiddenInputs}
          id={`partner-detail-account-action-${accountConfirmation.action}-${accountConfirmation.providerId}`}
          textInputs={accountConfirmation.textInputs}
          title={accountConfirmation.title}
          tone={accountConfirmation.tone}
        />
      ) : null}
      {deviceConfirmation ? (
        <ConfirmDialog
          action={partnerDetailDeviceServerAction(deviceConfirmation.action)}
          cancelHref={deviceConfirmation.cancelHref}
          confirmLabel={deviceConfirmation.confirmLabel}
          description={deviceConfirmation.description}
          disabled={deviceConfirmation.disabled}
          hiddenInputs={deviceConfirmation.hiddenInputs}
          id={`partner-detail-device-action-${deviceConfirmation.action}-${deviceConfirmation.providerDeviceId}`}
          textInputs={deviceConfirmation.textInputs}
          title={deviceConfirmation.title}
          tone={deviceConfirmation.tone}
        />
      ) : null}
      {controlConfirmation ? (
        <ConfirmDialog
          action={partnerDetailControlServerAction(controlConfirmation.action)}
          cancelHref={controlConfirmation.cancelHref}
          confirmLabel={controlConfirmation.confirmLabel}
          description={controlConfirmation.description}
          disabled={controlConfirmation.disabled}
          hiddenInputs={controlConfirmation.hiddenInputs}
          id={`partner-detail-control-action-${controlConfirmation.action}-${controlConfirmation.sanctionId}`}
          title={controlConfirmation.title}
          tone={controlConfirmation.tone}
        />
      ) : null}
      {reviewConfirmation ? (
        <ConfirmDialog
          action={partnerDetailReviewServerAction(reviewConfirmation.action)}
          cancelHref={reviewConfirmation.cancelHref}
          confirmLabel={reviewConfirmation.confirmLabel}
          description={reviewConfirmation.description}
          disabled={reviewConfirmation.disabled}
          hiddenInputs={reviewConfirmation.hiddenInputs}
          id={`partner-detail-review-action-${reviewConfirmation.action}-${reviewConfirmation.providerId}`}
          textInputs={reviewConfirmation.textInputs}
          title={reviewConfirmation.title}
          tone={reviewConfirmation.tone}
        />
      ) : null}
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/partners">
              Back to partners
            </Link>
          </p>
          <h1>
            {marketplaceDisplayText(
              provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
            )}
          </h1>
          <p className="muted">
            {marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} /{' '}
            {provider.user?.phone ?? 'No phone'} / {provider.city ?? 'No city'}
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(provider.id)}`}>
            All partner chats
          </Link>
          <ActionMenu
            actions={partnerDetailAccountActionMenuItems(provider)}
            label={`Partner detail account actions for ${providerDisplayLabel(provider)}`}
          />
        </div>
      </section>

      <PartnerDetailSummaryRailSection
        description="The first facts an operator checks before opening the full partner record."
        id="partner-operator-first-read"
        items={partnerOperatorFirstRead}
        statusLabel="Above-fold summary"
        title="Partner operator first read"
      />

      <div className="grid admin-mb-16">
        <StatusCard label="Level" value={provider.level ?? 'LEVEL_1_SIGNUP'} />
        <StatusCard label="Partner status" value={provider.status} />
        <StatusCard label="KYC" value={provider.kyc?.status ?? 'DRAFT'} />
        <StatusCard label="Verification" value={provider.verification?.status ?? 'DRAFT'} />
        <StatusCard label="Account block" value={provider.blockedAt ? 'BLOCKED' : 'CLEAR'} />
        <StatusCard label="Payout hold" value={payoutHold ? 'ACTIVE' : 'CLEAR'} />
      </div>

      <PartnerDetailSummaryRailSection
        description="Fast jumps for operators. This page keeps partner handling factual: onboarding, marketplace participation, wallet debt, payout, tax, location, retained chats, and staff notes."
        id="partner-operations-quick-rail"
        items={partnerOperationsQuickRail}
        statusLabel={`${partnerOperationsQuickRail.length} shortcuts`}
        title="Partner operations quick rail"
      />

      <PartnerDetailCommandSnapshotSection items={partnerActivityCommandSnapshot} />

      <PartnerDetailRecentTimelineSection formatDate={formatDate} records={partnerRecentTimelineRecords} />

      <PartnerDetailOperationsDigestSection
        description="One-screen factual digest for partner operations: identity, activity gate, bookings, chat, location, service pricing, finance, payout, tax, app reachability, and staff records."
        formatLatestAt={formatDate}
        id="partner-operations-digest"
        rows={partnerOperationsDigest}
        title="Partner operations digest"
      />

      <PartnerDetailBookingJourneySection
        description="Booking-by-booking factual journey for this partner: first-pick window, 10 km marketplace participation, customer final selection, retained chat, money rows, and staff records."
        emptyDetail="Use a wider date range to show older booking rows."
        emptyTitle="No partner booking journey matched this filter"
        formatLatestAt={formatDate}
        id="partner-booking-journey"
        rows={partnerBookingJourneyRows}
        title="Partner booking journey"
      />

      <PartnerDetailBookingGateEvidenceSection
        filteredAttempts={filteredPartnerBookingGateAttempts}
        formatDate={formatDate}
        loadedAttempts={partnerBookingGateAttempts}
      />

      <PartnerDetailConnectedRecordsSection
        description="Jump from this partner to linked booking, chat, KYC, bank, tax, location, wallet, payout, and operator records."
        id="partner-connected-operations-records"
        links={connectedPartnerRecordLinks}
        title="Partner connected operations records"
      />

      <div className="card admin-mb-16" id="partner-operator-command-queue">
        <div className="ops-section-header">
          <div>
            <h2>Partner operator command queue</h2>
            <p className="muted">
              Same-shift partner operations queue for onboarding, direct and marketplace readiness gates,
              payout, location, app reachability, and service setup. This is factual handling for operators.
            </p>
          </div>
          <span className={`pill ${pillClass(partnerOperatorCommandQueue.tone)}`}>
            {partnerOperatorCommandQueue.status}
          </span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          {partnerOperatorCommandQueue.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list admin-mt-16">
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

      <div className="card ops-note-panel admin-mb-16" id="partner-operator-notes">
        <div className="ops-section-header">
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
              <option value="Partner contacted; waiting for reply.">
                Partner contacted; waiting for reply.
              </option>
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

      <PartnerDetailMasterFactsSection facts={partnerMasterFacts} />

      <PartnerDetailBookingEvidenceBundlesSection
        rows={partnerBookingEvidenceRows}
        statusPillClass={partnerBookingStatusPillClass}
      />

      <PartnerDetailFullRecordIndexSection
        appActivityCount={(provider.sessions ?? []).length + (provider.devices ?? []).length}
        bookingRecordCount={partnerBookingArchive.length}
        cashDebtLabel={formatCurrency(cashFeeDebtAmount(provider))}
        dailyDigestCount={partnerDailyActivityDigest.length}
        missingKycDocumentCount={missingApprovedRequiredKycDocuments(provider).length}
      />

      <PartnerDetailOperatingLedgerSection rows={partnerOperatingLedger} />

      <PartnerDetailOperatingChecklistSection
        pillClassForTone={pillClass}
        rows={partnerOperatingChecklist}
      />

      <PartnerDetailRecordDateFilterSection
        activityCsvDownloadName={`hands-partner-${shortRecordId(provider.id)}-activity.csv`}
        activityOrder={activityOrder}
        activityType={activityType}
        dateFilters={dateFilters}
        filteredActivityCount={filteredPartnerActivityRecords.length}
        filteredActivityCsvHref={filteredActivityCsvHref}
        filteredBookingArchiveCount={filteredPartnerBookingArchive.length}
        partnerId={provider.id}
        totalActivityCount={partnerActivityRecords.length}
        totalBookingArchiveCount={partnerBookingArchive.length}
      />

      <PartnerDetailChatRetentionLedgerSection
        description="Customer final selection creates the partner chat. Mobile apps can hide completed-service chats, while admin keeps the retained transcript for cancellation, no-show, payment, and service evidence review."
        emptyMessage="No partner chat retention row matched this date filter."
        formatLatestMessageAt={formatDate}
        id="partner-chat-retention-ledger"
        rows={partnerChatRetentionRows}
        statusPillClass={partnerBookingStatusPillClass}
        summary={partnerChatRetentionSummary}
        title="Partner chat retention ledger"
      />

      <div className="card admin-mb-16" id="booking-chat-records">
        <div className="ops-section-header">
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
        <div className="setup-stage-list admin-mt-16">
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
                    {formatDate(bookingRequestOpenedAt(record.booking))}
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
                    <div className="ops-task-note admin-mt-10">
                      <strong>Admin chat archive</strong>
                      <p className="muted">
                        Mobile chat hides after service completion. Admin keeps this booking transcript.
                      </p>
                      <div className="admin-grid-gap-8 admin-mt-10">
                        {readPartnerChatMessages(record.booking).map((message) => (
                          <div className="service-matrix-cell" key={message.id}>
                            <strong>{chatSenderLabel(message)}</strong>
                            <small>{formatDate(message.createdAt)}</small>
                            <p className="admin-m-0">{message.body}</p>
                          </div>
                        ))}
                        {!readPartnerChatMessages(record.booking).length ? (
                          <p className="muted">Chat room exists, but no message is stored yet.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="ops-task-note admin-mt-10">
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
                    <Link
                      className="text-link"
                      href={`/chat-archive?q=${encodeURIComponent(record.booking.id)}`}
                    >
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

      <PartnerDetailBookingOpsLedgerSection
        rows={partnerBookingOpsLedgerRows}
        statusPillClass={partnerBookingStatusPillClass}
      />

      <PartnerDetailAppActivitySection rows={partnerAppActivityRows} summary={partnerActivitySummary} />

      <PartnerDetailDailyActivityDigestSection
        days={partnerDailyActivityDigest}
        formatDate={formatDate}
      />

      <PartnerDetailReadinessSnapshot
        provider={provider}
        bookingAcceptance={bookingAcceptance}
        payoutOps={payoutOps}
        dispatchPolicy={dispatchPolicy}
      />

      <PartnerDetailBookingGateDecisionSection
        cardClassForTone={cardClass}
        decision={bookingGateDecision}
        pillClassForTone={pillClass}
      />

      <PartnerAcceptanceRepairCommandPanel
        provider={provider}
        bookingAcceptance={bookingAcceptance}
        payoutOps={payoutOps}
        dispatchPolicy={dispatchPolicy}
      />

      <PartnerDetailCashDebtOriginSection
        hasCashFeeDebt={hasCashFeeDebt}
        hasSettlementRef={openCashDebtEarnings.some((earning) => earning.settlementRef)}
        openDebtLabel={formatCurrency(cashFeeDebtAmount(provider))}
        openRowCount={openCashDebtEarnings.length}
        rows={cashDebtOriginRows}
      />

      <PartnerDetailAcceptanceUnblockPlaybookSection
        pillClassForTone={pillClass}
        steps={acceptanceUnblockPlaybook}
      />

      <PartnerDetailOpsCommandCenterSection
        cardClassForTone={cardClass}
        locationFreshnessMinutes={dispatchPolicy.locationFreshnessMinutes}
        pillClassForTone={pillClass}
        summary={opsSummary}
      />

      <PartnerDetailPayoutOperationsSection
        cardClassForTone={cardClass}
        earningsRows={payoutEarningRows}
        hasCashFeeDebt={hasCashFeeDebt}
        operations={payoutOperationsView}
        partnerControlsHref={`/partner-controls?q=${encodeURIComponent(provider.id)}`}
        payoutBatchRows={payoutBatchRows}
        pillClassForTone={pillClass}
      />

      <PartnerDetailApprovalChecklistSection checklist={reviewChecklist} />

      <PartnerDetailRegistrationDossierSection dossier={registrationDossier} />

      <div className="card admin-mb-16">
        <div className="ops-section-header">
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
        <div className="detail-grid admin-mt-16">
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
                    <ActionMenu
                      actions={partnerDetailDeviceActionMenuItems(provider.id, device)}
                      label={`Device actions for ${maskDeviceId(device.deviceId)}`}
                    />
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
                        <p className="muted">
                          Session note: {displaySessionCheckText(session.suspiciousReason)}
                        </p>
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
          <div className="setup-stage-list admin-mt-16">
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

      <div className="card admin-mb-16">
        <div className="ops-section-header">
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
        <form className="form-grid admin-mb-16" action={createProviderReport}>
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
        <div className="ops-task-card ops-task-pending admin-mb-16">
          <div className="ops-section-header">
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
            <div className="setup-stage-item admin-mb-12">
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
                      <div className="participant-list admin-mt-6">
                        <span className={`pill ${reportSeverityPill(report.severity)}`}>
                          {report.severity}
                        </span>
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
                      <form className="actions admin-mt-8" action={updateProviderReport}>
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
                      <form className="actions admin-mt-8" action={createProviderSanction}>
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
                        <ActionMenu
                          actions={[
                            {
                              description: 'Review before lifting this Partner account control.',
                              href: partnerControlActionConfirmHref(provider.id, sanction.id),
                              kind: 'link',
                              label: 'Lift control',
                              tone: 'warning',
                            },
                          ]}
                          label={`Control actions for ${shortRecordId(sanction.id)}`}
                        />
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

      <div className="card admin-mb-16">
        <div className="ops-section-header">
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

      <div className="card admin-mb-16">
        <div className="ops-section-header">
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

      <div className="card admin-mb-16">
        <div className="ops-section-header">
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
          <InfoLine label="Feedback records" value={`${provider.reviewCount ?? 0} record(s) saved`} />
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
          <div className="participant-list admin-mb-10">
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
          <div className="actions admin-mt-12">
            <ActionMenu
              actions={[
                {
                  description: canApproveKyc
                    ? 'Review before approving Partner KYC.'
                    : 'Required identity documents must be approved before KYC approval.',
                  disabled: provider.kyc?.status === 'APPROVED' || !canApproveKyc,
                  href: partnerDetailReviewActionConfirmHref(provider.id, 'approve-kyc'),
                  kind: 'link',
                  label: 'Approve KYC',
                  tone: 'success',
                },
                {
                  description: 'Review and enter a KYC rejection reason.',
                  disabled: !provider.kyc || provider.kyc.status === 'REJECTED',
                  href: partnerDetailReviewActionConfirmHref(provider.id, 'reject-kyc'),
                  kind: 'link',
                  label: 'Reject KYC',
                  tone: 'danger',
                },
              ]}
              label="KYC review actions"
            />
          </div>
          {!canApproveKyc ? (
            <p className="muted admin-mt-10">
              Approve the required CCCD front, CCCD back, and selfie documents before approving KYC.
            </p>
          ) : null}
          <div className="setup-stage-list admin-mt-12">
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
          <div className="setup-stage-list admin-mt-12">
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
          <p className="muted admin-mt-10">
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
                  <div className="participant-list admin-mb-6">
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
                <div className="participant-list admin-mb-6">
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
                  {document.fileAsset?.id ? (
                    <a
                      className="text-link"
                      href={`/files/${document.fileAsset.id}/open`}
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
                  <ActionMenu
                    actions={[
                      {
                        description: 'Review before approving this identity document.',
                        disabled: document.status === 'APPROVED',
                        href: partnerDetailReviewActionConfirmHref(provider.id, 'approve-document', {
                          documentId: document.id,
                        }),
                        kind: 'link',
                        label: 'Approve doc',
                        tone: 'success',
                      },
                      {
                        description: 'Review and enter a document rejection reason.',
                        disabled: document.status === 'REJECTED',
                        href: partnerDetailReviewActionConfirmHref(provider.id, 'reject-document', {
                          documentId: document.id,
                        }),
                        kind: 'link',
                        label: 'Reject doc',
                        tone: 'danger',
                      },
                    ]}
                    label={`Document review actions for ${shortRecordId(document.id)}`}
                  />
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
                <div className="participant-list admin-mb-6">
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
                  <ActionMenu
                    actions={[
                      {
                        description: 'Review before approving this public profile media.',
                        disabled: file.reviewStatus === 'APPROVED',
                        href: partnerDetailReviewActionConfirmHref(provider.id, 'approve-media', {
                          fileId: file.id,
                        }),
                        kind: 'link',
                        label: 'Approve public media',
                        tone: 'success',
                      },
                      {
                        description: 'Review and enter a media rejection reason.',
                        disabled: file.reviewStatus === 'REJECTED',
                        href: partnerDetailReviewActionConfirmHref(provider.id, 'reject-media', {
                          fileId: file.id,
                        }),
                        kind: 'link',
                        label: 'Reject media',
                        tone: 'danger',
                      },
                    ]}
                    label={`Media review actions for ${shortRecordId(file.id)}`}
                  />
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
              <div className="actions admin-mt-12">
                <ActionMenu
                  actions={[
                    {
                      description: 'Review before approving this payout bank account.',
                      disabled: primaryBank.status === 'APPROVED',
                      href: partnerDetailReviewActionConfirmHref(provider.id, 'approve-bank', {
                        bankAccountId: primaryBank.id,
                      }),
                      kind: 'link',
                      label: 'Approve bank',
                      tone: 'success',
                    },
                    {
                      description: 'Review and enter a bank rejection reason.',
                      disabled: primaryBank.status === 'REJECTED',
                      href: partnerDetailReviewActionConfirmHref(provider.id, 'reject-bank', {
                        bankAccountId: primaryBank.id,
                      }),
                      kind: 'link',
                      label: 'Reject bank',
                      tone: 'danger',
                    },
                  ]}
                  label="Bank review actions"
                />
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
              <div className="actions admin-mt-12">
                <ActionMenu
                  actions={[
                    {
                      description: 'Review before approving this tax profile.',
                      disabled: provider.taxProfile.status === 'APPROVED',
                      href: partnerDetailReviewActionConfirmHref(provider.id, 'approve-tax'),
                      kind: 'link',
                      label: 'Approve tax',
                      tone: 'success',
                    },
                    {
                      description: 'Review and enter a tax rejection reason.',
                      disabled: provider.taxProfile.status === 'REJECTED',
                      href: partnerDetailReviewActionConfirmHref(provider.id, 'reject-tax'),
                      kind: 'link',
                      label: 'Reject tax',
                      tone: 'danger',
                    },
                  ]}
                  label="Tax review actions"
                />
              </div>
            </>
          ) : (
            <p className="muted">
              Tax profile is not required until payout eligibility review, and has not been submitted.
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
          <h2>Recent payout records</h2>
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

function partnerDetailAccountServerAction(action: PartnerAccountConfirmationAction) {
  switch (action) {
    case 'approve':
      return approveProvider;
    case 'block':
      return blockProviderAccount;
    case 'reject':
      return rejectProvider;
    case 'sync-role':
      return syncSupabaseProviderRole;
    case 'unblock':
      return unblockProviderAccount;
  }
}

function partnerDetailDeviceServerAction(action: PartnerDeviceConfirmationAction) {
  switch (action) {
    case 'block-device':
      return blockProviderDevice;
    case 'unblock-device':
      return unblockProviderDevice;
  }
}

function partnerDetailControlServerAction(action: PartnerControlConfirmationAction) {
  switch (action) {
    case 'lift-control':
      return liftProviderSanction;
  }
}

function partnerDetailReviewServerAction(action: PartnerReviewConfirmationAction) {
  switch (action) {
    case 'approve-bank':
      return approveProviderBankAccount;
    case 'approve-document':
      return approveProviderDocument;
    case 'approve-kyc':
      return approveProviderKyc;
    case 'approve-media':
      return approvePublicProviderMedia;
    case 'approve-tax':
      return approveProviderTaxProfile;
    case 'reject-bank':
      return rejectProviderBankAccount;
    case 'reject-document':
      return rejectProviderDocument;
    case 'reject-kyc':
      return rejectProviderKyc;
    case 'reject-media':
      return rejectPublicProviderMedia;
    case 'reject-tax':
      return rejectProviderTaxProfile;
  }
}

function partnerDetailReviewActionConfirmHref(
  providerId: string,
  action: PartnerReviewConfirmationAction,
  target: { readonly bankAccountId?: string; readonly documentId?: string; readonly fileId?: string } = {},
) {
  return partnerReviewActionConfirmHref(providerId, action, target, {
    baseHref: `/partners/${providerId}?section=full`,
  });
}

function partnerDetailAccountActionMenuItems(provider: ProviderDetail): readonly ActionMenuItem[] {
  const detailBaseHref = `/partners/${provider.id}?section=full`;
  const syncDisabled = provider.verification?.status !== 'APPROVED';
  const actions: ActionMenuItem[] = [
    {
      description: 'Review before approving this Partner for operations.',
      href: partnerAccountActionConfirmHref(provider.id, 'approve', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Approve partner',
      tone: 'success',
    },
    {
      description: 'Review and enter a rejection reason before sending this Partner back.',
      href: partnerAccountActionConfirmHref(provider.id, 'reject', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Reject partner',
      tone: 'danger',
    },
    {
      description: syncDisabled
        ? 'Partner verification must be approved before syncing Supabase role.'
        : 'Review before syncing the infrastructure role.',
      disabled: syncDisabled,
      href: partnerAccountActionConfirmHref(provider.id, 'sync-role', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Sync role',
      tone: 'info',
    },
  ];

  if (provider.blockedAt) {
    actions.push({
      description: 'Review the recorded issue before unblocking this account.',
      href: partnerAccountActionConfirmHref(provider.id, 'unblock', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Unblock account',
      tone: 'warning',
    });
  } else {
    actions.push({
      description: 'Review and enter an account block reason before blocking this Partner.',
      href: partnerAccountActionConfirmHref(provider.id, 'block', { baseHref: detailBaseHref }),
      kind: 'link',
      label: 'Block account',
      tone: 'danger',
    });
  }

  return actions;
}

function partnerDetailDeviceActionMenuItems(
  providerId: string,
  device: PartnerDetailDevice,
): readonly ActionMenuItem[] {
  if (device.blockedAt || !device.enabled) {
    return [
      {
        description: 'Review before unblocking this Partner app device.',
        href: partnerDeviceActionConfirmHref(providerId, 'unblock-device', device.id),
        kind: 'link',
        label: 'Unblock',
        tone: 'warning',
      },
    ];
  }

  return [
    {
      description: 'Review and enter a device block reason before blocking this Partner app device.',
      href: partnerDeviceActionConfirmHref(providerId, 'block-device', device.id),
      kind: 'link',
      label: 'Block',
      tone: 'danger',
    },
  ];
}

function providerDisplayLabel(provider: ProviderDetail) {
  return marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
}

function PartnerDetailFastOverview({
  dispatchPolicy,
  provider,
}: {
  dispatchPolicy: PartnerDispatchPolicy;
  provider: ProviderDetail;
}) {
  const partnerName = marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
  const fullHref = `/partners/${provider.id}?section=full`;
  const fullSectionHref = (hash: string) => `${fullHref}${hash}`;
  const primaryBank = primaryBankAccount(provider);
  const kycEvidence = buildPartnerKycEvidence(provider);
  const payoutOps = buildProviderPayoutOps(provider);
  const servicePricing = buildProviderServicePricing(provider);
  const bookingArchive = buildPartnerBookingArchive(provider);
  const latestBooking = bookingArchive[0]?.booking;
  const latestAccessAt = latestPartnerAccessAt(provider);
  const cashDebt = cashFeeDebtAmount(provider);
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const hasFreshLocation =
    Number.isFinite(locationMinutes) && locationMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const completedBookingCount = bookingArchive.filter(
    (record) => record.booking.status === 'COMPLETED',
  ).length;
  const liveBookingCount = bookingArchive.filter((record) => {
    const status = record.booking.status ?? '';
    return status !== 'COMPLETED' && !CLOSED_BOOKING_STATUSES.includes(status);
  }).length;
  const chatRoomCount = bookingArchive.filter((record) => record.booking.chatRoom).length;
  const chatMessageCount = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const enabledPushDevices = (provider.devices ?? []).filter((device) => device.enabled !== false).length;
  const overviewCards = [
    {
      label: 'KYC',
      value: provider.kyc?.status ?? provider.verification?.status ?? 'DRAFT',
      detail: kycEvidence.allRequiredApproved
        ? 'Required identity evidence is approved.'
        : `${kycEvidence.missingDocuments.length} required document(s) need approval.`,
      href: fullSectionHref('#kyc'),
      tone: kycEvidence.allRequiredApproved ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Wallet',
      value: cashDebt > 0 ? 'Company fee unpaid' : 'Clear',
      detail:
        cashDebt > 0
          ? `${formatCurrency(cashDebt)} cash-booking fee must be settled before marketplace alerts and participation.`
          : 'No partner cash-fee debt is loaded.',
      href: fullSectionHref('#cash-debt-origin'),
      tone: cashDebt > 0 ? 'pill-danger' : 'pill-success',
    },
    {
      label: 'Payout',
      value: payoutOps.status,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate is clear or deferred.',
      href: fullSectionHref('#payout'),
      tone: pillClass(payoutOps.tone),
    },
    {
      label: 'Bookings',
      value: `${completedBookingCount} completed`,
      detail: `${liveBookingCount} active record(s), ${bookingArchive.length} recent linked booking record(s).`,
      href: fullSectionHref('#partner-booking-journey'),
      tone: liveBookingCount ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Chat archive',
      value: `${chatRoomCount} room(s)`,
      detail: `${chatMessageCount} retained message(s) for admin review.`,
      href: fullSectionHref('#partner-chat-retention-ledger'),
      tone: chatRoomCount ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Location',
      value: locationAgeLabel(provider.currentLocationUpdatedAt),
      detail:
        provider.currentLat && provider.currentLng
          ? `${provider.currentLat}, ${provider.currentLng}`
          : 'No latest partner location pin is saved.',
      href: fullSectionHref('#location'),
      tone: hasFreshLocation ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Services',
      value: `${servicePricing.readyCount} bookable`,
      detail: `${servicePricing.rows.length} partner service option(s) loaded.`,
      href: fullSectionHref('#service-pricing'),
      tone: servicePricing.readyCount ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'App access',
      value: latestAccessAt ? formatDate(latestAccessAt) : 'No access',
      detail: `${provider.sessions?.length ?? 0} session(s), ${enabledPushDevices} enabled device(s).`,
      href: fullSectionHref('#app-activity'),
      tone: latestAccessAt ? 'pill-info' : 'pill-neutral',
    },
  ];

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/partners">
              Back to partners
            </Link>
          </p>
          <h1>{partnerName}</h1>
          <p className="muted">
            Fast operations overview / {provider.user?.phone ?? 'No phone'} / {provider.city ?? 'No city'}
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href={fullHref}>
            Open full dossier
          </Link>
          <Link className="text-link" href={`/partner-controls?q=${encodeURIComponent(provider.id)}`}>
            Account controls
          </Link>
        </div>
      </section>

      <section className="grid admin-mb-16">
        {overviewCards.map((card) => (
          <div className="card" key={card.label}>
            <span className={`pill ${card.tone}`}>{card.label}</span>
            <h2>{card.value}</h2>
            <p className="muted">{card.detail}</p>
            <Link className="text-link" href={card.href}>
              Open section
            </Link>
          </div>
        ))}
      </section>

      <section className="detail-grid">
        <div className="card">
          <h2>Identity</h2>
          <InfoLine label="Display name" value={partnerName} />
          <InfoLine label="Legal name" value={provider.legalName} />
          <InfoLine label="Phone" value={provider.user?.phone} />
          <InfoLine label="City" value={provider.city} />
          <InfoLine
            label="Joined"
            value={provider.user?.createdAt ? formatDate(provider.user.createdAt) : null}
          />
          <InfoLine label="Last access" value={latestAccessAt ? formatDate(latestAccessAt) : null} />
        </div>

        <div className="card">
          <h2>Booking command</h2>
          <InfoLine
            label="Policy"
            value={`${dispatchPolicy.responseWindowMinutes}m first-pick / ${Math.round(
              dispatchPolicy.backupRadiusMeters / 1000,
            )}km marketplace radius`}
          />
          <InfoLine
            label="Latest booking"
            value={
              latestBooking
                ? `${shortRecordId(latestBooking.id)} / ${latestBooking.status ?? 'UNKNOWN'} / ${bookingServiceLabel(
                    latestBooking,
                  )}`
                : null
            }
          />
          <InfoLine label="Marketplace rows" value={`${provider.participants?.length ?? 0} loaded`} />
          <InfoLine
            label="Retained chats"
            value={`${chatRoomCount} room(s), ${chatMessageCount} message(s)`}
          />
        </div>

        <div className="card">
          <h2>Payout readiness</h2>
          <InfoLine
            label="Bank"
            value={primaryBank ? `${primaryBank.bankName} / ${primaryBank.status}` : null}
          />
          <InfoLine
            label="Tax profile"
            value={provider.taxProfile?.status ?? 'Deferred until first earning'}
          />
          <InfoLine label="Cash fee debt" value={cashDebt > 0 ? formatCurrency(cashDebt) : 'Clear'} />
          <InfoLine label="Payout status" value={payoutOps.status} />
        </div>

        <div className="card">
          <h2>Next operator action</h2>
          <p className="muted">{kycEvidence.nextAction}</p>
          <p className="muted">
            {payoutOps.blockers[0] ??
              payoutOps.hold?.reason ??
              'No payout blocker is loaded for this partner.'}
          </p>
          <div className="participant-list">
            <Link className="pill pill-info" href={fullHref}>
              Full dossier
            </Link>
            <Link className="pill pill-info" href="/cash-settlements">
              Cash settlements
            </Link>
            <Link className="pill pill-info" href="/payouts">
              Payout batches
            </Link>
          </div>
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
type PartnerOperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: ProviderOpsCard['tone'];
  action: PartnerOperatorCommandActionConfig;
};

function PartnerOperatorCommandAction({
  providerId,
  command,
}: {
  providerId: string;
  command: PartnerOperatorCommand;
}) {
  return (
    <Link className="text-link" href={partnerOperatorCommandActionHref(providerId, command.action)}>
      {command.action.label}
    </Link>
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
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner readiness snapshot</h2>
          <p className="muted">
            Fast operating checks for dispatch, marketplace matching, cash settlement, KYC, payout, and
            service readiness.
          </p>
        </div>
        <span className={`pill ${pillClass(bookingAcceptance.tone)}`}>{bookingAcceptance.status}</span>
      </div>
      <div className="participant-list admin-mt-12">
        {badges.map((badge) => (
          <span className={`pill ${pillClass(badge.tone)}`} key={badge.label} title={badge.detail}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="setup-stage-item admin-mt-16">
        <span>{bookingAcceptance.canJoinMarketplace ? 'GO' : 'HOLD'}</span>
        <div>
          <strong>
            {bookingAcceptance.canJoinMarketplace
              ? 'Marketplace participation ready'
              : 'Marketplace participation blocker'}
          </strong>
          <p className="muted">{bookingAcceptance.primaryReason}</p>
        </div>
        <small>
          {bookingAcceptance.canJoinMarketplace
            ? `Marketplace radius ${formatDistance(dispatchPolicy.backupRadiusMeters)}`
            : 'Resolve join gate'}
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
    <div className={`card ${cardClass(command.tone)} admin-mb-16`}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace repair command</h2>
          <p className="muted">
            Exact operator diagnosis for marketplace participation, customer handoff, app message, and finance
            repair.
          </p>
        </div>
        <span className={`pill ${pillClass(command.tone)}`}>{command.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
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
      <div className="setup-stage-list admin-mt-16">
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
      title: 'Cash fee debt blocks marketplace alerts',
      detail: `${formatCurrency(cashDebt)} must be settled before this partner receives marketplace alerts, participates in marketplace requests, or receives payout release. Customers never carry this wallet debt.`,
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
      detail:
        'KYC is approved. Review profile, photos, service area, and public-facing text before approval.',
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
      detail:
        'Partner has revenue and tax profile is pending. Approve only after checking MST/address/identity match.',
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
      detail:
        'Partner needs at least one service duration priced at or above the admin minimum before customers can book.',
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
      tone: bookingAcceptance.canJoinMarketplace ? 'pending' : 'blocked',
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

  if (!bookingAcceptance.canJoinMarketplace && commands.every((command) => command.id !== 'cash-fee-debt')) {
    add({
      id: 'acceptance-gate',
      label: 'ACCEPT',
      title: 'Marketplace booking gate is on hold',
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
      detail:
        'No immediate operator action is visible. Continue monitoring bookings, app activity, and payout records.',
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
        label: 'Booking gates',
        value: bookingAcceptance.canJoinMarketplace ? 'Join ready' : 'Join hold',
        helper: bookingAcceptance.primaryReason,
      },
      {
        label: 'Cash fee debt',
        value: formatCurrency(cashDebt),
        helper: cashDebt > 0 ? 'Holds marketplace participation until settled.' : 'No cash fee debt.',
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

function buildPartnerBookingEvidenceRows(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
): PartnerBookingEvidenceRow[] {
  return bookingArchive.slice(0, 30).map((record) => {
    const booking = record.booking;
    const chatMessages = readPartnerChatMessages(booking);
    const participant = (booking.participants ?? []).find((item) => item.providerProfileId === provider.id);
    const earning = (provider.earnings ?? []).find((item) => item.bookingId === booking.id);
    const walletRows = earning?.walletLedgerEntries ?? [];
    const latestLocation = provider.currentLocationUpdatedAt
      ? `${locationAgeLabel(provider.currentLocationUpdatedAt)} / ${provider.currentLat ?? '?'}:${provider.currentLng ?? '?'}`
      : 'No latest location loaded';
    const addressDetail = partnerBookingAddressEvidenceLabel(booking);
    const moneyParts = [
      booking.payment
        ? `${booking.payment.status ?? 'UNKNOWN'} ${booking.payment.method ?? 'UNKNOWN'} ${formatCurrency(
            booking.payment.amount ?? 0,
            booking.payment.currency ?? 'VND',
          )}`
        : 'No payment row',
      earning
        ? `earning ${earning.status} net ${formatCurrency(earning.netAmount, earning.currency ?? 'VND')}`
        : 'no earning row',
      walletRows.length ? `${walletRows.length} wallet row(s)` : 'no wallet rows',
    ];
    const opsParts = [
      `participant ${participant?.status ?? 'not linked'}`,
      participant?.joinedAt
        ? `participated ${formatDate(participant.joinedAt)}`
        : 'participation time not stored',
      participant?.respondedAt
        ? `responded ${formatDate(participant.respondedAt)}`
        : 'response time not stored',
      `${booking.opsTasks?.length ?? 0} staff task(s)`,
      `location ${latestLocation}`,
    ];

    return {
      id: booking.id,
      relation: record.relation,
      bookingLabel: `${shortRecordId(booking.id)} / ${formatDate(bookingRecordCreatedAt(booking))}`,
      serviceLabel: `${bookingServiceLabel(booking)} / ${formatCurrency(bookingTotal(booking))}`,
      status: booking.status ?? 'UNKNOWN',
      roleStatus:
        record.relation === 'Selected'
          ? 'Final partner'
          : record.relation === 'Preferred'
            ? 'First-pick partner'
            : 'Marketplace participant',
      roleDetail: `${record.relation} / ${participant?.status ?? 'booking relation'} / ${
        booking.participants?.length ?? 0
      } participant(s)`,
      customerStatus: partnerBookingCustomer(booking),
      customerDetail: addressDetail,
      customerHref: booking.customerProfileId ? `/customers/${booking.customerProfileId}` : undefined,
      chatStatus: booking.chatRoom ? `${chatMessages.length} message(s)` : 'No chat room',
      chatDetail: booking.chatRoom
        ? `Room ${shortRecordId(booking.chatRoom.id)}${record.lastMessage ? ` / last ${record.lastMessage}` : ''}`
        : partnerBookingChatEvidenceLabel(booking),
      chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      moneyStatus: earning?.status ?? booking.payment?.status ?? 'No earning',
      moneyDetail: moneyParts.join(' / '),
      opsStatus:
        isClosedPartnerBooking(booking) || participant?.respondedAt || earning
          ? 'Records linked'
          : 'Minimal records',
      opsDetail: opsParts.join(' / '),
    };
  });
}

function buildPartnerBookingJourneyRows(
  provider: ProviderDetail,
  bookingArchive: PartnerBookingArchiveRecord[],
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerBookingJourneyRow[] {
  return bookingArchive.slice(0, 20).map((record) => {
    const booking = record.booking;
    const participant = (booking.participants ?? []).find((item) => item.providerProfileId === provider.id);
    const chatMessages = readPartnerChatMessages(booking);
    const latestMessage = chatMessages[chatMessages.length - 1];
    const earning = (provider.earnings ?? []).find((item) => item.bookingId === booking.id);
    const walletRows = earning?.walletLedgerEntries ?? [];
    const isFinalPartner = record.relation === 'Selected';
    const hasChat = Boolean(booking.chatRoom);
    const shouldHaveChat = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
      booking.status ?? '',
    );
    const firstPickValue =
      record.relation === 'Preferred'
        ? `${dispatchPolicy.responseWindowMinutes} min first-pick`
        : isFinalPartner
          ? 'Customer selected'
          : 'Marketplace participation';
    const marketplaceValue =
      record.relation === 'Joined'
        ? `Within ${formatDistance(dispatchPolicy.backupRadiusMeters)} policy`
        : `${booking.participants?.length ?? 0} participant(s)`;
    const moneyValue = earning
      ? `earning ${earning.status}`
      : booking.payment
        ? `${booking.payment.status ?? 'UNKNOWN'} ${booking.payment.method ?? 'UNKNOWN'}`
        : 'No money row';
    const latestAt = newestDateValue([
      latestMessage?.createdAt,
      participant?.respondedAt,
      participant?.joinedAt,
      booking.closedAt,
      earning?.paidAt,
      earning?.availableAt,
      earning?.createdAt,
      bookingRecordCreatedAt(booking),
    ]);

    return {
      id: booking.id,
      relation: record.relation,
      heading: `${bookingServiceLabel(booking)} / ${shortRecordId(booking.id)} / ${booking.status ?? 'UNKNOWN'}`,
      detail: `${formatCurrency(bookingTotal(booking))} / ${partnerBookingAddressEvidenceLabel(booking)} / customer ${partnerBookingCustomer(
        booking,
      )}`,
      latestAt,
      steps: [
        {
          label: 'Address',
          value: booking.addressSnapshot ? 'Snapshot saved' : 'Review',
          tone: booking.addressSnapshot ? 'pill-success' : 'pill-warn',
        },
        {
          label: 'First-pick',
          value: firstPickValue,
          tone: record.relation === 'Preferred' || isFinalPartner ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Open matching',
          value: marketplaceValue,
          tone: record.relation === 'Joined' ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Customer choice',
          value: isFinalPartner ? 'Final partner' : 'Not final on this row',
          tone: isFinalPartner ? 'pill-success' : 'pill-neutral',
        },
        {
          label: 'Response',
          value: participant?.respondedAt
            ? `${participant.status} ${formatDate(participant.respondedAt)}`
            : participant?.joinedAt
              ? `${participant.status} participation`
              : 'No response row',
          tone: participant?.respondedAt
            ? 'pill-success'
            : participant?.joinedAt
              ? 'pill-info'
              : 'pill-neutral',
        },
        {
          label: 'Chat',
          value: hasChat ? `${chatMessages.length} retained` : partnerBookingChatEvidenceLabel(booking),
          tone: hasChat ? 'pill-success' : shouldHaveChat ? 'pill-warn' : 'pill-neutral',
        },
        {
          label: 'Money',
          value: moneyValue,
          tone: earning ? 'pill-success' : booking.payment ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Wallet',
          value: walletRows.length ? `${walletRows.length} row(s)` : 'No row',
          tone: walletRows.length ? 'pill-info' : 'pill-neutral',
        },
      ],
      links: [
        { label: 'Open booking', href: `/bookings/${booking.id}` },
        ...(booking.customerProfileId
          ? [{ label: 'Open customer', href: `/customers/${booking.customerProfileId}` }]
          : []),
        ...(booking.chatRoom
          ? [{ label: 'Open chat archive', href: `/chat-archive?q=${encodeURIComponent(booking.id)}` }]
          : []),
      ],
    };
  });
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
      at: bookingRecordCreatedAt(bookingRecord.booking) ?? '',
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
    for (const task of bookingRecord.booking.opsTasks ?? []) {
      records.push({
        id: task.id,
        type: 'OPS',
        at: task.updatedAt ?? task.createdAt ?? bookingRecord.booking.updatedAt ?? '',
        title: `${task.status} booking task`,
        detail: `${task.type} / ${task.note ?? 'No note'} / ${task.actor?.fullName ?? task.actor?.phone ?? 'System'}`,
      });
    }
    const latestNote = latestBookingManualNote(bookingRecord.booking.notes);
    if (latestNote) {
      records.push({
        id: `${bookingRecord.booking.id}-booking-note`,
        type: 'OPS',
        at: bookingRecord.booking.updatedAt ?? bookingRecord.booking.createdAt ?? '',
        title: `Booking note ${shortRecordId(bookingRecord.booking.id)}`,
        detail: latestNote,
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
    const bookingGateAttempt =
      log.action === 'booking.create.rejected'
        ? buildPartnerBookingGateAttemptRows([log], provider.id)[0]
        : null;
    records.push({
      id: log.id,
      type: 'OPS',
      at: log.createdAt,
      title: bookingGateAttempt ? `Booking create stopped: ${bookingGateAttempt.reasonLabel}` : log.action,
      detail: bookingGateAttempt
        ? `${bookingGateAttempt.gateLabel} / ${bookingGateAttempt.detail}`
        : `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${auditLogNoteText(log)}`,
    });
  }

  return records
    .filter((record) => Number.isFinite(dateValue(record.at)))
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
}

function buildPartnerActivityCommandSnapshot(
  provider: ProviderDetail,
  records: PartnerActivityRecord[],
  bookingArchive: PartnerBookingArchiveRecord[],
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dateLabel: string,
  activityTypeLabel: string,
) {
  const latestEvent = orderPartnerActivityRecords(records, 'newest')[0];
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED');
  const latestCompletedBooking = completedBookings[0]?.booking;
  const retainedChatRooms = bookingArchive.filter((record) => record.booking.chatRoom);
  const retainedMessageCount = bookingArchive.reduce(
    (sum, record) => sum + readPartnerChatMessages(record.booking).length,
    0,
  );
  const joinedBookings = bookingArchive.filter((record) => record.relation === 'Joined').length;
  const selectedBookings = bookingArchive.filter((record) => record.relation === 'Selected').length;
  const preferredBookings = bookingArchive.filter((record) => record.relation === 'Preferred').length;
  const earningCount = provider.earnings?.length ?? 0;
  const payoutCount = provider.payoutBatches?.length ?? 0;
  const latestAccessAt = latestPartnerAccessAt(provider);
  const staffRecordCount =
    (provider.auditLogs?.length ?? 0) +
    (provider.verificationLogs?.length ?? 0) +
    (provider.reports?.length ?? 0) +
    (provider.sanctions?.length ?? 0);
  const latestStaffRecord = records.find((record) =>
    ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'].includes(
      record.type,
    ),
  );

  return [
    {
      label: 'Applied filter',
      value: `${records.length} event(s)`,
      helper: `${dateLabel} / ${activityTypeLabel}`,
      href: '#app-activity',
    },
    {
      label: 'Latest event',
      value: latestEvent ? latestEvent.title : 'No event',
      helper: latestEvent
        ? `${latestEvent.type} / ${formatDate(latestEvent.at)}`
        : 'No record in this filter.',
      href: latestEvent ? partnerActivityRecordHref(latestEvent) : '#app-activity',
    },
    {
      label: 'Completed work',
      value: `${completedBookings.length} booking(s)`,
      helper: latestCompletedBooking
        ? `Latest ${bookingServiceLabel(latestCompletedBooking)} / ${formatDate(
            bookingLatestActivityAt(latestCompletedBooking),
          )}`
        : 'No completed booking in this filter.',
      href: latestCompletedBooking ? `/bookings/${latestCompletedBooking.id}` : '#partner-booking-journey',
    },
    {
      label: 'Retained chat',
      value: `${retainedMessageCount} message(s)`,
      helper: `${retainedChatRooms.length} room(s) retained for admin review.`,
      href: '#partner-chat-retention-ledger',
    },
    {
      label: 'Marketplace records',
      value: `${joinedBookings} participation record(s)`,
      helper: `${preferredBookings} preferred / ${selectedBookings} selected booking relation(s).`,
      href: '#partner-booking-journey',
    },
    {
      label: 'Finance rows',
      value: `${earningCount + payoutCount} row(s)`,
      helper: `${earningCount} earning / ${payoutCount} payout / ${payoutOps.status}.`,
      href: '#payout',
    },
    {
      label: 'Location and app',
      value: locationAgeLabel(provider.currentLocationUpdatedAt),
      helper: latestAccessAt
        ? `Recent app access ${formatDate(latestAccessAt)}`
        : 'No app access row loaded.',
      href: '#location',
    },
    {
      label: 'Staff records',
      value: `${staffRecordCount} row(s)`,
      helper: latestStaffRecord
        ? `${latestStaffRecord.title} / ${formatDate(latestStaffRecord.at)}`
        : 'No staff record in this filter.',
      href: '#partner-operator-notes',
    },
  ];
}

function buildPartnerBookingGateAttemptRows(
  auditLogs: AdminAuditLog[],
  providerId: string,
): PartnerBookingGateAttemptRow[] {
  return auditLogs
    .filter((log) => log.action === 'booking.create.rejected')
    .map((log) => {
      const metadata = readMetadataObject(log.metadata);
      const reasonCode = readString(metadata.reasonCode) ?? 'UNKNOWN';
      const gate = partnerBookingGateFilter(reasonCode);
      const bookingAddress = readMetadataObject(metadata.bookingAddress);
      const addressText = readString(bookingAddress.addressText);
      const customerProfileId = readString(metadata.customerProfileId);
      const customerDistance = readNumber(metadata.customerDistanceMeters);
      const customerDistanceLimit = readNumber(metadata.customerDistanceLimitMeters);
      const partnerDistance = readNumber(metadata.preferredProviderDistanceMeters);
      const partnerDistanceLimit = readNumber(metadata.preferredProviderDistanceLimitMeters);
      const currentLocationRecordedAt = readString(metadata.currentLocationRecordedAt);
      const serviceId = readString(metadata.serviceId);
      const distanceParts = [
        partnerDistance !== null
          ? `First-pick ${formatDistance(partnerDistance)} / limit ${formatDistance(
              partnerDistanceLimit ?? 0,
            )}`
          : null,
        customerDistance !== null
          ? `Optional customer GPS ${formatDistance(customerDistance)} / limit ${formatDistance(
              customerDistanceLimit ?? 0,
            )}`
          : null,
      ].filter(Boolean);
      const detailParts = [
        addressText ? `Address: ${addressText}` : 'Address snapshot metadata missing',
        currentLocationRecordedAt
          ? `Optional customer GPS evidence: ${formatDate(currentLocationRecordedAt)}`
          : 'No optional GPS timestamp',
        serviceId ? `Service ${shortRecordId(serviceId)}` : null,
        customerProfileId ? `Customer ${shortRecordId(customerProfileId)}` : null,
      ].filter(Boolean);

      return {
        id: log.id,
        at: log.createdAt,
        gate,
        gateLabel: partnerBookingGateLabel(gate),
        reasonLabel: partnerBookingGateReasonLabel(reasonCode),
        detail: detailParts.join(' / '),
        addressLabel: addressText ? trimText(addressText, 72) : 'No address metadata',
        distanceLabel: distanceParts.length ? distanceParts.join(' / ') : 'No distance value',
        bookingMonitorHref: `/bookings?view=blocked-create&gate=${gate}`,
        auditHref: `/audit-log?query=booking.create.rejected&target=${encodeURIComponent(
          `provider:${providerId}`,
        )}`,
        tone: gate === 'unknown' ? 'pill-warn' : 'pill-info',
      };
    })
    .sort((left, right) => dateValue(right.at) - dateValue(left.at));
}

function partnerBookingGateFilter(reasonCode: string) {
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') return 'service-area';
  if (
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID'
  ) {
    return 'customer-gps';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') return 'customer-distance';
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') return 'first-pick-distance';
  return 'unknown';
}

function partnerBookingGateLabel(gate: string) {
  if (gate === 'service-area') return 'Service area';
  if (gate === 'customer-gps') return 'Optional GPS evidence';
  if (gate === 'customer-distance') return 'Optional GPS distance';
  if (gate === 'first-pick-distance') return 'First-pick distance';
  return 'Unknown gate';
}

function partnerBookingGateReasonLabel(reasonCode: string) {
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'Partner was outside the first-pick distance gate';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Optional customer GPS distance evidence';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Selected service address was outside enabled service area';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Optional customer GPS evidence was stale';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Optional customer GPS evidence was missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Optional customer GPS timestamp was missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Optional customer GPS timestamp was invalid';
  }
  return reasonCode.replace(/_/g, ' ').toLowerCase();
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
      value: `${provider.reviewCount ?? 0} feedback record(s)`,
      helper: 'Open the feedback section to read original customer feedback records',
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
      href: `/partners/${provider.id}?section=full#admin`,
      tone: provider.blockedAt ? 'blocked' : 'done',
    },
    {
      area: 'Booking',
      status: bookingAcceptance.canJoinMarketplace
        ? 'Marketplace participation clear'
        : 'Marketplace participation on hold',
      detail: bookingAcceptance.primaryReason,
      nextAction: bookingAcceptance.canJoinMarketplace
        ? 'Ready for marketplace participation'
        : 'Resolve marketplace participation gate',
      href: `/partners/${provider.id}?section=full#booking-chat-records`,
      tone: bookingAcceptance.canJoinMarketplace ? 'done' : 'blocked',
    },
    {
      area: 'Cash',
      status: cashDebt > 0 ? 'Cash fee debt exists' : 'Cash fee clear',
      detail:
        cashDebt > 0
          ? `Partner wallet has ${formatCurrency(cashDebt)} unpaid HANDS commission from cash bookings.`
          : 'No unpaid cash commission is gating marketplace participation.',
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
      href: `/partners/${provider.id}?section=full#kyc`,
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
      href: `/partners/${provider.id}?section=full#bank`,
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
      href: hasFirstRevenue ? `/partners/${provider.id}?section=full#tax` : '/tax-policy',
      tone: hasFirstRevenue && !taxReady ? 'pending' : 'done',
    },
    {
      area: 'Payout',
      status: payoutOps.status,
      detail: payoutOps.blockers[0] ?? payoutOps.hold?.reason ?? 'Payout gate is clear or deferred.',
      nextAction: payoutOps.tone === 'done' ? 'No payout action' : 'Review payout gate',
      href: `/partners/${provider.id}?section=full#payout`,
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
      href: `/partners/${provider.id}?section=full#service-pricing`,
      tone: providerServicePricing.readyCount > 0 ? 'done' : 'blocked',
    },
    {
      area: 'Location',
      status: locationFresh ? 'Location fresh' : 'Location refresh needed',
      detail: `Last location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}; marketplace matching policy allows ${dispatchPolicy.locationFreshnessMinutes}m.`,
      nextAction: locationFresh ? 'Ready for distance checks' : 'Ask app reopen/location update',
      href: `/partners/${provider.id}?section=full#location`,
      tone: locationFresh ? 'done' : 'pending',
    },
    {
      area: 'App',
      status: enabledPushCount > 0 ? 'App reachable' : 'Push device missing',
      detail: `${enabledPushCount} enabled push device(s), ${deviceCount} device row(s), ${sessionCount} session row(s).`,
      nextAction: enabledPushCount > 0 ? 'Can receive alerts' : 'Register device token',
      href: `/partners/${provider.id}?section=full#app-activity`,
      tone: enabledPushCount > 0 ? 'done' : 'pending',
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

function readPartnerChatMessages(booking: PartnerDetailBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  });
}

function buildPartnerBookingOpsLedgerRows(
  records: PartnerBookingArchiveRecord[],
): PartnerBookingOpsLedgerRow[] {
  return records
    .filter((record) => {
      const booking = record.booking;
      return (
        Boolean(booking.notes?.trim()) ||
        (booking.opsTasks?.length ?? 0) > 0 ||
        Boolean(booking.closedAt || booking.closedReason || booking.closedNote)
      );
    })
    .slice(0, 40)
    .map((record) => {
      const booking = record.booking;
      const tasks = [...(booking.opsTasks ?? [])].sort(
        (left, right) =>
          dateValue(right.updatedAt ?? right.createdAt) - dateValue(left.updatedAt ?? left.createdAt),
      );
      const latestTask = tasks[0];
      const latestNote = latestBookingManualNote(booking.notes);

      return {
        id: booking.id,
        relation: record.relation,
        bookingLabel: `${shortRecordId(booking.id)} / ${formatDate(bookingRecordCreatedAt(booking))}`,
        serviceLabel: `${bookingServiceLabel(booking)} / customer ${partnerBookingCustomer(booking)}`,
        status: booking.status ?? 'UNKNOWN',
        noteStatus: latestNote ? 'Manual note saved' : 'No manual note',
        noteDetail: latestNote ?? 'No booking-level staff note has been saved for this booking.',
        taskStatus: tasks.length ? `${tasks.length} task row(s)` : 'No staff task',
        taskDetail: latestTask
          ? `${latestTask.status} ${latestTask.type} / ${latestTask.note ?? 'No task note'} / ${
              latestTask.actor?.fullName ?? latestTask.actor?.phone ?? 'System'
            }`
          : 'No linked booking operation task is loaded.',
        closeoutStatus: booking.closedAt ? 'Closed by operator flow' : 'Not closed',
        closeoutDetail: booking.closedAt
          ? `${formatDate(booking.closedAt)} / ${bookingClosureLabel(booking)}`
          : 'No cancellation, no-show, refund, or closeout decision is saved.',
        chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      };
    });
}

function latestBookingManualNote(notes?: string | null) {
  if (!notes?.trim()) return null;
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const latest = lines[lines.length - 1];
  return latest ? trimText(latest, 180) : null;
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

function bookingTotal(booking: PartnerDetailBooking) {
  return (booking.services ?? []).reduce((sum, item) => {
    return sum + (item.price ?? 0) * (item.quantity ?? 1);
  }, 0);
}

function partnerBookingCustomer(booking: PartnerDetailBooking) {
  return (
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Unknown customer'
  );
}

function partnerBookingAddressEvidenceLabel(booking: PartnerDetailBooking) {
  if (booking.addressSnapshot) {
    const snapshotText = stringifyPartnerAddress(
      booking.addressSnapshot.addressText ?? booking.addressSnapshot.address,
    );
    const coordinates =
      booking.addressSnapshot.latitude != null && booking.addressSnapshot.longitude != null
        ? `${booking.addressSnapshot.latitude}, ${booking.addressSnapshot.longitude}`
        : 'coordinates not stored';
    return `${snapshotText} / snapshot ${coordinates}`;
  }
  if (booking.address) {
    return stringifyPartnerAddress(booking.address);
  }
  if (booking.lat != null && booking.lng != null) {
    return `coordinates ${booking.lat}, ${booking.lng}`;
  }
  return 'No booking address evidence loaded';
}

function stringifyPartnerAddress(value: unknown) {
  if (!value) return 'No address text';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const address = value as Record<string, unknown>;
    const text =
      address.addressText ??
      address.address_text ??
      address.address ??
      address.formatted ??
      address.label ??
      address.name;
    if (typeof text === 'string' && text.trim()) return text;
    return trimText(JSON.stringify(address), 120);
  }
  return String(value);
}

function partnerBookingChatEvidenceLabel(booking: PartnerDetailBooking) {
  const status = booking.status ?? '';
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(status)) {
    return 'Matched booking needs retained chat archive';
  }
  return 'No matched chat yet';
}

function partnerBookingStatusPillClass(status?: string) {
  if (['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status ?? '')) {
    return 'pill-info';
  }
  if (status === 'COMPLETED') return 'pill-success';
  if (status === 'NO_SHOW') return 'pill-danger';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status ?? '')) return 'pill-warn';
  return 'pill-neutral';
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

function readMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function auditLogNoteText(log: AdminAuditLog) {
  const metadata = readMetadataObject(log.metadata);
  const note = metadata.note ?? metadata.preset ?? metadata.reason ?? metadata.summary ?? metadata.status;
  if (typeof note === 'string' && note.trim()) {
    return trimText(note.trim(), 140);
  }
  return trimText(JSON.stringify(log.metadata ?? { action: log.action }), 140);
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
      action:
        cashDebt > 0
          ? 'Record partner deposit or admin offset before marketplace alerts, participation, and payout release resume.'
          : 'Clear',
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
  const directFirstPickBlockers = blockers.filter((gate) => gate.label !== 'Wallet and cash debt');
  const primaryReason = blockers[0]?.detail ?? 'All marketplace participation gates are clear.';
  const directFirstPickReason =
    directFirstPickBlockers[0]?.detail ??
    (cashDebt > 0
      ? 'Wallet debt does not block direct first-pick or already-matched service flow.'
      : 'Direct first-pick gates are clear.');

  return {
    canJoinMarketplace: blockers.length === 0,
    canDirectFirstPick: directFirstPickBlockers.length === 0,
    status: blockers.length === 0 ? 'CAN ACCEPT' : `${blockers.length} BLOCKER(S)`,
    tone: blockers.length === 0 ? ('done' as const) : ('blocked' as const),
    primaryReason,
    directFirstPickReason,
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
  const status = bookingAcceptance.canJoinMarketplace
    ? 'MARKETPLACE READY'
    : `${blockedGates.length} REPAIR STEP(S)`;
  const partnerAppMessage = partnerAppBlockMessage(provider, bookingAcceptance, payoutOps, dispatchPolicy);
  const hasWalletBlock = blockedGates.some((gate) => gate.label === 'Wallet and cash debt');
  const hasHardVisibilityBlock = blockedGates.some((gate) =>
    ['Account controls', 'Identity and approval'].includes(gate.label),
  );
  const customerImpact = bookingAcceptance.canJoinMarketplace
    ? 'Can appear in customer booking flow and final partner choice.'
    : bookingAcceptance.canDirectFirstPick && hasWalletBlock
      ? 'Customer balances are unaffected; this wallet gate blocks marketplace alerts and booking participation until settlement.'
      : hasHardVisibilityBlock
        ? 'Hide or avoid this partner for direct booking and marketplace shortlist until hard blockers are cleared.'
        : 'Partner may remain visible only after operator confirms freshness, reachability, and pricing.';
  const operatorDecision = bookingAcceptance.canJoinMarketplace
    ? 'No manual repair required. Monitor service quality and response speed.'
    : bookingAcceptance.canDirectFirstPick && hasWalletBlock
      ? 'Finance must clear cash debt before marketplace alerts, participation, or payout release.'
      : `Start with ${blockedGates[0]?.label ?? 'the first visible blocker'} before considering dispatch.`;
  const marketplaceRouting = bookingAcceptance.canJoinMarketplace
    ? `Eligible for first-pick and marketplace participation within ${formatDistance(dispatchPolicy.backupRadiusMeters)}.`
    : hasWalletBlock
      ? 'Partner can view marketplace requests, but marketplace alerts and booking participation are blocked until cash fee debt is settled or offset.'
      : 'Route urgent demand to direct-ready or marketplace-ready partners while this repair queue is open.';

  const steps = blockedGates.map((gate) => partnerAcceptanceRepairStep(provider, gate));
  if (!steps.length) {
    steps.push({
      owner: 'Ops',
      blocker: 'No active blocker',
      reason: 'All direct and marketplace readiness gates are currently clear for this partner.',
      operatorAction: 'Keep monitoring customer feedback records, response speed, and location freshness.',
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
      href: `/partners/${provider.id}?section=full#payout`,
      actionLabel: 'Open payout gate',
      tone: 'pending',
    });
  }

  return {
    status,
    tone: bookingAcceptance.canJoinMarketplace ? 'done' : 'blocked',
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
      href: `/partners/${provider.id}?section=full#kyc`,
      actionLabel: 'Open KYC',
      tone: 'blocked',
    },
    'Bank account': {
      owner: 'Finance',
      href: `/partners/${provider.id}?section=full#bank`,
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
      href: `/partners/${provider.id}?section=full#location`,
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
  if (bookingAcceptance.canJoinMarketplace) {
    return 'Partner is clear for direct first-pick and marketplace participation.';
  }
  if (bookingAcceptance.cashDebt > 0) {
    return 'Unpaid HANDS fees must be settled before final acceptance or service start.';
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
  return 'Partner needs operator review before marketplace alerts or participation.';
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
        ? 'Partner can pass the cash-debt marketplace alert and participation gate.'
        : 'Marketplace alerts, participation, and final marketplace selection are blocked; direct first-pick and already-matched service flow are not retroactively blocked by wallet debt.',
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
        : 'Partner must stay hidden from customer selection and marketplace participation until account-control review is resolved.',
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
          : 'Holds preferred direct requests and marketplace participation until identity evidence and bank readiness are approved.',
      payoutImpact: 'Approved bank is also required before partner payout can be prepared.',
      action: identityGate?.ok && bankGate?.ok ? 'Review KYC evidence' : 'Finish KYC and bank review',
      href: `/partners/${provider.id}?section=full#kyc`,
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
      href: `/partners/${provider.id}?section=full#location`,
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
      href: hasFirstRevenue ? `/partners/${provider.id}?section=full#payout` : '/tax-policy',
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
      label: bookingAcceptance.canDirectFirstPick ? 'Direct first-pick ready' : 'Direct first-pick repair',
      tone: bookingAcceptance.canDirectFirstPick ? 'done' : 'blocked',
      detail: bookingAcceptance.directFirstPickReason,
    },
    {
      label: bookingAcceptance.canJoinMarketplace
        ? 'Marketplace participation ready'
        : 'Marketplace participation blocked',
      tone: bookingAcceptance.canJoinMarketplace ? 'done' : 'blocked',
      detail: bookingAcceptance.canJoinMarketplace
        ? `Can participate in marketplace bookings inside ${formatDistance(dispatchPolicy.backupRadiusMeters)} during the ${dispatchPolicy.responseWindowMinutes}m response window.`
        : 'Marketplace participation uses wallet, account, identity, bank, reachability, location, and pricing gates.',
    },
    {
      label: cashDebt > 0 ? 'Cash debt' : 'Wallet clear',
      tone: cashDebt > 0 ? 'blocked' : 'done',
      detail:
        cashDebt > 0
          ? `Partner owes HANDS ${formatCurrency(cashDebt)} from cash settlement.`
          : 'No cash-settlement debt is gating marketplace participation.',
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
      label: payoutOps.status === 'UNLOCKED' ? 'Payout ready' : `Payout ${payoutOps.status.toLowerCase()}`,
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
        : 'No unpaid earning record.',
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
          ? `Latest partner app record is ${Number.isFinite(lastSeenMinutes) ? `${lastSeenMinutes}m old` : 'missing'}.`
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
      title: 'Shared device record',
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
        'Ask for the correct MST/tax code, legal name, and registered address before payout review.',
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
            ? 'Residential/tax address, city, and service area/location data are available.'
            : 'Service area/location data is available. Residential tax address can stay deferred until first earning.'
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
  const rows = ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type) => {
    const document = (provider.documents ?? []).find((item) => item.type === type);
    return {
      type,
      label: providerDocumentLabel(type),
      status: document?.status ?? 'MISSING',
      uploadedAt: document?.fileAsset?.uploadedAt,
      rejectionReason: document?.rejectionReason,
      fileLabel: marketplaceDisplayText(
        document?.fileAsset?.contentType ?? document?.fileAsset?.key ?? 'No file uploaded',
      ),
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
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

function buildPartnerDispatchPolicy(settings: AdminOperationalPolicySetting[]): PartnerDispatchPolicy {
  return {
    responseWindowMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.responseWindowMinutes,
    backupRadiusMeters:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.backupRadiusMeters,
    locationFreshnessMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      DEFAULT_PARTNER_DISPATCH_POLICY.locationFreshnessMinutes,
  };
}

function providerHasFirstRevenueSignal(provider: ProviderDetail) {
  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

function isCashFeeDebt(earning: NonNullable<ProviderDetail['earnings']>[number]) {
  return earning.netAmount < 0 && earning.booking?.payment?.method === 'CASH' && earning.status !== 'PAID';
}

function partnerCashDebtOriginLabel(earning: NonNullable<ProviderDetail['earnings']>[number]) {
  const method = earning.booking?.payment?.method ?? 'CASH';
  if (method === 'CASH') {
    return 'Partner collected customer cash; HANDS fee/tax remains unpaid until deposit or approved offset.';
  }
  return `Negative wallet row needs finance review because payment method is ${method}.`;
}

function partnerCashDebtEvidenceLabel(earning: NonNullable<ProviderDetail['earnings']>[number]) {
  if (earning.settlementRef) {
    return `Ref ${earning.settlementRef}`;
  }
  const ledgerRef = earning.walletLedgerEntries?.find((entry) => entry.reference)?.reference;
  if (ledgerRef) {
    return `Ledger ${ledgerRef}`;
  }
  return 'Evidence needed';
}

function buildPartnerCashDebtOriginRows(
  earnings: Array<NonNullable<ProviderDetail['earnings']>[number]>,
): PartnerCashDebtOriginRow[] {
  return earnings.slice(0, 5).map((earning) => ({
    amountLabel: formatCurrency(Math.abs(amountValue(earning.netAmount))),
    bookingHref: earning.bookingId ? `/bookings/${earning.bookingId}` : undefined,
    bookingLabel: earning.bookingId ? shortRecordId(earning.bookingId) : 'unknown',
    createdLabel: formatDate(earning.createdAt),
    evidenceLabel: partnerCashDebtEvidenceLabel(earning),
    handsFeeLabel: formatCurrency(earning.platformFee),
    id: earning.id,
    originLabel: partnerCashDebtOriginLabel(earning),
    paymentMethod: earning.booking?.payment?.method ?? 'UNKNOWN',
    taxLabel: formatCurrency(earning.withholdingAmount),
  }));
}

function buildPartnerPayoutOperationsView(
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
): PartnerPayoutOperationsView {
  return {
    blockers: payoutOps.blockers,
    cards: payoutOps.cards,
    hold: payoutOps.hold
      ? {
          expiresAtLabel: formatDate(payoutOps.hold.expiresAt),
          reason: payoutOps.hold.reason,
          startsAtLabel: formatDate(payoutOps.hold.startsAt),
        }
      : null,
    status: payoutOps.status,
    tone: payoutOps.tone,
  };
}

function buildPartnerPayoutEarningRows(
  earnings: Array<NonNullable<ProviderDetail['earnings']>[number]>,
): PartnerPayoutEarningRow[] {
  return earnings.slice(0, 5).map((earning) => {
    const cashDebt = isCashFeeDebt(earning);
    const bookingPrefix = earning.bookingId ? `Booking ${shortRecordId(earning.bookingId)} / ` : '';

    return {
      amountLine: `Gross ${formatCurrency(earning.grossAmount)} / platform fee ${formatCurrency(
        earning.platformFee,
      )} / withholding ${formatCurrency(earning.withholdingAmount)}`,
      detailLine: `${bookingPrefix}payment ${earning.booking?.payment?.method ?? 'UNKNOWN'} / created ${formatDate(
        earning.createdAt,
      )}`,
      id: earning.id,
      settlementNotes: earning.settlementNotes,
      settlementRef: earning.settlementRef,
      smallLabel: earning.paidAt ? `Settled ${formatDate(earning.paidAt)}` : cashDebt ? 'Blocks booking' : 'Unpaid',
      statusLabel: cashDebt ? 'CASH DEBT' : earning.status,
      title: cashDebt
        ? `Owes HANDS ${formatCurrency(Math.abs(amountValue(earning.netAmount)))}`
        : `Net ${formatCurrency(earning.netAmount)}`,
      walletLines: (earning.walletLedgerEntries ?? []).slice(0, 2).map((entry) => {
        const reference = entry.reference ? ` / ref ${entry.reference}` : '';
        return `Wallet ${walletLedgerLabel(entry.type)}: ${formatCurrency(
          entry.amount,
          entry.currency ?? earning.currency ?? 'VND',
        )}${reference}`;
      }),
    };
  });
}

function buildPartnerPayoutBatchRows(
  batches: Array<NonNullable<ProviderDetail['payoutBatches']>[number]>,
): PartnerPayoutBatchRow[] {
  return batches.slice(0, 5).map((batch) => ({
    createdLine: `Created ${formatDate(batch.createdAt)}${
      batch.transferRef ? ` / transfer ${batch.transferRef}` : ''
    }`,
    href: `/payouts#${batch.id}`,
    id: batch.id,
    paidLine: batch.paidAt ? `Paid ${formatDate(batch.paidAt)}` : null,
    status: batch.status,
    totalNetLabel: formatCurrency(batch.totalNetAmount),
  }));
}

function buildPartnerBookingGateDecisionView(
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerBookingGateDecisionView {
  return {
    backupRadiusLabel: formatDistance(dispatchPolicy.backupRadiusMeters),
    bookableServices: bookingAcceptance.bookableServices,
    canDirectFirstPick: bookingAcceptance.canDirectFirstPick,
    canJoinMarketplace: bookingAcceptance.canJoinMarketplace,
    cashDebtLabel: formatCurrency(bookingAcceptance.cashDebt),
    directFirstPickReason: bookingAcceptance.directFirstPickReason,
    gates: bookingAcceptance.gates,
    locationAge: bookingAcceptance.locationAge,
    locationFreshnessLabel: `${dispatchPolicy.locationFreshnessMinutes}m`,
    primaryReason: bookingAcceptance.primaryReason,
    responseWindowLabel: `${dispatchPolicy.responseWindowMinutes}m`,
    status: bookingAcceptance.status,
    tone: bookingAcceptance.tone,
  };
}

function buildPartnerAppActivityRows(records: PartnerActivityRecord[]): PartnerAppActivityRow[] {
  return records.map((record, index) => ({
    atLabel: formatDate(record.at),
    detail: record.detail,
    key: `${record.type}-${record.id}-${record.at}-${index}`,
    title: record.title,
    type: record.type,
  }));
}

function cashFeeDebtAmount(provider: ProviderDetail) {
  return (provider.earnings ?? [])
    .filter(isCashFeeDebt)
    .reduce((total, earning) => total + Math.abs(amountValue(earning.netAmount)), 0);
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
