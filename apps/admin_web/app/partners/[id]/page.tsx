import { notFound } from 'next/navigation';
import type {
  AdminManualWalletAdjustmentRow,
  AdminOperationalPolicySetting,
  AdminPartnerCustomerReview,
  AdminProviderWalletWithdrawalRequest,
  AdminReview,
  AdminGetResult,
} from '../../../lib/admin-api';
import { adminGet, adminGetResult } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import {
  AdminReviewRecordsSection,
  reviewRecordsForPartner,
} from '../../../components/admin-review-records-section';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminManualWalletAdjustmentHistory } from '../../../components/admin-manual-wallet-adjustment-history';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminDetailGrid, AdminErrorState, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { MoneyText } from '../../../components/money-text';
import { bookingRecordCreatedAt } from '../../../lib/admin-booking-time';
import { marketplaceDisplayText, partnerOperatingStatusLabel } from '../../../lib/admin-copy';
import { isWithinDetailDateFilter, readDetailDateFilters } from '../../../lib/detail-date-filter';
import {
  detailActivityTypeLabel,
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../lib/detail-activity-filter';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import { formatDateOnly } from '../../../lib/admin-format';
import { buildCsvDataHref } from '../../../lib/csv-export';
import { readSearchParam } from '../../../lib/date-range';
import {
  OPERATIONAL_POLICY_CACHE_OPTIONS,
  OPERATIONAL_POLICY_KEYS,
} from '../../../lib/operations-policy';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  blockProviderAccount,
  blockProviderDevice,
  createPartnerManualCustomerReview,
  deletePartnerPublicMedia,
  putProviderKycOnHold,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
  unblockProviderDevice,
  updatePartnerWalletWithdrawalRequest,
} from '../actions';
import { liftProviderSanction } from '../../partner-controls/actions';
import { buildPartnerControlDetailsHref } from '../../partner-controls/partner-control-page-load-plan';
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
import { buildPartnerActivityRecords } from './partner-detail-activity-records-model';
import { buildPartnerApprovalEvidenceSummaryRows } from './partner-detail-approval-evidence-summary-model';
import {
  buildPartnerBookingArchive,
  buildPartnerChatRetentionRows,
  buildPartnerChatRetentionSummary,
  countDistinctActivePartnerBookings,
} from './partner-detail-booking-model';
import {
  buildPartnerAccountActionConfirmation,
  partnerAccountActionConfirmHref,
  readPartnerAccountConfirmationAction,
  type PartnerAccountConfirmationAction,
} from '../partner-account-action-confirmation';
import {
  buildPartnerReviewActionConfirmation,
  readPartnerReviewConfirmationAction,
  type PartnerReviewConfirmationAction,
} from '../partner-review-action-confirmation';
import { buildProviderOpsPolicy } from '../partner-list-ops';
import { providerReviewIssues } from '../partner-list-readiness';
import {
  PARTNER_APPROVAL_QUEUE_HREF,
  readPartnerDecisionQueue,
  withPartnerDecisionQueue,
} from '../partner-review-mode';
import {
  buildPartnerDeviceActionConfirmation,
  readPartnerDeviceConfirmationAction,
  type PartnerDeviceConfirmationAction,
} from './partner-detail-device-action-confirmation';
import {
  buildPartnerDetailAccountActionMenuItems,
  buildPartnerDetailDeviceActionMenuItems,
} from './partner-detail-action-menu-model';
import {
  buildPartnerControlActionConfirmation,
  readPartnerControlConfirmationAction,
  type PartnerControlConfirmationAction,
} from './partner-detail-control-action-confirmation';
import { PartnerDetailBookingJourneySection } from './partner-detail-booking-journey-section';
import {
  PartnerDetailBookingGateEvidenceSection,
} from './partner-detail-booking-gate-evidence-section';
import { buildPartnerBookingGateAttemptRows } from './partner-detail-booking-gate-rows-model';
import { PartnerDetailBookingEvidenceBundlesSection } from './partner-detail-booking-evidence-bundles-section';
import { PartnerDetailBookingOpsLedgerSection } from './partner-detail-booking-ops-ledger-section';
import { PartnerDetailRecordDateFilterSection } from './partner-detail-record-date-filter-section';
import {
  PartnerDetailAcceptanceUnblockPlaybookSection,
} from './partner-detail-acceptance-unblock-playbook-section';
import {
  PartnerDetailApprovalChecklistSection,
  PartnerDetailRegistrationDossierSection,
} from './partner-detail-review-readiness-section';
import { buildProviderRegistrationDossier } from './partner-detail-registration-dossier-model';
import { buildProviderResubmissionPlan } from './partner-detail-resubmission-plan-model';
import { PartnerDetailCashDebtOriginSection } from './partner-detail-cash-debt-origin-section';
import { PartnerDetailPayoutOperationsSection } from './partner-detail-payout-operations-section';
import {
  buildPartnerCashDebtOriginRows,
  buildPartnerPayoutBatchRows,
  buildPartnerPayoutEarningRows,
  buildPartnerPayoutOperationsView,
  isCashFeeDebt,
} from './partner-detail-payout-rows-model';
import { buildPartnerFinanceFollowUpRows } from './partner-detail-finance-follow-up-model';
import { PartnerDetailFinanceFollowUpSection } from './partner-detail-finance-follow-up-section';
import { buildPartnerWalletSummary } from './partner-detail-wallet-model';
import { PartnerDetailWalletSummarySection } from './partner-detail-wallet-summary-section';
import { PartnerDetailWalletWithdrawalRequestSection } from './partner-detail-wallet-withdrawal-request-section';
import {
  PartnerDetailBookingGateDecisionSection,
  type PartnerBookingGateDecisionView,
} from './partner-detail-booking-gate-decision-section';
import {
  PartnerDetailAppActivitySection,
  type PartnerAppActivityRow,
} from './partner-detail-app-activity-section';
import { PartnerDetailBookingChatRecordsSection } from './partner-detail-booking-chat-records-section';
import {
  buildPartnerBookingChatRecordRows,
  buildPartnerBookingEvidenceRows,
  buildPartnerBookingJourneyRows,
  buildPartnerEarningsByBookingId,
} from './partner-detail-booking-rows-model';
import { PartnerDetailDeviceSessionActivitySection } from './partner-detail-device-session-activity-section';
import {
  buildPartnerDeviceRows,
  buildPartnerSessionRows,
  buildPartnerSharedDeviceRows,
} from './partner-detail-device-session-model';
import { buildPartnerReviewControlPanel } from './partner-detail-review-control-panel-model';
import { buildPartnerReviewHistoryRows } from './partner-detail-review-history-model';
import {
  PartnerDetailApprovalEvidenceSummarySection,
  PartnerDetailReviewControlPanelSection,
  PartnerDetailResubmissionGuidanceSection,
  PartnerDetailReviewHistorySection,
} from './partner-detail-review-progress-section';
import { PartnerDetailOperatorCommandQueueSection } from './partner-detail-operator-command-queue-section';
import { PartnerDetailOperatorNotesSection } from './partner-detail-operator-notes-section';
import {
  PartnerDetailReportsControlsSection,
} from './partner-detail-reports-controls-section';
import {
  buildPartnerAccountControlRows,
  buildPartnerOperatorNoteRows,
  buildPartnerReportControlPayoutHold,
  buildPartnerReportRows,
} from './partner-detail-control-records-model';
import {
  PartnerDetailAgreementsCard,
  PartnerDetailLocationActivityCard,
  PartnerDetailRecentPayoutRecordsCard,
} from './partner-detail-profile-finance-summary-section';
import {
  buildPartnerAgreementBadges,
  buildPartnerLocationSnapshotBadges,
  buildPartnerRecentPayoutRecordLines,
} from './partner-detail-profile-finance-summary-model';
import { PartnerDetailProfileOverviewCard } from './partner-detail-profile-overview-card';
import {
  buildPartnerKycEvidence,
  missingSubmittedRequiredKycDocuments,
} from './partner-detail-kyc-evidence-model';
import {
  PartnerDetailPublicProfileMediaCard,
  PartnerDetailTypedDocumentsCard,
} from './partner-detail-document-media-section';
import {
  PartnerDetailBankPayoutGateCard,
  PartnerDetailTaxProfileCard,
} from './partner-detail-finance-gate-section';
import { PartnerDetailFastOverview } from './partner-detail-fast-overview';
import {
  buildPartnerProfileOverviewFacts,
  buildPartnerPublicMediaRows,
  buildPartnerTypedDocumentRows,
  partnerProfileAvatarStatus,
  readPartnerProfileTranslations,
} from './partner-detail-profile-media-model';
import {
  buildPartnerBankPayoutGateView,
  buildPartnerTaxProfileView,
} from './partner-detail-bank-tax-model';
import {
  PartnerDetailServicePricingSection,
  type PartnerServicePricingDisplayRow,
} from './partner-detail-service-pricing-section';
import { PartnerDetailFullRecordIndexSection } from './partner-detail-full-record-index-section';
import { PartnerDetailMasterFactsSection } from './partner-detail-master-facts-section';
import { buildPartnerApprovalChecklist } from './partner-detail-approval-checklist-model';
import {
  buildPartnerActivityCommandSnapshot,
  buildPartnerBookingOpsLedgerRows,
  buildPartnerMasterFacts,
  latestPartnerAccessAt,
} from './partner-detail-record-summary-model';
import { PartnerDetailChatRetentionLedgerSection } from './partner-detail-chat-retention-ledger-section';
import {
  PARTNER_CONNECTED_RECORDS_DESCRIPTION,
  PartnerDetailConnectedRecordsSection,
} from './partner-detail-connected-records-section';
import { buildPartnerConnectedRecordLinks } from './partner-detail-connected-records-model';
import { PartnerDetailOperationsDigestSection } from './partner-detail-operations-digest-section';
import { buildPartnerOperationsDigest } from './partner-detail-operations-digest-model';
import { buildPartnerOperatingLedger } from './partner-detail-operating-ledger-model';
import { PartnerDetailOperatingLedgerSection } from './partner-detail-operating-ledger-section';
import { PartnerDetailOperatingChecklistSection } from './partner-detail-operating-checklist-section';
import { buildPartnerOperatingChecklist } from './partner-detail-operating-checklist-model';
import { PartnerDetailDailyActivityDigestSection } from './partner-detail-daily-activity-digest-section';
import { PartnerDetailRecentTimelineSection } from './partner-detail-recent-timeline-section';
import { PartnerDetailSummaryRailSection } from './partner-detail-summary-rail-section';
import type { PartnerDetailSummaryRailItem } from './partner-detail-summary-rail-model';
import {
  PartnerAcceptanceRepairCommandSection,
  PartnerDetailReadinessSnapshotSection,
} from './partner-detail-readiness-command-section';
import {
  buildPartnerAcceptanceRepairCommand,
  buildPartnerAcceptanceUnblockPlaybook,
  buildProviderBookingAcceptance,
} from './partner-detail-acceptance-model';
import {
  buildPartnerOperatorCommandQueue,
  buildPartnerReadinessSnapshotView,
  buildProviderServicePricing,
  type ProviderServicePricingRow,
} from './partner-detail-command-model';
import { partnerOpsCardClass, partnerOpsPillClass } from './partner-detail-tone';
import {
  buildPartnerOperationalChecks,
  openPartnerOperationalChecks,
} from './partner-detail-operational-status-model';
import { PartnerDetailCommandSnapshotSection } from './partner-detail-command-snapshot-section';
import {
  PartnerDetailDossierCluster,
  PartnerDetailReferenceDetails,
  PartnerDetailSectionGroup,
} from './partner-detail-section-group';
import {
  buildPartnerDetailWorkspaceHref,
  readPartnerAccessView,
  readPartnerBookingsView,
  readPartnerControlView,
  readPartnerDetailSection,
  readPartnerDossierView,
} from './partner-detail-workspace-model';
import {
  formatCurrency,
  formatDate,
  formatDistance,
  locationAgeLabel,
  locationAgeMinutes,
  shortRecordId,
} from './partner-detail-format';
import type {
  PartnerDispatchPolicy,
  ProviderDetail,
} from './partner-detail-types';
import {
  activePayoutHold,
  buildProviderPayoutOps,
  buildProviderSecuritySummary,
  cashFeeDebtAmount,
  primaryBankAccount,
  providerHasFirstRevenueSignal,
} from './partner-detail-payout-security-model';
import {
  partnerBookingStatusPillClass,
} from './partner-detail-record-helpers';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PARTNER_ACTIVITY_CSV_EXPORT_LIMIT = 30;
const PARTNER_DETAIL_REVIEW_RECORD_LIMIT = 10;
const PARTNER_DETAIL_MANUAL_ADJUSTMENT_HISTORY_LIMIT = 5;

