import { AlertTriangle, Landmark, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react';

import type {
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
} from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildMonthlyTaxClosingSummaryApiHref,
  buildMonthlyTaxCloseoutCommandState,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxExportHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  partnerWithholdingTaxHref,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PartnerWithholdingTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartnerWithholdingTaxPage({ searchParams }: PartnerWithholdingTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readPartnerWithholdingTaxFilters(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const [summaryResult, rowsResult, monthlyClosingResult] = await Promise.all([
    adminGetResult<AdminPartnerWithholdingTaxSummary>(
      buildPartnerWithholdingTaxSummaryApiHref(filters),
      emptyPartnerWithholdingTaxSummary(filters.period),
    ),
    adminGetResult<AdminPartnerWithholdingTaxRow[]>(buildPartnerWithholdingTaxApiHref(filters), []),
    adminGetResult<AdminMonthlyTaxClosingSummary>(
      buildMonthlyTaxClosingSummaryApiHref(monthlyFilters),
      emptyMonthlyTaxClosingSummary(monthlyFilters.period),
    ),
  ]);
  if (!summaryResult.ok) {
    return <PartnerWithholdingUnavailable period={filters.period} status={summaryResult.status} />;
  }
  const summary = summaryResult.data;
  const rows = rowsResult.data;
  const monthlyClosingSummary = monthlyClosingResult.data;
  const pagination = buildTaxSettlementServerPagination(rows, filters, summary.partnerCountWithRevenue);
  const tableRows = pagination.rows;
  const csvHref = buildPartnerWithholdingTaxExportHref(filters);
  const periodScope = `Period ${filters.period}`;
  const closeoutState = monthlyClosingResult.ok
    ? buildMonthlyTaxCloseoutCommandState(monthlyClosingSummary)
    : {
        detail: 'Monthly closeout status could not be loaded. Withholding register data remains available.',
        scope: 'API unavailable',
        tone: 'danger' as const,
        value: 'Data unavailable',
      };
  const closeoutEligible =
    monthlyClosingResult.ok &&
    monthlyClosingSummary.periodState !== 'FUTURE_PERIOD' &&
    (monthlyClosingSummary.hasActivity ?? true);
  const showWithholdingData = !monthlyClosingResult.ok || closeoutEligible;
  const evidenceBreakdown = summary.evidenceBreakdown ?? [];
  const mixedEvidencePartnerCount =
    evidenceBreakdown.find((item) => item.status === 'MIXED')?.partnerCount ?? 0;
  const missingEvidencePartnerCount =
    evidenceBreakdown.find((item) => item.status === 'MISSING_EVIDENCE')?.partnerCount ?? 0;
  const withholdingEvidenceReviewCount = mixedEvidencePartnerCount + missingEvidencePartnerCount;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'partner-withholding-tax',
            monthlyFilters,
            settlementFilters,
            withholdingFilters: filters,
          })}
        >
          {closeoutEligible && rowsResult.ok ? (
            <StatusBadgeLink
              download={`hands-partner-withholding-tax-${filters.period}.csv`}
              href={csvHref}
              tone="success"
            >
              Export current page CSV
            </StatusBadgeLink>
          ) : null}
        </TaxFinanceWorkflowActions>
      }
      description="Monthly Partner VAT/PIT withholding totals grouped by Partner from posted settlements and closed-period reversal entries."
      title="Partner Withholding Tax"
    >
      <FinanceListCommandBoard ariaLabel="Withholding command board" className="finance-five-card-command-board">
        <FinanceListCommandCard
          detail={closeoutState.detail}
          href={`/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`}
          icon={ShieldCheck}
          label="Tax closeout"
          scope={closeoutState.scope}
          tone={closeoutState.tone}
          value={closeoutState.value}
        />
        {showWithholdingData ? (
          <>
            <FinanceListCommandCard
              detail={`${summary.postedSettlementCount ?? summary.taxableBookingCount} posted settlement(s) and ${summary.reversalCount ?? 0} reversal(s) are netted into this payable.`}
              href={`/finance-tax/partner-withholding-tax?period=${encodeURIComponent(filters.period)}`}
              icon={ReceiptText}
              label="Withholding payable"
              scope={periodScope}
              tone={summary.totalPartnerTaxWithheld > 0 ? 'warning' : 'neutral'}
              value={<MoneyText amount={summary.totalPartnerTaxWithheld} currency={summary.currency} />}
            />
            <FinanceListCommandCard
              detail={`PIT withheld: ${formatMoneyForDetail(summary.partnerPitWithheldTotal, summary.currency)}.`}
              href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
              icon={Landmark}
              label="VAT withheld"
              scope={periodScope}
              tone={summary.partnerVatWithheldTotal > 0 ? 'primary' : 'neutral'}
              value={<MoneyText amount={summary.partnerVatWithheldTotal} currency={summary.currency} />}
            />
            <FinanceListCommandCard
              detail={`${summary.taxableBookingCount} net taxable booking record(s) across the selected partners.`}
              href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
              icon={UsersRound}
              label="Taxable partners"
              scope={periodScope}
              tone={summary.partnerCountWithRevenue > 0 ? 'info' : 'neutral'}
              value={String(summary.partnerCountWithRevenue)}
            />
            <FinanceListCommandCard
              detail={`${mixedEvidencePartnerCount} mixed and ${missingEvidencePartnerCount} missing-evidence Partner record(s). Explicit 0% requires retained policy and rule evidence.`}
              href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
              icon={AlertTriangle}
              label="Withholding evidence"
              scope={withholdingEvidenceReviewCount > 0 ? 'Needs review' : periodScope}
              tone={withholdingEvidenceReviewCount > 0 ? 'warning' : 'success'}
              value={String(withholdingEvidenceReviewCount)}
            />
          </>
        ) : null}
      </FinanceListCommandBoard>

      {!closeoutEligible ? (
        <AdminInlineNotice
          className="admin-mb-16"
          role={monthlyClosingResult.ok ? 'status' : 'alert'}
          tone={monthlyClosingResult.ok ? 'info' : 'danger'}
        >
          {closeoutState.detail}
        </AdminInlineNotice>
      ) : null}

      <AdminFilterPanel
        className="admin-mb-16"
        description="Choose the tax month and page size. Active posted settlements and closed-period reversal entries are netted by Partner."
        resultLabel={`${pagination.pageSize} per page`}
        resultTone={monthlyClosingResult.ok && !closeoutEligible ? 'neutral' : 'success'}
        title="Withholding tax period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
        <AdminFilterSummary
          ariaLabel="Active withholding tax filters"
          labels={[`Period: ${filters.period}`, `Rows: ${filters.take}`]}
          tone="info"
        />
      </AdminFilterPanel>

      {rowsResult.ok ? <FinanceTablePanel
        grouped
        description="Review each Partner's net taxable revenue and VAT/PIT withholding before declaration. Posted and reversal counts stay visible so a refund cannot silently disappear from the register."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Partner withholding register"
      >
        <FinanceDataTable
          emptyMessage="No Partner withholding tax rows exist for this period."
          headers={[
            'Partner',
            'Posted',
            'Reversals',
            'Net records',
            'Partner taxable revenue',
            'VAT withheld',
            'PIT withheld',
            'Total withheld',
            'Effective rate',
            'Evidence',
          ]}
          rowCount={tableRows.length}
        >
          {tableRows.map((row) => (
            <tr key={`${row.providerProfileId}-${row.period}`}>
              <td>
                <AdminTextLink href={`/partners/${row.providerProfileId}?section=full`}>
                  {row.partnerName}
                </AdminTextLink>
              </td>
              <td>{row.postedSettlementCount ?? row.completedBookingCount}</td>
              <td>{row.reversalCount ?? 0}</td>
              <td>{row.completedBookingCount}</td>
              <td>
                <MoneyText amount={row.grossServiceRevenue} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.partnerVatWithheldTotal} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.partnerPitWithheldTotal} currency={row.currency} />
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.totalPartnerTaxWithheld} currency={row.currency} />
                </strong>
              </td>
              <td>{withholdingEffectiveRate(row)}%</td>
              <td>
                <StatusBadgeFromPillClass pillClass={withholdingEvidencePill(row.withholdingEvidenceStatus)}>
                  {withholdingEvidenceLabel(row.withholdingEvidenceStatus)}
                </StatusBadgeFromPillClass>
                <div className="muted admin-mt-6">
                  {row.completeEvidenceCount} complete · {row.explicitZeroEvidenceCount} explicit 0% ·{' '}
                  {row.missingEvidenceCount} missing
                </div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Partner withholding tax pages"
          hrefForPage={(page) => partnerWithholdingTaxHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel> : (
        <AdminSection
          className="admin-mb-16"
          description="Partner rows are hidden because the register request failed. Summary totals above remain available."
          statusLabel={rowsResult.status ? `API ${rowsResult.status}` : 'API unavailable'}
          statusTone="danger"
          title="Partner withholding register unavailable"
        >
          <AdminFormControlLink className="button-secondary" href={partnerWithholdingTaxHref(filters)}>
            Retry withholding register
          </AdminFormControlLink>
        </AdminSection>
      )}
    </AdminPageTemplate>
  );
}

