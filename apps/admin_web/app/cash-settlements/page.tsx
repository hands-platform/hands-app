import Link from 'next/link';
import { AdminCashSettlementSummary, AdminEarning, adminGet } from '../../lib/admin-api';
import {
  type AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import { settleCashFeeDebt } from './actions';

type CashSettlementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CashSettlementsPage({ searchParams }: CashSettlementsPageProps) {
  const filters = buildCashSettlementFilters(searchParams ? await searchParams : {});
  const [earnings, apiSummary] = await Promise.all([
    adminGet<AdminEarning[]>('/admin/cash-settlement-earnings', []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
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
  const recoverySteps = buildWalletRecoverySteps(rows, providers, summary);
  const settlementHandoff = buildCashSettlementHandoffMap(rows, providers, summary);
  const commandCards = buildCommandCards(rows, providers, summary);
  const evidenceChecklist = buildCashSettlementEvidenceChecklist(rows, providers, summary);

  return (
    <>
      <h1>Cash Settlements</h1>
      <p className="muted">
        Finance queue for cash bookings where the partner collected customer cash and still owes HANDS
        platform fee or withholding. This page focuses on why the wallet became negative, whether the
        company-fee deposit or approved offset has evidence, and when marketplace participation can reopen.
        Wallet-blocked partners who only viewed the marketplace list are not tracked here.
      </p>

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash settlement date range</h2>
            <p className="muted">
              Range: {dateRangeLabel(filters.range)}. All date-filtered totals are calculated from visible
              cash earning records; all-date totals use the API summary.
            </p>
          </div>
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        </div>
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

      <section className="grid" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="card">
          <p>Blocked partners</p>
          <h2>{summary.providerCount}</h2>
        </div>
        <div className="card">
          <p>Open debt rows</p>
          <h2>{summary.rowCount}</h2>
        </div>
        <div className="card">
          <p>Total wallet debt</p>
          <h2>{formatMoney(summary.debtAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>HANDS fee</p>
          <h2>{formatMoney(summary.platformFee, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Tax withholding</p>
          <h2>{formatMoney(summary.taxAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Oldest open</p>
          <h2>{summary.oldestOpenLabel}</h2>
        </div>
        <div className="card">
          <p>Over 24h</p>
          <h2>{summary.staleDebtRowCount}</h2>
        </div>
        <div className="card">
          <p>Payment evidence</p>
          <h2>
            {summary.missingPaymentEvidenceCount ? `${summary.missingPaymentEvidenceCount} check` : 'OK'}
          </h2>
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
          <div>
            <h2>Wallet recovery workflow</h2>
            <p className="muted">
              Standard operating flow for reopening marketplace participation after cash-fee debt is paid
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
                <div className="risk-watch-header">
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Open cash fee debt rows</h2>
            <p className="muted">
              Settle only after confirming a partner deposit or a documented admin offset. The backend rejects
              missing references.
            </p>
          </div>
          <Link className="text-link" href="/payments?review=cash-debt">
            Payment debt view
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Debt</th>
              <th>Fee / Tax</th>
              <th>Evidence</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.earning.id}>
                <td>
                  <strong>{row.providerName}</strong>
                  <div className="muted">{row.providerPhone}</div>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    <Link className="pill" href={`/partners/${row.earning.providerProfileId}`}>
                      Partner
                    </Link>
                    <span className="pill pill-danger">Wallet blocked</span>
                  </div>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${row.earning.bookingId}`}>
                    {shortId(row.earning.bookingId)}
                  </Link>
                  <div className="muted">{row.createdAtLabel}</div>
                  <div className="muted">{row.serviceLabel}</div>
                </td>
                <td>
                  <strong>{formatMoney(row.debtAmount, row.earning.currency)}</strong>
                  <div className="muted">
                    Cash collected: {formatMoney(row.bookingAmount, row.earning.currency)}
                  </div>
                  <div className="muted">{row.debtOrigin}</div>
                </td>
                <td>
                  <div>HANDS fee {formatMoney(row.platformFee, row.earning.currency)}</div>
                  <div className="muted">Tax {formatMoney(row.taxAmount, row.earning.currency)}</div>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <small>{row.settlementEvidence}</small>
                    <small>Suggested ref: {row.settlementReference}</small>
                    <small>Payment method: {row.paymentMethod}</small>
                    {row.lastLedgerRef ? <small>Last ledger ref: {row.lastLedgerRef}</small> : null}
                    <small>{row.nextAction}</small>
                  </div>
                  <div className="ops-task-note" style={{ marginTop: 10 }}>
                    <strong>Cash settlement action execution map</strong>
                    <div className="setup-stage-list" style={{ marginTop: 8 }}>
                      {cashSettlementActionExecutionMap(row).map((item) => (
                        <div className="setup-stage-item" key={`${row.earning.id}-${item.action}`}>
                          <span className={`pill ${item.pillClass}`}>{item.status}</span>
                          <div>
                            <strong>{item.action}</strong>
                            <p className="muted">{item.reason}</p>
                            <small>{item.operatorRule}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
                <td>
                  <form action={settleCashFeeDebt} className="inline-form">
                    <input type="hidden" name="earningId" value={row.earning.id} />
                    <input
                      aria-label="Settlement reference"
                      name="settlementRef"
                      placeholder="Bank deposit ref or admin offset"
                      defaultValue={row.settlementReference}
                    />
                    <input
                      aria-label="Settlement notes"
                      name="settlementNotes"
                      placeholder="Evidence note"
                      defaultValue={`Partner deposit or approved offset for ${formatMoney(
                        row.debtAmount,
                        row.earning.currency,
                      )} using ${row.settlementReference}`}
                    />
                    <button type="submit">Confirm deposit / offset</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>No cash fee debt is waiting for settlement.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

type CashSettlementRow = {
  earning: AdminEarning;
  providerName: string;
  providerPhone: string;
  paymentMethod: string;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  bookingAmount: number;
  settlementReference: string;
  lastLedgerRef?: string | null;
  debtOrigin: string;
  settlementEvidence: string;
  serviceLabel: string;
  createdAtLabel: string;
  nextAction: string;
};

type CashSettlementProviderGroup = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  settlementReference: string;
  oldestOpenMs: number;
  oldestOpenLabel: string;
};

type CommandCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type EvidenceChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: string;
  pillClass: string;
};

type CashSettlementHandoffItem = EvidenceChecklistItem;

type CashSettlementActionExecutionItem = {
  action: string;
  status: string;
  reason: string;
  operatorRule: string;
  pillClass: string;
};

type WalletRecoveryStep = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  pillClass: string;
};

type CashSettlementSummary = {
  providerCount: number;
  rowCount: number;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  currency: string;
  oldestOpenLabel: string;
  staleDebtRowCount: number;
  highDebtProviderCount: number;
  missingPaymentEvidenceCount: number;
  cashPaymentRowCount: number;
};

type CashSettlementQueueFilter = 'all' | 'stale' | 'high-debt' | 'missing-ref' | 'payment-check';

type CashSettlementFilters = {
  range: AdminDateRange;
  queue: CashSettlementQueueFilter;
  q: string;
};

const cashSettlementQueueOptions: Array<{ value: CashSettlementQueueFilter; label: string }> = [
  { value: 'all', label: 'All open debt' },
  { value: 'stale', label: 'Over 24h' },
  { value: 'high-debt', label: 'High debt' },
  { value: 'missing-ref', label: 'No recorded ref' },
  { value: 'payment-check', label: 'Payment check' },
];

function buildCashSettlementRows(earnings: AdminEarning[]): CashSettlementRow[] {
  return earnings
    .filter((earning) => isOpenCashDebt(earning))
    .map((earning) => {
      const debtAmount = Math.abs(earning.netAmount);
      const settlementReference = cashSettlementReference(earning);
      return {
        earning,
        providerName: providerDisplayName(earning),
        providerPhone: earning.providerProfile?.user?.phone ?? 'No phone on file',
        paymentMethod: earning.booking?.payment?.method ?? 'CASH',
        debtAmount,
        platformFee: earning.platformFee,
        taxAmount: earning.withholdingAmount ?? 0,
        bookingAmount: earning.booking?.payment?.amount ?? earning.grossAmount,
        settlementReference,
        lastLedgerRef: earning.walletLedgerEntries?.[0]?.reference ?? null,
        debtOrigin: cashDebtOriginLabel(earning),
        settlementEvidence: cashDebtEvidenceLabel(earning),
        serviceLabel: bookingServiceLabel(earning),
        createdAtLabel: earning.createdAt ? relativeTime(earning.createdAt) : 'No created date',
        nextAction: `Confirm partner deposit or approved offset before settling ${settlementReference}.`,
      };
    })
    .sort((left, right) => {
      if (left.debtAmount !== right.debtAmount) {
        return right.debtAmount - left.debtAmount;
      }
      return Date.parse(left.earning.createdAt ?? '') - Date.parse(right.earning.createdAt ?? '');
    });
}

function applyCashSettlementRowFilters(
  rows: CashSettlementRow[],
  filters: CashSettlementFilters,
): CashSettlementRow[] {
  const query = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!cashSettlementRowMatchesQueue(row, filters.queue)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return cashSettlementSearchText(row).includes(query);
  });
}

function cashSettlementRowMatchesQueue(row: CashSettlementRow, queue: CashSettlementQueueFilter) {
  switch (queue) {
    case 'stale':
      return cashSettlementRowAgeHours(row) >= 24;
    case 'high-debt':
      return row.debtAmount >= 500_000;
    case 'missing-ref':
      return !row.earning.settlementRef && !row.lastLedgerRef;
    case 'payment-check':
      return !row.earning.booking?.payment || row.paymentMethod !== 'CASH';
    case 'all':
    default:
      return true;
  }
}

function cashSettlementSearchText(row: CashSettlementRow) {
  return [
    row.providerName,
    row.providerPhone,
    row.earning.providerProfileId,
    row.earning.bookingId,
    row.earning.id,
    row.settlementReference,
    row.earning.settlementRef,
    row.lastLedgerRef,
    row.paymentMethod,
    row.serviceLabel,
    row.debtOrigin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function cashSettlementActionExecutionMap(row: CashSettlementRow): CashSettlementActionExecutionItem[] {
  const hasPaymentEvidence = Boolean(row.earning.booking?.payment);
  const hasReference = Boolean(row.settlementReference);
  const hasLedgerReference = Boolean(row.lastLedgerRef);
  const isOldDebt = cashSettlementRowAgeHours(row) >= 24;

  return [
    {
      action: 'Confirm cash collection',
      status: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'Ready' : 'Check booking',
      reason:
        hasPaymentEvidence && row.paymentMethod === 'CASH'
          ? `Booking payment is marked CASH and customer cash amount is ${formatMoney(
              row.bookingAmount,
              row.earning.currency,
            )}.`
          : 'Payment evidence is missing or the booking payment method is not cash in the current payload.',
      operatorRule: 'Open the booking detail before settlement if the payment method or amount is unclear.',
      pillClass: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'pill-success' : 'pill-warn',
    },
    {
      action: 'Attach settlement reference',
      status: hasReference ? 'Reference ready' : 'Reference needed',
      reason: hasReference
        ? `Use ${row.settlementReference} as the bank deposit or approved offset reference.`
        : 'No suggested settlement reference is available for this debt row.',
      operatorRule: 'The backend requires a reference so finance can audit the wallet reopening decision.',
      pillClass: hasReference ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Settle wallet debt',
      status: row.debtAmount > 0 ? 'Debt open' : 'Clear',
      reason:
        row.debtAmount > 0
          ? `${formatMoney(row.debtAmount, row.earning.currency)} remains as HANDS fee/tax wallet debt.`
          : 'No open wallet debt remains on this earning row.',
      operatorRule:
        'Settle only after deposit evidence or approved offset; marketplace join and payout release stay gated until cleared.',
      pillClass: row.debtAmount > 0 ? 'pill-danger' : 'pill-success',
    },
    {
      action: 'Ledger trace',
      status: hasLedgerReference ? 'Trace exists' : 'No prior trace',
      reason: hasLedgerReference
        ? `Last wallet ledger reference is ${row.lastLedgerRef}.`
        : 'No wallet ledger reference has been recorded yet for this row.',
      operatorRule: 'Keep the booking, payment, earning, and wallet ledger references aligned.',
      pillClass: hasLedgerReference ? 'pill-info' : 'pill-neutral',
    },
    {
      action: 'Aging follow-up',
      status: isOldDebt ? 'Over 24h' : 'Fresh',
      reason: isOldDebt
        ? 'This cash debt has been open longer than 24 hours.'
        : 'This cash debt is still inside the first 24-hour finance follow-up window.',
      operatorRule: isOldDebt
        ? 'Prioritize partner deposit confirmation or admin offset review.'
        : 'Keep in the normal settlement queue.',
      pillClass: isOldDebt ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildWalletRecoverySteps(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): WalletRecoveryStep[] {
  const hasOpenDebt = summary.rowCount > 0;
  const missingEvidenceRows = rows.filter((row) => !row.earning.booking?.payment || row.paymentMethod !== 'CASH');
  const highestDebt = providers[0];

  return [
    {
      title: '1. Confirm why the wallet is negative',
      status: hasOpenDebt ? `${summary.rowCount} open` : 'Clear',
      detail: hasOpenDebt
        ? `${summary.providerCount} partner wallet(s) are negative because cash bookings created ${formatMoney(
            summary.debtAmount,
            summary.currency,
          )} of unpaid HANDS fee or withholding debt.`
        : 'No partner wallet is currently negative because of cash-fee debt.',
      operatorRule:
        'Use booking, payment, earning, and chat evidence. Record facts only; do not turn this into a partner or customer label.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
    },
    {
      title: '2. Collect deposit or approve offset',
      status: missingEvidenceRows.length ? `${missingEvidenceRows.length} check` : 'Evidence ready',
      detail: missingEvidenceRows.length
        ? 'Some rows need payment evidence review before finance should clear the wallet.'
        : 'Visible rows have the minimum booking/payment evidence needed for settlement review.',
      operatorRule:
        'Use a bank transfer reference when the partner pays HANDS, or an admin offset memo when finance deducts from future earnings.',
      pillClass: missingEvidenceRows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: '3. Confirm deposit / offset on the row',
      status: hasOpenDebt ? 'Action needed' : 'No action',
      detail: highestDebt
        ? `Start with ${highestDebt.providerName}, currently ${formatMoney(
            highestDebt.debtAmount,
            highestDebt.currency,
          )} open.`
        : 'There is no open row waiting for confirmation.',
      operatorRule:
        'Submitting the settlement form marks the negative earning paid and creates the wallet ledger trace.',
      pillClass: hasOpenDebt ? 'pill-warn' : 'pill-success',
    },
    {
      title: '4. Reopen marketplace and payout release',
      status: hasOpenDebt ? 'Still gated' : 'Unlocked',
      detail: hasOpenDebt
        ? 'Marketplace join and payout release remain blocked until the partner wallet is no longer negative.'
        : 'Partners with cleared wallets can participate in eligible marketplace bookings and continue payout release checks.',
      operatorRule:
        'Negative-wallet partners may still see marketplace demand. Only actual marketplace join and payout release are gated.',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
    },
  ];
}

function buildCashSettlementHandoffMap(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CashSettlementHandoffItem[] {
  const hasOpenDebt = summary.rowCount > 0;
  const highestDebt = providers[0];
  const rowsWithLedgerRefs = rows.filter((row) => row.lastLedgerRef || row.earning.settlementRef);
  const missingReferenceRows = rows.filter((row) => !row.lastLedgerRef && !row.earning.settlementRef);
  const cashRows = rows.filter((row) => row.paymentMethod === 'CASH');

  return [
    {
      title: 'Cash booking source',
      status: `${summary.cashPaymentRowCount} cash row(s)`,
      detail: cashRows.length
        ? `${formatMoney(
            cashRows.reduce((sum, row) => sum + row.bookingAmount, 0),
            summary.currency,
          )} was collected by partners as customer cash.`
        : 'No visible row is currently linked to a CASH payment method.',
      operatorRule: 'Use booking detail for payment, chat, and marketplace participant evidence.',
      href: '/bookings?view=cash-debt',
      className: cashRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: cashRows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Partner wallet debt',
      status: hasOpenDebt ? `${summary.providerCount} wallet(s)` : 'Clear',
      detail: highestDebt
        ? `${highestDebt.providerName} has the largest open wallet debt: ${formatMoney(
            highestDebt.debtAmount,
            highestDebt.currency,
          )}.`
        : 'No partner wallet has cash-fee debt in the current queue.',
      operatorRule: 'Negative wallet applies only to partners; customers never carry negative wallet debt.',
      href: '/partner-controls?review=cash-debt',
      className: hasOpenDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Deposit or offset proof',
      status: missingReferenceRows.length ? `${missingReferenceRows.length} ref needed` : 'Proof linked',
      detail: missingReferenceRows.length
        ? 'Finance still needs a bank deposit reference or an approved admin offset memo.'
        : `${rowsWithLedgerRefs.length} row(s) already have a settlement or wallet ledger reference.`,
      operatorRule: 'The settlement action must keep booking, payment, earning, and wallet references aligned.',
      href: '/cash-settlements?queue=missing-ref',
      className: missingReferenceRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: missingReferenceRows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Marketplace reopen rule',
      status: hasOpenDebt ? 'Join gated' : 'Join open',
      detail: hasOpenDebt
        ? 'Partners may see marketplace demand, but cannot join marketplace bookings while wallet debt remains.'
        : 'Cleared partner wallets can join eligible marketplace bookings again.',
      operatorRule: 'Partner app message: 수수료를 입금하지 않아 예약에 참여 할수 없습니다.',
      href: '/bookings?view=marketplace',
      className: hasOpenDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: hasOpenDebt ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Payout release gate',
      status: hasOpenDebt ? 'Hold payout' : 'Release checks',
      detail: hasOpenDebt
        ? `${formatMoney(summary.debtAmount, summary.currency)} must be settled before payout release.`
        : 'Payout release can continue through normal weekly, monthly, or admin-selected batch checks.',
      operatorRule: 'Cash debt settlement should be visible before finance approves payout release.',
      href: '/payouts',
      className: hasOpenDebt ? 'ops-task-pending' : 'ops-task-done',
      pillClass: hasOpenDebt ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildCashSettlementEvidenceChecklist(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): EvidenceChecklistItem[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500000);
  const rowsWithRefs = rows.filter((row) => row.lastLedgerRef);

  return [
    {
      title: 'Company-fee evidence',
      status: `${rows.length} open row(s)`,
      detail: 'Confirm bank deposit reference or approved offset memo before settling the cash fee debt.',
      operatorRule: 'The settlement action requires an auditable reference and note.',
      href: '/cash-settlements',
      className: rows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: rows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Wallet participation gate',
      status: `${summary.providerCount} Partner(s)`,
      detail:
        'Negative wallet partners can see marketplace demand, but cannot join marketplace bookings until settlement is confirmed.',
      operatorRule: 'Reopen marketplace participation only after settlement or approved offset is recorded.',
      href: '/partner-controls',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'High-debt follow-up',
      status: `${highDebtProviders.length} follow-up`,
      detail: 'Prioritize the highest debt and oldest open rows for operator handoff.',
      operatorRule: 'Use Partner detail, booking detail, and finance closeout together.',
      href: '/finance-closeout',
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Ledger trace',
      status: `${rowsWithRefs.length} ref(s)`,
      detail: 'Existing wallet ledger references should match the booking, payment, and earning row.',
      operatorRule: 'If a reference is missing, leave the row open until finance has evidence.',
      href: '/audit-log?bucket=Finance%2FCloseout',
      className: rowsWithRefs.length === rows.length ? 'ops-task-done' : 'ops-task-pending',
      pillClass: rowsWithRefs.length === rows.length ? 'pill-success' : 'pill-info',
    },
  ];
}

function buildProviderGroups(rows: CashSettlementRow[]): CashSettlementProviderGroup[] {
  const grouped = new Map<string, CashSettlementProviderGroup>();

  rows.forEach((row) => {
    const providerProfileId = row.earning.providerProfileId;
    const existing = grouped.get(providerProfileId);
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    const item = existing ?? {
      providerProfileId,
      providerName: row.providerName,
      currency: row.earning.currency,
      rowCount: 0,
      debtAmount: 0,
      platformFee: 0,
      taxAmount: 0,
      settlementReference: providerSettlementReference(providerProfileId),
      oldestOpenMs: createdMs,
      oldestOpenLabel: relativeTime(row.earning.createdAt),
    };

    item.rowCount += 1;
    item.debtAmount += row.debtAmount;
    item.platformFee += row.platformFee;
    item.taxAmount += row.taxAmount;
    if (createdMs < item.oldestOpenMs) {
      item.oldestOpenMs = createdMs;
      item.oldestOpenLabel = relativeTime(row.earning.createdAt);
    }

    grouped.set(providerProfileId, item);
  });

  return [...grouped.values()].sort((left, right) => right.debtAmount - left.debtAmount);
}

function buildSummary(rows: CashSettlementRow[], providers: CashSettlementProviderGroup[]) {
  const oldestMs = rows.reduce((oldest, row) => {
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    return Math.min(oldest, createdMs);
  }, Date.now());

  return {
    providerCount: providers.length,
    rowCount: rows.length,
    debtAmount: rows.reduce((sum, row) => sum + row.debtAmount, 0),
    platformFee: rows.reduce((sum, row) => sum + row.platformFee, 0),
    taxAmount: rows.reduce((sum, row) => sum + row.taxAmount, 0),
    currency: rows[0]?.earning.currency ?? 'VND',
    oldestOpenLabel: rows.length ? relativeTime(new Date(oldestMs).toISOString()) : '-',
    staleDebtRowCount: rows.filter((row) => {
      const createdMs = Date.parse(row.earning.createdAt ?? '');
      return Number.isFinite(createdMs) && Date.now() - createdMs > 24 * 60 * 60 * 1000;
    }).length,
    highDebtProviderCount: providers.filter((provider) => provider.debtAmount >= 500_000).length,
    missingPaymentEvidenceCount: rows.filter((row) => !row.earning.booking?.payment).length,
    cashPaymentRowCount: rows.filter((row) => row.earning.booking?.payment?.method === 'CASH').length,
  };
}

function mergeAuthoritativeSummary(
  visibleSummary: CashSettlementSummary,
  apiSummary: AdminCashSettlementSummary | null,
): CashSettlementSummary {
  if (!apiSummary) {
    return visibleSummary;
  }

  return {
    providerCount: apiSummary.providerCount,
    rowCount: apiSummary.rowCount,
    debtAmount: apiSummary.totalDebtAmount,
    platformFee: apiSummary.totalPlatformFee,
    taxAmount: apiSummary.totalTaxAmount,
    currency: apiSummary.currency,
    oldestOpenLabel: apiSummary.oldestOpenAt ? relativeTime(apiSummary.oldestOpenAt) : '-',
    staleDebtRowCount: apiSummary.staleDebtRowCount,
    highDebtProviderCount: apiSummary.highDebtProviderCount,
    missingPaymentEvidenceCount: apiSummary.missingPaymentEvidenceCount,
    cashPaymentRowCount: apiSummary.cashPaymentRowCount,
  };
}

function buildCommandCards(
  rows: CashSettlementRow[],
  providers: CashSettlementProviderGroup[],
  summary: CashSettlementSummary,
): CommandCard[] {
  const highDebtProviders = providers.filter((provider) => provider.debtAmount >= 500_000);

  return [
    {
      title: 'Blocked wallets',
      status: `${summary.providerCount} PARTNER(S)`,
      detail: `${summary.rowCount} open cash settlement row(s), ${formatMoney(
        summary.debtAmount,
        summary.currency,
      )} total. ${summary.cashPaymentRowCount} row(s) are linked to cash payment evidence.`,
      action: summary.providerCount
        ? 'Collect partner deposit or approve admin offset before marketplace join or payout release resumes.'
        : 'No wallet is currently blocked by cash fee debt.',
      className: summary.providerCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.providerCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'High debt priority',
      status: `${summary.highDebtProviderCount} HIGH`,
      detail: highDebtProviders.length
        ? highDebtProviders
            .slice(0, 2)
            .map(
              (provider) =>
                `${provider.providerName}: ${formatMoney(provider.debtAmount, provider.currency)}`,
            )
            .join(' / ')
        : 'No partner is above the high-debt review threshold.',
      action: highDebtProviders.length
        ? 'Prioritize these partners before allowing more cash work.'
        : 'Normal settlement queue priority.',
      className: highDebtProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: highDebtProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Aging debt',
      status: `${summary.staleDebtRowCount} OLD`,
      detail: summary.staleDebtRowCount
        ? 'One or more cash debts have been open longer than 24 hours.'
        : 'No cash fee debt is older than 24 hours.',
      action: summary.staleDebtRowCount
        ? 'Contact partner and record deposit or offset evidence.'
        : 'No aging escalation needed.',
      className: summary.staleDebtRowCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: summary.staleDebtRowCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payment evidence',
      status: `${summary.missingPaymentEvidenceCount} CHECK`,
      detail: summary.missingPaymentEvidenceCount
        ? 'Some rows lack linked payment evidence in the admin payload.'
        : 'Every visible row has booking payment evidence attached.',
      action: summary.missingPaymentEvidenceCount
        ? 'Open booking detail before settling these rows.'
        : 'Rows are ready for finance confirmation.',
      className: summary.missingPaymentEvidenceCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: summary.missingPaymentEvidenceCount ? 'pill-danger' : 'pill-success',
    },
  ];
}

function buildDebtCauseCards(rows: CashSettlementRow[], summary: CashSettlementSummary): CommandCard[] {
  const cashRows = rows.filter((row) => row.paymentMethod === 'CASH');
  const taxRows = rows.filter((row) => row.taxAmount > 0);
  const feeOnlyRows = rows.filter((row) => row.platformFee > 0 && row.taxAmount <= 0);
  const missingEvidenceRows = rows.filter((row) => !row.earning.booking?.payment || row.paymentMethod !== 'CASH');
  const staleRows = rows.filter((row) => cashSettlementRowAgeHours(row) >= 24);

  return [
    {
      title: 'Cash collected by partner',
      status: `${cashRows.length} ROW(S)`,
      detail: `${formatMoney(
        cashRows.reduce((sum, row) => sum + row.bookingAmount, 0),
        summary.currency,
      )} customer cash was collected outside the platform and needs HANDS fee reconciliation.`,
      action: cashRows.length
        ? 'Ask for company-fee deposit evidence or approve an admin offset.'
        : 'No visible row is tied to a cash payment.',
      className: cashRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: cashRows.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Platform fee debt',
      status: `${feeOnlyRows.length} FEE ROW(S)`,
      detail: `${formatMoney(
        rows.reduce((sum, row) => sum + row.platformFee, 0),
        summary.currency,
      )} HANDS fee remains open across visible rows.`,
      action: 'This is the main reason marketplace join is blocked while the wallet is negative.',
      className: rows.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: rows.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Tax withholding part',
      status: `${taxRows.length} TAX ROW(S)`,
      detail: `${formatMoney(
        taxRows.reduce((sum, row) => sum + row.taxAmount, 0),
        summary.currency,
      )} tax withholding is included in the negative-wallet calculation.`,
      action: taxRows.length
        ? 'Check tax policy version before approving an offset.'
        : 'No tax withholding is attached to visible rows.',
      className: taxRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: taxRows.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Evidence gaps',
      status: `${missingEvidenceRows.length} CHECK`,
      detail: missingEvidenceRows.length
        ? 'Some rows lack cash payment evidence or are not marked CASH in the linked payment payload.'
        : 'Visible rows have cash payment evidence attached.',
      action: missingEvidenceRows.length
        ? 'Open booking/payment detail before settlement.'
        : 'Rows are ready for finance evidence confirmation.',
      className: missingEvidenceRows.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: missingEvidenceRows.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Aging follow-up',
      status: `${staleRows.length} OVER 24H`,
      detail: staleRows.length
        ? `${formatMoney(
            staleRows.reduce((sum, row) => sum + row.debtAmount, 0),
            summary.currency,
          )} has been open longer than the first finance follow-up window.`
        : 'No visible debt is older than 24 hours.',
      action: staleRows.length
        ? 'Prioritize partner contact and evidence collection.'
        : 'Normal settlement cadence is enough.',
      className: staleRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: staleRows.length ? 'pill-warn' : 'pill-success',
    },
  ];
}

function isOpenCashDebt(earning: AdminEarning) {
  if (earning.status === 'PAID' || earning.status === 'CANCELLED') {
    return false;
  }
  return earning.netAmount < 0 && (earning.booking?.payment?.method === 'CASH' || earning.platformFee > 0);
}

function providerDisplayName(earning: AdminEarning) {
  return partnerDisplayText(
    earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Unknown partner',
  );
}

function bookingServiceLabel(earning: AdminEarning) {
  const service = earning.booking?.services?.[0]?.service;
  if (!service) {
    return 'Unlinked service option';
  }
  return `${service.name} / ${service.durationMin} min`;
}

function cashSettlementReference(earning: AdminEarning) {
  return `HANDS-CASH-${shortId(earning.bookingId).toUpperCase()}`;
}

function cashDebtOriginLabel(earning: AdminEarning) {
  const method = earning.booking?.payment?.method ?? 'CASH';
  const service = bookingServiceLabel(earning);
  if (method === 'CASH') {
    return `${service}: partner collected customer cash; HANDS fee/tax is still unpaid.`;
  }
  return `${service}: negative wallet row needs finance review because payment method is ${method}.`;
}

function cashDebtEvidenceLabel(earning: AdminEarning) {
  if (earning.settlementRef) {
    return `Settlement reference recorded: ${earning.settlementRef}.`;
  }
  const ledgerRef = earning.walletLedgerEntries?.find((entry) => entry.reference)?.reference;
  if (ledgerRef) {
    return `Wallet ledger reference exists: ${ledgerRef}. Confirm whether it is a deposit or offset.`;
  }
  return 'No deposit or approved offset reference is recorded yet.';
}

function cashSettlementRowAgeHours(row: CashSettlementRow) {
  const createdMs = Date.parse(row.earning.createdAt ?? '');
  if (!Number.isFinite(createdMs)) {
    return 0;
  }
  return (Date.now() - createdMs) / (60 * 60 * 1000);
}

function providerSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

function partnerDisplayText(value: string) {
  return value.replace(/\bProvider\b/g, 'Partner').replace(/\bprovider\b/g, 'partner');
}

function buildCashSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): CashSettlementFilters {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
    queue: normalizeCashSettlementQueue(readSearchParam(params.queue)),
    q: readSearchParam(params.q).trim(),
  };
}

function normalizeCashSettlementQueue(value: string): CashSettlementQueueFilter {
  if (value === 'stale' || value === 'high-debt' || value === 'missing-ref' || value === 'payment-check') {
    return value;
  }
  return 'all';
}

function cashSettlementQueueLabel(queue: CashSettlementQueueFilter) {
  return cashSettlementQueueOptions.find((option) => option.value === queue)?.label ?? 'All open debt';
}

function cashSettlementHref(input: { range: AdminDateRange; queue?: CashSettlementQueueFilter; q?: string }) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'all') {
    params.set('range', input.range);
  }
  if (input.queue && input.queue !== 'all') {
    params.set('queue', input.queue);
  }
  if (input.q?.trim()) {
    params.set('q', input.q.trim());
  }
  const query = params.toString();
  return query ? `/cash-settlements?${query}` : '/cash-settlements';
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function relativeTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) {
    return value;
  }
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}