const PARTNER_DETAIL_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
] as const;
const PARTNER_DETAIL_OPERATIONAL_POLICY_HREF = `/admin/operational-policy?${new URLSearchParams({
  keys: PARTNER_DETAIL_OPERATIONAL_POLICY_KEYS.join(','),
}).toString()}`;

export default async function ProviderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const detailSearchParams = searchParams ? await searchParams : {};
  const decisionQueue = readPartnerDecisionQueue(readSearchParam(detailSearchParams.decisionQueue));
  const detailSection = readPartnerDetailSection(detailSearchParams);
  const requestedControlView = readPartnerControlView(detailSearchParams);
  const requestedBookingsView = readPartnerBookingsView(detailSearchParams);
  const requestedAccessView = readPartnerAccessView(detailSearchParams);
  const dossierView = readPartnerDossierView(detailSearchParams);
  const dateFilters = readDetailDateFilters(detailSearchParams);
  const activityType = readDetailActivityType(detailSearchParams, PARTNER_ACTIVITY_TYPE_OPTIONS);
  const activityOrder = readDetailActivityOrder(detailSearchParams);
  const currentOperatorAccess = await getCurrentAdminOperatorAccess();
  const canLoadPartnerDiagnostics = canViewAdminDeveloperSystem(currentOperatorAccess);
  const canReviewPartnerKyc = hasAdminOperatorCategory(currentOperatorAccess, 'PARTNERS_KYC');
  const canEditPartnerProfile = hasAdminOperatorCategory(currentOperatorAccess, 'PARTNERS_DETAIL');
  const canViewPartnerReviews = hasAdminOperatorCategory(currentOperatorAccess, 'CUSTOMERS_REVIEWS');
  const canViewFinanceSettlements = hasAdminOperatorCategory(currentOperatorAccess, 'FINANCE_SETTLEMENTS');
  const canAdjustPartnerWallet = hasAdminOperatorCategory(
    currentOperatorAccess,
    'FINANCE_WALLET_ADJUSTMENTS',
  );
  const isFullPartnerDetail = detailSection === 'full';
  const controlView =
    requestedControlView === 'reference' && !canLoadPartnerDiagnostics ? 'work' : requestedControlView;
  const bookingsView =
    requestedBookingsView === 'ledger' && !canLoadPartnerDiagnostics ? 'journey' : requestedBookingsView;
  const accessView =
    requestedAccessView === 'diagnostics' && !canLoadPartnerDiagnostics ? 'readiness' : requestedAccessView;
  const shouldLoadAccessDiagnostics =
    canLoadPartnerDiagnostics &&
    detailSection === 'access' &&
    accessView === 'diagnostics';
  const shouldLoadFinanceRecords = detailSection === 'dossier' && dossierView === 'finance';
  const shouldLoadEvidenceRecords = detailSection === 'dossier' && dossierView === 'evidence';
  const providerEndpoint =
    detailSection === 'overview'
      ? `/admin/partners/${id}/overview`
      : `/admin/partners/${id}?includeDiagnostics=${shouldLoadAccessDiagnostics ? 'true' : 'false'}${
          shouldLoadFinanceRecords
            ? '&view=finance'
            : shouldLoadEvidenceRecords
              ? '&view=evidence'
              : ''
        }`;
  const [provider, operationalPolicies] = await Promise.all([
    adminGet<ProviderDetail | null>(providerEndpoint, null),
    shouldLoadFinanceRecords || shouldLoadEvidenceRecords
      ? Promise.resolve<AdminOperationalPolicySetting[]>([])
      : adminGet<AdminOperationalPolicySetting[]>(
          PARTNER_DETAIL_OPERATIONAL_POLICY_HREF,
          [],
          OPERATIONAL_POLICY_CACHE_OPTIONS,
        ),
  ]);

  if (!provider) {
    notFound();
  }
  const providerOpsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const dispatchPolicy: PartnerDispatchPolicy = {
    responseWindowMinutes: providerOpsPolicy.responseWindowMinutes,
    backupRadiusMeters: providerOpsPolicy.backupRadiusMeters,
    locationFreshnessMinutes: providerOpsPolicy.staleLocationMinutes,
  };

  if (detailSection === 'overview') {
    return (
      <PartnerDetailFastOverview
        bookingArchive={buildPartnerBookingArchive(provider)}
        cashDebt={cashFeeDebtAmount(provider)}
        dispatchPolicy={dispatchPolicy}
        kycEvidence={buildPartnerKycEvidence(provider)}
        latestAccessAt={latestPartnerAccessAt(provider)}
        payoutOps={buildProviderPayoutOps(provider)}
        provider={provider}
        servicePricing={buildProviderServicePricing(provider)}
      />
    );
  }

  const reviewQuery = new URLSearchParams({
    providerProfileId: provider.id,
    take: String(PARTNER_DETAIL_REVIEW_RECORD_LIMIT),
  }).toString();
  const walletWithdrawalQuery = new URLSearchParams({
    providerProfileId: provider.id,
    range: 'all',
    take: '10',
  }).toString();
  const partnerManualAdjustmentHref = `/wallet-adjustments?ownerType=PARTNER&ownerId=${encodeURIComponent(provider.id)}`;
  const shouldLoadControlRecords = detailSection === 'control' && controlView === 'records';
  const skippedCustomerReviews: AdminGetResult<AdminReview[]> = { data: [], ok: true, status: 200 };
  const skippedPartnerEvaluations: AdminGetResult<AdminPartnerCustomerReview[]> = {
    data: [],
    ok: true,
    status: 200,
  };
  const skippedWithdrawalRequests: AdminGetResult<AdminProviderWalletWithdrawalRequest[]> = {
    data: [],
    ok: true,
    status: 200,
  };
  const skippedManualAdjustments: AdminGetResult<AdminManualWalletAdjustmentRow[]> = {
    data: [],
    ok: true,
    status: 200,
  };
  const [customerReviewsResult, partnerEvaluationsResult, walletWithdrawalResult, partnerManualAdjustmentResult] =
    await Promise.all([
      shouldLoadControlRecords && canViewPartnerReviews
        ? adminGetResult<AdminReview[]>(`/admin/reviews?${reviewQuery}`, [])
        : Promise.resolve(
            shouldLoadControlRecords
              ? { data: [], ok: false, status: 403 } satisfies AdminGetResult<AdminReview[]>
              : skippedCustomerReviews,
          ),
      shouldLoadControlRecords && canViewPartnerReviews
        ? adminGetResult<AdminPartnerCustomerReview[]>(`/admin/partner-customer-reviews?${reviewQuery}`, [])
        : Promise.resolve(
            shouldLoadControlRecords
              ? { data: [], ok: false, status: 403 } satisfies AdminGetResult<AdminPartnerCustomerReview[]>
              : skippedPartnerEvaluations,
          ),
      shouldLoadFinanceRecords && canViewFinanceSettlements
        ? adminGetResult<AdminProviderWalletWithdrawalRequest[]>(
            `/admin/provider-wallet/withdrawal-requests?${walletWithdrawalQuery}`,
            [],
          )
        : Promise.resolve(
            shouldLoadFinanceRecords
              ? { data: [], ok: false, status: 403 } satisfies AdminGetResult<AdminProviderWalletWithdrawalRequest[]>
              : skippedWithdrawalRequests,
          ),
      shouldLoadFinanceRecords && canAdjustPartnerWallet
        ? adminGetResult<AdminManualWalletAdjustmentRow[]>(
            `/admin/wallet-adjustments?ownerType=PARTNER&ownerId=${encodeURIComponent(
              provider.id,
            )}&take=${PARTNER_DETAIL_MANUAL_ADJUSTMENT_HISTORY_LIMIT}`,
            [],
          )
        : Promise.resolve(
            shouldLoadFinanceRecords
              ? { data: [], ok: false, status: 403 } satisfies AdminGetResult<AdminManualWalletAdjustmentRow[]>
              : skippedManualAdjustments,
          ),
    ]);
  const customerReviews = customerReviewsResult.data;
  const partnerEvaluations = partnerEvaluationsResult.data;
  const walletWithdrawalRequests = walletWithdrawalResult.data;
  const partnerManualAdjustmentRows = partnerManualAdjustmentResult.data;
  const reviewRecordsForbidden =
    customerReviewsResult.status === 403 || partnerEvaluationsResult.status === 403;
  const reviewRecordsFailed = !customerReviewsResult.ok || !partnerEvaluationsResult.ok;
  const financeRecordsForbidden =
    walletWithdrawalResult.status === 403 || partnerManualAdjustmentResult.status === 403;
  const financeRequestForbidden =
    (canViewFinanceSettlements && walletWithdrawalResult.status === 403) ||
    (canAdjustPartnerWallet && partnerManualAdjustmentResult.status === 403);
  const financeRecordsFailed =
    (canViewFinanceSettlements && !walletWithdrawalResult.ok) ||
    (canAdjustPartnerWallet && !partnerManualAdjustmentResult.ok);
  const partnerReviewRecords = reviewRecordsForPartner(customerReviews, partnerEvaluations, provider.id);
  const partnerDisplayLabel = providerDisplayLabel(provider);
  const cashFeeDebtTotal = cashFeeDebtAmount(provider);
  const partnerAuditLogs = provider.auditLogs ?? [];
  const partnerEarnings = provider.earnings ?? [];
  const partnerWalletSummary = buildPartnerWalletSummary(provider);
  const partnerFinanceFollowUpRows = buildPartnerFinanceFollowUpRows({
    bankAccounts: provider.bankAccounts,
    providerProfileId: provider.id,
    walletSummary: partnerWalletSummary,
  });
  const partnerApprovalIssues = providerReviewIssues(provider, providerOpsPolicy);
  const primaryBank = primaryBankAccount(provider);
  const partnerBankPayoutGate = buildPartnerBankPayoutGateView(
    provider.id,
    primaryBank,
    provider.bankAccounts ?? [],
    provider.verificationLogs ?? [],
  );
  const partnerTaxProfile = buildPartnerTaxProfileView(provider);
  const reviewChecklist = buildPartnerApprovalChecklist(provider, dispatchPolicy);
  const payoutOps = buildProviderPayoutOps(provider);
  const securitySummary = buildProviderSecuritySummary(provider);
  const partnerDeviceRows = buildPartnerDeviceRows(provider, (device) =>
    buildPartnerDetailDeviceActionMenuItems(provider.id, {
      blocked: Boolean(device.blockedAt),
      enabled: device.enabled,
      id: device.id,
    }),
  );
  const partnerSessionRows = buildPartnerSessionRows(provider);
  const partnerSharedDeviceRows = buildPartnerSharedDeviceRows(provider);
  const resubmissionPlan = buildProviderResubmissionPlan(provider);
  const reviewHistoryRows = buildPartnerReviewHistoryRows(provider);
  const registrationDossier = buildProviderRegistrationDossier(provider);
  const reviewControlPanel = buildPartnerReviewControlPanel({
    cashDebtAmount: cashFeeDebtTotal,
    dossier: registrationDossier,
    provider,
    resubmissionPlan,
    reviewHistoryRows,
    reviewIssues: partnerApprovalIssues,
  });
  const providerServicePricing = buildProviderServicePricing(provider);
  const partnerServicePricingDisplayRows = buildPartnerServicePricingDisplayRows(providerServicePricing.rows);
  const bookingAcceptance = buildProviderBookingAcceptance(provider, providerServicePricing, dispatchPolicy);
  const readinessSnapshot = buildPartnerReadinessSnapshotView({
    provider,
    bookingAcceptance,
    dispatchPolicy,
  });
  const acceptanceRepairCommand = buildPartnerAcceptanceRepairCommand(
    provider,
    bookingAcceptance,
    payoutOps,
    dispatchPolicy,
  );
  const bookingGateDecision = buildPartnerBookingGateDecisionView(bookingAcceptance, dispatchPolicy);
  const acceptanceUnblockPlaybook = buildPartnerAcceptanceUnblockPlaybook(
    provider,
    bookingAcceptance,
    payoutOps,
  );
  const kycEvidence = buildPartnerKycEvidence(provider);
  const canApproveKyc =
    Boolean(provider.kyc && provider.legalName?.trim() && provider.kyc.cccdNumberLast4) &&
    missingSubmittedRequiredKycDocuments(provider).length === 0;
  const missingKycDocumentCount = kycEvidence.missingDocuments.length;
  const partnerTypedDocumentRows = buildPartnerTypedDocumentRows(provider);
  const partnerPublicMediaRows = buildPartnerPublicMediaRows(provider);
  const approvalEvidenceSummaryRows = buildPartnerApprovalEvidenceSummaryRows({
    provider,
    kycEvidence,
    primaryBank,
    hasFirstRevenue: providerHasFirstRevenueSignal(provider),
  });
  const payoutHold = activePayoutHold(provider);
  const partnerLocationAgeMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const partnerLocationIsFresh =
    Number.isFinite(partnerLocationAgeMinutes) &&
    partnerLocationAgeMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const profileComplete = partnerProfileIsComplete(provider);
  const partnerBookingArchive = buildPartnerBookingArchive(provider);
  const activePartnerBookingCount = countDistinctActivePartnerBookings(partnerBookingArchive);
  const partnerAppActivityStatus = provider.appActivitySummary?.activityStatus ?? 'never_tracked';
  const partnerOperationalChecks = buildPartnerOperationalChecks({
    accountBlocked: Boolean(provider.blockedAt),
    accountBlockedReason: provider.blockedReason,
    activeBookingCount: activePartnerBookingCount,
    activeBookingsHref: '#partner-booking-journey',
    availabilityChangedAtLabel: provider.availabilitySummary?.availabilityChangedAt
      ? formatDate(provider.availabilitySummary.availabilityChangedAt)
      : null,
    availabilityIntent: provider.availabilitySummary?.availabilityIntent,
    availabilityReason: provider.availabilitySummary?.availabilityReason,
    appActivityStatus: partnerAppActivityStatus,
    appLastActiveLabel: provider.appActivitySummary?.lastActiveAt
      ? formatDate(provider.appActivitySummary.lastActiveAt)
      : null,
    bookableServiceCount: providerServicePricing.readyCount,
    cashDebtLabel: formatCurrency(cashFeeDebtTotal),
    cashDebtOpen: cashFeeDebtTotal > 0,
    kycStatus: provider.kyc?.status,
    locationDetail: provider.currentLocationUpdatedAt
      ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`
      : 'No Partner location has been saved.',
    locationFresh: partnerLocationIsFresh,
    missingKycDocumentCount,
    nextAvailableAtLabel: provider.nextAvailableAt ? formatDate(provider.nextAvailableAt) : null,
    partnerStatus: provider.status,
    payoutHoldReason: payoutHold?.reason,
    profileComplete,
    profileStatus: provider.verification?.status,
    pushEnabled: (provider.user?.pushDevices ?? []).some((device) => device.enabled),
    scheduleConfigured: provider.availabilitySummary?.scheduleConfigured,
    todayWorkingHoursLabel: provider.availabilitySummary?.todayWindowLabel,
    withinWorkingHours: provider.availabilitySummary?.withinWorkingHours,
  });
  const partnerOpenOperationalChecks = openPartnerOperationalChecks(partnerOperationalChecks);

  if (isFullPartnerDetail) {
    const approvalOpenCount = partnerOpenOperationalChecks.filter(
      (check) => check.domain === 'ACCOUNT' || check.domain === 'APPROVAL',
    ).length;
    const workOpenCount = partnerOpenOperationalChecks.filter((check) => check.domain === 'WORK').length;
    const financeOpenCount = partnerOpenOperationalChecks.filter((check) => check.domain === 'FINANCE').length;

    return (
      <AdminPageTemplate
        actions={
          <>
            <AdminFormControlLink href={`/partners/${provider.id}`}>Overview</AdminFormControlLink>
            <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(provider.id)}`}>
              All Partner chats
            </AdminTextLink>
            <AdminTextLink href={decisionQueue ? PARTNER_APPROVAL_QUEUE_HREF : '/partners'}>
              {decisionQueue ? 'Back to Partner approvals' : 'Back to partners'}
            </AdminTextLink>
          </>
        }
        contentClassName="partners-page partner-detail-page"
        description={`${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} / ${
          provider.user?.phone ?? 'No phone'
        } / ${provider.city ?? 'No city'}`}
        title={`${partnerDisplayLabel} work areas`}
      >
        <PartnerDetailFullRecordIndexSection
          approvalOpenCount={approvalOpenCount}
          bookingRecordCount={partnerBookingArchive.length}
          canViewDiagnostics={canLoadPartnerDiagnostics}
          decisionQueue={decisionQueue}
          financeOpenCount={financeOpenCount}
          partnerId={provider.id}
          workOpenCount={workOpenCount}
        />
      </AdminPageTemplate>
    );
  }
  const reportControlPayoutHold = buildPartnerReportControlPayoutHold(payoutHold);
  const partnerReportRows = buildPartnerReportRows(provider);
  const partnerAccountControlRows = buildPartnerAccountControlRows(provider);
  const partnerProfileOverviewFacts = buildPartnerProfileOverviewFacts(provider);
  const partnerProfileTranslations = readPartnerProfileTranslations(provider.bioTranslations);
  const partnerAgreementBadges = buildPartnerAgreementBadges(provider);
  const partnerRecentPayoutRecordLines = buildPartnerRecentPayoutRecordLines(provider);
  const partnerLocationSnapshotBadges = buildPartnerLocationSnapshotBadges(provider);
  const hasCashFeeDebt = partnerEarnings.some(isCashFeeDebt);
  const openCashDebtEarnings = partnerEarnings.filter(isCashFeeDebt);
  const cashDebtOriginRows = buildPartnerCashDebtOriginRows(openCashDebtEarnings);
  const payoutOperationsView = buildPartnerPayoutOperationsView(payoutOps);
  const payoutEarningRows = buildPartnerPayoutEarningRows(partnerEarnings);
  const partnerEarningsByBookingId = buildPartnerEarningsByBookingId(partnerEarnings);
  const payoutBatchRows = buildPartnerPayoutBatchRows(provider.payoutBatches ?? []);
  const partnerActivityRecords = buildPartnerActivityRecords(provider, partnerBookingArchive);
  const filteredPartnerBookingArchive = orderPartnerBookingArchive(
    partnerBookingArchive.filter((record) =>
      isWithinDetailDateFilter(bookingRecordCreatedAt(record.booking), dateFilters),
    ),
    activityOrder,
  );
  const partnerBookingEvidenceRows = buildPartnerBookingEvidenceRows(
    provider,
    filteredPartnerBookingArchive,
    partnerEarningsByBookingId,
  );
  const partnerBookingChatRecordRows = buildPartnerBookingChatRecordRows(filteredPartnerBookingArchive);
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
    detailNode: record.detailNode,
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
    cashFeeDebtTotal,
  );
  const partnerOperatingChecklist = buildPartnerOperatingChecklist(
    provider,
    bookingAcceptance,
    providerServicePricing,
    dispatchPolicy,
  );
  const partnerOperatingLedger = buildPartnerOperatingLedger(
    provider,
    partnerBookingArchive,
    payoutOps,
    bookingAcceptance,
    providerServicePricing,
  );
  const partnerOperationsDigestBase = buildPartnerOperationsDigest({
    provider,
    bookingArchive: filteredPartnerBookingArchive,
    bookingAcceptance,
    providerServicePricing,
    dispatchPolicy,
    activityRecords: filteredPartnerActivityRecords,
  });
  const partnerLatestAccessAt = latestPartnerAccessAt(provider);
  const partnerOperationsDigest = partnerOperationsDigestBase.map((row) =>
    row.lane === 'App reachability' && partnerLatestAccessAt
      ? {
          ...row,
          detailNode: (
            <>
              Last app access <DateTimeText fallback="Missing" value={partnerLatestAccessAt} />.
            </>
          ),
        }
      : row,
  );
  const partnerBookingJourneyRows = buildPartnerBookingJourneyRows(
    provider,
    filteredPartnerBookingArchive,
    dispatchPolicy,
    partnerEarningsByBookingId,
  );
  const partnerChatRetentionRows = buildPartnerChatRetentionRows(filteredPartnerBookingArchive);
  const partnerChatRetentionSummary = buildPartnerChatRetentionSummary(partnerChatRetentionRows);
  const partnerBookingOpsLedgerRows = buildPartnerBookingOpsLedgerRows(filteredPartnerBookingArchive);
  const partnerBookingGateAttempts = buildPartnerBookingGateAttemptRows(partnerAuditLogs, provider.id);
  const filteredPartnerBookingGateAttempts = partnerBookingGateAttempts.filter((attempt) =>
    isWithinDetailDateFilter(attempt.at, dateFilters),
  );
  const partnerOperatorCommandQueue = buildPartnerOperatorCommandQueue({
    provider,
    bookingAcceptance,
    providerServicePricing,
    canApproveKyc,
  });
  const partnerOpsNotes = partnerAuditLogs.filter((log) => log.action === 'provider.ops_note.add');
  const partnerOperatorNoteRows = buildPartnerOperatorNoteRows(partnerOpsNotes);
  const partnerApprovalOpenCount = partnerOpenOperationalChecks.filter(
    (check) => check.domain === 'ACCOUNT' || check.domain === 'APPROVAL',
  ).length;
  const partnerWorkOpenCount = partnerOpenOperationalChecks.filter((check) => check.domain === 'WORK').length;
  const partnerFinanceOpenCount = partnerOpenOperationalChecks.filter(
    (check) => check.domain === 'FINANCE',
  ).length;
  const partnerReviewRecordCount =
    partnerReviewRecords.customerReviews.length + partnerReviewRecords.partnerEvaluations.length;
  const canCreateCustomerReview = canViewPartnerReviews;
  const manualReviewBookingOptions = (provider.selectedBookings ?? [])
    .filter(
      (booking) =>
        booking.status === 'COMPLETED' &&
        !booking.review &&
        Boolean(booking.customerProfile?.id),
    )
    .map((booking) => ({
      label: `${
        booking.customerProfile?.user?.fullName ??
        booking.customerProfile?.user?.phone ??
        'Customer'
      } · ${booking.id.slice(0, 8)} · ${formatDateOnly(
        booking.closedAt ?? booking.updatedAt ?? booking.createdAt,
      )}`,
      value: booking.id,
    }));
  const partnerRetainedRecordCount =
    partnerReportRows.length +
    partnerAccountControlRows.length +
    partnerOperatorNoteRows.length +
    partnerRecentTimelineRecords.length;
  const partnerStatusSummaryItems: PartnerDetailSummaryRailItem[] = [
    {
      detail: partnerApprovalOpenCount
        ? `${partnerApprovalOpenCount} approval or account issue(s) need review.`
        : 'Profile, KYC, documents, and account access are clear.',
      href: buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'approval'),
      label: 'Approval',
      value: partnerApprovalOpenCount ? 'Needs action' : 'Approved',
    },
    {
      detail: partnerWorkOpenCount ? (
        `${partnerWorkOpenCount} work readiness issue(s) are open.`
      ) : provider.appActivitySummary?.lastActiveAt ? (
        <>
          Ready to receive work. Last Partner app activity{' '}
          <DateTimeText fallback="Missing" value={provider.appActivitySummary.lastActiveAt} />.
        </>
      ) : (
        'Services and location are ready. App activity has not been recorded.'
      ),
      href: buildPartnerDetailWorkspaceHref(provider.id, 'access', 'readiness'),
      label: 'Work now',
      value: partnerWorkOpenCount ? 'Blocked' : 'Ready',
    },
    {
      detail: `${partnerReviewRecordCount} customer review or Partner evaluation record(s).`,
      href: buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'journey'),
      label: 'Bookings',
      value: `${partnerBookingEvidenceRows.length} booking(s)`,
    },
    {
      detail: partnerFinanceOpenCount
        ? `${partnerFinanceOpenCount} wallet or payout issue(s) need finance follow-up.`
        : 'No wallet receivable or payout hold is open.',
      href: buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'finance'),
      label: 'Money',
      value: (
        <MoneyText amount={partnerWalletSummary.currentBalance} currency={partnerWalletSummary.currency} />
      ),
    },
    {
      detail: 'Operator notes, reports, account controls, and retained activity are available below.',
      href: buildPartnerDetailWorkspaceHref(provider.id, 'control', 'records'),
      label: 'Records',
      value: `${partnerRetainedRecordCount} record(s)`,
    },
  ];
  const connectedPartnerRecordLinks = buildPartnerConnectedRecordLinks({
    provider,
    bookingArchive: partnerBookingArchive,
    bookingGateAttempts: partnerBookingGateAttempts,
    kycEvidence,
    canApproveKyc,
    payoutOps,
  });
  const activityCsvRecords = filteredPartnerActivityRecords.slice(0, PARTNER_ACTIVITY_CSV_EXPORT_LIMIT);
  const filteredActivityCsvHref = buildCsvDataHref(
    activityCsvRecords.map((record) => ({
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
  const detailBaseHref = withPartnerDecisionQueue(
    detailSection === 'control'
      ? buildPartnerDetailWorkspaceHref(provider.id, 'control', controlView)
      : detailSection === 'bookings'
        ? buildPartnerDetailWorkspaceHref(provider.id, 'bookings', bookingsView)
        : detailSection === 'access'
          ? buildPartnerDetailWorkspaceHref(provider.id, 'access', accessView)
          : detailSection === 'dossier'
            ? buildPartnerDetailWorkspaceHref(provider.id, 'dossier', dossierView)
            : `/partners/${provider.id}?section=${detailSection}`,
    decisionQueue,
  );
  const accountConfirmation = buildPartnerAccountActionConfirmation(
    [provider],
    readPartnerAccountConfirmationAction(readSearchParam(detailSearchParams.confirm)),
    provider.id,
    { cancelHref: detailBaseHref, decisionQueue },
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

  const partnerCommandSnapshotDiagnosticSection = shouldLoadAccessDiagnostics ? (
    <PartnerDetailCommandSnapshotSection items={partnerActivityCommandSnapshot} />
  ) : null;
  const partnerRecordDateFilterSection =
    detailSection === 'bookings' ? (
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
        view={bookingsView}
      />
    ) : null;
  const partnerReferenceDiagnosticSection =
    canLoadPartnerDiagnostics &&
    detailSection === 'control' &&
    controlView === 'reference' ? (
      <PartnerDetailReferenceDetails
        helper="Digest, master facts, indexes, ledger, and checklist remain available without competing with approval work."
        label="Reference summaries"
        status="5 blocks"
      >
        <AdminSection
          description="Developer-only Supabase role repair. It is separate from daily approval and account-control actions."
          id="partner-infrastructure-role"
          title="Infrastructure role"
        >
          {provider.verification?.status === 'APPROVED' ? (
            <AdminFormControlLink
              href={partnerAccountActionConfirmHref(provider.id, 'sync-role', {
                baseHref: `/partners/${provider.id}`,
              })}
            >
              Sync role
            </AdminFormControlLink>
          ) : (
            <p className="muted">Profile approval is required before infrastructure role sync.</p>
          )}
        </AdminSection>
        <PartnerDetailOperationsDigestSection
          description="One-screen factual digest for partner operations: identity, activity gate, bookings, chat, KYC, location, app reachability, and staff records."
          id="partner-operations-digest"
          rows={partnerOperationsDigest}
          title="Partner operations digest"
        />
        <PartnerDetailMasterFactsSection facts={partnerMasterFacts} />
        <PartnerDetailOperatingLedgerSection rows={partnerOperatingLedger} />
        <PartnerDetailOperatingChecklistSection
          pillClassForTone={partnerOpsPillClass}
          rows={partnerOperatingChecklist}
        />
      </PartnerDetailReferenceDetails>
    ) : null;
  const partnerBookingOpsLedgerDiagnosticSection =
    canLoadPartnerDiagnostics &&
    detailSection === 'bookings' &&
    bookingsView === 'ledger' ? (
      <PartnerDetailBookingOpsLedgerSection
        rows={partnerBookingOpsLedgerRows}
        statusPillClass={partnerBookingStatusPillClass}
      />
    ) : null;
  const partnerDeviceSessionDiagnosticSection = shouldLoadAccessDiagnostics ? (
    <PartnerDetailDeviceSessionActivitySection
      cardClassForTone={partnerOpsCardClass}
      deviceRows={partnerDeviceRows}
      followUpNeeded={securitySummary.followUpNeeded}
      pillClassForTone={partnerOpsPillClass}
      securityCards={securitySummary.cards}
      sessionRows={partnerSessionRows}
      sharedDeviceRows={partnerSharedDeviceRows}
    />
  ) : null;

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href={decisionQueue ? PARTNER_APPROVAL_QUEUE_HREF : '/partners'}>
            {decisionQueue ? 'Back to Partner approvals' : 'Back to partners'}
          </AdminFormControlLink>
          <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(provider.id)}`}>
            All Partner chats
          </AdminTextLink>
          <ActionMenu
            actions={buildPartnerDetailAccountActionMenuItems(
              {
                blocked: Boolean(provider.blockedAt),
                id: provider.id,
                kycStatus: provider.kyc?.status,
                profileComplete,
                verificationStatus: provider.verification?.status,
              },
              decisionQueue,
            )}
            label={`Partner detail account actions for ${partnerDisplayLabel}`}
          />
        </>
      }
      contentClassName="partners-page partner-detail-page"
      description={`${marketplaceDisplayText(provider.legalName ?? 'Legal name missing')} / ${
        provider.user?.phone ?? 'No phone'
      } / ${provider.city ?? 'No city'}`}
      title={partnerDisplayLabel}
    >
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
          supportingLinks={reviewConfirmation.supportingLinks}
          textInputs={reviewConfirmation.textInputs}
          title={reviewConfirmation.title}
          tone={reviewConfirmation.tone}
        />
      ) : null}

      <PartnerDetailSummaryRailSection
        description="Open a status to jump to the complete information below. No Partner record is hidden."
        id="partner-status-summary"
        items={partnerStatusSummaryItems}
        statusLabel={
          partnerOpenOperationalChecks.length
            ? `${partnerOpenOperationalChecks.length} open action(s)`
            : 'Ready'
        }
        title="Current partner status"
      />

      {detailSection === 'control' ? (
        <PartnerDetailSectionGroup
          description={
            controlView === 'records'
              ? 'Retained reviews, operator notes, and recent activity for follow-up and audit.'
              : controlView === 'reference'
                ? 'Developer-only digest, indexes, and operating ledger for deeper diagnostics.'
                : 'Current approval, hold, and follow-up commands that need an operator decision.'
          }
          eyebrow="Control"
          id="partner-control-section"
          status={
            controlView === 'records'
              ? `${partnerReviewRecords.customerReviews.length + partnerReviewRecords.partnerEvaluations.length + partnerOperatorNoteRows.length + partnerRecentTimelineRecords.length} record(s)`
              : controlView === 'reference'
                ? 'Developer reference'
                : `${partnerOperatorCommandQueue.commands.length} command(s)`
          }
          title={
            controlView === 'records' ? 'Partner control records' : 'Partner control workspace'
          }
        >
          <AdminSection
            description="Keep current decisions, retained records, and Developer diagnostics in separate workspaces."
            id="partner-control-workspace-selector"
            title="Control workspace view"
          >
            <AdminFilterChipGroup ariaLabel="Partner control workspaces">
              <AdminFormControlLink
                aria-current={controlView === 'work' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'control', 'work')}
              >
                Control work
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={controlView === 'records' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'control', 'records')}
              >
                Control records
              </AdminFormControlLink>
              {canLoadPartnerDiagnostics ? (
                <AdminFormControlLink
                  aria-current={controlView === 'reference' ? 'page' : undefined}
                  href={buildPartnerDetailWorkspaceHref(provider.id, 'control', 'reference')}
                >
                  Developer reference
                </AdminFormControlLink>
              ) : null}
            </AdminFilterChipGroup>
          </AdminSection>
          {controlView === 'work' ? (
            <>
              <PartnerDetailOperatorCommandQueueSection
                pillClassForTone={partnerOpsPillClass}
                providerId={provider.id}
                queue={partnerOperatorCommandQueue}
              />
              <PartnerDetailReviewControlPanelSection panel={reviewControlPanel} />
              <PartnerDetailApprovalEvidenceSummarySection rows={approvalEvidenceSummaryRows} />
              <PartnerDetailConnectedRecordsSection
                description={PARTNER_CONNECTED_RECORDS_DESCRIPTION}
                id="partner-connected-operations-records"
                links={connectedPartnerRecordLinks}
                title="Partner connected operations records"
              />
            </>
          ) : null}
          {controlView === 'records' ? (
            <>
              {reviewRecordsFailed ? (
                <AdminErrorState
                  action={
                    <AdminTextLink href={buildPartnerDetailWorkspaceHref(provider.id, 'control', 'records')}>
                      Retry review records
                    </AdminTextLink>
                  }
                  message={
                    reviewRecordsForbidden
                      ? 'You do not have permission to view Partner review records.'
                      : 'Partner review records could not be loaded. Pause this decision and retry.'
                  }
                  title={reviewRecordsForbidden ? 'Review records restricted' : 'Review records unavailable'}
                />
              ) : (
                <AdminReviewRecordsSection
                  basePath={`/partners/${id}`}
                  customerReviews={partnerReviewRecords.customerReviews}
                  description="Customer reviews about this Partner and Partner-written customer evaluations connected to this Partner."
                  id="partner-review-records"
                  partnerEvaluations={partnerReviewRecords.partnerEvaluations}
                  searchParams={detailSearchParams}
                  title="Partner review records"
                />
              )}
              <PartnerDetailOperatorNotesSection
                notes={partnerOperatorNoteRows}
                providerId={provider.id}
                totalCount={partnerOpsNotes.length}
              />
              <PartnerDetailRecentTimelineSection records={partnerRecentTimelineRecords} />
            </>
          ) : null}
          {controlView === 'reference' ? partnerReferenceDiagnosticSection : null}
        </PartnerDetailSectionGroup>
      ) : null}

      {detailSection === 'bookings' ? (
        <PartnerDetailSectionGroup
          description={
            bookingsView === 'evidence'
              ? 'Retained booking bundles and chat evidence for cancellation, no-show, payment, and service review.'
              : bookingsView === 'ledger'
                ? 'Developer-only booking operations notes and internal evidence references.'
                : 'Booking journey, first-pick participation, and marketplace gate decisions for this Partner.'
          }
          eyebrow="Bookings"
          id="partner-booking-section"
          status={
            bookingsView === 'evidence'
              ? `${partnerBookingEvidenceRows.length + partnerBookingChatRecordRows.length} evidence row(s)`
              : bookingsView === 'ledger'
                ? `${partnerBookingOpsLedgerRows.length} ledger row(s)`
                : `${partnerBookingJourneyRows.length} booking row(s)`
          }
          title={
            bookingsView === 'evidence'
              ? 'Partner booking evidence'
              : bookingsView === 'ledger'
                ? 'Partner booking operations ledger'
                : 'Partner booking journey'
          }
        >
          <AdminSection
            description="Keep current booking flow, retained evidence, and Developer ledger records in separate workspaces."
            id="partner-bookings-workspace-selector"
            title="Booking workspace view"
          >
            <AdminFilterChipGroup ariaLabel="Partner booking workspaces">
              <AdminFormControlLink
                aria-current={bookingsView === 'journey' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'journey')}
              >
                Booking journey
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={bookingsView === 'evidence' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'evidence')}
              >
                Chat &amp; evidence
              </AdminFormControlLink>
              {canLoadPartnerDiagnostics ? (
                <AdminFormControlLink
                  aria-current={bookingsView === 'ledger' ? 'page' : undefined}
                  href={buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'ledger')}
                >
                  Developer ledger
                </AdminFormControlLink>
              ) : null}
            </AdminFilterChipGroup>
          </AdminSection>
          {partnerRecordDateFilterSection}
          {bookingsView === 'journey' ? (
            <>
              {canCreateCustomerReview ? (
                <AdminSection
                  description="Publish a review for an actual completed booking. The customer, booking, and admin source stay attached to the record."
                  id="partner-manual-customer-review"
                  status={`${manualReviewBookingOptions.length} eligible booking(s)`}
                  title="Add customer review"
                >
                  {manualReviewBookingOptions.length > 0 ? (
                    <AdminFormGrid action={createPartnerManualCustomerReview}>
                      <input name="providerProfileId" type="hidden" value={provider.id} />
                      <AdminFormSelect
                        label="Customer / completed booking"
                        labelVisibility="visible"
                        name="bookingId"
                        options={manualReviewBookingOptions}
                        required
                      />
                      <AdminFormDate
                        label="Review date"
                        labelVisibility="visible"
                        name="reviewDate"
                        required
                      />
                      <AdminFormSelect
                        defaultValue="5"
                        label="Rating"
                        labelVisibility="visible"
                        name="rating"
                        options={[
                          { label: '5 stars', value: '5' },
                          { label: '4 stars', value: '4' },
                          { label: '3 stars', value: '3' },
                          { label: '2 stars', value: '2' },
                          { label: '1 star', value: '1' },
                        ]}
                        required
                      />
                      <AdminFormTextarea
                        className="form-grid-wide"
                        label="Customer review"
                        labelVisibility="visible"
                        maxLength={1000}
                        name="comment"
                        required
                        rows={4}
                      />
                      <AdminFormActionRow>
                        <AdminFormControlButton type="submit">Publish review</AdminFormControlButton>
                      </AdminFormActionRow>
                    </AdminFormGrid>
                  ) : (
                    <p className="muted">
                      Every loaded completed booking already has a review, or no eligible completed
                      booking is available.
                    </p>
                  )}
                </AdminSection>
              ) : null}
              <PartnerDetailBookingJourneySection
                description="Booking-by-booking factual journey for this partner: first-pick window, 10 km marketplace participation, customer final selection, retained chat, money rows, and staff records."
                emptyDetail="Use a wider date range to show older booking rows."
                emptyTitle="No partner booking journey matched this filter"
                id="partner-booking-journey"
                rows={partnerBookingJourneyRows}
                title="Partner booking journey"
              />
              <PartnerDetailBookingGateEvidenceSection
                filteredAttempts={filteredPartnerBookingGateAttempts}
                loadedAttempts={partnerBookingGateAttempts}
              />
            </>
          ) : null}
          {bookingsView === 'evidence' ? (
            <>
              <PartnerDetailBookingEvidenceBundlesSection
                rows={partnerBookingEvidenceRows}
                statusPillClass={partnerBookingStatusPillClass}
              />
              <PartnerDetailChatRetentionLedgerSection
                description="Customer final selection creates the Partner chat. Mobile apps can hide completed-service chats, while admin keeps the retained transcript for cancellation, no-show, payment, and service evidence review."
                emptyMessage="No Partner chat retention row matched this date filter."
                id="partner-chat-retention-ledger"
                rows={partnerChatRetentionRows}
                statusPillClass={partnerBookingStatusPillClass}
                summary={partnerChatRetentionSummary}
                title="Partner chat retention ledger"
              />
              <PartnerDetailBookingChatRecordsSection
                openBookingsHref={`/bookings?q=${encodeURIComponent(provider.id)}`}
                rows={partnerBookingChatRecordRows}
              />
            </>
          ) : null}
          {bookingsView === 'ledger' ? partnerBookingOpsLedgerDiagnosticSection : null}
        </PartnerDetailSectionGroup>
      ) : null}

      {detailSection === 'access' ? (
        <PartnerDetailSectionGroup
          description={
            accessView === 'diagnostics'
              ? 'Developer-only app activity, device reachability, and session evidence.'
              : accessView === 'controls'
                ? 'Customer complaints, staff findings, payout holds, and account restrictions that need review.'
                : 'Current marketplace readiness, booking gate decision, and repair actions.'
          }
          eyebrow="Access"
          id="partner-access-section"
          status={
            accessView === 'diagnostics'
              ? `${partnerAppActivityRows.length} diagnostic row(s)`
              : accessView === 'controls'
                ? `${partnerReportRows.length + partnerAccountControlRows.length} control signal(s)`
                : 'Current readiness'
          }
          title={
            accessView === 'diagnostics'
              ? 'Partner device and session diagnostics'
              : accessView === 'controls'
                ? 'Partner reports and account controls'
                : 'Partner marketplace readiness'
          }
        >
          <AdminSection
            description="Keep marketplace readiness, operator controls, and Developer diagnostics in separate workspaces."
            id="partner-access-workspace-selector"
            title="Access workspace view"
          >
            <AdminFilterChipGroup ariaLabel="Partner access workspaces">
              <AdminFormControlLink
                aria-current={accessView === 'readiness' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'access', 'readiness')}
              >
                Marketplace readiness
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={accessView === 'controls' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'access', 'controls')}
              >
                Reports &amp; controls
              </AdminFormControlLink>
              {canLoadPartnerDiagnostics ? (
                <AdminFormControlLink
                  aria-current={accessView === 'diagnostics' ? 'page' : undefined}
                  href={buildPartnerDetailWorkspaceHref(provider.id, 'access', 'diagnostics')}
                >
                  Device &amp; sessions
                </AdminFormControlLink>
              ) : null}
            </AdminFilterChipGroup>
          </AdminSection>
          {accessView === 'readiness' ? (
            <>
              <PartnerDetailReadinessSnapshotSection snapshot={readinessSnapshot} />
              <PartnerDetailBookingGateDecisionSection
                cardClassForTone={partnerOpsCardClass}
                decision={bookingGateDecision}
                pillClassForTone={partnerOpsPillClass}
              />
              <PartnerAcceptanceRepairCommandSection command={acceptanceRepairCommand} />
              <PartnerDetailAcceptanceUnblockPlaybookSection
                pillClassForTone={partnerOpsPillClass}
                steps={acceptanceUnblockPlaybook}
              />
            </>
          ) : null}
          {accessView === 'controls' ? (
            <PartnerDetailReportsControlsSection
              accountControls={partnerAccountControlRows}
              payoutHold={reportControlPayoutHold}
              providerId={provider.id}
              reports={partnerReportRows}
              reportsDeskHref={buildPartnerControlDetailsHref('reports', { q: provider.id })}
            />
          ) : null}
          {shouldLoadAccessDiagnostics ? (
            <>
              {partnerCommandSnapshotDiagnosticSection}
              <PartnerDetailAppActivitySection
                rows={partnerAppActivityRows}
                summary={partnerActivitySummary}
              />
              <PartnerDetailDailyActivityDigestSection days={partnerDailyActivityDigest} />
              {partnerDeviceSessionDiagnosticSection}
            </>
          ) : null}
        </PartnerDetailSectionGroup>
      ) : null}

      {detailSection === 'dossier' ? (
        <PartnerDetailSectionGroup
          description="Approval decisions, retained evidence, and finance records are separate bounded workspaces."
          eyebrow="Dossier"
          id="partner-dossier-section"
          status={
            dossierView === 'finance'
              ? `${walletWithdrawalRequests.length + partnerManualAdjustmentRows.length} finance record(s)`
              : dossierView === 'evidence'
                ? `${reviewHistoryRows.length + partnerTypedDocumentRows.length + partnerPublicMediaRows.length} evidence record(s)`
                : reviewChecklist.ready && registrationDossier.ready
                  ? 'Level 2 ready'
                  : `${reviewChecklist.blockers + registrationDossier.blockers} blocker(s)`
          }
          title={
            dossierView === 'finance'
              ? 'Partner finance records'
              : dossierView === 'evidence'
                ? 'Partner evidence records'
                : 'Partner approval decision'
          }
        >
          <AdminSection
            description="Open only the decision, retained evidence, or finance records needed for the current task."
            id="partner-dossier-workspace-selector"
            title="Dossier workspace view"
          >
            <AdminFilterChipGroup ariaLabel="Partner dossier workspaces">
              <AdminFormControlLink
                aria-current={dossierView === 'approval' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'approval')}
              >
                Approval decision
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={dossierView === 'evidence' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'evidence')}
              >
                Evidence records
              </AdminFormControlLink>
              <AdminFormControlLink
                aria-current={dossierView === 'finance' ? 'page' : undefined}
                href={buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'finance')}
              >
                Finance records
              </AdminFormControlLink>
            </AdminFilterChipGroup>
          </AdminSection>

          {dossierView === 'approval' ? (
            <>
              <PartnerDetailApprovalChecklistSection checklist={reviewChecklist} />
              <PartnerDetailRegistrationDossierSection dossier={registrationDossier} />
              <PartnerDetailResubmissionGuidanceSection plan={resubmissionPlan} />
            </>
          ) : null}

          {dossierView === 'evidence' ? (
            <>
              <PartnerDetailReviewHistorySection
                rows={reviewHistoryRows}
                totalCount={provider.verificationLogs?.length ?? 0}
              />
              <PartnerDetailDossierCluster
                helper="Name, public profile, service options, required documents, and KYC evidence used for Level 2 approval."
                label="Required approval evidence"
                status="5 cards"
              >
                <div className="partner-detail-dossier-stack">
                  <PartnerDetailProfileOverviewCard
                    avatarStatus={partnerProfileAvatarStatus(provider.status)}
                    bioVietnamese={provider.bio}
                    facts={partnerProfileOverviewFacts}
                    name={provider.displayName}
                    partnerId={provider.id}
                    statusBadges={[
                      partnerOperatingStatusLabel(provider.status),
                      `KYC ${partnerOperatingStatusLabel(provider.kyc?.status ?? 'NOT_SUBMITTED')}`,
                      partnerOperatingStatusLabel(provider.level ?? 'LEVEL_1'),
                    ]}
                    subtitle={[provider.user?.phone, provider.city].filter(Boolean).join(' / ') || 'Partner profile'}
                    translations={partnerProfileTranslations}
                  />
                  <PartnerDetailServicePricingSection
                    readyCount={providerServicePricing.readyCount}
                    rows={partnerServicePricingDisplayRows}
                  />

                  <PartnerDetailTypedDocumentsCard
                    canApprove={canApproveKyc}
                    canReview={canReviewPartnerKyc}
                    decisionQueue={decisionQueue}
                    hasKycRecord={Boolean(provider.kyc)}
                    holdReason={provider.kyc?.rejectionReason}
                    kycStatus={provider.kyc?.status}
                    partnerId={provider.id}
                    rows={partnerTypedDocumentRows}
                  />

                  <PartnerDetailPublicProfileMediaCard
                    canEdit={canEditPartnerProfile}
                    canReview={canReviewPartnerKyc}
                    partnerId={provider.id}
                    rows={partnerPublicMediaRows}
                  />
                </div>
              </PartnerDetailDossierCluster>

              <PartnerDetailReferenceDetails
                helper="Location freshness and accepted agreements support operations, but they are not the first approval read."
                label="Profile and activity references"
                status="2 cards"
              >
                <AdminDetailGrid className="partner-detail-dossier-grid">
                  <PartnerDetailLocationActivityCard
                    coordinatesLabel={
                      provider.currentLat && provider.currentLng ? partnerLocationSavedLabel() : null
                    }
                    lastLocationLabel={
                      provider.currentLocationUpdatedAt ? (
                        <DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} />
                      ) : null
                    }
                    snapshots={partnerLocationSnapshotBadges}
                  />

                  <PartnerDetailAgreementsCard agreements={partnerAgreementBadges} />
                </AdminDetailGrid>
              </PartnerDetailReferenceDetails>
            </>
          ) : null}

          {dossierView === 'finance' ? (
            <PartnerDetailReferenceDetails
              helper="Wallet debt, withdrawal details, payout batches, and legacy tax rows are finance follow-up records. They do not gate Level 2 approval."
              label="Finance-only evidence"
              status={
                financeRecordsFailed ? (
                  'Unavailable'
                ) : !canViewFinanceSettlements && !canAdjustPartnerWallet ? (
                  'Restricted'
                ) : financeRecordsForbidden ? (
                  'Partial access'
                ) : hasCashFeeDebt ? (
                  <>
                    <MoneyText amount={cashFeeDebtTotal} /> open debt
                  </>
                ) : (
                  'Reference'
                )
              }
            >
              {financeRecordsFailed ? (
                <AdminErrorState
                  action={
                    <AdminTextLink href={buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'finance')}>
                      Retry financial data
                    </AdminTextLink>
                  }
                  message={
                    financeRequestForbidden
                      ? 'You do not have permission to view this financial data.'
                      : 'Financial data could not be loaded. Pause this decision and retry.'
                  }
                  title={financeRequestForbidden ? 'Financial data restricted' : 'Financial data unavailable'}
                />
              ) : (
                <>
                  {canViewFinanceSettlements ? (
                    <>
                      <PartnerDetailFinanceFollowUpSection rows={partnerFinanceFollowUpRows} />
                      <PartnerDetailCashDebtOriginSection
                        hasCashFeeDebt={hasCashFeeDebt}
                        hasSettlementRef={openCashDebtEarnings.some((earning) => earning.settlementRef)}
                        openDebtLabel={<MoneyText amount={cashFeeDebtTotal} />}
                        openRowCount={openCashDebtEarnings.length}
                        rows={cashDebtOriginRows}
                      />
                      <PartnerDetailWalletSummarySection summary={partnerWalletSummary} />
                      <PartnerDetailWalletWithdrawalRequestSection
                        requests={walletWithdrawalRequests}
                        updateWithdrawalRequestAction={updatePartnerWalletWithdrawalRequest}
                      />
                      <PartnerDetailPayoutOperationsSection
                        cardClassForTone={partnerOpsCardClass}
                        earningsRows={payoutEarningRows}
                        hasCashFeeDebt={hasCashFeeDebt}
                        operations={payoutOperationsView}
                        partnerControlsHref={buildPartnerControlDetailsHref('reports', { q: provider.id })}
                        payoutBatchRows={payoutBatchRows}
                        pillClassForTone={partnerOpsPillClass}
                      />
                      <AdminDetailGrid className="partner-detail-dossier-grid">
                        <PartnerDetailBankPayoutGateCard bank={partnerBankPayoutGate} />
                        <PartnerDetailTaxProfileCard taxProfile={partnerTaxProfile} />
                        <PartnerDetailRecentPayoutRecordsCard
                          earningCount={partnerEarnings.length}
                          earnings={partnerRecentPayoutRecordLines}
                          payoutBatchCount={provider.payoutBatches?.length ?? 0}
                        />
                      </AdminDetailGrid>
                    </>
                  ) : (
                    <AdminErrorState
                      message="You do not have permission to view this financial data."
                      title="Settlement data restricted"
                    />
                  )}
                  {canAdjustPartnerWallet ? (
                    <AdminManualWalletAdjustmentHistory
                      rows={partnerManualAdjustmentRows}
                      walletAdjustmentsHref={partnerManualAdjustmentHref}
                    />
                  ) : (
                    <AdminErrorState
                      message="You do not have permission to view or adjust this Partner wallet."
                      title="Wallet adjustment data restricted"
                    />
                  )}
                </>
              )}
            </PartnerDetailReferenceDetails>
          ) : null}
        </PartnerDetailSectionGroup>
      ) : null}
    </AdminPageTemplate>
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

function partnerLocationSavedLabel() {
  return 'Latest Partner location saved for dispatch checks.';
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
    case 'delete-media':
      return deletePartnerPublicMedia;
    case 'hold-kyc':
      return putProviderKycOnHold;
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

function partnerProfileIsComplete(provider: ProviderDetail) {
  return Boolean(provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim());
}

function providerDisplayLabel(provider: ProviderDetail) {
  return marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
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
    cashDebtLabel: <MoneyText amount={bookingAcceptance.cashDebt} />,
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
    at: record.at,
    detail: record.detail,
    detailNode: record.detailNode,
    key: `${record.type}-${record.id}-${record.at}-${index}`,
    title: record.title,
    type: record.type,
  }));
}

function buildPartnerServicePricingDisplayRows(
  rows: ProviderServicePricingRow[],
): PartnerServicePricingDisplayRow[] {
  return rows.map((row) => ({
    bookable: row.bookable,
    durationLabel: row.durationMin ? `${row.durationMin} min` : 'No duration',
    id: row.id,
    issue: row.issue,
    name: row.name,
    payoutRuleLabel: `${row.payoutRuleCount} payout rule(s)`,
    priceLine: (
      <>
        Customer <MoneyText amount={row.customerPrice} /> / admin minimum <MoneyText amount={row.basePrice} />
        {row.providerPayoutAmount !== null ? (
          <>
            {' '}
            / partner payout <MoneyText amount={row.providerPayoutAmount} />
          </>
        ) : null}
      </>
    ),
  }));
}
