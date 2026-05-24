import { AdminEarning, AdminEarningSummary, adminGet } from '../../lib/admin-api';
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
  const [summary, earnings] = await Promise.all([
    adminGet<AdminEarningSummary>('/admin/earnings/summary', emptySummary),
    adminGet<AdminEarning[]>('/admin/earnings', []),
  ]);
  const sortedEarnings = sortEarnings(earnings);

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
              {value} {summary.currency}
            </h2>
          </div>
        ))}
      </section>
      <div className="card" style={{ marginTop: 20 }}>
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
                      <button type="submit">Direct mark paid</button>
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

function earningPriority(earning: AdminEarning) {
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

function canDirectlyPay(earning: AdminEarning) {
  return earning.status !== 'PAID' && earning.status !== 'CANCELLED' && !earning.payoutBatchId;
}

function canCreatePayout(earning: AdminEarning) {
  return (
    Boolean(earning.providerProfile) &&
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
