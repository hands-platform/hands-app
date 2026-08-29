import {
  AlertTriangle,
  Banknote,
  CircleCheckBig,
  CircleDollarSign,
  CreditCard,
  ChevronRight,
  FileWarning,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { redirect } from 'next/navigation';

import type { AdminFinanceOverviewSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminOverviewCommandCard, AdminOverviewCommandGrid } from '../../components/admin-overview-card';
import { MoneyText } from '../../components/money-text';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminErrorState, AdminKpiCard, AdminRowItem, AdminRowLink, AdminSection } from '../../components/admin-surface';
import { FinancePeriodFilterForm } from '../finance-tax/finance-period-filter-form';
import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewComparisonKpis,
  buildFinanceOverviewCurrentPositionKpis,
  buildFinanceOverviewEmptyMovementCopy,
  buildFinanceOverviewFilters,
  buildFinanceOverviewPageSections,
  buildFinanceOverviewRangeLabel,
  buildFinanceOverviewRecordsSection,
  buildFinanceOverviewTodayMovementKpis,
  buildFinanceOverviewVisibleActionItems,
  emptyFinanceOverviewSummaries,
  financeOverviewCanonicalHref,
  financeOverviewSummaryInput,
  financeOverviewHref,
  financeOverviewRangeOptions,
  isFinanceOverviewCanonicalRequest,
  isFinanceOverviewRangeMovementClear,
  isFinanceTodayMovementClear,
  type FinanceOverviewActionItem,
  type FinanceOverviewKpi,
  type FinanceOverviewSection,
  type FinanceOverviewSectionRow,
} from './finance-overview-model';
import { FinanceOverviewSnapshotControl } from './finance-overview-snapshot-control';

export const dynamic = 'force-dynamic';

const financeOverviewCommandCardClassName = 'finance-overview-command-card';
const financeOverviewCommandGridClassName = 'finance-overview-command-grid';
const financeOverviewCommandIconClassName = 'finance-overview-command-icon';

type FinanceOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceOverviewPage({
  searchParams,
}: {
  readonly searchParams?: FinanceOverviewPageSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedFilters = buildFinanceOverviewFilters(params);
  if (!isFinanceOverviewCanonicalRequest(params, requestedFilters)) {
    redirect(financeOverviewCanonicalHref(requestedFilters));
  }
  const filters = requestedFilters;
  const isCommandWorkspace = filters.workspace === 'command';
  const isFlowWorkspace = filters.workspace === 'flow';
  const hrefs = buildFinanceOverviewApiHrefs(filters);
  const fallback = emptyFinanceOverviewSummaries(filters.period);
  const overviewResult = await adminGetResult<AdminFinanceOverviewSummary>(hrefs.overviewSummaryHref, {
    generatedAt: '',
    range: filters.range,
    period: filters.period,
    ...fallback,
  });
  const overviewSummary = overviewResult.data;
  const overviewInput = financeOverviewSummaryInput(overviewSummary);
  const hasOverviewData = overviewResult.ok && overviewSummary.generatedAt.trim().length > 0;
  const { couponSummary, settlementSummary } = overviewInput;
  const currentPositionKpis = isCommandWorkspace
    ? buildFinanceOverviewCurrentPositionKpis(overviewInput)
    : [];
  const todayMovementKpis = isCommandWorkspace ? buildFinanceOverviewTodayMovementKpis(overviewInput) : [];
  const isTodayMovementClear = isCommandWorkspace && isFinanceTodayMovementClear(overviewInput);
  const recordsSection = isCommandWorkspace
    ? buildFinanceOverviewRecordsSection(overviewInput, filters.range)
    : null;
  const isRangeMovementClear = isFlowWorkspace && isFinanceOverviewRangeMovementClear(overviewInput);
  const sections = isFlowWorkspace
    ? buildFinanceOverviewPageSections(overviewInput, filters.range).filter(
        (section) => !isRangeMovementClear || section.title !== 'Revenue & Platform Fee',
      )
    : [];
  const comparisonKpis = isFlowWorkspace && filters.range !== 'today'
    ? buildFinanceOverviewComparisonKpis(overviewInput, filters.range)
    : [];
  const actionItems =
    filters.workspace === 'queues' ? buildFinanceOverviewActionItems(overviewInput) : [];
  const visibleActionItems =
    filters.workspace === 'queues' ? buildFinanceOverviewVisibleActionItems(actionItems) : [];
  const rangeLabel = buildFinanceOverviewRangeLabel(filters.range);
  const scopeLabel = isCommandWorkspace
    ? 'today'
    : filters.workspace === 'queues'
      ? 'all-open'
      : filters.range === 'today'
        ? 'today'
        : 'historical';
  const netRevenueEstimate = isFlowWorkspace
    ? settlementSummary.platformFeeNetRevenue -
      couponSummary.companyCouponExpense -
      settlementSummary.paymentProcessingFee
    : 0;
  const principleCards = isFlowWorkspace && !isRangeMovementClear
    ? [
        {
          detail: 'Customer paid amount is not company revenue.',
          icon: <CircleDollarSign size={19} aria-hidden="true" />,
          label: 'Gross customer payment',
          tone: 'primary',
          value: (
            <FinanceOverviewPrincipleMoney
              amount={settlementSummary.customerPaymentAmount}
              currency={settlementSummary.currency}
            />
          ),
        },
        {
          detail: 'Platform fee net revenue is the revenue base.',
          icon: <ReceiptText size={19} aria-hidden="true" />,
          label: 'Actual company revenue',
          tone: 'success',
          value: (
            <FinanceOverviewPrincipleMoney
              amount={settlementSummary.platformFeeNetRevenue}
              currency={settlementSummary.currency}
            />
          ),
        },
        {
          detail: 'Partner payout stays payable until payout or withdrawal closeout.',
          icon: <WalletCards size={19} aria-hidden="true" />,
          label: 'Partner payable',
          tone: 'warning',
          value: <FinanceOverviewPrincipleMoney amount={settlementSummary.partnerPayoutAmount} currency={settlementSummary.currency} />,
        },
        {
          detail: 'Net revenue estimate excludes gross pass-through payment volume.',
          icon: <ShieldCheck size={19} aria-hidden="true" />,
          label: 'Net estimate',
          tone: 'info',
          value: <FinanceOverviewPrincipleMoney amount={netRevenueEstimate} currency={settlementSummary.currency} />,
        },
      ]
    : [];

  return (
    <AdminPageTemplate
      contentClassName="finance-overview-page"
      description={
        isCommandWorkspace
          ? 'Review today money movement and current ledger balances. Older unresolved work remains in Current backlog.'
          : isFlowWorkspace
            ? 'Follow customer payments through revenue, Partner payable, wallet balances, tax, and reconciliation.'
            : 'Review unresolved Finance queues across all dates.'
      }
      title="Finance Overview"
    >
      <AdminFilterPanel
        actions={
          hasOverviewData ? (
            <FinanceOverviewSnapshotControl
              generatedAt={overviewSummary.generatedAt}
              scopeLabel={scopeLabel}
            />
          ) : null
        }
        className="finance-overview-filter-panel"
        description={
          isCommandWorkspace
            ? 'Today movement uses Vietnam time. Current balances are live ledger positions.'
            : filters.workspace === 'queues'
              ? 'All unresolved Finance queues remain visible until they are resolved.'
              : 'The range controls money-flow totals. Open queues and wallet balances remain current.'
        }
        title="Finance scope"
      >
        <AdminSegmentedControl
          activeValue={filters.workspace}
          ariaLabel="Finance overview workspaces"
          className="finance-overview-workspace-buttons"
          options={[
            {
              href: financeOverviewHref(filters.range, {
                period: filters.period,
                workspace: 'command',
              }),
              label: 'Today movement',
              value: 'command',
            },
            {
              href: financeOverviewHref(filters.range, {
                period: filters.period,
                workspace: 'queues',
              }),
              label: 'Current backlog',
              value: 'queues',
            },
            {
              href: financeOverviewHref(filters.range, {
                period: filters.period,
                workspace: 'flow',
              }),
              label: 'Money flow',
              value: 'flow',
            },
          ]}
          semantics="navigation"
        />
        {isFlowWorkspace ? (
          <AdminSegmentedControl
            activeValue={filters.range}
            ariaLabel="Finance overview range"
            className="finance-overview-range-buttons"
            options={financeOverviewRangeOptions.map((option) => ({
              href: financeOverviewHref(option.value, {
                period: filters.period,
                workspace: filters.workspace,
              }),
              label: option.label,
              value: option.value,
            }))}
            semantics="navigation"
          />
        ) : null}
        {isFlowWorkspace ? (
          <FinancePeriodFilterForm
            action="/finance-overview"
            className="finance-overview-period-form"
            hiddenFields={[
              { name: 'range', value: filters.range },
              { name: 'view', value: filters.workspace },
            ]}
            period={filters.period}
            periodLabel="Monthly tax period"
          />
        ) : null}
      </AdminFilterPanel>

      {!hasOverviewData ? (
        <FinanceOverviewUnavailable
          href={financeOverviewHref(filters.range, {
            period: filters.period,
            workspace: filters.workspace,
          })}
        />
      ) : null}

      {hasOverviewData && isCommandWorkspace ? (
        <>
          {isTodayMovementClear ? (
            <AdminInlineNotice className="finance-overview-today-clear" role="status" tone="info">
              <strong>Today movement clear.</strong>{' '}
              No finance movement recorded in Vietnam time. Current balances remain visible below.
            </AdminInlineNotice>
          ) : (
            <AdminSection
              bodyClassName="finance-overview-kpi-grid"
              className="finance-overview-kpi-section"
              description="Payments, failed charges, pending refunds, and Partner payable generated today only."
              statusLabel="Today · Vietnam time"
              statusTone="info"
              title="Today Movement"
            >
              {todayMovementKpis.map((kpi) => (
                <FinanceKpiCard key={kpi.label} kpi={kpi} rangeLabel="Today" />
              ))}
            </AdminSection>
          )}

          <AdminSection
            bodyClassName="finance-overview-kpi-grid"
            className="finance-overview-kpi-section"
            description="Current ledger balances and payable exposure, independent of the selected performance range."
            statusLabel="Current balance"
            statusTone="info"
            title="Current Balances"
          >
            {currentPositionKpis.map((kpi) => (
              <FinanceKpiCard key={kpi.label} kpi={kpi} rangeLabel={rangeLabel} />
            ))}
          </AdminSection>

          {recordsSection ? (
            <FinanceOverviewSectionCard
              period={filters.period}
              rangeLabel={rangeLabel}
              section={recordsSection}
            />
          ) : null}
        </>
      ) : null}

      {hasOverviewData && isFlowWorkspace ? (
        <>
          {isRangeMovementClear ? (
            <AdminInlineNotice className="finance-overview-range-clear" role="status" tone="info">
              {buildFinanceOverviewEmptyMovementCopy(filters.range)}
            </AdminInlineNotice>
          ) : (
            <AdminOverviewCommandGrid
              ariaLabel="Finance accounting principles"
              baseClassName={financeOverviewCommandGridClassName}
              className="finance-overview-principle-grid"
            >
              {principleCards.map((card) => (
                <AdminOverviewCommandCard
                  baseClassName={financeOverviewCommandCardClassName}
                  className={`finance-overview-principle-card is-${card.tone}`}
                  detail={card.detail}
                  icon={card.icon}
                  iconClassName={financeOverviewCommandIconClassName}
                  key={card.label}
                  kind="period"
                  label={card.label}
                  scope={rangeLabel}
                  value={card.value}
                />
              ))}
            </AdminOverviewCommandGrid>
          )}

          {comparisonKpis.length > 0 ? (
            <AdminSection
              bodyClassName="finance-overview-comparison-strip"
              className="finance-overview-comparison-section"
              description="Equal-length comparison with the immediately preceding period. Links open current-range records."
              statusLabel={rangeLabel}
              statusTone="info"
              title="Compared with previous period"
            >
              {comparisonKpis.map((kpi) => (
                <AdminRowLink className="finance-overview-comparison-item" href={kpi.href ?? '#'} key={kpi.label}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.detail}</strong>
                  <ChevronRight aria-hidden="true" size={16} />
                </AdminRowLink>
              ))}
            </AdminSection>
          ) : null}

          <AdminOverviewCommandGrid
            ariaLabel="Finance overview sections"
            baseClassName={financeOverviewCommandGridClassName}
            className="finance-overview-section-grid"
          >
            {sections.map((section) => (
              <FinanceOverviewSectionCard
                key={section.title}
                period={filters.period}
                rangeLabel={rangeLabel}
                section={section}
              />
            ))}
          </AdminOverviewCommandGrid>
        </>
      ) : null}

      {hasOverviewData && filters.workspace === 'queues' ? (
        <AdminSection
          actions={<AlertTriangle size={18} aria-hidden="true" />}
          bodyClassName="finance-overview-action-list"
          className="finance-overview-action-card"
          description="Current unresolved queues across all dates. Sorted by operational risk; open a queue to review the underlying records."
          statusLabel={visibleActionItems.length > 0 ? `${visibleActionItems.length} queues` : 'All clear'}
          statusTone={visibleActionItems.length > 0 ? 'warning' : 'success'}
          title="Current Open Backlog"
        >
          {visibleActionItems.length > 0 ? (
            <>
              <div aria-hidden="true" className="finance-overview-queue-header">
                <span />
                <span>Queue</span>
                <span>Work</span>
                <span>Oldest</span>
                <span>Impact</span>
                <span>Owner</span>
                <span>Action</span>
              </div>
              {visibleActionItems.map((item) => <FinanceActionItem key={item.label} item={item} />)}
            </>
          ) : (
            <AdminRowItem className="finance-overview-row finance-overview-queue-empty">
              <div>
                <strong>No unresolved Finance queues</strong>
                <small>Payment, bank, payout, wallet, tax, and journal batch controls are clear.</small>
              </div>
              <CircleCheckBig size={18} aria-hidden="true" />
            </AdminRowItem>
          )}
        </AdminSection>
      ) : null}
    </AdminPageTemplate>
  );
}

