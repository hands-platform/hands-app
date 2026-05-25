import Link from 'next/link';
import { AdminEarning, AdminEarningSummary, AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { createProviderPayout, markEarningPaid } from './actions';

const emptySummary: AdminEarningSummary = {
  count: 0,
  grossAmount: 0,
  platformFee: 0,
  withholdingAmount: 0,
  tipAmount: 0,
  netAmount: 0,
  pendingNetAmount: 0,
  availableNetAmount: 0,
  paidNetAmount: 0,
  currency: 'VND',
};

export default async function EarningsPage() {
  const [summary, earnings, payoutBatches] = await Promise.all([
    adminGet<AdminEarningSummary>('/admin/earnings/summary', emptySummary),
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
  ]);
  const sortedEarnings = sortEarnings(earnings);
  const payoutQueue = buildProviderPayoutQueue(sortedEarnings, payoutBatches);
  const cashDebtQueue = buildCashDebtQueue(sortedEarnings);
  const financeSignals = buildFinanceSignals(sortedEarnings, payoutBatches, payoutQueue, cashDebtQueue);

  const metrics = [
    ['Gross', summary.grossAmount],
    ['Platform fee', summary.platformFee],
    ['Tax withheld', summary.withholdingAmount],
    ['Tips', summary.tipAmount],
    ['Provider net', summary.netAmount],
    ['Pending net', summary.pendingNetAmount],
    ['Available net', summary.availableNetAmount],
    ['Paid net', summary.paidNetAmount],
  ];

  return (
    <>
      <h1>Provider Earnings</h1>
      <section className="grid">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>
              {formatMoney(Number(value), summary.currency)}
            </h2>
          </div>
        ))}
      </section>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Finance queue</h2>
            <p className="muted">
              Operator summary for provider payout readiness, batched earnings, tax logs, and stale pending revenue.
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

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Provider payout queue</h2>
            <p className="muted">
              Grouped by provider so finance can create one payout batch for all eligible unpaid earnings.
            </p>
          </div>
          <span className="pill pill-info">{payoutQueue.length} provider(s)</span>
        </div>
        {payoutQueue.length ? (
          <div className="setup-stage-list">
            {payoutQueue.slice(0, 12).map((group) => (
              <div className="setup-stage-item" key={group.providerProfileId}>
                <span>{group.status}</span>
                <div>
                  <strong>{group.providerName}</strong>
                  <p className="muted">
                    {group.unbatchedCount} unbatched earning(s) / net {formatMoney(group.unbatchedNet, group.currency)}
                    {' / '}withholding {formatMoney(group.withholdingAmount, group.currency)}
                  </p>
                  <p className="muted">
                    {group.activeBatch
                      ? `Existing batch ${shortId(group.activeBatch.id)} is ${group.activeBatch.status}.`
                      : group.nextAction}
                  </p>
                </div>
                <div className="actions">
                  <Link className="text-link" href={`/providers/${group.providerProfileId}`}>
                    Provider
                  </Link>
                  {group.canBatch ? (
                    <form action={createProviderPayout}>
                      <input type="hidden" name="providerProfileId" value={group.providerProfileId} />
                      <input type="hidden" name="transferRef" value={`HANDS-${shortId(group.providerProfileId)}`} />
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
          <p className="muted">No provider has unpaid earnings in the current admin result window.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash fee debt queue</h2>
            <p className="muted">
              Cash bookings create a negative provider wallet until the provider deposits the HANDS fee or finance offsets it.
            </p>
          </div>
          <span className={cashDebtQueue.length ? 'pill pill-danger' : 'pill pill-success'}>
            {cashDebtQueue.length} blocked wallet(s)
          </span>
        </div>
        {cashDebtQueue.length ? (
          <div className="setup-stage-list">
            {cashDebtQueue.slice(0, 12).map((item) => (
              <div className="setup-stage-item" key={item.earning.id}>
                <span>DEBT</span>
                <div>
                  <strong>{item.providerName}</strong>
                  <p className="muted">
                    Owes {formatMoney(Math.abs(item.earning.netAmount), item.earning.currency)} from booking{' '}
                    <Link className="text-link" href={`/bookings/${item.earning.bookingId}`}>
                      {shortId(item.earning.bookingId)}
                    </Link>
                    {' / '}payment {item.paymentMethod}
                  </p>
                  <p className="muted">
                    Platform fee {formatMoney(item.earning.platformFee, item.earning.currency)}
                    {' / '}tax {formatMoney(item.earning.withholdingAmount ?? 0, item.earning.currency)}
                  </p>
                </div>
                <div className="actions">
                  <Link className="text-link" href={`/providers/${item.earning.providerProfileId}`}>
                    Provider
                  </Link>
                  <form action={markEarningPaid}>
                    <input type="hidden" name="earningId" value={item.earning.id} />
                    <input
                      aria-label="Settlement reference"
                      name="settlementRef"
                      placeholder="Deposit ref or offset memo"
                    />
                    <input
                      type="hidden"
                      name="settlementNotes"
                      value="Cash fee debt settled from admin earnings queue"
                    />
                    <button type="submit">Mark fee settled</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No provider has unsettled cash fee debt in the current admin result window.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Recent earnings ledger</h2>
            <p className="muted">
              Raw earning rows remain visible for booking traceability, tax audit, and direct finance correction.
            </p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Booking</th>
              <th>Status</th>
              <th>Payout batch</th>
              <th>Gross / Fee / Tax / Tip</th>
              <th>Net</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedEarnings.map((earning) => (
              <tr key={earning.id}>
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
                  <div className="muted">{formatMoney(earning.tipAmount, earning.currency)} tip</div>
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
                        placeholder={isCashDebt(earning) ? 'Deposit ref or offset memo' : 'Transfer ref'}
                      />
                      <button type="submit">
                        {isCashDebt(earning) ? 'Mark fee settled' : 'Direct mark paid'}
                      </button>
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
    const scoreDiff = earningPriority(left) - earningPriority(right);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
  });
}

type ProviderPayoutQueueItem = {
  providerProfileId: string;
  providerName: string;
  currency: string;
  unbatchedCount: number;
  unbatchedNet: number;
  withholdingAmount: number;
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

type CashDebtQueueItem = {
  earning: AdminEarning;
  providerName: string;
  paymentMethod: string;
};

function buildCashDebtQueue(earnings: AdminEarning[]): CashDebtQueueItem[] {
  return earnings
    .filter((earning) => isCashDebt(earning))
    .map((earning) => ({
      earning,
      providerName: providerDisplayName(earning),
      paymentMethod: earning.booking?.payment?.method ?? 'CASH',
    }))
    .sort((left, right) => left.earning.netAmount - right.earning.netAmount);
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
    if (earning.netAmount <= 0) {
      return;
    }

    const existing = grouped.get(earning.providerProfileId);
    const activeBatch = activeBatchByProvider.get(earning.providerProfileId);
    const providerName = providerDisplayName(earning);
    const item =
      existing ??
      {
        providerProfileId: earning.providerProfileId,
        providerName,
        currency: earning.currency,
        unbatchedCount: 0,
        unbatchedNet: 0,
        withholdingAmount: 0,
        status: activeBatch ? 'BATCHED' : 'READY',
        canBatch: false,
        nextAction: 'Create a payout batch after finance review.',
        activeBatch,
      };

    item.withholdingAmount += earning.withholdingAmount ?? 0;
    if (!earning.payoutBatchId) {
      item.unbatchedCount += 1;
      item.unbatchedNet += earning.netAmount;
    }

    grouped.set(earning.providerProfileId, item);
  });

  return [...grouped.values()]
    .map((item) => {
      const canBatch = item.unbatchedCount > 0 && !item.activeBatch;
      return {
        ...item,
        canBatch,
        status: item.activeBatch ? 'BATCHED' : canBatch ? 'READY' : 'WAIT',
        nextAction: item.activeBatch
          ? 'Continue from payout batches before creating another batch.'
          : canBatch
            ? 'Create one batch for all currently eligible unpaid earnings.'
            : 'No unbatched earning is available for this provider.',
      };
    })
    .sort((left, right) => {
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
  const activeBatches = payoutBatches.filter((batch) => batch.status !== 'PAID' && batch.status !== 'CANCELLED');

  return [
    {
      title: 'Ready to batch',
      status: `${readyProviders.length} PROVIDER(S)`,
      detail: formatMoney(
        readyProviders.reduce((sum, item) => sum + item.unbatchedNet, 0),
        'VND',
      ),
      action: readyProviders.length ? 'Create batches from the provider queue below.' : 'No provider is ready to batch.',
      className: readyProviders.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: readyProviders.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Active batches',
      status: `${activeBatches.length} OPEN`,
      detail: formatMoney(activeBatches.reduce((sum, batch) => sum + batch.totalNetAmount, 0), 'VND'),
      action: activeBatches.length ? 'Move DRAFT/PROCESSING batches from payouts.' : 'No open payout batch.',
      className: activeBatches.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: activeBatches.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Batched unpaid rows',
      status: `${batchedUnpaid.length} ROW(S)`,
      detail: formatMoney(batchedUnpaid.reduce((sum, earning) => sum + earning.netAmount, 0), 'VND'),
      action: batchedUnpaid.length ? 'Follow the payout batch, not direct paid action.' : 'No batched unpaid row.',
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
        ? 'Confirm provider deposit or offset, then mark fee settled.'
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
  return earning.providerProfile?.displayName ?? earning.providerProfile?.user?.phone ?? 'Unknown provider';
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
    return 'Cash fee debt blocks provider wallet until settled';
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
    return `Fee policy: service payout matrix / provider payout ${formatMoney(
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
  const netCompanyFee =
    earning.platformFee - (earning.withholdingAmount ?? 0) - vatAmount - otherCostAmount;
  if (snapshot?.source === 'SERVICE_PAYOUT_RULE') {
    return `Net company fee after VAT/tax/cost: ${formatMoney(netCompanyFee, earning.currency)}`;
  }
  return `Net company fee estimate: ${formatMoney(netCompanyFee, earning.currency)}`;
}

function canDirectlyPay(earning: AdminEarning) {
  return earning.status !== 'PAID' && earning.status !== 'CANCELLED' && !earning.payoutBatchId;
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
