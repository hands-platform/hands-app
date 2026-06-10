import Link from 'next/link';
import {
  type AdminCashSettlementSummary,
  type AdminEarning,
  type AdminOperationalPolicySetting,
  adminGet,
} from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { formatMoney } from '../../lib/admin-format';
import { dateRangeLabel, isInDateRange, readSearchParam } from '../../lib/date-range';
import { buildAdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { settleCashFeeDebt } from './actions';
import { buildCashSettlementConfirmation } from './cash-settlement-action-confirmation';
import { CashSettlementOpenDebtTableSection } from './cash-settlement-open-debt-table-section';
import { CashSettlementPriorityBoardSection } from './cash-settlement-priority-board-section';
import {
  buildCommandCards,
  buildCashSettlementExecutionDesk,
  buildDebtCauseCards,
} from './cash-settlement-page-command-cards';
import {
  buildCashSettlementFilters,
  cashSettlementHref,
  cashSettlementQueueLabel,
} from './cash-settlement-page-filters';
import { buildCashSettlementPriorityBoard, buildCashSettlementPriorityBoardRows } from './cash-settlement-page-priority';
import { buildAppliedCashSettlementPolicyCards, buildCashSettlementRuleCards } from './cash-settlement-page-rule-cards';
import {
  applyCashSettlementRowFilters,
  buildCashSettlementOpenDebtTableRows,
  buildCashSettlementRows,
} from './cash-settlement-page-rows';
import { buildProviderGroups, buildSummary, mergeAuthoritativeSummary } from './cash-settlement-page-summary';
import { cashSettlementQueueOptions } from './cash-settlement-page-types';
import {
  buildCashSettlementEvidenceChecklist,
  buildCashSettlementHandoffMap,
  buildWalletRecoverySteps,
} from './cash-settlement-page-workflow-cards';

type CashSettlementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildCashSettlementFilters(params);
  const [earnings, apiSummary, policySettings] = await Promise.all([
    adminGet<AdminEarning[]>('/admin/cash-settlement-earnings', []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const allRowsInRange = buildCashSettlementRows(filteredEarnings);
  const rows = applyCashSettlementRowFilters(allRowsInRange, filters);
  const providers = buildProviderGroups(rows);
  const visibleSummary = buildSummary(rows, providers);
  const summary =
    filters.range === 'all' && filters.queue === 'all' && !filters.q
      ? mergeAuthoritativeSummary(visibleSummary, apiSummary)
      : visibleSummary;
  const debtCauseCards = buildDebtCauseCards(rows, summary);
  const settlementRuleCards = buildCashSettlementRuleCards(summary);
  const recoverySteps = buildWalletRecoverySteps(rows, providers, summary);
  const settlementHandoff = buildCashSettlementHandoffMap(rows, providers, summary);
  const commandCards = buildCommandCards(rows, providers, summary);
  const evidenceChecklist = buildCashSettlementEvidenceChecklist(rows, providers, summary);
  const executionDesk = buildCashSettlementExecutionDesk(rows, providers, summary);
  const priorityBoard = buildCashSettlementPriorityBoard(rows);
  const priorityBoardRows = buildCashSettlementPriorityBoardRows(priorityBoard);
  const openDebtRows = buildCashSettlementOpenDebtTableRows(rows);
  const liveOperationsPolicy = buildAdminLiveOperationsPolicy(policySettings);
  const appliedCashSettlementPolicyCards = buildAppliedCashSettlementPolicyCards(liveOperationsPolicy);
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
        { label: 'Cash debt partners', value: summary.providerCount, helper: 'Partners with open cash-fee debt rows.' },
        { label: 'Open debt rows', value: summary.rowCount, helper: 'Visible settlement rows after filters.' },
        { label: 'Total wallet debt', value: formatMoney(summary.debtAmount, summary.currency), helper: 'Company fee or tax still owed to HANDS.' },
        { label: 'HANDS fee', value: formatMoney(summary.platformFee, summary.currency), helper: 'Platform fee portion of cash debt.' },
        { label: 'Tax withholding', value: formatMoney(summary.taxAmount, summary.currency), helper: 'Tax portion of cash debt.' },
        { label: 'Oldest open', value: summary.oldestOpenLabel, helper: 'Oldest visible settlement row.' },
        { label: 'Over 24h', value: summary.staleDebtRowCount, helper: 'Rows older than 24 hours.' },
        {
          label: 'Payment evidence',
          value: summary.missingPaymentEvidenceCount ? `${summary.missingPaymentEvidenceCount} check` : 'OK',
          helper: 'Rows needing payment evidence review.',
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

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <AdminSectionHeader
          actions={
            <Link className="text-link" href="/finance-closeout">
              Open finance closeout
            </Link>
          }
          description={
            <>
              Range: {dateRangeLabel(filters.range)}. All date-filtered totals are calculated from visible
              cash earning records; all-date totals use the API summary.
            </>
          }
          title="Cash settlement date range"
        />
        <div className="filter-row" style={{ marginTop: 12 }}>
          {[
            ['All dates', cashSettlementHref({ range: 'all', queue: filters.queue, q: filters.q })],
            ['Today', cashSettlementHref({ range: 'today', queue: filters.queue, q: filters.q })],
            ['Last 7 days', cashSettlementHref({ range: '7d', queue: filters.queue, q: filters.q })],
            ['Last 30 days', cashSettlementHref({ range: '30d', queue: filters.queue, q: filters.q })],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
        <form className="inline-form" style={{ marginTop: 12 }} action="/cash-settlements">
          <input type="hidden" name="range" value={filters.range} />
          <input
            aria-label="Search cash settlement queue"
            name="q"
            defaultValue={filters.q}
            placeholder="Partner, phone, booking, reference"
          />
          <select aria-label="Cash settlement queue" name="queue" defaultValue={filters.queue}>
            <option value="all">All open debt</option>
            <option value="stale">Over 24h</option>
            <option value="high-debt">High debt</option>
            <option value="missing-ref">No recorded ref</option>
            <option value="payment-check">Payment evidence check</option>
          </select>
          <button type="submit">Apply</button>
          <Link className="text-link" href="/cash-settlements">
            Clear
          </Link>
        </form>
        <div className="filter-row" style={{ marginTop: 12 }}>
          {cashSettlementQueueOptions.map((option) => (
            <Link
              className="filter-pill"
              href={cashSettlementHref({ range: filters.range, queue: option.value, q: filters.q })}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Showing {rows.length} of {allRowsInRange.length} open cash debt row(s) for this date range.
          {filters.q ? ` Search: "${filters.q}".` : ''}{' '}
          {filters.queue !== 'all' ? `Queue: ${cashSettlementQueueLabel(filters.queue)}.` : ''}
        </p>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Cash settlement execution desk</h2>
            <p className="muted">
              Operator-first view for clearing partner cash-fee debt. It does not judge partner quality; it
              only shows what must be evidenced before final acceptance, service start, and payout release reopen.
            </p>
          </div>
          <Link className="text-link" href="/audit-log?bucket=Finance%2FCloseout">
            Audit evidence
          </Link>
        </div>
        <div className="ops-task-grid">
          {executionDesk.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <div>
                <span className={`pill ${card.pillClass}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
        <div className="ops-section-header" style={{ marginTop: 16 }}>
          <div>
            <h3>Settlement priority board</h3>
            <p className="muted">
              Sort order is amount first, then age. Confirm bank deposit evidence or a documented admin
              offset before pressing the settlement action on a row.
            </p>
          </div>
          <Link className="text-link" href="/cash-settlements?queue=high-debt">
            High debt queue
          </Link>
        </div>
        <CashSettlementPriorityBoardSection rows={priorityBoardRows} />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Cash fee operating rules</h2>
            <p className="muted">
              Use this as the first read before finance calls a partner or clears a wallet. The rule is
              factual: cash fee debt gates final acceptance, service start, and payout release, not customer
              access or account status.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy?review=wallet">
            Wallet policy
          </Link>
        </div>
        <div className="ops-section-header" style={{ marginTop: 14 }}>
          <div>
            <h3>Applied operations policy</h3>
            <p className="muted">
              Live Admin policy values used by finance before clearing Partner cash-fee debt and reopening
              final acceptance, service start, and payout release.
            </p>
          </div>
          <span className="pill pill-info">Live policy default</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {appliedCashSettlementPolicyCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid">
          {settlementRuleCards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <div>
                <span className={`pill ${card.pillClass}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Debt cause board</h2>
            <p className="muted">
              Factual breakdown of why partner wallets are negative. Use this before contacting a partner or
              approving an admin offset.
            </p>
          </div>
          <Link className="text-link" href="/payments?review=cash-debt">
            Review cash payments
          </Link>
        </div>
        <div className="ops-task-grid">
          {debtCauseCards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <div>
                <span className={`pill ${card.pillClass}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Cash fee settlement workflow</h2>
            <p className="muted">
              Standard operating flow for reopening final acceptance, service start, and payout release after cash-fee debt is paid
              or offset. This does not track blocked marketplace attempts.
            </p>
          </div>
          <Link className="text-link" href="/partner-controls?review=cash-debt">
            Open partner controls
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {recoverySteps.map((step) => (
            <div className="setup-stage-item" key={step.title}>
              <span className={`pill ${step.pillClass}`}>{step.status}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <small>{step.operatorRule}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Cash settlement handoff map</h2>
            <p className="muted">
              Follow a cash booking from customer payment evidence to partner wallet reopening and payout
              release. Marketplace viewing attempts are not tracked; actual marketplace participants remain
              on the booking record.
            </p>
          </div>
          <Link className="text-link" href="/bookings?view=cash-debt">
            Booking cash debt queue
          </Link>
        </div>
        <div className="ops-task-grid">
          {settlementHandoff.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Settlement command queue</h2>
            <p className="muted">
              Work from the highest debt and oldest debt first. Every settlement needs an auditable reference
              before the partner wallet can reopen.
            </p>
          </div>
          <Link className="text-link" href="/earnings">
            Open earnings
          </Link>
        </div>
        <div className="ops-task-grid">
          {commandCards.map((card) => (
            <div className={`ops-task-card ${card.className}`} key={card.title}>
              <div>
                <span className={`pill ${card.pillClass}`}>{card.status}</span>
                <h3>{card.title}</h3>
                <p className="muted">{card.detail}</p>
              </div>
              <small>{card.action}</small>
            </div>
          ))}
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Cash settlement evidence checklist</h2>
            <p className="muted">
              Operator checklist for cash bookings where the Partner collected customer cash and HANDS is
              waiting for a company-fee deposit or approved offset.
            </p>
          </div>
          <Link className="text-link" href="/bookings?view=cash-debt">
            Booking cash debt queue
          </Link>
        </div>
        <div className="ops-task-grid">
          {evidenceChecklist.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
              <div>
                <span className={`pill ${item.pillClass}`}>{item.status}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.operatorRule}</small>
            </Link>
          ))}
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner wallet debt groups</h2>
            <p className="muted">
              Partner-level view for deciding whether to collect a direct deposit or approve an offset against
              later positive earnings.
            </p>
          </div>
          <Link className="text-link" href="/partner-controls">
            Partner controls
          </Link>
        </div>
        {providers.length ? (
          <div className="detail-grid" style={{ marginTop: 16 }}>
            {providers.map((provider) => (
              <div key={provider.providerProfileId}>
                <div className="ops-section-header">
                  <h3>{provider.providerName}</h3>
                  <span className="pill pill-danger">
                    {formatMoney(provider.debtAmount, provider.currency)}
                  </span>
                </div>
                <p className="muted">
                  {provider.rowCount} open cash debt row(s),{' '}
                  {formatMoney(provider.platformFee, provider.currency)} HANDS fee,{' '}
                  {formatMoney(provider.taxAmount, provider.currency)} tax.
                </p>
                <div className="participant-list" style={{ marginTop: 8 }}>
                  <Link className="pill" href={`/partners/${provider.providerProfileId}`}>
                    Partner
                  </Link>
                  <span className="pill pill-warn">Suggested ref {provider.settlementReference}</span>
                  <span className="pill pill-info">{provider.oldestOpenLabel}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No partner has open cash settlement debt.</p>
        )}
      </div>

      <CashSettlementOpenDebtTableSection rows={openDebtRows} />
    </AdminPageTemplate>
  );
}
