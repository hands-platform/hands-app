import {
  AlertTriangle,
  Banknote,
  CircleCheckBig,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileWarning,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

import type {
  AdminFinanceOverviewSummary,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminOverviewCommandCard, AdminOverviewCommandGrid } from '../../components/admin-overview-card';
import { MoneyText } from '../../components/money-text';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminKpiCard, AdminRowItem, AdminRowLink, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { FinancePeriodFilterForm } from '../finance-tax/finance-period-filter-form';
import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewControlMetrics,
  buildFinanceOverviewFilters,
  buildFinanceOverviewPageSections,
  buildFinanceOverviewPrimaryKpis,
  buildFinanceOverviewRangeLabel,
  buildFinanceOverviewReviewSlaMetrics,
  buildFinanceOverviewVisibleActionItems,
  emptyFinanceOverviewSummaries,
  financeOverviewSummaryInput,
  financeOverviewHref,
  financeOverviewRangeOptions,
  type FinanceOverviewActionItem,
  type FinanceOverviewControlMetric,
  type FinanceOverviewKpi,
  type FinanceOverviewSection,
  type FinanceOverviewSectionRow,
} from './finance-overview-model';

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
  const filters = buildFinanceOverviewFilters(params);
  const isCommandWorkspace = filters.workspace === 'command';
  const isFlowWorkspace = filters.workspace === 'flow';
  const workspaceLabel =
    filters.workspace === 'flow'
      ? 'Money flow'
      : filters.workspace === 'queues'
        ? 'Action queues'
        : 'Command';
  const hrefs = buildFinanceOverviewApiHrefs(filters);
  const fallback = emptyFinanceOverviewSummaries(filters.period);
  const overviewSummary = await adminGet<AdminFinanceOverviewSummary>(hrefs.overviewSummaryHref, {
    generatedAt: '',
    range: filters.range,
    period: filters.period,
    ...fallback,
  });
  const overviewInput = financeOverviewSummaryInput(overviewSummary);
  const { couponSummary, settlementSummary } = overviewInput;
  const controlMetrics = isCommandWorkspace
    ? buildFinanceOverviewControlMetrics(overviewInput, filters.range)
    : [];
  const primaryKpis = isCommandWorkspace ? buildFinanceOverviewPrimaryKpis(overviewInput) : [];
  const reviewSlaMetrics = isCommandWorkspace
    ? buildFinanceOverviewReviewSlaMetrics(overviewInput, filters.range)
    : [];
  const sections = isFlowWorkspace ? buildFinanceOverviewPageSections(overviewInput) : [];
  const actionItems = isFlowWorkspace ? [] : buildFinanceOverviewActionItems(overviewInput, filters.range);
  const visibleActionItems =
    filters.workspace === 'queues' ? buildFinanceOverviewVisibleActionItems(actionItems) : [];
  const priorityItems = actionItems.filter((item) => item.tone === 'danger' || item.tone === 'warning');
  const priorityDeskItems = priorityItems.length > 0 ? priorityItems.slice(0, 4) : actionItems.slice(0, 4);
  const rangeLabel = buildFinanceOverviewRangeLabel(filters.range);
  const netRevenueEstimate = isFlowWorkspace
    ? settlementSummary.platformFeeNetRevenue -
      couponSummary.companyCouponExpense -
      settlementSummary.paymentProcessingFee
    : 0;
  const principleCards = isFlowWorkspace
    ? [
        {
          detail: 'Customer paid amount is not company revenue.',
          icon: <CircleDollarSign size={19} aria-hidden="true" />,
          label: 'Gross customer payment',
          tone: 'primary',
          value: (
            <MoneyText
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
            <MoneyText
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
          value: (
            <MoneyText
              amount={settlementSummary.partnerPayoutAmount}
              currency={settlementSummary.currency}
            />
          ),
        },
        {
          detail: 'Net revenue estimate excludes gross pass-through payment volume.',
          icon: <ShieldCheck size={19} aria-hidden="true" />,
          label: 'Net estimate',
          tone: 'info',
          value: <MoneyText amount={netRevenueEstimate} currency={settlementSummary.currency} />,
        },
      ]
    : [];

  return (
    <AdminPageTemplate
      contentClassName="finance-overview-page"
      description={
        isCommandWorkspace
          ? 'Current Finance risks, priority queues, and core operating signals.'
          : isFlowWorkspace
            ? 'Accounting flow for gross payments, platform revenue, Partner payable, wallet liability, tax, and reconciliation.'
            : 'Bounded Finance action queues linked to their source evidence pages.'
      }
      title="Finance Overview"
    >
      <AdminFilterPanel
        actions={
          <>
            <StatusBadge tone="success">Read-only</StatusBadge>
            <StatusBadge tone="info">{rangeLabel}</StatusBadge>
          </>
        }
        className="finance-overview-filter-panel"
        description="This page reads summary APIs only. Row-level evidence stays in bounded Finance/Tax lists."
        resultLabel={`${workspaceLabel} · ${filters.period}`}
        title="Finance range"
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
              label: 'Command',
              value: 'command',
            },
            {
              href: financeOverviewHref(filters.range, {
                period: filters.period,
                workspace: 'flow',
              }),
              label: 'Money flow',
              value: 'flow',
            },
            {
              href: financeOverviewHref(filters.range, {
                period: filters.period,
                workspace: 'queues',
              }),
              label: 'Action queues',
              value: 'queues',
            },
          ]}
        />
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
        />
        <FinancePeriodFilterForm
          action="/finance-overview"
          className="finance-overview-period-form"
          hiddenFields={[
            { name: 'range', value: filters.range },
            ...(filters.workspace === 'command' ? [] : [{ name: 'view', value: filters.workspace }]),
          ]}
          period={filters.period}
          periodLabel="Monthly tax period"
        />
        <AdminFilterSummary
          ariaLabel="Active finance overview filters"
          labels={[`Workspace: ${workspaceLabel}`, `Range: ${rangeLabel}`, `Period: ${filters.period}`]}
          tone="info"
        />
      </AdminFilterPanel>

      {isCommandWorkspace ? (
        <>
          <AdminSection
            bodyClassName="finance-overview-sla-grid"
            className="finance-overview-sla-section"
            description="Current 48-hour review backlog and resolved audit evidence stay separate."
            statusLabel={
              overviewInput.financeReviewSlaSummary.openOver72Count > 0
                ? `${overviewInput.financeReviewSlaSummary.openOver72Count} critical`
                : overviewInput.financeReviewSlaSummary.open48To72Count > 0
                  ? `${overviewInput.financeReviewSlaSummary.open48To72Count} approaching 72h`
                  : 'SLA clear'
            }
            statusTone={
              overviewInput.financeReviewSlaSummary.openOver72Count > 0
                ? 'danger'
                : overviewInput.financeReviewSlaSummary.open48To72Count > 0
                  ? 'warning'
                  : 'success'
            }
            title="Finance Review SLA"
          >
            {reviewSlaMetrics.map((metric) => (
              <FinanceReviewSlaCard key={metric.label} metric={metric} rangeLabel={rangeLabel} />
            ))}
          </AdminSection>

          <AdminSection
            bodyClassName="finance-overview-priority-grid"
            className="finance-overview-priority-board"
            description="Top finance queues stay above the KPI wall so operators see risk first."
            statusLabel={priorityItems.length > 0 ? `${priorityItems.length} need review` : 'All clear'}
            statusTone={priorityItems.length > 0 ? 'warning' : 'success'}
            title="Finance Priority Desk"
          >
            {priorityDeskItems.map((item) => (
              <FinancePriorityItem item={item} key={item.label} />
            ))}
          </AdminSection>

          <AdminOverviewCommandGrid
            ariaLabel="Finance control board"
            baseClassName={financeOverviewCommandGridClassName}
            className="finance-overview-control-board"
          >
            {controlMetrics.map((metric) => (
              <FinanceControlMetricCard key={metric.label} metric={metric} rangeLabel={rangeLabel} />
            ))}
          </AdminOverviewCommandGrid>

          <AdminSection
            bodyClassName="finance-overview-kpi-grid"
            className="finance-overview-kpi-section"
            description="Six top-level signals. Detailed wallet, refund, tax, and settlement evidence stays in Money flow."
            statusLabel={`${primaryKpis.length} signals`}
            title="Core Finance KPI"
          >
            {primaryKpis.map((kpi) => (
              <FinanceKpiCard key={kpi.label} kpi={kpi} rangeLabel={rangeLabel} />
            ))}
          </AdminSection>
        </>
      ) : null}

      {isFlowWorkspace ? (
        <>
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
                label={card.label}
                value={card.value}
              />
            ))}
          </AdminOverviewCommandGrid>

          <AdminOverviewCommandGrid
            ariaLabel="Finance overview sections"
            baseClassName={financeOverviewCommandGridClassName}
            className="finance-overview-section-grid"
          >
            {sections.map((section) => (
              <FinanceOverviewSectionCard key={section.title} section={section} />
            ))}
          </AdminOverviewCommandGrid>
        </>
      ) : null}

      {filters.workspace === 'queues' ? (
        <AdminSection
          actions={<AlertTriangle size={18} aria-hidden="true" />}
          bodyClassName="finance-overview-action-list"
          className="finance-overview-action-card"
          description="Top finance queues. Each link opens a bounded evidence list instead of pulling all rows into this overview."
          statusLabel={`${visibleActionItems.length} queues`}
          title="Finance Action Lists"
        >
          {visibleActionItems.map((item) => (
            <FinanceActionItem key={item.label} item={item} />
          ))}
        </AdminSection>
      ) : null}
    </AdminPageTemplate>
  );
}