function PartnerWithholdingUnavailable({
  period,
  status,
}: {
  readonly period: string;
  readonly status: number | null;
}) {
  const href = `/finance-tax/partner-withholding-tax?${new URLSearchParams({ period }).toString()}`;
  return (
    <AdminPageTemplate
      description={`Partner withholding data for ${period} could not be loaded.`}
      title="Partner Withholding Tax"
    >
      <AdminSection
        actions={<AlertTriangle aria-hidden="true" size={18} />}
        className="admin-mb-16"
        description="Withholding amounts, Partner counts, exports, and success states are hidden until the authoritative summary is available."
        statusLabel={status ? `API ${status}` : 'API unavailable'}
        statusTone="danger"
        title="Partner withholding data unavailable"
      >
        <AdminFormControlLink className="button-secondary" href={href}>
          Retry Partner withholding
        </AdminFormControlLink>
      </AdminSection>
    </AdminPageTemplate>
  );
}

function withholdingEffectiveRate(row: AdminPartnerWithholdingTaxRow) {
  if (row.grossServiceRevenue <= 0) {
    return '0';
  }
  return (Math.round((row.totalPartnerTaxWithheld / row.grossServiceRevenue) * 1000) / 10).toFixed(1);
}

function formatMoneyForDetail(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function withholdingEvidenceLabel(status: AdminPartnerWithholdingTaxRow['withholdingEvidenceStatus']) {
  switch (status) {
    case 'COMPLETE':
      return 'Complete';
    case 'EXPLICIT_ZERO':
      return 'Explicit 0%';
    case 'MIXED':
      return 'Mixed';
    case 'MISSING_EVIDENCE':
      return 'Missing evidence';
  }
}

function withholdingEvidencePill(status: AdminPartnerWithholdingTaxRow['withholdingEvidenceStatus']) {
  if (status === 'COMPLETE') return 'pill-success';
  if (status === 'EXPLICIT_ZERO') return 'pill-info';
  if (status === 'MIXED') return 'pill-warn';
  return 'pill-danger';
}
