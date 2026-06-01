import Link from 'next/link';
import {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
  adminGet,
} from '../../lib/admin-api';
import {
  AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';

type FinanceCloseoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceCloseoutPage({ searchParams }: FinanceCloseoutPageProps) {
  const filters = buildFinanceCloseoutFilters(searchParams ? await searchParams : {});
  const [payments, refunds, earningsSummary, earnings, payouts, cashSummary] = await Promise.all([
    adminGet<AdminPayment[]>('/admin/payments', []),
    adminGet<AdminRefund[]>('/admin/refunds', []),
    adminGet<AdminEarningSummary>('/admin/earnings/summary', {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency: 'VND',
    }),
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
  ]);

  const currency = earningsSummary.currency || payments[0]?.currency || cashSummary?.currency || 'VND';
  const filteredRefunds = refunds.filter((refund) => isInDateRange(refund.createdAt, filters.range));
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const filteredPayouts = payouts.filter((batch) => isInDateRange(batch.createdAt, filters.range));
  const filteredEarningsSummary = summarizeEarnings(filteredEarnings, currency);
  const reconciliation = buildReconciliation({
    payments,
    refunds: filteredRefunds,
    earningsSummary: filteredEarningsSummary,
    earnings: filteredEarnings,
    payouts: filteredPayouts,
    cashSummary,
    currency,
    range: filters.range,
  });
  const closeoutTasks = buildCloseoutTasks(reconciliation);
  const handoffRows = buildHandoffRows(reconciliation);

  return (
    <>
      <h1>Finance Closeout</h1>
      <p className="muted">
        End-of-shift reconciliation board for payment holds, refunds, earnings, cash wallet debt, and payout
        releases. This page does not judge customers or partners; it only shows factual money-flow records
        that operators must check before handoff.
      </p>

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Finance date range</h2>
            <p className="muted">
              Range: {filters.label}. Refunds, earnings, payout batches, and local cash debt use record dates.
              Payment hold rows remain all-time until payment timestamps are exposed by the API.
            </p>
          </div>
          <Link className="text-link" href="/audit-log?bucket=Finance%2FCloseout">
            Open finance audit
          </Link>
        </div>
        <div className="filter-row" style={{ marginTop: 12 }}>
          {[
            ['All records', '/finance-closeout'],
            ['Today', '/finance-closeout?range=today'],
            ['Last 7 days', '/finance-closeout?range=7d'],
            ['Last 30 days', '/finance-closeout?range=30d'],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="card">
          <p>Open payment items</p>
          <h2>{reconciliation.openPaymentCount}</h2>
        </div>
        <div className="card">
          <p>Refund items</p>
          <h2>{reconciliation.openRefundCount}</h2>
        </div>
        <div className="card">
          <p>Cash debt</p>
          <h2>{formatMoney(reconciliation.cashDebtAmount, currency)}</h2>
        </div>
        <div className="card">
          <p>Available payout</p>
          <h2>{formatMoney(filteredEarningsSummary.availableNetAmount, currency)}</h2>
        </div>
        <div className="card">
          <p>Open payout batches</p>
          <h2>{reconciliation.openPayoutCount}</h2>
        </div>
        <div className="card">
          <p>Missing refs</p>
          <h2>{reconciliation.missingReferenceCount}</h2>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Closeout reconciliation board</h2>
            <p className="muted">
              One pass across the finance queues. Work the red and yellow cards first, then leave a handoff
              note from Operations Handoff.
            </p>
          </div>
          <Link className="text-link" href="/operations-handoff">
            Open handoff
          </Link>
        </div>
        <div className="ops-task-grid">
          {closeoutTasks.map((task) => (
            <Link className={`ops-task-card ${task.className}`} href={task.href} key={task.title}>
              <div>
                <span className={`pill ${task.pillClass}`}>{task.status}</span>
                <h3>{task.title}</h3>
                <p className="muted">{task.detail}</p>
              </div>
              <small>{task.action}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payment-to-earning checks</h2>
            <p className="muted">
              Confirms that completed services have earning records, captured payments, or a cash settlement
              trail. Cash jobs with negative wallet balance stay visible until settled.
            </p>
          </div>
          <Link className="text-link" href="/earnings">
            Open earnings
          </Link>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Gross represented</span>
            <strong>{formatMoney(filteredEarningsSummary.grossAmount, currency)}</strong>
            <small>{filteredEarningsSummary.count} earning record(s)</small>
          </div>
          <div>
            <span>HANDS fee</span>
            <strong>{formatMoney(filteredEarningsSummary.platformFee, currency)}</strong>
            <small>Before VAT, withholding, and other cost views.</small>
          </div>
          <div>
            <span>Tax withheld</span>
            <strong>{formatMoney(filteredEarningsSummary.withholdingAmount, currency)}</strong>
            <small>Stored from active tax policy snapshots.</small>
          </div>
          <div>
            <span>Pending partner net</span>
            <strong>{formatMoney(filteredEarningsSummary.pendingNetAmount, currency)}</strong>
            <small>Positive payout or negative cash-fee debt.</small>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Cash debt handoff</h2>
            <p className="muted">
              Negative wallet balances are factual settlement rows. Partners can stay visible, but final
              acceptance waits until the company fee or approved offset is recorded.
            </p>
          </div>
          <Link className="text-link" href="/cash-settlements">
            Open cash settlements
          </Link>
        </div>
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <InfoTile label="Final-gate partners" value={(cashSummary?.providerCount ?? 0).toString()} />
          <InfoTile label="Open cash rows" value={(cashSummary?.rowCount ?? 0).toString()} />
          <InfoTile label="Wallet debt" value={formatMoney(reconciliation.cashDebtAmount, currency)} />
          <InfoTile
            label="Oldest open"
            value={cashSummary?.oldestOpenAt ? relativeTime(cashSummary.oldestOpenAt) : '-'}
          />
        </div>
      </section>

      <section className="card" style={{ overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout release checks</h2>
            <p className="muted">
              Transfer refs, earnings, tax logs, and open holds should be checked before a batch moves to
              paid. Use this as the final finance handoff list.
            </p>
          </div>
          <Link className="text-link" href="/payouts">
            Open payouts
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Count</th>
              <th>Amount</th>
              <th>Next action</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {handoffRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.count}</td>
                <td>{row.amount}</td>
                <td>{row.nextAction}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open queue
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

type ReconciliationInput = {
  payments: AdminPayment[];
  refunds: AdminRefund[];
  earningsSummary: AdminEarningSummary;
  earnings: AdminEarning[];
  payouts: AdminPayoutBatch[];
  cashSummary: AdminCashSettlementSummary | null;
  currency: string;
  range: AdminDateRange;
};

function buildReconciliation(input: ReconciliationInput) {
  const authorizedPayments = input.payments.filter((payment) => payment.status === 'AUTHORIZED');
  const cashPending = input.payments.filter(
    (payment) => payment.method === 'CASH' && payment.status === 'PENDING',
  );
  const missingPaymentRefs = input.payments.filter(
    (payment) =>
      ['AUTHORIZED', 'PENDING'].includes(payment.status) && !payment.providerRef && payment.method !== 'CASH',
  );
  const openRefunds = input.refunds.filter((refund) => refund.status !== 'COMPLETED');
  const openPayouts = input.payouts.filter((batch) => !['PAID', 'CANCELLED'].includes(batch.status));
  const payoutMissingRefs = input.payouts.filter(
    (batch) => ['PROCESSING', 'PAID'].includes(batch.status) && !batch.transferRef,
  );
  const earningsWithoutTaxLogs = input.earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const rangedCashDebtAmount = input.earnings
    .filter((earning) => earning.netAmount < 0 && earning.status !== 'PAID')
    .reduce((sum, earning) => sum + Math.abs(earning.netAmount), 0);

  return {
    authorizedPayments,
    cashPending,
    missingPaymentRefs,
    openRefunds,
    openPayouts,
    payoutMissingRefs,
    earningsWithoutTaxLogs,
    openPaymentCount: authorizedPayments.length + cashPending.length,
    openRefundCount: openRefunds.length,
    openPayoutCount: openPayouts.length,
    cashDebtAmount:
      input.range === 'all'
        ? (input.cashSummary?.totalDebtAmount ?? Math.abs(Math.min(0, input.earningsSummary.netAmount)))
        : rangedCashDebtAmount,
    missingReferenceCount: missingPaymentRefs.length + payoutMissingRefs.length,
    currency: input.currency,
  };
}

function buildCloseoutTasks(reconciliation: ReturnType<typeof buildReconciliation>) {
  return [
    {
      title: 'Payment hold review',
      status: `${reconciliation.authorizedPayments.length} HOLD(S)`,
      detail:
        'Authorized payments should remain held until service completion, then capture, release, or refund.',
      action: reconciliation.authorizedPayments.length
        ? 'Open payment holds before handoff.'
        : 'No open holds.',
      href: '/payments?review=authorized',
      className: reconciliation.authorizedPayments.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.authorizedPayments.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Cash collection review',
      status: `${reconciliation.cashPending.length} CASH`,
      detail:
        'Cash bookings need confirmation that the partner collected customer cash and the wallet debt is recorded.',
      action: reconciliation.cashPending.length
        ? 'Confirm cash rows and wallet ledger.'
        : 'No pending cash collection.',
      href: '/payments?review=cash',
      className: reconciliation.cashPending.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.cashPending.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Refund queue',
      status: `${reconciliation.openRefunds.length} OPEN`,
      detail: 'Refund cases need payment ledger state, customer message, and booking closeout alignment.',
      action: reconciliation.openRefunds.length ? 'Resolve requested refunds.' : 'No open refund cases.',
      href: '/refunds?review=open',
      className: reconciliation.openRefunds.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliation.openRefunds.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Missing references',
      status: `${reconciliation.missingReferenceCount} CHECK`,
      detail: 'Gateway and transfer references are required for auditable finance handoff.',
      action: reconciliation.missingReferenceCount
        ? 'Fill missing payment or payout references.'
        : 'References look complete.',
      href: '/payments?review=missing-ref',
      className: reconciliation.missingReferenceCount ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.missingReferenceCount ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payout release review',
      status: `${reconciliation.openPayouts.length} BATCH(ES)`,
      detail:
        'Open payout batches should be checked against earnings, tax logs, transfer refs, and active holds.',
      action: reconciliation.openPayouts.length
        ? 'Review payout blockers before bank transfer.'
        : 'No open payout batch.',
      href: '/payouts',
      className: reconciliation.openPayouts.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.openPayouts.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Tax log coverage',
      status: `${reconciliation.earningsWithoutTaxLogs.length} ROW(S)`,
      detail:
        'Completed earnings should carry a tax snapshot so later policy changes do not rewrite history.',
      action: reconciliation.earningsWithoutTaxLogs.length
        ? 'Check earnings without tax logs.'
        : 'Tax snapshots are present.',
      href: '/earnings',
      className: reconciliation.earningsWithoutTaxLogs.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: reconciliation.earningsWithoutTaxLogs.length ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildHandoffRows(reconciliation: ReturnType<typeof buildReconciliation>) {
  return [
    {
      label: 'Payment holds',
      count: reconciliation.authorizedPayments.length,
      amount: formatMoney(
        reconciliation.authorizedPayments.reduce((sum, payment) => sum + payment.amount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Capture after service completion or release/refund if the booking fails.',
      href: '/payments?review=authorized',
    },
    {
      label: 'Refunds',
      count: reconciliation.openRefunds.length,
      amount: formatMoney(
        reconciliation.openRefunds.reduce((sum, refund) => sum + refund.amount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Keep payment ledger, booking status, and customer message aligned.',
      href: '/refunds?review=open',
    },
    {
      label: 'Cash wallet debt',
      count: reconciliation.cashPending.length,
      amount: formatMoney(reconciliation.cashDebtAmount, reconciliation.currency),
      nextAction: 'Collect partner deposit or approve documented offset before final acceptance or customer selection.',
      href: '/cash-settlements',
    },
    {
      label: 'Payout batches',
      count: reconciliation.openPayouts.length,
      amount: formatMoney(
        reconciliation.openPayouts.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
        reconciliation.currency,
      ),
      nextAction: 'Verify transfer ref, earnings, withholding logs, and partner account state.',
      href: '/payouts',
    },
  ];
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="muted">{label}</span>
      <h3>{value}</h3>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function buildFinanceCloseoutFilters(params: Record<string, string | string[] | undefined>) {
  const range = normalizeDateRange(readSearchParam(params.range));
  return {
    range,
    label: dateRangeLabel(range),
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

function relativeTime(value: string) {
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