function FinanceControlMetricCard({
  metric,
  rangeLabel,
}: {
  readonly metric: FinanceOverviewControlMetric;
  readonly rangeLabel: string;
}) {
  const Icon = financeControlMetricIcons[metric.label] ?? ShieldCheck;
  const meta = financeOverviewControlMetricMeta(metric, rangeLabel);

  return (
    <AdminOverviewCommandCard
      baseClassName={financeOverviewCommandCardClassName}
      className={`finance-overview-control-card is-${metric.tone}`}
      detail={metric.detail}
      href={metric.href}
      icon={<Icon size={18} aria-hidden="true" />}
      iconClassName={financeOverviewCommandIconClassName}
      kind={meta.kind}
      label={metric.label}
      scope={meta.scope}
      value={<FinanceControlMetricValue metric={metric} />}
    />
  );
}

function FinanceControlMetricValue({ metric }: { readonly metric: FinanceOverviewControlMetric }) {
  return metric.amount === undefined ? (
    metric.value ?? 'Not set'
  ) : (
    <MoneyText amount={metric.amount} currency={metric.currency ?? 'VND'} />
  );
}

function FinanceKpiCard({ kpi, rangeLabel }: { readonly kpi: FinanceOverviewKpi; readonly rangeLabel: string }) {
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

function FinanceReviewSlaCard({
  metric,
  rangeLabel,
}: {
  readonly metric: FinanceOverviewKpi;
  readonly rangeLabel: string;
}) {
  const isOpen = metric.label.startsWith('Open ');
  const hasOpenOverdue = isOpen && (metric.tone === 'danger' || metric.tone === 'warning');

  return (
    <AdminKpiCard
      className={`finance-overview-kpi-card finance-overview-sla-card is-${metric.tone}`}
      href={metric.href}
      helper={metric.detail}
      icon={isOpen ? Clock3 : CircleCheckBig}
      iconSize={18}
      kind={metric.tone === 'danger' ? 'risk' : hasOpenOverdue ? 'action' : isOpen ? 'live' : 'record'}
      label={metric.label}
      scope={hasOpenOverdue ? 'Needs action' : isOpen ? 'Current queue' : rangeLabel}
      value={metric.value ?? '0'}
    />
  );
}

function financeOverviewKpiMeta(label: string, rangeLabel: string) {
  if (label === 'Partner Payout Pending') {
    return { kind: 'action', scope: 'Pending' } as const;
  }

  if (label === 'Payment Failed Amount' || label === 'Reconciliation Issues') {
    return { kind: 'risk', scope: 'Needs action' } as const;
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

function financeOverviewControlMetricMeta(metric: FinanceOverviewControlMetric, rangeLabel: string) {
  if (metric.label === 'Withdrawal matching') {
    if (metric.tone === 'danger') return { kind: 'risk', scope: 'Needs action' } as const;
    if (metric.tone === 'warning') return { kind: 'action', scope: 'Pending' } as const;
    return { kind: 'live', scope: 'Current queue' } as const;
  }

  if (metric.label === 'Open finance risks' || metric.label === 'Wallet exposure') {
    return metric.tone === 'success'
      ? ({ kind: 'live', scope: 'Current queue' } as const)
      : ({ kind: 'risk', scope: 'Needs action' } as const);
  }

  if (metric.label === 'Monthly close status') {
    return metric.value === 'CLOSED'
      ? ({ kind: 'record', scope: 'This month' } as const)
      : ({ kind: 'action', scope: 'Pending' } as const);
  }

  return { kind: 'period', scope: rangeLabel } as const;
}

function FinanceOverviewSectionCard({ section }: { readonly section: FinanceOverviewSection }) {
  const Icon = financeSectionIcons[section.title] ?? CircleDollarSign;

  return (
    <AdminSection
      actions={<Icon size={18} aria-hidden="true" />}
      bodyClassName="finance-overview-row-list"
      className={`finance-overview-section-card is-${section.tone}`}
      description={section.description}
      title={section.title}
    >
      {section.rows.map((row) => {
        const body = (
          <>
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
            <FinanceOverviewSectionRowValue row={row} />
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
    </AdminSection>
  );
}

function FinanceActionItem({ item }: { readonly item: FinanceOverviewActionItem }) {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'warning' ? FileWarning : ShieldCheck;
  const meta = financeOverviewActionItemMeta(item);

  return (
    <AdminOverviewCommandCard
      baseClassName="finance-overview-action-item"
      className={`is-${item.tone}`}
      detail={item.detail}
      href={item.href}
      icon={<Icon size={17} aria-hidden="true" />}
      iconClassName="finance-overview-action-icon"
      kind={meta.kind}
      label={item.label}
      scope={meta.scope}
      trailing={<FinanceActionAmount item={item} />}
      value={item.countLabel}
    />
  );
}

function FinancePriorityItem({ item }: { readonly item: FinanceOverviewActionItem }) {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'warning' ? FileWarning : ShieldCheck;
  const meta = financeOverviewActionItemMeta(item);

  return (
    <AdminOverviewCommandCard
      baseClassName={financeOverviewCommandCardClassName}
      className={`finance-overview-priority-card is-${item.tone}`}
      detail={item.detail}
      href={item.href}
      icon={<Icon size={18} aria-hidden="true" />}
      iconClassName={financeOverviewCommandIconClassName}
      kind={meta.kind}
      label={item.label}
      scope={meta.scope}
      trailing={<FinanceActionAmount item={item} />}
      value={item.countLabel}
    />
  );
}

function financeOverviewActionItemMeta(item: FinanceOverviewActionItem) {
  if (
    item.label === 'Finance reviews over 72h' ||
    item.label === 'Payment clearing open' ||
    item.label === 'Bank reconciliation unmatched' ||
    item.label === 'Cash debt recovery' ||
    item.label === 'Tax and closeout review'
  ) {
    return item.tone === 'success'
      ? ({ kind: 'live', scope: 'Current queue' } as const)
      : ({ kind: 'risk', scope: 'Needs action' } as const);
  }

  if (item.label === 'General ledger audit') {
    return { kind: 'record', scope: 'All records' } as const;
  }

  return item.tone === 'success'
    ? ({ kind: 'live', scope: 'Current queue' } as const)
    : ({ kind: 'action', scope: 'Pending' } as const);
}

function FinanceActionAmount({ item }: { readonly item: FinanceOverviewActionItem }) {
  return (
    <em>
      {item.amount === undefined ? (
        item.amountLabel ?? 'Not set'
      ) : (
        <MoneyText amount={item.amount} currency={item.currency ?? 'VND'} />
      )}
    </em>
  );
}

function FinanceOverviewMetricValue({ metric }: { readonly metric: FinanceOverviewKpi }) {
  return metric.amount === undefined ? (
    metric.value ?? 'Not set'
  ) : (
    <MoneyText amount={metric.amount} currency={metric.currency ?? 'VND'} />
  );
}

function FinanceOverviewSectionRowValue({ row }: { readonly row: FinanceOverviewSectionRow }) {
  return (
    <span>
      {row.amount === undefined ? (
        row.value ?? 'Not set'
      ) : (
        <MoneyText amount={row.amount} currency={row.currency ?? 'VND'} />
      )}
    </span>
  );
}

const financeKpiIcons: Record<string, typeof CircleDollarSign> = {
  'Cash Pending Amount': Banknote,
  'Customer Wallet Liability': WalletCards,
  'Gross Booking Amount': CircleDollarSign,
  'Negative Partner Wallet': AlertTriangle,
  'Net Platform Revenue Estimate': ShieldCheck,
  'Partner Payout Pending': WalletCards,
  'Payment Failed Amount': CreditCard,
  'Platform Fee': ReceiptText,
  'Reconciliation Issues': FileWarning,
  'Refund Pending Amount': FileWarning,
  'Tax Info Missing Partners': Landmark,
  'Withdrawal Payable': Landmark,
};

const financeControlMetricIcons: Record<string, typeof CircleDollarSign> = {
  'Monthly close status': ShieldCheck,
  'Open finance risks': AlertTriangle,
  'Revenue separation': ReceiptText,
  'Wallet exposure': WalletCards,
  'Withdrawal matching': Landmark,
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
