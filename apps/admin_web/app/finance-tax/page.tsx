import { AlertTriangle } from 'lucide-react';

import { ActionMenu } from '../../components/action-menu';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminDisclosure, AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import type { AdminMonthlyTaxClosingSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
import { FinanceOverviewTablePanel, type FinanceOverviewTableRow } from './finance-overview-table-panel';
import { FinancePeriodFilterForm } from './finance-period-filter-form';
import {
  bookingSettlementAuditHref,
  buildMonthlyTaxClosingPreflightLinks,
  buildMonthlyTaxClosingRiskLinks,
  buildMonthlyTaxClosingSummaryApiHref,
  emptyMonthlyTaxClosingSummary,
  generalLedgerHref,
  monthlyTaxClosingHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  resolveMonthlyTaxClosingPreflight,
} from './tax-settlement-page-model';

type FinanceTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceTaxPage({ searchParams }: FinanceTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const settlementFilters = {
    ...readBookingSettlementFilters(params),
    page: 1,
    period: monthlyFilters.period,
    range: 'all' as const,
  };
  const accountingFilters = {
    ...readFinanceAccountingFilters(params, 'posted'),
    page: 1,
    period: monthlyFilters.period,
    range: 'all' as const,
    returnTo: `/finance-tax?${new URLSearchParams({ period: monthlyFilters.period }).toString()}`,
  };
  const summaryResult = await adminGetResult<AdminMonthlyTaxClosingSummary>(
    buildMonthlyTaxClosingSummaryApiHref(monthlyFilters),
    emptyMonthlyTaxClosingSummary(monthlyFilters.period),
  );

  if (!summaryResult.ok) {
    return <TaxCloseUnavailable period={monthlyFilters.period} status={summaryResult.status} />;
  }

  const summary = summaryResult.data;
  const preflight = resolveMonthlyTaxClosingPreflight(summary);
  const hardBlockerControls = buildMonthlyTaxClosingPreflightLinks(
    summary,
    settlementFilters,
    monthlyFilters,
  );
  const hardBlockerKeys = new Set(hardBlockerControls.map((item) => item.key));
  const riskLinks = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, monthlyFilters);
  const reviewFlags = riskLinks.filter(
    (item) => !hardBlockerKeys.has(item.key) && hasPriorityWork(item),
  );
  const activeControls = [
    ...hardBlockerControls.map((item) => ({ ...item, controlType: 'BLOCKER' as const })),
    ...reviewFlags.map((item) => ({ ...item, controlType: 'REVIEW' as const })),
  ];
  const noSignalControls = riskLinks.filter((item) => !hasPriorityWork(item));
  const periodState = summary.periodState ?? summary.status;
  const generatedLabel = formatDateTime(summary.generatedAt, 'Generation time unavailable');
  const closeoutRows = buildCloseoutRows(activeControls, summary);
  const recordRows = buildRecordRows({
    accountingFilters,
    monthlyFilters,
    settlementFilters,
  });
  const transitionActionLabel = closeTransitionActionLabel(periodState, Boolean(summary.hasActivity));
  const showOperationalControls = periodState !== 'FUTURE_PERIOD' && summary.hasActivity;
  const headerActions = [
    {
      href: `/finance-tax?${new URLSearchParams({ period: summary.period }).toString()}`,
      kind: 'link' as const,
      label: 'Refresh now',
      tone: 'info' as const,
    },
    ...(transitionActionLabel
      ? [{
          href: monthlyTaxClosingHref(monthlyFilters),
          kind: 'link' as const,
          label: transitionActionLabel,
          tone: 'neutral' as const,
        }]
      : []),
  ];

  return (
    <AdminPageTemplate
      actions={
        <ActionMenu
          actions={headerActions}
          label="Tax and period close actions"
          variant="button-list"
        />
      }
      contentClassName="finance-tax-close-cockpit"
      description="Monthly close controls, tax exposure, reconciliation evidence, and accounting registers for one Vietnam period."
      title="Tax & Period Close"
    >
      <AdminFilterPanel
        className="admin-mb-16 finance-tax-period-control"
        description={`Generated ${generatedLabel} · Asia/Ho_Chi_Minh. Changing the month updates every control and register on this page.`}
        resultLabel={`${summary.period} · ${formatPeriodState(periodState)}`}
        resultTone={periodState === 'CLOSED' ? 'success' : periodState === 'FUTURE_PERIOD' ? 'neutral' : 'info'}
        title="Accounting month"
      >
        <FinancePeriodFilterForm
          action="/finance-tax"
          period={monthlyFilters.period}
          submitLabel="Apply month"
        />
      </AdminFilterPanel>

      {periodState === 'FUTURE_PERIOD' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="info">
          <strong>Future period — monitoring not started.</strong> No transition or close workload is available for this month.
        </AdminInlineNotice>
      ) : !summary.hasActivity ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="info">
          <strong>No activity — no close record.</strong> No settlement, reversal, or reconciliation activity exists for this month.
        </AdminInlineNotice>
      ) : null}

      {showOperationalControls ? (
        <>
          <AdminInlineNotice className="admin-mb-12 finance-tax-decision-summary" role="status" tone={preflight.blockers.length > 0 ? 'danger' : 'warning'}>
            <strong>{formatCount(preflight.blockers.length, 'hard blocker')}</strong> ·{' '}
            {formatCount(reviewFlags.length, 'review flag')} ·{' '}
            {formatCount(activeControls.length, 'active control')}. Server preflight is the only hard-blocker source.
          </AdminInlineNotice>

          <FinanceOverviewTablePanel
            description="Server-enforced blockers appear before advisory review controls. Counts can overlap; financial exposure is shown only when calculated."
            emptyMessage="No hard blocker or review signal is open for the selected accounting month."
            emptyTitle="No open close controls"
            resultLabel={preflight.blockers.length > 0
              ? formatCount(preflight.blockers.length, 'hard blocker')
              : formatCount(reviewFlags.length, 'review flag')}
            resultTone={preflight.blockers.length > 0 ? 'danger' : reviewFlags.length > 0 ? 'warning' : 'success'}
            rows={closeoutRows}
            title="Active close controls"
            variant="controls"
          />

          <AdminSection
            className="admin-mb-16 finance-tax-no-signal-section"
            description="These controls have no open signal for the selected month. This is not a verified-clear record."
            statusLabel={formatCount(noSignalControls.length, 'no open signal')}
            statusTone="neutral"
            title="Controls with no open signal"
          >
            <AdminDisclosure className="finance-tax-cleared-controls">
              <summary>
                <span className="finance-tax-disclosure-show">Show controls with no open signal</span>
                <span className="finance-tax-disclosure-hide">Hide controls with no open signal</span>
              </summary>
              <p className="muted">
                {noSignalControls.length > 0
                  ? noSignalControls.map((item) => item.label).join(' · ')
                  : 'Every evaluated control has an open signal.'}
              </p>
            </AdminDisclosure>
          </AdminSection>
        </>
      ) : null}

      <AdminSection
        className="admin-mb-16 finance-tax-related-registers"
        description="Open the selected month in the authoritative accounting, settlement, reversal, and policy registers."
        title="Related registers"
      >
        <ActionMenu
          actions={recordRows.map((row) => ({
            href: row.href,
            kind: 'link' as const,
            label: `${String(row.label)} · ${String(row.value)}`,
            tone: 'neutral' as const,
          }))}
          label="Related accounting registers"
          variant="button-list"
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}