function FinanceOverviewPrincipleMoney({
  amount,
  currency,
}: {
  readonly amount: number;
  readonly currency: string;
}) {
  return (
    <span className="finance-overview-principle-value">
      <span>{formatMoney(amount, '').trim()}</span>
      <small>{currency}</small>
    </span>
  );
}

function FinanceOverviewUnavailable({ href }: { readonly href: string }) {
  return (
    <AdminErrorState
      action={<AdminTextLink href={href}>Reload Finance Overview</AdminTextLink>}
      className="finance-overview-data-unavailable"
      message="Current balances and Finance queues could not be loaded. Do not treat unavailable values as zero."
      title="Finance data unavailable"
    />
  );
}

function FinanceKpiCard({
  kpi,
  rangeLabel,
}: {
  readonly kpi: FinanceOverviewKpi;
  readonly rangeLabel: string;
}) {
  const Icon = financeKpiIcons[kpi.label] ?? CircleDollarSign;
  const meta = financeOverviewKpiMeta(kpi.label, rangeLabel);

  return (
    <AdminKpiCard
      className={`finance-overview-kpi-card is-${kpi.tone}`}
      href={kpi.href}
      helper={kpi.detail}
      icon={Icon}
      iconSize={18}
      kind={meta.kind}
      label={kpi.label}
      scope={meta.scope}
      value={<FinanceOverviewMetricValue metric={kpi} />}
    />
  );
}

