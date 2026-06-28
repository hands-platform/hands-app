import {
  type AdminCashSettlementSummary,
  type AdminEarning,
  type AdminOperationalPolicySetting,
  adminGet,
} from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { formatMoney } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { buildAdminLiveOperationsPolicy } from '../../lib/operations-policy';
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
import { buildCashSettlementApiHref, buildCashSettlementFilters } from './cash-settlement-page-filters';
import { buildCashSettlementPriorityBoard, buildCashSettlementPriorityBoardRows } from './cash-settlement-page-priority';
import { buildAppliedCashSettlementPolicyCards, buildCashSettlementRuleCards } from './cash-settlement-page-rule-cards';
import {
  applyCashSettlementRowFilters,
  buildCashSettlementOpenDebtTableRows,
  buildCashSettlementRows,
} from './cash-settlement-page-rows';
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

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildCashSettlementFilters(params);
  const [earnings, apiSummary, policySettings] = await Promise.all([
    adminGet<AdminEarning[]>(buildCashSettlementApiHref(filters), []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const filteredEarnings = earnings;
  const allRowsInRange = buildCashSettlementRows(filteredEarnings);
  const rows = applyCashSettlementRowFilters(allRowsInRange, filters);
  const providers = buildProviderGroups(rows);
  const visibleSummary = buildSummary(rows, providers);
  const summary =
    filters.range === 'all' && filters.queue === 'all' && !filters.q
      ? mergeAuthoritativeSummary(visibleSummary, apiSummary)
      : visibleSummary;
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
        { helper: 'Partners with open cash-fee debt rows.', label: 'Partners with cash debt', value: summary.providerCount },
        { helper: 'Visible settlement rows after filters.', label: 'Open debt rows', value: summary.rowCount },
        {
          helper: 'Company fee or tax still owed to HANDS.',
          label: 'Total wallet debt',
          value: formatMoney(summary.debtAmount, summary.currency),
        },
        {
          helper: 'Platform fee portion of cash debt.',
          label: 'HANDS fee',
          value: formatMoney(summary.platformFee, summary.currency),
        },
        {
          helper: 'Tax portion of cash debt.',
          label: 'Tax withholding',
          value: formatMoney(summary.taxAmount, summary.currency),
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
        allRowsInRangeCount={allRowsInRange.length}
        filters={filters}
        visibleRowCount={rows.length}
      />
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
      <CashSettlementOpenDebtTableSection rows={buildCashSettlementOpenDebtTableRows(rows)} />
    </AdminPageTemplate>
  );
}