function TaxCloseUnavailable({
  period,
  status,
}: {
  readonly period: string;
  readonly status: number | null;
}) {
  return (
    <AdminPageTemplate
      description={`Monthly tax and close totals for ${period} could not be loaded.`}
      title="Tax & Period Close"
    >
      <AdminSection
        actions={<AlertTriangle aria-hidden="true" size={18} />}
        className="admin-mb-16"
        description="Tax amounts and closeout counts are intentionally hidden so unavailable data is never mistaken for 0 VND or zero pending records."
        statusLabel={status ? `API ${status}` : 'API unavailable'}
        statusTone="danger"
        title="Tax and close data unavailable"
      >
        <ActionMenu
          actions={[
            {
              href: `/finance-tax?${new URLSearchParams({ period }).toString()}`,
              kind: 'link',
              label: 'Retry tax and close overview',
              tone: 'danger',
            },
            {
              href: '/finance-overview',
              kind: 'link',
              label: 'Open Finance Overview',
              tone: 'info',
            },
          ]}
          label="Tax and close unavailable actions"
          variant="button-list"
        />
      </AdminSection>
    </AdminPageTemplate>
  );
}

function buildCloseoutRows(
  controls: ReadonlyArray<
    ReturnType<typeof buildMonthlyTaxClosingRiskLinks>[number] & {
      readonly controlType: 'BLOCKER' | 'REVIEW';
    }
  >,
  summary: AdminMonthlyTaxClosingSummary,
): FinanceOverviewTableRow[] {
  return controls.map((control) => ({
    actionLabel: closeControlActionLabel(control.key),
    affectedRecords: control.count === null ? 'Not counted' : formatCount(control.count, 'record'),
    exposure:
      control.amount !== null && control.currency
        ? <MoneyText amount={control.amount} currency={control.currency} />
        : 'Not calculated',
    helper: control.helper,
    href: control.href,
    key: `${control.controlType.toLowerCase()}-${control.key}`,
    label: control.label,
    signal: control.controlType === 'BLOCKER' ? 'Hard blocker' : 'Review flag',
    signalTone: 'warn',
    value: control.amount !== null
      ? <MoneyText amount={control.amount} currency={control.currency ?? summary.currency} />
      : '—',
  }));
}

