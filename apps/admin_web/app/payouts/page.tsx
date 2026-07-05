import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  AdminEarning,
  AdminOperationalPolicySetting,
  AdminPayoutBatch,
  AdminPayoutBatchSummary,
  AdminProviderWalletWithdrawalRequest,
  adminGet,
} from '../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminActionCard, AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeLink, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { formatRelativeTime, shortRecordId } from '../../lib/admin-format';
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
import { PayoutCommandQueueSection, type PayoutCommandSignal } from './payout-command-queue-section';
import { buildPayoutPartnerFinanceQueueRows } from './payout-partner-finance-queue-model';
import { PayoutPartnerFinanceQueueSection } from './payout-partner-finance-queue-section';
import { PayoutWalletWithdrawalRequestSection } from './payout-wallet-withdrawal-request-section';
import {
  PayoutMoneyFlowSection,
  type PayoutMoneyFlowCard,
  type PayoutMoneyFlowCheck,
} from './payout-money-flow-section';
import { PayoutInclusionAuditSection, type PayoutInclusionAuditRow } from './payout-inclusion-audit-section';
import {
  PayoutReleaseBlockerQueueSection,
  type PayoutReleaseBlockerQueueItem,
} from './payout-release-blocker-queue-section';
import {
  PayoutServiceEvidenceSection,
  type PayoutServiceEvidenceItem,
} from './payout-service-evidence-section';
import { PayoutStatusLanesSection, type PayoutStatusLane } from './payout-status-lanes-section';
import {
  buildPayoutFilters,
  buildPayoutOperationsApiHrefs,
  buildPayoutServerPagination,
  payoutHref,
} from './payouts-page-model';

type PayoutsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPayoutFilters(params);
  const apiHrefs = buildPayoutOperationsApiHrefs(filters);
  const [allBatches, payoutSummary, allEarnings, policySettings, walletWithdrawalRequests] = await Promise.all([
    adminGet<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, []),
    adminGet<AdminPayoutBatchSummary | null>(apiHrefs.payoutBatchSummaryHref, null),
    adminGet<AdminEarning[]>(apiHrefs.earningsHref, []),
    adminGet<AdminOperationalPolicySetting[]>(apiHrefs.operationalPolicyHref, []),
    adminGet<AdminProviderWalletWithdrawalRequest[]>(apiHrefs.providerWalletWithdrawalRequestsHref, []),
  ]);
  const batches = sortBatches(allBatches);
  const earnings = allEarnings;
  const summary = buildSummary(batches, payoutSummary);
  const payoutBatchRows = buildPayoutBatchTableRows(batches);
  const payoutBatchPagination = buildPayoutServerPagination(payoutBatchRows, filters, summary.total);
  const commandSignals = buildPayoutCommandSignals(batches);
  const payoutLanes = buildPayoutLanes(batches);
  const payoutStatusLanes = buildPayoutStatusLanes(payoutLanes);
  const serviceEvidence = buildPayoutServiceEvidence(batches);
  const moneyFlowCards = buildPayoutMoneyFlowCards(summary, serviceEvidence);
  const moneyFlowChecks = buildPayoutMoneyFlowChecks(batches, serviceEvidence);
  const liveOperationsPolicy = buildAdminLiveOperationsPolicy(policySettings);
  const appliedPayoutPolicyCards = buildAppliedPayoutPolicyCards(liveOperationsPolicy);
  const releasePolicyDesk = buildPayoutReleasePolicyDesk(batches, earnings, summary);
  const releaseCycleBoard = buildPayoutReleaseCycleBoard(batches, earnings);
  const marketplaceUnblockBridge = buildPayoutMarketplaceUnblockBridge(batches, earnings, summary);
  const releaseQueue = buildPayoutReleaseQueue(batches);
  const releaseBlockerRows = buildPayoutReleaseBlockerRows(releaseQueue);
  const partnerFinanceQueueRows = buildPayoutPartnerFinanceQueueRows(batches);
  const inclusionAudit = buildPayoutInclusionAudit(earnings, batches);
  const confirmationAction = readPayoutConfirmationAction(readSearchParam(params.confirm));
  const confirmationBatchId = readSearchParam(params.payoutBatchId);
  const confirmationBatch = allBatches.find((batch) => batch.id === confirmationBatchId);
  const confirmation = buildPayoutActionConfirmation(
    allBatches,
    confirmationAction,
    confirmationBatchId,
    confirmationBatch ? payoutActionAvailability(confirmationBatch, confirmationAction) : {},
  );

  return (
    <AdminPageTemplate
      description="Partner payout batches for transfer readiness, tax evidence, cash-fee debt holds, and finance release checks."
      metrics={[
        { label: 'Total batches', value: summary.total, helper: 'Payout batches in the selected range.' },
        { label: 'Needs review', value: summary.needsReview, helper: 'Draft or failed payout batches.' },
        { label: 'In progress', value: summary.inProgress, helper: 'Processing transfer batches.' },
        {
          label: 'Payout holds',
          value: summary.payoutHolds,
          helper: 'Batches blocked by Partner account checks.',
        },
        {
          label: 'Missing refs',
          value: summary.missingTransferRefs,
          helper: 'Transfer references required before paid.',
        },
        { label: 'Settled', value: summary.settled, helper: 'Paid payout batches.' },
        {
          label: 'Total net',
          value: <MoneyText amount={summary.totalNetAmount} currency={summary.currency} />,
          helper: 'Partner net in visible batches.',
        },
        {
          label: 'Withheld tax',
          value: <MoneyText amount={summary.withholdingAmount} currency={summary.currency} />,
          helper: 'Tax logs attached to payout batches.',
        },
      ]}
      title="Partner Payouts"
    >
      {confirmation ? (
        <ConfirmDialog
          action={payoutConfirmationAction(confirmation.action)}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          disabled={confirmation.disabled}
          hiddenInputs={[
            { name: 'payoutBatchId', value: confirmation.payoutBatchId },
            { name: 'transferRef', value: confirmation.transferRef },
          ]}
          id={`payout-${confirmation.action}-${confirmation.payoutBatchId}`}
          textInputs={
            confirmation.action === 'paid'
              ? [
                  {
                    label: 'Approving admin id',
                    name: 'approvalAdminId',
                    placeholder: 'Different admin user id',
                    required: true,
                  },
                ]
              : []
          }
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <AdminTablePanel
        className="payout-date-range-card"
        description={`Range: ${dateRangeLabel(filters.range)}. Batch summary, release checks, status lanes, and service evidence use payout batch record dates.`}
        resultLabel={`${summary.total} batch(es)`}
        resultTone={summary.total > 0 ? 'info' : 'warning'}
        title="Payout date range"
      >
        <div className="participant-list admin-mb-12">
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        </div>
        <AdminFilterChipGroup ariaLabel="Payout date range" className="admin-mt-12">
          {[
            { href: '/payouts?range=all', label: 'All dates', range: 'all' },
            { href: '/payouts?range=today', label: 'Today', range: 'today' },
            { href: '/payouts?range=7d', label: 'Last 7 days', range: '7d' },
            { href: '/payouts?range=30d', label: 'Last 30 days', range: '30d' },
          ].map((option) => (
            <StatusBadgeLink
              ariaCurrent={option.range === filters.range ? 'page' : undefined}
              href={option.href}
              key={option.range}
              tone={option.range === filters.range ? 'info' : 'neutral'}
            >
              {option.label}
            </StatusBadgeLink>
          ))}
        </AdminFilterChipGroup>
      </AdminTablePanel>
      <AdminTablePanel
        className="payout-release-policy-card"
        description="Shows the operating gates before partner payout release. Weekly, monthly, and admin-selected batch timing stays configurable from Operations Policy."
        resultLabel={`${releasePolicyDesk.length} gate(s)`}
        resultTone={releasePolicyDesk.some((signal) => signal.pillClass === 'pill-danger') ? 'danger' : 'info'}
        title="Payout batch release policy desk"
      >
        <div className="participant-list admin-mb-12">
          <Link className="text-link" href={operationalPolicyHref(OPERATIONAL_POLICY_KEYS.payoutBatchCycle)}>
            Batch policy
          </Link>
        </div>
        <AdminSectionHeader
          className="admin-mt-14"
          description="Live Admin policy values used by finance before payout release, cash-fee clearance, and final acceptance, service start, and payout release reopening."
          status={<StatusBadge tone="info">Live policy default</StatusBadge>}
          title="Applied operations policy"
        />
        <div className="service-trace-summary admin-mt-12">
          {appliedPayoutPolicyCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid">
          {releasePolicyDesk.map((signal) => (
            <AdminTaskCard
              actionLabel={signal.action}
              className={signal.className}
              detail={signal.detail}
              key={signal.title}
              leading={<StatusBadge tone={statusBadgeToneFromPillClass(signal.pillClass)}>{signal.status}</StatusBadge>}
              title={signal.title}
            />
          ))}
        </div>
        <AdminSectionHeader
          actions={
            <Link className="text-link" href="/cash-settlements">
              Cash settlements
            </Link>
          }
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
                  <StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.status}</StatusBadge>
                  <div className="muted">{item.queue}</div>
                </td>
                <td>{item.operatorCheck}</td>
                <td>{item.nextAction}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <AdminSectionHeader
          actions={
            <Link className="text-link" href="/bookings?view=marketplace">
              Marketplace monitor
            </Link>
          }
          className="admin-mt-16"
          description="Connects Partner cash-fee debt to the gates operators care about: final acceptance, service start, and payout release. Partners can see marketplace requests while the wallet is negative."
          title="Marketplace and payout unblock bridge"
        />
        <div className="ops-task-grid admin-mt-12">
          {marketplaceUnblockBridge.map((item) => (
            <AdminActionCard
              actionLabel={item.action}
              className={item.className}
              detail={item.detail}
              href={item.href}
              key={item.title}
              leading={<StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.status}</StatusBadge>}
              title={item.title}
              variant="ops-task"
            />
          ))}
        </div>
      </AdminTablePanel>

      <PayoutMoneyFlowSection cards={moneyFlowCards} checks={moneyFlowChecks} currency={summary.currency} />

      <PayoutCommandQueueSection signals={commandSignals} />

      <PayoutInclusionAuditSection audit={inclusionAudit} />

      <PayoutReleaseBlockerQueueSection items={releaseBlockerRows} />

      <PayoutPartnerFinanceQueueSection rows={partnerFinanceQueueRows} />

      <PayoutWalletWithdrawalRequestSection
        activeStatus={filters.withdrawalStatus}
        range={filters.range}
        requests={walletWithdrawalRequests}
        updateWithdrawalRequestAction={updateProviderWalletWithdrawalRequest}
      />

      <PayoutServiceEvidenceSection
        batchCount={batches.filter((batch) => (batch.earnings?.length ?? 0) > 0).length}
        currency={summary.currency}
        items={serviceEvidence}
      />

      <PayoutStatusLanesSection batchCount={batches.length} lanes={payoutStatusLanes} />

      <PayoutBatchListSection
        pagination={payoutBatchPagination}
        paginationHrefForPage={(page) =>
          payoutHref({
            page,
            pageSize: filters.pageSize,
            range: filters.range,
            withdrawalStatus: filters.withdrawalStatus,
          })
        }
        rows={payoutBatchPagination.rows}
        updateTransferRefAction={updatePayoutTransferRef}
      />
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

function buildPayoutBatchTableRows(batches: readonly AdminPayoutBatch[]): PayoutBatchTableRow[] {
  return batches.map((batch) => {
    const blockingReasons = payoutBlockingReasons(batch);
    const payoutHold = activePayoutHold(batch);

    return {
      id: batch.id,
      shortId: shortRecordId(batch.id),
      updatedLabel: formatRelativeTime(batch.createdAt, { justNow: 'Updated just now' }),
      partnerLabel: batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown',
      partnerPhone: batch.providerProfile?.user?.phone ?? 'No phone on file',
      partnerChecksHref: `/partners/${batch.providerProfileId}`,
      statusLabel: humanizeStatus(batch.status),
      phase: payoutPhase(batch.status),
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
      currency: batch.currency,
      totalAmount: batch.totalNetAmount,
      withholdingAmount: batchWithholdingAmount(batch),
      taxLogCount: batch.withholdingLogs?.length ?? 0,
      paidAt: batch.paidAt ?? null,
      paidAtRelativeLabel: batch.paidAt
        ? formatRelativeTime(batch.paidAt, { justNow: 'Updated just now' })
        : 'Awaiting settlement',
      actionExecutionItems: payoutActionExecutionMap(batch),
      actionMenuItems: payoutActionMenuItems(batch),
      payoutHold: Boolean(payoutHold),
      paidBlockedByReleaseCheck: !isTerminalPayoutBatch(batch) && blockingReasons.length > 0,
    };
  });
}

function payoutActionMenuItems(batch: AdminPayoutBatch) {
  return [
    ...(batch.status === 'DRAFT'
      ? [
          payoutActionMenuItem(
            batch,
            'processing',
            'Processing',
            'Review before starting transfer processing.',
            'info',
          ),
        ]
      : []),
    ...(!isTerminalPayoutBatch(batch)
      ? [payoutActionMenuItem(batch, 'paid', 'Paid', 'Review before marking this payout paid.', 'warning')]
      : []),
    ...(batch.status === 'PROCESSING'
      ? [
          payoutActionMenuItem(
            batch,
            'failed',
            'Failed',
            'Review before preserving a failed transfer state.',
            'danger',
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
) {
  const disabledReason = payoutActionDisabledReason(batch, action);

  return {
    kind: 'link' as const,
    href: payoutActionConfirmHref(batch.id, action),
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
    payoutHolds: payoutSummary?.payoutHolds ?? batches.filter((batch) => Boolean(activePayoutHold(batch))).length,
    missingTransferRefs:
      payoutSummary?.missingTransferRefs ?? batches.filter((batch) => transferRefRequiredBeforePaid(batch)).length,
    settled: payoutSummary?.settled ?? batches.filter((batch) => batch.status === 'PAID').length,
    totalNetAmount: payoutSummary?.totalNetAmount ?? batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
    withholdingAmount:
      payoutSummary?.withholdingAmount ?? batches.reduce((sum, batch) => sum + batchWithholdingAmount(batch), 0),
    currency: payoutSummary?.currency ?? currency,
  };
}

type PayoutLane = {
  title: string;
  batches: AdminPayoutBatch[];
  pillClass: string;
  emptyText: string;
};

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

type PayoutReleaseQueueItem = {
  batch: AdminPayoutBatch;
  reason: PayoutBlockingReason;
  providerLabel: string;
  severity: 'Block' | 'Check';
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

function buildPayoutMoneyFlowCards(
  summary: ReturnType<typeof buildSummary>,
  serviceEvidence: PayoutServiceEvidenceItem[],
): PayoutMoneyFlowCard[] {
  const grossRepresented = sumPayoutServiceEvidence(serviceEvidence, 'grossAmount');
  const providerNetRepresented = sumPayoutServiceEvidence(serviceEvidence, 'netAmount');
  const platformFeeRepresented = sumPayoutServiceEvidence(serviceEvidence, 'platformFee');
  const taxRepresented = sumPayoutServiceEvidence(serviceEvidence, 'withholdingAmount');
  const cashDebtRepresented = sumPayoutServiceEvidence(serviceEvidence, 'cashDebtAmount');

  return [
    {
      label: 'Gross represented',
      amount: grossRepresented,
      detail: 'Customer charge attached to earnings inside payout batches.',
    },
    {
      label: 'Partner payout',
      amount: summary.totalNetAmount,
      detail: 'Batch net amount planned for partner transfer.',
    },
    {
      label: 'Partner net evidence',
      amount: providerNetRepresented,
      detail: 'Service evidence net amount used to cross-check batch totals.',
    },
    {
      label: 'HANDS fee',
      amount: platformFeeRepresented,
      detail: 'Platform fee represented by earnings inside payout batches.',
    },
    {
      label: 'Tax withheld',
      amount: taxRepresented || summary.withholdingAmount,
      detail: 'Withholding logs and earning tax amount before final settlement.',
    },
    {
      label: 'Cash debt represented',
      amount: cashDebtRepresented,
      detail: 'Negative wallet amount that should not be paid out as partner net.',
    },
  ];
}

function buildPayoutMoneyFlowChecks(
  batches: AdminPayoutBatch[],
  serviceEvidence: PayoutServiceEvidenceItem[],
): PayoutMoneyFlowCheck[] {
  const currency = batches[0]?.currency ?? 'VND';
  const serviceNet = sumPayoutServiceEvidence(serviceEvidence, 'netAmount');
  const batchNet = batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0);
  const netGap = Math.abs(batchNet - serviceNet);
  const missingServiceEvidence =
    batches.filter((batch) => (batch.earnings?.length ?? 0) > 0).length > 0 && !serviceEvidence.length;
  const cashDebtEvidence = sumPayoutServiceEvidence(serviceEvidence, 'cashDebtAmount');
  const activeMissingRef = batches.filter((batch) => transferRefRequiredBeforePaid(batch));
  const paidMissingRef = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);
  const taxOpen = batches.filter((batch) =>
    (batch.withholdingLogs ?? []).some((log) => log.status !== 'PAID'),
  );

  return [
    {
      title: 'Batch net reconciliation',
      status: netGap > 0 ? 'CHECK' : 'MATCHED',
      detail: (
        <>
          Batch net versus service evidence gap: <MoneyText amount={netGap} currency={currency} />.
        </>
      ),
      action:
        netGap > 0
          ? 'Review batch composition before marking bank transfer complete.'
          : 'Batch net aligns with service evidence.',
      className: netGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: netGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Service evidence',
      status: missingServiceEvidence ? 'MISSING' : `${serviceEvidence.length} OPTION(S)`,
      detail: missingServiceEvidence
        ? 'At least one payout batch has earnings but no service evidence was generated.'
        : 'Payout batches are traceable to service duration options where available.',
      action: missingServiceEvidence
        ? 'Check booking service links before approving payout.'
        : 'Service trace is ready for finance review.',
      className: missingServiceEvidence ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: missingServiceEvidence ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Cash debt exclusion',
      status: cashDebtEvidence > 0 ? 'CHECK' : 'CLEAR',
      detail: cashDebtEvidence
        ? (
            <>
              <MoneyText amount={cashDebtEvidence} currency={currency} /> negative wallet amount appears in payout
              evidence.
            </>
          )
        : 'No negative wallet amount is represented in payout evidence.',
      action: cashDebtEvidence
        ? 'Remove or settle cash debt before transfer.'
        : 'Cash payment fee debt is not leaking into payout transfer.',
      className: cashDebtEvidence > 0 ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtEvidence > 0 ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Settlement references',
      status: `${activeMissingRef.length + paidMissingRef.length + taxOpen.length} CHECK`,
      detail: `${activeMissingRef.length} active batch(es) need bank ref before paid, ${paidMissingRef.length} paid missing ref, ${taxOpen.length} batch(es) with open tax logs.`,
      action:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length
          ? 'Complete transfer refs and withholding log status.'
          : 'Transfer references and withholding logs look complete.',
      className:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length
          ? 'ops-task-blocked'
          : 'ops-task-done',
      pillClass:
        activeMissingRef.length || paidMissingRef.length || taxOpen.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function sumPayoutServiceEvidence(
  serviceEvidence: PayoutServiceEvidenceItem[],
  field: keyof Pick<
    PayoutServiceEvidenceItem,
    'grossAmount' | 'netAmount' | 'platformFee' | 'withholdingAmount' | 'cashDebtAmount'
  >,
) {
  return serviceEvidence.reduce((sum, item) => sum + item[field], 0);
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
      detail: cashDebtRows.length
        ? (
            <>
              <MoneyText amount={cashDebtAmount} currency={currency} /> partner cash-fee debt is held outside payout
              release.
            </>
          )
        : 'No unbatched partner cash-fee debt is waiting in the current earning range.',
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
      detail: unbatchedCashDebt.length
        ? (
            <>
              <MoneyText amount={cashDebtAmount} currency={cashDebtCurrency} /> unpaid HANDS fee or withholding blocks
              final acceptance and service start.
            </>
          )
        : 'No negative Partner wallet is blocking final acceptance or service start from the current earning range.',
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
      href: activeBlockedBatches.length ? '#release-blocker-queue' : '/finance-closeout',
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

function buildPayoutInclusionAudit(earnings: AdminEarning[], batches: AdminPayoutBatch[]) {
  const currency = earnings[0]?.currency ?? batches[0]?.currency ?? 'VND';
  const batchedIds = new Set(batches.flatMap((batch) => (batch.earnings ?? []).map((earning) => earning.id)));
  const unbatched = earnings.filter((earning) => !earning.payoutBatchId && !batchedIds.has(earning.id));
  const ready = unbatched.filter((earning) => isEarningBatchReady(earning));
  const cashDebt = unbatched.filter((earning) => earning.netAmount < 0);
  const closeoutReview = unbatched.filter(
    (earning) => !isEarningBatchReady(earning) && earning.netAmount >= 0 && earning.status !== 'CANCELLED',
  );
  const alreadyBatched = earnings.filter((earning) => earning.payoutBatchId || batchedIds.has(earning.id));
  const rows = [
    ...ready.slice(0, 4).map((earning) => payoutInclusionRow(earning, 'Ready')),
    ...cashDebt.slice(0, 3).map((earning) => payoutInclusionRow(earning, 'Hold')),
    ...closeoutReview.slice(0, 3).map((earning) => payoutInclusionRow(earning, 'Hold')),
  ];

  return {
    readyCount: ready.length,
    blockedCount: cashDebt.length + closeoutReview.length,
    cards: [
      {
        label: 'Ready unbatched',
        value: `${ready.length}`,
        helper: (
          <>
            <MoneyText amount={sumEarnings(ready, 'netAmount')} currency={currency} /> can move into the next
            batch.
          </>
        ),
      },
      {
        label: 'Cash debt held',
        value: `${cashDebt.length}`,
        helper: (
          <>
            <MoneyText amount={Math.abs(sumEarnings(cashDebt, 'netAmount'))} currency={currency} /> company-fee debt
            stays out.
          </>
        ),
      },
      {
        label: 'Closeout review',
        value: `${closeoutReview.length}`,
        helper: 'Needs booking, payment, or earning status review before batching.',
      },
      {
        label: 'Already batched',
        value: `${alreadyBatched.length}`,
        helper: (
          <>
            <MoneyText amount={sumEarnings(alreadyBatched, 'netAmount')} currency={currency} /> already attached to
            batches.
          </>
        ),
      },
    ],
    rows,
  };
}

function isEarningBatchReady(earning: AdminEarning) {
  return (
    !earning.payoutBatchId &&
    earning.netAmount > 0 &&
    !['PAID', 'CANCELLED'].includes(earning.status) &&
    earning.booking?.status === 'COMPLETED'
  );
}

function payoutInclusionRow(earning: AdminEarning, status: PayoutInclusionAuditRow['status']) {
  const service = earning.booking?.services?.[0]?.service;
  const serviceLabel = service
    ? `${service.name} / ${service.durationMin} min`
    : `Booking ${shortRecordId(earning.bookingId)}`;
  const providerLabel =
    earning.providerProfile?.displayName ?? earning.providerProfile?.user?.phone ?? 'Unknown partner';
  const holdReason =
    earning.netAmount < 0
      ? 'Cash booking created company-fee debt. Keep it out of partner payout until deposit or admin offset is verified.'
      : earning.booking?.status !== 'COMPLETED'
        ? `Booking status is ${earning.booking?.status ?? 'missing'}, so it is not payout-ready.`
        : `Earning status is ${earning.status}; review closeout before batching.`;

  return {
    id: earning.id,
    status,
    title: (
      <>
        {providerLabel} / <MoneyText amount={earning.netAmount} currency={earning.currency} />
      </>
    ),
    detail: `${serviceLabel} / ${earning.status} / created ${
      earning.createdAt
        ? formatRelativeTime(earning.createdAt, { justNow: 'Updated just now' })
        : 'unknown time'
    }`,
    operatorRule:
      status === 'Ready'
        ? 'Positive completed earning can be included in the next configured payout batch.'
        : holdReason,
    href: `/bookings/${earning.bookingId}`,
  };
}

function sumEarnings(
  earnings: AdminEarning[],
  field: 'grossAmount' | 'platformFee' | 'withholdingAmount' | 'netAmount',
) {
  return earnings.reduce((sum, earning) => sum + Number(earning[field] ?? 0), 0);
}

function buildPayoutReleaseQueue(batches: AdminPayoutBatch[]): PayoutReleaseQueueItem[] {
  return batches
    .map<PayoutReleaseQueueItem | null>((batch) => {
      const reasons = payoutBlockingReasons(batch);
      const primaryReason = reasons[0];
      if (!primaryReason) {
        return null;
      }

      return {
        batch,
        reason: primaryReason,
        providerLabel:
          batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown partner',
        severity: primaryReason.pillClass === 'pill-danger' ? 'Block' : 'Check',
      };
    })
    .filter((item): item is PayoutReleaseQueueItem => Boolean(item))
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === 'Block' ? -1 : 1;
      }
      return Date.parse(right.batch.createdAt) - Date.parse(left.batch.createdAt);
    })
    .slice(0, 6);
}

function buildPayoutReleaseBlockerRows(
  releaseQueue: readonly PayoutReleaseQueueItem[],
): PayoutReleaseBlockerQueueItem[] {
  return releaseQueue.map((item) => ({
    action: item.reason.action,
    amount: item.batch.totalNetAmount,
    blockingReasons: payoutBlockingReasons(item.batch).map((reason) => ({
      label: reason.label,
      pillClass: reason.pillClass,
    })),
    currency: item.batch.currency,
    detail: payoutReleaseBlockerDetail(item.reason, item.batch),
    id: item.batch.id,
    label: item.reason.label,
    providerLabel: item.providerLabel,
    severity: item.severity,
  }));
}

function payoutReleaseBlockerDetail(reason: PayoutBlockingReason, batch: AdminPayoutBatch): ReactNode {
  if (reason.label === 'Tax log missing') {
    return (
      <>
        Withholding exists (<MoneyText amount={batchWithholdingAmount(batch)} currency={batch.currency} />) but no
        tax log is linked.
      </>
    );
  }
  return reason.detail;
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
        earnings.length && (!withholdingAmount || withholdingLogs.length)
          ? `${earnings.length} earning row(s) and ${withholdingLogs.length} tax log(s) are attached.`
          : earnings.length
            ? (
                <>
                  <MoneyText amount={withholdingAmount} currency={batch.currency} /> withholding exists without a
                  linked tax log.
                </>
              )
            : 'This payout batch has no earning rows attached.',
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

function buildPayoutCommandSignals(batches: AdminPayoutBatch[]): PayoutCommandSignal[] {
  const needsReview = batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED');
  const processing = batches.filter((batch) => batch.status === 'PROCESSING');
  const held = batches.filter((batch) => Boolean(activePayoutHold(batch)));
  const activeMissingRef = batches.filter((batch) => transferRefRequiredBeforePaid(batch));
  const missingTransferRef = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);
  const missingEarnings = batches.filter((batch) => !batch.earnings?.length);
  const missingWithholdingLogs = batches.filter(
    (batch) => batchWithholdingAmount(batch) > 0 && !batch.withholdingLogs?.length,
  );
  const pendingWithholding = batches.filter((batch) =>
    (batch.withholdingLogs ?? []).some((log) => log.status !== 'PAID'),
  );
  const reconciliationWarnings =
    missingTransferRef.length +
    activeMissingRef.length +
    missingEarnings.length +
    missingWithholdingLogs.length +
    pendingWithholding.length;
  const currency = batches[0]?.currency ?? 'VND';

  return [
    {
      title: 'Review amount',
      status: `${needsReview.length} BATCH(ES)`,
      detail: (
        <MoneyText
          amount={needsReview.reduce((sum, batch) => sum + batch.totalNetAmount, 0)}
          currency={currency}
        />
      ),
      action: needsReview.length
        ? 'Check failed and draft batches before starting bank transfer.'
        : 'No batch currently needs finance review.',
      className: needsReview.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: needsReview.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Banking in motion',
      status: `${processing.length} PROCESSING`,
      detail: (
        <MoneyText
          amount={processing.reduce((sum, batch) => sum + batch.totalNetAmount, 0)}
          currency={currency}
        />
      ),
      action: processing.length
        ? 'Confirm transfer results, then mark paid or failed.'
        : 'No payout is currently in banking transfer.',
      className: processing.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: processing.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Payout holds',
      status: `${held.length} HELD`,
      detail: held.length
        ? held
            .map((batch) => activePayoutHold(batch)?.reason ?? 'Active hold')
            .slice(0, 2)
            .join(' ')
        : 'No active payout hold on listed batches.',
      action: held.length ? 'Open partner checks before attempting payout.' : 'No payout hold action.',
      className: held.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: held.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Reconciliation',
      status: `${reconciliationWarnings} CHECK`,
      detail: `${activeMissingRef.length} active missing ref, ${missingTransferRef.length} paid missing ref, ${pendingWithholding.length} tax open, ${missingWithholdingLogs.length} tax missing, ${missingEarnings.length} empty batch.`,
      action: reconciliationWarnings
        ? 'Fix active transfer refs, withholding status, or empty batch records.'
        : 'Paid batch references and tax logs look consistent.',
      className: reconciliationWarnings ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliationWarnings ? 'pill-danger' : 'pill-success',
    },
  ];
}

function transferRefRequiredBeforePaid(batch: AdminPayoutBatch) {
  return !isTerminalPayoutBatch(batch) && !batch.transferRef;
}

function isTerminalPayoutBatch(batch: AdminPayoutBatch) {
  return batch.status === 'PAID' || batch.status === 'CANCELLED';
}

function payoutBlockingReasons(batch: AdminPayoutBatch): PayoutBlockingReason[] {
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
      label: 'Tax log missing',
      detail: 'Withholding exists but no tax log is linked.',
      action: 'Create or repair withholding logs before reconciliation.',
      pillClass: 'pill-warn',
    });
  }

  if (withholdingLogs.some((log) => log.status !== 'PAID')) {
    reasons.push({
      label: 'Tax open',
      detail: 'One or more withholding logs are not marked paid.',
      action: 'Complete withholding settlement status.',
      pillClass: 'pill-warn',
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

function buildPayoutLanes(batches: AdminPayoutBatch[]): PayoutLane[] {
  return [
    {
      title: 'Blocked by hold',
      batches: batches.filter((batch) => Boolean(activePayoutHold(batch))),
      pillClass: 'pill-danger',
      emptyText: 'No active payout hold in the current payout list.',
    },
    {
      title: 'Failed recovery',
      batches: batches.filter((batch) => batch.status === 'FAILED'),
      pillClass: 'pill-warn',
      emptyText: 'No failed batch needs recovery.',
    },
    {
      title: 'Draft review',
      batches: batches.filter((batch) => batch.status === 'DRAFT' && !activePayoutHold(batch)),
      pillClass: 'pill-warn',
      emptyText: 'No draft batch is waiting for review.',
    },
    {
      title: 'Processing confirmation',
      batches: batches.filter((batch) => batch.status === 'PROCESSING' && !activePayoutHold(batch)),
      pillClass: 'pill-info',
      emptyText: 'No bank transfer is currently in progress.',
    },
    {
      title: 'Paid reconciliation',
      batches: batches.filter((batch) => batch.status === 'PAID'),
      pillClass: 'pill-success',
      emptyText: 'No paid batch is available for reconciliation yet.',
    },
    {
      title: 'Cancelled archive',
      batches: batches.filter((batch) => batch.status === 'CANCELLED'),
      pillClass: 'pill-neutral',
      emptyText: 'No cancelled payout batch is in the current list.',
    },
  ];
}

function buildPayoutStatusLanes(lanes: readonly PayoutLane[]): PayoutStatusLane[] {
  return lanes.map((lane) => ({
    title: lane.title,
    batches: lane.batches.map((batch) => ({
      id: batch.id,
      amount: batch.totalNetAmount,
      currency: batch.currency,
      earningCount: batch.earnings?.length ?? 0,
      opsHint: opsHint(batch),
      partnerLabel:
        batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown partner',
    })),
    pillClass: lane.pillClass,
    emptyText: lane.emptyText,
  }));
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
  const withholdingLogsPaid =
    withholdingAmount <= 0 ||
    (withholdingLogs.length > 0 && withholdingLogs.every((log) => log.status === 'PAID'));
  const transferRefReady = batch.status !== 'PAID' || Boolean(batch.transferRef);
  const paidDateReady = batch.status !== 'PAID' || Boolean(batch.paidAt);
  const earningsAttached = earnings.length > 0;
  return [
    {
      label: payoutHold ? 'Held' : 'No hold',
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
          ? 'No tax due'
          : withholdingLogs.length
            ? withholdingLogsPaid
              ? 'Tax paid'
              : 'Tax open'
            : 'Tax log missing',
      ok: withholdingLogsPaid,
      detail:
        withholdingAmount <= 0
          ? 'No withholding amount is recorded for this batch.'
          : withholdingLogs.length
            ? `${withholdingLogs.length} withholding log(s) are linked.`
            : 'Withholding amount exists but no withholding log is linked.',
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
