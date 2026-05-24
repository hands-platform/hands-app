import { AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { markPayoutFailed, markPayoutPaid, markPayoutProcessing, updatePayoutTransferRef } from './actions';

export default async function PayoutsPage() {
  const batches = sortBatches(await adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []));
  const summary = buildSummary(batches);
  const commandSignals = buildPayoutCommandSignals(batches);
  const payoutLanes = buildPayoutLanes(batches);

  return (
    <>
      <h1>Provider Payouts</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total batches</p>
          <h2>{summary.total}</h2>
        </div>
        <div className="card">
          <p>Needs review</p>
          <h2>{summary.needsReview}</h2>
        </div>
        <div className="card">
          <p>In progress</p>
          <h2>{summary.inProgress}</h2>
        </div>
        <div className="card">
          <p>Payout holds</p>
          <h2>{summary.payoutHolds}</h2>
        </div>
        <div className="card">
          <p>Settled</p>
          <h2>{summary.settled}</h2>
        </div>
        <div className="card">
          <p>Total net</p>
          <h2>{formatMoney(summary.totalNetAmount, summary.currency)}</h2>
        </div>
        <div className="card">
          <p>Withheld tax</p>
          <h2>{formatMoney(summary.withholdingAmount, summary.currency)}</h2>
        </div>
      </section>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout command queue</h2>
            <p className="muted">
              Finance-first view for review money, active transfers, payout holds, and reconciliation warnings.
            </p>
          </div>
          <a className="text-link" href="/earnings">
            Review earnings queue
          </a>
        </div>
        <div className="ops-task-grid">
          {commandSignals.map((signal) => (
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Payout status lanes</h2>
            <p className="muted">
              Work from blocked and failed lanes first, then draft review, processing confirmation, and paid reconciliation.
            </p>
          </div>
          <span className="pill pill-info">{batches.length} batch(es)</span>
        </div>
        <div className="detail-grid" style={{ marginTop: 16 }}>
          {payoutLanes.map((lane) => (
            <div key={lane.title}>
              <div className="risk-watch-header">
                <h3>{lane.title}</h3>
                <span className={`pill ${lane.pillClass}`}>{lane.batches.length}</span>
              </div>
              {lane.batches.length ? (
                <div className="setup-stage-list">
                  {lane.batches.slice(0, 4).map((batch) => (
                    <div className="setup-stage-item" key={`${lane.title}-${batch.id}`}>
                      <span>{shortId(batch.id)}</span>
                      <div>
                        <strong>
                          {batch.providerProfile?.displayName ??
                            batch.providerProfile?.user?.phone ??
                            'Unknown provider'}
                        </strong>
                        <p className="muted">
                          {formatMoney(batch.totalNetAmount, batch.currency)} / {batch.earnings?.length ?? 0} earning(s)
                        </p>
                        <p className="muted">{opsHint(batch)}</p>
                      </div>
                      <a className="text-link" href={`#${batch.id}`}>
                        Row
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">{lane.emptyText}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">
              Provider settlement batches ordered so unresolved money movement stays at the top.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">Newest active first</span>
            <span className="pill pill-info">Payout signal</span>
            <span className="pill pill-warn">Reconciliation</span>
            <a className="pill" href="/earnings">
              Review earnings
            </a>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Ops signal</th>
              <th>Transfer ref</th>
              <th>Earnings</th>
              <th>Checklist</th>
              <th>Total</th>
              <th>Tax withheld</th>
              <th>Paid at</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const checklist = payoutChecklist(batch);
              const payoutHold = activePayoutHold(batch);
              return (
                <tr id={batch.id} key={batch.id}>
                  <td>
                    <div>{shortId(batch.id)}</div>
                    <div className="muted">{relativeTime(batch.createdAt)}</div>
                  </td>
                  <td>
                    <div>
                      {batch.providerProfile?.displayName ?? batch.providerProfile?.user?.phone ?? 'Unknown'}
                    </div>
                    <div className="muted">{batch.providerProfile?.user?.phone ?? 'No phone on file'}</div>
                    {payoutHold && (
                      <div style={{ marginTop: 6 }}>
                        <span className="pill pill-danger">Payout hold</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{humanizeStatus(batch.status)}</div>
                    <div className="muted">{payoutPhase(batch.status)}</div>
                  </td>
                  <td>
                    <span className={payoutHold ? 'signal signal-warn' : signalClass(batch.status)}>
                      {opsSignal(batch)}
                    </span>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {opsHint(batch)}
                    </div>
                  </td>
                  <td>
                    <div>{batch.transferRef ?? '-'}</div>
                    <div className="muted">{batch.notes?.trim() ? batch.notes : 'No transfer notes'}</div>
                  </td>
                  <td>
                    <div>{batch.earnings?.length ?? 0} item(s)</div>
                    <div className="muted">{earningsStatusHint(batch)}</div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {checklist.map((item) => (
                        <span className={item.ok ? 'pill pill-success' : 'pill pill-warn'} key={item.label}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{formatMoney(batch.totalNetAmount, batch.currency)}</td>
                  <td>
                    <div>{formatMoney(batchWithholdingAmount(batch), batch.currency)}</div>
                    <div className="muted">{batch.withholdingLogs?.length ?? 0} tax log(s)</div>
                  </td>
                  <td>
                    <div>{batch.paidAt ? new Date(batch.paidAt).toLocaleString() : '-'}</div>
                    <div className="muted">
                      {batch.paidAt ? relativeTime(batch.paidAt) : 'Awaiting settlement'}
                    </div>
                  </td>
                  <td>
                    <form className="actions" action={updatePayoutTransferRef}>
                      <input type="hidden" name="payoutBatchId" value={batch.id} />
                      <input
                        aria-label="Transfer reference"
                        name="transferRef"
                        placeholder="Bank ref"
                        defaultValue={batch.transferRef ?? ''}
                      />
                      <input
                        aria-label="Transfer notes"
                        name="notes"
                        placeholder="Notes"
                        defaultValue={batch.notes ?? ''}
                      />
                      <button type="submit">Save</button>
                    </form>
                    <div className="actions" style={{ marginTop: 8 }}>
                      {batch.status === 'DRAFT' && (
                        <PayoutStatusForm
                          action={markPayoutProcessing}
                          batch={batch}
                          disabled={Boolean(payoutHold)}
                          label="Processing"
                        />
                      )}
                      {batch.status !== 'PAID' && batch.status !== 'CANCELLED' && (
                        <PayoutStatusForm
                          action={markPayoutPaid}
                          batch={batch}
                          disabled={Boolean(payoutHold)}
                          label="Paid"
                        />
                      )}
                      {batch.status === 'PROCESSING' && (
                        <PayoutStatusForm action={markPayoutFailed} batch={batch} label="Failed" />
                      )}
                      {payoutHold && (
                        <a className="pill pill-danger" href={`/providers/${batch.providerProfileId}`}>
                          Open provider risk
                        </a>
                      )}
                      {(batch.status === 'PAID' || batch.status === 'CANCELLED') && (
                        <span className="muted">No status action</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={11}>No payout batches loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PayoutStatusForm({
  action,
  batch,
  disabled,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  batch: AdminPayoutBatch;
  disabled?: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="payoutBatchId" value={batch.id} />
      <input type="hidden" name="transferRef" value={batch.transferRef ?? ''} />
      <button disabled={disabled} type="submit">
        {label}
      </button>
    </form>
  );
}

function sortBatches(batches: AdminPayoutBatch[]) {
  return [...batches].sort((left, right) => {
    const scoreDiff = payoutPriority(left.status) - payoutPriority(right.status);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function payoutPriority(status: string) {
  switch (status) {
    case 'FAILED':
      return 0;
    case 'DRAFT':
      return 1;
    case 'PROCESSING':
      return 2;
    case 'PAID':
      return 3;
    case 'CANCELLED':
      return 4;
    default:
      return 5;
  }
}

function buildSummary(batches: AdminPayoutBatch[]) {
  const currency = batches[0]?.currency ?? 'VND';
  return {
    total: batches.length,
    needsReview: batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED').length,
    inProgress: batches.filter((batch) => batch.status === 'PROCESSING').length,
    payoutHolds: batches.filter((batch) => Boolean(activePayoutHold(batch))).length,
    settled: batches.filter((batch) => batch.status === 'PAID').length,
    totalNetAmount: batches.reduce((sum, batch) => sum + batch.totalNetAmount, 0),
    withholdingAmount: batches.reduce((sum, batch) => sum + batchWithholdingAmount(batch), 0),
    currency,
  };
}

type PayoutCommandSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type PayoutLane = {
  title: string;
  batches: AdminPayoutBatch[];
  pillClass: string;
  emptyText: string;
};

function buildPayoutCommandSignals(batches: AdminPayoutBatch[]): PayoutCommandSignal[] {
  const needsReview = batches.filter((batch) => batch.status === 'DRAFT' || batch.status === 'FAILED');
  const processing = batches.filter((batch) => batch.status === 'PROCESSING');
  const held = batches.filter((batch) => Boolean(activePayoutHold(batch)));
  const missingTransferRef = batches.filter((batch) => batch.status === 'PAID' && !batch.transferRef);
  const missingEarnings = batches.filter((batch) => !batch.earnings?.length);
  const pendingWithholding = batches.filter((batch) =>
    (batch.withholdingLogs ?? []).some((log) => log.status !== 'PAID'),
  );
  const reconciliationWarnings = missingTransferRef.length + missingEarnings.length + pendingWithholding.length;
  const currency = batches[0]?.currency ?? 'VND';

  return [
    {
      title: 'Review amount',
      status: `${needsReview.length} BATCH(ES)`,
      detail: formatMoney(needsReview.reduce((sum, batch) => sum + batch.totalNetAmount, 0), currency),
      action: needsReview.length
        ? 'Check failed and draft batches before starting bank transfer.'
        : 'No batch currently needs finance review.',
      className: needsReview.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: needsReview.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Banking in motion',
      status: `${processing.length} PROCESSING`,
      detail: formatMoney(processing.reduce((sum, batch) => sum + batch.totalNetAmount, 0), currency),
      action: processing.length
        ? 'Confirm transfer results, then mark paid or failed.'
        : 'No payout is currently in banking transfer.',
      className: processing.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: processing.length ? 'pill-info' : 'pill-success',
    },
    {
      title: 'Payout holds',
      status: `${held.length} HELD`,
      detail: held.length
        ? held.map((batch) => activePayoutHold(batch)?.reason ?? 'Active hold').slice(0, 2).join(' ')
        : 'No active payout hold on listed batches.',
      action: held.length ? 'Open provider risk before attempting payout.' : 'No risk hold action.',
      className: held.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: held.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Reconciliation',
      status: `${reconciliationWarnings} CHECK`,
      detail: `${missingTransferRef.length} paid missing ref, ${pendingWithholding.length} tax open, ${missingEarnings.length} empty batch.`,
      action: reconciliationWarnings
        ? 'Fix references, withholding status, or empty batch records.'
        : 'Paid batch references and tax logs look consistent.',
      className: reconciliationWarnings ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: reconciliationWarnings ? 'pill-danger' : 'pill-success',
    },
  ];
}

function buildPayoutLanes(batches: AdminPayoutBatch[]): PayoutLane[] {
  return [
    {
      title: 'Blocked by hold',
      batches: batches.filter((batch) => Boolean(activePayoutHold(batch))),
      pillClass: 'pill-danger',
      emptyText: 'No active payout hold in the current payout list.',
    },
    {
      title: 'Failed recovery',
      batches: batches.filter((batch) => batch.status === 'FAILED'),
      pillClass: 'pill-warn',
      emptyText: 'No failed batch needs recovery.',
    },
    {
      title: 'Draft review',
      batches: batches.filter((batch) => batch.status === 'DRAFT' && !activePayoutHold(batch)),
      pillClass: 'pill-warn',
      emptyText: 'No draft batch is waiting for review.',
    },
    {
      title: 'Processing confirmation',
      batches: batches.filter((batch) => batch.status === 'PROCESSING' && !activePayoutHold(batch)),
      pillClass: 'pill-info',
      emptyText: 'No bank transfer is currently in progress.',
    },
    {
      title: 'Paid reconciliation',
      batches: batches.filter((batch) => batch.status === 'PAID'),
      pillClass: 'pill-success',
      emptyText: 'No paid batch is available for reconciliation yet.',
    },
    {
      title: 'Cancelled archive',
      batches: batches.filter((batch) => batch.status === 'CANCELLED'),
      pillClass: 'pill-neutral',
      emptyText: 'No cancelled payout batch is in the current list.',
    },
  ];
}

function batchWithholdingAmount(batch: AdminPayoutBatch) {
  if (batch.withholdingLogs?.length) {
    return batch.withholdingLogs.reduce((sum, log) => sum + log.amount, 0);
  }
  return (batch.earnings ?? []).reduce((sum, earning) => sum + (earning.withholdingAmount ?? 0), 0);
}

function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function payoutPhase(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Waiting for finance review';
    case 'PROCESSING':
      return 'Transfer is in motion';
    case 'PAID':
      return 'Settlement finished';
    case 'FAILED':
      return 'Needs payout recovery';
    case 'CANCELLED':
      return 'Batch was stopped';
    default:
      return 'Monitor this payout batch';
  }
}

function signalClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'signal signal-ok';
    case 'PROCESSING':
      return 'signal signal-info';
    case 'DRAFT':
    case 'FAILED':
      return 'signal signal-warn';
    default:
      return 'signal';
  }
}

function opsSignal(batch: AdminPayoutBatch) {
  if (activePayoutHold(batch)) {
    return 'Payout hold';
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Needs review';
    case 'PROCESSING':
      return 'Transfer in progress';
    case 'PAID':
      return batch.transferRef ? 'Settled' : 'Settled, missing ref';
    case 'FAILED':
      return 'Retry payout';
    case 'CANCELLED':
      return 'Stopped';
    default:
      return 'Monitor';
  }
}

function opsHint(batch: AdminPayoutBatch) {
  const payoutHold = activePayoutHold(batch);
  if (payoutHold) {
    return `Finance actions are locked until this active sanction is lifted: ${payoutHold.reason}`;
  }
  switch (batch.status) {
    case 'DRAFT':
      return 'Check included earnings, confirm the therapist, and release only if totals look right.';
    case 'PROCESSING':
      return 'Watch for banking confirmation before marking the batch complete.';
    case 'PAID':
      return batch.transferRef
        ? 'Payment already landed. Keep this for reconciliation and support follow-up.'
        : 'Payment is marked paid but still needs a banking transfer reference.';
    case 'FAILED':
      return 'Review transfer notes and retry path before earnings age further.';
    case 'CANCELLED':
      return 'Make sure related earnings are reassigned or rebatched if still payable.';
    default:
      return 'Use this row to understand payout readiness and reconcile provider earnings.';
  }
}

function earningsStatusHint(batch: AdminPayoutBatch) {
  if (!batch.earnings?.length) {
    return 'No earnings attached';
  }
  const payoutLinked = batch.earnings.filter((earning) => earning.payoutBatchId === batch.id).length;
  return `${payoutLinked}/${batch.earnings.length} linked to this batch`;
}

function payoutChecklist(batch: AdminPayoutBatch) {
  const earnings = batch.earnings ?? [];
  const allEarningsPaid = earnings.length > 0 && earnings.every((earning) => earning.status === 'PAID');
  const payoutHold = activePayoutHold(batch);
  return [
    { label: payoutHold ? 'Held' : 'No hold', ok: !payoutHold },
    { label: batch.transferRef ? 'Ref' : 'No ref', ok: Boolean(batch.transferRef) },
    { label: allEarningsPaid ? 'Earnings paid' : 'Earnings open', ok: allEarningsPaid },
    { label: batch.paidAt ? 'Paid date' : 'No paid date', ok: Boolean(batch.paidAt) },
  ];
}

function activePayoutHold(batch: AdminPayoutBatch) {
  return batch.providerProfile?.sanctions?.find(
    (sanction) => sanction.type === 'PAYOUT_HOLD' && sanction.status === 'ACTIVE',
  );
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function relativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) {
    return 'Unknown time';
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