function hasPriorityWork(item: ReturnType<typeof buildMonthlyTaxClosingRiskLinks>[number]) {
  return (item.count ?? 0) > 0 || Math.abs(item.amount ?? 0) > 0;
}

function closeControlActionLabel(key: string) {
  if (key.includes('deposit')) return 'Match deposits';
  if (key.includes('outflow')) return 'Match payouts';
  if (key.includes('inflow')) return 'Match returns';
  if (key.includes('coupon')) return 'Review coupons';
  if (key.includes('payment-fee')) return 'Review fee evidence';
  if (key.includes('tax')) return 'Review tax rows';
  if (key.includes('journal')) return 'Review journals';
  if (key.includes('cash-debt')) return 'Review cash debt';
  return 'Review formula';
}

function formatPeriodState(state: NonNullable<AdminMonthlyTaxClosingSummary['periodState']> | string) {
  return state.replaceAll('_', ' ').toLowerCase().replace(/^./u, (value) => value.toUpperCase());
}

function closeTransitionActionLabel(
  periodState: NonNullable<AdminMonthlyTaxClosingSummary['periodState']> | string,
  hasActivity: boolean,
) {
  if (!hasActivity || periodState === 'FUTURE_PERIOD') return null;
  if (periodState === 'CLOSED') return 'View closed period';
  if (periodState === 'REVIEWED') return 'Prepare tax declaration';
  if (periodState === 'DECLARED') return 'Record tax payment';
  if (periodState === 'PAID') return 'Run final close checks';
  return 'Review monthly totals';
}

function formatCount(count: number, singular: string) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : `${singular}s`}`;
}

function buildRecordRows({
  accountingFilters,
  monthlyFilters,
  settlementFilters,
}: {
  readonly accountingFilters: ReturnType<typeof readFinanceAccountingFilters>;
  readonly monthlyFilters: ReturnType<typeof readMonthlyTaxClosingFilters>;
  readonly settlementFilters: ReturnType<typeof readBookingSettlementFilters>;
}): FinanceOverviewTableRow[] {
  const returnTo = `/finance-tax?${new URLSearchParams({ period: monthlyFilters.period }).toString()}`;
  return [
    {
      actionLabel: 'Open',
      helper: 'Posted booking amounts, payment method, Partner payout, VAT/PIT, and fee evidence.',
      href: bookingSettlementAuditHref({
        ...settlementFilters,
        page: 1,
        period: monthlyFilters.period,
        range: 'all',
        returnTo,
        review: 'all',
        sort: 'oldest',
      }),
      key: 'settlements',
      label: 'Booking settlement records',
      signal: 'SETTLE',
      value: monthlyFilters.period,
    },
    {
      actionLabel: 'Open',
      helper:
        'Balanced debit and credit batches created by settlement, refund, payout, and adjustment flows.',
      href: generalLedgerHref(accountingFilters),
      key: 'ledger',
      label: 'General ledger',
      signal: 'GL',
      value: monthlyFilters.period,
    },
    {
      actionLabel: 'Open',
      helper: 'Closed-period corrections and refunds retained without editing the original settlement.',
      href: `/finance-tax/settlement-reversals?${new URLSearchParams({
        period: monthlyFilters.period,
        range: 'all',
        review: 'all',
        returnTo,
      }).toString()}`,
      key: 'reversals',
      label: 'Settlement reversals',
      signal: 'REV',
      value: monthlyFilters.period,
    },
    {
      actionLabel: 'Open',
      helper: 'Versioned Vietnam tax rules. Historical settlement values remain immutable.',
      href: '/tax-policy',
      key: 'tax-policy',
      label: 'Tax policy',
      signal: 'RULES',
      value: 'Global',
    },
  ];
}
