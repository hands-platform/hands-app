import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminDisclosureCard, AdminNotePanel, AdminNoticeCard } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import {
  type AdminCashSettlementDetail,
  type AdminCashSettlementSummary,
  type AdminEarning,
  adminGetResult,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { readSearchParam } from '../../lib/date-range';
import { CashSettlementFilterSection } from './cash-settlement-filter-section';
import { CashSettlementOpenDebtTableSection } from './cash-settlement-open-debt-table-section';
import {
  buildCashSettlementApiHref,
  buildCashSettlementFilters,
  buildCashSettlementServerPagination,
  buildCashSettlementSummaryApiHref,
  cashSettlementHref,
  cashSettlementQueueLabel,
  cashSettlementReviewHref,
  safeCashSettlementOverviewReturnTo,
} from './cash-settlement-page-filters';
import { buildCashSettlementOpenDebtTableRows, buildCashSettlementRows } from './cash-settlement-page-rows';
import { buildSummary, mergeAuthoritativeSummary } from './cash-settlement-page-summary';
import { CashSettlementReviewDrawer } from './cash-settlement-review-drawer';

type CashSettlementsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Cash Settlement Workbench',
};

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildCashSettlementFilters(params);
  if (readSearchParam(params.view) === 'full') {
    redirect(cashSettlementHref({ ...filters, view: 'guide' }));
  }
  const reviewId = readSearchParam(params.review).trim();
  const periodBaselineFilters = filters.period
    ? { ...filters, age: 'all' as const, page: 1, pageSize: 10, q: '', queue: 'all' as const, sla: 'all' as const, sort: 'oldest' as const }
    : null;
  const needsPeriodBaseline = periodBaselineFilters
    ? buildCashSettlementSummaryApiHref(periodBaselineFilters) !== buildCashSettlementSummaryApiHref(filters)
    : false;
  const [earningsResult, summaryResult, periodBaselineResult, detailResult, operatorAccess] = await Promise.all([
    adminGetResult<AdminEarning[]>(buildCashSettlementApiHref(filters), []),
    adminGetResult<AdminCashSettlementSummary | null>(buildCashSettlementSummaryApiHref(filters), null),
    needsPeriodBaseline && periodBaselineFilters
      ? adminGetResult<AdminCashSettlementSummary | null>(
          buildCashSettlementSummaryApiHref(periodBaselineFilters),
          null,
        )
      : Promise.resolve(null),
    reviewId
      ? adminGetResult<AdminCashSettlementDetail | null>(
          `/admin/cash-settlement-earnings/${encodeURIComponent(reviewId)}`,
          null,
        )
      : Promise.resolve({ data: null, ok: true, status: null }),
    getCurrentAdminOperatorAccess(),
  ]);
  const rows = buildCashSettlementRows(earningsResult.data);
  const visibleSummary = buildSummary(rows);
  const summary = summaryResult.ok
    ? mergeAuthoritativeSummary(visibleSummary, summaryResult.data)
    : visibleSummary;
  const openDebtRows = buildCashSettlementOpenDebtTableRows(rows);
  const totalRows = summaryResult.ok ? summary.rowCount : earningsResult.data.length;
  const openDebtPagination = buildCashSettlementServerPagination(openDebtRows, filters, totalRows);
  const closeHref = cashSettlementHref(filters);
  const reviewHref = reviewId ? cashSettlementReviewHref(closeHref, reviewId) : closeHref;
  const notice = readSearchParam(params.notice);
  const noticeCode = readSearchParam(params.code);
  const globalSummary = summaryResult.data?.global ?? null;
  const periodBaselineSummary = filters.period
    ? needsPeriodBaseline
      ? periodBaselineResult?.ok
        ? periodBaselineResult.data
        : null
      : summaryResult.data
    : null;
  const pageSummary = filters.period && periodBaselineSummary
    ? {
        missingSettlementEvidenceCount: periodBaselineSummary.missingSettlementEvidenceCount,
        providerCount: periodBaselineSummary.providerCount,
        remainingDebtAmount: periodBaselineSummary.totalDebtAmount,
        rowCount: periodBaselineSummary.rowCount,
        staleDebtRowCount: periodBaselineSummary.staleDebtRowCount,
      }
    : globalSummary;
  const periodBaselineUnavailable = Boolean(filters.period && needsPeriodBaseline && !periodBaselineResult?.ok);
  const canAllocate = hasAdminOperatorCategory(operatorAccess, 'FINANCE_SETTLEMENTS');
  const guideHref = cashSettlementHref({ ...filters, page: 1, view: 'guide' });

  return (
    <AdminPageTemplate
      contentClassName="cash-settlement-workbench-content"
      description="Operational workbench for Partner-held cash fee receivables. Review evidence before changing financial state."
      actions={
        <>
          {filters.returnTo ? (
            <AdminTextLink href={safeCashSettlementOverviewReturnTo(filters.returnTo)}>
              Back to Tax &amp; Period Close
            </AdminTextLink>
          ) : null}
          <AdminTextLink href={guideHref}>Operating guide</AdminTextLink>
          <AdminTextLink href={closeHref}>Refresh now</AdminTextLink>
        </>
      }
      metrics={[
        {
          className: 'cash-settlement-kpi-card',
          helper: 'Open company receivable from Partner-collected cash.',
          kind: 'risk',
          label: 'Open exposure',
          scope: filters.period ? `Accounting month ${filters.period}` : 'All dates · All open',
          value: summaryResult.ok && pageSummary ? (
            <MoneyText amount={pageSummary.remainingDebtAmount} currency={summary.currency} />
          ) : (
            'Unavailable'
          ),
        },
        {
          className: 'cash-settlement-kpi-card',
          helper: 'Open debt past the configured settlement follow-up threshold.',
          kind: 'action',
          label: 'Overdue',
          scope: filters.period ? `Accounting month ${filters.period}` : 'All dates · All open',
          value: summaryResult.ok && pageSummary ? pageSummary.staleDebtRowCount : 'Unavailable',
        },
        {
          className: 'cash-settlement-kpi-card',
          helper: 'Open debt without an approved deposit allocation.',
          kind: 'risk',
          label: 'Missing settlement evidence',
          scope: filters.period ? `Accounting month ${filters.period}` : 'All dates · All open',
          value: summaryResult.ok && pageSummary
            ? pageSummary.missingSettlementEvidenceCount
            : 'Unavailable',
        },
        {
          className: 'cash-settlement-kpi-card',
          helper: 'Distinct Partners with an open cash fee receivable.',
          kind: 'action',
          label: 'Partners affected',
          scope: filters.period ? `Accounting month ${filters.period}` : 'All dates · All open',
          value: summaryResult.ok && pageSummary ? pageSummary.providerCount : 'Unavailable',
        },
      ]}
      metricsClassName="cash-settlement-kpi-grid"
      title="Cash Settlement Workbench"
    >
      {!earningsResult.ok || !summaryResult.ok || periodBaselineUnavailable ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Cash settlement data is incomplete</strong>
          <p className="muted">
            {!earningsResult.ok
              ? 'The receivable list could not be loaded. '
              : 'The queue totals could not be loaded. '}
            Reload before using this page for a finance decision.
          </p>
          <AdminTextLink href={closeHref}>Retry</AdminTextLink>
        </AdminNoticeCard>
      ) : null}

      {notice === 'settled' ? (
        <AdminNoticeCard className="admin-mb-16" role="status" tone="success">
          <strong>Approved deposit allocation recorded</strong>
          <p className="muted">
            Earning {readSearchParam(params.resultEarningId)} ·{' '}
            <MoneyText
              amount={Number(readSearchParam(params.resultAmount)) || 0}
              currency="VND"
            />{' '}
            · {cashSettlementResultMethodLabel(readSearchParam(params.resultMethod))} · status{' '}
            {readSearchParam(params.resultStatus) || 'Unknown'}.
            {readSearchParam(params.auditId) ? ` Audit ${readSearchParam(params.auditId)}.` : ''}
          </p>
          {readSearchParam(params.evidenceId) ? (
            <AdminTextLink href={`/finance-tax/partner-bank-deposits/${encodeURIComponent(readSearchParam(params.evidenceId))}`}>
              Open deposit evidence
            </AdminTextLink>
          ) : null}
          {readSearchParam(params.allocationId) ? (
            <p className="muted">Allocation {readSearchParam(params.allocationId)}</p>
          ) : null}
        </AdminNoticeCard>
      ) : notice === 'error' ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <strong>Settlement was not changed</strong>
          <p className="muted">{cashSettlementErrorMessage(noticeCode)}</p>
        </AdminNoticeCard>
      ) : null}

      <CashSettlementFilterSection
        ageCounts={summaryResult.data?.queueAgeCounts}
        allOpenRowCount={pageSummary?.rowCount ?? 0}
        filters={filters}
        generatedAt={summaryResult.data?.generatedAt}
        queueCounts={summaryResult.data?.queueCounts}
        queueSla={summaryResult.data?.queueSla}
        totalRowCount={totalRows}
        visibleRowCount={rows.length}
      />

      {summaryResult.ok && summary.rowCount > 0 ? (
        <AdminNotePanel className="admin-mb-16 cash-settlement-finance-context">
          <strong>
            Filtered queue · {cashSettlementQueueLabel(filters.queue)} · {summary.rowCount} row(s)
          </strong>
          <p className="muted">
            Remaining exposure <MoneyText amount={summary.debtAmount} currency={summary.currency} /> · Original debt{' '}
            <MoneyText amount={summaryResult.data?.totalOriginalDebtAmount ?? summary.debtAmount} currency={summary.currency} /> · Allocated{' '}
            <MoneyText amount={summaryResult.data?.totalAllocatedAmount ?? 0} currency={summary.currency} />
          </p>
          <p className="muted">
            HANDS fee <MoneyText amount={summary.platformFee} currency={summary.currency} /> · Partner tax{' '}
            <MoneyText amount={summary.taxAmount} currency={summary.currency} /> · Company coupon offset{' '}
            <MoneyText amount={summary.companyCouponOffset} currency={summary.currency} /> · Payment records
            needing review {summary.missingPaymentEvidenceCount}
          </p>
        </AdminNotePanel>
      ) : null}

      {filters.view === 'guide' ? (
        <AdminDisclosureCard className="admin-mb-16 cash-settlement-guide" open>
          <summary>Settlement operating guide</summary>
          <div className="admin-mt-12">
            <p>
              Allocate only executed Partner deposits with ledger and journal evidence. Allocation cannot
              exceed either the deposit recovery available or the earning&apos;s remaining exposure.
            </p>
            <p className="muted">
              Free-text references and synthetic identifiers are not settlement evidence. This action does
              not create another wallet ledger or accounting journal entry.
            </p>
            <AdminTextLink href="/finance-tax/partner-bank-deposits">Open Partner bank deposits</AdminTextLink>
          </div>
        </AdminDisclosureCard>
      ) : null}

      {summary.rowCount > 0 ? (
        <CashSettlementOpenDebtTableSection
          allOpenRowCount={pageSummary?.rowCount ?? 0}
          filters={filters}
          pagination={openDebtPagination}
        />
      ) : null}

      {reviewId ? (
        <CashSettlementReviewDrawer
          closeHref={closeHref}
          canAllocate={canAllocate}
          detail={detailResult.data}
          detailLoaded={detailResult.ok}
          returnTo={reviewHref}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function cashSettlementResultMethodLabel(method: string) {
  return method === 'APPROVED_PARTNER_DEPOSIT' ? 'Approved Partner deposit' : 'Approved evidence';
}

function cashSettlementErrorMessage(code: string) {
  switch (code) {
    case 'INVALID_INPUT':
      return 'Enter a positive whole-VND amount and an audit reason of at least 12 characters.';
    case 'EVIDENCE_INVALID':
      return 'The selected deposit is not executed, lacks accounting evidence, or cannot cover this debt.';
    case 'PERMISSION_DENIED':
      return 'Your finance permissions do not allow this allocation.';
    case 'TARGET_NOT_FOUND':
      return 'The deposit or open earning no longer exists.';
    case 'STALE_OR_DUPLICATE':
      return 'The deposit or debt changed while you were reviewing it. Reload the evidence before retrying.';
    default:
      return 'The approved deposit allocation could not be recorded. Reload the evidence before retrying.';
  }
}
