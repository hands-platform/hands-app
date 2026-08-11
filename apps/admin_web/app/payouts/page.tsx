import type { ReactNode } from 'react';

import {
  type AdminUser,
  AdminEarning,
  AdminOperationalPolicySetting,
  AdminPayoutBatch,
  AdminPayoutBatchSummary,
  AdminProviderWalletWithdrawalRequest,
  AdminProviderWalletWithdrawalRequestSummary,
  adminGet,
  adminGetResult,
} from '../../lib/admin-api';
import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { adminPayoutBatchOperatorEvidenceLines } from '../../components/admin-finance-operator-evidence';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminActionCard, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import { formatRelativeTime, shortRecordId } from '../../lib/admin-format';
import { adminWorkflowStatusLabel } from '../../lib/admin-copy';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { dateRangeLabel, readSearchParam } from '../../lib/date-range';
import {
  type AdminLiveOperationsPolicy,
  OPERATIONAL_POLICY_KEYS,
  buildAdminLiveOperationsPolicy,
  formatPolicyDistance,
  humanizePolicyValue,
  operationalPolicyHref,
} from '../../lib/operations-policy';
import {
  markPayoutFailed,
  markPayoutPaid,
  markPayoutProcessing,
  reversePaidPayout,
  reversePaidProviderWalletWithdrawal,
  updatePayoutTransferRef,
  updateProviderWalletWithdrawalRequest,
} from './actions';
import {
  type PayoutConfirmationAction,
  buildPayoutActionConfirmation,
  payoutActionConfirmHref,
  readPayoutConfirmationAction,
} from './payout-action-confirmation';
import { PayoutBatchListSection } from './payout-batch-list-section';
import type { PayoutBatchTableRow } from './payout-batch-table';
import type { PayoutCommandSignal } from './payout-command-queue-section';
import { PayoutWalletWithdrawalRequestSection } from './payout-wallet-withdrawal-request-section';
import {
  PayoutMoneyFlowSection,
  type PayoutMoneyFlowCard,
  type PayoutMoneyFlowCheck,
} from './payout-money-flow-section';
import type { PayoutServiceEvidenceItem } from './payout-service-evidence-section';
import { buildFinanceApproverOptions } from '../finance-tax/finance-approver-options';
import {
  buildPayoutFilters,
  buildPayoutOperationsApiHrefs,
  buildPayoutServerPagination,
  payoutHref,
  payoutWithdrawalClearSavedViewHref,
} from './payouts-page-model';

type PayoutsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPayoutFilters(params);
  const isOperationsWorkspace = filters.workspace === 'operations';
  const isPolicyWorkspace = filters.workspace === 'policy';
  const isAuditWorkspace = filters.workspace === 'audit';
  const isRecordsWorkspace = filters.workspace === 'records';
  const isBankReconciliationScope =
    filters.evidence === 'bank-match-incomplete' && Boolean(filters.period);
  const workspaceLabel =
    filters.view === 'withdrawals'
      ? 'Withdrawals'
      : filters.view === 'reconciliation'
        ? 'Reconciliation'
        : 'Payout batches';
  const currentPayoutViewHref = payoutCurrentViewHref(filters);
  const confirmationAction = readPayoutConfirmationAction(readSearchParam(params.confirm));
  const confirmationBatchId = readSearchParam(params.payoutBatchId);
  const payoutRangeScope = dateRangeLabel(filters.range);
  const apiHrefs = buildPayoutOperationsApiHrefs(filters);
  const confirmationPayoutBatchHref =
    confirmationBatchId && confirmationBatchId !== filters.editPayoutBatchId
      ? `/admin/payout-batches/${encodeURIComponent(confirmationBatchId)}`
      : null;
  const [
    payoutBatchesResult,
    payoutSummaryResult,
    payoutOverviewSummaryResult,
    selectedPayoutBatchResult,
    confirmationPayoutBatchResult,
    allEarnings,
    policySettings,
    walletWithdrawalRequestsResult,
    walletWithdrawalSummaryResult,
    walletWithdrawalGlobalSummaryResult,
  ] = await Promise.all([
    apiHrefs.payoutBatchesHref
      ? adminGetResult<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, [])
      : Promise.resolve({ data: [] as AdminPayoutBatch[], ok: true, status: 204 }),
    adminGetResult<AdminPayoutBatchSummary | null>(apiHrefs.payoutBatchSummaryHref, null),
    adminGetResult<AdminPayoutBatchSummary | null>(apiHrefs.payoutBatchOverviewSummaryHref, null),
    apiHrefs.selectedPayoutBatchHref
      ? adminGetResult<AdminPayoutBatch | null>(apiHrefs.selectedPayoutBatchHref, null)
      : Promise.resolve({ data: null, ok: true, status: 204 }),
    confirmationPayoutBatchHref
      ? adminGetResult<AdminPayoutBatch | null>(confirmationPayoutBatchHref, null)
      : Promise.resolve({ data: null, ok: true, status: 204 }),
    apiHrefs.earningsHref
      ? adminGet<AdminEarning[]>(apiHrefs.earningsHref, [])
      : Promise.resolve([] as AdminEarning[]),
    apiHrefs.operationalPolicyHref
      ? adminGet<AdminOperationalPolicySetting[]>(apiHrefs.operationalPolicyHref, [])
      : Promise.resolve([] as AdminOperationalPolicySetting[]),
    apiHrefs.providerWalletWithdrawalRequestsHref
      ? adminGetResult<AdminProviderWalletWithdrawalRequest[]>(apiHrefs.providerWalletWithdrawalRequestsHref, [])
      : Promise.resolve({ data: [] as AdminProviderWalletWithdrawalRequest[], ok: true, status: 204 }),
    apiHrefs.providerWalletWithdrawalRequestSummaryHref
      ? adminGetResult<AdminProviderWalletWithdrawalRequestSummary | null>(
          apiHrefs.providerWalletWithdrawalRequestSummaryHref,
          null,
        )
      : Promise.resolve({ data: null, ok: true, status: 204 }),
    adminGetResult<AdminProviderWalletWithdrawalRequestSummary | null>(
      apiHrefs.providerWalletWithdrawalRequestGlobalSummaryHref,
      null,
    ),
  ]);
  const allBatches = payoutBatchesResult.data;
  const payoutSummary = payoutSummaryResult.data;
  const payoutOverviewSummary = payoutOverviewSummaryResult.data;
  const walletWithdrawalRequests = walletWithdrawalRequestsResult.data;
  const walletWithdrawalSummary = walletWithdrawalSummaryResult.data;
  const walletWithdrawalGlobalSummary = walletWithdrawalGlobalSummaryResult.data;
  const batches = sortBatches(allBatches);
  const earnings = allEarnings;
  const summary = buildSummary(batches, payoutOverviewSummary);
  const payoutBatchRows = buildPayoutBatchTableRows(batches, filters);
  const payoutBatchTotal = payoutSummary?.total ?? payoutBatchRows.length;
  const payoutBatchPagination = buildPayoutServerPagination(payoutBatchRows, filters, payoutBatchTotal);
  const selectedPayoutBatchRow =
    payoutBatchRows.find((row) => row.id === filters.editPayoutBatchId) ??
    (selectedPayoutBatchResult.data
      ? buildPayoutBatchTableRows([selectedPayoutBatchResult.data], filters)[0]
      : null);
  const withdrawalTotal = walletWithdrawalSummary?.filteredTotal ?? walletWithdrawalRequests.length;
  const withdrawalPagination = isRecordsWorkspace || isAuditWorkspace
    ? buildPayoutServerPagination(
        walletWithdrawalRequests,
        { ...filters, page: filters.withdrawalPage },
        withdrawalTotal,
      )
    : null;
  const moneyFlowCards = filters.recon === 'overview'
    ? buildScopedPayoutMoneyFlowCards(payoutOverviewSummary?.moneyFlow)
    : [];
  const moneyFlowChecks = filters.recon === 'overview'
    ? buildScopedPayoutMoneyFlowChecks(payoutOverviewSummary?.moneyFlow)
    : [];
  const liveOperationsPolicy = buildAdminLiveOperationsPolicy(policySettings);
  const appliedPayoutPolicyCards = isPolicyWorkspace
    ? buildAppliedPayoutPolicyCards(liveOperationsPolicy)
    : [];
  const releasePolicyDesk = isPolicyWorkspace ? buildPayoutReleasePolicyDesk(batches, earnings, summary) : [];
  const releaseCycleBoard = isPolicyWorkspace ? buildPayoutReleaseCycleBoard(batches, earnings) : [];
  const marketplaceUnblockBridge = isPolicyWorkspace
    ? buildPayoutMarketplaceUnblockBridge(batches, earnings, summary)
    : [];
  const confirmationBatch =
    allBatches.find((batch) => batch.id === confirmationBatchId) ??
    [selectedPayoutBatchResult.data, confirmationPayoutBatchResult.data].find(
      (batch) => batch?.id === confirmationBatchId,
    ) ??
    null;
  const confirmationBatches =
    confirmationBatch && !allBatches.some((batch) => batch.id === confirmationBatch.id)
      ? [...allBatches, confirmationBatch]
      : allBatches;
  const confirmation = buildPayoutActionConfirmation(
    confirmationBatches,
    confirmationAction,
    confirmationBatchId,
    confirmationBatch ? payoutActionAvailability(confirmationBatch, confirmationAction) : {},
    currentPayoutViewHref,
  );
  const selectedWithdrawalForReversal =
    walletWithdrawalRequests.find((request) => request.id === filters.reverseWithdrawalRequestId) ?? null;
  const needsFinanceApproverDirectory =
    confirmationAction === 'reverse' || Boolean(selectedWithdrawalForReversal);
  const [currentOperatorAccess, financeApproverUsers] = needsFinanceApproverDirectory
    ? await Promise.all([
        getCurrentAdminOperatorAccess(),
        adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
      ])
    : [null, []];
  const financeApproverOptions = buildFinanceApproverOptions(
    financeApproverUsers,
    currentOperatorAccess?.id ?? null,
  );

  return (
    <AdminPageTemplate
      actions={
        filters.returnTo ? (
          <AdminTextLink href={filters.returnTo}>Back to Finance Overview</AdminTextLink>
        ) : undefined
      }
      description="Partner payout batches for transfer readiness, tax evidence, cash-fee debt holds, and finance release checks."
      metrics={isBankReconciliationScope ? [
        {
          helper: 'Paid payout batches in the selected monthly close whose bank OUTFLOW match is incomplete.',
          kind: 'risk',
          label: 'Bank match candidates',
          scope: filters.period ?? 'Monthly close',
          value: payoutSummaryResult.ok
            ? (payoutSummary?.bankReconciliationCandidateCount ?? 0)
            : 'Unavailable',
        },
        {
          helper: 'Posted company-bank credit still lacking matched bank evidence.',
          kind: 'risk',
          label: 'Remaining bank match',
          scope: filters.period ?? 'Monthly close',
          value: payoutSummaryResult.ok ? (
            <MoneyText
              amount={payoutSummary?.bankReconciliationRemainingAmount ?? 0}
              currency={payoutSummary?.currency ?? 'VND'}
            />
          ) : 'Unavailable',
        },
      ] : [
        {
          helper: 'Draft or failed payout batches.',
          kind: 'risk',
          label: 'Needs review',
          scope: 'Needs action',
          value: payoutOverviewSummaryResult.ok ? summary.needsReview : 'Unavailable',
        },
        {
          helper: 'Processing transfer batches.',
          kind: 'live',
          label: 'Transfers in progress',
          scope: 'Current queue',
          value: payoutOverviewSummaryResult.ok ? summary.inProgress : 'Unavailable',
        },
        {
          helper: 'Paid withdrawals still missing a bank reconciliation match.',
          kind: 'risk',
          label: 'Bank matches pending',
          scope: 'All open evidence',
          value: walletWithdrawalGlobalSummaryResult.ok
            ? (walletWithdrawalGlobalSummary?.paidUnreconciled ?? 0)
            : 'Unavailable',
        },
        {
          helper: 'Paid payout batches missing transfer, withholding, wallet-ledger, or posted GL evidence.',
          kind: 'risk',
          label: 'Wallet / GL closeout repair',
          scope: payoutRangeScope,
          value: payoutOverviewSummaryResult.ok
            ? (payoutOverviewSummary?.postPaymentRepairCount ?? 0)
            : 'Unavailable',
        },
      ]}
      title="Partner Payouts"
    >
      {confirmation ? (
        <>
          {confirmation.action === 'reverse' && financeApproverOptions.length === 0 ? (
            <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
              No other Finance approver is available. Assign the FINANCE_APPROVER role before posting this
              payout reversal.
            </AdminInlineNotice>
          ) : null}
          <ConfirmDialog
            action={payoutConfirmationAction(confirmation.action)}
            cancelHref={confirmation.cancelHref}
            confirmLabel={confirmation.confirmLabel}
            description={confirmation.description}
            disabled={
              confirmation.disabled ||
              (confirmation.action === 'reverse' && financeApproverOptions.length === 0)
            }
            hiddenInputs={[
              { name: 'payoutBatchId', value: confirmation.payoutBatchId },
              { name: 'transferRef', value: confirmation.transferRef },
            ]}
            id={`payout-${confirmation.action}-${confirmation.payoutBatchId}`}
            selectInputs={
              confirmation.action === 'reverse'
                ? [
                    {
                      label: 'Separate Finance approver',
                      name: 'approvalAdminId',
                      options: [{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions],
                      required: true,
                    },
                  ]
                : []
            }
            textInputs={
              confirmation.action === 'reverse'
                ? [
                    {
                      label: 'Reversal reason',
                      minLength: 10,
                      name: 'reason',
                      placeholder: 'Why the bank transfer was returned or rejected',
                      required: true,
                    },
                    {
                      label: 'Bank reversal reference',
                      name: 'reversalReference',
                      placeholder: 'Bank return or rejection reference',
                      required: true,
                    },
                    {
                      label: 'Bank evidence URL',
                      name: 'attachmentUrl',
                      placeholder: 'Private evidence URL',
                      required: true,
                    },
                  ]
                : []
            }
            title={confirmation.title}
            tone={confirmation.tone}
          />
        </>
      ) : null}

      {selectedWithdrawalForReversal ? (
        <ConfirmDialog
          action={reversePaidProviderWalletWithdrawal}
          cancelHref={currentPayoutViewHref}
          confirmLabel="Reverse paid withdrawal"
          description={
            <>
              Reverse withdrawal {shortRecordId(selectedWithdrawalForReversal.id)} for{' '}
              {selectedWithdrawalForReversal.providerProfile?.displayName ??
                selectedWithdrawalForReversal.providerProfile?.user?.phone ??
                'Unknown Partner'}{' '}
              after confirming bank return evidence. Amount:{' '}
              <MoneyText
                amount={selectedWithdrawalForReversal.amount}
                currency={selectedWithdrawalForReversal.currency}
              />
              . Current transfer reference: {selectedWithdrawalForReversal.transferRef || 'Missing'}.
              {' '}Bank:{' '}
              {selectedWithdrawalForReversal.bankAccount
                ? `${selectedWithdrawalForReversal.bankAccount.bankName} ${
                    selectedWithdrawalForReversal.bankAccount.accountNumberMasked ??
                    `ending ${selectedWithdrawalForReversal.bankAccount.accountNumberLast4 ?? 'unknown'}`
                  }`
                : 'not linked'}.
              {' '}Paid at: <DateTimeText fallback="Unknown" value={selectedWithdrawalForReversal.paidAt} />.
              {' '}Paid by:{' '}
              {selectedWithdrawalForReversal.paidBy?.fullName ??
                selectedWithdrawalForReversal.paidBy?.email ??
                selectedWithdrawalForReversal.paidBy?.id ??
                'not recorded'}.
              {' '}Bank match:{' '}
              {selectedWithdrawalForReversal.reconciliationState === 'MATCHED'
                ? 'matched'
                : 'not matched'}.
              {' '}Accounting preview: Dr Bank / Cr Partner wallet liability. Paid journal:{' '}
              {selectedWithdrawalForReversal.preflight?.paidJournalPosted ? 'posted' : 'missing'}.
            </>
          }
          disabled={
            selectedWithdrawalForReversal.preflight?.canReversePaid === false ||
            financeApproverOptions.length === 0
          }
          hiddenInputs={[{ name: 'requestId', value: selectedWithdrawalForReversal.id }]}
          id={`withdrawal-reversal-${selectedWithdrawalForReversal.id}`}
          selectInputs={[
            {
              label: 'Separate Finance approver',
              name: 'approvalAdminId',
              options: [{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions],
              required: true,
            },
          ]}
          textInputs={[
            {
              label: 'Reversal reason',
              minLength: 10,
              name: 'reason',
              placeholder: 'Why the bank transfer was returned or rejected',
              required: true,
            },
            {
              label: 'Bank reversal reference',
              name: 'reversalReference',
              placeholder: 'Bank return or rejection reference',
              required: true,
            },
            {
              label: 'Bank reversal evidence URL',
              name: 'attachmentUrl',
              placeholder: 'Private evidence URL',
              required: true,
            },
          ]}
          title="Reverse paid withdrawal"
          tone="danger"
        />
      ) : null}

      {!payoutOverviewSummaryResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Payout summary could not be loaded. Reload before using this page for release or reconciliation.
        </AdminInlineNotice>
      ) : null}
      {!walletWithdrawalGlobalSummaryResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Withdrawal reconciliation summary could not be loaded. Global bank-match risk is unavailable.
        </AdminInlineNotice>
      ) : null}
      {(isOperationsWorkspace || filters.recon === 'payout-closeout-repair') && !payoutBatchesResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Payout batch rows could not be loaded. Reload before acting on this queue.
        </AdminInlineNotice>
      ) : null}
      {(isRecordsWorkspace || filters.recon === 'bank-unmatched') && !walletWithdrawalRequestsResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Withdrawal rows could not be loaded. Reload before approving or reconciling a withdrawal.
        </AdminInlineNotice>
      ) : null}
      {(isRecordsWorkspace || filters.recon === 'bank-unmatched') && !walletWithdrawalSummaryResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          The selected withdrawal scope could not be summarized. Row counts and pagination are unavailable.
        </AdminInlineNotice>
      ) : null}
      {(walletWithdrawalGlobalSummary?.paidUnreconciled ?? 0) > 0 ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          {walletWithdrawalGlobalSummary?.paidUnreconciled} paid withdrawal(s) remain unmatched across all dates. A
          clear selected queue does not clear this global evidence backlog.
        </AdminInlineNotice>
      ) : null}
      {isBankReconciliationScope ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          Showing the exact {filters.period} paid payout batches used by Finance Overview. Remaining amounts
          reflect active MATCHED or PARTIALLY_MATCHED OUTFLOW evidence only.
        </AdminInlineNotice>
      ) : null}

      <AdminTablePanel
        className="payout-date-range-card"
        description={
          isBankReconciliationScope
            ? `Accounting period: ${filters.period} · Asia/Ho_Chi_Minh. This list is the monthly payout bank-evidence exception scope.`
            : `Selected range: ${dateRangeLabel(filters.range)} · Asia/Ho_Chi_Minh. Each view loads only its own row data; global bank-match risk remains visible.`
        }
        footer={
          <AdminFilterChipGroup ariaLabel="Payout evidence views">
            <AdminTextLink href="/finance-overview">Open Finance Overview</AdminTextLink>
            <AdminTextLink href={operationalPolicyHref(OPERATIONAL_POLICY_KEYS.payoutBatchCycle)}>
              Payout policy
            </AdminTextLink>
          </AdminFilterChipGroup>
        }
        resultLabel={`${workspaceLabel} · generated ${formatRelativeTime(
          payoutOverviewSummary?.generatedAt ?? null,
          { justNow: 'just now' },
        )}`}
        resultTone={payoutOverviewSummaryResult.ok ? 'info' : 'danger'}
        title="Payout workspace"
      >
        <div className="booking-date-filter-bar payout-range-filter-group admin-mt-12">
          <span className="payout-range-filter-group-label">View</span>
          <AdminSegmentedControl
            activeValue={filters.view}
            ariaLabel="Payout views"
            className="payout-workspace-filter-buttons"
            options={[
              {
                href: payoutHref({ range: filters.range, view: 'batches' }),
                label: 'Payout batches',
                value: 'batches',
              },
              {
                href: payoutHref({ range: filters.range, view: 'withdrawals' }),
                label: 'Withdrawals',
                value: 'withdrawals',
              },
              {
                href: payoutHref({ range: filters.range, recon: 'overview', view: 'reconciliation' }),
                label: 'Reconciliation',
                value: 'reconciliation',
              },
            ]}
          />
        </div>
        {filters.view === 'reconciliation' ? (
          <div className="booking-date-filter-bar payout-range-filter-group admin-mt-12">
            <span className="payout-range-filter-group-label">Workspace</span>
            <AdminSegmentedControl
              activeValue={filters.recon ?? 'overview'}
              ariaLabel="Payout reconciliation workspaces"
              className="payout-workspace-filter-buttons"
              options={[
                {
                  href: payoutHref({ range: filters.range, recon: 'overview', view: 'reconciliation' }),
                  label: 'Overview',
                  value: 'overview',
                },
                {
                  href: payoutHref({
                    range: filters.range,
                    recon: 'bank-unmatched',
                    view: 'reconciliation',
                  }),
                  label: `Bank unmatched (${walletWithdrawalGlobalSummary?.paidUnreconciled ?? 0})`,
                  value: 'bank-unmatched',
                },
                {
                  href: payoutHref({
                    range: filters.range,
                    recon: 'payout-closeout-repair',
                    view: 'reconciliation',
                  }),
                  label: `Wallet / GL closeout repair (${payoutOverviewSummary?.postPaymentRepairCount ?? 0})`,
                  value: 'payout-closeout-repair',
                },
              ]}
            />
          </div>
        ) : null}
        {!isBankReconciliationScope ? (
          <div className="booking-date-filter-bar payout-range-filter-group admin-mt-12">
            <span className="payout-range-filter-group-label">Range</span>
          <AdminSegmentedControl
            activeValue={filters.range}
            ariaLabel="Payout date range"
            className="payout-range-filter-buttons"
            options={[
              {
                href: payoutHref({ range: 'all', recon: filters.recon, view: filters.view }),
                label: 'All dates',
                value: 'all',
              },
              {
                href: payoutHref({ range: 'today', recon: filters.recon, view: filters.view }),
                label: 'Today',
                value: 'today',
              },
              {
                href: payoutHref({ range: '7d', recon: filters.recon, view: filters.view }),
                label: 'Last 7 days',
                value: '7d',
              },
              {
                href: payoutHref({ range: '30d', recon: filters.recon, view: filters.view }),
                label: 'Last 30 days',
                value: '30d',
              },
            ]}
            />
          </div>
        ) : null}
        {filters.recon !== 'overview' ? (
        <AdminFormGrid action="/payouts" className="payout-filter-form admin-mt-12" method="get">
          {filters.view !== 'batches' ? <input name="view" type="hidden" value={filters.view} /> : null}
          {filters.recon ? <input name="recon" type="hidden" value={filters.recon} /> : null}
          {filters.range !== 'all' ? <input name="range" type="hidden" value={filters.range} /> : null}
          {filters.evidence ? <input name="evidence" type="hidden" value={filters.evidence} /> : null}
          {filters.period ? <input name="period" type="hidden" value={filters.period} /> : null}
          {filters.returnTo ? <input name="returnTo" type="hidden" value={filters.returnTo} /> : null}
          {filters.status ? <input name="status" type="hidden" value={filters.status} /> : null}
          <AdminFormInput
            defaultValue={filters.q}
            label={
              filters.view === 'withdrawals' || filters.recon === 'bank-unmatched'
                ? 'Search withdrawal ID, Partner, phone, bank last 4, or transfer reference'
                : 'Search batch ID, Partner, phone, or transfer reference'
            }
            name="q"
            placeholder="Search records"
            type="search"
          />
          {filters.view === 'batches' && !isBankReconciliationScope ? (
            <AdminFormSelect
              defaultValue={filters.queue ?? ''}
              label="Queue"
              name="queue"
              options={[
                { label: 'Open work', value: 'open' },
                { label: 'Needs review', value: 'review' },
                { label: 'In transfer', value: 'transfer' },
                { label: 'Paid history', value: 'paid' },
                { label: 'Cancelled archive', value: 'archived' },
              ]}
            />
          ) : null}
          <AdminFormSelect
            defaultValue={filters.sort}
            label="Sort"
            name="sort"
            options={[
              { label: 'Newest first', value: 'newest' },
              { label: 'Oldest first', value: 'oldest' },
              { label: 'Highest amount', value: 'amount-desc' },
              { label: 'Lowest amount', value: 'amount-asc' },
            ]}
          />
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
        </AdminFormGrid>
        ) : null}
      </AdminTablePanel>
      {isPolicyWorkspace ? (
        <AdminTablePanel
          className="payout-release-policy-card"
          description="Shows the operating gates before partner payout release. Weekly, monthly, and admin-selected batch timing stays configurable from Operations Policy."
          resultLabel={`${releasePolicyDesk.length} gate(s)`}
          resultTone={
            releasePolicyDesk.some((signal) => signal.pillClass === 'pill-danger') ? 'danger' : 'info'
          }
          title="Payout batch release policy desk"
        >
          <AdminFilterChipGroup ariaLabel="Payout release policy links" className="admin-mb-12">
            <AdminTextLink href={operationalPolicyHref(OPERATIONAL_POLICY_KEYS.payoutBatchCycle)}>
              Batch policy
            </AdminTextLink>
          </AdminFilterChipGroup>
          <AdminSectionHeader
            className="admin-mt-14"
            description="Live Admin policy values used by finance before payout release, cash-fee clearance, and final acceptance, service start, and payout release reopening."
            status={<StatusBadge tone="info">Live policy default</StatusBadge>}
            title="Applied operations policy"
          />
          <AdminTraceSummary
            className="admin-mt-12"
            defaultKind="live"
            defaultScope="Live policy"
            metrics={appliedPayoutPolicyCards.map((card) => ({
              detail: card.helper,
              label: card.label,
              value: card.value,
            }))}
          />
          <AdminTaskGrid>
            {releasePolicyDesk.map((signal) => (
              <AdminTaskCard
                actionLabel={signal.action}
                className={signal.className}
                detail={signal.detail}
                key={signal.title}
                leading={
                  <StatusBadgeFromPillClass pillClass={signal.pillClass}>
                    {signal.status}
                  </StatusBadgeFromPillClass>
                }
                title={signal.title}
              />
            ))}
          </AdminTaskGrid>
          <AdminSectionHeader
            actions={<AdminTextLink href="/cash-settlements">Cash settlements</AdminTextLink>}
            className="admin-mt-16"
            description="Finance can read this from top to bottom before a bank transfer run. Partner cash-fee debt stays out of payout release until cleared."
            title="Payout release cycle board"
          />
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table payout-release-cycle-table"
              emptyMessage="No payout release cycle steps are configured."
              headers={['Step', 'Queue', 'Operator check', 'Next action']}
              rowCount={releaseCycleBoard.length}
            >
              {releaseCycleBoard.map((item) => (
                <tr key={item.step}>
                  <td>
                    <strong>{item.step}</strong>
                    <div className="muted">{item.timing}</div>
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={item.pillClass}>
                      {item.status}
                    </StatusBadgeFromPillClass>
                    <div className="muted">{item.queue}</div>
                  </td>
                  <td>{item.operatorCheck}</td>
                  <td>{item.nextAction}</td>
                </tr>
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <AdminSectionHeader
            actions={<AdminTextLink href="/bookings?view=marketplace">Marketplace monitor</AdminTextLink>}
            className="admin-mt-16"
            description="Connects Partner cash-fee debt to the gates operators care about: final acceptance, service start, and payout release. Partners can see marketplace requests while the wallet is negative."
            title="Marketplace and payout unblock bridge"
          />
          <AdminTaskGrid className="admin-mt-12">
            {marketplaceUnblockBridge.map((item) => (
              <AdminActionCard
                actionLabel={item.action}
                className={item.className}
                detail={item.detail}
                href={item.href}
                key={item.title}
                leading={
                  <StatusBadgeFromPillClass pillClass={item.pillClass}>
                    {item.status}
                  </StatusBadgeFromPillClass>
                }
                title={item.title}
                variant="ops-task"
              />
            ))}
          </AdminTaskGrid>
        </AdminTablePanel>
      ) : null}

      {filters.recon === 'overview' && payoutOverviewSummaryResult.ok ? (
        <>
          <PayoutMoneyFlowSection
            cards={moneyFlowCards}
            checks={moneyFlowChecks}
            currency={summary.currency}
            rangeLabel={dateRangeLabel(filters.range)}
          />
          <section aria-labelledby="payout-reconciliation-queues-title" className="admin-mb-16">
            <AdminSectionHeader
              description="Choose the evidence boundary that needs work. No payout or withdrawal rows are loaded in this overview."
              title="Reconciliation queues"
              titleId="payout-reconciliation-queues-title"
            />
            <AdminTaskGrid className="admin-mt-12">
              <AdminActionCard
                actionLabel="Review bank matches"
                detail={
                  <>
                    <MoneyText
                      amount={walletWithdrawalGlobalSummary?.paidUnreconciledAmount ?? 0}
                      currency={walletWithdrawalGlobalSummary?.currency ?? summary.currency}
                    />{' '}
                    paid withdrawals still lack a bank match.
                  </>
                }
                href={payoutHref({
                  range: filters.range,
                  recon: 'bank-unmatched',
                  view: 'reconciliation',
                })}
                leading={
                  <StatusBadge tone={walletWithdrawalGlobalSummary?.paidUnreconciled ? 'warning' : 'success'}>
                    {walletWithdrawalGlobalSummary?.paidUnreconciled ?? 0} pending
                  </StatusBadge>
                }
                title="Bank unmatched"
                variant="ops-task"
              />
              <AdminActionCard
                actionLabel="Review closeout evidence"
                detail="Paid payout batches missing transfer, withholding, wallet-ledger, or posted GL evidence. Record origin is not classified without an authoritative rollout cutoff."
                href={payoutHref({
                  range: filters.range,
                  recon: 'payout-closeout-repair',
                  view: 'reconciliation',
                })}
                leading={
                  <StatusBadge tone={payoutOverviewSummary?.postPaymentRepairCount ? 'warning' : 'success'}>
                    {payoutOverviewSummary?.postPaymentRepairCount ?? 0} pending
                  </StatusBadge>
                }
                title="Wallet / GL closeout repair"
                variant="ops-task"
              />
            </AdminTaskGrid>
          </section>
        </>
      ) : null}

      {!payoutOverviewSummaryResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Payout summary could not be loaded. Refresh before using totals or reconciliation counts.
        </AdminInlineNotice>
      ) : null}

      {(isRecordsWorkspace || filters.recon === 'bank-unmatched') && !walletWithdrawalRequestsResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Withdrawal rows could not be loaded. No zero result is being inferred from this failure.
        </AdminInlineNotice>
      ) : null}

      {(isOperationsWorkspace || filters.recon === 'payout-closeout-repair') && !payoutBatchesResult.ok ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Payout batch rows could not be loaded. Refresh before taking a finance action.
        </AdminInlineNotice>
      ) : null}

      {(isRecordsWorkspace || filters.recon === 'bank-unmatched') && walletWithdrawalRequestsResult.ok ? (
        <PayoutWalletWithdrawalRequestSection
          activeReconciliation={filters.withdrawalReconciliation}
          activeStatus={filters.withdrawalStatus}
          pagination={withdrawalPagination}
          paginationHrefForPage={(withdrawalPage) =>
            payoutHref({
              focusWithdrawalRequests: true,
              page: filters.page,
              pageSize: filters.pageSize,
              range: filters.range,
              recon: filters.recon,
              withdrawalPage,
              withdrawalPartnerId: filters.withdrawalPartnerId,
              withdrawalReconciliation: filters.withdrawalReconciliation,
              withdrawalStatus: filters.hasWithdrawalSavedView ? filters.withdrawalStatus : null,
              view: filters.view,
            })
          }
          reconciliationHrefForView={(withdrawalReconciliation) =>
            payoutHref({
              focusWithdrawalRequests: true,
              page: filters.page,
              pageSize: filters.pageSize,
              range: filters.range,
              recon: filters.recon,
              withdrawalPartnerId: filters.withdrawalPartnerId,
              withdrawalReconciliation,
              withdrawalStatus: 'PAID',
              view: filters.view,
            })
          }
          range={filters.range}
          requests={walletWithdrawalRequests}
          reverseHrefForRequest={(requestId) =>
            payoutHref({
              pageSize: filters.pageSize,
              q: filters.q,
              range: filters.range,
              recon: filters.recon,
              reverseWithdrawalRequestId: requestId,
              sort: filters.sort,
              view: filters.view,
              withdrawalPartnerId: filters.withdrawalPartnerId,
              withdrawalReconciliation: filters.withdrawalReconciliation,
              withdrawalStatus: filters.withdrawalStatus,
            })
          }
          savedView={
            filters.hasWithdrawalSavedView
              ? {
                  clearHref: payoutWithdrawalClearSavedViewHref(filters),
                  label: withdrawalSavedViewLabel(filters),
                  resultCount: withdrawalTotal,
                }
              : null
          }
          statusHrefForView={(withdrawalStatus) =>
            payoutHref({
              focusWithdrawalRequests: true,
              page: filters.page,
              pageSize: filters.pageSize,
              range: filters.range,
              recon: filters.recon,
              withdrawalPartnerId: filters.withdrawalPartnerId,
              withdrawalStatus,
              view: filters.view,
            })
          }
          summary={walletWithdrawalSummary}
          updateWithdrawalRequestAction={updateProviderWalletWithdrawalRequest}
        />
      ) : null}

      {(isOperationsWorkspace || filters.recon === 'payout-closeout-repair') && payoutBatchesResult.ok ? (
        <PayoutBatchListSection
          pagination={payoutBatchPagination}
          paginationHrefForPage={(page) =>
            payoutHref({
              evidence: filters.evidence,
              page,
              pageSize: filters.pageSize,
              period: filters.period,
              q: filters.q,
              queue: filters.queue,
              range: filters.range,
              recon: filters.recon,
              returnTo: filters.returnTo,
              sort: filters.sort,
              status: filters.status,
              view: filters.view,
            })
          }
          rows={payoutBatchPagination.rows}
          selectedRowLoaded={Boolean(selectedPayoutBatchRow)}
          selectedRowRequested={Boolean(filters.editPayoutBatchId)}
          selectedRow={selectedPayoutBatchRow}
          selectionClearHref={
            payoutHref({
              evidence: filters.evidence,
              page: filters.page,
              pageSize: filters.pageSize,
              period: filters.period,
              q: filters.q,
              queue: filters.queue,
              range: filters.range,
              recon: filters.recon,
              returnTo: filters.returnTo,
              sort: filters.sort,
              status: filters.status,
              view: filters.view,
            })
          }
          showOperatorEvidence={isAuditWorkspace}
          updateTransferRefAction={updatePayoutTransferRef}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function sortBatches(batches: AdminPayoutBatch[]) {
  return [...batches].sort((left, right) => {
    const priorityDiff = payoutPriority(left.status) - payoutPriority(right.status);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function withdrawalSavedViewLabel(filters: ReturnType<typeof buildPayoutFilters>) {
  if (filters.withdrawalReconciliation === 'unmatched') {
    return 'Withdrawal requests · Bank match pending';
  }
  if (filters.withdrawalReconciliation === 'matched') {
    return 'Withdrawal requests · Reconciled';
  }
  if (filters.withdrawalPartnerId) {
    return `Withdrawal requests · Partner ${shortRecordId(filters.withdrawalPartnerId)}`;
  }
  return `Withdrawal requests · ${adminWorkflowStatusLabel(filters.withdrawalStatus)}`;
}

function payoutCurrentViewHref(filters: ReturnType<typeof buildPayoutFilters>) {
  return payoutHref({
    editPayoutBatchId: filters.editPayoutBatchId,
    evidence: filters.evidence,
    page: filters.page,
    pageSize: filters.pageSize,
    period: filters.period,
    q: filters.q,
    queue: filters.queue,
    range: filters.range,
    recon: filters.recon,
    returnTo: filters.returnTo,
    sort: filters.sort,
    status: filters.status,
    view: filters.view,
    withdrawalPage: filters.withdrawalPage,
    withdrawalPartnerId: filters.withdrawalPartnerId,
    withdrawalReconciliation: filters.withdrawalReconciliation,
    withdrawalStatus: filters.hasWithdrawalSavedView ? filters.withdrawalStatus : null,
  });
}

function buildPayoutBatchTableRows(
  batches: readonly AdminPayoutBatch[],
  filters: ReturnType<typeof buildPayoutFilters>,
): PayoutBatchTableRow[] {
  return batches.map((batch) => {
    const blockingReasons = payoutBlockingReasons(batch);
    const payoutHold = activePayoutHold(batch);
    const bankAccount = selectedPayoutBankAccount(batch);
    const preflightMessages = batch.riskModel
      ? batch.riskModel.phase === 'POST_PAYMENT'
        ? batch.riskModel.reconciliationFindings
        : [
            ...(batch.riskModel.releasePreflight?.blockers ?? []),
            ...(batch.riskModel.releasePreflight?.warnings ?? []),
          ]
      : [...(batch.preflight?.blockers ?? []), ...(batch.preflight?.warnings ?? [])];

    return {
      id: batch.id,
      bankAccountDetail: bankAccount
        ? `${bankAccount.accountHolderName} · ${bankAccount.status}`
        : 'No bank account is attached to this payout target.',
      bankAccountLabel: bankAccount
        ? `${bankAccount.bankName} · ${bankAccount.accountNumberMasked ?? bankAccount.accountNumberLast4 ?? 'Hidden'}`
        : 'Missing',
      bankReconciliationRemainingAmount: batch.bankReconciliation?.remainingAmount,
      shortId: shortRecordId(batch.id),
      updatedLabel: formatRelativeTime(batch.createdAt, { justNow: 'Updated just now' }),
      partnerLabel: batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown',
      partnerPhone: batch.providerProfile?.user?.phone ?? 'No phone on file',
      partnerChecksHref: `/partners/${batch.providerProfileId}`,
      statusLabel: humanizeStatus(batch.status),
      phase: payoutPhase(batch.status),
      operatorEvidence: adminPayoutBatchOperatorEvidenceLines(batch),
      opsSignalClassName: payoutHold ? 'signal signal-warn' : signalClass(batch.status),
      opsSignal: opsSignal(batch),
      opsHint: opsHint(batch),
      blockingReasons: blockingReasons.map((reason) => ({
        detail: reason.detail,
        label: reason.label,
        pillClass: reason.pillClass,
      })),
      blockingActionSummary: blockingReasons.length
        ? blockingReasons.map((reason) => reason.action).join(' ')
        : 'No blocking reason is preventing the next finance action.',
      transferRef: batch.transferRef ?? '',
      notes: batch.notes ?? '',
      earningCount: batch.earnings?.length ?? 0,
      earningsHint: earningsStatusHint(batch),
      serviceEvidencePills: batchServiceEvidence(batch)
        .slice(0, 3)
        .map((item) => ({
          amount: item.netAmount,
          currency: item.currency,
          key: item.key,
          label: item.label,
        })),
      checklist: payoutChecklist(batch).map((item) => ({
        detail: item.detail,
        label: item.label,
        ok: item.ok,
      })),
      readinessSummary: payoutReadinessSummary(batch),
      rawStatus: batch.status,
      reviewHref: payoutHref({
        editPayoutBatchId: batch.id,
        evidence: filters.evidence,
        page: filters.page,
        pageSize: filters.pageSize,
        period: filters.period,
        q: filters.q,
        queue: filters.queue,
        range: filters.range,
        recon: filters.recon,
        returnTo: filters.returnTo,
        sort: filters.sort,
        status: filters.status,
        view: filters.view,
      }),
      riskDetail:
        preflightMessages.map((message) => message.message).join(' ') ||
        (blockingReasons.length
          ? blockingReasons.map((reason) => reason.detail).join(' ')
          : 'No payout release risk is currently reported.'),
      riskLabel: preflightMessages.length
        ? `${preflightMessages.length} ${batch.riskModel?.phase === 'POST_PAYMENT' ? 'repair finding(s)' : 'release check(s)'}`
          : blockingReasons.length
            ? `${blockingReasons.length} check(s)`
            : batch.riskModel?.phase === 'POST_PAYMENT'
              ? 'Evidence complete'
              : 'Clear',
      currency: batch.currency,
      totalAmount: batch.totalNetAmount,
      withholdingAmount: batchWithholdingAmount(batch),
      taxLogCount: batch.withholdingLogs?.length ?? 0,
      paidAt: batch.paidAt ?? null,
      paidAtRelativeLabel: batch.paidAt
        ? formatRelativeTime(batch.paidAt, { justNow: 'Updated just now' })
        : 'Awaiting settlement',
      actionExecutionItems: payoutActionExecutionMap(batch),
      actionMenuItems: payoutActionMenuItems(batch, payoutCurrentViewHref(filters)),
      payoutHold: Boolean(payoutHold),
      paidBlockedByReleaseCheck:
        !isTerminalPayoutBatch(batch) &&
        (batch.preflight ? !batch.preflight.canMarkPaid : blockingReasons.length > 0),
    };
  });
}

function selectedPayoutBankAccount(batch: AdminPayoutBatch) {
  const accounts = batch.providerProfile?.bankAccounts ?? [];
  return (
    accounts.find((account) => account.id === batch.preflight?.approvedBankAccountId) ??
    accounts.find((account) => account.isPrimary && account.status === 'APPROVED' && !account.deletedAt) ??
    accounts.find((account) => account.isPrimary && !account.deletedAt) ??
    accounts.find((account) => !account.deletedAt) ??
    null
  );
}

function payoutActionMenuItems(
  batch: AdminPayoutBatch,
  currentViewHref: string,
) {
  return [
    ...(batch.status === 'DRAFT'
      ? [
          payoutActionMenuItem(
            batch,
            'processing',
            'Start transfer preparation',
            'Review before starting transfer processing.',
            'info',
            currentViewHref,
          ),
        ]
      : []),
    ...(!isTerminalPayoutBatch(batch)
      ? [
          payoutActionMenuItem(
            batch,
            'paid',
            'Approve paid closeout',
            'Review before approving this payout paid closeout.',
            'warning',
            currentViewHref,
          ),
        ]
      : []),
    ...(batch.status === 'PROCESSING'
      ? [
          payoutActionMenuItem(
            batch,
            'failed',
            'Record transfer failure',
            'Review before preserving a failed transfer state.',
            'danger',
            currentViewHref,
          ),
        ]
      : []),
    ...(batch.status === 'PAID'
      ? [
          payoutActionMenuItem(
            batch,
            'reverse',
            'Post reversal',
            'Restore the Partner wallet only after bank return evidence is attached.',
            'danger',
            currentViewHref,
          ),
        ]
      : []),
  ];
}

function payoutActionMenuItem(
  batch: AdminPayoutBatch,
  action: PayoutConfirmationAction,
  label: string,
  fallbackDescription: string,
  tone: 'danger' | 'info' | 'warning',
  currentViewHref: string,
) {
  const disabledReason = payoutActionDisabledReason(batch, action);

  return {
    kind: 'link' as const,
    href: payoutActionConfirmHref(batch.id, action, currentViewHref),
    label,
    disabled: Boolean(disabledReason),
    description: disabledReason ?? fallbackDescription,
    tone,
  };
}

function payoutActionAvailability(batch: AdminPayoutBatch, action: PayoutConfirmationAction | null) {
  if (!action) {
    return { transferRef: batch.transferRef ?? '' };
  }

  const disabledReason = payoutActionDisabledReason(batch, action);
  if (disabledReason) {
    return {
      disabled: true,
      disabledReason,
      transferRef: batch.transferRef ?? '',
    };
  }

  return { transferRef: batch.transferRef ?? '' };
}

function payoutActionDisabledReason(batch: AdminPayoutBatch, action: PayoutConfirmationAction) {
  if (batch.preflight) {
    const actionAvailability =
      action === 'processing'
        ? batch.preflight.actionAvailability?.startProcessing
        : action === 'paid'
          ? batch.preflight.actionAvailability?.markPaid
          : action === 'reverse'
            ? batch.preflight.actionAvailability?.reversePaid
            : batch.preflight.actionAvailability?.markFailed;
    if (actionAvailability) {
      return actionAvailability.allowed
        ? null
        : actionAvailability.blockers.map((blocker) => blocker.message).join(' ') ||
            `Server preflight does not allow the ${action} action for this batch.`;
    }
    const allowed =
      action === 'processing'
        ? batch.preflight.canStartProcessing
        : action === 'paid'
          ? batch.preflight.canMarkPaid
          : action === 'reverse'
            ? batch.preflight.canReversePaid
            : batch.preflight.canMarkFailed;
    if (!allowed) {
      const evidence = batch.preflight.blockers.map((blocker) => blocker.message).join(' ');
      return evidence || `Server preflight does not allow the ${action} action for this batch.`;
    }
    return null;
  }
  const payoutHold = activePayoutHold(batch);
  const blockingReasons = payoutBlockingReasons(batch);

  switch (action) {
    case 'processing':
      if (batch.status !== 'DRAFT') {
        return `Batch status is ${batch.status}; processing action is not available.`;
      }
      return payoutHold ? `Partner payout hold is active: ${payoutHold.reason}.` : null;
    case 'paid':
      if (isTerminalPayoutBatch(batch)) {
        return `Batch status is ${batch.status}; paid action is not available.`;
      }
      return blockingReasons.length
        ? `Resolve ${blockingReasons.map((reason) => reason.label).join(', ')} before marking paid.`
        : null;
    case 'failed':
      return batch.status === 'PROCESSING'
        ? null
        : `Batch status is ${batch.status}; failed action is available only while processing.`;
    case 'reverse':
      return batch.status === 'PAID'
        ? null
        : `Batch status is ${batch.status}; reversal is available only for a paid payout.`;
  }
}

function payoutConfirmationAction(action: PayoutConfirmationAction) {
  switch (action) {
    case 'failed':
      return markPayoutFailed;
    case 'paid':
      return markPayoutPaid;
    case 'processing':
      return markPayoutProcessing;
    case 'reverse':
      return reversePaidPayout;
  }
}

function payoutPriority(status: string) {
  switch (status) {
    case 'FAILED':
      return 0;
    case 'DRAFT':
      return 1;
    case 'PROCESSING':
      return 2;
    case 'PAID':
      return 3;
    case 'CANCELLED':
      return 4;
    default:
      return 5;
  }
}

function buildSummary(batches: AdminPayoutBatch[], payoutSummary?: AdminPayoutBatchSummary | null) {
  const currency = batches[0]?.currency ?? 'VND';
  return {
    total: payoutSummary?.total ?? batches.length,
    needsReview:
      payoutSummary?.needsReview ??
      batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED').length,
    inProgress: payoutSummary?.inProgress ?? batches.filter((batch) => batch.status === 'PROCESSING').length,
    payoutHolds:
      payoutSummary?.payoutHolds ?? batches.filter((batch) => Boolean(activePayoutHold(batch))).length,
    missingTransferRefs:
      payoutSummary?.missingTransferRefs ??
      batches.filter((batch) => transferRefRequiredBeforePaid(batch)).length,
    settled: payoutSummary?.settled ?? batches.filter((batch) => batch.status === 'PAID').length,
    totalNetAmount:
      payoutSummary?.totalNetAmount ?? batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
    withholdingAmount:
      payoutSummary?.withholdingAmount ??
      batches.reduce((sum, batch) => sum + batchWithholdingAmount(batch), 0),
    currency: payoutSummary?.currency ?? currency,
  };
}

type PayoutBlockingReason = {
  label: string;
  detail: string;
  action: string;
  pillClass: string;
};

type PayoutActionExecutionItem = {
  action: string;
  status: string;
  reason: ReactNode;
  operatorRule: string;
  pillClass: string;
};

type PayoutReleaseCycleItem = {
  step: string;
  timing: string;
  status: string;
  queue: string;
  operatorCheck: string;
  nextAction: string;
  pillClass: string;
};

type PayoutMarketplaceUnblockItem = {
  title: string;
  status: string;
  detail: ReactNode;
  action: string;
  href: string;
  className: string;
  pillClass: string;
};

type AppliedPayoutPolicyCard = {
  label: string;
  value: string;
  helper: string;
};

type InternalPayoutServiceEvidenceItem = {
  batchCount: number;
  batchIds: Set<string>;
  cashDebtAmount: number;
  currency: string;
  earningCount: number;
  earningIds: Set<string>;
  grossAmount: number;
  groupKey: string;
  key: string;
  label: string;
  netAmount: number;
  platformFee: number;
  withholdingAmount: number;
};

function buildPayoutServiceEvidence(batches: AdminPayoutBatch[]): PayoutServiceEvidenceItem[] {
  const grouped = new Map<string, InternalPayoutServiceEvidenceItem>();

  batches.forEach((batch) => {
    (batch.earnings ?? []).forEach((earning) => {
      addEarningToServiceEvidence(grouped, batch.id, earning);
    });
  });

  return [...grouped.values()]
    .map(({ batchIds, earningIds, ...item }) => ({
      ...item,
      batchCount: batchIds.size,
      earningCount: earningIds.size,
    }))
    .sort((left, right) => right.netAmount - left.netAmount || left.label.localeCompare(right.label))
    .slice(0, 12);
}

function buildScopedPayoutMoneyFlowCards(
  moneyFlow: AdminPayoutBatchSummary['moneyFlow'],
): PayoutMoneyFlowCard[] {
  if (!moneyFlow) return [];
  return [
    { amount: moneyFlow.grossAmount, detail: 'Gross earning evidence in the full selected range.', label: 'Gross' },
    {
      amount: moneyFlow.payoutNetAmount,
      detail: `Payout batches in selected range: ${moneyFlow.scopeBatchCount}.`,
      label: 'Batch net',
    },
    {
      amount: moneyFlow.evidenceNetAmount,
      detail: `Payout batches with linked earnings: ${moneyFlow.evidenceBatchCount}. This does not validate wallet-ledger or GL posting.`,
      label: 'Linked earnings net',
    },
    { amount: moneyFlow.platformFeeAmount, detail: 'HANDS fee represented by linked earnings.', label: 'Platform fee' },
    { amount: moneyFlow.withholdingAmount, detail: 'Partner withholding represented by linked earnings.', label: 'Withholding' },
    { amount: moneyFlow.cashDebtAmount, detail: 'Negative earning exposure attached to this range.', label: 'Cash debt' },
  ];
}

function buildScopedPayoutMoneyFlowChecks(
  moneyFlow: AdminPayoutBatchSummary['moneyFlow'],
): PayoutMoneyFlowCheck[] {
  if (!moneyFlow) {
    return [
      {
        action: 'Reload before using this evidence.',
        className: 'ops-task-blocked',
        detail: 'The full-range money-flow contract is unavailable.',
        pillClass: 'pill-danger',
        status: 'NOT EVALUATED',
        title: 'Earning linkage scope',
      },
    ];
  }
  const evaluated = moneyFlow.completeness === 'COMPLETE';
  const matched = moneyFlow.verdict === 'MATCHED';
  return [
    {
      action: evaluated ? 'Full selected-range evidence was evaluated.' : 'Load missing earning evidence before deciding.',
      className: evaluated ? 'ops-task-done' : 'ops-task-blocked',
      detail: `${moneyFlow.evidenceBatchCount} of ${moneyFlow.scopeBatchCount} selected payout batches have linked earnings; all-date payout batches: ${moneyFlow.totalBatchCount}. This check does not validate wallet-ledger or GL posting.`,
      pillClass: evaluated ? 'pill-success' : 'pill-warning',
      status: evaluated ? 'COMPLETE' : 'NOT EVALUATED',
      title: 'Earning linkage coverage',
    },
    {
      action: matched
        ? 'Batch net and earning evidence net agree in this range.'
        : evaluated
          ? 'Investigate the full-range net difference.'
          : 'Do not interpret the gap until evidence is complete.',
      className: matched ? 'ops-task-done' : 'ops-task-blocked',
      detail: (
        <>
          Full-range batch net minus evidence net: <MoneyText amount={moneyFlow.netGap} currency="VND" />.
        </>
      ),
      pillClass: matched ? 'pill-success' : evaluated ? 'pill-danger' : 'pill-warning',
      status: moneyFlow.verdict.replace('_', ' '),
      title: 'Net reconciliation',
    },
  ];
}

function buildPayoutReleasePolicyDesk(
  batches: AdminPayoutBatch[],
  earnings: AdminEarning[],
  summary: ReturnType<typeof buildSummary>,
): PayoutCommandSignal[] {
  const activeBatches = batches.filter((batch) => !['PAID', 'CANCELLED'].includes(batch.status));
  const blockedBatches = activeBatches.filter((batch) => payoutBlockingReasons(batch).length > 0);
  const readyBatches = activeBatches.filter((batch) => payoutBlockingReasons(batch).length === 0);
  const cashDebtRows = earnings.filter((earning) => !earning.payoutBatchId && earning.netAmount < 0);
  const cashDebtAmount = Math.abs(sumEarnings(cashDebtRows, 'netAmount'));
  const currency = earnings[0]?.currency ?? summary.currency;
  const paidMissingReference = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);

  return [
    {
      title: 'Batch cycle policy',
      status: 'Config driven',
      detail:
        'Payout release follows weekly, monthly, or admin-selected batch timing from Operations Policy.',
      action: 'Change the cycle in policy first, then run finance batches from this page.',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      title: 'Release gate',
      status: `${readyBatches.length} ready / ${blockedBatches.length} blocked`,
      detail:
        'Paid status requires clean transfer reference, closed tax logs, no payout hold, and no cash-fee debt attached.',
      action: blockedBatches.length
        ? 'Open the release blocker queue before marking a batch paid.'
        : 'Active batches have no release blocker in the current filter.',
      className: blockedBatches.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: blockedBatches.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Cash debt exclusion',
      status: cashDebtRows.length ? `${cashDebtRows.length} held` : 'Clear',
      detail: cashDebtRows.length ? (
        <>
          <MoneyText amount={cashDebtAmount} currency={currency} /> partner cash-fee debt is held outside
          payout release.
        </>
      ) : (
        'No unbatched partner cash-fee debt is waiting in the current earning range.'
      ),
      action: cashDebtRows.length
        ? 'Clear deposit or approved offset in Cash Settlements before payout release.'
        : 'Payout release is not carrying partner cash-fee debt.',
      className: cashDebtRows.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtRows.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Reference repair',
      status: paidMissingReference.length ? `${paidMissingReference.length} repair` : 'Complete',
      detail: paidMissingReference.length
        ? 'At least one paid batch is missing the bank reference needed for finance evidence.'
        : 'Paid payout batches have bank references in the visible range.',
      action: paidMissingReference.length
        ? 'Add historical transfer reference and notes on the payout row.'
        : 'No paid-reference repair is required.',
      className: paidMissingReference.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: paidMissingReference.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Customer wallet isolation',
      status: 'Partner only',
      detail:
        'Cash-fee wallet debt belongs to partner settlement; customer wallet balance is not made negative.',
      action: 'Use customer pages for booking and payment history, not partner cash-fee recovery.',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    },
  ];
}

function buildAppliedPayoutPolicyCards(policy: AdminLiveOperationsPolicy): AppliedPayoutPolicyCard[] {
  return [
    {
      label: 'Payout batch cycle',
      value: humanizePolicyValue(policy.payoutBatchCycle),
      helper: 'Positive partner earnings move through weekly, monthly, or admin-selected batches.',
    },
    {
      label: 'Cash clearance',
      value: humanizePolicyValue(policy.cashSettlementClearance),
      helper: 'Cash-fee debt clears only with deposit evidence or an approved admin offset.',
    },
    {
      label: 'Wallet gate',
      value: humanizePolicyValue(policy.walletNegativeGate),
      helper:
        'Negative Partner wallet blocks final acceptance, service start, and payout release until settled.',
    },
    {
      label: 'Marketplace radius',
      value: formatPolicyDistance(policy.marketplaceRadiusMeters),
      helper: 'Used when reopened partners participate in eligible marketplace requests.',
    },
  ];
}

function buildPayoutReleaseCycleBoard(
  batches: AdminPayoutBatch[],
  earnings: AdminEarning[],
): PayoutReleaseCycleItem[] {
  const draft = batches.filter((batch) => batch.status === 'DRAFT');
  const processing = batches.filter((batch) => batch.status === 'PROCESSING');
  const paid = batches.filter((batch) => batch.status === 'PAID');
  const failed = batches.filter((batch) => batch.status === 'FAILED');
  const cashDebt = earnings.filter((earning) => !earning.payoutBatchId && earning.netAmount < 0);
  const readyUnbatched = earnings.filter(isEarningBatchReady);

  return [
    {
      step: '1. Build next batch',
      timing: 'Weekly / monthly / admin-selected',
      status: `${readyUnbatched.length} earning(s)`,
      queue: 'Positive completed earnings only.',
      operatorCheck: 'Exclude partner cash-fee debt and any booking that is not completed.',
      nextAction: 'Create or rebuild the payout batch after finance closeout.',
      pillClass: readyUnbatched.length ? 'pill-info' : 'pill-neutral',
    },
    {
      step: '2. Draft review',
      timing: 'Before bank transfer',
      status: `${draft.length} draft`,
      queue: 'Draft payout batches awaiting finance checks.',
      operatorCheck: 'Confirm transfer ref plan, service evidence, tax logs, and partner payout facts.',
      nextAction: 'Move clean draft batches to processing.',
      pillClass: draft.length ? 'pill-warn' : 'pill-success',
    },
    {
      step: '3. Banking transfer',
      timing: 'Transfer run',
      status: `${processing.length} processing`,
      queue: 'Batches currently in bank transfer workflow.',
      operatorCheck: 'Wait for bank result; keep evidence attached to the same batch row.',
      nextAction: 'Mark paid with bank ref, or failed when transfer did not complete.',
      pillClass: processing.length ? 'pill-info' : 'pill-neutral',
    },
    {
      step: '4. Paid reconciliation',
      timing: 'After transfer',
      status: `${paid.length} paid / ${failed.length} failed`,
      queue: 'Finished or failed payout batches.',
      operatorCheck: 'Paid rows must keep earning status, tax logs, and bank reference aligned.',
      nextAction: 'Repair missing references or rebuild failed batches.',
      pillClass: failed.length ? 'pill-warn' : 'pill-success',
    },
    {
      step: '5. Cash-fee debt lane',
      timing: 'Before release',
      status: `${cashDebt.length} held`,
      queue: 'Partner cash-fee wallet debt from cash bookings.',
      operatorCheck:
        'Debt must be settled by deposit evidence or approved offset before final acceptance, service start, and payout release resume.',
      nextAction: 'Open Cash Settlements for deposit or offset confirmation.',
      pillClass: cashDebt.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function buildPayoutMarketplaceUnblockBridge(
  batches: AdminPayoutBatch[],
  earnings: AdminEarning[],
  summary: ReturnType<typeof buildSummary>,
): PayoutMarketplaceUnblockItem[] {
  const unbatchedCashDebt = earnings.filter((earning) => !earning.payoutBatchId && earning.netAmount < 0);
  const cashDebtAmount = Math.abs(sumEarnings(unbatchedCashDebt, 'netAmount'));
  const cashDebtPartnerCount = new Set(unbatchedCashDebt.map((earning) => earning.providerProfileId)).size;
  const cashDebtCurrency = unbatchedCashDebt[0]?.currency ?? summary.currency;
  const activePayoutHoldBatches = batches.filter((batch) => Boolean(activePayoutHold(batch)));
  const activeBlockedBatches = batches.filter(
    (batch) => !['PAID', 'CANCELLED'].includes(batch.status) && payoutBlockingReasons(batch).length > 0,
  );
  const batchCashDebtLeak = batches.filter((batch) =>
    (batch.earnings ?? []).some((earning) => earning.netAmount < 0),
  );
  const readyForTransfer = batches.filter(
    (batch) =>
      !['PAID', 'CANCELLED'].includes(batch.status) &&
      payoutBlockingReasons(batch).length === 0 &&
      batch.totalNetAmount > 0,
  );

  return [
    {
      title: 'Final acceptance gate',
      status: unbatchedCashDebt.length ? `${cashDebtPartnerCount} partner wallet(s)` : 'Clear',
      detail: unbatchedCashDebt.length ? (
        <>
          <MoneyText amount={cashDebtAmount} currency={cashDebtCurrency} /> unpaid HANDS fee or withholding
          blocks final acceptance and service start.
        </>
      ) : (
        'No negative Partner wallet is blocking final acceptance or service start from the current earning range.'
      ),
      action: unbatchedCashDebt.length
        ? 'Partner can see marketplace requests, but final acceptance, service start, and payout release are blocked until fee deposit or approved offset is posted.'
        : 'Partner marketplace eligibility follows booking-address radius, KYC, service, and app-presence rules.',
      href: unbatchedCashDebt.length ? '/cash-settlements' : '/bookings?view=marketplace',
      className: unbatchedCashDebt.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: unbatchedCashDebt.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Payout release gate',
      status: `${activeBlockedBatches.length} blocked`,
      detail: activeBlockedBatches.length
        ? 'One or more payout batches still have a hold, missing reference, missing tax evidence, or cash debt leakage.'
        : 'Active payout batches have no release blocker in this date range.',
      action: activeBlockedBatches.length
        ? 'Open the release blocker queue before marking any payout as paid.'
        : `${readyForTransfer.length} active batch(es) can continue through finance review and transfer.`,
      href: activeBlockedBatches.length ? '#release-blocker-queue' : '/payouts',
      className: activeBlockedBatches.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: activeBlockedBatches.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Cash debt must stay out of payout',
      status: batchCashDebtLeak.length ? `${batchCashDebtLeak.length} batch leak` : 'Excluded',
      detail: batchCashDebtLeak.length
        ? 'A payout batch includes negative earning rows. Finance should remove or settle those rows before release.'
        : 'Partner cash-fee debt is kept in Cash Settlements instead of being paid out as partner net.',
      action: batchCashDebtLeak.length
        ? 'Repair the batch so cash debt is settled by deposit evidence or admin offset, not bank payout.'
        : 'Use Cash Settlements for wallet reopening, then Payouts for positive Partner earnings.',
      href: batchCashDebtLeak.length ? '/payouts?review=cash-debt-leak' : '/cash-settlements',
      className: batchCashDebtLeak.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: batchCashDebtLeak.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Partner hold evidence',
      status: `${activePayoutHoldBatches.length} hold`,
      detail: activePayoutHoldBatches.length
        ? 'A partner payout hold is active. This is separate from customer booking history and customer wallet state.'
        : 'No active partner payout hold is attached to visible payout batches.',
      action: activePayoutHoldBatches.length
        ? 'Open partner detail, confirm the operational reason, and lift only after evidence is complete.'
        : 'Keep partner controls factual with activity and finance evidence only.',
      href: activePayoutHoldBatches.length ? '/partners?review=payout-hold' : '/partners',
      className: activePayoutHoldBatches.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: activePayoutHoldBatches.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function isEarningBatchReady(earning: AdminEarning) {
  return (
    !earning.payoutBatchId &&
    earning.netAmount > 0 &&
    !['PAID', 'CANCELLED'].includes(earning.status) &&
    earning.booking?.status === 'COMPLETED'
  );
}

function sumEarnings(
  earnings: AdminEarning[],
  field: 'grossAmount' | 'platformFee' | 'withholdingAmount' | 'netAmount',
) {
  return earnings.reduce((sum, earning) => sum + Number(earning[field] ?? 0), 0);
}

function payoutActionExecutionMap(batch: AdminPayoutBatch): PayoutActionExecutionItem[] {
  const blockingReasons = payoutBlockingReasons(batch);
  const payoutHold = activePayoutHold(batch);
  const earnings = batch.earnings ?? [];
  const withholdingAmount = batchWithholdingAmount(batch);
  const withholdingLogs = batch.withholdingLogs ?? [];
  const canMoveToProcessing = batch.status === 'DRAFT' && !payoutHold;
  const canMarkPaid = !isTerminalPayoutBatch(batch) && blockingReasons.length === 0;
  const canMarkFailed = batch.status === 'PROCESSING';
  const hasTransferReference = Boolean(batch.transferRef);

  return [
    {
      action: 'Save bank reference',
      status: hasTransferReference ? 'Saved' : 'Needed before paid',
      reason: hasTransferReference
        ? `Bank transfer reference ${batch.transferRef} is saved.`
        : 'No bank transfer reference is saved for this payout batch.',
      operatorRule: 'Save the bank reference and notes before marking the payout as paid.',
      pillClass: hasTransferReference ? 'pill-success' : 'pill-warn',
    },
    {
      action: 'Start processing',
      status: canMoveToProcessing ? 'Available' : batch.status === 'DRAFT' ? 'Blocked' : 'Not draft',
      reason: canMoveToProcessing
        ? 'Draft batch has no active payout hold, so finance can start the transfer workflow.'
        : payoutHold
          ? `Partner payout hold is active: ${payoutHold.reason}.`
          : `Batch status is ${batch.status}.`,
      operatorRule: 'Move to processing only after earnings and partner payout facts are reviewed.',
      pillClass: canMoveToProcessing
        ? 'pill-success'
        : batch.status === 'DRAFT'
          ? 'pill-danger'
          : 'pill-neutral',
    },
    {
      action: 'Mark paid',
      status: canMarkPaid ? 'Available' : 'Blocked',
      reason: canMarkPaid
        ? 'No release blocker is currently preventing paid status.'
        : blockingReasons.map((reason) => `${reason.label}: ${reason.detail}`).join(' '),
      operatorRule:
        'Paid status requires clean earnings, tax logs, bank reference, no payout hold, and no cash debt leakage.',
      pillClass: canMarkPaid ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Mark failed',
      status: canMarkFailed ? 'Available' : 'Only processing',
      reason: canMarkFailed
        ? 'Batch is in processing and can be moved to failed if the bank transfer did not complete.'
        : `Batch status is ${batch.status}.`,
      operatorRule: 'Use failed only to preserve the failed transfer state before retry or rebuild.',
      pillClass: canMarkFailed ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Reconcile earnings and tax',
      status:
        earnings.length && (!withholdingAmount || withholdingLogs.length)
          ? 'Trace ready'
          : earnings.length
            ? 'Tax check'
            : 'No earnings',
      reason:
        earnings.length && (!withholdingAmount || withholdingLogs.length) ? (
          `${earnings.length} earning row(s) and ${withholdingLogs.length} tax log(s) are attached.`
        ) : earnings.length ? (
          <>
            <MoneyText amount={withholdingAmount} currency={batch.currency} /> withholding exists without a
            linked tax log.
          </>
        ) : (
          'This payout batch has no earning rows attached.'
        ),
      operatorRule:
        'Finance closeout should reconcile booking, earning, tax, wallet, and payout records together.',
      pillClass:
        earnings.length && (!withholdingAmount || withholdingLogs.length)
          ? 'pill-success'
          : earnings.length
            ? 'pill-warn'
            : 'pill-danger',
    },
  ];
}

function batchServiceEvidence(batch: AdminPayoutBatch | AdminPayoutBatch[]): PayoutServiceEvidenceItem[] {
  return buildPayoutServiceEvidence(Array.isArray(batch) ? batch : [batch]);
}

function addEarningToServiceEvidence(
  grouped: Map<string, InternalPayoutServiceEvidenceItem>,
  batchId: string,
  earning: AdminEarning,
) {
  if (earning.status === 'CANCELLED') {
    return;
  }

  const bookingServices =
    earning.booking?.services && earning.booking.services.length > 0
      ? earning.booking.services
      : [
          {
            id: `earning-${earning.id}`,
            serviceId: 'unknown-service',
            quantity: 1,
            price: earning.grossAmount,
            service: null,
          },
        ];

  const allocationBase =
    bookingServices.reduce(
      (sum, bookingService) =>
        sum + Number(bookingService.price ?? 0) * Math.max(1, Number(bookingService.quantity ?? 1)),
      0,
    ) ||
    earning.grossAmount ||
    1;

  bookingServices.forEach((bookingService) => {
    const quantity = Math.max(1, Number(bookingService.quantity ?? 1));
    const serviceGross = Number(bookingService.price ?? 0) * quantity;
    const allocationShare = allocationBase > 0 ? serviceGross / allocationBase : 1 / bookingServices.length;
    const service = bookingService.service;
    const key = service?.id ?? bookingService.serviceId ?? 'unknown-service';
    const duration = service?.durationMin ? `${service.durationMin} min` : 'duration not linked';
    const label = service?.name ? `${service.name} / ${duration}` : 'Unlinked service option';
    const item = grouped.get(key) ?? {
      key,
      label,
      groupKey: service?.serviceGroupKey ?? bookingService.serviceId ?? 'unknown',
      currency: earning.currency,
      batchCount: 0,
      earningCount: 0,
      grossAmount: 0,
      netAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      cashDebtAmount: 0,
      batchIds: new Set<string>(),
      earningIds: new Set<string>(),
    };

    item.batchIds.add(batchId);
    item.earningIds.add(earning.id);
    item.grossAmount += Math.round(earning.grossAmount * allocationShare);
    item.netAmount += Math.round(earning.netAmount * allocationShare);
    item.platformFee += Math.round(earning.platformFee * allocationShare);
    item.withholdingAmount += Math.round((earning.withholdingAmount ?? 0) * allocationShare);
    if (earning.netAmount < 0) {
      item.cashDebtAmount += Math.round(Math.abs(earning.netAmount) * allocationShare);
    }

    grouped.set(key, item);
  });
}

function transferRefRequiredBeforePaid(batch: AdminPayoutBatch) {
  return !isTerminalPayoutBatch(batch) && !batch.transferRef;
}

function isTerminalPayoutBatch(batch: AdminPayoutBatch) {
  return batch.status === 'PAID' || batch.status === 'CANCELLED';
}

function payoutBlockingReasons(batch: AdminPayoutBatch): PayoutBlockingReason[] {
  if (batch.riskModel) {
    const messages =
      batch.riskModel.phase === 'POST_PAYMENT'
        ? batch.riskModel.reconciliationFindings
        : [
            ...(batch.riskModel.releasePreflight?.blockers ?? []),
            ...(batch.riskModel.releasePreflight?.warnings ?? []),
          ];
    return messages.map((message) => ({
      label: payoutPreflightLabel(message.code),
      detail: message.message,
      action: message.message,
      pillClass:
        batch.riskModel?.releasePreflight?.warnings.some((warning) => warning.code === message.code)
          ? 'pill-warn'
          : 'pill-danger',
    }));
  }
  if (batch.preflight) {
    return [
      ...batch.preflight.blockers.map((blocker) => ({
        label: payoutPreflightLabel(blocker.code),
        detail: blocker.message,
        action: blocker.message,
        pillClass: 'pill-danger',
      })),
      ...batch.preflight.warnings.map((warning) => ({
        label: payoutPreflightLabel(warning.code),
        detail: warning.message,
        action: warning.message,
        pillClass: 'pill-warn',
      })),
    ];
  }
  const reasons: PayoutBlockingReason[] = [];
  const payoutHold = activePayoutHold(batch);
  const withholdingAmount = batchWithholdingAmount(batch);
  const withholdingLogs = batch.withholdingLogs ?? [];
  const earnings = batch.earnings ?? [];
  const cashFeeDebtEarnings = earnings.filter((earning) => earning.netAmount < 0);

  if (payoutHold) {
    reasons.push({
      label: 'Payout hold',
      detail: payoutHold.reason,
      action: 'Lift the partner payout hold before changing this payout.',
      pillClass: 'pill-danger',
    });
  }

  if (cashFeeDebtEarnings.length) {
    reasons.push({
      label: 'Cash fee debt',
      detail: `${cashFeeDebtEarnings.length} partner cash-fee debt earning row(s) are attached to this payout batch.`,
      action: 'Settle cash-fee debt or remove negative earning rows before payout release.',
      pillClass: 'pill-danger',
    });
  }

  if (transferRefRequiredBeforePaid(batch)) {
    reasons.push({
      label: 'Bank ref required',
      detail: 'A transfer reference must be saved before this batch can be marked paid.',
      action: 'Save the bank transfer reference first.',
      pillClass: 'pill-warn',
    });
  }

  if (batch.status === 'PAID' && !batch.transferRef) {
    reasons.push({
      label: 'Paid missing ref',
      detail: 'This paid batch is missing its banking reference for reconciliation.',
      action: 'Add the historical bank reference.',
      pillClass: 'pill-danger',
    });
  }

  if (!earnings.length) {
    reasons.push({
      label: 'No earnings',
      detail: 'The payout batch has no linked earning records.',
      action: 'Attach payable earnings or cancel the batch.',
      pillClass: 'pill-warn',
    });
  }

  if (withholdingAmount > 0 && !withholdingLogs.length) {
    reasons.push({
      label: 'Withholding record missing',
      detail: 'Withholding exists but no payout deduction record is linked.',
      action: 'Create or repair the payout withholding record before release.',
      pillClass: 'pill-warn',
    });
  }

  if (batch.status === 'PAID' && withholdingLogs.some((log) => log.status !== 'PAID')) {
    reasons.push({
      label: 'Withholding evidence mismatch',
      detail: 'This paid payout still has an incomplete partner withholding deduction record.',
      action: 'Repair the payout deduction evidence before reconciliation.',
      pillClass: 'pill-danger',
    });
  }

  if (batch.status === 'PAID' && earnings.some((earning) => earning.status !== 'PAID')) {
    reasons.push({
      label: 'Earning mismatch',
      detail: 'The batch is paid but at least one attached earning is not paid.',
      action: 'Repair earning status so partner ledger matches payout.',
      pillClass: 'pill-danger',
    });
  }

  return reasons;
}

function payoutPreflightLabel(code: string) {
  if (code === 'WITHHOLDING_LOG_MISSING') {
    return 'Withholding record missing';
  }
  if (code === 'WITHHOLDING_DEDUCTION_EVIDENCE_INCOMPLETE') {
    return 'Withholding evidence mismatch';
  }
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function batchWithholdingAmount(batch: AdminPayoutBatch) {
  if (batch.withholdingLogs?.length) {
    return batch.withholdingLogs.reduce((sum, log) => sum + log.amount, 0);
  }
  return (batch.earnings ?? []).reduce((sum, earning) => sum + (earning.withholdingAmount ?? 0), 0);
}

function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function payoutPhase(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Waiting for finance review';
    case 'PROCESSING':
      return 'Transfer is in motion';
    case 'PAID':
      return 'Settlement finished';
    case 'FAILED':
      return 'Needs payout recovery';
    case 'CANCELLED':
      return 'Batch was stopped';
    default:
      return 'Monitor this payout batch';
  }
}

function signalClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'signal signal-ok';
    case 'PROCESSING':
      return 'signal signal-info';
    case 'DRAFT':
    case 'FAILED':
      return 'signal signal-warn';
    default:
      return 'signal';
  }
}

function opsSignal(batch: AdminPayoutBatch) {
  if (activePayoutHold(batch)) {
    return 'Payout hold';
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Needs review';
    case 'PROCESSING':
      return 'Transfer in progress';
    case 'PAID':
      return batch.transferRef ? 'Settled' : 'Settled, missing ref';
    case 'FAILED':
      return 'Retry payout';
    case 'CANCELLED':
      return 'Stopped';
    default:
      return 'Monitor';
  }
}

function opsHint(batch: AdminPayoutBatch) {
  const payoutHold = activePayoutHold(batch);
  if (payoutHold) {
    return `Finance actions are locked until this active sanction is lifted: ${payoutHold.reason}`;
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Check included earnings, confirm the partner, and release only if totals look right.';
    case 'PROCESSING':
      return 'Check banking confirmation before marking the batch complete.';
    case 'PAID':
      return batch.transferRef
        ? 'Payment already landed. Keep this for reconciliation and support follow-up.'
        : 'Payment is marked paid but still needs a banking transfer reference.';
    case 'FAILED':
      return 'Review transfer notes and retry path before earnings age further.';
    case 'CANCELLED':
      return 'Make sure related earnings are reassigned or rebatched if still payable.';
    default:
      return 'Use this row to understand payout readiness and reconcile partner earnings.';
  }
}

function earningsStatusHint(batch: AdminPayoutBatch) {
  if (!batch.earnings?.length) {
    return 'No earnings attached';
  }
  const payoutLinked = batch.earnings.filter((earning) => earning.payoutBatchId === batch.id).length;
  return `${payoutLinked}/${batch.earnings.length} linked to this batch`;
}

function payoutChecklist(batch: AdminPayoutBatch) {
  const earnings = batch.earnings ?? [];
  const allEarningsPaid = earnings.length > 0 && earnings.every((earning) => earning.status === 'PAID');
  const payoutHold = activePayoutHold(batch);
  const withholdingAmount = batchWithholdingAmount(batch);
  const withholdingLogs = batch.withholdingLogs ?? [];
  const withholdingEvidenceReady =
    withholdingAmount <= 0 ||
    (withholdingLogs.length > 0 &&
      (batch.status !== 'PAID' || withholdingLogs.every((log) => log.status === 'PAID')));
  const transferRefReady = batch.status !== 'PAID' || Boolean(batch.transferRef);
  const paidDateReady = batch.status !== 'PAID' || Boolean(batch.paidAt);
  const earningsAttached = earnings.length > 0;
  return [
    {
      label: payoutHold ? 'On hold' : 'No hold',
      ok: !payoutHold,
      detail: payoutHold
        ? `Partner has an active payout hold: ${payoutHold.reason}`
        : 'No active payout hold is attached to this partner.',
    },
    {
      label: earningsAttached ? 'Earnings linked' : 'No earnings',
      ok: earningsAttached,
      detail: earningsAttached
        ? `${earnings.length} earning record(s) are attached to this batch.`
        : 'This payout batch has no earning records attached.',
    },
    {
      label:
        withholdingAmount <= 0
          ? 'No withholding'
          : withholdingLogs.length
            ? batch.status === 'PAID'
              ? withholdingEvidenceReady
                ? 'Deduction recorded'
                : 'Deduction mismatch'
              : 'Deduction ready'
            : 'Deduction record missing',
      ok: withholdingEvidenceReady,
      detail:
        withholdingAmount <= 0
          ? 'No withholding amount is recorded for this batch.'
          : withholdingLogs.length
            ? batch.status === 'PAID'
              ? `${withholdingLogs.length} payout withholding deduction record(s) are linked. Government remittance is tracked in Monthly Tax Closing.`
              : `${withholdingLogs.length} payout withholding deduction record(s) are ready to close with the partner payout.`
            : 'Withholding amount exists but no payout deduction record is linked.',
    },
    {
      label: batch.transferRef ? 'Bank ref' : batch.status === 'PAID' ? 'No ref' : 'Ref later',
      ok: transferRefReady,
      detail: batch.transferRef
        ? `Bank transfer reference: ${batch.transferRef}`
        : batch.status === 'PAID'
          ? 'Paid batches must keep a bank transfer reference for reconciliation.'
          : 'Bank transfer reference can be added when finance starts or completes the payout.',
    },
    {
      label: allEarningsPaid
        ? 'Earnings paid'
        : batch.status === 'PAID'
          ? 'Earnings open'
          : 'Earnings pending',
      ok: batch.status === 'PAID' ? allEarningsPaid : earningsAttached,
      detail: allEarningsPaid
        ? 'Every attached earning is marked PAID.'
        : batch.status === 'PAID'
          ? 'The payout is PAID, but one or more attached earnings are not marked PAID.'
          : 'Attached earnings will be marked paid when payout settlement is complete.',
    },
    {
      label: batch.paidAt ? 'Paid date' : batch.status === 'PAID' ? 'No paid date' : 'Date later',
      ok: paidDateReady,
      detail: batch.paidAt
        ? 'Paid timestamp is present.'
        : batch.status === 'PAID'
          ? 'Paid batches need a paid timestamp.'
          : 'Paid timestamp is expected only after settlement.',
    },
  ];
}

function payoutReadinessSummary(batch: AdminPayoutBatch) {
  const failedItems = payoutChecklist(batch).filter((item) => !item.ok);
  if (!failedItems.length) {
    return 'Ready for the current payout phase.';
  }
  return `Check ${failedItems.map((item) => item.label.toLowerCase()).join(', ')} before advancing.`;
}

function activePayoutHold(batch: AdminPayoutBatch) {
  return batch.providerProfile?.sanctions?.find(
    (sanction) => sanction.type === 'PAYOUT_HOLD' && sanction.status === 'ACTIVE',
  );
}
