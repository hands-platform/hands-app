import Link from 'next/link';
import { AdminEarning, AdminEarningSummary, AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { dateRangeLabel, isInDateRange, normalizeDateRange, readSearchParam } from '../../lib/date-range';
import { createProviderPayout, markEarningPaid } from './actions';

const emptySummary: AdminEarningSummary = {
  count: 0,
  grossAmount: 0,
  platformFee: 0,
  withholdingAmount: 0,
  netAmount: 0,
  pendingNetAmount: 0,
  availableNetAmount: 0,
  paidNetAmount: 0,
  currency: 'VND',
};

type EarningsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EarningsPage({ searchParams }: EarningsPageProps) {
  const filters = buildEarningFilters(searchParams ? await searchParams : {});
  const [apiSummary, earnings, payoutBatches] = await Promise.all([
    adminGet<AdminEarningSummary>('/admin/earnings/summary', emptySummary),
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
  ]);
  const currency = apiSummary.currency || earnings[0]?.currency || payoutBatches[0]?.currency || 'VND';
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const filteredPayoutBatches = payoutBatches.filter((batch) =>
    isInDateRange(batch.createdAt, filters.range),
  );
  const summary = filters.range === 'all' ? apiSummary : summarizeEarnings(filteredEarnings, currency);
  const sortedEarnings = sortEarnings(filteredEarnings);
  const payoutQueue = buildProviderPayoutQueue(sortedEarnings, filteredPayoutBatches);
  const cashDebtQueue = buildCashDebtQueue(sortedEarnings);
  const cashDebtTotals = buildCashDebtTotals(cashDebtQueue);
  const financeSignals = buildFinanceSignals(
    sortedEarnings,
    filteredPayoutBatches,
    payoutQueue,
    cashDebtQueue,
  );
  const serviceBridge = buildServiceEarningBridge(sortedEarnings);
  const moneyFlowCards = buildEarningsMoneyFlowCards(summary, serviceBridge, cashDebtTotals);
  const moneyFlowChecks = buildEarningsMoneyFlowChecks(summary, serviceBridge, cashDebtQueue);

  const metrics = [
    ['Gross', summary.grossAmount],
    ['Platform fee', summary.platformFee],
    ['Tax withheld', summary.withholdingAmount],
    ['Partner net', summary.netAmount],
    ['Pending net', summary.pendingNetAmount],
    ['Available net', summary.availableNetAmount],
    ['Paid net', summary.paidNetAmount],
  ];

  return (
    <>
      <h1>Partner Earnings</h1>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Earnings date range</h2>
            <p className="muted">
              Range: {dateRangeLabel(filters.range)}. Earning rows, service bridge, cash debt, and payout
              batches on this page use record dates.
            </p>
          </div>
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        </div>
        <div className="filter-row" style={{ marginTop: 12 }}>
          {[
            ['All dates', '/earnings'],
            ['Today', '/earnings?range=today'],
            ['Last 7 days', '/earnings?range=7d'],
            ['Last 30 days', '/earnings?range=30d'],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section className="grid">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{formatMoney(Number(value), summary.currency)}</h2>
          </div>
        ))}
      </section>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Money flow command center</h2>
            <p className="muted">
              Same finance language as booking detail: customer charge, partner payout, HANDS fee, tax,
              company net, and cash debt before payout.
            </p>
          </div>
          <Link className="text-link" href="/bookings">
            Trace bookings
          </Link>
        </div>
        <div className="service-trace-summary">
          {moneyFlowCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{formatMoney(card.amount, summary.currency)}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 16 }}>
          {moneyFlowChecks.map((check) => (
            <div className={`ops-task-card ${check.className}`} key={check.title}>
              <div>
                <span className={`pill ${check.pillClass}`}>{check.status}</span>
                <h3>{check.title}</h3>
                <p className="muted">{check.detail}</p>
              </div>
              <small>{check.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Finance queue</h2>
            <p className="muted">
              Operator summary for partner payout readiness, batched earnings, tax logs, and stale pending
              revenue.
            </p>
          </div>
          <Link className="text-link" href="/payouts">
            Open payout batches
          </Link>
        </div>
        <div className="ops-task-grid">
          {financeSignals.map((signal) => (
            <div className={`ops-task-card ${signal.className}`} key={signal.title}>
              <div>
                <span className={`pill ${signal.pillClass}`}>{signal.status}</span>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
              </div>
              <small>{signal.action}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Service to earnings bridge</h2>
            <p className="muted">
              Confirms which service duration options are creating partner net, HANDS platform fee, tax
              withholding, cash wallet debt, and payout-batch pressure.
            </p>
          </div>
          <Link className="text-link" href="/services">
            Review service pricing
          </Link>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Service options</span>
            <strong>{serviceBridge.length}</strong>
          </div>
          <div>
            <span>Gross</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.grossAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Partner net</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.netAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Partner payout</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.providerPayoutAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Platform fee</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.platformFee, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>VAT / cost</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.vatAmount + item.otherCostAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Tax withheld</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.withholdingAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Cash debt</span>
            <strong>
              {formatMoney(
                serviceBridge.reduce((sum, item) => sum + item.cashDebtAmount, 0),
                summary.currency,
              )}
            </strong>
          </div>
        </div>
        {serviceBridge.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Service option</th>
                <th>Bookings</th>
                <th>Gross</th>
                <th>Partner payout</th>
                <th>Partner net</th>
                <th>Platform fee</th>
                <th>VAT / cost</th>
                <th>Tax withheld</th>
                <th>Net company fee</th>
                <th>Cash debt</th>
                <th>Payout state</th>
              </tr>
            </thead>
            <tbody>
              {serviceBridge.map((item) => (
                <tr key={item.key}>
                  <td>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.groupKey}</p>
                  </td>
                  <td>
                    <strong>{item.bookingCount}</strong>
                    <p className="muted">{item.cashBookingCount} cash booking(s)</p>
                  </td>
                  <td>{formatMoney(item.grossAmount, item.currency)}</td>
                  <td>
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(item.providerPayoutAmount, item.currency)}</strong>
                      <small>{item.matrixBackedCount} matrix-backed booking(s)</small>
                    </div>
                  </td>
                  <td>{formatMoney(item.netAmount, item.currency)}</td>
                  <td>{formatMoney(item.platformFee, item.currency)}</td>
                  <td>
                    <div className="service-matrix-cell">
                      <small>VAT {formatMoney(item.vatAmount, item.currency)}</small>
                      <small>Cost {formatMoney(item.otherCostAmount, item.currency)}</small>
                    </div>
                  </td>
                  <td>{formatMoney(item.withholdingAmount, item.currency)}</td>
                  <td>{formatMoney(item.netCompanyFee, item.currency)}</td>
                  <td>
                    <span className={`pill ${item.cashDebtAmount ? 'pill-danger' : 'pill-success'}`}>
                      {formatMoney(item.cashDebtAmount, item.currency)}
                    </span>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <small>{item.unbatchedCount} unbatched</small>
                      <small>{item.batchedCount} batched</small>
                      <small>{item.paidCount} paid</small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No earning has linked service details yet.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Partner payout queue</h2>
            <p className="muted">
              Grouped by partner so finance can create one payout batch for all eligible unpaid earnings.
            </p>
          </div>
          <span className="pill pill-info">{payoutQueue.length} partner(s)</span>
        </div>
        {payoutQueue.length ? (
          <div className="setup-stage-list">
            {payoutQueue.slice(0, 12).map((group) => (
              <div className="setup-stage-item" key={group.providerProfileId}>
                <span>{group.status}</span>
                <div>
                  <strong>{group.providerName}</strong>
                  <p className="muted">
                    {group.unbatchedCount} unbatched earning(s) / net{' '}
                    {formatMoney(group.unbatchedNet, group.currency)}
                    {' / '}withholding {formatMoney(group.withholdingAmount, group.currency)}
                  </p>
                  <p className="muted">
                    Wallet balance {formatMoney(group.walletBalance, group.currency)}
                    {group.cashDebtAmount > 0
                      ? ` / cash debt ${formatMoney(group.cashDebtAmount, group.currency)} blocks payout batching`
                      : ' / no cash debt'}
                  </p>
                  <p className="muted">
                    {group.activeBatch
                      ? `Existing batch ${shortId(group.activeBatch.id)} is ${group.activeBatch.status}.`
                      : group.nextAction}
                  </p>
                </div>
                <div className="actions">
                  <Link className="text-link" href={`/partners/${group.providerProfileId}`}>
                    Partner
                  </Link>
                  {group.canBatch ? (
                    <form action={createProviderPayout}>
                      <input type="hidden" name="providerProfileId" value={group.providerProfileId} />
                      <input
                        type="hidden"
                        name="transferRef"
                        value={`HANDS-${shortId(group.providerProfileId)}`}
                      />
                      <button type="submit">Batch payout</button>
                    </form>
                  ) : (
                    <span className="muted">No batch action</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No partner has unpaid earnings in the current admin result window.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash fee debt queue</h2>
            <p className="muted">
              Cash bookings create a negative partner wallet until the partner deposits the HANDS fee or
              finance offsets it.
            </p>
          </div>
          <span className={cashDebtQueue.length ? 'pill pill-danger' : 'pill pill-success'}>
            {cashDebtQueue.length} blocked wallet(s)
          </span>
        </div>
        {cashDebtQueue.length ? (
          <div className="service-trace-summary">
            <div>
              <span>Blocked wallets</span>
              <strong>{cashDebtQueue.length}</strong>
            </div>
            <div>
              <span>Wallet debt</span>
              <strong>{formatMoney(cashDebtTotals.debtAmount, summary.currency)}</strong>
            </div>
            <div>
              <span>Booking cash</span>
              <strong>{formatMoney(cashDebtTotals.bookingAmount, summary.currency)}</strong>
            </div>
            <div>
              <span>HANDS fee</span>
              <strong>{formatMoney(cashDebtTotals.platformFee, summary.currency)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{formatMoney(cashDebtTotals.taxAmount, summary.currency)}</strong>
            </div>
          </div>
        ) : null}
        {cashDebtQueue.length ? (
          <div className="setup-stage-list">
            {cashDebtQueue.slice(0, 12).map((item) => (
              <div className="setup-stage-item" key={item.earning.id}>
                <span>DEBT</span>
                <div>
                  <strong>{item.providerName}</strong>
                  <p className="muted">
                    Owes {formatMoney(item.debtAmount, item.earning.currency)} from booking{' '}
                    <Link className="text-link" href={`/bookings/${item.earning.bookingId}`}>
                      {shortId(item.earning.bookingId)}
                    </Link>
                    {' / '}payment {item.paymentMethod}
                  </p>
                  <p className="muted">
                    Booking cash {formatMoney(item.bookingAmount, item.earning.currency)}
                    {' / '}HANDS fee {formatMoney(item.platformFee, item.earning.currency)}
                    {' / '}tax {formatMoney(item.taxAmount, item.earning.currency)}
                  </p>
                  <div className="service-matrix-cell">
                    {item.settlementChecklist.map((step) => (
                      <small key={step}>{step}</small>
                    ))}
                    <small>Suggested ref: {item.settlementReference}</small>
                    {item.lastLedgerRef ? <small>Last ledger ref: {item.lastLedgerRef}</small> : null}
                  </div>
                  <p className="muted">
                    Settling this row records the partner cash-fee debt as paid and can reopen booking
                    acceptance once the wallet is non-negative.
                  </p>
                </div>
                <div className="actions">
                  <Link className="text-link" href={`/partners/${item.earning.providerProfileId}`}>
                    Partner
                  </Link>
                  <form action={markEarningPaid}>
                    <input type="hidden" name="earningId" value={item.earning.id} />
                    <input
                      aria-label="Settlement reference"
                      name="settlementRef"
                      placeholder="Deposit ref or offset memo"
                      defaultValue={item.settlementReference}
                    />
                    <input
                      type="hidden"
                      name="settlementNotes"
                      value={`Cash fee debt settled from admin earnings queue with reference ${item.settlementReference}`}
                    />
                    <button type="submit">Mark fee settled</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No partner has unsettled cash fee debt in the current admin result window.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Recent earnings ledger</h2>
            <p className="muted">
              Raw earning rows remain visible for booking traceability, tax audit, payout batching, and cash
              fee settlement correction.
            </p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Status</th>
              <th>Payout batch</th>
              <th>Gross / Fee / Tax</th>
              <th>Net</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedEarnings.map((earning) => (
              <tr id={`earning-${earning.id}`} key={earning.id}>
                <td>
                  <div>
                    {earning.providerProfile?.displayName ??
                      earning.providerProfile?.user?.phone ??
                      'Unknown'}
                  </div>
                  <div className="muted">{earning.providerProfile?.user?.phone ?? 'No phone on file'}</div>
                </td>
                <td>
                  <a className="text-link" href={`/bookings/${earning.bookingId}`}>
                    {shortId(earning.bookingId)}
                  </a>
                  <div className="muted">
                    {earning.createdAt ? relativeTime(earning.createdAt) : 'No create time'}
                  </div>
                  <div className="muted">Payment {earning.booking?.payment?.method ?? 'UNKNOWN'}</div>
                  {earning.settlementRef && (
                    <div className="muted">Settlement ref {earning.settlementRef}</div>
                  )}
                  {(earning.walletLedgerEntries ?? []).slice(0, 2).map((entry) => (
                    <div className="muted" key={entry.id}>
                      Wallet {entry.type}: {formatMoney(entry.amount, entry.currency)}
                    </div>
                  ))}
                </td>
                <td>
                  <span className={earningSignalClass(earning)}>{earningStatusLabel(earning)}</span>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {earningHint(earning)}
                  </div>
                </td>
                <td>
                  {earning.payoutBatchId ? (
                    <a className="pill pill-info" href={`/payouts#${earning.payoutBatchId}`}>
                      {shortId(earning.payoutBatchId)}
                    </a>
                  ) : (
                    <span className="pill pill-warn">Not batched</span>
                  )}
                </td>
                <td>
                  <div>{formatMoney(earning.grossAmount, earning.currency)} gross</div>
                  <div className="muted">
                    {formatMoney(earning.platformFee, earning.currency)} platform fee
                  </div>
                  <div className="muted">{platformFeePolicyHint(earning)}</div>
                  <div className="muted">{netCompanyFeeHint(earning)}</div>
                  <div className="muted">
                    {formatMoney(earning.withholdingAmount ?? 0, earning.currency)} tax withheld
                  </div>
                  <div className="muted">{taxPolicyHint(earning)}</div>
                </td>
                <td>
                  <strong>{formatMoney(earning.netAmount, earning.currency)}</strong>
                </td>
                <td>
                  {canDirectlyPay(earning) && (
                    <form action={markEarningPaid}>
                      <input type="hidden" name="earningId" value={earning.id} />
                      <input
                        aria-label="Settlement reference"
                        name="settlementRef"
                        placeholder="Deposit ref or offset memo"
                      />
                      <button type="submit">Mark fee settled</button>
                    </form>
                  )}
                  {canCreatePayout(earning) && (
                    <form action={createProviderPayout} style={{ marginTop: 6 }}>
                      <input type="hidden" name="providerProfileId" value={earning.providerProfileId} />
                      <input type="hidden" name="transferRef" value={`MVP-${earning.providerProfileId}`} />
                      <button type="submit">Batch payout</button>
                    </form>
                  )}
                  {!canDirectlyPay(earning) && !canCreatePayout(earning) && (
                    <span className="muted">{earning.status === 'PAID' ? 'Paid' : 'No action'}</span>
                  )}
                </td>
              </tr>
            ))}
            {sortedEarnings.length === 0 && (
              <tr>
                <td colSpan={7}>No earnings loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortEarnings(earnings: AdminEarning[]) {
  return [...earnings].sort((left, right) => {
    const priorityDiff = earningPriority(left) - earningPriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
  });
}

function buildEarningFilters(params: Record<string, string | string[] | undefined>) {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

function summarizeEarnings(earnings: AdminEarning[], currency: string): AdminEarningSummary {
  return earnings.reduce<AdminEarningSummary>(
    (summary, earning) => {
      summary.count += 1;
      summary.grossAmount += earning.grossAmount;
      summary.platformFee += earning.platformFee;
      summary.withholdingAmount += earning.withholdingAmount;
      summary.netAmount += earning.netAmount;
      if (earning.status === 'PENDING') {
        summary.pendingNetAmount += earning.netAmount;
      }
      if (earning.status === 'AVAILABLE') {
        summary.availableNetAmount += earning.netAmount;
      }
      if (earning.status === 'PAID') {
        summary.paidNetAmount += earning.netAmount;
      }
      return summary;
    },
    {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency,
    },
  );
}

type ProviderPayoutQueueItem = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  unbatchedCount: number;
  unbatchedNet: number;
  withholdingAmount: number;
  cashDebtAmount: number;
  walletBalance: number;
  status: string;
  canBatch: boolean;
  nextAction: string;
  activeBatch?: AdminPayoutBatch;
};

type FinanceSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type MoneyFlowCard = {
  label: string;
  amount: number;
  detail: string;
};

type CashDebtQueueItem = {
  earning: AdminEarning;
  providerName: string;
  paymentMethod: string;
  debtAmount: number;
  platformFee: number;
  taxAmount: number;
  bookingAmount: number;
  settlementReference: string;
  lastLedgerRef?: string | null;
  settlementChecklist: string[];
};

type ServiceEarningBridgeItem = {
  key: string;
  label: string;
  groupKey: string;
  currency: string;
  bookingCount: number;
  cashBookingCount: number;
  grossAmount: number;
  netAmount: number;
  providerPayoutAmount: number;
  platformFee: number;
  vatAmount: number;
  otherCostAmount: number;
  withholdingAmount: number;
  netCompanyFee: number;
  cashDebtAmount: number;
  matrixBackedCount: number;
  unbatchedCount: number;
  batchedCount: number;
  paidCount: number;
};

type ServicePayoutSnapshotLine = {
  serviceId?: string;
  customerPrice?: number | string;
  providerPayoutAmount?: number | string;
  platformFeeAmount?: number | string;
  vatAmount?: number | string;
  otherCostAmount?: number | string;
};

function buildCashDebtQueue(earnings: AdminEarning[]): CashDebtQueueItem[] {
  return earnings
    .filter((earning) => isCashDebt(earning))
    .map((earning) => {
      const debtAmount = Math.abs(earning.netAmount);
      const platformFee = earning.platformFee;
      const taxAmount = earning.withholdingAmount ?? 0;
      const bookingAmount = earning.booking?.payment?.amount ?? earning.grossAmount;
      const settlementReference = cashDebtSettlementReference(earning.providerProfileId);
      const lastLedgerRef = earning.walletLedgerEntries?.[0]?.reference ?? null;

      return {
        earning,
        providerName: providerDisplayName(earning),
        paymentMethod: earning.booking?.payment?.method ?? 'CASH',
        debtAmount,
        platformFee,
        taxAmount,
        bookingAmount,
        settlementReference,
        lastLedgerRef,
        settlementChecklist: [
          `Confirm partner deposit or approved offset before settling ${settlementReference}.`,
          'Keep the reference on the bank transfer, chat evidence, or admin offset memo.',
          'Recheck payout queue after settlement.',
        ],
      };
    })
    .sort((left, right) => right.debtAmount - left.debtAmount);
}

function cashDebtSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

function buildCashDebtTotals(queue: CashDebtQueueItem[]) {
  return queue.reduce(
    (totals, item) => ({
      debtAmount: totals.debtAmount + item.debtAmount,
      platformFee: totals.platformFee + item.platformFee,
      taxAmount: totals.taxAmount + item.taxAmount,
      bookingAmount: totals.bookingAmount + item.bookingAmount,
    }),
    {
      debtAmount: 0,
      platformFee: 0,
      taxAmount: 0,
      bookingAmount: 0,
    },
  );
}

function buildEarningsMoneyFlowCards(
  summary: AdminEarningSummary,
  serviceBridge: ServiceEarningBridgeItem[],
  cashDebtTotals: ReturnType<typeof buildCashDebtTotals>,
): MoneyFlowCard[] {
  const bridgeGross = sumServiceBridge(serviceBridge, 'grossAmount');
  const providerPayout = sumServiceBridge(serviceBridge, 'providerPayoutAmount');
  const netCompanyFee = sumServiceBridge(serviceBridge, 'netCompanyFee');
  const vatAndCost =
    sumServiceBridge(serviceBridge, 'vatAmount') + sumServiceBridge(serviceBridge, 'otherCostAmount');

  return [
    {
      label: 'Customer charge',
      amount: bridgeGross || summary.grossAmount,
      detail: 'Gross customer payment across completed earning rows.',
    },
    {
      label: 'Partner payout',
      amount: providerPayout || summary.netAmount,
      detail: 'Service pricing matrix payout before wallet debt and batch status.',
    },
    {
      label: 'HANDS fee',
      amount: summary.platformFee,
      detail: 'Total platform fee before VAT, withholding, and operating cost allocation.',
    },
    {
      label: 'Tax withheld',
      amount: summary.withholdingAmount,
      detail: 'Freelancer withholding already attached to earning records.',
    },
    {
      label: 'Company net',
      amount: netCompanyFee || Math.max(0, summary.platformFee - summary.withholdingAmount - vatAndCost),
      detail: 'Estimated HANDS fee after configured tax and cost deductions.',
    },
    {
      label: 'Cash debt',
      amount: cashDebtTotals.debtAmount,
      detail: 'Negative wallet amount from cash jobs that must be settled before final acceptance or customer selection.',
    },
  ];
}

function buildEarningsMoneyFlowChecks(
  summary: AdminEarningSummary,
  serviceBridge: ServiceEarningBridgeItem[],
  cashDebtQueue: CashDebtQueueItem[],
): FinanceSignal[] {
  const bridgeGross = sumServiceBridge(serviceBridge, 'grossAmount');
  const bridgePlatformFee = sumServiceBridge(serviceBridge, 'platformFee');
  const unlinkedOptions = serviceBridge.filter((item) => item.label === 'Unlinked service option');
  const grossGap = Math.abs(summary.grossAmount - bridgeGross);
  const feeGap = Math.abs(summary.platformFee - bridgePlatformFee);
  const hasBridgeRows = serviceBridge.length > 0;

  return [
    {
      title: 'Booking service link',
      status: `${unlinkedOptions.length} UNLINKED`,
      detail: unlinkedOptions.length
        ? 'Some earning rows still do not point to a configured service duration option.'
        : 'Every visible earning can be traced to a service option or fallback row.',
      action: unlinkedOptions.length
        ? 'Open service pricing and reconnect missing booking service references.'
        : 'Service option trace is ready for finance review.',
      className: unlinkedOptions.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: unlinkedOptions.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Gross reconciliation',
      status: hasBridgeRows && grossGap > 0 ? 'CHECK' : 'MATCHED',
      detail: hasBridgeRows
        ? `Summary versus service bridge gap: ${formatMoney(grossGap, summary.currency)}.`
        : 'No service bridge rows are available yet.',
      action:
        hasBridgeRows && grossGap > 0
          ? 'Review cancelled rows, manual earning edits, or missing service links.'
          : 'Customer charge totals reconcile with the service bridge.',
      className: hasBridgeRows && grossGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: hasBridgeRows && grossGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Fee reconciliation',
      status: hasBridgeRows && feeGap > 0 ? 'CHECK' : 'MATCHED',
      detail: hasBridgeRows
        ? `Platform fee bridge gap: ${formatMoney(feeGap, summary.currency)}.`
        : 'No fee bridge rows are available yet.',
      action:
        hasBridgeRows && feeGap > 0
          ? 'Confirm fee policy snapshots before payout approval.'
          : 'HANDS fee totals are aligned across earnings and service rows.',
      className: hasBridgeRows && feeGap > 0 ? 'ops-task-pending' : 'ops-task-done',
      pillClass: hasBridgeRows && feeGap > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Cash job lock',
      status: `${cashDebtQueue.length} PARTNER(S)`,
      detail: cashDebtQueue.length
        ? 'Negative wallet partners must settle company fee before final acceptance or customer selection.'
        : 'No cash fee debt currently blocks partner work.',
      action: cashDebtQueue.length
        ? 'Use cash debt queue to confirm deposit or approved offset.'
        : 'Partner booking lock is clear for listed earnings.',
      className: cashDebtQueue.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtQueue.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function sumServiceBridge(
  serviceBridge: ServiceEarningBridgeItem[],
  field: keyof Pick<
    ServiceEarningBridgeItem,
    | 'grossAmount'
    | 'netAmount'
    | 'providerPayoutAmount'
    | 'platformFee'
    | 'vatAmount'
    | 'otherCostAmount'
    | 'withholdingAmount'
    | 'netCompanyFee'
    | 'cashDebtAmount'
  >,
) {
  return serviceBridge.reduce((sum, item) => sum + item[field], 0);
}

function buildServiceEarningBridge(earnings: AdminEarning[]): ServiceEarningBridgeItem[] {
  const grouped = new Map<string, ServiceEarningBridgeItem>();

  earnings.forEach((earning) => {
    if (earning.status === 'CANCELLED') {
      return;
    }

    const bookingServices =
      earning.booking?.services && earning.booking.services.length > 0
        ? earning.booking.services
        : [
            {
              id: `earning-${earning.id}`,
              serviceId: 'unknown-service',
              quantity: 1,
              price: earning.grossAmount,
              service: null,
            },
          ];

    const allocationBase =
      bookingServices.reduce(
        (sum, bookingService) =>
          sum + Number(bookingService.price ?? 0) * Math.max(1, Number(bookingService.quantity ?? 1)),
        0,
      ) ||
      earning.grossAmount ||
      1;

    bookingServices.forEach((bookingService) => {
      const quantity = Math.max(1, Number(bookingService.quantity ?? 1));
      const serviceGross = Number(bookingService.price ?? 0) * quantity;
      const allocationShare = allocationBase > 0 ? serviceGross / allocationBase : 1 / bookingServices.length;
      const service = bookingService.service;
      const key = service?.id ?? bookingService.serviceId ?? 'unknown-service';
      const duration = service?.durationMin ? `${service.durationMin} min` : 'duration not linked';
      const label = service?.name ? `${service.name} / ${duration}` : 'Unlinked service option';
      const payoutLine = servicePayoutLineFor(earning, bookingService);
      const providerPayoutAmount =
        readAmount(payoutLine?.providerPayoutAmount) ||
        Math.max(0, serviceGross - Math.round(earning.platformFee * allocationShare));
      const platformFeeAmount =
        readAmount(payoutLine?.platformFeeAmount) || Math.round(earning.platformFee * allocationShare);
      const vatAmount = readAmount(payoutLine?.vatAmount);
      const otherCostAmount = readAmount(payoutLine?.otherCostAmount);
      const withholdingAmount = Math.round((earning.withholdingAmount ?? 0) * allocationShare);
      const item = grouped.get(key) ?? {
        key,
        label,
        groupKey: service?.serviceGroupKey ?? bookingService.serviceId ?? 'unknown',
        currency: earning.currency,
        bookingCount: 0,
        cashBookingCount: 0,
        grossAmount: 0,
        netAmount: 0,
        providerPayoutAmount: 0,
        platformFee: 0,
        vatAmount: 0,
        otherCostAmount: 0,
        withholdingAmount: 0,
        netCompanyFee: 0,
        cashDebtAmount: 0,
        matrixBackedCount: 0,
        unbatchedCount: 0,
        batchedCount: 0,
        paidCount: 0,
      };

      item.bookingCount += 1;
      if (earning.booking?.payment?.method === 'CASH') {
        item.cashBookingCount += 1;
      }
      item.grossAmount += Math.round(earning.grossAmount * allocationShare);
      item.netAmount += Math.round(earning.netAmount * allocationShare);
      item.providerPayoutAmount += providerPayoutAmount;
      item.platformFee += platformFeeAmount;
      item.vatAmount += vatAmount;
      item.otherCostAmount += otherCostAmount;
      item.withholdingAmount += withholdingAmount;
      item.netCompanyFee += platformFeeAmount - vatAmount - otherCostAmount - withholdingAmount;
      if (payoutLine) {
        item.matrixBackedCount += 1;
      }
      if (earning.netAmount < 0) {
        item.cashDebtAmount += Math.round(Math.abs(earning.netAmount) * allocationShare);
      }
      if (earning.status === 'PAID') {
        item.paidCount += 1;
      } else if (earning.payoutBatchId) {
        item.batchedCount += 1;
      } else {
        item.unbatchedCount += 1;
      }

      grouped.set(key, item);
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.grossAmount - left.grossAmount || left.label.localeCompare(right.label))
    .slice(0, 12);
}

function servicePayoutLineFor(
  earning: AdminEarning,
  bookingService: NonNullable<NonNullable<AdminEarning['booking']>['services']>[number],
) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  const snapshot = latestFeeLog?.ruleSnapshot as
    | { source?: string; lines?: ServicePayoutSnapshotLine[] }
    | undefined;
  if (snapshot?.source !== 'SERVICE_PAYOUT_RULE' || !Array.isArray(snapshot.lines)) {
    return null;
  }
  const serviceId = bookingService.service?.id ?? bookingService.serviceId;
  const customerPrice = readAmount(bookingService.price);
  return (
    snapshot.lines.find(
      (line) => line.serviceId === serviceId && readAmount(line.customerPrice) === customerPrice,
    ) ?? null
  );
}

function readAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  return 0;
}

function buildProviderPayoutQueue(earnings: AdminEarning[], payoutBatches: AdminPayoutBatch[]) {
  const activeBatchByProvider = new Map<string, AdminPayoutBatch>();
  payoutBatches
    .filter((batch) => batch.status !== 'PAID' && batch.status !== 'CANCELLED')
    .forEach((batch) => {
      if (!activeBatchByProvider.has(batch.providerProfileId)) {
        activeBatchByProvider.set(batch.providerProfileId, batch);
      }
    });

  const grouped = new Map<string, ProviderPayoutQueueItem>();
  earnings.forEach((earning) => {
    if (earning.status === 'PAID' || earning.status === 'CANCELLED') {
      return;
    }

    const existing = grouped.get(earning.providerProfileId);
    const activeBatch = activeBatchByProvider.get(earning.providerProfileId);
    const providerName = providerDisplayName(earning);
    const item = existing ?? {
      providerProfileId: earning.providerProfileId,
      providerName,
      currency: earning.currency,
      unbatchedCount: 0,
      unbatchedNet: 0,
      withholdingAmount: 0,
      cashDebtAmount: 0,
      walletBalance: 0,
      status: activeBatch ? 'BATCHED' : 'READY',
      canBatch: false,
      nextAction: 'Create a payout batch after finance review.',
      activeBatch,
    };

    item.withholdingAmount += earning.withholdingAmount ?? 0;
    if (!earning.payoutBatchId) {
      item.walletBalance += earning.netAmount;
    }
    if (!earning.payoutBatchId && earning.netAmount > 0) {
      item.unbatchedCount += 1;
      item.unbatchedNet += earning.netAmount;
    }
    if (!earning.payoutBatchId && earning.netAmount < 0) {
      item.cashDebtAmount += Math.abs(earning.netAmount);
    }

    grouped.set(earning.providerProfileId, item);
  });

  return [...grouped.values()]
    .map((item) => {
      const hasCashDebt = item.cashDebtAmount > 0;
      const canBatch = item.unbatchedCount > 0 && !item.activeBatch && !hasCashDebt;
      return {
        ...item,
        canBatch,
        status: hasCashDebt ? 'HOLD' : item.activeBatch ? 'BATCHED' : canBatch ? 'READY' : 'WAIT',
        nextAction: item.activeBatch
          ? 'Continue from payout batches before creating another batch.'
          : hasCashDebt
            ? 'Settle or offset the cash fee debt before creating a payout batch.'
            : canBatch
              ? 'Create one batch for all currently eligible unpaid earnings.'
              : 'No unbatched positive earning is available for this partner.',
      };
    })
    .sort((left, right) => {
      if (left.cashDebtAmount !== right.cashDebtAmount) {
        return right.cashDebtAmount - left.cashDebtAmount;
      }
      if (left.canBatch !== right.canBatch) {
        return left.canBatch ? -1 : 1;
      }
      return right.unbatchedNet - left.unbatchedNet;
    });
}

function buildFinanceSignals(
  earnings: AdminEarning[],
  payoutBatches: AdminPayoutBatch[],
  payoutQueue: ProviderPayoutQueueItem[],
  cashDebtQueue: CashDebtQueueItem[],
): FinanceSignal[] {
  const readyProviders = payoutQueue.filter((item) => item.canBatch);
  const batchedUnpaid = earnings.filter(
    (earning) => earning.payoutBatchId && earning.status !== 'PAID' && earning.status !== 'CANCELLED',
  );
  const missingTaxLogs = earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const stalePending = earnings.filter((earning) => {
    if (earning.status !== 'PENDING' || !earning.availableAt) {
      return false;
    }
    return Date.parse(earning.availableAt) < Date.now();
  });
  const activeBatches = payoutBatches.filter(
    (batch) => batch.status !== 'PAID' && batch.status !== 'CANCELLED',
  );

  return [
    {
      title: 'Ready to batch',
      status: `${readyProviders.length} PARTNER(S)`,
      detail: formatMoney(
        readyProviders.reduce((sum, item) => sum + item.unbatchedNet, 0),
        'VND',
      ),
      action: readyProviders.length
        ? 'Create batches from the partner queue below.'
        : 'No partner is ready to batch.',
      className: readyProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: readyProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Active batches',
      status: `${activeBatches.length} OPEN`,
      detail: formatMoney(
        activeBatches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        'VND',
      ),
      action: activeBatches.length ? 'Move DRAFT/PROCESSING batches from payouts.' : 'No open payout batch.',
      className: activeBatches.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: activeBatches.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Batched unpaid rows',
      status: `${batchedUnpaid.length} ROW(S)`,
      detail: formatMoney(
        batchedUnpaid.reduce((sum, earning) => sum + earning.netAmount, 0),
        'VND',
      ),
      action: batchedUnpaid.length
        ? 'Follow the payout batch, not direct paid action.'
        : 'No batched unpaid row.',
      className: batchedUnpaid.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: batchedUnpaid.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Cash fee debt',
      status: `${cashDebtQueue.length} WALLET(S)`,
      detail: formatMoney(
        cashDebtQueue.reduce((sum, item) => sum + Math.abs(item.earning.netAmount), 0),
        'VND',
      ),
      action: cashDebtQueue.length
        ? 'Confirm partner deposit or offset, then mark fee settled.'
        : 'No negative cash wallet needs settlement.',
      className: cashDebtQueue.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtQueue.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Audit warnings',
      status: `${missingTaxLogs.length + stalePending.length} CHECK`,
      detail: `${missingTaxLogs.length} missing tax log(s), ${stalePending.length} pending after available time.`,
      action:
        missingTaxLogs.length || stalePending.length
          ? 'Review tax policy or earning availability before payment.'
          : 'Tax and availability signals look consistent.',
      className: missingTaxLogs.length || stalePending.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: missingTaxLogs.length || stalePending.length ? 'pill-danger' : 'pill-success',
    },
  ];
}

function earningPriority(earning: AdminEarning) {
  if (isCashDebt(earning)) {
    return -1;
  }
  if (earning.status === 'CANCELLED') {
    return 5;
  }
  if (earning.status === 'PAID') {
    return 4;
  }
  if (earning.payoutBatchId) {
    return 2;
  }
  if (earning.status === 'AVAILABLE') {
    return 0;
  }
  return 1;
}

function providerDisplayName(earning: AdminEarning) {
  return earning.providerProfile?.displayName ?? earning.providerProfile?.user?.phone ?? 'Unknown partner';
}

function earningSignalClass(earning: AdminEarning) {
  if (earning.status === 'PAID') {
    return 'signal signal-ok';
  }
  if (earning.status === 'CANCELLED') {
    return 'signal signal-warn';
  }
  if (earning.payoutBatchId) {
    return 'signal signal-info';
  }
  return 'signal signal-warn';
}

function earningStatusLabel(earning: AdminEarning) {
  if (earning.payoutBatchId && earning.status !== 'PAID') {
    return `${earning.status} / batched`;
  }
  return earning.status;
}

function earningHint(earning: AdminEarning) {
  if (isCashDebt(earning)) {
    return 'Cash fee debt blocks partner wallet until settled';
  }
  if (earning.status === 'PAID') {
    return earning.paidAt ? `Paid ${relativeTime(earning.paidAt)}` : 'Paid without timestamp';
  }
  if (earning.status === 'CANCELLED') {
    return 'Cancelled by refund or booking reversal';
  }
  if (earning.payoutBatchId) {
    return 'Follow this from the payout batch screen';
  }
  if (earning.availableAt) {
    return `Available ${relativeTime(earning.availableAt)}`;
  }
  return 'Ready for finance review';
}

function taxPolicyHint(earning: AdminEarning) {
  const latestTaxLog = earning.taxLogs?.[0];
  if (!latestTaxLog) {
    return 'No tax log yet';
  }
  const snapshot = latestTaxLog.ruleSnapshot as
    | { scope?: string; reason?: string; rateBps?: number }
    | undefined;
  if (snapshot?.reason) {
    return `Tax policy: ${snapshot.reason}`;
  }
  return `Tax policy: ${snapshot?.scope ?? 'RULE'} at ${((snapshot?.rateBps ?? 0) / 100).toFixed(2)}%`;
}

function platformFeePolicyHint(earning: AdminEarning) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  if (!latestFeeLog) {
    return 'Fee policy: no log yet';
  }
  const snapshot = latestFeeLog.ruleSnapshot as
    | {
        source?: string;
        scope?: string;
        rateBps?: number;
        fixedAmount?: number;
        providerPayoutAmount?: number;
        vatAmount?: number;
        otherCostAmount?: number;
      }
    | undefined;
  if (snapshot?.source === 'SERVICE_PAYOUT_RULE') {
    return `Fee policy: service payout matrix / partner payout ${formatMoney(
      snapshot.providerPayoutAmount ?? 0,
      earning.currency,
    )}`;
  }
  return `Fee policy: ${snapshot?.scope ?? 'RULE'} at ${((snapshot?.rateBps ?? 0) / 100).toFixed(2)}%`;
}

function netCompanyFeeHint(earning: AdminEarning) {
  const latestFeeLog = earning.platformFeeLogs?.[0];
  const snapshot = latestFeeLog?.ruleSnapshot as
    | {
        source?: string;
        vatAmount?: number;
        otherCostAmount?: number;
      }
    | undefined;
  const vatAmount = snapshot?.vatAmount ?? 0;
  const otherCostAmount = snapshot?.otherCostAmount ?? 0;
  const netCompanyFee = earning.platformFee - (earning.withholdingAmount ?? 0) - vatAmount - otherCostAmount;
  if (snapshot?.source === 'SERVICE_PAYOUT_RULE') {
    return `Net company fee after VAT/tax/cost: ${formatMoney(netCompanyFee, earning.currency)}`;
  }
  return `Net company fee estimate: ${formatMoney(netCompanyFee, earning.currency)}`;
}

function canDirectlyPay(earning: AdminEarning) {
  return isCashDebt(earning);
}

function canCreatePayout(earning: AdminEarning) {
  return (
    Boolean(earning.providerProfile) &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    earning.netAmount > 0 &&
    !earning.payoutBatchId
  );
}

function isCashDebt(earning: AdminEarning) {
  return (
    earning.netAmount < 0 &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    !earning.payoutBatchId
  );
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function relativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return 'Unknown time';
  }
  const diffMs = Date.now() - timestamp;
  const absoluteMinutes = Math.floor(Math.abs(diffMs) / 60000);
  const suffix = diffMs >= 0 ? 'ago' : 'from now';
  if (absoluteMinutes < 1) {
    return diffMs >= 0 ? 'just now' : 'in less than 1m';
  }
  if (absoluteMinutes < 60) {
    return `${absoluteMinutes}m ${suffix}`;
  }
  const hours = Math.floor(absoluteMinutes / 60);
  if (hours < 24) {
    return `${hours}h ${suffix}`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${suffix}`;
}
