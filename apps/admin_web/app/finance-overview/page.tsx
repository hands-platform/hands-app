import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
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
import { formatMoney } from '../../lib/admin-format';
import { AdminCard, AdminSection } from '../../components/admin-surface';
import { FinancePeriodFilterForm } from '../finance-tax/finance-period-filter-form';
import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewControlMetrics,
  buildFinanceOverviewFilters,
  buildFinanceOverviewPrimaryKpis,
  buildFinanceOverviewRangeLabel,
  buildFinanceOverviewSections,
  emptyFinanceOverviewSummaries,
  financeOverviewSummaryInput,
  financeOverviewHref,
  financeOverviewRangeOptions,
  type FinanceOverviewActionItem,
  type FinanceOverviewControlMetric,
  type FinanceOverviewKpi,
  type FinanceOverviewSection,
} from './finance-overview-model';

export const dynamic = 'force-dynamic';

type FinanceOverviewPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceOverviewPage({
  searchParams,
}: {
  readonly searchParams?: FinanceOverviewPageSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = buildFinanceOverviewFilters(params);
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
  const controlMetrics = buildFinanceOverviewControlMetrics(overviewInput);
  const primaryKpis = buildFinanceOverviewPrimaryKpis(overviewInput);
  const sections = buildFinanceOverviewSections(overviewInput);
  const actionItems = buildFinanceOverviewActionItems(overviewInput, filters.range);
  const priorityItems = actionItems.filter((item) => item.tone === 'danger' || item.tone === 'warning');
  const priorityDeskItems = priorityItems.length > 0 ? priorityItems.slice(0, 4) : actionItems.slice(0, 4);
  const netRevenueEstimate =
    settlementSummary.platformFeeNetRevenue -
    couponSummary.companyCouponExpense -
    settlementSummary.paymentProcessingFee;

  return (
    <div className="usage-overview-page finance-overview-page">
      <section className="toolbar">
        <div>
          <h1>Finance Overview</h1>
          <p className="muted">
            Money-flow command view for gross payments, platform-fee revenue, Partner payable,
            wallet liability, refunds, tax, and reconciliation risk.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">Read-only</span>
          <span className="pill pill-info">{buildFinanceOverviewRangeLabel(filters.range)}</span>
        </div>
      </section>

      <AdminSection
        className="usage-overview-filter-panel finance-overview-filter-panel"
        description="This page reads summary APIs only. Row-level evidence stays in bounded Finance/Tax lists."
        statusLabel={`Period ${filters.period}`}
        title="Finance range"
      >
        <div className="booking-date-filter-buttons usage-overview-range-buttons">
          {financeOverviewRangeOptions.map((option) => (
            <a
              key={option.value}
              className={`booking-date-filter-button${option.value === filters.range ? ' is-active' : ''}`}
              href={financeOverviewHref(option.value)}
            >
              {option.label}
            </a>
          ))}
        </div>
        <FinancePeriodFilterForm
          action="/finance-overview"
          className="finance-overview-period-form"
          hiddenFields={[{ name: 'range', value: filters.range }]}
          period={filters.period}
          periodLabel="Monthly tax period"
        />
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

      <section className="finance-overview-control-board" aria-label="Finance control board">
        {controlMetrics.map((metric) => (
          <FinanceControlMetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="finance-overview-principle-grid" aria-label="Finance accounting principles">
        <AdminCard className="finance-overview-principle-card is-primary">
          <span className="usage-overview-command-icon">
            <CircleDollarSign size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Gross customer payment</span>
            <strong>{formatMoney(settlementSummary.customerPaymentAmount, settlementSummary.currency)}</strong>
            <small>Customer paid amount is not company revenue.</small>
          </div>
        </AdminCard>
        <AdminCard className="finance-overview-principle-card is-success">
          <span className="usage-overview-command-icon">
            <ReceiptText size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Actual company revenue</span>
            <strong>{formatMoney(settlementSummary.platformFeeNetRevenue, settlementSummary.currency)}</strong>
            <small>Platform fee net revenue is the revenue base.</small>
          </div>
        </AdminCard>
        <AdminCard className="finance-overview-principle-card is-warning">
          <span className="usage-overview-command-icon">
            <WalletCards size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Partner payable</span>
            <strong>{formatMoney(settlementSummary.partnerPayoutAmount, settlementSummary.currency)}</strong>
            <small>Partner payout stays payable until payout or withdrawal closeout.</small>
          </div>
        </AdminCard>
        <AdminCard className="finance-overview-principle-card is-info">
          <span className="usage-overview-command-icon">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <div>
            <span>Net estimate</span>
            <strong>{formatMoney(netRevenueEstimate, settlementSummary.currency)}</strong>
            <small>Net revenue estimate excludes gross pass-through payment volume.</small>
          </div>
        </AdminCard>
      </section>

      <AdminSection
        bodyClassName="usage-overview-command-grid finance-overview-kpi-grid"
        className="finance-overview-kpi-section"
        description="Six top-level signals. Detailed wallet, refund, tax, and settlement evidence remains below."
        statusLabel={`${primaryKpis.length} signals`}
        title="Core Finance KPI"
      >
        {primaryKpis.map((kpi) => (
          <FinanceKpiCard key={kpi.label} kpi={kpi} />
        ))}
      </AdminSection>

      <section className="finance-overview-section-grid" aria-label="Finance overview sections">
        {sections.map((section) => (
          <FinanceOverviewSectionCard key={section.title} section={section} />
        ))}
      </section>

      <AdminSection
        actions={<AlertTriangle size={18} aria-hidden="true" />}
        bodyClassName="usage-overview-action-list finance-overview-action-list"
        className="usage-overview-action-card finance-overview-action-card"
        description="Today-first finance queues. Each link opens a bounded evidence list instead of pulling all rows into this overview."
        title="Finance Action Lists"
      >
        {actionItems.map((item) => (
          <FinanceActionItem key={item.label} item={item} />
        ))}
      </AdminSection>
    </div>
  );
}

function FinanceControlMetricCard({ metric }: { readonly metric: FinanceOverviewControlMetric }) {
  const Icon = financeControlMetricIcons[metric.label] ?? ShieldCheck;

  return (
    <a className={`card admin-card finance-overview-control-card is-${metric.tone}`} href={metric.href}>
      <span className="usage-overview-command-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{metric.label}</span>
        <strong>{metric.value}</strong>
        <small>{metric.detail}</small>
      </div>
    </a>
  );
}

function FinanceKpiCard({ kpi }: { readonly kpi: FinanceOverviewKpi }) {
  const Icon = financeKpiIcons[kpi.label] ?? CircleDollarSign;
  const body = (
    <>
      <span className="usage-overview-command-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{kpi.label}</span>
        <strong>{kpi.value}</strong>
        <small>{kpi.detail}</small>
      </div>
    </>
  );

  if (kpi.href) {
    return (
      <a className={`card admin-card usage-overview-command-card is-${kpi.tone}`} href={kpi.href}>
        {body}
      </a>
    );
  }

  return <article className={`card admin-card usage-overview-command-card is-${kpi.tone}`}>{body}</article>;
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
            <span>{row.value}</span>
          </>
        );

        return row.href ? (
          <a className="finance-overview-row" href={row.href} key={row.label}>
            {body}
          </a>
        ) : (
          <div className="finance-overview-row" key={row.label}>
            {body}
          </div>
        );
      })}
    </AdminSection>
  );
}

