import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
  AdminOperatorAccessDeniedError,
  adminGet,
  adminPostOrThrow,
  type AdminBookingSettlementGapDryRun,
  type AdminBookingSettlementGapList,
  type AdminBookingSettlementGapRepairPreview,
  type AdminBookingSettlementGapRepairResult,
  type AdminBookingSettlementRepairCheckpoint,
  type AdminBookingSettlementGapSummary,
  type AdminCashSettlementSummary,
  type AdminEarning,
  type AdminEarningSummary,
  type AdminPayment,
  type AdminPaymentSummary,
  type AdminPayoutBatch,
  type AdminRefund,
  type AdminRefundSummary,
  type AdminUser,
} from '../../lib/admin-api';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import {
  AdminFormControlButton,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminNoticeCard } from '../../components/admin-surface';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { formatRelativeAge } from '../../lib/admin-format';
import {
  buildCloseoutTasks,
  buildFinanceCloseoutApiHrefs,
  buildFinanceCloseoutEvidenceChecklist,
  buildFinanceCloseoutFilters,
  buildFinanceCloseoutOperationsHref,
  buildFinanceCloseoutPageHref,
  buildFinanceCloseoutSettlementBatchReviewHref,
  buildFinanceCloseoutSettlementRepairHref,
  buildFinanceCloseoutSettlementPagination,
  buildFinanceCloseoutSettlementPeriodOptions,
  buildFinanceCloseoutSettlementDryRunHref,
  buildHandoffRows,
  buildReconciliation,
  buildShiftCloseActionMap,
  FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS,
  FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS,
  FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS,
} from '../../lib/finance-closeout';
import { FinanceCloseoutEvidenceChecklistSection } from './finance-closeout-evidence-checklist-section';
import { FinanceCloseoutCashDebtHandoffSection } from './finance-closeout-cash-debt-handoff-section';
import { FinanceCloseoutPaymentEarningSection } from './finance-closeout-payment-earning-section';
import { FinanceCloseoutPayoutReleaseChecksSection } from './finance-closeout-payout-release-checks-section';
import { FinanceCloseoutShiftActionMapSection } from './finance-closeout-shift-action-map-section';
import { FinanceCloseoutSettlementBacklogSection } from './finance-closeout-settlement-backlog-section';
import { FinanceCloseoutSettlementBatchPreviewSection } from './finance-closeout-settlement-batch-preview-section';
import { FinanceCloseoutSettlementDryRunSection } from './finance-closeout-settlement-dry-run-section';
import { FinanceCloseoutSettlementRepairDrawer } from './finance-closeout-settlement-repair-drawer';
import { FinanceCloseoutTaskBoardSection } from './finance-closeout-task-board-section';

type FinanceCloseoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceCloseoutPage({ searchParams }: FinanceCloseoutPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildFinanceCloseoutFilters(params);
  const isSettlementWorkspace = filters.workspace === 'settlement';
  const repairBookingId = readPageParam(params, 'repairBookingId');
  const checkpointBookingId = readPageParam(params, 'checkpointBookingId');
  const repairNotice = readPageParam(params, 'repairNotice');
  const shouldRunSettlementDryRun = readPageParam(params, 'settlementDryRun') === '1';
  const reviewBookingIds = readPageParamList(params, 'reviewBookingId', 10);
  const apiHrefs = buildFinanceCloseoutApiHrefs(filters);
  const emptyEarningsSummary: AdminEarningSummary = {
    count: 0,
    grossAmount: 0,
    platformFee: 0,
    withholdingAmount: 0,
    netAmount: 0,
    pendingNetAmount: 0,
    availableNetAmount: 0,
    paidNetAmount: 0,
    currency: 'VND',
  };
  const emptySettlementGaps: AdminBookingSettlementGapList = {
    generatedAt: '',
    hasNext: false,
    items: [],
    skip: (filters.settlementPage - 1) * filters.settlementPageSize,
    take: filters.settlementPageSize,
    total: 0,
  };
  const [
    payments,
    paymentSummary,
    refunds,
    refundSummary,
    earningsSummary,
    earnings,
    payouts,
    cashSummary,
    settlementGaps,
    settlementGapSummary,
    settlementDryRun,
    repairPreview,
    financeApprovers,
    selectedRepairPreviews,
    repairCheckpoint,
  ] = await Promise.all([
    isSettlementWorkspace ? Promise.resolve<AdminPayment[]>([]) : adminGet<AdminPayment[]>(apiHrefs.paymentsHref, []),
    isSettlementWorkspace
      ? Promise.resolve<AdminPaymentSummary | null>(null)
      : adminGet<AdminPaymentSummary | null>(apiHrefs.paymentSummaryHref, null),
    isSettlementWorkspace ? Promise.resolve<AdminRefund[]>([]) : adminGet<AdminRefund[]>(apiHrefs.refundsHref, []),
    isSettlementWorkspace
      ? Promise.resolve<AdminRefundSummary | null>(null)
      : adminGet<AdminRefundSummary | null>(apiHrefs.refundSummaryHref, null),
    isSettlementWorkspace
      ? Promise.resolve<AdminEarningSummary>(emptyEarningsSummary)
      : adminGet<AdminEarningSummary>(apiHrefs.earningsSummaryHref, emptyEarningsSummary),
    isSettlementWorkspace ? Promise.resolve<AdminEarning[]>([]) : adminGet<AdminEarning[]>(apiHrefs.earningsHref, []),
    isSettlementWorkspace
      ? Promise.resolve<AdminPayoutBatch[]>([])
      : adminGet<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, []),
    isSettlementWorkspace
      ? Promise.resolve<AdminCashSettlementSummary | null>(null)
      : adminGet<AdminCashSettlementSummary | null>(apiHrefs.cashSettlementSummaryHref, null),
    isSettlementWorkspace
      ? adminGet<AdminBookingSettlementGapList>(apiHrefs.bookingSettlementGapsHref, emptySettlementGaps)
      : Promise.resolve<AdminBookingSettlementGapList>(emptySettlementGaps),
    adminGet<AdminBookingSettlementGapSummary | null>(apiHrefs.bookingSettlementGapSummaryHref, null),
    isSettlementWorkspace && shouldRunSettlementDryRun
      ? adminGet<AdminBookingSettlementGapDryRun | null>(apiHrefs.bookingSettlementGapDryRunHref, null)
      : Promise.resolve<AdminBookingSettlementGapDryRun | null>(null),
    isSettlementWorkspace && repairBookingId
      ? adminGet<AdminBookingSettlementGapRepairPreview | null>(
          `/admin/booking-settlement-gaps/${encodeURIComponent(repairBookingId)}/preview`,
          null,
        )
      : Promise.resolve<AdminBookingSettlementGapRepairPreview | null>(null),
    isSettlementWorkspace && repairBookingId
      ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
      : Promise.resolve<AdminUser[]>([]),
    isSettlementWorkspace && reviewBookingIds.length
      ? Promise.all(
          reviewBookingIds.map((bookingId) =>
            adminGet<AdminBookingSettlementGapRepairPreview | null>(
              `/admin/booking-settlement-gaps/${encodeURIComponent(bookingId)}/preview`,
              null,
            ),
          ),
        )
      : Promise.resolve<Array<AdminBookingSettlementGapRepairPreview | null>>([]),
    isSettlementWorkspace && checkpointBookingId
      ? adminGet<AdminBookingSettlementRepairCheckpoint | null>(
          `/admin/booking-settlement-gaps/${encodeURIComponent(checkpointBookingId)}/checkpoint`,
          null,
        )
      : Promise.resolve<AdminBookingSettlementRepairCheckpoint | null>(null),
  ]);

  const currency = earningsSummary.currency || payments[0]?.currency || cashSummary?.currency || 'VND';
  const filteredRefunds = refunds;
  const filteredEarnings = earnings;
  const filteredPayouts = payouts;
  const filteredEarningsSummary = { ...earningsSummary, currency };
  const reconciliation = buildReconciliation({
    payments,
    paymentSummary,
    refunds: filteredRefunds,
    refundSummary,
    earningsSummary: filteredEarningsSummary,
    earnings: filteredEarnings,
    payouts: filteredPayouts,
    cashSummary,
    currency,
    range: filters.range,
  });
  const closeoutTasks = buildCloseoutTasks(reconciliation);
  const evidenceChecklist = buildFinanceCloseoutEvidenceChecklist(reconciliation);
  const shiftCloseActionMap = buildShiftCloseActionMap(reconciliation);
  const handoffRows = buildHandoffRows(reconciliation);
  const closeoutRangeScope = filters.label;
  const settlementPagination = buildFinanceCloseoutSettlementPagination(settlementGaps);
  const selectedSettlementPreviews = selectedRepairPreviews.filter(
    (preview): preview is AdminBookingSettlementGapRepairPreview => preview !== null,
  );
  const settlementPeriodOptions = buildFinanceCloseoutSettlementPeriodOptions();
  const settlementPaymentMethodLabel =
    FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS.find(
      (option) => option.value === filters.settlementPaymentMethod,
    )?.label ?? 'All payment methods';

  return (
    <AdminPageTemplate
      description={
        isSettlementWorkspace
          ? 'Controlled review and repair workspace for completed bookings without a retained settlement snapshot.'
          : 'End-of-shift operations board for payment holds, refunds, earnings, cash wallet debt, and payout releases.'
      }
      metrics={
        isSettlementWorkspace
          ? [
              {
                helper: 'Completed bookings older than 24 hours without a settlement snapshot.',
                kind: 'risk',
                label: 'Settlement backlog',
                scope: 'Backlog >24h',
                value: settlementGapSummary?.backlog ?? settlementGaps.total,
              },
              {
                helper: 'Canonical booking evidence can be reconstructed through the guarded repair flow.',
                kind: 'action',
                label: 'Canonical repair',
                scope: 'Repair queue',
                value: settlementGapSummary?.canonical ?? 0,
              },
              {
                helper: 'Historical paid evidence is ready for preview and dual approval.',
                kind: 'action',
                label: 'Historical ready',
                scope: 'Repair queue',
                value: settlementGapSummary?.historicalReady ?? 0,
              },
              {
                helper: 'Evidence must be corrected before a settlement snapshot can be created.',
                kind: 'risk',
                label: 'Evidence blocked',
                scope: 'Needs review',
                value: settlementGapSummary?.evidenceBlocked ?? 0,
              },
              {
                helper: 'Finance must inspect these rows before choosing a repair path.',
                kind: 'risk',
                label: 'Manual review',
                scope: 'Needs review',
                value: settlementGapSummary?.manualReview ?? 0,
              },
            ]
          : [
              {
                helper: 'Completed bookings older than 24 hours without a settlement snapshot.',
                kind: 'risk',
                label: 'Settlement backlog',
                scope: 'Backlog >24h',
                value: settlementGapSummary?.backlog ?? 0,
              },
              {
                helper: 'Payment holds and cash rows to close for this range.',
                kind: 'action',
                label: 'Open payment items',
                scope: closeoutRangeScope,
                value: reconciliation.openPaymentCount,
              },
              {
                helper: 'Refund cases still open for this range.',
                kind: 'risk',
                label: 'Refund items',
                scope: closeoutRangeScope,
                value: reconciliation.openRefundCount,
              },
              {
                label: 'Cash debt',
                value: <MoneyText amount={reconciliation.cashDebtAmount} currency={currency} />,
                helper: 'Partner cash-fee debt needing settlement evidence for this range.',
                kind: 'risk',
                scope: closeoutRangeScope,
              },
              {
                label: 'Available payout',
                value: <MoneyText amount={filteredEarningsSummary.availableNetAmount} currency={currency} />,
                helper: 'Partner net waiting for payout batching in this range.',
                kind: 'action',
                scope: closeoutRangeScope,
              },
              {
                helper: 'Payout batches still waiting for release checks.',
                kind: 'action',
                label: 'Open payout batches',
                scope: closeoutRangeScope,
                value: reconciliation.openPayoutCount,
              },
              {
                helper: 'Payment or payout references to complete before handoff.',
                kind: 'risk',
                label: 'Missing refs',
                scope: closeoutRangeScope,
                value: reconciliation.missingReferenceCount,
              },
            ]
      }
      title="Finance Closeout"
    >
      {repairNotice ? (
        <AdminNoticeCard
          className="admin-mb-16"
          role={repairNotice === 'repaired' ? 'status' : 'alert'}
          tone={repairNotice === 'repaired' ? 'success' : repairNotice === 'checkpoint-failed' ? 'warning' : 'danger'}
        >
          <strong>
            {repairNotice === 'repaired'
              ? 'Settlement repaired and verified'
              : repairNotice === 'checkpoint-failed'
                ? 'Settlement recorded, accounting review required'
                : 'Settlement repair not completed'}
          </strong>
          <p className="muted">{settlementRepairNoticeMessage(repairNotice)}</p>
          {repairCheckpoint ? (
            <p className="muted">
              Checkpoint {repairCheckpoint.status}
              {repairCheckpoint.blockingFailures.length > 0
                ? ` · ${repairCheckpoint.blockingFailures.join(', ')}`
                : ` · ${repairCheckpoint.checks.length} checks passed`}
            </p>
          ) : null}
        </AdminNoticeCard>
      ) : null}

      <AdminFilterPanel
        className="admin-mt-16 admin-mb-16"
        description="Daily closeout work and historical settlement repair are loaded independently."
        resultLabel={isSettlementWorkspace ? 'Settlement repair' : 'Operations closeout'}
        title="Closeout workspace"
      >
        <AdminSegmentedControl
          activeValue={filters.workspace}
          ariaLabel="Finance closeout workspaces"
          options={[
            {
              href: buildFinanceCloseoutOperationsHref(filters.range),
              label: 'Operations closeout',
              value: 'operations',
            },
            {
              href: buildFinanceCloseoutPageHref(filters, { settlementPage: 1 }),
              label: 'Settlement repair',
              value: 'settlement',
            },
          ]}
        />
      </AdminFilterPanel>

      {!isSettlementWorkspace ? (
        <AdminFilterPanel
        actions={
          <AdminTextLink href="/audit-log?bucket=Finance%2FCloseout">Open finance audit</AdminTextLink>
        }
        className="admin-mb-16"
        description={
          <>
            Range: {filters.label}. Refunds, earnings, payout batches, and local cash debt use record dates.
            Payment hold rows remain all-time until payment timestamps are exposed by the API.
          </>
        }
        resultLabel={filters.label}
        title="Finance date range"
      >
        <div className="booking-date-filter-bar finance-closeout-filter-group">
          <span className="finance-closeout-filter-group-label">Range</span>
          <AdminSegmentedControl
            activeValue={filters.range}
            ariaLabel="Finance closeout date range"
            className="finance-closeout-filter-buttons"
            options={[
              {
                href: buildFinanceCloseoutOperationsHref('all'),
                label: 'All records',
                value: 'all',
              },
              {
                href: buildFinanceCloseoutOperationsHref('today'),
                label: 'Today',
                value: 'today',
              },
              {
                href: buildFinanceCloseoutOperationsHref('7d'),
                label: 'Last 7 days',
                value: '7d',
              },
              {
                href: buildFinanceCloseoutOperationsHref('30d'),
                label: 'Last 30 days',
                value: '30d',
              },
            ]}
          />
        </div>
        <AdminFilterSummary
          ariaLabel="Active finance closeout filters"
          labels={[`Range: ${filters.label}`]}
          tone="info"
        />
      </AdminFilterPanel>
      ) : null}

      {isSettlementWorkspace ? (
        <AdminFilterPanel
        actions={
          <AdminTextLink
            href={buildFinanceCloseoutPageHref(filters, {
              settlementAge: 'backlog',
              settlementPage: 1,
              settlementPaymentMethod: 'all',
              settlementPeriod: 'all',
              settlementQuery: '',
              settlementTrack: 'canonical',
            })}
          >
            Clear filters
          </AdminTextLink>
        }
        className="admin-mb-16"
        description="Completed bookings without a settlement snapshot. Choose a repair track first, then age. Historical readiness is a baseline evidence check; the preview remains the final finance safety gate."
        resultLabel={`${settlementGaps.total} booking(s)`}
        title="Settlement gap filters"
      >
        <div className="booking-date-filter-bar finance-closeout-filter-group">
          <span className="finance-closeout-filter-group-label">Repair track</span>
          <AdminSegmentedControl
            activeValue={filters.settlementTrack}
            ariaLabel="Settlement repair track"
            className="finance-closeout-filter-buttons"
            options={FINANCE_CLOSEOUT_SETTLEMENT_TRACK_OPTIONS.map((option) => ({
              href: buildFinanceCloseoutPageHref(filters, {
                settlementPage: 1,
                settlementTrack: option.value,
              }),
              ...option,
            }))}
          />
        </div>
        <div className="booking-date-filter-bar finance-closeout-filter-group">
          <span className="finance-closeout-filter-group-label">Age</span>
          <AdminSegmentedControl
            activeValue={filters.settlementAge}
            ariaLabel="Settlement gap age"
            className="finance-closeout-filter-buttons"
            options={FINANCE_CLOSEOUT_SETTLEMENT_AGE_OPTIONS.map((option) => ({
              href: buildFinanceCloseoutPageHref(filters, {
                settlementAge: option.value,
                settlementPage: 1,
              }),
              ...option,
            }))}
          />
        </div>
        <AdminFormShell
          action="/finance-closeout"
          className="admin-directory-filter-grid admin-mt-12"
          method="get"
        >
          <input name="view" type="hidden" value="settlement" />
          <input name="range" type="hidden" value={filters.range} />
          <input name="settlementAge" type="hidden" value={filters.settlementAge} />
          <input name="settlementPage" type="hidden" value="1" />
          <input name="settlementTrack" type="hidden" value={filters.settlementTrack} />
          <AdminFormSelect
            defaultValue={filters.settlementPeriod}
            label="Settlement month"
            labelVisibility="visible"
            name="settlementPeriod"
            options={settlementPeriodOptions}
          />
          <AdminFormSelect
            defaultValue={filters.settlementPaymentMethod}
            label="Payment method"
            labelVisibility="visible"
            name="settlementPaymentMethod"
            options={FINANCE_CLOSEOUT_SETTLEMENT_PAYMENT_METHOD_OPTIONS}
          />
          <AdminFormSearch
            defaultValue={filters.settlementQuery}
            label="Search settlement backlog"
            name="q"
            placeholder="Booking, customer, phone, or Partner"
          />
          <AdminFormControlButton className="button-secondary" type="submit">
            Search backlog
          </AdminFormControlButton>
        </AdminFormShell>
        <AdminFilterSummary
          ariaLabel="Settlement gap age summary"
          labels={[
            `Queue: ${filters.settlementAgeLabel}`,
            `Track: ${filters.settlementTrackLabel}`,
            `Month: ${filters.settlementPeriod === 'all' ? 'All months' : filters.settlementPeriod}`,
            `Payment: ${settlementPaymentMethodLabel}`,
            `Canonical: ${settlementGapSummary?.canonical ?? 0}`,
            `Historical ready: ${settlementGapSummary?.historicalReady ?? 0}`,
            `Evidence blocked: ${settlementGapSummary?.evidenceBlocked ?? 0}`,
            `Manual review: ${settlementGapSummary?.manualReview ?? 0}`,
            `24–72h: ${settlementGapSummary?.age24To72Hours ?? 0}`,
            `3–7d: ${settlementGapSummary?.age3To7Days ?? 0}`,
            `7d+: ${settlementGapSummary?.age7DaysPlus ?? 0}`,
            `Under 24h: ${settlementGapSummary?.recent ?? 0}`,
            `Oldest: ${formatRelativeAge(settlementGapSummary?.oldestGapAt, 'None')}`,
          ]}
          tone={(settlementGapSummary?.backlog ?? 0) > 0 ? 'warning' : 'success'}
        />
      </AdminFilterPanel>
      ) : null}

      {isSettlementWorkspace ? (
        <>
          <FinanceCloseoutSettlementBacklogSection
            hrefForPage={(page) => buildFinanceCloseoutPageHref(filters, { settlementPage: page })}
            hrefForRepair={(bookingId) => buildFinanceCloseoutSettlementRepairHref(filters, bookingId)}
            pagination={settlementPagination}
            reviewFormState={{
              q: filters.settlementQuery,
              range: filters.range,
              settlementAge: filters.settlementAge,
              settlementPage: filters.settlementPage,
              settlementPaymentMethod: filters.settlementPaymentMethod,
              settlementPeriod: filters.settlementPeriod,
              settlementTrack: filters.settlementTrack,
            }}
            rows={settlementGaps.items}
          />

          <FinanceCloseoutSettlementDryRunSection
            clearHref={buildFinanceCloseoutPageHref(filters)}
            hrefForBatch={(bookingIds) => buildFinanceCloseoutSettlementBatchReviewHref(filters, bookingIds)}
            report={settlementDryRun}
            runHref={buildFinanceCloseoutSettlementDryRunHref(filters)}
          />

          <FinanceCloseoutSettlementBatchPreviewSection
            clearHref={buildFinanceCloseoutPageHref(filters)}
            hrefForRepair={(bookingId) => buildFinanceCloseoutSettlementRepairHref(filters, bookingId)}
            previews={selectedSettlementPreviews}
          />
        </>
      ) : (
        <>
          <FinanceCloseoutTaskBoardSection tasks={closeoutTasks} />

          <FinanceCloseoutPaymentEarningSection currency={currency} summary={filteredEarningsSummary} />

          <FinanceCloseoutCashDebtHandoffSection
            cashDebtAmount={reconciliation.cashDebtAmount}
            currency={currency}
            oldestOpenAt={cashSummary?.oldestOpenAt}
            providerCount={cashSummary?.providerCount ?? 0}
            rowCount={cashSummary?.rowCount ?? 0}
          />

          <FinanceCloseoutEvidenceChecklistSection items={evidenceChecklist} />

          <FinanceCloseoutShiftActionMapSection items={shiftCloseActionMap} />

          <FinanceCloseoutPayoutReleaseChecksSection rows={handoffRows} />
        </>
      )}

      {isSettlementWorkspace && repairBookingId ? (
        <FinanceCloseoutSettlementRepairDrawer
          action={repairBookingSettlementGapAction}
          approvers={financeApprovers}
          closeHref={buildFinanceCloseoutPageHref(filters)}
          preview={repairPreview}
          returnFilters={{
            q: filters.settlementQuery,
            range: filters.range,
            settlementAge: filters.settlementAge,
            settlementPage: filters.settlementPage,
            settlementPaymentMethod: filters.settlementPaymentMethod,
            settlementPeriod: filters.settlementPeriod,
            settlementTrack: filters.settlementTrack,
          }}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

async function repairBookingSettlementGapAction(formData: FormData) {
  'use server';

  const bookingId = readFormValue(formData, 'bookingId');
  const confirmationBookingId = readFormValue(formData, 'confirmationBookingId');
  const approvalAdminId = readFormValue(formData, 'approvalAdminId');
  const reason = readFormValue(formData, 'reason');
  const filters = buildFinanceCloseoutFilters({
    q: readFormValue(formData, 'q'),
    range: readFormValue(formData, 'range'),
    settlementAge: readFormValue(formData, 'settlementAge'),
    settlementPage: readFormValue(formData, 'settlementPage'),
    settlementPaymentMethod: readFormValue(formData, 'settlementPaymentMethod'),
    settlementPeriod: readFormValue(formData, 'settlementPeriod'),
    settlementTrack: readFormValue(formData, 'settlementTrack'),
  });
  const closeHref = buildFinanceCloseoutPageHref(filters);
  const previewHref = bookingId ? buildFinanceCloseoutSettlementRepairHref(filters, bookingId) : closeHref;

  if (!bookingId || !approvalAdminId || reason.length < 8) {
    redirect(withRepairNotice(previewHref, 'invalid'));
  }
  if (confirmationBookingId !== bookingId) {
    redirect(withRepairNotice(previewHref, 'confirmation'));
  }

  let result: AdminBookingSettlementGapRepairResult;
  try {
    result = await adminPostOrThrow<AdminBookingSettlementGapRepairResult>(
      `/admin/booking-settlement-gaps/${encodeURIComponent(bookingId)}/repair`,
      { approvalAdminId, reason },
    );
  } catch (error) {
    redirect(withRepairNotice(previewHref, settlementRepairErrorCode(error)));
  }

  redirect(
    withRepairNotice(
      closeHref,
      result.checkpoint.passed ? 'repaired' : 'checkpoint-failed',
      result.bookingId,
    ),
  );
}

function readPageParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function readPageParamList(
  params: Record<string, string | string[] | undefined>,
  key: string,
  maxItems: number,
) {
  const value = params[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, maxItems);
}

function readFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function withRepairNotice(href: string, notice: string, checkpointBookingId?: string) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set('repairNotice', notice);
  if (checkpointBookingId) url.searchParams.set('checkpointBookingId', checkpointBookingId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function settlementRepairErrorCode(error: unknown) {
  if (error instanceof AdminOperatorAccessDeniedError) return 'access-denied';
  if (error instanceof AdminApiRequestError) return `api-${error.status}`;
  if (error instanceof Error && error.message.startsWith('Admin Web session')) return 'admin-session';
  return 'failed';
}

function settlementRepairNoticeMessage(notice: string) {
  if (notice === 'repaired')
    return 'The missing snapshot was created and its journal, clearing, and retained evidence checks passed.';
  if (notice === 'checkpoint-failed')
    return 'The repair write exists, but one or more accounting checks failed. Do not retry; review the checkpoint and finance audit evidence.';
  if (notice === 'confirmation') return 'The confirmation booking ID did not match.';
  if (notice === 'invalid') return 'Approver, reason, and booking confirmation are required.';
  if (notice === 'access-denied' || notice === 'api-403')
    return 'Your operator category cannot perform this repair.';
  if (notice === 'api-400')
    return 'The API blocked this repair because finance evidence or approval is not valid.';
  if (notice === 'admin-session' || notice === 'api-401') return 'Admin authentication expired. Sign in again.';
  return 'The finance write failed. No successful repair was confirmed.';
}
