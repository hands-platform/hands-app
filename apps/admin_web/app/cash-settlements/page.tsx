import { ActionMenu } from '../../components/action-menu';
import {
  type AdminCashSettlementSummary,
  type AdminEarning,
  type AdminOperationalPolicySetting,
  adminGet,
} from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { MoneyText } from '../../components/money-text';
import { readSearchParam } from '../../lib/date-range';
import {
  buildAdminLiveOperationsPolicy,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
} from '../../lib/operations-policy';
import { settleCashFeeDebt } from './actions';
import { buildCashSettlementConfirmation } from './cash-settlement-action-confirmation';
import {
  CashSettlementExecutionSection,
  CashSettlementRulesSection,
  CashSettlementWorkflowSections,
} from './cash-settlement-board-sections';
import { CashSettlementFilterSection } from './cash-settlement-filter-section';
import { CashSettlementOpenDebtTableSection } from './cash-settlement-open-debt-table-section';
import {
  buildCommandCards,
  buildCashSettlementExecutionDesk,
  buildDebtCauseCards,
} from './cash-settlement-page-command-cards';
import {
  buildCashSettlementApiHref,
  buildCashSettlementFilters,
  buildCashSettlementServerPagination,
  buildCashSettlementSummaryApiHref,
  cashSettlementHref,
} from './cash-settlement-page-filters';
import {
  buildCashSettlementPriorityBoard,
  buildCashSettlementPriorityBoardRows,
} from './cash-settlement-page-priority';
import {
  buildAppliedCashSettlementPolicyCards,
  buildCashSettlementRuleCards,
} from './cash-settlement-page-rule-cards';
import { buildCashSettlementOpenDebtTableRows, buildCashSettlementRows } from './cash-settlement-page-rows';
import { buildProviderGroups, buildSummary, mergeAuthoritativeSummary } from './cash-settlement-page-summary';
import {
  buildCashSettlementEvidenceChecklist,
  buildCashSettlementHandoffMap,
  buildWalletRecoverySteps,
} from './cash-settlement-page-workflow-cards';
import { CashSettlementProviderGroupsSection } from './cash-settlement-provider-groups-section';

type CashSettlementsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const CASH_SETTLEMENT_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.cashSettlementClearance,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
  OPERATIONAL_POLICY_KEYS.payoutBatchCycle,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
] as const;