function FinanceActionItem({ item }: { readonly item: FinanceOverviewActionItem }) {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'warning' ? FileWarning : ShieldCheck;

  return (
    <a className={`card admin-card usage-overview-action-item is-${item.tone}`} href={item.href}>
      <span className="usage-overview-command-icon">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div>
        <span>{item.label}</span>
        <strong>{item.countLabel}</strong>
        <small>{item.detail}</small>
      </div>
      <em>{item.amountLabel}</em>
    </a>
  );
}

function FinancePriorityItem({ item }: { readonly item: FinanceOverviewActionItem }) {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'warning' ? FileWarning : ShieldCheck;

  return (
    <a
      className={`card admin-card usage-overview-command-card finance-overview-priority-card is-${item.tone}`}
      href={item.href}
    >
      <span className="usage-overview-command-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <span>{item.label}</span>
        <strong>{item.countLabel}</strong>
        <small>{item.detail}</small>
      </div>
      <em>{item.amountLabel}</em>
    </a>
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
  'Monthly close readiness': ShieldCheck,
  'Open finance risks': AlertTriangle,
  'Revenue separation': ReceiptText,
  'Wallet exposure': WalletCards,
};

const financeSectionIcons: Record<string, typeof CircleDollarSign> = {
  'Cash Payment / Receivable': Banknote,
  'Partner Settlement': WalletCards,
  'Payment Method Health': CreditCard,
  Reconciliation: FileWarning,
  'Refund & Dispute': AlertTriangle,
  'Revenue & Platform Fee': ReceiptText,
  'Tax Overview': Landmark,
  'Wallet Liability': WalletCards,
};