function financeOverviewKpiMeta(label: string, rangeLabel: string) {
  if (
    label === 'Customer Wallet Liability' ||
    label === 'Partner Wallet Liability' ||
    label === 'Partner Receivable' ||
    label === 'Withdrawal Payable'
  ) {
    return { kind: label === 'Partner Receivable' ? 'risk' : 'live', scope: 'Current balance' } as const;
  }

  if (label === 'Partner Payout Pending') {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  if (label === 'Payment Failed Amount' || label === 'Reconciliation Issues') {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  if (label === 'Failed Payments Today' || label === 'Pending Refunds Created Today') {
    return {
      kind: label === 'Pending Refunds Created Today' ? 'action' : 'risk',
      scope: 'Today',
    } as const;
  }

  if (label === 'Customer Payments Today' || label === 'Partner Payout Generated Today') {
    return { kind: 'period', scope: 'Today' } as const;
  }

  if (
    label === 'Platform VAT' ||
    label === 'Partner Withholding' ||
    label === 'Reconciliation Delta' ||
    label === 'Close Status'
  ) {
    return {
      kind: label === 'Reconciliation Delta' ? 'risk' : 'period',
      scope: 'This month',
    } as const;
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

function FinanceOverviewSectionCard({
  period,
  rangeLabel,
  section,
}: {
  readonly period: string;
  readonly rangeLabel: string;
  readonly section: FinanceOverviewSection;
}) {
  const Icon = financeSectionIcons[section.title] ?? CircleDollarSign;
  const scope =
    section.title === 'Records'
      ? 'All records'
      : section.title === 'Wallet Liability'
        ? 'Current balance'
        : section.title === 'Reconciliation'
          ? 'Current + all-open'
          : section.title === 'Tax Overview'
            ? period
            : section.title === 'Partner Settlement'
              ? 'Current queue'
              : section.title === 'Payment Method Status'
                ? rangeLabel
              : rangeLabel;
  const showSectionAction =
    section.title === 'Payment Method Status' &&
    Boolean(section.href) &&
    section.rows.some((row) => Number(row.value ?? 0) > 0);

  return (
    <AdminSection
      actions={<Icon size={18} aria-hidden="true" />}
      bodyClassName="finance-overview-row-list"
      className={`finance-overview-section-card is-${section.tone}`}
      description={section.description}
      statusLabel={scope}
      statusTone="info"
      title={section.title}
    >
      {section.rows.map((row) => {
        const body = (
          <>
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
            <span className="finance-overview-row-tail">
              <FinanceOverviewSectionRowValue row={row} />
              {row.href ? <ChevronRight aria-hidden="true" size={16} /> : null}
            </span>
          </>
        );

        return row.href ? (
          <AdminRowLink className="finance-overview-row" href={row.href} key={row.label}>
            {body}
          </AdminRowLink>
        ) : (
          <AdminRowItem className="finance-overview-row" key={row.label}>
            {body}
          </AdminRowItem>
        );
      })}
      {showSectionAction && section.href ? (
        <AdminRowLink
          ariaLabel={`Open Payments for ${rangeLabel}`}
          className="finance-overview-row finance-overview-section-action"
          href={section.href}
        >
          <div>
            <strong>Open Payments</strong>
            <small>Review the payment records behind this range.</small>
          </div>
          <span className="finance-overview-row-tail">
            <span>{rangeLabel}</span>
            <ChevronRight aria-hidden="true" size={16} />
          </span>
        </AdminRowLink>
      ) : null}
    </AdminSection>
  );
}

function FinanceActionItem({ item }: { readonly item: FinanceOverviewActionItem }) {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'warning' ? FileWarning : ShieldCheck;
  const meta = financeOverviewActionItemMeta(item);

  return (
    <AdminRowLink
      ariaLabel={financeOverviewActionItemAriaLabel(item)}
      className={`finance-overview-queue-row is-${item.tone}`}
      href={item.href}
    >
      <span className="finance-overview-action-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="finance-overview-queue-main">
        <span className={`metric-card-scope is-${meta.kind}`}>{meta.scope}</span>
        <strong>{item.label}</strong>
        <small>{item.detail}</small>
      </div>
      <strong className="finance-overview-queue-count">{item.countLabel}</strong>
      <span className="finance-overview-queue-oldest">
        {item.oldestLabel?.replace(/^Oldest\s+/, '') ?? 'Unavailable'}
      </span>
      <FinanceActionImpact item={item} />
      <span className={`finance-overview-queue-owner is-${item.ownerState}`}>
        <strong>{item.ownerLabel}</strong>
        {item.assigneeLabel ? <small>{item.assigneeLabel}</small> : null}
      </span>
      <span className="finance-overview-queue-action">
        Open <ChevronRight aria-hidden="true" size={15} />
      </span>
    </AdminRowLink>
  );
}

function financeOverviewActionItemAriaLabel(item: FinanceOverviewActionItem) {
  const impact =
    item.amount === undefined
      ? item.amountLabel
      : formatMoney(item.amount, item.currency ?? 'VND');
  const assignee = item.assigneeLabel && item.assigneeLabel !== item.countLabel
    ? `, ${item.assigneeLabel}`
    : '';

  return [
    `Open ${item.label}.`,
    `${item.countLabel}.`,
    item.oldestLabel ? `${item.oldestLabel}.` : 'Oldest time unavailable.',
    ...(impact ? [`Impact ${impact}.`] : []),
    `Owner ${item.ownerLabel}${assignee}.`,
  ].join(' ');
}

function financeOverviewActionItemMeta(item: FinanceOverviewActionItem) {
  if (
    item.label === 'Finance review SLA' ||
    item.label === 'Payment clearing open' ||
    item.label === 'Bank reconciliation unmatched' ||
    item.label === 'Cash debt recovery'
  ) {
    return item.tone === 'success'
      ? ({ kind: 'live', scope: 'Current queue' } as const)
      : ({ kind: 'risk', scope: 'Needs action' } as const);
  }

  if (item.label === 'General ledger balance') {
    return { kind: 'record', scope: 'All records' } as const;
  }

  return item.tone === 'success'
    ? ({ kind: 'live', scope: 'Current queue' } as const)
    : ({ kind: 'action', scope: 'Pending' } as const);
}

function FinanceActionImpact({ item }: { readonly item: FinanceOverviewActionItem }) {
  return (
    <span className="finance-overview-queue-impact">
      {item.amount === undefined ? (
        (item.amountLabel ?? 'Not available')
      ) : (
        <MoneyText amount={item.amount} currency={item.currency ?? 'VND'} />
      )}
    </span>
  );
}

function FinanceOverviewMetricValue({ metric }: { readonly metric: FinanceOverviewKpi }) {
  return metric.amount === undefined ? (
    (metric.value ?? 'Not set')
  ) : (
    <MoneyText amount={metric.amount} currency={metric.currency ?? 'VND'} />
  );
}

function FinanceOverviewSectionRowValue({ row }: { readonly row: FinanceOverviewSectionRow }) {
  return (
    <>
      {row.amount === undefined ? (
        (row.value ?? 'Not set')
      ) : (
        <MoneyText amount={row.amount} currency={row.currency ?? 'VND'} />
      )}
    </>
  );
}

const financeKpiIcons: Record<string, typeof CircleDollarSign> = {
  'Cash Pending Amount': Banknote,
  'Close Status': CircleCheckBig,
  'Customer Payments Today': CircleDollarSign,
  'Customer Wallet Liability': WalletCards,
  'Failed Payments Today': CreditCard,
  'Gross Booking Amount': CircleDollarSign,
  'Pending Refunds Created Today': RefreshCw,
  'Partner Receivable': AlertTriangle,
  'Partner Payout Generated Today': WalletCards,
  'Partner Withholding': ReceiptText,
  'Net Platform Revenue Estimate': ShieldCheck,
  'Partner Payout Pending': WalletCards,
  'Payment Failed Amount': CreditCard,
  'Platform VAT': Landmark,
  'Platform Fee': ReceiptText,
  'Reconciliation Delta': FileWarning,
  'Reconciliation Issues': FileWarning,
  'Refund Pending Amount': FileWarning,
  'Tax Info Missing Partners': Landmark,
  'Withdrawal Payable': Landmark,
};

const financeSectionIcons: Record<string, typeof CircleDollarSign> = {
  'Cash Payment / Receivable': Banknote,
  'Partner Settlement': WalletCards,
  'Payment Method Status': CreditCard,
  Reconciliation: FileWarning,
  'Refund & Dispute': AlertTriangle,
  'Revenue & Platform Fee': ReceiptText,
  'Tax Overview': Landmark,
  'Wallet Liability': WalletCards,
};