const CASH_SETTLEMENT_POLICY_HREF = `/admin/operational-policy?${new URLSearchParams({
  keys: CASH_SETTLEMENT_POLICY_KEYS.join(','),
}).toString()}`;

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildCashSettlementFilters(params);
  const showFullOperationsView = readSearchParam(params.view) === 'full';
  const [earnings, apiSummary, policySettings] = await Promise.all([
    adminGet<AdminEarning[]>(buildCashSettlementApiHref(filters), []),
    adminGet<AdminCashSettlementSummary | null>(buildCashSettlementSummaryApiHref(filters), null),
    showFullOperationsView
      ? adminGet<AdminOperationalPolicySetting[]>(CASH_SETTLEMENT_POLICY_HREF, [])
      : Promise.resolve([] as AdminOperationalPolicySetting[]),
  ]);
  const rows = buildCashSettlementRows(earnings);
  const providers = buildProviderGroups(rows);
  const visibleSummary = buildSummary(rows, providers);
  const summary = mergeAuthoritativeSummary(visibleSummary, apiSummary);
  const openDebtRows = buildCashSettlementOpenDebtTableRows(rows);
  const openDebtPagination = buildCashSettlementServerPagination(openDebtRows, filters, summary.rowCount);
  const liveOperationsPolicy = buildAdminLiveOperationsPolicy(policySettings);
  const priorityBoard = buildCashSettlementPriorityBoard(rows);
  const confirmation =
    readSearchParam(params.confirm) === 'settle'
      ? buildCashSettlementConfirmation(rows, {
          earningId: readSearchParam(params.earningId),
          settlementMethod: readSearchParam(params.settlementMethod),
          settlementNotes: readSearchParam(params.settlementNotes),
          settlementRef: readSearchParam(params.settlementRef),
        })
      : null;

  return (
    <AdminPageTemplate
      description="Finance queue for cash bookings where the Partner collected customer cash and still owes HANDS platform fee or withholding."
      metrics={[
        {
          helper: 'Partners with open cash-fee debt rows.',
          label: 'Partners with cash debt',
          value: summary.providerCount,
        },
        {
          helper: 'Visible settlement rows after filters.',
          label: 'Open debt rows',
          value: summary.rowCount,
        },
        {
          helper: 'Company fee or tax still owed to HANDS.',
          label: 'Total wallet debt',
          value: <MoneyText amount={summary.debtAmount} currency={summary.currency} />,
        },
        {
          helper: 'Company-funded coupon amount already offset from Partner cash settlement.',
          label: 'Company coupon offset',
          value: <MoneyText amount={summary.companyCouponOffset} currency={summary.currency} />,
        },
        {
          helper: 'Platform fee portion of cash debt.',
          label: 'HANDS fee',
          value: <MoneyText amount={summary.platformFee} currency={summary.currency} />,
        },
        {
          helper: 'Tax portion of cash debt.',
          label: 'Tax withholding',
          value: <MoneyText amount={summary.taxAmount} currency={summary.currency} />,
        },
        { helper: 'Oldest visible settlement row.', label: 'Oldest open', value: summary.oldestOpenLabel },
        { helper: 'Rows older than 24 hours.', label: 'Over 24h', value: summary.staleDebtRowCount },
        {
          helper: 'Rows needing payment evidence review.',
          label: 'Payment evidence',
          value: summary.missingPaymentEvidenceCount ? `${summary.missingPaymentEvidenceCount} check` : 'OK',
        },
      ]}
      title="Cash Settlements"
    >
      {confirmation ? (
        <ConfirmDialog
          action={settleCashFeeDebt}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={[
            { name: 'earningId', value: confirmation.earningId },
            { name: 'settlementMethod', value: confirmation.settlementMethod },
            { name: 'settlementRef', value: confirmation.settlementRef },
            { name: 'settlementNotes', value: confirmation.settlementNotes },
          ]}
          id={`cash-settlement-${confirmation.earningId}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <CashSettlementFilterSection
        filters={filters}
        visibleRowCount={rows.length}
        totalRowCount={summary.rowCount}
      />
      {showFullOperationsView ? (
        <>
          <CashSettlementExecutionSection
            executionDesk={buildCashSettlementExecutionDesk(rows, providers, summary)}
            priorityBoardRows={buildCashSettlementPriorityBoardRows(priorityBoard)}
          />
          <CashSettlementRulesSection
            appliedPolicyCards={buildAppliedCashSettlementPolicyCards(liveOperationsPolicy)}
            settlementRuleCards={buildCashSettlementRuleCards(summary)}
          />
          <CashSettlementWorkflowSections
            commandCards={buildCommandCards(rows, providers, summary)}
            debtCauseCards={buildDebtCauseCards(rows, summary)}
            evidenceChecklist={buildCashSettlementEvidenceChecklist(rows, providers, summary)}
            recoverySteps={buildWalletRecoverySteps(rows, providers, summary)}
            settlementHandoff={buildCashSettlementHandoffMap(rows, providers, summary)}
          />
          <CashSettlementProviderGroupsSection providers={providers} />
        </>
      ) : (
        <AdminTablePanel
          description="The default queue keeps payload focused on today's action list. Open the full view only when policy, workflow, and Partner group evidence is needed."
          resultLabel="Compact default"
          resultTone="info"
          title="Cash settlement operations playbook"
        >
          <ActionMenu
            actions={[
              {
                href: cashSettlementHref({
                  pageSize: filters.pageSize,
                  q: filters.q,
                  queue: filters.queue,
                  range: filters.range,
                  view: 'full',
                }),
                kind: 'link',
                label: 'Open full operations view',
                tone: 'info',
              },
            ]}
            label="Cash settlement optional operations actions"
          />
        </AdminTablePanel>
      )}
      <CashSettlementOpenDebtTableSection
        filters={filters}
        pagination={openDebtPagination}
        showOperationsEvidence={showFullOperationsView}
      />
    </AdminPageTemplate>
  );
}
